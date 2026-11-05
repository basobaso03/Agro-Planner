import React, { useState } from 'react';
import { haptics } from '../../native/haptics.ts';
import { useToast } from '../../components/ui/Toast.tsx';
import type { OrgMember } from '../../types/agro.ts';

export interface NotificationPrefsScreenProps {
  activeMember: OrgMember;
}

export const NotificationPrefsScreen: React.FC<NotificationPrefsScreenProps> = () => {
  const { showToast } = useToast();
  const [protocolsEnabled, setProtocolsEnabled] = useState(true);
  const [multiSigEnabled, setMultiSigEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  const handleToggleHaptics = (val: boolean) => {
    setHapticsEnabled(val);
    if (val) {
      haptics.impact('medium');
    }
    showToast({
      type: 'info',
      title: 'Haptics Updated',
      message: val ? 'Tactile vibration feedback enabled.' : 'Haptics disabled.',
    });
  };

  return (
    <div className="flex-1 flex flex-col p-4 pb-24 max-w-2xl mx-auto w-full space-y-4">
      <div className="bg-white border border-[#E8DFCE] p-5 rounded-2xl shadow-xs">
        <h1 className="text-base font-black text-slate-950">Alerts & Native Haptics</h1>
        <p className="text-xs text-slate-600 mt-1 font-medium">
          Customize local scheduled reminders, financial approvals, and physical vibration feedback.
        </p>
      </div>

      <div className="bg-white border border-[#E8DFCE] rounded-2xl divide-y divide-[#F0EBE1] shadow-xs overflow-hidden text-xs">
        <div className="p-4 flex items-center justify-between">
          <div>
            <div className="font-black text-slate-950 text-sm">
              Protocol Reminders
            </div>
            <div className="text-slate-600 font-medium mt-0.5">
              Scheduled notifications for vaccinations and feed shifts
            </div>
          </div>
          <input
            type="checkbox"
            checked={protocolsEnabled}
            onChange={(e) => setProtocolsEnabled(e.target.checked)}
            className="w-5 h-5 accent-emerald-600 rounded cursor-pointer"
          />
        </div>

        <div className="p-4 flex items-center justify-between">
          <div>
            <div className="font-black text-slate-950 text-sm">
              Multi-Sig Financial Alerts
            </div>
            <div className="text-slate-600 font-medium mt-0.5">
              Push notification when an expense requires second treasurer sign-off
            </div>
          </div>
          <input
            type="checkbox"
            checked={multiSigEnabled}
            onChange={(e) => setMultiSigEnabled(e.target.checked)}
            className="w-5 h-5 accent-emerald-600 rounded cursor-pointer"
          />
        </div>

        <div className="p-4 flex items-center justify-between">
          <div>
            <div className="font-black text-slate-950 text-sm">
              Android Haptic Feedback
            </div>
            <div className="text-slate-600 font-medium mt-0.5">
              Vibrate lightly on button taps, confirmations, and form submissions
            </div>
          </div>
          <input
            type="checkbox"
            checked={hapticsEnabled}
            onChange={(e) => handleToggleHaptics(e.target.checked)}
            className="w-5 h-5 accent-emerald-600 rounded cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};

