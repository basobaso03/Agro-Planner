import React, { useState, useEffect, useMemo } from 'react';
import { dataService } from '../../services/dataService.ts';
import { formatMoney } from '../../utils/currency.ts';
import { PERMISSIONS, getRoleMeta } from '../../utils/permissions.ts';
import { filterVisibleOrgMembers, isUnclaimedPlaceholder, matchesMemberRecord } from '../../utils/memberIdentity.ts';
import { AddMemberSheet } from '../../sheets/pool/AddMemberSheet.tsx';
import { BulkMockContributorsSheet } from '../../sheets/pool/BulkMockContributorsSheet.tsx';
import { LinkMemberSheet } from '../../sheets/pool/LinkMemberSheet.tsx';
import { ClaimProfileSheet } from '../../sheets/pool/ClaimProfileSheet.tsx';
import { MemberRoleSheet } from '../../sheets/common/MemberRoleSheet.tsx';
import { InviteCodeSheet } from '../../sheets/common/InviteCodeSheet.tsx';
import { ContributionSheet } from '../../sheets/pool/ContributionSheet.tsx';
import { useToast } from '../../components/ui/Toast.tsx';
import type { MemberClaimRequest, OrgMember } from '../../types/agro.ts';

export interface MembersScreenProps {
  activeMember: OrgMember;
  showNumbers?: boolean;
}

