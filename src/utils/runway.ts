import type {
  ExpenseLedgerEvent,
  CapitalContributionEvent,
  DebtLiabilityEvent,
  OrgMember,
  MemberEquitySummary,
} from '../types/agro.ts';
import type {
  RunwayPlan,
  RunwayLine,
  RunwayPledge,
  RunwayAllocation,
  RunwayMilestoneKey,
  RunwayLineStatus,
} from '../types/runway.ts';
import { RunwayError } from '../types/runway.ts';

export function round2(num: number): number {
  if (isNaN(num) || !isFinite(num)) return 0;
  return Number((Math.round((num + Number.EPSILON) * 100) / 100).toFixed(2));
}

export interface RunwayPlanTotals {
  costTotal: number;
  contingencyReserve: number;
  totalRequirement: number;
  expectedIncome: number;
  reserveAmount?: number;
  reserveDrawn?: number;
}

export function computeLineCost(line: RunwayLine): number {
  const occurrences = line.recurrence?.occurrences && line.recurrence.occurrences > 0
    ? line.recurrence.occurrences
    : 1;
  return round2(line.qty * line.unitCost * occurrences);
}

export function computePlanTotals(
  plan: Pick<RunwayPlan, 'contingencyMode' | 'contingencyPercent' | 'contingencyFixedAmount'>,
  lines: RunwayLine[],
  livestockExpectedRevenue: number = 0
): RunwayPlanTotals {
  let costTotal = 0;
  let eligibleForContingency = 0;
  let expectedIncome = 0;

  for (const line of lines) {
    if (line.skipped || line.approval === 'REJECTED') continue;

    const lineCost = computeLineCost(line);

    if (line.kind === 'INCOME') {
      const confidence = line.confidencePct != null ? line.confidencePct / 100 : 1;
      const expected = round2(lineCost * confidence);
      expectedIncome = round2(expectedIncome + expected);
    } else {
      costTotal = round2(costTotal + lineCost);
      if (!line.excludeFromContingency) {
        eligibleForContingency = round2(eligibleForContingency + lineCost);
      }
    }
  }

  if (livestockExpectedRevenue > 0) {
    expectedIncome = round2(expectedIncome + livestockExpectedRevenue);
  }

  let contingencyReserve = 0;
  if (plan.contingencyMode === 'FIXED') {
    contingencyReserve = round2(plan.contingencyFixedAmount ?? 0);
  } else {
    const pct = (plan.contingencyPercent ?? 0) / 100;
    contingencyReserve = round2(eligibleForContingency * pct);
  }

  const totalRequirement = round2(costTotal + contingencyReserve);

  return {
    costTotal,
    contingencyReserve,
    totalRequirement,
    expectedIncome,
    reserveAmount: contingencyReserve,
    reserveDrawn: 0,
  };
}

export interface CashTimelineEvent {
  date: string;
  type: 'OUTFLOW' | 'INFLOW';
  title: string;
  amount: number; // positive number
  netChange: number; // negative for outflow, positive for inflow
  runningBalance: number;
  isRecurring?: boolean;
}

export interface CashTimelineResult {
  events: CashTimelineEvent[];
  peakNeed: number;
  operatingBreakEvenMonth: number | null;
  paybackDate: string | null;
  shortfall: number;
  monthlyCashflow?: any[];
  lowestBalance?: number;
  finalBalance?: number;
  breakEvenMonth?: number | null;
}

