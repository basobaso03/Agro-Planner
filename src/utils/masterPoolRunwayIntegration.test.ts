import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeFundingLayers,
  deriveLineStatuses,
  evaluateSpend,
  computeRecovery,
  round2,
} from './runway.ts';
import {
  computeFinancialSummary,
  computeMemberEquities,
} from './calculations.ts';
import type {
  RunwayPlan,
  RunwayLine,
  RunwayPledge,
  RunwayPaymentClaim,
} from '../types/runway.ts';
import type {
  OrgMember,
  CapitalContributionEvent,
  ExpenseLedgerEvent,
  FarmLocation,
  LivestockEntry,
  LivestockLifecycleEvent,
} from '../types/agro.ts';
import type { Organization } from '../types/organization.ts';

const testOrg: Organization = {
  id: 'org-test-agro-master',
  name: 'Sunland Agro Farming',
  type: 'AGRO_FARMING',
  adminMemberId: 'mem-admin',
  adminEmail: 'admin@sunland.org',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  currentInviteCode: 'SEED-TEST',
  inviteCodeCreatedAt: '2026-01-01T00:00:00Z',
  inviteCodeExpiresAt: '2026-01-02T00:00:00Z',
  defaultTargetContributionUsd: 1000,
  contributionPaceDefault: 'MONTHLY',
  currency: 'USD',
  currencySymbol: '$',
  features: {
    livestockModule: true,
    farmSitesModule: true,
    feedInventoryModule: true,
    multiSigApprovals: true,
    publicAuditVerifier: true,
    runwayModule: true,
  },
};

const adminMember: OrgMember = {
  id: 'mem-admin',
  uid: 'uid-admin',
  orgId: testOrg.id,
  fullName: 'Farai Admin',
  phoneOrEmail: '+263771111111',
  role: 'ORG_ADMIN',
  approvalStatus: 'APPROVED',
  active: true,
  joinedAt: '2026-01-01T00:00:00Z',
  targetContributionUsd: 1000,
  contributionPace: 'MONTHLY',
};

const partnerMember: OrgMember = {
  id: 'mem-partner',
  uid: 'uid-partner',
  orgId: testOrg.id,
  fullName: 'Tariro Partner',
  phoneOrEmail: '+263772222222',
  role: 'MEMBER',
  approvalStatus: 'APPROVED',
  active: true,
  joinedAt: '2026-01-01T00:00:00Z',
  targetContributionUsd: 1000,
  contributionPace: 'MONTHLY',
};

const testPlan: RunwayPlan = {
  id: 'RWY-BATCH-01',
  orgId: testOrg.id,
  name: 'Broiler Batch 01 (3000 Birds)',
  orgType: 'AGRO_FARMING',
  mode: 'SIMPLE',
  status: 'ACTIVE',
  enforcement: 'STRICT',
  startDate: '2026-02-01T00:00:00Z',
  contingencyMode: 'PERCENT',
  contingencyPercent: 10,
  targetBasis: 'GROSS',
  activationThresholdPct: 100,
  openingCashAdopted: 500,
  plannedFinancing: [],
  phases: [],
  showMemberPledges: true,
  collectionMode: 'ANYTIME',
  milestonesReached: {},
  version: 1,
  createdByMemberId: adminMember.id,
  createdByName: adminMember.fullName,
  createdAt: '2026-01-15T00:00:00Z',
  updatedAt: '2026-01-15T00:00:00Z',
  auditHash: 'hash-plan-01',
};

const feedLine: RunwayLine = {
  id: 'RWL-FEED-01',
  planId: testPlan.id,
  orgId: testOrg.id,
  kind: 'COST',
  title: 'Broiler Starter Feed (50 Bags)',
  category: 'FEED',
  qty: 50,
  unitCost: 20, // Total = $1,000
  priority: 'ESSENTIAL',
  origin: 'PLAN',
  approval: 'APPROVED',
  sortOrder: 1,
  createdAt: '2026-01-15T00:00:00Z',
  updatedAt: '2026-01-15T00:00:00Z',
  auditHash: 'hash-line-01',
};

const chicksLine: RunwayLine = {
  id: 'RWL-CHICKS-02',
  planId: testPlan.id,
  orgId: testOrg.id,
  kind: 'COST',
  title: 'Day Old Chicks (3000 Birds)',
  category: 'LIVESTOCK_PURCHASE',
  qty: 3000,
  unitCost: 0.85, // Total = $2,550
  priority: 'ESSENTIAL',
  origin: 'PLAN',
  approval: 'APPROVED',
  sortOrder: 2,
  createdAt: '2026-01-15T00:00:00Z',
  updatedAt: '2026-01-15T00:00:00Z',
  auditHash: 'hash-line-02',
};

