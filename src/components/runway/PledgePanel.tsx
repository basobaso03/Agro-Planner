import React, { useState } from 'react';
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
  const [pledgeAmount, setPledgeAmount] = useState<string>('');
  const [instalmentPlan, setInstalmentPlan] = useState<string>('LUMP_SUM');
  const [pledgeNote, setPledgeNote] = useState<string>('');
  const [selectedMemberId, setSelectedMemberId] = useState<string>(currentMember.id);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [selectedPledgeHistory, setSelectedPledgeHistory] = useState<RunwayPledge | null>(null);

  const canPledge = PERMISSIONS.canPledge(currentMember.role);
  const isAdminOrTreasurer = currentMember.role === 'ORG_ADMIN' || currentMember.role === 'TREASURER';

  // Find user's current pledge
  const myPledge = pledges.find((p) => p.planId === plan.id && p.memberId === currentMember.id);

  // Compute total paid by member toward this plan
  const myContributions = contributions
    .filter((c) => c.runwayPlanId === plan.id && c.memberId === currentMember.id)
    .reduce((acc, c) => (c.direction === 'CONTRA_REVERSAL' ? acc - Math.abs(c.amount) : acc + c.amount), 0);

  // Fair share split suggestions
  const fairShareSuggestions = suggestPledgeSplit(layers.memberTarget, members);

  const handlePledgeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(pledgeAmount);
    if (!amount || amount <= 0) return;

    onPledge({
      memberId: isAdminOrTreasurer ? selectedMemberId : currentMember.id,
      amount,
      instalmentPlan,
      note: pledgeNote.trim() || undefined,
    });

    setPledgeAmount('');
    setPledgeNote('');
  };

  const isLockedOrActive = plan.status === 'PLEDGING' || plan.status === 'ACTIVE';

  return (
    <div className="space-y-6">
      {/* Pledge Hero Stats Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs">
        <div>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            Total Pledged
          </span>
          <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mt-0.5">
            <CountUp value={layers.pledged} />
          </div>
          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
            {layers.pledgedPct}% of Target
          </span>
        </div>

        <div>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            Cash Paid In
          </span>
          <div className="text-lg sm:text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
            <CountUp value={layers.collected} />
          </div>
          <span className="text-[11px] text-indigo-500 font-medium">
            {layers.collectedPct}% Collected
          </span>
        </div>

        <div>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            Commitment Gap
          </span>
          <div className="text-lg sm:text-xl font-bold text-rose-600 dark:text-rose-400 mt-0.5">
            <CountUp value={layers.gap} />
          </div>
          <span className="text-[11px] text-gray-400">Remaining to pledge</span>
        </div>

        <div>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            Active Pledgers
          </span>
          <div className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
            {pledges.length} / {members.length}
          </div>
          <span className="text-[11px] text-gray-400">Participating members</span>
        </div>
      </div>

      {/* Member's Personal Pledge Card */}
      {canPledge && isLockedOrActive && !readOnly && (
        <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/50 dark:from-indigo-950/40 dark:via-gray-900 dark:to-purple-950/20 border border-indigo-200 dark:border-indigo-900/50 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                {myPledge ? 'Update Your Pledge Commitment' : 'Add Your Capital Pledge'}
              </h4>
            </div>

            {myPledge && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300">
                Current: ${myPledge.amount.toFixed(2)} (${myContributions.toFixed(2)} paid)
              </span>
            )}
          </div>

          <form onSubmit={handlePledgeSubmit} className="space-y-3">
            {/* If Admin/Treasurer, allow pledging for member */}
            {isAdminOrTreasurer && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Pledging on Behalf of Member:
                </label>
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-medium"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.role})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Fair Share Quick Pick Chips */}
            {fairShareSuggestions.length > 0 && (
              <div>
                <span className="text-[11px] font-semibold text-gray-500 mb-1 block">
                  Quick Select Suggested Fair Share:
                </span>
                <div className="flex flex-wrap gap-2">
                  {fairShareSuggestions.slice(0, 4).map((s) => {
                    const m = members.find((mem) => mem.id === s.memberId);
                    return (
                      <button
                        key={s.memberId}
                        type="button"
                        onClick={() => setPledgeAmount(s.amount.toString())}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 transition-colors cursor-pointer"
                      >
                        {m?.fullName || 'Member'}: ${s.amount.toFixed(0)} (fair share)
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Pledge Amount ($) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={pledgeAmount}
                  onChange={(e) => setPledgeAmount(e.target.value)}
                  placeholder={myPledge ? myPledge.amount.toString() : 'e.g. 500'}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-bold text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Pay-In Cadence
                </label>
                <select
                  value={instalmentPlan}
                  onChange={(e) => setInstalmentPlan(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-semibold text-gray-900 dark:text-white"
                >
                  <option value="LUMP_SUM">Single Full Pay-in</option>
                  <option value="WEEKLY">Weekly Instalments</option>
                  <option value="BI_WEEKLY">Bi-Weekly Instalments</option>
                  <option value="MONTHLY">Monthly Contributions</option>
                </select>
              </div>
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
                className="w-full px-3.5 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{myPledge ? 'Confirm Updated Pledge' : 'Submit Capital Pledge'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Roster of Pledgers */}
      <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h4 className="text-sm font-bold text-gray-900 dark:text-white">
              Member Pledge Roster ({pledges.length})
            </h4>
          </div>
        </div>

        {pledges.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500 dark:text-gray-400">
            No pledges recorded yet. When members pledge, their commitments and pay-in progress appear here.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800/80">
            {pledges.map((p) => {
              const mem = members.find((m) => m.id === p.memberId);
              const paid = contributions
                .filter((c) => c.runwayPlanId === plan.id && c.memberId === p.memberId)
                .reduce((acc, c) => (c.direction === 'CONTRA_REVERSAL' ? acc - Math.abs(c.amount) : acc + c.amount), 0);
              const pct = p.amount > 0 ? Math.min(100, Math.round((paid / p.amount) * 100)) : 0;

              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3.5 sm:p-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors gap-3"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center font-bold text-xs text-indigo-700 dark:text-indigo-300 shrink-0">
                      {(p.memberName || mem?.fullName || 'M').slice(0, 2).toUpperCase()}
                    </div>

                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                          {p.memberName || mem?.fullName || 'Member'}
                        </span>
                        {mem?.role && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 uppercase">
                            {mem.role}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>Pledged: ${p.amount.toFixed(2)}</span>
                        <span>•</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                          ${paid.toFixed(2)} paid ({pct}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: History & Actions */}
                  <div className="flex items-center space-x-2">
                    {p.history && p.history.length > 0 && (
                      <button
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

                    {pct >= 100 ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-500" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* History Modal */}
      {showHistoryModal && selectedPledgeHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                Pledge Modification History ({selectedPledgeHistory.memberName})
              </h4>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 rounded text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
              {selectedPledgeHistory.history?.map((h, idx) => (
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
