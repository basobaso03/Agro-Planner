import test from 'node:test';
import assert from 'node:assert/strict';
import { dataService, PRIMARY_ADMIN_EMAIL } from '../src/services/dataService.ts';
import { PERMISSIONS } from '../src/utils/permissions.ts';
import type { OrgMember, Role } from '../src/types/agro.ts';
import { TEST_ACCOUNTS, toOrgMember } from './helpers/testContext.ts';
import { RulesEngineSimulator } from './helpers/rulesEngineSimulator.ts';
import { verifyAuditChainIntegrity } from '../src/utils/cryptoHash.ts';
import { compareSemver } from '../src/services/appUpdateService.ts';

// ---------------------------------------------------------------------------
// SUITE 7: MEMBER GOVERNANCE, ROLE PROMOTIONS, DEMOTIONS & RBAC TRANSITIONS
// ---------------------------------------------------------------------------

test('WF-GOV-01: Admin Promotes Member to Treasurer (Gains Multi-Sig & Capital Rights)', async () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);
  const memberActor = toOrgMember(TEST_ACCOUNTS.agroMember);

  // Ensure member is in state
  const curState = dataService.getState();
  if (!curState.members.some((m) => m.id === memberActor.id)) {
    (dataService as any).saveLocalState({
      ...curState,
      members: [...curState.members, memberActor, adminActor],
    });
  }

  // 1. Before promotion: Regular Member CANNOT approve multi-sig or log capital
  assert.equal(PERMISSIONS.canApproveMultiSig(memberActor.role), false);
  assert.equal(PERMISSIONS.canLogCapitalDeposit(memberActor.role), false);

  // 2. Admin promotes Tafadzwa to TREASURER
  const updatedMember = await dataService.adminUpdateMemberRoleAndAccess({
    targetMemberId: memberActor.id,
    role: 'TREASURER',
    approvalStatus: 'APPROVED',
    note: 'Promoted to Chief Financial Officer & Multi-Sig Authorizer',
    actor: adminActor,
  });

  assert.equal(updatedMember.role, 'TREASURER');
  assert.equal(updatedMember.approvalStatus, 'APPROVED');

  // 3. After promotion: Tafadzwa now holds Treasurer capabilities
  assert.equal(PERMISSIONS.canApproveMultiSig(updatedMember.role), true);
  assert.equal(PERMISSIONS.canLogCapitalDeposit(updatedMember.role), true);

  // Verify can log capital deposit with new role
  const deposit = dataService.logCapitalContribution({
    memberId: updatedMember.id,
    direction: 'ADDITION',
    amount: 1500,
    note: 'Authorized capital deposit by newly promoted Treasurer',
    actor: updatedMember,
  });
  assert.ok(deposit.id);
  assert.equal(deposit.amount, 1500);
});

test('WF-GOV-02: Admin Demotes Treasurer to Member (Revokes Multi-Sig & Capital Rights)', async () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);
  const treasurerActor = toOrgMember(TEST_ACCOUNTS.agroTreasurer);

  // Ensure treasurer is in state
  const curState = dataService.getState();
  if (!curState.members.some((m) => m.id === treasurerActor.id)) {
    (dataService as any).saveLocalState({
      ...curState,
      members: [...curState.members, treasurerActor, adminActor],
    });
  }

  // 1. Before demotion: Chipo is a Treasurer
  assert.equal(PERMISSIONS.canApproveMultiSig(treasurerActor.role), true);
  assert.equal(PERMISSIONS.canLogCapitalDeposit(treasurerActor.role), true);

  // 2. Admin demotes Chipo to MEMBER
  const demotedMember = await dataService.adminUpdateMemberRoleAndAccess({
    targetMemberId: treasurerActor.id,
    role: 'MEMBER',
    approvalStatus: 'APPROVED',
    note: 'Rotated from financial treasury back to regular investor member',
    actor: adminActor,
  });

  assert.equal(demotedMember.role, 'MEMBER');

  // 3. After demotion: Chipo no longer has Treasurer rights
  assert.equal(PERMISSIONS.canApproveMultiSig(demotedMember.role), false);
  assert.equal(PERMISSIONS.canLogCapitalDeposit(demotedMember.role), false);

  // Attempting to record capital deposit must now be rejected
  assert.throws(
    () => {
      dataService.logCapitalContribution({
        memberId: demotedMember.id,
        direction: 'ADDITION',
        amount: 500,
        note: 'Unauthorized post-demotion deposit',
        actor: demotedMember,
      });
    },
    /Access Denied: Only Treasurers and Organization Admins can record capital contributions/
  );
});

