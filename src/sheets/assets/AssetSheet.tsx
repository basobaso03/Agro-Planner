import React from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { MoneyInput } from '../../components/ui/MoneyInput.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { formatMoney } from '../../utils/currency.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import type { FarmLocation, OrgMember, FixedAssetCategory, AssetCondition } from '../../types/agro.ts';

export interface AssetSheetProps {
  isOpen: boolean;
  onClose: () => void;
  locations: FarmLocation[];
  activeMember: OrgMember;
  leftMoney: number;
  onAssetCreated?: () => void;
}

export const AssetSheet: React.FC<AssetSheetProps> = ({
  isOpen,
  onClose,
  locations,
  activeMember,
  leftMoney,
  onAssetCreated,
}) => {
  const { showToast } = useToast();

  const form = useForm({
    initial: {
      name: '',
      category: 'Poultry & Livestock Housing',
      cost: '',
      locationId: locations[0]?.id || '',
      note: '',
    },
    draftKey: 'asset_create_draft',
    validate: (values) => ({
      name: validators.required(values.name, 'Asset name'),
      cost: validators.positiveNumber(values.cost, 'Purchase cost'),
      note: validators.minAuditNote(values.note, 4),
    }),
    crossValidate: (values) => {
      const c = parseFloat(values.cost) || 0;
      if (c > leftMoney) {
        return {
          cost: `Insufficient funds in pool: Cash on Ground is ${formatMoney(leftMoney)}, but asset requires ${formatMoney(c)}`,
        };
      }
      return null;
    },
    onSubmit: async (values) => {
      const c = parseFloat(values.cost);

      dataService.logFixedAssetEvent({
        locationId: values.locationId || locations[0]?.id,
        assetGroupId: values.category.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        assetName: values.name.trim(),
        category: values.category as FixedAssetCategory,
        direction: 'INITIAL',
        quantityDelta: 1,
        valueDelta: c,
        condition: 'GOOD' as AssetCondition,
        note: values.note.trim(),
        actor: activeMember,
        deductFromLeftMoney: true, // Mandatory deduction as per Frontend plan Issue 11
      });

      showToast(`Registered fixed asset "${values.name}" for ${formatMoney(c)}.`);
      if (onAssetCreated) onAssetCreated();
      onClose();
    },
  });

  const costNum = parseFloat(form.values.cost) || 0;

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Acquire Fixed Asset"
      subtitle="Capital equipment, vehicles, solar & infrastructure"
      isSubmitting={form.isSubmitting}
      dirty={form.isDirty}
      stickyError={form.stickyError}
      submitLabel={`Purchase & Deduct ${formatMoney(costNum)}`}
      onSubmit={form.handleSubmit}
    >
      <div className="space-y-3.5">
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
          <span className="text-slate-500">Available Pool Balance:</span>
          <span className="font-mono font-bold text-emerald-700">{formatMoney(leftMoney)}</span>
        </div>

        <Field label="Asset Name / Description" required error={form.errors.name}>
          <input
            type="text"
            value={form.values.name}
            onChange={(e) => form.setFieldValue('name', e.target.value)}
            placeholder="e.g. 5kVA Solar Inverter & 4x Lithium Batteries"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" required>
            <select
              value={form.values.category}
              onChange={(e) => form.setFieldValue('category', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              <option value="Poultry & Livestock Housing">Poultry &amp; Livestock Housing</option>
              <option value="Solar, Borehole & Water">Solar, Borehole &amp; Water</option>
              <option value="Feeders, Drinkers & Equipment">Feeders, Drinkers &amp; Equipment</option>
              <option value="Vehicles & Farm Transport">Vehicles &amp; Farm Transport</option>
              <option value="Land, Fencing & Security">Land, Fencing &amp; Security</option>
              <option value="Processing & Cold Storage">Processing &amp; Cold Storage</option>
              <option value="Custom / Other Infrastructure">Custom / Other Infrastructure</option>
            </select>
          </Field>

          <Field label="Purchase Cost" required error={form.errors.cost}>
            <MoneyInput
              value={form.values.cost}
              onChange={(val) => form.setFieldValue('cost', val)}
              hasError={Boolean(form.errors.cost)}
            />
          </Field>
        </div>

        <Field label="Assigned Farm Site Location" required>
          <select
            value={form.values.locationId}
            onChange={(e) => form.setFieldValue('locationId', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Mandatory Audit Note" required hint="Min 4 characters" error={form.errors.note}>
          <textarea
            rows={2}
            value={form.values.note}
            onChange={(e) => form.setFieldValue('note', e.target.value)}
            placeholder="Explain asset supplier, warranty, or serial number..."
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </Field>
      </div>
    </FormSheet>
  );
};

