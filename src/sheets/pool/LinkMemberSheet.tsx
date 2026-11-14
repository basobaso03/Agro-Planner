import React, { useMemo, useState } from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import type { OrgMember, Role } from '../../types/agro.ts';
import { computeNameSimilarity, isUnclaimedPlaceholder, matchesMemberRecord } from '../../utils/memberIdentity.ts';
import { Link2, Sparkles } from 'lucide-react';

export interface LinkMemberSheetProps {
  isOpen: boolean;
  onClose: () => void;
  placeholderMember: OrgMember;
  activeMember: OrgMember;
  preselectedTargetMemberId?: string;
  claimRequestId?: string;
  onLinked?: () => void;
}

export const LinkMemberSheet: React.FC<LinkMemberSheetProps> = ({
  isOpen,
  onClose,
  placeholderMember,
  activeMember,
  preselectedTargetMemberId,
  claimRequestId,
  onLinked,
}) => {
  const { showToast } = useToast();
  const state = dataService.getState();
  const orgId = placeholderMember.orgId || activeMember.orgId || '';

  const candidates = useMemo(() => {
    const orgMembers = (state.members || []).filter(
      (m) =>
        (!orgId || m.orgId === orgId) &&
        m.id !== placeholderMember.id &&
        m.accountStatus !== 'CLAIMED' &&
        !isUnclaimedPlaceholder(m)
    );
    const contribCounts = new Map<string, number>();
    for (const c of state.capitalContributions || []) {
      if (!orgId || c.orgId === orgId) {
        contribCounts.set(c.memberId, (contribCounts.get(c.memberId) || 0) + c.amount);
      }
    }
    return orgMembers
      .map((m) => ({
        member: m,
        similarity: computeNameSimilarity(placeholderMember.fullName, m.fullName),
        existingPaid: contribCounts.get(m.id) || 0,
      }))
      .sort((a, b) => b.similarity - a.similarity || a.existingPaid - b.existingPaid);
  }, [state.members, state.capitalContributions, orgId, placeholderMember]);

  const [targetMemberId, setTargetMemberId] = useState<string>(
    preselectedTargetMemberId || candidates[0]?.member.id || ''
  );
  const [finalRole, setFinalRole] = useState<Role>(
    placeholderMember.role !== 'MEMBER'
      ? placeholderMember.role
      : candidates[0]?.member.role || 'MEMBER'
  );
  const [note, setNote] = useState('');
  const [stickyError, setStickyError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const placeholderFinancials = useMemo(() => {
    const contributions = (state.capitalContributions || []).filter(
      (c) => (!orgId || c.orgId === orgId) && matchesMemberRecord(c.memberId, placeholderMember)
    );
    const paid = contributions.reduce(
      (acc, c) => acc + (c.direction === 'CONTRA_REVERSAL' ? -Math.abs(c.amount) : c.amount),
      0
    );
    const pledges = (state.runwayPledges || []).filter(
      (p) =>
        (!orgId || p.orgId === orgId) &&
        p.status !== 'MERGED' &&
        p.status !== 'WITHDRAWN' &&
        matchesMemberRecord(p.memberId, placeholderMember)
    );
    const totalPledged = pledges.reduce((acc, p) => acc + (p.amount || 0), 0);
    return {
      paid: Math.max(0, paid),
      contributionCount: contributions.length,
      pledgeCount: pledges.length,
      totalPledged,
    };
  }, [state.capitalContributions, state.runwayPledges, orgId, placeholderMember]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStickyError(null);
    if (!targetMemberId) {
      setStickyError('Please choose the registered member account that owns this contributor profile.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { mergedMember } = await dataService.adminLinkAndMergeMember({
        placeholderMemberId: placeholderMember.id,
        targetMemberId,
        claimRequestId,
        finalRole,
        note: note.trim() || undefined,
        actor: activeMember,
      });

      showToast({
        type: 'success',
        title: 'Accounts Linked & Merged',
        message: `${placeholderMember.fullName}'s ledger history now belongs to ${mergedMember.fullName}.`,
      });
      onLinked?.();
      onClose();
    } catch (err: any) {
      setStickyError(err?.message || 'Could not link member accounts.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Link & Merge Mock Account"
      subtitle={`Transfer ${placeholderMember.fullName}'s contributions & pledges to a registered user`}
      stickyError={stickyError}
      isSubmitting={isSubmitting}
      submitLabel="Confirm Link & Merge"
      onSubmit={handleSubmit}
      maxHeight="88dvh"
    >
      <div className="space-y-4">
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-1.5 text-xs">
          <div className="font-black text-amber-950 flex items-center gap-1.5">
            <Link2 className="w-4 h-4 text-amber-700" />
            <span>Pre-Recorded Ledger Summary: {placeholderMember.fullName}</span>
          </div>
          <div className="flex flex-wrap gap-3 text-amber-900 font-semibold">
            <span>Paid Capital: <strong className="font-mono">${placeholderFinancials.paid.toFixed(2)}</strong> ({placeholderFinancials.contributionCount} entries)</span>
            <span>Runway Pledges: <strong className="font-mono">${placeholderFinancials.totalPledged.toFixed(2)}</strong> ({placeholderFinancials.pledgeCount})</span>
          </div>
        </div>

        <Field label="Target Registered Member Account" required>
          {candidates.length === 0 ? (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 font-medium">
              No registered members have joined yet. Share the Org Invite Code or Personal Claim Code so this contributor can sign up first.
            </div>
          ) : (
            <select
              value={targetMemberId}
              onChange={(e) => {
                setTargetMemberId(e.target.value);
                const chosen = candidates.find((c) => c.member.id === e.target.value);
                if (chosen && placeholderMember.role === 'MEMBER') {
                  setFinalRole(chosen.member.role);
                }
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-[#E0D7C6] bg-[#FAF8F5] text-slate-950 text-xs font-bold"
            >
              {candidates.map(({ member, similarity, existingPaid }) => (
                <option key={member.id} value={member.id}>
                  {member.fullName} ({member.email || member.phoneOrEmail})
                  {similarity >= 0.5 ? ' ★ Name Match' : ''}
                  {existingPaid === 0 ? ' · $0 Paid' : ` · $${existingPaid.toFixed(0)} Paid`}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="Final Role After Link">
          <select
            value={finalRole}
            onChange={(e) => setFinalRole(e.target.value as Role)}
            className="w-full px-3 py-2.5 rounded-xl border border-[#E0D7C6] bg-[#FAF8F5] text-slate-950 text-xs font-bold"
          >
            <option value="MEMBER">Member (Investor)</option>
            <option value="TREASURER">Treasurer</option>
            <option value="GROUND_OPERATOR">Ground Operator</option>
            <option value="ORG_ADMIN">Organization Admin</option>
          </select>
        </Field>

        <Field label="Audit Merge Note (Optional)">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Verified in-person member identity on WhatsApp"
            className="w-full px-3 py-2.5 rounded-xl border border-[#E0D7C6] bg-white text-slate-950 text-xs"
          />
        </Field>

        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-950 font-medium flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <span>
            Historical immutable capital entries remain intact under cryptographic SHA-256 verification and automatically unify under the registered account&apos;s equity &amp; Runway pledges.
          </span>
        </div>
      </div>
    </FormSheet>
  );
};