const allLines = [feedLine, chicksLine];

test('Integrated Ledger: Initial Onboarding Capital establishes Treasury & Member Equities', () => {
  const initialContributions: CapitalContributionEvent[] = [
    {
      id: 'TX-CAP-01',
      orgId: testOrg.id,
      memberId: adminMember.id,
      memberName: adminMember.fullName,
      direction: 'ADDITION',
      amount: 1000,
      note: 'Founding equity injection',
      createdAt: '2026-01-01T00:00:00Z',
      createdByMemberId: adminMember.id,
      auditHash: 'hash-cap-01',
    },
    {
      id: 'TX-CAP-02',
      orgId: testOrg.id,
      memberId: partnerMember.id,
      memberName: partnerMember.fullName,
      direction: 'ADDITION',
      amount: 400,
      note: 'Initial partial capital payment',
      createdAt: '2026-01-02T00:00:00Z',
      createdByMemberId: adminMember.id,
      auditHash: 'hash-cap-02',
    },
  ];

  const financials = computeFinancialSummary({
    capitalContributions: initialContributions,
    expenses: [],
    livestockEvents: [],
    fixedAssets: [],
    livestockStatuses: [],
  });

  assert.equal(financials.totalPool, 1400);
  assert.equal(financials.leftMoney, 1400);

  const equities = computeMemberEquities(
    [adminMember, partnerMember],
    initialContributions,
    financials.totalNav
  );

  const adminEq = equities.find((e) => e.member.id === adminMember.id);
  const partnerEq = equities.find((e) => e.member.id === partnerMember.id);

  assert.ok(adminEq);
  assert.equal(adminEq.netContribution, 1000);
  assert.equal(adminEq.progressPercentage, 100);
  assert.equal(adminEq.isGoalMet, true);

  assert.ok(partnerEq);
  assert.equal(partnerEq.netContribution, 400);
  assert.equal(partnerEq.progressPercentage, 40);
  assert.equal(partnerEq.remainingToTargetUsd, 600);
  assert.equal(partnerEq.isGoalMet, false);
});

test('Integrated Ledger: Runway Pay-In credits Member Master Equity, Master Pool & Left Money', () => {
  const initialContributions: CapitalContributionEvent[] = [
    {
      id: 'TX-CAP-01',
      orgId: testOrg.id,
      memberId: adminMember.id,
      memberName: adminMember.fullName,
      direction: 'ADDITION',
      amount: 1000,
      note: 'Founding capital',
      createdAt: '2026-01-01T00:00:00Z',
      createdByMemberId: adminMember.id,
      auditHash: 'hash-cap-01',
    },
    {
      id: 'TX-CAP-02',
      orgId: testOrg.id,
      memberId: partnerMember.id,
      memberName: partnerMember.fullName,
      direction: 'ADDITION',
      amount: 400,
      note: 'Initial capital',
      createdAt: '2026-01-02T00:00:00Z',
      createdByMemberId: adminMember.id,
      auditHash: 'hash-cap-02',
    },
  ];

  // Partner pledges $600 to fund the Runway Plan
  const partnerPledge: RunwayPledge = {
    id: 'PLG-01',
    planId: testPlan.id,
    orgId: testOrg.id,
    memberId: partnerMember.id,
    memberName: partnerMember.fullName,
    amount: 600,
    pace: 'ONE_OFF',
    history: [],
    createdAt: '2026-01-16T00:00:00Z',
    updatedAt: '2026-01-16T00:00:00Z',
  };

  // Partner pays in $600 against their Runway pledge
  const runwayPayInContribution: CapitalContributionEvent = {
    id: 'TX-CAP-RUNWAY-03',
    orgId: testOrg.id,
    memberId: partnerMember.id,
    memberName: partnerMember.fullName,
    direction: 'ADDITION',
    amount: 600,
    note: `Runway Pay-in: EcoCash TX-9921 for ${testPlan.name}`,
    runwayPlanId: testPlan.id,
    pledgeId: partnerPledge.id,
    claimId: 'CLM-01',
    createdAt: '2026-01-18T00:00:00Z',
    createdByMemberId: adminMember.id,
    auditHash: 'hash-cap-runway-03',
  };

  const allContributions = [...initialContributions, runwayPayInContribution];

  // 1. Check Master Financial Ledger
  const updatedFinancials = computeFinancialSummary({
    capitalContributions: allContributions,
    expenses: [],
    livestockEvents: [],
    fixedAssets: [],
    livestockStatuses: [],
  });

  assert.equal(updatedFinancials.totalPool, 2000, 'Master pool should increase from $1,400 to $2,000');
  assert.equal(updatedFinancials.leftMoney, 2000, 'Ground cash should increase to $2,000');

  // 2. Check Partner Equity Progress toward Master Target
  const updatedEquities = computeMemberEquities(
    [adminMember, partnerMember],
    allContributions,
    updatedFinancials.totalNav
  );

  const partnerEq = updatedEquities.find((e) => e.member.id === partnerMember.id);
  assert.ok(partnerEq);
  assert.equal(partnerEq.netContribution, 1000, 'Partner has now contributed $400 initial + $600 runway = $1,000');
  assert.equal(partnerEq.progressPercentage, 100);
  assert.equal(partnerEq.isGoalMet, true, 'Partner completed their master capital commitment via the runway pay-in');

  // 3. Check Runway Funding Layers
  const layers = computeFundingLayers(testPlan, allLines, [partnerPledge], allContributions, []);
  assert.equal(layers.pledged, 600);
  assert.equal(layers.collected, 500 + 600, 'Opening cash ($500) + Runway contribution ($600) = $1,100 collected');
});

