import React, { useState } from 'react';
import { X, CheckCheck, Send, ShieldCheck, Radio } from 'lucide-react';
import type {
  AuditNotificationEvent,
  FarmLocation,
  NotificationSeverity,
  SyndicateMember,
} from '../types/agro.ts';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AuditNotificationEvent[];
  activeMember: SyndicateMember;
  locations: FarmLocation[];
  onMarkAllRead: () => void;
  onPostBroadcast: (data: {
    locationId: string;
    severity: NotificationSeverity;
    title: string;
    message: string;
  }) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  activeMember,
  locations,
  onMarkAllRead,
  onPostBroadcast,
}) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [locationId, setLocationId] = useState(
    activeMember.assignedLocationId || locations[0]?.id || 'ALL'
  );
  const [severity, setSeverity] = useState<NotificationSeverity>('URGENT_GROUND');

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 4) return;
    onPostBroadcast({
      locationId,
      severity,
      title: title.trim() || `Ground Report from ${activeMember.fullName}`,
      message: message.trim(),
    });
    setTitle('');
    setMessage('');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-end transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-notifications-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full sm:max-w-md bg-[#FAF7F2] border-l border-[#E8DFCE] h-full flex flex-col shadow-2xl pt-safe">
        {/* Drawer Header - Clean & Safe from Phone Top */}
        <div className="px-4 py-3 bg-white border-b border-[#E8DFCE] flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Radio className="w-4 h-4 text-amber-600 animate-pulse" />
            </div>
            <div className="min-w-0">
              <h2 id="drawer-notifications-title" className="text-sm font-bold text-slate-900 tracking-tight truncate">
                Ground Stream & Notifications
              </h2>
              <p className="text-[11px] text-slate-500">Live Syndicate Activity Log</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onMarkAllRead}
              className="px-2.5 py-1.5 rounded-xl bg-[#FAF8F5] hover:bg-[#F0EBE1] border border-[#E0D7C6] text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Mark all notifications as read"
            >
              <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Mark Read</span>
            </button>
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

        {/* Quick Ground Broadcast Composer */}
        <form onSubmit={handleSend} className="p-4 bg-white border-b border-[#E8DFCE] space-y-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-700 truncate">
              Broadcast as <span className="text-amber-800 font-bold">{activeMember.fullName}</span>
            </span>
            <div className="flex items-center gap-2">
              <select
                aria-label="Broadcast Location"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-amber-500 cursor-pointer"
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
                className="bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="URGENT_GROUND">Urgent Ground</option>
                <option value="MILESTONE">Milestone</option>
                <option value="INFO">General Info</option>
              </select>
            </div>
          </div>

          <input
            type="text"
            placeholder="Headline (e.g., Vet Inspection Complete at Norton)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
          />

          <div className="flex items-center gap-2">
            <input
              type="text"
              required
              placeholder="Write ground status update (min 4 chars)..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="flex-1 bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
            />
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs hover:shadow-sm flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </div>
        </form>

        {/* Notifications Stream List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-safe">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No recent notifications or ground alerts.
            </div>
          ) : (
            notifications.map((item) => {
              const isUnread = !item.readByMemberIds.includes(activeMember.id);
              const isUrgent = item.severity === 'URGENT_GROUND';
              const isContra = item.severity === 'WARNING_CONTRA';

              return (
                <div
                  key={item.id}
                  className={`rounded-2xl p-3.5 border transition-all ${
                    isUnread
                      ? 'bg-white border-amber-400 shadow-sm'
                      : 'bg-white/80 border-[#E8DFCE] hover:border-[#D6CBBA]'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-700">
                      #{item.sequenceNumber} · {item.locationName} · {item.actorName}
                    </span>
                    <span className="font-mono text-slate-400">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="mt-1 flex items-start gap-1.5">
                    {isUrgent && (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                        URGENT
                      </span>
                    )}
                    {isContra && (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 shrink-0">
                        CONTRA
                      </span>
                    )}
                    <p className="text-xs font-bold text-slate-900 leading-snug">{item.title}</p>
                  </div>

                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.message}</p>

                  <div className="mt-2.5 pt-2 border-t border-[#F0EBE1] flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Verified Record #{item.sequenceNumber}
                    </span>
                    {typeof item.deltaFinancial === 'number' && item.deltaFinancial !== 0 && (
                      <span
                        className={`font-mono font-bold ${
                          item.deltaFinancial > 0 ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {item.deltaFinancial > 0 ? '+' : ''}${item.deltaFinancial.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
