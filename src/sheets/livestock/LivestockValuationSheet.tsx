import React from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { MoneyInput } from '../../components/ui/MoneyInput.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { formatMoney } from '../../utils/currency.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import type { LivestockEntry, OrgMember } from '../../types/agro.ts';

export interface LivestockValuationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  batch: LivestockEntry;
  activeMember: OrgMember;
  onValuationSaved?: () => void;
}

export const LivestockValuationSheet: React.FC<LivestockValuationSheetProps> = ({
  isOpen,
  onClose,
  batch,
  activeMember,
  onValuationSaved,
}) => {
  const { showToast } = useToast();

  const status = dataService.computeLivestockStatuses().find((s: any) => s.entry.id === batch.id);
  const liveCount = status ? status.currentLiveHeadcount : batch.initialHeadcount;

  const form = useForm({
    initial: {
      pricePerUnit: String(batch.configuredSalePricePerUnit ?? (batch.species === 'Broilers' ? '6.00' : '85.00')),
      pricePerKg: String(batch.configuredSalePricePerKg ?? ''),
    },
    validate: (values) => ({
      pricePerUnit: validators.positiveNumber(values.pricePerUnit, 'Target price per animal'),
    }),
    onSubmit: async (values) => {
      try {
        const unitPrice = parseFloat(values.pricePerUnit);
        const kgPrice = parseFloat(values.pricePerKg);

        dataService.configureLivestockValuationPrice({
          livestockId: batch.id,
          configuredSalePricePerUnit: unitPrice,
          configuredSalePricePerKg: !isNaN(kgPrice) && kgPrice > 0 ? kgPrice : undefined,
          actor: activeMember,
        });

        showToast({
          type: 'success',
          title: 'Valuation Pricing Updated',
          message: `Market pricing set to ${formatMoney(unitPrice)}/head for ${batch.nameOrTag}.`,
        });
        onValuationSaved?.();
        onClose();
      } catch (err: any) {
        showToast({
          type: 'error',
          title: 'Update Failed',
          message: err?.message || 'Could not update pricing configuration.',
        });
      }
    },
  });

  const unitPrice = parseFloat(form.values.pricePerUnit || '0') || 0;
  const projectedGross = liveCount * unitPrice;
  const purchaseCost = batch.purchaseCostTotal || 0;
  const projectedGrossMargin = projectedGross - purchaseCost;

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Livestock Valuation Pricing"
      subtitle={`Configure market benchmarks for ${batch.nameOrTag}`}
      isSubmitting={form.isSubmitting}
      submitLabel="Save Pricing"
      onSubmit={form.handleSubmit}
      maxHeight="88dvh"
    >
      <div className="space-y-4">
        {/* Live Projection Pill */}
        <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <div className="text-emerald-700 dark:text-emerald-300">Live Stock</div>
            <div className="font-bold text-slate-900 dark:text-white mt-0.5">
              {liveCount} head
            </div>
          </div>
          <div>
            <div className="text-emerald-700 dark:text-emerald-300">Projected Value</div>
            <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {formatMoney(projectedGross)}
            </div>
          </div>
          <div>
            <div className="text-emerald-700 dark:text-emerald-300">Gross Margin</div>
            <div className="font-bold text-slate-900 dark:text-white mt-0.5">
              {formatMoney(projectedGrossMargin)}
            </div>
          </div>
        </div>

        <Field label="Market Selling Price per Head / Bird (USD)" required error={form.errors.pricePerUnit}>
          <MoneyInput
            value={form.values.pricePerUnit}
            onChange={(val) => form.setValue('pricePerUnit', val)}
            placeholder="6.00"
          />
        </Field>

        <Field label="Optional Benchmark Price per Kg Live Weight (USD)">
          <MoneyInput
            value={form.values.pricePerKg}
            onChange={(val) => form.setValue('pricePerKg', val)}
            placeholder="e.g. 2.80"
          />
        </Field>
      </div>
    </FormSheet>
  );
};

