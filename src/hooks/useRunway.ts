import { useState, useEffect, useMemo, useRef } from 'react';
import { dataService } from '../services/dataService.ts';
import type { AgroStateSnapshot, ExpenseLedgerEvent } from '../types/agro.ts';
import type {
  RunwayPlanTotals,
  RunwayFundingLayers,
  CashTimelineResult,
  DerivedLineInfo,
  RunwayVarianceReport,
} from '../utils/runway.ts';
import {
  computePlanTotals,
  computeFundingLayers,
  buildCashTimeline,
  deriveLineStatuses,
  computeAvailableCash,
  computeRecovery,
  buildVarianceReport,
  findOffPlanSpend,
  computeLineCost,
  round2,
  computeRunwayMonths,
} from '../utils/runway.ts';

export function useRunway(planId?: string, orgIdOverride?: string) {
  const [state, setState] = useState<AgroStateSnapshot>(() => dataService.getState());

  useEffect(() => {
    return dataService.subscribe((nextState: AgroStateSnapshot) => {
      setState(nextState);
    });
  }, []);

  const activeOrgId = orgIdOverride || state.activeOrgId || dataService.getActiveOrgId() || 'org-master';
  const currentOrg =
    (state.organizations || []).find((o) => o.id === activeOrgId) ||
    dataService.getActiveOrganization(activeOrgId);
  const isEnabled = Boolean(currentOrg?.features?.runwayModule);

  const orgPlans = useMemo(() => {
    return (state.runwayPlans || []).filter((p) => p.orgId === activeOrgId);
  }, [state.runwayPlans, activeOrgId]);

  const plan = useMemo(() => {
    if (planId) {
      const match = orgPlans.find((p) => p.id === planId);
      if (match) return match;
    }
    const active = orgPlans.find((p) => p.status === 'ACTIVE');
    if (active) return active;
    const pledging = orgPlans.find((p) => p.status === 'PLEDGING');
    if (pledging) return pledging;
    const draft = orgPlans.find((p) => p.status === 'DRAFT');
    if (draft) return draft;
    return orgPlans[0] || null;
  }, [orgPlans, planId]);

  const lines = useMemo(() => {
    if (!plan) return [];
    return (state.runwayLines || [])
      .filter((l) => l.planId === plan.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((l) => {
        const budget = computeLineCost(l);
        const actual = (state.expenses || [])
          .filter((e) => e.runwayLineId === l.id && e.approvalStatus === 'APPROVED')
          .reduce((acc, e) => acc + (e.direction === 'CONTRA_REVERSAL' ? -Math.abs(e.amount) : e.amount), 0);
        return {
          ...l,
          budget,
          actual: round2(Math.max(0, actual)),
        };
      });
  }, [state.runwayLines, state.expenses, plan]);

  const pledges = useMemo(() => {
    if (!plan) return [];
    const plgList = (state.runwayPledges || []).filter((p) => p.planId === plan.id);
    return plgList.map((p) => {
      const paid = (state.capitalContributions || [])
        .filter((c) => c.pledgeId === p.id && c.runwayPlanId === plan.id)
        .reduce((acc, c) => acc + (c.direction === 'CONTRA_REVERSAL' ? -Math.abs(c.amount) : c.amount), 0);
      return {
        ...p,
        pledgedAmount: p.amount,
        paidAmount: round2(Math.max(0, paid)),
      };
    });
  }, [state.runwayPledges, state.capitalContributions, plan]);

  const claims = useMemo(() => {
    if (!plan) return [];
    return (state.runwayClaims || []).filter((c) => c.planId === plan.id);
  }, [state.runwayClaims, plan]);

  const contributions = useMemo(() => {
    if (!plan) return [];
    return (state.capitalContributions || []).filter((c) => c.runwayPlanId === plan.id);
  }, [state.capitalContributions, plan]);

  const expenses = useMemo(() => {
    if (!plan) return [];
    return (state.expenses || []).filter((e) => e.runwayPlanId === plan.id);
  }, [state.expenses, plan]);

  const debts = useMemo(() => {
    if (!plan) return [];
    return (state.debtLiabilities || []).filter((d) => d.runwayPlanId === plan.id);
  }, [state.debtLiabilities, plan]);

  const livestockStatuses = useMemo(() => {
    return dataService.computeLivestockStatuses();
  }, [state.livestockEntries, state.livestockEvents]);

  const livestockRevenue = useMemo(() => {
    if (!plan) return 0;
    const pricings = plan.livestockRevenuePricings || {};
    let total = 0;
    for (const st of livestockStatuses) {
      if (plan.locationId && plan.locationId !== 'ALL' && st.entry.locationId !== plan.locationId) {
        continue;
      }
      const cfg = pricings[st.entry.id];
      if (cfg && cfg.sellingPricePerUnit > 0) {
        total += st.currentLiveHeadcount * cfg.sellingPricePerUnit;
      }
    }
    return round2(total);
  }, [plan, livestockStatuses]);

  const totals: RunwayPlanTotals = useMemo(() => {
    if (!plan) {
      return { costTotal: 0, contingencyReserve: 0, totalRequirement: 0, expectedIncome: 0 };
    }
    return computePlanTotals(plan, lines, livestockRevenue);
  }, [lines, plan, livestockRevenue]);

  const layers: RunwayFundingLayers = useMemo(() => {
    if (!plan) {
      return {
        target: 0,
        memberTarget: 0,
        totalRequirement: 0,
        peakNeed: 0,
        openingCash: 0,
        plannedFinancing: 0,
        pledged: 0,
        pledgedUnpaid: 0,
        collected: 0,
        executed: 0,
        remainingCommitted: 0,
        reserveUsed: 0,
        reserveLeft: 0,
        gap: 0,
        pledgedPct: 0,
        collectedPct: 0,
        executedPct: 0,
        isFullyFunded: false,
        isFullyPledged: false,
      };
    }
    return computeFundingLayers(plan, lines, pledges, contributions, expenses, debts);
  }, [plan, lines, pledges, contributions, expenses, debts]);

  const timeline: CashTimelineResult = useMemo(() => {
    if (!plan) {
      return {
        events: [],
        monthlyCashflow: [],
        peakNeed: 0,
        lowestBalance: 0,
        finalBalance: 0,
        operatingBreakEvenMonth: null,
        paybackDate: null,
        shortfall: 0,
        breakEvenMonth: null,
      };
    }
    return buildCashTimeline(plan, lines, plan.openingCashAdopted || 0);
  }, [plan, lines]);

  const lineStatuses: Map<string, DerivedLineInfo> = useMemo(() => {
    if (!plan) return new Map();
    return deriveLineStatuses(lines, expenses, debts);
  }, [lines, expenses, debts, plan]);

  const availableCash = useMemo(() => {
    const leftMoney = dataService.getCurrentOrgLeftMoney(activeOrgId);
    return computeAvailableCash(leftMoney, state.expenses || []);
  }, [activeOrgId, state.expenses, state.capitalContributions]);

  const runwayMonths = useMemo(() => {
    return computeRunwayMonths(availableCash, state.expenses || []);
  }, [availableCash, state.expenses]);

  const salesRevenue = useMemo(() => {
    return (state.livestockEvents || [])
      .filter((e) => e.eventType === 'SALE_DISPATCH')
      .reduce((acc, e) => acc + (e.saleRevenueAmount || 0), 0);
  }, [state.livestockEvents]);

  const creditSaleReceipts = useMemo(() => {
    return (state.creditSales || []).reduce((acc, cs) => {
      const repSum = (cs.paymentLogs || []).reduce((pAcc: number, p) => pAcc + (p.amount || 0), 0);
      return acc + repSum;
    }, 0);
  }, [state.creditSales]);

  const recovery = useMemo(() => {
    return computeRecovery(layers.executed, salesRevenue, creditSaleReceipts);
  }, [layers.executed, salesRevenue, creditSaleReceipts]);

  const variance: RunwayVarianceReport | null = useMemo(() => {
    if (!plan) return null;
    return buildVarianceReport(plan, lines, expenses, debts, salesRevenue, creditSaleReceipts);
  }, [plan, lines, expenses, debts, salesRevenue, creditSaleReceipts]);

  const offPlanExpenses: ExpenseLedgerEvent[] = useMemo(() => {
    if (!plan) return [];
    return findOffPlanSpend(plan, state.expenses || []);
  }, [plan, state.expenses]);

  return {
    state,
    isEnabled,
    orgPlans,
    plans: orgPlans,
    plan,
    activePlan: plan,
    lines,
    pledges,
    claims,
    contributions,
    expenses,
    debts,
    totals,
    layers,
    fundingLayers: layers,
    isFullyFunded: layers.isFullyFunded,
    isFullyPledged: layers.isFullyPledged,
    currentOrg,
    livestockRevenue,
    livestockStatuses,
    runwayMonths,
    timeline,
    lineStatuses,
    availableCash,
    recovery,
    variance,
    offPlanExpenses,
  };
}

export function useRunwayProgress(layers: RunwayFundingLayers) {
  const prevLayersRef = useRef<RunwayFundingLayers>(layers);
  const [deltaEvent, setDeltaEvent] = useState<{
    type: 'PLEDGE' | 'PAYMENT' | 'NONE';
    amount: number;
    timestamp: number;
  }>({ type: 'NONE', amount: 0, timestamp: 0 });

  useEffect(() => {
    const prev = prevLayersRef.current;
    if (layers.collected > prev.collected) {
      setDeltaEvent({
        type: 'PAYMENT',
        amount: Number((layers.collected - prev.collected).toFixed(2)),
        timestamp: Date.now(),
      });
    } else if (layers.pledgedUnpaid > prev.pledgedUnpaid) {
      setDeltaEvent({
        type: 'PLEDGE',
        amount: Number((layers.pledgedUnpaid - prev.pledgedUnpaid).toFixed(2)),
        timestamp: Date.now(),
      });
    }
    prevLayersRef.current = layers;
  }, [layers.collected, layers.pledgedUnpaid]);

  return deltaEvent;
}
