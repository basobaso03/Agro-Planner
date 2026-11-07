import React, { useState } from 'react';
import {
  TrendingUp,
  Plus,
  AlertCircle,
  Wheat,
  Calculator,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import type { RunwayPlan, RunwayPlanTotals } from '../../types/runway';
import type { LivestockComputedStatus, OrgMember } from '../../types/agro';
import { dataService } from '../../services/dataService';
import { CountUp } from './CountUp';
import { formatMoney, isPrivacyMasked } from '../../utils/currency';

interface RunwayRevenuePanelProps {
  plan: RunwayPlan;
  currentMember: OrgMember;
  totals: RunwayPlanTotals;
  onUpdatePricing: (
    livestockId: string,
    price: number,
    pricingUnit?: 'HEAD' | 'KG',
    averageWeightKg?: number
  ) => void;
  onOpenRegisterBatch: () => void;
  showNumbers?: boolean;
}

export const RunwayRevenuePanel: React.FC<RunwayRevenuePanelProps> = ({
  plan,
  totals,
  onUpdatePricing,
  onOpenRegisterBatch,
  showNumbers,
}) => {
  const isMasked = showNumbers !== undefined ? !showNumbers : isPrivacyMasked();
  // Query real-time livestock computed statuses directly from dataService
  const allStatuses: LivestockComputedStatus[] = dataService.computeLivestockStatuses();

  // Filter batches by plan location if specified
  const relevantStatuses = allStatuses.filter((st) => {
    if (!plan.locationId || plan.locationId === 'ALL') return true;
    return st.entry.locationId === plan.locationId;
  });

  // Local draft price inputs state (livestockId -> price string)
  const savedPricings = plan.livestockRevenuePricings || {};
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const st of relevantStatuses) {
      const saved = savedPricings[st.entry.id]?.sellingPricePerUnit;
      if (saved !== undefined && saved > 0) {
        init[st.entry.id] = String(saved);
      } else {
        // Sensible default benchmark based on species
        const sp = (st.entry.species || '').toLowerCase();
        if (sp.includes('broiler') || sp.includes('poultry') || sp.includes('chicken')) {
          init[st.entry.id] = '6.50';
        } else if (sp.includes('layer')) {
          init[st.entry.id] = '8.00';
        } else if (sp.includes('goat') || sp.includes('sheep')) {
          init[st.entry.id] = '75.00';
        } else if (sp.includes('pig') || sp.includes('swine')) {
          init[st.entry.id] = '180.00';
        } else {
          init[st.entry.id] = '10.00';
        }
      }
    }
    return init;
  });

  const handlePriceChange = (livestockId: string, val: string) => {
    setPriceInputs((prev) => ({ ...prev, [livestockId]: val }));
    const parsed = parseFloat(val);
    if (Number.isFinite(parsed) && parsed >= 0) {
      onUpdatePricing(livestockId, parsed);
    }
  };

  // Compute live real-time totals
  const totalLiveAnimals = relevantStatuses.reduce((acc, st) => acc + st.currentLiveHeadcount, 0);

  let totalProjectedRevenue = 0;
  for (const st of relevantStatuses) {
    const priceStr = priceInputs[st.entry.id];
    const price = priceStr !== undefined ? parseFloat(priceStr) || 0 : savedPricings[st.entry.id]?.sellingPricePerUnit || 0;
    totalProjectedRevenue += st.currentLiveHeadcount * price;
  }

  const costBase = totals.costTotal || totals.totalRequirement || 0;
  const projectedNetProfit = totalProjectedRevenue - costBase;
  const roiPct = costBase > 0 ? (projectedNetProfit / costBase) * 100 : 0;
  const isProfitable = projectedNetProfit > 0;

  return (
    <div className="space-y-5">
      {/* Overview Metric Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 sm:p-4 rounded-2xl bg-white border border-[#E8DFCE] shadow-xs">
        <div className="min-w-0">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap block truncate">
            <span className="sm:hidden">Live Stock</span>
            <span className="hidden sm:inline">Surviving Live Stock</span>
          </span>
          <div className="text-base sm:text-xl font-black font-mono text-slate-950 mt-0.5 truncate flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span>{isMasked ? '•••• head' : `${totalLiveAnimals.toLocaleString()} head`}</span>
          </div>
        </div>

        <div className="min-w-0">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-700 whitespace-nowrap block truncate">
            <span className="sm:hidden">Sales Revenue</span>
            <span className="hidden sm:inline">Projected Sales Revenue</span>
          </span>
          <div className="text-base sm:text-xl font-black font-mono text-emerald-700 mt-0.5 truncate">
            <CountUp value={totalProjectedRevenue} decimals={2} showNumbers={!isMasked} />
          </div>
        </div>

        <div className="min-w-0">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap block truncate">
            <span className="sm:hidden">Budget Capital</span>
            <span className="hidden sm:inline">Budget Capital Required</span>
          </span>
          <div className="text-base sm:text-xl font-black font-mono text-slate-950 mt-0.5 truncate">
            {formatMoney(costBase, !isMasked)}
          </div>
        </div>

        <div className="min-w-0">
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-indigo-700 whitespace-nowrap block truncate">
            <span className="sm:hidden">Net Return (ROI)</span>
            <span className="hidden sm:inline">Projected Net Return (ROI)</span>
          </span>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-1.5 min-w-0">
            <span
              className={`text-base sm:text-xl font-black font-mono truncate ${isProfitable ? 'text-emerald-700' : 'text-amber-700'
                }`}
            >
              {isMasked
                ? '••••••'
                : `${isProfitable ? '+' : ''}$${projectedNetProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </span>
            <span
              className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${isProfitable
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}
            >
              {isMasked ? '••%' : `${roiPct >= 0 ? '+' : ''}${roiPct.toFixed(1)}%`}
            </span>
          </div>
        </div>
      </div>

      {/* Dynamic Ground Livestock Sync Explainer */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-indigo-50/60 dark:from-emerald-950/30 dark:via-gray-900 dark:to-indigo-950/20 border border-emerald-200/80 dark:border-emerald-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-emerald-600 text-white shrink-0 shadow-xs">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-emerald-950 dark:text-emerald-200">
              Dynamic Ground Headcount Synchronization
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-[11px] leading-relaxed">
              Expected revenue is calculated from living animals on the ground. When mortality occurs or sales are dispatched in daily operations, your revenue projections automatically adjust.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenRegisterBatch}
          className="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-gray-800 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 font-bold hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors shrink-0 cursor-pointer shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Register Animal Batch</span>
        </button>
      </div>

      {/* EMPTY STATE: If no animals registered at this site */}
      {relevantStatuses.length === 0 ? (
        <div className="p-8 sm:p-10 text-center rounded-3xl bg-white dark:bg-gray-900 border-2 border-dashed border-gray-200 dark:border-gray-800 space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400 shadow-xs">
            <Wheat className="w-8 h-8 animate-pulse" />
          </div>

          <div className="space-y-1.5 max-w-md mx-auto">
            <h4 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
              No Active Livestock Registered on Site
            </h4>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              Revenue calculations in Agro-Planner connect directly to living animals on the ground. When animal quantities change (such as mortality, weight growth, or sales), your expected revenue automatically updates.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={onOpenRegisterBatch}
              className="inline-flex items-center space-x-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-lg transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Register New Livestock Batch</span>
            </button>
          </div>
        </div>
      ) : (
        /* LIST OF ACTIVE BATCHES WITH DYNAMIC PRICE & QUANTITY CALCULATOR */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">
              Active Animal Batches on Ground ({isMasked ? '••' : relevantStatuses.length})
            </h4>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              Set target selling price per head to forecast harvest proceeds
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {relevantStatuses.map((st) => {
              const priceStr = priceInputs[st.entry.id] || '';
              const unitPrice = parseFloat(priceStr) || 0;
              const batchRevenue = st.currentLiveHeadcount * unitPrice;

              const initialHeadcount = st.entry.initialHeadcount || st.currentLiveHeadcount;
              const mortalityCount = Math.max(0, initialHeadcount - st.currentLiveHeadcount);
              const survivalRate =
                initialHeadcount > 0
                  ? ((st.currentLiveHeadcount / initialHeadcount) * 100).toFixed(1)
                  : '100.0';

              const spLower = (st.entry.species || '').toLowerCase();
              const isPoultry = spLower.includes('broiler') || spLower.includes('chicken');
              const presets = isPoultry ? [5.5, 6.0, 6.5, 7.0, 8.0] : [60, 75, 90, 120];

              return (
                <div
                  key={st.entry.id}
                  className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs space-y-3.5 hover:border-emerald-300 dark:hover:border-emerald-800 transition-colors"
                >
                  {/* Top row: Batch title, tag & countdown */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                          {st.entry.species}
                        </span>
                        <h5 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                          {st.entry.nameOrTag}
                        </h5>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span>Day {st.currentTotalAgeDays} on farm • {st.countdownBadgeText}</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 font-bold uppercase block">
                        Surviving Quantity
                      </span>
                      <span className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                        {isMasked ? '•••• head' : `${st.currentLiveHeadcount.toLocaleString()} head`}
                      </span>
                    </div>
                  </div>

                  {/* Quantity & Mortality Breakdown Strip */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 text-xs">
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-bold block">Initial Stock</span>
                      <strong className="text-gray-700 dark:text-gray-200 font-mono">
                        {isMasked ? '•••• placed' : `${initialHeadcount} placed`}
                      </strong>
                    </div>

                    <div>
                      <span className="text-[10px] text-rose-500 uppercase font-bold block">Mortality / Loss</span>
                      <strong className="text-rose-600 font-mono">
                        {isMasked
                          ? '-•••• head (••%)'
                          : `-${mortalityCount} head (${initialHeadcount > 0 ? ((mortalityCount / initialHeadcount) * 100).toFixed(1) : 0}%)`}
                      </strong>
                    </div>

                    <div>
                      <span className="text-[10px] text-emerald-600 uppercase font-bold block">Survival Rate</span>
                      <strong className="text-emerald-600 font-mono">
                        {isMasked ? '••% healthy' : `${survivalRate}% healthy`}
                      </strong>
                    </div>
                  </div>

                  {/* Interactive Price & Total Calculation Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <div className="space-y-1.5 flex-1 max-w-md">
                      <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300">
                        Target Selling Price ($ per animal)
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1 max-w-[160px]">
                          <span className="absolute left-3 top-2 text-xs font-bold text-gray-500">$</span>
                          <input
                            type={isMasked ? 'password' : 'number'}
                            inputMode="decimal"
                            min="0"
                            step="0.10"
                            placeholder="0.00"
                            value={isMasked ? '••••' : priceStr}
                            disabled={isMasked}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handlePriceChange(st.entry.id, e.target.value)}
                            className="w-full pl-6 pr-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-mono font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                          />
                        </div>

                        {/* Preset quick pills */}
                        <div className="flex items-center gap-1">
                          {presets.map((p) => (
                            <button
                              key={p}
                              type="button"
                              disabled={isMasked}
                              onClick={() => handlePriceChange(st.entry.id, String(p))}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${parseFloat(priceStr) === p
                                ? 'bg-emerald-600 text-white'
                                : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                                } disabled:opacity-50`}
                            >
                              {isMasked ? '••••' : `$${p.toFixed(2)}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Batch Revenue Result */}
                    <div className="sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-800/60">
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase flex items-center sm:justify-end gap-1">
                        <Calculator className="w-3 h-3" /> Batch Projected Revenue
                      </span>
                      <span className="text-base sm:text-xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                        {isMasked ? '••••••' : `$${batchRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </span>
                      <span className="text-[10px] text-gray-400 block mt-0.5">
                        {isMasked
                          ? '•••• head × ••••••'
                          : `${st.currentLiveHeadcount} head × $${unitPrice.toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Another Animal Batch Quick Button */}
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={onOpenRegisterBatch}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>Register Another Animal Batch</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