export function buildCashTimeline(
  plan: Pick<RunwayPlan, 'startDate' | 'stress'>,
  lines: RunwayLine[],
  openingCash: number = 0,
  stressOverride?: {
    costIncreasePct?: number;
    incomeDelayMonths?: number;
    incomeHaircutPct?: number;
  }
): CashTimelineResult {
  const stress = stressOverride || plan.stress || {
    costIncreasePct: 0,
    incomeDelayMonths: 0,
    incomeHaircutPct: 0,
  };

  const rawEvents: Array<{
    date: string;
    type: 'OUTFLOW' | 'INFLOW';
    title: string;
    amount: number;
    isRecurring?: boolean;
  }> = [];

  const baseDate = plan.startDate ? new Date(plan.startDate) : new Date();

  for (const line of lines) {
    if (line.skipped || line.approval === 'REJECTED') continue;

    const occurrences = line.recurrence?.occurrences && line.recurrence.occurrences > 0
      ? line.recurrence.occurrences
      : 1;
    const everyDays = line.recurrence?.everyDays || 30;
    const lineStartDate = line.plannedDate ? new Date(line.plannedDate) : new Date(baseDate);

    if (line.kind === 'COST') {
      const costMultiplier = 1 + (stress.costIncreasePct || 0) / 100;
      const unitAmount = round2(line.qty * line.unitCost * costMultiplier);

      for (let i = 0; i < occurrences; i++) {
        const evDate = new Date(lineStartDate);
        evDate.setDate(evDate.getDate() + i * everyDays);
        rawEvents.push({
          date: evDate.toISOString().slice(0, 10),
          type: 'OUTFLOW',
          title: occurrences > 1 ? `${line.title} (#${i + 1})` : line.title,
          amount: unitAmount,
          isRecurring: occurrences > 1,
        });
      }
    } else if (line.kind === 'INCOME') {
      const confidence = (line.confidencePct != null ? line.confidencePct : 100) / 100;
      const haircut = (stress.incomeHaircutPct || 0) / 100;
      const unitAmount = round2(line.qty * line.unitCost * confidence * (1 - haircut));

      const delayDays = (stress.incomeDelayMonths || 0) * 30;
      for (let i = 0; i < occurrences; i++) {
        const evDate = new Date(lineStartDate);
        evDate.setDate(evDate.getDate() + i * everyDays + delayDays);
        rawEvents.push({
          date: evDate.toISOString().slice(0, 10),
          type: 'INFLOW',
          title: occurrences > 1 ? `${line.title} (#${i + 1})` : line.title,
          amount: unitAmount,
          isRecurring: occurrences > 1,
        });
      }
    }
  }

  // Sort: earlier date first. On identical date, OUTFLOW applied before INFLOW.
  rawEvents.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.type !== b.type) return a.type === 'OUTFLOW' ? -1 : 1;
    return 0;
  });

  let runningBalance = round2(openingCash);
  let minBalance = runningBalance;
  let troughIndex = -1;
  const processedEvents: CashTimelineEvent[] = [];

  for (let i = 0; i < rawEvents.length; i++) {
    const ev = rawEvents[i];
    const netChange = ev.type === 'OUTFLOW' ? -ev.amount : ev.amount;
    runningBalance = round2(runningBalance + netChange);

    if (runningBalance < minBalance) {
      minBalance = runningBalance;
      troughIndex = i;
    }

    processedEvents.push({
      date: ev.date,
      type: ev.type,
      title: ev.title,
      amount: ev.amount,
      netChange,
      runningBalance,
      isRecurring: ev.isRecurring,
    });
  }

  const peakNeed = round2(Math.max(0, -minBalance));

  // Payback date: first date after the trough where runningBalance >= 0
  let paybackDate: string | null = null;
  if (troughIndex >= 0) {
    for (let i = troughIndex; i < processedEvents.length; i++) {
      if (processedEvents[i].runningBalance >= 0) {
        paybackDate = processedEvents[i].date;
        break;
      }
    }
  } else if (runningBalance >= 0 && processedEvents.length > 0) {
    paybackDate = processedEvents[0].date;
  }

  const shortfall = round2(Math.max(0, -runningBalance));

  // Operating break-even month: group by 30-day windows from start date; first month >= 1 where inflow >= outflow
  let operatingBreakEvenMonth: number | null = null;
  const monthMap: Record<number, { inflow: number; outflow: number }> = {};

  for (const ev of processedEvents) {
    const evTime = new Date(ev.date).getTime();
    const diffDays = Math.max(0, Math.floor((evTime - baseDate.getTime()) / (1000 * 60 * 60 * 24)));
    const month = diffDays === 0 ? 0 : Math.floor((diffDays - 1) / 30) + 1;

    if (!monthMap[month]) monthMap[month] = { inflow: 0, outflow: 0 };
    if (ev.type === 'OUTFLOW') {
      monthMap[month].outflow = round2(monthMap[month].outflow + ev.amount);
    } else {
      monthMap[month].inflow = round2(monthMap[month].inflow + ev.amount);
    }
  }

  const months = Object.keys(monthMap)
    .map(Number)
    .sort((a, b) => a - b);
  for (const m of months) {
    if (m >= 1) {
      const data = monthMap[m];
      if (data.inflow > 0 && data.inflow >= data.outflow) {
        operatingBreakEvenMonth = m;
        break;
      }
    }
  }

  return {
    events: processedEvents,
    peakNeed,
    operatingBreakEvenMonth,
    paybackDate,
    shortfall,
  };
}

export interface RunwayFundingLayers {
  pledged: number;
  pledgedUnpaid: number;
  collected: number;
  executed: number;
  gap: number;
  memberTarget: number;
  totalRequirement: number;
  target: number;
  peakNeed: number;
  pledgedPct: number;
  collectedPct: number;
  executedPct: number;
  reserveUsed: number;
  reserveLeft: number;
  remainingCommitted: number;
  openingCash: number;
  plannedFinancing: number;
  isFullyFunded: boolean;
  isFullyPledged: boolean;
}

