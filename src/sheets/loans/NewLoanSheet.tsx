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
import type { LoanCategory, OrgMember } from '../../types/agro.ts';
import type { RunwayAllocation } from '../../types/runway.ts';

export interface NewLoanSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeMember: OrgMember;
  leftMoney: number;
  runwayAllocation?: RunwayAllocation;
  onLoanCreated?: () => void;
  onRequestSpendGate?: (amt: number, payload: any) => void;
}

export const NewLoanSheet: React.FC<NewLoanSheetProps> = ({
  isOpen,
  onClose,
  activeMember,
  leftMoney,
  runwayAllocation,
  onLoanCreated,
  onRequestSpendGate,
}) => {
  const { showToast } = useToast();

  const form = useForm({
    initial: {
      borrowerName: '',
      borrowerContact: '',
      category: 'OUTGROWER_ADVANCE' as LoanCategory,
      principal: '',
      agreedReturnDate: (() => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d.toISOString().split('T')[0];
      })(),
      collateralNote: '',
      purposeNote: '',
    },
    draftKey: 'loan_create_draft',
    validate: (values) => ({
      borrowerName: validators.required(values.borrowerName, 'Borrower name'),
      principal: validators.positiveNumber(values.principal, 'Principal loan amount'),
      agreedReturnDate: validators.required(values.agreedReturnDate, 'Return date'),
      purposeNote: validators.minAuditNote(values.purposeNote, 4),
    }),
    crossValidate: (values) => {
      const p = parseFloat(values.principal) || 0;
      if (p > leftMoney) {
        return {
          principal: `Insufficient funds: Cash on Ground is ${formatMoney(leftMoney)}, but loan requires ${formatMoney(p)}`,
        };
      }
      return null;
    },
    onSubmit: async (values) => {
      if (!PERMISSIONS.canIssueLoan(activeMember.role)) {
        throw new Error('Permission denied: Only Treasurers and Administrators can issue loan advances.');
      }
      const p = parseFloat(values.principal);

      try {
        dataService.recordLoanGiven({
          borrowerName: values.borrowerName.trim(),
          borrowerContact: values.borrowerContact.trim(),
          category: values.category,
          principalAmount: p,
          agreedReturnDate: values.agreedReturnDate,
          collateralNote: values.collateralNote.trim() || undefined,
          purposeNote: values.purposeNote.trim(),
          actor: activeMember,
          runwayAllocation,
        });

        showToast(`Disbursed loan advance of ${formatMoney(p)} to ${values.borrowerName}.`);
        if (onLoanCreated) onLoanCreated();
        onClose();
      } catch (err: any) {
        const isRunwayGate =
          err?.code === 'RUNWAY_ALLOCATION_REQUIRED' ||
          err?.code === 'RUNWAY_LINE_OVERRUN' ||
          err?.message?.toLowerCase().includes('runway spend gate blocked');

        if (isRunwayGate && onRequestSpendGate) {
          onRequestSpendGate(p, {
            borrowerName: values.borrowerName.trim(),
            borrowerContact: values.borrowerContact.trim(),
            category: values.category,
            principalAmount: p,
            agreedReturnDate: values.agreedReturnDate,
            collateralNote: values.collateralNote.trim() || undefined,
            purposeNote: values.purposeNote.trim(),
            actor: activeMember,
          });
          onClose();
        } else {
          throw err;
        }
      }
    },
  });

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Advance Loan to Third Party"
      subtitle="Outgrower advances, partner credits, or staff loans"
      isSubmitting={form.isSubmitting}
      dirty={form.isDirty}
      stickyError={form.stickyError}
      submitLabel="Disburse Loan"
      onSubmit={form.handleSubmit}
    >
      <div className="space-y-3.5">
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
          <span className="text-slate-500">Available Liquid Cash:</span>
          <span className="font-mono font-bold text-emerald-700">{formatMoney(leftMoney)}</span>
        </div>

        <Field label="Borrower Name" required error={form.errors.borrowerName}>
          <input
            type="text"
            value={form.values.borrowerName}
            onChange={(e) => form.setFieldValue('borrowerName', e.target.value)}
            placeholder="e.g. Tendai Moyo (Outgrower)"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" required>
            <select
              value={form.values.category}
              onChange={(e) => form.setFieldValue('category', e.target.value as LoanCategory)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              <option value="OUTGROWER_ADVANCE">Outgrower Advance</option>
              <option value="PARTNER_BUSINESS_CREDIT">Partner Credit</option>
              <option value="EMPLOYEE_ADVANCE">Staff Advance</option>
              <option value="COMMERCIAL_LOAN">Commercial Loan</option>
            </select>
          </Field>

          <Field label="Loan Principal" required error={form.errors.principal}>
            <MoneyInput
              value={form.values.principal}
              onChange={(val) => form.setFieldValue('principal', val)}
              hasError={Boolean(form.errors.principal)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Borrower Contact" hint="Phone/Email">
            <input
              type="tel"
              inputMode="tel"
              value={form.values.borrowerContact}
              onChange={(e) => form.setFieldValue('borrowerContact', e.target.value)}
              placeholder="e.g. +263 77..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </Field>

          <Field label="Agreed Return Date" required error={form.errors.agreedReturnDate}>
            <input
              type="date"
              value={form.values.agreedReturnDate}
              onChange={(e) => form.setFieldValue('agreedReturnDate', e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </Field>
        </div>

        <Field label="Collateral / Guarantee Note" hint="Optional">
          <input
            type="text"
            value={form.values.collateralNote}
            onChange={(e) => form.setFieldValue('collateralNote', e.target.value)}
            placeholder="e.g. Cattle ear-tag #402 / Equipment serial"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </Field>

        <Field
          label="Mandatory Purpose Explanation"
          required
          hint="Min 4 characters (recorded in audit ledger)"
          error={form.errors.purposeNote}
        >
          <textarea
            rows={2}
            value={form.values.purposeNote}
            onChange={(e) => form.setFieldValue('purposeNote', e.target.value)}
            placeholder="Explain why this loan is being advanced..."
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </Field>
      </div>
    </FormSheet>
  );
};

