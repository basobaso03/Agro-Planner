import test from 'node:test';
import assert from 'node:assert/strict';
import { dataService } from '../src/services/dataService.ts';
import {
  computeMemberEquities,
  computeFinancialSummary,
  computeFixedAssetGroups,
} from '../src/utils/calculations.ts';
import type {
  CapitalContributionEvent,
  ExpenseLedgerEvent,
  FixedAssetLedgerEvent,
  OrgMember,
} from '../src/types/agro.ts';
import {
  TEST_ACCOUNTS,
  toOrgMember,
  loadRealTestImageBase64,
  loadProductionFixtures,
} from './helpers/testContext.ts';

test('WF-13: General Business Venture — Adaptive Workspace & Feature Toggles', () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.ventureAdmin);

  const org = dataService.createOrganization({
    name: 'Apex Commercial Logistics & Fleet',
    type: 'GENERAL_VENTURE',
    actor: adminActor,
    defaultTargetContributionUsd: 3000,
    contributionPaceDefault: 'MONTHLY',
  });

  assert.equal(org.type, 'GENERAL_VENTURE');
  assert.equal(org.features.livestockModule, false);
  assert.equal(org.features.feedInventoryModule, false);
  assert.equal(org.features.multiSigApprovals, true);
  assert.equal(org.features.publicAuditVerifier, true);
  assert.equal(org.defaultTargetContributionUsd, 3000);
});

test('WF-14: Member Target Capital Commitments, Progress Bars & Equity Math', () => {
  const memberActor = toOrgMember(TEST_ACCOUNTS.ventureMember);
  memberActor.targetContributionUsd = 3000;
  memberActor.contributionPace = 'MONTHLY';

  // 1. Case A: Contributed $2,000 out of $3,000 goal
  const contributionsCaseA: CapitalContributionEvent[] = [
    {
      id: 'TX-CAP-A1',
      memberId: memberActor.id,
      memberName: memberActor.fullName,
      direction: 'INITIAL',
      amount: 2000,
      note: 'Initial tranche deposit',
      createdAt: new Date().toISOString(),
      createdByMemberId: memberActor.id,
      auditHash: 'hash-a1',
    },
  ];

  const equitiesCaseA = computeMemberEquities([memberActor], contributionsCaseA, 2000);
  const summaryA = equitiesCaseA[0];

  assert.equal(summaryA.targetContributionUsd, 3000);
  assert.equal(summaryA.netContribution, 2000);
  assert.equal(summaryA.remainingToTargetUsd, 1000);
  assert.equal(summaryA.progressPercentage, 67); // Math.round((2000 / 3000) * 100) = 67%
  assert.equal(summaryA.isGoalMet, false);

  // 2. Case B: Contributed full $3,000 goal
  const contributionsCaseB: CapitalContributionEvent[] = [
    ...contributionsCaseA,
    {
      id: 'TX-CAP-A2',
      memberId: memberActor.id,
      memberName: memberActor.fullName,
      direction: 'ADDITION',
      amount: 1000,
      note: 'Final tranche to reach goal',
      createdAt: new Date().toISOString(),
      createdByMemberId: memberActor.id,
      auditHash: 'hash-a2',
    },
  ];

  const equitiesCaseB = computeMemberEquities([memberActor], contributionsCaseB, 3000);
  const summaryB = equitiesCaseB[0];

  assert.equal(summaryB.netContribution, 3000);
  assert.equal(summaryB.remainingToTargetUsd, 0);
  assert.equal(summaryB.progressPercentage, 100);
  assert.equal(summaryB.isGoalMet, true);

  // 3. Case C: Contributed $3,500 (exceeded goal)
  const contributionsCaseC: CapitalContributionEvent[] = [
    ...contributionsCaseB,
    {
      id: 'TX-CAP-A3',
      memberId: memberActor.id,
      memberName: memberActor.fullName,
      direction: 'ADDITION',
      amount: 500,
      note: 'Bonus seed deposit',
      createdAt: new Date().toISOString(),
      createdByMemberId: memberActor.id,
      auditHash: 'hash-a3',
    },
  ];

  const equitiesCaseC = computeMemberEquities([memberActor], contributionsCaseC, 3500);
  const summaryC = equitiesCaseC[0];

  assert.equal(summaryC.netContribution, 3500);
  assert.equal(summaryC.remainingToTargetUsd, 0); // Must be clamped at 0
  assert.equal(summaryC.progressPercentage, 100); // Must be capped at 100%
  assert.equal(summaryC.isGoalMet, true);
});

