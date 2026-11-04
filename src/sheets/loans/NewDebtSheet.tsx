import React from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { MoneyInput } from '../../components/ui/MoneyInput.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import { PERMISSIONS } from '../../utils/permissions.ts';
import type { DebtCategory, OrgMember } from '../../types/agro.ts';

export interface NewDebtSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeMember: OrgMember;
  onDebtCreated?: () => void;
}

export const NewDebtSheet: React.FC<NewDebtSheetProps> = ({
  isOpen,
  onClose,
  activeMember,
  onDebtCreated,
}) => {
  const { showToast } = useToast();

  const form = useForm({
    initial: {
      creditorName: '',
      creditorContact: '',
      category: 'SUPPLIER_CREDIT' as DebtCategory,
      principal: '',
      dueDate: (() => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d.toISOString().split('T')[0];
      })(),
      purposeNote: '',
    },
    draftKey: 'debt_create_draft',
    validate: (values) => ({
      creditorName: validators.required(values.creditorName, 'Creditor / Lender name'),
      principal: validators.positiveNumber(values.principal, 'Principal amount'),
      purposeNote: validators.minAuditNote(values.purposeNote, 4),
    }),
    onSubmit: async (values) => {
      if (!PERMISSIONS.canRecordDebt(activeMember.role)) {
        throw new Error('Permission denied: Only Treasurers and Administrators can record debt liabilities.');
      }
      const p = parseFloat(values.principal);

      dataService.recordDebtLiability({
        creditorName: values.creditorName.trim(),
        creditorContact: values.creditorContact.trim() || undefined,
        category: values.category,
        principalAmount: p,
        dueDate: values.dueDate || undefined,
        purposeNote: values.purposeNote.trim(),
        actor: activeMember,
      });

      showToast(`Recorded debt liability of $${p.toFixed(2)} from ${values.creditorName}.`);
      if (onDebtCreated) onDebtCreated();
      onClose();
    },
  });

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Record Borrowed Money / Debt"
      subtitle="Supplier credit, director loans, or bank advances"
      isSubmitting={form.isSubmitting}
      dirty={form.isDirty}
      stickyError={form.stickyError}
      submitLabel="Save Liability"
      onSubmit={form.handleSubmit}
    >
      <div className="space-y-3.5">
        <Field label="Creditor / Supplier Name" required error={form.errors.creditorName}>
          <input
            type="text"
            value={form.values.creditorName}
            onChange={(e) => form.setFieldValue('creditorName', e.target.value)}
            placeholder="e.g. Irvine's Chicks / National Foods"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" required>
            <select
              value={form.values.category}
              onChange={(e) => form.setFieldValue('category', e.target.value as DebtCategory)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
            >
              <option value="SUPPLIER_CREDIT">Supplier Credit</option>
              <option value="EXTERNAL_LOAN">Bank / Commercial Loan</option>
              <option value="DIRECTOR_MEMBER_ADVANCE">Director Advance</option>
              <option value="EQUIPMENT_FINANCING">Equipment Financing</option>
              <option value="OTHER_LIABILITY">Other Liability</option>
            </select>
          </Field>

          <Field label="Principal Amount" required error={form.errors.principal}>
            <MoneyInput
              value={form.values.principal}
              onChange={(val) => form.setFieldValue('principal', val)}
              hasError={Boolean(form.errors.principal)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Contact Phone" hint="Optional">
            <input
              type="tel"
              inputMode="tel"
              value={form.values.creditorContact}
              onChange={(e) => form.setFieldValue('creditorContact', e.target.value)}
              placeholder="e.g. +263 77..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-rose-500"
            />
          </Field>

          <Field label="Settlement Due Date" hint="Optional">
            <div className="flex items-center gap-1 mb-1">
              {[
                { label: '+14d', days: 14 },
                { label: '+30d', days: 30 },
                { label: '+60d', days: 60 },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + chip.days);
                    form.setFieldValue('dueDate', d.toISOString().split('T')[0]);
                  }}
                  className="px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[10px] font-bold hover:bg-rose-100 transition-colors cursor-pointer"
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <input
              type="date"
              value={form.values.dueDate}
              onChange={(e) => form.setFieldValue('dueDate', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-rose-500"
            />
          </Field>
        </div>

        <Field
          label="Mandatory Purpose Explanation"
          required
          hint="Min 4 characters (audit required)"
          error={form.errors.purposeNote}
        >
          <textarea
            rows={2}
            value={form.values.purposeNote}
            onChange={(e) => form.setFieldValue('purposeNote', e.target.value)}
            placeholder="Explain what the borrowed funds or supplier goods will be used for..."
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          />
        </Field>
      </div>
    </FormSheet>
  );
};

