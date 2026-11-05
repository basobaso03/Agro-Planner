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
  // Revenue for recovery (scoped strictly to this plan's active lifecycle & organization)
  const planStart = new Date(plan.activatedAt || plan.startDate).getTime();
  const planEnd = plan.completedAt ? new Date(plan.completedAt).getTime() : Infinity;

  const cashSales = livestockEvents
    .filter((e) => {
      if (e.eventType !== 'SALE_DISPATCH' || !(e.saleRevenueAmount && e.saleRevenueAmount > 0)) return false;
      if (e.orgId && plan.orgId && e.orgId !== plan.orgId) return false;
      if (plan.locationId && plan.locationId !== 'ALL' && e.locationId && e.locationId !== plan.locationId) return false;
      const t = new Date(e.createdAt || (e as any).timestamp).getTime();
      return t >= planStart && t <= planEnd;
    })
    .reduce((acc, e) => acc + (e.saleRevenueAmount || 0), 0);

  const creditReceipts = creditSales.reduce((acc, cs) => {
    if (cs.orgId && plan.orgId && cs.orgId !== plan.orgId) return acc;
    if (plan.locationId && plan.locationId !== 'ALL' && cs.locationId && cs.locationId !== plan.locationId) return acc;
    return (
      acc +
      (cs.paymentLogs || [])
        .filter((p) => {
          const t = new Date(p.paidAt).getTime();
          return t >= planStart && t <= planEnd;
        })
        .reduce((pAcc, p) => pAcc + (p.amount || 0), 0)
    );
  }, 0);

  const varianceReport = buildVarianceReport(plan, lines, expenses, [], cashSales, creditReceipts);
  const offPlanExpenses = findOffPlanSpend(plan, expenses);
  const recovery = computeRecovery(layers.executed, cashSales, creditReceipts);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Report Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-[#E8DFCE] shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-emerald-700" />
            <h3 className="text-base font-black text-slate-950">
              Executive Capital Variance & Recovery Report
            </h3>
          </div>
          <p className="text-xs text-slate-600 font-medium">
            Audit-grade reconciliation of planned allocations versus actual ground disbursements.
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-[#E8DFCE] hover:bg-stone-50 text-xs font-bold text-slate-900 transition-colors cursor-pointer print:hidden"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print / Export PDF</span>
        </button>
      </div>

      {/* Break-Even Recovery Hero Badge */}
      <div
        className={`p-5 rounded-2xl border shadow-xs flex items-start space-x-4 ${recovery.isBreakEven
          ? 'bg-emerald-50/70 border-emerald-200'
          : 'bg-[#FAF8F5] border-[#E8DFCE]'
          }`}
      >
        <div
          className={`p-3 rounded-2xl ${recovery.isBreakEven
            ? 'bg-emerald-600 text-white shadow-xs'
            : 'bg-emerald-700 text-white shadow-xs'
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
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-emerald-100 text-emerald-900'
                }`}
            >
              {recovery.isBreakEven ? 'Break-Even Milestone Achieved' : 'Capital Recovery in Progress'}
            </span>
          </div>

          <h4 className="text-base sm:text-lg font-black text-slate-950">
            ${recovery.recoveredAmount.toLocaleString()} Recovered ({recovery.recoveredPct}% of ${layers.executed.toLocaleString()} spent)
          </h4>

          <p className="text-xs text-slate-600 font-medium">
            {recovery.isBreakEven
              ? `The venture has fully recouped its initial capital disbursement and is generating surplus cashflow ($${recovery.surplus.toFixed(2)} net profit).`
              : `$${recovery.shortfall.toFixed(2)} remaining to achieve break-even payback on capital spent.`}
          </p>
        </div>
      </div>

      {/* Off-Plan Spend Warning List (if any) */}
      {offPlanExpenses.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
          <div className="flex items-center space-x-2 text-amber-900 font-bold text-xs sm:text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Off-Plan Outflows Detected ({offPlanExpenses.length})</span>
          </div>
          <p className="text-xs text-slate-600 font-medium">
            The following disbursements were executed during this plan's active lifecycle without an explicit budget step allocation:
          </p>
          <div className="divide-y divide-amber-200/60 text-xs">
            {offPlanExpenses.map((e) => (
              <div key={e.id} className="py-2 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-950">${e.amount.toFixed(2)}</span>
                  <span className="text-slate-600 ml-2">({e.category}) {e.note}</span>
                </div>
                <span className="text-[10px] text-slate-500 font-semibold">{new Date(e.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plan-vs-Actual Variance Table */}
      <div className="rounded-2xl bg-white border border-[#E8DFCE] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E8DFCE]">
          <h4 className="text-sm font-black text-slate-950">
            Category Variance Reconciliation
          </h4>
        </div>

        {/* Mobile-First Card List (< sm) */}
        <div className="sm:hidden divide-y divide-[#E8DFCE]">
          {varianceReport.categories.map((cat) => {
            const isOver = cat.variance < 0;
            return (
              <div key={cat.category} className="p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-950">{cat.category}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cat.status === 'UNDER_BUDGET'
                      ? 'bg-emerald-100 text-emerald-800'
                      : cat.status === 'ON_TRACK'
                        ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                        : 'bg-rose-100 text-rose-800'
                      }`}
                  >
                    {cat.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 bg-[#FAF8F5] border border-[#E8DFCE] rounded-xl p-2.5">
                  <div>
                    <span className="text-[10px] text-slate-600 block font-semibold">Planned</span>
                    <span className="font-mono font-bold text-slate-950">
                      ${cat.planned.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-600 block font-semibold">Actual</span>
                    <span className="font-mono font-black text-slate-950">
                      ${cat.actual.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-600 block font-semibold">Variance</span>
                    <span
                      className={`font-mono font-bold ${isOver ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                    >
                      {cat.variance >= 0
                        ? `+$${cat.variance.toFixed(2)}`
                        : `-$${Math.abs(cat.variance).toFixed(2)}`}
                      <span className="block text-[10px] opacity-80 font-normal">
                        {cat.variancePct >= 0 ? `+${cat.variancePct.toFixed(1)}%` : `${cat.variancePct.toFixed(1)}%`}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="p-3.5 bg-[#FAF8F5] text-xs font-black text-slate-950 flex items-center justify-between border-t border-[#E8DFCE]">
            <span>Total Planned vs Actual:</span>
            <span className="font-mono font-bold">
              ${varianceReport.totals.planned.toFixed(2)} / ${varianceReport.totals.actual.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Desktop / Tablet Table (sm+) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF8F5] text-slate-600 font-bold border-b border-[#E8DFCE]">
              <tr>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Planned Budget</th>
                <th className="py-3 px-4">Actual Spend</th>
                <th className="py-3 px-4">Variance ($)</th>
                <th className="py-3 px-4">Variance (%)</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DFCE]">
              {varianceReport.categories.map((cat) => {
                const isOver = cat.variance < 0;
                return (
                  <tr key={cat.category} className="hover:bg-stone-50/50">
                    <td className="py-3 px-4 font-bold text-slate-950">
                      {cat.category}
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-semibold">
                      ${cat.planned.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-950">
                      ${cat.actual.toFixed(2)}
                    </td>
                    <td
                      className={`py-3 px-4 font-bold ${isOver ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                    >
                      {cat.variance >= 0 ? `+$${cat.variance.toFixed(2)}` : `-$${Math.abs(cat.variance).toFixed(2)}`}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-600">
                      {cat.variancePct >= 0 ? `+${cat.variancePct.toFixed(1)}%` : `${cat.variancePct.toFixed(1)}%`}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cat.status === 'UNDER_BUDGET'
                          ? 'bg-emerald-100 text-emerald-800'
                          : cat.status === 'ON_TRACK'
                            ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                            : 'bg-rose-100 text-rose-800'
                          }`}
                      >
                        {cat.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-[#FAF8F5] font-black text-slate-950 border-t border-[#E8DFCE]">
              <tr>
                <td className="py-3 px-4">Totals</td>
                <td className="py-3 px-4">${varianceReport.totals.planned.toFixed(2)}</td>
                <td className="py-3 px-4">${varianceReport.totals.actual.toFixed(2)}</td>
                <td
                  className={`py-3 px-4 font-black ${varianceReport.totals.variance < 0 ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                >
                  {varianceReport.totals.variance >= 0
                    ? `+$${varianceReport.totals.variance.toFixed(2)}`
                    : `-$${Math.abs(varianceReport.totals.variance).toFixed(2)}`}
                </td>
                <td className="py-3 px-4">
                  {varianceReport.totals.variancePct >= 0
                    ? `+${varianceReport.totals.variancePct.toFixed(1)}%`
                    : `${varianceReport.totals.variancePct.toFixed(1)}%`}
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
