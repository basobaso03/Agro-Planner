import React, { useState, useMemo } from 'react';
import {
  X,
  CheckCheck,
  Send,
  Radio,
  Search,
  Filter,
  PlusCircle,
  Bell,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type {
  AuditNotificationEvent,
  FarmLocation,
  NotificationSeverity,
  OrgMember,
} from '../types/agro.ts';
import { NotificationCard } from './NotificationCard.tsx';
import { NotificationDetailModal } from './NotificationDetailModal.tsx';
import { getEventCategory, NotificationCategory } from '../utils/notificationFormatter.ts';
import { nativeHaptics } from '../native/haptics.ts';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AuditNotificationEvent[];
  activeMember: OrgMember;
  locations: FarmLocation[];
  onMarkAllRead: () => void;
  onPostBroadcast: (data: {
    locationId: string;
    severity: NotificationSeverity;
    title: string;
    message: string;
  }) => void;
  onOpenDetails?: (notification: AuditNotificationEvent) => void;
  onMarkRead?: (id: string) => void;
  onMarkUnread?: (id: string) => void;
  onNavigateToRoute?: (routeId: string, params?: Record<string, string>) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  activeMember,
  locations,
  onMarkAllRead,
  onPostBroadcast,
  onOpenDetails,
  onMarkRead,
  onMarkUnread,
  onNavigateToRoute,
}) => {
  const [activeTab, setActiveTab] = useState<'ALL' | 'UNREAD'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | NotificationCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<AuditNotificationEvent | null>(null);

  // Broadcast Composer State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [locationId, setLocationId] = useState(
    activeMember.assignedLocationId || locations[0]?.id || 'ALL'
  );
  const [severity, setSeverity] = useState<NotificationSeverity>('URGENT_GROUND');

  // Compute Unread count
  const unreadCount = useMemo(() => {
    return notifications.filter(
      (n) => !(n.readByMemberIds || []).includes(activeMember.id)
    ).length;
  }, [notifications, activeMember.id]);

  // Filtered Notifications list
  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      // Tab filter
      const isRead = (item.readByMemberIds || []).includes(activeMember.id);
      if (activeTab === 'UNREAD' && isRead) return false;

      // Category filter
      if (categoryFilter !== 'ALL') {
        const cat = getEventCategory(item.eventType);
        if (cat !== categoryFilter) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = (item.title || '').toLowerCase().includes(query);
        const matchesMsg = (item.message || '').toLowerCase().includes(query);
        const matchesActor = (item.actorName || '').toLowerCase().includes(query);
        const matchesLoc = (item.locationName || '').toLowerCase().includes(query);
        if (!matchesTitle && !matchesMsg && !matchesActor && !matchesLoc) return false;
      }

      return true;
    });
  }, [notifications, activeTab, categoryFilter, searchQuery, activeMember.id]);

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 4) return;
    try {
      void nativeHaptics.impact('medium');
      onPostBroadcast({
        locationId,
        severity,
        title: title.trim() || `Ground Report from ${activeMember.fullName}`,
        message: message.trim(),
      });
      setTitle('');
      setMessage('');
      setShowComposer(false);
    } catch (err) {
      console.warn('Notification drawer broadcast error:', err);
    }
  };

  const handleCardDetailsClick = (item: AuditNotificationEvent) => {
    // Auto-mark as read on open if currently unread
    const isUnread = !(item.readByMemberIds || []).includes(activeMember.id);
    if (isUnread && onMarkRead) {
      onMarkRead(item.id);
    }

    if (onOpenDetails) {
      onOpenDetails(item);
    } else {
      setSelectedNotification(item);
    }
  };

  const handleToggleRead = (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (!target) return;
    const isRead = (target.readByMemberIds || []).includes(activeMember.id);
    if (isRead) {
      if (onMarkUnread) onMarkUnread(id);
    } else {
      if (onMarkRead) onMarkRead(id);
    }
  };

  return (
    <>
      <div
        style={{
          top: 'var(--vvo, 0px)',
          height: 'var(--vvh, 100dvh)',
        }}
        className="fixed left-0 right-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-end transition-opacity overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-notifications-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="w-full sm:max-w-md bg-[#FAF7F2] border-l border-[#E8DFCE] h-full flex flex-col shadow-2xl pt-safe overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-white border-b border-[#E8DFCE] flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4 text-amber-600" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2
                    id="drawer-notifications-title"
                    className="text-sm font-black text-slate-950 tracking-tight truncate"
                  >
                    Notifications & Alerts
                  </h2>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white leading-none">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 truncate">
                  Live Farm Stream & Verified Ledger
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    void nativeHaptics.impact('light');
                    onMarkAllRead();
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-[#FAF8F5] hover:bg-[#F0EBE1] border border-[#E0D7C6] text-xs font-bold text-emerald-800 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Mark all notifications as read"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Mark All Read</span>
                  <span className="sm:hidden">Read All</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close notifications"
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Filter Bar: Tabs & Search */}
          <div className="p-3 bg-white border-b border-[#E8DFCE] space-y-2.5 shrink-0">
            {/* Read/Unread Dual Tabs */}
            <div className="flex items-center gap-1.5 bg-[#FAF8F5] p-1 rounded-xl border border-[#E0D7C6]">
              <button
                type="button"
                onClick={() => {
                  void nativeHaptics.impact('light');
                  setActiveTab('ALL');
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'ALL'
                    ? 'bg-white text-slate-950 shadow-xs border border-[#E8DFCE]'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>All</span>
                <span className="text-[10px] opacity-75 font-mono">({notifications.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  void nativeHaptics.impact('light');
                  setActiveTab('UNREAD');
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'UNREAD'
                    ? 'bg-white text-amber-950 shadow-xs border border-amber-300'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>Unread</span>
                {unreadCount > 0 ? (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-white font-mono">
                    {unreadCount}
                  </span>
                ) : (
                  <span className="text-[10px] opacity-75 font-mono">(0)</span>
                )}
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search alerts, actors, sites..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-[11px]">
              {(['ALL', 'FINANCE', 'LIVESTOCK', 'RUNWAY', 'OPERATIONS', 'SECURITY'] as const).map(
                (cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      void nativeHaptics.impact('light');
                      setCategoryFilter(cat);
                    }}
                    className={`px-2.5 py-1 rounded-full font-bold whitespace-nowrap transition-colors cursor-pointer border ${
                      categoryFilter === cat
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-[#FAF8F5] text-slate-600 border-[#E0D7C6] hover:bg-[#F0EBE1]'
                    }`}
                  >
                    {cat === 'ALL' ? 'All Categories' : cat.charAt(0) + cat.slice(1).toLowerCase()}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Quick Ground Broadcast Composer Toggle */}
          <div className="border-b border-[#E8DFCE] bg-white shrink-0">
            <button
              type="button"
              onClick={() => setShowComposer(!showComposer)}
              className="w-full px-4 py-2 flex items-center justify-between text-xs font-bold text-amber-900 hover:bg-amber-50/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                <span>Quick Ground Broadcast</span>
              </div>
              {showComposer ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <div className="flex items-center gap-1 text-[11px] text-amber-700">
                  <span>Send Update</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </div>
              )}
            </button>

            {showComposer && (
              <form onSubmit={handleSend} className="p-3.5 pt-1 space-y-2.5 bg-amber-50/20">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-700 truncate">
                    Broadcasting as <strong className="text-amber-800">{activeMember.fullName}</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <select
                      aria-label="Broadcast Location"
                      value={locationId}
                      onChange={(e) => setLocationId(e.target.value)}
                      className="bg-white border border-[#E0D7C6] rounded-xl px-2 py-1 text-xs font-medium text-slate-800 focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="ALL">All Sites</option>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Broadcast Severity"
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as NotificationSeverity)}
                      className="bg-white border border-[#E0D7C6] rounded-xl px-2 py-1 text-xs font-medium text-slate-800 focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="URGENT_GROUND">Urgent</option>
                      <option value="MILESTONE">Milestone</option>
                      <option value="INFO">General Info</option>
                    </select>
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="Headline (e.g. Field Inspection Complete at Norton)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-white border border-[#E0D7C6] rounded-xl px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 transition-colors"
                />

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Write ground status update (min 4 chars)..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="flex-1 bg-white border border-[#E0D7C6] rounded-xl px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Notifications Stream List */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3.5 space-y-2.5 pb-safe">
            {filteredNotifications.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto">
                  <Bell className="w-6 h-6" />
                </div>
                <div className="font-bold text-xs text-slate-700">
                  {activeTab === 'UNREAD' ? 'No Unread Notifications' : 'No Notifications Found'}
                </div>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  {activeTab === 'UNREAD'
                    ? 'All farm activity alerts and ledger records have been read.'
                    : searchQuery
                    ? 'No records match your active search filter.'
                    : 'Activity across expenses, livestock, and runway plans will appear here.'}
                </p>
                {activeTab === 'UNREAD' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('ALL')}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 underline mt-2"
                  >
                    View All Activity ({notifications.length})
                  </button>
                )}
              </div>
            ) : (
              filteredNotifications.map((item) => (
                <NotificationCard
                  key={item.id}
                  notification={item}
                  activeMember={activeMember}
                  onOpenDetails={handleCardDetailsClick}
                  onToggleRead={handleToggleRead}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Local Notification Detail Modal if not handled by parent */}
      {!onOpenDetails && selectedNotification && (
        <NotificationDetailModal
          isOpen={Boolean(selectedNotification)}
          onClose={() => setSelectedNotification(null)}
          notification={selectedNotification}
          activeMember={activeMember}
          onMarkRead={onMarkRead}
          onMarkUnread={onMarkUnread}
          onNavigateToRoute={onNavigateToRoute}
        />
      )}
    </>
  );
};
