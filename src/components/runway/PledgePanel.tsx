import React, { useState, useMemo } from 'react';
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
import { formatMoney, isPrivacyMasked } from '../../utils/currency';
import { BottomSheet } from '../ui/BottomSheet';

interface PledgePanelProps {
  plan: RunwayPlan;
  pledges: RunwayPledge[];
  contributions: CapitalContributionEvent[];
  members: OrgMember[];
  currentMember: OrgMember;
  layers: RunwayFundingLayers;
  onPledge: (params: { memberId: string; amount: number; instalmentPlan?: string; note?: string }) => void;
  readOnly?: boolean;
  showNumbers?: boolean;
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
  showNumbers,
}) => {
  const isMasked = showNumbers !== undefined ? !showNumbers : isPrivacyMasked();
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

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
  const handleOpenPledgeModal = (mem?: OrgMember) => {
    const target = mem || (selectableMembers.length > 0 ? selectableMembers[0] : currentMember);
    setSelectedMember(target);
    const existing = pledges.find((p) => p.planId === plan.id && p.memberId === target.id);
    const suggested = fairShareSuggestions.find((s) => s.memberId === target.id)?.amount || defaultFairShare;

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
            <CountUp value={layers.pledged} showNumbers={!isMasked} />
          </div>
          <span className="text-[11px] text-amber-700 font-bold">
            {isMasked ? '••% of Target' : `${layers.pledgedPct}% of Target`}
          </span>
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Cash Paid In
          </span>
          <div className="text-lg sm:text-xl font-black font-mono text-indigo-700 mt-0.5">
            <CountUp value={layers.collected} showNumbers={!isMasked} />
          </div>
          <span className="text-[11px] text-indigo-700 font-bold">
            {isMasked ? '••% Collected' : `${layers.collectedPct}% Collected`}
          </span>
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Commitment Gap
          </span>
          <div className="text-lg sm:text-xl font-black font-mono text-rose-600 mt-0.5">
            <CountUp value={layers.gap} showNumbers={!isMasked} />
          </div>
          <span className="text-[11px] text-slate-600 font-medium">Remaining to pledge</span>
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Team Participation
          </span>
          <div className="text-lg sm:text-xl font-black font-mono text-emerald-700 mt-0.5">
            {isMasked ? '•• / ••' : `${counts.pledged} / ${counts.all}`}
          </div>
          <span className="text-[11px] text-slate-600 font-medium">
            {isMasked ? '••% members pledged' : `${counts.all > 0 ? Math.round((counts.pledged / counts.all) * 100) : 0}% members pledged`}
          </span>
        </div>
      </div>

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

            <div className="flex items-center gap-2">
              {canPledge && isLockedOrActive && !readOnly && (
                <button
                  type="button"
                  onClick={() => handleOpenPledgeModal()}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Log Member Pledge</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">

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
                  label: isMasked ? 'Paid ••%' : `Paid ${paidPct}%`,
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
                              Pledged: {formatMoney(pledgedAmount, !isMasked)}
                            </span>
                            <span>•</span>
                            <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                              {formatMoney(paid, !isMasked)} paid ({isMasked ? '••%' : `${paidPct}%`})
                            </span>
                          </>
                        ) : (
                          <span className="text-amber-700 dark:text-amber-400 font-medium">
                            No pledge logged • Suggested fair share: ~{formatMoney(fairShare, !isMasked)}
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

      {/* Log / Edit Pledge Bottom Sheet */}
      {isPledgeModalOpen && selectedMember && (
        <BottomSheet
          isOpen={isPledgeModalOpen}
          onClose={() => setIsPledgeModalOpen(false)}
          title={
            selectedMember.id === currentMember.id
              ? 'Commit Your Capital Pledge'
              : `Log Pledge for ${selectedMember.fullName}`
          }
          subtitle={`Plan Target: ${formatMoney(layers.memberTarget, !isMasked)} · Suggested Fair Share: ~${formatMoney(defaultFairShare, !isMasked)}`}
          size="auto"
          maxHeight="min(82vh, 580px)"
        >
          <div className="p-4 sm:p-5 space-y-3.5">
            {/* Member selector if user is Admin / Treasurer */}
            {isAdminOrTreasurer && selectableMembers.length > 1 && (
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Pledging Member <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedMember.id}
                  onChange={(e) => {
                    const found = selectableMembers.find((m) => m.id === e.target.value);
                    if (found) handleOpenPledgeModal(found);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8DFCE] bg-white text-xs font-bold text-slate-950 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  {selectableMembers.map((m) => {
                    const ex = pledges.find((p) => p.planId === plan.id && p.memberId === m.id);
                    return (
                      <option key={m.id} value={m.id} className="bg-white text-slate-900 font-semibold py-1">
                        {m.fullName} ({formatRole(m.role)}){ex ? ` — Pledged ${formatMoney(ex.amount, !isMasked)}` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Fair share target banner */}
            <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200/60 flex items-center justify-between text-xs">
              <span className="text-indigo-900 font-semibold">
                Suggested Cycle Fair Share:
              </span>
              <span className="font-mono font-bold text-indigo-950">
                {formatMoney(
                  fairShareSuggestions.find((s) => s.memberId === selectedMember.id)?.amount || defaultFairShare,
                  !isMasked
                )}
              </span>
            </div>

            <form onSubmit={handlePledgeSubmit} className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-900">
                    Pledged Amount ($) <span className="text-rose-500">*</span>
                  </label>
                  {defaultFairShare > 0 && (
                    <button
                      type="button"
                      disabled={isMasked}
                      onClick={() => setPledgeAmount(defaultFairShare.toFixed(2))}
                      className="text-[11px] font-bold text-indigo-700 hover:underline cursor-pointer disabled:opacity-50"
                    >
                      Use Fair Share ({formatMoney(defaultFairShare, !isMasked)})
                    </button>
                  )}
                </div>
                <input
                  type={isMasked ? 'password' : 'number'}
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  placeholder={isMasked ? '••••' : 'e.g. 500.00'}
                  value={isMasked ? '••••' : pledgeAmount}
                  disabled={isMasked}
                  required
                  autoFocus
                  onChange={(e) => setPledgeAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8DFCE] bg-white text-sm font-mono font-bold text-slate-950 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
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
                        className="px-2.5 py-1 rounded-lg border border-[#E8DFCE] bg-[#FAF8F5] text-xs font-bold text-slate-800 hover:bg-indigo-50 hover:border-indigo-300 transition-colors cursor-pointer"
                      >
                        ${val}
                      </button>
                    ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Disbursement Cadence
                </label>
                <select
                  value={instalmentPlan}
                  onChange={(e) => setInstalmentPlan(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8DFCE] bg-white text-xs font-bold text-slate-950 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="LUMP_SUM" className="bg-white text-slate-900 font-semibold py-1">Single Full Pay-in</option>
                  <option value="WEEKLY" className="bg-white text-slate-900 font-semibold py-1">Weekly Instalments</option>
                  <option value="BI_WEEKLY" className="bg-white text-slate-900 font-semibold py-1">Bi-Weekly Instalments</option>
                  <option value="MONTHLY" className="bg-white text-slate-900 font-semibold py-1">Monthly Contributions</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Optional Commitment Note
                </label>
                <input
                  type="text"
                  value={pledgeNote}
                  onChange={(e) => setPledgeNote(e.target.value)}
                  placeholder="e.g. Will disburse via EcoCash after Friday harvest"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8DFCE] bg-white text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-[#F0EBE1]">
                <button
                  type="button"
                  onClick={() => setIsPledgeModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer active:scale-95"
                >
                  Save Pledge
                </button>
              </div>
            </form>
          </div>
        </BottomSheet>
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
                      {h.type}: {formatMoney(h.previousAmount, !isMasked)} → {formatMoney(h.newAmount, !isMasked)}
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
