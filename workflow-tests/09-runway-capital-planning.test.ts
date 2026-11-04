import test from 'node:test';
import assert from 'node:assert/strict';
import { dataService } from '../src/services/dataService.ts';
import {
  computePlanTotals,
  computeFundingLayers,
  deriveLineStatuses,
  suggestPledgeSplit,
  suggestUnitCosts,
  detectMilestones,
  computeRecovery,
  computeAvailableCash,
} from '../src/utils/runway.ts';
import { BUILT_IN_RUNWAY_TEMPLATES } from '../src/utils/runwayTemplates.ts';
import { RunwayError } from '../src/types/runway.ts';
import { TEST_ACCOUNTS, toOrgMember } from './helpers/testContext.ts';
import { verifyAuditChainIntegrity } from '../src/utils/cryptoHash.ts';

// ---------------------------------------------------------------------------
// SUITE 9: RUNWAY CAPITAL PLANNING MODULE WORKFLOWS & SPEND GATE ENFORCEMENT
// ---------------------------------------------------------------------------

const adminActor = toOrgMember(TEST_ACCOUNTS.agroAdmin);
const treasurerActor = toOrgMember(TEST_ACCOUNTS.agroTreasurer);
const memberActor = toOrgMember(TEST_ACCOUNTS.agroMember);
const operatorActor = toOrgMember(TEST_ACCOUNTS.agroOperator);
const ventureAdminActor = toOrgMember(TEST_ACCOUNTS.ventureAdmin);

let failedCount = 0;
function runTest(name: string, fn: () => void | Promise<void>) {
  test(name, async () => {
    try {
      await fn();
    } catch (e: any) {
      failedCount++;
      console.error(`\n>>> FAILURE IN [${name}]:`, e.message);
      if (e.actual !== undefined && e.expected !== undefined) {
        console.error(`    Actual:`, e.actual, `Expected:`, e.expected);
      }
      throw e;
    }
  });
}

// Seed test actors in state.members
const initialState = dataService.getState();
const existingIds = new Set(initialState.members.map((m) => m.id));
const toAdd = [adminActor, treasurerActor, memberActor, operatorActor, ventureAdminActor].filter((m) => !existingIds.has(m.id));
if (toAdd.length > 0) {
  dataService.saveLocalState({
    ...initialState,
    members: [...initialState.members, ...toAdd],
  });
}

// Create isolated test location for Suite 9
const testLoc = dataService.addLocation({
  name: 'Norton Runway Testing Ground',
  region: 'Mashonaland West',
  gpsCoordinates: '-17.8833, 30.7000',
  primaryOperatorName: adminActor.fullName,
  actor: adminActor,
});

runTest('WF-RUN-01: Feature toggle isolation & no-regression (features.runwayModule off -> early exit)', () => {
  const orgId = adminActor.orgId || 'org-agro-prod-01';

  // Ensure runwayModule is disabled for this test
  dataService.setRunwayModuleEnabled({ orgId, enabled: false, actor: adminActor });
  const org = (dataService.getState().organizations || []).find((o) => o.id === orgId);
  assert.equal(org?.features?.runwayModule, false);

  // Assert compliance directly: with module disabled, returns empty object immediately
  const compliance = dataService.assertRunwayCompliance({
    orgId,
    amount: 500,
    actor: adminActor,
  });
  assert.deepEqual(compliance, {});
});

runTest('WF-RUN-02: Enable module + draft plan creation with built-in template', () => {
  const orgId = adminActor.orgId || 'org-agro-prod-01';

  dataService.setRunwayModuleEnabled({ orgId, enabled: true, actor: adminActor });
  const org = (dataService.getState().organizations || []).find((o) => o.id === orgId);
  assert.equal(org?.features?.runwayModule, true);

  const broilerTemplate = BUILT_IN_RUNWAY_TEMPLATES.find((t) => t.id === 'TMP-AGRO-BROILER-42D');
  assert.ok(broilerTemplate);

  const { plan } = dataService.createRunwayPlan({
    orgId,
    name: 'Q1 2026 Broiler Expansion',
    enforcement: 'STRICT',
    startDate: new Date().toISOString(),
    fundingDeadline: new Date(Date.now() + 14 * 86400000).toISOString(),
    contingencyMode: 'PERCENT',
    contingencyPercent: 10,
    targetBasis: 'GROSS',
    activationThresholdPct: 100,
    templateId: broilerTemplate.id,
    lines: broilerTemplate.lines,
    phases: broilerTemplate.phases,
    actor: adminActor,
  });

  assert.equal(plan.status, 'DRAFT');
  assert.equal(plan.enforcement, 'STRICT');
  assert.equal(plan.orgId, orgId);

  const lines = (dataService.getState().runwayLines || []).filter((l) => l.planId === plan.id);
  assert.equal(lines.length, broilerTemplate.lines.length);
});

