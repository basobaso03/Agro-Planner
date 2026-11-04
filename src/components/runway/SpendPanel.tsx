import React, { useState } from 'react';
import {
  Layers,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  PlusCircle,
  FileEdit,
} from 'lucide-react';
import type {
  RunwayPlan,
  RunwayLine,
  RunwayLineStatus,
  RunwayFundingLayers,
} from '../../types/runway';
import type { ExpenseLedgerEvent, OrgMember } from '../../types/agro';
import { deriveLineStatuses } from '../../utils/runway';
import { PERMISSIONS } from '../../utils/permissions';
import { CountUp } from './CountUp';

interface SpendPanelProps {
  plan: RunwayPlan;
  lines: RunwayLine[];
  expenses: ExpenseLedgerEvent[];
  layers: RunwayFundingLayers;
  currentMember: OrgMember;
  onRecordExpense: () => void;
  onProposeAmendment: () => void;
  readOnly?: boolean;
}

export const SpendPanel: React.FC<SpendPanelProps> = ({
  plan,
  lines,
  expenses,
  layers,
  currentMember,
  onRecordExpense,
  onProposeAmendment,
  readOnly = false,
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  const canSpend = PERMISSIONS.canSpendAgainstPlan(currentMember.role);
  const canPropose = PERMISSIONS.canProposeAmendment(currentMember.role);

  const derivedStatuses = deriveLineStatuses(lines, expenses);
  const planExpenses = expenses.filter((e) => e.runwayPlanId === plan.id);
  const reserveDraws = planExpenses.filter((e) => (e.runwayReserveDraw || 0) > 0);

  const costLines = lines.filter((l) => l.kind === 'COST');
  const filteredLines =
    filterCategory === 'ALL'
      ? costLines
      : costLines.filter((l) => l.category === filterCategory);

  const categories = Array.from(new Set(costLines.map((l) => l.category)));

  return (
    <div className="space-y-6">
      {/* Top Execution Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs">
        <div>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            Total Capital Target
          </span>
          <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mt-0.5">
            <CountUp value={layers.totalRequirement} />
          </div>
        </div>

        <div>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            Disbursed Spend
          </span>
          <div className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
            <CountUp value={layers.executed} />
          </div>
          <span className="text-[11px] text-gray-400">{layers.executedPct}% of budget spent</span>
        </div>

        <div>
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
            Reserve Buffer Left
          </span>
          <div className="text-lg sm:text-xl font-bold text-amber-700 dark:text-amber-300 mt-0.5">
            <CountUp value={layers.reserveLeft} />
          </div>
          <span className="text-[11px] text-gray-400">
            ${layers.reserveUsed.toFixed(0)} used for overruns
          </span>
        </div>

        <div>
          <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            Remaining Budget
          </span>
          <div className="text-lg sm:text-xl font-bold text-indigo-700 dark:text-indigo-300 mt-0.5">
            <CountUp value={Math.max(0, layers.totalRequirement - layers.executed)} />
          </div>
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
                    ${(d.runwayReserveDraw || 0).toFixed(2)}
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

      {/* Lines Spend Execution Table */}
      <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h4 className="text-sm font-bold text-gray-900 dark:text-white">
              Line-Item Spend Execution
            </h4>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <button
              onClick={() => setFilterCategory('ALL')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                filterCategory === 'ALL'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  filterCategory === cat
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-800/80">
          {filteredLines.map((line) => {
            const statusInfo = derivedStatuses.get(line.id);
            const plannedTotal = statusInfo?.cost ?? statusInfo?.plannedTotal ?? line.qty * line.unitCost;
            const spent = statusInfo?.spent || 0;
            const remaining = statusInfo?.remaining || 0;
            const status = statusInfo?.status || 'PLANNED';

            const statusColors: Record<string, string> = {
              PAID: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
              PARTIAL: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
              OVERRUN: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 animate-pulse',
              PLANNED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
            };

            const pctSpent = plannedTotal > 0 ? Math.min(100, Math.round((spent / plannedTotal) * 100)) : 0;

            return (
              <div
                key={line.id}
                className="p-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors space-y-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-gray-900 dark:text-white">
                        {line.title}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                          statusColors[status] || statusColors.PLANNED
                        }`}
                      >
                        {status}
                      </span>
                    </div>

                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Budget: ${plannedTotal.toFixed(2)} • Spent: ${spent.toFixed(2)} • Left: ${remaining.toFixed(2)}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {pctSpent}%
                    </span>
                  </div>
                </div>

                {/* Micro progress bar */}
                <div className="w-full h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      spent > plannedTotal
                        ? 'bg-rose-500'
                        : status === 'PAID'
                        ? 'bg-emerald-500'
                        : 'bg-indigo-600'
                    }`}
                    style={{ width: `${pctSpent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Footer */}
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          {canPropose && (
            <button
              onClick={onProposeAmendment}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
            >
              <FileEdit className="w-4 h-4 text-indigo-500" />
              <span>Propose Plan Amendment</span>
            </button>
          )}

          {canSpend && (
            <button
              onClick={onRecordExpense}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Record Allocated Expense</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