test('Integrated Ledger: Runway Spend gates against Line Budget and deducts from Master Left Money', () => {
  const contributions: CapitalContributionEvent[] = [
    {
      id: 'TX-CAP-01',
      orgId: testOrg.id,
      memberId: adminMember.id,
      memberName: adminMember.fullName,
      direction: 'ADDITION',
      amount: 2000,
      note: 'Capital',
      createdAt: '2026-01-01T00:00:00Z',
      createdByMemberId: adminMember.id,
      auditHash: 'hash-cap-01',
    },
  ];

  let currentExpenses: ExpenseLedgerEvent[] = [];

  // Line budget for Starter Feed is 50 bags * $20 = $1,000
  const feedLineBudget = feedLine.qty * feedLine.unitCost;
  assert.equal(feedLineBudget, 1000);

  // Spend $400 for first 20 bags of feed
  const spendEval1 = evaluateSpend({
    plan: testPlan,
    lines: allLines,
    expenses: currentExpenses,
    allocation: { mode: 'LINE', lineId: feedLine.id },
    amount: 400,
    availableCash: 2000,
  });

  assert.equal(spendEval1.allowed, true);
  assert.equal(spendEval1.tags.runwayPlanId, testPlan.id);
  assert.equal(spendEval1.tags.runwayLineId, feedLine.id);

  // Record this expense in ledger
  const exp1: ExpenseLedgerEvent = {
    id: 'EXP-FEED-01',
    orgId: testOrg.id,
    locationId: 'LOC-MAIN',
    locationName: 'Main Farm',
    category: 'FEED',
    amount: 400,
    direction: 'DEDUCTION',
    approvalStatus: 'APPROVED',
    loggedByMemberId: 'mem-admin',
    loggedByName: 'Farai Admin',
    approvedByMemberIds: ['mem-admin'],
    note: 'Purchased 20 bags starter feed',
    runwayPlanId: testPlan.id,
    runwayLineId: feedLine.id,
    createdAt: '2026-02-02T00:00:00Z',
    auditHash: 'hash-exp-01',
  };
  currentExpenses.push(exp1);

  // Verify Master Financials: Ground cash must be reduced from $2,000 to $1,600
  const finAfterSpend1 = computeFinancialSummary({
    capitalContributions: contributions,
    expenses: currentExpenses,
    livestockEvents: [],
    fixedAssets: [],
    livestockStatuses: [],
  });

  assert.equal(finAfterSpend1.approvedExpenses, 400);
  assert.equal(finAfterSpend1.leftMoney, 1600, 'Master leftMoney must be reduced by $400');

  // Verify Runway Line Status: Remaining line budget is now $600 ($1,000 - $400)
  const lineStatuses = deriveLineStatuses(allLines, currentExpenses);
  const feedStatus = lineStatuses.get(feedLine.id);
  assert.ok(feedStatus);
  assert.equal(feedStatus.spent, 400);
  assert.equal(feedStatus.remaining, 600);
  assert.equal(feedStatus.status, 'PARTIAL');

  // Spend remaining $600 to fully complete the line
  const spendEval2 = evaluateSpend({
    plan: testPlan,
    lines: allLines,
    expenses: currentExpenses,
    allocation: { mode: 'LINE', lineId: feedLine.id },
    amount: 600,
    availableCash: 1600,
  });
  assert.equal(spendEval2.allowed, true);

  const exp2: ExpenseLedgerEvent = {
    id: 'EXP-FEED-02',
    orgId: testOrg.id,
    locationId: 'LOC-MAIN',
    locationName: 'Main Farm',
    category: 'FEED',
    amount: 600,
    direction: 'DEDUCTION',
    approvalStatus: 'APPROVED',
    loggedByMemberId: 'mem-admin',
    loggedByName: 'Farai Admin',
    approvedByMemberIds: ['mem-admin'],
    note: 'Purchased remaining 30 bags starter feed',
    runwayPlanId: testPlan.id,
    runwayLineId: feedLine.id,
    createdAt: '2026-02-10T00:00:00Z',
    auditHash: 'hash-exp-02',
  };
  currentExpenses.push(exp2);

  const lineStatusesFinal = deriveLineStatuses(allLines, currentExpenses);
  const feedStatusFinal = lineStatusesFinal.get(feedLine.id);
  assert.ok(feedStatusFinal);
  assert.equal(feedStatusFinal.spent, 1000);
  assert.equal(feedStatusFinal.remaining, 0);
  assert.equal(feedStatusFinal.status, 'PAID');

  const finFinal = computeFinancialSummary({
    capitalContributions: contributions,
    expenses: currentExpenses,
    livestockEvents: [],
    fixedAssets: [],
    livestockStatuses: [],
  });
  assert.equal(finFinal.leftMoney, 1000, 'Master leftMoney is now $1,000 ($2,000 - $1,000 spent on feed)');
});

