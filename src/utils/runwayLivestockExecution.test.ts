import test from 'node:test';
import assert from 'node:assert/strict';
import { dataService } from '../services/dataService.ts';
import { computeLivestockStatus } from './calculations.ts';
import { deriveLineStatuses } from './runway.ts';
import type {
  OrgMember,
  LivestockEntry,
  FarmLocation,
} from '../types/agro.ts';
import type {
  RunwayPlan,
  RunwayLine,
} from '../types/runway.ts';

const testOrgId = 'org-livestock-rwy-test';

const adminMember: OrgMember = {
  id: 'mem-rwy-admin',
  uid: 'uid-rwy-admin',
  orgId: testOrgId,
  fullName: 'Farai Admin',
  phoneOrEmail: 'admin@sunland.test',
  role: 'ORG_ADMIN',
  approvalStatus: 'APPROVED',
  active: true,
  joinedAt: '2026-01-01T00:00:00Z',
};

const testLocation: FarmLocation = {
  id: 'loc-rwy-test-1',
  orgId: testOrgId,
  name: 'Sunland Paddock A',
  region: 'Norton',
  primaryOperatorName: adminMember.fullName,
  createdBy: adminMember.id,
  gpsCoordinates: '-17.8252,31.0335',
  createdAt: '2026-01-01T00:00:00Z',
};

const testPlan: RunwayPlan = {
  id: 'RWY-LSTK-PLAN-01',
  orgId: testOrgId,
  name: 'Broiler Batch 01 Capital Plan',
  orgType: 'AGRO_FARMING',
  mode: 'SIMPLE',
  status: 'ACTIVE',
  enforcement: 'STRICT',
  startDate: '2026-02-01T00:00:00Z',
  contingencyMode: 'PERCENT',
  contingencyPercent: 10,
  targetBasis: 'GROSS',
  activationThresholdPct: 100,
  openingCashAdopted: 0,
  plannedFinancing: [],
  phases: [],
  showMemberPledges: true,
  collectionMode: 'ANYTIME',
  milestonesReached: {},
  version: 1,
  createdByMemberId: adminMember.id,
  createdByName: adminMember.fullName,
  createdAt: '2026-02-01T00:00:00Z',
  updatedAt: '2026-02-01T00:00:00Z',
  auditHash: 'hash-rwy-test',
};

const livestockLine: RunwayLine = {
  id: 'RWL-CHICKS-01',
  planId: testPlan.id,
  orgId: testOrgId,
  kind: 'COST',
  title: 'Day-old chicks (Cobb 500)',
  category: 'LIVESTOCK',
  qty: 200,
  unitCost: 1.5,
  unitLabel: 'chick',
  priority: 'ESSENTIAL',
  origin: 'PLAN',
  approval: 'APPROVED',
  sortOrder: 1,
  createdAt: '2026-02-01T00:00:00Z',
  updatedAt: '2026-02-01T00:00:00Z',
  auditHash: 'hash-line-test',
};

const assetLine: RunwayLine = {
  id: 'RWL-FEEDER-01',
  planId: testPlan.id,
  orgId: testOrgId,
  kind: 'COST',
  title: 'Automatic Feeders & Drinkers',
  category: 'EQUIPMENT',
  qty: 10,
  unitCost: 25,
  unitLabel: 'units',
  priority: 'IMPORTANT',
  origin: 'PLAN',
  approval: 'APPROVED',
  sortOrder: 2,
  createdAt: '2026-02-01T00:00:00Z',
  updatedAt: '2026-02-01T00:00:00Z',
  auditHash: 'hash-asset-line-test',
};

function resetLedgerState(initialLeftMoney = 5000) {
  dataService.saveLocalState({
    organizations: [
      {
        id: testOrgId,
        name: 'Sunland Test',
        type: 'AGRO_FARMING',
        adminMemberId: adminMember.id,
        adminEmail: 'admin@sunland.test',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        currentInviteCode: 'CODE-1234',
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
      },
    ],
    members: [adminMember],
    locations: [testLocation],
    capitalContributions: [
      {
        id: `CAP-${Date.now()}`,
        orgId: testOrgId,
        memberId: adminMember.id,
        memberName: adminMember.fullName,
        amount: initialLeftMoney,
        direction: 'INITIAL',
        note: 'Initial pool capital',
        createdByMemberId: adminMember.id,
        createdAt: '2026-01-01T00:00:00Z',
        auditHash: 'hash-cap-init',
      },
    ],
    expenses: [],
    fixedAssets: [],
    livestockEntries: [],
    livestockEvents: [],
    feedLedger: [],
    debtLiabilities: [],
    loansGiven: [],
    creditSales: [],
    auditNotifications: [],
    runwayPlans: [testPlan],
    runwayLines: [livestockLine, assetLine],
    runwayPledges: [],
    runwayClaims: [],
  });
}

