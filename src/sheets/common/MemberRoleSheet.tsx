import React from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import type { OrgMember, Role, MemberApprovalStatus } from '../../types/agro.ts';

export interface MemberRoleSheetProps {
  isOpen: boolean;
  onClose: () => void;
  member: OrgMember;
  activeMember: OrgMember;
  onUpdated?: () => void;
}

export const MemberRoleSheet: React.FC<MemberRoleSheetProps> = ({
  isOpen,
  onClose,
  member,
  activeMember,
  onUpdated,
}) => {
  const { showToast } = useToast();
  const locations = dataService.getState().locations.filter(
    (l) => !activeMember.orgId || l.orgId === activeMember.orgId
  );
  const org =
    (dataService.getState().organizations || []).find((o) => o.id === activeMember.orgId) ||
    dataService.getActiveOrganization(activeMember.orgId);
  const isAgro = org?.type !== 'GENERAL_VENTURE';

  const isSelf = member.id === activeMember.id;

  const form = useForm({
    initial: {
      role: member.role,
      approvalStatus: member.approvalStatus || 'APPROVED',
      assignedLocationId: member.assignedLocationId || '',
      note: '',
    },
    validate: (values) => {
      const errors: Record<string, string | null> = {};
      if (values.note && values.note.trim().length > 500) {
        errors.note = 'Audit note cannot exceed 500 characters.';
      }
      return errors;
    },
    onSubmit: async (values) => {
      try {
        const auditNote =
          values.note.trim() ||
          `Role updated to ${values.role.replace(/_/g, ' ')} by ${activeMember.fullName || 'Admin'}`;

        await dataService.adminUpdateMemberRoleAndAccess({
          targetMemberId: member.id,
          role: values.role as Role,
          approvalStatus: values.approvalStatus as MemberApprovalStatus,
          assignedLocationId: values.assignedLocationId || undefined,
          note: auditNote,
          actor: activeMember,
        });

        showToast({
          type: 'success',
          title: 'Member Updated',
          message: `${member.fullName}'s role has been updated to ${values.role.replace(/_/g, ' ')}.`,
        });
        onUpdated?.();
        onClose();
      } catch (err: any) {
        showToast({
          type: 'error',
          title: 'Update Failed',
          message: err?.message || 'Could not update member role.',
        });
      }
    },
  });

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Member Role & Clearances"
      subtitle={`Configure privileges for ${member.fullName}`}
      isSubmitting={form.isSubmitting}
      submitLabel={isSelf ? 'Done' : 'Apply Role Changes'}
      onSubmit={isSelf ? onClose : form.handleSubmit}
      maxHeight="88dvh"
    >
      <div className="space-y-4">
        {isSelf && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 font-medium">
            <strong>Administrator Account:</strong> You are viewing your own administrator account. For security, administrators cannot demote or suspend themselves. To transfer administration, assign another user as Organization Admin first.
          </div>
        )}

        <Field label="System Role" required>
          <select
            value={form.values.role}
            disabled={isSelf}
            onChange={(e) => form.setValue('role', e.target.value as Role)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm disabled:opacity-60 cursor-pointer"
          >
            <option value="MEMBER">Member (Investor - Portfolio &amp; Read-Only)</option>
            <option value="GROUND_OPERATOR">Ground Operator (Farm / Warehouse Logging)</option>
            <option value="TREASURER">Treasurer (Multi-Sig, Approvals &amp; Financials)</option>
            <option value="ORG_ADMIN">Organization Admin (Full Governance)</option>
            {member.role === 'SYNDICATE_ADMIN' && <option value="SYNDICATE_ADMIN">Syndicate Admin</option>}
            {member.role === 'REMOTE_INVESTOR' && <option value="REMOTE_INVESTOR">Remote Investor</option>}
          </select>
        </Field>

        <Field label="Membership Status" required>
          <select
            value={form.values.approvalStatus}
            disabled={isSelf}
            onChange={(e) => form.setValue('approvalStatus', e.target.value as MemberApprovalStatus)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm disabled:opacity-60 cursor-pointer"
          >
            <option value="APPROVED">✅ Active / Approved</option>
            <option value="SUSPENDED">🚫 Suspended (Access Revoked)</option>
          </select>
        </Field>

        {isAgro && locations.length > 0 && (
          <Field label="Assigned Location Site">
            <select
              value={form.values.assignedLocationId}
              disabled={isSelf}
              onChange={(e) => form.setValue('assignedLocationId', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm disabled:opacity-60 cursor-pointer"
            >
              <option value="">All Locations (Enterprise Wide)</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {!isSelf && (
          <Field
            label="Audit Justification (Optional)"
            error={form.errors.note}
            hint="Optional note logged to immutable audit ledger."
          >
            <textarea
              rows={2}
              value={form.values.note}
              onChange={(e) => form.setValue('note', e.target.value)}
              placeholder="e.g. Promoted to Treasurer following committee vote"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            />
          </Field>
        )}
      </div>
    </FormSheet>
  );
};

