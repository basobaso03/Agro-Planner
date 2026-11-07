import React, { useState } from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { MoneyInput } from '../../components/ui/MoneyInput.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { formatMoney } from '../../utils/currency.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import { PERMISSIONS } from '../../utils/permissions.ts';
import { Bell, Calendar, Users, Radio } from 'lucide-react';
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
  const [broadcastNow, setBroadcastNow] = useState(false);

  const form = useForm({
    initial: {
      borrowerName: '',
      borrowerContact: '',
      category: 'OUTGROWER_ADVANCE' as LoanCategory,
      principal: '',
      interestRate: '0',
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
      interestRate: validators.nonNegativeNumber(values.interestRate, 'Interest rate'),
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
      const interestRate = parseFloat(values.interestRate) || 0;

      try {
        const created = dataService.recordLoanGiven({
          borrowerName: values.borrowerName.trim(),
          borrowerContact: values.borrowerContact.trim(),
          category: values.category,
          principalAmount: p,
          interestRatePercent: interestRate,
          agreedReturnDate: values.agreedReturnDate,
          collateralNote: values.collateralNote.trim() || undefined,
          purposeNote: values.purposeNote.trim(),
          actor: activeMember,
          runwayAllocation,
        });

        if (broadcastNow && created.agreedReturnDate) {
          dataService.broadcastFinancialDueAlert({
            entityType: 'LOAN_GIVEN',
            entityId: created.id,
            partyName: created.borrowerName,
            amount: created.remainingBalance,
            dueDate: created.agreedReturnDate,
            customNote: created.purposeNote,
            actor: activeMember,
          });
        }

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
            interestRatePercent: interestRate,
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

        <Field label="Agreed Interest Rate (%)" hint="0% if interest-free outgrower advance" error={form.errors.interestRate}>
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            {[0, 5, 10, 15, 20].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => form.setFieldValue('interestRate', rate.toString())}
                className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                  form.values.interestRate === rate.toString()
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
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
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500 pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
          </div>
        </Field>

        {/* Live Calculation Breakdown */}
        {parseFloat(form.values.principal) > 0 && (
          <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span>Cash Disbursed from Ground:</span>
              <span className="font-mono font-bold">${parseFloat(form.values.principal || '0').toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Agreed Interest ({parseFloat(form.values.interestRate) || 0}%):</span>
              <span className="font-mono font-bold text-emerald-700">
                +${((parseFloat(form.values.principal || '0') * (parseFloat(form.values.interestRate) || 0)) / 100).toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1.5 border-t border-emerald-200 text-slate-900 font-bold">
              <span>Total Receivable to Collect:</span>
              <span className="font-mono font-black text-emerald-700 text-sm">
                ${(parseFloat(form.values.principal || '0') * (1 + (parseFloat(form.values.interestRate) || 0) / 100)).toFixed(2)}
              </span>
            </div>
          </div>
        )}

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

        {/* Morning Notification Schedule & Member Scope Preview */}
        {form.values.agreedReturnDate && (
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
                Agreed Return Date: {new Date(form.values.agreedReturnDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>

            <div className="flex items-start gap-2 text-amber-800 text-[11px] leading-relaxed pt-1.5 border-t border-amber-200/60">
              <Users className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
              <span>
                <strong>Org-Wide Reach:</strong> When the return date arrives in the morning, alerts notify the team so this advance is tracked and collected on time.
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