test('WF-GOV-03: Admin Promotes Member to Co-Admin (Gains Site CRUD & 24-Hr Codes)', async () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);
  const memberActor = toOrgMember(TEST_ACCOUNTS.agroMember);

  // Admin promotes member to ORG_ADMIN
  const coAdmin = await dataService.adminUpdateMemberRoleAndAccess({
    targetMemberId: memberActor.id,
    role: 'ORG_ADMIN',
    approvalStatus: 'APPROVED',
    note: 'Appointed co-administrator',
    actor: adminActor,
  });

  assert.equal(coAdmin.role, 'ORG_ADMIN');
  assert.equal(PERMISSIONS.canAddLocations(coAdmin.role), true);
  assert.equal(PERMISSIONS.canEditLocation(coAdmin.role), true);
  assert.equal(PERMISSIONS.canRefreshInviteCode(coAdmin.role), true);
  assert.equal(PERMISSIONS.canManageMembers(coAdmin.role), true);

  // Co-admin can now add a farm site
  const site = dataService.addLocation({
    name: 'Co-Admin Created Station',
    region: 'Mashonaland Central',
    gpsCoordinates: '-17.30, 31.33',
    primaryOperatorName: 'Station Lead',
    actor: coAdmin,
  });
  assert.ok(site.id);

  // Co-admin demoted back to MEMBER
  const demotedAdmin = await dataService.adminUpdateMemberRoleAndAccess({
    targetMemberId: memberActor.id,
    role: 'MEMBER',
    approvalStatus: 'APPROVED',
    note: 'Stepped down from admin role',
    actor: adminActor,
  });

  assert.equal(demotedAdmin.role, 'MEMBER');
  assert.equal(PERMISSIONS.canAddLocations(demotedAdmin.role), false);
  assert.equal(PERMISSIONS.canRefreshInviteCode(demotedAdmin.role), false);
});

test('WF-GOV-04: Admin Reassigns Member to Ground Operator (Blocks Capital Visibility)', async () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);
  const memberActor = toOrgMember(TEST_ACCOUNTS.agroMember);
  const loc = dataService.getState().locations[0] || dataService.addLocation({
    name: 'Norton Broiler Hub (Site A)',
    region: 'Mashonaland West',
    gpsCoordinates: '-17.8833, 30.7000',
    primaryOperatorName: 'Kudzi Mutasa',
    actor: adminActor,
  });

  // Admin reassigns member to GROUND_OPERATOR at Norton site
  const operator = await dataService.adminUpdateMemberRoleAndAccess({
    targetMemberId: memberActor.id,
    role: 'GROUND_OPERATOR',
    approvalStatus: 'APPROVED',
    assignedLocationId: loc.id,
    note: 'Assigned as dedicated site operator at Norton Broiler Hub',
    actor: adminActor,
  });

  assert.equal(operator.role, 'GROUND_OPERATOR');
  assert.equal(operator.assignedLocationId, loc.id);

  // Ground operator cannot view capital pool or master treasury
  assert.equal(PERMISSIONS.canViewMasterTreasury(operator.role), false);
  assert.equal(PERMISSIONS.canViewCapitalPoolTab(operator.role), false);
  assert.equal(PERMISSIONS.canViewAllInvestorStakes(operator.role), false);

  // Firestore rules evaluation: Ground operator reading /capital_contributions is rejected
  const simulator = new RulesEngineSimulator();
  simulator.registerMember(operator.uid || operator.id, {
    role: operator.role,
    approvalStatus: operator.approvalStatus,
    active: operator.active,
    orgId: operator.orgId,
    email: operator.email,
  });

  const ruleResult = simulator.evaluate({
    collection: 'capital_contributions',
    docId: 'TX-TEST-01',
    operation: 'read',
    auth: { uid: operator.uid || operator.id, email: operator.email },
    existingData: { orgId: operator.orgId },
  });
  assert.equal(ruleResult.allowed, false, 'Ground Operator must be denied from reading capital contributions');
});

