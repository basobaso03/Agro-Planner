import React, { useState } from 'react';
import { dataService } from '../../services/dataService.ts';
import { formatMoney } from '../../utils/currency.ts';
import { PERMISSIONS } from '../../utils/permissions.ts';
import { AddMemberSheet } from '../../sheets/pool/AddMemberSheet.tsx';
import { MemberRoleSheet } from '../../sheets/common/MemberRoleSheet.tsx';
import { TargetFundraisingSheet } from '../../sheets/pool/TargetFundraisingSheet.tsx';
import { InviteCodeSheet } from '../../sheets/common/InviteCodeSheet.tsx';
import { ContributionSheet } from '../../sheets/pool/ContributionSheet.tsx';
import type { OrgMember } from '../../types/agro.ts';

export interface MembersScreenProps {
  activeMember: OrgMember;
}

export const MembersScreen: React.FC<MembersScreenProps> = ({ activeMember }) => {
  const [selectedMember, setSelectedMember] = useState<OrgMember | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showRoleSheet, setShowRoleSheet] = useState(false);
  const [showTargetSheet, setShowTargetSheet] = useState(false);
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [showContributionSheet, setShowContributionSheet] = useState(false);

  const members = dataService.getState().members.filter(
    (m) => !activeMember.orgId || m.orgId === activeMember.orgId
  );
  const equities = dataService.computeMemberEquitySummaries();

  const canManage = PERMISSIONS.canManageMembers(activeMember.role);

  return (
    <div className="flex-1 flex flex-col p-4 pb-24 max-w-2xl mx-auto w-full space-y-4">
      {/* Top Banner & Quick Actions */}
      <div className="bg-slate-900 text-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold">Syndicate Governance</h1>
            <p className="text-xs text-slate-400 mt-0.5">{members.length} registered partners</p>
          </div>
          <button
            type="button"
            onClick={() => setShowInviteSheet(true)}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-semibold text-xs flex items-center gap-1.5"
          >
            <span>🔑</span>
            <span>Invite Code</span>
          </button>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => setShowAddMember(true)}
            className="w-full py-2.5 px-3 rounded-xl bg-white text-slate-900 font-semibold text-xs text-center active:scale-[0.99] transition-all"
          >
            + Register New Member
          </button>
        )}
      </div>

      {/* Members List */}
      <div className="space-y-3">
        <div className="font-bold text-slate-900 dark:text-white text-sm">Partners & Operators</div>
        <div className="space-y-2.5">
          {members.map((member) => {
            const eq = equities.find((e: any) => e.member.id === member.id);
            return (
              <div
                key={member.id}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-sm shrink-0">
                      {member.fullName.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">
                        {member.fullName}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {member.role} · {member.approvalStatus || 'APPROVED'}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      {eq ? formatMoney(eq.netContribution) : '$0.00'}
                    </div>
                    <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      {eq ? `${eq.profitSharePercentage.toFixed(1)}% equity` : '0%'}
                    </div>
                  </div>
                </div>

                {/* Actions row */}
                <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMember(member);
                      setShowContributionSheet(true);
                    }}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-center hover:bg-slate-100"
                  >
                    + Deposit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMember(member);
                      setShowTargetSheet(true);
                    }}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-center hover:bg-slate-100"
                  >
                    🎯 Target
                  </button>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMember(member);
                        setShowRoleSheet(true);
                      }}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-center hover:bg-slate-100"
                    >
                      ⚙️ Clearances
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
          />

          <TargetFundraisingSheet
            isOpen={showTargetSheet}
            onClose={() => {
              setShowTargetSheet(false);
              setSelectedMember(null);
            }}
            member={selectedMember}
            activeMember={activeMember}
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

