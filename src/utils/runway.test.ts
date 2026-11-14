import test from 'node:test';
import assert from 'node:assert/strict';
import {
  round2,
  computeLineCost,
  computePlanTotals,
  buildCashTimeline,
  computeFundingLayers,
  deriveLineStatuses,
  computeAvailableCash,
  evaluateSpend,
  suggestPledgeSplit,
  detectMilestones,
  computeRecovery,
  computeRunwayMonths,
  findOffPlanSpend,
  buildVarianceReport,
  fundingGapCoach,
  runStressTest,
  suggestUnitCosts,
  getTimelineGuideCopy,
} from './runway.ts';
import type {
  RunwayPlan,
  RunwayLine,
  RunwayPledge,
} from '../types/runway.ts';
import { RunwayError } from '../types/runway.ts';
import type {
  ExpenseLedgerEvent,
  CapitalContributionEvent,
  DebtLiabilityEvent,
  OrgMember,
  MemberEquitySummary,
} from '../types/agro.ts';

// Helper to create a base mock plan
function createMockPlan(overrides?: Partial<RunwayPlan>): RunwayPlan {
  return {
    id: 'RWY-001',
    orgId: 'org-test',
    name: 'Test Runway',
    orgType: 'AGRO_FARMING',
    mode: 'SIMPLE',
    status: 'ACTIVE',
    enforcement: 'STRICT',
    startDate: '2026-01-01',
    contingencyMode: 'PERCENT',
    contingencyPercent: 10,
    targetBasis: 'GROSS',
    activationThresholdPct: 100,
    openingCashAdopted: 0,
    plannedFinancing: [],
    phases: [],
    showMemberPledges: false,
    collectionMode: 'ANYTIME',
    milestonesReached: {},
    version: 1,
    createdByMemberId: 'mem-admin',
    createdByName: 'Admin',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    auditHash: 'hash-001',
    ...overrides,
  };
}

// U-01: Line cost math (qty * unit, recurrence expansion, rounding to cents)
test('U-01: Line cost math accurately calculates one-off and recurring lines with cent rounding', () => {
  const oneOff: RunwayLine = {
    id: 'L-1',
    planId: 'RWY-001',
    orgId: 'org-test',
    kind: 'COST',
    title: 'Broiler chicks',
    category: 'LIVESTOCK_PURCHASE',
    qty: 500,
    unitCost: 1.005, // test fractional cent rounding
    priority: 'ESSENTIAL',
    origin: 'PLAN',
    approval: 'APPROVED',
    sortOrder: 1,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    auditHash: 'h1',
  };
  assert.equal(computeLineCost(oneOff), 502.50);

  const recurring: RunwayLine = {
    ...oneOff,
    id: 'L-2',
    qty: 2,
    unitCost: 35.75,
    recurrence: { everyDays: 14, occurrences: 3 },
  };
  // 2 * 35.75 * 3 = 214.50
  assert.equal(computeLineCost(recurring), 214.50);
});

// U-02: Reserve percent vs fixed; excludeFromContingency; zero-line plan = 0
test('U-02: Contingency reserve calculation handles percent, fixed, exclusions, and empty lines', () => {
  const emptyPlan = createMockPlan();
  const emptyTotals = computePlanTotals(emptyPlan, []);
  assert.equal(emptyTotals.costTotal, 0);
  assert.equal(emptyTotals.contingencyReserve, 0);
  assert.equal(emptyTotals.totalRequirement, 0);

  const line1: RunwayLine = {
    id: 'L-1',
    planId: 'RWY-001',
    orgId: 'org-test',
    kind: 'COST',
    title: 'Feed',
    category: 'FEED',
    qty: 10,
    unitCost: 20, // 200
    priority: 'ESSENTIAL',
    origin: 'PLAN',
    approval: 'APPROVED',
    sortOrder: 1,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    auditHash: 'h1',
  };
  const line2Excluded: RunwayLine = {
    ...line1,
    id: 'L-2',
    qty: 1,
    unitCost: 500, // 500
    excludeFromContingency: true,
  };

  const percentPlan = createMockPlan({ contingencyMode: 'PERCENT', contingencyPercent: 15 });
  const totals = computePlanTotals(percentPlan, [line1, line2Excluded]);
  assert.equal(totals.costTotal, 700);
  // 15% of 200 (excluding 500) = 30
  assert.equal(totals.contingencyReserve, 30);
  assert.equal(totals.totalRequirement, 730);

  const fixedPlan = createMockPlan({ contingencyMode: 'FIXED', contingencyFixedAmount: 125 });
  const fixedTotals = computePlanTotals(fixedPlan, [line1, line2Excluded]);
  assert.equal(fixedTotals.contingencyReserve, 125);
  assert.equal(fixedTotals.totalRequirement, 825);
});