export function computeFundingLayers(
  plan: RunwayPlan,
  lines: RunwayLine[],
  pledges: RunwayPledge[],
  contributions: CapitalContributionEvent[],
  expenses: ExpenseLedgerEvent[],
  debts: DebtLiabilityEvent[] = []
): RunwayFundingLayers {
  const totals = computePlanTotals(plan, lines);
  const openingCash = round2(plan.openingCashAdopted || 0);

  // Planned financing F
  const plannedFinancingTotal = round2(
    (plan.plannedFinancing || []).reduce((acc, f) => acc + (f.amount || 0), 0)
  );

  let targetT = totals.totalRequirement;
  let peakNeed = 0;
  if (plan.targetBasis === 'PEAK_NEED') {
    const timeline = buildCashTimeline(plan, lines, openingCash);
    peakNeed = timeline.peakNeed;
    targetT = round2(peakNeed + totals.contingencyReserve);
  }

  const memberTarget = round2(Math.max(0, targetT - openingCash - plannedFinancingTotal));

  // Pledged: sum of active pledge amounts for this plan (ignore consolidated/withdrawn tombstones)
  const pledged = round2(
    pledges
      .filter((p) => p.planId === plan.id && p.status !== 'MERGED' && p.status !== 'WITHDRAWN')
      .reduce((acc, p) => acc + (p.amount || 0), 0)
  );

  // Collected: openingCash + contributions tagged with plan + received debt principal tagged with plan
  let planContributions = 0;
  for (const c of contributions) {
    if (c.runwayPlanId === plan.id) {
      if (c.direction === 'CONTRA_REVERSAL') {
        planContributions = round2(planContributions - Math.abs(c.amount));
      } else {
        planContributions = round2(planContributions + c.amount);
      }
    }
  }

  let planLoansReceived = 0;
  for (const d of debts) {
    if (d.runwayPlanId === plan.id) {
      planLoansReceived = round2(planLoansReceived + d.principalAmount);
    }
  }

  const collected = round2(openingCash + planContributions + planLoansReceived);

  // Executed: sum of approved expenses tagged with plan (net of contra)
  let executed = 0;
  let reserveUsed = 0;

  for (const e of expenses) {
    if (e.runwayPlanId === plan.id && e.approvalStatus === 'APPROVED') {
      const isContra = e.direction === 'CONTRA_REVERSAL';
      const absAmount = Math.abs(e.amount);

      if (isContra) {
        executed = round2(executed - absAmount);
        if (e.runwayReserveDraw) {
          reserveUsed = round2(reserveUsed - Math.abs(e.runwayReserveDraw));
        }
      } else {
        executed = round2(executed + absAmount);
        if (e.runwayReserveDraw) {
          reserveUsed = round2(reserveUsed + Math.abs(e.runwayReserveDraw));
        }
      }
    }
  }

  reserveUsed = Math.max(0, reserveUsed);
  const reserveLeft = round2(Math.max(0, totals.contingencyReserve - reserveUsed));
  const gap = round2(Math.max(0, memberTarget - pledged));

  const pledgedPct = memberTarget > 0 ? Number(((pledged / memberTarget) * 100).toFixed(1)) : 100;
  const collectedPct = memberTarget > 0 ? Number(((collected / memberTarget) * 100).toFixed(1)) : 100;
  const executedPct = totals.totalRequirement > 0 ? Number(((executed / totals.totalRequirement) * 100).toFixed(1)) : 0;
  const pledgedUnpaid = round2(Math.max(0, pledged - collected));
  const remainingCommitted = round2(Math.max(0, totals.totalRequirement - executed));
  const isFullyPledged = memberTarget > 0 ? pledged >= memberTarget : true;
  const isFullyFunded = memberTarget > 0 ? collected >= memberTarget : true;

  return {
    pledged,
    pledgedUnpaid,
    collected,
    executed: Math.max(0, executed),
    gap,
    memberTarget,
    totalRequirement: totals.totalRequirement,
    target: targetT,
    peakNeed,
    pledgedPct,
    collectedPct,
    executedPct,
    reserveUsed,
    reserveLeft,
    remainingCommitted,
    openingCash,
    plannedFinancing: plannedFinancingTotal,
    isFullyFunded,
    isFullyPledged,
  };
}

export interface DerivedLineInfo {
  line: RunwayLine;
  cost: number;
  plannedTotal?: number; // alias for cost
  spent: number;
  pending: number;
  remaining: number;
  status: RunwayLineStatus;
}

