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
    'creditSales',
    'credit-sales',
    'saleDetail',
    'sale-detail',
    'stockInventory',
    'operations-inventory',
    'stockMovementLedger',
    'operations-stock-ledger',
  ].includes(routeId);

  const workspaceMode = isAgroRoute ? 'AGRO_FARMING' : 'BOTH';

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
      title: 'Audit Trail',
      subtitle: 'Tamper-Evident Operations Ledger',
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
    subtitle: 'Capital Seed Navigation',
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

const ROOT_OVERVIEW_ENTRY: RouteEntry = {
  key: 'root-overview',
  id: 'overview',
  title: 'Overview',
};

const TAB_ROOT_TITLES: Record<TabId, string> = {
  overview: 'Overview',
  operations: 'Operations',
  money: 'Money & Wealth',
  more: 'More',
};

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Unified stack always rooted at 'overview' so back navigation (both top-left arrow and phone hardware back button)
  // steps cleanly through all opened pages down to Overview before exiting.
  const [navStack, setNavStack] = useState<RouteEntry[]>([ROOT_OVERVIEW_ENTRY]);
  const [activeSheet, setActiveSheet] = useState<{ sheetId: string; props?: any } | null>(null);

  const currentRoute = navStack[navStack.length - 1] || ROOT_OVERVIEW_ENTRY;
  const activeTab = resolveTabForRoute(currentRoute.id);

  const switchTab = useCallback((tab: TabId) => {
    void nativeHaptics.selectionChanged();
    setNavStack((prev) => {
      if (tab === 'overview') {
        return [ROOT_OVERVIEW_ENTRY];
      }
      const top = prev[prev.length - 1];
      // If already on this tab root, keep stack as-is; if deep inside this tab, pop back to this tab's root
      if (top && top.id === tab) {
        return prev;
      }
      const tabRootEntry: RouteEntry = {
        key: `root-${tab}-${Date.now()}`,
        id: tab,
        title: TAB_ROOT_TITLES[tab] || tab,
      };
      const filtered = prev.filter((entry, idx) => idx === 0 || entry.id !== tab);
      return [...filtered, tabRootEntry];
    });
    backHandlerRegistry.ensureHistoryGuard();
  }, []);

  const navigate = useCallback(
    (routeId: RouteId, params?: Record<string, string>, title?: string) => {
      void nativeHaptics.impact();
      if (routeId === 'overview') {
        setNavStack([ROOT_OVERVIEW_ENTRY]);
        return;
      }

      const newEntry: RouteEntry = {
        key: `route_${routeId}_${Date.now()}`,
        id: routeId,
        params,
        title: title || routeId,
      };

      setNavStack((prev) => {
        const top = prev[prev.length - 1];
        // Avoid pushing duplicate consecutive route with identical id and params
        if (
          top &&
          top.id === routeId &&
          JSON.stringify(top.params || {}) === JSON.stringify(params || {})
        ) {
          return prev;
        }
        return [...prev, newEntry];
      });

      // Record page visit to persistent Recents system
      recordPageVisit(routeId, params, title);

      backHandlerRegistry.ensureHistoryGuard();
    },
    []
  );

  const pop = useCallback((): boolean => {
    if (activeSheet) {
      setActiveSheet(null);
      return true;
    }

    if (navStack.length > 1) {
      void nativeHaptics.selectionChanged();
      setNavStack((prev) => (prev.length > 1 ? prev.slice(0, prev.length - 1) : [ROOT_OVERVIEW_ENTRY]));
      return true;
    }

    if (currentRoute.id !== 'overview') {
      void nativeHaptics.selectionChanged();
      setNavStack([ROOT_OVERVIEW_ENTRY]);
      return true;
    }

    return false;
  }, [activeSheet, navStack.length, currentRoute.id]);

  const openSheet = useCallback((sheetId: string, props?: any) => {
    void nativeHaptics.impact();
    setActiveSheet({ sheetId, props });
    backHandlerRegistry.ensureHistoryGuard();
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

  const canPop = navStack.length > 1 || currentRoute.id !== 'overview';

  return (
    <NavigationContext.Provider
      value={{
        activeTab,
        currentRoute,
        switchTab,
        navigate,
        pop,
        goBack: pop,
        canPop,
        activeSheet,
        openSheet,
        closeSheet,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

const fallbackNavigation: NavigationContextType = {
  activeTab: 'overview',
  currentRoute: { id: 'overview', key: 'overview_fallback', title: 'Overview' },
  switchTab: () => { },
  navigate: () => { },
  pop: () => false,
  goBack: () => false,
  canPop: false,
  activeSheet: null,
  openSheet: () => { },
  closeSheet: () => { },
};

export function useNavigation(): NavigationContextType {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    return fallbackNavigation;
  }
  return ctx;
}
