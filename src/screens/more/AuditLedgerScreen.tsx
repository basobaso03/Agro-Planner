import React, { useState } from 'react';
import { dataService } from '../../services/dataService.ts';
import { verifyAuditChainIntegrity, type ChainVerificationResult } from '../../utils/cryptoHash.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import type { OrgMember } from '../../types/agro.ts';

export interface AuditLedgerScreenProps {
  activeMember: OrgMember;
}

export const AuditLedgerScreen: React.FC<AuditLedgerScreenProps> = () => {
  const { showToast } = useToast();
  const notifications = dataService.getState().auditNotifications || [];

  const [verification, setVerification] = useState<ChainVerificationResult>(() =>
    verifyAuditChainIntegrity(notifications)
  );
  const [filter, setFilter] = useState<'ALL' | 'FINANCIAL' | 'GROUND' | 'SYSTEM'>('ALL');

  const handleVerify = () => {
    const result = verifyAuditChainIntegrity(notifications);
    setVerification(result);
    if (result.valid) {
      showToast({
        type: 'success',
        title: 'Audit Chain Verified',
        message: `All ${result.totalBlocksChecked} ledger blocks verified cryptographically intact.`,
      });
    } else {
      showToast({
        type: 'error',
        title: 'Tampering Detected',
        message: result.brokenReason || 'Ledger chain integrity check failed.',
      });
    }
  };

  const filtered = notifications.filter((n) => {
    if (filter === 'ALL') return true;
    if (filter === 'FINANCIAL') {
      return (
        n.eventType === 'CAPITAL_CONTRIBUTION' ||
        n.eventType === 'EXPENSE_LOGGED' ||
        n.eventType === 'CREDIT_SALE' ||
        n.eventType === 'CAPITAL_CONTRA' ||
        n.eventType === 'EXPENSE_CONTRA'
      );
    }
    if (filter === 'GROUND') {
      return (
        n.eventType === 'GROUND_BROADCAST' ||
        n.eventType === 'LIVESTOCK_REGISTERED' ||
        n.eventType === 'LIVESTOCK_MORTALITY'
      );
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col p-4 pb-24 max-w-2xl mx-auto w-full space-y-4">
      {/* Verification Hero Card */}
      <div className="bg-slate-900 text-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Tamper-Evident SHA-256 Ledger
            </div>
            <div className="text-xl font-bold mt-0.5">
              {verification.valid ? '✅ Continuous Chain Intact' : '⚠️ Chain Integrity Alert'}
            </div>
          </div>
          <button
            type="button"
            onClick={handleVerify}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all active:scale-95"
          >
            Verify Chain
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800 dark:border-slate-700 text-xs text-slate-300">
          <div>
            <span className="text-slate-400">Total Blocks:</span>{' '}
            <span className="font-bold text-white">{verification.totalBlocksChecked}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-400">Latest Hash:</span>{' '}
            <span className="font-mono text-emerald-400">
              {verification.latestHash ? `${verification.latestHash.slice(0, 10)}...` : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="grid grid-cols-4 gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold text-center">
        <button
          type="button"
          onClick={() => setFilter('ALL')}
          className={`py-2 rounded-lg transition-all ${filter === 'ALL'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500'
            }`}
        >
          All Blocks
        </button>
        <button
          type="button"
          onClick={() => setFilter('FINANCIAL')}
          className={`py-2 rounded-lg transition-all ${filter === 'FINANCIAL'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500'
            }`}
        >
          Financial
        </button>
        <button
          type="button"
          onClick={() => setFilter('GROUND')}
          className={`py-2 rounded-lg transition-all ${filter === 'GROUND'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500'
            }`}
        >
          Ground
        </button>
        <button
          type="button"
          onClick={() => setFilter('SYSTEM')}
          className={`py-2 rounded-lg transition-all ${filter === 'SYSTEM'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500'
            }`}
        >
          System
        </button>
      </div>

      {/* Sealed Blocks List */}
      <div className="space-y-3">
        {filtered.map((block) => (
          <div
            key={block.id}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-xs space-y-2 text-xs"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  BLOCK #{block.sequenceNumber}
                </span>
                <span className="ml-2 font-semibold text-slate-900 dark:text-white">
                  {block.title || block.eventType}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 shrink-0">
                {new Date(block.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <p className="text-slate-600 dark:text-slate-300">{block.message}</p>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 font-mono text-[10px] text-slate-400 space-y-0.5">
              <div>PREV: {block.previousHash?.slice(0, 24)}...</div>
              <div className="text-emerald-600 dark:text-emerald-400">
                CURR: {block.currentHash?.slice(0, 24)}...
              </div>
              <div className="text-slate-400">
                ACTOR: {block.actorName} ({block.actorRole}) · LOC: {block.locationName}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

