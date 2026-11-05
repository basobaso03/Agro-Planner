import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  PlusCircle,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  History,
  AlertCircle,
  X,
  Search,
  Filter,
  Edit3,
  Check,
  UserCheck,
  UserX,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import type { RunwayPlan, RunwayPledge, RunwayFundingLayers } from '../../types/runway';
import type { OrgMember, CapitalContributionEvent } from '../../types/agro';
import { suggestPledgeSplit } from '../../utils/runway';
import { PERMISSIONS } from '../../utils/permissions';
import { CountUp } from './CountUp';

interface PledgePanelProps {
  plan: RunwayPlan;
  pledges: RunwayPledge[];
  contributions: CapitalContributionEvent[];
  members: OrgMember[];
  currentMember: OrgMember;
  layers: RunwayFundingLayers;
  onPledge: (params: { memberId: string; amount: number; instalmentPlan?: string; note?: string }) => void;
  readOnly?: boolean;
}

type FilterStatus = 'ALL' | 'UNPLEDGED' | 'PLEDGED' | 'PAID';

const formatRole = (role?: string) => {
  if (!role) return '';
  return role
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export const PledgePanel: React.FC<PledgePanelProps> = ({
  plan,
  pledges,
  contributions,
  members,
  currentMember,
  layers,
  onPledge,
  readOnly = false,
}) => {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Quick inline pledge form state
  const [quickMemberId, setQuickMemberId] = useState<string>(currentMember.id);
  const [quickAmount, setQuickAmount] = useState<string>('');
  const [quickNote, setQuickNote] = useState<string>('');
  const [pledgeSuccessMsg, setPledgeSuccessMsg] = useState<string | null>(null);
  const [pledgeErrorMsg, setPledgeErrorMsg] = useState<string | null>(null);

  // Pledge modal state
  const [isPledgeModalOpen, setIsPledgeModalOpen] = useState<boolean>(false);
  const [selectedMember, setSelectedMember] = useState<OrgMember | null>(null);
  const [pledgeAmount, setPledgeAmount] = useState<string>('');
  const [instalmentPlan, setInstalmentPlan] = useState<string>('LUMP_SUM');
  const [pledgeNote, setPledgeNote] = useState<string>('');

  // History modal state
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [selectedPledgeHistory, setSelectedPledgeHistory] = useState<RunwayPledge | null>(null);

  const canPledge = PERMISSIONS.canPledge(currentMember.role);
  const isAdminOrTreasurer =
    currentMember.role === 'ORG_ADMIN' ||
    currentMember.role === 'SYNDICATE_ADMIN' ||
    currentMember.role === 'TREASURER';
  const isLockedOrActive = plan.status !== 'COMPLETED' && plan.status !== 'ARCHIVED';

  // Ensure currentMember is present in deduplicated org members list
  const activeMembers = useMemo(() => {
    const currentEmail = (currentMember.email || currentMember.phoneOrEmail || '').trim().toLowerCase();
    const list = [...members];
    const hasCurrent = list.some(
      (m) =>
        m.id === currentMember.id ||
        (currentMember.uid && m.uid === currentMember.uid) ||
        (currentEmail && (m.email || m.phoneOrEmail || '').trim().toLowerCase() === currentEmail)
    );
    if (!hasCurrent && currentMember.id) {
      list.unshift(currentMember);
    }
    return list;
  }, [members, currentMember]);

  // Fair share split suggestions
  const fairShareSuggestions = useMemo(() => {
    return suggestPledgeSplit(layers.memberTarget, activeMembers);
  }, [layers.memberTarget, activeMembers]);

  const defaultFairShare = useMemo(() => {
    return layers.memberTarget > 0 && activeMembers.length > 0
      ? Number((layers.memberTarget / activeMembers.length).toFixed(2))
      : 0;
  }, [layers.memberTarget, activeMembers]);

  useEffect(() => {
    if (activeMembers.length > 0 && !activeMembers.some((m) => m.id === quickMemberId)) {
      setQuickMemberId(activeMembers[0].id);
    }
  }, [activeMembers, quickMemberId]);

  useEffect(() => {
    const existing = pledges.find((p) => p.planId === plan.id && p.memberId === quickMemberId);
    const suggested = fairShareSuggestions.find((s) => s.memberId === quickMemberId)?.amount || defaultFairShare;
    if (existing && existing.amount > 0) {
      setQuickAmount(existing.amount.toString());
    } else if (suggested > 0) {
      setQuickAmount(suggested.toString());
    }
  }, [quickMemberId, pledges, plan.id, fairShareSuggestions, defaultFairShare]);

  // Aggregate each member's pledge, paid contributions, and status
  const memberPledgeData = useMemo(() => {
    const currentEmail = (currentMember.email || currentMember.phoneOrEmail || '').trim().toLowerCase();
    return activeMembers.map((m) => {
      const pledge = pledges.find((p) => p.planId === plan.id && p.memberId === m.id);
      const paid = contributions
        .filter((c) => c.runwayPlanId === plan.id && (c.memberId === m.id || (pledge && c.pledgeId === pledge.id)))
        .reduce((acc, c) => (c.direction === 'CONTRA_REVERSAL' ? acc - Math.abs(c.amount) : acc + c.amount), 0);

      const pledgedAmount = pledge?.amount || 0;
      const hasPledged = Boolean(pledge && pledge.amount > 0);
      const paidPct = pledgedAmount > 0 ? Math.min(100, Math.round((paid / pledgedAmount) * 100)) : 0;
      const fairShare = fairShareSuggestions.find((s) => s.memberId === m.id)?.amount || defaultFairShare;

      let status: 'UNPLEDGED' | 'FULLY_PAID' | 'PARTIALLY_PAID' | 'UNPAID';
      if (!hasPledged) {
        status = 'UNPLEDGED';
      } else if (paid >= pledgedAmount && pledgedAmount > 0) {
        status = 'FULLY_PAID';
      } else if (paid > 0) {
        status = 'PARTIALLY_PAID';
      } else {
        status = 'UNPAID';
      }

      const memEmail = (m.email || m.phoneOrEmail || '').trim().toLowerCase();
      const isCurrent =
        m.id === currentMember.id ||
        Boolean(currentMember.uid && m.uid === currentMember.uid) ||
        Boolean(currentEmail && memEmail === currentEmail);

      return {
        member: m,
        pledge,
        pledgedAmount,
        paid,
        paidPct,
        fairShare,
        hasPledged,
        status,
        isCurrent,
      };
    });
  }, [activeMembers, pledges, contributions, plan.id, fairShareSuggestions, defaultFairShare, currentMember]);

  // Counts for quick filter pills
  const counts = useMemo(() => {
    const unpledged = memberPledgeData.filter((d) => !d.hasPledged).length;
    const pledged = memberPledgeData.filter((d) => d.hasPledged).length;
    const paid = memberPledgeData.filter((d) => d.status === 'FULLY_PAID').length;
    return {
      all: memberPledgeData.length,
      unpledged,
      pledged,
      paid,
    };
  }, [memberPledgeData]);

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return memberPledgeData.filter((item) => {
      // Status filter
      if (filterStatus === 'UNPLEDGED' && item.hasPledged) return false;
      if (filterStatus === 'PLEDGED' && !item.hasPledged) return false;
      if (filterStatus === 'PAID' && item.status !== 'FULLY_PAID') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.member.fullName.toLowerCase().includes(q);
        const matchesRole = (item.member.role || '').toLowerCase().includes(q);
        return matchesName || matchesRole;
      }
      return true;
    });
  }, [memberPledgeData, filterStatus, searchQuery]);

  // Open modal to log or edit pledge
  const handleOpenPledgeModal = (mem: OrgMember) => {
    setSelectedMember(mem);
    const existing = pledges.find((p) => p.planId === plan.id && p.memberId === mem.id);
    const suggested = fairShareSuggestions.find((s) => s.memberId === mem.id)?.amount || defaultFairShare;

    if (existing) {
      setPledgeAmount(existing.amount.toString());
      setInstalmentPlan(existing.pace || 'LUMP_SUM');
    } else {
      setPledgeAmount(suggested > 0 ? suggested.toString() : '');
      setInstalmentPlan('LUMP_SUM');
    }
    setPledgeNote('');
    setIsPledgeModalOpen(true);
  };

  const handlePledgeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    const amount = parseFloat(pledgeAmount);
    if (!amount || amount <= 0) return;

    try {
      setPledgeErrorMsg(null);
      onPledge({
        memberId: selectedMember.id,
        amount,
        instalmentPlan,
        note: pledgeNote.trim() || undefined,
      });

      setPledgeSuccessMsg(
        `Saved pledge of $${amount.toFixed(2)} for ${selectedMember.fullName}.`
      );
      setTimeout(() => setPledgeSuccessMsg(null), 5000);
      setIsPledgeModalOpen(false);
      setSelectedMember(null);
      setPledgeAmount('');
      setPledgeNote('');
    } catch (err: any) {
      setPledgeErrorMsg(err.message || 'Unable to save pledge.');
    }
  };

  const handleQuickPledgeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetMem = activeMembers.find((m) => m.id === quickMemberId) || currentMember;
    const amount = parseFloat(quickAmount);
    if (!amount || amount <= 0) {
      setPledgeErrorMsg('Please enter a valid pledge amount greater than $0.00.');
      return;
    }

    try {
      setPledgeErrorMsg(null);
      onPledge({
        memberId: targetMem.id,
        amount,
        instalmentPlan: 'LUMP_SUM',
        note: quickNote.trim() || undefined,
      });
      setPledgeSuccessMsg(`Saved pledge of $${amount.toFixed(2)} for ${targetMem.fullName}.`);
      setQuickNote('');
      setTimeout(() => setPledgeSuccessMsg(null), 5000);
    } catch (err: any) {
      setPledgeErrorMsg(err.message || 'Unable to save member pledge.');
    }
  };

  // Find user's own pledge for quick highlight
  const myData = memberPledgeData.find((d) => d.isCurrent);
  const selectableMembers = isAdminOrTreasurer
    ? activeMembers
    : activeMembers.filter((m) => m.id === currentMember.id || myData?.member.id === m.id);

  return (
    <div className="space-y-6">
      {pledgeSuccessMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{pledgeSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setPledgeSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 shrink-0 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {pledgeErrorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{pledgeErrorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setPledgeErrorMsg(null)}
            className="text-rose-700 hover:text-rose-900 dark:text-rose-400 shrink-0 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Pledge Hero Stats Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-white border border-[#E8DFCE] shadow-xs">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Total Pledged
          </span>
          <div className="text-lg sm:text-xl font-black font-mono text-slate-950 mt-0.5">
            <CountUp value={layers.pledged} />
          </div>
          <span className="text-[11px] text-amber-700 font-bold">
            {layers.pledgedPct}% of Target
          </span>
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Cash Paid In
          </span>
          <div className="text-lg sm:text-xl font-black font-mono text-indigo-700 mt-0.5">
            <CountUp value={layers.collected} />
          </div>
          <span className="text-[11px] text-indigo-700 font-bold">
            {layers.collectedPct}% Collected
          </span>
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Commitment Gap
          </span>
          <div className="text-lg sm:text-xl font-black font-mono text-rose-600 mt-0.5">
            <CountUp value={layers.gap} />
          </div>
          <span className="text-[11px] text-slate-600 font-medium">Remaining to pledge</span>
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Team Participation
          </span>
          <div className="text-lg sm:text-xl font-black font-mono text-emerald-700 mt-0.5">
            {counts.pledged} / {counts.all}
          </div>
          <span className="text-[11px] text-slate-600 font-medium">
            {counts.all > 0 ? Math.round((counts.pledged / counts.all) * 100) : 0}% members pledged
          </span>
        </div>
      </div>

      {/* Direct Log Member Pledge Bar (on top of available members) */}
      {canPledge && isLockedOrActive && !readOnly && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-indigo-50/80 via-white to-purple-50/50 dark:from-indigo-950/40 dark:via-gray-900 dark:to-purple-950/20 border border-indigo-200/80 dark:border-indigo-900/50 shadow-xs space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 shadow-sm">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  Log Member Pledge Toward Target (${layers.memberTarget.toFixed(2)})
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Record the proposed amount each member can pay towards the cycle target.
                </p>
              </div>
            </div>
            {defaultFairShare > 0 && (
              <button
                type="button"
                onClick={() => setQuickAmount(defaultFairShare.toFixed(2))}
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline self-start sm:self-center cursor-pointer"
              >
                Use Fair Share (${defaultFairShare.toFixed(2)})
              </button>
            )}
          </div>

          <form onSubmit={handleQuickPledgeSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
            <div className="sm:col-span-4">
              <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Member <span className="text-rose-500">*</span>
              </label>
              <select
                value={quickMemberId}
                onChange={(e) => setQuickMemberId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#E8DFCE] bg-white text-xs font-bold text-slate-950"
              >
                {(selectableMembers.length > 0 ? selectableMembers : [currentMember]).map((m) => {
                  const existing = pledges.find((p) => p.planId === plan.id && p.memberId === m.id);
                  return (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({formatRole(m.role)}){existing ? ` — Pledged $${existing.amount.toFixed(2)}` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold text-slate-950 mb-1">
                Proposed Pledge ($) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                required
                value={quickAmount}
                onChange={(e) => setQuickAmount(e.target.value)}
                placeholder="e.g. 500.00"
                className="w-full px-3 py-2 rounded-xl border border-[#E8DFCE] bg-white text-xs font-mono font-black text-slate-950 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold text-slate-950 mb-1">
                Note (Optional)
              </label>
              <input
                type="text"
                value={quickNote}
                onChange={(e) => setQuickNote(e.target.value)}
                placeholder="e.g. Will pay in 2 instalments"
                className="w-full px-3 py-2 rounded-xl border border-[#E8DFCE] bg-white text-xs font-medium text-slate-950"
              />
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <PlusCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Save Pledge</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Roster of Organization Members */}
      <div className="rounded-2xl bg-white border border-[#E8DFCE] shadow-xs overflow-hidden">
        {/* Header & Filter Controls */}
        <div className="p-4 border-b border-[#F0EBE1] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <h4 className="text-sm font-black text-slate-950">
                Organization Member Pledges ({counts.pledged}/{counts.all})
              </h4>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setFilterStatus('ALL')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${filterStatus === 'ALL'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
              >
                All ({counts.all})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('UNPLEDGED')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${filterStatus === 'UNPLEDGED'
                  ? 'bg-amber-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
              >
                Unpledged ({counts.unpledged})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('PLEDGED')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${filterStatus === 'PLEDGED'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
              >
                Pledged ({counts.pledged})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('PAID')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${filterStatus === 'PAID'
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
              >
                Paid in Full ({counts.paid})
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search member by name or role..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 text-xs text-gray-900 dark:text-white focus:outline-indigo-500"
            />
          </div>
        </div>

        {/* Member Rows */}
        {filteredMembers.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500 dark:text-gray-400">
            No organization members match the selected filter.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800/80">
            {filteredMembers.map(({ member: mem, pledge: p, pledgedAmount, paid, paidPct, fairShare, hasPledged, status, isCurrent }) => {
              const canEditThisMember = (isAdminOrTreasurer || isCurrent) && isLockedOrActive && !readOnly;

              const statusBadgeConfig = {
                FULLY_PAID: {
                  label: 'Paid in Full',
                  bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
                  ring: 'ring-2 ring-emerald-500',
                  icon: CheckCircle2,
                },
                PARTIALLY_PAID: {
                  label: `Paid ${paidPct}%`,
                  bg: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
                  ring: 'ring-2 ring-indigo-500',
                  icon: Clock,
                },
                UNPAID: {
                  label: 'Pledged (Unpaid)',
                  bg: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
                  ring: 'ring-2 ring-amber-500',
                  icon: Clock,
                },
                UNPLEDGED: {
                  label: 'Not Pledged',
                  bg: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
                  ring: 'ring-1 ring-gray-300 dark:ring-gray-700',
                  icon: UserX,
                },
              };

              const badge = statusBadgeConfig[status];
              const BadgeIcon = badge.icon;

              return (
                <div
                  key={mem.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors gap-3"
                >
                  {/* Left: Avatar & Member Info */}
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div
                      className={`w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center font-bold text-xs text-indigo-700 dark:text-indigo-300 shrink-0 ${badge.ring}`}
                    >
                      {mem.fullName.slice(0, 2).toUpperCase()}
                    </div>

                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                          {mem.fullName}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 font-bold">
                            You
                          </span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 font-semibold">
                          {formatRole(mem.role)}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold flex items-center gap-0.5 ${badge.bg}`}>
                          <BadgeIcon className="w-3 h-3" />
                          <span>{badge.label}</span>
                        </span>
                      </div>

                      {/* Financial info row */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        {hasPledged ? (
                          <>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              Pledged: ${pledgedAmount.toFixed(2)}
                            </span>
                            <span>•</span>
                            <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                              ${paid.toFixed(2)} paid ({paidPct}%)
                            </span>
                          </>
                        ) : (
                          <span className="text-amber-700 dark:text-amber-400 font-medium">
                            No pledge logged • Suggested fair share: ~${fairShare.toFixed(0)}
                          </span>
                        )}
                      </div>

                      {/* Micro progress bar for pledged members */}
                      {hasPledged && (
                        <div className="w-full max-w-xs h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden mt-1">
                          <div
                            className={`h-full transition-all duration-500 ${paidPct >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'
                              }`}
                            style={{ width: `${paidPct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-800">
                    {p && p.history && p.history.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPledgeHistory(p);
                          setShowHistoryModal(true);
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
                        title="View pledge modification history"
                      >
                        <History className="w-4 h-4" />
                      </button>
                    )}

                    {canEditThisMember && (
                      <button
                        type="button"
                        onClick={() => handleOpenPledgeModal(mem)}
                        className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 ${hasPledged
                          ? 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          }`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{hasPledged ? 'Edit Pledge' : 'Log Pledge'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Log / Edit Pledge Modal */}
      {isPledgeModalOpen &&
        selectedMember &&
        createPortal(
          <div
            style={{
              top: 'var(--vvo, 0px)',
              height: 'var(--vvh, 100dvh)',
            }}
            className="fixed left-0 right-0 z-[100] flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-xs p-2.5 sm:p-4 animate-in fade-in overflow-hidden"
          >
            <div
              style={{
                maxHeight: 'calc(var(--vvh, 100dvh) - var(--sat, 0px) - 12px)',
              }}
              className="w-full max-w-md rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl p-4 sm:p-6 space-y-3.5 overflow-y-auto overscroll-contain"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-base font-bold text-gray-900 dark:text-white">
                    {selectedMember.id === currentMember.id
                      ? 'Commit Your Capital Pledge'
                      : `Log Pledge for ${selectedMember.fullName}`}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Role: <span className="font-semibold">{formatRole(selectedMember.role)}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPledgeModalOpen(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Fair share target banner */}
              <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-900/40 flex items-center justify-between text-xs">
                <span className="text-indigo-800 dark:text-indigo-300 font-medium">
                  Cycle Target Fair Share:
                </span>
                <span className="font-mono font-bold text-indigo-950 dark:text-indigo-100">
                  ${(fairShareSuggestions.find((s) => s.memberId === selectedMember.id)?.amount || defaultFairShare).toFixed(2)}
                </span>
              </div>

              <form onSubmit={handlePledgeSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Pledged Amount ($) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    required
                    value={pledgeAmount}
                    onChange={(e) => setPledgeAmount(e.target.value)}
                    placeholder="e.g. 500.00"
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-mono font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />

                  {/* Quick amount chips */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[
                      Number((fairShareSuggestions.find((s) => s.memberId === selectedMember.id)?.amount || defaultFairShare).toFixed(2)),
                      100,
                      250,
                      500,
                      1000,
                    ]
                      .filter((val, idx, self) => val > 0 && self.indexOf(val) === idx)
                      .map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setPledgeAmount(val.toString())}
                          className="px-2 py-0.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-[11px] font-semibold text-gray-700 dark:text-gray-300 hover:bg-indigo-50 hover:border-indigo-300 transition-colors cursor-pointer"
                        >
                          ${val}
                        </button>
                      ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Disbursement Cadence
                  </label>
                  <select
                    value={instalmentPlan}
                    onChange={(e) => setInstalmentPlan(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-semibold text-gray-900 dark:text-white"
                  >
                    <option value="LUMP_SUM">Single Full Pay-in</option>
                    <option value="WEEKLY">Weekly Instalments</option>
                    <option value="BI_WEEKLY">Bi-Weekly Instalments</option>
                    <option value="MONTHLY">Monthly Contributions</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Optional Commitment Note
                  </label>
                  <input
                    type="text"
                    value={pledgeNote}
                    onChange={(e) => setPledgeNote(e.target.value)}
                    placeholder="e.g. Will disburse via EcoCash after Friday harvest"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() => setIsPledgeModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer active:scale-95"
                  >
                    Save Pledge
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.getElementById('sheet-root') || document.body
        )}

      {/* History Modal */}
      {showHistoryModal && selectedPledgeHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                Pledge History ({selectedPledgeHistory.memberName})
              </h4>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="p-1 rounded text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-800 text-xs max-h-64 overflow-y-auto">
              {selectedPledgeHistory.history?.map((h: any, idx: number) => (
                <div key={idx} className="py-2.5 space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span
                      className={
                        h.type === 'INCREASE'
                          ? 'text-emerald-600'
                          : h.type === 'DECREASE'
                            ? 'text-rose-600'
                            : 'text-indigo-600'
                      }
                    >
                      {h.type}: ${h.previousAmount} → ${h.newAmount}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(h.timestamp || h.at).toLocaleDateString()}
                    </span>
                  </div>
                  {(h.reason || h.note) && <p className="text-gray-500">{h.reason || h.note}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
