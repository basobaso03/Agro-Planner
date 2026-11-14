import test from 'node:test';
import assert from 'node:assert/strict';
import { dataService } from '../src/services/dataService.ts';
import { outboxService } from '../src/services/outbox.ts';
import { computeMemberEquities } from '../src/utils/calculations.ts';
import { computeFundingLayers } from '../src/utils/runway.ts';
import { verifyAuditChainIntegrity } from '../src/utils/cryptoHash.ts';
import {
  computeClaimTokenId,
  filterVisibleOrgMembers,
  isClaimedTombstone,
  isUnclaimedPlaceholder,
} from '../src/utils/memberIdentity.ts';
import { generateEquityCertificatePdf } from '../src/services/pdf/generators/shared/equityCertificatePdf.ts';
import type { OrgMember } from '../src/types/agro.ts';
import { toOrgMember, TEST_ACCOUNTS } from './helpers/testContext.ts';

let failedCount = 0;
function runTest(name: string, fn: () => void | Promise<void>) {
  test(name, async () => {
    try {
      await fn();
    } catch (e: any) {
      failedCount++;
      console.error(`\n>>> FAILURE IN [${name}]:`, e?.message || e);
      throw e;
    }
  });
}

runTest('WF-MOCK-01: AGRO_FARMING Path A — Admin creates mock contributors (no email), Runway contributions & pledges, then future user claims with CLM code', async () => {
  const adminActor = toOrgMember({
    ...TEST_ACCOUNTS.agroAdmin,
    id: 'uid-agro-founder-14',
    uid: 'uid-agro-founder-14',
    orgId: 'org-pending',
  });

  const agroOrg = dataService.createOrganization({
    name: 'Macheke Pre-Reg Agro Collective',
    type: 'AGRO_FARMING',
    actor: adminActor,
    defaultTargetContributionUsd: 1500,
    contributionPaceDefault: 'MONTHLY',
  });
  const activeAdmin = dataService.getState().members.find((m) => m.id === adminActor.id) || {
    ...adminActor,
    orgId: agroOrg.id,
  };

  const siteNorton = dataService.addLocation({
    name: 'Norton Layer House #1',
    region: 'Mashonaland West',
    primaryOperatorName: 'Site Lead',
    actor: activeAdmin,
  });

  dataService.setRunwayModuleEnabled({ orgId: agroOrg.id, enabled: true, actor: activeAdmin });
  const { plan } = dataService.createRunwayPlan({
    orgId: agroOrg.id,
    name: 'Layer Expansion Q4',
    enforcement: 'STRICT',
    startDate: new Date().toISOString(),
    contingencyMode: 'PERCENT',
    contingencyPercent: 0,
    targetBasis: 'GROSS',
    activationThresholdPct: 100,
    actor: activeAdmin,
  });
  dataService.upsertRunwayLine({
    planId: plan.id,
    line: {
      title: 'Point-of-Lay Pullets',
      category: 'LIVESTOCK',
      kind: 'COST',
      qty: 500,
      unitCost: 8,
      priority: 'ESSENTIAL',
    },
    actor: activeAdmin,
  });
  dataService.lockRunwayPlan({ planId: plan.id, actor: activeAdmin });

  // 1. Single Mock Contributor with NO EMAIL, role = TREASURER, site = siteNorton, initial capital + initial pledge
  const mockChiedza = dataService.addMember({
    fullName: 'Chiedza Moyo',
    phoneOrEmail: '',
    role: 'TREASURER',
    assignedLocationId: siteNorton.id,
    targetContributionUsd: 2000,
    contributionPace: 'MONTHLY',
    initialContributionUsd: 750,
    initialContributionPlanId: plan.id,
    contributionNote: 'Cash deposit received before app registration',
    initialPledgeAmount: 1200,
    initialPledgePlanId: plan.id,
    isPlaceholder: true,
    actor: activeAdmin,
  });

  assert.equal(isUnclaimedPlaceholder(mockChiedza), true);
  assert.equal(mockChiedza.role, 'TREASURER');
  assert.equal(mockChiedza.assignedLocationId, siteNorton.id);
  const chiedzaCode = dataService.getPlaceholderClaimCode(mockChiedza.id) || '';
  assert.match(chiedzaCode, /^CLM-[A-Z2-9]{8}$/);

  // 2. Batch Mock Add including duplicate names with disambiguators
  const batchRes = dataService.addBulkPlaceholderMembers({
    defaultRunwayPlanId: plan.id,
    entries: [
      {
        fullName: 'Tendai Sibanda',
        phone: '+263771000111',
        role: 'MEMBER',
        targetContributionUsd: 1000,
        initialContributionUsd: 400,
        initialPledgeAmount: 1000,
      },
      {
        fullName: 'Tendai Sibanda',
        phone: '+263772000222',
        role: 'GROUND_OPERATOR',
        assignedLocationId: siteNorton.id,
        targetContributionUsd: 500,
        initialContributionUsd: 200,
        initialPledgeAmount: 500,
      },
    ],
    actor: activeAdmin,
  });
  assert.equal(batchRes.errors.length, 0);
  assert.equal(batchRes.created.length, 2);
  assert.notEqual(batchRes.created[0].member.id, batchRes.created[1].member.id);
  assert.notEqual(batchRes.created[0].claimCode, batchRes.created[1].claimCode);

  // Verify pre-claim capital pool & Runway funding layers reflect mock contributions + pledges
  const preState = dataService.getState();
  const orgContribsPre = preState.capitalContributions.filter((c) => c.orgId === agroOrg.id);
  const orgPledgesPre = (preState.runwayPledges || []).filter((p) => p.orgId === agroOrg.id);
  const preLayers = computeFundingLayers(
    plan,
    (preState.runwayLines || []).filter((l) => l.planId === plan.id),
    orgPledgesPre,
    orgContribsPre,
    []
  );
  assert.equal(preLayers.pledged, 2700); // 1200 + 1000 + 500
  assert.equal(preLayers.collected, 1350); // 750 + 400 + 200

  // 3. Future Registration: Chiedza signs up with a completely new email & UID and claims using Org Code + Personal Claim Code
  const newcomerChiedza: OrgMember = {
    id: 'uid-chiedza-future-99',
    uid: 'uid-chiedza-future-99',
    fullName: 'C. Moyo',
    email: 'chiedza.new@mail.com',
    phoneOrEmail: 'chiedza.new@mail.com',
    role: 'MEMBER',
    approvalStatus: 'PENDING_APPROVAL',
    joinedAt: new Date().toISOString(),
    active: true,
  };

  await dataService.joinOrganizationWithCode({
    inviteCode: agroOrg.currentInviteCode,
    claimCode: chiedzaCode,
    actor: newcomerChiedza,
  });

  const postState = dataService.getState();
  const claimedReal = postState.members.find((m) => m.id === newcomerChiedza.id)!;
  const claimedTombstone = postState.members.find((m) => m.id === mockChiedza.id)!;

  assert.equal(claimedReal.orgId, agroOrg.id);
  assert.equal(claimedReal.approvalStatus, 'APPROVED');
  assert.equal(claimedReal.role, 'TREASURER', 'Must auto-inherit TREASURER role from mock');
  assert.equal(claimedReal.assignedLocationId, siteNorton.id, 'Must auto-inherit Agro site location');
  // Runway pledgeToRunwayPlan synchronizes member targetContributionUsd with pledged cycle commitment ($1,200)
  assert.equal(claimedReal.targetContributionUsd, 1200);
  assert.ok(claimedReal.linkedMemberIds?.includes(mockChiedza.id));
  assert.equal(isClaimedTombstone(claimedTombstone), true);
  assert.equal(claimedTombstone.active, false);

  // Tombstone must be hidden from visible org member lists & equity calculations without double-counting
  const visible = filterVisibleOrgMembers(postState.members, agroOrg.id);
  assert.equal(visible.some((m) => m.id === mockChiedza.id), false);
  assert.equal(visible.some((m) => m.id === newcomerChiedza.id), true);

  const equities = computeMemberEquities(
    visible,
    postState.capitalContributions.filter((c) => c.orgId === agroOrg.id),
    1350
  );
  const chiedzaEquity = equities.find((e) => e.member.id === newcomerChiedza.id)!;
  assert.equal(chiedzaEquity.netContribution, 750);

  // Replay protection: re-using Chiedza's Claim Code by another user must fail
  const intruderAttempt: OrgMember = {
    id: 'uid-replay-attacker',
    uid: 'uid-replay-attacker',
    fullName: 'Replay Attacker',
    email: 'attacker@mail.com',
    phoneOrEmail: 'attacker@mail.com',
    role: 'MEMBER',
    approvalStatus: 'PENDING_APPROVAL',
    joinedAt: new Date().toISOString(),
    active: true,
  };
  await assert.rejects(
    async () => {
      await dataService.joinOrganizationWithCode({
        inviteCode: agroOrg.currentInviteCode,
        claimCode: chiedzaCode,
        actor: intruderAttempt,
      });
    },
    /already been used|already been claimed|revoked/i
  );

  // Audit chain remains 100% SHA-256 intact
  const auditCheck = verifyAuditChainIntegrity(postState.auditNotifications || []);
  assert.equal(auditCheck.valid, true, auditCheck.brokenReason);
});

