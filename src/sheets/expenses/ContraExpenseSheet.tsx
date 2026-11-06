import React from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { formatMoney } from '../../utils/currency.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import type { ExpenseLedgerEvent, OrgMember } from '../../types/agro.ts';

export interface ContraExpenseSheetProps {
  isOpen: boolean;
  onClose: () => void;
  expense: ExpenseLedgerEvent;
  activeMember: OrgMember;
  onContraCompleted?: () => void;
}

export const ContraExpenseSheet: React.FC<ContraExpenseSheetProps> = ({
  isOpen,
  onClose,
  expense,
  activeMember,
  onContraCompleted,
}) => {
  const { showToast } = useToast();

  const form = useForm({
    initial: {
      reason: '',
    },
    validate: (values) => ({
      reason: validators.minAuditNote(values.reason, 4),
    }),
    onSubmit: async (values) => {
      dataService.logExpense({
        locationId: expense.locationId,
        batchOrAnimalId: expense.batchOrAnimalId,
        category: expense.category,
        direction: 'CONTRA_REVERSAL',
        amount: expense.amount,
        referenceTransactionId: expense.id,
        note: `CONTRA: ${values.reason.trim()}`,
        actor: activeMember,
      });

      showToast(`Contra reversal of ${formatMoney(expense.amount)} executed.`);
      if (onContraCompleted) onContraCompleted();
      onClose();
    },
  });

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Execute Contra Reversal"
      subtitle={`Original Transaction: ${expense.id}`}
      isSubmitting={form.isSubmitting}
      dirty={form.isDirty}
      stickyError={form.stickyError}
      submitLabel={`Reverse ${formatMoney(expense.amount)}`}
      onSubmit={form.handleSubmit}
    >
      <div className="space-y-3.5">
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
          <div className="font-bold">Strict Immutability Rule:</div>
          <p className="text-amber-800">
            Past ledger records are sealed and immutable, and cannot be edited or deleted. This contra reversal
            will create an offsetting positive credit of {formatMoney(expense.amount)} returning liquid cash to the
            pool.
          </p>
        </div>

        <Field
          label="Mandatory Reason for Contra Reversal"
          required
          hint="Min 4 characters (recorded in audit ledger)"
          error={form.errors.reason}
        >
          <textarea
            rows={3}
            value={form.values.reason}
            onChange={(e) => form.setFieldValue('reason', e.target.value)}
            placeholder="e.g. Duplicate entry logged in error by ground operator..."
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-rose-500"
          />
        </Field>
      </div>
    </FormSheet>
  );
};

