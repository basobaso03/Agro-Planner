import React, { useState, useMemo } from 'react';
import {
  Layers,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  PlusCircle,
  FileEdit,
  CreditCard,
  Building2,
  ShoppingBag,
  Sparkles,
  Check,
  Search,
  Filter,
  History,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';
import type {
  RunwayPlan,
  RunwayLine,
  RunwayLineStatus,
  RunwayFundingLayers,
} from '../../types/runway';
import type { ExpenseLedgerEvent, OrgMember, FarmLocation } from '../../types/agro';
import { deriveLineStatuses } from '../../utils/runway';
import { PERMISSIONS } from '../../utils/permissions';
import { dataService } from '../../services/dataService';
import { CountUp } from './CountUp';
import { RunwayPurchaseSheet } from './RunwayPurchaseSheet';
import { formatMoney, isPrivacyMasked } from '../../utils/currency';

interface SpendPanelProps {
  plan: RunwayPlan;
  lines: RunwayLine[];
  expenses: ExpenseLedgerEvent[];
  layers: RunwayFundingLayers;
  currentMember: OrgMember;
  locations?: FarmLocation[];
  availableCash?: number;
  onRecordExpense: () => void;
  onProposeAmendment: () => void;
  readOnly?: boolean;
  showNumbers?: boolean;
}

type ExecutionViewFilter = 'ALL' | 'PENDING' | 'PAID';

export const SpendPanel: React.FC<SpendPanelProps> = ({
  plan,
  lines,
  expenses,
  layers,
  currentMember,
  locations = [],
  availableCash = 0,
  onRecordExpense,
  onProposeAmendment,
  readOnly = false,
  showNumbers,
}) => {
  const isMasked = showNumbers !== undefined ? !showNumbers : isPrivacyMasked();
  const [filterView, setFilterView] = useState<ExecutionViewFilter>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Purchase Sheet state
  const [purchasingLine, setPurchasingLine] = useState<RunwayLine | null>(null);
  const [purchaseSuccessBanner, setPurchaseSuccessBanner] = useState<string | null>(null);
  const [expandedLineId, setExpandedLineId] = useState<string | null>(null);
  const [isReversing, setIsReversing] = useState<boolean>(false);

  const canSpend = PERMISSIONS.canSpendAgainstPlan(currentMember.role);
  const canPropose = PERMISSIONS.canProposeAmendment(currentMember.role);

  const derivedStatuses = useMemo(() => {
    return deriveLineStatuses(lines, expenses);
  }, [lines, expenses]);

  const planExpenses = useMemo(() => {
    return expenses.filter((e) => e.runwayPlanId === plan.id);
  }, [expenses, plan.id]);

  const lineExpenses = useMemo(() => {
    const map = new Map<string, ExpenseLedgerEvent[]>();
    for (const exp of expenses) {
      if (exp.runwayLineId) {
        const list = map.get(exp.runwayLineId) || [];
        list.push(exp);
        map.set(exp.runwayLineId, list);
      }
    }
    return map;
  }, [expenses]);

  const reversedExpenseIds = useMemo(() => {
    const set = new Set<string>();
    for (const exp of expenses) {
      if (exp.direction === 'CONTRA_REVERSAL' && exp.referenceTransactionId) {
        set.add(exp.referenceTransactionId);
      }
    }
    return set;
  }, [expenses]);

  const handleReversePurchase = (exp: ExpenseLedgerEvent, lineTitle: string) => {
    if (reversedExpenseIds.has(exp.id)) {
      alert(`This purchase transaction has already been reversed.`);
      return;
    }

    const activeOrg = dataService.getActiveOrganization(plan.orgId);
    const isAgroPlan = plan.orgType !== 'GENERAL_VENTURE' && activeOrg?.type !== 'GENERAL_VENTURE';
    const assetTypesReversed = isAgroPlan
      ? 'reverse any registered livestock or equipment assets'
      : 'reverse any registered equipment assets';

    if (
      !window.confirm(
        `Undo / reverse this purchase of $${Math.abs(exp.amount).toFixed(2)} for "${lineTitle}"?\n\nThis will safely record a Contra-Reversal, restore the money back to Money on the Ground, reduce the spent amount on this line, and ${assetTypesReversed}.`
      )
    ) {
      return;
    }

    try {
      setIsReversing(true);
      // 1. Log contra-reversal for the expense
      dataService.logExpense({
        locationId: exp.locationId,
        category: exp.category,
        direction: 'CONTRA_REVERSAL',
        amount: -Math.abs(exp.amount),
        referenceTransactionId: exp.id,
        note: `Contra-reversal of purchase: ${exp.note || lineTitle}`,
        actor: currentMember,
        runwayAllocation: exp.runwayLineId ? { mode: 'LINE', lineId: exp.runwayLineId } : undefined,
        runwayPlanId: exp.runwayPlanId || plan.id,
      });

      // 2. If there's a corresponding fixed asset, reverse it too
      const assetState = dataService.getState().fixedAssets || [];
      const reversedAssetIds = new Set(
        assetState
          .filter((a) => a.direction === 'CONTRA_REVERSAL' && a.referenceTransactionId)
          .map((a) => a.referenceTransactionId!)
      );
      const matchingAsset = assetState.find(
        (a) =>
          !reversedAssetIds.has(a.id) &&
          a.direction !== 'CONTRA_REVERSAL' &&
          (a.id === exp.batchOrAnimalId ||
            a.referenceTransactionId === exp.id ||
            (exp.note && a.assetName && exp.note.includes(a.assetName)))
      );
      if (matchingAsset) {
        dataService.logFixedAssetEvent({
          assetName: matchingAsset.assetName,
          category: matchingAsset.category,
          locationId: matchingAsset.locationId,
          direction: 'CONTRA_REVERSAL',
          quantityDelta: -Math.abs(matchingAsset.quantityDelta),
          valueDelta: -Math.abs(matchingAsset.valueDelta),
          condition: matchingAsset.condition,
          referenceTransactionId: matchingAsset.id,
          note: `Contra-reversal of asset purchase: ${lineTitle}`,
          deductFromLeftMoney: false,
          actor: currentMember,
          runwayPlanId: plan.id,
          runwayAllocation: exp.runwayLineId ? { mode: 'LINE', lineId: exp.runwayLineId } : undefined,
        });
      }

      // 3. If there's a corresponding livestock entry/batch (strictly in AGRO farming ventures), reverse the livestock purchase too
      if (isAgroPlan) {
        const livestockState = dataService.getState().livestockEntries || [];
        const livestockEvents = dataService.getState().livestockEvents || [];
        const matchingLivestock = livestockState.find(
          (l) =>
            l.id === exp.batchOrAnimalId ||
            l.acquisitionExpenseId === exp.id ||
            (exp.category === 'LIVESTOCK_PURCHASE' && exp.note && l.nameOrTag && exp.note.includes(l.nameOrTag))
        );

        if (matchingLivestock) {
          const alreadyReversedLivestock = livestockEvents.some(
            (e) =>
              e.livestockId === matchingLivestock.id &&
              e.eventType === 'HEADCOUNT_CONTRA_ADJUSTMENT' &&
              e.referenceTransactionId === exp.id
          );

          if (!alreadyReversedLivestock) {
            // Extract headcount delta from expense note e.g. [Qty: 100 chick] or fallback to initialHeadcount
            let reverseHeadcount = matchingLivestock.initialHeadcount;
            const qtyMatch = exp.note?.match(/\[Qty:\s*(\d+(?:\.\d+)?)/i);
            if (qtyMatch && qtyMatch[1]) {
              const parsed = parseFloat(qtyMatch[1]);
              if (Number.isFinite(parsed) && parsed > 0) {
                reverseHeadcount = Math.round(parsed);
              }
            }

            dataService.logLivestockLifecycleEvent({
              livestockId: matchingLivestock.id,
              eventType: 'HEADCOUNT_CONTRA_ADJUSTMENT',
              headcountDelta: -Math.abs(reverseHeadcount),
              referenceTransactionId: exp.id,
              note: `Contra-reversal of livestock purchase against Runway line: ${lineTitle}`,
              actor: currentMember,
            });
          }
        }
      }

      handlePurchaseSuccess(`Successfully reversed purchase of $${Math.abs(exp.amount).toFixed(2)}! Funds restored to Money on the Ground.`);
    } catch (err: any) {
      alert(err.message || 'Error reversing purchase.');
    } finally {
      setIsReversing(false);
    }
  };

  const reserveDraws = useMemo(() => {
    return planExpenses.filter((e) => (e.runwayReserveDraw || 0) > 0);
  }, [planExpenses]);

  const costLines = useMemo(() => {
    return lines.filter((l) => l.kind === 'COST');
  }, [lines]);

  // Aggregate line statistics
  const { pendingLines, paidLines, partialLinesCount, itemsCompletedPct, totalPlannedCost, totalSpentCost } = useMemo(() => {
    let paidCount = 0;
    let partialCount = 0;
    let pendingCount = 0;
    let plannedSum = 0;
    let spentSum = 0;
    let progressWeightedSum = 0;

    const pending: RunwayLine[] = [];
    const paid: RunwayLine[] = [];

    costLines.forEach((l) => {
      const statusInfo = derivedStatuses.get(l.id);
      const planned = statusInfo?.cost ?? statusInfo?.plannedTotal ?? l.qty * l.unitCost;
      const spent = statusInfo?.spent || 0;
      const status = statusInfo?.status || 'PLANNED';

      plannedSum += planned;
      spentSum += spent;

      if (status === 'PAID' || status === 'COMMITTED') {
        paidCount++;
        progressWeightedSum += 1;
        paid.push(l);
      } else {
        if (status === 'PARTIAL' && planned > 0) {
          partialCount++;
          progressWeightedSum += Math.min(1, spent / planned);
        }
        pendingCount++;
        pending.push(l);
      }
    });

    const pct = costLines.length > 0 ? Math.round((progressWeightedSum / costLines.length) * 100) : 0;

    return {
      pendingLines: pending,
      paidLines: paid,
      partialLinesCount: partialCount,
      itemsCompletedPct: pct,
      totalPlannedCost: plannedSum,
      totalSpentCost: spentSum,
    };
  }, [costLines, derivedStatuses]);

  const categories = useMemo(() => {
    return Array.from(new Set(costLines.map((l) => l.category)));
  }, [costLines]);

  // Filtered lines to display
  const filteredLines = useMemo(() => {
    return costLines.filter((line) => {
      const statusInfo = derivedStatuses.get(line.id);
      const status = statusInfo?.status || 'PLANNED';
      const isPaid = status === 'PAID' || status === 'COMMITTED';

      if (filterView === 'PENDING' && isPaid) return false;
      if (filterView === 'PAID' && !isPaid) return false;

      if (filterCategory !== 'ALL' && line.category !== filterCategory) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return line.title.toLowerCase().includes(q) || line.category.toLowerCase().includes(q);
      }

      return true;
    });
  }, [costLines, derivedStatuses, filterView, filterCategory, searchQuery]);

  const handlePurchaseSuccess = (msg: string) => {
    setPurchaseSuccessBanner(msg);
    setTimeout(() => {
      setPurchaseSuccessBanner(null);
    }, 6000);
  };

  return (
    <div className="space-y-6">
      {/* Success Notification Banner */}
      {purchaseSuccessBanner && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{purchaseSuccessBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setPurchaseSuccessBanner(null)}
            className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 shrink-0 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Execution Progress & Ground Cash Tracker */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-indigo-50/70 via-white to-emerald-50/40 dark:from-indigo-950/40 dark:via-gray-900 dark:to-emerald-950/20 border border-indigo-200/80 dark:border-indigo-900/50 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                Capital Execution &amp; Purchases
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Items Purchased: <strong className="text-emerald-600 dark:text-emerald-400">{isMasked ? '•• of ••' : `${paidLines.length} of ${costLines.length}`}</strong> full{partialLinesCount > 0 ? ` (${isMasked ? '••' : partialLinesCount} partially paid)` : ''} ({isMasked ? '••%' : `${itemsCompletedPct}%`}) • Disbursed: <strong className="text-indigo-600 dark:text-indigo-400">{formatMoney(layers.executed, !isMasked)}</strong> of {formatMoney(layers.totalRequirement, !isMasked)} ({isMasked ? '••%' : `${layers.executedPct}%`})
            </p>
          </div>

          {/* Ground Cash Indicator */}
          <div className="p-2.5 px-3.5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs shrink-0 flex items-center space-x-3">
            <div>
              <span className="text-[10px] font-bold uppercase text-gray-400 block">
                Master Treasury Cash (leftMoney)
              </span>
              <span className="text-sm sm:text-base font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                {formatMoney(availableCash, !isMasked)}
              </span>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Live Organization Treasury Balance" />
          </div>
        </div>

        {/* Master Execution Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full h-3 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden shadow-inner flex">
            {/* Disbursed spend */}
            <div
              className="h-full bg-emerald-500 dark:bg-emerald-400 transition-all duration-700 ease-out"
              style={{ width: `${Math.min(100, layers.executedPct)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400 font-semibold">
            <span>Executed: {formatMoney(layers.executed, !isMasked)}</span>
            <span>Target: {formatMoney(layers.totalRequirement, !isMasked)}</span>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-white border border-[#E8DFCE] shadow-xs">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Total Target
          </span>
          <div className="text-lg sm:text-xl font-black font-mono text-slate-950 mt-0.5">
            <CountUp value={layers.totalRequirement} showNumbers={!isMasked} />
          </div>
          <span className="text-[11px] text-slate-600 font-medium">100% Budget</span>
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            Disbursed Spend
          </span>
          <div className="text-lg sm:text-xl font-black font-mono text-emerald-700 mt-0.5">
            <CountUp value={layers.executed} showNumbers={!isMasked} />
          </div>
          <span className="text-[11px] text-slate-600 font-medium">{isMasked ? '••% of budget' : `${layers.executedPct}% of budget`}</span>
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
            Reserve Buffer Left
          </span>
          <div className="text-lg sm:text-xl font-black font-mono text-amber-800 mt-0.5">
            <CountUp value={layers.reserveLeft} showNumbers={!isMasked} />
          </div>
          <span className="text-[11px] text-slate-600 font-medium">
            {formatMoney(layers.reserveUsed, !isMasked)} used for overruns
          </span>
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
            Remaining Budget
          </span>
          <div className="text-lg sm:text-xl font-black font-mono text-indigo-900 mt-0.5">
            <CountUp value={Math.max(0, layers.totalRequirement - layers.executed)} showNumbers={!isMasked} />
          </div>
          <span className="text-[11px] text-slate-600 font-medium">{isMasked ? '•• items left' : `${costLines.length - paidLines.length} items left`}</span>
        </div>
      </div>

      {/* Contingency Reserve Drawer Card */}
      {layers.reserveUsed > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-2.5">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <h4 className="text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-200">
              Contingency Emergency Draws ({reserveDraws.length})
            </h4>
          </div>

          <div className="divide-y divide-amber-200/50 dark:divide-amber-900/30 text-xs">
            {reserveDraws.map((d) => (
              <div key={d.id} className="py-2 flex items-center justify-between">
                <div>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {formatMoney(d.runwayReserveDraw || 0, !isMasked)}
                  </span>
                  <span className="text-gray-500 ml-2">{d.runwayAllocationNote || d.note}</span>
                </div>
                <span className="text-gray-400 text-[10px]">
                  {new Date(d.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Line-Item Purchases Execution Table */}
      <div className="rounded-2xl bg-white border border-[#E8DFCE] shadow-xs overflow-hidden">
        {/* Header & Filter Controls */}
        <div className="p-4 border-b border-[#F0EBE1] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <h4 className="text-sm font-black text-slate-950">
                Line Items Execution ({isMasked ? '••/••' : `${paidLines.length}/${costLines.length}`} Purchased)
              </h4>
            </div>

            {/* View filter pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setFilterView('ALL')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${filterView === 'ALL'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
              >
                All ({costLines.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterView('PENDING')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${filterView === 'PENDING'
                  ? 'bg-amber-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
              >
                To Buy ({pendingLines.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterView('PAID')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${filterView === 'PAID'
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
              >
                Purchased ({paidLines.length})
              </button>
            </div>
          </div>

          {/* Search & Category Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search items to buy..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 text-xs text-gray-900 dark:text-white focus:outline-indigo-500"
              />
            </div>

            {categories.length > 1 && (
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 text-xs text-gray-700 dark:text-gray-300 font-semibold"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Lines List */}
        <div className="divide-y divide-gray-100 dark:divide-gray-800/80">
          {filteredLines.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500 dark:text-gray-400">
              No planned items match the selected filter.
            </div>
          ) : (
            filteredLines.map((line) => {
              const statusInfo = derivedStatuses.get(line.id);
              const plannedTotal = statusInfo?.cost ?? statusInfo?.plannedTotal ?? line.qty * line.unitCost;
              const spent = statusInfo?.spent || 0;
              const remaining = Math.max(0, plannedTotal - spent);
              const status = statusInfo?.status || 'PLANNED';
              const isPaid = status === 'PAID' || status === 'COMMITTED';
              const isPartial = status === 'PARTIAL';
              const isOverBudget = spent > plannedTotal + 0.01;
              const exps = lineExpenses.get(line.id) || [];
              const isExpanded = expandedLineId === line.id;
              const approxUnitsPurchased =
                line.unitCost > 0 ? Number((spent / line.unitCost).toFixed(2)) : 0;

              const isCapex = Boolean(
                line.excludeFromContingency ||
                line.category === 'EQUIPMENT' ||
                line.category === 'Equipment & Assets'
              );

              const statusColors: Record<string, string> = {
                PAID: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
                COMMITTED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
                PARTIAL: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
                OVERRUN: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 animate-pulse',
                PLANNED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
              };

              const pctSpent =
                plannedTotal > 0
                  ? Math.min(100, spent > 0 ? Math.max(1, Math.round((spent / plannedTotal) * 100)) : 0)
                  : 0;

              return (
                <div
                  key={line.id}
                  className="p-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Item info */}
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                          {line.title}
                        </span>

                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase flex items-center gap-1 ${statusColors[status] || statusColors.PLANNED
                            }`}
                        >
                          {isPaid && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {isPartial && <Clock className="w-3 h-3 text-indigo-600" />}
                          <span>
                            {isPaid
                              ? 'PURCHASED'
                              : isPartial
                                ? `PARTIALLY PAID (${isMasked ? '••%' : `${pctSpent}%`})`
                                : status}
                          </span>
                        </span>

                        {isOverBudget && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            <span>OVER-PURCHASED (+{formatMoney(spent - plannedTotal, !isMasked)})</span>
                          </span>
                        )}

                        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                          {line.category}
                        </span>

                        {isCapex && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center gap-1 border border-indigo-200/60 dark:border-indigo-800">
                            <Building2 className="w-3 h-3" />
                            <span>Fixed Asset (CAPEX)</span>
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Target: {isMasked ? `•••• ${line.unitLabel || 'units'} × •••••• = ` : `${line.qty} ${line.unitLabel || 'units'} × $${line.unitCost.toFixed(2)} = `}<strong>{formatMoney(plannedTotal, !isMasked)}</strong>
                        {' • '}
                        Spent: <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{formatMoney(spent, !isMasked)}</span>
                        {spent > 0 && line.unitCost > 0 && (
                          <span className="text-indigo-500 dark:text-indigo-400">
                            {' '}({isMasked ? '••••' : approxUnitsPurchased} of {isMasked ? '••••' : line.qty} {line.unitLabel || 'units'})
                          </span>
                        )}
                        {' • '}
                        Remaining: <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{formatMoney(remaining, !isMasked)}</span>
                      </div>

                      {exps.length > 0 && (
                        <div className="pt-0.5 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setExpandedLineId(isExpanded ? null : line.id)}
                            className="inline-flex items-center space-x-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 cursor-pointer"
                          >
                            <History className="w-3.5 h-3.5" />
                            <span>{exps.length} Purchase{exps.length > 1 ? 's' : ''} Recorded</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                          {isOverBudget && (
                            <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                              • Spend exceeds plan. Expand to review and undo accidental duplicates.
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right: Actions & Progress Badge */}
                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                      <div className="text-right sm:mr-2">
                        <span className="text-sm font-bold font-mono text-gray-900 dark:text-white">
                          {isMasked ? '••%' : `${pctSpent}%`}
                        </span>
                      </div>

                      {!readOnly && canSpend && !isPaid && (
                        <button
                          type="button"
                          onClick={() => setPurchasingLine(line)}
                          className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>{isPartial ? 'Pay / Buy Remaining' : 'Purchase Item'}</span>
                        </button>
                      )}

                      {isPaid && isCapex && (
                        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-xl flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Registered in Assets</span>
                        </span>
                      )}

                      {isPaid && !isCapex && (
                        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-xl flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Paid in Full</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Micro Progress Bar */}
                  <div className="w-full h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${spent > plannedTotal
                        ? 'bg-rose-500'
                        : isPaid
                          ? 'bg-emerald-500'
                          : 'bg-indigo-600'
                        }`}
                      style={{ width: `${pctSpent}%` }}
                    />
                  </div>

                  {/* Expandable Purchase History Drawer & Reversal */}
                  {isExpanded && exps.length > 0 && (
                    <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/80 space-y-2 mt-2">
                      <div className="flex items-center justify-between text-xs font-bold text-gray-800 dark:text-gray-200 border-b border-gray-200/70 dark:border-gray-700/70 pb-1.5">
                        <div className="flex items-center space-x-1.5">
                          <History className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Purchase Transactions ({exps.length})</span>
                        </div>
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                          Spent: {formatMoney(spent, !isMasked)} / Planned: {formatMoney(plannedTotal, !isMasked)}
                        </span>
                      </div>

                      <div className="divide-y divide-gray-200/50 dark:divide-gray-700/50 text-xs">
                        {exps.map((e) => {
                          const isContra = e.direction === 'CONTRA_REVERSAL';
                          const hasBeenReversed = reversedExpenseIds.has(e.id);
                          return (
                            <div key={e.id} className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="space-y-0.5">
                                <div className="flex items-center space-x-2">
                                  <span
                                    className={`font-mono font-bold ${isContra || hasBeenReversed ? 'text-rose-600 line-through' : 'text-emerald-600 dark:text-emerald-400'
                                      }`}
                                  >
                                    {formatMoney(isContra ? -Math.abs(e.amount) : Math.abs(e.amount), !isMasked)}
                                  </span>
                                  <span className="text-[10px] text-gray-400">
                                    {new Date(e.createdAt).toLocaleDateString()}
                                  </span>
                                  {e.category === 'FIXED_ASSET_PURCHASE' && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                                      Fixed Asset
                                    </span>
                                  )}
                                  {isContra && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                      Contra Reversal
                                    </span>
                                  )}
                                  {hasBeenReversed && !isContra && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                      Reversed
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-gray-600 dark:text-gray-300">
                                  {e.note}
                                </p>
                                <span className="text-[10px] text-gray-400 block">
                                  Logged by {e.loggedByName}
                                </span>
                              </div>

                              {!readOnly && canSpend && !isContra && !hasBeenReversed && (
                                <button
                                  type="button"
                                  disabled={isReversing}
                                  onClick={() => handleReversePurchase(e, line.title)}
                                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-[11px] font-bold border border-rose-200 dark:border-rose-900 transition-colors cursor-pointer self-start sm:self-center shrink-0 active:scale-95"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Undo Purchase</span>
                                </button>
                              )}

                              {hasBeenReversed && (
                                <span className="text-[11px] font-semibold text-gray-400 italic self-start sm:self-center shrink-0">
                                  Already reversed
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Action Footer */}
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          {/* Propose Plan Amendment hidden for now per request */}

          {canSpend && (
            <button
              type="button"
              onClick={onRecordExpense}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Record Other General Expense</span>
            </button>
          )}
        </div>
      )}

      {/* Purchase Modal Sheet */}
      {purchasingLine && (
        <RunwayPurchaseSheet
          isOpen={Boolean(purchasingLine)}
          onClose={() => setPurchasingLine(null)}
          line={purchasingLine}
          plan={plan}
          availableCash={availableCash}
          locations={locations}
          currentMember={currentMember}
          remainingBudget={Math.max(
            0,
            (derivedStatuses.get(purchasingLine.id)?.cost ??
              purchasingLine.qty * purchasingLine.unitCost) -
            (derivedStatuses.get(purchasingLine.id)?.spent || 0)
          )}
          spentSoFar={derivedStatuses.get(purchasingLine.id)?.spent || 0}
          showNumbers={!isMasked}
          onSuccess={handlePurchaseSuccess}
        />
      )}
    </div>
  );
};
