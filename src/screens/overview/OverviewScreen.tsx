import React from 'react';
import { BalanceCard } from '../../components/ui/BalanceCard.tsx';
import { QuickActions } from '../../components/ui/QuickActions.tsx';
import { RecentChips } from './RecentChips.tsx';
import { HubList } from './HubList.tsx';
import { RecentActivity } from './RecentActivity.tsx';
import { useNavigation } from '../../navigation/useNavigation.ts';
import { usePullToRefresh } from '../../hooks/usePullToRefresh.ts';
import { dataService } from '../../services/dataService.ts';
import { Loader2 } from 'lucide-react';
import type { AgroStateSnapshot, OrgMember } from '../../types/agro.ts';

export interface OverviewScreenProps {
  state: AgroStateSnapshot;
  activeMember: OrgMember;
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
}

export const OverviewScreen: React.FC<OverviewScreenProps> = ({
  state,
  activeMember,
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
}) => {
  const { navigate } = useNavigation();
  const { isRefreshing, pullDistance, handlers } = usePullToRefresh(onRefresh);

  const isAgro = (state.organizations || [])[0]?.type !== 'GENERAL_VENTURE';

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
        onLogExpense={onLogExpense}
        onRecordSale={onRecordSale}
        onAddLoanDebt={onAddLoanDebt}
        onBroadcast={onBroadcast}
      />

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
      <RecentActivity notifications={state.auditNotifications || []} showNumbers={showNumbers} />
    </div>
  );
};
