import React from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { MoneyInput } from '../../components/ui/MoneyInput.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import type { OrgMember, Role } from '../../types/agro.ts';

export interface AddMemberSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeMember: OrgMember;
  onMemberAdded?: () => void;
}

export const AddMemberSheet: React.FC<AddMemberSheetProps> = ({
  isOpen,
  onClose,
  activeMember,
  onMemberAdded,
}) => {
  const { showToast } = useToast();
  const locations = dataService.getState().locations.filter(
    (l) => !activeMember.orgId || l.orgId === activeMember.orgId
  );

  const form = useForm({
    initial: {
      fullName: '',
      phoneOrEmail: '',
      role: 'MEMBER' as Role,
      assignedLocationId: locations[0]?.id || '',
      initialContribution: '',
      contributionNote: '',
    },
    validate: (values) => ({
      fullName: validators.required(values.fullName, 'Full name'),
      phoneOrEmail: validators.contact(values.phoneOrEmail),
      contributionNote:
        parseFloat(values.initialContribution || '0') > 0
          ? validators.minAuditNote(values.contributionNote, 4)
          : null,
    }),
    onSubmit: async (values) => {
      try {
        const initAmt = parseFloat(values.initialContribution || '0');
        dataService.addMember({
          fullName: values.fullName.trim(),
          phoneOrEmail: values.phoneOrEmail.trim(),
          role: values.role,
          assignedLocationId: values.assignedLocationId || undefined,
          initialContributionUsd: initAmt > 0 ? initAmt : undefined,
          contributionNote: initAmt > 0 ? values.contributionNote.trim() : undefined,
          actor: activeMember,
        });

        showToast({
          type: 'success',
          title: 'Member Added',
          message: `${values.fullName} is now registered in the organization.`,
        });
        onMemberAdded?.();
        onClose();
      } catch (err: any) {
        showToast({
          type: 'error',
          title: 'Failed to Add Member',
          message: err?.message || 'Could not register member.',
        });
      }
    },
  });

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Member"
      subtitle="Register an equity partner, operator, or executive"
      isSubmitting={form.isSubmitting}
      submitLabel="Register Member"
      onSubmit={form.handleSubmit}
      maxHeight="88dvh"
    >
      <div className="space-y-4">
        <Field label="Full Name" required error={form.errors.fullName}>
          <input
            type="text"
            value={form.values.fullName}
            onChange={(e) => form.setValue('fullName', e.target.value)}
            placeholder="e.g. Tendai Moyo"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          />
        </Field>

        <Field label="Phone or Email" required error={form.errors.phoneOrEmail}>
          <input
            type="text"
            value={form.values.phoneOrEmail}
            onChange={(e) => form.setValue('phoneOrEmail', e.target.value)}
            placeholder="e.g. +263 77 123 4567 or member@example.com"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Assigned Role" required>
            <select
              value={form.values.role}
              onChange={(e) => form.setValue('role', e.target.value as Role)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            >
              <option value="MEMBER">Member (Investor)</option>
              <option value="GROUND_OPERATOR">Ground Operator</option>
              <option value="TREASURER">Treasurer</option>
              <option value="ORG_ADMIN">Organization Admin</option>
            </select>
          </Field>

          <Field label="Primary Site">
            <select
              value={form.values.assignedLocationId}
              onChange={(e) => form.setValue('assignedLocationId', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
            >
              <option value="">All Locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Initial Capital Deposit (Optional)
          </div>

          <Field label="Opening Contribution (USD)">
            <MoneyInput
              value={form.values.initialContribution}
              onChange={(val) => form.setValue('initialContribution', val)}
              placeholder="0.00"
            />
          </Field>

          {parseFloat(form.values.initialContribution || '0') > 0 && (
            <Field
              label="Deposit Audit Note"
              required
              error={form.errors.contributionNote}
              hint="Required note for pool ledger recording."
            >
              <input
                type="text"
                value={form.values.contributionNote}
                onChange={(e) => form.setValue('contributionNote', e.target.value)}
                placeholder="e.g. Bank transfer ref #TX-8910"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
              />
            </Field>
          )}
        </div>
      </div>
    </FormSheet>
  );
};

