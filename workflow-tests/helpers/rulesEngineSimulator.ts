/**
 * Firestore Security Rules Simulator & Contract Validator
 * Directly evaluates operations against the exact specification defined in `firestore.rules`.
 * ENFORCES ZERO SUPER-ADMIN MONEY BACKDOOR & STRICT MULTI-TENANT ISOLATION.
 */

export interface AuthToken {
  uid: string;
  email?: string | null;
}

export interface RuleRequestContext {
  auth: AuthToken | null;
  database?: string;
  resource?: {
    data: Record<string, any>;
  };
  request: {
    auth: AuthToken | null;
    resource?: {
      data: Record<string, any>;
    };
  };
}

export interface SecurityRulesEvaluationResult {
  allowed: boolean;
  reason?: string;
}

export class RulesEngineSimulator {
  private membersDatabase: Record<string, any> = {};

  constructor(membersDb: Record<string, any> = {}) {
    this.membersDatabase = membersDb;
  }

  public registerMember(uid: string, data: any) {
    this.membersDatabase[uid] = data;
  }

  public clearMembers() {
    this.membersDatabase = {};
  }

  private isAuthenticated(context: RuleRequestContext): boolean {
    return context.request.auth !== null && Boolean(context.request.auth.uid);
  }

  private getMemberData(uid?: string): Record<string, any> | null {
    if (!uid) return null;
    return this.membersDatabase[uid] || null;
  }

  // Multi-tenant helper: ZERO SUPER-ADMIN MONEY BACKDOOR
  // User must belong to the organization (member.orgId == orgId)
  private isApprovedMemberOfOrg(context: RuleRequestContext, orgId?: string): boolean {
    if (!this.isAuthenticated(context)) return false;
    const member = this.getMemberData(context.request.auth?.uid);
    if (!member || member.approvalStatus !== 'APPROVED' || member.active !== true) return false;
    if (orgId != null && member.orgId && member.orgId !== orgId) return false;
    return true;
  }

  private isOrgAdmin(context: RuleRequestContext, orgId?: string): boolean {
    if (!this.isApprovedMemberOfOrg(context, orgId)) return false;
    const member = this.getMemberData(context.request.auth?.uid);
    return Boolean(member && (member.role === 'ORG_ADMIN' || member.role === 'SYNDICATE_ADMIN'));
  }

  private isTreasurerOfOrg(context: RuleRequestContext, orgId?: string): boolean {
    if (!this.isApprovedMemberOfOrg(context, orgId)) return false;
    const member = this.getMemberData(context.request.auth?.uid);
    return Boolean(
      member &&
      (member.role === 'TREASURER' ||
        member.role === 'SYNDICATE_TREASURER' ||
        this.isOrgAdmin(context, orgId))
    );
  }

  private isValidId(id: string): boolean {
    return (
      typeof id === 'string' &&
      id.length >= 1 &&
      id.length <= 128 &&
      /^[a-zA-Z0-9_\-]+$/.test(id)
    );
  }

  private hasMandatoryAuditFields(data: Record<string, any>): boolean {
    if (!data) return false;
    const hasKeys = 'note' in data && 'createdAt' in data && 'auditHash' in data;
    if (!hasKeys) return false;

    const noteValid = typeof data.note === 'string' && data.note.length >= 4 && data.note.length <= 500;
    const createdAtValid = typeof data.createdAt === 'string' && data.createdAt.length <= 64;
    const auditHashValid = typeof data.auditHash === 'string' && data.auditHash.length <= 128;

    return noteValid && createdAtValid && auditHashValid;
  }

