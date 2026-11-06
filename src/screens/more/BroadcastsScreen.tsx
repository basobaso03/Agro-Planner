import React, { useState } from 'react';
import { Radio } from 'lucide-react';
import { dataService } from '../../services/dataService.ts';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import { Fab } from '../../components/ui/Fab.tsx';
import { BroadcastSheet } from '../../sheets/common/BroadcastSheet.tsx';
import { getRoleMeta } from '../../utils/permissions.ts';
import type { OrgMember } from '../../types/agro.ts';

export interface BroadcastsScreenProps {
  activeMember: OrgMember;
}

export const BroadcastsScreen: React.FC<BroadcastsScreenProps> = ({ activeMember }) => {
  const [showBroadcastSheet, setShowBroadcastSheet] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');

  const rawNotifications = dataService.getState().auditNotifications || [];
  const notifications = activeMember?.orgId
    ? rawNotifications.filter((n) => !n.orgId || n.orgId === activeMember.orgId)
    : rawNotifications;
  const broadcasts = notifications.filter(
    (n) => n.eventType === 'GROUND_BROADCAST' || n.severity === 'URGENT_GROUND' || n.severity === 'WARNING_CONTRA'
  );

  const filtered = broadcasts.filter((b) => {
    if (filterSeverity === 'ALL') return true;
    return b.severity === filterSeverity;
  });

  return (
    <div className="flex-1 flex flex-col p-4 pb-24 max-w-2xl mx-auto w-full space-y-4">
      {/* Header */}
      <div className="bg-white border border-[#E8DFCE] p-5 rounded-2xl shadow-xs">
        <h1 className="text-base font-black text-slate-950">Team Broadcast Stream</h1>
        <p className="text-xs text-slate-600 mt-1 font-medium">
          Operational alerts, emergency notices, and harvest milestones dispatched by farm operators and executives.
        </p>
      </div>

      {/* Broadcasts Feed */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="📢"
          title="No Active Broadcasts"
          message="Dispatch an operational alert or farm update to your team."
          actionLabel="Send Broadcast"
          onAction={() => setShowBroadcastSheet(true)}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-[#E8DFCE] rounded-2xl p-4 shadow-xs space-y-3 text-xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${item.severity === 'URGENT_GROUND'
                        ? 'bg-rose-100 text-rose-900 border border-rose-300'
                        : item.severity === 'WARNING_CONTRA'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : item.severity === 'MILESTONE'
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : 'bg-slate-100 text-slate-800 border border-slate-300'
                        }`}
                    >
                      {item.severity.replace(/_/g, ' ')}
                    </span>
                    <span className="text-slate-600 font-semibold">· {item.locationName}</span>
                  </div>
                  <h2 className="text-sm font-bold text-slate-950 mt-1.5">
                    {item.title}
                  </h2>
                </div>

                <span className="text-[11px] text-slate-600 font-medium shrink-0">
                  {new Date(item.timestamp).toLocaleDateString()}
                </span>
              </div>

              <p className="text-slate-800 text-sm leading-relaxed">
                {item.message}
              </p>

              {item.photoUrl && (
                <div className="rounded-xl overflow-hidden max-h-48 border border-[#E8DFCE]">
                  <img src={item.photoUrl} alt="Broadcast Attachment" className="w-full h-full object-cover" />
                </div>
              )}

              <div className="pt-2 border-t border-[#F0EBE1] flex items-center justify-between text-[11px] text-slate-600">
                <span>By <strong className="text-slate-950">{item.actorName}</strong> ({getRoleMeta(item.actorRole).label})</span>
                <span className="font-mono font-bold text-slate-800">Block {item.sequenceNumber}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB */}
      <Fab icon={Radio} label="Dispatch Alert" onClick={() => setShowBroadcastSheet(true)} />

      {/* Sheet */}
      <BroadcastSheet
        isOpen={showBroadcastSheet}
        onClose={() => setShowBroadcastSheet(false)}
        activeMember={activeMember}
      />
    </div>
  );
};

