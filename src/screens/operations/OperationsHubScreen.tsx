import React, { useState } from 'react';
import { useNavigation } from '../../navigation/useNavigation.ts';
import { dataService } from '../../services/dataService.ts';
import { ListRow } from '../../components/ui/ListRow.tsx';
import { LogExpenseSheet } from '../../sheets/expenses/LogExpenseSheet.tsx';
import type { OrgMember } from '../../types/agro.ts';

export interface OperationsHubScreenProps {
  activeMember: OrgMember;
  showNumbers?: boolean;
  onOpenSiteManager?: () => void;
}

export const OperationsHubScreen: React.FC<OperationsHubScreenProps> = ({
  activeMember,
  showNumbers = true,
}) => {
  const { navigate } = useNavigation();
  const [showExpenseSheet, setShowExpenseSheet] = useState(false);

  const assets = dataService.computeFixedAssetGroupSummaries();
  const pendingExpenses = (dataService.getState().expenses || []).filter(
    (e) => (!activeMember.orgId || e.orgId === activeMember.orgId) && (e.approvalStatus === 'PENDING_MULTISIG' || (e.approvalStatus as string) === 'PENDING')
  );
  const members = (dataService.getState().members || []).filter(
    (m) => !activeMember.orgId || m.orgId === activeMember.orgId
  );

  return (
    <div className="flex-1 flex flex-col p-4 pb-24 max-w-2xl mx-auto w-full space-y-4">
      {/* Operational KPI Header Card */}
      <div className="bg-white border border-[#E8DFCE] p-5 rounded-2xl shadow-xs space-y-3">
        <div className="text-xs text-slate-600 font-bold uppercase tracking-wider">
          Venture Operations &amp; Governance
        </div>
        <div className="grid grid-cols-2 gap-4 pt-1">
          <div>
            <div className="text-xs text-slate-600 font-medium">Pending Clearances</div>
            <div className={`text-xl font-black tracking-tight mt-0.5 ${pendingExpenses.length > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              {pendingExpenses.length > 0 ? `${pendingExpenses.length} Vouchers` : 'All Approved ✓'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-600 font-medium">Team Governance</div>
            <div className="text-xl font-black tracking-tight text-slate-950 mt-0.5">
              {members.length} Members
            </div>
          </div>
        </div>
      </div>

      {/* 4 Dedicated Operational Action Buttons */}
      <div className="grid grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => setShowExpenseSheet(true)}
          className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-center shadow-xs active:scale-[0.98] transition-all flex flex-col items-center gap-1.5 cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center font-bold text-base border border-rose-200">
            🧾
          </div>
          <div className="text-xs font-bold text-slate-900 dark:text-white">Log Expense</div>
        </button>

        <button
          type="button"
          onClick={() => navigate('broadcastCenter')}
          className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-center shadow-xs active:scale-[0.98] transition-all flex flex-col items-center gap-1.5 cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center font-bold text-base border border-blue-200">
            📢
          </div>
          <div className="text-xs font-bold text-slate-900 dark:text-white">Broadcast</div>
        </button>

        <button
          type="button"
          onClick={() => navigate('assets')}
          className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-center shadow-xs active:scale-[0.98] transition-all flex flex-col items-center gap-1.5 cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center font-bold text-base border border-emerald-200">
            🚜
          </div>
          <div className="text-xs font-bold text-slate-900 dark:text-white">Add Asset</div>
        </button>

        <button
          type="button"
          onClick={() => navigate('auditLedger')}
          className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-center shadow-xs active:scale-[0.98] transition-all flex flex-col items-center gap-1.5 cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-base border border-slate-300">
            🛡️
          </div>
          <div className="text-xs font-bold text-slate-900 dark:text-white">Audit Trail</div>
        </button>
      </div>

      {/* Operational Modules List */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl divide-y divide-slate-100 dark:divide-slate-700/60 shadow-xs overflow-hidden">
        <ListRow
          icon="🧾"
          title="Spend Approvals &amp; Multi-Sig"
          subtitle={
            pendingExpenses.length > 0
              ? `${pendingExpenses.length} expense vouchers awaiting signature`
              : 'All expense disbursements verified and approved'
          }
          badge={pendingExpenses.length > 0 ? `${pendingExpenses.length} Pending` : undefined}
          badgeVariant="amber"
          onClick={() => navigate('expenses')}
        />

        <ListRow
          icon="🚜"
          title="Fixed Assets &amp; Equipment"
          subtitle={`${assets.length} equipment items registered on ground`}
          onClick={() => navigate('assets')}
        />

        <ListRow
          icon="📢"
          title="Team Broadcast Dispatch Center"
          subtitle="Operational announcements, notices and alerts"
          onClick={() => navigate('broadcastCenter')}
        />

        <ListRow
          icon="👥"
          title="Syndicate Team &amp; Permissions"
          subtitle={`${members.length} members · 24-hr invite codes & roles`}
          onClick={() => navigate('members')}
        />

        <ListRow
          icon="🛡️"
          title="Audit Ledger"
          subtitle="Immutable verified trail of all operations"
          onClick={() => navigate('auditLedger')}
        />

        <ListRow
          icon="🔄"
          title="Sync &amp; Offline Outbox"
          subtitle="Background queue, cloud persistence & diagnostics"
          onClick={() => navigate('syncStatus')}
        />
      </div>

      {/* Sheets */}
      <LogExpenseSheet
        isOpen={showExpenseSheet}
        onClose={() => setShowExpenseSheet(false)}
        activeMember={activeMember}
      />
    </div>
  );
};