test('Runway Execution: Purchase animals registers them into Livestock inventory and creates linked expense', () => {
  resetLedgerState(5000);

  const initialMoney = dataService.getCurrentOrgLeftMoney(testOrgId);
  assert.equal(initialMoney, 5000);

  // 1. Purchase 200 chicks for $300 against planned line RWL-CHICKS-01
  const purchasedBatch = dataService.registerLivestock({
    locationId: testLocation.id,
    species: 'Broilers',
    nameOrTag: 'Broiler Batch #01',
    trackingMode: 'BATCH',
    entryDate: '2026-02-05T00:00:00Z',
    initialAgeValue: 1,
    initialAgeUnit: 'DAYS',
    targetDurationValue: 6,
    targetDurationUnit: 'WEEKS',
    initialHeadcount: 200,
    purchaseCostTotal: 300,
    autoDeductPurchaseFromLeftMoney: true,
    fundingSource: 'CASH_POOL',
    targetSaleWeightKg: 2.2,
    notes: 'Purchase of Day-old chicks (Cobb 500) [Qty: 200 chick]',
    actor: adminMember,
    runwayAllocation: { mode: 'LINE', lineId: livestockLine.id },
    runwayPlanId: testPlan.id,
  });

  // Verify LivestockEntry properties
  assert.ok(purchasedBatch.id.startsWith('LSTK-'));
  assert.equal(purchasedBatch.species, 'Broilers');
  assert.equal(purchasedBatch.initialHeadcount, 200);
  assert.equal(purchasedBatch.purchaseCostTotal, 300);
  assert.equal(purchasedBatch.runwayPlanId, testPlan.id);
  assert.equal(purchasedBatch.runwayLineId, livestockLine.id);
  assert.ok(purchasedBatch.acquisitionExpenseId?.startsWith('TX-EXP-'));

  // Verify LeftMoney deducted
  const moneyAfter = dataService.getCurrentOrgLeftMoney(testOrgId);
  assert.equal(moneyAfter, 4700);

  // Verify ExpenseLedgerEvent
  const state = dataService.getState();
  const expense = state.expenses.find((e) => e.runwayLineId === livestockLine.id);
  assert.ok(expense);
  assert.equal(expense.category, 'LIVESTOCK_PURCHASE');
  assert.equal(expense.amount, 300);
  assert.equal(expense.batchOrAnimalId, purchasedBatch.id);
  assert.equal(expense.runwayPlanId, testPlan.id);

  // Verify line status transitions to PAID
  const lineStatuses = deriveLineStatuses([livestockLine], state.expenses);
  const statusInfo = lineStatuses.get(livestockLine.id);
  assert.equal(statusInfo?.status, 'PAID');
  assert.equal(statusInfo?.spent, 300);
  assert.equal(statusInfo?.remaining, 0);

  // Verify Livestock status calculation
  const livestockStatus = computeLivestockStatus(
    purchasedBatch,
    state.livestockEvents,
    state.feedLedger
  );
  assert.equal(livestockStatus.currentLiveHeadcount, 200);
  assert.ok(livestockStatus.estimatedCurrentValueUsd > 0);
});