// U-03: Broiler example: lines 500 + 560 + 750 + 90 + 150 + 200 + 60 + 40 = $2,350, reserve 10 % = $235, requirement $2,585
test('U-03: Broiler example matches exact plan specifications ($2,350 lines + $235 buffer = $2,585)', () => {
  const items = [
    { title: 'Day-old chicks', qty: 500, unitCost: 1.00 }, // 500
    { title: 'Starter feed', qty: 20, unitCost: 28.00 },   // 560
    { title: 'Finisher feed', qty: 25, unitCost: 30.00 },  // 750
    { title: 'Vaccines & meds', qty: 1, unitCost: 90.00 },  // 90
    { title: 'Bedding wood shavings', qty: 10, unitCost: 15.00 }, // 150
    { title: 'Heating & gas', qty: 2, unitCost: 100.00 },  // 200
    { title: 'Disinfectant & spray', qty: 3, unitCost: 20.00 }, // 60
    { title: 'Catching & loading', qty: 4, unitCost: 10.00 }, // 40
  ];

  const lines: RunwayLine[] = items.map((it, idx) => ({
    id: `L-${idx + 1}`,
    planId: 'RWY-BROILER',
    orgId: 'org-test',
    kind: 'COST',
    title: it.title,
    category: 'LIVESTOCK',
    qty: it.qty,
    unitCost: it.unitCost,
    priority: 'ESSENTIAL',
    origin: 'PLAN',
    approval: 'APPROVED',
    sortOrder: idx,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    auditHash: `h-${idx}`,
  }));

  const plan = createMockPlan({
    id: 'RWY-BROILER',
    contingencyMode: 'PERCENT',
    contingencyPercent: 10,
  });

  const totals = computePlanTotals(plan, lines);
  assert.equal(totals.costTotal, 2350);
  assert.equal(totals.contingencyReserve, 235);
  assert.equal(totals.totalRequirement, 2585);
});

// U-04: Timeline: same-date outflow-before-inflow; Shop example (§12.3): peak need $4,100, operating break-even month 2, no payback inside the 5-month horizon, remaining shortfall $800
test('U-04: Cash timeline verifies same-date priority and General Shop reference dataset', () => {
  const plan = createMockPlan({
    startDate: '2026-01-01',
  });

  // Shop setup $3,000 at day 0
  const setupLine: RunwayLine = {
    id: 'L-SETUP',
    planId: plan.id,
    orgId: plan.orgId,
    kind: 'COST',
    title: 'Initial setup & equipment',
    category: 'ASSET',
    qty: 1,
    unitCost: 3000,
    plannedDate: '2026-01-01',
    priority: 'ESSENTIAL',
    origin: 'PLAN',
    approval: 'APPROVED',
    sortOrder: 0,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    auditHash: 'h0',
  };

  // Monthly outflow $800 (5 occurrences, every 30 days starting 2026-01-31)
  const monthlyCost: RunwayLine = {
    id: 'L-RENT',
    planId: plan.id,
    orgId: plan.orgId,
    kind: 'COST',
    title: 'Rent & operations',
    category: 'OPERATIONS',
    qty: 1,
    unitCost: 800,
    plannedDate: '2026-01-31',
    recurrence: { everyDays: 30, occurrences: 5 },
    priority: 'ESSENTIAL',
    origin: 'PLAN',
    approval: 'APPROVED',
    sortOrder: 1,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    auditHash: 'h1',
  };

  // Inflows: Month 1: $500, Month 2: $900, Month 3: $1,300, Month 4: $1,600, Month 5: $1,900
  const monthlyInflowAmounts = [500, 900, 1300, 1600, 1900];
  const incomeLines: RunwayLine[] = monthlyInflowAmounts.map((amt, idx) => {
    const d = new Date('2026-01-31');
    d.setDate(d.getDate() + idx * 30);
    return {
      id: `L-INC-${idx + 1}`,
      planId: plan.id,
      orgId: plan.orgId,
      kind: 'INCOME',
      title: `Expected sales M${idx + 1}`,
      category: 'SALES',
      qty: 1,
      unitCost: amt,
      plannedDate: d.toISOString().slice(0, 10),
      confidencePct: 100,
      priority: 'ESSENTIAL',
      origin: 'PLAN',
      approval: 'APPROVED',
      sortOrder: 10 + idx,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      auditHash: `h-inc-${idx}`,
    };
  });

  const timeline = buildCashTimeline(plan, [setupLine, monthlyCost, ...incomeLines], 0);

  // Peak need must be 4,100
  assert.equal(timeline.peakNeed, 4100);
  // Operating break-even month: month 2 (inflow 900 >= outflow 800)
  assert.equal(timeline.operatingBreakEvenMonth, 2);
  // No payback reached in horizon
  assert.equal(timeline.paybackDate, null);
  // Shortfall at the end of the 5 months: $800
  assert.equal(timeline.shortfall, 800);
});

