import React from 'react';
import {
  FileText,
  Printer,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Award,
} from 'lucide-react';
import type { RunwayPlan, RunwayLine, RunwayFundingLayers } from '../../types/runway';
import type { ExpenseLedgerEvent, LivestockLifecycleEvent, CreditSaleEvent } from '../../types/agro';
import { buildVarianceReport, findOffPlanSpend, computeRecovery } from '../../utils/runway';

interface RunwayReportProps {
  plan: RunwayPlan;
  lines: RunwayLine[];
  expenses: ExpenseLedgerEvent[];
  livestockEvents?: LivestockLifecycleEvent[];
  creditSales?: CreditSaleEvent[];
  layers: RunwayFundingLayers;
}

export const RunwayReport: React.FC<RunwayReportProps> = ({
  plan,
  lines,
  expenses,
  livestockEvents = [],
  creditSales = [],
  layers,
}) => {
  const varianceReport = buildVarianceReport(plan, lines, expenses);
  const offPlanExpenses = findOffPlanSpend(plan, expenses);

  // Revenue for recovery
  const cashSales = livestockEvents
    .filter((e) => e.eventType === 'SALE_DISPATCH' && (e.saleRevenueAmount || 0) > 0)
    .reduce((acc, e) => acc + (e.saleRevenueAmount || 0), 0);

  const creditReceipts = creditSales.reduce((acc, cs) => {
    return acc + (cs.paymentLogs || []).reduce((pAcc, p) => pAcc + (p.amount || 0), 0);
  }, 0);

  const recovery = computeRecovery(layers.executed, cashSales, creditReceipts);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Report Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Executive Capital Variance & Recovery Report
            </h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Audit-grade reconciliation of planned allocations versus actual ground disbursements.
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-200 transition-colors cursor-pointer print:hidden"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print / Export PDF</span>
        </button>
      </div>

      {/* Break-Even Recovery Hero Badge */}
      <div
        className={`p-5 rounded-2xl border shadow-sm flex items-start space-x-4 ${recovery.isBreakEven
          ? 'bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-transparent border-emerald-300 dark:border-emerald-800'
          : 'bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent border-indigo-200 dark:border-indigo-800'
          }`}
      >
        <div
          className={`p-3 rounded-2xl ${recovery.isBreakEven
            ? 'bg-emerald-500 text-white shadow-md'
            : 'bg-indigo-600 text-white shadow-md'
            }`}
        >
          {recovery.isBreakEven ? (
            <Award className="w-6 h-6 animate-bounce" />
          ) : (
            <TrendingUp className="w-6 h-6" />
          )}
        </div>

        <div className="space-y-1 flex-1">
          <div className="flex items-center space-x-2">
            <span
              className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${recovery.isBreakEven
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                }`}
            >
              {recovery.isBreakEven ? 'Break-Even Milestone Achieved' : 'Capital Recovery in Progress'}
            </span>
          </div>

          <h4 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
            ${recovery.recoveredAmount.toLocaleString()} Recovered ({recovery.recoveredPct}% of ${layers.executed.toLocaleString()} spent)
          </h4>

          <p className="text-xs text-gray-600 dark:text-gray-400">
            {recovery.isBreakEven
              ? `The venture has fully recouped its initial capital disbursement and is generating surplus cashflow ($${recovery.surplus.toFixed(2)} net profit).`
              : `$${recovery.shortfall.toFixed(2)} remaining to achieve break-even payback on capital spent.`}
          </p>
        </div>
      </div>

      {/* Off-Plan Spend Warning List (if any) */}
      {offPlanExpenses.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-2">
          <div className="flex items-center space-x-2 text-amber-800 dark:text-amber-300 font-bold text-xs sm:text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Off-Plan Outflows Detected ({offPlanExpenses.length})</span>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            The following disbursements were executed during this plan's active lifecycle without an explicit budget step allocation:
          </p>
          <div className="divide-y divide-amber-200/50 dark:divide-amber-900/30 text-xs">
            {offPlanExpenses.map((e) => (
              <div key={e.id} className="py-2 flex items-center justify-between">
                <div>
                  <span className="font-bold text-gray-900 dark:text-white">${e.amount.toFixed(2)}</span>
                  <span className="text-gray-500 ml-2">({e.category}) {e.note}</span>
                </div>
                <span className="text-[10px] text-gray-400">{new Date(e.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plan-vs-Actual Variance Table */}
      <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <h4 className="text-sm font-bold text-gray-900 dark:text-white">
            Category Variance Reconciliation
          </h4>
        </div>

        {/* Mobile-First Card List (< sm) */}
        <div className="sm:hidden divide-y divide-gray-100 dark:divide-gray-800">
          {varianceReport.categories.map((cat) => {
            const isOver = cat.variance < 0;
            return (
              <div key={cat.category} className="p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-gray-900 dark:text-white">{cat.category}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cat.status === 'UNDER_BUDGET'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : cat.status === 'ON_TRACK'
                          ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}
                  >
                    {cat.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-2.5">
                  <div>
                    <span className="text-[10px] text-gray-500 block">Planned</span>
                    <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">
                      ${cat.planned.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 block">Actual</span>
                    <span className="font-mono font-bold text-gray-900 dark:text-white">
                      ${cat.actual.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 block">Variance</span>
                    <span
                      className={`font-mono font-bold ${isOver ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                    >
                      {cat.variance >= 0
                        ? `+$${cat.variance.toFixed(2)}`
                        : `-$${Math.abs(cat.variance).toFixed(2)}`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="p-3.5 bg-gray-50/90 dark:bg-gray-800/80 text-xs font-bold flex items-center justify-between">
            <span>Total Planned vs Actual:</span>
            <span className="font-mono">
              ${varianceReport.totals.planned.toFixed(2)} / ${varianceReport.totals.actual.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Desktop / Tablet Table (sm+) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 font-semibold border-b border-gray-100 dark:border-gray-800">
              <tr>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Planned Budget</th>
                <th className="py-3 px-4">Actual Spend</th>
                <th className="py-3 px-4">Variance ($)</th>
                <th className="py-3 px-4">Variance (%)</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {varianceReport.categories.map((cat) => {
                const isOver = cat.variance < 0;
                return (
                  <tr key={cat.category} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40">
                    <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                      {cat.category}
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
                      ${cat.planned.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-900 dark:text-white">
                      ${cat.actual.toFixed(2)}
                    </td>
                    <td
                      className={`py-3 px-4 font-bold ${isOver ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                    >
                      {cat.variance >= 0 ? `+$${cat.variance.toFixed(2)}` : `-$${Math.abs(cat.variance).toFixed(2)}`}
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-500">
                      {cat.variancePct.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cat.status === 'UNDER_BUDGET'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : cat.status === 'ON_TRACK'
                            ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                      >
                        {cat.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50/80 dark:bg-gray-800/80 font-bold border-t border-gray-200 dark:border-gray-700">
              <tr>
                <td className="py-3 px-4">Totals</td>
                <td className="py-3 px-4">${varianceReport.totals.planned.toFixed(2)}</td>
                <td className="py-3 px-4">${varianceReport.totals.actual.toFixed(2)}</td>
                <td
                  className={`py-3 px-4 ${varianceReport.totals.variance < 0 ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                >
                  {varianceReport.totals.variance >= 0
                    ? `+$${varianceReport.totals.variance.toFixed(2)}`
                    : `-$${Math.abs(varianceReport.totals.variance).toFixed(2)}`}
                </td>
                <td className="py-3 px-4">
                  {varianceReport.totals.variancePct.toFixed(1)}%
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${varianceReport.totals.status === 'UNDER_BUDGET'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                      }`}
                  >
                    {varianceReport.totals.status.replace('_', ' ')}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