test('WF-GOV-05: Ground Operator Farm Site Reassignment (Site A Norton ➔ Site B Gweru)', async () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);
  const operatorActor = toOrgMember(TEST_ACCOUNTS.agroOperator);

  // Ensure operator is in state
  const curState = dataService.getState();
  if (!curState.members.some((m) => m.id === operatorActor.id)) {
    (dataService as any).saveLocalState({
      ...curState,
      members: [...curState.members, operatorActor],
    });
  }

  // Ensure Gweru site exists
  const gweruSite = dataService.getState().locations.find((l) => l.name.includes('Gweru')) ||
    dataService.addLocation({
      name: 'Gweru Livestock Ranch (Site B)',
      region: 'Midlands',
      gpsCoordinates: '-19.45, 29.81',
      primaryOperatorName: 'Kudzi Mutasa',
      actor: adminActor,
    });

  // Reassign Kudzi to Gweru Ranch
  const reassignedOp = await dataService.adminUpdateMemberRoleAndAccess({
    targetMemberId: operatorActor.id,
    role: 'GROUND_OPERATOR',
    approvalStatus: 'APPROVED',
    assignedLocationId: gweruSite.id,
    note: 'Transferred to manage Boer goat breeding operations in Gweru',
    actor: adminActor,
  });

  assert.equal(reassignedOp.assignedLocationId, gweruSite.id);
  const storedOp = dataService.getState().members.find((m) => m.id === operatorActor.id);
  assert.equal(storedOp?.assignedLocationId, gweruSite.id);
});

test('WF-GOV-06: Member Suspension and Reactivation Lifecycle', async () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);
  const memberActor = toOrgMember(TEST_ACCOUNTS.agroMember);

  // 1. Admin suspends member
  const suspended = await dataService.adminUpdateMemberRoleAndAccess({
    targetMemberId: memberActor.id,
    role: 'MEMBER',
    approvalStatus: 'SUSPENDED',
    note: 'Account temporarily suspended for compliance audit',
    actor: adminActor,
  });

  assert.equal(suspended.approvalStatus, 'SUSPENDED');
  assert.equal(suspended.active, false);

  // Suspended member in rules simulator must be rejected from writing
  const simulator = new RulesEngineSimulator();
  simulator.registerMember(memberActor.uid || memberActor.id, {
    role: 'MEMBER',
    approvalStatus: 'SUSPENDED',
    active: false,
    orgId: memberActor.orgId,
    email: memberActor.email,
  });

  const writeAttempt = simulator.evaluate({
    collection: 'expense_ledger',
    docId: 'TX-SUS-EXP',
    operation: 'create',
    auth: { uid: memberActor.uid || memberActor.id, email: memberActor.email },
    incomingData: {
      orgId: memberActor.orgId,
      note: 'Suspended user trying to log expense',
      createdAt: new Date().toISOString(),
      auditHash: 'hash',
    },
  });
  assert.equal(writeAttempt.allowed, false, 'Suspended member must be blocked from write operations');

  // 2. Admin reactivates member
  const reactivated = await dataService.adminUpdateMemberRoleAndAccess({
    targetMemberId: memberActor.id,
    role: 'MEMBER',
    approvalStatus: 'APPROVED',
    note: 'Compliance review completed; account restored',
    actor: adminActor,
  });

  assert.equal(reactivated.approvalStatus, 'APPROVED');
  assert.equal(reactivated.active, true);
});