// U-05: Target basis GROSS ($7,700) vs PEAK_NEED ($4,100 + $700 = $4,800)
test('U-05: Target basis correctly derives GROSS ($7,700) and PEAK_NEED ($4,800)', () => {
  const planGross = createMockPlan({
    targetBasis: 'GROSS',
    contingencyMode: 'PERCENT',
    contingencyPercent: 10,
    startDate: '2026-01-01',
  });

  const lines: RunwayLine[] = [
    {
      id: 'L-1',
      planId: planGross.id,
      orgId: planGross.orgId,
      kind: 'COST',
      title: 'Setup',
      category: 'ASSET',
      qty: 1,
      unitCost: 3000,
      plannedDate: '2026-01-01',
      priority: 'ESSENTIAL',
      origin: 'PLAN',
      approval: 'APPROVED',
      sortOrder: 0,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      auditHash: 'h0',
    },
    {
      id: 'L-2',
      planId: planGross.id,
      orgId: planGross.orgId,
      kind: 'COST',
      title: 'Monthly Ops',
      category: 'OPS',
      qty: 1,
      unitCost: 800,
      plannedDate: '2026-01-31',
      recurrence: { everyDays: 30, occurrences: 5 }, // 4000
      priority: 'ESSENTIAL',
      origin: 'PLAN',
      approval: 'APPROVED',
      sortOrder: 1,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      auditHash: 'h1',
    },
    // Inflow lines to produce peak 4,100
    ...[500, 900, 1300, 1600, 1900].map((amt, idx) => {
      const d = new Date('2026-01-31');
      d.setDate(d.getDate() + idx * 30);
      return {
        id: `L-INC-${idx + 1}`,
        planId: planGross.id,
        orgId: planGross.orgId,
        kind: 'INCOME' as const,
        title: `Sales M${idx + 1}`,
        category: 'SALES',
        qty: 1,
        unitCost: amt,
        plannedDate: d.toISOString().slice(0, 10),
        confidencePct: 100,
        priority: 'ESSENTIAL' as const,
        origin: 'PLAN' as const,
        approval: 'APPROVED' as const,
        sortOrder: 10 + idx,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        auditHash: `h-inc-${idx}`,
      };
    }),
  ];

  const layersGross = computeFundingLayers(planGross, lines, [], [], []);
  // Costs = 3000 + 4000 = 7000. 10% reserve = 700. Gross = 7,700.
  assert.equal(layersGross.totalRequirement, 7700);
  assert.equal(layersGross.memberTarget, 7700);

  const planPeak = createMockPlan({
    ...planGross,
    targetBasis: 'PEAK_NEED',
  });
  const layersPeak = computeFundingLayers(planPeak, lines, [], [], []);
  // Peak need (4,100) + reserve (700) = 4,800
  assert.equal(layersPeak.peakNeed, 4100);
  assert.equal(layersPeak.memberTarget, 4800);
});

// U-06: MemberTarget = T - O - F, floors at 0
test('U-06: MemberTarget subtracts opening cash (O) and planned financing (F), flooring at 0', () => {
  const plan = createMockPlan({
    targetBasis: 'GROSS',
    contingencyMode: 'FIXED',
    contingencyFixedAmount: 500,
    openingCashAdopted: 1000,
    plannedFinancing: [
      { id: 'F1', lenderName: 'AgriBank', amount: 1500 },
    ],
  });

  const line: RunwayLine = {
    id: 'L1',
    planId: plan.id,
    orgId: plan.orgId,
    kind: 'COST',
    title: 'Equipment',
    category: 'ASSET',
    qty: 1,
    unitCost: 3000,
    priority: 'ESSENTIAL',
    origin: 'PLAN',
    approval: 'APPROVED',
    sortOrder: 0,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    auditHash: 'h0',
  };

  // T = 3000 + 500 = 3500. O = 1000, F = 1500. MemberTarget = 3500 - 1000 - 1500 = 1000.
  const layers = computeFundingLayers(plan, [line], [], [], []);
  assert.equal(layers.memberTarget, 1000);

  // If opening cash + financing exceeds requirement, floor at 0
  const planExcess = createMockPlan({
    ...plan,
    openingCashAdopted: 5000,
  });
  const layersExcess = computeFundingLayers(planExcess, [line], [], [], []);
  assert.equal(layersExcess.memberTarget, 0);
});

