import React from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { useForm } from '../../hooks/useForm.ts';
import { validators } from '../../utils/validation.ts';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import type { OrgMember, Role, MemberApprovalStatus } from '../../types/agro.ts';

export interface MemberRoleSheetProps {
  isOpen: boolean;
  onClose: () => void;
  member: OrgMember;
  activeMember: OrgMember;
  onUpdated?: () => void;
}

export const MemberRoleSheet: React.FC<MemberRoleSheetProps> = ({
  isOpen,
  onClose,
  member,
  activeMember,
  onUpdated,
}) => {
  const { showToast } = useToast();
  const locations = dataService.getState().locations.filter(
    (l) => !activeMember.orgId || l.orgId === activeMember.orgId
  );

  const form = useForm({
    initial: {
      role: member.role,
      approvalStatus: member.approvalStatus || 'APPROVED',
      assignedLocationId: member.assignedLocationId || '',
      note: '',
    },
    validate: (values) => ({
      note: validators.minAuditNote(values.note, 4),
    }),
    onSubmit: async (values) => {
      try {
        await dataService.adminUpdateMemberRoleAndAccess({
          targetMemberId: member.id,
          role: values.role as Role,
          approvalStatus: values.approvalStatus as MemberApprovalStatus,
          assignedLocationId: values.assignedLocationId || undefined,
          note: values.note.trim(),
          actor: activeMember,
        });

        showToast({
          type: 'success',
          title: 'Member Updated',
          message: `${member.fullName}'s role and clearance permissions updated.`,
        });
        onUpdated?.();
        onClose();
      } catch (err: any) {
        showToast({
          type: 'error',
          title: 'Update Failed',
          message: err?.message || 'Could not update member role.',
        });
      }
    },
  });

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Member Role & Clearances"
      subtitle={`Configure privileges for ${member.fullName}`}
      isSubmitting={form.isSubmitting}
      submitLabel="Apply Role Changes"
      onSubmit={form.handleSubmit}
      maxHeight="88dvh"
    >
      <div className="space-y-4">
        <Field label="System Role" required>
          <select
            value={form.values.role}
            onChange={(e) => form.setValue('role', e.target.value as Role)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          >
            <option value="MEMBER">Member (Investor - Portfolio & Read-Only)</option>
            <option value="GROUND_OPERATOR">Ground Operator (Farm / Warehouse Logging)</option>
            <option value="TREASURER">Treasurer (Multi-Sig, Approvals & Financials)</option>
            <option value="ORG_ADMIN">Organization Admin (Full Governance)</option>
          </select>
        </Field>

        <Field label="Membership Status" required>
          <select
            value={form.values.approvalStatus}
            onChange={(e) => form.setValue('approvalStatus', e.target.value as MemberApprovalStatus)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          >
            <option value="APPROVED">✅ Active / Approved</option>
            <option value="PENDING_CLEARANCE">⏳ Pending Clearance</option>
            <option value="SUSPENDED">🚫 Suspended (Access Revoked)</option>
          </select>
        </Field>

        <Field label="Assigned Location Site">
          <select
            value={form.values.assignedLocationId}
            onChange={(e) => form.setValue('assignedLocationId', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          >
            <option value="">All Locations (Enterprise Wide)</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Mandatory Audit Justification"
          required
          error={form.errors.note}
          hint="Role and clearance modifications require minimum 4 characters explanation."
        >
          <textarea
            rows={2}
            value={form.values.note}
            onChange={(e) => form.setValue('note', e.target.value)}
            placeholder="e.g. Promoted to Treasurer following executive committee resolution"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          />
        </Field>
      </div>
    </FormSheet>
  );
};