export function deriveLineStatuses(
  lines: RunwayLine[],
  expenses: ExpenseLedgerEvent[],
  debts: DebtLiabilityEvent[] = []
): Map<string, DerivedLineInfo> {
  const result = new Map<string, DerivedLineInfo>();

  for (const line of lines) {
    const cost = computeLineCost(line);

    if (line.skipped) {
      result.set(line.id, {
        line,
        cost,
        plannedTotal: cost,
        spent: 0,
        pending: 0,
        remaining: 0,
        status: 'SKIPPED',
      });
      continue;
    }

    // Check linked debt status (supplier-credit commitment)
    let isCommitted = false;
    let debtSettled = false;
    if (line.linkedDebtId) {
      const linked = debts.find((d) => d.id === line.linkedDebtId);
      if (linked) {
        if (linked.status === 'SETTLED' || linked.remainingBalance <= 0) {
          debtSettled = true;
        } else {
          isCommitted = true;
        }
      }
    }

    let spent = 0;
    let pending = 0;

    for (const exp of expenses) {
      if (exp.runwayLineId === line.id) {
        const linePortion = Math.abs(exp.amount);

        if (exp.approvalStatus === 'APPROVED') {
          if (exp.direction === 'CONTRA_REVERSAL') {
            spent = round2(spent - linePortion);
          } else {
            spent = round2(spent + linePortion);
          }
        } else if (exp.approvalStatus === 'PENDING_MULTISIG' && exp.direction !== 'CONTRA_REVERSAL') {
          pending = round2(pending + linePortion);
        }
      }
    }

    spent = Math.max(0, spent);
    const remaining = round2(Math.max(0, cost - spent - pending));

    let status: RunwayLineStatus = 'PLANNED';
    if (debtSettled || spent >= cost) {
      status = 'PAID';
    } else if (isCommitted) {
      status = 'COMMITTED';
    } else if (spent > 0) {
      status = 'PARTIAL';
    }

    result.set(line.id, {
      line,
      cost,
      plannedTotal: cost,
      spent,
      pending,
      remaining,
      status,
    });
  }

  return result;
}

export function computeAvailableCash(leftMoney: number, expenses: ExpenseLedgerEvent[]): number {
  const pendingMultiSigTotal = round2(
    expenses
      .filter((e) => e.approvalStatus === 'PENDING_MULTISIG' && e.direction !== 'CONTRA_REVERSAL')
      .reduce((acc, e) => acc + Math.abs(e.amount), 0)
  );
  return round2(Math.max(0, leftMoney - pendingMultiSigTotal));
}

export interface SpendEvaluationResult {
  allowed: boolean;
  advisoryWarning?: string;
  tags: {
    runwayPlanId?: string;
    runwayLineId?: string;
    runwayReserveDraw?: number;
    runwayAllocationNote?: string;
  };
}

