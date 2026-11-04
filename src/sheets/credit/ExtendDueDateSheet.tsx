import React from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import type { CreditSaleEvent, OrgMember } from '../../types/agro.ts';

export interface ExtendDueDateSheetProps {
  isOpen: boolean;
  onClose: () => void;
  sale: CreditSaleEvent;
  activeMember: OrgMember;
  onDateExtended?: () => void;
}

export const ExtendDueDateSheet: React.FC<ExtendDueDateSheetProps> = ({
  isOpen,
  onClose,
  sale,
  activeMember,
  onDateExtended,
}) => {
  const { showToast } = useToast();

  const addDays = (days: number) => {
    const base = new Date(sale.agreedSettlementDate);
    base.setDate(base.getDate() + days);
    return base.toISOString().split('T')[0];
  };

  const form = useForm({
    initial: {
      newDate: addDays(7),
      reason: '',
    },
    validate: (values) => ({
      newDate: validators.required(values.newDate, 'New settlement date'),
      reason: validators.minAuditNote(values.reason, 4),
    }),
    onSubmit: async (values) => {
      dataService.extendCreditSaleDueDate({
        creditSaleId: sale.id,
        newAgreedDate: values.newDate,
        reason: values.reason.trim(),
        actor: activeMember,
      });

      showToast(`Due date extended to ${new Date(values.newDate).toLocaleDateString()}.`);
      if (onDateExtended) onDateExtended();
      onClose();
    },
  });

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Extend Due Date"
      subtitle={`Customer: ${sale.customerName}`}
      isSubmitting={form.isSubmitting}
      dirty={form.isDirty}
      stickyError={form.stickyError}
      submitLabel="Authorize Extension"
      onSubmit={form.handleSubmit}
    >
      <div className="space-y-3.5">
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
          <span className="font-bold">Current Agreed Date:</span>{' '}
          {new Date(sale.agreedSettlementDate).toLocaleDateString()}
        </div>

        <Field label="Quick Add Days">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => form.setFieldValue('newDate', addDays(7))}
              className="py-2 px-3 rounded-xl border border-slate-200 bg-[#FAF8F5] text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              +7 Days
            </button>
            <button
              type="button"
              onClick={() => form.setFieldValue('newDate', addDays(14))}
              className="py-2 px-3 rounded-xl border border-slate-200 bg-[#FAF8F5] text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              +14 Days
            </button>
            <button
              type="button"
              onClick={() => form.setFieldValue('newDate', addDays(30))}
              className="py-2 px-3 rounded-xl border border-slate-200 bg-[#FAF8F5] text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              +30 Days
            </button>
          </div>
        </Field>

        <Field label="New Agreed Settlement Date" required error={form.errors.newDate}>
          <input
            type="date"
            value={form.values.newDate}
            onChange={(e) => form.setFieldValue('newDate', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          />
        </Field>

        <Field
          label="Reason for Date Extension"
          required
          hint="Min 4 characters (recorded in audit ledger)"
          error={form.errors.reason}
        >
          <textarea
            rows={2}
            value={form.values.reason}
            onChange={(e) => form.setFieldValue('reason', e.target.value)}
            placeholder="e.g. Customer requested extension due to late butchery payout..."
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          />
        </Field>
      </div>
    </FormSheet>
  );
};

