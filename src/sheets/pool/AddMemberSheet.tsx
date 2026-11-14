import React, { useState } from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { MoneyInput } from '../../components/ui/MoneyInput.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import { isValidRealEmail } from '../../utils/memberIdentity.ts';
import type { OrgMember, Role } from '../../types/agro.ts';
import { CheckCircle2, Copy, KeyRound, Plus } from 'lucide-react';

export interface AddMemberSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeMember: OrgMember;
  onMemberAdded?: () => void;
}

export const AddMemberSheet: React.FC<AddMemberSheetProps> = ({
  isOpen,
  onClose,
  activeMember,
  onMemberAdded,
}) => {
  const { showToast } = useToast();
  const state = dataService.getState();
  const orgId = activeMember.orgId || dataService.getActiveOrgId() || '';
  const org =
    (state.organizations || []).find((o) => o.id === orgId) ||
    dataService.getActiveOrganization(orgId);
  const isAgro = dataService.isAgroOrganization(orgId);
  const locations = isAgro
    ? (state.locations || []).filter((l) => !orgId || l.orgId === orgId)
    : [];
  const runwayPlans = (state.runwayPlans || []).filter(
    (p) =>
      (!orgId || p.orgId === orgId) &&
      p.status !== 'COMPLETED' &&
      p.status !== 'ARCHIVED'
  );

  const [noEmailYet, setNoEmailYet] = useState(true);
  const [addAnotherMode, setAddAnotherMode] = useState(false);
  const [createdMockBanner, setCreatedMockBanner] = useState<{
    fullName: string;
    claimCode: string;
    inviteCode: string;
  } | null>(null);
  const [copiedBundle, setCopiedBundle] = useState(false);

  const form = useForm({
    initial: {
      fullName: '',
      phoneOrEmail: '',
      role: 'MEMBER' as Role,
      assignedLocationId: isAgro ? locations[0]?.id || '' : '',
      targetContribution: String(org?.defaultTargetContributionUsd || 1000),
      initialContribution: '',
      contributionNote: '',
      runwayPlanId: runwayPlans[0]?.id || '',
      initialPledge: '',
      pledgeNote: '',
    },
    validate: (values) => {
      const initPaid = parseFloat(values.initialContribution || '0');
      const initPledge = parseFloat(values.initialPledge || '0');
      return {
        fullName: validators.required(values.fullName, 'Full name'),
        phoneOrEmail: noEmailYet
          ? validators.optionalContact(values.phoneOrEmail, 'Phone (Optional)')
          : validators.contact(values.phoneOrEmail, 'Phone or Email'),
        targetContribution: validators.nonNegativeNumber(values.targetContribution, 'Capital target'),
        initialContribution: validators.nonNegativeNumber(values.initialContribution, 'Contribution'),
        contributionNote:
          initPaid > 0 && values.contributionNote.trim().length > 0 && values.contributionNote.trim().length < 4
            ? 'Audit note must be at least 4 characters (or leave blank for auto-note).'
            : null,
        initialPledge:
          initPledge > 0 && !values.runwayPlanId
            ? 'Select a Runway Plan above to record a pledge.'
            : validators.nonNegativeNumber(values.initialPledge, 'Runway pledge'),
      };
    },
    onSubmit: async (values) => {
      try {
        const initAmt = parseFloat(values.initialContribution || '0');
        const initPledge = parseFloat(values.initialPledge || '0');
        const targetAmt = parseFloat(values.targetContribution || '0');
        const contactClean = values.phoneOrEmail.trim();
        const isMock = noEmailYet || !isValidRealEmail(contactClean);

        const createdMember = dataService.addMember({
          fullName: values.fullName.trim(),
          phoneOrEmail: contactClean,
          phone: !isValidRealEmail(contactClean) ? contactClean : undefined,
          role: values.role,
          assignedLocationId: isAgro ? values.assignedLocationId || undefined : undefined,
          targetContributionUsd: targetAmt > 0 ? targetAmt : undefined,
          initialContributionUsd: initAmt > 0 ? initAmt : undefined,
          contributionNote:
            initAmt > 0
              ? values.contributionNote.trim() || `Pre-registered initial capital by ${values.fullName.trim()}`
              : undefined,
          initialContributionPlanId: initAmt > 0 && values.runwayPlanId ? values.runwayPlanId : undefined,
          initialPledgeAmount: initPledge > 0 ? initPledge : undefined,
          initialPledgePlanId: initPledge > 0 ? values.runwayPlanId || undefined : undefined,
          initialPledgeNote: values.pledgeNote.trim() || undefined,
          isPlaceholder: isMock,
          actor: activeMember,
        });

        const claimCode = dataService.getPlaceholderClaimCode(createdMember.id);
        showToast({
          type: 'success',
          title: isMock ? 'Unclaimed Mock Member Created' : 'Member Added',
          message: isMock
            ? `${createdMember.fullName} added with claim code ${claimCode || ''}.`
            : `${createdMember.fullName} is now registered in the organization.`,
        });
        onMemberAdded?.();

        if (addAnotherMode) {
          form.setValue('fullName', '');
          form.setValue('phoneOrEmail', '');
          form.setValue('initialContribution', '');
          form.setValue('contributionNote', '');
          form.setValue('initialPledge', '');
          form.setValue('pledgeNote', '');
          if (isMock && claimCode) {
            setCreatedMockBanner({
              fullName: createdMember.fullName,
              claimCode,
              inviteCode: org?.currentInviteCode || 'N/A',
            });
          }
          setAddAnotherMode(false);
          return;
        }

        if (isMock && claimCode) {
          setCreatedMockBanner({
            fullName: createdMember.fullName,
            claimCode,
            inviteCode: org?.currentInviteCode || 'N/A',
          });
          return;
        }

        onClose();
      } catch (err: any) {
        showToast({
          type: 'error',
          title: 'Failed to Add Member',
          message: err?.message || 'Could not register member.',
        });
      }
    },
  });

  const handleCopyCreatedBundle = () => {
    if (!createdMockBanner) return;
    const msg = `Hi ${createdMockBanner.fullName}, join ${org?.name || 'our organization'} using Org Invite Code: ${createdMockBanner.inviteCode} and Personal Claim Code: ${createdMockBanner.claimCode} to link your pre-recorded contributions & equity stake.`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(msg);
      setCopiedBundle(true);
      setTimeout(() => setCopiedBundle(false), 2500);
    }
  };

  if (createdMockBanner) {
    return (
      <FormSheet
        isOpen={isOpen}
        onClose={() => {
          setCreatedMockBanner(null);
          onClose();
        }}
        title="Mock Contributor Saved"
        subtitle="Share this code bundle when they register, or link manually anytime"
        submitLabel="Done"
        cancelLabel="Add Another Person"
        onSubmit={(e) => {
          e.preventDefault();
          setCreatedMockBanner(null);
          onClose();
        }}
        footerExtra={
          <button
            type="button"
            onClick={() => {
              setCreatedMockBanner(null);
              form.setValue('fullName', '');
              form.setValue('phoneOrEmail', '');
              form.setValue('initialContribution', '');
              form.setValue('contributionNote', '');
              form.setValue('initialPledge', '');
              form.setValue('pledgeNote', '');
            }}
            className="w-full py-2 px-3 rounded-xl bg-[#FAF8F5] border border-[#E0D7C6] text-slate-900 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Keep Adding Another Contributor</span>
          </button>
        }
        maxHeight="85dvh"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 space-y-2.5">
            <div className="flex items-center gap-2 text-amber-950 font-black text-sm">
              <KeyRound className="w-4 h-4 text-amber-700" />
              <span>{createdMockBanner.fullName} (Unclaimed Mock Account)</span>
            </div>
            <p className="text-xs text-amber-900 font-medium leading-relaxed">
              Their contributions and Runway pledges are already live in the pool. When they sign up later (even with any future email or Google account), they can enter these two codes — OR you can click <strong>Link to Registered User</strong> in Members once they join.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="p-2.5 rounded-xl bg-white border border-amber-200">
                <span className="block text-[10px] font-bold text-slate-500 uppercase">Org Invite Code</span>
                <span className="font-mono font-black text-sm text-emerald-900">{createdMockBanner.inviteCode}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-amber-200">
                <span className="block text-[10px] font-bold text-slate-500 uppercase">Personal Claim Code</span>
                <span className="font-mono font-black text-sm text-amber-900">{createdMockBanner.claimCode}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyCreatedBundle}
              className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copiedBundle ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedBundle ? 'Invite & Claim Message Copied!' : 'Copy Shareable WhatsApp / SMS Invite'}</span>
            </button>
          </div>
        </div>
      </FormSheet>
    );
  }

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Member"
      subtitle="Register an active user or create a no-email mock contributor"
      isSubmitting={form.isSubmitting}
      submitLabel={noEmailYet ? 'Create Mock Member' : 'Register Member'}
      onSubmit={form.handleSubmit}
      footerExtra={
        <button
          type="button"
          onClick={() => {
            setAddAnotherMode(true);
            void form.handleSubmit();
          }}
          disabled={form.isSubmitting}
          className="w-full py-2 px-3 rounded-xl bg-[#FAF8F5] hover:bg-[#F0EBE1] border border-[#E0D7C6] text-slate-900 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Save &amp; Add Another Contributor</span>
        </button>
      }
      maxHeight="90dvh"
    >
      <div className="space-y-4">
        <div className="p-3 rounded-2xl bg-amber-50/90 border border-amber-200 flex items-start justify-between gap-3">
          <div className="text-xs">
            <p className="font-black text-amber-950">Unregistered Contributor (No Email Yet)</p>
            <p className="text-[11px] text-amber-900 font-medium">
              Create a placeholder profile by name now, record cash &amp; pledges, and link when they join later.
            </p>
          </div>
          <input
            type="checkbox"
            checked={noEmailYet}
            onChange={(e) => setNoEmailYet(e.target.checked)}
            className="mt-1 h-4 w-4 rounded accent-amber-600 cursor-pointer shrink-0"
          />
        </div>

        <Field label="Full Name" required error={form.errors.fullName}>
          <input
            type="text"
            value={form.values.fullName}
            onChange={(e) => form.setValue('fullName', e.target.value)}
            placeholder="e.g. Tendai Moyo"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-950 text-sm"
          />
        </Field>

        <Field
          label={noEmailYet ? 'Phone or Contact (Optional)' : 'Phone or Email'}
          required={!noEmailYet}
          error={form.errors.phoneOrEmail}
          hint={noEmailYet ? 'Leave blank if you only have their name right now.' : undefined}
        >
          <input
            type="text"
            value={form.values.phoneOrEmail}
            onChange={(e) => form.setValue('phoneOrEmail', e.target.value)}
            placeholder={
              noEmailYet
                ? 'Optional: +263 77 123 4567 (helps tell duplicate names apart)'
                : 'e.g. +263 77 123 4567 or member@example.com'
            }
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-950 text-sm"
          />
        </Field>

        <div className={`grid ${isAgro ? 'grid-cols-2' : 'grid-cols-2'} gap-3`}>
          <Field label="Assigned Role" required>
            <select
              value={form.values.role}
              onChange={(e) => form.setValue('role', e.target.value as Role)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-950 text-sm"
            >
              <option value="MEMBER">Member (Investor)</option>
              <option value="GROUND_OPERATOR">Ground Operator</option>
              <option value="TREASURER">Treasurer</option>
              <option value="ORG_ADMIN">Organization Admin</option>
            </select>
          </Field>

          {isAgro ? (
            <Field label="Primary Farm Site">
              <select
                value={form.values.assignedLocationId}
                onChange={(e) => form.setValue('assignedLocationId', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-950 text-sm"
              >
                <option value="">All Locations</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Capital Goal (USD)" error={form.errors.targetContribution}>
              <MoneyInput
                value={form.values.targetContribution}
                onChange={(val) => form.setValue('targetContribution', val)}
                placeholder="1000.00"
              />
            </Field>
          )}
        </div>

        {isAgro && (
          <Field label="Agreed Capital Goal (USD)" error={form.errors.targetContribution}>
            <MoneyInput
              value={form.values.targetContribution}
              onChange={(val) => form.setValue('targetContribution', val)}
              placeholder="1000.00"
            />
          </Field>
        )}

        <div className="pt-2 border-t border-slate-100 space-y-3">
          <div className="text-xs font-black uppercase tracking-wider text-slate-500">
            Initial Contribution &amp; Runway Pledge (Optional)
          </div>

          {runwayPlans.length > 0 && (
            <Field label="Attach to Runway Plan (Optional)">
              <select
                value={form.values.runwayPlanId}
                onChange={(e) => form.setValue('runwayPlanId', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-[#FAF8F5] text-slate-950 text-xs font-bold"
              >
                <option value="">Master Capital Pool Only</option>
                {runwayPlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || p.title} ({p.status})
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Cash Paid Already (USD)" error={form.errors.initialContribution}>
              <MoneyInput
                value={form.values.initialContribution}
                onChange={(val) => form.setValue('initialContribution', val)}
                placeholder="0.00"
              />
            </Field>

            {runwayPlans.length > 0 && (
              <Field label="Runway Pledge (USD)" error={form.errors.initialPledge}>
                <MoneyInput
                  value={form.values.initialPledge}
                  onChange={(val) => form.setValue('initialPledge', val)}
                  placeholder="0.00"
                />
              </Field>
            )}
          </div>

          {parseFloat(form.values.initialContribution || '0') > 0 && (
            <Field
              label="Contribution Audit Note"
              error={form.errors.contributionNote}
              hint="Optional custom note (auto-filled if left blank)."
            >
              <input
                type="text"
                value={form.values.contributionNote}
                onChange={(e) => form.setValue('contributionNote', e.target.value)}
                placeholder="e.g. Cash collected before registration"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-950 text-sm"
              />
            </Field>
          )}

          {parseFloat(form.values.initialPledge || '0') > 0 && (
            <Field label="Pledge Note (Optional)">
              <input
                type="text"
                value={form.values.pledgeNote}
                onChange={(e) => form.setValue('pledgeNote', e.target.value)}
                placeholder="e.g. Monthly installment commitment"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-950 text-sm"
              />
            </Field>
          )}
        </div>
      </div>
    </FormSheet>
  );
};
