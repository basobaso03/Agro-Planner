import React from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { MoneyInput } from '../../components/ui/MoneyInput.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { formatMoney } from '../../utils/currency.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import type { DebtLiabilityEvent, OrgMember } from '../../types/agro.ts';
import type { RunwayAllocation } from '../../types/runway.ts';

export interface RepayDebtSheetProps {
  isOpen: boolean;
  onClose: () => void;
  debt: DebtLiabilityEvent;
  activeMember: OrgMember;
  leftMoney: number;
  runwayAllocation?: RunwayAllocation;
  onRepayCompleted?: () => void;
  onRequestSpendGate?: (amt: number, payload: any) => void;
}

export const RepayDebtSheet: React.FC<RepayDebtSheetProps> = ({
  isOpen,
  onClose,
  debt,
  activeMember,
  leftMoney,
  runwayAllocation,
  onRepayCompleted,
  onRequestSpendGate,
}) => {
  const { showToast } = useToast();

  const form = useForm({
    initial: {
      amount: debt.remainingBalance.toFixed(2),
      paymentMethod: 'Cash (USD)',
      reference: '',
      note: `Debt repayment to ${debt.creditorName}`,
    },
    validate: (values) => ({
      amount: validators.positiveNumber(values.amount, 'Repayment amount'),
      note: validators.minAuditNote(values.note, 4),
    }),
    crossValidate: (values) => {
      const amt = parseFloat(values.amount) || 0;
      if (amt > debt.remainingBalance) {
        return {
          amount: `Repayment amount (${formatMoney(amt)}) cannot exceed remaining balance (${formatMoney(
            debt.remainingBalance
          )})`,
        };
      }
      if (amt > leftMoney) {
        return {
          amount: `Insufficient funds: Cash on Ground is ${formatMoney(leftMoney)}, but repayment requires ${formatMoney(
            amt
          )}`,
        };
      }
      return null;
    },
    onSubmit: async (values) => {
      const amt = parseFloat(values.amount);

      try {
        dataService.repayDebtLiability({
          debtId: debt.id,
          amount: amt,
          paymentMethod: values.paymentMethod,
          receiptReference: values.reference.trim() || undefined,
          note: values.note.trim(),
          actor: activeMember,
          runwayAllocation,
        });

        showToast(`Disbursed repayment of ${formatMoney(amt)} to ${debt.creditorName}.`);
        if (onRepayCompleted) onRepayCompleted();
        onClose();
      } catch (err: any) {
        const isRunwayGate =
          err?.code === 'RUNWAY_ALLOCATION_REQUIRED' ||
          err?.code === 'RUNWAY_LINE_OVERRUN' ||
          err?.message?.toLowerCase().includes('runway spend gate blocked');

        if (isRunwayGate && onRequestSpendGate) {
          onRequestSpendGate(amt, {
            debtId: debt.id,
            amount: amt,
            paymentMethod: values.paymentMethod,
            receiptReference: values.reference.trim() || undefined,
            note: values.note.trim(),
            actor: activeMember,
          });
          onClose();
        } else {
          throw err;
        }
      }
    },
  });

  const amtNum = parseFloat(form.values.amount) || 0;
  const newBalance = Math.max(0, debt.remainingBalance - amtNum);

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Disburse Debt Repayment"
      subtitle={`Creditor: ${debt.creditorName}`}
      isSubmitting={form.isSubmitting}
      dirty={form.isDirty}
      stickyError={form.stickyError}
      submitLabel={`Disburse ${formatMoney(amtNum)}`}
      onSubmit={form.handleSubmit}
      footerExtra={
        <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE] text-xs flex items-center justify-between font-mono">
          <span className="text-slate-500 font-sans">Remaining Debt After Payment:</span>
          <span className="font-bold text-rose-600">{formatMoney(newBalance)}</span>
        </div>
      }
    >
      <div className="space-y-3.5">
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
          <span className="text-slate-500">Available Liquid Cash:</span>
          <span className="font-mono font-bold text-emerald-700">{formatMoney(leftMoney)}</span>
        </div>

        <Field
          label="Repayment Amount"
          required
          hint={`Max: ${formatMoney(debt.remainingBalance)}`}
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
              onClick={() => form.setFieldValue('amount', Math.min(debt.remainingBalance, leftMoney).toFixed(2))}
              className="py-1 px-2.5 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 text-xs font-bold cursor-pointer hover:bg-rose-100"
            >
              Pay Full Remaining ({formatMoney(debt.remainingBalance)})
            </button>
          </div>
        </Field>

        <Field label="Payment Method" required>
          <select
            value={form.values.paymentMethod}
            onChange={(e) => form.setFieldValue('paymentMethod', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          >
            <option value="Cash (USD)">Cash (USD)</option>
            <option value="EcoCash (USD)">EcoCash (USD)</option>
            <option value="Bank Transfer">Bank Transfer / EFT</option>
            <option value="InnBucks">InnBucks</option>
            <option value="Other">Other Method</option>
          </select>
        </Field>

        <Field label="Payment Receipt Reference" hint="Optional">
          <input
            type="text"
            value={form.values.reference}
            onChange={(e) => form.setFieldValue('reference', e.target.value)}
            placeholder="e.g. Bank Ref / Cheque No."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          />
        </Field>

        <Field label="Audit Note" required hint="Min 4 characters" error={form.errors.note}>
          <textarea
            rows={2}
            value={form.values.note}
            onChange={(e) => form.setFieldValue('note', e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          />
        </Field>
      </div>
    </FormSheet>
  );
};

