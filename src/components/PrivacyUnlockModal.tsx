import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  Fingerprint,
  KeyRound,
  X,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  Settings,
} from 'lucide-react';
import type { OrgMember } from '../types/agro.ts';
import { dataService, hasPasswordConfigured } from '../services/dataService.ts';
import { BottomSheet } from './ui/BottomSheet.tsx';
import {
  verifyDeviceBiometric,
  getEnrolledBiometricRecord,
  isBiometricHardwareSupported,
  getPrivacyUnlockPreference,
  type PrivacyUnlockMethod,
} from '../utils/mobileHardware.ts';

interface PrivacyUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  activeMember: OrgMember;
  onNavigateToSettings: (section?: string) => void;
  initialError?: string | null;
  initialMode?: 'password' | 'setup';
}

export const PrivacyUnlockModal: React.FC<PrivacyUnlockModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  activeMember,
  onNavigateToSettings,
  initialError,
}) => {
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState(initialError || '');
  const [loading, setLoading] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Preference state (default to biometric)
  const [currentPref, setCurrentPref] = useState<PrivacyUnlockMethod>(() =>
    getPrivacyUnlockPreference()
  );

  // Device hardware biometric capability check
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  const hasPassword = hasPasswordConfigured(activeMember);
  const hasBiometric = Boolean(getEnrolledBiometricRecord());

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(initialError || '');
      setCurrentPref(getPrivacyUnlockPreference());
      setPasswordInput('');

      void isBiometricHardwareSupported().then((supported) => {
        setBiometricAvailable(supported || hasBiometric);
      });

      // Auto trigger fingerprint prompt if preferred
      if (currentPref === 'biometric' || (!hasPassword && hasBiometric)) {
        void handleBiometricUnlock();
      } else {
        const timer = setTimeout(() => {
          if (passwordInputRef.current) {
            passwordInputRef.current.focus();
          }
        }, 150);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, initialError, currentPref, hasPassword, hasBiometric]);

  if (!isOpen) return null;

  const handleBiometricUnlock = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      await verifyDeviceBiometric();
      onSuccess();
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Biometric fingerprint or face sensor could not be verified.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!passwordInput) return;

    const ok = dataService.verifyMemberPassword(activeMember, passwordInput);
    if (ok) {
      setPasswordInput('');
      onSuccess();
      onClose();
    } else {
      setErrorMsg('Incorrect account password. Please try again or use fingerprint.');
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Security Privacy Shield"
      subtitle="Verify your identity to unmask financial numbers"
      size="auto"
    >
      <div className="space-y-4 p-1">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
        )}

        {/* Option 1: Biometric Fingerprint (Default) */}
        {biometricAvailable && (
          <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] flex flex-col items-center justify-center text-center space-y-2.5">
            <button
              type="button"
              onClick={handleBiometricUnlock}
              disabled={loading}
              className="w-16 h-16 rounded-full bg-emerald-100 hover:bg-emerald-200 border-2 border-emerald-400 flex items-center justify-center text-emerald-800 transition-all active:scale-95 shadow-xs cursor-pointer"
            >
              <Fingerprint className="w-9 h-9 text-emerald-700" />
            </button>
            <div>
              <p className="text-xs font-black text-slate-950">Tap for Fingerprint Unlock</p>
              <p className="text-[11px] text-slate-600 font-medium">
                Uses device hardware biometric security sensor
              </p>
            </div>
          </div>
        )}

        {/* Option 2: Password Authentication */}
        {hasPassword ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <label htmlFor="unlock-pwd" className="text-xs font-black text-slate-950">
                Or Enter Account Password:
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-300 text-[11px] text-amber-950 font-bold transition-colors cursor-pointer shadow-2xs"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5 text-amber-800" /> : <Eye className="w-3.5 h-3.5 text-amber-800" />}
                <span>{showPassword ? 'Hide' : 'Show'}</span>
              </button>
            </div>

            <div className="relative">
              <input
                ref={passwordInputRef}
                id="unlock-pwd"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Enter your account password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-slate-950 font-bold placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white"
              />
              <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>

            <button
              type="submit"
              disabled={loading || !passwordInput}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-black transition-colors cursor-pointer shadow-xs"
            >
              Verify &amp; Show Numbers
            </button>
          </form>
        ) : !biometricAvailable ? (
          /* Secure Prompt if neither credential configured - NO BYPASS LOOPHOLE */
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-slate-950 space-y-3">
            <div className="flex items-center gap-2 text-amber-900 font-black">
              <ShieldCheck className="w-4 h-4 text-amber-700" />
              <span>Credentials Setup Required</span>
            </div>
            <p className="text-slate-800 leading-relaxed font-medium">
              Financial numbers are protected by secure encryption. To unmask figures, you must first enroll your fingerprint or configure an account password in Settings.
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateToSettings('settings-password');
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-slate-900 text-white font-black flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Go to Settings to Configure Security</span>
            </button>
          </div>
        ) : null}
      </div>
    </BottomSheet>
  );
};