test('Runway Execution: Reverse purchase logic reverses the purchase of livestock and restores funds', () => {
  resetLedgerState(5000);

  // Step 1: Purchase the chicks
  const purchasedBatch = dataService.registerLivestock({
    locationId: testLocation.id,
    species: 'Broilers',
    nameOrTag: 'Broiler Batch #01',
    trackingMode: 'BATCH',
    entryDate: '2026-02-05T00:00:00Z',
    initialAgeValue: 1,
    initialAgeUnit: 'DAYS',
    targetDurationValue: 6,
    targetDurationUnit: 'WEEKS',
    initialHeadcount: 200,
    purchaseCostTotal: 300,
    autoDeductPurchaseFromLeftMoney: true,
    fundingSource: 'CASH_POOL',
    notes: 'Purchase of Day-old chicks (Cobb 500) [Qty: 200 chick]',
    actor: adminMember,
    runwayAllocation: { mode: 'LINE', lineId: livestockLine.id },
    runwayPlanId: testPlan.id,
  });

  const stateAfterBuy = dataService.getState();
  const originalExpense = stateAfterBuy.expenses.find((e) => e.batchOrAnimalId === purchasedBatch.id)!;
  assert.ok(originalExpense);

  // Step 2: Execute Reverse Purchase (simulating SpendPanel.tsx handleReversePurchase)
  // 2a. Log contra-reversal for expense
  dataService.logExpense({
    locationId: originalExpense.locationId,
    category: originalExpense.category,
    direction: 'CONTRA_REVERSAL',
    amount: -Math.abs(originalExpense.amount),
    referenceTransactionId: originalExpense.id,
    note: `Contra-reversal of purchase: ${originalExpense.note}`,
    actor: adminMember,
    runwayAllocation: { mode: 'LINE', lineId: livestockLine.id },
    runwayPlanId: testPlan.id,
  });

  // 2b. Reverse livestock purchase: log HEADCOUNT_CONTRA_ADJUSTMENT
  const reverseEvent = dataService.logLivestockLifecycleEvent({
    livestockId: purchasedBatch.id,
    eventType: 'HEADCOUNT_CONTRA_ADJUSTMENT',
    headcountDelta: -200,
    referenceTransactionId: originalExpense.id,
    note: `Contra-reversal of livestock purchase against Runway line: ${livestockLine.title}`,
    actor: adminMember,
  });

  assert.equal(reverseEvent.headcountDelta, -200);

  // Step 3: Verify funds and line spend restored
  const stateAfterReverse = dataService.getState();
  const moneyRestored = dataService.getCurrentOrgLeftMoney(testOrgId);
  assert.equal(moneyRestored, 5000, 'Left Money fully restored to $5,000');

  // Verify Runway line status restored
  const lineStatuses = deriveLineStatuses([livestockLine], stateAfterReverse.expenses);
  const statusInfo = lineStatuses.get(livestockLine.id);
  assert.equal(statusInfo?.status, 'PLANNED', 'Line status resets to PLANNED');
  assert.equal(statusInfo?.spent, 0, 'Line spent resets to 0');
  assert.equal(statusInfo?.remaining, 300, 'Remaining budget restored to full $300');

  // Step 4: Verify Livestock headcount and valuation reversed to 0
  const updatedStatus = computeLivestockStatus(
    purchasedBatch,
    stateAfterReverse.livestockEvents,
    stateAfterReverse.feedLedger
  );
  assert.equal(updatedStatus.currentLiveHeadcount, 0, 'Live headcount zeroed out by contra-adjustment');
  assert.equal(updatedStatus.estimatedCurrentValueUsd, 0, 'Valuation zeroed out');
  assert.equal(updatedStatus.totalExpectedRevenueUsd, 0, 'Expected revenue zeroed out');
});

