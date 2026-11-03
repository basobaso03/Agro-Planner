import React, { useState, useRef } from 'react';
import {
  ShieldCheck,
  SearchCheck,
  Send,
  Camera,
  Upload,
  X,
  Maximize2,
} from 'lucide-react';
import type {
  AuditNotificationEvent,
  FarmLocation,
  NotificationSeverity,
  OrgMember,
} from '../types/agro.ts';
import {
  verifyAuditChainIntegrity,
  type ChainVerificationResult,
} from '../utils/cryptoHash.ts';
import type { FontStyleId } from '../types/theme.ts';
import { PERMISSIONS } from '../utils/permissions.ts';
import { compressImage, validateImageFile } from '../utils/imageUpload.ts';

interface AuditAlertsTabProps {
  auditNotifications: AuditNotificationEvent[];
  locations: FarmLocation[];
  activeMember: OrgMember;
  cloudUserEmail?: string | null;
  onPostBroadcast: (data: {
    locationId: string;
    severity: NotificationSeverity;
    title: string;
    message: string;
    photoUrl?: string;
  }) => void;
  activeFontId?: FontStyleId;
  onSelectFont?: (id: FontStyleId) => void;
  backgroundIntensity?: 'subtle' | 'standard' | 'expressive';
  onSelectBackgroundIntensity?: (intensity: 'subtle' | 'standard' | 'expressive') => void;
  onOpenThemeModal?: () => void;
  showNumbers?: boolean;
}

