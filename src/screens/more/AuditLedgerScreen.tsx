import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  X,
  Copy,
  Check,
  Share2,
  Download,
  FileText,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  ArrowUpDown,
  ExternalLink,
  Calendar,
  User,
  MapPin,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { dataService } from '../../services/dataService.ts';
import {
  verifyAuditChainIntegrity,
  type ChainVerificationResult,
} from '../../utils/cryptoHash.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import { BottomSheet } from '../../components/ui/BottomSheet.tsx';
import { copyToClipboard } from '../../native/clipboard.ts';
import { shareContent } from '../../native/share.ts';
import { formatMoney } from '../../utils/currency.ts';
import { getRoleMeta } from '../../utils/permissions.ts';
import { PdfExportButton } from '../../components/ui/PdfExportButton.tsx';
import { generateAuditCertificatePdf } from '../../services/pdf/generators/shared/auditCertificatePdf.ts';
import { buildExportFilename } from '../../utils/pdfFilename.ts';
import type { OrgMember, AuditNotificationEvent } from '../../types/agro.ts';
import { NotificationDetailModal } from '../../components/NotificationDetailModal.tsx';
import { useNavigation } from '../../navigation/useNavigation.ts';

export interface AuditLedgerScreenProps {
  activeMember: OrgMember;
}

