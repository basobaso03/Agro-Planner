import React, { useState, useMemo } from 'react';
import {
  History,
  Clock,
  Search,
  X,
  Trash2,
  ChevronRight,
  Compass,
  ArrowRight,
  ShieldCheck,
  DollarSign,
  Activity,
  Users,
  Layers,
  Sparkles,
  CreditCard,
  FileText,
  Scale,
  ArrowDownLeft,
  ArrowUpRight,
  PieChart,
  Coins,
  Building2,
  Receipt,
  Megaphone,
  RefreshCw,
  HardDrive,
  Bell,
  Globe,
} from 'lucide-react';
import { useNavigation } from '../../navigation/useNavigation.ts';
import { recentsManager, type RecentPage } from '../../navigation/recents.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import type { OrgMember } from '../../types/agro.ts';
import type { RouteId } from '../../navigation/routes.ts';

export interface RecentScreenProps {
  activeMember: OrgMember;
  isAgroEnabled?: boolean;
}

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays}d ago`;
}

function getRecentCategory(routeId: string): {
  key: 'FINANCIAL' | 'OPERATIONS' | 'GOVERNANCE' | 'GENERAL';
  label: string;
  badgeClass: string;
  iconBg: string;
} {
  const r = routeId.toLowerCase();
  if (
    r.includes('sale') ||
    r.includes('loan') ||
    r.includes('debt') ||
    r.includes('expense') ||
    r.includes('capital') ||
    r.includes('money') ||
    r.includes('runway') ||
    r.includes('asset')
  ) {
    return {
      key: 'FINANCIAL',
      label: 'Financial',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      iconBg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    };
  }
  if (
    r.includes('batch') ||
    r.includes('livestock') ||
    r.includes('checkpoint') ||
    r.includes('feed') ||
    r.includes('stock') ||
    r.includes('operations') ||
    r.includes('site')
  ) {
    return {
      key: 'OPERATIONS',
      label: 'Operations',
      badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
      iconBg: 'bg-sky-50 border-sky-200 text-sky-700',
    };
  }
  if (
    r.includes('member') ||
    r.includes('audit') ||
    r.includes('broadcast') ||
    r.includes('sync') ||
    r.includes('storage') ||
    r.includes('settings')
  ) {
    return {
      key: 'GOVERNANCE',
      label: 'Governance',
      badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
      iconBg: 'bg-purple-50 border-purple-200 text-purple-700',
    };
  }
  return {
    key: 'GENERAL',
    label: 'Workspace',
    badgeClass: 'bg-slate-50 text-slate-800 border-slate-200',
    iconBg: 'bg-slate-50 border-slate-200 text-slate-700',
  };
}

function renderRecentIcon(iconName?: string, routeId?: string) {
  const key = iconName || routeId || '';
  switch (key) {
    case 'CreditCard':
    case 'creditSales':
    case 'credit-sales':
      return <CreditCard className="w-5 h-5 text-emerald-700" />;
    case 'FileText':
    case 'saleDetail':
    case 'sale-detail':
      return <FileText className="w-5 h-5 text-emerald-700" />;
    case 'Scale':
    case 'loansDebts':
    case 'loans-debts':
      return <Scale className="w-5 h-5 text-emerald-700" />;
    case 'ArrowDownLeft':
    case 'debtDetail':
      return <ArrowDownLeft className="w-5 h-5 text-amber-700" />;
    case 'ArrowUpRight':
    case 'loanDetail':
      return <ArrowUpRight className="w-5 h-5 text-emerald-700" />;
    case 'PieChart':
    case 'financialSummary':
    case 'financial-summary':
      return <PieChart className="w-5 h-5 text-emerald-700" />;
    case 'Coins':
    case 'capitalPool':
      return <Coins className="w-5 h-5 text-emerald-700" />;
    case 'Building2':
    case 'fixedAssets':
    case 'assets':
      return <Building2 className="w-5 h-5 text-slate-700" />;
    case 'Receipt':
    case 'expenses':
      return <Receipt className="w-5 h-5 text-emerald-700" />;
    case 'Compass':
    case 'runway':
    case 'runwayPlan':
    case 'overview':
      return <Compass className="w-5 h-5 text-purple-700" />;
    case 'Users':
    case 'members':
      return <Users className="w-5 h-5 text-indigo-700" />;
    case 'ShieldCheck':
    case 'auditLedger':
    case 'audit-ledger':
      return <ShieldCheck className="w-5 h-5 text-emerald-700" />;
    case 'Megaphone':
    case 'broadcastCenter':
    case 'broadcasts':
      return <Megaphone className="w-5 h-5 text-amber-700" />;
    case 'RefreshCw':
    case 'syncStatus':
    case 'sync-status':
      return <RefreshCw className="w-5 h-5 text-sky-700" />;
    case 'HardDrive':
    case 'storageManager':
    case 'storage-manager':
      return <HardDrive className="w-5 h-5 text-slate-700" />;
    case 'Bell':
    case 'notificationPrefs':
    case 'notification-prefs':
      return <Bell className="w-5 h-5 text-amber-700" />;
    case 'Globe':
    case 'currencyLocale':
    case 'currency-locale':
      return <Globe className="w-5 h-5 text-sky-700" />;
    case 'Clock':
    case 'recentPages':
    case 'recent-pages':
      return <Clock className="w-5 h-5 text-slate-700" />;
    case 'Layers':
    case 'stockMovementLedger':
    case 'operations-stock-ledger':
    case 'stockInventory':
    case 'operations-inventory':
      return <Layers className="w-5 h-5 text-sky-700" />;
    case 'Activity':
    case 'operations':
    case 'batchDetail':
    case 'livestock-detail':
    case 'checkpointAgenda':
    case 'feedInventory':
    case 'siteCompare':
      return <Activity className="w-5 h-5 text-sky-700" />;
    default:
      return <Compass className="w-5 h-5 text-slate-700" />;
  }
}

export const RecentScreen: React.FC<RecentScreenProps> = ({
  isAgroEnabled = true,
}) => {
  const { navigate } = useNavigation();
  const { showToast } = useToast();
  const [recents, setRecents] = useState<RecentPage[]>(() =>
    recentsManager.getRecents(isAgroEnabled)
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<
    'ALL' | 'FINANCIAL' | 'OPERATIONS' | 'GOVERNANCE'
  >('ALL');

  const handleRemove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    recentsManager.remove(id);
    const updated = recentsManager.getRecents(isAgroEnabled);
    setRecents(updated);
    showToast({
      type: 'info',
      title: 'Item Removed',
      message: 'Page removed from recent history.',
    });
  };

  const handleClearAll = () => {
    recentsManager.clear();
    setRecents([]);
    showToast({
      type: 'info',
      title: 'History Cleared',
      message: 'All recent pages have been cleared.',
    });
  };

  const filteredRecents = useMemo(() => {
    return recents.filter((item) => {
      const cat = getRecentCategory(item.routeId);
      if (filterCategory !== 'ALL' && cat.key !== filterCategory) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const titleMatch = (item.title || '').toLowerCase().includes(q);
      const subMatch = (item.subtitle || '').toLowerCase().includes(q);
      const catMatch = cat.label.toLowerCase().includes(q);
      return titleMatch || subMatch || catMatch;
    });
  }, [recents, filterCategory, searchQuery]);

  const quickHubs: {
    title: string;
    subtitle: string;
    routeId: RouteId;
    icon: React.ReactNode;
    badge: string;
  }[] = [
      {
        title: 'Overview Hub',
        subtitle: 'Organization status & metrics',
        routeId: 'overview',
        icon: <Compass className="w-5 h-5 text-emerald-600" />,
        badge: 'Main',
      },
      {
        title: 'Money & Capital',
        subtitle: 'Cash pool, runway & expenses',
        routeId: 'money',
        icon: <DollarSign className="w-5 h-5 text-emerald-600" />,
        badge: 'Finance',
      },
      ...(isAgroEnabled
        ? [
          {
            title: 'Operations Hub',
            subtitle: 'Livestock, feed & checkpoints',
            routeId: 'operations' as RouteId,
            icon: <Activity className="w-5 h-5 text-sky-600" />,
            badge: 'Ground',
          },
        ]
        : [
          {
            title: 'Stock Ledger',
            subtitle: 'Inventory dispatches & movements',
            routeId: 'stockMovementLedger' as RouteId,
            icon: <Layers className="w-5 h-5 text-sky-600" />,
            badge: 'Stock',
          },
        ]),
      {
        title: 'Credit Sales',
        subtitle: 'Track receivables & customer credit',
        routeId: 'creditSales',
        icon: <Sparkles className="w-5 h-5 text-amber-600" />,
        badge: 'Sales',
      },
      {
        title: 'Syndicate Team',
        subtitle: 'Members, roles & invite codes',
        routeId: 'members',
        icon: <Users className="w-5 h-5 text-purple-600" />,
        badge: 'Team',
      },
      {
        title: 'Audit Trail',
        subtitle: 'Tamper-evident verification ledger',
        routeId: 'auditLedger',
        icon: <ShieldCheck className="w-5 h-5 text-emerald-600" />,
        badge: 'Security',
      },
    ];

  return (
    <div className="flex-1 flex flex-col p-4 pb-24 max-w-2xl mx-auto w-full space-y-4">
      {/* Hero Header Card */}
      <div className="bg-white border border-[#E8DFCE] p-4 rounded-2xl shadow-xs space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-2xs shrink-0">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base font-black text-slate-950">
                Recently Opened Pages
              </h1>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                Fast multitasking &amp; quick record switching
              </p>
            </div>
          </div>

          {recents.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer shrink-0"
              title="Clear all recent history"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          )}
        </div>

        {recents.length > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-[#F0EBE1] text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Saved session records</span>
            </span>
            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
              {recents.length} pages
            </span>
          </div>
        )}
      </div>

      {/* Search & Category Filter Controls (only when recents exist) */}
      {recents.length > 0 && (
        <div className="space-y-2">
          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search recently opened pages..."
              className="w-full pl-9 pr-9 py-2.5 bg-white border border-[#E8DFCE] rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all shadow-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Filter Chips */}
          <div className="grid grid-cols-4 gap-1 bg-[#FAF8F5] border border-[#E8DFCE] p-1 rounded-xl text-xs font-bold text-center">
            {(
              [
                { id: 'ALL', label: 'All' },
                { id: 'FINANCIAL', label: 'Finance' },
                { id: 'OPERATIONS', label: 'Agro/Ops' },
                { id: 'GOVERNANCE', label: 'Admin' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilterCategory(t.id)}
                className={`py-1.5 rounded-lg transition-all cursor-pointer ${filterCategory === t.id
                  ? 'bg-white text-slate-950 shadow-xs border border-[#E0D7C6]'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recents List */}
      {recents.length === 0 ? (
        <div className="bg-white border border-[#E8DFCE] rounded-2xl p-7 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] flex items-center justify-center text-2xl mx-auto shadow-2xs">
            🕒
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-slate-950">
              No Recently Opened Pages
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
              Pages, detail sheets, and transactions you visit will appear here for fast multitasking and quick return navigation.
            </p>
          </div>
        </div>
      ) : filteredRecents.length === 0 ? (
        <div className="bg-white border border-[#E8DFCE] rounded-2xl p-6 text-center space-y-2 shadow-xs">
          <div className="text-sm font-bold text-slate-900">
            No matching recent pages
          </div>
          <p className="text-xs text-slate-500">
            No records matched &ldquo;{searchQuery}&rdquo;. Try another search or reset filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setFilterCategory('ALL');
            }}
            className="mt-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredRecents.map((item) => {
            const cat = getRecentCategory(item.routeId);
            return (
              <div
                key={item.id}
                onClick={() => navigate(item.routeId, item.params)}
                className="bg-white border border-[#E8DFCE] hover:border-emerald-600/60 rounded-2xl p-3.5 shadow-xs space-y-2 hover:shadow-sm cursor-pointer active:scale-[0.99] transition-all group"
              >
                {/* Top Badge & Time Header */}
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`font-semibold px-2 py-0.5 rounded-md border text-[10px] ${cat.badgeClass}`}
                    >
                      {cat.label}
                    </span>
                    <span className="text-slate-400 font-medium">·</span>
                    <span className="text-slate-500 font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{formatRelativeTime(item.timestamp)}</span>
                    </span>
                  </div>

                  {/* Dismiss Single Item Button */}
                  <button
                    type="button"
                    onClick={(e) => handleRemove(item.id, e)}
                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Remove from recents"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Main Content Row */}
                <div className="flex items-center justify-between gap-3 pt-0.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs ${cat.iconBg}`}
                    >
                      {renderRecentIcon(item.icon, item.routeId)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-950 group-hover:text-emerald-700 transition-colors truncate">
                        {item.title}
                      </div>
                      <div className="text-xs text-slate-600 font-medium truncate mt-0.5">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>

                  {/* Jump Action Indicator */}
                  <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-50 group-hover:bg-emerald-50 text-slate-600 group-hover:text-emerald-700 border border-slate-200 group-hover:border-emerald-200 text-xs font-bold transition-all shrink-0">
                    <span>Open</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Suggested Quick Hubs */}
      <div className="space-y-2.5 pt-2">
        <div className="flex items-center justify-between px-1">
          <div className="text-xs uppercase tracking-wider text-slate-500 font-bold">
            Quick Jump Destinations
          </div>
          <span className="text-[11px] text-slate-400">Primary Hubs</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {quickHubs.map((hub) => (
            <div
              key={hub.routeId}
              onClick={() => navigate(hub.routeId)}
              className="bg-white border border-[#E8DFCE] hover:border-emerald-600/50 rounded-2xl p-3 shadow-xs hover:shadow-sm cursor-pointer active:scale-[0.98] transition-all group flex flex-col justify-between space-y-2"
            >
              <div className="flex items-start justify-between">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 group-hover:bg-emerald-50 group-hover:border-emerald-200 transition-colors">
                  {hub.icon}
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  {hub.badge}
                </span>
              </div>

              <div>
                <div className="text-xs font-bold text-slate-950 group-hover:text-emerald-700 transition-colors">
                  {hub.title}
                </div>
                <div className="text-[11px] text-slate-500 truncate mt-0.5">
                  {hub.subtitle}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
