import React from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import type { OrgMember } from '../../types/agro.ts';

export interface StockInSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeMember: OrgMember;
  onStockAdded?: () => void;
}

export const StockInSheet: React.FC<StockInSheetProps> = ({
  isOpen,
  onClose,
  activeMember,
  onStockAdded,
}) => {
  const { showToast } = useToast();
  const locations = dataService.getState().locations.filter(
    (l) => !activeMember.orgId || l.orgId === activeMember.orgId
  );

  const form = useForm({
    initial: {
      locationId: locations[0]?.id || '',
      itemName: '',
      quantityUnits: '',
      unitSize: '50',
      unitType: 'kg',
      supplier: '',
      note: '',
    },
    validate: (values) => ({
      locationId: !values.locationId ? 'Location is required' : null,
      itemName: validators.required(values.itemName, 'Item name'),
      quantityUnits: validators.positiveInteger(values.quantityUnits, 'Quantity'),
      note: validators.minAuditNote(values.note, 4),
    }),
    onSubmit: async (values) => {
      try {
        const units = parseInt(values.quantityUnits, 10);
        const unitSize = parseFloat(values.unitSize) || 1;

        dataService.logFeedEvent({
          locationId: values.locationId,
          feedType: values.itemName.trim(),
          direction: 'STOCK_IN',
          bagsDelta: units,
          kgPerBag: unitSize,
          note: `[Supplier: ${values.supplier || 'N/A'}] ${values.note.trim()}`,
          actor: activeMember,
        });

        showToast({
          type: 'success',
          title: 'Stock Added',
          message: `+${units} units of ${values.itemName} added to inventory.`,
        });
        onStockAdded?.();
        onClose();
      } catch (err: any) {
        showToast({
          type: 'error',
          title: 'Stock In Failed',
          message: err?.message || 'Could not record stock in.',
        });
      }
    },
  });

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Stock In / Inventory Receipt"
      subtitle="Record incoming goods, raw materials, or supplies"
      isSubmitting={form.isSubmitting}
      submitLabel="Record Inward Stock"
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

        <Field label="Item Name / SKU" required error={form.errors.itemName}>
          <input
            type="text"
            value={form.values.itemName}
            onChange={(e) => form.setValue('itemName', e.target.value)}
            placeholder="e.g. 50kg Sunflower Seed Bags, Diesel Drums"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Units / Packages Received" required error={form.errors.quantityUnits}>
            <input
              type="number"
              min={1}
              value={form.values.quantityUnits}
              onChange={(e) => form.setValue('quantityUnits', e.target.value)}
              placeholder="e.g. 20"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            />
          </Field>

          <Field label="Unit Weight / Volume (kg/L)">
            <input
              type="number"
              min={0.1}
              step="any"
              value={form.values.unitSize}
              onChange={(e) => form.setValue('unitSize', e.target.value)}
              placeholder="50"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            />
          </Field>
        </div>

        <Field label="Supplier / Vendor Name">
          <input
            type="text"
            value={form.values.supplier}
            onChange={(e) => form.setValue('supplier', e.target.value)}
            placeholder="e.g. National Foods Ltd"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          />
        </Field>

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
            placeholder="e.g. Delivered via truck #AB-492, verified undamaged count"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          />
        </Field>
      </div>
    </FormSheet>
  );
};