runTest('WF-RUN-03: Line CRUD + auto-sum totals + reserve mode handling', () => {
  const orgId = adminActor.orgId || 'org-agro-prod-01';

  const { plan } = dataService.createRunwayPlan({
    orgId,
    name: 'Custom Line Test Plan',
    enforcement: 'STRICT',
    startDate: new Date().toISOString(),
    contingencyMode: 'PERCENT',
    contingencyPercent: 10,
    targetBasis: 'GROSS',
    activationThresholdPct: 100,
    actor: adminActor,
  });

  // Create line 1
  const line1 = dataService.upsertRunwayLine({
    planId: plan.id,
    line: {
      title: '500 Day-Old Chicks',
      category: 'LIVESTOCK',
      kind: 'COST',
      qty: 500,
      unitCost: 1.10,
      unitLabel: 'chick',
      priority: 'ESSENTIAL',
      sortOrder: 0,
    },
    actor: adminActor,
  });

  // Create line 2
  const line2 = dataService.upsertRunwayLine({
    planId: plan.id,
    line: {
      title: 'Starter Feed 50kg Bags',
      category: 'FEED',
      kind: 'COST',
      qty: 10,
      unitCost: 35.00,
      unitLabel: 'bag',
      priority: 'ESSENTIAL',
      sortOrder: 1,
    },
    actor: adminActor,
  });

  let lines = (dataService.getState().runwayLines || []).filter((l) => l.planId === plan.id);
  let totals = computePlanTotals(plan, lines);

  // line1: 500 * 1.10 = 550, line2: 10 * 35 = 350, subtotal = 900
  // reserve: 10% of 900 = 90. totalRequirement = 990
  assert.equal(totals.costTotal, 900);
  assert.equal(totals.contingencyReserve, 90);
  assert.equal(totals.totalRequirement, 990);

  // Update line 2 qty to 12 (12 * 35 = 420, subtotal = 970, reserve = 97, totalRequirement = 1067)
  dataService.upsertRunwayLine({
    planId: plan.id,
    line: {
      id: line2.id,
      title: line2.title,
      category: line2.category,
      kind: line2.kind,
      qty: 12,
      unitCost: 35.00,
      priority: 'ESSENTIAL',
    },
    actor: adminActor,
  });

  lines = (dataService.getState().runwayLines || []).filter((l) => l.planId === plan.id);
  totals = computePlanTotals(plan, lines);
  assert.equal(totals.costTotal, 970);
  assert.equal(totals.contingencyReserve, 97);
  assert.equal(totals.totalRequirement, 1067);

  // Reorder lines
  dataService.reorderRunwayLines({ planId: plan.id, lineIds: [line2.id, line1.id], actor: adminActor });
  const reordered = (dataService.getState().runwayLines || []).filter((l) => l.planId === plan.id);
  assert.equal(reordered.find((l) => l.id === line2.id)?.sortOrder, 0);
  assert.equal(reordered.find((l) => l.id === line1.id)?.sortOrder, 1);

  // Delete line 1
  dataService.removeRunwayLine({ planId: plan.id, lineId: line1.id, actor: adminActor });
  lines = (dataService.getState().runwayLines || []).filter((l) => l.planId === plan.id);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].id, line2.id);
});

runTest('WF-RUN-04: Smart unit cost suggestions from past org expenses', () => {
  const orgId = adminActor.orgId || 'org-agro-prod-01';

  const mockExpenses = [
    { id: 'E1', orgId, category: 'FEED', amount: 30, direction: 'DEDUCTION', approvalStatus: 'APPROVED', createdAt: new Date().toISOString() } as any,
    { id: 'E2', orgId, category: 'FEED', amount: 40, direction: 'DEDUCTION', approvalStatus: 'APPROVED', createdAt: new Date().toISOString() } as any,
    { id: 'E3', orgId, category: 'FEED', amount: 50, direction: 'DEDUCTION', approvalStatus: 'APPROVED', createdAt: new Date().toISOString() } as any,
  ];

  const suggested = suggestUnitCosts('FEED', mockExpenses);
  // Median of [30, 40, 50] is 40
  assert.equal(suggested, 40);
});

runTest('WF-RUN-05: Lock plan -> freezes lines, captures opening cash (O), enters PLEDGING', () => {
  const orgId = adminActor.orgId || 'org-agro-prod-01';

  const { plan } = dataService.createRunwayPlan({
    orgId,
    name: 'Lock Test Plan',
    enforcement: 'STRICT',
    startDate: new Date().toISOString(),
    contingencyMode: 'PERCENT',
    contingencyPercent: 10,
    targetBasis: 'GROSS',
    activationThresholdPct: 100,
    actor: adminActor,
  });

  dataService.upsertRunwayLine({
    planId: plan.id,
    line: {
      title: 'Brooding kit',
      category: 'FEED',
      kind: 'COST',
      qty: 1,
      unitCost: 100,
      priority: 'ESSENTIAL',
    },
    actor: adminActor,
  });

  const lockedPlan = dataService.lockRunwayPlan({
    planId: plan.id,
    adoptOpeningCash: true,
    actor: adminActor,
  });

  assert.equal(lockedPlan.status, 'PLEDGING');
  assert.ok(lockedPlan.lockedAt);

  // Modifying line on locked plan without amendment must fail
  assert.throws(
    () => {
      dataService.upsertRunwayLine({
        planId: plan.id,
        line: {
          title: 'New Line While Locked',
          category: 'FEED',
          kind: 'COST',
          qty: 1,
          unitCost: 50,
          priority: 'ESSENTIAL',
        },
        actor: adminActor,
      });
    },
    (err: any) => {
      assert.ok(err instanceof RunwayError);
      assert.equal(err.code, 'RUNWAY_PLAN_LOCKED');
      return true;
    }
  );
});