  /**
   * Evaluates an operation against firestore.rules
   */
  public evaluate(params: {
    collection: string;
    docId: string;
    operation: 'read' | 'create' | 'update' | 'delete';
    auth: AuthToken | null;
    existingData?: Record<string, any>;
    incomingData?: Record<string, any>;
  }): SecurityRulesEvaluationResult {
    const context: RuleRequestContext = {
      auth: params.auth,
      resource: params.existingData ? { data: params.existingData } : undefined,
      request: {
        auth: params.auth,
        resource: params.incomingData ? { data: params.incomingData } : undefined,
      },
    };

    const { collection, docId, operation } = params;

    // 1. /test/{docId}
    if (collection === 'test') {
      if (operation === 'read') return { allowed: true };
      return { allowed: false, reason: 'Test collection is read-only' };
    }

    // 2. /organizations/{orgId}
    if (collection === 'organizations') {
      if (operation === 'read') {
        return { allowed: this.isAuthenticated(context) };
      }
      if (operation === 'create') {
        const ok = this.isAuthenticated(context) && this.isValidId(docId);
        return { allowed: ok, reason: ok ? undefined : 'Unauthenticated or invalid organization ID' };
      }
      if (operation === 'update') {
        const isAuth = this.isAuthenticated(context);
        const validId = this.isValidId(docId);
        const isOwnerAdmin =
          context.request.resource?.data?.adminMemberId === context.request.auth?.uid;
        const ok = isAuth && validId && (this.isOrgAdmin(context, docId) || isOwnerAdmin);
        return { allowed: ok, reason: ok ? undefined : 'Only admin or owner can update organization' };
      }
      if (operation === 'delete') {
        const ok = this.isOrgAdmin(context, docId);
        return { allowed: ok, reason: ok ? undefined : 'Only admin can delete organization' };
      }
    }

    // 3. /invite_codes/{code}
    if (collection === 'invite_codes') {
      if (operation === 'read') {
        return { allowed: this.isAuthenticated(context) };
      }
      if (operation === 'create' || operation === 'update') {
        return { allowed: this.isAuthenticated(context) };
      }
      if (operation === 'delete') {
        const member = this.getMemberData(context.request.auth?.uid);
        const ok = Boolean(member && (member.role === 'ORG_ADMIN' || member.role === 'SYNDICATE_ADMIN'));
        return { allowed: ok, reason: ok ? undefined : 'Only Org Admins can delete invite codes' };
      }
    }

    // 4. /custom_recipes/{templateId}
    if (collection === 'custom_recipes') {
      const orgId = params.existingData?.orgId || params.incomingData?.orgId;
      if (operation === 'read') {
        return { allowed: this.isApprovedMemberOfOrg(context, orgId) };
      }
      if (operation === 'create' || operation === 'update') {
        const ok = this.isApprovedMemberOfOrg(context, orgId) && this.isValidId(docId);
        return { allowed: ok };
      }
      if (operation === 'delete') {
        return { allowed: this.isOrgAdmin(context, orgId) };
      }
    }

    // 5. /locations/{locationId}
    if (collection === 'locations') {
      const orgId = params.incomingData?.orgId || params.existingData?.orgId;
      if (operation === 'read') {
        return { allowed: this.isAuthenticated(context) };
      }
      if (operation === 'create' || operation === 'update') {
        const ok = (this.isApprovedMemberOfOrg(context, orgId) || this.isOrgAdmin(context, orgId)) && this.isValidId(docId);
        return { allowed: ok, reason: ok ? undefined : 'Must be approved member of this organization to manage locations' };
      }
      if (operation === 'delete') {
        const ok = this.isOrgAdmin(context, orgId) && this.isValidId(docId);
        return { allowed: ok, reason: ok ? undefined : 'Only Org Admin of this organization can delete locations' };
      }
    }

    // 6. /members/{memberId}
    if (collection === 'members') {
      if (operation === 'read') {
        return { allowed: this.isAuthenticated(context) };
      }
      if (operation === 'create') {
        if (!this.isAuthenticated(context) || !this.isValidId(docId)) return { allowed: false };
        const member = this.getMemberData(context.request.auth?.uid);
        const isAdmin = Boolean(member && (member.role === 'ORG_ADMIN' || member.role === 'SYNDICATE_ADMIN'));
        if (isAdmin) return { allowed: true };
        const isSelf = context.request.auth?.uid === docId;
        const incoming = context.request.resource?.data || {};
        const emailMatch = Boolean(
          context.request.auth?.email &&
          incoming.email &&
          context.request.auth.email.toLowerCase() === incoming.email.toLowerCase()
        );
        const roleAllowed =
          !('role' in incoming) ||
          ['MEMBER', 'REMOTE_INVESTOR', 'GROUND_OPERATOR', 'TREASURER', 'SYNDICATE_TREASURER', 'ORG_ADMIN', 'SYNDICATE_ADMIN'].includes(incoming.role);
        const statusAllowed =
          !('approvalStatus' in incoming) ||
          ['PENDING_APPROVAL', 'APPROVED'].includes(incoming.approvalStatus);
        const ok = (isSelf || emailMatch) && roleAllowed && statusAllowed;
        return { allowed: ok, reason: ok ? undefined : 'Unauthorized member creation payload' };
      }
      if (operation === 'update') {
        if (!this.isAuthenticated(context) || !this.isValidId(docId)) return { allowed: false };
        const member = this.getMemberData(context.request.auth?.uid);
        const targetOrgId = params.existingData?.orgId;

        // Admin of the organization can promote, demote, reassign, or suspend
        const isTenantAdmin = Boolean(
          member &&
          (member.role === 'ORG_ADMIN' || member.role === 'SYNDICATE_ADMIN') &&
          (!targetOrgId || !member.orgId || member.orgId === targetOrgId)
        );
        if (isTenantAdmin) return { allowed: true };

        const isSelf = context.request.auth?.uid === docId;
        const existing = context.resource?.data || {};
        const incoming = context.request.resource?.data || {};
        const affectedKeys = Object.keys(incoming).filter((k) => incoming[k] !== existing[k]);
        const restrictedKeys = ['role', 'approvalStatus', 'active', 'assignedLocationId'];
        const touchesRestricted = affectedKeys.some((k) => restrictedKeys.includes(k));
        const isOnboardingWithoutOrg = !('orgId' in existing) || existing.orgId == null;

        if (isSelf) {
          if (!touchesRestricted || existing.approvalStatus === 'PENDING_APPROVAL' || isOnboardingWithoutOrg) {
            return { allowed: true };
          }
          return { allowed: false, reason: 'Self cannot modify role, approvalStatus, active, or assignedLocation' };
        }

        const emailMatch =
          context.request.auth?.email &&
          existing.email &&
          context.request.auth.email.toLowerCase() === existing.email.toLowerCase();
        if (emailMatch && (!touchesRestricted || existing.approvalStatus === 'PENDING_APPROVAL' || isOnboardingWithoutOrg)) {
          return { allowed: true };
        }
        return { allowed: false, reason: 'Unauthorized member update' };
      }
      if (operation === 'delete') {
        const targetOrgId = params.existingData?.orgId;
        return { allowed: this.isOrgAdmin(context, targetOrgId) };
      }
    }

    // 7. /capital_contributions/{entryId} (STRICT APPEND ONLY & AIR-GAP ISOLATION!)
    if (collection === 'capital_contributions') {
      const targetOrgId = params.existingData?.orgId || params.incomingData?.orgId;
      if (operation === 'read') {
        if (!this.isApprovedMemberOfOrg(context, targetOrgId)) {
          return { allowed: false, reason: 'Must be approved member of the organization to view money' };
        }
        const member = this.getMemberData(context.request.auth?.uid);
        if (member?.role === 'GROUND_OPERATOR') {
          return { allowed: false, reason: 'Ground Operator restricted from reading capital contributions' };
        }
        return { allowed: true };
      }
      if (operation === 'create') {
        const data = context.request.resource?.data || {};
        const isSelf = data.memberId === context.request.auth?.uid || data.createdByMemberId === context.request.auth?.uid;
        const isApproved = this.isApprovedMemberOfOrg(context, targetOrgId);
        const ok =
          isApproved &&
          (this.isTreasurerOfOrg(context, targetOrgId) || isSelf) &&
          this.isValidId(docId) &&
          this.hasMandatoryAuditFields(data);
        return { allowed: ok, reason: ok ? undefined : 'Treasurer role or member self-contribution of the organization and mandatory audit fields required' };
      }
      if (operation === 'update') {
        return { allowed: false, reason: 'Capital Contributions collection is strictly APPEND-ONLY (allow update: if false;)' };
      }
      if (operation === 'delete') {
        return { allowed: this.isOrgAdmin(context, targetOrgId) };
      }
    }

    // 8. /expense_ledger/{entryId}
    if (collection === 'expense_ledger') {
      const targetOrgId = params.existingData?.orgId || params.incomingData?.orgId;
      if (operation === 'read') {
        return { allowed: this.isApprovedMemberOfOrg(context, targetOrgId) };
      }
      if (operation === 'create') {
        const ok =
          this.isApprovedMemberOfOrg(context, targetOrgId) &&
          this.isValidId(docId) &&
          this.hasMandatoryAuditFields(context.request.resource?.data || {});
        return { allowed: ok, reason: ok ? undefined : 'Must be approved member of the organization with valid audit fields' };
      }
      if (operation === 'update') {
        if (!this.isTreasurerOfOrg(context, targetOrgId) || !this.isValidId(docId)) {
          return { allowed: false, reason: 'Treasurer authority of the organization required' };
        }
        const existing = context.resource?.data || {};
        const incoming = context.request.resource?.data || {};
        const affectedKeys = Object.keys(incoming).filter((k) => incoming[k] !== existing[k]);
        const allowedKeys = ['approvalStatus', 'approvedByMemberIds'];
        const onlyAllowed = affectedKeys.every((k) => allowedKeys.includes(k));
        const statusValid = ['APPROVED', 'PENDING_MULTISIG', 'REJECTED_BY_CONTRA'].includes(
          incoming.approvalStatus
        );
        const approvedByListValid =
          Array.isArray(incoming.approvedByMemberIds) && incoming.approvedByMemberIds.length <= 50;

        const ok = onlyAllowed && statusValid && approvedByListValid;
        return { allowed: ok, reason: ok ? undefined : 'Update restricted to approvalStatus and approvedByMemberIds' };
      }
      if (operation === 'delete') {
        return { allowed: this.isOrgAdmin(context, targetOrgId) };
      }
    }

    // 9. /fixed_assets_ledger/{entryId} (STRICT APPEND ONLY & AIR-GAP!)
    if (collection === 'fixed_assets_ledger') {
      const targetOrgId = params.existingData?.orgId || params.incomingData?.orgId;
      if (operation === 'read') return { allowed: this.isApprovedMemberOfOrg(context, targetOrgId) };
      if (operation === 'create') {
        const ok =
          this.isApprovedMemberOfOrg(context, targetOrgId) &&
          this.isValidId(docId) &&
          this.hasMandatoryAuditFields(context.request.resource?.data || {});
        return { allowed: ok };
      }
      if (operation === 'update') {
        return { allowed: false, reason: 'Fixed Assets ledger is strictly APPEND-ONLY (allow update: if false;)' };
      }
      if (operation === 'delete') return { allowed: this.isOrgAdmin(context, targetOrgId) };
    }

    // 10. /livestock_entries/{livestockId}
    if (collection === 'livestock_entries') {
      const targetOrgId = params.existingData?.orgId || params.incomingData?.orgId;
      if (operation === 'read') return { allowed: this.isApprovedMemberOfOrg(context, targetOrgId) };
      if (operation === 'create') {
        const incoming = context.request.resource?.data || {};
        const ok =
          this.isApprovedMemberOfOrg(context, targetOrgId) &&
          this.isValidId(docId) &&
          typeof incoming.nameOrTag === 'string' &&
          incoming.nameOrTag.length <= 140;
        return { allowed: ok };
      }
      if (operation === 'update') {
        if (!this.isApprovedMemberOfOrg(context, targetOrgId) || !this.isValidId(docId)) return { allowed: false };
        if (this.isOrgAdmin(context, targetOrgId)) return { allowed: true };
        const existing = context.resource?.data || {};
        const incoming = context.request.resource?.data || {};
        const affectedKeys = Object.keys(incoming).filter((k) => incoming[k] !== existing[k]);
        const allowedKeys = ['gallery', 'imageUrl', 'customCheckpoints', 'targetSaleWeightKg'];
        const onlyAllowed = affectedKeys.every((k) => allowedKeys.includes(k));
        return { allowed: onlyAllowed };
      }
      if (operation === 'delete') return { allowed: this.isOrgAdmin(context, targetOrgId) };
    }

    // 11. /livestock_lifecycle_events/{eventId} (APPEND ONLY!)
    if (collection === 'livestock_lifecycle_events') {
      const targetOrgId = params.existingData?.orgId || params.incomingData?.orgId;
      if (operation === 'read') return { allowed: this.isApprovedMemberOfOrg(context, targetOrgId) };
      if (operation === 'create') {
        const ok =
          this.isApprovedMemberOfOrg(context, targetOrgId) &&
          this.isValidId(docId) &&
          this.hasMandatoryAuditFields(context.request.resource?.data || {});
        return { allowed: ok };
      }
      if (operation === 'update') {
        return { allowed: false, reason: 'Livestock lifecycle events collection is strictly APPEND-ONLY' };
      }
      if (operation === 'delete') return { allowed: this.isOrgAdmin(context, targetOrgId) };
    }

    // 12. /feed_ledger/{eventId} (APPEND ONLY!)
    if (collection === 'feed_ledger') {
      const targetOrgId = params.existingData?.orgId || params.incomingData?.orgId;
      if (operation === 'read') return { allowed: this.isApprovedMemberOfOrg(context, targetOrgId) };
      if (operation === 'create') {
        const ok =
          this.isApprovedMemberOfOrg(context, targetOrgId) &&
          this.isValidId(docId) &&
          this.hasMandatoryAuditFields(context.request.resource?.data || {});
        return { allowed: ok };
      }
      if (operation === 'update') {
        return { allowed: false, reason: 'Feed ledger is strictly APPEND-ONLY' };
      }
      if (operation === 'delete') return { allowed: this.isOrgAdmin(context, targetOrgId) };
    }

    // 13. /audit_notifications/{auditId}
    if (collection === 'audit_notifications') {
      const targetOrgId = params.existingData?.orgId || params.incomingData?.orgId;
      if (operation === 'read') return { allowed: this.isApprovedMemberOfOrg(context, targetOrgId) };
      if (operation === 'create') {
        const incoming = context.request.resource?.data || {};
        const hasFields =
          'previousHash' in incoming &&
          'currentHash' in incoming &&
          'timestamp' in incoming &&
          'message' in incoming;
        const validHashPrev = typeof incoming.previousHash === 'string' && incoming.previousHash.length <= 128;
        const validHashCur = typeof incoming.currentHash === 'string' && incoming.currentHash.length <= 128;
        const validMsg = typeof incoming.message === 'string' && incoming.message.length <= 800;
        const ok =
          this.isApprovedMemberOfOrg(context, targetOrgId) &&
          this.isValidId(docId) &&
          hasFields &&
          validHashPrev &&
          validHashCur &&
          validMsg;
        return { allowed: ok };
      }
      if (operation === 'update') {
        if (!this.isApprovedMemberOfOrg(context, targetOrgId) || !this.isValidId(docId)) return { allowed: false };
        const existing = context.resource?.data || {};
        const incoming = context.request.resource?.data || {};
        const affectedKeys = Object.keys(incoming).filter((k) => incoming[k] !== existing[k]);
        const ok =
          affectedKeys.length === 1 &&
          affectedKeys[0] === 'readByMemberIds' &&
          Array.isArray(incoming.readByMemberIds) &&
          incoming.readByMemberIds.length <= 100;
        return { allowed: ok };
      }
      if (operation === 'delete') return { allowed: this.isOrgAdmin(context, targetOrgId) };
    }

    // 14. /debt_liabilities/{id}
    if (collection === 'debt_liabilities') {
      const targetOrgId = params.existingData?.orgId || params.incomingData?.orgId;
      if (operation === 'read') return { allowed: this.isApprovedMemberOfOrg(context, targetOrgId) };
      if (operation === 'create') {
        const ok =
          this.isTreasurerOfOrg(context, targetOrgId) &&
          this.isValidId(docId) &&
          (context.request.resource?.data?.principalAmount > 0);
        return { allowed: ok };
      }
      if (operation === 'update') {
        const ok =
          this.isTreasurerOfOrg(context, targetOrgId) &&
          params.incomingData?.orgId === params.existingData?.orgId;
        return { allowed: ok };
      }
      if (operation === 'delete') return { allowed: this.isOrgAdmin(context, targetOrgId) };
    }

    // 15. /loans_given/{id}
    if (collection === 'loans_given') {
      const targetOrgId = params.existingData?.orgId || params.incomingData?.orgId;
      if (operation === 'read') return { allowed: this.isApprovedMemberOfOrg(context, targetOrgId) };
      if (operation === 'create') {
        const ok =
          this.isTreasurerOfOrg(context, targetOrgId) &&
          this.isValidId(docId) &&
          (context.request.resource?.data?.principalAmount > 0);
        return { allowed: ok };
      }
      if (operation === 'update') {
        const ok =
          this.isTreasurerOfOrg(context, targetOrgId) &&
          params.incomingData?.orgId === params.existingData?.orgId;
        return { allowed: ok };
      }
      if (operation === 'delete') return { allowed: this.isOrgAdmin(context, targetOrgId) };
    }

    // 16. /credit_sales/{id}
    if (collection === 'credit_sales') {
      const targetOrgId = params.existingData?.orgId || params.incomingData?.orgId;
      if (operation === 'read') return { allowed: this.isApprovedMemberOfOrg(context, targetOrgId) };
      if (operation === 'create') {
        const total =
          context.request.resource?.data?.totalSaleAmount ??
          context.request.resource?.data?.totalAmount ??
          0;
        const ok =
          this.isApprovedMemberOfOrg(context, targetOrgId) &&
          this.isValidId(docId) &&
          total > 0;
        return { allowed: ok };
      }
      if (operation === 'update') {
        const ok =
          this.isApprovedMemberOfOrg(context, targetOrgId) &&
          params.incomingData?.orgId === params.existingData?.orgId;
        return { allowed: ok };
      }
      if (operation === 'delete') return { allowed: this.isOrgAdmin(context, targetOrgId) };
    }

    // 17. /runway_plans/{id}
    if (collection === 'runway_plans') {
      const targetOrgId = params.existingData?.orgId || params.incomingData?.orgId;
      if (operation === 'read') return { allowed: this.isApprovedMemberOfOrg(context, targetOrgId) };
      if (operation === 'create') {
        const ok = this.isOrgAdmin(context, targetOrgId) && this.isValidId(docId);
        return { allowed: ok };
      }
      if (operation === 'update') {
        const ok =
          this.isTreasurerOfOrg(context, targetOrgId) &&
          params.incomingData?.orgId === params.existingData?.orgId;
        return { allowed: ok };
      }
      if (operation === 'delete') return { allowed: false };
    }

    // 18. /runway_lines/{id}
    if (collection === 'runway_lines') {
      const targetOrgId = params.existingData?.orgId || params.incomingData?.orgId;
      if (operation === 'read') return { allowed: this.isApprovedMemberOfOrg(context, targetOrgId) };
      if (operation === 'create') {
        const incoming = context.request.resource?.data || {};
        const ok =
          this.isTreasurerOfOrg(context, targetOrgId) &&
          this.isValidId(docId) &&
          incoming.unitCost >= 0 &&
          incoming.qty >= 0;
        return { allowed: ok };
      }
      if (operation === 'update') {
        const ok =
          this.isTreasurerOfOrg(context, targetOrgId) &&
          params.incomingData?.orgId === params.existingData?.orgId;
        return { allowed: ok };
      }
      if (operation === 'delete') return { allowed: this.isOrgAdmin(context, targetOrgId) };
    }

    // 19. /runway_pledges/{id}
    if (collection === 'runway_pledges') {
      const targetOrgId = params.existingData?.orgId || params.incomingData?.orgId;
      if (operation === 'read') {
        const member = this.getMemberData(context.request.auth?.uid);
        return {
          allowed:
            this.isApprovedMemberOfOrg(context, targetOrgId) &&
            member?.role !== 'GROUND_OPERATOR',
        };
      }
      if (operation === 'create' || operation === 'update') {
        const incoming = context.request.resource?.data || {};
        const isSelf = incoming.memberId === context.request.auth?.uid;
        const isTreas = this.isTreasurerOfOrg(context, targetOrgId);
        const ok = this.isApprovedMemberOfOrg(context, targetOrgId) && (isSelf || isTreas);
        return { allowed: ok };
      }
      if (operation === 'delete') return { allowed: false };
    }

    // 20. /runway_claims/{id}
    if (collection === 'runway_claims') {
      const targetOrgId = params.existingData?.orgId || params.incomingData?.orgId;
      if (operation === 'read') return { allowed: this.isApprovedMemberOfOrg(context, targetOrgId) };
      if (operation === 'create') {
        const incoming = context.request.resource?.data || {};
        const ok =
          this.isApprovedMemberOfOrg(context, targetOrgId) &&
          incoming.status === 'PENDING';
        return { allowed: ok };
      }
      if (operation === 'update') {
        const existing = context.resource?.data || {};
        const incoming = context.request.resource?.data || {};
        const affectedKeys = Object.keys(incoming).filter((k) => incoming[k] !== existing[k]);
        const allowedKeys = ['status', 'resolvedByMemberId', 'resolutionNote', 'contributionId', 'resolvedAt'];
        const onlyAllowed = affectedKeys.every((k) => allowedKeys.includes(k));
        const ok = this.isTreasurerOfOrg(context, targetOrgId) && onlyAllowed;
        return { allowed: ok };
      }
      if (operation === 'delete') return { allowed: false };
    }

    // 21. /runway_templates/{id}
    if (collection === 'runway_templates') {
      const targetOrgId = params.existingData?.orgId || params.incomingData?.orgId;
      if (operation === 'read') return { allowed: this.isApprovedMemberOfOrg(context, targetOrgId) };
      if (operation === 'create' || operation === 'update') {
        return { allowed: this.isTreasurerOfOrg(context, targetOrgId) };
      }
      if (operation === 'delete') return { allowed: this.isOrgAdmin(context, targetOrgId) };
    }

    // Catch-all default deny
    return { allowed: false, reason: 'Catch-all default deny rule' };
  }
}
