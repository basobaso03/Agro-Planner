import React, { useState } from 'react';
import {
  DollarSign,
  RotateCcw,
  Calculator,
  ShieldCheck,
  ShieldAlert,
  Lock,
  X,
  Target,
  Copy,
  CheckCircle2,
  Users,
  Sparkles,
  Pencil,
  KeyRound,
  Link2,
  UserPlus,
  RefreshCw,
} from 'lucide-react';
import type {
  CapitalContributionEvent,
  FarmLocation,
  FinancialSummary,
  MemberEquitySummary,
  Role,
  OrgMember,
} from '../types/agro.ts';
import type { Organization } from '../types/organization.ts';
import { computeDividendDistribution } from '../utils/calculations.ts';
import { PERMISSIONS, maskContact } from '../utils/permissions.ts';
import { dataService } from '../services/dataService.ts';
import { useRunway } from '../hooks/useRunway.ts';
import { ContributionSheet } from '../sheets/pool/ContributionSheet.tsx';
import { TargetFundraisingSheet } from '../sheets/pool/TargetFundraisingSheet.tsx';
import { BulkMockContributorsSheet } from '../sheets/pool/BulkMockContributorsSheet.tsx';
import { LinkMemberSheet } from '../sheets/pool/LinkMemberSheet.tsx';
import { ClaimProfileSheet } from '../sheets/pool/ClaimProfileSheet.tsx';
import { AddMemberSheet } from '../sheets/pool/AddMemberSheet.tsx';
import { MemberRoleSheet } from '../sheets/common/MemberRoleSheet.tsx';
import {
  filterVisibleOrgMembers,
  isUnclaimedPlaceholder,
  matchesMemberRecord,
} from '../utils/memberIdentity.ts';
import { PdfExportButton } from './ui/PdfExportButton.tsx';
import { generateEquityCertificatePdf } from '../services/pdf/generators/shared/equityCertificatePdf.ts';
import { buildExportFilename } from '../utils/pdfFilename.ts';

interface PoolEquityTabProps {
  memberEquities: MemberEquitySummary[];
  capitalContributions: CapitalContributionEvent[];
  financials: FinancialSummary;
  locations: FarmLocation[];
  activeMember: OrgMember;
  activeOrg?: Organization | null;
  onAddMember?: (data: {
    fullName: string;
    phoneOrEmail?: string;
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
    runwayPlanId?: string;
    pledgeId?: string;
    claimId?: string;
  }) => void;
  showNumbers?: boolean;
}