runTest('WF-RUN-06: Member pledge creation + history tracking + audit log', () => {
  const orgId = memberActor.orgId || 'org-agro-prod-01';

  const { plan } = dataService.createRunwayPlan({
    orgId,
    name: 'Pledge History Test Plan',
    enforcement: 'STRICT',
    startDate: new Date().toISOString(),
    contingencyMode: 'PERCENT',
    contingencyPercent: 0,
    targetBasis: 'GROSS',
    activationThresholdPct: 100,
    actor: adminActor,
  });

  dataService.upsertRunwayLine({
    planId: plan.id,
    line: {
      title: 'Pledge Target Item',
      category: 'FEED',
      kind: 'COST',
      qty: 1,
      unitCost: 1000,
      priority: 'ESSENTIAL',
    },
    actor: adminActor,
  });

  dataService.lockRunwayPlan({ planId: plan.id, actor: adminActor });

  // Member pledges $400
  const pledge = dataService.pledgeToRunwayPlan({
    planId: plan.id,
    memberId: memberActor.id,
    amount: 400,
    actor: memberActor,
  });

  assert.equal(pledge.amount, 400);
  assert.equal(pledge.memberId, memberActor.id);
  assert.equal(pledge.history.length, 1);
  assert.equal(pledge.history[0].type, 'INITIAL');
  assert.equal(pledge.history[0].newAmount, 400);
});

runTest('WF-RUN-07: Fair share suggestion split among members', () => {
  const m1 = toOrgMember(TEST_ACCOUNTS.agroAdmin);
  const m2 = toOrgMember(TEST_ACCOUNTS.agroTreasurer);
  const m3 = toOrgMember(TEST_ACCOUNTS.agroMember);
  const target = 1000;

  const splits = suggestPledgeSplit(target, [m1, m2, m3]);
  assert.equal(splits.length, 3);

  // 1000 / 3 = 333.33 with cent distributed to first
  const sum = splits.reduce((acc, s) => acc + s.amount, 0);
  assert.equal(sum, 1000);
  assert.equal(splits[0].amount, 333.34);
  assert.equal(splits[1].amount, 333.33);
  assert.equal(splits[2].amount, 333.33);
});

runTest('WF-RUN-08: Pledge modification: cannot decrease below already-contributed cash', () => {
  const orgId = memberActor.orgId || 'org-agro-prod-01';

  const { plan } = dataService.createRunwayPlan({
    orgId,
    name: 'Pledge Cap Test Plan',
    enforcement: 'STRICT',
    startDate: new Date().toISOString(),
    contingencyMode: 'PERCENT',
    contingencyPercent: 0,
    targetBasis: 'GROSS',
    activationThresholdPct: 100,
    actor: adminActor,
  });

  dataService.upsertRunwayLine({
    planId: plan.id,
    line: {
      title: 'Cap Line',
      category: 'FEED',
      kind: 'COST',
      qty: 1,
      unitCost: 1000,
      priority: 'ESSENTIAL',
    },
    actor: adminActor,
  });
  dataService.lockRunwayPlan({ planId: plan.id, actor: adminActor });

  // Pledge $500
  dataService.pledgeToRunwayPlan({
    planId: plan.id,
    memberId: memberActor.id,
    amount: 500,
    actor: memberActor,
  });

  // Log capital contribution of $300 tagged with this plan
  dataService.logCapitalContribution({
    memberId: memberActor.id,
    direction: 'ADDITION',
    amount: 300,
    note: 'Initial deposit for runway plan',
    runwayPlanId: plan.id,
    actor: treasurerActor,
  });

  // Decreasing pledge to $200 (below $300 paid) must fail
  assert.throws(
    () => {
      dataService.pledgeToRunwayPlan({
        planId: plan.id,
        memberId: memberActor.id,
        amount: 200,
        actor: memberActor,
      });
    },
    (err: any) => {
      assert.ok(err instanceof RunwayError);
      assert.equal(err.code, 'RUNWAY_PLEDGE_BELOW_PAID');
      return true;
    }
  );

  // Decreasing pledge to $350 (above $300) succeeds
  const updated = dataService.pledgeToRunwayPlan({
    planId: plan.id,
    memberId: memberActor.id,
    amount: 350,
    actor: memberActor,
  });
  assert.equal(updated.amount, 350);
});