export function evaluateSpend(params: {
  plan?: RunwayPlan;
  lines: RunwayLine[];
  expenses: ExpenseLedgerEvent[];
  allocation?: RunwayAllocation;
  amount: number;
  availableCash: number;
  actorRole?: string;
  debts?: DebtLiabilityEvent[];
}): SpendEvaluationResult {
  const { plan, lines, expenses, allocation, amount, availableCash, debts = [] } = params;

  // Condition 1: If no plan or plan is not ACTIVE, gate is inactive
  if (!plan || plan.status !== 'ACTIVE') {
    return { allowed: true, tags: {} };
  }

  const isAdvisory = plan.enforcement === 'ADVISORY';

  // Condition 2: Allocation missing
  if (!allocation) {
    if (isAdvisory) {
      return {
        allowed: true,
        advisoryWarning: 'Spend was recorded without Runway allocation while plan is ACTIVE.',
        tags: {},
      };
    }
    throw new RunwayError(
      'RUNWAY_ALLOCATION_REQUIRED',
      'Runway Plan is ACTIVE under STRICT enforcement. You must allocate this spend to a plan line, contingency reserve, or amendment.'
    );
  }

  const derived = deriveLineStatuses(lines, expenses, debts);
  const layers = computeFundingLayers(plan, lines, [], [], expenses, debts);
  const reserveLeft = layers.reserveLeft;

  if (allocation.mode === 'LINE') {
    const lineInfo = derived.get(allocation.lineId);
    if (!lineInfo || lineInfo.line.planId !== plan.id || lineInfo.line.skipped) {
      throw new RunwayError('RUNWAY_LINE_INVALID', 'The selected plan line does not exist or has been skipped.');
    }

    // Condition 4: Phase locked
    if (lineInfo.line.phaseId && plan.phases && plan.phases.length > 0) {
      const phase = plan.phases.find((p) => p.id === lineInfo.line.phaseId);
      if (phase && phase.releaseAfterPhaseId && !phase.released) {
        throw new RunwayError(
          'RUNWAY_PHASE_NOT_RELEASED',
          `Step belongs to phase "${phase.name}" which has not been released yet.`
        );
      }
    }

    // Condition 5: Ground cash check
    if (amount > availableCash) {
      throw new RunwayError(
        'RUNWAY_INSUFFICIENT_GROUND_CASH',
        `Insufficient money on the ground ($${availableCash.toFixed(2)} available, $${amount.toFixed(2)} needed). Money counts only after it is paid in and logged.`
      );
    }

    // Condition 6: amount <= remaining_i
    if (amount <= lineInfo.remaining) {
      return {
        allowed: true,
        tags: {
          runwayPlanId: plan.id,
          runwayLineId: lineInfo.line.id,
        },
      };
    }

    // Condition 7: amount > remaining_i (overrun)
    const overrun = round2(amount - lineInfo.remaining);
    const drawReq = allocation.reserveDrawAmount != null ? allocation.reserveDrawAmount : 0;

    if (drawReq >= overrun) {
      if (drawReq > reserveLeft) {
        throw new RunwayError(
          'RUNWAY_RESERVE_EXHAUSTED',
          `Contingency reserve exhausted ($${reserveLeft.toFixed(2)} left, $${drawReq.toFixed(2)} requested for line overrun).`
        );
      }
      if (!allocation.reserveReason || allocation.reserveReason.trim().length < 4) {
        throw new RunwayError(
          'RUNWAY_REASON_REQUIRED',
          'A detailed reason (at least 4 characters) is required when drawing from contingency reserve for an overrun.'
        );
      }
      return {
        allowed: true,
        tags: {
          runwayPlanId: plan.id,
          runwayLineId: lineInfo.line.id,
          runwayReserveDraw: drawReq,
          runwayAllocationNote: allocation.reserveReason.trim(),
        },
      };
    }

    throw new RunwayError(
      'RUNWAY_LINE_OVERRUN',
      `Spend of $${amount.toFixed(2)} exceeds line budget of $${lineInfo.remaining.toFixed(2)} by $${overrun.toFixed(2)}. Allocate extra to contingency reserve or raise the line.`,
      { overrun, remaining: lineInfo.remaining }
    );
  }

  if (allocation.mode === 'CONTINGENCY') {
    // Condition 10: reason required
    if (!allocation.reason || allocation.reason.trim().length < 4) {
      throw new RunwayError(
        'RUNWAY_REASON_REQUIRED',
        'A detailed reason (at least 4 characters) is required when drawing from contingency reserve.'
      );
    }

    // Condition 8: reserve exhausted
    if (amount > reserveLeft) {
      throw new RunwayError(
        'RUNWAY_RESERVE_EXHAUSTED',
        `Contingency reserve exhausted ($${reserveLeft.toFixed(2)} left, $${amount.toFixed(2)} requested).`
      );
    }

    // Condition 5: ground cash check
    if (amount > availableCash) {
      throw new RunwayError(
        'RUNWAY_INSUFFICIENT_GROUND_CASH',
        `Insufficient money on the ground ($${availableCash.toFixed(2)} available, $${amount.toFixed(2)} needed).`
      );
    }

    return {
      allowed: true,
      tags: {
        runwayPlanId: plan.id,
        runwayReserveDraw: amount,
        runwayAllocationNote: allocation.reason.trim(),
      },
    };
  }

  if (allocation.mode === 'NEW_LINE') {
    // Condition 9: NEW_LINE requires approval
    throw new RunwayError(
      'RUNWAY_AMENDMENT_PENDING',
      `Unplanned spend "${allocation.title}" must be proposed as a plan amendment and approved before spending.`,
      { allocation }
    );
  }

  return { allowed: true, tags: {} };
}

export function suggestPledgeSplit(
  memberTarget: number,
  members: OrgMember[],
  method: 'EQUAL' | 'BY_TARGET' | 'BY_EQUITY' = 'EQUAL',
  memberEquities: MemberEquitySummary[] = []
): { memberId: string; amount: number }[] {
  if (members.length === 0 || memberTarget <= 0) return [];

  const eligibleMembers = members.filter((m) => m.active);
  if (eligibleMembers.length === 0) return [];

  const splits: { memberId: string; rawSplit: number }[] = [];

  if (method === 'BY_TARGET') {
    const totalTarget = eligibleMembers.reduce((acc, m) => acc + (m.targetContributionUsd || 0), 0);
    if (totalTarget > 0) {
      for (const m of eligibleMembers) {
        const weight = (m.targetContributionUsd || 0) / totalTarget;
        splits.push({ memberId: m.id, rawSplit: memberTarget * weight });
      }
    }
  } else if (method === 'BY_EQUITY') {
    const totalNet = memberEquities.reduce((acc, eq) => acc + Math.max(0, eq.netContribution), 0);
    if (totalNet > 0) {
      for (const m of eligibleMembers) {
        const eq = memberEquities.find((e) => e.member.id === m.id);
        const weight = Math.max(0, eq?.netContribution || 0) / totalNet;
        splits.push({ memberId: m.id, rawSplit: memberTarget * weight });
      }
    }
  }

  // Fallback to equal split if BY_TARGET or BY_EQUITY produced no valid split
  if (splits.length === 0) {
    const equalShare = memberTarget / eligibleMembers.length;
    for (const m of eligibleMembers) {
      splits.push({ memberId: m.id, rawSplit: equalShare });
    }
  }

  // Cent remainder distribution to sum exactly to memberTarget
  const targetCents = Math.round(memberTarget * 100);
  let assignedCents = 0;
  const resultWithCents = splits.map((s) => {
    const cents = Math.floor(s.rawSplit * 100);
    assignedCents += cents;
    return { memberId: s.memberId, cents, remainder: s.rawSplit * 100 - cents };
  });

  let shortfallCents = targetCents - assignedCents;
  // Sort by highest remainder first
  resultWithCents.sort((a, b) => b.remainder - a.remainder);

  for (let i = 0; i < resultWithCents.length && shortfallCents > 0; i++) {
    resultWithCents[i].cents += 1;
    shortfallCents -= 1;
  }

  return resultWithCents.map((r) => ({
    memberId: r.memberId,
    amount: round2(r.cents / 100),
  }));
}

