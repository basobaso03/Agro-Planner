import React, { useState } from 'react';
import { Clock, ChevronRight, Bell, Sparkles } from 'lucide-react';
import { useNavigation } from '../../navigation/useNavigation.ts';
import type { AuditNotificationEvent, OrgMember } from '../../types/agro.ts';
import { NotificationCard } from '../../components/NotificationCard.tsx';
import { NotificationDetailModal } from '../../components/NotificationDetailModal.tsx';
import { dataService } from '../../services/dataService.ts';

export interface RecentActivityProps {
  notifications: AuditNotificationEvent[];
  showNumbers?: boolean;
  activeMember?: OrgMember;
  onOpenNotificationsDrawer?: () => void;
  onSelectNotification?: (notification: AuditNotificationEvent) => void;
}

export const RecentActivity: React.FC<RecentActivityProps> = ({
  notifications,
  showNumbers = true,
  activeMember,
  onOpenNotificationsDrawer,
  onSelectNotification,
}) => {
  const { navigate } = useNavigation();
  const [selectedNotification, setSelectedNotification] = useState<AuditNotificationEvent | null>(null);

  const recentItems = notifications.slice(0, 4);
  if (recentItems.length === 0) return null;

  // Derive active member fallback from state if not provided
  const member = activeMember || dataService.getState().members[0] || {
    id: 'guest',
    fullName: 'Team Member',
    email: '',
    role: 'MEMBER' as const,
    status: 'ACTIVE' as const,
    joinedAt: new Date().toISOString(),
  };

  const handleOpenDetails = (item: AuditNotificationEvent) => {
    // Automatically mark read if unread
    const isUnread = !(item.readByMemberIds || []).includes(member.id);
    if (isUnread) {
      dataService.markNotificationRead(item.id, member.id);
    }

    if (onSelectNotification) {
      onSelectNotification(item);
    } else {
      setSelectedNotification(item);
    }
  };

  const handleToggleRead = (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (!target) return;
    const isRead = (target.readByMemberIds || []).includes(member.id);
    if (isRead) {
      dataService.markNotificationUnread(id, member.id);
    } else {
      dataService.markNotificationRead(id, member.id);
    }
  };

  const unreadCount = recentItems.filter(
    (n) => !(n.readByMemberIds || []).includes(member.id)
  ).length;

  return (
    <>
      <div className="space-y-2 py-1">
        {/* Section Header */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>Recent Activity & Alerts</span>
            </span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-500 text-white">
                {unreadCount} new
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onOpenNotificationsDrawer && (
              <button
                type="button"
                onClick={onOpenNotificationsDrawer}
                className="text-[11px] font-bold text-amber-700 hover:text-amber-800 flex items-center gap-0.5 cursor-pointer"
              >
                <span>Stream</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('auditLedger')}
              className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5 cursor-pointer"
            >
              <span>Ledger</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Compact Notification List */}
        <div className="bg-white rounded-3xl border border-[#E8DFCE] divide-y divide-[#F0EBE1] overflow-hidden shadow-xs">
          {recentItems.map((item) => (
            <NotificationCard
              key={item.id}
              notification={item}
              activeMember={member}
              onOpenDetails={handleOpenDetails}
              onToggleRead={handleToggleRead}
              compact
            />
          ))}
        </div>
      </div>

      {/* Internal Notification Detail Modal */}
      {!onSelectNotification && selectedNotification && (
        <NotificationDetailModal
          isOpen={Boolean(selectedNotification)}
          onClose={() => setSelectedNotification(null)}
          notification={selectedNotification}
          activeMember={member}
          onMarkRead={(id) => dataService.markNotificationRead(id, member.id)}
          onMarkUnread={(id) => dataService.markNotificationUnread(id, member.id)}
          onNavigateToRoute={(routeId, params) => navigate(routeId as any, params)}
        />
      )}
    </>
  );
};
