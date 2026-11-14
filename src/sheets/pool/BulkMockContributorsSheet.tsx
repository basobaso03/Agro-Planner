import React, { useMemo, useState } from 'react';
import { FormSheet } from '../../components/ui/FormSheet.tsx';
import { Field } from '../../components/ui/Field.tsx';
import { dataService } from '../../services/dataService.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import type { OrgMember, Role } from '../../types/agro.ts';
import { Copy, Plus, Trash2, CheckCircle2 } from 'lucide-react';

export interface BulkMockContributorsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeMember: OrgMember;
  defaultPlanId?: string;
  onCompleted?: () => void;
}

interface DraftRow {
  key: string;
  fullName: string;
  phone: string;
  paidAmount: string;
  pledgeAmount: string;
  role: Role;
  assignedLocationId: string;
}

export const BulkMockContributorsSheet: React.FC<BulkMockContributorsSheetProps> = ({
  isOpen,
  onClose,
  activeMember,
  defaultPlanId = '',
  onCompleted,
}) => {
  const { showToast } = useToast();
  const orgId = activeMember.orgId || dataService.getActiveOrgId() || '';
  const state = dataService.getState();
  const org =
    (state.organizations || []).find((o) => o.id === orgId) ||
    dataService.getActiveOrganization(orgId);
  const isAgro = dataService.isAgroOrganization(orgId);
  const locations = isAgro
    ? (state.locations || []).filter((l) => !orgId || l.orgId === orgId)
    : [];
  const runwayPlans = (state.runwayPlans || []).filter(
    (p) =>
      (!orgId || p.orgId === orgId) &&
      p.status !== 'COMPLETED' &&
      p.status !== 'ARCHIVED'
  );

  const createEmptyRow = (idx: number): DraftRow => ({
    key: `row-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
    fullName: '',
    phone: '',
    paidAmount: '',
    pledgeAmount: '',
    role: 'MEMBER',
    assignedLocationId: isAgro ? locations[0]?.id || '' : '',
  });

  const [selectedPlanId, setSelectedPlanId] = useState<string>(
    defaultPlanId || runwayPlans[0]?.id || ''
  );
  const [rows, setRows] = useState<DraftRow[]>([createEmptyRow(1), createEmptyRow(2)]);
  const [stickyError, setStickyError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdSummary, setCreatedSummary] = useState<
    Array<{ name: string; claimCode: string; paid: number; pledged: number }>
  >([]);
  const [copiedAll, setCopiedAll] = useState(false);

  const totals = useMemo(() => {
    let validCount = 0;
    let totalPaid = 0;
    let totalPledged = 0;
    for (const r of rows) {
      if (r.fullName.trim()) {
        validCount++;
        const p = parseFloat(r.paidAmount || '0');
        const pl = parseFloat(r.pledgeAmount || '0');
        if (!isNaN(p) && p > 0) totalPaid += p;
        if (!isNaN(pl) && pl > 0) totalPledged += pl;
      }
    }
    return { validCount, totalPaid, totalPledged };
  }, [rows]);

  const updateRow = (key: string, field: keyof DraftRow, value: string) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  };

  const handleAddRow = () => {
    setRows((prev) => [...prev, createEmptyRow(prev.length + 1)]);
  };

  const handleRemoveRow = (key: string) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((r) => r.key !== key));
  };

  const handleResetAndClose = () => {
    setCreatedSummary([]);
    setRows([createEmptyRow(1), createEmptyRow(2)]);
    setStickyError(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStickyError(null);
    const populated = rows.filter((r) => r.fullName.trim().length > 0);
    if (populated.length === 0) {
      setStickyError('Enter at least one contributor name to create mock accounts.');
      return;
    }

    const needsPlan = populated.some((r) => parseFloat(r.pledgeAmount || '0') > 0);
    if (needsPlan && !selectedPlanId) {
      setStickyError('Select a Runway Plan to attach the entered Runway pledges, or clear the pledge amounts.');
      return;
    }

    for (const r of populated) {
      const paid = parseFloat(r.paidAmount || '0');
      const pledge = parseFloat(r.pledgeAmount || '0');
      if (r.paidAmount && (isNaN(paid) || paid < 0)) {
        setStickyError(`Invalid paid amount for "${r.fullName}".`);
        return;
      }
      if (r.pledgeAmount && (isNaN(pledge) || pledge < 0)) {
        setStickyError(`Invalid pledge amount for "${r.fullName}".`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const result = dataService.addBulkPlaceholderMembers({
        defaultRunwayPlanId: selectedPlanId || undefined,
        entries: populated.map((r) => {
          const paid = parseFloat(r.paidAmount || '0');
          const pledge = parseFloat(r.pledgeAmount || '0');
          return {
            fullName: r.fullName.trim(),
            phone: r.phone.trim() || undefined,
            role: r.role,
            assignedLocationId: isAgro ? r.assignedLocationId || undefined : undefined,
            initialContributionUsd: paid > 0 ? paid : undefined,
            initialPledgeAmount: pledge > 0 ? pledge : undefined,
            runwayPlanId: selectedPlanId || undefined,
            targetContributionUsd: pledge > 0 ? pledge : paid > 0 ? paid : undefined,
          };
        }),
        actor: activeMember,
      });

      const summary = result.created.map(({ member, claimCode }, idx) => ({
        name: member.fullName,
        claimCode,
        paid: parseFloat(populated[idx]?.paidAmount || '0') || 0,
        pledged: parseFloat(populated[idx]?.pledgeAmount || '0') || 0,
      }));
      setCreatedSummary(summary);
      showToast({
        type: 'success',
        title: `${summary.length} Mock Accounts Created`,
        message: 'Pre-registered contributors, contributions, and pledges are live.',
      });
      onCompleted?.();
    } catch (err: any) {
      setStickyError(err?.message || 'Batch creation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyAllBundles = () => {
    const inviteCode = org?.currentInviteCode || 'INVITE-CODE';
    const lines = createdSummary.map(
      (s) =>
        `• ${s.name}: Org Code ${inviteCode} | Personal Claim Code: ${s.claimCode}${s.paid > 0 ? ` (Paid $${s.paid.toFixed(2)})` : ''}${s.pledged > 0 ? ` (Pledged $${s.pledged.toFixed(2)})` : ''}`
    );
    const msg = `${org?.name || 'Organization'} Onboarding & Claim Codes:\n${lines.join('\n')}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(msg);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
    }
  };

  if (createdSummary.length > 0) {
    return (
      <FormSheet
        isOpen={isOpen}
        onClose={handleResetAndClose}
        title="Mock Contributors Created"
        subtitle="Share Org Invite + Personal Claim Codes now or link manually when they join"
        submitLabel="Done"
        cancelLabel="Close"
        onSubmit={(e) => {
          e.preventDefault();
          handleResetAndClose();
        }}
        maxHeight="88dvh"
      >
        <div className="space-y-3">
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2 text-xs">
            <div>
              <p className="font-black text-emerald-950">
                {createdSummary.length} Placeholder Profiles Saved
              </p>
              <p className="text-emerald-800 font-medium">
                Org Invite Code: <span className="font-mono font-black">{org?.currentInviteCode || 'N/A'}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyAllBundles}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              {copiedAll ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAll ? 'Copied!' : 'Copy All Codes'}</span>
            </button>
          </div>

          <div className="space-y-2">
            {createdSummary.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE] flex items-center justify-between gap-2 text-xs"
              >
                <div>
                  <p className="font-black text-slate-950">{item.name}</p>
                  <p className="text-[11px] text-slate-600">
                    Paid: ${item.paid.toFixed(2)} · Pledged: ${item.pledged.toFixed(2)}
                  </p>
                </div>
                <span className="font-mono font-black text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg">
                  {item.claimCode}
                </span>
              </div>
            ))}
          </div>
        </div>
      </FormSheet>
    );
  }

  return (
    <FormSheet
      isOpen={isOpen}
      onClose={handleResetAndClose}
      title="Batch Add Unregistered Contributors"
      subtitle="Enter contributor names, cash already paid, and Runway pledges — no email needed"
      stickyError={stickyError}
      isSubmitting={isSubmitting}
      submitLabel={`Save ${totals.validCount || ''} Mock Account${totals.validCount === 1 ? '' : 's'}`.trim()}
      onSubmit={handleSubmit}
      maxHeight="90dvh"
    >
      <div className="space-y-4">
        {runwayPlans.length > 0 && (
          <Field label="Target Runway Plan (for Pledges & Plan Contributions)">
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#E0D7C6] bg-[#FAF8F5] text-slate-950 text-xs font-bold"
            >
              <option value="">Master Capital Pool Only (No Runway Plan)</option>
              {runwayPlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || p.title} ({p.status})
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="space-y-3">
          {rows.map((row, idx) => (
            <div
              key={row.key}
              className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                  Contributor #{idx + 1} · Unclaimed Mock
                </span>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveRow(row.key)}
                    className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                    title="Remove row"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={row.fullName}
                  onChange={(e) => updateRow(row.key, 'fullName', e.target.value)}
                  placeholder="Full Name * (e.g. Tendai Moyo)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-950 text-xs font-bold"
                />
                <input
                  type="text"
                  value={row.phone}
                  onChange={(e) => updateRow(row.key, 'phone', e.target.value)}
                  placeholder="Phone (Optional)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-950 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Paid Now ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.paidAmount}
                    onChange={(e) => updateRow(row.key, 'paidAmount', e.target.value)}
                    placeholder="0.00"
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-950 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Runway Pledge ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.pledgeAmount}
                    onChange={(e) => updateRow(row.key, 'pledgeAmount', e.target.value)}
                    placeholder="0.00"
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-950 text-xs font-mono font-bold"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Role</label>
                  <select
                    value={row.role}
                    onChange={(e) => updateRow(row.key, 'role', e.target.value as Role)}
                    className="w-full px-2 py-2 rounded-xl border border-slate-200 bg-white text-slate-950 text-xs font-bold"
                  >
                    <option value="MEMBER">Member</option>
                    <option value="TREASURER">Treasurer</option>
                    <option value="GROUND_OPERATOR">Ground Operator</option>
                    <option value="ORG_ADMIN">Org Admin</option>
                  </select>
                </div>
              </div>

              {isAgro && locations.length > 0 && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Farm Location</label>
                  <select
                    value={row.assignedLocationId}
                    onChange={(e) => updateRow(row.key, 'assignedLocationId', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-950 text-xs"
                  >
                    <option value="">All Locations</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleAddRow}
          className="w-full py-2.5 px-3 rounded-xl border border-dashed border-emerald-400 bg-emerald-50/70 hover:bg-emerald-50 text-emerald-900 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Another Contributor Row</span>
        </button>

        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs font-bold text-amber-950">
          <span>Batch Summary ({totals.validCount} named)</span>
          <span className="font-mono">
            Paid: ${totals.totalPaid.toFixed(2)} · Pledged: ${totals.totalPledged.toFixed(2)}
          </span>
        </div>
      </div>
    </FormSheet>
  );
};