runTest('WF-MOCK-02: GENERAL_VENTURE Path B — Post-join contributions, Claim Request flow, Admin Link Merge & Duplicate Pledge Consolidation', async () => {
  const ventureAdminActor = toOrgMember({
    ...TEST_ACCOUNTS.ventureAdmin,
    id: 'uid-venture-founder-14',
    uid: 'uid-venture-founder-14',
    orgId: 'org-pending',
  });

  const ventureOrg = dataService.createOrganization({
    name: 'Apex Retail Pre-Reg Syndicate',
    type: 'GENERAL_VENTURE',
    actor: ventureAdminActor,
    defaultTargetContributionUsd: 2500,
    contributionPaceDefault: 'MONTHLY',
  });
  const activeAdmin = dataService.getState().members.find((m) => m.id === ventureAdminActor.id) || {
    ...ventureAdminActor,
    orgId: ventureOrg.id,
  };

  dataService.setRunwayModuleEnabled({ orgId: ventureOrg.id, enabled: true, actor: activeAdmin });
  const { plan } = dataService.createRunwayPlan({
    orgId: ventureOrg.id,
    name: 'Wholesale Inventory Q1',
    enforcement: 'STRICT',
    startDate: new Date().toISOString(),
    contingencyMode: 'PERCENT',
    contingencyPercent: 0,
    targetBasis: 'GROSS',
    activationThresholdPct: 100,
    actor: activeAdmin,
  });
  dataService.upsertRunwayLine({
    planId: plan.id,
    line: {
      title: 'Storefront Stock Load',
      category: 'STOCK',
      kind: 'COST',
      qty: 1,
      unitCost: 5000,
      priority: 'ESSENTIAL',
    },
    actor: activeAdmin,
  });
  dataService.lockRunwayPlan({ planId: plan.id, actor: activeAdmin });

  // Create mock contributor in GENERAL_VENTURE (must NOT set assignedLocationId even if omitted or passed accidentally via empty UI)
  const mockKudzai = dataService.addMember({
    fullName: 'Kudzai Ndlovu',
    phoneOrEmail: '+263773334444',
    role: 'MEMBER',
    assignedLocationId: 'should-be-cleared-in-venture',
    targetContributionUsd: 2000,
    contributionPace: 'MONTHLY',
    initialContributionUsd: 500,
    initialContributionPlanId: plan.id,
    initialPledgeAmount: 1000,
    initialPledgePlanId: plan.id,
    isPlaceholder: true,
    actor: activeAdmin,
  });

  assert.equal(mockKudzai.assignedLocationId, undefined, 'General Venture must never retain agro location IDs');

  // Kudzai registers later WITHOUT Personal Claim Code, using only Org Invite Code (SEED-XXXX)
  const kudzaiNewAccount: OrgMember = {
    id: 'uid-kudzai-real-77',
    uid: 'uid-kudzai-real-77',
    fullName: 'Kudzai Ndlovu Real',
    email: 'kudzai.ndlovu@gmail.com',
    phoneOrEmail: 'kudzai.ndlovu@gmail.com',
    role: 'MEMBER',
    approvalStatus: 'PENDING_APPROVAL',
    joinedAt: new Date().toISOString(),
    active: true,
  };
  await dataService.joinOrganizationWithCode({
    inviteCode: ventureOrg.currentInviteCode,
    actor: kudzaiNewAccount,
  });

  const joinedKudzai = dataService.getState().members.find((m) => m.id === kudzaiNewAccount.id)!;

  // Kudzai logs a post-join contribution ($300) + a post-join Runway pledge ($600) under his new account BEFORE linking
  dataService.logCapitalContribution({
    memberId: joinedKudzai.id,
    direction: 'ADDITION',
    amount: 300,
    note: 'Post-join second installment',
    runwayPlanId: plan.id,
    actor: activeAdmin,
  });
  dataService.pledgeToRunwayPlan({
    planId: plan.id,
    memberId: joinedKudzai.id,
    amount: 600,
    note: 'Additional cycle pledge after signup',
    actor: joinedKudzai,
  });

  // Path B Step 1: Another member submits a bogus claim request -> Admin rejects it
  const wrongMember: OrgMember = {
    id: 'uid-wrong-claimant-88',
    uid: 'uid-wrong-claimant-88',
    fullName: 'Someone Else',
    email: 'someone@gmail.com',
    phoneOrEmail: 'someone@gmail.com',
    role: 'MEMBER',
    approvalStatus: 'PENDING_APPROVAL',
    joinedAt: new Date().toISOString(),
    active: true,
  };
  await dataService.joinOrganizationWithCode({
    inviteCode: ventureOrg.currentInviteCode,
    actor: wrongMember,
  });
  const wrongClaimant = dataService.getState().members.find((m) => m.id === wrongMember.id)!;
  const bogusReq = dataService.submitMemberClaimRequest({
    placeholderMemberId: mockKudzai.id,
    note: 'Oops wrong profile',
    actor: wrongClaimant,
  });
  const rejectedReq = dataService.rejectMemberClaimRequest({
    requestId: bogusReq.id,
    note: 'Identity did not match',
    actor: activeAdmin,
  });
  assert.equal(rejectedReq.status, 'REJECTED');

  // Path B Step 2: Real Kudzai submits request -> Admin approves & merges
  const realReq = dataService.submitMemberClaimRequest({
    placeholderMemberId: mockKudzai.id,
    note: 'Please link my Jan cash contribution ($500 receipt)',
    actor: joinedKudzai,
  });
  assert.equal(realReq.status, 'PENDING');

  const { mergedMember, placeholderTombstone } = await dataService.adminLinkAndMergeMember({
    placeholderMemberId: mockKudzai.id,
    targetMemberId: joinedKudzai.id,
    claimRequestId: realReq.id,
    finalRole: 'MEMBER',
    note: 'Verified receipt against ledger',
    actor: activeAdmin,
  });

  assert.ok(mergedMember.linkedMemberIds?.includes(mockKudzai.id));
  assert.equal(mergedMember.assignedLocationId, undefined);
  assert.equal(placeholderTombstone.accountStatus, 'CLAIMED');
  assert.equal(placeholderTombstone.active, false);

  const postState = dataService.getState();
  const resolvedReq = (postState.memberClaimRequests || []).find((r) => r.id === realReq.id)!;
  assert.equal(resolvedReq.status, 'APPROVED');

  // Verify Capital Equity sums BOTH pre-claim ($500) + post-join ($300) = $800 without tombstone duplication
  const orgContribs = postState.capitalContributions.filter((c) => c.orgId === ventureOrg.id);
  const visibleMembers = filterVisibleOrgMembers(postState.members, ventureOrg.id);
  const equities = computeMemberEquities(visibleMembers, orgContribs, 800);
  const kudzaiEquity = equities.find((e) => e.member.id === joinedKudzai.id)!;
  assert.equal(kudzaiEquity.netContribution, 800);
  assert.equal(visibleMembers.some((m) => m.id === mockKudzai.id), false);

  // Verify Runway pledge consolidation summed $1,000 + $600 = $1,600 into 1 ACTIVE survivor and marked 1 MERGED without double-counting
  const planPledges = (postState.runwayPledges || []).filter((p) => p.planId === plan.id);
  const activePledges = planPledges.filter((p) => p.status !== 'MERGED' && p.status !== 'WITHDRAWN');
  const mergedPledges = planPledges.filter((p) => p.status === 'MERGED');
  assert.equal(activePledges.length, 1);
  assert.equal(mergedPledges.length, 1);
  assert.equal(activePledges[0].amount, 1600);
  assert.equal(activePledges[0].memberId, joinedKudzai.id);

  const postLayers = computeFundingLayers(
    plan,
    (postState.runwayLines || []).filter((l) => l.planId === plan.id),
    planPledges,
    orgContribs,
    []
  );
  assert.equal(postLayers.pledged, 1600);
  assert.equal(postLayers.collected, 800);

  // Verify Equity Certificate PDF generation works cleanly post-merge
  const pdf = generateEquityCertificatePdf({
    organization: ventureOrg,
    equitySummaries: equities,
    totalPool: 800,
    totalNav: 800,
    targetMember: mergedMember,
    operatorName: activeAdmin.fullName,
  });
  assert.ok(pdf.output('arraybuffer').byteLength > 500);
});

