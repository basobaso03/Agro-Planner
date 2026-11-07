import React, { useState } from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { MoneyInput } from '../../components/ui/MoneyInput.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import { PERMISSIONS } from '../../utils/permissions.ts';
import { Bell, Calendar, Users, Radio } from 'lucide-react';
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
  const [broadcastNow, setBroadcastNow] = useState(false);

  const form = useForm({
    initial: {
      creditorName: '',
      creditorContact: '',
      category: 'SUPPLIER_CREDIT' as DebtCategory,
      principal: '',
      interestRate: '0',
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
      interestRate: validators.nonNegativeNumber(values.interestRate, 'Interest rate'),
      purposeNote: validators.minAuditNote(values.purposeNote, 4),
    }),
    onSubmit: async (values) => {
      if (!PERMISSIONS.canRecordDebt(activeMember.role)) {
        throw new Error('Permission denied: Only Treasurers and Administrators can record debt liabilities.');
      }
      const p = parseFloat(values.principal);
      const interestRate = parseFloat(values.interestRate) || 0;

      const created = dataService.recordDebtLiability({
        creditorName: values.creditorName.trim(),
        creditorContact: values.creditorContact.trim() || undefined,
        category: values.category,
        principalAmount: p,
        interestRatePercent: interestRate,
        dueDate: values.dueDate || undefined,
        purposeNote: values.purposeNote.trim(),
        actor: activeMember,
      });

      if (broadcastNow && created.dueDate) {
        dataService.broadcastFinancialDueAlert({
          entityType: 'DEBT_LIABILITY',
          entityId: created.id,
          partyName: created.creditorName,
          amount: created.principalAmount,
          dueDate: created.dueDate,
          customNote: created.purposeNote,
          actor: activeMember,
        });
      }

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

          <Field label="Principal Borrowed" required error={form.errors.principal}>
            <MoneyInput
              value={form.values.principal}
              onChange={(val) => form.setFieldValue('principal', val)}
              hasError={Boolean(form.errors.principal)}
            />
          </Field>
        </div>

        <Field label="Interest Rate (%)" hint="0% if zero-interest credit" error={form.errors.interestRate}>
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            {[0, 5, 10, 15, 20].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => form.setFieldValue('interestRate', rate.toString())}
                className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                  form.values.interestRate === rate.toString()
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100'
                }`}
              >
                {rate}%
              </button>
            ))}
          </div>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              min="0"
              value={form.values.interestRate}
              onChange={(e) => form.setFieldValue('interestRate', e.target.value)}
              placeholder="e.g. 10"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-rose-500 pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
          </div>
        </Field>

        {/* Live Calculation Breakdown */}
        {parseFloat(form.values.principal) > 0 && (
          <div className="p-3 rounded-2xl bg-rose-50/60 border border-rose-200/80 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span>Principal Amount:</span>
              <span className="font-mono font-bold">${parseFloat(form.values.principal || '0').toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Interest ({parseFloat(form.values.interestRate) || 0}%):</span>
              <span className="font-mono font-bold text-rose-700">
                +${((parseFloat(form.values.principal || '0') * (parseFloat(form.values.interestRate) || 0)) / 100).toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1.5 border-t border-rose-200 text-slate-900 font-bold">
              <span>Total Repayable Debt:</span>
              <span className="font-mono font-black text-rose-700 text-sm">
                ${(parseFloat(form.values.principal || '0') * (1 + (parseFloat(form.values.interestRate) || 0) / 100)).toFixed(2)}
              </span>
            </div>
          </div>
        )}

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

        {/* Morning Notification Schedule & Member Scope Preview */}
        {form.values.dueDate && (
          <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-950 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <Bell className="w-4 h-4 text-amber-600" />
                <span>Morning Dispatch Notification</span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                09:00 AM Alert
              </span>
            </div>

            <div className="flex items-center gap-2 text-slate-800 font-semibold">
              <Calendar className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>
                Due Date: {new Date(form.values.dueDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>

            <div className="flex items-start gap-2 text-amber-800 text-[11px] leading-relaxed pt-1.5 border-t border-amber-200/60">
              <Users className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
              <span>
                <strong>Org-Wide Reach:</strong> When due date arrives in the morning, alerts notify the team so this liability is settled before penalties.
              </span>
            </div>

            <label className="flex items-center gap-2 pt-1 text-xs font-bold text-amber-900 cursor-pointer">
              <input
                type="checkbox"
                checked={broadcastNow}
                onChange={(e) => setBroadcastNow(e.target.checked)}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
              <span className="flex items-center gap-1">
                <Radio className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                Dispatch immediate broadcast to all org members right now
              </span>
            </label>
          </div>
        )}

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

