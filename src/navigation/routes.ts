/**
 * Typed Navigation Route Registry
 */

export type TabId = 'overview' | 'operations' | 'money' | 'more';

export type RouteId =
  // Root Tabs
  | 'overview'
  | 'operations'
  | 'money'
  | 'more'
  // Agro Screens
  | 'batchDetail'
  | 'livestock-detail'
  | 'checkpointAgenda'
  | 'feedInventory'
  | 'siteCompare'
  | 'site-compare'
  // General Screens
  | 'stockInventory'
  | 'operations-inventory'
  | 'stockMovementLedger'
  | 'operations-stock-ledger'
  // Money Screens
  | 'creditSales'
  | 'credit-sales'
  | 'saleDetail'
  | 'sale-detail'
  | 'loansDebts'
  | 'loans-debts'
  | 'loanDetail'
  | 'debtDetail'
  | 'expenses'
  | 'capitalPool'
  | 'assets'
  | 'fixedAssets'
  | 'runway'
  | 'runwayPlan'
  | 'financialSummary'
  | 'financial-summary'
  // More Screens
  | 'recentPages'
  | 'recent-pages'
  | 'members'
  | 'auditLedger'
  | 'audit-ledger'
  | 'broadcastCenter'
  | 'broadcasts'
  | 'syncStatus'
  | 'sync-status'
  | 'storageManager'
  | 'storage-manager'
  | 'notificationPrefs'
  | 'notification-prefs'
  | 'currencyLocale'
  | 'currency-locale'
  | 'settings'
  | 'helpOnboarding';

export interface RouteEntry {
  key: string; // Unique instance key
  id: RouteId;
  params?: Record<string, string>;
  title: string;
  scrollTop?: number;
}
