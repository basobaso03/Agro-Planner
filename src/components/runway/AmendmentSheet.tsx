import React, { useState } from 'react';
import {
  FileEdit,
  X,
  Check,
  XCircle,
  PlusCircle,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import type { RunwayLine } from '../../types/runway';
import type { OrgMember } from '../../types/agro';
import { PERMISSIONS } from '../../utils/permissions';

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

  // Form State
  const [title, setTitle] = useState<string>('');
  const [category, setCategory] = useState<string>('FEED');
  const [qty, setQty] = useState<number>(1);
  const [unitCost, setUnitCost] = useState<number>(0);
  const [note, setNote] = useState<string>('');
  const [selectedExistingLineId, setSelectedExistingLineId] = useState<string>('');
  const [isModifyingExisting, setIsModifyingExisting] = useState<boolean>(false);

  const canApprove = PERMISSIONS.canApproveAmendment(currentMember.role);
  const canPropose = PERMISSIONS.canProposeAmendment(currentMember.role);

  const planLines = lines.filter((l) => l.planId === planId);
  const pendingAmendments = planLines.filter((l) => l.approval === 'PROPOSED');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || qty <= 0 || unitCost <= 0 || !note.trim()) return;

    onPropose({
      planId,
      title: title.trim(),
      category,
      qty: Number(qty),
      unitCost: Number(unitCost),
      note: note.trim(),
      lineId: isModifyingExisting ? selectedExistingLineId : undefined,
    });

    setTitle('');
    setQty(1);
    setUnitCost(0);
    setNote('');
    onClose();
  };

  const categories = ['FEED', 'EQUIPMENT', 'LIVESTOCK', 'MEDICINE', 'LABOR', 'UTILITIES', 'OTHER'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl p-5 sm:p-6 space-y-4 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
          <div className="flex items-center space-x-2">
            <FileEdit className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Plan Amendments & Mid-Cycle Adjustments
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('PROPOSE')}
            className={`py-1.5 rounded-lg transition-all ${
              activeTab === 'PROPOSE'
                ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Propose Amendment
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PENDING')}
            className={`py-1.5 rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
              activeTab === 'PENDING'
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
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-3.5 pr-1">
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
                  Qty *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={qty}
                  onChange={(e) => setQty(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Unit Cost ($) *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={unitCost}
                  onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-bold text-indigo-600"
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

            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-xs">
              <span className="text-gray-500">Additional Requirement:</span>
              <span className="font-bold text-gray-900 dark:text-white">
                ${(qty * unitCost).toFixed(2)}
              </span>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canPropose || !title.trim() || !note.trim() || qty <= 0 || unitCost <= 0}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md disabled:opacity-50"
              >
                Submit Amendment
              </button>
            </div>
          </form>
        )}

        {/* PENDING TAB */}
        {activeTab === 'PENDING' && (
          <div className="flex-1 overflow-y-auto space-y-3">
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

                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px] font-bold">
                      Awaiting Sign-off
                    </span>
                  </div>

                  {line.amendmentReason && (
                    <p className="p-2.5 rounded-xl bg-white/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 italic">
                      "{line.amendmentReason}"
                    </p>
                  )}

                  {canApprove && (
                    <div className="flex items-center justify-end space-x-2 pt-1">
                      <button
                        onClick={() => onResolve({ lineId: line.id, decision: 'REJECT' })}
                        className="px-3 py-1.5 rounded-xl text-rose-600 hover:bg-rose-100/50 text-xs font-bold transition-colors cursor-pointer"
                      >
                        Reject
                      </button>
                      <button
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
};