export function detectMilestones(
  layers: RunwayFundingLayers,
  plan: RunwayPlan,
  isBreakEven: boolean = false
): RunwayMilestoneKey[] {
  const newMilestones: RunwayMilestoneKey[] = [];
  const reached = plan.milestonesReached || {};

  const check = (key: RunwayMilestoneKey, condition: boolean) => {
    if (condition && !reached[key]) {
      newMilestones.push(key);
    }
  };

  check('PLEDGED_25', layers.pledgedPct >= 25);
  check('PLEDGED_50', layers.pledgedPct >= 50);
  check('PLEDGED_75', layers.pledgedPct >= 75);
  check('PLEDGED_100', layers.pledgedPct >= 100);

  check('COLLECTED_25', layers.collectedPct >= 25);
  check('COLLECTED_50', layers.collectedPct >= 50);
  check('COLLECTED_75', layers.collectedPct >= 75);
  check('COLLECTED_100', layers.collectedPct >= 100);

  check('BREAK_EVEN', isBreakEven);

  return newMilestones;
}

export function computeRecovery(
  executedSpend: number,
  salesRevenue: number,
  creditSaleReceipts: number = 0
): {
  recoveredAmount: number;
  recoveredPct: number;
  isBreakEven: boolean;
  surplus: number;
  shortfall: number;
} {
  const recoveredAmount = round2(salesRevenue + creditSaleReceipts);
  const recoveredPct = executedSpend > 0 ? Number(((recoveredAmount / executedSpend) * 100).toFixed(1)) : 0;
  const isBreakEven = executedSpend > 0 && recoveredAmount >= executedSpend;
  const surplus = round2(Math.max(0, recoveredAmount - executedSpend));
  const shortfall = round2(Math.max(0, executedSpend - recoveredAmount));

  return {
    recoveredAmount,
    recoveredPct,
    isBreakEven,
    surplus,
    shortfall,
  };
}

export function computeRunwayMonths(
  availableCash: number,
  expenses: ExpenseLedgerEvent[],
  lookbackDays: number = 60
): number {
  if (availableCash <= 0) return 0;

  const now = Date.now();
  const msLookback = lookbackDays * 86_400_000;

  let totalOutflow = 0;
  for (const exp of expenses) {
    if (exp.approvalStatus !== 'APPROVED') continue;
    const expTime = new Date(exp.createdAt).getTime();
    if (now - expTime <= msLookback) {
      if (exp.direction === 'CONTRA_REVERSAL') {
        totalOutflow = round2(totalOutflow - Math.abs(exp.amount));
      } else {
        totalOutflow = round2(totalOutflow + Math.abs(exp.amount));
      }
    }
  }

  totalOutflow = Math.max(0, totalOutflow);
  const monthlyOutflow = totalOutflow / (lookbackDays / 30);
  if (monthlyOutflow <= 0) return Infinity;

  return round2(availableCash / monthlyOutflow);
}

export function findOffPlanSpend(
  plan: RunwayPlan,
  expenses: ExpenseLedgerEvent[]
): ExpenseLedgerEvent[] {
  if (plan.status !== 'ACTIVE' && plan.status !== 'COMPLETED') return [];

  const start = new Date(plan.activatedAt || plan.startDate).getTime();
  const end = plan.completedAt ? new Date(plan.completedAt).getTime() : Infinity;

  return expenses.filter((e) => {
    if (e.approvalStatus !== 'APPROVED') return false;
    if (e.direction === 'CONTRA_REVERSAL') return false;
    if (e.orgId && plan.orgId && e.orgId !== plan.orgId) return false;
    if (plan.locationId && plan.locationId !== 'ALL' && e.locationId && e.locationId !== plan.locationId) return false;
    const t = new Date(e.createdAt).getTime();
    return t >= start && t <= end && !e.runwayPlanId;
  });
}