test('WF-15: Capital Pool Ledger — Treasurer deposits & contra reversals', () => {
  const treasurerActor = toOrgMember(TEST_ACCOUNTS.ventureTreasurer);
  const memberActor = toOrgMember(TEST_ACCOUNTS.ventureMember);

  // Ensure member is in state
  const curState = dataService.getState();
  if (!curState.members.some((m) => m.id === memberActor.id)) {
    (dataService as any).saveLocalState({
      ...curState,
      members: [...curState.members, memberActor, treasurerActor],
    });
  }

  // 1. Initial Deposit by Treasurer
  const depositEvent = dataService.logCapitalContribution({
    memberId: memberActor.id,
    direction: 'ADDITION',
    amount: 3000,
    note: 'Bank wire deposit for fleet acquisition pool',
    actor: treasurerActor,
  });

  assert.ok(depositEvent.id);
  assert.equal(depositEvent.amount, 3000);
  assert.ok(depositEvent.auditHash.length >= 32);

  // Negative: Regular Member attempting to log capital contribution directly -> MUST BE REJECTED
  assert.throws(
    () => {
      dataService.logCapitalContribution({
        memberId: memberActor.id,
        direction: 'ADDITION',
        amount: 1000,
        note: 'Unauthorized self deposit',
        actor: memberActor,
      });
    },
    /Access Denied: Only Treasurers and Organization Admins can record capital contributions/
  );

  // 2. Contra Reversal (Correction of $200 overbilling)
  const contraEvent = dataService.logCapitalContribution({
    memberId: memberActor.id,
    direction: 'CONTRA_REVERSAL',
    amount: -200,
    referenceTransactionId: depositEvent.id,
    note: 'Reversing erroneous wire over-credit of $200',
    actor: treasurerActor,
  });

  assert.ok(contraEvent.id);
  assert.equal(contraEvent.amount, -200);
  assert.equal(contraEvent.referenceTransactionId, depositEvent.id);
});

test('WF-17: Maker-Checker Multi-Sig Expense Workflow — Deductions & Approvals', () => {
  const memberActor = toOrgMember(TEST_ACCOUNTS.ventureMember);
  const treasurerActor = toOrgMember(TEST_ACCOUNTS.ventureTreasurer);
  const adminActor = toOrgMember(TEST_ACCOUNTS.ventureAdmin);

  // Ensure location exists in state
  const loc = dataService.getState().locations[0] || dataService.addLocation({
    name: 'Fleet Logistics Depot',
    region: 'Harare Commercial Area',
    gpsCoordinates: '-17.82, 31.05',
    primaryOperatorName: 'Fleet Manager',
    actor: adminActor,
  });

  // 1. Minor expense <= $150 ($85 replacement wiper blades & wash) -> Auto-cleared as APPROVED
  const minorExpense = dataService.logExpense({
    locationId: loc.id,
    category: 'MAINTENANCE',
    direction: 'DEDUCTION',
    amount: 85,
    note: 'Fleet vehicle windshield wiper replacement and exterior wash',
    actor: memberActor,
  });
  assert.ok(minorExpense.id);
  assert.equal(minorExpense.approvalStatus, 'APPROVED');

  // 2. Major expense > $150 ($640 commercial vehicle diesel service) -> Requires multi-sig PENDING_MULTISIG
  const invoicePhoto = loadRealTestImageBase64('feed-delivery-invoice.jpg');
  const expense = dataService.logExpense({
    locationId: loc.id,
    category: 'MAINTENANCE',
    direction: 'DEDUCTION',
    amount: 640,
    note: 'Comprehensive 20,000km diesel service & brake pad replacement',
    receiptPhotoDataUrl: invoicePhoto,
    actor: memberActor,
  });

  assert.ok(expense.id);
  assert.equal(expense.approvalStatus, 'PENDING_MULTISIG');
  assert.ok(expense.approvedByMemberIds.includes(memberActor.id));

  // 3. Negative: Non-treasurer (regular member) attempting to approve multi-sig expense -> MUST BE REJECTED
  assert.throws(
    () => {
      dataService.approveMultiSigExpense(expense.id, memberActor);
    },
    /Access Denied: Only Treasurers and Organization Admins can approve multi-sig expenses/
  );

  // 4. Financial Summary: Pending expenses must NOT deduct from Left Money prematurely
  const curFinancialsPending = computeFinancialSummary({
    capitalContributions: dataService.getState().capitalContributions,
    expenses: dataService.getState().expenses,
    fixedAssets: dataService.getState().fixedAssets,
    livestockStatuses: [],
    livestockEvents: [],
  });
  assert.ok(curFinancialsPending.pendingMultiSigExpenses >= 640);

  // 3. Treasurer approves expense
  dataService.approveMultiSigExpense(expense.id, treasurerActor);

  const updatedExpense = dataService.getState().expenses.find((e) => e.id === expense.id)!;
  assert.equal(updatedExpense.approvalStatus, 'APPROVED');
  assert.ok(updatedExpense.approvedByMemberIds.includes(treasurerActor.id));

  // 4. Financial Summary: Now approved expense deducts from Left Money
  const curFinancialsApproved = computeFinancialSummary({
    capitalContributions: dataService.getState().capitalContributions,
    expenses: dataService.getState().expenses,
    fixedAssets: dataService.getState().fixedAssets,
    livestockStatuses: [],
    livestockEvents: [],
  });
  assert.ok(curFinancialsApproved.approvedExpenses >= 640);

  // 5. Contra-reversal expense ($120 over-invoiced refund)
  const contraExpense = dataService.logExpense({
    locationId: loc.id,
    category: 'MAINTENANCE',
    direction: 'CONTRA_REVERSAL',
    amount: -120,
    referenceTransactionId: expense.id,
    note: 'Supplier discount refund on replacement brake discs',
    actor: treasurerActor,
  });

  assert.equal(contraExpense.approvalStatus, 'APPROVED');
  assert.equal(contraExpense.amount, -120);
});

