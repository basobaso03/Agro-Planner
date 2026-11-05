import React, { useState } from 'react';
import { dataService } from '../../services/dataService.ts';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import type { OrgMember } from '../../types/agro.ts';

export interface StockMovementLedgerProps {
  activeMember: OrgMember;
}

export const StockMovementLedger: React.FC<StockMovementLedgerProps> = () => {
  const [filter, setFilter] = useState<'ALL' | 'STOCK_IN' | 'DAILY_CONSUMPTION' | 'CONTRA_REVERSAL'>('ALL');

  const events = dataService.getState().feedLedger || [];

  const filtered = events.filter((e: any) => {
    if (filter === 'ALL') return true;
    return e.direction === filter;
  });

  return (
    <div className="flex-1 flex flex-col p-4 pb-24 max-w-2xl mx-auto w-full space-y-4">
      {/* Header Info */}
      <div className="bg-white border border-[#E8DFCE] p-4 rounded-2xl shadow-xs">
        <h1 className="text-base font-black text-slate-950">Stock Movement Ledger</h1>
        <p className="text-xs text-slate-600 font-medium mt-1">
          Cryptographically sealed append-only audit trail of all inventory receipts, dispatches, and reversals.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="grid grid-cols-4 gap-1.5 bg-[#FAF8F5] border border-[#E8DFCE] p-1 rounded-xl text-xs font-bold text-center">
        <button
          type="button"
          onClick={() => setFilter('ALL')}
          className={`py-2 rounded-lg transition-all ${
            filter === 'ALL'
              ? 'bg-white text-slate-950 shadow-xs border border-[#E8DFCE]'
              : 'text-slate-600 hover:text-slate-950'
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setFilter('STOCK_IN')}
          className={`py-2 rounded-lg transition-all ${
            filter === 'STOCK_IN'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500'
          }`}
        >
          Receipts
        </button>
        <button
          type="button"
          onClick={() => setFilter('DAILY_CONSUMPTION')}
          className={`py-2 rounded-lg transition-all ${
            filter === 'DAILY_CONSUMPTION'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500'
          }`}
        >
          Dispatches
        </button>
        <button
          type="button"
          onClick={() => setFilter('CONTRA_REVERSAL')}
          className={`py-2 rounded-lg transition-all ${
            filter === 'CONTRA_REVERSAL'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500'
          }`}
        >
          Contra
        </button>
      </div>

      {/* Ledger Stream */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No Movement Records"
          message="No stock movements match the selected filter."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((ev: any) => (
            <div
              key={ev.id}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-xs flex justify-between items-center text-xs"
            >
              <div>
                <div className="font-bold text-slate-900 dark:text-white text-sm">
                  {ev.feedType}
                </div>
                <div className="text-slate-500 mt-0.5">{ev.note}</div>
                <div className="text-[11px] font-mono text-slate-400 mt-1">
                  Hash: {ev.auditHash?.slice(0, 16)}... · By {ev.loggedByName}
                </div>
              </div>

              <div className="text-right">
                <span
                  className={`text-base font-bold ${
                    ev.bagsDelta > 0 ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {ev.bagsDelta > 0 ? `+${ev.bagsDelta}` : ev.bagsDelta} units
                </span>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {new Date(ev.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