test('Dual-Check Protection: Throws RUNWAY_INSUFFICIENT_GROUND_CASH if Treasury is short despite Line Budget', () => {
  // Line has $1,000 budget, but farm physically only has $150 liquid cash in the bank/wallet
  assert.throws(
    () => {
      evaluateSpend({
        plan: testPlan,
        lines: allLines,
        expenses: [],
        allocation: { mode: 'LINE', lineId: feedLine.id },
        amount: 500, // Budget allows $500, but available cash is only $150
        availableCash: 150,
      });
    },
    (err: any) => {
      assert.equal(err.code, 'RUNWAY_INSUFFICIENT_GROUND_CASH');
      assert.match(err.message, /Insufficient money on the ground/);
      return true;
    }
  );
});

test('Seeding from Treasury: Opening Cash Adoption reduces required Member Pledges', () => {
  // Plan total requirement:
  // Feed: $1,000 + Chicks: $2,550 = $3,550 + 10% contingency ($355) = $3,905
  // If the organization adopts $1,500 of existing ground cash from earlier profits/contributions:
  const adoptedPlan: RunwayPlan = {
    ...testPlan,
    openingCashAdopted: 1500,
  };

  const layers = computeFundingLayers(adoptedPlan, allLines, [], [], []);

  assert.equal(layers.totalRequirement, 3905);
  assert.equal(layers.openingCash, 1500);
  // Member Target = Total ($3,905) - Opening Cash ($1,500) = $2,405
  assert.equal(layers.memberTarget, 2405);
});

test('Cycle Recovery & Break-Even: Recoups Capital Spent and yields Farm Profit', () => {
  const executedSpend = 3000; // $3,000 spent on broiler cycle

  // 1. Before sales (chickens growing): 0 recovered
  const rec0 = computeRecovery(executedSpend, 0, 0);
  assert.equal(rec0.recoveredAmount, 0);
  assert.equal(rec0.recoveredPct, 0);
  assert.equal(rec0.shortfall, 3000);
  assert.equal(rec0.isBreakEven, false);

  // 2. Mid harvest: $1,800 sold
  const recMid = computeRecovery(executedSpend, 1800, 0);
  assert.equal(recMid.recoveredAmount, 1800);
  assert.equal(recMid.recoveredPct, 60);
  assert.equal(recMid.shortfall, 1200);
  assert.equal(recMid.isBreakEven, false);

  // 3. Harvest complete: $4,200 total sales ($3,500 cash + $700 credit sales collected)
  const recDone = computeRecovery(executedSpend, 3500, 700);
  assert.equal(recDone.recoveredAmount, 4200);
  assert.equal(recDone.recoveredPct, 140);
  assert.equal(recDone.isBreakEven, true);
  assert.equal(recDone.surplus, 1200, 'Surplus of $1,200 represents pure distributable profit');
  assert.equal(recDone.shortfall, 0);
});