export const MembersScreen: React.FC<MembersScreenProps> = ({
  activeMember,
  showNumbers = true,
}) => {
  const { showToast } = useToast();
  const [, setTick] = useState(0);

  useEffect(() => {
    return dataService.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, []);

  const [selectedMember, setSelectedMember] = useState<OrgMember | null>(null);
  const [linkModalContext, setLinkModalContext] = useState<{
    placeholder: OrgMember;
    targetId?: string;
    requestId?: string;
  } | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [showClaimSheet, setShowClaimSheet] = useState(false);
  const [showRoleSheet, setShowRoleSheet] = useState(false);
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [showContributionSheet, setShowContributionSheet] = useState(false);
  const [filterTab, setFilterTab] = useState<'ALL' | 'ACTIVE' | 'UNCLAIMED'>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const state = dataService.getState();
  const orgId = activeMember.orgId || '';

  const members = useMemo(() => {
    return filterVisibleOrgMembers(state.members || [], orgId);
  }, [state.members, orgId]);

  const unclaimedMembers = useMemo(
    () => members.filter((m) => isUnclaimedPlaceholder(m)),
    [members]
  );

  const pendingClaimRequests = useMemo(() => {
    return (state.memberClaimRequests || []).filter(
      (r) => (!orgId || r.orgId === orgId) && r.status === 'PENDING'
    );
  }, [state.memberClaimRequests, orgId]);

  const filteredMembers = useMemo(() => {
    if (filterTab === 'UNCLAIMED') return unclaimedMembers;
    if (filterTab === 'ACTIVE') return members.filter((m) => !isUnclaimedPlaceholder(m));
    return members;
  }, [members, unclaimedMembers, filterTab]);

  const equities = dataService.computeMemberEquitySummaries();

  const org =
    (state.organizations || []).find((o) => o.id === orgId) ||
    dataService.getActiveOrganization(orgId);

  const canManage = PERMISSIONS.canManageMembers(activeMember.role);

  const handleCopyClaimInvite = async (placeholder: OrgMember) => {
    let code = dataService.getPlaceholderClaimCode(placeholder.id);
    if (!code) {
      code = await dataService.fetchPlaceholderClaimCode(placeholder.id, orgId);
    }
    if (!code) {
      code = await dataService.regeneratePlaceholderClaimCode({
        placeholderMemberId: placeholder.id,
        actor: activeMember,
      });
    }
    const inviteCode = org?.currentInviteCode || 'ASK-ADMIN';
    const message = `Hi ${placeholder.fullName}, join ${org?.name || 'our organization'} in AgroPlanner using Org Code: ${inviteCode} and your Personal Claim Code: ${code} to claim your pre-recorded equity & pledges.`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(message);
    }
    setCopiedId(placeholder.id);
    setTimeout(() => setCopiedId(null), 2500);
    showToast({
      type: 'success',
      title: 'Claim Code Copied',
      message: `Claim Code ${code} copied for ${placeholder.fullName}.`,
    });
  };

  const handleApproveRequest = (req: MemberClaimRequest) => {
    const placeholder = members.find((m) => m.id === req.placeholderMemberId);
    if (!placeholder) return;
    setLinkModalContext({
      placeholder,
      targetId: req.requesterMemberId,
      requestId: req.id,
    });
  };

  const handleRejectRequest = (req: MemberClaimRequest) => {
    try {
      dataService.rejectMemberClaimRequest({
        requestId: req.id,
        note: 'Rejected by Administrator',
        actor: activeMember,
      });
      showToast({
        type: 'info',
        title: 'Link Request Rejected',
        message: `Dismissed request from ${req.requesterName}.`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Action Failed',
        message: err?.message || 'Could not reject request.',
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 pb-24 max-w-2xl mx-auto w-full space-y-4">
      {/* Top Banner & Quick Actions */}
      <div className="bg-white border border-[#E8DFCE] p-5 rounded-2xl shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">{org?.type === 'AGRO_FARMING' ? '🌱' : '💼'}</span>
              <h1 className="text-base font-black text-slate-950">{org?.name || 'Syndicate Governance'}</h1>
            </div>
            <p className="text-xs text-slate-600 font-medium mt-0.5">
              {org?.type === 'AGRO_FARMING' ? 'Agro-Farming & Livestock Enterprise' : 'General Business Venture'} · {members.length} partners ({unclaimedMembers.length} unclaimed)
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() => setShowInviteSheet(true)}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors shrink-0"
            >
              <span>🔑</span>
              <span>Invite Code</span>
            </button>
          )}
        </div>

        {canManage ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setShowAddMember(true)}
              className="w-full py-2.5 px-3 rounded-xl bg-[#FAF8F5] border border-[#E0D7C6] text-slate-950 font-bold text-xs text-center hover:bg-[#F0EBE1] active:scale-[0.99] transition-all cursor-pointer shadow-xs"
            >
              + Add Member / Mock Account
            </button>
            <button
              type="button"
              onClick={() => setShowBulkAdd(true)}
              className="w-full py-2.5 px-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 font-bold text-xs text-center hover:bg-amber-100 active:scale-[0.99] transition-all cursor-pointer shadow-xs"
            >
              📋 Batch Add Unregistered List
            </button>
          </div>
        ) : (
          unclaimedMembers.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClaimSheet(true)}
              className="w-full py-2.5 px-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 font-bold text-xs text-center hover:bg-amber-100 transition-all cursor-pointer shadow-xs"
            >
              🔑 Contributed before registering? Claim Existing Profile
            </button>
          )
        )}
      </div>

      {/* Admin Queue: Pending Claim Requests */}
      {canManage && pendingClaimRequests.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wide text-amber-950">
              Pending Profile Link Requests ({pendingClaimRequests.length})
            </h2>
          </div>
          <div className="space-y-2">
            {pendingClaimRequests.map((req) => (
              <div
                key={req.id}
                className="p-3 rounded-xl bg-white border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div>
                  <p className="font-black text-slate-950">
                    {req.requesterName}{' '}
                    <span className="font-normal text-slate-500">
                      ({req.requesterEmail || 'Member'})
                    </span>{' '}
                    → <span className="text-amber-800">{req.placeholderName}</span>
                  </p>
                  {req.note && (
                    <p className="text-[11px] text-slate-600 mt-0.5">&ldquo;{req.note}&rdquo;</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleApproveRequest(req)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                  >
                    Approve &amp; Link
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRejectRequest(req)}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Pills */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="font-black text-slate-950 text-sm">Partners &amp; Operators</div>
        <div className="flex items-center gap-1.5 text-xs">
          {(['ALL', 'ACTIVE', 'UNCLAIMED'] as const).map((tab) => {
            const count =
              tab === 'ALL'
                ? members.length
                : tab === 'UNCLAIMED'
                  ? unclaimedMembers.length
                  : members.length - unclaimedMembers.length;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setFilterTab(tab)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${filterTab === tab
                  ? 'bg-emerald-700 text-white'
                  : 'bg-white border border-[#E8DFCE] text-slate-700 hover:bg-[#FAF8F5]'
                  }`}
              >
                {tab === 'ALL' ? 'All' : tab === 'ACTIVE' ? 'Registered' : 'Unclaimed Mock'} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Members List */}
      <div className="space-y-2.5">
        {filteredMembers.map((member) => {
          const eq = equities.find(
            (e: any) => matchesMemberRecord(e.member.id, member) || e.member.id === member.id
          );
          const isMock = isUnclaimedPlaceholder(member);
          return (
            <div
              key={member.id}
              className={`bg-white border rounded-2xl p-4 shadow-xs space-y-3 ${isMock ? 'border-amber-300 bg-amber-50/20' : 'border-[#E8DFCE]'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-full font-bold flex items-center justify-center text-sm shrink-0 border ${isMock
                      ? 'bg-amber-100 border-amber-300 text-amber-900'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      }`}
                  >
                    {member.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-black text-slate-950 truncate">
                        {member.fullName}
                      </span>
                      {isMock && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-300">
                          Unclaimed · Mock
                        </span>
                      )}
                      {member.linkedMemberIds && member.linkedMemberIds.length > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                          Linked ✓
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 font-medium mt-0.5">
                      {getRoleMeta(member.role).label} · {isMock ? (member.phone || 'Awaiting Registration') : (member.approvalStatus || 'APPROVED')}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-black font-mono text-slate-950">
                    {eq ? formatMoney(eq.netContribution, showNumbers) : (showNumbers ? '$0.00' : '••••••')}
                  </div>
                  <div className="text-xs font-bold text-emerald-700">
                    {eq ? (showNumbers ? `${eq.profitSharePercentage.toFixed(1)}% equity` : '••% equity') : '0%'}
                  </div>
                  {eq && eq.targetContributionUsd > 0 && (
                    <div className="text-[10px] text-slate-600 font-medium mt-0.5">
                      Goal: {formatMoney(eq.targetContributionUsd, showNumbers)}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions row */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-[#F0EBE1] text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMember(member);
                    setShowContributionSheet(true);
                  }}
                  className="flex-1 min-w-[95px] py-1.5 px-2 rounded-lg bg-[#FAF8F5] border border-[#E0D7C6] text-slate-900 font-bold text-center hover:bg-[#F0EBE1] cursor-pointer transition-colors shadow-xs"
                >
                  + Deposit
                </button>
                {canManage && isMock && (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleCopyClaimInvite(member)}
                      className="flex-1 min-w-[115px] py-1.5 px-2 rounded-lg bg-amber-100 border border-amber-300 text-amber-950 font-bold text-center hover:bg-amber-200 cursor-pointer transition-colors shadow-xs"
                    >
                      {copiedId === member.id ? '✓ Copied Code' : '🔑 Share Claim Code'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLinkModalContext({ placeholder: member })}
                      className="flex-1 min-w-[115px] py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-center cursor-pointer transition-colors shadow-xs"
                    >
                      🔗 Link to User
                    </button>
                  </>
                )}
                {canManage && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMember(member);
                      setShowRoleSheet(true);
                    }}
                    className="py-1.5 px-3 rounded-lg bg-[#FAF8F5] border border-[#E0D7C6] text-slate-900 font-bold text-center hover:bg-[#F0EBE1] cursor-pointer transition-colors shadow-xs"
                  >
                    ⚙️ Role
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sheets */}
      <AddMemberSheet
        isOpen={showAddMember}
        onClose={() => setShowAddMember(false)}
        activeMember={activeMember}
        onMemberAdded={() => setTick((t) => t + 1)}
      />

      <BulkMockContributorsSheet
        isOpen={showBulkAdd}
        onClose={() => setShowBulkAdd(false)}
        activeMember={activeMember}
        onCompleted={() => setTick((t) => t + 1)}
      />

      {linkModalContext && (
        <LinkMemberSheet
          isOpen={Boolean(linkModalContext)}
          onClose={() => setLinkModalContext(null)}
          placeholderMember={linkModalContext.placeholder}
          activeMember={activeMember}
          preselectedTargetMemberId={linkModalContext.targetId}
          claimRequestId={linkModalContext.requestId}
          onLinked={() => setTick((t) => t + 1)}
        />
      )}

      <ClaimProfileSheet
        isOpen={showClaimSheet}
        onClose={() => setShowClaimSheet(false)}
        activeMember={activeMember}
        onClaimedOrRequested={() => setTick((t) => t + 1)}
      />

      {selectedMember && (
        <>
          <MemberRoleSheet
            isOpen={showRoleSheet}
            onClose={() => {
              setShowRoleSheet(false);
              setSelectedMember(null);
            }}
            member={selectedMember}
            activeMember={activeMember}
            onUpdated={() => setTick((t) => t + 1)}
          />

          <ContributionSheet
            isOpen={showContributionSheet}
            onClose={() => {
              setShowContributionSheet(false);
              setSelectedMember(null);
            }}
            targetMember={selectedMember}
            activeMember={activeMember}
          />
        </>
      )}

      <InviteCodeSheet
        isOpen={showInviteSheet}
        onClose={() => setShowInviteSheet(false)}
        activeMember={activeMember}
      />
    </div>
  );
};
