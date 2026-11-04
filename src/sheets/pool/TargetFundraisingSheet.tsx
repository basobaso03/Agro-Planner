import React from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { MoneyInput } from '../../components/ui/MoneyInput.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { formatMoney } from '../../utils/currency.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import type { OrgMember } from '../../types/agro.ts';

export interface TargetFundraisingSheetProps {
  isOpen: boolean;
  onClose: () => void;
  member: OrgMember;
  activeMember: OrgMember;
  onTargetUpdated?: () => void;
}

export const TargetFundraisingSheet: React.FC<TargetFundraisingSheetProps> = ({
  isOpen,
  onClose,
  member,
  activeMember,
  onTargetUpdated,
}) => {
  const { showToast } = useToast();

  const form = useForm({
    initial: {
      targetUsd: String(member.targetContributionUsd ?? 1000),
      pace: (member.contributionPace || 'MONTHLY') as 'MONTHLY' | 'MILESTONE' | 'FLEXIBLE',
    },
    validate: (values) => ({
      targetUsd: validators.positiveNumber(values.targetUsd, 'Fundraising Target'),
    }),
    onSubmit: async (values) => {
      try {
        const target = parseFloat(values.targetUsd);
        dataService.updateMemberCapitalTarget({
          memberId: member.id,
          targetContributionUsd: target,
          contributionPace: values.pace,
          actor: activeMember,
        });

        showToast({
          type: 'success',
          title: 'Target Updated',
          message: `Capital target for ${member.fullName} set to ${formatMoney(target)}.`,
        });
        onTargetUpdated?.();
        onClose();
      } catch (err: any) {
        showToast({
          type: 'error',
          title: 'Update Failed',
          message: err?.message || 'Could not update capital target.',
        });
      }
    },
  });

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Member Capital Target"
      subtitle={`Configure target contribution for ${member.fullName}`}
      isSubmitting={form.isSubmitting}
      submitLabel="Save Target"
      onSubmit={form.handleSubmit}
      maxHeight="88dvh"
    >
      <div className="space-y-4">
        <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200">
          Syndicate capital commitments track member fundraising progress and allow the team to monitor venture capitalization.
        </div>

        <Field label="Fundraising Target (USD)" required error={form.errors.targetUsd}>
          <MoneyInput
            value={form.values.targetUsd}
            onChange={(val) => form.setValue('targetUsd', val)}
            placeholder="1,000.00"
          />
        </Field>

        <Field label="Contribution Cadence">
          <select
            value={form.values.pace}
            onChange={(e) => form.setValue('pace', e.target.value as any)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          >
            <option value="MONTHLY">Monthly Contribution Schedule</option>
            <option value="MILESTONE">Milestone / Cycle Based</option>
            <option value="FLEXIBLE">Flexible / Discretionary</option>
          </select>
        </Field>
      </div>
    </FormSheet>
  );
};

