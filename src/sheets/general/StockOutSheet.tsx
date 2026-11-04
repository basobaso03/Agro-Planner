import React from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import type { OrgMember } from '../../types/agro.ts';

export interface StockOutSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeMember: OrgMember;
  onStockDeducted?: () => void;
}

export const StockOutSheet: React.FC<StockOutSheetProps> = ({
  isOpen,
  onClose,
  activeMember,
  onStockDeducted,
}) => {
  const { showToast } = useToast();
  const locations = dataService.getState().locations.filter(
    (l) => !activeMember.orgId || l.orgId === activeMember.orgId
  );

  const inventory = dataService.computeFeedInventorySummaries();

  const form = useForm({
    initial: {
      locationId: locations[0]?.id || '',
      feedType: inventory[0]?.feedType || '',
      units: '',
      reason: 'OPERATIONAL_USE' as 'OPERATIONAL_USE' | 'DAMAGED_EXPIRED' | 'INTERNAL_TRANSFER',
      note: '',
    },
    validate: (values) => ({
      locationId: !values.locationId ? 'Location is required' : null,
      feedType: validators.required(values.feedType, 'Item name'),
      units: validators.positiveInteger(values.units, 'Quantity'),
      note: validators.minAuditNote(values.note, 4),
    }),
    onSubmit: async (values) => {
      try {
        const units = parseInt(values.units, 10);
        dataService.logFeedEvent({
          locationId: values.locationId,
          feedType: values.feedType.trim(),
          direction: 'DAILY_CONSUMPTION',
          bagsDelta: -Math.abs(units),
          kgPerBag: 50,
          note: `[Reason: ${values.reason}] ${values.note.trim()}`,
          actor: activeMember,
        });

        showToast({
          type: 'success',
          title: 'Stock Deducted',
          message: `-${units} units of ${values.feedType} deducted from inventory.`,
        });
        onStockDeducted?.();
        onClose();
      } catch (err: any) {
        showToast({
          type: 'error',
          title: 'Stock Out Failed',
          message: err?.message || 'Could not deduct stock.',
        });
      }
    },
  });

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Stock Out / Inventory Dispatch"
      subtitle="Issue goods from inventory for operations or dispatch"
      isSubmitting={form.isSubmitting}
      submitLabel="Record Stock Out"
      onSubmit={form.handleSubmit}
      maxHeight="88dvh"
    >
      <div className="space-y-4">
        <Field label="Warehouse / Location" required error={form.errors.locationId}>
          <select
            value={form.values.locationId}
            onChange={(e) => form.setValue('locationId', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Item / Inventory Category" required error={form.errors.feedType}>
          {inventory.length > 0 ? (
            <select
              value={form.values.feedType}
              onChange={(e) => form.setValue('feedType', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            >
              {inventory.map((item: any, idx: number) => (
                <option key={idx} value={item.feedType}>
                  {item.feedType} (In stock: {item.currentBagsBalance} units)
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={form.values.feedType}
              onChange={(e) => form.setValue('feedType', e.target.value)}
              placeholder="e.g. Broiler Finisher Mash"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity to Deduct" required error={form.errors.units}>
            <input
              type="number"
              min={1}
              value={form.values.units}
              onChange={(e) => form.setValue('units', e.target.value)}
              placeholder="e.g. 5"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            />
          </Field>

          <Field label="Reason">
            <select
              value={form.values.reason}
              onChange={(e) => form.setValue('reason', e.target.value as any)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            >
              <option value="OPERATIONAL_USE">Operational Use</option>
              <option value="DAMAGED_EXPIRED">Damaged / Expired</option>
              <option value="INTERNAL_TRANSFER">Internal Transfer</option>
            </select>
          </Field>
        </div>

        <Field
          label="Mandatory Audit Note"
          required
          error={form.errors.note}
          hint="Minimum 4 characters."
        >
          <textarea
            rows={2}
            value={form.values.note}
            onChange={(e) => form.setValue('note', e.target.value)}
            placeholder="e.g. Issued 5 bags for afternoon feeding in Pen 3"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          />
        </Field>
      </div>
    </FormSheet>
  );
};

