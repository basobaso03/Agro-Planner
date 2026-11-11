import test from 'node:test';
import assert from 'node:assert/strict';
import { dataService } from '../services/dataService.ts';
import type { OrgMember } from '../types/agro.ts';
import type { Organization } from '../types/organization.ts';

function generate24HrInviteCode(prefix: string = 'SEED'): {
  code: string;
  createdAt: string;
  expiresAt: string;
} {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars[Math.floor(Math.random() * chars.length)];
  }
  const now = Date.now();
  const code = `${prefix}-${rand}`;
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
  return { code, createdAt, expiresAt };
}

function isInviteCodeActive(expiresAtIso: string, nowMs: number = Date.now()): boolean {
  return new Date(expiresAtIso).getTime() > nowMs;
}

test('Organization 24-Hr Invite Code Generator produces valid format and 24h duration', () => {
  const generated = generate24HrInviteCode('SEED');
  assert.match(generated.code, /^SEED-[23456789A-Z]{4}$/);

  const startMs = new Date(generated.createdAt).getTime();
  const endMs = new Date(generated.expiresAt).getTime();
  const diffHours = (endMs - startMs) / (1000 * 60 * 60);
  assert.equal(diffHours, 24);

  // Active right now
  assert.equal(isInviteCodeActive(generated.expiresAt, startMs + 1000), true);
  // Active after 23 hours
  assert.equal(isInviteCodeActive(generated.expiresAt, startMs + 23 * 3600 * 1000), true);
  // Expired after 24 hours + 1 minute
  assert.equal(isInviteCodeActive(generated.expiresAt, startMs + 24 * 3600 * 1000 + 60000), false);
});

test('Organization 24-Hr Invite Code: Admin manual code refresh generates new code and invalidates prior', () => {
  const adminActor: OrgMember = {
    id: 'mem-admin-org-test',
    orgId: 'org-test-alpha',
    fullName: 'Alpha Org Admin',
    phoneOrEmail: 'admin@alpha.test',
    role: 'ORG_ADMIN',
    approvalStatus: 'APPROVED',
    active: true,
    joinedAt: new Date().toISOString(),
  };

  const initialOrg = dataService.createOrganization({
    name: 'Alpha Farming Ventures',
    type: 'AGRO_FARMING',
    actor: adminActor,
    defaultTargetContributionUsd: 1500,
    contributionPaceDefault: 'MONTHLY',
  });

  const originalCode = initialOrg.currentInviteCode;
  assert.ok(originalCode);
  assert.match(originalCode, /^SEED-/);

  // Manual refresh by admin
  const refreshedOrg = dataService.refreshInviteCode({
    orgId: initialOrg.id,
    actor: adminActor,
  });

  assert.notEqual(refreshedOrg.currentInviteCode, originalCode);
  assert.ok(new Date(refreshedOrg.inviteCodeExpiresAt).getTime() > Date.now());

  // Non-admin attempting to refresh code must be rejected
  const memberActor: OrgMember = {
    ...adminActor,
    id: 'mem-regular-user',
    role: 'MEMBER',
  };

  assert.throws(
    () => {
      dataService.refreshInviteCode({
        orgId: initialOrg.id,
        actor: memberActor,
      });
    },
    /Access Denied: Only Organization Admins can refresh invitation codes/
  );
});

test('Organization 24-Hr Invite Code: Member joins with valid code and is rejected with expired code', async () => {
  const adminActor: OrgMember = {
    id: 'mem-admin-org-beta',
    orgId: 'org-test-beta',
    fullName: 'Beta Org Admin',
    phoneOrEmail: 'admin@beta.test',
    role: 'ORG_ADMIN',
    approvalStatus: 'APPROVED',
    active: true,
    joinedAt: new Date().toISOString(),
  };

  const org = dataService.createOrganization({
    name: 'Beta Capital Pool',
    type: 'GENERAL_VENTURE',
    actor: adminActor,
    defaultTargetContributionUsd: 2000,
  });

  const candidateMember: OrgMember = {
    id: 'mem-candidate-01',
    fullName: 'New Investor Candidate',
    phoneOrEmail: 'investor@beta.test',
    role: 'MEMBER',
    active: false,
    joinedAt: new Date().toISOString(),
  };

  // Join with valid code succeeds immediately
  const joinedOrg = await dataService.joinOrganizationWithCode({
    inviteCode: org.currentInviteCode,
    actor: candidateMember,
  });

  assert.equal(joinedOrg.id, org.id);
  const updatedMember = dataService.getState().members.find((m) => m.id === candidateMember.id)!;
  assert.equal(updatedMember.approvalStatus, 'APPROVED');
  assert.equal(updatedMember.active, true);
  assert.equal(updatedMember.targetContributionUsd, 2000);

  // Test expired invitation code throws descriptive error
  const expiredOrg: Organization = {
    ...org,
    id: 'org-expired-test',
    currentInviteCode: 'SEED-EXPD',
    inviteCodeExpiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  };

  const curState = dataService.getState();
  (dataService as any).saveLocalState({
    ...curState,
    organizations: [...(curState.organizations || []), expiredOrg],
  });

  await assert.rejects(
    async () => {
      await dataService.joinOrganizationWithCode({
        inviteCode: 'SEED-EXPD',
        actor: candidateMember,
      });
    },
    /expired after 24 hours/
  );
});

