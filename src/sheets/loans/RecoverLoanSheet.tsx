import React from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { MoneyInput } from '../../components/ui/MoneyInput.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { formatMoney } from '../../utils/currency.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import type { LoanGivenEvent, OrgMember } from '../../types/agro.ts';

export interface RecoverLoanSheetProps {
  isOpen: boolean;
  onClose: () => void;
  loan: LoanGivenEvent;
  activeMember: OrgMember;
  onLoanRecovered?: () => void;
}

export const RecoverLoanSheet: React.FC<RecoverLoanSheetProps> = ({
  isOpen,
  onClose,
  loan,
  activeMember,
  onLoanRecovered,
}) => {
  const { showToast } = useToast();

  const form = useForm({
    initial: {
      amount: loan.remainingBalance.toFixed(2),
      paymentMethod: 'Cash (USD)',
      reference: '',
      note: `Loan recovery from ${loan.borrowerName}`,
    },
    validate: (values) => ({
      amount: validators.positiveNumber(values.amount, 'Recovery amount'),
      note: validators.minAuditNote(values.note, 4),
    }),
    crossValidate: (values) => {
      const amt = parseFloat(values.amount) || 0;
      if (amt > loan.remainingBalance) {
        return {
          amount: `Recovery amount (${formatMoney(amt)}) cannot exceed remaining balance (${formatMoney(
            loan.remainingBalance
          )})`,
        };
      }
      return null;
    },
    onSubmit: async (values) => {
      const amt = parseFloat(values.amount);

      dataService.recoverLoanGiven({
        loanId: loan.id,
        amount: amt,
        paymentMethod: values.paymentMethod,
        receiptReference: values.reference.trim() || undefined,
        note: values.note.trim(),
        actor: activeMember,
      });

      showToast(`Recovered payment of ${formatMoney(amt)} from ${loan.borrowerName}.`);
      if (onLoanRecovered) onLoanRecovered();
      onClose();
    },
  });

  const amtNum = parseFloat(form.values.amount) || 0;
  const newBalance = Math.max(0, loan.remainingBalance - amtNum);

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Record Loan Recovery Inflow"
      subtitle={`Borrower: ${loan.borrowerName}`}
      isSubmitting={form.isSubmitting}
      dirty={form.isDirty}
      stickyError={form.stickyError}
      submitLabel={`Recover ${formatMoney(amtNum)}`}
      onSubmit={form.handleSubmit}
      footerExtra={
        <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE] text-xs flex items-center justify-between font-mono">
          <span className="text-slate-500 font-sans">Remaining Unreturned Balance:</span>
          <span className="font-bold text-emerald-700">{formatMoney(newBalance)}</span>
        </div>
      }
    >
      <div className="space-y-3.5">
        <Field
          label="Recovery Amount"
          required
          hint={`Max: ${formatMoney(loan.remainingBalance)}`}
          error={form.errors.amount}
        >
          <div className="space-y-2">
            <MoneyInput
              value={form.values.amount}
              onChange={(val) => form.setFieldValue('amount', val)}
              hasError={Boolean(form.errors.amount)}
            />
            <button
              type="button"
              onClick={() => form.setFieldValue('amount', loan.remainingBalance.toFixed(2))}
              className="py-1 px-2.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold cursor-pointer hover:bg-emerald-100"
            >
              Recover in Full ({formatMoney(loan.remainingBalance)})
            </button>
          </div>
        </Field>

        <Field label="Payment Method" required>
          <select
            value={form.values.paymentMethod}
            onChange={(e) => form.setFieldValue('paymentMethod', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          >
            <option value="Cash (USD)">Cash (USD)</option>
            <option value="EcoCash (USD)">EcoCash (USD)</option>
            <option value="Bank Transfer">Bank Transfer / EFT</option>
            <option value="InnBucks">InnBucks</option>
            <option value="Other">Other Method</option>
          </select>
        </Field>

        <Field label="Receipt Reference" hint="Optional">
          <input
            type="text"
            value={form.values.reference}
            onChange={(e) => form.setFieldValue('reference', e.target.value)}
            placeholder="e.g. Deposit Slip / Reference Number"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </Field>

        <Field label="Audit Note" required hint="Min 4 characters" error={form.errors.note}>
          <textarea
            rows={2}
            value={form.values.note}
            onChange={(e) => form.setFieldValue('note', e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </Field>
      </div>
    </FormSheet>
  );
};

