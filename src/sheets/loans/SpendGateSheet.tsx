import React, { useState } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet.tsx';
import { ShieldAlert, Layers, AlertTriangle } from 'lucide-react';
import { formatMoney } from '../../utils/currency.ts';
import type { RunwayLine, RunwayAllocation, RunwayAllocationMode } from '../../types/runway.ts';

export interface SpendGateSheetProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  category?: string;
  lines: RunwayLine[];
  reserveLeft: number;
  onAllocate: (allocation: RunwayAllocation) => void;
}

export const SpendGateSheet: React.FC<SpendGateSheetProps> = ({
  isOpen,
  onClose,
  amount,
  category,
  lines,
  reserveLeft,
  onAllocate,
}) => {
  const [mode, setMode] = useState<RunwayAllocationMode>('LINE');
  const [selectedLineId, setSelectedLineId] = useState<string>(lines[0]?.id || '');
  const [reserveReason, setReserveReason] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const costLines = lines.filter((l) => l.kind === 'COST' && !l.skipped);

  const handleConfirm = () => {
    setError(null);
    if (mode === 'LINE') {
      if (!selectedLineId) {
        setError('Please select a planned budget line.');
        return;
      }
      onAllocate({ mode: 'LINE', lineId: selectedLineId });
      onClose();
    } else if (mode === 'CONTINGENCY') {
      if (reserveReason.trim().length < 4) {
        setError('Mandatory explanation (at least 4 characters) is required to draw from Contingency Reserve.');
        return;
      }
      if (amount > reserveLeft) {
        setError(`Disbursement (${formatMoney(amount)}) exceeds remaining Contingency Reserve (${formatMoney(reserveLeft)}).`);
        return;
      }
      onAllocate({ mode: 'CONTINGENCY', reason: reserveReason.trim() });
      onClose();
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Runway Spend Gate Enforcement"
      subtitle="All capital disbursements must be accounted for"
      size="auto"
      footer={
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-black shadow-md cursor-pointer"
          >
            Confirm Allocation ({formatMoney(amount)})
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Disbursement Amount Banner */}
        <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Disbursement Amount</span>
            <span className="text-lg font-black font-mono text-slate-900">{formatMoney(amount)}</span>
          </div>
          {category && (
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 uppercase font-mono">
              {category}
            </span>
          )}
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setMode('LINE');
              setError(null);
            }}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              mode === 'LINE'
                ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-500/20'
                : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="text-xs font-bold text-slate-900">Planned Budget Line</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Deduct from approved line</div>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('CONTINGENCY');
              setError(null);
            }}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              mode === 'CONTINGENCY'
                ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-500/20'
                : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="text-xs font-bold text-slate-900">Contingency Reserve</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Avail: {formatMoney(reserveLeft)}</div>
          </button>
        </div>

        {/* Mode-Specific Content */}
        {mode === 'LINE' ? (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">Select Budget Line</label>
            <select
              value={selectedLineId}
              onChange={(e) => setSelectedLineId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              {costLines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} — Budgeted: {formatMoney(l.unitCost * l.qty)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              Reason for Contingency Draw (Min 4 chars) <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              value={reserveReason}
              onChange={(e) => setReserveReason(e.target.value)}
              placeholder="Explain why this unplanned disbursement must draw from contingency reserve..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>
        )}
      </div>
    </BottomSheet>
  );
};