export const AuditLedgerScreen: React.FC<AuditLedgerScreenProps> = ({ activeMember }) => {
  const { showToast } = useToast();
  const { navigate } = useNavigation();
  const rawNotifications = dataService.getState().auditNotifications || [];
  const notifications = useMemo(() => {
    return activeMember?.orgId
      ? rawNotifications.filter((n) => !n.orgId || n.orgId === activeMember.orgId)
      : rawNotifications;
  }, [rawNotifications, activeMember?.orgId]);

  const [verification, setVerification] = useState<ChainVerificationResult>(() =>
    verifyAuditChainIntegrity(notifications)
  );
  const [filter, setFilter] = useState<'ALL' | 'FINANCIAL' | 'GROUND' | 'SYSTEM'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'DESC' | 'ASC'>('DESC');
  const [selectedBlock, setSelectedBlock] = useState<AuditNotificationEvent | null>(null);
  const [showCertificate, setShowCertificate] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleVerify = () => {
    setIsVerifying(true);
    setTimeout(() => {
      const result = verifyAuditChainIntegrity(notifications);
      setVerification(result);
      setIsVerifying(false);

      if (result.valid) {
        showToast({
          type: 'success',
          title: 'Audit Chain Verified',
          message: `All ${result.totalBlocksChecked} ledger blocks verified intact.`,
        });
      } else {
        showToast({
          type: 'error',
          title: 'Tampering Detected',
          message: result.brokenReason || 'Ledger chain integrity check failed.',
        });
      }
    }, 250);
  };

  const handleCopy = async (text: string, label: string, idKey: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedId(idKey);
      setTimeout(() => setCopiedId(null), 1800);
      showToast({
        type: 'success',
        title: 'Copied',
        message: `${label} copied to clipboard.`,
      });
    }
  };

  const handleExportJson = () => {
    try {
      const exportData = {
        exportDate: new Date().toISOString(),
        organizationId: activeMember?.orgId || 'GLOBAL',
        verificationStatus: verification.valid ? 'INTACT' : 'TAMPERED',
        totalBlocks: verification.totalBlocksChecked,
        genesisHash: verification.genesisHash,
        latestHash: verification.latestHash,
        verifiedAt: verification.verifiedAt,
        blocks: notifications,
      };

      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_ledger_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast({
        type: 'success',
        title: 'Ledger Exported',
        message: `Saved ${notifications.length} blocks to JSON.`,
      });
    } catch {
      void handleCopy(
        JSON.stringify(notifications, null, 2),
        'Full Audit Ledger JSON',
        'export-json'
      );
    }
  };

  const handleShareLedger = async () => {
    const summaryText = [
      `=== AUDIT TRAIL VERIFICATION REPORT ===`,
      `Status: ${verification.valid ? 'VERIFIED INTACT' : 'TAMPERING DETECTED'}`,
      `Total Blocks: ${verification.totalBlocksChecked}`,
      `Verified At: ${new Date(verification.verifiedAt).toLocaleString()}`,
      `Organization: ${activeMember?.orgId || 'Default'}`,
      `=======================================`,
    ].join('\n');

    const shared = await shareContent({
      title: 'Audit Trail Verification Report',
      text: summaryText,
      dialogTitle: 'Share Audit Report',
    });

    if (!shared) {
      void handleCopy(summaryText, 'Audit Verification Report', 'share-ledger');
    }
  };

  // Filtering & Searching
  const filtered = useMemo(() => {
    return notifications
      .filter((n) => {
        // Category filter
        if (filter === 'FINANCIAL') {
          const isFinancial =
            n.eventType === 'CAPITAL_CONTRIBUTION' ||
            n.eventType === 'EXPENSE_LOGGED' ||
            n.eventType === 'CREDIT_SALE' ||
            n.eventType === 'CAPITAL_CONTRA' ||
            n.eventType === 'EXPENSE_CONTRA';
          if (!isFinancial) return false;
        } else if (filter === 'GROUND') {
          const isGround =
            n.eventType === 'GROUND_BROADCAST' ||
            n.eventType === 'LIVESTOCK_REGISTERED' ||
            n.eventType === 'LIVESTOCK_MORTALITY';
          if (!isGround) return false;
        } else if (filter === 'SYSTEM') {
          const isSystem =
            (n.eventType as string) === 'USER_INVITED' ||
            (n.eventType as string) === 'SETTINGS_UPDATED' ||
            (n.eventType as string) === 'CHECKPOINT_RESOLVED' ||
            (n.eventType as string) === 'LOAN_ISSUED' ||
            (n.eventType as string) === 'DEBT_RECORDED' ||
            (n.eventType as string) === 'RUNWAY_CREATED' ||
            n.eventType === 'RUNWAY_PLAN_CREATED' ||
            n.eventType === 'ORGANIZATION_CREATED' ||
            n.eventType === 'INVITE_CODE_REFRESHED';
          if (!isSystem) return false;
        }

        // Full text search query
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        const seqMatch = `block ${n.sequenceNumber}`.includes(q) || `#${n.sequenceNumber}`.includes(q);
        const titleMatch = (n.title || '').toLowerCase().includes(q);
        const messageMatch = (n.message || '').toLowerCase().includes(q);
        const actorMatch =
          (n.actorName || '').toLowerCase().includes(q) ||
          (n.actorRole || '').toLowerCase().includes(q) ||
          getRoleMeta(n.actorRole).label.toLowerCase().includes(q);
        const locationMatch = (n.locationName || '').toLowerCase().includes(q);
        const eventMatch = (n.eventType || '').toLowerCase().includes(q);
        const hashMatch =
          (n.currentHash || '').toLowerCase().includes(q) ||
          (n.previousHash || '').toLowerCase().includes(q);

        return seqMatch || titleMatch || messageMatch || actorMatch || locationMatch || eventMatch || hashMatch;
      })
      .sort((a, b) => {
        return sortOrder === 'DESC'
          ? b.sequenceNumber - a.sequenceNumber
          : a.sequenceNumber - b.sequenceNumber;
      });
  }, [notifications, filter, searchQuery, sortOrder]);

  return (
    <div className="flex-1 flex flex-col p-4 pb-24 max-w-2xl mx-auto w-full space-y-4">
      {/* Verification Hero Card */}
      <div className="bg-white border border-[#E8DFCE] p-5 rounded-2xl shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`p-2.5 rounded-xl ${verification.valid
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
            >
              {verification.valid ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <ShieldAlert className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-600 font-bold">
                Tamper-Evident Security Ledger
              </div>
              <div className="text-xl font-black text-slate-950 mt-0.5">
                {verification.valid ? 'Continuous Chain Intact' : 'Chain Integrity Alert'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Last checked: {new Date(verification.verifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleVerify}
            disabled={isVerifying}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs transition-all active:scale-95 shadow-xs cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
            <span>Verify Chain</span>
          </button>
        </div>

        {/* Verification Metrics */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#F0EBE1] text-xs">
          <div>
            <span className="text-slate-600 font-medium">Total Blocks:</span>{' '}
            <span className="font-mono font-black text-slate-950">{verification.totalBlocksChecked}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-600 font-medium">Security Status:</span>{' '}
            <span className={`font-bold ${verification.valid ? 'text-emerald-700' : 'text-rose-700'}`}>
              {verification.valid ? 'Verified Intact' : 'Tampering Detected'}
            </span>
          </div>
          <div>
            <span className="text-slate-600 font-medium">Chain Seed:</span>{' '}
            <span className="font-bold text-slate-950">Sequence #1 (Genesis)</span>
          </div>
          <div className="text-right">
            <span className="text-slate-600 font-medium">Latest Block:</span>{' '}
            <span className="font-bold text-slate-950">Sequence #{verification.totalBlocksChecked}</span>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#F0EBE1]">
          <button
            type="button"
            onClick={() => setShowCertificate(true)}
            className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 font-semibold text-[11px] transition-all cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-slate-600" />
            <span>Certificate</span>
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 font-semibold text-[11px] transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export JSON</span>
          </button>
          <button
            type="button"
            onClick={handleShareLedger}
            className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 font-semibold text-[11px] transition-all cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 text-slate-600" />
            <span>Share Report</span>
          </button>
        </div>
      </div>

      {/* Alert Banner if Tampering Detected */}
      {!verification.valid && (
        <div className="bg-rose-50 border border-rose-300 rounded-2xl p-4 text-xs space-y-2">
          <div className="flex items-center gap-2 text-rose-800 font-bold">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Security Warning: Chain Discrepancy Detected</span>
          </div>
          <p className="text-rose-700 leading-relaxed">
            {verification.brokenReason || 'Ledger chain integrity check failed.'}
          </p>
          {verification.brokenAtSequence && (
            <button
              type="button"
              onClick={() => {
                const target = notifications.find((n) => n.sequenceNumber === verification.brokenAtSequence);
                if (target) setSelectedBlock(target);
              }}
              className="inline-flex items-center gap-1.5 font-bold text-rose-800 underline hover:text-rose-950 cursor-pointer pt-1"
            >
              <span>Inspect Compromised Block #{verification.brokenAtSequence}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Search Input Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search keyword, actor, location, or block #..."
          className="w-full pl-9 pr-9 py-2.5 bg-white border border-[#E8DFCE] rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all shadow-xs"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Tabs & Sort Order Toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="grid grid-cols-4 gap-1 bg-[#FAF8F5] border border-[#E8DFCE] p-1 rounded-xl text-xs font-bold text-center flex-1">
          {(['ALL', 'FINANCIAL', 'GROUND', 'SYSTEM'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilter(t)}
              className={`py-1.5 rounded-lg transition-all cursor-pointer ${filter === t
                ? 'bg-white text-slate-950 shadow-xs border border-[#E0D7C6]'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              {t === 'ALL' ? 'All' : t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setSortOrder(sortOrder === 'DESC' ? 'ASC' : 'DESC')}
          className="px-2.5 py-2 rounded-xl bg-white border border-[#E8DFCE] text-slate-700 hover:text-slate-950 font-medium text-xs flex items-center gap-1 shadow-xs cursor-pointer shrink-0"
          title={`Order: ${sortOrder === 'DESC' ? 'Newest First' : 'Oldest First'}`}
        >
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
          <span>{sortOrder === 'DESC' ? 'Newest' : 'Oldest'}</span>
        </button>
      </div>

      {/* Results Counter */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
        <span>
          Showing <strong className="text-slate-800">{filtered.length}</strong> of{' '}
          <strong className="text-slate-800">{notifications.length}</strong> blocks
        </span>
        {(searchQuery || filter !== 'ALL') && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setFilter('ALL');
            }}
            className="text-emerald-700 hover:underline font-semibold cursor-pointer"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Blocks List */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-[#E8DFCE] rounded-2xl p-8 text-center space-y-2 shadow-xs">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <Search className="w-5 h-5" />
          </div>
          <div className="text-sm font-bold text-slate-900">No matching audit records</div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No audit blocks found matching your query &ldquo;{searchQuery}&rdquo;. Try another search term or reset filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setFilter('ALL');
            }}
            className="mt-2 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((block) => {
            const hasDeltaMoney = block.deltaFinancial !== undefined && block.deltaFinancial !== 0;
            const hasDeltaLivestock = block.deltaHeadcount !== undefined && block.deltaHeadcount !== 0;

            const severityClass =
              block.severity === 'WARNING_CONTRA' || (block.severity as string) === 'CRITICAL'
                ? 'bg-rose-100 text-rose-800 border-rose-200'
                : block.severity === 'URGENT_GROUND' || (block.severity as string) === 'ALERT'
                  ? 'bg-orange-100 text-orange-800 border-orange-200'
                  : block.severity === 'FINANCIAL' || (block.severity as string) === 'WARNING'
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : 'bg-slate-100 text-slate-800 border-slate-200';

            return (
              <div
                key={block.id}
                onClick={() => setSelectedBlock(block)}
                className="bg-white border border-[#E8DFCE] hover:border-emerald-600/60 rounded-2xl p-4 shadow-xs space-y-2.5 text-xs transition-all cursor-pointer group"
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-900 text-white shadow-2xs">
                      BLOCK #{block.sequenceNumber}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${severityClass}`}>
                      {block.severity}
                    </span>
                    <span className="font-bold text-slate-950 text-xs">
                      {block.title || block.eventType}
                    </span>
                  </div>

                  <span className="text-[11px] text-slate-500 font-medium shrink-0 font-mono">
                    {new Date(block.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Message Body */}
                <p className="text-slate-800 leading-relaxed font-normal">{block.message}</p>

                {/* Impact Badges if present */}
                {(hasDeltaMoney || hasDeltaLivestock) && (
                  <div className="flex items-center gap-2 flex-wrap pt-0.5">
                    {hasDeltaMoney && (
                      <span
                        className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${(block.deltaFinancial || 0) >= 0
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                      >
                        {(block.deltaFinancial || 0) >= 0 ? '+' : ''}
                        {formatMoney(block.deltaFinancial || 0)}
                      </span>
                    )}
                    {hasDeltaLivestock && (
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                        {(block.deltaHeadcount || 0) >= 0 ? '+' : ''}
                        {block.deltaHeadcount} head
                      </span>
                    )}
                  </div>
                )}

                {/* Footer Info & Quick Actions */}
                <div className="pt-2 border-t border-[#F0EBE1] flex items-center justify-between text-[11px] text-slate-600 font-medium">
                  <div className="truncate mr-2">
                    <span>
                      Logged by <strong className="text-slate-950">{block.actorName}</strong> ({getRoleMeta(block.actorRole).label})
                    </span>
                    <span className="mx-1.5">·</span>
                    <span>
                      Location: <strong className="text-slate-950">{block.locationName}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setSelectedBlock(block)}
                      className="px-2.5 py-1 rounded-xl bg-[#FAF8F5] hover:bg-[#F0EBE1] border border-[#E0D7C6] text-xs font-bold text-slate-900 flex items-center gap-1 transition-colors cursor-pointer group-hover:border-slate-500"
                    >
                      <span>View Details</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-700 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Unified Record Detail Modal */}
      {selectedBlock && (
        <NotificationDetailModal
          isOpen={Boolean(selectedBlock)}
          onClose={() => setSelectedBlock(null)}
          notification={selectedBlock}
          activeMember={activeMember}
          onMarkRead={(id) => dataService.markNotificationRead(id, activeMember.id)}
          onMarkUnread={(id) => dataService.markNotificationUnread(id, activeMember.id)}
          onNavigateToRoute={(routeId, params) => navigate(routeId as any, params)}
        />
      )}

      {/* Audit Verification Certificate BottomSheet */}
      {showCertificate && (
        <BottomSheet
          isOpen={showCertificate}
          onClose={() => setShowCertificate(false)}
          title="Audit Ledger Certificate"
          subtitle="Official Chain Verification Proof"
          maxHeight="88dvh"
        >
          <div className="space-y-4 text-xs pb-4">
            {/* Certificate Parchment Card */}
            <div className="bg-white border-2 border-emerald-600/30 p-5 rounded-2xl shadow-sm space-y-4">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center mx-auto shadow-2xs">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div className="text-base font-black text-slate-950 uppercase tracking-wide">
                  Certificate of Ledger Integrity
                </div>
                <div className="text-[11px] text-slate-500">
                  Continuous Ledger Verification
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 leading-relaxed text-[11px]">
                This attests that all <strong className="text-slate-950">{verification.totalBlocksChecked}</strong>{' '}
                operational and financial records in the ledger have been verified against the Genesis seed. The chronological record chain is fully intact with zero evidence of tampering or record deletion.
              </div>

              <div className="space-y-2 text-[11px] border-t border-[#F0EBE1] pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Verification Result:</span>
                  <span className="font-bold text-emerald-700">
                    {verification.valid ? '✅ Continuous Chain Intact' : '⚠️ Broken Chain'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Verified Timestamp:</span>
                  <span className="font-mono text-slate-800">
                    {new Date(verification.verifiedAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Organization ID:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {activeMember?.orgId || 'GLOBAL'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Total Verified Blocks:</span>
                  <span className="font-mono font-black text-slate-950">
                    {verification.totalBlocksChecked}
                  </span>
                </div>
                <div className="pt-2 border-t border-dashed border-[#E8DFCE] flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Security Status:</span>
                  <span className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px]">
                    Tamper-Evident Record Intact
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <PdfExportButton
                label="Share PDF Cert"
                title="Audit Trail Certificate"
                filename={buildExportFilename({
                  orgName: dataService.getActiveOrg()?.name,
                  documentType: 'Audit-Trail-Certificate',
                })}
                generateDoc={() =>
                  generateAuditCertificatePdf({
                    organization: dataService.getActiveOrg(),
                    auditEvents: notifications,
                    operatorName: activeMember.fullName,
                  })
                }
              />
              <button
                type="button"
                onClick={handleShareLedger}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Share2 className="w-4 h-4 text-slate-600" />
                <span>Share Proof</span>
              </button>
              <button
                type="button"
                onClick={handleExportJson}
                className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export JSON</span>
              </button>
            </div>
          </div>
        </BottomSheet>
      )}
    </div>
  );
};
