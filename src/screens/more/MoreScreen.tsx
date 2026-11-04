import React, { useState } from 'react';
import { useNavigation } from '../../navigation/useNavigation.ts';
import { dataService } from '../../services/dataService.ts';
import { ListRow } from '../../components/ui/ListRow.tsx';
import { isPrivacyMasked, togglePrivacyMask } from '../../utils/currency.ts';
import { InviteCodeSheet } from '../../sheets/common/InviteCodeSheet.tsx';
import { SiteSheet } from '../../sheets/common/SiteSheet.tsx';
import { BroadcastSheet } from '../../sheets/common/BroadcastSheet.tsx';
import type { OrgMember } from '../../types/agro.ts';

export interface MoreScreenProps {
  activeMember: OrgMember;
  onSignOut?: () => void;
}

export const MoreScreen: React.FC<MoreScreenProps> = ({
  activeMember,
  onSignOut,
}) => {
  const { navigate } = useNavigation();
  const [masked, setMasked] = useState(isPrivacyMasked());

  // Sheets
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [showSiteSheet, setShowSiteSheet] = useState(false);
  const [showBroadcastSheet, setShowBroadcastSheet] = useState(false);

  const org = (dataService.getState().organizations || []).find(
    (o) => o.id === (activeMember.orgId || 'org-master')
  );

  const handleToggleMask = () => {
    const next = togglePrivacyMask();
    setMasked(next);
  };

  return (
    <div className="flex-1 flex flex-col p-4 pb-24 max-w-2xl mx-auto w-full space-y-4">
      {/* Profile Card */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-lg">
            {activeMember.fullName?.charAt(0) || 'U'}
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              {activeMember.fullName}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {activeMember.role} · {org?.name || 'Venture'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggleMask}
          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 flex items-center gap-1.5"
        >
          <span>{masked ? '👁️' : '🔒'}</span>
          <span>{masked ? 'Unmask' : 'Mask'}</span>
        </button>
      </div>

      {/* Enterprise & Team Governance */}
      <div className="space-y-1">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-2">
          Organization & Team
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl divide-y divide-slate-100 dark:divide-slate-700/60 shadow-xs overflow-hidden">
          <ListRow
            icon="👥"
            title="Syndicate Members & Equity"
            subtitle="View members, roles, capital deposits & profit shares"
            onClick={() => navigate('members')}
          />
          <ListRow
            icon="🔑"
            title="24-Hour Invite Code"
            subtitle={`Active code: ${org?.currentInviteCode || 'SEED-8492'}`}
            onClick={() => setShowInviteSheet(true)}
          />
          <ListRow
            icon="📍"
            title="Enterprise Sites & Branches"
            subtitle="Register new farm paddocks or branch depots"
            onClick={() => setShowSiteSheet(true)}
          />
          <ListRow
            icon="📢"
            title="Team Broadcasts & Dispatches"
            subtitle="Urgent notifications, field dispatches & alerts"
            onClick={() => navigate('broadcasts')}
          />
        </div>
      </div>

      {/* Security & Audit Ledger */}
      <div className="space-y-1">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-2">
          Ledger & System Integrity
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl divide-y divide-slate-100 dark:divide-slate-700/60 shadow-xs overflow-hidden">
          <ListRow
            icon="🛡️"
            title="Cryptographic Audit Trail"
            subtitle="SHA-256 tamper-evident verification engine"
            onClick={() => navigate('audit-ledger')}
          />
          <ListRow
            icon="🔄"
            title="Sync & Offline Outbox"
            subtitle="Background queue, cloud persistence status"
            onClick={() => navigate('sync-status')}
          />
          <ListRow
            icon="💾"
            title="Device Storage Manager"
            subtitle="High-capacity IndexedDB, cache clear & reset"
            onClick={() => navigate('storage-manager')}
          />
        </div>
      </div>

      {/* Preferences & Navigation */}
      <div className="space-y-1">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-2">
          Preferences & Navigation
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl divide-y divide-slate-100 dark:divide-slate-700/60 shadow-xs overflow-hidden">
          <ListRow
            icon="🕒"
            title="Opened Pages / Recents"
            subtitle="Switch between recently visited screens"
            onClick={() => navigate('recent-pages')}
          />
          <ListRow
            icon="🔔"
            title="Notifications & Haptics"
            subtitle="Checkpoint alerts, vibrate on action"
            onClick={() => navigate('notification-prefs')}
          />
          <ListRow
            icon="💱"
            title="Currency & Regional Locale"
            subtitle="USD default, number formatting"
            onClick={() => navigate('currency-locale')}
          />
        </div>
      </div>

      {/* Sign Out Button */}
      {onSignOut && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onSignOut}
            className="w-full py-3 px-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-semibold text-xs text-center active:scale-[0.99] transition-all"
          >
            Sign Out of Account
          </button>
        </div>
      )}

      {/* Sheets */}
      <InviteCodeSheet
        isOpen={showInviteSheet}
        onClose={() => setShowInviteSheet(false)}
        activeMember={activeMember}
      />

      <SiteSheet
        isOpen={showSiteSheet}
        onClose={() => setShowSiteSheet(false)}
        activeMember={activeMember}
      />

      <BroadcastSheet
        isOpen={showBroadcastSheet}
        onClose={() => setShowBroadcastSheet(false)}
        activeMember={activeMember}
      />
    </div>
  );
};

