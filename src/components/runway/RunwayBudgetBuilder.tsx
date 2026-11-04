import React, { useState } from 'react';
import {
  Plus,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  ShieldAlert,
  Sparkles,
  Lock,
  BookmarkPlus,
  Layers,
  ChevronDown,
} from 'lucide-react';
import type {
  RunwayPlan,
  RunwayLine,
  ContingencyMode,
} from '../../types/runway';
import type { ExpenseLedgerEvent, OrgMember } from '../../types/agro';
import { computePlanTotals } from '../../utils/runway';
import { RunwayLineSheet } from './RunwayLineSheet';
import { CountUp } from './CountUp';

interface RunwayBudgetBuilderProps {
  plan: RunwayPlan;
  lines: RunwayLine[];
  currentMember: OrgMember;
  pastExpenses?: ExpenseLedgerEvent[];
  onUpsertLine: (line: Partial<RunwayLine> & {
    title: string;
    category: string;
    qty: number;
    unitCost: number;
  }) => void;
  onRemoveLine: (lineId: string) => void;
  onReorderLines: (lineIdsInOrder: string[]) => void;
  onUpdateReserve: (mode: ContingencyMode, value: number) => void;
  onLockPlan?: () => void;
  onSaveAsTemplate?: (templateName: string) => void;
  readOnly?: boolean;
}

