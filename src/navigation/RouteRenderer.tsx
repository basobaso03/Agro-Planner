import React, { useRef, useEffect } from 'react';
import { useNavigation } from './useNavigation.ts';
import { TabHost } from './TabHost.tsx';
import { ScreenHost } from './ScreenHost.tsx';
import { OverviewScreen } from '../screens/overview/OverviewScreen.tsx';
import { BatchListScreen } from '../screens/livestock/BatchListScreen.tsx';
import { BatchDetailScreen } from '../screens/livestock/BatchDetailScreen.tsx';
import { CheckpointAgendaScreen } from '../screens/livestock/CheckpointAgendaScreen.tsx';
import { FeedInventoryScreen } from '../screens/livestock/FeedInventoryScreen.tsx';
import { SiteCompareScreen } from '../screens/livestock/SiteCompareScreen.tsx';
import { OperationsHubScreen } from '../screens/operations/OperationsHubScreen.tsx';
import { StockInventoryScreen } from '../screens/operations/StockInventoryScreen.tsx';
import { StockMovementLedger } from '../screens/operations/StockMovementLedger.tsx';
import { MoneyScreen } from '../screens/money/MoneyScreen.tsx';
import { FinancialSummaryScreen } from '../screens/money/FinancialSummaryScreen.tsx';
import { CreditSalesScreen } from '../screens/credit/CreditSalesScreen.tsx';
import { SaleDetailScreen } from '../screens/credit/SaleDetailScreen.tsx';
import { LoansDebtsScreen } from '../screens/loans/LoansDebtsScreen.tsx';
import { LoanDetailScreen } from '../screens/loans/LoanDetailScreen.tsx';
import { DebtDetailScreen } from '../screens/loans/DebtDetailScreen.tsx';
import { MoreScreen } from '../screens/more/MoreScreen.tsx';
import { MembersScreen } from '../screens/more/MembersScreen.tsx';
import { AuditLedgerScreen } from '../screens/more/AuditLedgerScreen.tsx';
import { BroadcastsScreen } from '../screens/more/BroadcastsScreen.tsx';
import { SyncStatusScreen } from '../screens/more/SyncStatusScreen.tsx';
import { StorageManagerScreen } from '../screens/more/StorageManagerScreen.tsx';
import { NotificationPrefsScreen } from '../screens/more/NotificationPrefsScreen.tsx';
import { CurrencyLocaleScreen } from '../screens/more/CurrencyLocaleScreen.tsx';
import { RecentScreen } from '../screens/more/RecentScreen.tsx';
import { ExpensesFeedTab } from '../components/ExpensesFeedTab.tsx';
import { PoolEquityTab } from '../components/PoolEquityTab.tsx';
import { AssetsTab } from '../components/AssetsTab.tsx';
import { RunwayTab } from '../components/runway/RunwayTab.tsx';
import { UserSettingsTab } from '../components/UserSettingsTab.tsx';
import { dataService } from '../services/dataService.ts';
import type {
  AgroStateSnapshot,
  OrgMember,
  FarmLocation,
  FinancialSummary,
  MemberEquitySummary,
  LivestockComputedStatus,
  FixedAssetGroupSummary,
  FeedInventorySummary,
  FixedAssetCategory,
  FixedAssetLedgerEvent,
  ExpenseCategory,
  FeedLedgerEvent,
  Role,
  AuditNotificationEvent,
} from '../types/agro.ts';

export interface RouteRendererProps {
  state: AgroStateSnapshot;
  activeMember: OrgMember;
  locations: FarmLocation[];
  selectedLocationId: string;
  financials: FinancialSummary;
  memberEquities: MemberEquitySummary[];
  livestockStatuses: LivestockComputedStatus[];
  fixedAssetGroups: FixedAssetGroupSummary[];
  feedSummaries: FeedInventorySummary[];
  isAgroEnabled: boolean;
  showNumbers?: boolean;
  onToggleShowNumbers?: () => void;
  cloudUserEmail?: string | null;
  onRefresh: () => Promise<void>;
  onSignOut?: () => void;
  onLogExpense: () => void;
  onRecordSale: () => void;
  onAddLoanDebt: () => void;
  onBroadcast: () => void;
  onOpenSiteManager?: () => void;
  onOpenNotifications?: () => void;
  onSelectNotification?: (notification: AuditNotificationEvent) => void;
}

