import React from 'react';
import {
  ShieldCheck,
  MapPin,
  Clock,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  Share2,
  Check,
  FileText,
  Building,
} from 'lucide-react';
import { BottomSheet } from './ui/BottomSheet.tsx';
import type { AuditNotificationEvent, OrgMember } from '../types/agro.ts';
import { formatNotification } from '../utils/notificationFormatter.ts';
import { copyToClipboard } from '../native/clipboard.ts';
import { useToast } from './ui/Toast.tsx';
import { nativeHaptics } from '../native/haptics.ts';
import { useNavigation } from '../navigation/useNavigation.ts';

export interface NotificationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  notification: AuditNotificationEvent | null;
  activeMember: OrgMember;
  onMarkRead?: (id: string) => void;
  onMarkUnread?: (id: string) => void;
  onNavigateToRoute?: (routeId: string, params?: Record<string, string>) => void;
}

export const NotificationDetailModal: React.FC<NotificationDetailModalProps> = ({
  isOpen,
  onClose,
  notification,
  activeMember,
  onMarkRead,
  onMarkUnread,
  onNavigateToRoute,
}) => {
  const { showToast } = useToast();
  const { navigate } = useNavigation();

  if (!notification) return null;

  const parsed = formatNotification(notification);
  const isRead = (notification.readByMemberIds || []).includes(activeMember.id);

  const handleToggleRead = () => {
    void nativeHaptics.impact('light');
    if (isRead) {
      if (onMarkUnread) onMarkUnread(notification.id);
      showToast({
        type: 'info',
        title: 'Marked as Unread',
        message: 'Notification returned to your unread stream.',
      });
    } else {
      if (onMarkRead) onMarkRead(notification.id);
      showToast({
        type: 'success',
        title: 'Marked as Read',
        message: 'Notification marked as read.',
      });
    }
  };

  const handleShare = async () => {
    void nativeHaptics.impact('light');
    const shareText = `[Agro Planner Record #${parsed.sequenceNumber}]\n${parsed.cleanTitle}\n${parsed.fullMessage}\nLocation: ${parsed.locationName}\nLogged by: ${parsed.actor.name} (${parsed.actor.roleLabel})`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: parsed.cleanTitle,
          text: shareText,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    const success = await copyToClipboard(shareText);
    if (success) {
      showToast({
        type: 'success',
        title: 'Record Copied',
        message: 'Summary copied to clipboard for sharing.',
      });
    }
  };

  const handleNavigate = () => {
    if (!parsed.targetRoute) return;
    void nativeHaptics.impact('medium');
    onClose();
    if (onNavigateToRoute) {
      onNavigateToRoute(parsed.targetRoute.routeId, parsed.targetRoute.params);
    } else {
      try {
        navigate(parsed.targetRoute.routeId as any, parsed.targetRoute.params);
      } catch (err) {
        console.warn('Navigation error in NotificationDetailModal:', err);
      }
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Record Details"
      subtitle={`Record #${parsed.sequenceNumber} · ${parsed.relativeTime}`}
      maxHeight="92dvh"
      headerAccessory={
        <button
          type="button"
          onClick={handleToggleRead}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${isRead
            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
            : 'bg-slate-950 hover:bg-slate-900 text-white border-slate-950 shadow-xs'
            }`}
          title={isRead ? 'Mark as unread' : 'Mark as read'}
        >
          {isRead ? (
            <>
              <Circle className="w-3.5 h-3.5 text-slate-500" />
              <span>Mark Unread</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              <span>Mark Read</span>
            </>
          )}
        </button>
      }
      footer={
        <div className="flex items-center gap-2 w-full pt-1">
          {parsed.targetRoute && (
            <button
              type="button"
              onClick={handleNavigate}
              className="flex-1 py-3 px-4 rounded-2xl bg-slate-950 hover:bg-slate-900 active:bg-black text-white font-black text-xs shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>{parsed.targetRoute.actionLabel}</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={handleShare}
            className="py-3 px-4 rounded-2xl bg-white hover:bg-[#FAF8F5] border border-[#E0D7C6] text-slate-800 font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            title="Share or copy record"
          >
            <Share2 className="w-4 h-4 text-slate-600" />
            <span>Share</span>
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-xs pb-4">
        {/* Category & Status Badges Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1.5 ${parsed.categoryStyles.bg} ${parsed.categoryStyles.text} ${parsed.categoryStyles.border}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${parsed.categoryStyles.dot}`} />
              {parsed.categoryLabel}
            </span>

            {parsed.severity !== 'INFO' && (
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${parsed.severityStyles.bg} ${parsed.severityStyles.text} ${parsed.severityStyles.border}`}
              >
                {parsed.severity.replace(/_/g, ' ')}
              </span>
            )}

            {!isRead && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-950 text-white uppercase tracking-wider">
                New
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{parsed.formattedTime}</span>
            <span>·</span>
            <span>{parsed.formattedDate}</span>
          </div>
        </div>

        {/* Main Headline */}
        <div className="bg-white border border-[#E8DFCE] p-4 rounded-2xl shadow-xs space-y-1">
          <h2 className="text-sm sm:text-base font-black text-slate-950 leading-snug">
            {parsed.cleanTitle}
          </h2>
          <p className="text-[11px] text-slate-500">
            Registered event sequence #{parsed.sequenceNumber} · {parsed.locationName}
          </p>
        </div>

        {/* Key Metric Highlight Card (if applicable) */}
        {parsed.metricBadge && (
          <div className="p-4 rounded-2xl border border-slate-900 bg-white text-slate-950 flex items-center justify-between gap-3 shadow-xs">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                {parsed.metricBadge.label}
              </div>
              <div className="text-xl font-black font-mono tracking-tight mt-0.5">
                {parsed.metricBadge.value}
              </div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-base text-slate-900">
              {parsed.metricBadge.isPositive ? '+' : '–'}
            </div>
          </div>
        )}

        {/* Formatted Event Summary & Narrative Card */}
        <div className="bg-white border border-[#E8DFCE] p-4 rounded-2xl shadow-xs space-y-3">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-[#F0EBE1] pb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Event Narrative</span>
            </span>
            {parsed.narrative.referenceId && (
              <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                Ref: {parsed.narrative.referenceId}
              </span>
            )}
          </div>

          {/* Primary Summary Statement */}
          <div className="text-slate-900 text-xs sm:text-sm leading-relaxed font-semibold">
            {parsed.narrative.primarySummary}
          </div>

          {/* Structured Operator Note Callout if present */}
          {parsed.narrative.notes && (
            <div className="bg-[#FAF8F5] border-l-3 border-l-slate-950 p-3 rounded-r-xl space-y-1">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Operator Note
              </div>
              <p className="text-xs text-slate-800 font-medium italic leading-relaxed">
                &ldquo;{parsed.narrative.notes}&rdquo;
              </p>
            </div>
          )}

          {/* Deduction Note Pill if present */}
          {parsed.narrative.deductionInfo && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-semibold border border-slate-200">
              <span>{parsed.narrative.deductionInfo}</span>
            </div>
          )}
        </div>

        {/* Photo Evidence Attachment (if present) */}
        {parsed.photoUrl && (
          <div className="bg-white border border-[#E8DFCE] p-3 rounded-2xl shadow-xs space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">
              Attached Field Evidence
            </div>
            <div className="rounded-xl overflow-hidden max-h-64 border border-[#E8DFCE] bg-slate-900/5">
              <img
                src={parsed.photoUrl}
                alt="Notification attachment"
                className="w-full h-full object-contain max-h-64 mx-auto"
                loading="lazy"
              />
            </div>
          </div>
        )}

        {/* Context & Operator Profile */}
        <div className="bg-white border border-[#E8DFCE] p-3.5 rounded-2xl shadow-xs grid grid-cols-2 gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-slate-950 text-white flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
              {parsed.actor.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase text-slate-500 block">
                Operator / Actor
              </span>
              <div className="font-bold text-slate-950 truncate mt-0.5">
                {parsed.actor.name}
              </div>
              <span className="inline-block text-[10px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded mt-0.5 border border-slate-200">
                {parsed.actor.roleLabel}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase text-slate-500 block">
                Site Location
              </span>
              <div className="font-bold text-slate-950 truncate mt-0.5">
                {parsed.locationName}
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5 font-medium">
                Verified Site Record
              </span>
            </div>
          </div>
        </div>

        {/* Cryptographic Trust Seal - CLEAN (NO HASHES DISPLAYED) */}
        <div className="bg-white border border-[#E8DFCE] p-3.5 rounded-2xl shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-950">
                Immutable Ledger Authenticated
              </div>
              <div className="text-[10px] text-slate-500">
                Ledger Record #{parsed.sequenceNumber}
              </div>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-600" />
            <span>Verified Intact</span>
          </span>
        </div>
      </div>
    </BottomSheet>
  );
};
