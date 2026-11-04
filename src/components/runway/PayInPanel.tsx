import React, { useState } from 'react';
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
} from 'lucide-react';
import type { RunwayPlan, RunwayPaymentClaim, PaymentClaimMethod } from '../../types/runway';
import type { OrgMember } from '../../types/agro';
import { PERMISSIONS } from '../../utils/permissions';
import { CountUp } from './CountUp';

interface PayInPanelProps {
  plan: RunwayPlan;
  claims: RunwayPaymentClaim[];
  currentMember: OrgMember;
  members: OrgMember[];
  onSubmitClaim: (params: {
    planId: string;
    amount: number;
    method: PaymentClaimMethod;
    reference?: string;
    receiptPhotoDataUrl?: string;
    note?: string;
  }) => void;
  onResolveClaim?: (params: {
    claimId: string;
    decision: 'CONFIRM' | 'REJECT';
    note?: string;
  }) => void;
  readOnly?: boolean;
}

export const PayInPanel: React.FC<PayInPanelProps> = ({
  plan,
  claims,
  currentMember,
  members,
  onSubmitClaim,
  onResolveClaim,
  readOnly = false,
}) => {
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<PaymentClaimMethod>('ECOCASH');
  const [reference, setReference] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [receiptPhoto, setReceiptPhoto] = useState<string>('');
  const [confirmingClaim, setConfirmingClaim] = useState<RunwayPaymentClaim | null>(null);
  const [resolutionNote, setResolutionNote] = useState<string>('');

  const canConfirm = PERMISSIONS.canConfirmPaymentClaim(currentMember.role);
  const planClaims = claims.filter((c) => c.planId === plan.id);
  const pendingClaims = planClaims.filter((c) => c.status === 'PENDING');
  const resolvedClaims = planClaims.filter((c) => c.status !== 'PENDING');

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setReceiptPhoto(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitClaim = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = parseFloat(amount);
    if (!cleanAmount || cleanAmount <= 0) return;

    onSubmitClaim({
      planId: plan.id,
      amount: cleanAmount,
      method,
      reference: reference.trim() || undefined,
      receiptPhotoDataUrl: receiptPhoto || undefined,
      note: note.trim() || undefined,
    });

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

  return (
    <div className="space-y-6">
      {/* Submit Pay-in Declaration Form */}
      {!readOnly && (
        <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs space-y-4">
          <div className="flex items-center space-x-2">
            <Receipt className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-sm font-bold text-gray-900 dark:text-white">
              Declare Capital Pay-in Payment
            </h4>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Submit your deposit reference or cash hand-off details. The Organization Treasurer will verify the receipt and confirm your funds into the runway pool.
          </p>

          <form onSubmit={handleSubmitClaim} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Amount Deposited ($) *
                </label>
                <input
                  type="number"
                  min="1"
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
                  Payment Method *
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentClaimMethod)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-semibold"
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
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs"
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
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs"
                />
              </div>
            </div>

            {/* Receipt Attachment */}
            <div className="flex items-center space-x-3 pt-1">
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

            <button
              type="submit"
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Submit Pay-in Declaration</span>
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
              const mem = members.find((m) => m.id === claim.memberId);
              return (
                <div key={claim.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <span>{mem?.fullName || 'Member'}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300">
                        {claim.method}
                      </span>
                    </div>
                    <div className="text-gray-500">
                      Amount: <span className="font-bold text-gray-900 dark:text-white">${claim.amount.toFixed(2)}</span>
                      {claim.reference && ` • Ref: ${claim.reference}`}
                    </div>
                    {claim.note && <p className="text-gray-500 italic">{claim.note}</p>}
                  </div>

                  {canConfirm && (
                    <button
                      onClick={() => setConfirmingClaim(claim)}
                      className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 space-y-4 shadow-2xl">
            <h4 className="text-base font-bold text-gray-900 dark:text-white">
              Verify Member Pay-in
            </h4>

            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Claim Amount:</span>
                <span className="font-bold text-emerald-600">${confirmingClaim.amount.toFixed(2)}</span>
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

            {confirmingClaim.receiptPhotoDataUrl && (
              <img
                src={confirmingClaim.receiptPhotoDataUrl}
                alt="Receipt screenshot"
                className="w-full max-h-48 object-contain rounded-xl border border-gray-200"
              />
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
      <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <h4 className="text-sm font-bold text-gray-900 dark:text-white">
            Resolved Payment Claims ({resolvedClaims.length})
          </h4>
        </div>

        {resolvedClaims.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-400">
            No resolved payment claims recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800/80 text-xs">
            {resolvedClaims.map((claim) => (
              <div key={claim.id} className="p-3.5 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-gray-900 dark:text-white">
                      ${claim.amount.toFixed(2)}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${claim.status === 'CONFIRMED'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}
                    >
                      {claim.status}
                    </span>
                  </div>
                  <div className="text-gray-500">
                    {claim.method} {claim.reference ? `• Ref: ${claim.reference}` : ''}
                  </div>
                </div>

                <div className="text-right text-[11px] text-gray-400">
                  {claim.resolvedAt ? new Date(claim.resolvedAt).toLocaleDateString() : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
