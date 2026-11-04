import React from 'react';
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
  cloudUserEmail?: string | null;
  onRefresh: () => Promise<void>;
  onSignOut?: () => void;
  onLogExpense: () => void;
  onRecordSale: () => void;
  onAddLoanDebt: () => void;
  onBroadcast: () => void;
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
  cloudUserEmail,
  onRefresh,
  onSignOut,
  onLogExpense,
  onRecordSale,
  onAddLoanDebt,
  onBroadcast,
}) => {
  const { currentRoute, activeTab, navigate, pop } = useNavigation();

  // If at root of tab, render the tab root screen
  const routeId = currentRoute.id;

  // If at root of any primary bottom tab, preserve state memory with TabHost (Fix B11)
  const isRootTab = ['overview', 'operations', 'money', 'more'].includes(routeId);

  if (isRootTab) {
    return (
      <TabHost
        overviewContent={
          <OverviewScreen
            state={state}
            activeMember={activeMember}
            leftMoney={financials.leftMoney}
            totalNav={financials.leftMoney + fixedAssetGroups.reduce((acc, a) => acc + a.currentValue, 0)}
            totalReceivables={financials.creditSalesReceivables ?? financials.totalCreditSalesOutstanding ?? 0}
            totalDebt={financials.debtLiabilitiesOwed ?? financials.totalBorrowedDebtOutstanding ?? 0}
            totalLoansGiven={financials.loansGivenRecoverable ?? financials.totalLoansGivenOutstanding ?? 0}
            showNumbers={showNumbers}
            onRefresh={onRefresh}
            onLogExpense={onLogExpense}
            onRecordSale={onRecordSale}
            onAddLoanDebt={onAddLoanDebt}
            onBroadcast={onBroadcast}
          />
        }
        operationsContent={
          isAgroEnabled ? (
            <BatchListScreen activeMember={activeMember} onRefresh={onRefresh} />
          ) : (
            <OperationsHubScreen activeMember={activeMember} />
          )
        }
        moneyContent={<MoneyScreen activeMember={activeMember} />}
        moreContent={
          <MoreScreen
            activeMember={activeMember}
            onSignOut={onSignOut}
          />
        }
      />
    );
  }

  // Pushed screens across multi-stack navigation hosted with ScreenHost animations
  const renderPushedScreen = () => {
    switch (routeId) {
      case 'batchDetail':
      case 'livestock-detail':
        return <BatchDetailScreen batchId={currentRoute.params?.id} activeMember={activeMember} />;

      case 'checkpointAgenda':
        return <CheckpointAgendaScreen activeMember={activeMember} />;

      case 'feedInventory':
        return <FeedInventoryScreen activeMember={activeMember} />;

      case 'siteCompare':
      case 'site-compare':
        return <SiteCompareScreen activeMember={activeMember} />;

      case 'stockInventory':
      case 'operations-inventory':
        return <StockInventoryScreen activeMember={activeMember} />;

      case 'stockMovementLedger':
      case 'operations-stock-ledger':
        return <StockMovementLedger activeMember={activeMember} />;

      case 'creditSales':
      case 'credit-sales':
        return <CreditSalesScreen activeMember={activeMember} isAgroEnabled={isAgroEnabled} />;

      case 'saleDetail':
      case 'sale-detail':
        return (
          <SaleDetailScreen
            saleId={currentRoute.params?.id || ''}
            activeMember={activeMember}
            onBack={() => pop()}
          />
        );

      case 'loansDebts':
      case 'loans-debts':
        return <LoansDebtsScreen activeMember={activeMember} />;

      case 'loanDetail':
        return (
          <LoanDetailScreen
            loanId={currentRoute.params?.id || ''}
            activeMember={activeMember}
            onBack={() => pop()}
          />
        );

      case 'debtDetail':
        return (
          <DebtDetailScreen
            debtId={currentRoute.params?.id || ''}
            activeMember={activeMember}
            onBack={() => pop()}
          />
        );

      case 'financialSummary':
      case 'financial-summary':
        return <FinancialSummaryScreen activeMember={activeMember} />;

      case 'members':
        return <MembersScreen activeMember={activeMember} />;

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

      case 'helpOnboarding':
        return (
          <div className="px-3.5 sm:px-5 py-3">
            <UserSettingsTab
              activeMember={activeMember}
              session={null}
              locations={locations}
              activeOrg={(state.organizations || [])[0]}
              onSignOut={onSignOut || (() => { })}
            />
          </div>
        );

      default:
        return (
          <OverviewScreen
            state={state}
            activeMember={activeMember}
            leftMoney={financials.leftMoney}
            totalNav={financials.leftMoney + fixedAssetGroups.reduce((acc, a) => acc + a.currentValue, 0)}
            totalReceivables={financials.creditSalesReceivables ?? financials.totalCreditSalesOutstanding ?? 0}
            totalDebt={financials.debtLiabilitiesOwed ?? financials.totalBorrowedDebtOutstanding ?? 0}
            totalLoansGiven={financials.loansGivenRecoverable ?? financials.totalLoansGivenOutstanding ?? 0}
            showNumbers={showNumbers}
            onRefresh={onRefresh}
            onLogExpense={onLogExpense}
            onRecordSale={onRecordSale}
            onAddLoanDebt={onAddLoanDebt}
            onBroadcast={onBroadcast}
          />
        );
    }
  };

  return (
    <ScreenHost screenKey={routeId}>
      {renderPushedScreen()}
    </ScreenHost>
  );
};

