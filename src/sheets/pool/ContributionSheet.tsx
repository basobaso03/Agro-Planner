import React from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { MoneyInput } from '../../components/ui/MoneyInput.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { formatMoney } from '../../utils/currency.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import { PERMISSIONS } from '../../utils/permissions.ts';
import type { OrgMember } from '../../types/agro.ts';

export interface ContributionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeMember: OrgMember;
  targetMember?: OrgMember;
  onContributed?: () => void;
}

export const ContributionSheet: React.FC<ContributionSheetProps> = ({
  isOpen,
  onClose,
  activeMember,
  targetMember,
  onContributed,
}) => {
  const { showToast } = useToast();
  const members = dataService.getState().members.filter(
    (m) => !activeMember.orgId || m.orgId === activeMember.orgId
  );

  const form = useForm({
    initial: {
      memberId: targetMember?.id || (members[0]?.id ?? ''),
      direction: 'ADDITION' as 'ADDITION' | 'CONTRA_REVERSAL',
      amount: '',
      referenceTxId: '',
      note: '',
    },
    validate: (values) => ({
      memberId: !values.memberId ? 'Select contributing member' : null,
      amount: validators.positiveNumber(values.amount, 'Contribution amount'),
      note: validators.minAuditNote(values.note, 4),
    }),
    onSubmit: async (values) => {
      if (!PERMISSIONS.canLogContribution(activeMember.role)) {
        throw new Error('Permission denied: Only Treasurers and Administrators can log capital contributions.');
      }
      try {
        const amt = parseFloat(values.amount);
        dataService.logCapitalContribution({
          memberId: values.memberId,
          direction: values.direction,
          amount: amt,
          referenceTransactionId: values.referenceTxId.trim() || undefined,
          note: values.note.trim(),
          actor: activeMember,
        });

        showToast({
          type: 'success',
          title: values.direction === 'ADDITION' ? 'Capital Added' : 'Contra Adjustment Logged',
          message: `${formatMoney(amt)} recorded successfully into syndicate pool.`,
        });
        onContributed?.();
        onClose();
      } catch (err: any) {
        showToast({
          type: 'error',
          title: 'Transaction Failed',
          message: err?.message || 'Could not record contribution.',
        });
      }
    },
  });

  const selectedMember = members.find((m) => m.id === form.values.memberId) || targetMember;
  const currentEquity = selectedMember
    ? dataService.computeMemberEquitySummaries().find((e: any) => e.member.id === selectedMember.id)
    : null;

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Capital Contribution"
      subtitle="Record an equity injection or ledger adjustment"
      isSubmitting={form.isSubmitting}
      submitLabel={form.values.direction === 'ADDITION' ? 'Confirm Deposit' : 'Confirm Contra'}
      onSubmit={form.handleSubmit}
      maxHeight="88dvh"
    >
      <div className="space-y-4">
        <Field label="Member" required error={form.errors.memberId}>
          <select
            value={form.values.memberId}
            onChange={(e) => form.setValue('memberId', e.target.value)}
            disabled={!!targetMember}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName} ({m.role})
              </option>
            ))}
          </select>
        </Field>

        {currentEquity && (
          <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs">
            <div>
              <div className="text-slate-400">Current Net Capital</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                {formatMoney(currentEquity.netContribution)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-slate-400">Equity Share</div>
              <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {currentEquity.profitSharePercentage.toFixed(2)}%
              </div>
            </div>
          </div>
        )}

        <Field label="Transaction Type" required>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => form.setValue('direction', 'ADDITION')}
              className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                form.values.direction === 'ADDITION'
                  ? 'bg-emerald-500 text-white border-emerald-600'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              + Capital Injection
            </button>
            <button
              type="button"
              onClick={() => form.setValue('direction', 'CONTRA_REVERSAL')}
              className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                form.values.direction === 'CONTRA_REVERSAL'
                  ? 'bg-rose-500 text-white border-rose-600'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              Contra Reversal
            </button>
          </div>
        </Field>

        <Field label="Amount (USD)" required error={form.errors.amount}>
          <MoneyInput
            value={form.values.amount}
            onChange={(val) => form.setValue('amount', val)}
            placeholder="0.00"
          />
        </Field>

        <Field label="Bank / EcoCash Reference ID">
          <input
            type="text"
            value={form.values.referenceTxId}
            onChange={(e) => form.setValue('referenceTxId', e.target.value)}
            placeholder="e.g. TX-2026-90412"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          />
        </Field>

        <Field
          label="Mandatory Audit Note"
          required
          error={form.errors.note}
          hint="Minimum 4 characters required for audit trail."
        >
          <textarea
            rows={2}
            value={form.values.note}
            onChange={(e) => form.setValue('note', e.target.value)}
            placeholder="e.g. Q1 syndicate capital injection via Stanbic transfer"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          />
        </Field>
      </div>
    </FormSheet>
  );
};