test('Runway Execution: Fixed Asset purchase and reverse purchase logic operates symmetrically', () => {
  resetLedgerState(5000);

  // Step 1: Purchase 10 Feeders & Drinkers for $250
  const assetEvent = dataService.logFixedAssetEvent({
    assetName: assetLine.title,
    category: 'FEEDERS_EQUIPMENT',
    locationId: testLocation.id,
    direction: 'INITIAL',
    quantityDelta: 10,
    valueDelta: 250,
    condition: 'EXCELLENT',
    note: 'Purchase of Automatic Feeders & Drinkers [Qty: 10 units]',
    deductFromLeftMoney: true,
    actor: adminMember,
    runwayAllocation: { mode: 'LINE', lineId: assetLine.id },
    runwayPlanId: testPlan.id,
  });

  assert.equal(assetEvent.quantityDelta, 10);
  assert.equal(assetEvent.valueDelta, 250);

  const stateAfterBuy = dataService.getState();
  const expEvent = stateAfterBuy.expenses.find((e) => e.runwayLineId === assetLine.id)!;
  assert.ok(expEvent);
  assert.equal(expEvent.amount, 250);
  assert.equal(expEvent.category, 'FIXED_ASSET_PURCHASE');
  assert.equal(expEvent.batchOrAnimalId, assetEvent.id, 'Expense correctly tagged with asset ID');

  assert.equal(dataService.getCurrentOrgLeftMoney(testOrgId), 4750);

  // Step 2: Reverse Fixed Asset Purchase (SpendPanel logic)
  // 2a. Contra-reversal on expense
  dataService.logExpense({
    locationId: expEvent.locationId,
    category: expEvent.category,
    direction: 'CONTRA_REVERSAL',
    amount: -Math.abs(expEvent.amount),
    referenceTransactionId: expEvent.id,
    note: `Contra-reversal of purchase: ${expEvent.note}`,
    actor: adminMember,
    runwayAllocation: { mode: 'LINE', lineId: assetLine.id },
    runwayPlanId: testPlan.id,
  });

  // 2b. Contra-reversal on matching asset
  const matchingAsset = stateAfterBuy.fixedAssets.find(
    (a) => a.id === expEvent.batchOrAnimalId || a.referenceTransactionId === expEvent.id
  )!;
  assert.ok(matchingAsset);

  const contraAsset = dataService.logFixedAssetEvent({
    assetName: matchingAsset.assetName,
    category: matchingAsset.category,
    locationId: matchingAsset.locationId,
    direction: 'CONTRA_REVERSAL',
    quantityDelta: -Math.abs(matchingAsset.quantityDelta),
    valueDelta: -Math.abs(matchingAsset.valueDelta),
    condition: matchingAsset.condition,
    referenceTransactionId: matchingAsset.id,
    note: `Contra-reversal of asset purchase: ${assetLine.title}`,
    deductFromLeftMoney: false,
    actor: adminMember,
    runwayPlanId: testPlan.id,
    runwayAllocation: { mode: 'LINE', lineId: assetLine.id },
  });

  assert.equal(contraAsset.quantityDelta, -10);
  assert.equal(contraAsset.valueDelta, -250);

  // Step 3: Verify funds and line budget restored
  assert.equal(dataService.getCurrentOrgLeftMoney(testOrgId), 5000);
  const stateAfterRev = dataService.getState();
  const lineStatuses = deriveLineStatuses([assetLine], stateAfterRev.expenses);
  const statusInfo = lineStatuses.get(assetLine.id);
  assert.equal(statusInfo?.status, 'PLANNED');
  assert.equal(statusInfo?.spent, 0);
  assert.equal(statusInfo?.remaining, 250);

  // Step 4: Verify net asset quantity and value
  const allAssetEvents = stateAfterRev.fixedAssets.filter((a) => a.assetName === assetLine.title);
  const netQty = allAssetEvents.reduce((acc, a) => acc + a.quantityDelta, 0);
  const netVal = allAssetEvents.reduce((acc, a) => acc + a.valueDelta, 0);
  assert.equal(netQty, 0, 'Net equipment quantity is 0');
  assert.equal(netVal, 0, 'Net equipment valuation is 0');
});

