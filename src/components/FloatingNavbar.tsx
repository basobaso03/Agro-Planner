import React from 'react';
import {
  Home,
  Bird,
  Receipt,
  Users,
  Warehouse,
  ShieldCheck,
  UserCog,
  Settings,
} from 'lucide-react';
import type { ActiveTab } from '../App.tsx';
import type { Role } from '../types/agro.ts';
import { PERMISSIONS } from '../utils/permissions.ts';

interface FloatingNavbarProps {
  activeTab: ActiveTab;
  onNavigateTab: (tab: ActiveTab) => void;
  mobileFrameMode: boolean;
  activeRole: Role;
  pendingUsersCount?: number;
}

export const FloatingNavbar: React.FC<FloatingNavbarProps> = ({
  activeTab,
  onNavigateTab,
  mobileFrameMode,
  activeRole,
  pendingUsersCount = 0,
}) => {
  const allNavItems: {
    id: ActiveTab;
    label: string;
    icon: React.FC<{ className?: string }>;
    badgeCount?: number;
  }[] = [
    { id: 'HOME', label: 'Overview', icon: Home },
    { id: 'LIVESTOCK', label: 'Livestock', icon: Bird },
    { id: 'EXPENSES', label: 'Expenses', icon: Receipt },
    { id: 'POOL', label: 'Pool', icon: Users },
    { id: 'ASSETS', label: 'Assets', icon: Warehouse },
    { id: 'AUDIT', label: 'Ledger', icon: ShieldCheck },
    { id: 'USERS', label: 'Roles', icon: UserCog, badgeCount: pendingUsersCount },
    { id: 'SETTINGS', label: 'Settings', icon: Settings },
  ];

  // Restrict tabs based on Role
  const navItems = allNavItems.filter((item) => {
    if (item.id === 'POOL') {
      return PERMISSIONS.canViewCapitalPoolTab(activeRole);
    }
    if (item.id === 'USERS') {
      return PERMISSIONS.canManageMembers(activeRole);
    }
    return true;
  });

  return (
    <nav
      aria-label="Solora Floating Navigation"
      className={`fixed bottom-4 sm:bottom-6 z-40 left-1/2 -translate-x-1/2 transition-all ${
        mobileFrameMode ? 'w-[calc(100%-1.5rem)] max-w-[400px]' : 'w-auto max-w-[96vw]'
      }`}
    >
      <div className="flex items-center gap-1 sm:gap-1.5 p-1.5 sm:p-2 bg-white/95 backdrop-blur-xl border border-[#E8DFCE] rounded-full shadow-[0_12px_36px_-4px_rgba(217,119,6,0.12),0_4px_12px_rgba(0,0,0,0.04)] overflow-x-auto no-scrollbar">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigateTab(item.id)}
              className={`relative group flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer shrink-0 ${
                isActive
                  ? 'tab-brand-active px-3 py-2 sm:px-3.5 sm:py-2.5'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 p-2 sm:px-2.5 sm:py-2.5'
              }`}
              aria-label={item.label}
              title={item.label}
            >
              <Icon
                className={`w-4 h-4 sm:w-[18px] sm:h-[18px] shrink-0 transition-transform ${
                  isActive ? 'scale-105' : 'group-hover:scale-105'
                }`}
              />
              {isActive && (
                <span className="text-xs font-bold tracking-tight ml-1.5 whitespace-nowrap">
                  {item.label}
                </span>
              )}
              {Boolean(item.badgeCount && item.badgeCount > 0 && !isActive) && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