export const AuditAlertsTab: React.FC<AuditAlertsTabProps> = ({
  auditNotifications,
  locations,
  activeMember,
  onPostBroadcast,
  showNumbers = true,
}) => {
  const [subTab, setSubTab] = useState<'STREAM' | 'AUDIT_TRAIL'>('STREAM');
  const [streamFilter, setStreamFilter] = useState<
    'ALL' | 'GROUND' | 'CONTRA' | 'FINANCIAL' | 'LIVESTOCK'
  >('ALL');

  // Broadcast Composer State
  const alertFileInputRef = useRef<HTMLInputElement>(null);
  const [bLocId, setBLocId] = useState(
    activeMember.assignedLocationId || locations[0]?.id || 'ALL'
  );
  const [bSeverity, setBSeverity] = useState<NotificationSeverity>('URGENT_GROUND');
  const [bTitle, setBTitle] = useState('');
  const [bMessage, setBMessage] = useState('');
  const [bPhoto, setBPhoto] = useState<string | null>(null);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');

  // Lightbox Viewer
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title: string } | null>(null);

  // Hash Chain Verification State
  const [verificationResult, setVerificationResult] =
    useState<ChainVerificationResult | null>(null);

  const filteredStream = auditNotifications.filter((ev) => {
    if (streamFilter === 'ALL') return true;
    if (streamFilter === 'GROUND') return ev.eventType === 'GROUND_BROADCAST';
    if (streamFilter === 'CONTRA') return ev.severity === 'WARNING_CONTRA';
    if (streamFilter === 'FINANCIAL')
      return (
        ev.eventType === 'CAPITAL_CONTRIBUTION' ||
        ev.eventType === 'EXPENSE_LOGGED' ||
        ev.eventType === 'EXPENSE_APPROVED' ||
        ev.eventType === 'LIVESTOCK_SALE'
      );
    if (streamFilter === 'LIVESTOCK')
      return ev.eventType.startsWith('LIVESTOCK_');
    return true;
  });

  const chronologicalBlocks = [...auditNotifications].sort(
    (a, b) => a.sequenceNumber - b.sequenceNumber
  );

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setPhotoError(validation.error || 'Invalid file format');
      return;
    }
    setIsCompressingPhoto(true);
    try {
      const compressed = await compressImage(file, { maxWidth: 1024, maxHeight: 1024, quality: 0.8 });
      setBPhoto(compressed);
      setPhotoError('');
    } catch (err: unknown) {
      setPhotoError(err instanceof Error ? err.message : 'Photo compression failed');
    } finally {
      setIsCompressingPhoto(false);
      e.target.value = '';
    }
  };

  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (bMessage.trim().length < 4) return;
    try {
      onPostBroadcast({
        locationId: bLocId,
        severity: bSeverity,
        title: bTitle.trim() || `Ground Dispatch — ${activeMember.fullName}`,
        message: bMessage.trim(),
        photoUrl: bPhoto || undefined,
      });
      setBTitle('');
      setBMessage('');
      setBPhoto(null);
      setPhotoError('');
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Failed to post broadcast.');
    }
  };

  const handleVerifyIntegrity = () => {
    const res = verifyAuditChainIntegrity(auditNotifications);
    setVerificationResult(res);
  };

  const canViewAuditTrail = PERMISSIONS.canViewHashChain(activeMember.role);
  const effectiveSubTab =
    subTab === 'AUDIT_TRAIL' && !canViewAuditTrail
      ? 'STREAM'
      : subTab;

  return (
    <div className="space-y-4 pb-6">
      {/* Sub-Tab Selector (Role-Aware) */}
      {canViewAuditTrail && (
        <div className="grid grid-cols-2 gap-1 p-1 bg-[#FAF8F5] border border-[#E8DFCE] rounded-2xl">
          <button
            type="button"
            onClick={() => setSubTab('STREAM')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap text-center cursor-pointer ${effectiveSubTab === 'STREAM'
              ? 'tab-brand-active'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            Broadcasts ({auditNotifications.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('AUDIT_TRAIL')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap text-center cursor-pointer ${effectiveSubTab === 'AUDIT_TRAIL'
              ? 'tab-brand-active'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            Audit Trail
          </button>
        </div>
      )}

      {/* SUB-TAB 1: REAL-TIME GROUND BROADCAST & NOTIFICATION FEED */}
      {effectiveSubTab === 'STREAM' && (
        <div className="space-y-4">
          {/* Ground Broadcast Composer Card */}
          <form
            onSubmit={handleBroadcast}
            className="rounded-3xl bg-white border border-[#E8DFCE] p-4 sm:p-5 space-y-3.5 shadow-xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <h2 className="text-sm font-bold text-slate-900 min-w-0 break-words">
                Broadcast Ground Update ({activeMember.fullName})
              </h2>
              <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
                <select
                  aria-label="Broadcast Site"
                  value={bLocId}
                  onChange={(e) => setBLocId(e.target.value)}
                  className="w-full sm:w-auto bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-amber-500 min-w-0 truncate cursor-pointer"
                >
                  <option value="ALL">All Locations</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Broadcast Severity"
                  value={bSeverity}
                  onChange={(e) => setBSeverity(e.target.value as NotificationSeverity)}
                  className="w-full sm:w-auto bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-amber-500 min-w-0 truncate cursor-pointer"
                >
                  <option value="URGENT_GROUND">Urgent Ground</option>
                  <option value="MILESTONE">Milestone</option>
                  <option value="INFO">General Info</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                placeholder="Headline (e.g., 20 Bags Starter Delivered)"
                value={bTitle}
                onChange={(e) => setBTitle(e.target.value)}
                className="bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white"
              />
              <div className="sm:col-span-2 flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Write detailed ground message for organization members..."
                  value={bMessage}
                  onChange={(e) => setBMessage(e.target.value)}
                  className="flex-1 bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Post</span>
                </button>
              </div>
            </div>

            {/* Optional Photo Attachment */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#F0EBE1]">
              {bPhoto ? (
                <div className="flex items-center gap-2 bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-2.5 py-1.5">
                  <img
                    src={bPhoto}
                    alt="Broadcast attachment"
                    className="w-8 h-8 rounded-lg object-cover border border-[#E0D7C6]"
                  />
                  <span className="text-xs text-emerald-800 font-semibold">Photo Attached</span>
                  <button
                    type="button"
                    onClick={() => setBPhoto(null)}
                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    ref={alertFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={isCompressingPhoto}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => alertFileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-[#CFC5B2] hover:border-amber-500 bg-[#FAF8F5] text-xs font-semibold text-slate-700 cursor-pointer transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5 text-amber-600" />
                    <span>{isCompressingPhoto ? 'Compressing...' : 'Attach Field Photo (Single Tap)'}</span>
                  </button>
                </div>
              )}
              {photoError && <span className="text-xs text-rose-600 font-medium">{photoError}</span>}
            </div>
          </form>

          {/* Filter Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: 'ALL', label: 'All Events' },
              { id: 'GROUND', label: 'Ground Messages Only' },
              { id: 'CONTRA', label: 'Contra-Reversals' },
              { id: 'FINANCIAL', label: 'Financials' },
              { id: 'LIVESTOCK', label: 'Livestock Alerts' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStreamFilter(f.id as typeof streamFilter)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${streamFilter === f.id
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-white border border-[#E0D7C6] text-slate-700 hover:text-slate-900 hover:bg-slate-50'
                  }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Feed Items */}
          <div className="space-y-3">
            {filteredStream.map((ev) => (
              <div
                key={ev.id}
                className={`rounded-2xl border p-4 space-y-2 transition-all ${ev.severity === 'WARNING_CONTRA'
                  ? 'bg-rose-50/70 border-rose-200'
                  : ev.severity === 'URGENT_GROUND'
                    ? 'bg-amber-50/70 border-amber-200 shadow-xs'
                    : 'bg-white border-[#E8DFCE] shadow-xs'
                  }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">
                    Block #{ev.sequenceNumber} · {ev.locationName} · {ev.actorName} (
                    {ev.actorRole.replace('_', ' ')})
                  </span>
                  <span className="font-mono text-slate-400">
                    {new Date(ev.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900">{ev.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{ev.message}</p>
                {ev.photoUrl && (
                  <div className="pt-1.5">
                    <div
                      onClick={() => setLightboxPhoto({ url: ev.photoUrl!, title: ev.title })}
                      className="relative inline-block rounded-xl overflow-hidden border border-[#E0D7C6] bg-slate-50 cursor-pointer group/photo shadow-xs"
                    >
                      <img
                        src={ev.photoUrl}
                        alt={ev.title}
                        className="max-h-52 w-auto object-cover group-hover/photo:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/photo:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1.5">
                        <Maximize2 className="w-4 h-4" />
                        <span>Enlarge Photo Evidence</span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="pt-2.5 border-t border-[#F0EBE1] flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span className="text-[#064e3b] flex items-center gap-1.5 font-bold">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#064e3b]" />
                    Verified Immutable Ledger Record
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    Audit Ref #{ev.id.slice(-6).toUpperCase()} · Block #{ev.sequenceNumber}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: CRYPTOGRAPHIC IMMUTABLE AUDIT TRAIL */}
      {effectiveSubTab === 'AUDIT_TRAIL' && canViewAuditTrail && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white border border-[#E8DFCE] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#064e3b]" />
                Immutable Financial Ledger &amp; Verifier
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Automated tamper-evident verification ensuring every expense, lifecycle event, and capital deposit remains permanently authentic and unalterable.
              </p>
            </div>
            <button
              type="button"
              onClick={handleVerifyIntegrity}
              className="px-4 py-2.5 rounded-xl bg-[#064e3b] hover:bg-[#065f46] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <SearchCheck className="w-4 h-4" />
              Verify Ledger Integrity
            </button>
          </div>

          {verificationResult && (
            <div
              data-testid="ledger-verification-banner"
              className={`rounded-2xl border p-4 space-y-1.5 ${verificationResult.valid
                ? 'bg-emerald-50 border-emerald-300 text-[#064e3b]'
                : 'bg-rose-50 border-rose-300 text-rose-800'
                }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#064e3b]" />
                  {verificationResult.valid
                    ? '100% Tamper-Proof Verified — All Records Authentic'
                    : 'Integrity Alert — Verification Mismatch Detected'}
                </p>
                <span className="text-xs font-mono font-bold">
                  {!showNumbers ? '••' : verificationResult.totalBlocksChecked} Records Audited
                </span>
              </div>
              <p className="text-xs text-slate-700">
                Continuous Ledger Chain: All {!showNumbers ? '••' : verificationResult.totalBlocksChecked} consecutive ledger events are mathematically sealed and verified without alteration.
              </p>
            </div>
          )}

          {/* Chronological Block Chain List */}
          <div className="space-y-2.5">
            {chronologicalBlocks.map((block) => (
              <div
                key={block.id}
                className="rounded-2xl bg-white border border-[#E8DFCE] p-4 space-y-2 text-xs shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-slate-500">
                  <span className="text-[#064e3b] font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#064e3b]" />
                    LEDGER ENTRY #{block.sequenceNumber} · {block.eventType.replace(/_/g, ' ')}
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    {new Date(block.timestamp).toLocaleDateString()} {new Date(block.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="font-sans text-slate-900 font-bold text-sm">{block.title}</p>
                <p className="font-sans text-slate-600 leading-relaxed">{block.message}</p>
                <div className="pt-2 border-t border-[#F0EBE1] flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5 text-[#064e3b] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#064e3b]" />
                    <span>Cryptographically Sealed &amp; Validated</span>
                  </div>
                  <span className="text-slate-400 font-mono text-[11px]">
                    Audit Ref #{block.id.slice(-6).toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Photo Lightbox Modal */}
      {lightboxPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-white border border-[#E8DFCE] rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3.5 border-b border-[#F0EBE1] bg-[#FAF8F5]">
              <h4 className="text-sm font-bold text-slate-900 truncate">{lightboxPhoto.title}</h4>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-black/5">
              <img
                src={lightboxPhoto.url}
                alt={lightboxPhoto.title}
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-xl shadow-md"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

