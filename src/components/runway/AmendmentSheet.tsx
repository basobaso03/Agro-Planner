import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FileEdit,
  X,
  Calculator,
} from 'lucide-react';
import type { RunwayLine } from '../../types/runway';
import type { OrgMember } from '../../types/agro';
import { PERMISSIONS } from '../../utils/permissions';
import { useBackHandler } from '../../navigation/useBackHandler';

interface AmendmentSheetProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  lines: RunwayLine[];
  currentMember: OrgMember;
  onPropose: (params: {
    planId: string;
    title: string;
    category: string;
    qty: number;
    unitCost: number;
    note: string;
    lineId?: string;
  }) => void;
  onResolve: (params: {
    lineId: string;
    decision: 'APPROVE' | 'REJECT';
    note?: string;
  }) => void;
}

export const AmendmentSheet: React.FC<AmendmentSheetProps> = ({
  isOpen,
  onClose,
  planId,
  lines,
  currentMember,
  onPropose,
  onResolve,
}) => {
  const [activeTab, setActiveTab] = useState<'PROPOSE' | 'PENDING'>('PROPOSE');

  // Form State (string-backed so fields clear cleanly on click/backspace)
  const [title, setTitle] = useState<string>('');
  const [category, setCategory] = useState<string>('FEED');
  const [qtyStr, setQtyStr] = useState<string>('');
  const [totalPriceStr, setTotalPriceStr] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [selectedExistingLineId] = useState<string>('');
  const [isModifyingExisting] = useState<boolean>(false);

  const canApprove = PERMISSIONS.canApproveAmendment(currentMember.role);
  const canPropose = PERMISSIONS.canProposeAmendment(currentMember.role);

  useBackHandler(
    100,
    () => {
      if (!isOpen) return false;
      onClose();
      return true;
    },
    [isOpen, onClose]
  );

  const planLines = lines.filter((l) => l.planId === planId);
  const pendingAmendments = planLines.filter((l) => l.approval === 'PROPOSED');

  if (!isOpen) return null;

  const parsedQty = parseFloat(qtyStr);
  const parsedTotal = parseFloat(totalPriceStr);
  const validQty = Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 0;
  const validTotal = Number.isFinite(parsedTotal) && parsedTotal > 0 ? parsedTotal : 0;
  const autoUnitCost = validQty > 0 ? validTotal / validQty : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || validQty <= 0 || validTotal <= 0 || !note.trim()) return;

    onPropose({
      planId,
      title: title.trim(),
      category,
      qty: Number(validQty),
      unitCost: Number((validTotal / validQty).toFixed(4)),
      note: note.trim(),
      lineId: isModifyingExisting ? selectedExistingLineId : undefined,
    });

    setTitle('');
    setQtyStr('');
    setTotalPriceStr('');
    setNote('');
    onClose();
  };

  const categories = ['FEED', 'EQUIPMENT', 'LIVESTOCK', 'MEDICINE', 'LABOR', 'UTILITIES', 'OTHER'];

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 backdrop-blur-xs px-3 py-3 sm:p-4 pt-safe pb-safe animate-in fade-in">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl p-4 sm:p-6 space-y-4 max-h-[calc(100dvh-1.5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] sm:max-h-[88dvh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
          <div className="flex items-center space-x-2 min-w-0">
            <FileEdit className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">
              Plan Amendments &amp; Mid-Cycle Adjustments
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="shrink-0 grid grid-cols-2 gap-2 p-1 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('PROPOSE')}
            className={`py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'PROPOSE'
                ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
          >
            Propose Amendment
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PENDING')}
            className={`py-1.5 rounded-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${activeTab === 'PENDING'
                ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
          >
            <span>Review Pending</span>
            {pendingAmendments.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center">
                {pendingAmendments.length}
              </span>
            )}
          </button>
        </div>

        {/* PROPOSE TAB */}
        {activeTab === 'PROPOSE' && (
          <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto space-y-3.5 pr-1">
            {!canPropose && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs">
                Only Ground Operators, Treasurers, and Admins can submit plan amendments.
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Amendment Title *
              </label>
              <input
                type="text"
                required
                disabled={!canPropose}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Additional Antibiotics Batch (Post-cold snap)"
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-medium"
              />
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-xs"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

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
                  placeholder="e.g. 10"
                  value={qtyStr}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setQtyStr(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-mono font-bold"
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
                  placeholder="e.g. 50.00"
                  value={totalPriceStr}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setTotalPriceStr(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-mono font-bold text-indigo-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Mandatory Operational Justification *
              </label>
              <textarea
                rows={3}
                required
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Explain why this budget adjustment is required and why it wasn't captured in the original plan..."
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-xs">
              <span className="text-gray-500 flex items-center gap-1">
                <Calculator className="w-3.5 h-3.5 text-indigo-500" />
                Auto Unit Cost: <strong>${autoUnitCost.toFixed(2)}/unit</strong>
              </span>
              <span className="font-bold font-mono text-gray-900 dark:text-white">
                Total: ${validTotal.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canPropose || !title.trim() || !note.trim() || validQty <= 0 || validTotal <= 0}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md disabled:opacity-50 cursor-pointer"
              >
                Submit Amendment
              </button>
            </div>
          </form>
        )}

        {/* PENDING TAB */}
        {activeTab === 'PENDING' && (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
            {pendingAmendments.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">
                No amendments currently awaiting review.
              </div>
            ) : (
              pendingAmendments.map((line) => (
                <div
                  key={line.id}
                  className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 space-y-2.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h5 className="font-bold text-gray-900 dark:text-white">{line.title}</h5>
                      <span className="text-gray-500">
                        {line.qty} {line.unitLabel || 'units'} @ ${line.unitCost.toFixed(2)} • Total: $
                        {(line.qty * line.unitCost).toFixed(2)}
                      </span>
                    </div>

                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px] font-bold shrink-0">
                      Awaiting Sign-off
                    </span>
                  </div>

                  {line.amendmentReason && (
                    <p className="p-2.5 rounded-xl bg-white/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 italic">
                      &quot;{line.amendmentReason}&quot;
                    </p>
                  )}

                  {canApprove && (
                    <div className="flex items-center justify-end space-x-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onResolve({ lineId: line.id, decision: 'REJECT' })}
                        className="px-3 py-1.5 rounded-xl text-rose-600 hover:bg-rose-100/50 text-xs font-bold transition-colors cursor-pointer"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => onResolve({ lineId: line.id, decision: 'APPROVE' })}
                        className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                      >
                        Approve Amendment
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    const portalRoot = document.getElementById('sheet-root') || document.body;
    return createPortal(modalContent, portalRoot);
  }

  return modalContent;
};
