import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { TabId, RouteId, RouteEntry } from './routes.ts';
import { nativeHaptics } from '../native/haptics.ts';
import { backHandlerRegistry } from './useBackHandler.ts';
import { recentsManager } from './recents.ts';

interface NavigationContextType {
  activeTab: TabId;
  currentRoute: RouteEntry;
  switchTab: (tab: TabId) => void;
  navigate: (routeId: RouteId, params?: Record<string, string>, title?: string) => void;
  pop: () => boolean;
  goBack: () => boolean;
  canPop: boolean;
  activeSheet: { sheetId: string; props?: any } | null;
  openSheet: (sheetId: string, props?: any) => void;
  closeSheet: () => void;
}

const NavigationContext = createContext<NavigationContextType | null>(null);

function resolveTabForRoute(routeId: RouteId): TabId {
  if (routeId === 'overview') return 'overview';

  const operationsRoutes = [
    'operations',
    'batchDetail',
    'livestock-detail',
    'checkpointAgenda',
    'feedInventory',
    'siteCompare',
    'site-compare',
    'stockInventory',
    'operations-inventory',
    'stockMovementLedger',
    'operations-stock-ledger',
  ];
  if (operationsRoutes.includes(routeId)) return 'operations';

  const moneyRoutes = [
    'money',
    'creditSales',
    'credit-sales',
    'saleDetail',
    'sale-detail',
    'loansDebts',
    'loans-debts',
    'loanDetail',
    'debtDetail',
    'financialSummary',
    'financial-summary',
    'capitalPool',
    'fixedAssets',
    'assets',
    'expenses',
    'runway',
    'runwayPlan',
  ];
  if (moneyRoutes.includes(routeId)) return 'money';

  return 'more';
}

