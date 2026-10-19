import React, { useState } from 'react';
import {
  UserPlus,
  DollarSign,
  RotateCcw,
  Calculator,
  ShieldCheck,
  ShieldAlert,
  Lock,
  X,
} from 'lucide-react';
import type {
  CapitalContributionEvent,
  FarmLocation,
  FinancialSummary,
  MemberEquitySummary,
  Role,
  SyndicateMember,
} from '../types/agro.ts';
import { computeDividendDistribution } from '../utils/calculations.ts';
import { PERMISSIONS, maskContact } from '../utils/permissions.ts';

interface PoolEquityTabProps {
  memberEquities: MemberEquitySummary[];
  capitalContributions: CapitalContributionEvent[];
  financials: FinancialSummary;
  locations: FarmLocation[];
  activeMember: SyndicateMember;
  onAddMember: (data: {
    fullName: string;
    phoneOrEmail: string;
    role: Role;
    assignedLocationId?: string;
    initialContributionUsd?: number;
    contributionNote?: string;
  }) => void;
  onLogContribution: (data: {
    memberId: string;
    direction: 'ADDITION' | 'CONTRA_REVERSAL';
    amount: number;
    referenceTransactionId?: string;
    note: string;
  }) => void;
  showNumbers?: boolean;
}

export const PoolEquityTab: React.FC<PoolEquityTabProps> = ({
  memberEquities,
  capitalContributions,
  financials,
  locations,
  activeMember,
  onAddMember,
  onLogContribution,
  showNumbers = true,
}) => {
  const [simulatedProfit, setSimulatedProfit] = useState('2500');

  // Add Member Modal State
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [memName, setMemName] = useState('');
  const [memContact, setMemContact] = useState('');
  const [memRole, setMemRole] = useState<Role>('REMOTE_INVESTOR');
  const [memLocationId, setMemLocationId] = useState('');
  const [memInitDeposit, setMemInitDeposit] = useState('500');
  const [memNote, setMemNote] = useState('');
  const [memError, setMemError] = useState('');

  // Log Contribution / Contra Modal State
  const [contribModal, setContribModal] = useState<{
    mode: 'ADDITION' | 'CONTRA_REVERSAL';
    defaultMemberId: string;
    defaultRefId?: string;
  } | null>(null);
  const [cMemberId, setCMemberId] = useState('');
  const [cAmount, setCAmount] = useState('250');
  const [cContraSign, setCContraSign] = useState<'DEDUCT' | 'ADD'>('DEDUCT');
  const [cRefId, setCRefId] = useState('');
  const [cNote, setCNote] = useState('');
  const [cError, setCError] = useState('');

  const payouts = computeDividendDistribution(
    parseFloat(simulatedProfit) || 0,
    memberEquities
  );

  const handleAddMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (memName.trim().length < 2 || memContact.trim().length < 3) {
      setMemError('Please enter the member full name and phone/email.');
      return;
    }
    const initUsd = parseFloat(memInitDeposit) || 0;
    onAddMember({
      fullName: memName.trim(),
      phoneOrEmail: memContact.trim(),
      role: memRole,
      assignedLocationId: memLocationId || undefined,
      initialContributionUsd: initUsd > 0 ? initUsd : undefined,
      contributionNote:
        memNote.trim() || `Initial syndicate equity contribution by ${memName.trim()}`,
    });
    setMemName('');
    setMemContact('');
    setMemNote('');
    setMemError('');
    setShowAddMemberModal(false);
  };

  const handleOpenContribModal = (
    mode: 'ADDITION' | 'CONTRA_REVERSAL',
    memberId: string
  ) => {
    const memberContribs = capitalContributions.filter((c) => c.memberId === memberId);
    setContribModal({ mode, defaultMemberId: memberId });
    setCMemberId(memberId);
    setCAmount('200');
    setCContraSign('DEDUCT');
    setCRefId(memberContribs[0]?.id || capitalContributions[0]?.id || 'TX-CAP-001');
    setCNote('');
    setCError('');
  };

  const handleContribSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contribModal) return;
    const rawAmt = parseFloat(cAmount);
    if (isNaN(rawAmt) || rawAmt <= 0) {
      setCError('Please enter a valid positive dollar amount.');
      return;
    }
    if (cNote.trim().length < 4) {
      setCError('Mandatory explanation note (min 4 chars) is required.');
      return;
    }

    const signedAmount =
      contribModal.mode === 'CONTRA_REVERSAL'
        ? cContraSign === 'DEDUCT'
          ? -Math.abs(rawAmt)
          : Math.abs(rawAmt)
        : Math.abs(rawAmt);

    onLogContribution({
      memberId: cMemberId,
      direction: contribModal.mode,
      amount: signedAmount,
      referenceTransactionId:
        contribModal.mode === 'CONTRA_REVERSAL' ? cRefId : undefined,
      note: cNote.trim(),
    });
    setContribModal(null);
  };

  // Role-Based Access Guard for Ground Operators
  if (!PERMISSIONS.canViewCapitalPoolTab(activeMember.role)) {
    return (
      <div className="rounded-3xl bg-white border border-[#E8DFCE] p-8 text-center space-y-4 max-w-lg mx-auto my-12 shadow-md">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-slate-900">Access Restricted · Syndicate Capital Pool</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            The Capital Pool Ledger and Member Equity records are restricted to Syndicate Investors and Executive Leadership. Field operators manage flock feeds, weigh-ins, and site receipts directly via the Livestock and Expenses tabs.
          </p>
        </div>
        <div className="pt-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-full bg-[#FAF8F5] border border-[#E8DFCE] text-slate-700">
            <Lock className="w-3.5 h-3.5 text-amber-600" />
            Active Role: {activeMember.role.replace(/_/g, ' ')} ({activeMember.fullName})
          </span>
        </div>
      </div>
    );
  }

  const canManageMembers = PERMISSIONS.canManageMembers(activeMember.role);
  const canLogCapital = PERMISSIONS.canLogCapitalDeposit(activeMember.role);
  const canPostContra = PERMISSIONS.canPostContraReversals(activeMember.role);
  const canViewUnmasked = PERMISSIONS.canViewUnmaskedPII(activeMember.role);

  return (
    <div className="space-y-5 pb-6">
      {/* 1. SYNDICATE CAPITAL POOL SUMMARY */}
      <section className="solora-card rounded-3xl p-4 sm:p-6 bg-white border border-[#E8DFCE] shadow-[0_12px_36px_-6px_rgba(217,119,6,0.06)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-slate-500">Master Syndicate Capital Pool</p>
              {!canManageMembers && (
                <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                  Investor View
                </span>
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-slate-900 mt-0.5">
              {!showNumbers ? '••••••••' : `$${financials.totalSyndicatePool.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canManageMembers && (
              <button
                type="button"
                onClick={() => setShowAddMemberModal(true)}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-[#E0D7C6] text-xs font-semibold text-slate-800 flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
                Add New Member
              </button>
            )}
            {canLogCapital && (
              <button
                type="button"
                onClick={() =>
                  handleOpenContribModal('ADDITION', memberEquities[0]?.member.id || 'mem-chipo')
                }
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <DollarSign className="w-3.5 h-3.5" />
                Log Contribution
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[#F0EBE1] text-xs">
          <div className="bg-[#FAF8F5] p-3 rounded-2xl border border-[#E8DFCE]">
            <p className="text-[11px] font-medium text-slate-500">Active Syndicate Partners</p>
            <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">
              {!showNumbers ? '••' : memberEquities.length} Members
            </p>
          </div>
          <div className="bg-[#FAF8F5] p-3 rounded-2xl border border-[#E8DFCE]">
            <p className="text-[11px] font-medium text-slate-500">Available Left Money</p>
            <p className="font-mono font-bold text-emerald-700 text-sm mt-0.5">
              {!showNumbers ? '••••••••' : `$${financials.leftMoney.toFixed(2)}`}
            </p>
          </div>
          <div className="bg-[#FAF8F5] p-3 rounded-2xl border border-[#E8DFCE]">
            <p className="text-[11px] font-medium text-slate-500">Total Implied Net Worth (NAV)</p>
            <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">
              {!showNumbers ? '••••••••' : `$${financials.totalSyndicateNav.toFixed(2)}`}
            </p>
          </div>
        </div>
      </section>

      {/* 2. INTERACTIVE PROFIT PAYOUT CALCULATOR */}
      <section className="rounded-3xl bg-[#FAF8F5] border border-[#E8DFCE] p-4 sm:p-5 space-y-3.5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Interactive Profit Payout & Dividend Simulator
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-mono">Pro-Rata by Net Contribution %</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label htmlFor="profit-sim-input" className="text-xs text-slate-700 font-medium whitespace-nowrap">
            Hypothetical or Actual Profit to Distribute ($):
          </label>
          <input
            id="profit-sim-input"
            type="number"
            min="0"
            step="50"
            value={simulatedProfit}
            onChange={(e) => setSimulatedProfit(e.target.value)}
            className="w-full sm:w-48 bg-white border border-[#E0D7C6] rounded-xl px-3.5 py-2 text-sm font-bold font-mono text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          {payouts.map((p) => (
            <div
              key={p.memberId}
              className="rounded-xl bg-white border border-[#E8DFCE] p-3 space-y-1 shadow-xs"
            >
              <p className="text-xs font-bold text-slate-900 truncate">{p.memberName}</p>
              <p className="text-[11px] font-mono text-slate-500">
                Share: {!showNumbers ? '••%' : `${p.sharePercent.toFixed(2)}%`}
              </p>
              <p className="text-sm font-bold font-mono tabular-nums text-emerald-700">
                {!showNumbers ? '••••••••' : `$${p.payoutUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. MEMBER EQUITY CARDS */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">Member Stakes & Profit Split</h2>
            <p className="text-xs text-slate-500">Ownership shares and dividend allocations across syndicate partners</p>
          </div>
          <span className="text-xs font-mono font-semibold text-slate-600 bg-white border border-[#E8DFCE] px-2.5 py-1 rounded-full shadow-xs">
            {memberEquities.length} Active Partners
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {memberEquities.map((eq) => {
            const assignedLoc = locations.find(
              (l) => l.id === eq.member.assignedLocationId
            );

            const isCurrentViewer = eq.member.id === activeMember.id;
            const contactDisplay = maskContact(eq.member.phoneOrEmail, canViewUnmasked);

            return (
              <div
                key={eq.member.id}
                className={`rounded-2xl border p-4 sm:p-5 flex flex-col justify-between gap-3.5 transition-all shadow-xs ${
                  isCurrentViewer
                    ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-md shadow-emerald-950/5'
                    : 'bg-white border-[#E8DFCE] hover:border-[#D5C9B3]'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">{eq.member.fullName}</h3>
                        {isCurrentViewer && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Your Stake
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        {eq.member.role.replace(/_/g, ' ')}
                        {assignedLoc ? ` · ${assignedLoc.name}` : ' · Remote'}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                        Contact: {contactDisplay}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg sm:text-xl font-extrabold font-mono tabular-nums text-emerald-700">
                        {!showNumbers ? '••%' : `${eq.profitSharePercentage.toFixed(2)}%`}
                      </span>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Profit Share</p>
                    </div>
                  </div>

                  {/* Equity Share Visual Bar */}
                  <div className="w-full h-2 rounded-full bg-[#FAF8F5] border border-[#E8DFCE] overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, eq.profitSharePercentage)}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                    <div className="bg-[#FAF8F5] p-2.5 rounded-xl border border-[#E8DFCE]">
                      <p className="text-[11px] text-slate-500 font-medium">Contributed Capital</p>
                      <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">
                        {!showNumbers ? '••••••••' : `$${eq.netContribution.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                      </p>
                    </div>
                    <div className="bg-[#FAF8F5] p-2.5 rounded-xl border border-[#E8DFCE]">
                      <p className="text-[11px] text-slate-500 font-medium">Implied Stake Value</p>
                      <p className="font-mono font-bold text-emerald-700 text-sm mt-0.5">
                        {!showNumbers ? '••••••••' : `$${eq.impliedNavEquityUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#F0EBE1] flex flex-wrap items-center justify-between gap-2">
                  {canLogCapital && (
                    <button
                      type="button"
                      onClick={() => handleOpenContribModal('ADDITION', eq.member.id)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      Add Capital
                    </button>
                  )}

                  {canPostContra && (
                    <button
                      type="button"
                      onClick={() => handleOpenContribModal('CONTRA_REVERSAL', eq.member.id)}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-amber-50 border border-amber-300 text-amber-800 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Adjust Contribution
                    </button>
                  )}

                  {!canLogCapital && !canPostContra && (
                    <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5 py-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Verified Syndicate Ledger
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. APPEND-ONLY CAPITAL CONTRIBUTION LOG */}
      <section className="space-y-2.5">
        <h3 className="text-sm font-bold text-slate-900">Capital Contribution History</h3>
        <div className="space-y-2">
          {capitalContributions.map((c) => (
            <div
              key={c.id}
              className="rounded-xl bg-white border border-[#E8DFCE] p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs shadow-xs"
            >
              <div className="space-y-0.5">
                <div className="text-slate-500">
                  <strong className="text-slate-900 font-mono">Deposit #{c.id.slice(-6).toUpperCase()}</strong> · {c.memberName} ·{' '}
                  <span className="font-semibold text-emerald-700">{c.direction === 'ADDITION' ? 'Capital Deposit' : c.direction === 'INITIAL' ? 'Initial Capital Pool' : 'Contra Adjustment'}</span>
                  {c.referenceTransactionId ? ` · Ref: #${c.referenceTransactionId.slice(-6).toUpperCase()}` : ''}
                </div>
                <p className="text-slate-700">{c.note}</p>
                <div className="text-[11px] text-emerald-700 flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Verified Ledger Record
                </div>
              </div>
              <div className="text-right font-mono">
                <p
                  className={`text-sm font-bold ${
                    c.amount >= 0 ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {!showNumbers ? '••••••••' : (c.amount >= 0 ? `+$${c.amount.toFixed(2)}` : `-$${Math.abs(c.amount).toFixed(2)}`)}
                </p>
                <p className="text-[11px] text-slate-400">
                  {new Date(c.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ADD NEW MEMBER MODAL */}
      {showAddMemberModal && (
        <div
          className="modal-overlay-responsive"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-member-title"
        >
          <div className="modal-dialog-responsive max-w-md p-5 sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE1] shrink-0">
              <h2 id="add-member-title" className="text-base font-bold text-slate-900">
                Add New Syndicate Member
              </h2>
              <button
                type="button"
                onClick={() => setShowAddMemberModal(false)}
                aria-label="Close modal"
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMemberSubmit} className="modal-body-scroll mt-4 space-y-3.5">
              {memError && (
                <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 font-medium">
                  {memError}
                </p>
              )}

              <div>
                <label htmlFor="mem-name" className="block text-xs font-semibold text-slate-600 mb-1">
                  Full Name *
                </label>
                <input
                  id="mem-name"
                  type="text"
                  required
                  placeholder="e.g. Farai M."
                  value={memName}
                  onChange={(e) => setMemName(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label htmlFor="mem-contact" className="block text-xs font-semibold text-slate-600 mb-1">
                  Phone or Email *
                </label>
                <input
                  id="mem-contact"
                  type="text"
                  required
                  placeholder="e.g. +263 77 812 3300"
                  value={memContact}
                  onChange={(e) => setMemContact(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="mem-role" className="block text-xs font-semibold text-slate-600 mb-1">
                    Syndicate Role
                  </label>
                  <select
                    id="mem-role"
                    value={memRole}
                    onChange={(e) => setMemRole(e.target.value as Role)}
                    className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                  >
                    <option value="REMOTE_INVESTOR">Remote Investor</option>
                    <option value="GROUND_OPERATOR">Ground Operator</option>
                    <option value="TREASURER">Treasurer</option>
                    <option value="SYNDICATE_ADMIN">Syndicate Admin</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="mem-loc" className="block text-xs font-semibold text-slate-600 mb-1">
                    Assigned Farm Site
                  </label>
                  <select
                    id="mem-loc"
                    value={memLocationId}
                    onChange={(e) => setMemLocationId(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                  >
                    <option value="">Remote / Unassigned</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="mem-init-cap" className="block text-xs font-semibold text-slate-600 mb-1">
                  Initial Capital Contribution ($)
                </label>
                <input
                  id="mem-init-cap"
                  type="number"
                  min="0"
                  step="10"
                  value={memInitDeposit}
                  onChange={(e) => setMemInitDeposit(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label htmlFor="mem-note" className="block text-xs font-semibold text-slate-600 mb-1">
                  Audit Note
                </label>
                <input
                  id="mem-note"
                  type="text"
                  placeholder="e.g. Initial equity stake via bank transfer"
                  value={memNote}
                  onChange={(e) => setMemNote(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white border border-[#E0D7C6] text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 shadow-xs transition-colors"
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LOG CONTRIBUTION / CONTRA MODAL */}
      {contribModal && (
        <div
          className="modal-overlay-responsive"
          role="dialog"
          aria-modal="true"
          aria-labelledby="contrib-modal-title"
        >
          <div className="modal-dialog-responsive max-w-md p-5 sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE1] shrink-0">
              <h2 id="contrib-modal-title" className="text-base font-bold text-slate-900">
                {contribModal.mode === 'CONTRA_REVERSAL'
                  ? 'Post Capital Contribution Contra-Entry'
                  : 'Log Member Capital Contribution'}
              </h2>
              <button
                type="button"
                onClick={() => setContribModal(null)}
                aria-label="Close modal"
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleContribSubmit} className="modal-body-scroll mt-4 space-y-3.5">
              {cError && (
                <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 font-medium">
                  {cError}
                </p>
              )}

              <div>
                <label htmlFor="c-member" className="block text-xs font-semibold text-slate-600 mb-1">
                  Syndicate Member
                </label>
                <select
                  id="c-member"
                  value={cMemberId}
                  onChange={(e) => setCMemberId(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                >
                  {memberEquities.map((m) => (
                    <option key={m.member.id} value={m.member.id}>
                      {m.member.fullName} (Current: ${m.netContribution.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              {contribModal.mode === 'CONTRA_REVERSAL' && (
                <div className="space-y-3 p-3 rounded-2xl bg-amber-50/70 border border-amber-200">
                  <div>
                    <label htmlFor="c-ref" className="block text-xs font-semibold text-amber-900 mb-1">
                      Reference Original Contribution TX *
                    </label>
                    <select
                      id="c-ref"
                      value={cRefId}
                      onChange={(e) => setCRefId(e.target.value)}
                      className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900"
                    >
                      {capitalContributions.map((tx) => (
                        <option key={tx.id} value={tx.id}>
                          {tx.id} ({tx.memberName}: ${tx.amount.toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCContraSign('DEDUCT')}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                        cContraSign === 'DEDUCT'
                          ? 'bg-amber-600 border-amber-600 text-white shadow-xs'
                          : 'bg-white border-[#E0D7C6] text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      - Reduce Overstated Deposit
                    </button>
                    <button
                      type="button"
                      onClick={() => setCContraSign('ADD')}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                        cContraSign === 'ADD'
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                          : 'bg-white border-[#E0D7C6] text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      + Add Understated Deposit
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="c-amt" className="block text-xs font-semibold text-slate-600 mb-1">
                  Amount ($) *
                </label>
                <input
                  id="c-amt"
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={cAmount}
                  onChange={(e) => setCAmount(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label htmlFor="c-note" className="block text-xs font-semibold text-slate-600 mb-1">
                  Mandatory Explanation Note *
                </label>
                <textarea
                  id="c-note"
                  rows={2}
                  required
                  placeholder="Provide payment reference or reason for contra-entry..."
                  value={cNote}
                  onChange={(e) => setCNote(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setContribModal(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white border border-[#E0D7C6] text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 shadow-xs transition-colors"
                >
                  Commit to Pool Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
