import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, Trash2, Check, Calculator, Building2 } from 'lucide-react';
import type {
  RunwayLine,
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
  const [category, setCategory] = useState<string>('FEED');
  const [qtyStr, setQtyStr] = useState<string>('');
  const [totalPriceStr, setTotalPriceStr] = useState<string>('');
  const [unitLabel, setUnitLabel] = useState<string>('units');
  const [priority, setPriority] = useState<RunwayLinePriority>('ESSENTIAL');
  const [excludeFromContingency, setExcludeFromContingency] = useState<boolean>(false);
  const [plannedDate, setPlannedDate] = useState<string>('');

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
      setCategory(existingLine.category || 'FEED');
      const q = existingLine.qty || 1;
      const u = existingLine.unitCost || 0;
      setQtyStr(String(q));
      setTotalPriceStr(String(Number((q * u).toFixed(2))));
      setUnitLabel(existingLine.unitLabel || 'units');
      setPriority(existingLine.priority || 'ESSENTIAL');
      setExcludeFromContingency(Boolean(existingLine.excludeFromContingency));
      setPlannedDate(existingLine.plannedDate || '');
      if (existingLine.recurrence) {
        setIsRecurring(true);
        setEveryDays(existingLine.recurrence.everyDays);
        setOccurrences(existingLine.recurrence.occurrences);
      } else {
        setIsRecurring(false);
      }
    } else {
      setTitle('');
      setCategory('FEED');
      setQtyStr('');
      setTotalPriceStr('');
      setUnitLabel('units');
      setPriority('ESSENTIAL');
      setExcludeFromContingency(false);
      setPlannedDate(new Date().toISOString().slice(0, 10));
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
      kind: 'COST',
      category,
      qty: Number(validQty),
      unitCost: Number((validTotal / validQty).toFixed(4)),
      unitLabel: unitLabel.trim() || undefined,
      priority,
      excludeFromContingency,
      plannedDate: plannedDate || undefined,
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
    'SUPPLIES',
    'OTHER',
  ];

  const modalContent = (
    <div
      style={{
        top: 'var(--vvo, 0px)',
        height: 'var(--vvh, 100dvh)',
      }}
      className="fixed left-0 right-0 z-[100] flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-xs px-2 py-1.5 sm:p-4 animate-in fade-in duration-200 overflow-hidden"
    >
      <div
        style={{
          maxHeight: 'calc(var(--vvh, 100dvh) - var(--sat, 0px) - 8px)',
        }}
        className="w-full max-w-lg rounded-3xl bg-white border border-[#E8DFCE] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3.5 border-b border-[#E8DFCE]">
          <div>
            <h3 className="text-base font-black text-slate-950">
              {existingLine ? 'Edit Planned Cost' : 'Add Planned Cost'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-[110px] overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-3.5 pb-6">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-950 mb-1">
              Line Item Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Starter Feed Bags, Broiler Chicks, or Laptop for Inventory"
              className="w-full px-3 py-2 rounded-xl border border-[#E8DFCE] bg-white text-slate-950 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>

          {/* Category & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-950 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => {
                  const val = e.target.value;
                  setCategory(val);
                  if (val === 'EQUIPMENT') {
                    setExcludeFromContingency(true);
                  }
                }}
                className="w-full px-3 py-2 rounded-xl border border-[#E8DFCE] bg-white text-slate-950 text-sm font-semibold focus:ring-2 focus:ring-emerald-500"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-950 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as RunwayLinePriority)}
                className="w-full px-3 py-2 rounded-xl border border-[#E8DFCE] bg-white text-slate-950 text-sm font-semibold focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ESSENTIAL">Essential (Must Have)</option>
                <option value="IMPORTANT">Important (Should Have)</option>
                <option value="NICE_TO_HAVE">Nice to Have</option>
              </select>
            </div>
          </div>

          {/* Planned Quantity, Estimated Total ($), Unit Label */}
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="block text-xs font-bold text-slate-950 mb-1">
                Planned Quantity <span className="text-rose-500">*</span>
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
                className="w-full px-3 py-2 rounded-xl border border-[#E8DFCE] bg-white text-slate-950 text-sm font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-950 mb-1">
                Estimated Total ($) <span className="text-rose-500">*</span>
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
                className="w-full px-3 py-2 rounded-xl border border-[#E8DFCE] bg-white text-sm font-mono font-black text-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-950 mb-1">
                Unit Label
              </label>
              <input
                type="text"
                value={unitLabel}
                onChange={(e) => setUnitLabel(e.target.value)}
                placeholder="chick, bag, unit"
                className="w-full px-3 py-2 rounded-xl border border-[#E8DFCE] bg-white text-slate-950 text-sm font-semibold"
              />
            </div>
          </div>

          {/* Smart Cost Suggestion Chip */}
          {costSuggestions !== null && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
              <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1 mb-1.5">
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
                  className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  Apply Benchmark: ${costSuggestions.toFixed(2)} / unit
                </button>
              </div>
            </div>
          )}

          {/* Planned Date */}
          <div>
            <label className="block text-xs font-bold text-slate-950 mb-1">
              Planned Disbursement Date
            </label>
            <input
              type="date"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#E8DFCE] bg-white text-slate-950 text-sm font-medium"
            />
          </div>

          {/* Fixed Capital Asset / Equipment Indicator */}
          <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE]">
            <label className="flex items-start space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={excludeFromContingency}
                onChange={(e) => setExcludeFromContingency(e.target.checked)}
                className="mt-0.5 rounded-md border-[#E8DFCE] text-emerald-600 focus:ring-emerald-500"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-950 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-emerald-700" />
                  Fixed Capital Asset (CAPEX)
                </span>
                <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                  Check if this is permanent equipment (e.g. laptop, weighing scale, water pump). It does not produce harvest yield and can be excluded from variable emergency contingency buffers.
                </p>
              </div>
            </label>
          </div>

          {/* Recurrence Toggle */}
          <div className="pt-2 border-t border-[#E8DFCE]">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="rounded-md border-[#E8DFCE] text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-xs font-bold text-slate-950">
                Recurring Expense (e.g. Monthly Labor, Feed refills)
              </span>
            </label>

            {isRecurring && (
              <div className="grid grid-cols-2 gap-3 mt-2.5 pl-6">
                <div>
                  <label className="block text-[11px] text-slate-600 font-semibold mb-1">Repeat Every (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={everyDays}
                    onChange={(e) => setEveryDays(parseInt(e.target.value) || 30)}
                    className="w-full px-3 py-1.5 rounded-lg border border-[#E8DFCE] text-xs font-bold text-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 font-semibold mb-1">Total Cycles</label>
                  <input
                    type="number"
                    min="1"
                    value={occurrences}
                    onChange={(e) => setOccurrences(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-1.5 rounded-lg border border-[#E8DFCE] text-xs font-bold text-slate-950"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Unit Cost & Subtotal preview banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE]">
            <div className="flex items-center space-x-1.5 text-xs text-slate-700 font-medium">
              <Calculator className="w-4 h-4 shrink-0 text-emerald-700" />
              <span>
                Unit Cost: <strong className="text-slate-950 font-bold">${autoUnitCost.toFixed(2)}/{unitLabel || 'unit'}</strong>
              </span>
            </div>
            <span className="text-sm sm:text-base font-black font-mono text-emerald-700">
              Total: ${lineTotal.toFixed(2)}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#E8DFCE]">
            {existingLine && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  onDelete(existingLine.id);
                  onClose();
                }}
                className="px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors flex items-center space-x-1 cursor-pointer"
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
                className="px-4 py-2 rounded-xl text-slate-700 hover:bg-stone-100 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95"
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