runTest('WF-RUN-09: Payment claim submission by member + treasurer confirmation', () => {
  const orgId = memberActor.orgId || 'org-agro-prod-01';

  const { plan } = dataService.createRunwayPlan({
    orgId,
    name: 'Payment Claim Workflow Plan',
    enforcement: 'STRICT',
    startDate: new Date().toISOString(),
    contingencyMode: 'PERCENT',
    contingencyPercent: 0,
    targetBasis: 'GROSS',
    activationThresholdPct: 100,
    actor: adminActor,
  });

  dataService.upsertRunwayLine({
    planId: plan.id,
    line: {
      title: 'Claim Line',
      category: 'FEED',
      kind: 'COST',
      qty: 1,
      unitCost: 500,
      priority: 'ESSENTIAL',
    },
    actor: adminActor,
  });
  dataService.lockRunwayPlan({ planId: plan.id, actor: adminActor });

  const pledge = dataService.pledgeToRunwayPlan({
    planId: plan.id,
    memberId: memberActor.id,
    amount: 500,
    actor: memberActor,
  });

  // Member submits payment claim
  const claim = dataService.submitRunwayPaymentClaim({
    planId: plan.id,
    pledgeId: pledge.id,
    amount: 250,
    method: 'ECOCASH',
    reference: 'Ecocash Ref #EC-883920',
    actor: memberActor,
  });

  assert.equal(claim.status, 'PENDING');
  assert.equal(claim.amount, 250);

  // Non-treasurer cannot approve claim
  assert.throws(
    () => {
      dataService.resolveRunwayPaymentClaim({
        claimId: claim.id,
        decision: 'CONFIRM',
        actor: memberActor,
      });
    },
    (err: any) => {
      assert.match(err.message, /Access Denied: Only Treasurers and Organization Admins/i);
      return true;
    }
  );

  // Treasurer confirms claim -> creates CapitalContributionEvent
  const confirmedClaim = dataService.resolveRunwayPaymentClaim({
    claimId: claim.id,
    decision: 'CONFIRM',
    actor: treasurerActor,
  });

  assert.equal(confirmedClaim.status, 'CONFIRMED');
  assert.ok(confirmedClaim.contributionId);

  // Verify capital contribution was created and tagged
  const contr = dataService.getState().capitalContributions.find((c) => c.id === confirmedClaim.contributionId);
  assert.ok(contr);
  assert.equal(contr.amount, 250);
  assert.equal(contr.runwayPlanId, plan.id);
  assert.equal(contr.pledgeId, pledge.id);
});

runTest('WF-RUN-10: Capital contribution auto-tags runwayPlanId & pledgeId, updates funding layers', () => {
  const orgId = memberActor.orgId || 'org-agro-prod-01';

  const { plan } = dataService.createRunwayPlan({
    orgId,
    name: 'Layers Funding Calculation Plan',
    enforcement: 'STRICT',
    startDate: new Date().toISOString(),
    contingencyMode: 'PERCENT',
    contingencyPercent: 0,
    targetBasis: 'GROSS',
    activationThresholdPct: 100,
    actor: adminActor,
  });

  dataService.upsertRunwayLine({
    planId: plan.id,
    line: {
      title: 'Layers Target Item',
      category: 'FEED',
      kind: 'COST',
      qty: 1,
      unitCost: 1000,
      priority: 'ESSENTIAL',
    },
    actor: adminActor,
  });

  dataService.lockRunwayPlan({ planId: plan.id, actor: adminActor });

  dataService.pledgeToRunwayPlan({
    planId: plan.id,
    memberId: memberActor.id,
    amount: 1000,
    actor: memberActor,
  });

  dataService.logCapitalContribution({
    memberId: memberActor.id,
    direction: 'ADDITION',
    amount: 600,
    note: 'Partial pay-in',
    runwayPlanId: plan.id,
    actor: treasurerActor,
  });

  const state = dataService.getState();
  const currentPlan = (state.runwayPlans || []).find((p) => p.id === plan.id)!;
  const currentLines = (state.runwayLines || []).filter((l) => l.planId === plan.id);
  const currentPledges = (state.runwayPledges || []).filter((p) => p.planId === plan.id);
  const currentContributions = (state.capitalContributions || []).filter((c) => c.runwayPlanId === plan.id);

  const layers = computeFundingLayers(currentPlan, currentLines, currentPledges, currentContributions, [], []);
  assert.equal(layers.totalRequirement, 1000);
  assert.equal(layers.collected, 600);
  assert.equal(layers.gap, 0);
  assert.equal(layers.memberTarget - layers.collected, 400);
  assert.equal(layers.collectedPct, 60);
  assert.equal(layers.pledgedPct, 100);
  assert.equal(layers.collectedPct >= 100, false);
  assert.equal(layers.pledgedPct >= 100, true);
});

runTest('WF-RUN-11: Threshold activation (>= 100% or configured %) transitions to ACTIVE', () => {
  const orgId = memberActor.orgId || 'org-agro-prod-01';

  const { plan } = dataService.createRunwayPlan({
    orgId,
    name: 'Activation Threshold Plan',
    enforcement: 'STRICT',
    startDate: new Date().toISOString(),
    contingencyMode: 'PERCENT',
    contingencyPercent: 0,
    targetBasis: 'GROSS',
    activationThresholdPct: 100,
    actor: adminActor,
  });

  dataService.upsertRunwayLine({
    planId: plan.id,
    line: {
      title: 'Threshold Item',
      category: 'FEED',
      kind: 'COST',
      qty: 1,
      unitCost: 500,
      priority: 'ESSENTIAL',
    },
    actor: adminActor,
  });

  dataService.lockRunwayPlan({ planId: plan.id, actor: adminActor });

  dataService.pledgeToRunwayPlan({
    planId: plan.id,
    memberId: memberActor.id,
    amount: 500,
    actor: memberActor,
  });

  // Paying $400 out of $500 (80% funded) - attempting activation must fail under 100% threshold
  dataService.logCapitalContribution({
    memberId: memberActor.id,
    direction: 'ADDITION',
    amount: 400,
    note: '80% payment',
    runwayPlanId: plan.id,
    actor: treasurerActor,
  });

  assert.throws(
    () => {
      dataService.activateRunwayPlan({ planId: plan.id, actor: adminActor });
    },
    (err: any) => {
      assert.ok(err instanceof RunwayError);
      assert.equal(err.code, 'RUNWAY_THRESHOLD_NOT_MET');
      return true;
    }
  );

  // Pay remaining $100 -> 100% funded
  dataService.logCapitalContribution({
    memberId: memberActor.id,
    direction: 'ADDITION',
    amount: 100,
    note: 'Final $100 pay-in',
    runwayPlanId: plan.id,
    actor: treasurerActor,
  });

  const activatedPlan = dataService.activateRunwayPlan({ planId: plan.id, actor: adminActor });
  assert.equal(activatedPlan.status, 'ACTIVE');
  assert.ok(activatedPlan.activatedAt);
});

