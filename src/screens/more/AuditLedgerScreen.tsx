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
      <div className="bg-white border border-[#E8DFCE] p-5 rounded-2xl shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-600 font-bold">
              Tamper-Evident Security Ledger
            </div>
            <div className="text-xl font-black text-slate-950 mt-0.5">
              {verification.valid ? '✅ Continuous Chain Intact' : '⚠️ Chain Integrity Alert'}
            </div>
          </div>
          <button
            type="button"
            onClick={handleVerify}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all active:scale-95 shadow-xs cursor-pointer"
          >
            Verify Chain
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#F0EBE1] text-xs">
          <div>
            <span className="text-slate-600 font-medium">Total Blocks:</span>{' '}
            <span className="font-mono font-black text-slate-950">{verification.totalBlocksChecked}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-600 font-medium">Security Status:</span>{' '}
            <span className="font-bold text-emerald-700">
              {verification.valid ? 'Verified Secure' : 'Alert'}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="grid grid-cols-4 gap-1.5 bg-[#FAF8F5] border border-[#E8DFCE] p-1 rounded-xl text-xs font-bold text-center">
        {(['ALL', 'FINANCIAL', 'GROUND', 'SYSTEM'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilter(t)}
            className={`py-2 rounded-lg transition-all cursor-pointer ${filter === t
              ? 'bg-white text-slate-950 shadow-xs border border-[#E0D7C6]'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            {t === 'ALL' ? 'All Blocks' : t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Sealed Blocks List */}
      <div className="space-y-3">
        {filtered.map((block) => (
          <div
            key={block.id}
            className="bg-white border border-[#E8DFCE] rounded-2xl p-4 shadow-xs space-y-2 text-xs"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                  BLOCK #{block.sequenceNumber}
                </span>
                <span className="ml-2 font-bold text-slate-950">
                  {block.title || block.eventType}
                </span>
              </div>
              <span className="text-[11px] text-slate-600 font-medium font-mono shrink-0">
                {new Date(block.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <p className="text-slate-800 leading-relaxed font-normal">{block.message}</p>

            <div className="pt-2 border-t border-[#F0EBE1] text-[11px] text-slate-600 font-medium">
              <span>Logged by <strong className="text-slate-950">{block.actorName}</strong> ({block.actorRole})</span>
              <span className="mx-1.5">·</span>
              <span>Location: <strong className="text-slate-950">{block.locationName}</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

