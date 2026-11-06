import React, { useState, useEffect, useCallback } from 'react';
import {
  HardDrive,
  Database,
  Trash2,
  RefreshCw,
  AlertTriangle,
  FolderSync,
  Building2,
  Users,
  Receipt,
  PlaneTakeoff,
  Binary,
  Layers,
} from 'lucide-react';
import { appStorage } from '../../services/storage.ts';
import { dataService } from '../../services/dataService.ts';
import { outboxService } from '../../services/outbox.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import type { OrgMember } from '../../types/agro.ts';

export interface StorageManagerScreenProps {
  activeMember: OrgMember;
}

interface StorageDiagnostics {
  localStorageBytes: number;
  localStorageKeys: number;
  snapshotBytes: number;
  totalUsageBytes: number;
  quotaBytes: number;
  recordCounts: {
    organizations: number;
    members: number;
    ledgerEntries: number;
    runwayItems: number;
    livestockItems: number;
    auditEvents: number;
    outboxQueue: number;
  };
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const StorageManagerScreen: React.FC<StorageManagerScreenProps> = ({ activeMember }) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [confirmWipeOpen, setConfirmWipeOpen] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState('');
  const [diag, setDiag] = useState<StorageDiagnostics>({
    localStorageBytes: 0,
    localStorageKeys: 0,
    snapshotBytes: 0,
    totalUsageBytes: 0,
    quotaBytes: 0,
    recordCounts: {
      organizations: 0,
      members: 0,
      ledgerEntries: 0,
      runwayItems: 0,
      livestockItems: 0,
      auditEvents: 0,
      outboxQueue: 0,
    },
  });

  const refreshDiagnostics = useCallback(async () => {
    try {
      const storageDiag = await appStorage.getStorageDiagnostics();
      const state = dataService.getState();
      const snapshotString = JSON.stringify(state);
      const snapshotBytes = new Blob([snapshotString]).size;

      const totalDetectedBytes = Math.max(
        storageDiag.estimatedUsageBytes,
        storageDiag.localStorageBytes + snapshotBytes
      );

      const orgCount = state.organizations?.length || 0;
      const memberCount = state.members?.length || 0;
      const ledgerCount =
        (state.expenses?.length || 0) +
        (state.capitalContributions?.length || 0) +
        (state.fixedAssets?.length || 0) +
        (state.debtLiabilities?.length || 0) +
        (state.creditSales?.length || 0);
      const runwayCount =
        (state.runwayPlans?.length || 0) +
        (state.runwayLines?.length || 0) +
        (state.runwayPledges?.length || 0) +
        (state.runwayClaims?.length || 0);
      const livestockCount =
        (state.livestockEntries?.length || 0) + (state.feedLedger?.length || 0);
      const auditCount = state.auditNotifications?.length || 0;
      const outboxCount = outboxService.getPending().length;

      setDiag({
        localStorageBytes: storageDiag.localStorageBytes,
        localStorageKeys: storageDiag.localStorageKeys,
        snapshotBytes,
        totalUsageBytes: totalDetectedBytes,
        quotaBytes: storageDiag.quotaBytes,
        recordCounts: {
          organizations: orgCount,
          members: memberCount,
          ledgerEntries: ledgerCount,
          runwayItems: runwayCount,
          livestockItems: livestockCount,
          auditEvents: auditCount,
          outboxQueue: outboxCount,
        },
      });
    } catch (err) {
      console.warn('Storage diagnostics error:', err);
    }
  }, []);

  useEffect(() => {
    void refreshDiagnostics();
  }, [refreshDiagnostics]);

