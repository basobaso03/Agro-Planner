import React, { useState, useEffect } from 'react';
import { appStorage } from '../../services/storage.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import type { OrgMember } from '../../types/agro.ts';

export interface StorageManagerScreenProps {
  activeMember: OrgMember;
}

export const StorageManagerScreen: React.FC<StorageManagerScreenProps> = () => {
  const { showToast } = useToast();
  const [estimate, setEstimate] = useState<{ usage: number; quota: number }>({ usage: 0, quota: 0 });

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((est) => {
        setEstimate({
          usage: est.usage || 0,
          quota: est.quota || 0,
        });
      });
    }
  }, []);

  const handleClearCache = async () => {
    try {
      if (typeof window !== 'undefined' && 'caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      showToast({
        type: 'success',
        title: 'Cache Cleared',
        message: 'Temporary images and assets pruned from device memory.',
      });
    } catch {
      showToast({
        type: 'error',
        title: 'Failed',
        message: 'Could not clear cache.',
      });
    }
  };

  const usageMb = (estimate.usage / (1024 * 1024)).toFixed(2);
  const quotaMb = (estimate.quota / (1024 * 1024)).toFixed(0);

  return (
    <div className="flex-1 flex flex-col p-4 pb-24 max-w-2xl mx-auto w-full space-y-4">
      {/* Storage Hero */}
      <div className="bg-white border border-[#E8DFCE] p-5 rounded-2xl shadow-xs space-y-3">
        <div className="text-[11px] uppercase tracking-wider text-slate-600 font-bold">
          High-Capacity IndexedDB Storage
        </div>
        <div className="text-2xl font-black font-mono text-slate-950">{usageMb} MB Used</div>
        <div className="text-xs text-slate-600 font-medium">
          Device Available Quota: ~{quotaMb} MB (IndexedDB replaces 5MB localStorage)
        </div>
      </div>

      <div className="bg-white border border-[#E8DFCE] rounded-2xl p-4 shadow-xs space-y-3 text-xs">
        <div className="font-black text-slate-950 text-sm">Storage Maintenance</div>
        <p className="text-slate-800 leading-relaxed font-normal">
          The app stores audit trail blocks, livestock photos, and offline journals locally. Pruning temporary cache will free storage while preserving all ledgers.
        </p>

        <div className="pt-2">
          <button
            type="button"
            onClick={handleClearCache}
            className="w-full py-2.5 px-3 rounded-xl border border-[#E0D7C6] bg-[#FAF8F5] text-slate-900 font-bold text-xs text-center hover:bg-[#F0EBE1] active:scale-95 transition-all shadow-xs cursor-pointer"
          >
            Prune Temporary Image Cache
          </button>
        </div>
      </div>
    </div>
  );
};