test('WF-18: Commercial Fixed Assets Ledger — Fleet Vehicle Acquisition & Photo Proof', () => {
  const adminActor = toOrgMember(TEST_ACCOUNTS.ventureAdmin);
  const loc = dataService.getState().locations[0] || dataService.addLocation({
    name: 'Fleet Logistics Depot',
    region: 'Harare Commercial Area',
    gpsCoordinates: '-17.82, 31.05',
    primaryOperatorName: 'Fleet Manager',
    actor: adminActor,
  });
  const truckPhoto = loadRealTestImageBase64('isuzu-npr-truck.jpg');

  // Log acquisition of Isuzu Commercial Truck ($18,500)
  const assetEvent = dataService.logFixedAssetEvent({
    assetName: '2022 Isuzu NPR 4-Ton Commercial Cargo Truck',
    category: 'TOOLS_MACHINERY',
    locationId: loc.id,
    direction: 'INITIAL',
    quantityDelta: 1,
    valueDelta: 18500,
    condition: 'EXCELLENT',
    note: 'Purchased certified low-mileage commercial delivery truck with drop-side bed.',
    photoUrl: truckPhoto,
    actor: adminActor,
  });

  assert.ok(assetEvent.id);
  assert.equal(assetEvent.valueDelta, 18500);
  assert.equal(assetEvent.condition, 'EXCELLENT');
  assert.ok(assetEvent.photoUrl?.startsWith('data:image/jpeg;base64,'));

  // Aggregation test
  const summaries = computeFixedAssetGroups(
    dataService.getState().fixedAssets,
    dataService.getState().locations
  );
  const truckSummary = summaries.find((s) => s.assetGroupId === assetEvent.assetGroupId)!;
  assert.ok(truckSummary);
  assert.equal(truckSummary.currentQuantity, 1);
  assert.equal(truckSummary.currentValue, 18500);
  assert.equal(truckSummary.latestCondition, 'EXCELLENT');
});