runTest('WF-MOCK-03: Security, RBAC, Regeneration & Cross-Org Isolation Guards', async () => {
  const orgAFounder = toOrgMember({
    ...TEST_ACCOUNTS.agroAdmin,
    id: 'uid-iso-orgA-admin',
    uid: 'uid-iso-orgA-admin',
    orgId: 'org-pending',
  });
  const orgBFounder = toOrgMember({
    ...TEST_ACCOUNTS.ventureAdmin,
    id: 'uid-iso-orgB-admin',
    uid: 'uid-iso-orgB-admin',
    orgId: 'org-pending',
  });

  const orgA = dataService.createOrganization({
    name: 'Org Alpha Farm',
    type: 'AGRO_FARMING',
    actor: orgAFounder,
    defaultTargetContributionUsd: 1000,
  });
  const orgB = dataService.createOrganization({
    name: 'Org Beta Shop',
    type: 'GENERAL_VENTURE',
    actor: orgBFounder,
    defaultTargetContributionUsd: 1000,
  });

  const adminA = dataService.getState().members.find((m) => m.id === orgAFounder.id)!;
  const adminB = dataService.getState().members.find((m) => m.id === orgBFounder.id)!;

  const mockInA = dataService.addMember({
    fullName: 'Mock Alpha',
    phoneOrEmail: '',
    role: 'MEMBER',
    initialContributionUsd: 250,
    isPlaceholder: true,
    actor: adminA,
  });
  const originalCodeA = dataService.getPlaceholderClaimCode(mockInA.id);

  // Regenerating claim code invalidates the old claim code and issues a new one
  const freshCodeA = await dataService.regeneratePlaceholderClaimCode({
    placeholderMemberId: mockInA.id,
    actor: adminA,
  });
  assert.notEqual(freshCodeA, originalCodeA);

  // Non-admin member cannot batch add, regenerate claim codes, or merge
  const memberInA: OrgMember = {
    id: 'uid-regular-member-a',
    uid: 'uid-regular-member-a',
    orgId: orgA.id,
    fullName: 'Regular Member',
    phoneOrEmail: 'regular@alpha.com',
    role: 'MEMBER',
    approvalStatus: 'APPROVED',
    joinedAt: new Date().toISOString(),
    active: true,
  };
  assert.throws(
    () =>
      dataService.addBulkPlaceholderMembers({
        entries: [{ fullName: 'Unauthorized Mock' }],
        actor: memberInA,
      }),
    /Access Denied/
  );
  await assert.rejects(
    async () =>
      await dataService.regeneratePlaceholderClaimCode({
        placeholderMemberId: mockInA.id,
        actor: memberInA,
      }),
    /Access Denied/
  );

  // Cross-org isolation: Trying to redeem Org A's claim code inside Org B must fail
  const newcomerB: OrgMember = {
    id: 'uid-newcomer-b',
    uid: 'uid-newcomer-b',
    fullName: 'Cross Org User',
    email: 'cross@beta.com',
    phoneOrEmail: 'cross@beta.com',
    role: 'MEMBER',
    approvalStatus: 'PENDING_APPROVAL',
    joinedAt: new Date().toISOString(),
    active: true,
  };
  await assert.rejects(
    async () => {
      await dataService.joinOrganizationWithCode({
        inviteCode: orgB.currentInviteCode,
        claimCode: freshCodeA,
        actor: newcomerB,
      });
    },
    /Invalid Personal Claim Code/i
  );

  // Cross-org admin link attack: Admin B cannot merge Admin A's placeholder into any member
  await assert.rejects(
    async () => {
      await dataService.adminLinkAndMergeMember({
        placeholderMemberId: mockInA.id,
        targetMemberId: adminB.id,
        actor: adminB,
      });
    },
    /Tenant Boundary Violation/i
  );

  // Also ensure old invalidated code rejects even with valid Org A invite code
  await assert.rejects(
    async () => {
      await dataService.joinOrganizationWithCode({
        inviteCode: orgA.currentInviteCode,
        claimCode: originalCodeA,
        actor: newcomerB,
      });
    },
    /Invalid Personal Claim Code/i
  );

  // Verify deterministic token hashing isolates identical claim strings across orgs
  assert.notEqual(
    computeClaimTokenId(orgA.id, freshCodeA),
    computeClaimTokenId(orgB.id, freshCodeA)
  );
  assert.ok(Array.isArray(outboxService.getQueue()));
});

test.after(() => {
  if (failedCount > 0) {
    console.error(`\n❌ Suite 14 Total Failed: ${failedCount}`);
    setTimeout(() => process.exit(1), 200);
  } else {
    setTimeout(() => process.exit(0), 200);
  }
});