export const PoolEquityTab: React.FC<PoolEquityTabProps> = ({
  memberEquities,
  capitalContributions,
  financials,
  locations,
  activeMember,
  activeOrg,
  onAddMember,
  onLogContribution,
  showNumbers = true,
}) => {
  const runway = useRunway();
  const activePlan = runway.isEnabled && (runway.plan?.status === 'ACTIVE' || runway.plan?.status === 'PLEDGING') ? runway.plan : null;
  const [applyToRunway, setApplyToRunway] = useState(false);

  const [simulatedProfit, setSimulatedProfit] = useState('2500');
  const [copiedCode, setCopiedCode] = useState(false);

  // Placeholder / Mock member management state
  const [showAddMemberSheet, setShowAddMemberSheet] = useState(false);
  const [showBatchMockSheet, setShowBatchMockSheet] = useState(false);
  const [showClaimSheet, setShowClaimSheet] = useState(false);
  const [linkingContext, setLinkingContext] = useState<{
    placeholder: OrgMember;
    preselectedTargetMemberId?: string;
    claimRequestId?: string;
  } | null>(null);
  const [claimCodeSheet, setClaimCodeSheet] = useState<{
    member: OrgMember;
    code: string;
    copied?: boolean;
  } | null>(null);
  const [claimCodeBusy, setClaimCodeBusy] = useState(false);
  const [poolActionNotice, setPoolActionNotice] = useState<string | null>(null);

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

  // Role & Clearance Modal State (Admin Only)
  const [roleModalMember, setRoleModalMember] = useState<OrgMember | null>(null);

  // Target Capital Modal State
  const [targetModal, setTargetModal] = useState<{
    memberId: string;
    memberName: string;
    currentTarget: number;
    currentPace: 'MONTHLY' | 'MILESTONE' | 'FLEXIBLE';
  } | null>(null);
  const [targetAmount, setTargetAmount] = useState('1000');
  const [targetPace, setTargetPace] = useState<'MONTHLY' | 'MILESTONE' | 'FLEXIBLE'>('MONTHLY');
  const [targetError, setTargetError] = useState('');

  const payouts = computeDividendDistribution(
    parseFloat(simulatedProfit) || 0,
    memberEquities
  );

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleOpenContribModal = (
    mode: 'ADDITION' | 'CONTRA_REVERSAL',
    memberId: string
  ) => {
    setContribModal({ mode, defaultMemberId: memberId });
    setCMemberId(memberId);
    setCAmount('250');
    setCRefId('');
    setCNote('');
    setCError('');

    if (activePlan) {
      const targetEq = memberEquities.find((e) => e.member.id === memberId);
      const pl = runway.pledges.find(
        (p) =>
          p.planId === activePlan.id &&
          p.status !== 'MERGED' &&
          p.status !== 'WITHDRAWN' &&
          (targetEq ? matchesMemberRecord(p.memberId, targetEq.member) : p.memberId === memberId)
      );
      const paid = pl?.paidAmount ?? 0;
      const pledged = pl?.pledgedAmount ?? pl?.amount ?? 0;
      setApplyToRunway(Boolean(pl && paid < pledged));
    } else {
      setApplyToRunway(false);
    }
  };

  const handleContribSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contribModal) return;
    const parsedAmount = parseFloat(cAmount);
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setCError('Please enter a valid amount.');
      return;
    }
    if (!cNote.trim()) {
      setCError('A mandatory description/note is required for transparent ledger audits.');
      return;
    }

    try {
      if (contribModal.mode === 'ADDITION') {
        const pledge = activePlan ? runway.pledges.find((p) => p.planId === activePlan.id && p.memberId === cMemberId) : null;
        onLogContribution({
          memberId: cMemberId,
          direction: 'ADDITION',
          amount: parsedAmount,
          note: cNote.trim(),
          runwayPlanId: applyToRunway && activePlan ? activePlan.id : undefined,
          pledgeId: applyToRunway && pledge ? pledge.id : undefined,
        });
      } else {
        const finalAmount = cContraSign === 'DEDUCT' ? -parsedAmount : parsedAmount;
        onLogContribution({
          memberId: cMemberId,
          direction: 'CONTRA_REVERSAL',
          amount: finalAmount,
          referenceTransactionId: cRefId.trim() || undefined,
          note: `[Contra Reversal] ${cNote.trim()}`,
        });
      }
      setContribModal(null);
    } catch (err) {
      setCError(err instanceof Error ? err.message : 'Contribution transaction failed.');
    }
  };

  const handleOpenTargetModal = (member: OrgMember, currentTarget: number, currentPace: 'MONTHLY' | 'MILESTONE' | 'FLEXIBLE') => {
    setTargetModal({
      memberId: member.id,
      memberName: member.fullName,
      currentTarget,
      currentPace,
    });
    setTargetAmount(String(currentTarget || 1000));
    setTargetPace(currentPace || 'MONTHLY');
    setTargetError('');
  };

  const handleSaveTargetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetModal) return;
    const parsed = Number(targetAmount);
    if (!parsed || isNaN(parsed) || parsed < 0) {
      setTargetError('Please enter a valid target amount.');
      return;
    }
    try {
      dataService.updateMemberCapitalTarget({
        memberId: targetModal.memberId,
        targetContributionUsd: parsed,
        contributionPace: targetPace,
        actor: activeMember,
      });
      setTargetModal(null);
    } catch (err: unknown) {
      setTargetError(err instanceof Error ? err.message : 'Failed to update member target.');
    }
  };

  const canManageMembers = PERMISSIONS.canManageMembers(activeMember.role);
  const canCreateMembers = PERMISSIONS.canManageMemberCRUD(activeMember);
  const canLogCapital = PERMISSIONS.canLogCapitalDeposit(activeMember.role);
  const canPostContra = PERMISSIONS.canPostContraReversals(activeMember.role);
  const canViewUnmasked = PERMISSIONS.canViewUnmaskedPII(activeMember.role);
  const isAgroOrg = activeOrg?.type !== 'GENERAL_VENTURE';

  const snapshot = dataService.getState();
  const visibleOrgMembers = filterVisibleOrgMembers(snapshot.members || [], activeMember.orgId);
  const unclaimedPlaceholders = visibleOrgMembers.filter((m) => isUnclaimedPlaceholder(m));
  const pendingClaimRequests = (snapshot.memberClaimRequests || []).filter(
    (r) => (!activeMember.orgId || r.orgId === activeMember.orgId) && r.status === 'PENDING'
  );

  const handleOpenClaimCode = async (member: OrgMember) => {
    setPoolActionNotice(null);
    let code = dataService.getPlaceholderClaimCode(member.id);
    if (!code && activeMember.orgId) {
      setClaimCodeBusy(true);
      try {
        code = await dataService.fetchPlaceholderClaimCode(member.id, activeMember.orgId);
      } finally {
        setClaimCodeBusy(false);
      }
    }
    setClaimCodeSheet({ member, code: code || '' });
  };

  const handleRegenerateClaimCode = async () => {
    if (!claimCodeSheet) return;
    setClaimCodeBusy(true);
    try {
      const freshCode = await dataService.regeneratePlaceholderClaimCode({
        placeholderMemberId: claimCodeSheet.member.id,
        actor: activeMember,
      });
      setClaimCodeSheet({ member: claimCodeSheet.member, code: freshCode, copied: false });
      setPoolActionNotice(`Generated a new Claim Code for ${claimCodeSheet.member.fullName}.`);
    } catch (err: unknown) {
      setPoolActionNotice(err instanceof Error ? err.message : 'Failed to regenerate claim code.');
    } finally {
      setClaimCodeBusy(false);
    }
  };

  const handleRejectClaimRequest = async (requestId: string) => {
    try {
      await dataService.rejectMemberClaimRequest({
        requestId,
        actor: activeMember,
      });
      setPoolActionNotice('Profile link request rejected.');
    } catch (err: unknown) {
      setPoolActionNotice(err instanceof Error ? err.message : 'Failed to reject link request.');
    }
  };

  // Calculate Organization Total Target Commitment
  const totalTargetGoal = memberEquities.reduce((acc, eq) => acc + (eq.targetContributionUsd || 1000), 0);
  const totalContributedPool = financials.totalPool || 0;
  const overallTargetPercentage = totalTargetGoal > 0 ? Math.min(100, Math.round((totalContributedPool / totalTargetGoal) * 100)) : 0;

  return (
    <div className="space-y-5 animate-fade-in pb-16 text-slate-950">
      {/* 24-Hour Quick Invite Banner for Admins */}
      {canManageMembers && activeOrg?.currentInviteCode && (
        <div className="p-4 rounded-3xl bg-emerald-50 border border-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 shrink-0">
              <Users className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-emerald-950 uppercase tracking-wide">
                  24-Hour Invitation Code:
                </span>
                <span className="font-mono font-black text-sm text-emerald-900 bg-white px-2.5 py-0.5 rounded-lg border border-emerald-300 shadow-xs">
                  {activeOrg.currentInviteCode}
                </span>
              </div>
              <p className="text-[11px] text-emerald-900 font-medium mt-0.5">
                Share with new members to let them join {activeOrg.name} immediately without delay.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleCopyCode(activeOrg.currentInviteCode)}
            className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
          >
            {copiedCode ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? 'Code Copied!' : 'Copy Invitation Code'}</span>
          </button>
        </div>
      )}

      {/* 1. MASTER POOL BANNER & TARGET COMMITMENT METER */}
      <section className="rounded-3xl bg-white border border-[#E8DFCE] p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                Organization Master Capital Pool
              </span>
              {!canManageMembers && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/90 whitespace-nowrap shrink-0 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                  Member View
                </span>
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black font-mono tabular-nums text-slate-950 mt-0.5">
              {!showNumbers ? '••••••••' : `$${totalContributedPool.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PdfExportButton
              label="Share Equity PDF"
              title="Syndicate Capital Equity Statement"
              filename={buildExportFilename({
                orgName: activeOrg?.name || 'Syndicate',
                documentType: 'Syndicate-Equity-Certificate',
              })}
              generateDoc={() =>
                generateEquityCertificatePdf({
                  organization: activeOrg,
                  equitySummaries: memberEquities,
                  totalPool: totalContributedPool,
                  totalNav: financials.totalNav || financials.totalSyndicateNav || 0,
                  operatorName: activeMember.fullName,
                })
              }
            />
            {canLogCapital && memberEquities.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  handleOpenContribModal('ADDITION', memberEquities[0]?.member.id || activeMember.id)
                }
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-black text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <DollarSign className="w-3.5 h-3.5" />
                Log Contribution
              </button>
            )}
          </div>
        </div>

        {/* Global Organization Capital Target Progress Meter */}
        <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-black text-slate-950 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-emerald-700" />
              <span>Collective Funding Goal: {!showNumbers ? '••••••••' : `$${totalTargetGoal.toLocaleString()}`}</span>
            </span>
            <span className="font-mono font-black text-emerald-800">
              {!showNumbers ? '••%' : `${overallTargetPercentage}% Funded`}
            </span>
          </div>

          <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden border border-slate-300">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full transition-all duration-500"
              style={{ width: `${overallTargetPercentage}%` }}
            />
          </div>

          <div className="flex justify-between text-[11px] text-slate-500 font-medium">
            <span>Collected: {!showNumbers ? '••••' : `$${totalContributedPool.toFixed(0)}`}</span>
            <span>Target: {!showNumbers ? '••••' : `$${totalTargetGoal.toFixed(0)}`}</span>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="bg-[#FAF8F5] p-3 rounded-2xl border border-[#E8DFCE]">
            <p className="text-[11px] font-bold text-slate-500">Active Group Members</p>
            <p className="font-mono font-black text-slate-950 text-sm mt-0.5">
              {!showNumbers ? '••' : memberEquities.length} Members
            </p>
          </div>
          <div className="bg-[#FAF8F5] p-3 rounded-2xl border border-[#E8DFCE]">
            <p className="text-[11px] font-bold text-slate-500">Available Liquid Money (leftMoney)</p>
            <p className="font-mono font-black text-emerald-800 text-sm mt-0.5">
              {!showNumbers ? '••••••••' : `$${financials.leftMoney.toFixed(2)}`}
            </p>
          </div>
          <div className="bg-[#FAF8F5] p-3 rounded-2xl border border-[#E8DFCE]">
            <p className="text-[11px] font-bold text-slate-500">Total Implied Asset Value (NAV)</p>
            <p className="font-mono font-black text-slate-950 text-sm mt-0.5">
              {!showNumbers ? '••••••••' : `$${financials.totalNav.toFixed(2)}`}
            </p>
          </div>
        </div>

        {/* Active Runway Operational Cycle Bridge */}
        {activePlan && (
          <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="font-black text-indigo-950 block">
                  Active Operational Runway: {activePlan.name}
                </span>
                <span className="text-[11px] text-indigo-700 font-medium">
                  Status: {activePlan.status} • Member cycle pay-ins directly build this Master Capital Pool &amp; liquid cash.
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 2. INTERACTIVE PROFIT PAYOUT & DIVIDEND CALCULATOR */}
      <section className="rounded-3xl bg-[#FAF8F5] border border-[#E8DFCE] p-4 sm:p-5 space-y-3.5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-emerald-700" />
            <h2 className="text-sm font-black text-slate-950">
              Interactive Profit Payout &amp; Dividend Simulator
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-mono font-bold">Pro-Rata by Net Contribution %</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label htmlFor="profit-sim-input" className="text-xs text-slate-800 font-bold whitespace-nowrap">
            Profit to Distribute ($):
          </label>
          <input
            id="profit-sim-input"
            type="number"
            min="0"
            step="50"
            value={simulatedProfit}
            onChange={(e) => setSimulatedProfit(e.target.value)}
            className="w-full sm:w-48 bg-white border border-[#E0D7C6] rounded-xl px-3.5 py-2 text-sm font-black font-mono text-slate-950 focus:outline-none focus:border-emerald-600"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          {payouts.map((p) => (
            <div
              key={p.memberId}
              className="rounded-xl bg-white border border-[#E8DFCE] p-3 space-y-1 shadow-xs"
            >
              <p className="text-xs font-black text-slate-950 truncate">{p.memberName}</p>
              <p className="text-[11px] font-mono font-bold text-slate-500">
                Share: {!showNumbers ? '••%' : `${p.sharePercent.toFixed(2)}%`}
              </p>
              <p className="text-sm font-black font-mono tabular-nums text-emerald-800">
                {!showNumbers ? '••••••••' : `$${p.payoutUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Newcomer Prompt to Claim Pre-Recorded Mock Profile */}
      {!canManageMembers && unclaimedPlaceholders.length > 0 && !(activeMember.linkedMemberIds?.length) && (
        <div className="p-4 rounded-3xl bg-indigo-50 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-black text-indigo-950 uppercase tracking-wide">
                Contributed Before Joining?
              </p>
              <p className="text-[11px] text-indigo-900 font-medium mt-0.5">
                Claim your pre-registered contributor account with your Personal Claim Code or send a link request to an admin.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowClaimSheet(true)}
            className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs cursor-pointer transition-colors"
          >
            Claim My Profile
          </button>
        </div>
      )}

      {/* Pending Claim Requests Alert for Admins */}
      {canManageMembers && pendingClaimRequests.length > 0 && (
        <div className="p-4 rounded-3xl bg-amber-50 border border-amber-300 space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-amber-800" />
              <span className="text-xs font-black text-amber-950 uppercase tracking-wide">
                {pendingClaimRequests.length} Profile Link Request{pendingClaimRequests.length > 1 ? 's' : ''} Pending
              </span>
            </div>
          </div>
          <div className="space-y-2">
            {pendingClaimRequests.map((req) => {
              const placeholder = visibleOrgMembers.find((m) => m.id === req.placeholderMemberId);
              return (
                <div
                  key={req.id}
                  className="p-2.5 rounded-2xl bg-white border border-amber-200 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <span className="font-black text-slate-950">{req.requesterName}</span>
                    <span className="text-slate-600 font-medium"> requested link to </span>
                    <span className="font-black text-amber-900">{req.placeholderName}</span>
                    {req.note && <p className="text-[11px] text-slate-500 mt-0.5">Note: {req.note}</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {placeholder && (
                      <button
                        type="button"
                        onClick={() =>
                          setLinkingContext({
                            placeholder,
                            preselectedTargetMemberId: req.requesterMemberId || req.requesterUid,
                            claimRequestId: req.id,
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] cursor-pointer"
                      >
                        Approve &amp; Link
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRejectClaimRequest(req.id)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {poolActionNotice && (
        <div className="p-3 rounded-2xl bg-slate-900 text-white text-xs font-bold flex items-center justify-between gap-2">
          <span>{poolActionNotice}</span>
          <button
            type="button"
            onClick={() => setPoolActionNotice(null)}
            className="text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. MEMBER EQUITY & TARGET CONTRIBUTION CARDS */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-950">
              Member Capital Commitments &amp; Progress
            </h2>
            <p className="text-xs text-slate-600 font-medium">
              Progress towards agreed capital target and equity ownership
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canCreateMembers && (
              <>
                <button
                  type="button"
                  onClick={() => setShowAddMemberSheet(true)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Add Contributor</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowBatchMockSheet(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>+ Batch Mock List</span>
                </button>
              </>
            )}
            <span className="text-xs font-mono font-black text-slate-800 bg-white border border-[#E8DFCE] px-2.5 py-1 rounded-full shadow-xs">
              {memberEquities.length} Active Partners
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {memberEquities.map((eq) => {
            const assignedLoc = locations.find((l) => l.id === eq.member.assignedLocationId);
            const isCurrentViewer =
              matchesMemberRecord(eq.member.id, activeMember) || eq.member.id === activeMember.id;
            const isPlaceholder = isUnclaimedPlaceholder(eq.member);
            const hasLinkedHistory = Boolean(eq.member.linkedMemberIds?.length);
            const contactDisplay = maskContact(eq.member.phoneOrEmail || '', canViewUnmasked);

            const targetUsd = eq.targetContributionUsd || 1000;
            const progress = eq.progressPercentage;
            const remaining = eq.remainingToTargetUsd;
            const isGoalMet = eq.isGoalMet;

            return (
              <div
                key={eq.member.id}
                className={`rounded-2xl border p-4 sm:p-5 flex flex-col justify-between gap-3.5 transition-all shadow-xs ${isCurrentViewer
                  ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                  : isPlaceholder
                    ? 'bg-amber-50/40 border-amber-300 hover:border-amber-400'
                    : 'bg-white border-[#E8DFCE] hover:border-[#D5C9B3]'
                  }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="text-base font-black text-slate-950">{eq.member.fullName}</h3>
                        {isCurrentViewer && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-300">
                            Your Stake
                          </span>
                        )}
                        {isPlaceholder && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                            Unclaimed · Mock
                          </span>
                        )}
                        {hasLinkedHistory && !isPlaceholder && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-teal-100 text-teal-900 border border-teal-300">
                            Linked ✓
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 font-bold">
                        {eq.member.role.replace(/_/g, ' ')}
                        {isAgroOrg ? (assignedLoc ? ` · ${assignedLoc.name}` : ' · Remote') : ''}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500 font-medium mt-0.5">
                        {isPlaceholder
                          ? (eq.member.phoneOrEmail ? `Contact: ${contactDisplay}` : 'Awaiting future registration')
                          : `Contact: ${contactDisplay}`}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-lg sm:text-xl font-black font-mono tabular-nums text-emerald-800">
                        {!showNumbers ? '••%' : `${eq.profitSharePercentage.toFixed(2)}%`}
                      </span>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Profit Share</p>
                    </div>
                  </div>

                  {/* TARGET CAPITAL COMMITMENT PROGRESS BAR */}
                  <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE] space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-slate-950 flex items-center gap-1">
                          <Target className="w-3.5 h-3.5 text-amber-700" />
                          <span>Capital Goal: {!showNumbers ? '••••' : `$${targetUsd.toLocaleString()}`}</span>
                        </span>
                        {(isCurrentViewer || canManageMembers) && (
                          <button
                            type="button"
                            onClick={() => handleOpenTargetModal(eq.member, targetUsd, eq.contributionPace)}
                            className="p-1 rounded text-slate-400 hover:text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer"
                            title="Edit agreed capital target amount and pace"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isGoalMet
                          ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                          : 'bg-amber-100 text-amber-950 border border-amber-300'
                          }`}
                      >
                        {isGoalMet ? 'Goal Met ✓' : `${progress}% (${eq.contributionPace})`}
                      </span>
                    </div>

                    <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden border border-slate-300">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${isGoalMet ? 'bg-emerald-600' : 'bg-amber-500'
                          }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium pt-0.5">
                      <span>Paid: {!showNumbers ? '••••' : `$${eq.netContribution.toFixed(2)}`}</span>
                      <span>
                        {isGoalMet
                          ? 'Fully Contributed'
                          : `Remaining: ${!showNumbers ? '••••' : `$${remaining.toFixed(2)}`}`}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-[#FAF8F5] p-2.5 rounded-xl border border-[#E8DFCE]">
                      <p className="text-[11px] text-slate-500 font-bold">Total Net Capital</p>
                      <p className="font-mono font-black text-slate-950 text-sm mt-0.5">
                        {!showNumbers ? '••••••••' : `$${eq.netContribution.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                      </p>
                    </div>
                    <div className="bg-[#FAF8F5] p-2.5 rounded-xl border border-[#E8DFCE]">
                      <p className="text-[11px] text-slate-500 font-bold">Implied NAV Stake</p>
                      <p className="font-mono font-black text-emerald-800 text-sm mt-0.5">
                        {!showNumbers ? '••••••••' : `$${eq.impliedNavEquityUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                      </p>
                    </div>
                  </div>

                  {activePlan && (() => {
                    const pl = runway.pledges.find(
                      (p) =>
                        p.planId === activePlan.id &&
                        p.status !== 'MERGED' &&
                        p.status !== 'WITHDRAWN' &&
                        matchesMemberRecord(p.memberId, eq.member)
                    );
                    if (!pl) return null;
                    return (
                      <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200 flex items-center justify-between text-xs">
                        <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          Runway Pledge
                        </span>
                        <span className="font-mono font-bold text-indigo-900">
                          ${(pl.paidAmount ?? 0).toFixed(2)} / ${(pl.pledgedAmount ?? pl.amount).toFixed(2)}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                <div className="pt-3 border-t border-[#F0EBE1] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {canLogCapital && (
                      <button
                        type="button"
                        onClick={() => handleOpenContribModal('ADDITION', eq.member.id)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        Add Capital
                      </button>
                    )}

                    {canPostContra && (
                      <button
                        type="button"
                        onClick={() => handleOpenContribModal('CONTRA_REVERSAL', eq.member.id)}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Adjust Entry
                      </button>
                    )}

                    {canManageMembers && (
                      <button
                        type="button"
                        onClick={() => setRoleModalMember(eq.member)}
                        className="px-3 py-1.5 rounded-xl bg-[#FAF8F5] hover:bg-[#F0EBE1] border border-[#E0D7C6] text-slate-800 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        title="Update user role and permissions"
                      >
                        <span>⚙️ Change Role</span>
                      </button>
                    )}

                    {canManageMembers && isPlaceholder && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenClaimCode(eq.member)}
                          className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-950 text-xs font-black flex items-center gap-1 cursor-pointer transition-colors"
                          title="View or share Personal Claim Code"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Claim Code</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setLinkingContext({ placeholder: eq.member })}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1 cursor-pointer transition-colors"
                          title="Link to a registered user"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          <span>Link to User</span>
                        </button>
                      </>
                    )}
                  </div>

                  {!canLogCapital && !canPostContra && !canManageMembers && (
                    <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5 py-1 font-bold">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Verified Ledger Record
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
        <h3 className="text-sm font-black text-slate-950">Capital Contribution History</h3>
        <div className="space-y-2">
          {capitalContributions.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl bg-white border border-[#E8DFCE] p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs shadow-xs"
            >
              <div className="space-y-0.5">
                <div className="text-slate-500 font-medium">
                  <strong className="text-slate-950 font-mono font-black">Deposit #{c.id.slice(-6).toUpperCase()}</strong> · {c.memberName} ·{' '}
                  <span className="font-bold text-emerald-800">
                    {c.direction === 'ADDITION'
                      ? 'Capital Deposit'
                      : c.direction === 'INITIAL'
                        ? 'Initial Pool Fund'
                        : 'Contra Adjustment'}
                  </span>
                  {c.referenceTransactionId ? ` · Ref: #${c.referenceTransactionId.slice(-6).toUpperCase()}` : ''}
                </div>
                <p className="text-slate-900 font-medium">{c.note}</p>
                <div className="text-[11px] text-emerald-800 flex items-center gap-1.5 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Verified Ledger Record
                </div>
              </div>
              <div className="text-right font-mono">
                <p
                  className={`text-sm font-black ${c.amount >= 0 ? 'text-emerald-800' : 'text-amber-800'
                    }`}
                >
                  {!showNumbers ? '••••••••' : (c.amount >= 0 ? `+$${c.amount.toFixed(2)}` : `-$${Math.abs(c.amount).toFixed(2)}`)}
                </p>
                <p className="text-[11px] text-slate-500 font-medium">
                  {new Date(c.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom Sheets */}
      {contribModal && (
        <ContributionSheet
          isOpen={Boolean(contribModal)}
          onClose={() => setContribModal(null)}
          activeMember={activeMember}
          targetMember={memberEquities.find((m) => m.member.id === (cMemberId || contribModal.defaultMemberId))?.member}
        />
      )}

      {targetModal && (
        <TargetFundraisingSheet
          isOpen={Boolean(targetModal)}
          onClose={() => setTargetModal(null)}
          member={memberEquities.find((m) => m.member.id === targetModal.memberId)?.member || activeMember}
          activeMember={activeMember}
        />
      )}

      {roleModalMember && (
        <MemberRoleSheet
          isOpen={Boolean(roleModalMember)}
          onClose={() => setRoleModalMember(null)}
          member={roleModalMember}
          activeMember={activeMember}
        />
      )}

      {showAddMemberSheet && (
        <AddMemberSheet
          isOpen={showAddMemberSheet}
          onClose={() => setShowAddMemberSheet(false)}
          activeMember={activeMember}
        />
      )}

      {showBatchMockSheet && (
        <BulkMockContributorsSheet
          isOpen={showBatchMockSheet}
          onClose={() => setShowBatchMockSheet(false)}
          activeMember={activeMember}
          defaultPlanId={activePlan?.id || ''}
        />
      )}

      {showClaimSheet && (
        <ClaimProfileSheet
          isOpen={showClaimSheet}
          onClose={() => setShowClaimSheet(false)}
          activeMember={activeMember}
        />
      )}

      {linkingContext && (
        <LinkMemberSheet
          isOpen={Boolean(linkingContext)}
          onClose={() => setLinkingContext(null)}
          placeholderMember={linkingContext.placeholder}
          activeMember={activeMember}
          preselectedTargetMemberId={linkingContext.preselectedTargetMemberId}
          claimRequestId={linkingContext.claimRequestId}
        />
      )}

      {claimCodeSheet && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white border border-[#E8DFCE] p-5 space-y-4 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-black text-slate-950">
                  Personal Claim Code
                </h4>
                <p className="text-xs text-slate-600 font-medium">
                  Share privately with <strong>{claimCodeSheet.member.fullName}</strong> so they can claim their profile when registering.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setClaimCodeSheet(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {claimCodeSheet.code ? (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 flex items-center justify-between gap-2">
                <span className="font-mono font-black text-lg text-amber-950 tracking-wider">
                  {claimCodeSheet.code}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(claimCodeSheet.code);
                    setClaimCodeSheet({ ...claimCodeSheet, copied: true });
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{claimCodeSheet.copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-slate-100 text-xs text-slate-700 font-medium">
                {claimCodeBusy ? 'Loading claim code...' : 'Claim code not cached yet. Click Regenerate to issue a fresh personal claim code.'}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                disabled={claimCodeBusy}
                onClick={handleRegenerateClaimCode}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${claimCodeBusy ? 'animate-spin' : ''}`} />
                <span>Regenerate Code</span>
              </button>
              <button
                type="button"
                onClick={() => setClaimCodeSheet(null)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
