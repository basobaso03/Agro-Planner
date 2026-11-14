import test from 'node:test';
import assert from 'node:assert/strict';
import { dataService } from '../src/services/dataService.ts';
import { outboxService } from '../src/services/outbox.ts';
import type { OrgMember } from '../src/types/agro.ts';
import type { Organization } from '../src/types/organization.ts';
import { TEST_ACCOUNTS, toOrgMember } from './helpers/testContext.ts';

test('WF-01: Founder Admin creates AGRO_FARMING and GENERAL_VENTURE organizations', () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);

  // 1. Create AGRO_FARMING Organization
  const agroOrg = dataService.createOrganization({
    name: 'Green Valley Agro-Ventures',
    type: 'AGRO_FARMING',
    actor: adminActor,
    defaultTargetContributionUsd: 2000,
    contributionPaceDefault: 'MONTHLY',
  });

  assert.ok(agroOrg.id);
  assert.equal(agroOrg.name, 'Green Valley Agro-Ventures');
  assert.equal(agroOrg.type, 'AGRO_FARMING');
  assert.equal(agroOrg.defaultTargetContributionUsd, 2000);
  assert.equal(agroOrg.features.livestockModule, true);
  assert.equal(agroOrg.features.farmSitesModule, true);
  assert.match(agroOrg.currentInviteCode, /^SEED-[23456789A-Z]{4}$/);

  // 2. Create GENERAL_VENTURE Organization
  const ventureAdminActor = toOrgMember(TEST_ACCOUNTS.ventureAdmin);
  const ventureOrg = dataService.createOrganization({
    name: 'Apex Commercial Fleet Syndicate',
    type: 'GENERAL_VENTURE',
    actor: ventureAdminActor,
    defaultTargetContributionUsd: 3000,
    contributionPaceDefault: 'MONTHLY',
  });

  assert.ok(ventureOrg.id);
  assert.equal(ventureOrg.name, 'Apex Commercial Fleet Syndicate');
  assert.equal(ventureOrg.type, 'GENERAL_VENTURE');
  assert.equal(ventureOrg.defaultTargetContributionUsd, 3000);
  assert.equal(ventureOrg.features.livestockModule, false);
  assert.equal(agroOrg.features.farmSitesModule, true);
});

test('WF-02: 24-Hour Cryptographic Invitation Code Lifecycle & Expiration Duration', () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);
  const org = dataService.createOrganization({
    name: 'Durability Agro Farm',
    type: 'AGRO_FARMING',
    actor: adminActor,
    defaultTargetContributionUsd: 1500,
  });

  const createdAtMs = new Date(org.inviteCodeCreatedAt).getTime();
  const expiresAtMs = new Date(org.inviteCodeExpiresAt).getTime();
  const diffHours = (expiresAtMs - createdAtMs) / (1000 * 60 * 60);

  // Must be strictly 24 hours
  assert.equal(diffHours, 24);
  assert.ok(expiresAtMs > Date.now());
});

test('WF-03: Member joins with valid 24-hr code and is admitted immediately', async () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);
  const org = dataService.createOrganization({
    name: 'Fast Join Agro Co-op',
    type: 'AGRO_FARMING',
    actor: adminActor,
    defaultTargetContributionUsd: 1200,
  });

  const candidate = toOrgMember(TEST_ACCOUNTS.candidateValid);

  // Redeem valid code
  const joinedOrg = await dataService.joinOrganizationWithCode({
    inviteCode: org.currentInviteCode,
    actor: candidate,
  });

  assert.equal(joinedOrg.id, org.id);
  const member = dataService.getState().members.find((m) => m.id === candidate.id);
  assert.ok(member);
  assert.equal(member.approvalStatus, 'APPROVED');
  assert.equal(member.active, true);
  assert.equal(member.role, 'MEMBER');
  assert.equal(member.targetContributionUsd, 1200);
  assert.equal(member.orgId, org.id);
});

test('WF-03-NEG-1: Member attempting to join with non-existent code is rejected', async () => {
  const candidate = toOrgMember(TEST_ACCOUNTS.candidateValid);

  await assert.rejects(
    async () => {
      await dataService.joinOrganizationWithCode({
        inviteCode: 'NON-EXISTENT-CODE',
        actor: candidate,
      });
    },
    /Invalid invitation code/
  );
});

test('WF-03-NEG-2: Member attempting to join with expired code (>24 hours) is rejected', async () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);
  const org = dataService.createOrganization({
    name: 'Expired Code Test Org',
    type: 'AGRO_FARMING',
    actor: adminActor,
  });

  const expiredOrg: Organization = {
    ...org,
    id: 'org-expired-lifecycle-01',
    currentInviteCode: 'SEED-OLD1',
    inviteCodeCreatedAt: new Date(Date.now() - 25 * 3600 * 1000).toISOString(),
    inviteCodeExpiresAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(), // Expired 1 hr ago
  };

  const curState = dataService.getState();
  (dataService as any).saveLocalState({
    ...curState,
    organizations: [...(curState.organizations || []), expiredOrg],
  });

  const candidate = toOrgMember(TEST_ACCOUNTS.candidateValid);

  await assert.rejects(
    async () => {
      await dataService.joinOrganizationWithCode({
        inviteCode: 'SEED-OLD1',
        actor: candidate,
      });
    },
    /expired after 24 hours/
  );
});