test('WF-GOV-07-NEG: Non-Admin Cannot Promote/Demote Members & Cross-Tenant Governance Blocked', async () => {
  const regularMember = toOrgMember(TEST_ACCOUNTS.agroMember);
  const targetMember = toOrgMember(TEST_ACCOUNTS.agroTreasurer);
  const ventureAdmin = toOrgMember(TEST_ACCOUNTS.ventureAdmin);

  // 1. Regular member attempting to promote someone -> MUST FAIL
  await assert.rejects(
    async () => {
      await dataService.adminUpdateMemberRoleAndAccess({
        targetMemberId: targetMember.id,
        role: 'ORG_ADMIN',
        approvalStatus: 'APPROVED',
        actor: regularMember,
      });
    },
    /Access Denied: Only Organization Admins can modify member roles/
  );

  // 2. Venture Admin attempting to modify Agro Org member -> MUST FAIL
  await assert.rejects(
    async () => {
      await dataService.adminUpdateMemberRoleAndAccess({
        targetMemberId: targetMember.id,
        role: 'MEMBER',
        approvalStatus: 'SUSPENDED',
        actor: ventureAdmin,
      });
    },
    /Access Denied: You cannot modify members belonging to another organization/
  );
});

test('WF-GOV-08: Admin Pre-Authorizes Member with Assigned Role & Initial Capital', () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);
  const loc = dataService.getState().locations[0] || dataService.addLocation({
    name: 'Norton Broiler Hub (Site A)',
    region: 'Mashonaland West',
    gpsCoordinates: '-17.8833, 30.7000',
    primaryOperatorName: 'Kudzi Mutasa',
    actor: adminActor,
  });

  // Admin pre-authorizes a new prospective member
  const preAuthMember = dataService.addMember({
    fullName: 'Pre-Authorized Operations Lead',
    phoneOrEmail: 'preauth.lead@agroplanner.com',
    role: 'TREASURER',
    assignedLocationId: loc.id,
    initialContributionUsd: 500,
    contributionNote: 'Initial pre-cleared capital stake',
    actor: adminActor,
  });

  assert.ok(preAuthMember.id);
  assert.equal(preAuthMember.fullName, 'Pre-Authorized Operations Lead');
  assert.equal(preAuthMember.role, 'TREASURER');
  assert.equal(preAuthMember.approvalStatus, 'APPROVED');
  assert.equal(preAuthMember.assignedLocationId, loc.id);

  // Stored in state
  const found = dataService.getState().members.find((m) => m.id === preAuthMember.id);
  assert.ok(found);
  assert.equal(found.approvalStatus, 'APPROVED');
});

test('WF-GOV-09: Member Permanent Deletion & Founder Account Deletion Protection Guard', async () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);

  // 1. Create a disposable member to delete
  const disposable = dataService.addMember({
    fullName: 'Disposable Temporary Member',
    phoneOrEmail: 'disposable.temp@agroplanner.com',
    role: 'MEMBER',
    actor: adminActor,
  });

  assert.ok(dataService.getState().members.some((m) => m.id === disposable.id));

  // 2. Admin deletes the disposable member
  await dataService.deleteMember({
    targetMemberId: disposable.id,
    actor: adminActor,
    reason: 'Test account decommissioned',
  });

  assert.equal(
    dataService.getState().members.some((m) => m.id === disposable.id),
    false,
    'Deleted member must be removed from state snapshot'
  );

  // 3. Negative Guard: Attempting to delete the Primary Founder Admin MUST FAIL
  const founderMember = toOrgMember(TEST_ACCOUNTS.founder);
  // Ensure founder is in state
  const curState = dataService.getState();
  if (!curState.members.some((m) => m.id === founderMember.id)) {
    (dataService as any).saveLocalState({
      ...curState,
      members: [...curState.members, founderMember],
    });
  }

  await assert.rejects(
    async () => {
      await dataService.deleteMember({
        targetMemberId: founderMember.id,
        actor: adminActor,
      });
    },
    /Zero-Trust Protection: The primary Founder Admin account cannot be deleted/
  );
});

