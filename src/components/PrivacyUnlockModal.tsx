import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  Fingerprint,
  KeyRound,
  X,
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import type { SyndicateMember } from '../types/agro.ts';
import { dataService } from '../services/dataService.ts';
import {
  verifyDeviceBiometric,
  getEnrolledBiometricRecord,
  isBiometricHardwareSupported,
  getPrivacyUnlockPreference,
  setPrivacyUnlockPreference,
  type PrivacyUnlockMethod,
} from '../utils/mobileHardware.ts';

interface PrivacyUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  activeMember: SyndicateMember;
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
  initialMode = 'password',
}) => {
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState(initialError || '');
  const [loading, setLoading] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Preference state
  const [currentPref, setCurrentPref] = useState<PrivacyUnlockMethod>(() =>
    getPrivacyUnlockPreference()
  );
  const [prefSavedMsg, setPrefSavedMsg] = useState(false);

  // Quick setup password mode inside modal if user hasn't set one up yet
  const [setupMode, setSetupMode] = useState(initialMode === 'setup');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');

  // Device hardware biometric capability check
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  const hasPassword = Boolean(activeMember.hasPasswordSetup && activeMember.passwordVerifierHash);
  const hasBiometric = Boolean(getEnrolledBiometricRecord());

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(initialError || '');
      setCurrentPref(getPrivacyUnlockPreference());
      setPrefSavedMsg(false);
      setPasswordInput('');

      // Auto-set setup mode if neither credential exists
      if (!hasPassword && !hasBiometric) {
        setSetupMode(true);
      } else {
        setSetupMode(initialMode === 'setup');
      }

      // Check biometric hardware support
      void isBiometricHardwareSupported().then((supported) => {
        setBiometricAvailable(supported || hasBiometric);
      });

      // Focus password input automatically when modal opens in password mode
      const timer = setTimeout(() => {
        if (!setupMode && passwordInputRef.current) {
          passwordInputRef.current.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialError, initialMode, hasPassword, hasBiometric, setupMode]);

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

  const handleInitialPasswordSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (setupPassword.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }
    if (setupPassword !== setupConfirm) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await dataService.setupOrUpdatePasswordForCurrentUser({
        member: activeMember,
        newPassword: setupPassword,
      });
      setSetupPassword('');
      setSetupConfirm('');
      setSetupMode(false);
      onSuccess();
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to configure security password.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePreference = (method: PrivacyUnlockMethod) => {
    setPrivacyUnlockPreference(method);
    setCurrentPref(method);
    setPrefSavedMsg(true);
    setTimeout(() => setPrefSavedMsg(false), 2500);
  };

  return (
    <div
      className="modal-overlay-responsive animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-unlock-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-dialog-responsive max-w-md p-5 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 id="privacy-unlock-title" className="text-base font-bold text-slate-900">
                {setupMode ? 'Create Security Password' : 'Authorize Viewing Numbers'}
              </h2>
              <p className="text-xs text-slate-500">
                {setupMode
                  ? 'Required before viewing financial figures & livestock counts'
                  : 'Enter password to reveal protected figures'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {/* If user hasn't set up either credential and is not yet in setup mode */}
        {!hasPassword && !hasBiometric && !setupMode ? (
          <div className="space-y-4 py-2">
            <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] text-xs text-slate-700 space-y-2">
              <p className="font-semibold text-amber-900">
                Security Setup Required:
              </p>
              <p className="leading-relaxed text-slate-600">
                To protect privacy, numbers are hidden by default when resuming a session.
                Please configure a security password or fingerprint on your account to unlock them.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setSetupMode(true)}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>Create Security Password Now</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToSettings('biometrics');
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-[#FAF8F5] hover:bg-slate-100 border border-[#E0D7C6] text-slate-800 text-xs font-bold transition-colors cursor-pointer"
              >
                Open Settings &amp; Biometrics Studio
              </button>
            </div>
          </div>
        ) : setupMode ? (
          /* Quick Password Setup Form */
          <form onSubmit={handleInitialPasswordSetup} className="space-y-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Security Password (min 8 chars)
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoFocus
                placeholder="Minimum 8 characters"
                value={setupPassword}
                onChange={(e) => setSetupPassword(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm Security Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Re-enter password"
                value={setupConfirm}
                onChange={(e) => setSetupConfirm(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showPassword ? 'Hide characters' : 'Show characters'}</span>
              </button>
              {hasPassword && (
                <button
                  type="button"
                  onClick={() => setSetupMode(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 shadow-sm"
            >
              <Check className="w-4 h-4" />
              <span>{loading ? 'Saving...' : 'Save Password & Reveal Numbers'}</span>
            </button>
          </form>
        ) : (
          /* Direct Password Entry Form (No Intermediate Option Selection Required) */
          <div className="space-y-4 pt-1">
            {hasPassword ? (
              <form onSubmit={handlePasswordSubmit} className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Account Security Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showPassword ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      ref={passwordInputRef}
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoFocus
                      placeholder="Type your password and press Enter"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all shadow-2xs"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={loading || !passwordInput}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                  >
                    {loading ? 'Verifying...' : 'Unlock Numbers'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setSetupMode(true)}
                  className="text-xs font-bold text-amber-700 hover:underline cursor-pointer"
                >
                  No password set yet? Click here to create a security password
                </button>
              </div>
            )}

            {/* Quick Biometric Alternative (if hardware supported on this phone) */}
            {biometricAvailable && (
              <div className="pt-2 border-t border-[#F0EBE1] flex items-center justify-between">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleBiometricUnlock}
                  className="w-full py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Fingerprint className="w-4 h-4 text-emerald-600" />
                  <span>Verify with Fingerprint / Face Unlock instead</span>
                </button>
              </div>
            )}

            {/* Quick Default Eye Method Switcher */}
            <div className="pt-3 border-t border-[#F0EBE1] space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  Default Eye Unlock Method:
                </span>
                {prefSavedMsg ? (
                  <span className="text-emerald-700 font-bold animate-pulse">Saved as default!</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToSettings('biometrics');
                    }}
                    className="text-amber-700 hover:underline cursor-pointer"
                  >
                    Open Settings
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#FAF8F5] border border-[#E8DFCE] rounded-xl text-[11px]">
                <button
                  type="button"
                  onClick={() => handleUpdatePreference('auto')}
                  className={`py-1.5 px-2 rounded-lg font-bold text-center transition-all cursor-pointer ${
                    currentPref === 'auto'
                      ? 'bg-amber-500 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                  title="Auto: Prompts fingerprint if phone supports it, otherwise password"
                >
                  ⚡ Auto
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdatePreference('biometric')}
                  className={`py-1.5 px-2 rounded-lg font-bold text-center transition-all cursor-pointer ${
                    currentPref === 'biometric'
                      ? 'bg-amber-500 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                  title="Fingerprint: Always prompt device fingerprint first on eye tap"
                >
                  👆 Fingerprint
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdatePreference('password')}
                  className={`py-1.5 px-2 rounded-lg font-bold text-center transition-all cursor-pointer ${
                    currentPref === 'password'
                      ? 'bg-amber-500 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                  title="Password: Always open password input directly on eye tap"
                >
                  🔑 Password
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