  const handlePruneCache = async () => {
    setLoading(true);
    try {
      if (typeof window !== 'undefined' && 'caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      await refreshDiagnostics();
      showToast({
        type: 'success',
        title: 'Cache Pruned',
        message: 'Temporary images and offline bundle assets pruned from device memory.',
      });
    } catch {
      showToast({
        type: 'error',
        title: 'Failed',
        message: 'Could not prune temporary cache.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleWipeAllLocalData = async () => {
    if (wipeConfirmText.trim().toUpperCase() !== 'WIPE') {
      showToast({
        type: 'warning',
        title: 'Confirmation Mismatch',
        message: 'Type "WIPE" in all capitals to confirm local database purge.',
      });
      return;
    }

    setLoading(true);
    try {
      showToast({
        type: 'info',
        title: 'Flushing Device Storage',
        message: 'Purging local storage, IndexedDB, and active session...',
      });

      // Detach listeners, clear localStorage, IndexedDB, caches, and session
      await dataService.signOutCloud();
      await appStorage.purgeAllIndexedDatabases();

      if (typeof window !== 'undefined') {
        window.localStorage.clear();
        window.sessionStorage.clear();
        // Give time for toast display then hard-reload
        setTimeout(() => {
          window.location.reload();
        }, 350);
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Wipe Failed',
        message: err instanceof Error ? err.message : 'Could not purge local storage.',
      });
      setLoading(false);
    }
  };

  const handleResetOrgOnly = async () => {
    setLoading(true);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('agro_active_org_id');
        window.localStorage.removeItem('agro_planner_active_org_id');
      }
      const curState = dataService.getState();
      const updatedMembers = (curState.members || []).map((m) =>
        m.id === activeMember.id ? { ...m, orgId: undefined } : m
      );
      dataService.saveLocalState({
        ...curState,
        activeOrgId: undefined,
        members: updatedMembers,
      });

      showToast({
        type: 'success',
        title: 'Organization Link Reset',
        message: 'Active organization unlinked. Refreshing workspace onboarding...',
      });

      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }, 300);
    } catch {
      showToast({
        type: 'error',
        title: 'Failed',
        message: 'Could not reset organization link.',
      });
      setLoading(false);
    }
  };

  const quotaMb =
    diag.quotaBytes > 0 ? (diag.quotaBytes / (1024 * 1024)).toFixed(0) : 'Unlimited';

  return (
    <div className="flex-1 flex flex-col p-4 pb-28 max-w-2xl mx-auto w-full space-y-4">
      {/* Hero: Storage Diagnostics */}
      <div className="bg-white border border-[#E8DFCE] p-5 rounded-3xl shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                Device Ledger Storage
              </div>
              <h2 className="text-xl font-black text-slate-950 font-mono">
                {formatBytes(diag.totalUsageBytes)} Detected
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={refreshDiagnostics}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            title="Refresh Storage Scan"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
          <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE]/80 space-y-0.5">
            <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
              <Database className="w-3 h-3 text-amber-700" />
              <span>Snapshot Size</span>
            </div>
            <div className="text-sm font-mono font-black text-slate-950">
              {formatBytes(diag.snapshotBytes)}
            </div>
            <div className="text-[10px] text-slate-500">In-Memory / State</div>
          </div>

          <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE]/80 space-y-0.5">
            <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
              <Binary className="w-3 h-3 text-emerald-700" />
              <span>LocalStorage</span>
            </div>
            <div className="text-sm font-mono font-black text-slate-950">
              {formatBytes(diag.localStorageBytes)}
            </div>
            <div className="text-[10px] text-slate-500">{diag.localStorageKeys} keys stored</div>
          </div>

          <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE]/80 space-y-0.5 col-span-2 sm:col-span-1">
            <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
              <Layers className="w-3 h-3 text-blue-700" />
              <span>Device Quota</span>
            </div>
            <div className="text-sm font-mono font-black text-slate-950">
              ~{quotaMb} {diag.quotaBytes > 0 ? 'MB' : ''}
            </div>
            <div className="text-[10px] text-slate-500">IndexedDB Capacity</div>
          </div>
        </div>
      </div>

      {/* Local Record Inventory Breakdown */}
      <div className="bg-white border border-[#E8DFCE] rounded-3xl p-5 shadow-xs space-y-3">
        <div className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <FolderSync className="w-3.5 h-3.5 text-slate-600" />
          <span>Local Data Inventory</span>
        </div>
        <p className="text-xs text-slate-700 leading-relaxed font-normal">
          Active records currently cached inside your browser or device storage:
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
            <span className="text-slate-600 flex items-center gap-1.5 font-medium">
              <Building2 className="w-3.5 h-3.5 text-slate-500" /> Orgs
            </span>
            <span className="font-mono font-black text-slate-900">
              {diag.recordCounts.organizations}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
            <span className="text-slate-600 flex items-center gap-1.5 font-medium">
              <Users className="w-3.5 h-3.5 text-slate-500" /> Members
            </span>
            <span className="font-mono font-black text-slate-900">
              {diag.recordCounts.members}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
            <span className="text-slate-600 flex items-center gap-1.5 font-medium">
              <Receipt className="w-3.5 h-3.5 text-slate-500" /> Ledgers
            </span>
            <span className="font-mono font-black text-slate-900">
              {diag.recordCounts.ledgerEntries}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
            <span className="text-slate-600 flex items-center gap-1.5 font-medium">
              <PlaneTakeoff className="w-3.5 h-3.5 text-slate-500" /> Runway
            </span>
            <span className="font-mono font-black text-slate-900">
              {diag.recordCounts.runwayItems}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
            <span className="text-slate-600 flex items-center gap-1.5 font-medium">
              <Binary className="w-3.5 h-3.5 text-slate-500" /> Audit Log
            </span>
            <span className="font-mono font-black text-slate-900">
              {diag.recordCounts.auditEvents}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
            <span className="text-slate-600 flex items-center gap-1.5 font-medium">
              <FolderSync className="w-3.5 h-3.5 text-slate-500" /> Outbox Queue
            </span>
            <span className="font-mono font-black text-slate-900">
              {diag.recordCounts.outboxQueue}
            </span>
          </div>
        </div>
      </div>

      {/* Routine Maintenance */}
      <div className="bg-white border border-[#E8DFCE] rounded-3xl p-5 shadow-xs space-y-3">
        <h3 className="text-sm font-black text-slate-950">Routine Cache Pruning</h3>
        <p className="text-xs text-slate-700 leading-relaxed font-normal">
          Pruning removes downloaded website assets, fonts, and temporary image previews while preserving your local organization, ledgers, and accounts.
        </p>

        <button
          type="button"
          onClick={handlePruneCache}
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-xl border border-[#E0D7C6] bg-[#FAF8F5] text-slate-900 font-bold text-xs hover:bg-[#F0EBE1] active:scale-[0.99] transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-700 ${loading ? 'animate-spin' : ''}`} />
          <span>Prune Temporary Image &amp; Asset Cache</span>
        </button>
      </div>

      {/* Organization Reset Only */}
      <div className="bg-white border border-amber-200/80 rounded-3xl p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-amber-900">
          <Building2 className="w-4 h-4 text-amber-700 shrink-0" />
          <h3 className="text-sm font-black">Reset Organization Attachment</h3>
        </div>
        <p className="text-xs text-slate-700 leading-relaxed font-normal">
          Unlinks your account from the current organization and returns to the initial onboarding screen (Create Organization or Join with 24-hr Code). Your user profile is preserved.
        </p>

        <button
          type="button"
          onClick={handleResetOrgOnly}
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs active:scale-[0.99] transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2"
        >
          <Building2 className="w-3.5 h-3.5 text-amber-700" />
          <span>Reset Active Organization Link</span>
        </button>
      </div>

      {/* Danger Zone: Full Wipe & Factory Reset */}
      <div className="bg-rose-50/60 border border-rose-300 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-800 shrink-0 mt-0.5">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-black text-rose-950">
              Factory Reset: Flush All Local Device Storage
            </h3>
            <p className="text-xs text-rose-900 leading-relaxed font-medium">
              Completely wipes LocalStorage, IndexedDB databases, cached organizations, accounts, and session tokens from this device. Use this to start testing clean from step one.
            </p>
          </div>
        </div>

        {!confirmWipeOpen ? (
          <button
            type="button"
            onClick={() => setConfirmWipeOpen(true)}
            className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>Flush Local Database &amp; Reset App</span>
          </button>
        ) : (
          <div className="p-4 rounded-2xl bg-white border border-rose-300 space-y-3">
            <div className="text-xs font-bold text-rose-950">
              Type <span className="font-mono text-rose-700 underline font-black">WIPE</span> below to confirm total storage erasure:
            </div>
            <input
              type="text"
              value={wipeConfirmText}
              onChange={(e) => setWipeConfirmText(e.target.value)}
              placeholder="Type WIPE"
              className="w-full px-3.5 py-2.5 rounded-xl border border-rose-300 bg-rose-50/30 text-xs font-mono font-bold text-rose-950 focus:outline-none focus:border-rose-600"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmWipeOpen(false);
                  setWipeConfirmText('');
                }}
                className="flex-1 py-2.5 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleWipeAllLocalData}
                disabled={loading || wipeConfirmText.trim().toUpperCase() !== 'WIPE'}
                className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-black transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Total Wipe</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
