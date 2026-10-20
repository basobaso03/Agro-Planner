import React, { useState } from 'react';
import {
  Bell,
  MapPin,
  Plus,
  Smartphone,
  Monitor,
  ShieldCheck,
  WifiOff,
  Cloud,
  LogOut,
  X,
  Eye,
  EyeOff,
  UserCog,
} from 'lucide-react';
import type { FarmLocation, SyndicateMember } from '../types/agro.ts';
import type { ActiveTab } from '../App.tsx';
import { useOnlineStatus } from '../hooks/usePWAInstall.ts';
import { LogoSvg } from './BrandLogos.tsx';
import { PERMISSIONS, getRoleMeta } from '../utils/permissions.ts';

interface HeaderProps {
  locations: FarmLocation[];
  selectedLocationId: string;
  onSelectLocation: (locId: string) => void;
  activeMember: SyndicateMember;
  pendingUsersCount?: number;
  unreadCount: number;
  onOpenNotifications: () => void;
  onNavigateTab: (tab: ActiveTab, section?: string) => void;
  onSignOut: () => void;
  onAddLocation: (data: {
    name: string;
    region: string;
    gpsCoordinates: string;
    primaryOperatorName: string;
  }) => void;
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
  onAddLocation,
  mobileFrameMode,
  onToggleMobileFrame,
  isCloudConnected,
  showNumbers = true,
  onToggleShowNumbers = () => {},
  isAuthenticatingPrivacy = false,
}) => {
  const isOnline = useOnlineStatus();
  const [showAddSiteModal, setShowAddSiteModal] = useState(false);
  const [siteName, setSiteName] = useState('');
  const [siteRegion, setSiteRegion] = useState('');
  const [siteGps, setSiteGps] = useState('-17.8500, 30.9200');
  const [siteOperator, setSiteOperator] = useState(activeMember.fullName);
  const [errorMsg, setErrorMsg] = useState('');

  const handleCreateSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (siteName.trim().length < 3 || siteRegion.trim().length < 3) {
      setErrorMsg('Please enter a valid farm site name and province/region.');
      return;
    }
    onAddLocation({
      name: siteName,
      region: siteRegion,
      gpsCoordinates: siteGps,
      primaryOperatorName: siteOperator || activeMember.fullName,
    });
    setSiteName('');
    setSiteRegion('');
    setErrorMsg('');
    setShowAddSiteModal(false);
  };

  const canAddLocations = PERMISSIONS.canAddLocations(activeMember.role);
  const canManageRoles = PERMISSIONS.canManageMembers(activeMember.role);
  const roleMeta = getRoleMeta(activeMember.role);

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E8DFCE] px-4 pt-safe shadow-xs">
        <div className="py-2 sm:py-2.5">
          <div className="flex items-center justify-between gap-2.5 sm:gap-3">
            {/* Left Zone: Brand (and Desktop Profile Badge inline) */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {/* Brand Title & Permanent Organic Sprout AP Logo */}
              <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 text-left select-none">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl overflow-hidden border border-[#E0D7C6] shadow-xs flex items-center justify-center bg-white">
                  <LogoSvg size={34} />
                </div>
                <span className="text-sm sm:text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
                  Agro Planner
                </span>
              </div>

              {/* Desktop Profile Badge (sm+): Inline next to Brand, Full Text */}
              <div className="hidden sm:flex items-center min-w-0">
                <button
                  type="button"
                  onClick={() => onNavigateTab('SETTINGS', 'profile')}
                  title={`My Personal Account: ${activeMember.fullName} (${roleMeta.label})`}
                  aria-label={`My Personal Account: ${activeMember.fullName}, ${roleMeta.label}`}
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
              className={`flex items-center justify-center min-w-[38px] min-h-[38px] rounded-xl border shadow-xs transition-colors cursor-pointer ${
                isAuthenticatingPrivacy
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
                title={`${pendingUsersCount} new user${(pendingUsersCount || 0) > 1 ? 's' : ''} awaiting admin approval`}
                aria-label={`View ${pendingUsersCount} pending user approvals`}
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

            <button
              type="button"
              onClick={onOpenNotifications}
              aria-label={`Open Ground Broadcasts and Notifications (${unreadCount} unread)`}
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
              title="Sign Out of Syndicate Portal"
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
              title={`My Personal Account: ${activeMember.fullName} (${roleMeta.label})`}
              aria-label={`My Personal Account: ${activeMember.fullName}, ${roleMeta.label}`}
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

      {/* Global Location Filter Bar (Below Header) */}
      <div className="bg-[#FAF7F2]/95 border-b border-[#E8DFCE] px-4 py-1.5">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 px-0.5">
          <button
            type="button"
            onClick={() => onSelectLocation('ALL')}
            className={`px-3.5 py-1.5 rounded-full text-xs transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
              selectedLocationId === 'ALL'
                ? 'tab-brand-active'
                : 'tab-brand-inactive'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            All Sites (Master)
          </button>

          {locations.map((loc) => (
            <button
              key={loc.id}
              type="button"
              onClick={() => onSelectLocation(loc.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                selectedLocationId === loc.id
                  ? 'tab-brand-active'
                  : 'tab-brand-inactive'
              }`}
            >
              {loc.name}
            </button>
          ))}

          {canAddLocations && (
            <button
              type="button"
              onClick={() => setShowAddSiteModal(true)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-dashed border-amber-400 text-amber-700 hover:bg-amber-50 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Site
            </button>
          )}
        </div>
      </div>

      {/* Add Farm Location Modal */}
      {showAddSiteModal && (
        <div
          className="modal-overlay-responsive"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-site-title"
        >
          <div className="modal-dialog-responsive max-w-md p-5 sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE1] shrink-0">
              <h2 id="add-site-title" className="text-base font-bold text-slate-900">
                Register New Syndicate Farm Site
              </h2>
              <button
                type="button"
                onClick={() => setShowAddSiteModal(false)}
                aria-label="Close modal"
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSite} className="modal-body-scroll mt-4 space-y-3.5">
              {errorMsg && (
                <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  {errorMsg}
                </p>
              )}
              <div>
                <label htmlFor="site-name" className="block text-xs font-semibold text-slate-700 mb-1">
                  Site / Farm Name *
                </label>
                <input
                  id="site-name"
                  type="text"
                  required
                  placeholder="e.g. Mazowe Citrus & Layer Plot (Site A)"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label htmlFor="site-region" className="block text-xs font-semibold text-slate-700 mb-1">
                  Region / District *
                </label>
                <input
                  id="site-region"
                  type="text"
                  required
                  placeholder="e.g. Mashonaland Central, Zimbabwe"
                  value={siteRegion}
                  onChange={(e) => setSiteRegion(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="site-gps" className="block text-xs font-semibold text-slate-700 mb-1">
                    GPS Coordinates
                  </label>
                  <input
                    id="site-gps"
                    type="text"
                    value={siteGps}
                    onChange={(e) => setSiteGps(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label htmlFor="site-op" className="block text-xs font-semibold text-slate-700 mb-1">
                    Primary Ground Operator
                  </label>
                  <input
                    id="site-op"
                    type="text"
                    value={siteOperator}
                    onChange={(e) => setSiteOperator(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddSiteModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 shadow-sm transition-colors"
                >
                  Append Site to Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </>
  );
};