runTest('WF-RUN-12: Spend Gate: MUST_HAVE step execution with exact match', () => {
  const orgId = adminActor.orgId || 'org-agro-prod-01';
  const loc = testLoc;

  // Deactivate any prior active plan in this org so this plan can activate cleanly
  const state = dataService.getState();
  for (const p of state.runwayPlans || []) {
    if (p.orgId === orgId && p.status === 'ACTIVE') {
      p.status = 'COMPLETED';
    }
  }
  dataService.saveLocalState(state);

  const { plan } = dataService.createRunwayPlan({
    orgId,
    name: 'Step Execution Test Plan',
    enforcement: 'STRICT',
    startDate: new Date().toISOString(),
    contingencyMode: 'PERCENT',
    contingencyPercent: 0,
    targetBasis: 'GROSS',
    activationThresholdPct: 100,
    actor: adminActor,
  });

  const line = dataService.upsertRunwayLine({
    planId: plan.id,
    line: {
      title: 'Commercial Brooder Heaters',
      category: 'FEED',
      kind: 'COST',
      qty: 1,
      unitCost: 150,
      priority: 'ESSENTIAL',
    },
    actor: adminActor,
  });

  dataService.lockRunwayPlan({ planId: plan.id, actor: adminActor });
  dataService.pledgeToRunwayPlan({ planId: plan.id, memberId: adminActor.id, amount: 150, actor: adminActor });
  dataService.logCapitalContribution({
    memberId: adminActor.id,
    direction: 'ADDITION',
    amount: 150,
    note: 'Full pay-in',
    runwayPlanId: plan.id,
    actor: treasurerActor,
  });
  dataService.activateRunwayPlan({ planId: plan.id, actor: adminActor });

  // Log expense allocated to this exact line
  const exp = dataService.logExpense({
    locationId: loc.id,
    category: 'FEED',
    direction: 'DEDUCTION',
    amount: 150,
    note: 'Purchased 1 commercial brooder heater',
    actor: adminActor,
    runwayAllocation: {
      mode: 'LINE',
      lineId: line.id,
    },
  });

  assert.equal(exp.runwayPlanId, plan.id);
  assert.equal(exp.runwayLineId, line.id);

  // Check derived line status is PAID
  const updatedLines = (dataService.getState().runwayLines || []).filter((l) => l.planId === plan.id);
  const updatedExpenses = (dataService.getState().expenses || []).filter((e) => e.runwayPlanId === plan.id);
  const statuses = deriveLineStatuses(updatedLines, updatedExpenses);
  const lineStatus = statuses.get(line.id);
  assert.equal(lineStatus?.status, 'PAID');
});

runTest('WF-RUN-13: Spend Gate: Strict enforcement rejects unallocated spend when active plan exists', () => {
  const orgId = adminActor.orgId || 'org-agro-prod-01';
  const loc = testLoc;

  // Spending WITHOUT runwayAllocation under STRICT enforcement must throw RUNWAY_ALLOCATION_REQUIRED
  assert.throws(
    () => {
      dataService.logExpense({
        locationId: loc.id,
        category: 'FEED',
        direction: 'DEDUCTION',
        amount: 50,
        note: 'Unallocated spending attempt',
        actor: adminActor,
      });
    },
    (err: any) => {
      assert.ok(err instanceof RunwayError);
      assert.equal(err.code, 'RUNWAY_ALLOCATION_REQUIRED');
      return true;
    }
  );
});

runTest('WF-RUN-14: Spend Gate: Advisory enforcement warns on unallocated spend', () => {
  const orgId = adminActor.orgId || 'org-agro-prod-01';
  const loc = testLoc;

  // Change active plan to ADVISORY
  const state = dataService.getState();
  const activePlan = (state.runwayPlans || []).find((p) => p.orgId === orgId && p.status === 'ACTIVE');
  if (activePlan) {
    activePlan.enforcement = 'ADVISORY';
    dataService.saveLocalState(state);
  }

  // Spending without allocation under ADVISORY enforcement succeeds and emits warning audit
  const exp = dataService.logExpense({
    locationId: loc.id,
    category: 'FEED',
    direction: 'DEDUCTION',
    amount: 10,
    note: 'Spontaneous supplies purchase',
    actor: adminActor,
  });

  assert.ok(exp);
  assert.equal(exp.amount, 10);

  // Check audit notifications for off-plan warning
  const audits = dataService.getState().auditNotifications;
  const warnAudit = audits.find((a) => a.eventType === 'RUNWAY_OFF_PLAN_WARNING');
  assert.ok(warnAudit);
});