export const RunwayBudgetBuilder: React.FC<RunwayBudgetBuilderProps> = ({
  plan,
  lines,
  currentMember,
  pastExpenses = [],
  onUpsertLine,
  onRemoveLine,
  onReorderLines,
  onUpdateReserve,
  onLockPlan,
  onSaveAsTemplate,
  readOnly = false,
}) => {
  const [editingLine, setEditingLine] = useState<RunwayLine | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState<boolean>(false);
  const [templateModalOpen, setTemplateModalOpen] = useState<boolean>(false);
  const [templateName, setTemplateName] = useState<string>('');

  const totals = computePlanTotals(plan, lines);
  const isDraft = plan.status === 'DRAFT';

  const handleMove = (index: number, direction: 'UP' | 'DOWN') => {
    if (readOnly || !isDraft) return;
    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= lines.length) return;

    const newOrder = [...lines];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIdx];
    newOrder[targetIdx] = temp;

    onReorderLines(newOrder.map((l) => l.id));
  };

  return (
    <div className="space-y-5">
      {/* Live Financial Totals Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs">
        <div>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            Cost Baseline
          </span>
          <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mt-0.5">
            <CountUp value={totals.costTotal} />
          </div>
        </div>

        <div>
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5" /> Contingency
          </span>
          <div className="text-lg sm:text-xl font-bold text-amber-700 dark:text-amber-300 mt-0.5">
            +<CountUp value={totals.contingencyReserve} />
          </div>
        </div>

        <div>
          <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            Total Capital Target
          </span>
          <div className="text-lg sm:text-xl font-extrabold text-indigo-700 dark:text-indigo-300 mt-0.5">
            <CountUp value={totals.totalRequirement} />
          </div>
        </div>

        <div>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            Expected Revenue
          </span>
          <div className="text-lg sm:text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
            <CountUp value={totals.expectedIncome} />
          </div>
        </div>
      </div>

      {/* Contingency Configuration (Draft only) */}
      {isDraft && !readOnly && (
        <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h4 className="text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-200">
                Contingency Buffer Reserve Configuration
              </h4>
            </div>

            <div className="flex items-center space-x-1 p-0.5 rounded-lg bg-amber-200/50 dark:bg-amber-900/50 text-xs">
              <button
                type="button"
                onClick={() => onUpdateReserve('PERCENT', plan.contingencyPercent ?? 10)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                  plan.contingencyMode === 'PERCENT'
                    ? 'bg-white dark:bg-gray-800 text-amber-900 dark:text-amber-100 shadow-xs'
                    : 'text-amber-800 dark:text-amber-300'
                }`}
              >
                Percentage (%)
              </button>
              <button
                type="button"
                onClick={() => onUpdateReserve('FIXED', plan.contingencyFixedAmount ?? 100)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                  plan.contingencyMode === 'FIXED'
                    ? 'bg-white dark:bg-gray-800 text-amber-900 dark:text-amber-100 shadow-xs'
                    : 'text-amber-800 dark:text-amber-300'
                }`}
              >
                Fixed Dollar ($)
              </button>
            </div>
          </div>

          {plan.contingencyMode === 'PERCENT' ? (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-amber-900 dark:text-amber-300">
                <span>Buffer Rate: {plan.contingencyPercent ?? 10}%</span>
                <span>${totals.contingencyReserve.toFixed(2)} added to target</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="1"
                value={plan.contingencyPercent ?? 10}
                onChange={(e) => onUpdateReserve('PERCENT', parseInt(e.target.value) || 0)}
                className="w-full accent-amber-600"
              />
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <div className="relative flex-1 max-w-xs">
                <span className="absolute left-3 top-2 text-xs font-bold text-gray-500">$</span>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={plan.contingencyFixedAmount ?? 0}
                  onChange={(e) => onUpdateReserve('FIXED', parseFloat(e.target.value) || 0)}
                  className="w-full pl-6 pr-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-800 text-xs font-semibold"
                />
              </div>
              <span className="text-xs text-amber-800 dark:text-amber-300">
                Fixed cash cushion locked for emergency draws
              </span>
            </div>
          )}
        </div>
      )}

      {/* Lines Table / List */}
      <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h4 className="text-sm font-bold text-gray-900 dark:text-white">
              Budget Steps & Capital Lines ({lines.length})
            </h4>
          </div>

          {isDraft && !readOnly && (
            <button
              onClick={() => {
                setEditingLine(null);
                setIsSheetOpen(true);
              }}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Line</span>
            </button>
          )}
        </div>

        {lines.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <Sparkles className="w-8 h-8 text-indigo-400 mx-auto" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              No budget lines configured yet
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              Add your feed, livestock, equipment, or labor requirements to compute your total runway.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800/80">
            {lines.map((line, idx) => {
              const isIncome = line.kind === 'INCOME';
              const lineCost = line.qty * line.unitCost;
              return (
                <div
                  key={line.id}
                  className="flex items-center justify-between p-3.5 sm:p-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors gap-3"
                >
                  {/* Left: Reorder controls + details */}
                  <div className="flex items-center space-x-3 min-w-0">
                    {isDraft && !readOnly && (
                      <div className="flex flex-col space-y-0.5">
                        <button
                          disabled={idx === 0}
                          onClick={() => handleMove(idx, 'UP')}
                          className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={idx === lines.length - 1}
                          onClick={() => handleMove(idx, 'DOWN')}
                          className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            isIncome
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {isIncome ? 'INFLOW' : 'COST'}
                        </span>

                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          {line.category}
                        </span>

                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium">
                          {line.priority}
                        </span>
                      </div>

                      <h5 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                        {line.title}
                      </h5>

                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {line.qty} {line.unitLabel || 'units'} × ${line.unitCost.toFixed(2)}
                        {line.recurrence && (
                          <span className="ml-1 text-indigo-600 dark:text-indigo-400">
                            (×{line.recurrence.occurrences} cycles every {line.recurrence.everyDays}d)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Right: Subtotal & Actions */}
                  <div className="flex items-center space-x-3 shrink-0">
                    <span
                      className={`text-sm sm:text-base font-bold ${
                        isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      {isIncome ? '+' : ''}${lineCost.toFixed(2)}
                    </span>

                    {isDraft && !readOnly && (
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => {
                            setEditingLine(line);
                            setIsSheetOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onRemoveLine(line.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        {onSaveAsTemplate && (
          <button
            onClick={() => setTemplateModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-semibold transition-colors cursor-pointer"
          >
            <BookmarkPlus className="w-4 h-4 text-indigo-500" />
            <span>Save Plan as Template</span>
          </button>
        )}

        {isDraft && !readOnly && onLockPlan && (
          <button
            onClick={onLockPlan}
            disabled={lines.length === 0}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs sm:text-sm font-bold shadow-md transition-all ml-auto disabled:opacity-50 cursor-pointer active:scale-95"
          >
            <Lock className="w-4 h-4" />
            <span>Lock Plan & Open Pledges</span>
          </button>
        )}
      </div>

      {/* Line Edit Bottom Sheet */}
      <RunwayLineSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        existingLine={editingLine}
        pastExpenses={pastExpenses}
        onSave={onUpsertLine}
        onDelete={onRemoveLine}
      />

      {/* Save Template Modal */}
      {templateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 space-y-4 shadow-2xl">
            <h4 className="text-base font-bold text-gray-900 dark:text-white">
              Save Plan as Organization Template
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Future ventures can instantiate this pre-built line budget with one tap.
            </p>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. Standard 500 Broiler Cycle"
              className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-900 dark:text-white"
            />
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setTemplateModalOpen(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-500"
              >
                Cancel
              </button>
              <button
                disabled={!templateName.trim()}
                onClick={() => {
                  onSaveAsTemplate?.(templateName.trim());
                  setTemplateModalOpen(false);
                  setTemplateName('');
                }}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold disabled:opacity-50"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

