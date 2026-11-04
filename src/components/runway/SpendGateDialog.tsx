import React, { useState } from 'react';
import {
  ShieldAlert,
  Layers,
  FileEdit,
  ArrowRight,
  X,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import type { RunwayLine, RunwayAllocation, RunwayAllocationMode } from '../../types/runway';

interface SpendGateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  category?: string;
  lines: RunwayLine[];
  reserveLeft: number;
  onAllocate: (allocation: RunwayAllocation) => void;
  onProposeAmendment?: () => void;
}

export const SpendGateDialog: React.FC<SpendGateDialogProps> = ({
  isOpen,
  onClose,
  amount,
  category,
  lines,
  reserveLeft,
  onAllocate,
  onProposeAmendment,
}) => {
  const [mode, setMode] = useState<RunwayAllocationMode>('LINE');
  const [selectedLineId, setSelectedLineId] = useState<string>(lines[0]?.id || '');
  const [reserveReason, setReserveReason] = useState<string>('');

  if (!isOpen) return null;

  const costLines = lines.filter((l) => l.kind === 'COST' && !l.skipped);

  const handleConfirm = () => {
    if (mode === 'LINE') {
      if (!selectedLineId) return;
      onAllocate({
        mode: 'LINE',
        lineId: selectedLineId,
      });
      onClose();
    } else if (mode === 'CONTINGENCY') {
      if (!reserveReason.trim() || reserveReason.trim().length < 4) return;
      onAllocate({
        mode: 'CONTINGENCY',
        reason: reserveReason.trim(),
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl p-5 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                Runway Spend Gate Enforcement
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Active plan is locked under STRICT enforcement. All capital disbursements must be accounted for.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Amount to be allocated */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
          <div>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              Outflow Disbursement:
            </span>
            <div className="text-lg font-extrabold text-gray-900 dark:text-white">
              ${amount.toFixed(2)}
            </div>
          </div>
          {category && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 uppercase">
              {category}
            </span>
          )}
        </div>

        {/* Allocation Mode Tabs */}
        <div className="space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
            Select Allocation Path:
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('LINE')}
              className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                mode === 'LINE'
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-500'
                  : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2 mb-1">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-gray-900 dark:text-white">Plan Line</span>
              </div>
              <div className="text-[11px] text-gray-500">Charge to pre-planned budget step</div>
            </button>

            <button
              type="button"
              onClick={() => setMode('CONTINGENCY')}
              className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                mode === 'CONTINGENCY'
                  ? 'border-amber-600 bg-amber-50/50 dark:bg-amber-950/40 ring-2 ring-amber-500'
                  : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2 mb-1">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  Contingency Draw
                </span>
              </div>
              <div className="text-[11px] text-amber-700/80 dark:text-amber-400">
                ${reserveLeft.toFixed(2)} reserve available
              </div>
            </button>
          </div>
        </div>

        {/* Mode Dependent Controls */}
        {mode === 'LINE' && (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
              Target Budget Step Line:
            </label>
            <select
              value={selectedLineId}
              onChange={(e) => setSelectedLineId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-semibold text-gray-900 dark:text-white"
            >
              {costLines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title} (Budget: ${(l.qty * l.unitCost).toFixed(2)})
                </option>
              ))}
            </select>
          </div>
        )}

        {mode === 'CONTINGENCY' && (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
              Mandatory Emergency Reason Note *
            </label>
            <input
              type="text"
              required
              value={reserveReason}
              onChange={(e) => setReserveReason(e.target.value)}
              placeholder="e.g. Unexpected replacement generator fuel"
              className="w-full px-3.5 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white"
            />
            {amount > reserveLeft && (
              <p className="text-xs text-rose-600 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Requested draw exceeds available reserve (${reserveLeft.toFixed(2)}).
              </p>
            )}
          </div>
        )}

        {/* Propose Amendment Shortcut */}
        {onProposeAmendment && (
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
            <span className="text-gray-500">Unbudgeted item or need additional funds?</span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onProposeAmendment();
              }}
              className="font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              <FileEdit className="w-3.5 h-3.5" /> Propose Amendment
            </button>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end space-x-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Cancel Outflow
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={mode === 'CONTINGENCY' && (!reserveReason.trim() || amount > reserveLeft)}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md disabled:opacity-50 cursor-pointer active:scale-95"
          >
            Confirm Allocation
          </button>
        </div>
      </div>
    </div>
  );
};

