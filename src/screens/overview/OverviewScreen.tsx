import React from 'react';
import { BalanceCard } from '../../components/ui/BalanceCard.tsx';
import { QuickActions } from '../../components/ui/QuickActions.tsx';
import { PageSearch } from './PageSearch.tsx';
import { RecentChips } from './RecentChips.tsx';
import { HubList } from './HubList.tsx';
import { RecentActivity } from './RecentActivity.tsx';
import { useNavigation } from '../../navigation/useNavigation.ts';
import { usePullToRefresh } from '../../hooks/usePullToRefresh.ts';
import { dataService } from '../../services/dataService.ts';
import { getRoleMeta } from '../../utils/permissions.ts';
import { Loader2, Sparkles, X, ChevronRight, Compass } from 'lucide-react';
import { InviteCodeSheet } from '../../sheets/common/InviteCodeSheet.tsx';
import { useRunway } from '../../hooks/useRunway.ts';
import { RunwayHeroCard } from '../../components/runway/RunwayHeroCard.tsx';
import type { AgroStateSnapshot, OrgMember, AuditNotificationEvent } from '../../types/agro.ts';
import type { Organization } from '../../types/organization.ts';

export interface OverviewScreenProps {
  state: AgroStateSnapshot;
  activeMember: OrgMember;
  activeOrg?: Organization | null;
  leftMoney: number;
  totalNav: number;
  totalReceivables: number;
  totalDebt: number;
  totalLoansGiven: number;
  showNumbers?: boolean;
  onRefresh: () => Promise<void>;
  onLogExpense: () => void;
  onRecordSale: () => void;
  onAddLoanDebt: () => void;
  onBroadcast: () => void;
  runwayMonthsRemaining?: number;
  onOpenSiteManager?: () => void;
  onOpenNotifications?: () => void;
  onSelectNotification?: (notification: AuditNotificationEvent) => void;
}