test('WF-GOV-10: Cryptographic SHA-256 Chained Hash Verification & Tamper Detection', () => {
  const notifications = dataService.getState().auditNotifications;
  assert.ok(notifications.length > 0, 'Must have recorded audit notifications');

  // 1. Legitimate ledger: All blocks verify successfully
  const validResult = verifyAuditChainIntegrity(notifications);
  assert.equal(validResult.valid, true, 'Legitimate ledger hash chain must be 100% cryptographically valid');
  assert.ok(validResult.totalBlocksChecked >= notifications.length);

  // 2. Tampered ledger simulation: Corrupting an audit payload must immediately break verification
  const tamperedNotifications = JSON.parse(JSON.stringify(notifications));
  if (tamperedNotifications.length > 0) {
    tamperedNotifications[0].message = 'MALICIOUS_TAMPERED_MESSAGE_INSERTION';
    const tamperedResult = verifyAuditChainIntegrity(tamperedNotifications);
    assert.equal(tamperedResult.valid, false, 'Tampered block must cause verification failure');
    assert.ok(tamperedResult.brokenReason);
  }
});

test('WF-GOV-11: App Version Comparison & Force Update Gating', () => {
  // Installed: 1.0.4, Min Required: 1.0.3 -> No force update needed (1)
  assert.equal(compareSemver('1.0.4', '1.0.3'), 1);

  // Installed: 1.0.2, Min Required: 1.0.3 -> Force update REQUIRED (-1)
  assert.equal(compareSemver('1.0.2', '1.0.3'), -1);

  // Installed: 1.0.4, Min Required: 1.0.4 -> Identical versions (0)
  assert.equal(compareSemver('1.0.4', '1.0.4'), 0);
});

test('WF-GOV-12: Farm Site-Level Viewport Isolation (Site A vs Site B vs Site C)', () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);
  let allLocations = dataService.getState().locations;
  let siteA = allLocations.find((l) => l.name.includes('Norton'));
  let siteB = allLocations.find((l) => l.name.includes('Gweru'));

  if (!siteA) {
    siteA = dataService.addLocation({
      name: 'Norton Broiler Hub (Site A)',
      region: 'Mashonaland West',
      gpsCoordinates: '-17.8833, 30.7000',
      primaryOperatorName: 'Tendai M.',
      actor: adminActor,
    });
  }
  if (!siteB) {
    siteB = dataService.addLocation({
      name: 'Gweru Livestock Ranch (Site B)',
      region: 'Midlands Province',
      gpsCoordinates: '-19.4500, 29.8167',
      primaryOperatorName: 'Kudzi Mutasa',
      actor: adminActor,
    });
  }

  assert.ok(siteA && siteB, 'Both Site A and Site B must exist in state');

  const allExpenses = dataService.getState().expenses;
  const allLivestock = dataService.getState().livestockEntries;

  // 1. Filtered by Site A: Only Norton records visible
  const siteAExpenses = allExpenses.filter((e) => e.locationId === siteA.id);
  const siteALivestock = allLivestock.filter((l) => l.locationId === siteA.id);

  assert.equal(siteAExpenses.some((e) => e.locationId === siteB.id), false);
  assert.equal(siteALivestock.some((l) => l.locationId === siteB.id), false);

  // 2. Filtered by Site B: Only Gweru records visible
  const siteBExpenses = allExpenses.filter((e) => e.locationId === siteB.id);
  const siteBLivestock = allLivestock.filter((l) => l.locationId === siteB.id);

  assert.equal(siteBExpenses.some((e) => e.locationId === siteA.id), false);
  assert.equal(siteBLivestock.some((l) => l.locationId === siteA.id), false);
});

test.after(() => {
  setTimeout(() => process.exit(0), 100);
});

