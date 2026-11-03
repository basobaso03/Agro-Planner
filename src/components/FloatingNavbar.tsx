import React from 'react';
import {
  Home,
  Bird,
  Receipt,
  LayoutGrid,
} from 'lucide-react';
import type { ActiveTab } from '../App.tsx';
import type { Role } from '../types/agro.ts';

interface FloatingNavbarProps {
  activeTab: ActiveTab;
  onNavigateTab: (tab: ActiveTab) => void;
  mobileFrameMode: boolean;
  activeRole: Role;
  pendingUsersCount?: number;
  unreadBroadcastsCount?: number;
  isAgroEnabled?: boolean;
}

export const FloatingNavbar: React.FC<FloatingNavbarProps> = ({
  activeTab,
  onNavigateTab,
  mobileFrameMode,
  activeRole: _activeRole,
  pendingUsersCount: _pendingUsersCount = 0,
  unreadBroadcastsCount: _unreadBroadcastsCount = 0,
  isAgroEnabled = true,
}) => {
  // Streamlined 3-tab primary navigation bar
  // Secondary modules (Pool, Assets, Broadcasts, Audit, Users, Settings) have been
  // cleanly transferred to the Overview tab's Modern Banking Hub Grid.
  const navItems: {
    id: ActiveTab;
    label: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    { id: 'HOME', label: 'Overview', icon: Home },
    {
      id: 'LIVESTOCK',
      label: isAgroEnabled ? 'Livestock' : 'Operations',
      icon: isAgroEnabled ? Bird : LayoutGrid,
    },
    { id: 'EXPENSES', label: 'Expenses', icon: Receipt },
  ];

  return (
    <nav
      aria-label="CapitaSeed Floating Navigation"
      className={`fixed bottom-4 sm:bottom-6 z-40 left-1/2 -translate-x-1/2 transition-all ${
        mobileFrameMode ? 'w-[calc(100%-2rem)] max-w-[380px]' : 'w-auto max-w-[94vw]'
      }`}
    >
      <div className="flex items-center justify-center gap-1 sm:gap-2 p-1.5 sm:p-2 bg-white/95 backdrop-blur-xl border border-[#E8DFCE] rounded-full shadow-[0_12px_36px_-4px_rgba(217,119,6,0.14),0_4px_12px_rgba(0,0,0,0.06)]">
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
                  ? 'tab-brand-active px-4 py-2 sm:px-5 sm:py-2.5 text-white font-bold shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 px-3.5 py-2 sm:px-4 sm:py-2.5 font-medium'
              }`}
              aria-label={item.label}
              title={item.label}
            >
              <Icon
                className={`w-4 h-4 sm:w-[18px] sm:h-[18px] shrink-0 transition-transform ${
                  isActive ? 'scale-105' : 'group-hover:scale-105'
                }`}
              />
              <span className={`text-xs tracking-tight ml-1.5 whitespace-nowrap ${isActive ? 'font-bold' : 'font-semibold'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
