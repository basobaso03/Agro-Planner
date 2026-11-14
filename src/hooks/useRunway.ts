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
import {
  filterVisibleOrgMembers,
  getMemberMatchIds,
  isValidRealEmail,
  matchesMemberRecord,
} from '../utils/memberIdentity.ts';

export function useRunway(planId?: string, orgIdOverride?: string) {
  const [state, setState] = useState<AgroStateSnapshot>(() => dataService.getState());

  useEffect(() => {
    return dataService.subscribe((nextState: AgroStateSnapshot) => {
      setState(nextState);
    });
  }, []);

  const activeOrgId = orgIdOverride || state.activeOrgId || dataService.getActiveOrgId() || '';
  const currentOrg =
    (state.organizations || []).find((o) => o.id === activeOrgId) ||
    dataService.getActiveOrganization(activeOrgId);
  const isEnabled = Boolean(currentOrg?.features?.runwayModule);

  const orgMembers = useMemo(() => {
    const visible = filterVisibleOrgMembers(state.members || [], activeOrgId);
    const seenIds = new Set<string>();
    const seenUids = new Set<string>();
    const seenEmails = new Set<string>();
    return visible.filter((m) => {
      if (seenIds.has(m.id)) return false;
      if (m.uid && seenUids.has(m.uid)) return false;
      const candidateEmail = (m.email || (isValidRealEmail(m.phoneOrEmail) ? m.phoneOrEmail : '')).trim().toLowerCase();
      if (candidateEmail && isValidRealEmail(candidateEmail) && seenEmails.has(candidateEmail)) return false;
      seenIds.add(m.id);
      if (m.uid) seenUids.add(m.uid);
      if (candidateEmail && isValidRealEmail(candidateEmail)) seenEmails.add(candidateEmail);
      return true;
    });
  }, [state.members, activeOrgId]);

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
    const plgList = (state.runwayPledges || []).filter(
      (p) => p.planId === plan.id && p.status !== 'MERGED' && p.status !== 'WITHDRAWN'
    );
    return plgList.map((p) => {
      const owner = orgMembers.find((m) => matchesMemberRecord(p.memberId, m));
      const ownerIds = owner ? getMemberMatchIds(owner) : new Set([p.memberId]);
      const paid = (state.capitalContributions || [])
        .filter((c) => c.runwayPlanId === plan.id && (c.pledgeId === p.id || ownerIds.has(c.memberId)))
        .reduce((acc, c) => acc + (c.direction === 'CONTRA_REVERSAL' ? -Math.abs(c.amount) : c.amount), 0);
      return {
        ...p,
        memberName: owner ? owner.fullName : p.memberName,
        pledgedAmount: p.amount,
        paidAmount: round2(Math.max(0, paid)),
      };
    });
  }, [state.runwayPledges, state.capitalContributions, plan, orgMembers]);

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
      if (cfg && typeof cfg.sellingPricePerUnit === 'number' && cfg.sellingPricePerUnit > 0) {
        total += st.currentLiveHeadcount * cfg.sellingPricePerUnit;
      } else if (typeof st.entry.configuredSalePricePerUnit === 'number' && st.entry.configuredSalePricePerUnit > 0) {
        total += st.currentLiveHeadcount * st.entry.configuredSalePricePerUnit;
      } else if (typeof st.totalExpectedRevenueUsd === 'number' && st.totalExpectedRevenueUsd > 0) {
        total += st.totalExpectedRevenueUsd;
      } else {
        const sp = (st.entry.species || '').toLowerCase();
        const defaultPrice =
          sp.includes('broiler') || sp.includes('poultry') || sp.includes('chicken')
            ? 6.5
            : sp.includes('layer')
              ? 8.0
              : sp.includes('goat') || sp.includes('sheep')
                ? 75.0
                : sp.includes('pig') || sp.includes('swine')
                  ? 180.0
                  : 10.0;
        total += st.currentLiveHeadcount * defaultPrice;
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
    if (!plan) return 0;
    const planStart = new Date(plan.activatedAt || plan.startDate).getTime();
    const planEnd = plan.completedAt ? new Date(plan.completedAt).getTime() : Infinity;

    return (state.livestockEvents || [])
      .filter((e) => {
        if (e.eventType !== 'SALE_DISPATCH' || !(e.saleRevenueAmount && e.saleRevenueAmount > 0)) return false;
        if (e.orgId && plan.orgId && e.orgId !== plan.orgId) return false;
        if (plan.locationId && plan.locationId !== 'ALL' && e.locationId && e.locationId !== plan.locationId) return false;
        const t = new Date(e.createdAt || (e as any).timestamp).getTime();
        return t >= planStart && t <= planEnd;
      })
      .reduce((acc, e) => acc + (e.saleRevenueAmount || 0), 0);
  }, [state.livestockEvents, plan]);

  const creditSaleReceipts = useMemo(() => {
    if (!plan) return 0;
    const planStart = new Date(plan.activatedAt || plan.startDate).getTime();
    const planEnd = plan.completedAt ? new Date(plan.completedAt).getTime() : Infinity;

    return (state.creditSales || []).reduce((acc, cs) => {
      if (cs.orgId && plan.orgId && cs.orgId !== plan.orgId) return acc;
      if (plan.locationId && plan.locationId !== 'ALL' && cs.locationId && cs.locationId !== plan.locationId) return acc;

      const repSum = (cs.paymentLogs || [])
        .filter((p) => {
          const t = new Date(p.paidAt).getTime();
          return t >= planStart && t <= planEnd;
        })
        .reduce((pAcc: number, p) => pAcc + (p.amount || 0), 0);

      return acc + repSum;
    }, 0);
  }, [state.creditSales, plan]);

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
    orgMembers,
    members: orgMembers,
    orgPlans,
    plans: orgPlans,
    plan,
    currentPlan: plan,
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
