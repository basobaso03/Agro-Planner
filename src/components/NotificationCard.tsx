import React from 'react';
import {
  CheckCheck,
  Circle,
  ChevronRight,
  ShieldCheck,
  MapPin,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import type { AuditNotificationEvent, OrgMember } from '../types/agro.ts';
import { formatNotification } from '../utils/notificationFormatter.ts';
import { nativeHaptics } from '../native/haptics.ts';

export interface NotificationCardProps {
  notification: AuditNotificationEvent;
  activeMember: OrgMember;
  onOpenDetails: (notification: AuditNotificationEvent) => void;
  onToggleRead?: (id: string) => void;
  compact?: boolean;
}

export const NotificationCard: React.FC<NotificationCardProps> = ({
  notification,
  activeMember,
  onOpenDetails,
  onToggleRead,
  compact = false,
}) => {
  const isRead = (notification.readByMemberIds || []).includes(activeMember.id);
  const parsed = formatNotification(notification);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    void nativeHaptics.impact('light');
    if (onToggleRead) {
      onToggleRead(notification.id);
    }
  };

  const handleCardClick = () => {
    void nativeHaptics.impact('light');
    onOpenDetails(notification);
  };

  if (compact) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCardClick();
          }
        }}
        className={`p-3.5 transition-all text-left flex items-start gap-3 cursor-pointer group ${
          isRead
            ? 'bg-white hover:bg-slate-50/80 text-slate-700'
            : 'bg-slate-50/70 hover:bg-slate-100 border-l-4 border-l-slate-950 text-slate-950'
        }`}
      >
        {/* Category Indicator Dot or Icon */}
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
            isRead
              ? 'bg-slate-100 text-slate-500 border-slate-200'
              : 'bg-white text-slate-950 border-slate-300 shadow-2xs'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isRead ? 'bg-slate-400' : 'bg-slate-950'}`} />
        </div>

        {/* Content Preview */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${parsed.categoryStyles.bg} ${parsed.categoryStyles.text} ${parsed.categoryStyles.border}`}
              >
                {parsed.categoryLabel}
              </span>
              <span className="text-[10px] text-slate-500 font-medium truncate">
                {parsed.locationName}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono shrink-0">
              {parsed.relativeTime}
            </span>
          </div>

          <div
            className={`text-xs mt-1 truncate ${
              isRead ? 'font-semibold text-slate-800' : 'font-black text-slate-950'
            }`}
          >
            {parsed.cleanTitle}
          </div>

          <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
            {parsed.shortSummary}
          </div>

          {/* Action Row */}
          <div className="mt-2 flex items-center justify-between text-[11px] pt-1">
            {parsed.metricBadge ? (
              <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {parsed.metricBadge.value}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 font-mono">
                Seq #{parsed.sequenceNumber}
              </span>
            )}

            <button
              type="button"
              onClick={handleCardClick}
              className="text-[11px] font-bold text-slate-900 hover:text-black group-hover:translate-x-0.5 transition-all flex items-center gap-0.5 cursor-pointer"
            >
              <span>View Details</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-700" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Full Notification Card (for Drawer & Streams)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
      className={`rounded-2xl p-4 border transition-all text-left relative overflow-hidden group cursor-pointer ${
        isRead
          ? 'bg-white/80 border-[#E8DFCE] hover:border-[#D6CBBA] shadow-xs'
          : 'bg-white border-slate-950 shadow-sm ring-1 ring-slate-950/20'
      }`}
    >
      {/* Top Meta Bar */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 gap-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 shrink-0 ${parsed.categoryStyles.bg} ${parsed.categoryStyles.text} ${parsed.categoryStyles.border}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${parsed.categoryStyles.dot}`} />
            {parsed.categoryLabel}
          </span>

          {parsed.severity !== 'INFO' && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${parsed.severityStyles.bg} ${parsed.severityStyles.text} ${parsed.severityStyles.border}`}
            >
              {parsed.severity.replace(/_/g, ' ')}
            </span>
          )}

          {!isRead && (
            <span className="w-2 h-2 rounded-full bg-slate-950 ring-2 ring-slate-200 shrink-0" />
          )}

          <span className="font-semibold text-slate-600 truncate">
            {parsed.locationName}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-mono text-[10px] text-slate-400">
            {parsed.relativeTime}
          </span>
          {onToggleRead && (
            <button
              type="button"
              onClick={handleToggle}
              title={isRead ? 'Mark as unread' : 'Mark as read'}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {isRead ? (
                <CheckCheck className="w-3.5 h-3.5 text-slate-500" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-slate-950 fill-slate-950" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main Title & Short Summary */}
      <div className="mt-2 space-y-1">
        <h3
          className={`text-xs sm:text-sm leading-snug line-clamp-1 ${
            isRead ? 'font-bold text-slate-800' : 'font-black text-slate-950'
          }`}
        >
          {parsed.cleanTitle}
        </h3>

        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
          {parsed.shortSummary}
        </p>
      </div>

      {/* Metric Badge & Footer Action Bar */}
      <div className="mt-3 pt-2.5 border-t border-[#F0EBE1] flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-2 min-w-0">
          {parsed.metricBadge ? (
            <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-950 border border-slate-200">
              {parsed.metricBadge.value}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-slate-500 font-medium truncate">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <span>Record #{parsed.sequenceNumber}</span>
            </span>
          )}

          <span className="text-slate-400 text-[10px] truncate hidden sm:inline">
            by {parsed.actor.name}
          </span>
        </div>

        {/* View Details Action Button - High contrast black & white style */}
        <button
          type="button"
          onClick={handleCardClick}
          className="px-2.5 py-1 rounded-xl bg-[#FAF8F5] hover:bg-[#F0EBE1] border border-[#E0D7C6] text-xs font-bold text-slate-900 flex items-center gap-1 transition-colors cursor-pointer group-hover:border-slate-500"
        >
          <span>View Details</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-700 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
};

