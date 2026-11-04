import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, Trash2, Check, Calculator } from 'lucide-react';
import type {
  RunwayLine,
  RunwayLineKind,
  RunwayLinePriority,
} from '../../types/runway';
import type { ExpenseLedgerEvent } from '../../types/agro';
import { suggestUnitCosts } from '../../utils/runway';
import { useBackHandler } from '../../navigation/useBackHandler';

interface RunwayLineSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (lineData: Partial<RunwayLine> & {
    title: string;
    category: string;
    qty: number;
    unitCost: number;
  }) => void;
  onDelete?: (lineId: string) => void;
  existingLine?: RunwayLine | null;
  pastExpenses?: ExpenseLedgerEvent[];
}

export const RunwayLineSheet: React.FC<RunwayLineSheetProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  existingLine,
  pastExpenses = [],
}) => {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<RunwayLineKind>('COST');
  const [category, setCategory] = useState<string>('FEED');
  const [qtyStr, setQtyStr] = useState<string>('');
  const [totalPriceStr, setTotalPriceStr] = useState<string>('');
  const [unitLabel, setUnitLabel] = useState<string>('units');
  const [priority, setPriority] = useState<RunwayLinePriority>('ESSENTIAL');
  const [excludeFromContingency, setExcludeFromContingency] = useState<boolean>(false);
  const [plannedDate, setPlannedDate] = useState<string>('');
  const [confidencePct, setConfidencePct] = useState<number>(100);

  // Recurrence
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [everyDays, setEveryDays] = useState<number>(30);
  const [occurrences, setOccurrences] = useState<number>(1);

  useBackHandler(
    100,
    () => {
      if (!isOpen) return false;
      onClose();
      return true;
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    if (existingLine) {
      setTitle(existingLine.title);
      setKind(existingLine.kind || 'COST');
      setCategory(existingLine.category || 'FEED');
      const q = existingLine.qty || 1;
      const u = existingLine.unitCost || 0;
      setQtyStr(String(q));
      setTotalPriceStr(String(Number((q * u).toFixed(2))));
      setUnitLabel(existingLine.unitLabel || 'units');
      setPriority(existingLine.priority || 'ESSENTIAL');
      setExcludeFromContingency(Boolean(existingLine.excludeFromContingency));
      setPlannedDate(existingLine.plannedDate || '');
      setConfidencePct(existingLine.confidencePct ?? 100);
      if (existingLine.recurrence) {
        setIsRecurring(true);
        setEveryDays(existingLine.recurrence.everyDays);
        setOccurrences(existingLine.recurrence.occurrences);
      } else {
        setIsRecurring(false);
      }
    } else {
      setTitle('');
      setKind('COST');
      setCategory('FEED');
      setQtyStr('');
      setTotalPriceStr('');
      setUnitLabel('units');
      setPriority('ESSENTIAL');
      setExcludeFromContingency(false);
      setPlannedDate(new Date().toISOString().slice(0, 10));
      setConfidencePct(100);
      setIsRecurring(false);
    }
  }, [existingLine, isOpen]);

  if (!isOpen) return null;

  const parsedQty = parseFloat(qtyStr);
  const parsedTotal = parseFloat(totalPriceStr);
  const validQty = Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 0;
  const validTotal = Number.isFinite(parsedTotal) && parsedTotal >= 0 ? parsedTotal : 0;
  const autoUnitCost = validQty > 0 ? validTotal / validQty : 0;

  const costSuggestions = suggestUnitCosts(category, pastExpenses || []);
  const lineTotal = validTotal * (isRecurring ? occurrences || 1 : 1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || validQty <= 0 || validTotal <= 0) return;

    onSave({
      id: existingLine?.id,
      title: title.trim(),
      kind,
      category,
      qty: Number(validQty),
      unitCost: Number((validTotal / validQty).toFixed(4)),
      unitLabel: unitLabel.trim() || undefined,
      priority,
      excludeFromContingency,
      plannedDate: plannedDate || undefined,
      confidencePct: kind === 'INCOME' ? Number(confidencePct) : undefined,
      recurrence: isRecurring
        ? {
          everyDays: Number(everyDays) || 30,
          occurrences: Number(occurrences) || 1,
        }
        : undefined,
    });

    onClose();
  };

  const categories = [
    'FEED',
    'EQUIPMENT',
    'LIVESTOCK',
    'MEDICINE',
    'LABOR',
    'UTILITIES',
    'TRANSPORT',
    'MAINTENANCE',
    'SALES_INCOME',
    'OTHER',
  ];

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-xs px-2 py-2 sm:p-4 pt-safe pb-safe animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl max-h-[calc(100dvh-1.5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] sm:max-h-[88dvh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            {existingLine ? 'Edit Budget Line' : 'Add Plan Budget Line'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3.5">
          {/* Kind Segmented Control */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-gray-100 dark:bg-gray-800">
            <button
              type="button"
              onClick={() => setKind('COST')}
              className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${kind === 'COST'
                  ? 'bg-white dark:bg-gray-700 text-rose-600 dark:text-rose-300 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
            >
              Cost Outflow
            </button>
            <button
              type="button"
              onClick={() => setKind('INCOME')}
              className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${kind === 'INCOME'
                  ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-300 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
            >
              Expected Revenue Inflow
            </button>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Line Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 500x Broiler Day-Old Chicks"
              className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          {/* Category & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as RunwayLinePriority)}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ESSENTIAL">Essential (Must Have)</option>
                <option value="IMPORTANT">Important (Should Have)</option>
                <option value="NICE_TO_HAVE">Nice to Have</option>
              </select>
            </div>
          </div>

          {/* Items Bought (Qty), Total Price ($), Unit Label */}
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Items (Qty) *
              </label>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="any"
                required
                placeholder="e.g. 100"
                value={qtyStr}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setQtyStr(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Total Price ($) *
              </label>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                required
                placeholder="e.g. 150.00"
                value={totalPriceStr}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setTotalPriceStr(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Unit Label
              </label>
              <input
                type="text"
                value={unitLabel}
                onChange={(e) => setUnitLabel(e.target.value)}
                placeholder="chick, bag, kg"
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              />
            </div>
          </div>

          {/* Smart Cost Suggestion Chip */}
          {costSuggestions !== null && (
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
              <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1 mb-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Past Org Spend Benchmark:
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const q = validQty > 0 ? validQty : 1;
                    if (validQty <= 0) setQtyStr('1');
                    setTotalPriceStr(String(Number((q * costSuggestions).toFixed(2))));
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700/60 text-xs font-medium text-amber-900 dark:text-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  Apply Benchmark: ${costSuggestions.toFixed(2)} / unit
                </button>
              </div>
            </div>
          )}

          {/* Planned Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Planned Date
              </label>
              <input
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              />
            </div>

            {kind === 'INCOME' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Confidence ({confidencePct}%)
                </label>
                <input
                  type="range"
                  min="20"
                  max="100"
                  step="5"
                  value={confidencePct}
                  onChange={(e) => setConfidencePct(parseInt(e.target.value))}
                  className="w-full mt-2"
                />
              </div>
            )}
          </div>

          {/* Recurrence Toggle */}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="rounded-md border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Recurring Expense (e.g. Monthly Labor, Feed refills)
              </span>
            </label>

            {isRecurring && (
              <div className="grid grid-cols-2 gap-3 mt-2.5 pl-6">
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">Repeat Every (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={everyDays}
                    onChange={(e) => setEveryDays(parseInt(e.target.value) || 30)}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">Total Cycles</label>
                  <input
                    type="number"
                    min="1"
                    value={occurrences}
                    onChange={(e) => setOccurrences(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Contingency exclusion */}
          {kind === 'COST' && (
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={excludeFromContingency}
                onChange={(e) => setExcludeFromContingency(e.target.checked)}
                className="rounded-md border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Exclude from contingency reserve calculation (e.g. fixed capital asset)
              </span>
            </label>
          )}

          {/* Auto-calculated Unit Cost & Subtotal preview banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-900/40">
            <div className="flex items-center space-x-1.5 text-xs text-indigo-700 dark:text-indigo-300 font-medium">
              <Calculator className="w-4 h-4 shrink-0" />
              <span>
                Auto Unit Cost: <strong>${autoUnitCost.toFixed(2)}/{unitLabel || 'unit'}</strong>
              </span>
            </div>
            <span className="text-sm sm:text-base font-bold font-mono text-indigo-900 dark:text-indigo-100">
              Total: ${lineTotal.toFixed(2)}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            {existingLine && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  onDelete(existingLine.id);
                  onClose();
                }}
                className="px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-colors flex items-center space-x-1 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Remove</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Save Line</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    const portalRoot = document.getElementById('sheet-root') || document.body;
    return createPortal(modalContent, portalRoot);
  }

  return modalContent;
};
