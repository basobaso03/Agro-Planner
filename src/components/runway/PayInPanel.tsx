import React, { useState, useMemo, useEffect } from 'react';
import {
  Receipt,
  PlusCircle,
  CheckCircle,
  XCircle,
  Clock,
  Upload,
  AlertCircle,
  ShieldCheck,
  Check,
  X,
  Users,
  CheckCircle2,
  UserCheck,
  Maximize2,
  Eye,
  Trash2,
} from 'lucide-react';
import type {
  RunwayPlan,
  RunwayPledge,
  RunwayFundingLayers,
  RunwayPaymentClaim,
  PaymentClaimMethod,
} from '../../types/runway';
import type { OrgMember, CapitalContributionEvent } from '../../types/agro';
import { PERMISSIONS } from '../../utils/permissions';
import { compressImage } from '../../utils/imageUpload';
import { ImageViewerSheet } from '../ui/ImageViewerSheet.tsx';
import { CountUp } from './CountUp';

interface PayInPanelProps {
  plan: RunwayPlan;
  claims: RunwayPaymentClaim[];
  pledges?: RunwayPledge[];
  contributions?: CapitalContributionEvent[];
  layers?: RunwayFundingLayers;
  currentMember: OrgMember;
  members: OrgMember[];
  onSubmitClaim: (params: {
    planId: string;
    memberId?: string;
    pledgeId?: string;
    amount: number;
    method: PaymentClaimMethod;
    reference?: string;
    receiptPhotoDataUrl?: string;
    note?: string;
    autoConfirm?: boolean;
  }) => void;
  onResolveClaim?: (params: {
    claimId: string;
    decision: 'CONFIRM' | 'REJECT';
    note?: string;
  }) => void;
  readOnly?: boolean;
}