test('Linked Placeholder Parity: Merged mock + post-join contributions and consolidated pledges keep pool and layers reconciled', () => {
  const linkedMember: OrgMember = {
    id: 'uid-linked-user',
    uid: 'uid-linked-user',
    orgId: testOrg.id,
    fullName: 'Nyasha Claimed',
    phoneOrEmail: 'nyasha@sunland.org',
    role: 'MEMBER',
    approvalStatus: 'APPROVED',
    isPlaceholder: false,
    accountStatus: 'ACTIVE',
    linkedMemberIds: ['mem-mock-nyasha'],
    joinedAt: '2026-02-05T00:00:00Z',
    targetContributionUsd: 2000,
    contributionPace: 'MONTHLY',
    active: true,
  };

  const claimedTombstone: OrgMember = {
    id: 'mem-mock-nyasha',
    orgId: testOrg.id,
    fullName: 'Nyasha Mock',
    phoneOrEmail: '',
    role: 'MEMBER',
    approvalStatus: 'APPROVED',
    isPlaceholder: true,
    accountStatus: 'CLAIMED',
    claimedByUid: 'uid-linked-user',
    claimedByMemberId: 'uid-linked-user',
    joinedAt: '2026-01-15T00:00:00Z',
    active: false,
  };

  const contributions: CapitalContributionEvent[] = [
    {
      id: 'CAP-PRE',
      orgId: testOrg.id,
      memberId: 'mem-mock-nyasha',
      memberName: 'Nyasha Mock',
      direction: 'INITIAL',
      amount: 1200,
      runwayPlanId: testPlan.id,
      pledgeId: 'PLG-CONSOLIDATED',
      note: 'Pre-registration contribution on Runway',
      createdAt: '2026-01-15T00:00:00Z',
      createdByMemberId: adminMember.id,
      auditHash: 'h-pre',
    },
    {
      id: 'CAP-AFTER',
      orgId: testOrg.id,
      memberId: 'uid-linked-user',
      memberName: 'Nyasha Claimed',
      direction: 'ADDITION',
      amount: 800,
      runwayPlanId: testPlan.id,
      pledgeId: 'PLG-CONSOLIDATED',
      note: 'Post-claim second installment',
      createdAt: '2026-02-10T00:00:00Z',
      createdByMemberId: 'uid-linked-user',
      auditHash: 'h-after',
    },
  ];

  const pledges: RunwayPledge[] = [
    {
      id: 'PLG-CONSOLIDATED',
      planId: testPlan.id,
      orgId: testOrg.id,
      memberId: 'uid-linked-user',
      memberName: 'Nyasha Claimed',
      amount: 2000,
      pledgedAmount: 2000,
      paidAmount: 2000,
      pace: 'MONTHLY',
      status: 'ACTIVE',
      history: [],
      createdAt: '2026-01-15T00:00:00Z',
      updatedAt: '2026-02-10T00:00:00Z',
    },
    {
      id: 'PLG-OLD-DUPLICATE',
      planId: testPlan.id,
      orgId: testOrg.id,
      memberId: 'uid-linked-user',
      memberName: 'Nyasha Mock',
      amount: 1200,
      pledgedAmount: 1200,
      paidAmount: 1200,
      pace: 'MONTHLY',
      status: 'MERGED',
      absorbedIntoPledgeId: 'PLG-CONSOLIDATED',
      history: [],
      createdAt: '2026-01-15T00:00:00Z',
      updatedAt: '2026-02-10T00:00:00Z',
    },
  ];

  const equities = computeMemberEquities([adminMember, claimedTombstone, linkedMember], contributions, 2000);
  assert.equal(equities.length, 2);
  const nyashaEq = equities.find((e) => e.member.id === 'uid-linked-user')!;
  assert.equal(nyashaEq.netContribution, 2000);
  assert.equal(nyashaEq.profitSharePercentage, 100);
  assert.equal(nyashaEq.isGoalMet, true);

  const layers = computeFundingLayers(testPlan, allLines, pledges, contributions, []);
  assert.equal(layers.pledged, 2000);
  // testPlan has openingCashAdopted = 500 + 2,000 contributed = 2,500 collected
  assert.equal(layers.collected, 2500);
});
