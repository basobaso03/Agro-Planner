import React, { useState } from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { MoneyInput } from '../../components/ui/MoneyInput.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { formatMoney } from '../../utils/currency.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import type { FarmLocation, LivestockComputedStatus, OrgMember } from '../../types/agro.ts';

export interface RecordCreditSaleSheetProps {
  isOpen: boolean;
  onClose: () => void;
  locations?: FarmLocation[];
  livestockStatuses?: LivestockComputedStatus[];
  activeMember: OrgMember;
  onSaleCreated?: () => void;
}

export const RecordCreditSaleSheet: React.FC<RecordCreditSaleSheetProps> = ({
  isOpen,
  onClose,
  locations = dataService.getState().locations || [],
  livestockStatuses = dataService.computeLivestockStatuses(),
  activeMember,
  onSaleCreated,
}) => {
  const { showToast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);

  const initialValues = {
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    locationId: locations[0]?.id || '',
    livestockId: '',
    quantity: '1',
    unitPrice: '6.00',
    depositPaid: '0.00',
    agreedDueDate: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 14);
      return d.toISOString().split('T')[0];
    })(),
    paymentTerms: 'Net 14 Days - Full balance payable on or before agreed date',
    note: '',
  };

  const form = useForm({
    initial: initialValues,
    draftKey: 'credit_sale_create',
    validate: (values) => ({
      customerName: validators.required(values.customerName, 'Customer name'),
      quantity: validators.positiveInteger(values.quantity, 'Quantity'),
      unitPrice: validators.positiveNumber(values.unitPrice, 'Unit price'),
      agreedDueDate: validators.required(values.agreedDueDate, 'Settlement due date'),
      note: validators.minAuditNote(values.note, 4),
    }),
    crossValidate: (values) => {
      const total = (parseInt(values.quantity, 10) || 0) * (parseFloat(values.unitPrice) || 0);
      const deposit = parseFloat(values.depositPaid) || 0;
      if (deposit > total) {
        return { depositPaid: 'Deposit paid cannot exceed total sale price' };
      }
      return null;
    },
    onSubmit: async (values) => {
      const qty = parseInt(values.quantity, 10);
      const unitP = parseFloat(values.unitPrice);
      const dep = parseFloat(values.depositPaid) || 0;

      dataService.recordCreditSale({
        locationId: values.locationId || locations[0]?.id,
        livestockId: values.livestockId || undefined,
        customerName: values.customerName.trim(),
        customerPhone: values.customerPhone.trim(),
        customerAddress: values.customerAddress.trim(),
        quantitySold: qty,
        unitPrice: unitP,
        depositPaidCash: dep,
        agreedSettlementDate: values.agreedDueDate,
        paymentTerms: values.paymentTerms.trim(),
        notes: values.note.trim(),
        actor: activeMember,
      });

      showToast(`Credit sale of $${(qty * unitP).toFixed(2)} recorded for ${values.customerName}.`);
      if (onSaleCreated) onSaleCreated();
      onClose();
    },
  });

  const qtyNum = parseInt(form.values.quantity, 10) || 0;
  const unitNum = parseFloat(form.values.unitPrice) || 0;
  const depositNum = parseFloat(form.values.depositPaid) || 0;
  const totalAmount = qtyNum * unitNum;
  const balanceRemaining = Math.max(0, totalAmount - depositNum);

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Record Credit Sale"
      subtitle={step === 1 ? 'Step 1 of 2: Customer & Goods' : 'Step 2 of 2: Payment & Due Date'}
      dirty={form.isDirty}
      isSubmitting={form.isSubmitting}
      stickyError={form.stickyError}
      submitLabel={step === 1 ? 'Next: Payment Terms →' : 'Save Credit Sale'}
      onSubmit={(e) => {
        if (step === 1) {
          e.preventDefault();
          if (!form.values.customerName.trim()) {
            form.setStickyError('Customer name is required.');
            return;
          }
          if (qtyNum <= 0) {
            form.setStickyError('Quantity must be at least 1.');
            return;
          }
          if (unitNum <= 0) {
            form.setStickyError('Unit price must be greater than zero.');
            return;
          }
          form.setStickyError(null);
          setStep(2);
        } else {
          void form.handleSubmit(e);
        }
      }}
      footerExtra={
        <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE] text-xs flex items-center justify-between font-mono">
          <div>
            <span className="text-[10px] text-slate-400 block font-sans">Total Sale</span>
            <span className="font-bold text-slate-900">{formatMoney(totalAmount)}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-sans">Deposit Paid</span>
            <span className="font-bold text-emerald-600">{formatMoney(depositNum)}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-amber-700 block font-sans font-bold">Balance Owed</span>
            <span className="font-black text-rose-600">{formatMoney(balanceRemaining)}</span>
          </div>
        </div>
      }
    >
      {step === 1 ? (
        <div className="space-y-3.5">
          <Field label="Customer Full Name" required error={form.errors.customerName}>
            <input
              type="text"
              value={form.values.customerName}
              onChange={(e) => form.setFieldValue('customerName', e.target.value)}
              placeholder="e.g. John Doe / City Butchery"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Customer Phone" hint="Optional">
              <input
                type="tel"
                inputMode="tel"
                value={form.values.customerPhone}
                onChange={(e) => form.setFieldValue('customerPhone', e.target.value)}
                placeholder="e.g. +263 77..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </Field>

            <Field label="Farm Location" required>
              <select
                value={form.values.locationId}
                onChange={(e) => form.setFieldValue('locationId', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {livestockStatuses.length > 0 && (
            <Field label="Batch / Animal (Optional)">
              <select
                value={form.values.livestockId}
                onChange={(e) => form.setFieldValue('livestockId', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              >
                <option value="">General Produce / Crop / Unlinked</option>
                {livestockStatuses.map((ls: any) => (
                  <option key={ls.entry.id} value={ls.entry.id}>
                    {ls.entry.nameOrTag} ({ls.currentLiveHeadcount} available)
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity Sold" required error={form.errors.quantity}>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                value={form.values.quantity}
                onChange={(e) => form.setFieldValue('quantity', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </Field>

            <Field label="Unit Selling Price" required error={form.errors.unitPrice}>
              <MoneyInput
                value={form.values.unitPrice}
                onChange={(val) => form.setFieldValue('unitPrice', val)}
                hasError={Boolean(form.errors.unitPrice)}
              />
            </Field>
          </div>
        </div>
      ) : (
        <div className="space-y-3.5">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="text-xs font-bold text-amber-700 hover:text-amber-800 cursor-pointer"
          >
            ← Back to Customer Details
          </button>

          <Field label="Upfront Cash Deposit" hint="Amount received today" error={form.errors.depositPaid}>
            <MoneyInput
              value={form.values.depositPaid}
              onChange={(val) => form.setFieldValue('depositPaid', val)}
              hasError={Boolean(form.errors.depositPaid)}
            />
          </Field>

          <Field label="Agreed Settlement Due Date" required error={form.errors.agreedDueDate}>
            <div className="flex items-center gap-1.5 mb-1.5">
              {[
                { label: '+7 Days', days: 7 },
                { label: '+14 Days', days: 14 },
                { label: '+30 Days', days: 30 },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + chip.days);
                    form.setFieldValue('agreedDueDate', d.toISOString().split('T')[0]);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <input
              type="date"
              value={form.values.agreedDueDate}
              onChange={(e) => form.setFieldValue('agreedDueDate', e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </Field>

          <Field label="Payment Terms Note">
            <input
              type="text"
              value={form.values.paymentTerms}
              onChange={(e) => form.setFieldValue('paymentTerms', e.target.value)}
              placeholder="e.g. Net 14 Days"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </Field>

          <Field
            label="Mandatory Audit Note"
            required
            hint="Min 4 characters"
            error={form.errors.note}
          >
            <textarea
              rows={2}
              value={form.values.note}
              onChange={(e) => form.setFieldValue('note', e.target.value)}
              placeholder="Explain transaction agreement (required by security rules)..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </Field>
        </div>
      )}
    </FormSheet>
  );
};