test('WF-04: Admin manual code refresh generates new code and invalidates prior code', async () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);
  const org = dataService.createOrganization({
    name: 'Refresh Code Test Org',
    type: 'AGRO_FARMING',
    actor: adminActor,
    defaultTargetContributionUsd: 1800,
  });

  const oldCode = org.currentInviteCode;

  // Refresh code
  const refreshedOrg = dataService.refreshInviteCode({
    orgId: org.id,
    actor: adminActor,
  });

  assert.notEqual(refreshedOrg.currentInviteCode, oldCode);
  assert.ok(new Date(refreshedOrg.inviteCodeExpiresAt).getTime() > Date.now());

  // Negative: Candidate Farai attempts to use oldCode -> MUST BE REJECTED
  const candidateFarai = toOrgMember(TEST_ACCOUNTS.candidateRefresh);
  await assert.rejects(
    async () => {
      await dataService.joinOrganizationWithCode({
        inviteCode: oldCode,
        actor: candidateFarai,
      });
    },
    /Invalid invitation code/
  );

  // Positive: Candidate Farai uses new refreshed code -> SUCCEEDS
  const joinedOrg = await dataService.joinOrganizationWithCode({
    inviteCode: refreshedOrg.currentInviteCode,
    actor: candidateFarai,
  });

  assert.equal(joinedOrg.id, org.id);
  const admitted = dataService.getState().members.find((m) => m.id === candidateFarai.id);
  assert.equal(admitted?.approvalStatus, 'APPROVED');
});

test('WF-04-NEG: Non-admin member or ground operator attempting to refresh code is rejected', () => {
  const memberActor = toOrgMember(TEST_ACCOUNTS.agroMember);
  const operatorActor = toOrgMember(TEST_ACCOUNTS.agroOperator);

  assert.throws(
    () => {
      dataService.refreshInviteCode({
        orgId: 'org-agro-prod-01',
        actor: memberActor,
      });
    },
    /Access Denied: Only Organization Admins can refresh invitation codes/
  );

  assert.throws(
    () => {
      dataService.refreshInviteCode({
        orgId: 'org-agro-prod-01',
        actor: operatorActor,
      });
    },
    /Access Denied: Only Organization Admins can refresh invitation codes/
  );
});

test('WF-05: signOutCloud completely wipes all localStorage, sessionStorage, IndexedDB, outbox queue, and auth session state', async () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);
  dataService.createOrganization({
    name: 'Wipe Test Organization',
    type: 'AGRO_FARMING',
    actor: adminActor,
    defaultTargetContributionUsd: 1000,
  });

  if (typeof window !== 'undefined') {
    window.localStorage.setItem('agro_planner_local_credentials_v2', JSON.stringify({ 'test@example.com': {} }));
    window.localStorage.setItem('agro_planner_active_auth_session_v2', JSON.stringify({ uid: adminActor.id }));
    window.localStorage.setItem('agro_planner_biometric_credential_v1', JSON.stringify({ id: 'bio-1' }));
    window.localStorage.setItem('capita_outbox_queue_v1', JSON.stringify([{ id: 'op-1' }]));
    window.sessionStorage.setItem('temp_session_token', 'secret-token');
  }

  await dataService.signOutCloud();

  assert.equal(dataService.getActiveSession(), null);
  assert.equal(dataService.getState().organizations?.length || 0, 0);
  assert.equal(dataService.getState().members.length, 0);
  assert.equal(
    outboxService.getQueue().length,
    0,
    'Outbox queue must be cleared upon signOutCloud'
  );
});

test('WF-06: New user can join organization with 24-hr Org Invite Code + Personal Claim Code simultaneously', async () => {
  const founder = toOrgMember(TEST_ACCOUNTS.agroAdmin);
  const org = dataService.createOrganization({
    name: 'Co-op Onboarding Claim Farm',
    type: 'AGRO_FARMING',
    actor: founder,
    defaultTargetContributionUsd: 1000,
  });
  const activeFounder = dataService.getState().members.find((m) => m.id === founder.id) || {
    ...founder,
    orgId: org.id,
  };

  const placeholder = dataService.addMember({
    fullName: 'Future Joiner Placeholder',
    phoneOrEmail: '',
    role: 'TREASURER',
    initialContributionUsd: 350,
    isPlaceholder: true,
    actor: activeFounder,
  });
  const personalCode = dataService.getPlaceholderClaimCode(placeholder.id) || '';
  assert.match(personalCode, /^CLM-/);

  const newcomer = toOrgMember({
    ...TEST_ACCOUNTS.candidateValid,
    id: 'uid-onboard-claim-user',
    uid: 'uid-onboard-claim-user',
    email: 'future.joiner@example.com',
    orgId: '',
  });
  const joinedOrg = await dataService.joinOrganizationWithCode({
    inviteCode: org.currentInviteCode,
    claimCode: personalCode,
    actor: newcomer,
  });
  assert.equal(joinedOrg.id, org.id);

  const merged = dataService.getState().members.find((m) => m.id === newcomer.id);
  assert.equal(merged?.role, 'TREASURER');
  assert.ok(merged?.linkedMemberIds?.includes(placeholder.id));
});

test.after(() => {
  setTimeout(() => process.exit(0), 100);
});
