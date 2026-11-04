import React from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { MoneyInput } from '../../components/ui/MoneyInput.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { formatMoney } from '../../utils/currency.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import type { CreditSaleEvent, OrgMember } from '../../types/agro.ts';

export interface RecordPaymentSheetProps {
  isOpen: boolean;
  onClose: () => void;
  sale: CreditSaleEvent;
  activeMember: OrgMember;
  onPaymentRecorded?: () => void;
}

export const RecordPaymentSheet: React.FC<RecordPaymentSheetProps> = ({
  isOpen,
  onClose,
  sale,
  activeMember,
  onPaymentRecorded,
}) => {
  const { showToast } = useToast();

  const form = useForm({
    initial: {
      amount: sale.creditBalanceRemaining.toFixed(2),
      paymentMethod: 'Cash (USD)',
      reference: '',
      note: `Customer installment payment from ${sale.customerName}`,
    },
    validate: (values) => ({
      amount: validators.positiveNumber(values.amount, 'Payment amount'),
      note: validators.minAuditNote(values.note, 4),
    }),
    crossValidate: (values) => {
      const amt = parseFloat(values.amount) || 0;
      if (amt > sale.creditBalanceRemaining) {
        return {
          amount: `Payment amount (${formatMoney(amt)}) cannot exceed remaining balance (${formatMoney(
            sale.creditBalanceRemaining
          )})`,
        };
      }
      return null;
    },
    onSubmit: async (values) => {
      const amt = parseFloat(values.amount);

      dataService.recordCreditSalePayment({
        creditSaleId: sale.id,
        amount: amt,
        paymentMethod: values.paymentMethod,
        receiptReference: values.reference.trim() || undefined,
        note: values.note.trim(),
        actor: activeMember,
      });

      showToast(`Payment of ${formatMoney(amt)} recorded for ${sale.customerName}.`);
      if (onPaymentRecorded) onPaymentRecorded();
      onClose();
    },
  });

  const amtNum = parseFloat(form.values.amount) || 0;
  const newBalance = Math.max(0, sale.creditBalanceRemaining - amtNum);

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Record Customer Payment"
      subtitle={`Receivable for ${sale.customerName}`}
      isSubmitting={form.isSubmitting}
      dirty={form.isDirty}
      stickyError={form.stickyError}
      submitLabel={`Confirm Payment (${formatMoney(amtNum)})`}
      onSubmit={form.handleSubmit}
      footerExtra={
        <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE] text-xs flex items-center justify-between font-mono">
          <span className="text-slate-500 font-sans">Remaining After Payment:</span>
          <span className="font-bold text-rose-600">{formatMoney(newBalance)}</span>
        </div>
      }
    >
      <div className="space-y-3.5">
        <Field
          label="Payment Amount"
          required
          hint={`Max: ${formatMoney(sale.creditBalanceRemaining)}`}
          error={form.errors.amount}
        >
          <div className="space-y-2">
            <MoneyInput
              value={form.values.amount}
              onChange={(val) => form.setFieldValue('amount', val)}
              hasError={Boolean(form.errors.amount)}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => form.setFieldValue('amount', sale.creditBalanceRemaining.toFixed(2))}
                className="py-1 px-2.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold cursor-pointer hover:bg-emerald-100"
              >
                Pay in Full ({formatMoney(sale.creditBalanceRemaining)})
              </button>
            </div>
          </div>
        </Field>

        <Field label="Payment Method" required>
          <select
            value={form.values.paymentMethod}
            onChange={(e) => form.setFieldValue('paymentMethod', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          >
            <option value="Cash (USD)">Cash (USD)</option>
            <option value="EcoCash (USD)">EcoCash (USD)</option>
            <option value="InnBucks">InnBucks</option>
            <option value="Bank Transfer">Bank Transfer / EFT</option>
            <option value="Other">Other Method</option>
          </select>
        </Field>

        <Field label="Receipt / Transaction Reference" hint="Optional">
          <input
            type="text"
            value={form.values.reference}
            onChange={(e) => form.setFieldValue('reference', e.target.value)}
            placeholder="e.g. EcoCash Ref: MP2602..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          />
        </Field>

        <Field label="Audit Note" required hint="Min 4 characters" error={form.errors.note}>
          <textarea
            rows={2}
            value={form.values.note}
            onChange={(e) => form.setFieldValue('note', e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          />
        </Field>
      </div>
    </FormSheet>
  );
};