runTest('WF-RUN-15: Spend Gate: Contingency reserve draw requires reason + tracks remaining reserve', () => {
  const orgId = adminActor.orgId || 'org-agro-prod-01';
  const loc = testLoc;

  // Deactivate prior active plans
  const state = dataService.getState();
  for (const p of state.runwayPlans || []) {
    if (p.orgId === orgId && p.status === 'ACTIVE') {
      p.status = 'COMPLETED';
    }
  }
  dataService.saveLocalState(state);

  const { plan } = dataService.createRunwayPlan({
    orgId,
    name: 'Contingency Draw Plan',
    enforcement: 'STRICT',
    startDate: new Date().toISOString(),
    contingencyMode: 'FIXED',
    contingencyFixedAmount: 200,
    targetBasis: 'GROSS',
    activationThresholdPct: 100,
    actor: adminActor,
  });

  dataService.upsertRunwayLine({
    planId: plan.id,
    line: {
      title: 'Base line',
      category: 'FEED',
      kind: 'COST',
      qty: 1,
      unitCost: 300,
      priority: 'ESSENTIAL',
    },
    actor: adminActor,
  });

  dataService.lockRunwayPlan({ planId: plan.id, actor: adminActor });
  dataService.pledgeToRunwayPlan({ planId: plan.id, memberId: adminActor.id, amount: 500, actor: adminActor });
  dataService.logCapitalContribution({
    memberId: adminActor.id,
    direction: 'ADDITION',
    amount: 500,
    note: 'Full plan funding',
    runwayPlanId: plan.id,
    actor: treasurerActor,
  });
  dataService.activateRunwayPlan({ planId: plan.id, actor: adminActor });

  // Draw without mandatory reason must fail
  assert.throws(
    () => {
      dataService.logExpense({
        locationId: loc.id,
        category: 'FEED',
        direction: 'DEDUCTION',
        amount: 50,
        note: 'Emergency draw',
        actor: adminActor,
        runwayAllocation: {
          mode: 'CONTINGENCY',
          reason: '  ',
        },
      });
    },
    (err: any) => {
      assert.ok(err instanceof RunwayError);
      assert.equal(err.code, 'RUNWAY_REASON_REQUIRED');
      return true;
    }
  );

  // Draw with reason succeeds
  const exp = dataService.logExpense({
    locationId: loc.id,
    category: 'FEED',
    direction: 'DEDUCTION',
    amount: 80,
    note: 'Emergency veterinary medicines following unexpected temperature drop',
    actor: adminActor,
    runwayAllocation: {
      mode: 'CONTINGENCY',
      reason: 'Sudden cold snap required immediate heating fuel & electrolyte boosters',
    },
  });

  assert.equal(exp.runwayReserveDraw, 80);
  assert.equal(exp.runwayPlanId, plan.id);

  // Attempting to draw more than remaining reserve ($200 - $80 = $120) fails
  assert.throws(
    () => {
      dataService.logExpense({
        locationId: loc.id,
        category: 'FEED',
        direction: 'DEDUCTION',
        amount: 150,
        note: 'Excess draw',
        actor: adminActor,
        runwayAllocation: {
          mode: 'CONTINGENCY',
          reason: 'Excessive repair cost',
        },
      });
    },
    (err: any) => {
      assert.ok(err instanceof RunwayError);
      assert.equal(err.code, 'RUNWAY_RESERVE_EXHAUSTED');
      return true;
    }
  );
});

runTest('WF-RUN-16: Plan amendment: propose line change/addition -> admin/treasurer approval', () => {
  const orgId = adminActor.orgId || 'org-agro-prod-01';

  // Deactivate prior active plans
  const state = dataService.getState();
  for (const p of state.runwayPlans || []) {
    if (p.orgId === orgId && p.status === 'ACTIVE') {
      p.status = 'COMPLETED';
    }
  }
  dataService.saveLocalState(state);

  const { plan } = dataService.createRunwayPlan({
    orgId,
    name: 'Amendment Workflow Plan',
    enforcement: 'STRICT',
    startDate: new Date().toISOString(),
    contingencyMode: 'PERCENT',
    contingencyPercent: 0,
    targetBasis: 'GROSS',
    activationThresholdPct: 100,
    actor: adminActor,
  });

  dataService.upsertRunwayLine({
    planId: plan.id,
    line: {
      title: 'Original line',
      category: 'FEED',
      kind: 'COST',
      qty: 1,
      unitCost: 100,
      priority: 'ESSENTIAL',
    },
    actor: adminActor,
  });
  dataService.lockRunwayPlan({ planId: plan.id, actor: adminActor });
  dataService.pledgeToRunwayPlan({ planId: plan.id, memberId: adminActor.id, amount: 100, actor: adminActor });
  dataService.logCapitalContribution({
    memberId: adminActor.id,
    direction: 'ADDITION',
    amount: 100,
    note: 'Fund amendment plan',
    runwayPlanId: plan.id,
    actor: treasurerActor,
  });
  dataService.activateRunwayPlan({ planId: plan.id, actor: adminActor });

  // Propose an amendment to add a new line
  const proposedLine = dataService.proposeRunwayAmendment({
    planId: plan.id,
    title: 'Additional Disinfectant Chemical',
    category: 'FEED',
    qty: 2,
    unitCost: 45,
    priority: 'IMPORTANT',
    note: 'Biosecurity requirement after local outbreak notice',
    actor: operatorActor,
  });

  assert.equal(proposedLine.approval, 'PROPOSED');
  assert.equal(proposedLine.origin, 'AMENDMENT');
  assert.equal(proposedLine.proposedByMemberId, operatorActor.id);

  // Non-privileged member cannot approve amendment
  assert.throws(
    () => {
      dataService.resolveRunwayAmendment({
        lineId: proposedLine.id,
        decision: 'APPROVE',
        actor: memberActor,
      });
    },
    (err: any) => {
      assert.match(err.message, /Access Denied: Only Organization Admins and Treasurers can approve/i);
      return true;
    }
  );

  // Treasurer approves amendment
  const approvedLine = dataService.resolveRunwayAmendment({
    lineId: proposedLine.id,
    decision: 'APPROVE',
    actor: treasurerActor,
  });

  assert.equal(approvedLine.approval, 'APPROVED');
  assert.equal(approvedLine.approvedByMemberId, treasurerActor.id);
});