export interface RunwayVarianceCategory {
  category: string;
  planned: number;
  actual: number;
  variance: number;
  variancePct: number;
  status: 'UNDER_BUDGET' | 'ON_TRACK' | 'OVER_BUDGET';
}

export interface RunwayVarianceReport {
  planId: string;
  planName: string;
  status: string;
  totalPlanned: number;
  totalSpent: number;
  varianceTotal: number;
  variancePct: number;
  contingencyBudget: number;
  contingencyUsed: number;
  contingencyLeft: number;
  offPlanExpenses: ExpenseLedgerEvent[];
  offPlanTotal: number;
  recoveredAmount: number;
  recoveredPct: number;
  isBreakEven: boolean;
  lineReports: {
    lineId: string;
    title: string;
    category: string;
    planned: number;
    spent: number;
    variance: number;
    status: RunwayLineStatus;
  }[];
  categories: RunwayVarianceCategory[];
  totals: {
    planned: number;
    actual: number;
    variance: number;
    variancePct: number;
    status: string;
  };
}

export function buildVarianceReport(
  plan: RunwayPlan,
  lines: RunwayLine[],
  expenses: ExpenseLedgerEvent[],
  debts: DebtLiabilityEvent[] = [],
  salesRevenue: number = 0,
  creditSaleReceipts: number = 0
): RunwayVarianceReport {
  const totals = computePlanTotals(plan, lines);
  const derived = deriveLineStatuses(lines, expenses, debts);
  const layers = computeFundingLayers(plan, lines, [], [], expenses, debts);
  const offPlan = findOffPlanSpend(plan, expenses);
  const offPlanTotal = round2(offPlan.reduce((acc, e) => acc + Math.abs(e.amount), 0));
  const recovery = computeRecovery(layers.executed, salesRevenue, creditSaleReceipts);

  const lineReports = lines.map((l) => {
    const info = derived.get(l.id);
    const planned = info ? info.cost : computeLineCost(l);
    const spent = info ? info.spent : 0;
    const variance = round2(spent - planned);
    return {
      lineId: l.id,
      title: l.title,
      category: l.category,
      planned,
      spent,
      variance,
      status: info ? info.status : 'PLANNED',
    };
  });

  const varianceTotal = round2(layers.executed - totals.costTotal);
  const variancePct = totals.costTotal > 0 ? Number(((varianceTotal / totals.costTotal) * 100).toFixed(1)) : 0;

  const catMap = new Map<string, { planned: number; actual: number }>();
  for (const lr of lineReports) {
    const existing = catMap.get(lr.category) || { planned: 0, actual: 0 };
    existing.planned = round2(existing.planned + lr.planned);
    existing.actual = round2(existing.actual + lr.spent);
    catMap.set(lr.category, existing);
  }

  const categories: RunwayVarianceCategory[] = Array.from(catMap.entries()).map(([category, c]) => {
    const variance = round2(c.planned - c.actual);
    const varPct = c.planned > 0 ? round2(((c.planned - c.actual) / c.planned) * 100) : 0;
    const status: 'UNDER_BUDGET' | 'ON_TRACK' | 'OVER_BUDGET' =
      variance > 0 ? 'UNDER_BUDGET' : variance === 0 ? 'ON_TRACK' : 'OVER_BUDGET';
    return {
      category,
      planned: c.planned,
      actual: c.actual,
      variance,
      variancePct: varPct,
      status,
    };
  });

  const totalsSummary = {
    planned: totals.costTotal,
    actual: layers.executed,
    variance: round2(totals.costTotal - layers.executed),
    variancePct: totals.costTotal > 0 ? round2(((totals.costTotal - layers.executed) / totals.costTotal) * 100) : 0,
    status: totals.costTotal >= layers.executed ? 'UNDER_BUDGET' : 'OVER_BUDGET',
  };

  return {
    planId: plan.id,
    planName: plan.name,
    status: plan.status,
    totalPlanned: totals.costTotal,
    totalSpent: layers.executed,
    varianceTotal,
    variancePct,
    contingencyBudget: totals.contingencyReserve,
    contingencyUsed: layers.reserveUsed,
    contingencyLeft: layers.reserveLeft,
    offPlanExpenses: offPlan,
    offPlanTotal,
    recoveredAmount: recovery.recoveredAmount,
    recoveredPct: recovery.recoveredPct,
    isBreakEven: recovery.isBreakEven,
    lineReports,
    categories,
    totals: totalsSummary,
  };
}

export interface GapCoachRecommendation {
  type: 'TRIM_LINES' | 'INCREASE_PLEDGES' | 'PHASE_RELEASE' | 'SEEK_FINANCING';
  priority: number;
  title: string;
  description: string;
  potentialImpactUsd?: number;
}

