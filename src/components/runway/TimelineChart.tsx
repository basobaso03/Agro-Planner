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
} from 'lucide-react';
import type { RunwayPlan, RunwayLine } from '../../types/runway';
import { buildCashTimeline } from '../../utils/runway';

interface TimelineChartProps {
  plan: RunwayPlan;
  lines: RunwayLine[];
  openingCash?: number;
}

export const TimelineChart: React.FC<TimelineChartProps> = ({
  plan,
  lines,
  openingCash = 0,
}) => {
  const [costIncreasePct, setCostIncreasePct] = useState<number>(0);
  const [incomeHaircutPct, setIncomeHaircutPct] = useState<number>(0);
  const [incomeDelayMonths, setIncomeDelayMonths] = useState<number>(0);
  const [showStressSliders, setShowStressSliders] = useState<boolean>(false);

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
      return [{ date: 'Start', balance: openingCash, netChange: 0 }];
    }
    return [
      { date: 'Day 0', balance: openingCash, netChange: 0 },
      ...timeline.events.map((ev) => ({
        date: ev.date.slice(5),
        balance: ev.runningBalance,
        netChange: ev.netChange,
        title: ev.title,
      })),
    ];
  }, [timeline, openingCash]);

  const minBalance = Math.min(...chartData.map((d) => d.balance));

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h4 className="text-sm font-bold text-gray-900 dark:text-white">
              Projected Cash Timeline & Peak Capital Need
            </h4>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Dynamic cumulative cash balance based on step planned dates and recurring cycles.
          </p>
        </div>

        <button
          onClick={() => setShowStressSliders(!showStressSliders)}
          className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
            showStressSliders || costIncreasePct > 0 || incomeHaircutPct > 0
              ? 'border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
              : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Stress-Test Model</span>
        </button>
      </div>

      {/* Stress Test Controls Drawer */}
      {showStressSliders && (
        <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-amber-950 dark:text-amber-200">
            <span>What-If Scenario Sliders</span>
            {(costIncreasePct > 0 || incomeHaircutPct > 0 || incomeDelayMonths > 0) && (
              <button
                onClick={() => {
                  setCostIncreasePct(0);
                  setIncomeHaircutPct(0);
                  setIncomeDelayMonths(0);
                }}
                className="text-amber-700 dark:text-amber-400 underline font-medium"
              >
                Reset to Base
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <div className="flex justify-between text-gray-700 dark:text-gray-300 mb-1">
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
                className="w-full accent-rose-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-gray-700 dark:text-gray-300 mb-1">
                <span>Revenue Haircut</span>
                <span className="font-bold text-amber-600">-{incomeHaircutPct}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="40"
                step="5"
                value={incomeHaircutPct}
                onChange={(e) => setIncomeHaircutPct(parseInt(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-gray-700 dark:text-gray-300 mb-1">
                <span>Revenue Delay</span>
                <span className="font-bold text-indigo-600">+{incomeDelayMonths} Mo</span>
              </div>
              <input
                type="range"
                min="0"
                max="3"
                step="1"
                value={incomeDelayMonths}
                onChange={(e) => setIncomeDelayMonths(parseInt(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* KPI Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 text-xs">
        <div>
          <span className="text-gray-500">Peak Capital Need:</span>
          <div className="font-extrabold text-rose-600 dark:text-rose-400 text-sm">
            ${timeline.peakNeed.toFixed(2)}
          </div>
        </div>

        <div>
          <span className="text-gray-500">Operating Break-Even:</span>
          <div className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
            {timeline.operatingBreakEvenMonth != null
              ? `Month ${timeline.operatingBreakEvenMonth}`
              : 'Beyond cycle'}
          </div>
        </div>

        <div>
          <span className="text-gray-500">Payback Date:</span>
          <div className="font-bold text-gray-900 dark:text-white text-sm">
            {timeline.paybackDate || 'Not reached'}
          </div>
        </div>

        <div>
          <span className="text-gray-500">Ending Cash:</span>
          <div
            className={`font-bold text-sm ${
              chartData[chartData.length - 1]?.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            ${(chartData[chartData.length - 1]?.balance || 0).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Recharts Area Chart */}
      <div className="h-64 sm:h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(val: unknown) => [
                `$${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                'Running Cash',
              ]}
              labelFormatter={(lbl) => `Date: ${lbl}`}
              contentStyle={{
                backgroundColor: 'rgba(17, 24, 39, 0.95)',
                color: '#fff',
                borderRadius: '0.75rem',
                border: 'none',
                fontSize: '12px',
              }}
            />
            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
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
    </div>
  );
};