runTest('WF-RUN-17: Cash exhaustion / left money gate blocks outflow even if step has budget', () => {
  const orgId = adminActor.orgId || 'org-agro-prod-01';
  const loc = testLoc;

  // Deactivate prior active plans
  const state = dataService.getState();
  for (const p of state.runwayPlans || []) {
    if (p.orgId === orgId && p.status === 'ACTIVE') {
      p.status = 'COMPLETED';
    }
  }
  dataService.saveLocalState(state);

  const { plan } = dataService.createRunwayPlan({
    orgId,
    name: 'Zero Cash Gate Plan',
    enforcement: 'STRICT',
    startDate: new Date().toISOString(),
    contingencyMode: 'PERCENT',
    contingencyPercent: 0,
    targetBasis: 'GROSS',
    activationThresholdPct: 100,
    actor: adminActor,
  });

  const line = dataService.upsertRunwayLine({
    planId: plan.id,
    line: {
      title: 'Expensive Generator',
      category: 'FEED',
      kind: 'COST',
      qty: 1,
      unitCost: 100000,
      priority: 'ESSENTIAL',
    },
    actor: adminActor,
  });

  dataService.lockRunwayPlan({ planId: plan.id, actor: adminActor });
  dataService.pledgeToRunwayPlan({ planId: plan.id, memberId: adminActor.id, amount: 100000, actor: adminActor });
  dataService.logCapitalContribution({
    memberId: adminActor.id,
    direction: 'ADDITION',
    amount: 100000,
    note: 'Initial deposit',
    runwayPlanId: plan.id,
    actor: treasurerActor,
  });
  dataService.activateRunwayPlan({ planId: plan.id, actor: adminActor });

  // Attempting to spend more than org's left money must fail
  const leftMoney = dataService.getCurrentOrgLeftMoney(orgId);
  assert.throws(
    () => {
      dataService.logExpense({
        locationId: loc.id,
        category: 'FEED',
        direction: 'DEDUCTION',
        amount: leftMoney + 500,
        note: 'Attempting to spend non-existent bank cash',
        actor: adminActor,
        runwayAllocation: {
          mode: 'LINE',
          lineId: line.id,
        },
      });
    },
    (err: any) => {
      assert.match(err.message, /Insufficient (liquid funds in Left Money|money on the ground)/i);
      return true;
    }
  );
});

runTest('WF-RUN-18: Multi-sig pending expense reserve lock (prevents double spending)', () => {
  const mockExpenses = [
    { id: 'EXP-1', amount: 100, approvalStatus: 'APPROVED', direction: 'DEDUCTION' },
    { id: 'EXP-2', amount: 250, approvalStatus: 'PENDING_MULTISIG', direction: 'DEDUCTION' },
  ] as any;

  // Available cash must subtract pending multi-sig (400 - 250 = 150)
  const available = computeAvailableCash(400, mockExpenses);
  assert.equal(available, 150);
});

runTest('WF-RUN-19: Milestone detection & audit broadcast (25%, 50%, 100%, Break-even)', () => {
  const plan = {
    id: 'PLN-MS-01',
    milestonesReached: {},
  } as any;

  const layersQuarter = {
    pledgedPct: 30,
    collectedPct: 26,
  } as any;

  const msQuarter = detectMilestones(layersQuarter, plan, false);
  assert.ok(msQuarter.includes('COLLECTED_25'));

  // Mark quarter collected and test half collected
  plan.milestonesReached['COLLECTED_25'] = new Date().toISOString();
  const layersHalf = {
    pledgedPct: 60,
    collectedPct: 52,
  } as any;

  const msHalf = detectMilestones(layersHalf, plan, false);
  assert.ok(msHalf.includes('COLLECTED_50'));
  assert.equal(msHalf.includes('COLLECTED_25'), false); // Already reached, ignored
});

