import React, { useState, useEffect } from 'react';
import { dataService } from '../../services/dataService.ts';
import { formatMoney } from '../../utils/currency.ts';
import { PERMISSIONS, getRoleMeta } from '../../utils/permissions.ts';
import { AddMemberSheet } from '../../sheets/pool/AddMemberSheet.tsx';
import { MemberRoleSheet } from '../../sheets/common/MemberRoleSheet.tsx';
import { InviteCodeSheet } from '../../sheets/common/InviteCodeSheet.tsx';
import { ContributionSheet } from '../../sheets/pool/ContributionSheet.tsx';
import type { OrgMember } from '../../types/agro.ts';

export interface MembersScreenProps {
  activeMember: OrgMember;
  showNumbers?: boolean;
}

export const MembersScreen: React.FC<MembersScreenProps> = ({
  activeMember,
  showNumbers = true,
}) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    return dataService.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, []);

  const [selectedMember, setSelectedMember] = useState<OrgMember | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showRoleSheet, setShowRoleSheet] = useState(false);
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [showContributionSheet, setShowContributionSheet] = useState(false);

  const members = dataService.getState().members.filter(
    (m) => !activeMember.orgId || m.orgId === activeMember.orgId
  );
  const equities = dataService.computeMemberEquitySummaries();

  const org =
    (dataService.getState().organizations || []).find((o) => o.id === activeMember.orgId) ||
    dataService.getActiveOrganization(activeMember.orgId);

  const canManage = PERMISSIONS.canManageMembers(activeMember.role);

  return (
    <div className="flex-1 flex flex-col p-4 pb-24 max-w-2xl mx-auto w-full space-y-4">
      {/* Top Banner & Quick Actions */}
      <div className="bg-white border border-[#E8DFCE] p-5 rounded-2xl shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">{org?.type === 'AGRO_FARMING' ? '🌱' : '💼'}</span>
              <h1 className="text-base font-black text-slate-950">{org?.name || 'Syndicate Governance'}</h1>
            </div>
            <p className="text-xs text-slate-600 font-medium mt-0.5">
              {org?.type === 'AGRO_FARMING' ? 'Agro-Farming & Livestock Enterprise' : 'General Business Venture'} · {members.length} registered partners
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() => setShowInviteSheet(true)}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              <span>🔑</span>
              <span>Invite Code</span>
            </button>
          )}
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => setShowAddMember(true)}
            className="w-full py-2.5 px-3 rounded-xl bg-[#FAF8F5] border border-[#E0D7C6] text-slate-950 font-bold text-xs text-center hover:bg-[#F0EBE1] active:scale-[0.99] transition-all cursor-pointer shadow-xs"
          >
            + Register New Member
          </button>
        )}
      </div>

      {/* Members List */}
      <div className="space-y-3">
        <div className="font-black text-slate-950 text-sm">Partners & Operators</div>
        <div className="space-y-2.5">
          {members.map((member) => {
            const eq = equities.find((e: any) => e.member.id === member.id);
            return (
              <div
                key={member.id}
                className="bg-white border border-[#E8DFCE] rounded-2xl p-4 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold flex items-center justify-center text-sm shrink-0">
                      {member.fullName.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-950">
                        {member.fullName}
                      </div>
                      <div className="text-xs text-slate-600 font-medium mt-0.5">
                        {getRoleMeta(member.role).label} · {member.approvalStatus || 'APPROVED'}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-black font-mono text-slate-950">
                      {eq ? formatMoney(eq.netContribution, showNumbers) : (showNumbers ? '$0.00' : '••••••')}
                    </div>
                    <div className="text-xs font-bold text-emerald-700">
                      {eq ? (showNumbers ? `${eq.profitSharePercentage.toFixed(1)}% equity` : '••% equity') : '0%'}
                    </div>
                    {eq && eq.targetContributionUsd > 0 && (
                      <div className="text-[10px] text-slate-600 font-medium mt-0.5">
                        Pledged: {formatMoney(eq.targetContributionUsd, showNumbers)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions row */}
                <div className="flex gap-2 pt-2 border-t border-[#F0EBE1] text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMember(member);
                      setShowContributionSheet(true);
                    }}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-[#FAF8F5] border border-[#E0D7C6] text-slate-900 font-bold text-center hover:bg-[#F0EBE1] cursor-pointer transition-colors shadow-xs"
                  >
                    + Deposit
                  </button>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMember(member);
                        setShowRoleSheet(true);
                      }}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-[#FAF8F5] border border-[#E0D7C6] text-slate-900 font-bold text-center hover:bg-[#F0EBE1] cursor-pointer transition-colors shadow-xs"
                    >
                      ⚙️ Change Role
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sheets */}
      <AddMemberSheet
        isOpen={showAddMember}
        onClose={() => setShowAddMember(false)}
        activeMember={activeMember}
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