// U-07: Funding layers & percentages; over-payment kept as extra
test('U-07: Funding layers compute percentages accurately and handle over-payment as extra', () => {
  const plan = createMockPlan({
    targetBasis: 'GROSS',
    contingencyMode: 'FIXED',
    contingencyFixedAmount: 200,
  });

  const line: RunwayLine = {
    id: 'L1',
    planId: plan.id,
    orgId: plan.orgId,
    kind: 'COST',
    title: 'Seed',
    category: 'FEED',
    qty: 1,
    unitCost: 800,
    priority: 'ESSENTIAL',
    origin: 'PLAN',
    approval: 'APPROVED',
    sortOrder: 0,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    auditHash: 'h0',
  };

  // Requirement = 800 + 200 = 1,000. MemberTarget = 1,000.
  const pledges: RunwayPledge[] = [
    {
      id: 'PLG-1',
      planId: plan.id,
      orgId: plan.orgId,
      memberId: 'mem-1',
      memberName: 'Alice',
      amount: 1200, // over-pledge!
      pace: 'ONE_OFF',
      history: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];

  const contributions: CapitalContributionEvent[] = [
    {
      id: 'CAP-1',
      orgId: plan.orgId,
      memberId: 'mem-1',
      memberName: 'Alice',
      direction: 'ADDITION',
      amount: 1100, // over-paid!
      note: 'Pay-in for runway',
      runwayPlanId: plan.id,
      createdAt: '2026-01-01',
      createdByMemberId: 'mem-1',
      auditHash: 'c1',
    },
  ];

  const expenses: ExpenseLedgerEvent[] = [
    {
      id: 'EXP-1',
      orgId: plan.orgId,
      locationId: 'loc-1',
      locationName: 'Site 1',
      category: 'FEED',
      direction: 'DEDUCTION',
      amount: 400,
      note: 'Part 1 of seed',
      loggedByMemberId: 'mem-1',
      loggedByName: 'Alice',
      approvalStatus: 'APPROVED',
      approvedByMemberIds: ['mem-admin'],
      runwayPlanId: plan.id,
      runwayLineId: 'L1',
      createdAt: '2026-01-01',
      auditHash: 'e1',
    },
  ];

  const layers = computeFundingLayers(plan, [line], pledges, contributions, expenses);
  assert.equal(layers.pledged, 1200);
  assert.equal(layers.pledgedPct, 120);
  assert.equal(layers.collected, 1100);
  assert.equal(layers.collectedPct, 110);
  assert.equal(layers.executed, 400);
  assert.equal(layers.executedPct, 40);
  assert.equal(layers.gap, 0);
});

// U-08: Derived line status (PLANNED/PARTIAL/PAID/COMMITTED); contra restores
test('U-08: Derived line statuses transition correctly and contra-reversal restores remaining budget', () => {
  const line: RunwayLine = {
    id: 'L-FEED',
    planId: 'RWY-001',
    orgId: 'org-test',
    kind: 'COST',
    title: 'Broiler Starter Feed',
    category: 'FEED',
    qty: 10,
    unitCost: 50, // total cost $500
    priority: 'ESSENTIAL',
    origin: 'PLAN',
    approval: 'APPROVED',
    sortOrder: 0,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    auditHash: 'hf',
  };

  // Initially: PLANNED
  let statuses = deriveLineStatuses([line], []);
  let info = statuses.get(line.id)!;
  assert.equal(info.status, 'PLANNED');
  assert.equal(info.spent, 0);
  assert.equal(info.remaining, 500);

  // Partial expense of $200
  const expPartial: ExpenseLedgerEvent = {
    id: 'E-1',
    orgId: 'org-test',
    locationId: 'loc-1',
    locationName: 'Site 1',
    category: 'FEED',
    direction: 'DEDUCTION',
    amount: 200,
    note: 'Feed bags 1-4',
    loggedByMemberId: 'mem-1',
    loggedByName: 'Op',
    approvalStatus: 'APPROVED',
    approvedByMemberIds: ['mem-1'],
    runwayLineId: line.id,
    createdAt: '2026-01-02',
    auditHash: 'he1',
  };

  statuses = deriveLineStatuses([line], [expPartial]);
  info = statuses.get(line.id)!;
  assert.equal(info.status, 'PARTIAL');
  assert.equal(info.spent, 200);
  assert.equal(info.remaining, 300);

  // Remaining $300 spent -> PAID
  const expRest: ExpenseLedgerEvent = {
    ...expPartial,
    id: 'E-2',
    amount: 300,
    note: 'Feed bags 5-10',
  };
  statuses = deriveLineStatuses([line], [expPartial, expRest]);
  info = statuses.get(line.id)!;
  assert.equal(info.status, 'PAID');
  assert.equal(info.spent, 500);
  assert.equal(info.remaining, 0);

  // Contra reversal of $300 restores budget back to PARTIAL
  const expContra: ExpenseLedgerEvent = {
    ...expRest,
    id: 'E-2-CONTRA',
    direction: 'CONTRA_REVERSAL',
    amount: -300,
    note: 'Correcting duplicate feed entry',
  };
  statuses = deriveLineStatuses([line], [expPartial, expRest, expContra]);
  info = statuses.get(line.id)!;
  assert.equal(info.status, 'PARTIAL');
  assert.equal(info.spent, 200);
  assert.equal(info.remaining, 300);
});

// U-09: evaluateSpend — every row of the §7.3 decision table
test('U-09: evaluateSpend validates every condition in the §7.3 decision table', () => {
  const plan = createMockPlan({
    status: 'ACTIVE',
    enforcement: 'STRICT',
    contingencyMode: 'FIXED',
    contingencyFixedAmount: 200,
    phases: [
      { id: 'p1', name: 'Phase 1', order: 1, released: true },
      { id: 'p2', name: 'Phase 2', order: 2, releaseAfterPhaseId: 'p1', released: false },
    ],
  });

  const linePhase1: RunwayLine = {
    id: 'L-P1',
    planId: plan.id,
    orgId: plan.orgId,
    phaseId: 'p1',
    kind: 'COST',
    title: 'Phase 1 Chicks',
    category: 'LIVESTOCK',
    qty: 1,
    unitCost: 500,
    priority: 'ESSENTIAL',
    origin: 'PLAN',
    approval: 'APPROVED',
    sortOrder: 0,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    auditHash: 'hp1',
  };

  const linePhase2Locked: RunwayLine = {
    ...linePhase1,
    id: 'L-P2',
    phaseId: 'p2',
    title: 'Phase 2 Expansions',
  };

  const lineSkipped: RunwayLine = {
    ...linePhase1,
    id: 'L-SKIP',
    skipped: true,
  };

  const lines = [linePhase1, linePhase2Locked, lineSkipped];

  // 1. Gate not active (e.g. DRAFT plan)
  const draftPlan = { ...plan, status: 'DRAFT' as const };
  assert.equal(
    evaluateSpend({ plan: draftPlan, lines, expenses: [], amount: 100, availableCash: 100 }).allowed,
    true
  );

  // 2. Allocation missing
  assert.throws(
    () => evaluateSpend({ plan, lines, expenses: [], amount: 100, availableCash: 1000 }),
    (err: any) => err instanceof RunwayError && err.code === 'RUNWAY_ALLOCATION_REQUIRED'
  );

  // 3. Line not found / skipped
  assert.throws(
    () => evaluateSpend({
      plan,
      lines,
      expenses: [],
      allocation: { mode: 'LINE', lineId: 'L-SKIP' },
      amount: 100,
      availableCash: 1000,
    }),
    (err: any) => err instanceof RunwayError && err.code === 'RUNWAY_LINE_INVALID'
  );

  // 4. Line belongs to locked phase
  assert.throws(
    () => evaluateSpend({
      plan,
      lines,
      expenses: [],
      allocation: { mode: 'LINE', lineId: 'L-P2' },
      amount: 100,
      availableCash: 1000,
    }),
    (err: any) => err instanceof RunwayError && err.code === 'RUNWAY_PHASE_NOT_RELEASED'
  );

  // 5. amount > availableCash
  assert.throws(
    () => evaluateSpend({
      plan,
      lines,
      expenses: [],
      allocation: { mode: 'LINE', lineId: 'L-P1' },
      amount: 300,
      availableCash: 150, // insufficient cash!
    }),
    (err: any) => err instanceof RunwayError && err.code === 'RUNWAY_INSUFFICIENT_GROUND_CASH'
  );

  // 6. amount <= remaining
  const validRes = evaluateSpend({
    plan,
    lines,
    expenses: [],
    allocation: { mode: 'LINE', lineId: 'L-P1' },
    amount: 300,
    availableCash: 1000,
  });
  assert.equal(validRes.allowed, true);
  assert.equal(validRes.tags.runwayLineId, 'L-P1');

  // 7. amount > remaining (overrun without reserve draw)
  assert.throws(
    () => evaluateSpend({
      plan,
      lines,
      expenses: [],
      allocation: { mode: 'LINE', lineId: 'L-P1' },
      amount: 600, // exceeds 500 budget
      availableCash: 1000,
    }),
    (err: any) => err instanceof RunwayError && err.code === 'RUNWAY_LINE_OVERRUN'
  );

  // 7b. overrun with valid reserve draw
  const overrunRes = evaluateSpend({
    plan,
    lines,
    expenses: [],
    allocation: {
      mode: 'LINE',
      lineId: 'L-P1',
      reserveDrawAmount: 100,
      reserveReason: 'Chicks price increased by $100 across supplier',
    },
    amount: 600,
    availableCash: 1000,
  });
  assert.equal(overrunRes.allowed, true);
  assert.equal(overrunRes.tags.runwayReserveDraw, 100);

  // 8. Contingency reserve exhausted
  assert.throws(
    () => evaluateSpend({
      plan,
      lines,
      expenses: [],
      allocation: { mode: 'CONTINGENCY', reason: 'Repair fence after storm' },
      amount: 350, // reserve is 200
      availableCash: 1000,
    }),
    (err: any) => err instanceof RunwayError && err.code === 'RUNWAY_RESERVE_EXHAUSTED'
  );

  // 9. NEW_LINE creates pending amendment
  assert.throws(
    () => evaluateSpend({
      plan,
      lines,
      expenses: [],
      allocation: { mode: 'NEW_LINE', title: 'Security Cameras', category: 'ASSET', note: 'Unplanned security upgrade' },
      amount: 300,
      availableCash: 1000,
    }),
    (err: any) => err instanceof RunwayError && err.code === 'RUNWAY_AMENDMENT_PENDING'
  );

  // 10. Contingency without valid reason (< 4 chars)
  assert.throws(
    () => evaluateSpend({
      plan,
      lines,
      expenses: [],
      allocation: { mode: 'CONTINGENCY', reason: 'bad' },
      amount: 50,
      availableCash: 1000,
    }),
    (err: any) => err instanceof RunwayError && err.code === 'RUNWAY_REASON_REQUIRED'
  );
});

// U-10: availableCash subtracts pending multi-sig
test('U-10: availableCash subtracts pending multi-sig expenses to prevent overdrawing', () => {
  const leftMoney = 500;
  const expenses: ExpenseLedgerEvent[] = [
    {
      id: 'E-PEND-1',
      orgId: 'org-test',
      locationId: 'loc-1',
      locationName: 'Site 1',
      category: 'FEED',
      direction: 'DEDUCTION',
      amount: 200,
      note: 'Pending multi-sig approval',
      loggedByMemberId: 'mem-1',
      loggedByName: 'Op',
      approvalStatus: 'PENDING_MULTISIG',
      approvedByMemberIds: [],
      createdAt: '2026-01-01',
      auditHash: 'p1',
    },
    {
      id: 'E-APP-1',
      orgId: 'org-test',
      locationId: 'loc-1',
      locationName: 'Site 1',
      category: 'FEED',
      direction: 'DEDUCTION',
      amount: 150,
      note: 'Approved',
      loggedByMemberId: 'mem-1',
      loggedByName: 'Op',
      approvalStatus: 'APPROVED',
      approvedByMemberIds: ['mem-admin'],
      createdAt: '2026-01-01',
      auditHash: 'a1',
    },
  ];

  // 500 leftMoney - 200 pending multi-sig = 300 available
  assert.equal(computeAvailableCash(leftMoney, expenses), 300);
});

// U-11: Pledge split: equal / by target / by equity; sums exactly to M (cent distribution)
test('U-11: suggestPledgeSplit calculates splits that sum exactly to target without cent loss', () => {
  const members: OrgMember[] = [
    {
      id: 'm1',
      orgId: 'org-test',
      fullName: 'Alice',
      phoneOrEmail: 'alice@test.com',
      role: 'ORG_ADMIN',
      targetContributionUsd: 1000,
      joinedAt: '2026-01-01',
      active: true,
    },
    {
      id: 'm2',
      orgId: 'org-test',
      fullName: 'Bob',
      phoneOrEmail: 'bob@test.com',
      role: 'MEMBER',
      targetContributionUsd: 2000,
      joinedAt: '2026-01-01',
      active: true,
    },
    {
      id: 'm3',
      orgId: 'org-test',
      fullName: 'Charlie',
      phoneOrEmail: 'charlie@test.com',
      role: 'MEMBER',
      targetContributionUsd: 1000,
      joinedAt: '2026-01-01',
      active: true,
    },
  ];

  // Target = 1000. Equal split: 1000 / 3 = 333.33 with one cent remaining.
  const equalSplits = suggestPledgeSplit(1000, members, 'EQUAL');
  const sumEqual = round2(equalSplits.reduce((acc, s) => acc + s.amount, 0));
  assert.equal(sumEqual, 1000.00);
  assert.equal(equalSplits[0].amount, 333.34);
  assert.equal(equalSplits[1].amount, 333.33);
  assert.equal(equalSplits[2].amount, 333.33);

  // Proportional by target: 1000/4000 (25%), 2000/4000 (50%), 1000/4000 (25%) -> 250, 500, 250
  const targetSplits = suggestPledgeSplit(1000, members, 'BY_TARGET');
  const sumTarget = round2(targetSplits.reduce((acc, s) => acc + s.amount, 0));
  assert.equal(sumTarget, 1000.00);
  assert.equal(targetSplits[0].amount, 250.00);
  assert.equal(targetSplits[1].amount, 500.00);
  assert.equal(targetSplits[2].amount, 250.00);
});

// U-12: Milestone detection fires once per threshold, never twice
test('U-12: Milestone detection fires once per threshold and ignores already reached milestones', () => {
  const plan = createMockPlan({
    milestonesReached: {
      PLEDGED_25: '2026-01-02T10:00:00.000Z',
    },
  });

  const layers: any = {
    pledgedPct: 55, // hit 25% and 50%
    collectedPct: 30, // hit 25%
  };

  const newMilestones = detectMilestones(layers, plan, false);
  // PLEDGED_25 was already reached, so only PLEDGED_50 and COLLECTED_25 should fire
  assert.deepEqual(newMilestones, ['PLEDGED_50', 'COLLECTED_25']);
});

// U-13: Recovery % and break-even trigger
test('U-13: computeRecovery detects break-even when revenue meets or exceeds executed spend', () => {
  const under = computeRecovery(1000, 750, 0);
  assert.equal(under.recoveredPct, 75.0);
  assert.equal(under.isBreakEven, false);

  const exact = computeRecovery(1000, 800, 200); // 800 cash + 200 credit payments = 1000
  assert.equal(exact.recoveredPct, 100.0);
  assert.equal(exact.isBreakEven, true);

  const profit = computeRecovery(1000, 1400, 100);
  assert.equal(profit.recoveredPct, 150.0);
  assert.equal(profit.isBreakEven, true);
});

// U-14: Variance report & off-plan detection
test('U-14: Variance report identifies plan vs actual differences and detects off-plan expenses', () => {
  const plan = createMockPlan({
    status: 'ACTIVE',
    activatedAt: '2026-01-01T00:00:00.000Z',
    contingencyMode: 'FIXED',
    contingencyFixedAmount: 100,
  });

  const line: RunwayLine = {
    id: 'L-1',
    planId: plan.id,
    orgId: plan.orgId,
    kind: 'COST',
    title: 'Broiler Feed',
    category: 'FEED',
    qty: 1,
    unitCost: 400,
    priority: 'ESSENTIAL',
    origin: 'PLAN',
    approval: 'APPROVED',
    sortOrder: 0,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    auditHash: 'h0',
  };

  const planExp: ExpenseLedgerEvent = {
    id: 'EXP-PLAN',
    orgId: plan.orgId,
    locationId: 'loc-1',
    locationName: 'Site 1',
    category: 'FEED',
    direction: 'DEDUCTION',
    amount: 450, // $50 overrun
    note: 'Feed bags',
    loggedByMemberId: 'mem-1',
    loggedByName: 'Op',
    approvalStatus: 'APPROVED',
    approvedByMemberIds: ['mem-admin'],
    runwayPlanId: plan.id,
    runwayLineId: line.id,
    runwayReserveDraw: 50,
    createdAt: '2026-01-05T00:00:00.000Z',
    auditHash: 'ep',
  };

  const offPlanExp: ExpenseLedgerEvent = {
    id: 'EXP-OFF',
    orgId: plan.orgId,
    locationId: 'loc-1',
    locationName: 'Site 1',
    category: 'MAINTENANCE',
    direction: 'DEDUCTION',
    amount: 120,
    note: 'Emergency generator fuel logged without plan tag',
    loggedByMemberId: 'mem-1',
    loggedByName: 'Op',
    approvalStatus: 'APPROVED',
    approvedByMemberIds: ['mem-admin'],
    createdAt: '2026-01-06T00:00:00.000Z',
    auditHash: 'eo',
  };

  const expenses = [planExp, offPlanExp];

  const offPlan = findOffPlanSpend(plan, expenses);
  assert.equal(offPlan.length, 1);
  assert.equal(offPlan[0].id, 'EXP-OFF');

  const report = buildVarianceReport(plan, [line], expenses);
  assert.equal(report.totalPlanned, 400);
  assert.equal(report.totalSpent, 450);
  assert.equal(report.varianceTotal, 50);
  assert.equal(report.contingencyUsed, 50);
  assert.equal(report.contingencyLeft, 50);
  assert.equal(report.offPlanTotal, 120);
});

// U-15: Stress test raises peak need predictably
test('U-15: Stress test raises peak need and recalculates cash timeline', () => {
  const plan = createMockPlan({
    startDate: '2026-01-01',
  });

  const costLine: RunwayLine = {
    id: 'L-1',
    planId: plan.id,
    orgId: plan.orgId,
    kind: 'COST',
    title: 'Broiler Setup',
    category: 'LIVESTOCK',
    qty: 1,
    unitCost: 1000,
    plannedDate: '2026-01-01',
    priority: 'ESSENTIAL',
    origin: 'PLAN',
    approval: 'APPROVED',
    sortOrder: 0,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    auditHash: 'h1',
  };

  const baseTimeline = buildCashTimeline(plan, [costLine], 0);
  assert.equal(baseTimeline.peakNeed, 1000);

  // Stress test: +25% cost increase
  const stressed = runStressTest(
    plan,
    [costLine],
    { costIncreasePct: 25, incomeDelayMonths: 0, incomeHaircutPct: 0 },
    0
  );
  assert.equal(stressed.peakNeed, 1250);
});

// U-16: Funding Gap Coach ordering (raise pledges / trim NICE_TO_HAVE / phase / loan)
test('U-16: fundingGapCoach provides prioritized recommendations when a funding gap exists', () => {
  const lines: RunwayLine[] = [
    {
      id: 'L-NICE',
      planId: 'RWY-001',
      orgId: 'org-test',
      kind: 'COST',
      title: 'Perimeter solar spotlights',
      category: 'ASSET',
      qty: 2,
      unitCost: 150, // 300 nice-to-have
      priority: 'NICE_TO_HAVE',
      origin: 'PLAN',
      approval: 'APPROVED',
      sortOrder: 0,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      auditHash: 'h0',
    },
  ];

  const pledges: RunwayPledge[] = [
    {
      id: 'P1',
      planId: 'RWY-001',
      orgId: 'org-test',
      memberId: 'm1',
      memberName: 'Alice',
      amount: 500,
      pace: 'ONE_OFF',
      history: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: 'P2',
      planId: 'RWY-001',
      orgId: 'org-test',
      memberId: 'm2',
      memberName: 'Bob',
      amount: 500,
      pace: 'ONE_OFF',
      history: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];

  const gap = 400;
  const recs = fundingGapCoach(gap, lines, pledges);

  assert.equal(recs.length > 0, true);
  // Priority 1: Trim nice-to-have
  assert.equal(recs[0].type, 'TRIM_LINES');
  assert.equal(recs[0].potentialImpactUsd, 300);

  // Priority 2: Member top-up (400 / 2 members = $200 each)
  assert.equal(recs[1].type, 'INCREASE_PLEDGES');
  assert.equal(recs[1].potentialImpactUsd, 400);

  // Suggest unit costs helper
  const pastExpenses: ExpenseLedgerEvent[] = [
    {
      id: 'E1',
      orgId: 'org-test',
      locationId: 'loc-1',
      locationName: 'Site 1',
      category: 'FEED',
      direction: 'DEDUCTION',
      amount: 25,
      note: 'feed',
      loggedByMemberId: 'm1',
      loggedByName: 'Alice',
      approvalStatus: 'APPROVED',
      approvedByMemberIds: ['m1'],
      createdAt: '2026-01-01',
      auditHash: 'a',
    },
    {
      id: 'E2',
      orgId: 'org-test',
      locationId: 'loc-1',
      locationName: 'Site 1',
      category: 'FEED',
      direction: 'DEDUCTION',
      amount: 35,
      note: 'feed',
      loggedByMemberId: 'm1',
      loggedByName: 'Alice',
      approvalStatus: 'APPROVED',
      approvedByMemberIds: ['m1'],
      createdAt: '2026-01-01',
      auditHash: 'b',
    },
  ];
  // median of 25 and 35 is 30
  assert.equal(suggestUnitCosts('FEED', pastExpenses), 30);
});

test('U-17: Timeline "How to Read" guide excludes agro terminology for General Business', () => {
  const generalCopy = getTimelineGuideCopy(false);
  const combinedGeneral = [
    generalCopy.subtitle,
    generalCopy.guideTitle,
    generalCopy.dipDescription,
    generalCopy.breakEvenPrefix,
    generalCopy.breakEvenSuffix,
  ]
    .join(' ')
    .toLowerCase();

  assert.doesNotMatch(combinedGeneral, /\b(agriculture|farming|farm|feed|chicks|harvest)\b/);
  assert.match(generalCopy.guideTitle, /Business Cash Flow/);

  const agroCopy = getTimelineGuideCopy(true);
  assert.match(agroCopy.guideTitle, /Agriculture/);
  assert.match(agroCopy.dipDescription, /feed, chicks/i);
});

test('U-18: computeFundingLayers ignores MERGED and WITHDRAWN pledges without double-counting after linking', () => {
  const plan: RunwayPlan = {
    id: 'RWY-U18',
    orgId: 'org-u18',
    name: 'General Venture Cycle',
    orgType: 'GENERAL_VENTURE',
    mode: 'SIMPLE',
    status: 'PLEDGING',
    enforcement: 'STRICT',
    startDate: '2026-03-01T00:00:00Z',
    contingencyMode: 'PERCENT',
    contingencyPercent: 0,
    targetBasis: 'GROSS',
    activationThresholdPct: 100,
    openingCashAdopted: 0,
    plannedFinancing: [],
    phases: [],
    showMemberPledges: true,
    collectionMode: 'ANYTIME',
    milestonesReached: {},
    version: 1,
    createdByMemberId: 'mem-1',
    createdByName: 'Admin',
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
    auditHash: 'h-u18',
  };

  const lines: RunwayLine[] = [
    {
      id: 'L1',
      planId: plan.id,
      orgId: plan.orgId,
      kind: 'COST',
      title: 'Inventory Stock',
      name: 'Inventory Stock',
      category: 'STOCK',
      plannedDate: '2026-03-05T00:00:00Z',
      unitCost: 1000,
      qty: 1,
      priority: 'ESSENTIAL',
      origin: 'PLAN',
      approval: 'APPROVED',
      sortOrder: 1,
      createdAt: '2026-03-01T00:00:00Z',
      updatedAt: '2026-03-01T00:00:00Z',
      auditHash: 'h-l1',
    },
  ];

  const pledges: RunwayPledge[] = [
    {
      id: 'PLG-SURVIVOR',
      planId: plan.id,
      orgId: plan.orgId,
      memberId: 'uid-real-1',
      memberName: 'Alice Real',
      amount: 700,
      pledgedAmount: 700,
      paidAmount: 500,
      pace: 'ONE_OFF',
      status: 'ACTIVE',
      history: [],
      createdAt: '2026-03-02T00:00:00Z',
      updatedAt: '2026-03-03T00:00:00Z',
    },
    {
      id: 'PLG-ABSORBED-MOCK',
      planId: plan.id,
      orgId: plan.orgId,
      memberId: 'uid-real-1',
      memberName: 'Alice Mock',
      amount: 400,
      pledgedAmount: 400,
      paidAmount: 0,
      pace: 'ONE_OFF',
      status: 'MERGED',
      absorbedIntoPledgeId: 'PLG-SURVIVOR',
      history: [],
      createdAt: '2026-03-01T00:00:00Z',
      updatedAt: '2026-03-03T00:00:00Z',
    },
    {
      id: 'PLG-WITHDRAWN',
      planId: plan.id,
      orgId: plan.orgId,
      memberId: 'mem-2',
      memberName: 'Bob',
      amount: 300,
      pledgedAmount: 300,
      paidAmount: 0,
      pace: 'ONE_OFF',
      status: 'WITHDRAWN',
      history: [],
      createdAt: '2026-03-01T00:00:00Z',
      updatedAt: '2026-03-03T00:00:00Z',
    },
  ];

  const layers = computeFundingLayers(plan, lines, pledges, [], []);
  assert.equal(layers.pledged, 700);
  assert.equal(layers.gap, 300);
});
