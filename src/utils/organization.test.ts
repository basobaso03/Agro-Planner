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

test.after(() => {
  setTimeout(() => process.exit(0), 100);
});
