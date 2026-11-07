import React, { useState } from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import type { OrgMember } from '../../types/agro.ts';

export interface SiteSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeMember: OrgMember;
  onSiteCreated?: () => void;
}

export const SiteSheet: React.FC<SiteSheetProps> = ({
  isOpen,
  onClose,
  activeMember,
  onSiteCreated,
}) => {
  const { showToast } = useToast();

  const form = useForm({
    initial: {
      name: '',
      region: '',
      primaryOperatorName: activeMember.fullName || '',
    },
    validate: (values) => ({
      name: validators.required(values.name, 'Location / Site name'),
      region: validators.required(values.region, 'District / Region'),
      primaryOperatorName: validators.required(values.primaryOperatorName, 'Operator name'),
    }),
    onSubmit: async (values) => {
      try {
        dataService.addLocation({
          name: values.name.trim(),
          region: values.region.trim(),
          primaryOperatorName: values.primaryOperatorName.trim(),
          actor: activeMember,
        });

        showToast({
          type: 'success',
          title: 'Site Registered',
          message: `${values.name} (${values.region}) is active for enterprise operations.`,
        });
        onSiteCreated?.();
        onClose();
      } catch (err: any) {
        showToast({
          type: 'error',
          title: 'Registration Failed',
          message: err?.message || 'Could not register location.',
        });
      }
    },
  });

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Add Enterprise Site"
      subtitle="Register a farm paddock, branch warehouse, or retail depot"
      isSubmitting={form.isSubmitting}
      submitLabel="Save Site"
      onSubmit={form.handleSubmit}
      maxHeight="88dvh"
    >
      <div className="space-y-4">
        <Field label="Site / Branch Name" required error={form.errors.name}>
          <input
            type="text"
            value={form.values.name}
            onChange={(e) => form.setValue('name', e.target.value)}
            placeholder="e.g. Norton Broiler Farm, Harare Central Depot"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          />
        </Field>

        <Field label="District / Province / Region" required error={form.errors.region}>
          <input
            type="text"
            value={form.values.region}
            onChange={(e) => form.setValue('region', e.target.value)}
            placeholder="e.g. Mashonaland West, Midlands"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          />
        </Field>

        <Field label="Primary Site Manager / Operator" required error={form.errors.primaryOperatorName}>
          <input
            type="text"
            value={form.values.primaryOperatorName}
            onChange={(e) => form.setValue('primaryOperatorName', e.target.value)}
            placeholder="e.g. John K."
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          />
        </Field>
      </div>
    </FormSheet>
  );
};