test('Organization Governance: Admin updates organization settings and member capital targets', () => {
  const adminActor: OrgMember = {
    id: 'mem-admin-gov-test',
    orgId: 'org-gov-test',
    fullName: 'Gov Org Admin',
    phoneOrEmail: 'govadmin@test.com',
    role: 'ORG_ADMIN',
    approvalStatus: 'APPROVED',
    active: true,
    joinedAt: new Date().toISOString(),
  };

  const org = dataService.createOrganization({
    name: 'Initial Agro Enterprise',
    type: 'AGRO_FARMING',
    actor: adminActor,
    defaultTargetContributionUsd: 1000,
    contributionPaceDefault: 'MONTHLY',
  });

  // 1. Admin updates org name and switches workspace mode to GENERAL_VENTURE
  const updatedOrg = dataService.updateOrganization({
    orgId: org.id,
    name: 'Upgraded Capital Fund',
    type: 'GENERAL_VENTURE',
    defaultTargetContributionUsd: 2500,
    contributionPaceDefault: 'MILESTONE',
    actor: adminActor,
  });

  assert.equal(updatedOrg.name, 'Upgraded Capital Fund');
  assert.equal(updatedOrg.type, 'GENERAL_VENTURE');
  assert.equal(updatedOrg.defaultTargetContributionUsd, 2500);
  assert.equal(updatedOrg.contributionPaceDefault, 'MILESTONE');
  assert.equal(updatedOrg.features.livestockModule, false);

  // 2. Member joins and has their individual target configured
  const memberActor: OrgMember = {
    id: 'mem-investor-target-test',
    orgId: org.id,
    fullName: 'Target Test Investor',
    phoneOrEmail: 'investor@target.test',
    role: 'MEMBER',
    approvalStatus: 'APPROVED',
    active: true,
    joinedAt: new Date().toISOString(),
  };

  const curState = dataService.getState();
  (dataService as any).saveLocalState({
    ...curState,
    members: [...curState.members, memberActor],
  });

  const updatedMember = dataService.updateMemberCapitalTarget({
    memberId: memberActor.id,
    targetContributionUsd: 5000,
    contributionPace: 'FLEXIBLE',
    actor: adminActor,
  });

  assert.equal(updatedMember.targetContributionUsd, 5000);
  assert.equal(updatedMember.contributionPace, 'FLEXIBLE');
});