test('Runway Execution: Add headcount to existing batch and reverse accurately', () => {
  resetLedgerState(5000);

  // Step 1: An existing batch already has 100 birds
  const existingBatch = dataService.registerLivestock({
    locationId: testLocation.id,
    species: 'Broilers',
    nameOrTag: 'Base Broiler Flock',
    trackingMode: 'BATCH',
    entryDate: '2026-01-15T00:00:00Z',
    targetDurationValue: 6,
    targetDurationUnit: 'WEEKS',
    initialHeadcount: 100,
    purchaseCostTotal: 150,
    autoDeductPurchaseFromLeftMoney: false,
    notes: 'Existing baseline flock',
    actor: adminMember,
  });

  // Step 2: Buy 200 chicks from Runway and add them into the existing batch
  dataService.logLivestockLifecycleEvent({
    livestockId: existingBatch.id,
    eventType: 'INITIAL_STOCK',
    headcountDelta: 200,
    note: 'Purchase of Day-old chicks (Cobb 500) [Qty: 200 chick]',
    actor: adminMember,
  });

  const exp = dataService.spendAgainstRunwayPlan({
    planId: testPlan.id,
    allocation: { mode: 'LINE', lineId: livestockLine.id },
    amount: 300,
    locationId: testLocation.id,
    category: 'LIVESTOCK_PURCHASE',
    batchOrAnimalId: existingBatch.id,
    note: 'Purchase of Day-old chicks (Cobb 500) [Qty: 200 chick]',
    actor: adminMember,
  });

  const stateAfterAdd = dataService.getState();
  const statusAfterAdd = computeLivestockStatus(
    existingBatch,
    stateAfterAdd.livestockEvents,
    stateAfterAdd.feedLedger
  );
  assert.equal(statusAfterAdd.currentLiveHeadcount, 300, 'Batch headcount expanded to 300 (100 + 200)');

  // Step 3: Reverse the runway purchase
  dataService.logExpense({
    locationId: exp.locationId,
    category: exp.category,
    direction: 'CONTRA_REVERSAL',
    amount: -Math.abs(exp.amount),
    referenceTransactionId: exp.id,
    note: `Contra-reversal of purchase: ${exp.note}`,
    actor: adminMember,
    runwayAllocation: { mode: 'LINE', lineId: livestockLine.id },
    runwayPlanId: testPlan.id,
  });

  dataService.logLivestockLifecycleEvent({
    livestockId: existingBatch.id,
    eventType: 'HEADCOUNT_CONTRA_ADJUSTMENT',
    headcountDelta: -200,
    referenceTransactionId: exp.id,
    note: `Contra-reversal of livestock purchase against Runway line: ${livestockLine.title}`,
    actor: adminMember,
  });

  const stateAfterReverse = dataService.getState();
  const statusAfterReverse = computeLivestockStatus(
    existingBatch,
    stateAfterReverse.livestockEvents,
    stateAfterReverse.feedLedger
  );
  assert.equal(statusAfterReverse.currentLiveHeadcount, 100, 'Batch headcount restored to original 100');
  assert.equal(dataService.getCurrentOrgLeftMoney(testOrgId), 5000, 'Funds returned to ground pool');
});

test('Runway Execution: Strict isolation of General Venture (GENERAL_VENTURE) from livestock logic', () => {
  resetLedgerState(5000);

  // Set up a General Venture plan (e.g., Grocery & Meat Retail)
  const generalVenturePlan: RunwayPlan = {
    ...testPlan,
    id: 'RWY-GV-RETAIL-01',
    name: 'Retail Butchery & Store Plan',
    orgType: 'GENERAL_VENTURE',
  };

  const meatInventoryLine: RunwayLine = {
    ...livestockLine,
    id: 'RWL-GV-CHICKEN-01',
    planId: generalVenturePlan.id,
    title: 'Whole Frozen Chickens for Resale',
    category: 'INVENTORY',
    qty: 150,
    unitCost: 4.0,
    unitLabel: 'birds',
  };

  dataService.saveLocalState({
    ...dataService.getState(),
    runwayPlans: [...(dataService.getState().runwayPlans || []), generalVenturePlan],
    runwayLines: [...(dataService.getState().runwayLines || []), meatInventoryLine],
  });

  // Guard 1: Direct attempt to register livestock under a GENERAL_VENTURE plan must be rejected
  assert.throws(
    () => {
      dataService.registerLivestock({
        locationId: testLocation.id,
        species: 'Broilers',
        nameOrTag: 'Forbidden General Venture Batch',
        targetDurationValue: 6,
        targetDurationUnit: 'WEEKS',
        initialHeadcount: 150,
        purchaseCostTotal: 600,
        notes: 'Should fail',
        actor: adminMember,
        runwayPlanId: generalVenturePlan.id,
      });
    },
    /Livestock registration is restricted to Agricultural Farming enterprises/i,
    'Throws error when attempting to register livestock under a GENERAL_VENTURE plan'
  );

  // Guard 2: Purchasing against the GENERAL_VENTURE line records normal business expense, leaving livestock ledger untouched
  const exp = dataService.spendAgainstRunwayPlan({
    planId: generalVenturePlan.id,
    allocation: { mode: 'LINE', lineId: meatInventoryLine.id },
    amount: 600,
    locationId: testLocation.id,
    category: 'OTHER',
    note: 'Purchase of Whole Frozen Chickens for Resale [Qty: 150 birds]',
    actor: adminMember,
  });

  const stateAfterSpend = dataService.getState();
  assert.equal(stateAfterSpend.livestockEntries.length, 0, 'No livestock entries created for GENERAL_VENTURE');
  assert.equal(stateAfterSpend.livestockEvents.length, 0, 'No livestock events created for GENERAL_VENTURE');
  assert.equal(dataService.getCurrentOrgLeftMoney(testOrgId), 4400, 'Left money deducted properly: 5000 - 600 = 4400');

  // Guard 3: Contra-reversal on general venture restores funds safely without invoking livestock logic
  dataService.logExpense({
    locationId: exp.locationId,
    category: exp.category,
    direction: 'CONTRA_REVERSAL',
    amount: -Math.abs(exp.amount),
    referenceTransactionId: exp.id,
    note: `Contra-reversal of purchase: ${exp.note}`,
    actor: adminMember,
    runwayAllocation: { mode: 'LINE', lineId: meatInventoryLine.id },
    runwayPlanId: generalVenturePlan.id,
  });

  const stateAfterReversal = dataService.getState();
  assert.equal(dataService.getCurrentOrgLeftMoney(testOrgId), 5000, 'Funds restored to 5000');
  assert.equal(stateAfterReversal.livestockEntries.length, 0, 'Livestock entries remain 0');
  assert.equal(stateAfterReversal.livestockEvents.length, 0, 'Livestock events remain 0');
});

