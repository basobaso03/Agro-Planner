import React from 'react';
import { ArrowDownLeft, ArrowUpRight, DollarSign, Clock, ChevronRight } from 'lucide-react';
import { formatMoney } from '../../utils/currency.ts';
import { useNavigation } from '../../navigation/useNavigation.ts';
import type { AuditNotificationEvent } from '../../types/agro.ts';

export interface RecentActivityProps {
  notifications: AuditNotificationEvent[];
  showNumbers?: boolean;
}

export const RecentActivity: React.FC<RecentActivityProps> = ({
  notifications,
  showNumbers = true,
}) => {
  const { navigate } = useNavigation();
  const recentItems = notifications.slice(0, 4);

  if (recentItems.length === 0) return null;

  return (
    <div className="space-y-2 py-1">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>Recent Activity</span>
        </span>
        <button
          type="button"
          onClick={() => navigate('auditLedger')}
          className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5 cursor-pointer"
        >
          <span>All Ledger</span>
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-[#E8DFCE] divide-y divide-[#F0EBE1] overflow-hidden shadow-xs">
        {recentItems.map((item) => (
          <div key={item.id} className="p-3.5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-slate-900 line-clamp-1">{item.title}</div>
              <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{item.message}</div>
              <div className="text-[10px] text-slate-400 font-mono mt-1">
                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                {new Date(item.timestamp).toLocaleDateString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