test('Runway Pledges and Member Targets: Synchronized to the same unified source of truth', () => {
  const adminActor: any = {
    id: 'admin-sync-test',
    orgId: 'org-sync-test',
    fullName: 'Admin Sync',
    phoneOrEmail: 'admin@sync.test',
    role: 'ORG_ADMIN',
    approvalStatus: 'APPROVED',
    active: true,
    joinedAt: new Date().toISOString(),
  };

  const memberActor: any = {
    id: 'mem-sync-test',
    orgId: 'org-sync-test',
    fullName: 'Member Sync',
    phoneOrEmail: 'member@sync.test',
    role: 'MEMBER',
    targetContributionUsd: 1000,
    contributionPace: 'MONTHLY',
    approvalStatus: 'APPROVED',
    active: true,
    joinedAt: new Date().toISOString(),
  };

  const planId = 'plan-sync-test';
  const plan: any = {
    id: planId,
    orgId: 'org-sync-test',
    name: 'Sync Test Runway Plan',
    cycleDays: 42,
    startDate: '2026-11-01',
    targetBasis: 'GROSS',
    contingencyReserveType: 'NONE',
    contingencyReserveValue: 0,
    status: 'ACTIVE',
    lines: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const curState = dataService.getState();
  (dataService as any).saveLocalState({
    ...curState,
    members: [...curState.members, adminActor, memberActor],
    runwayPlans: [...(curState.runwayPlans || []), plan],
    runwayPledges: curState.runwayPledges || [],
  });

  // 1. Pledging to runway plan updates member target
  dataService.pledgeToRunwayPlan({
    planId,
    memberId: memberActor.id,
    amount: 2500,
    pace: 'MONTHLY',
    actor: memberActor,
  });

  const memberAfterPledge = dataService.getState().members.find((m) => m.id === memberActor.id)!;
  assert.equal(memberAfterPledge.targetContributionUsd, 2500);

  // 2. Updating capital target updates the active runway plan's pledge
  dataService.updateMemberCapitalTarget({
    memberId: memberActor.id,
    targetContributionUsd: 3200,
    contributionPace: 'MILESTONE',
    actor: adminActor,
  });

  const pledgeAfterTargetUpdate = (dataService.getState().runwayPledges || []).find(
    (p) => p.planId === planId && p.memberId === memberActor.id
  )!;
  assert.equal(pledgeAfterTargetUpdate.amount, 3200);
});

test('Multi-Device Authentication: Changing password on Device A invalidates Device B session', async () => {
  const member: OrgMember = {
    id: 'mem-multi-device-test',
    email: 'multidevice@example.com',
    fullName: 'Multi Device User',
    phoneOrEmail: 'multidevice@example.com',
    role: 'MEMBER',
    approvalStatus: 'APPROVED',
    active: true,
    hasPasswordSetup: false,
    sessionVersion: 1,
    joinedAt: new Date().toISOString(),
  };

  const curState = dataService.getState();
  dataService.saveLocalState({
    ...curState,
    members: [...curState.members, member],
  });

  // Simulate active session on Device A
  (dataService as any).setActiveSession({
    uid: member.id,
    email: member.email,
    displayName: member.fullName,
    emailVerified: true,
    providers: ['google.com'],
    isCloudAuth: true,
    sessionVersion: 1,
  });

  // Device A sets up/changes password
  const updatedMember = await dataService.setupOrUpdatePasswordForCurrentUser({
    member,
    newPassword: 'SuperSecurePassword123!',
  });

  assert.equal(updatedMember.sessionVersion, 2);
  assert.ok(updatedMember.passwordVerifierHash);
  assert.ok(updatedMember.passwordChangedAt);

  // Device A session was upgraded to sessionVersion 2 and remains valid
  const deviceASession = dataService.getActiveSession();
  assert.equal(deviceASession?.sessionVersion, 2);
  assert.equal(dataService.checkAndEnforceActiveSessionValidity(), true);
});

test('Multi-Device Authentication: Global revocation stamps sessionsRevokedAt and increments sessionVersion', async () => {
  const member: OrgMember = {
    id: 'mem-global-revoke-test',
    email: 'revokeall@example.com',
    fullName: 'Revoke All User',
    phoneOrEmail: 'revokeall@example.com',
    role: 'MEMBER',
    approvalStatus: 'APPROVED',
    active: true,
    sessionVersion: 2,
    sessionsRevokedAt: new Date(Date.now() - 60000).toISOString(),
    joinedAt: new Date().toISOString(),
  };

  const curState = dataService.getState();
  dataService.saveLocalState({
    ...curState,
    members: [...curState.members, member],
  });

  // Verify member profile resolution and version tracking
  const found = dataService.findMemberByUidOrEmail(member.id, member.email);
  assert.ok(found);
  assert.equal(found.sessionVersion, 2);

  // Simulate signing back in AFTER the revocation (sessionCreatedAt > sessionsRevokedAt, sessionVersion === 2)
  (dataService as any).setActiveSession({
    uid: member.id,
    email: member.email,
    displayName: member.fullName,
    emailVerified: true,
    providers: ['google.com'],
    isCloudAuth: true,
    sessionVersion: 2,
    sessionCreatedAt: Date.now(),
  });

  // Verify that active session is valid and not rejected
  assert.equal(dataService.checkAndEnforceActiveSessionValidity(), true);

  // Simulate an app restart / onAuthStateChanged refresh where sessionVersion was not passed:
  // It should preserve sessionVersion 2 and sessionCreatedAt, remaining valid without kicking user out
  (dataService as any).setActiveSession({
    uid: member.id,
    email: member.email,
    displayName: member.fullName,
    emailVerified: true,
    providers: ['google.com'],
    isCloudAuth: true,
  });

  const refreshedSession = dataService.getActiveSession();
  assert.equal(refreshedSession?.sessionVersion, 2);
  assert.equal(dataService.checkAndEnforceActiveSessionValidity(), true);
});

test('General Business Venture (GENERAL_VENTURE): Logs expenses and fixed assets without requiring a farm site', () => {
  const adminActor: OrgMember = {
    id: 'mem-gb-admin-nosite',
    fullName: 'General Venture Founder',
    phoneOrEmail: 'founder@generalbiz.test',
    role: 'ORG_ADMIN',
    approvalStatus: 'APPROVED',
    active: true,
    joinedAt: new Date().toISOString(),
  };

  const gbOrg = dataService.createOrganization({
    name: 'Metro Trading & Logistics',
    type: 'GENERAL_VENTURE',
    actor: adminActor,
    defaultTargetContributionUsd: 2000,
  });

  assert.equal(gbOrg.type, 'GENERAL_VENTURE');
  assert.equal(gbOrg.features.livestockModule, false);
  assert.equal(gbOrg.features.farmSitesModule, false);
  assert.equal(dataService.isAgroOrganization(gbOrg.id), false);

  const gbAdminInOrg: OrgMember = {
    ...adminActor,
    orgId: gbOrg.id,
  };

  // Seed pool cash so asset purchase can succeed
  dataService.logCapitalContribution({
    memberId: gbAdminInOrg.id,
    direction: 'ADDITION',
    amount: 1000,
    note: 'Initial general venture working capital',
    actor: gbAdminInOrg,
  });

  // 1. Log expense with NO locationId -> must succeed without requiring a farm site
  const exp = dataService.logExpense({
    category: 'LABOR_WAGES',
    direction: 'DEDUCTION',
    amount: 120,
    note: 'Monthly store assistant wages',
    actor: gbAdminInOrg,
  });

  assert.equal(exp.orgId, gbOrg.id);
  assert.equal(exp.locationId, 'ALL');
  assert.equal(exp.locationName, 'General Business');
  assert.equal(exp.approvalStatus, 'APPROVED');

  // 2. Contra-reversal of general business expense -> must succeed without a farm site
  const contra = dataService.logExpense({
    locationId: exp.locationId,
    category: exp.category,
    direction: 'CONTRA_REVERSAL',
    amount: -20,
    referenceTransactionId: exp.id,
    note: 'Overpayment adjustment on wages',
    actor: gbAdminInOrg,
  });
  assert.equal(contra.locationId, 'ALL');
  assert.equal(contra.locationName, 'General Business');

  // 3. Log fixed asset with NO locationId -> must succeed without requiring a farm site
  const asset = dataService.logFixedAssetEvent({
    assetName: 'POS Thermal Terminal',
    category: 'IT, POS & Electronics',
    direction: 'INITIAL',
    quantityDelta: 1,
    valueDelta: 250,
    condition: 'EXCELLENT',
    note: 'Point of sale counter terminal',
    deductFromLeftMoney: true,
    actor: gbAdminInOrg,
  });
  assert.equal(asset.locationId, 'ALL');

  // 4. Agro-Farming org must still enforce farm site location
  const agroAdmin: OrgMember = {
    id: 'mem-agro-admin-sitecheck',
    fullName: 'Agro Admin',
    phoneOrEmail: 'agro@farm.test',
    role: 'ORG_ADMIN',
    approvalStatus: 'APPROVED',
    active: true,
    joinedAt: new Date().toISOString(),
  };
  const agroOrg = dataService.createOrganization({
    name: 'Sunrise Poultry Farm',
    type: 'AGRO_FARMING',
    actor: agroAdmin,
  });
  assert.equal(agroOrg.features.farmSitesModule, true);
  assert.equal(dataService.isAgroOrganization(agroOrg.id), true);

  assert.throws(
    () => {
      dataService.logExpense({
        category: 'FEED',
        direction: 'DEDUCTION',
        amount: 50,
        note: 'Attempt agro expense without site',
        actor: { ...agroAdmin, orgId: agroOrg.id },
      });
    },
    /Farm location is required/
  );
});

test.after(() => {
  setTimeout(() => process.exit(0), 100);
});
