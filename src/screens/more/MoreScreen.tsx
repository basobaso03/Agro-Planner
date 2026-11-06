import React, { useState } from 'react';
import { useNavigation } from '../../navigation/useNavigation.ts';
import { dataService } from '../../services/dataService.ts';
import { ListRow } from '../../components/ui/ListRow.tsx';
import { isPrivacyMasked, togglePrivacyMask } from '../../utils/currency.ts';
import { PERMISSIONS, getRoleMeta } from '../../utils/permissions.ts';
import { InviteCodeSheet } from '../../sheets/common/InviteCodeSheet.tsx';
import { SiteSheet } from '../../sheets/common/SiteSheet.tsx';
import { BroadcastSheet } from '../../sheets/common/BroadcastSheet.tsx';
import { ModernWhatsAppIcon, ModernEmailIcon } from '../../components/DeveloperBrandInfo.tsx';
import type { OrgMember } from '../../types/agro.ts';

export interface MoreScreenProps {
  activeMember: OrgMember;
  showNumbers?: boolean;
  onToggleShowNumbers?: () => void;
  onSignOut?: () => void;
  onOpenSiteManager?: () => void;
}

export const MoreScreen: React.FC<MoreScreenProps> = ({
  activeMember,
  showNumbers,
  onToggleShowNumbers,
  onSignOut,
  onOpenSiteManager,
}) => {
  const { navigate } = useNavigation();
  const masked = showNumbers !== undefined ? !showNumbers : isPrivacyMasked();

  // Sheets
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [showSiteSheet, setShowSiteSheet] = useState(false);
  const [showBroadcastSheet, setShowBroadcastSheet] = useState(false);

  const canManage = PERMISSIONS.canManageMembers(activeMember.role);

  const org =
    (dataService.getState().organizations || []).find((o) => o.id === activeMember.orgId) ||
    dataService.getActiveOrganization(activeMember.orgId);

  const isAgro = org?.type !== 'GENERAL_VENTURE';
  const roleMeta = getRoleMeta(activeMember.role);

  const handleToggleMask = () => {
    if (onToggleShowNumbers) {
      onToggleShowNumbers();
    } else {
      togglePrivacyMask();
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 pb-24 max-w-2xl mx-auto w-full space-y-4">
      {/* Profile Card */}
      <div className="bg-white border border-[#E8DFCE] rounded-2xl p-4 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold flex items-center justify-center text-lg">
            {activeMember.fullName?.charAt(0) || 'U'}
          </div>
          <div>
            <div className="text-sm font-black text-slate-950">
              {activeMember.fullName}
            </div>
            <div className="text-xs text-slate-600 font-medium mt-0.5">
              {roleMeta.label} · {org?.name || 'Venture'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggleMask}
          className="px-3 py-1.5 rounded-xl border border-[#E0D7C6] bg-[#FAF8F5] text-xs font-bold text-slate-800 hover:bg-[#F0EBE1] flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
        >
          <span>{masked ? '👁️' : '🔒'}</span>
          <span>{masked ? 'Unmask' : 'Mask'}</span>
        </button>
      </div>

      {/* Enterprise & Team Governance */}
      <div className="space-y-1">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-600 px-2">
          Organization & Team
        </div>
        <div className="bg-white border border-[#E8DFCE] rounded-2xl divide-y divide-[#F0EBE1] shadow-xs overflow-hidden">
          <ListRow
            icon="🏢"
            title="Organisation & Account Settings"
            subtitle={`${org?.name || 'Workspace'} · ${org?.type === 'AGRO_FARMING' ? 'Agro-Farming Enterprise' : 'General Venture'}`}
            onClick={() => navigate('settings')}
          />
          <ListRow
            icon="👥"
            title="Syndicate Members & Equity"
            subtitle="View members, roles, capital deposits & profit shares"
            onClick={() => navigate('members')}
          />
          {canManage && (
            <ListRow
              icon="🔑"
              title="24-Hour Invite Code"
              subtitle={`Active code: ${org?.currentInviteCode || 'SEED-8492'}`}
              onClick={() => setShowInviteSheet(true)}
            />
          )}
          {isAgro && (
            <ListRow
              icon="📍"
              title="Enterprise Sites & Branches"
              subtitle="Register new farm paddocks, kraals or branch depots"
              onClick={() => (onOpenSiteManager ? onOpenSiteManager() : setShowSiteSheet(true))}
            />
          )}
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
        <div className="text-xs font-bold uppercase tracking-wider text-slate-600 px-2">
          Ledger & System Integrity
        </div>
        <div className="bg-white border border-[#E8DFCE] rounded-2xl divide-y divide-[#F0EBE1] shadow-xs overflow-hidden">
          <ListRow
            icon="🛡️"
            title="Audit Trail"
            subtitle="Tamper-evident verification engine"
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
        <div className="text-xs font-bold uppercase tracking-wider text-slate-600 px-2">
          Preferences & Navigation
        </div>
        <div className="bg-white border border-[#E8DFCE] rounded-2xl divide-y divide-[#F0EBE1] shadow-xs overflow-hidden">
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

      {/* Engineered by BASOBASO SOFTWARES & Direct Developer Contact */}
      <div className="bg-white border border-[#E8DFCE] rounded-3xl p-5 shadow-xs space-y-4 text-center">
        {/* Engineered by gradient badge as styled in Splash Screen */}
        <div className="flex flex-col items-center justify-center space-y-1">
          <span className="text-[10px] font-bold tracking-[0.25em] text-slate-400 uppercase">
            Engineered by
          </span>
          <span
            className="text-sm font-black tracking-[0.22em] uppercase text-transparent bg-clip-text animate-gradient-flow"
            style={{
              backgroundImage:
                'linear-gradient(90deg, #b45309 0%, #be123c 35%, #047857 70%, #b45309 100%)',
              backgroundSize: '200% auto',
            }}
          >
            BASOBASO SOFTWARES
          </span>
          <div className="w-16 h-0.5 rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 mt-1" />
        </div>

        <div className="space-y-1">
          <h4 className="text-xs font-bold text-slate-900">
            Developer Support &amp; Feedback
          </h4>
          <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
            Report bugs, request custom features, or share feedback directly with the lead engineer.
          </p>
        </div>

        {/* Contact Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-left">
          {/* WhatsApp Direct */}
          <a
            href="https://wa.me/263788123047?text=Hello%20Marlvin%20Basera%20%28BASOBASO%20SOFTWARES%29%2C%20I%20have%20feedback%20%2F%20bug%20report%20for%20Capital%20Seed."
            target="_blank"
            rel="noopener noreferrer"
            className="p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 flex items-center gap-3 transition-all active:scale-[0.98] group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <ModernWhatsAppIcon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                WhatsApp
              </div>
              <div className="text-xs font-bold text-slate-900 truncate">
                +263 788 123 047
              </div>
              <div className="text-[10px] text-emerald-700 font-medium">
                Instant Chat &amp; Feedback
              </div>
            </div>
          </a>

          {/* Email Direct */}
          <a
            href="mailto:baseramarlvin@gmail.com?subject=Capital%20Seed%20Feedback%20%2F%20Bug%20Report&body=Hello%20Marlvin%20%28BASOBASO%20SOFTWARES%29%2C%0A%0AI%20am%20using%20Capital%20Seed%20v1.0.5%20and%20would%20like%20to%20share%20the%20following%3A%0A%0A"
            className="p-3 rounded-2xl bg-sky-50 hover:bg-sky-100/80 border border-sky-200 flex items-center gap-3 transition-all active:scale-[0.98] group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <ModernEmailIcon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-sky-800 uppercase tracking-wider">
                Email
              </div>
              <div className="text-xs font-bold text-slate-900 truncate">
                baseramarlvin@gmail.com
              </div>
              <div className="text-[10px] text-sky-700 font-medium">
                Direct Engineering Inbox
              </div>
            </div>
          </a>
        </div>

        {/* App Version Tag */}
        <div className="pt-2 border-t border-[#F0EBE1] flex items-center justify-between text-[11px] text-slate-500">
          <span className="font-semibold text-slate-600">Capital Seed Platform</span>
          <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
            v1.0.5 Production
          </span>
        </div>
      </div>

      {/* Sign Out Button */}
      {onSignOut && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onSignOut}
            className="w-full py-3 px-4 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-xs text-center active:scale-[0.99] transition-all cursor-pointer shadow-xs"
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

      {isAgro && (
        <SiteSheet
          isOpen={showSiteSheet}
          onClose={() => setShowSiteSheet(false)}
          activeMember={activeMember}
        />
      )}

      <BroadcastSheet
        isOpen={showBroadcastSheet}
        onClose={() => setShowBroadcastSheet(false)}
        activeMember={activeMember}
      />
    </div>
  );
};