export const RouteRenderer: React.FC<RouteRendererProps> = ({
  state,
  activeMember,
  locations,
  selectedLocationId,
  financials,
  memberEquities,
  livestockStatuses,
  fixedAssetGroups,
  feedSummaries,
  isAgroEnabled,
  showNumbers = true,
  onToggleShowNumbers,
  cloudUserEmail,
  onRefresh,
  onSignOut,
  onLogExpense,
  onRecordSale,
  onAddLoanDebt,
  onBroadcast,
  onOpenSiteManager,
  onOpenNotifications,
  onSelectNotification,
}) => {
  const { currentRoute, activeTab, navigate, pop } = useNavigation();

  const activeOrg =
    (state.organizations || []).find((o) => o.id === activeMember.orgId) ||
    dataService.getActiveOrganization(activeMember.orgId);

  // If at root of tab, render the tab root screen
  const routeId = currentRoute.id;

  // If at root of any primary bottom tab, preserve state memory with TabHost (Fix B11)
  const isRootTab = ['overview', 'operations', 'money', 'more'].includes(routeId);

  const tabScrollMapRef = useRef<Record<string, number>>({});
  const prevIsRootTabRef = useRef<boolean>(isRootTab);
  const prevActiveTabRef = useRef<string>(activeTab);

  useEffect(() => {
    const mainEl = document.querySelector('main');
    if (!mainEl) return;

    // Track scroll events while on a root tab
    const handleScroll = () => {
      if (['overview', 'operations', 'money', 'more'].includes(currentRoute.id)) {
        tabScrollMapRef.current[activeTab] = mainEl.scrollTop;
      }
    };

    mainEl.addEventListener('scroll', handleScroll, { passive: true });

    // Transitioning from pushed screen back to root tab: restore scroll
    if (isRootTab && !prevIsRootTabRef.current) {
      const saved = tabScrollMapRef.current[activeTab] || 0;
      requestAnimationFrame(() => {
        if (mainEl) mainEl.scrollTop = saved;
      });
    } else if (!isRootTab && prevIsRootTabRef.current) {
      // Pushing a new screen: reset pushed screen to top
      mainEl.scrollTop = 0;
    } else if (isRootTab && prevActiveTabRef.current !== activeTab) {
      // Switched between tabs: restore the target tab's scroll
      const saved = tabScrollMapRef.current[activeTab] || 0;
      requestAnimationFrame(() => {
        if (mainEl) mainEl.scrollTop = saved;
      });
    }

    prevIsRootTabRef.current = isRootTab;
    prevActiveTabRef.current = activeTab;

    return () => {
      mainEl.removeEventListener('scroll', handleScroll);
    };
  }, [isRootTab, activeTab, currentRoute.id]);

  // Pushed screens across multi-stack navigation hosted with ScreenHost animations
  const renderPushedScreen = () => {
    switch (routeId) {
      case 'batchDetail':
      case 'livestock-detail':
        return <BatchDetailScreen batchId={currentRoute.params?.id} activeMember={activeMember} showNumbers={showNumbers} />;

      case 'checkpointAgenda':
        return <CheckpointAgendaScreen activeMember={activeMember} />;

      case 'feedInventory':
        return <FeedInventoryScreen activeMember={activeMember} />;

      case 'siteCompare':
      case 'site-compare':
        return <SiteCompareScreen activeMember={activeMember} showNumbers={showNumbers} onOpenSiteManager={onOpenSiteManager} />;

      case 'stockInventory':
      case 'operations-inventory':
        if (!isAgroEnabled) {
          return <OperationsHubScreen activeMember={activeMember} showNumbers={showNumbers} onOpenSiteManager={undefined} />;
        }
        return <StockInventoryScreen activeMember={activeMember} />;

      case 'stockMovementLedger':
      case 'operations-stock-ledger':
        if (!isAgroEnabled) {
          return <OperationsHubScreen activeMember={activeMember} showNumbers={showNumbers} onOpenSiteManager={undefined} />;
        }
        return <StockMovementLedger activeMember={activeMember} />;

      case 'creditSales':
      case 'credit-sales':
        if (!isAgroEnabled) {
          return <OperationsHubScreen activeMember={activeMember} showNumbers={showNumbers} onOpenSiteManager={undefined} />;
        }
        return <CreditSalesScreen activeMember={activeMember} isAgroEnabled={isAgroEnabled} showNumbers={showNumbers} />;

      case 'saleDetail':
      case 'sale-detail':
        return (
          <SaleDetailScreen
            saleId={currentRoute.params?.id || ''}
            activeMember={activeMember}
            onBack={() => pop()}
            showNumbers={showNumbers}
          />
        );

      case 'loansDebts':
      case 'loans-debts':
        return <LoansDebtsScreen activeMember={activeMember} showNumbers={showNumbers} />;

      case 'loanDetail':
        return (
          <LoanDetailScreen
            loanId={currentRoute.params?.id || ''}
            activeMember={activeMember}
            onBack={() => pop()}
            showNumbers={showNumbers}
          />
        );

      case 'debtDetail':
        return (
          <DebtDetailScreen
            debtId={currentRoute.params?.id || ''}
            activeMember={activeMember}
            onBack={() => pop()}
            showNumbers={showNumbers}
          />
        );

      case 'financialSummary':
      case 'financial-summary':
        return <FinancialSummaryScreen activeMember={activeMember} showNumbers={showNumbers} />;

      case 'members':
        return <MembersScreen activeMember={activeMember} showNumbers={showNumbers} />;

      case 'auditLedger':
      case 'audit-ledger':
        return <AuditLedgerScreen activeMember={activeMember} />;

      case 'broadcastCenter':
      case 'broadcasts':
        return <BroadcastsScreen activeMember={activeMember} />;

      case 'syncStatus':
      case 'sync-status':
        return <SyncStatusScreen activeMember={activeMember} />;

      case 'storageManager':
      case 'storage-manager':
        return <StorageManagerScreen activeMember={activeMember} />;

      case 'notificationPrefs':
      case 'notification-prefs':
        return <NotificationPrefsScreen activeMember={activeMember} />;

      case 'currencyLocale':
      case 'currency-locale':
        return <CurrencyLocaleScreen activeMember={activeMember} />;

      case 'recentPages':
      case 'recent-pages':
        return <RecentScreen activeMember={activeMember} isAgroEnabled={isAgroEnabled} />;

      case 'runway':
      case 'runwayPlan':
        return (
          <RunwayTab
            currentMember={activeMember}
            locations={locations}
            onOpenExpenseModal={onLogExpense}
            showNumbers={showNumbers}
          />
        );

      case 'fixedAssets':
      case 'assets':
        return (
          <div className="px-3.5 sm:px-5 py-3">
            <AssetsTab
              assetGroups={fixedAssetGroups}
              locations={locations}
              selectedLocationId={selectedLocationId}
              activeMember={activeMember}
              leftMoney={financials.leftMoney}
              onLogAssetEvent={(data) =>
                dataService.logFixedAssetEvent({ ...data, actor: activeMember })
              }
              onTransferAsset={(data) =>
                dataService.transferFixedAssetBetweenLocations({
                  ...data,
                  actor: activeMember,
                })
              }
              showNumbers={showNumbers}
            />
          </div>
        );

      case 'capitalPool':
        return (
          <div className="px-3.5 sm:px-5 py-3">
            <PoolEquityTab
              financials={financials}
              memberEquities={memberEquities}
              capitalContributions={state.capitalContributions || []}
              locations={locations}
              activeMember={activeMember}
              onAddMember={(data) => dataService.addMember({ ...data, actor: activeMember })}
              onLogContribution={(data) =>
                dataService.logCapitalContribution({ ...data, actor: activeMember })
              }
              showNumbers={showNumbers}
            />
          </div>
        );

      case 'expenses':
        return (
          <div className="px-3.5 sm:px-5 py-3">
            <ExpensesFeedTab
              expenses={state.expenses || []}
              feedSummaries={feedSummaries}
              financials={financials}
              locations={locations}
              livestockStatuses={livestockStatuses}
              selectedLocationId={selectedLocationId}
              activeMember={activeMember}
              onLogExpense={(data) => dataService.logExpense({ ...data, actor: activeMember })}
              onApproveMultiSig={(txId) => dataService.approveMultiSigExpense(txId, activeMember)}
              onLogFeedEvent={(data) => dataService.logFeedEvent({ ...data, actor: activeMember })}
              showNumbers={showNumbers}
            />
          </div>
        );

      case 'settings':
      case 'helpOnboarding':
        return (
          <div className="px-3.5 sm:px-5 py-3">
            <UserSettingsTab
              activeMember={activeMember}
              session={null}
              locations={locations}
              activeOrg={activeOrg}
              onSignOut={onSignOut || (() => { })}
              targetSection={currentRoute.params?.section || null}
            />
          </div>
        );

      default:
        return (
          <OverviewScreen
            state={state}
            activeMember={activeMember}
            activeOrg={activeOrg}
            leftMoney={financials.leftMoney}
            totalNav={financials.totalNav ?? (financials.leftMoney + fixedAssetGroups.reduce((acc, a) => acc + a.currentValue, 0))}
            totalReceivables={
              (isAgroEnabled ? (financials.creditSalesReceivables ?? financials.totalCreditSalesOutstanding ?? 0) : 0) +
              (financials.loansGivenRecoverable ?? financials.totalLoansGivenOutstanding ?? 0)
            }
            totalDebt={financials.debtLiabilitiesOwed ?? financials.totalBorrowedDebtOutstanding ?? 0}
            totalLoansGiven={financials.loansGivenRecoverable ?? financials.totalLoansGivenOutstanding ?? 0}
            showNumbers={showNumbers}
            onRefresh={onRefresh}
            onLogExpense={onLogExpense}
            onRecordSale={onRecordSale}
            onAddLoanDebt={onAddLoanDebt}
            onBroadcast={onBroadcast}
            onOpenNotifications={onOpenNotifications}
            onSelectNotification={onSelectNotification}
          />
        );
    }
  };

  return (
    <>
      <div style={{ display: isRootTab ? 'block' : 'none' }} className="w-full">
        <TabHost
          overviewContent={
            <OverviewScreen
              state={state}
              activeMember={activeMember}
              activeOrg={activeOrg}
              leftMoney={financials.leftMoney}
              totalNav={financials.totalNav ?? (financials.leftMoney + fixedAssetGroups.reduce((acc, a) => acc + a.currentValue, 0))}
              totalReceivables={
                (isAgroEnabled ? (financials.creditSalesReceivables ?? financials.totalCreditSalesOutstanding ?? 0) : 0) +
                (financials.loansGivenRecoverable ?? financials.totalLoansGivenOutstanding ?? 0)
              }
              totalDebt={financials.debtLiabilitiesOwed ?? financials.totalBorrowedDebtOutstanding ?? 0}
              totalLoansGiven={financials.loansGivenRecoverable ?? financials.totalLoansGivenOutstanding ?? 0}
              showNumbers={showNumbers}
              onRefresh={onRefresh}
              onLogExpense={onLogExpense}
              onRecordSale={onRecordSale}
              onAddLoanDebt={onAddLoanDebt}
              onBroadcast={onBroadcast}
              onOpenSiteManager={isAgroEnabled ? onOpenSiteManager : undefined}
              onOpenNotifications={onOpenNotifications}
              onSelectNotification={onSelectNotification}
            />
          }
          operationsContent={
            isAgroEnabled ? (
              <BatchListScreen activeMember={activeMember} showNumbers={showNumbers} onRefresh={onRefresh} onOpenSiteManager={onOpenSiteManager} />
            ) : (
              <OperationsHubScreen activeMember={activeMember} showNumbers={showNumbers} onOpenSiteManager={undefined} />
            )
          }
          moneyContent={<MoneyScreen activeMember={activeMember} showNumbers={showNumbers} onToggleShowNumbers={onToggleShowNumbers} />}
          moreContent={
            <MoreScreen
              activeMember={activeMember}
              showNumbers={showNumbers}
              onToggleShowNumbers={onToggleShowNumbers}
              onSignOut={onSignOut}
              onOpenSiteManager={isAgroEnabled ? onOpenSiteManager : undefined}
            />
          }
        />
      </div>

      {!isRootTab && (
        <ScreenHost screenKey={routeId}>
          {renderPushedScreen()}
        </ScreenHost>
      )}
    </>
  );
};

