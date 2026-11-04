import React from 'react';
import { useSyncStatus } from '../../hooks/useSyncStatus.ts';
import { Check, RefreshCw, AlertTriangle, WifiOff } from 'lucide-react';

export interface SyncChipProps {
  onClick?: () => void;
}

export const SyncChip: React.FC<SyncChipProps> = ({ onClick }) => {
  const status = useSyncStatus();

  if (!status.online) {
    return (
      <button
        type="button"
        onClick={onClick}
        title="Offline mode - changes queued locally"
        className="px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center gap-1 border border-slate-300 cursor-pointer"
      >
        <WifiOff className="w-3 h-3 text-slate-500" />
        <span>Offline</span>
      </button>
    );
  }

  if (status.failedCount > 0) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={`${status.failedCount} sync error(s) - tap to review`}
        className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold flex items-center gap-1 border border-rose-300 cursor-pointer animate-pulse"
      >
        <AlertTriangle className="w-3 h-3 text-rose-600" />
        <span>{status.failedCount} Sync Issue</span>
      </button>
    );
  }

  if (status.pendingCount > 0) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={`${status.pendingCount} record(s) syncing to cloud`}
        className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center gap-1 border border-amber-300 cursor-pointer"
      >
        <RefreshCw className="w-3 h-3 text-amber-600 animate-spin" />
        <span>{status.pendingCount} Queued</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title="Cloud synced live"
      className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold flex items-center gap-1 border border-emerald-200 cursor-pointer"
    >
      <Check className="w-3 h-3 text-emerald-600" />
      <span>Synced</span>
    </button>
  );
};