function recordPageVisit(routeId: RouteId, params?: Record<string, string>, title?: string) {
  // Do not record root tabs as recent individual pages
  if (['overview', 'operations', 'money', 'more'].includes(routeId)) return;

  const paramId = params?.id ? `:${params.id}` : '';
  const entityId = `${routeId}${paramId}`;

  const isAgroRoute = [
    'batchDetail',
    'livestock-detail',
    'checkpointAgenda',
    'feedInventory',
    'siteCompare',
    'site-compare',
  ].includes(routeId);

  const isGeneralRoute = [
    'stockInventory',
    'operations-inventory',
    'stockMovementLedger',
    'operations-stock-ledger',
  ].includes(routeId);

  const workspaceMode = isAgroRoute
    ? 'AGRO_FARMING'
    : isGeneralRoute
      ? 'GENERAL_VENTURE'
      : 'BOTH';

  const metaMap: Record<string, { title: string; subtitle: string; icon: string }> = {
    batchDetail: {
      title: title || (params?.id ? `Batch #${params.id}` : 'Batch Detail'),
      subtitle: 'Livestock Batch Tracking',
      icon: 'Bird',
    },
    'livestock-detail': {
      title: title || (params?.id ? `Batch #${params.id}` : 'Batch Detail'),
      subtitle: 'Livestock Batch Tracking',
      icon: 'Bird',
    },
    checkpointAgenda: {
      title: 'Milestone Agenda',
      subtitle: 'Health & Vaccination Milestones',
      icon: 'Calendar',
    },
    feedInventory: {
      title: 'Feed Inventory',
      subtitle: 'Feed Stocks & Consumption',
      icon: 'Wheat',
    },
    siteCompare: {
      title: 'Site Comparison',
      subtitle: 'Multi-Location Performance',
      icon: 'BarChart2',
    },
    stockInventory: {
      title: 'Stock Inventory',
      subtitle: 'SKU Catalog & Reorder Levels',
      icon: 'Package',
    },
    stockMovementLedger: {
      title: 'Stock Movement Ledger',
      subtitle: 'Inventory Audit Trail',
      icon: 'ArrowLeftRight',
    },
    creditSales: {
      title: 'Sales on Credit',
      subtitle: 'Customer Receivables & Terms',
      icon: 'CreditCard',
    },
    saleDetail: {
      title: title || (params?.id ? `Credit Sale #${params.id}` : 'Credit Sale Detail'),
      subtitle: 'Customer Installment & Balance',
      icon: 'FileText',
    },
    loansDebts: {
      title: 'Loans & Debts Hub',
      subtitle: 'Liabilities & Advances',
      icon: 'Scale',
    },
    debtDetail: {
      title: title || (params?.id ? `Liability #${params.id}` : 'Debt Liability Detail'),
      subtitle: 'Creditor Repayment Ledger',
      icon: 'ArrowDownLeft',
    },
    loanDetail: {
      title: title || (params?.id ? `Loan #${params.id}` : 'Loan Given Detail'),
      subtitle: 'Outgrower Recovery Timeline',
      icon: 'ArrowUpRight',
    },
    financialSummary: {
      title: '9 Pillars Financial Breakdown',
      subtitle: 'Organization Net Worth & NAV',
      icon: 'PieChart',
    },
    capitalPool: {
      title: 'Capital Pool & Equities',
      subtitle: 'Member Contributions & Targets',
      icon: 'Coins',
    },
    fixedAssets: {
      title: 'Fixed Assets Ledger',
      subtitle: 'Equipment & Infrastructure',
      icon: 'Building2',
    },
    expenses: {
      title: 'Expense Feed',
      subtitle: 'Disbursements & Receipts',
      icon: 'Receipt',
    },
    runway: {
      title: 'Runway Capital Plan',
      subtitle: 'Spend Gate & Budget Allocations',
      icon: 'Compass',
    },
    members: {
      title: 'Team & Governance',
      subtitle: 'Member Directory & Roles',
      icon: 'Users',
    },
    auditLedger: {
      title: 'Cryptographic Audit Log',
      subtitle: 'Hash-Chained Operations Ledger',
      icon: 'ShieldCheck',
    },
    broadcastCenter: {
      title: 'Ground Broadcasts',
      subtitle: 'Urgent Operational Alerts',
      icon: 'Megaphone',
    },
    syncStatus: {
      title: 'Sync Status & Outbox',
      subtitle: 'Cloud Persistence Queue',
      icon: 'RefreshCw',
    },
    storageManager: {
      title: 'Storage & Backup',
      subtitle: 'IndexedDB & Offline Cache',
      icon: 'HardDrive',
    },
    notificationPrefs: {
      title: 'Notification Alerts',
      subtitle: 'Due Date Reminders & Alarms',
      icon: 'Bell',
    },
    currencyLocale: {
      title: 'Currency & Regional Units',
      subtitle: 'Symbol & Number Formatting',
      icon: 'Globe',
    },
    recentPages: {
      title: 'Recent Pages',
      subtitle: 'Browsing & Operation History',
      icon: 'Clock',
    },
  };

  const meta = metaMap[routeId] || {
    title: title || routeId,
    subtitle: 'CapitaSeed Navigation',
    icon: 'Compass',
  };

  recentsManager.record({
    id: entityId,
    routeId,
    title: meta.title,
    subtitle: meta.subtitle,
    icon: meta.icon,
    params: params || {},
    workspaceMode,
  });
}

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTabState] = useState<TabId>('overview');

  const [stacks, setStacks] = useState<Record<TabId, RouteEntry[]>>({
    overview: [{ key: 'root-overview', id: 'overview', title: 'Overview' }],
    operations: [{ key: 'root-operations', id: 'operations', title: 'Operations' }],
    money: [{ key: 'root-money', id: 'money', title: 'Money & Wealth' }],
    more: [{ key: 'root-more', id: 'more', title: 'More' }],
  });

  const [activeSheet, setActiveSheet] = useState<{ sheetId: string; props?: any } | null>(null);

  const currentStack = stacks[activeTab] || [];
  const currentRoute = currentStack[currentStack.length - 1] || {
    key: `root-${activeTab}`,
    id: activeTab,
    title: activeTab.toUpperCase(),
  };

  const switchTab = useCallback((tab: TabId) => {
    void nativeHaptics.selectionChanged();
    setActiveTabState((prevTab) => {
      if (prevTab === tab) {
        // Re-tap active tab: pop to root
        setStacks((prev) => ({
          ...prev,
          [tab]: [prev[tab][0]],
        }));
      }
      return tab;
    });
  }, []);

  const navigate = useCallback(
    (routeId: RouteId, params?: Record<string, string>, title?: string) => {
      void nativeHaptics.impact();
      const targetTab = resolveTabForRoute(routeId);

      const newEntry: RouteEntry = {
        key: `route_${routeId}_${Date.now()}`,
        id: routeId,
        params,
        title: title || routeId,
      };

      setStacks((prev) => ({
        ...prev,
        [targetTab]: [...prev[targetTab], newEntry],
      }));

      setActiveTabState(targetTab);

      // Record page visit to persistent Recents system
      recordPageVisit(routeId, params, title);

      if (typeof window !== 'undefined') {
        window.history.pushState({ tab: targetTab, routeId }, '');
      }
    },
    []
  );

  const pop = useCallback((): boolean => {
    if (activeSheet) {
      setActiveSheet(null);
      return true;
    }

    const tabStack = stacks[activeTab];
    if (tabStack.length > 1) {
      void nativeHaptics.selectionChanged();
      setStacks((prev) => ({
        ...prev,
        [activeTab]: prev[activeTab].slice(0, prev[activeTab].length - 1),
      }));
      return true;
    }

    if (activeTab !== 'overview') {
      setActiveTabState('overview');
      return true;
    }

    return false;
  }, [activeSheet, stacks, activeTab]);

  const openSheet = useCallback((sheetId: string, props?: any) => {
    void nativeHaptics.impact();
    setActiveSheet({ sheetId, props });
  }, []);

  const closeSheet = useCallback(() => {
    setActiveSheet(null);
  }, []);

  // Register navigation back stack with BackHandlerRegistry (Priority 10)
  useEffect(() => {
    backHandlerRegistry.init();
    return backHandlerRegistry.register('NAV_PROVIDER_STACK', 10, () => {
      return pop();
    });
  }, [pop]);

  return (
    <NavigationContext.Provider
      value={{
        activeTab,
        currentRoute,
        switchTab,
        navigate,
        pop,
        goBack: pop,
        canPop: currentStack.length > 1,
        activeSheet,
        openSheet,
        closeSheet,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return ctx;
}
