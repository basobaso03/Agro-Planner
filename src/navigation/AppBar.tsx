import React from 'react';
import { ArrowLeft, Bell, Eye, EyeOff, MapPin, ChevronDown } from 'lucide-react';
import { useNavigation } from './useNavigation.ts';
import { SyncChip } from '../components/ui/SyncChip.tsx';
import type { FarmLocation, OrgMember } from '../types/agro.ts';

export interface AppBarProps {
  orgName?: string;
  locations?: FarmLocation[];
  selectedLocationId?: string;
  onSelectLocation?: (id: string) => void;
  showNumbers?: boolean;
  onToggleShowNumbers?: () => void;
  unreadNotificationsCount?: number;
  onOpenNotifications?: () => void;
  onOpenSyncStatus?: () => void;
}

export const AppBar: React.FC<AppBarProps> = ({
  orgName = 'CapitaSeed',
  locations = [],
  selectedLocationId = 'ALL',
  onSelectLocation,
  showNumbers = true,
  onToggleShowNumbers,
  unreadNotificationsCount = 0,
  onOpenNotifications,
  onOpenSyncStatus,
}) => {
  const { currentRoute, canPop, pop } = useNavigation();

  const selectedLocName =
    selectedLocationId === 'ALL'
      ? 'All Sites'
      : locations.find((l) => l.id === selectedLocationId)?.name || 'Select Site';

  return (
    <header className="sticky top-0 z-30 shrink-0 bg-white/95 backdrop-blur-md border-b border-[#E8DFCE] pt-safe px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
      {/* Left Column: Back button or Org Branding */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {canPop ? (
          <button
            type="button"
            onClick={pop}
            aria-label="Back"
            className="p-2 -ml-1 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : null}

        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight truncate flex items-center gap-1.5">
            <span>{currentRoute.title}</span>
          </h1>
          {!canPop && <p className="text-[10px] text-slate-500 font-bold uppercase truncate">{orgName}</p>}
        </div>
      </div>

      {/* Right Column: Site Chip + SyncChip + Privacy Eye + Bell */}
      <div className="flex items-center gap-1.5 shrink-0">
        {locations.length > 1 && onSelectLocation && (
          <div className="relative">
            <select
              aria-label="Select Farm Site"
              value={selectedLocationId}
              onChange={(e) => onSelectLocation(e.target.value)}
              className="appearance-none pl-6 pr-5 py-1 rounded-full bg-[#FAF8F5] border border-slate-200 text-[10px] font-bold text-slate-700 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">All Sites</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
            <MapPin className="w-3 h-3 text-amber-500 absolute left-2 top-2 pointer-events-none" />
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-2 pointer-events-none" />
          </div>
        )}

        <SyncChip onClick={onOpenSyncStatus} />

        {onToggleShowNumbers && (
          <button
            type="button"
            onClick={onToggleShowNumbers}
            title={showNumbers ? 'Hide balances' : 'Show balances'}
            className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {showNumbers ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
          </button>
        )}

        {onOpenNotifications && (
          <button
            type="button"
            onClick={onOpenNotifications}
            aria-label="Notifications"
            className="relative p-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
            )}
          </button>
        )}
      </div>
    </header>
  );
};