runTest('WF-RUN-20: Break-even recovery tracking via livestock sales + credit sales', () => {
  const executedSpend = 2000;
  const cashSales = 1200;
  const creditReceipts = 900;

  // Total receipts = 1200 + 900 = 2100. Executed = 2000.
  const recovery = computeRecovery(executedSpend, cashSales, creditReceipts);
  assert.equal(recovery.recoveredAmount, 2100);
  assert.equal(recovery.recoveredPct, 105);
  assert.equal(recovery.isBreakEven, true);
});

runTest('WF-RUN-21: Multi-tenant boundary: Org A cannot read or modify Org B plans', () => {
  const { plan: orgAPlan } = dataService.createRunwayPlan({
    orgId: adminActor.orgId!,
    name: 'Org A Secret Plan',
    enforcement: 'STRICT',
    startDate: new Date().toISOString(),
    contingencyMode: 'PERCENT',
    contingencyPercent: 0,
    targetBasis: 'GROSS',
    activationThresholdPct: 100,
    actor: adminActor,
  });

  // Org B admin attempting to upsert a line on Org A's plan must fail
  assert.throws(
    () => {
      dataService.upsertRunwayLine({
        planId: orgAPlan.id,
        line: {
          title: 'Org B Intruder Line',
          category: 'FEED',
          kind: 'COST',
          qty: 1,
          unitCost: 100,
          priority: 'ESSENTIAL',
        },
        actor: ventureAdminActor,
      });
    },
    (err: any) => {
      assert.match(err.message, /Tenant Boundary Violation: Actor cannot modify another organization/i);
      return true;
    }
  );
});

runTest('WF-RUN-22: Plan closure (COMPLETED / CANCELLED) releases Spend Gate', () => {
  const orgId = adminActor.orgId || 'org-agro-prod-01';

  // Deactivate prior active plans
  const state = dataService.getState();
  for (const p of state.runwayPlans || []) {
    if (p.orgId === orgId && p.status === 'ACTIVE') {
      p.status = 'COMPLETED';
    }
  }
  dataService.saveLocalState(state);

  const { plan } = dataService.createRunwayPlan({
    orgId,
    name: 'Plan Closure Release Test',
    enforcement: 'STRICT',
    startDate: new Date().toISOString(),
    contingencyMode: 'PERCENT',
    contingencyPercent: 0,
    targetBasis: 'GROSS',
    activationThresholdPct: 100,
    actor: adminActor,
  });

  dataService.upsertRunwayLine({
    planId: plan.id,
    line: {
      title: 'Closure item',
      category: 'FEED',
      kind: 'COST',
      qty: 1,
      unitCost: 50,
      priority: 'ESSENTIAL',
    },
    actor: adminActor,
  });

  dataService.lockRunwayPlan({ planId: plan.id, actor: adminActor });
  dataService.pledgeToRunwayPlan({ planId: plan.id, memberId: adminActor.id, amount: 50, actor: adminActor });
  dataService.logCapitalContribution({
    memberId: adminActor.id,
    direction: 'ADDITION',
    amount: 50,
    note: 'Fund plan',
    runwayPlanId: plan.id,
    actor: treasurerActor,
  });
  dataService.activateRunwayPlan({ planId: plan.id, actor: adminActor });

  // Close plan
  dataService.closeRunwayPlan({ planId: plan.id, actor: adminActor });
  const closed = (dataService.getState().runwayPlans || []).find((p) => p.id === plan.id);
  assert.equal(closed?.status, 'COMPLETED');

  // Spend Gate must now allow unallocated spend without throwing
  const compliance = dataService.assertRunwayCompliance({
    orgId,
    amount: 25,
    actor: adminActor,
  });
  assert.deepEqual(compliance, {});
});

runTest('WF-RUN-23: SHA-256 cryptographic chain integrity across all runway operations', () => {
  const state = dataService.getState();
  const audits = state.auditNotifications || [];
  assert.ok(audits.length > 0);

  // Verify full blockchain-style audit hash integrity
  const isChainValid = verifyAuditChainIntegrity(audits);
  if (!isChainValid.valid) {
    console.error('Audit chain broken detail:', isChainValid.brokenReason);
    const sorted = [...audits].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i];
      console.log(`[#${a.sequenceNumber}] ${a.id} ${a.eventType} prev=${a.previousHash.slice(0, 10)} curr=${a.currentHash.slice(0, 10)}`);
    }
  }
  assert.equal(isChainValid.valid, true, isChainValid.brokenReason);
});

runTest('WF-RUN-24: Persistence regression (G1): sanitizeSnapshot preserves runway arrays', () => {
  const state = dataService.getState();
  assert.ok(Array.isArray(state.runwayPlans), 'runwayPlans must be preserved in state');
  assert.ok(Array.isArray(state.runwayLines), 'runwayLines must be preserved in state');
  assert.ok(Array.isArray(state.runwayPledges), 'runwayPledges must be preserved in state');
  assert.ok(Array.isArray(state.runwayClaims), 'runwayClaims must be preserved in state');
  assert.ok(Array.isArray(state.runwayTemplates), 'runwayTemplates must be preserved in state');
});

test.after(() => {
  if (failedCount > 0) {
    console.error(`\n❌ Total Failed: ${failedCount}`);
    setTimeout(() => process.exit(1), 200);
  } else {
    setTimeout(() => process.exit(0), 200);
  }
});

