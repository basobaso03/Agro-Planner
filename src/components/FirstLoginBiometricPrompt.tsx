import React, { useState } from 'react';
import { Fingerprint, ShieldCheck, X, CheckCircle2 } from 'lucide-react';
import {
  enrollDeviceBiometric,
  setPrivacyUnlockPreference,
} from '../utils/mobileHardware.ts';

interface FirstLoginBiometricPromptProps {
  memberEmail: string;
  memberName: string;
  memberId: string;
  onDone: () => void;
}

export const FirstLoginBiometricPrompt: React.FC<FirstLoginBiometricPromptProps> = ({
  memberEmail,
  memberName,
  memberId,
  onDone,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const handleEnableBiometric = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      await enrollDeviceBiometric({
        memberId,
        email: memberEmail,
        fullName: memberName,
      });
      setPrivacyUnlockPreference('biometric');
      setSuccess(true);
      setTimeout(() => {
        onDone();
      }, 1200);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Could not activate biometric sensor on this device.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="w-full max-w-sm bg-white border border-[#E8DFCE] rounded-3xl p-6 shadow-2xl text-slate-950 space-y-4">
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700">
            <Fingerprint className="w-7 h-7 text-emerald-700" />
          </div>
          <button
            onClick={onDone}
            aria-label="Skip biometric enrollment"
            className="p-1 rounded-xl text-slate-400 hover:text-slate-950 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <h3 className="text-base font-black text-slate-950">
            Enable Fingerprint Quick-Unlock?
          </h3>
          <p className="text-xs text-slate-700 font-medium leading-relaxed mt-1">
            Protect your organization financials and unlock in one touch using your Android fingerprint sensor. Fingerprint is the recommended security standard for Capital Seed.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-900 font-semibold">
            {errorMsg}
          </div>
        )}

        {success ? (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 font-black flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Fingerprint enrolled and set as default!</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={handleEnableBiometric}
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-xs cursor-pointer"
            >
              <Fingerprint className="w-4 h-4" />
              <span>{loading ? 'Activating Sensor...' : 'Enable Fingerprint Security'}</span>
            </button>
            <button
              onClick={onDone}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              Maybe Later
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