test('Runway Execution: Checkpoint protocol control allows Start from Scratch (0 checkpoints) or custom presets', () => {
  resetLedgerState(5000);

  // Case A: User explicitly selects "Start from Scratch" -> customCheckpoints is []
  const scratchBatch = dataService.registerLivestock({
    locationId: testLocation.id,
    species: 'Broilers',
    nameOrTag: 'Blank Protocol Broilers',
    trackingMode: 'BATCH',
    entryDate: '2026-02-10T00:00:00Z',
    targetDurationValue: 6,
    targetDurationUnit: 'WEEKS',
    initialHeadcount: 50,
    purchaseCostTotal: 75,
    autoDeductPurchaseFromLeftMoney: true,
    customCheckpoints: [], // Start from scratch
    notes: 'Purchased from runway with blank schedule',
    actor: adminMember,
    runwayAllocation: { mode: 'LINE', lineId: livestockLine.id },
    runwayPlanId: testPlan.id,
  });

  const stateA = dataService.getState();
  const statusA = computeLivestockStatus(scratchBatch, stateA.livestockEvents, stateA.feedLedger);
  assert.equal(statusA.protocols.length, 0, 'Batch with Start from Scratch has 0 checkpoints, no unwanted default checkpoints applied');

  // Case B: User selects a preset with custom edited checkpoints (e.g. keeps only 2 stages)
  const customTwoStages = [
    {
      id: 'cp-custom-1',
      dayTarget: 1,
      title: 'Day 1: Setup & Warmth',
      category: 'BIOSECURITY' as const,
      completed: false,
      reminderStatus: 'SCHEDULED' as const,
    },
    {
      id: 'cp-custom-2',
      dayTarget: 28,
      title: 'Day 28: Sample Weighing',
      category: 'WEIGHT_CHECK' as const,
      targetWeightKg: 1.5,
      completed: false,
      reminderStatus: 'SCHEDULED' as const,
    },
  ];

  const customBatch = dataService.registerLivestock({
    locationId: testLocation.id,
    species: 'Broilers',
    nameOrTag: 'Custom Protocol Broilers',
    trackingMode: 'BATCH',
    entryDate: '2026-02-10T00:00:00Z',
    targetDurationValue: 6,
    targetDurationUnit: 'WEEKS',
    initialHeadcount: 50,
    purchaseCostTotal: 75,
    autoDeductPurchaseFromLeftMoney: true,
    customCheckpoints: customTwoStages,
    notes: 'Purchased with 2 custom stages',
    actor: adminMember,
    runwayAllocation: { mode: 'LINE', lineId: livestockLine.id },
    runwayPlanId: testPlan.id,
  });

  const stateB = dataService.getState();
  const statusB = computeLivestockStatus(customBatch, stateB.livestockEvents, stateB.feedLedger);
  assert.equal(statusB.protocols.length, 2, 'Batch has exactly the 2 user-approved checkpoint stages');
  assert.equal(statusB.protocols[0].title, 'Day 1: Setup & Warmth');
  assert.equal(statusB.protocols[1].title, 'Day 28: Sample Weighing');
});

test.after(() => {
  setTimeout(() => process.exit(0), 100);
});
