import React, { useMemo, useState } from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import { validators } from '../../utils/validation.ts';
import { isUnclaimedPlaceholder } from '../../utils/memberIdentity.ts';
import type { OrgMember } from '../../types/agro.ts';
import { KeyRound, UserCheck } from 'lucide-react';

export interface ClaimProfileSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeMember: OrgMember;
  onClaimedOrRequested?: () => void;
}

export const ClaimProfileSheet: React.FC<ClaimProfileSheetProps> = ({
  isOpen,
  onClose,
  activeMember,
  onClaimedOrRequested,
}) => {
  const { showToast } = useToast();
  const [mode, setMode] = useState<'CODE' | 'REQUEST'>('CODE');
  const [claimCode, setClaimCode] = useState('');
  const [selectedPlaceholderId, setSelectedPlaceholderId] = useState('');
  const [note, setNote] = useState('');
  const [stickyError, setStickyError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const state = dataService.getState();
  const orgId = activeMember.orgId || '';

  // Strictly expose ONLY non-financial identity metadata (fullName, role) so Ground Operators/Members see zero pool amounts
  const unclaimedNames = useMemo(() => {
    return (state.members || []).filter(
      (m) => (!orgId || m.orgId === orgId) && isUnclaimedPlaceholder(m)
    );
  }, [state.members, orgId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStickyError(null);

    if (mode === 'CODE') {
      const codeErr = validators.claimCode(claimCode);
      if (codeErr) {
        setStickyError(codeErr);
        return;
      }
      setIsSubmitting(true);
      try {
        const res = await dataService.claimPlaceholderMemberWithCode({
          orgId,
          claimCode: claimCode.trim(),
          actor: activeMember,
        });
        showToast({
          type: 'success',
          title: 'Contributor Profile Claimed!',
          message: `Historical contributions from "${res.claimedPlaceholder.fullName}" are now linked to your account.`,
        });
        onClaimedOrRequested?.();
        onClose();
      } catch (err: any) {
        setStickyError(err?.message || 'Unable to verify that Claim Code.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const chosenId = selectedPlaceholderId || unclaimedNames[0]?.id;
    if (!chosenId) {
      setStickyError('No unclaimed placeholder profiles are available in this organization.');
      return;
    }

    setIsSubmitting(true);
    try {
      const req = dataService.submitMemberClaimRequest({
        placeholderMemberId: chosenId,
        note: note.trim() || undefined,
        actor: activeMember,
      });
      showToast({
        type: 'success',
        title: 'Link Request Sent',
        message: `Admin notified to link your account with "${req.placeholderName}".`,
      });
      onClaimedOrRequested?.();
      onClose();
    } catch (err: any) {
      setStickyError(err?.message || 'Could not submit link request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Claim Your Pre-Recorded Profile"
      subtitle="Attach contributions & pledges logged before you registered"
      stickyError={stickyError}
      isSubmitting={isSubmitting}
      submitLabel={mode === 'CODE' ? 'Verify Code & Claim Profile' : 'Send Link Request to Admin'}
      onSubmit={handleSubmit}
      maxHeight="86dvh"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE]">
          <button
            type="button"
            onClick={() => {
              setMode('CODE');
              setStickyError(null);
            }}
            className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all ${mode === 'CODE'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-700 hover:bg-white'
              }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>I Have a Claim Code</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('REQUEST');
              setStickyError(null);
            }}
            className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all ${mode === 'REQUEST'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-700 hover:bg-white'
              }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Ask Admin to Link</span>
          </button>
        </div>

        {mode === 'CODE' ? (
          <Field
            label="Personal Claim Code"
            required
            hint="Enter the one-time code shared by your administrator (e.g. CLM-7X9K2P4M)."
          >
            <input
              type="text"
              value={claimCode}
              onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
              placeholder="e.g. CLM-7X9K2P4M"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E0D7C6] bg-[#FAF8F5] text-slate-950 font-mono font-black tracking-wider uppercase text-sm text-center"
            />
          </Field>
        ) : (
          <div className="space-y-3">
            <Field label="Select Your Pre-Registered Name" required>
              {unclaimedNames.length === 0 ? (
                <p className="text-xs text-slate-500 font-medium p-3 rounded-xl bg-slate-50 border border-slate-200">
                  No unclaimed profiles are waiting in this organization.
                </p>
              ) : (
                <select
                  value={selectedPlaceholderId || unclaimedNames[0]?.id || ''}
                  onChange={(e) => setSelectedPlaceholderId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E0D7C6] bg-[#FAF8F5] text-slate-950 text-xs font-bold"
                >
                  {unclaimedNames.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.role.replace(/_/g, ' ')})
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field label="Note for Admin (Optional)" hint="Help the admin verify your identity (e.g. phone number or payment date).">
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Paid in January via EcoCash +263 77..."
                className="w-full px-3 py-2.5 rounded-xl border border-[#E0D7C6] bg-white text-slate-950 text-xs"
              />
            </Field>
          </div>
        )}
      </div>
    </FormSheet>
  );
};