test('WF-19: Mathematical Identity: Left Money & Net Asset Value (NAV) Reconciliation', () => {
  const memberA: OrgMember = {
    ...toOrgMember(TEST_ACCOUNTS.ventureAdmin),
    id: 'mem-vnt-a',
    fullName: 'Partner A',
  };
  const memberB: OrgMember = {
    ...toOrgMember(TEST_ACCOUNTS.ventureTreasurer),
    id: 'mem-vnt-b',
    fullName: 'Partner B',
  };

  const poolDeposits: CapitalContributionEvent[] = [
    {
      id: 'TX-P-1',
      memberId: 'mem-vnt-a',
      memberName: 'Partner A',
      direction: 'INITIAL',
      amount: 10000,
      note: 'Initial pool fund',
      createdAt: new Date().toISOString(),
      createdByMemberId: 'mem-vnt-a',
      auditHash: 'h1',
    },
    {
      id: 'TX-P-2',
      memberId: 'mem-vnt-b',
      memberName: 'Partner B',
      direction: 'INITIAL',
      amount: 10000,
      note: 'Initial pool fund',
      createdAt: new Date().toISOString(),
      createdByMemberId: 'mem-vnt-b',
      auditHash: 'h2',
    },
  ];

  const approvedExpenses: ExpenseLedgerEvent[] = [
    {
      id: 'TX-E-1',
      locationId: 'loc-test',
      locationName: 'Test Depot',
      category: 'TRANSPORT_LOGISTICS',
      direction: 'DEDUCTION',
      amount: 3500,
      note: 'Fleet insurance',
      loggedByMemberId: 'mem-vnt-a',
      loggedByName: 'Partner A',
      approvalStatus: 'APPROVED',
      approvedByMemberIds: ['mem-vnt-b'],
      createdAt: new Date().toISOString(),
      auditHash: 'he1',
    },
  ];

  const fixedAssets: FixedAssetLedgerEvent[] = [
    {
      id: 'TX-FA-1',
      assetGroupId: 'grp-1',
      assetName: 'Trailer',
      category: 'TOOLS_MACHINERY',
      locationId: 'loc-test',
      direction: 'INITIAL',
      quantityDelta: 1,
      valueDelta: 7500,
      condition: 'EXCELLENT',
      note: 'Cargo trailer',
      loggedByName: 'Partner A',
      createdAt: new Date().toISOString(),
      auditHash: 'hfa1',
    },
  ];

  const financial = computeFinancialSummary({
    capitalContributions: poolDeposits,
    expenses: approvedExpenses,
    fixedAssets,
    livestockStatuses: [],
    livestockEvents: [],
  });

  // Total Pool = 10,000 + 10,000 = 20,000
  assert.equal(financial.totalPool, 20000);
  assert.equal(financial.approvedExpenses, 3500);

  // Left Money = Total Pool - Approved Expenses = 20,000 - 3,500 = 16,500
  assert.equal(financial.leftMoney, 16500);

  // Total NAV = Left Money ($16,500) + Fixed Assets ($7,500) = $24,000
  assert.equal(financial.totalFixedAssetsValue, 7500);
  assert.equal(financial.totalNav, 24000);

  // Equity Shares
  const equities = computeMemberEquities([memberA, memberB], poolDeposits, financial.totalNav);
  assert.equal(equities[0].profitSharePercentage, 50);
  assert.equal(equities[1].profitSharePercentage, 50);
  assert.equal(equities[0].impliedNavEquityUsd, 12000);
  assert.equal(equities[1].impliedNavEquityUsd, 12000);
});

test('WF-20-BOUNDS: Financial & Operational Input Validation Bounds', () => {
  const treasurerActor = toOrgMember(TEST_ACCOUNTS.ventureTreasurer);
  const memberActor = toOrgMember(TEST_ACCOUNTS.ventureMember);
  const loc = dataService.getState().locations[0];

  // 1. Note < 4 characters in capital deposit -> MUST BE REJECTED
  assert.throws(
    () => {
      dataService.logCapitalContribution({
        memberId: memberActor.id,
        direction: 'ADDITION',
        amount: 500,
        note: 'bad', // < 4 chars
        actor: treasurerActor,
      });
    },
    /A mandatory explanation note \(at least 4 characters\) is required/
  );

  // 2. Note < 4 characters in expense -> MUST BE REJECTED
  assert.throws(
    () => {
      dataService.logExpense({
        locationId: loc.id,
        category: 'MAINTENANCE',
        direction: 'DEDUCTION',
        amount: 50,
        note: 'no', // < 4 chars
        actor: memberActor,
      });
    },
    /Mandatory detailed note is required explaining what the money was used for/
  );

  // 3. Invalid / Missing farm location -> MUST BE REJECTED
  assert.throws(
    () => {
      dataService.logExpense({
        locationId: 'non-existent-location-id-999',
        category: 'FEED',
        direction: 'DEDUCTION',
        amount: 100,
        note: 'Valid explanation note for expense',
        actor: memberActor,
      });
    },
    /Farm location is required/
  );
});

test.after(() => {
  setTimeout(() => process.exit(0), 100);
});
