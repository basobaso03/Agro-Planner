import React from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { MoneyInput } from '../../components/ui/MoneyInput.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { formatMoney } from '../../utils/currency.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import type { FixedAssetLedgerEvent, OrgMember } from '../../types/agro.ts';

export interface AdjustAssetSheetProps {
  isOpen: boolean;
  onClose: () => void;
  asset: FixedAssetLedgerEvent;
  activeMember: OrgMember;
  onAssetAdjusted?: () => void;
}

export const AdjustAssetSheet: React.FC<AdjustAssetSheetProps> = ({
  isOpen,
  onClose,
  asset,
  activeMember,
  onAssetAdjusted,
}) => {
  const { showToast } = useToast();

  const form = useForm({
    initial: {
      direction: 'IMPAIRMENT' as 'IMPAIRMENT' | 'REVALUATION_UP',
      deltaAmount: '',
      note: '',
    },
    validate: (values) => ({
      deltaAmount: validators.positiveNumber(values.deltaAmount, 'Adjustment amount'),
      note: validators.minAuditNote(values.note, 4),
    }),
    onSubmit: async (values) => {
      const delta = parseFloat(values.deltaAmount);
      const direction = values.direction === 'REVALUATION_UP' ? 'ADDITION' : 'DEDUCTION';

      dataService.logFixedAssetEvent({
        locationId: asset.locationId,
        assetGroupId: asset.assetGroupId,
        assetName: asset.assetName,
        category: asset.category,
        direction,
        quantityDelta: 0,
        valueDelta: delta,
        condition: asset.condition || 'GOOD',
        note: values.note.trim(),
        actor: activeMember,
        deductFromLeftMoney: false,
      });

      showToast(`Asset adjustment of ${formatMoney(delta)} recorded.`);
      if (onAssetAdjusted) onAssetAdjusted();
      onClose();
    },
  });

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Adjust Asset Valuation"
      subtitle={`Asset: ${asset.assetName}`}
      isSubmitting={form.isSubmitting}
      dirty={form.isDirty}
      stickyError={form.stickyError}
      submitLabel="Apply Valuation Adjustment"
      onSubmit={form.handleSubmit}
    >
      <div className="space-y-3.5">
        <Field label="Adjustment Direction" required>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => form.setFieldValue('direction', 'IMPAIRMENT')}
              className={`p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                form.values.direction === 'IMPAIRMENT'
                  ? 'bg-rose-50 border-rose-300 text-rose-800 ring-2 ring-rose-500/20'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              Impairment / Depreciation (-)
            </button>
            <button
              type="button"
              onClick={() => form.setFieldValue('direction', 'REVALUATION_UP')}
              className={`p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                form.values.direction === 'REVALUATION_UP'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-500/20'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              Revaluation Gain (+)
            </button>
          </div>
        </Field>

        <Field label="Adjustment Amount Delta" required error={form.errors.deltaAmount}>
          <MoneyInput
            value={form.values.deltaAmount}
            onChange={(val) => form.setFieldValue('deltaAmount', val)}
            hasError={Boolean(form.errors.deltaAmount)}
          />
        </Field>

        <Field label="Mandatory Reason Note" required hint="Min 4 characters" error={form.errors.note}>
          <textarea
            rows={2}
            value={form.values.note}
            onChange={(e) => form.setFieldValue('note', e.target.value)}
            placeholder="Explain depreciation wear or revaluation inspection..."
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          />
        </Field>
      </div>
    </FormSheet>
  );
};