const formatRole = (role?: string) => {
  if (!role) return '';
  return role
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export const PayInPanel: React.FC<PayInPanelProps> = ({
  plan,
  claims,
  pledges = [],
  contributions = [],
  layers,
  currentMember,
  members,
  onSubmitClaim,
  onResolveClaim,
  readOnly = false,
}) => {
  const canConfirm = PERMISSIONS.canConfirmPaymentClaim(currentMember.role);

  // Deduplicated org members list including currentMember
  const activeMembers = useMemo(() => {
    const currentEmail = (currentMember.email || currentMember.phoneOrEmail || '').trim().toLowerCase();
    const list = [...members];
    const hasCurrent = list.some(
      (m) =>
        m.id === currentMember.id ||
        (currentMember.uid && m.uid === currentMember.uid) ||
        (currentEmail && (m.email || m.phoneOrEmail || '').trim().toLowerCase() === currentEmail)
    );
    if (!hasCurrent && currentMember.id) {
      list.unshift(currentMember);
    }
    return list;
  }, [members, currentMember]);

  const [selectedMemberId, setSelectedMemberId] = useState<string>(currentMember.id);
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<PaymentClaimMethod>('ECOCASH');
  const [reference, setReference] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [receiptPhoto, setReceiptPhoto] = useState<string>('');
  const [autoConfirmPayIn, setAutoConfirmPayIn] = useState<boolean>(canConfirm);
  const [confirmingClaim, setConfirmingClaim] = useState<RunwayPaymentClaim | null>(null);
  const [resolutionNote, setResolutionNote] = useState<string>('');
  const [payInBanner, setPayInBanner] = useState<string | null>(null);
  const [activeReceiptPhoto, setActiveReceiptPhoto] = useState<{
    url: string;
    title: string;
    subtitle?: string;
  } | null>(null);

  useEffect(() => {
    if (activeMembers.length > 0 && !activeMembers.some((m) => m.id === selectedMemberId)) {
      setSelectedMemberId(activeMembers[0].id);
    }
  }, [activeMembers, selectedMemberId]);

  const planClaims = claims.filter((c) => c.planId === plan.id);
  const pendingClaims = planClaims.filter((c) => c.status === 'PENDING');
  const resolvedClaims = planClaims.filter((c) => c.status !== 'PENDING');

  // Compute each pledger / member's pledge & pay-in progress
  const pledgerRows = useMemo(() => {
    return activeMembers.map((mem) => {
      const pledge = pledges.find((p) => p.planId === plan.id && p.memberId === mem.id);
      const paid = contributions
        .filter((c) => c.runwayPlanId === plan.id && (c.memberId === mem.id || (pledge && c.pledgeId === pledge.id)))
        .reduce((acc, c) => (c.direction === 'CONTRA_REVERSAL' ? acc - Math.abs(c.amount) : acc + c.amount), 0);
      const pending = pendingClaims
        .filter((c) => c.memberId === mem.id || (pledge && c.pledgeId === pledge.id))
        .reduce((acc, c) => acc + c.amount, 0);

      const pledgedAmount = pledge?.amount || 0;
      const remaining = Math.max(0, pledgedAmount - paid);
      const paidPct = pledgedAmount > 0 ? Math.min(100, Math.round((paid / pledgedAmount) * 100)) : 0;

      // Master Capital Goal context
      const totalMasterContributed = contributions
        .filter((c) => c.memberId === mem.id)
        .reduce((acc, c) => (c.direction === 'CONTRA_REVERSAL' ? acc - Math.abs(c.amount) : acc + c.amount), 0);
      const masterTarget = mem.targetContributionUsd || 1000;
      const masterPct = masterTarget > 0 ? Math.min(100, Math.round((totalMasterContributed / masterTarget) * 100)) : 0;

      return {
        member: mem,
        pledge,
        pledgedAmount,
        paid: Math.max(0, paid),
        pending,
        remaining,
        paidPct,
        totalMasterContributed: Math.max(0, totalMasterContributed),
        masterTarget,
        masterPct,
      };
    });
  }, [activeMembers, pledges, contributions, pendingClaims, plan.id]);

  const selectedPledgerRow = useMemo(() => {
    return pledgerRows.find((r) => r.member.id === selectedMemberId) || pledgerRows[0];
  }, [pledgerRows, selectedMemberId]);

  const handleSelectPledgerForPayIn = (memberId: string, suggestedRemaining?: number) => {
    setSelectedMemberId(memberId);
    if (suggestedRemaining && suggestedRemaining > 0) {
      setAmount(suggestedRemaining.toFixed(2));
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, { maxWidth: 1024, maxHeight: 1024, quality: 0.7 });
      setReceiptPhoto(compressed);
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setReceiptPhoto(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitClaim = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = parseFloat(amount);
    if (!cleanAmount || cleanAmount <= 0) return;

    const targetRow = pledgerRows.find((r) => r.member.id === selectedMemberId);
    const shouldAutoConfirm = canConfirm && autoConfirmPayIn;

    onSubmitClaim({
      planId: plan.id,
      memberId: selectedMemberId,
      pledgeId: targetRow?.pledge?.id,
      amount: cleanAmount,
      method,
      reference: reference.trim() || undefined,
      receiptPhotoDataUrl: receiptPhoto || undefined,
      note: note.trim() || undefined,
      autoConfirm: shouldAutoConfirm,
    });

    const payerName = targetRow?.member.fullName || currentMember.fullName;
    setPayInBanner(
      shouldAutoConfirm
        ? `Recorded & confirmed $${cleanAmount.toFixed(2)} pay-in by ${payerName}! Pledge progress & Money on the Ground updated.`
        : `Submitted $${cleanAmount.toFixed(2)} pay-in claim for ${payerName} (awaiting Treasurer confirmation).`
    );
    setTimeout(() => setPayInBanner(null), 6000);

    setAmount('');
    setReference('');
    setNote('');
    setReceiptPhoto('');
  };

  const handleResolve = (decision: 'CONFIRM' | 'REJECT') => {
    if (!confirmingClaim || !onResolveClaim) return;
    onResolveClaim({
      claimId: confirmingClaim.id,
      decision,
      note: resolutionNote.trim() || undefined,
    });
    setConfirmingClaim(null);
    setResolutionNote('');
  };

  const methods: { id: PaymentClaimMethod; label: string }[] = [
    { id: 'ECOCASH', label: 'EcoCash Mobile Money' },
    { id: 'INNBUCKS', label: 'InnBucks Cash Drop' },
    { id: 'BANK_TRANSFER', label: 'Bank Electronic Transfer' },
    { id: 'CASH', label: 'Physical Cash on Ground' },
    { id: 'MUKURU', label: 'Mukuru Remittance' },
  ];

  const selectableMembers = canConfirm
    ? activeMembers
    : activeMembers.filter((m) => m.id === currentMember.id);

  return (
    <div className="space-y-6">
      {payInBanner && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{payInBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setPayInBanner(null)}
            className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 shrink-0 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Treasury & Equity Bridge Callout */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-xs flex items-start gap-3 shadow-xs">
        <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800 shrink-0 mt-0.5">
          <ShieldCheck className="w-4 h-4 text-emerald-700" />
        </div>
        <div className="space-y-0.5">
          <h4 className="font-black text-emerald-950 text-xs">
            Direct Link to Organization Master Capital Pool
          </h4>
          <p className="text-emerald-900/90 font-medium leading-relaxed">
            Every confirmed pay-in deposits physical cash into the Organization Treasury (<strong className="font-bold">leftMoney</strong>) and counts towards the member&apos;s Master Capital Target &amp; equity ownership.
          </p>
        </div>
      </div>

      {/* Pledgers & Pay-In Progress Tracker */}
      <div className="rounded-2xl bg-white border border-[#E8DFCE] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#F0EBE1] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-indigo-600" />
            <h4 className="text-sm font-black text-slate-950">
              Pledgers &amp; Pay-in Fulfilment Progress
            </h4>
          </div>
          {layers && (
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="text-slate-600">
                Pledged: <strong className="text-slate-950 font-bold">${layers.pledged.toFixed(2)}</strong>
              </span>
              <span className="text-emerald-700 font-bold">
                Paid In: <strong>${layers.collected.toFixed(2)} ({layers.collectedPct}%)</strong>
              </span>
            </div>
          )}
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-800/80">
          {pledgerRows.map(({ member: mem, pledgedAmount, paid, pending, remaining, paidPct, totalMasterContributed, masterTarget, masterPct }) => {
            const isSelected = mem.id === selectedMemberId;
            return (
              <div
                key={mem.id}
                className={`p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${isSelected ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : 'hover:bg-gray-50/50 dark:hover:bg-gray-800/40'
                  }`}
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-bold text-gray-900 dark:text-white">
                      {mem.fullName}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 font-semibold">
                      {formatRole(mem.role)}
                    </span>
                    {pledgedAmount > 0 ? (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${paid >= pledgedAmount
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : paid > 0
                            ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                      >
                        {paid >= pledgedAmount ? 'Plan Pledge Paid' : `${paidPct}% Plan Paid`}
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 font-medium">
                        No Pledge Logged
                      </span>
                    )}
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
                      Master Equity: ${totalMasterContributed.toFixed(0)} / ${masterTarget.toFixed(0)} ({masterPct}%)
                    </span>
                    {pending > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 font-bold">
                        +${pending.toFixed(2)} Pending Verification
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>
                      Plan Pledge: <strong className="text-gray-900 dark:text-white">${pledgedAmount.toFixed(2)}</strong>
                    </span>
                    <span>•</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      Plan Paid: ${paid.toFixed(2)}
                    </span>
                    <span>•</span>
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      Plan Rem: ${remaining.toFixed(2)}
                    </span>
                  </div>

                  {pledgedAmount > 0 && (
                    <div className="w-full max-w-xs h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden mt-1">
                      <div
                        className={`h-full transition-all duration-500 ${paidPct >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'
                          }`}
                        style={{ width: `${paidPct}%` }}
                      />
                    </div>
                  )}
                </div>

                {!readOnly && (canConfirm || mem.id === currentMember.id) && (
                  <button
                    type="button"
                    onClick={() => handleSelectPledgerForPayIn(mem.id, remaining)}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95 shrink-0 self-start sm:self-center"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>
                      {remaining > 0 ? `Pay Remaining ($${remaining.toFixed(2)})` : 'Record Pay-in'}
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Submit Pay-in Declaration Form */}
      {!readOnly && (
        <div className="p-5 rounded-2xl bg-white border border-[#E8DFCE] shadow-xs space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-2">
              <Receipt className="w-5 h-5 text-emerald-700" />
              <h4 className="text-sm font-black text-slate-950">
                Record Member Capital Pay-in Payment
              </h4>
            </div>
            {selectedPledgerRow && selectedPledgerRow.pledgedAmount > 0 && (
              <span className="text-xs font-bold text-emerald-800">
                {selectedPledgerRow.member.fullName}: ${selectedPledgerRow.paid.toFixed(2)} / ${selectedPledgerRow.pledgedAmount.toFixed(2)} paid (${selectedPledgerRow.remaining.toFixed(2)} remaining)
              </span>
            )}
          </div>

          <p className="text-xs text-slate-600 font-medium">
            Select the member who paid and enter the deposit details. Linked payments automatically update the member&apos;s pledge progress and credit the organization&apos;s Money on the Ground.
          </p>

          <form onSubmit={handleSubmitClaim} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-950 mb-1">
                  Member / Pledger Paying <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E8DFCE] bg-white text-xs font-bold text-slate-950"
                >
                  {(selectableMembers.length > 0 ? selectableMembers : [currentMember]).map((m) => {
                    const row = pledgerRows.find((r) => r.member.id === m.id);
                    return (
                      <option key={m.id} value={m.id}>
                        {m.fullName}
                        {row && row.pledgedAmount > 0
                          ? ` (Pledged $${row.pledgedAmount.toFixed(2)} • Rem $${row.remaining.toFixed(2)})`
                          : ' (No pledge yet)'}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Amount Deposited ($) <span className="text-rose-500">*</span>
                  </label>
                  {selectedPledgerRow && selectedPledgerRow.remaining > 0 && (
                    <button
                      type="button"
                      onClick={() => setAmount(selectedPledgerRow.remaining.toFixed(2))}
                      className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      Full Rem (${selectedPledgerRow.remaining.toFixed(2)})
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 200.00"
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-bold text-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Payment Method <span className="text-rose-500">*</span>
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentClaimMethod)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-semibold text-gray-900 dark:text-white"
                >
                  {methods.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Transaction / Transfer Reference
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. MP261103.1820.D982"
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Optional Note
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Handed cash to ground operator Kudzi"
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {canConfirm && (
              <label className="flex items-center space-x-2 text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer pt-0.5">
                <input
                  type="checkbox"
                  checked={autoConfirmPayIn}
                  onChange={(e) => setAutoConfirmPayIn(e.target.checked)}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>
                  Immediately verify &amp; credit payment to Pool / Money on the Ground and update pledge progress
                </span>
              </label>
            )}

            {/* Receipt Attachment & Thumbnail */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center space-x-3">
                <label className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{receiptPhoto ? 'Replace Receipt Photo' : 'Attach Receipt / Screenshot'}</span>
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </label>

                {receiptPhoto && (
                  <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Photo Attached
                  </span>
                )}
              </div>

              {receiptPhoto && (
                <div className="relative inline-block rounded-xl overflow-hidden border border-[#E8DFCE] bg-slate-50 group">
                  <img
                    src={receiptPhoto}
                    alt="Receipt preview"
                    onClick={() =>
                      setActiveReceiptPhoto({
                        url: receiptPhoto,
                        title: 'Receipt Preview',
                        subtitle: 'Newly attached payment proof (click to inspect)',
                      })
                    }
                    className="w-24 h-24 object-cover cursor-pointer group-hover:opacity-90 transition-opacity"
                  />
                  <div
                    onClick={() =>
                      setActiveReceiptPhoto({
                        url: receiptPhoto,
                        title: 'Receipt Preview',
                        subtitle: 'Newly attached payment proof (click to inspect)',
                      })
                    }
                    className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white"
                  >
                    <Maximize2 className="w-4 h-4 drop-shadow-sm" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setReceiptPhoto('')}
                    title="Remove receipt"
                    className="absolute top-1 right-1 p-1 rounded-full bg-rose-600 text-white shadow-xs hover:bg-rose-700 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>
                {canConfirm && autoConfirmPayIn
                  ? 'Record & Confirm Pay-in'
                  : 'Submit Pay-in Declaration'}
              </span>
            </button>
          </form>
        </div>
      )}

      {/* Pending Treasurer Verification Drawer / Section */}
      {pendingClaims.length > 0 && (
        <div className="rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-amber-600 animate-spin" />
              <h4 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                Pending Treasurer Verifications ({pendingClaims.length})
              </h4>
            </div>

            {canConfirm && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                Treasurer Action Needed
              </span>
            )}
          </div>

          <div className="divide-y divide-amber-200/50 dark:divide-amber-900/30">
            {pendingClaims.map((claim) => {
              const mem = activeMembers.find((m) => m.id === claim.memberId);
              const payerName = claim.memberName || mem?.fullName || 'Member';
              const receiptUrl = claim.receiptPhotoDataUrl || claim.proofPhotoDataUrl;
              return (
                <div key={claim.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {receiptUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          setActiveReceiptPhoto({
                            url: receiptUrl,
                            title: `Payment Receipt: ${payerName}`,
                            subtitle: `$${claim.amount.toFixed(2)} via ${claim.method}`,
                          })
                        }
                        title="Click to view full screen receipt"
                        className="relative w-12 h-12 rounded-xl overflow-hidden border border-amber-300 dark:border-amber-800 shrink-0 group cursor-pointer shadow-2xs"
                      >
                        <img
                          src={receiptUrl}
                          alt="Receipt"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <span className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white">
                          <Eye className="w-3.5 h-3.5" />
                        </span>
                      </button>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0">
                        <Receipt className="w-5 h-5" />
                      </div>
                    )}
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
                        <span>{payerName}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 font-bold">
                          {claim.method}
                        </span>
                        {receiptUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              setActiveReceiptPhoto({
                                url: receiptUrl,
                                title: `Payment Receipt: ${payerName}`,
                                subtitle: `$${claim.amount.toFixed(2)} via ${claim.method}`,
                              })
                            }
                            className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold underline cursor-pointer flex items-center gap-0.5"
                          >
                            <Eye className="w-3 h-3" /> View Receipt
                          </button>
                        )}
                      </div>
                      <div className="text-gray-500">
                        Amount: <span className="font-bold text-gray-900 dark:text-white">${claim.amount.toFixed(2)}</span>
                        {claim.reference && ` • Ref: ${claim.reference}`}
                      </div>
                      {claim.note && <p className="text-gray-500 italic truncate">{claim.note}</p>}
                    </div>
                  </div>

                  {canConfirm && (
                    <button
                      onClick={() => setConfirmingClaim(claim)}
                      className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer shrink-0 self-start sm:self-center"
                    >
                      Verify / Resolve
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmingClaim && (
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
            className="w-full max-w-sm rounded-2xl bg-white border border-[#E8DFCE] p-4 sm:p-5 space-y-3.5 shadow-2xl overflow-y-auto overscroll-contain"
          >
            <h4 className="text-base font-black text-slate-950">
              Verify Member Pay-in
            </h4>

            <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE] space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600 font-semibold">Paid By:</span>
                <span className="font-black text-slate-950">
                  {confirmingClaim.memberName || activeMembers.find((m) => m.id === confirmingClaim.memberId)?.fullName || 'Member'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-semibold">Claim Amount:</span>
                <span className="font-black text-emerald-700">${confirmingClaim.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Method:</span>
                <span className="font-semibold">{confirmingClaim.method}</span>
              </div>
              {confirmingClaim.reference && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Reference:</span>
                  <span className="font-mono">{confirmingClaim.reference}</span>
                </div>
              )}
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-950 font-medium">
              ✓ Confirming will add <strong>${confirmingClaim.amount.toFixed(2)}</strong> to Organization Left Money and credit <strong>{confirmingClaim.memberName || 'the member'}</strong>&apos;s Master Capital stake.
            </div>

            {confirmingClaim.receiptPhotoDataUrl && (
              <div
                onClick={() =>
                  setActiveReceiptPhoto({
                    url: confirmingClaim.receiptPhotoDataUrl!,
                    title: `Receipt: ${confirmingClaim.memberName || 'Member'}`,
                    subtitle: `$${confirmingClaim.amount.toFixed(2)} via ${confirmingClaim.method}`,
                  })
                }
                className="relative cursor-pointer group rounded-xl overflow-hidden border border-gray-200 bg-slate-50"
                title="Click to view full screen"
              >
                <img
                  src={confirmingClaim.receiptPhotoDataUrl}
                  alt="Receipt screenshot"
                  className="w-full max-h-48 object-contain group-hover:opacity-90 transition-opacity"
                />
                <span className="absolute bottom-2 right-2 px-2 py-1 rounded-lg bg-black/70 text-white text-[10px] font-bold flex items-center gap-1 shadow-sm">
                  <Maximize2 className="w-3 h-3" /> Full Screen
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Resolution Note
              </label>
              <input
                type="text"
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="e.g. Verified on bank statement"
                className="w-full px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-700 text-xs"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleResolve('REJECT')}
                className="px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-bold"
              >
                Reject Claim
              </button>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setConfirmingClaim(null)}
                  className="px-3 py-2 rounded-xl text-gray-500 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleResolve('CONFIRM')}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-md"
                >
                  Confirm & Credit Pool
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History of Confirmed Claims */}
      <div className="rounded-2xl bg-white border border-[#E8DFCE] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E8DFCE]">
          <h4 className="text-sm font-black text-slate-950">
            Resolved Payment Claims ({resolvedClaims.length})
          </h4>
        </div>

        {resolvedClaims.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 font-medium">
            No resolved payment claims recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-[#E8DFCE] text-xs">
            {resolvedClaims.map((claim) => {
              const mem = activeMembers.find((m) => m.id === claim.memberId);
              const payerName = claim.memberName || mem?.fullName || 'Member';
              const receiptUrl = claim.receiptPhotoDataUrl || claim.proofPhotoDataUrl;
              return (
                <div key={claim.id} className="p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {receiptUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          setActiveReceiptPhoto({
                            url: receiptUrl,
                            title: `Payment Receipt: ${payerName}`,
                            subtitle: `$${claim.amount.toFixed(2)} (${claim.status}) via ${claim.method}`,
                          })
                        }
                        title="Click to view full screen receipt"
                        className="relative w-10 h-10 rounded-xl overflow-hidden border border-[#E8DFCE] shrink-0 group cursor-pointer shadow-2xs"
                      >
                        <img
                          src={receiptUrl}
                          alt="Receipt thumbnail"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <span className="absolute inset-0 bg-black/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white">
                          <Eye className="w-3.5 h-3.5" />
                        </span>
                      </button>
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                        <Receipt className="w-4 h-4" />
                      </div>
                    )}
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-gray-900 dark:text-white truncate">
                          {payerName}
                        </span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          +${claim.amount.toFixed(2)}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${claim.status === 'CONFIRMED'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}
                        >
                          {claim.status}
                        </span>
                        {receiptUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              setActiveReceiptPhoto({
                                url: receiptUrl,
                                title: `Payment Receipt: ${payerName}`,
                                subtitle: `$${claim.amount.toFixed(2)} (${claim.status}) via ${claim.method}`,
                              })
                            }
                            className="text-[10px] text-indigo-600 font-bold underline cursor-pointer flex items-center gap-0.5"
                          >
                            <Eye className="w-3 h-3" /> Receipt
                          </button>
                        )}
                      </div>
                      <div className="text-gray-500">
                        {claim.method} {claim.reference ? `• Ref: ${claim.reference}` : ''}
                        {claim.resolutionNote ? ` • ${claim.resolutionNote}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="text-right text-[11px] text-gray-400 shrink-0">
                    {claim.resolvedAt ? new Date(claim.resolvedAt).toLocaleDateString() : ''}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ImageViewerSheet
        isOpen={Boolean(activeReceiptPhoto)}
        onClose={() => setActiveReceiptPhoto(null)}
        imageUrl={activeReceiptPhoto?.url}
        title={activeReceiptPhoto?.title || 'Payment Receipt'}
        subtitle={activeReceiptPhoto?.subtitle}
      />
    </div>
  );
};
