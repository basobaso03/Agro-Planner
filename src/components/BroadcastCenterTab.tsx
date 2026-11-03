import React, { useState, useRef } from 'react';
import {
  Radio,
  Send,
  AlertTriangle,
  Sparkles,
  Camera,
  X,
  CheckCircle2,
  Building,
  Image as ImageIcon,
  Clock,
  Filter,
  Eye,
  Megaphone,
} from 'lucide-react';
import type {
  AuditNotificationEvent,
  FarmLocation,
  NotificationSeverity,
  OrgMember,
} from '../types/agro.ts';
import { compressImage, validateImageFile } from '../utils/imageUpload.ts';
import { dataService } from '../services/dataService.ts';

interface BroadcastCenterTabProps {
  notifications: AuditNotificationEvent[];
  locations: FarmLocation[];
  activeMember: OrgMember;
  onPostBroadcast: (data: {
    locationId: string;
    severity: NotificationSeverity;
    title: string;
    message: string;
    photoUrl?: string;
  }) => void;
  showNumbers?: boolean;
}

export const BroadcastCenterTab: React.FC<BroadcastCenterTabProps> = ({
  notifications,
  locations,
  activeMember,
  onPostBroadcast,
  showNumbers = true,
}) => {
  // Composer State
  const broadcastFileInputRef = useRef<HTMLInputElement>(null);
  const [bLocId, setBLocId] = useState<string>('ALL');
  const [bSeverity, setBSeverity] = useState<NotificationSeverity>('URGENT_GROUND');
  const [bTitle, setBTitle] = useState('');
  const [bMessage, setBMessage] = useState('');
  const [bPhoto, setBPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [postSuccess, setPostSuccess] = useState(false);

  // Filter State
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'URGENT' | 'MILESTONE' | 'PHOTOS'>('ALL');

  // Fullscreen Photo Lightbox
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title: string } | null>(null);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError('');
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setPhotoError(validation.error || 'Invalid image file.');
      return;
    }

    try {
      const compressed = await compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.78 });
      setBPhoto(compressed);
    } catch {
      setPhotoError('Failed to process ground photo. Please try a different image.');
    } finally {
      e.target.value = '';
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bMessage.trim()) return;

    setIsPosting(true);
    setPhotoError('');

    try {
      onPostBroadcast({
        locationId: bLocId,
        severity: bSeverity,
        title: bTitle.trim() || `Field Update from ${activeMember.fullName}`,
        message: bMessage.trim(),
        photoUrl: bPhoto || undefined,
      });

      setBTitle('');
      setBMessage('');
      setBPhoto(null);
      setPostSuccess(true);
      setTimeout(() => setPostSuccess(false), 3000);
    } catch (err: unknown) {
      setPhotoError(err instanceof Error ? err.message : 'Failed to dispatch broadcast.');
    } finally {
      setIsPosting(false);
    }
  };

  const handleMarkAllRead = () => {
    dataService.markAllNotificationsRead(activeMember.id);
  };

  // Filter broadcasts
  const broadcasts = notifications.filter((ev) => {
    if (severityFilter === 'URGENT') return ev.severity === 'URGENT_GROUND';
    if (severityFilter === 'MILESTONE') return ev.severity === 'MILESTONE';
    if (severityFilter === 'PHOTOS') return Boolean(ev.photoUrl);
    return true;
  });

  const unreadCount = notifications.filter(
    (n) => !Array.isArray(n.readByMemberIds) || !n.readByMemberIds.includes(activeMember.id)
  ).length;

  return (
    <div className="space-y-5 animate-fade-in pb-16">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-3xl bg-white border border-[#E8DFCE] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
            <Radio className="w-6 h-6 text-amber-700 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-950 flex items-center gap-2">
              <span>Organization Broadcast Center</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black animate-pulse">
                  {unreadCount} Unread
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-600 font-medium">
              Real-time operational alerts, animal lifecycle milestones, and field dispatches
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs border border-slate-300 transition-colors cursor-pointer"
          >
            Mark All as Read
          </button>
        )}
      </div>

      {/* Broadcast Composer Card */}
      <form
        onSubmit={handleBroadcast}
        className="rounded-3xl bg-white border border-[#E8DFCE] p-4 sm:p-5 space-y-3.5 shadow-xs text-slate-950"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-[#F0EBE1]">
          <h2 className="text-xs font-black text-slate-950 flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-amber-600" />
            <span>Broadcast Live Ground Update ({activeMember.fullName})</span>
          </h2>

          <div className="flex items-center gap-2">
            <select
              aria-label="Broadcast Site"
              value={bLocId}
              onChange={(e) => setBLocId(e.target.value)}
              className="bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-2.5 py-1 text-xs text-slate-900 font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="ALL">All Locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Broadcast Severity"
              value={bSeverity}
              onChange={(e) => setBSeverity(e.target.value as NotificationSeverity)}
              className="bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-2.5 py-1 text-xs text-slate-900 font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="URGENT_GROUND">🚨 Urgent Ground</option>
              <option value="MILESTONE">🏆 Milestone</option>
              <option value="INFO">ℹ️ General Info</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <input
            type="text"
            placeholder="Headline (e.g. 20 Bags Grower Feed Delivered)"
            value={bTitle}
            onChange={(e) => setBTitle(e.target.value)}
            className="bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3 py-2 text-xs text-slate-950 font-bold placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white"
          />

          <div className="sm:col-span-2 flex gap-2">
            <input
              type="text"
              required
              placeholder="Write detailed ground message for organization members..."
              value={bMessage}
              onChange={(e) => setBMessage(e.target.value)}
              className="flex-1 bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3 py-2 text-xs text-slate-950 font-medium placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white"
            />
            <button
              type="submit"
              disabled={isPosting}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-black flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isPosting ? 'Sending...' : 'Dispatch'}</span>
            </button>
          </div>
        </div>

        {/* Attachment Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#F0EBE1]">
          {bPhoto ? (
            <div className="flex items-center gap-2 bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-2.5 py-1.5">
              <img
                src={bPhoto}
                alt="Broadcast attachment preview"
                className="w-8 h-8 rounded-lg object-cover border border-[#E0D7C6]"
              />
              <span className="text-xs text-emerald-800 font-bold">Photo Attached</span>
              <button
                type="button"
                onClick={() => setBPhoto(null)}
                className="p-1 rounded-md text-slate-400 hover:text-rose-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div>
              <input
                ref={broadcastFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: 'none' }}
                onChange={handlePhotoSelect}
              />
              <button
                type="button"
                onClick={() => broadcastFileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF8F5] hover:bg-slate-100 border border-[#E0D7C6] text-xs font-bold text-slate-700 cursor-pointer transition-colors"
              >
                <Camera className="w-3.5 h-3.5 text-amber-600" />
                <span>Attach Field Photo (Single Tap)</span>
              </button>
            </div>
          )}

          <p className="text-[11px] text-slate-500 font-medium">
            Dispatches immediately to all member devices with push vibration.
          </p>
        </div>

        {postSuccess && (
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Broadcast dispatched successfully to all organization members!</span>
          </div>
        )}

        {photoError && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-950 font-bold">
            {photoError}
          </div>
        )}
      </form>

      {/* Filter Pill Row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-black text-slate-700 flex items-center gap-1">
          <Filter className="w-3.5 h-3.5" />
          <span>Filter:</span>
        </span>
        <button
          type="button"
          onClick={() => setSeverityFilter('ALL')}
          className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${severityFilter === 'ALL'
            ? 'bg-slate-950 text-white shadow-xs'
            : 'bg-white text-slate-700 border border-[#E8DFCE] hover:border-slate-400'
            }`}
        >
          All Activity ({notifications.length})
        </button>
        <button
          type="button"
          onClick={() => setSeverityFilter('URGENT')}
          className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${severityFilter === 'URGENT'
            ? 'bg-rose-600 text-white shadow-xs'
            : 'bg-white text-slate-700 border border-[#E8DFCE] hover:border-slate-400'
            }`}
        >
          🚨 Urgent Only
        </button>
        <button
          type="button"
          onClick={() => setSeverityFilter('MILESTONE')}
          className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${severityFilter === 'MILESTONE'
            ? 'bg-amber-600 text-white shadow-xs'
            : 'bg-white text-slate-700 border border-[#E8DFCE] hover:border-slate-400'
            }`}
        >
          🏆 Milestones
        </button>
        <button
          type="button"
          onClick={() => setSeverityFilter('PHOTOS')}
          className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${severityFilter === 'PHOTOS'
            ? 'bg-emerald-600 text-white shadow-xs'
            : 'bg-white text-slate-700 border border-[#E8DFCE] hover:border-slate-400'
            }`}
        >
          📷 Field Photos
        </button>
      </div>

      {/* Broadcast Feed List */}
      <div className="space-y-3.5">
        {broadcasts.length === 0 ? (
          <div className="p-8 rounded-3xl bg-white border border-[#E8DFCE] text-center space-y-2">
            <Radio className="w-8 h-8 text-slate-300 mx-auto" />
            <h3 className="text-sm font-black text-slate-900">No broadcasts match this filter</h3>
            <p className="text-xs text-slate-500 font-medium">
              Post an update using the composer above to share telemetry with the team.
            </p>
          </div>
        ) : (
          broadcasts.map((ev) => {
            const isRead =
              Array.isArray(ev.readByMemberIds) && ev.readByMemberIds.includes(activeMember.id);

            return (
              <div
                key={ev.id}
                className={`p-4 sm:p-5 rounded-3xl border transition-all text-slate-950 ${isRead
                  ? 'bg-white border-[#E8DFCE]'
                  : 'bg-amber-50/40 border-amber-300 ring-2 ring-amber-400/20 shadow-xs'
                  }`}
              >
                {/* Meta Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#F0EBE1]">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${ev.severity === 'URGENT_GROUND'
                        ? 'bg-rose-100 text-rose-900 border border-rose-300'
                        : ev.severity === 'MILESTONE'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-slate-100 text-slate-800 border border-slate-300'
                        }`}
                    >
                      {ev.severity.replace('_', ' ')}
                    </span>
                    <span className="text-xs font-black text-slate-950">{ev.actorName}</span>
                    <span className="text-[10px] text-slate-500 font-bold px-1.5 py-0.2 rounded bg-slate-100">
                      {ev.actorRole.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                    <span className="flex items-center gap-1">
                      <Building className="w-3 h-3 text-slate-400" />
                      <span>{ev.locationName}</span>
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1 font-mono text-[10px]">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </span>
                  </div>
                </div>

                {/* Content Body */}
                <div className="pt-2.5 space-y-2">
                  <h3 className="text-sm font-black text-slate-950">{ev.title}</h3>
                  <p className="text-xs text-slate-800 leading-relaxed font-medium whitespace-pre-line">
                    {ev.message}
                  </p>

                  {/* Attached Field Photo Preview */}
                  {ev.photoUrl && (
                    <div className="pt-1">
                      <div
                        onClick={() => setLightboxPhoto({ url: ev.photoUrl!, title: ev.title })}
                        className="relative rounded-2xl overflow-hidden border border-[#E0D7C6] max-w-sm max-h-56 cursor-pointer group"
                      >
                        <img
                          src={ev.photoUrl}
                          alt={ev.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                          <Eye className="w-4 h-4" />
                          <span>View Full Photo</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[10001] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setLightboxPhoto(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] p-2 space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between text-white">
              <span className="text-xs font-bold truncate">{lightboxPhoto.title}</span>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="p-1 rounded-full bg-white/20 hover:bg-white/40 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={lightboxPhoto.url}
              alt={lightboxPhoto.title}
              className="max-h-[80vh] w-auto rounded-2xl object-contain shadow-2xl mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
};