export function fundingGapCoach(
  gap: number,
  lines: RunwayLine[],
  pledges: RunwayPledge[]
): GapCoachRecommendation[] {
  if (gap <= 0) return [];

  const recs: GapCoachRecommendation[] = [];

  // 1. Trim NICE_TO_HAVE lines
  const niceToHaveCost = lines
    .filter((l) => l.kind === 'COST' && l.priority === 'NICE_TO_HAVE' && !l.skipped)
    .reduce((acc, l) => acc + computeLineCost(l), 0);

  if (niceToHaveCost > 0) {
    recs.push({
      type: 'TRIM_LINES',
      priority: 1,
      title: 'Trim nice-to-have items',
      description: `Postponing non-essential steps can immediately reduce your capital requirement by up to $${niceToHaveCost.toFixed(2)}.`,
      potentialImpactUsd: round2(niceToHaveCost),
    });
  }

  // 2. Increase member pledges
  const activePledgeCount = pledges.filter((p) => p.amount > 0).length;
  if (activePledgeCount > 0) {
    const topUpPerMember = round2(gap / activePledgeCount);
    recs.push({
      type: 'INCREASE_PLEDGES',
      priority: 2,
      title: 'Member top-up pledges',
      description: `An additional commitment of ~$${topUpPerMember.toFixed(2)} from each of the ${activePledgeCount} pledging members closes the remaining $${gap.toFixed(2)} gap.`,
      potentialImpactUsd: round2(gap),
    });
  }

  // 3. Phased funding
  const phase1Lines = lines.filter((l) => l.phaseId === 'phase-1' || !l.phaseId);
  const phase1Cost = phase1Lines.reduce((acc, l) => acc + computeLineCost(l), 0);
  if (phase1Cost > 0 && phase1Cost < gap + phase1Cost) {
    recs.push({
      type: 'PHASE_RELEASE',
      priority: 3,
      title: 'Activate Phase 1 first',
      description: `Fund the immediate setup requirements ($${phase1Cost.toFixed(2)}) first, then fund subsequent phases from early cash flow.`,
      potentialImpactUsd: round2(phase1Cost),
    });
  }

  // 4. Seek external financing
  recs.push({
    type: 'SEEK_FINANCING',
    priority: 4,
    title: 'Bridge with supplier credit or financing',
    description: `A commercial loan or supplier credit of $${gap.toFixed(2)} can bridge the remaining funding gap.`,
    potentialImpactUsd: round2(gap),
  });

  return recs.sort((a, b) => a.priority - b.priority);
}

export function runStressTest(
  plan: RunwayPlan,
  lines: RunwayLine[],
  stress: { costIncreasePct: number; incomeDelayMonths: number; incomeHaircutPct: number },
  openingCash: number = 0
): CashTimelineResult {
  return buildCashTimeline(plan, lines, openingCash, stress);
}

export function suggestUnitCosts(category: string, pastExpenses: ExpenseLedgerEvent[]): number | null {
  const matches = pastExpenses
    .filter((e) => e.approvalStatus === 'APPROVED' && e.category === category && e.direction === 'DEDUCTION' && e.amount > 0)
    .map((e) => e.amount)
    .sort((a, b) => a - b);

  if (matches.length === 0) return null;

  const mid = Math.floor(matches.length / 2);
  if (matches.length % 2 !== 0) {
    return round2(matches[mid]);
  }
  return round2((matches[mid - 1] + matches[mid]) / 2);
}

export interface TimelineGuideCopy {
  subtitle: string;
  guideTitle: string;
  dipDescription: string;
  breakEvenPrefix: string;
  breakEvenSuffix: string;
}

/**
 * Returns business-mode-appropriate copy for the Runway Cash Flow Timeline and its "How to Read" guide.
 */
export function getTimelineGuideCopy(isAgro: boolean): TimelineGuideCopy {
  if (isAgro) {
    return {
      subtitle:
        'Projected bank balance from initial seed capital through operational spending to harvest sales.',
      guideTitle: 'General User Guide: Understanding Cash Flow in Agriculture',
      dipDescription:
        'Farming requires upfront spending on feed, chicks, and infrastructure before any product can be sold. The graph naturally drops early on.',
      breakEvenPrefix: 'When harvest sales begin, the line rises. Crossing the ',
      breakEvenSuffix: ' means all initial costs are recouped, entering pure farm profit.',
    };
  }

  return {
    subtitle:
      'Projected bank balance from initial capital through operational spending to business revenue.',
    guideTitle: 'General User Guide: Understanding Business Cash Flow',
    dipDescription:
      'Running a business requires upfront spending on inventory, equipment, and operating costs before sales revenue comes in. The graph naturally drops early on.',
    breakEvenPrefix: 'When sales and customer revenue begin, the line rises. Crossing the ',
    breakEvenSuffix: ' means all initial costs are recouped, entering net business profit.',
  };
}
