import React, { useState } from 'react';
import {
  Bell,
  MapPin,
  Smartphone,
  Monitor,
  ShieldCheck,
  WifiOff,
  Cloud,
  LogOut,
  Eye,
  EyeOff,
  UserCog,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
} from 'lucide-react';
import type { FarmLocation, OrgMember } from '../types/agro.ts';
import type { ActiveTab } from '../App.tsx';
import { useOnlineStatus } from '../hooks/usePWAInstall.ts';
import { LogoSvg } from './BrandLogos.tsx';
import { PERMISSIONS, getRoleMeta } from '../utils/permissions.ts';
import { dataService } from '../services/dataService.ts';

interface HeaderProps {
  locations: FarmLocation[];
  selectedLocationId: string;
  onSelectLocation: (locId: string) => void;
  activeMember: OrgMember;
  pendingUsersCount?: number;
  unreadCount: number;
  onOpenNotifications: () => void;
  onNavigateTab: (tab: ActiveTab, section?: string) => void;
  onSignOut: () => void;
  onAddLocation?: (data: {
    name: string;
    region: string;
    gpsCoordinates: string;
    primaryOperatorName: string;
  }) => void;
  onOpenSiteManager?: () => void;
  organizationName?: string;
  workspaceMode?: 'AGRO_FARMING' | 'GENERAL_VENTURE';
  mobileFrameMode: boolean;
  onToggleMobileFrame: () => void;
  isCloudConnected?: boolean;
  showNumbers?: boolean;
  onToggleShowNumbers?: () => void;
  isAuthenticatingPrivacy?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  locations,
  selectedLocationId,
  onSelectLocation,
  activeMember,
  pendingUsersCount,
  unreadCount,
  onOpenNotifications,
  onNavigateTab,
  onSignOut,
  onOpenSiteManager,
  organizationName,
  workspaceMode,
  mobileFrameMode,
  onToggleMobileFrame,
  isCloudConnected,
  showNumbers = true,
  onToggleShowNumbers = () => { },
  isAuthenticatingPrivacy = false,
}) => {
  const isOnline = useOnlineStatus();

  // Live Cloud Force-Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<{ message: string; isError?: boolean } | null>(null);

  const handleCloudSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncToast(null);
    try {
      const res = await dataService.syncWithCloudServer();
      setSyncToast({ message: res.message });
      setTimeout(() => setSyncToast(null), 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      setSyncToast({ message: msg, isError: true });
      setTimeout(() => setSyncToast(null), 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  const canManageLocations = PERMISSIONS.canAddLocations(activeMember?.role || 'REMOTE_INVESTOR');
  const canManageRoles = PERMISSIONS.canManageMembers(activeMember?.role || 'REMOTE_INVESTOR');
  const roleMeta = getRoleMeta(activeMember?.role);

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E8DFCE] px-4 pt-safe shadow-xs">
        <div className="py-2 sm:py-2.5">
          <div className="flex items-center justify-between gap-2.5 sm:gap-3">
            {/* Left Zone: Brand (and Desktop Profile Badge inline) */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {/* Brand Title & Permanent Sprout CapitaSeed Logo */}
              <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 text-left select-none">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl overflow-hidden border border-[#E0D7C6] shadow-xs flex items-center justify-center bg-white">
                  <LogoSvg size={34} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm sm:text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
                    CapitaSeed
                  </span>
                  {organizationName && (
                    <div className="flex items-center gap-1.5 -mt-0.5">
                      <span className="text-[10px] font-semibold text-amber-800 truncate max-w-[110px] sm:max-w-[170px]">
                        {organizationName}
                      </span>
                      {workspaceMode && (
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md border ${workspaceMode === 'GENERAL_VENTURE'
                            ? 'bg-sky-50 text-sky-800 border-sky-300'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          }`}>
                          {workspaceMode === 'GENERAL_VENTURE' ? 'General Venture' : 'Agro Farming'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Desktop Profile Badge (sm+): Inline next to Brand, Full Text */}
              <div className="hidden sm:flex items-center min-w-0">
                <button
                  type="button"
                  onClick={() => onNavigateTab('SETTINGS', 'profile')}
                  title={`My Account: ${activeMember.fullName} (${roleMeta.label})`}
                  aria-label={`My Account: ${activeMember.fullName}, ${roleMeta.label}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#FAF8F5] hover:bg-[#F0EBE1] border border-[#E0D7C6] text-xs transition-colors cursor-pointer whitespace-nowrap shadow-2xs"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="font-bold text-slate-900">
                    {activeMember.fullName}
                  </span>
                  <span aria-hidden="true" className="text-slate-300 shrink-0">
                    ·
                  </span>
                  <span className="text-[11px] font-semibold text-amber-800">
                    {roleMeta.label}
                  </span>
                </button>
              </div>
            </div>

            {/* Zone 2: Quick Actions (Admin Users, Settings, Notifications, Sign Out) */}
            <div className="flex items-center gap-1.5 shrink-0 self-center">
              {!isOnline && (
                <span
                  title="Offline Mode — Local Queue Active"
                  className="hidden md:inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 px-2 py-1"
                >
                  <WifiOff className="w-3 h-3 text-amber-600" />
                  Offline
                </span>
              )}
              {isCloudConnected && (
                <span
                  title="Live Cloud Firestore Synchronized"
                  className="hidden md:inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 px-2 py-1"
                >
                  <Cloud className="w-3 h-3 text-emerald-600" />
                  Sync
                </span>
              )}

              {/* Privacy Number Mask / Eye Toggle Button */}
              <button
                type="button"
                onClick={onToggleShowNumbers}
                disabled={isAuthenticatingPrivacy}
                title={
                  isAuthenticatingPrivacy
                    ? 'Verifying Biometric Sensor...'
                    : showNumbers
                      ? 'Hide System Numbers (Privacy Mode)'
                      : 'Reveal System Numbers (Quick Unlock)'
                }
                aria-label={showNumbers ? 'Hide System Numbers' : 'Reveal System Numbers'}
                className={`flex items-center justify-center min-w-[38px] min-h-[38px] rounded-xl border shadow-xs transition-colors cursor-pointer ${isAuthenticatingPrivacy
                  ? 'bg-amber-100 border-amber-400 text-amber-700 animate-pulse'
                  : showNumbers
                    ? 'bg-white border-[#E0D7C6] text-slate-700 hover:text-amber-600 hover:border-amber-400'
                    : 'bg-amber-500 text-white border-amber-600 shadow-sm'
                  }`}
              >
                {isAuthenticatingPrivacy ? (
                  <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                ) : showNumbers ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </button>

              {/* Live Cloud Force-Sync / Refresh Button */}
              <button
                type="button"
                disabled={isSyncing}
                onClick={handleCloudSync}
                title="Force Sync / Refresh from Live Cloud Database"
                aria-label="Force Sync from Cloud"
                className={`flex items-center justify-center min-w-[38px] min-h-[38px] rounded-xl border shadow-xs transition-colors cursor-pointer ${isSyncing
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                  : 'bg-white border-[#E0D7C6] text-slate-700 hover:text-emerald-700 hover:border-emerald-400'
                  }`}
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-emerald-600' : ''}`} />
              </button>

              <button
                type="button"
                onClick={onToggleMobileFrame}
                aria-label={mobileFrameMode ? 'Switch to Full Width View' : 'Switch to Mobile Phone Frame'}
                title={mobileFrameMode ? 'Expand to Full Screen' : 'Preview Mobile Handset Frame'}
                className="hidden lg:flex items-center justify-center min-w-[38px] min-h-[38px] rounded-xl bg-white border border-[#E0D7C6] text-slate-700 hover:text-slate-900 hover:border-slate-300 shadow-xs transition-colors cursor-pointer"
              >
                {mobileFrameMode ? <Monitor className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
              </button>

              {/* Quick Admin Pending Approvals Alert Badge */}
              {canManageRoles && (pendingUsersCount || 0) > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('USERS')}
                  title={`${pendingUsersCount} new user${(pendingUsersCount || 0) > 1 ? 's' : ''} awaiting admin review`}
                  aria-label={`View ${pendingUsersCount} pending users`}
                  className="relative flex items-center gap-1.5 px-2.5 min-h-[38px] rounded-xl bg-amber-500 hover:bg-amber-600 text-white border border-amber-600 shadow-xs transition-colors cursor-pointer animate-pulse"
                >
                  <UserCog className="w-4 h-4" />
                  <span className="text-[11px] font-bold whitespace-nowrap hidden sm:inline">
                    {pendingUsersCount} Pending
                  </span>
                  <span className="sm:hidden text-[11px] font-bold">
                    {pendingUsersCount}
                  </span>
                </button>
              )}

              {/* Notification Broadcasts Button */}
              <button
                type="button"
                onClick={() => onNavigateTab('BROADCASTS')}
                aria-label={`Open Organization Broadcasts and Communications (${unreadCount} unread)`}
                title={`Broadcasts (${unreadCount} unread)`}
                className="relative flex items-center justify-center min-w-[38px] min-h-[38px] rounded-xl bg-white border border-[#E0D7C6] text-slate-700 hover:text-slate-900 hover:border-amber-400 shadow-xs transition-colors cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold font-mono flex items-center justify-center shadow-xs">
                    {unreadCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={onSignOut}
                title="Sign Out of CapitaSeed"
                aria-label="Sign Out"
                className="flex items-center justify-center min-w-[38px] min-h-[38px] rounded-xl bg-white border border-[#E0D7C6] text-slate-700 hover:text-rose-600 hover:border-rose-300 shadow-xs transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mobile Profile Container (sm:hidden): On its OWN dedicated full-width row showing full text without any ellipsis */}
          <div className="flex sm:hidden items-center pt-2 w-full">
            <button
              type="button"
              onClick={() => onNavigateTab('SETTINGS', 'profile')}
              title={`My Account: ${activeMember.fullName} (${roleMeta.label})`}
              aria-label={`My Account: ${activeMember.fullName}, ${roleMeta.label}`}
              className="w-full inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#FAF8F5] hover:bg-[#F0EBE1] border border-[#E0D7C6] text-xs transition-colors cursor-pointer shadow-2xs overflow-x-auto no-scrollbar"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="font-bold text-slate-900 whitespace-nowrap">
                {activeMember.fullName}
              </span>
              <span aria-hidden="true" className="text-slate-300 shrink-0">
                ·
              </span>
              <span className="text-[11px] font-semibold text-amber-800 whitespace-nowrap">
                {roleMeta.label}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Floating Cloud Sync Notification Toast */}
      {syncToast && (
        <div className={`fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2 transition-all ${syncToast.isError
          ? 'bg-rose-50 border-rose-300 text-rose-900'
          : 'bg-emerald-50 border-emerald-300 text-emerald-900'
          }`}>
          {syncToast.isError ? (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
          <span>{syncToast.message}</span>
        </div>
      )}

      {/* Global Location Filter Bar (Below Header) */}
      <div className="bg-[#FAF7F2]/95 border-b border-[#E8DFCE] px-4 py-1.5">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 px-0.5">
          <button
            type="button"
            onClick={() => onSelectLocation('ALL')}
            className={`px-3.5 py-1.5 rounded-full text-xs transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${selectedLocationId === 'ALL'
              ? 'tab-brand-active'
              : 'tab-brand-inactive'
              }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            All Sites
          </button>

          {locations.map((loc) => (
            <button
              key={loc.id}
              type="button"
              onClick={() => onSelectLocation(loc.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs transition-all whitespace-nowrap shrink-0 cursor-pointer ${selectedLocationId === loc.id
                ? 'tab-brand-active'
                : 'tab-brand-inactive'
                }`}
            >
              {loc.name}
            </button>
          ))}

          {canManageLocations && onOpenSiteManager && (
            <button
              type="button"
              onClick={onOpenSiteManager}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-[#E0D7C6] text-amber-800 hover:bg-amber-50 hover:border-amber-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
              Manage Sites
            </button>
          )}
        </div>
      </div>
    </>
  );
};
