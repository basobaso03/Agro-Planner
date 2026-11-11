import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import {
  Sliders,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Sparkles,
  Info,
  CheckCircle2,
  ArrowDownRight,
  ArrowUpRight,
  HelpCircle,
  Clock,
} from 'lucide-react';
import type { RunwayPlan, RunwayLine } from '../../types/runway';
import { buildCashTimeline, getTimelineGuideCopy } from '../../utils/runway';
import { formatMoney, isPrivacyMasked } from '../../utils/currency';
import { dataService } from '../../services/dataService';

interface TimelineChartProps {
  plan: RunwayPlan;
  lines: RunwayLine[];
  openingCash?: number;
  showNumbers?: boolean;
  isAgro?: boolean;
}

const formatDateShort = (isoDate: string): string => {
  if (!isoDate || isoDate.length < 10) return isoDate;
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate.slice(5);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return isoDate.slice(5);
  }
};

const formatDateFull = (isoDate: string): string => {
  if (!isoDate || isoDate.length < 10) return isoDate;
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return isoDate;
  }
};

export const TimelineChart: React.FC<TimelineChartProps> = ({
  plan,
  lines,
  openingCash = 0,
  showNumbers,
  isAgro: isAgroProp,
}) => {
  const isMasked = showNumbers !== undefined ? !showNumbers : isPrivacyMasked();
  const isAgro =
    isAgroProp !== undefined
      ? isAgroProp
      : plan.orgType !== 'GENERAL_VENTURE' &&
      (plan.orgId ? dataService.isAgroOrganization(plan.orgId) : true);
  const guideCopy = getTimelineGuideCopy(isAgro);
  const [costIncreasePct, setCostIncreasePct] = useState<number>(0);
  const [incomeHaircutPct, setIncomeHaircutPct] = useState<number>(0);
  const [incomeDelayMonths, setIncomeDelayMonths] = useState<number>(0);
  const [showStressSliders, setShowStressSliders] = useState<boolean>(false);
  const [showGuide, setShowGuide] = useState<boolean>(false);

  const timeline = useMemo(() => {
    return buildCashTimeline(plan, lines, openingCash, {
      costIncreasePct,
      incomeHaircutPct,
      incomeDelayMonths,
    });
  }, [plan, lines, openingCash, costIncreasePct, incomeHaircutPct, incomeDelayMonths]);

  // Aggregate events into chart points
  const chartData = useMemo(() => {
    if (timeline.events.length === 0) {
      return [{ date: 'Start', fullDate: 'Day 0', balance: openingCash, netChange: 0, title: 'Opening Cash' }];
    }
    return [
      {
        date: 'Start',
        fullDate: plan.startDate ? formatDateFull(plan.startDate) : 'Day 0',
        balance: openingCash,
        netChange: 0,
        title: 'Initial Cash on Ground',
      },
      ...timeline.events.map((ev) => ({
        date: formatDateShort(ev.date),
        fullDate: formatDateFull(ev.date),
        balance: ev.runningBalance,
        netChange: ev.netChange,
        title: ev.title,
        type: ev.type,
      })),
    ];
  }, [timeline, openingCash, plan.startDate]);

  const hasEvents = timeline.events.length > 0;
  const isHealthyEnding = (chartData[chartData.length - 1]?.balance || 0) >= 0;

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E8DFCE] shadow-xs space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-emerald-700" />
            <h4 className="text-sm font-black text-slate-950">
              Cash Flow Timeline & Funding Roadmap
            </h4>
          </div>
          <p className="text-xs text-slate-600 font-medium">
            {guideCopy.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl border border-[#E8DFCE] hover:bg-stone-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
            <span>How to Read</span>
          </button>

          <button
            type="button"
            onClick={() => setShowStressSliders(!showStressSliders)}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${showStressSliders || costIncreasePct > 0 || incomeHaircutPct > 0
              ? 'border-amber-400 bg-amber-50 text-amber-950'
              : 'border-[#E8DFCE] hover:bg-stone-50 text-slate-800'
              }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Stress Test</span>
          </button>
        </div>
      </div>

      {/* Beginner Explainer Walkthrough Drawer */}
      {showGuide && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-950 space-y-2.5 animate-in fade-in">
          <div className="flex items-center space-x-2 font-bold text-indigo-900">
            <Info className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>{guideCopy.guideTitle}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] leading-relaxed">
            <div className="p-2.5 rounded-xl bg-white/80 border border-indigo-100 space-y-1">
              <strong className="text-indigo-900 block font-bold">1. The Upfront Outflow Dip</strong>
              <p className="text-slate-600">
                {guideCopy.dipDescription}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-white/80 border border-indigo-100 space-y-1">
              <strong className="text-indigo-900 block font-bold">2. Peak Capital Need</strong>
              <p className="text-slate-600">
                The lowest trough is your <strong>Peak Capital Need</strong> — the minimum total capital members must contribute to prevent running out of money.
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-white/80 border border-indigo-100 space-y-1">
              <strong className="text-indigo-900 block font-bold">3. Break-Even &amp; Profit</strong>
              <p className="text-slate-600">
                {guideCopy.breakEvenPrefix}
                <strong>$0.00 red threshold</strong>
                {guideCopy.breakEvenSuffix}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stress Test Controls Drawer */}
      {showStressSliders && (
        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-amber-950">
            <span>What-If Scenario Simulation (Test Resilience)</span>
            {(costIncreasePct > 0 || incomeHaircutPct > 0 || incomeDelayMonths > 0) && (
              <button
                type="button"
                onClick={() => {
                  setCostIncreasePct(0);
                  setIncomeHaircutPct(0);
                  setIncomeDelayMonths(0);
                }}
                className="text-amber-800 underline font-bold cursor-pointer"
              >
                Reset to Base
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <div className="flex justify-between text-slate-800 font-medium mb-1">
                <span>Cost Inflation</span>
                <span className="font-bold text-rose-600">+{costIncreasePct}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="5"
                value={costIncreasePct}
                onChange={(e) => setCostIncreasePct(parseInt(e.target.value))}
                className="w-full accent-rose-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-800 font-medium mb-1">
                <span>Revenue Haircut</span>
                <span className="font-bold text-amber-700">-{incomeHaircutPct}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="40"
                step="5"
                value={incomeHaircutPct}
                onChange={(e) => setIncomeHaircutPct(parseInt(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-800 font-medium mb-1">
                <span>Revenue Delay</span>
                <span className="font-bold text-emerald-800">+{incomeDelayMonths} Mo</span>
              </div>
              <input
                type="range"
                min="0"
                max="3"
                step="1"
                value={incomeDelayMonths}
                onChange={(e) => setIncomeDelayMonths(parseInt(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* KPI Highlights Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE] text-xs">
        <div>
          <span className="text-slate-600 font-semibold block truncate">Peak Capital Need:</span>
          <div className="font-black text-rose-600 text-sm mt-0.5 truncate">
            {formatMoney(timeline.peakNeed, !isMasked)}
          </div>
          <span className="text-[10px] text-slate-400 block truncate">Max cash deficit</span>
        </div>

        <div>
          <span className="text-slate-600 font-semibold block truncate">Operating Break-Even:</span>
          <div className="font-black text-emerald-700 text-sm mt-0.5 truncate">
            {timeline.operatingBreakEvenMonth != null ? `Month ${timeline.operatingBreakEvenMonth}` : 'Beyond cycle'}
          </div>
          <span className="text-[10px] text-slate-400 block truncate">When costs recover</span>
        </div>

        <div>
          <span className="text-slate-600 font-semibold block truncate">Payback Date:</span>
          <div className="font-black text-slate-950 text-sm mt-0.5 truncate">
            {timeline.paybackDate ? formatDateShort(timeline.paybackDate) : 'Not reached'}
          </div>
          <span className="text-[10px] text-slate-400 block truncate">100% principal back</span>
        </div>

        <div>
          <span className="text-slate-600 font-semibold block truncate">Ending Treasury:</span>
          <div className={`font-black text-sm mt-0.5 truncate ${isHealthyEnding ? 'text-emerald-700' : 'text-rose-600'}`}>
            {formatMoney(chartData[chartData.length - 1]?.balance || 0, !isMasked)}
          </div>
          <span className="text-[10px] text-slate-400 block truncate">
            {isHealthyEnding ? 'Net surplus profit' : 'Needs more funding'}
          </span>
        </div>
      </div>

      {/* Chart Visual Legend Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 font-bold text-indigo-900">
            <span className="w-3 h-3 rounded-full bg-indigo-600 shrink-0" />
            <span>Cumulative Cash Balance</span>
          </div>
          <div className="flex items-center gap-1.5 font-bold text-rose-600">
            <span className="w-3 h-0.5 border-t-2 border-dashed border-rose-500 shrink-0" />
            <span>$0.00 Deficit Threshold</span>
          </div>
        </div>

        <span className="text-[11px] text-slate-400 font-medium">
          Dips below red line require member capital
        </span>
      </div>

      {/* Recharts Area Chart */}
      <div className="h-64 sm:h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 15, bottom: 5 }}>
            <defs>
              <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => isMasked ? '••' : `$${Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  const isPositiveChange = (data.netChange || 0) >= 0;
                  return (
                    <div className="p-3 rounded-xl bg-slate-900 text-white text-xs shadow-xl space-y-1.5 border border-slate-700 min-w-[160px]">
                      <div className="text-[11px] text-slate-400 font-bold border-b border-slate-800 pb-1 flex items-center justify-between">
                        <span>{data.fullDate || data.date}</span>
                        {data.type && (
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${data.type === 'INFLOW' ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'
                              }`}
                          >
                            {data.type}
                          </span>
                        )}
                      </div>
                      {data.title && <div className="font-bold text-slate-100">{data.title}</div>}
                      {data.netChange !== 0 && (
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400">Cash Impact:</span>
                          <span className={`font-mono font-bold ${isPositiveChange ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {formatMoney(isPositiveChange ? data.netChange : -Math.abs(data.netChange), !isMasked)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-800">
                        <span className="text-slate-400">Treasury Balance:</span>
                        <span className="font-mono font-black text-indigo-300">{formatMoney(data.balance, !isMasked)}</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine
              y={0}
              stroke="#ef4444"
              strokeDasharray="4 4"
              label={{ value: 'Zero Deficit', fill: '#ef4444', fontSize: 10, position: 'insideBottomLeft' }}
            />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="#6366f1"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#balanceGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Chronological Milestone Schedule */}
      {hasEvents && (
        <div className="pt-2 border-t border-[#E8DFCE] space-y-2">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Chronological Cash Events Schedule ({timeline.events.length})</span>
            </h5>
            <span className="text-[11px] text-slate-500">Ordered by execution date</span>
          </div>

          <div className="divide-y divide-[#E8DFCE] border border-[#E8DFCE] rounded-xl overflow-hidden max-h-56 overflow-y-auto">
            {timeline.events.map((ev, idx) => {
              const isOut = ev.type === 'OUTFLOW';
              return (
                <div
                  key={`${ev.date}-${idx}`}
                  className="p-2.5 sm:px-3 text-xs flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span
                      className={`p-1 rounded-md shrink-0 ${isOut ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                        }`}
                    >
                      {isOut ? <ArrowDownRight className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900 truncate">{ev.title}</div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        {formatDateFull(ev.date)} {ev.isRecurring ? '• Recurring' : ''}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className={`font-mono font-bold ${isOut ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {formatMoney(isOut ? -ev.amount : ev.amount, !isMasked)}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500">
                      Balance: {formatMoney(ev.runningBalance, !isMasked)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

