import React, { useState } from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { MoneyInput } from '../../components/ui/MoneyInput.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { formatMoney } from '../../utils/currency.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import type { OrgMember } from '../../types/agro.ts';

export interface RecordGeneralSaleSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeMember: OrgMember;
  onSaleRecorded?: () => void;
}

export const RecordGeneralSaleSheet: React.FC<RecordGeneralSaleSheetProps> = ({
  isOpen,
  onClose,
  activeMember,
  onSaleRecorded,
}) => {
  const { showToast } = useToast();
  const [saleType, setSaleType] = useState<'CASH' | 'CREDIT'>('CASH');

  const locations = dataService.getState().locations.filter(
    (l) => !activeMember.orgId || l.orgId === activeMember.orgId
  );

  const form = useForm({
    initial: {
      locationId: locations[0]?.id || '',
      itemDescription: '',
      customerName: '',
      customerPhone: '',
      quantity: '1',
      unitPrice: '',
      deposit: '',
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      note: '',
    },
    validate: (values) => {
      const q = parseInt(values.quantity || '0', 10);
      const p = parseFloat(values.unitPrice || '0');
      const total = q * p;
      const d = parseFloat(values.deposit || '0');

      return {
        itemDescription: validators.required(values.itemDescription, 'Item description'),
        customerName: validators.required(values.customerName, 'Customer name'),
        customerPhone: validators.contact(values.customerPhone),
        quantity: validators.positiveInteger(values.quantity, 'Quantity'),
        unitPrice: validators.positiveNumber(values.unitPrice, 'Unit price'),
        deposit:
          saleType === 'CREDIT' && d >= total
            ? 'For 100% cash sales, switch to Cash Sale mode'
            : null,
        note: validators.minAuditNote(values.note, 4),
      };
    },
    onSubmit: async (values) => {
      try {
        const qty = parseInt(values.quantity, 10);
        const price = parseFloat(values.unitPrice);
        const total = qty * price;
        const deposit = saleType === 'CASH' ? total : parseFloat(values.deposit || '0');

        dataService.recordCreditSale({
          locationId: values.locationId,
          customerName: values.customerName.trim(),
          customerPhone: values.customerPhone.trim(),
          quantitySold: qty,
          unitPriceUsd: price,
          upfrontDepositUsd: deposit,
          agreedSettlementDate: values.dueDate,
          notes: `[Item: ${values.itemDescription}] ${values.note.trim()}`,
          actor: activeMember,
        });

        showToast({
          type: 'success',
          title: saleType === 'CASH' ? 'Cash Sale Recorded' : 'Credit Sale Recorded',
          message: `${formatMoney(total)} sale logged for ${values.customerName}.`,
        });
        onSaleRecorded?.();
        onClose();
      } catch (err: any) {
        showToast({
          type: 'error',
          title: 'Recording Failed',
          message: err?.message || 'Could not record sale.',
        });
      }
    },
  });

  const qty = parseInt(form.values.quantity || '0', 10);
  const price = parseFloat(form.values.unitPrice || '0');
  const total = !isNaN(qty) && !isNaN(price) ? qty * price : 0;
  const deposit =
    saleType === 'CASH' ? total : parseFloat(form.values.deposit || '0') || 0;
  const balanceRemaining = Math.max(0, total - deposit);

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title={saleType === 'CASH' ? 'Record Cash Sale' : 'Record Credit Sale'}
      subtitle="General inventory, service, or product checkout"
      isSubmitting={form.isSubmitting}
      submitLabel={saleType === 'CASH' ? 'Confirm Cash Sale' : 'Record Credit Agreement'}
      onSubmit={form.handleSubmit}
      maxHeight="88dvh"
    >
      <div className="space-y-4">
        {/* Toggle Cash vs Credit */}
        <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setSaleType('CASH')}
            className={`py-2 text-xs font-semibold rounded-lg transition-all ${
              saleType === 'CASH'
                ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            💵 Cash / Immediate
          </button>
          <button
            type="button"
            onClick={() => setSaleType('CREDIT')}
            className={`py-2 text-xs font-semibold rounded-lg transition-all ${
              saleType === 'CREDIT'
                ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            📋 On Credit / Terms
          </button>
        </div>

        {/* Live Calculation Strip */}
        <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <div className="text-slate-400">Total Invoice</div>
            <div className="font-bold text-slate-900 dark:text-white mt-0.5">
              {formatMoney(total)}
            </div>
          </div>
          <div>
            <div className="text-slate-400">Deposit / Cash</div>
            <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {formatMoney(deposit)}
            </div>
          </div>
          <div>
            <div className="text-slate-400">Receivable</div>
            <div className="font-bold text-amber-600 dark:text-amber-400 mt-0.5">
              {formatMoney(balanceRemaining)}
            </div>
          </div>
        </div>

        <Field label="Item or Service Description" required error={form.errors.itemDescription}>
          <input
            type="text"
            value={form.values.itemDescription}
            onChange={(e) => form.setValue('itemDescription', e.target.value)}
            placeholder="e.g. 50kg Sunflower Oil, Retail Pack #04"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity" required error={form.errors.quantity}>
            <input
              type="number"
              min={1}
              value={form.values.quantity}
              onChange={(e) => form.setValue('quantity', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            />
          </Field>

          <Field label="Unit Price (USD)" required error={form.errors.unitPrice}>
            <MoneyInput
              value={form.values.unitPrice}
              onChange={(val) => form.setValue('unitPrice', val)}
              placeholder="0.00"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Customer Name" required error={form.errors.customerName}>
            <input
              type="text"
              value={form.values.customerName}
              onChange={(e) => form.setValue('customerName', e.target.value)}
              placeholder="e.g. Sarah Dube"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            />
          </Field>

          <Field label="Customer Contact" required error={form.errors.customerPhone}>
            <input
              type="text"
              value={form.values.customerPhone}
              onChange={(e) => form.setValue('customerPhone', e.target.value)}
              placeholder="+263 7..."
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            />
          </Field>
        </div>

        {saleType === 'CREDIT' && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Field label="Upfront Deposit (USD)" error={form.errors.deposit}>
              <MoneyInput
                value={form.values.deposit}
                onChange={(val) => form.setValue('deposit', val)}
                placeholder="0.00"
              />
            </Field>

            <Field label="Due Date" required>
              <input
                type="date"
                value={form.values.dueDate}
                onChange={(e) => form.setValue('dueDate', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
              />
            </Field>
          </div>
        )}

        <Field
          label="Mandatory Audit Note"
          required
          error={form.errors.note}
          hint="Minimum 4 characters required."
        >
          <input
            type="text"
            value={form.values.note}
            onChange={(e) => form.setValue('note', e.target.value)}
            placeholder="e.g. Delivered to shop counter, invoice signed"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          />
        </Field>
      </div>
    </FormSheet>
  );
};

