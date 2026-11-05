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
    <div
      style={{
        top: 'var(--vvo, 0px)',
        height: 'var(--vvh, 100dvh)',
      }}
      className="fixed left-0 right-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-2.5 sm:p-4 animate-in fade-in overflow-hidden"
    >
      <div
        style={{
          maxHeight: 'calc(var(--vvh, 100dvh) - var(--sat, 0px) - 12px)',
        }}
        className="w-full max-w-lg rounded-3xl bg-white border border-[#E8DFCE] shadow-2xl p-4 sm:p-6 space-y-4 overflow-y-auto overscroll-contain"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-950">
                Runway Spend Gate Enforcement
              </h3>
              <p className="text-xs text-slate-600 font-medium">
                Active plan is locked under STRICT enforcement. All capital disbursements must be accounted for.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Amount to be allocated */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE]">
          <div>
            <span className="text-xs font-semibold text-slate-600">
              Outflow Disbursement:
            </span>
            <div className="text-lg font-black text-slate-950">
              ${amount.toFixed(2)}
            </div>
          </div>
          {category && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200 uppercase">
              {category}
            </span>
          )}
        </div>

        {/* Allocation Mode Tabs */}
        <div className="space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
            Select Allocation Path:
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('LINE')}
              className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${mode === 'LINE'
                ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500'
                : 'border-[#E8DFCE] hover:border-slate-300 bg-white'
                }`}
            >
              <div className="flex items-center space-x-2 mb-1">
                <Layers className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-black text-slate-950">Plan Line</span>
              </div>
              <div className="text-[11px] text-slate-600 font-medium">Charge to pre-planned budget step</div>
            </button>

            <button
              type="button"
              onClick={() => setMode('CONTINGENCY')}
              className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${mode === 'CONTINGENCY'
                ? 'border-amber-600 bg-amber-50/50 ring-2 ring-amber-500'
                : 'border-[#E8DFCE] hover:border-slate-300 bg-white'
                }`}
            >
              <div className="flex items-center space-x-2 mb-1">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-black text-amber-950">
                  Contingency Draw
                </span>
              </div>
              <div className="text-[11px] text-amber-800 font-semibold">
                ${reserveLeft.toFixed(2)} reserve available
              </div>
            </button>
          </div>
        </div>

        {/* Mode Dependent Controls */}
        {mode === 'LINE' && (
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-950">
              Target Budget Step Line:
            </label>
            <select
              value={selectedLineId}
              onChange={(e) => setSelectedLineId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8DFCE] bg-white text-xs font-bold text-slate-950"
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
            <label className="block text-xs font-bold text-slate-950">
              Mandatory Emergency Reason Note <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={reserveReason}
              onChange={(e) => setReserveReason(e.target.value)}
              placeholder="e.g. Unexpected replacement generator fuel"
              className="w-full px-3.5 py-2 rounded-xl border border-[#E8DFCE] bg-white text-xs font-medium text-slate-950"
            />
            {amount > reserveLeft && (
              <p className="text-xs text-rose-600 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Requested draw exceeds available reserve (${reserveLeft.toFixed(2)}).
              </p>
            )}
          </div>
        )}

        {/* Propose Amendment Shortcut */}
        {onProposeAmendment && (
          <div className="pt-2 border-t border-[#E8DFCE] flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">Unbudgeted item or need additional funds?</span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onProposeAmendment();
              }}
              className="font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
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
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-stone-100 cursor-pointer"
          >
            Cancel Outflow
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={mode === 'CONTINGENCY' && (!reserveReason.trim() || amount > reserveLeft)}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md disabled:opacity-50 cursor-pointer active:scale-95"
          >
            Confirm Allocation
          </button>
        </div>
      </div>
    </div>
  );
};