export const OverviewScreen: React.FC<OverviewScreenProps> = ({
  state,
  activeMember,
  activeOrg,
  leftMoney,
  totalNav,
  totalReceivables,
  totalDebt,
  totalLoansGiven,
  showNumbers = true,
  onRefresh,
  onLogExpense,
  onRecordSale,
  onAddLoanDebt,
  onBroadcast,
  runwayMonthsRemaining,
  onOpenSiteManager,
  onOpenNotifications,
  onSelectNotification,
}) => {
  const { navigate } = useNavigation();
  const { isRefreshing, pullDistance, handlers } = usePullToRefresh(onRefresh);
  const [showInviteSheet, setShowInviteSheet] = React.useState(false);

  const org =
    activeOrg ||
    (state.organizations || []).find((o) => o.id === activeMember.orgId) ||
    dataService.getActiveOrganization(activeMember.orgId);

  const isAgro = org?.type !== 'GENERAL_VENTURE';
  const isAdmin = activeMember.role === 'ORG_ADMIN' || activeMember.role === 'SYNDICATE_ADMIN';

  const welcomeKey = `agro_welcome_seen_${activeMember.id}_${org?.id || 'default'}`;
  const [showWelcome, setShowWelcome] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem(welcomeKey);
  });

  const handleDismissWelcome = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(welcomeKey, 'true');
    }
    setShowWelcome(false);
  };

  // Compute metrics
  const activeCreditSales = (state.creditSales || []).filter((s) => s.status !== 'SETTLED');
  const creditOverdueCount = activeCreditSales.filter(
    (s) => new Date(s.agreedSettlementDate).getTime() < Date.now()
  ).length;
  const creditSalesOutstanding = activeCreditSales.reduce(
    (acc, s) => acc + (s.creditBalanceRemaining ?? (s.totalSaleAmount - (s.depositPaidCash || 0))),
    0
  );

  const totalPool = (state.capitalContributions || []).reduce((acc, c) => acc + c.amount, 0);

  const assetSummaries = dataService.computeFixedAssetGroupSummaries();
  const fixedAssetsVal = assetSummaries.reduce((acc: number, a: any) => acc + a.currentValue, 0);

  const livestockStatuses = dataService.computeLivestockStatuses();
  const flockCount = livestockStatuses.reduce((acc: number, s: any) => acc + s.currentLiveHeadcount, 0);
  const livestockValuation = livestockStatuses.reduce((acc: number, s: any) => acc + s.estimatedCurrentValueUsd, 0);

  const runway = useRunway(undefined, activeMember.orgId);

  return (
    <div {...handlers} className="p-4 sm:p-5 space-y-4 max-w-xl mx-auto">
      {/* Pull To Refresh Indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          style={{ height: `${pullDistance}px` }}
          className="flex items-center justify-center overflow-hidden transition-all text-slate-500"
        >
          <Loader2 className={`w-5 h-5 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
        </div>
      )}

      {/* Welcome Note for New User introducing them to their Organization */}
      {showWelcome && org && (
        <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-amber-50 border-2 border-emerald-400/50 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3 relative animate-fade-in">
          <button
            type="button"
            onClick={handleDismissWelcome}
            className="absolute top-3 right-3 p-1 rounded-full text-slate-400 hover:text-slate-800 hover:bg-black/5 cursor-pointer transition-colors"
            title="Dismiss welcome note"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-base shadow-xs shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="inline-block text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full border border-emerald-300">
                {isAdmin ? '🎉 Organization Founded' : '👋 Welcome to your Team'}
              </span>
              <h3 className="text-sm sm:text-base font-black text-slate-950 mt-0.5">
                {isAdmin ? `Welcome to ${org.name}!` : `Welcome to ${org.name}, ${activeMember.fullName}!`}
              </h3>
            </div>
          </div>

          <p className="text-xs text-slate-700 leading-relaxed font-medium">
            {isAdmin ? (
              <>
                You have registered <strong>{org.name}</strong> as an <strong>{org.type === 'AGRO_FARMING' ? 'Agro-Farming & Livestock Enterprise' : 'General Business Venture'}</strong>. Invite members to your syndicate using active 24-hr code <span className="font-mono font-black text-emerald-900 bg-white px-1.5 py-0.5 rounded-md border border-emerald-300 shadow-2xs">{org.currentInviteCode || 'SEED-8492'}</span>.
              </>
            ) : (
              <>
                You have joined <strong>{org.name}</strong> as a <strong>{getRoleMeta(activeMember.role).label}</strong>. This workspace operates as an <strong>{org.type === 'AGRO_FARMING' ? 'Agro-Farming & Livestock Enterprise' : 'General Business Venture'}</strong>. You can view member capital pools, track live operations, submit expenses, and collaborate.
              </>
            )}
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowInviteSheet(true)}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
              >
                🔑 Share Invite Code
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('settings')}
              className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold shadow-xs cursor-pointer transition-colors"
            >
              🏢 View Org Details
            </button>
            <button
              type="button"
              onClick={handleDismissWelcome}
              className="px-3.5 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 text-xs font-semibold cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Organisation Identity & Workspace Card */}
      <div
        onClick={() => navigate('settings')}
        className="bg-white border border-[#E8DFCE] hover:border-emerald-500 rounded-2xl p-3.5 shadow-xs flex items-center justify-between gap-3 cursor-pointer transition-all group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center text-lg shrink-0">
            {org?.type === 'AGRO_FARMING' ? '🌱' : '💼'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-sm font-black text-slate-950">
                {org?.name || 'Capital Seed'}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200 text-[10px] font-bold">
                {org?.type === 'AGRO_FARMING' ? 'Agro-Farming' : 'General Venture'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 font-medium mt-0.5 truncate">
              {getRoleMeta(activeMember.role).label} · Target: ${(org?.defaultTargetContributionUsd || 1000).toLocaleString()} ({org?.contributionPaceDefault === 'MONTHLY' ? 'Monthly' : org?.contributionPaceDefault === 'MILESTONE' ? 'Milestone' : 'Flexible'})
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 text-slate-400 group-hover:text-emerald-700 transition-colors">
          <span className="text-[11px] font-bold text-slate-500 hidden sm:inline">Settings</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>

      {/* 1. Consolidated Mobile Banking Balance Card */}
      <BalanceCard
        totalNav={totalNav}
        leftMoney={leftMoney}
        receivables={totalReceivables}
        liabilities={totalDebt}
        showNumbers={showNumbers}
        onCardClick={() => navigate('financialSummary')}
      />

      {/* 2. 4 Circular Quick Action Buttons (56dp) */}
      <QuickActions
        isAgro={isAgro}
        onLogExpense={onLogExpense}
        onRecordSale={onRecordSale}
        onContributePool={() => navigate('capitalPool')}
        onAddLoanDebt={onAddLoanDebt}
        onBroadcast={onBroadcast}
      />

      {/* 2.2 Runway Capital Planning Hero Card for General Business */}
      {!isAgro && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-indigo-600" />
              <span>Capital Runway &amp; Spend Gate</span>
            </span>
            <button
              type="button"
              onClick={() => navigate('runway')}
              className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 cursor-pointer"
            >
              Open Plan →
            </button>
          </div>

          {runway.currentPlan ? (
            <RunwayHeroCard
              plan={runway.currentPlan}
              layers={runway.fundingLayers}
              runwayMonths={runway.runwayMonths}
              currentMember={activeMember}
              onNavigateTab={() => navigate('runway')}
            />
          ) : (
            <div
              onClick={() => navigate('runway')}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 p-4 sm:p-5 text-white shadow-sm border border-indigo-700/50 cursor-pointer hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/30 border border-indigo-400/30 text-[10px] font-bold text-indigo-200 uppercase tracking-wider">
                    ✨ Capital Planning
                  </span>
                  <h4 className="text-sm sm:text-base font-black text-white tracking-tight">
                    Start Venture Capital Runway
                  </h4>
                  <p className="text-xs text-indigo-100/80 leading-relaxed line-clamp-2">
                    Map required expenditure lines, gather member pledges, and enforce spend discipline.
                  </p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-white/10 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Compass className="w-5 h-5 text-amber-300" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2.5 Quick Page & Settings Search with Kind Filters */}
      <PageSearch isAdmin={isAdmin} isAgro={isAgro} />

      {/* 3. Recently Opened Pages Carousel */}
      <RecentChips isAgroEnabled={isAgro} />

      {/* 4. Banking Hub Rows (Icon · Title · Preview) */}
      <HubList
        isAgroEnabled={isAgro}
        activeMember={activeMember}
        showNumbers={showNumbers}
        poolContributed={totalPool}
        creditOutstanding={creditSalesOutstanding}
        creditOverdueCount={creditOverdueCount}
        debtOutstanding={totalDebt}
        loansGivenOutstanding={totalLoansGiven}
        fixedAssetsValue={fixedAssetsVal}
        runwayMonthsRemaining={runwayMonthsRemaining}
        livestockFlockCount={flockCount}
        livestockValuation={livestockValuation}
        generalStockValue={fixedAssetsVal}
        unreadBroadcastsCount={0}
        onOpenSiteManager={onOpenSiteManager}
      />

      {/* 5. Recent Activity Feed */}
      <RecentActivity
        notifications={
          activeMember?.orgId
            ? (state.auditNotifications || []).filter((n) => !n.orgId || n.orgId === activeMember.orgId)
            : (state.auditNotifications || [])
        }
        showNumbers={showNumbers}
        activeMember={activeMember}
        onOpenNotificationsDrawer={onOpenNotifications}
        onSelectNotification={onSelectNotification}
      />

      <InviteCodeSheet
        isOpen={showInviteSheet}
        onClose={() => setShowInviteSheet(false)}
        activeMember={activeMember}
      />
    </div>
  );
};
