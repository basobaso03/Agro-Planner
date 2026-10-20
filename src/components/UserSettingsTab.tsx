import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  KeyRound,
  ShieldCheck,
  Save,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  Type,
  SunMedium,
  Palette,
  LogOut,
  Check,
  X,
  ExternalLink,
  Sparkles,
  Fingerprint,
  BellRing,
  AlertTriangle,
} from 'lucide-react';
import type { FarmLocation, SyndicateMember } from '../types/agro.ts';
import { dataService, type AuthenticatedSession } from '../services/dataService.ts';
import { PERMISSIONS, getRoleMeta } from '../utils/permissions.ts';
import { FONT_OPTIONS, type FontStyleId } from '../types/theme.ts';
import { LogoSvg } from './BrandLogos.tsx';
import {
  DEVELOPER_INFO,
  ModernEmailIcon,
  ModernLinkedInIcon,
  ModernWhatsAppIcon,
} from './DeveloperBrandInfo.tsx';
import {
  areSystemNotificationsEnabled,
  dispatchSystemNotification,
  enrollDeviceBiometric,
  getEnrolledBiometricRecord,
  getNotificationPermissionState,
  getPrivacyUnlockPreference,
  isBiometricHardwareSupported,
  removeEnrolledBiometricRecord,
  requestSystemNotificationPermission,
  setPrivacyUnlockPreference,
  setSystemNotificationsPreference,
  verifyDeviceBiometric,
  type EnrolledBiometricRecord,
  type PrivacyUnlockMethod,
} from '../utils/mobileHardware.ts';

interface UserSettingsTabProps {
  activeMember: SyndicateMember;
  session: AuthenticatedSession | null;
  locations: FarmLocation[];
  activeFontId: FontStyleId;
  onSelectFont: (fontId: FontStyleId) => void;
  backgroundIntensity: 'subtle' | 'standard' | 'expressive';
  onSelectBackgroundIntensity: (intensity: 'subtle' | 'standard' | 'expressive') => void;
  onPreviewSplash?: () => void;
  onSignOut: () => void;
  targetSection?: string | null;
}

export const UserSettingsTab: React.FC<UserSettingsTabProps> = ({
  activeMember,
  session,
  locations,
  activeFontId,
  onSelectFont,
  backgroundIntensity,
  onSelectBackgroundIntensity,
  onPreviewSplash,
  onSignOut,
  targetSection = null,
}) => {
  // Profile Editor State
  const [fullName, setFullName] = useState(activeMember.fullName);
  const [phone, setPhone] = useState(activeMember.phone || activeMember.phoneOrEmail || '');
  const [bio, setBio] = useState(activeMember.bio || '');
  const [profileBanner, setProfileBanner] = useState('');
  const [profileError, setProfileError] = useState('');

  // Password & Credential Linking State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pwdBanner, setPwdBanner] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  // Section highlight & smooth scroll handling
  const [highlightedSection, setHighlightedSection] = useState<string | null>(null);

  useEffect(() => {
    if (!targetSection) return;

    let targetId = targetSection;
    if (
      targetSection === 'fingerprint' ||
      targetSection === 'biometric' ||
      targetSection === 'biometrics'
    ) {
      targetId = 'settings-biometrics';
    } else if (targetSection === 'password' || targetSection === 'credentials') {
      targetId = 'settings-password';
    } else if (targetSection === 'profile') {
      targetId = 'settings-profile';
    } else if (
      targetSection === 'appearance' ||
      targetSection === 'theme' ||
      targetSection === 'font'
    ) {
      targetId = 'settings-appearance';
    } else if (targetSection === 'permissions' || targetSection === 'capabilities') {
      targetId = 'settings-permissions';
    } else if (targetSection === 'about' || targetSection === 'developer') {
      targetId = 'settings-about';
    }

    setHighlightedSection(targetId);

    const scrollTimer = setTimeout(() => {
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);

    const clearTimer = setTimeout(() => {
      setHighlightedSection(null);
    }, 4000);

    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
  }, [targetSection]);

  useEffect(() => {
    setFullName(activeMember.fullName);
    setPhone(activeMember.phone || activeMember.phoneOrEmail || '');
    setBio(activeMember.bio || '');
  }, [activeMember]);

  const roleMeta = getRoleMeta(activeMember.role);
  const isAdmin = activeMember.role === 'SYNDICATE_ADMIN';
  const assignedSite = locations.find((l) => l.id === activeMember.assignedLocationId);
  const linkedProviders = activeMember.authProviders || session?.providers || ['google.com'];
  const isGoogleLinked = linkedProviders.includes('google.com');
  const isPasswordLinked = Boolean(
    activeMember.hasPasswordSetup || linkedProviders.includes('password')
  );

  const [biometricSupported, setBiometricSupported] = useState<boolean>(false);
  const [enrolledBio, setEnrolledBio] = useState<EnrolledBiometricRecord | null>(() =>
    getEnrolledBiometricRecord()
  );
  const [bioStatusMsg, setBioStatusMsg] = useState('');
  const [bioErrorMsg, setBioErrorMsg] = useState('');
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported'>(() =>
    getNotificationPermissionState()
  );
  const [notifEnabled, setNotifEnabled] = useState<boolean>(() =>
    areSystemNotificationsEnabled()
  );
  const [notifStatusMsg, setNotifStatusMsg] = useState('');

  // Default Eye quick-unlock method preference
  const [privacyPref, setPrivacyPref] = useState<PrivacyUnlockMethod>(() =>
    getPrivacyUnlockPreference()
  );
  const [privacyPrefSaved, setPrivacyPrefSaved] = useState<boolean>(false);

  const handleSelectPrivacyPref = (method: PrivacyUnlockMethod) => {
    setPrivacyUnlockPreference(method);
    setPrivacyPref(method);
    setPrivacyPrefSaved(true);
    setTimeout(() => setPrivacyPrefSaved(false), 2500);
  };

  useEffect(() => {
    isBiometricHardwareSupported().then(setBiometricSupported).catch(() => {});
  }, []);

  // Zero-trust live alerts and warnings
  const recentAlerts = React.useMemo(() => {
    try {
      const all = dataService.getState().auditNotifications || [];
      return all
        .filter((n) => n.severity === 'WARNING_CONTRA' || n.severity === 'URGENT_GROUND')
        .slice(0, 3);
    } catch {
      return [];
    }
  }, []);

  const handleToggleBiometrics = async () => {
    setBioStatusMsg('');
    setBioErrorMsg('');
    if (enrolledBio) {
      removeEnrolledBiometricRecord();
      setEnrolledBio(null);
      setBioStatusMsg('Fingerprint and face unlock has been turned off on this device.');
    } else {
      try {
        const rec = await enrollDeviceBiometric({
          memberId: activeMember.id,
          email: activeMember.email || session?.email || activeMember.phoneOrEmail,
          fullName: activeMember.fullName,
        });
        setEnrolledBio(rec);
        setBioStatusMsg('Fingerprint & face unlock enabled! You can now use your biometric sensor to quickly access Agro Planner.');
      } catch (err) {
        setBioErrorMsg(
          err instanceof Error
            ? err.message
            : 'Could not complete biometric setup. Please ensure your device has fingerprint or screen lock enabled.'
        );
      }
    }
  };

  const handleTestBiometricSensor = async () => {
    setBioStatusMsg('');
    setBioErrorMsg('');
    try {
      const verified = await verifyDeviceBiometric();
      setBioStatusMsg(`Identity verified! Fingerprint unlock is working properly for ${verified.fullName}.`);
    } catch (err) {
      setBioErrorMsg(err instanceof Error ? err.message : 'Biometric verification did not succeed.');
    }
  };

  const handleToggleNotifications = async () => {
    setNotifStatusMsg('');
    if (notifPerm === 'granted' && notifEnabled) {
      setSystemNotificationsPreference(false);
      setNotifEnabled(false);
      setNotifStatusMsg('Mobile alerts and vibration paused.');
    } else {
      try {
        const res = await requestSystemNotificationPermission();
        setNotifPerm(res);
        if (res === 'granted') {
          setSystemNotificationsPreference(true);
          setNotifEnabled(true);
          await dispatchSystemNotification({
            title: 'Agro Planner · Alerts Active',
            body: `Notifications and vibration alerts enabled for ${activeMember.fullName}.`,
            urgent: false,
          });
          setNotifStatusMsg('Mobile alerts enabled! You will receive real-time updates.');
        } else {
          setNotifStatusMsg('Notification permission was not granted. Please enable notifications in your device settings.');
        }
      } catch (err) {
        setNotifStatusMsg(err instanceof Error ? err.message : 'Could not enable notifications.');
      }
    }
  };

  const handleSendTestNotification = async () => {
    setNotifStatusMsg('');
    if (getNotificationPermissionState() !== 'granted') {
      await handleToggleNotifications();
      return;
    }
    const ok = await dispatchSystemNotification({
      title: 'Agro Planner · Field Alert Test',
      body: `Test notification verified for ${activeMember.fullName} with vibration.`,
      urgent: true,
    });
    setNotifStatusMsg(
      ok
        ? 'Test alert and vibration dispatched to your status bar!'
        : 'Please allow notifications in your device settings first.'
    );
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileBanner('');
    setProfileError('');
    try {
      dataService.updateOwnMemberProfile({
        memberId: activeMember.id,
        fullName,
        phone,
        jobTitle: activeMember.jobTitle || '',
        bio,
        preferredContact: activeMember.preferredContact || 'EMAIL',
      });
      setProfileBanner('Your profile details have been saved successfully.');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile details.');
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdBanner('');
    setPwdError('');

    if (newPassword.length < 8) {
      setPwdError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('Confirmation password does not match.');
      return;
    }

    setPwdLoading(true);
    try {
      await dataService.setupOrUpdatePasswordForCurrentUser({
        member: activeMember,
        newPassword,
      });
      setNewPassword('');
      setConfirmPassword('');
      setPwdBanner(
        isPasswordLinked
          ? 'Your password has been updated securely.'
          : 'Password linked to your Google account. You can now sign in with either Google or Email & Password.'
      );
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : 'Could not configure password.');
    } finally {
      setPwdLoading(false);
    }
  };

  const capabilityMatrix = [
    {
      label: 'View Master Liquid Capital Pool & NAV',
      allowed: PERMISSIONS.canViewMasterTreasury(activeMember.role),
    },
    {
      label: 'Approve Multi-Sig Expenses (> $150)',
      allowed: PERMISSIONS.canApproveMultiSig(activeMember.role),
    },
    {
      label: 'Post Accounting Contra-Entry Reversals',
      allowed: PERMISSIONS.canPostContraReversals(activeMember.role),
    },
    {
      label: 'Log Direct Capital Pool Deposits',
      allowed: PERMISSIONS.canLogCapitalDeposit(activeMember.role),
    },
    {
      label: 'Manage Syndicate Users & Switch Roles',
      allowed: PERMISSIONS.canManageMembers(activeMember.role),
    },
    {
      label: 'Register Official Farm Locations',
      allowed: PERMISSIONS.canAddLocations(activeMember.role),
    },
    {
      label: 'View Unmasked Member Contact PII',
      allowed: PERMISSIONS.canViewUnmaskedPII(activeMember.role),
    },
  ];

  return (
    <div className="space-y-6 pb-24">
      {/* Top Identity Summary Header Card */}
      <section className="bg-white border border-[#E8DFCE] rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-bold text-slate-900">{roleMeta.label}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{activeMember.email || activeMember.phoneOrEmail}</span>
            <span aria-hidden="true">·</span>
            <span>
              Site Scope: <strong className="text-slate-800">{assignedSite ? assignedSite.name : 'All Syndicate Sites'}</strong>
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
            Account Profile &amp; Security Settings
          </h1>
          <p className="text-xs text-slate-500">{roleMeta.desc}</p>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 self-start md:self-auto shrink-0 shadow-sm transition-colors cursor-pointer"
          style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}
        >
          <LogOut className="w-3.5 h-3.5 text-white" />
          <span className="text-white font-bold">Sign Out of Session</span>
        </button>
      </section>

      {/* Main Two-Column Grid: Profile Details + Google-to-Password Credential Linking */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Column 1: Edit Personal Profile & Contact Details */}
        <form
          id="settings-profile"
          onSubmit={handleSaveProfile}
          className={`lg:col-span-7 bg-white border rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs transition-all duration-500 ${
            highlightedSection === 'settings-profile'
              ? 'border-amber-500 ring-4 ring-amber-400/40 shadow-xl'
              : 'border-[#E8DFCE]'
          }`}
        >
          <div className="pb-3 border-b border-[#F0EBE1] flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-amber-600" />
                <span>Personal Profile &amp; Contact Details</span>
                {highlightedSection === 'settings-profile' && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold animate-pulse">
                    Focused Section
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Update your display name, contact phone number, and operational notes.
              </p>
            </div>
          </div>

          {profileBanner && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{profileBanner}</span>
            </div>
          )}
          {profileError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
              {profileError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="settings-fullname" className="block text-xs font-semibold text-slate-700 mb-1">
                Full Display Name *
              </label>
              <input
                id="settings-fullname"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label htmlFor="settings-email" className="block text-xs font-semibold text-slate-700 mb-1">
                Verified Email
              </label>
              <input
                id="settings-email"
                type="email"
                disabled
                value={activeMember.email || session?.email || activeMember.phoneOrEmail}
                className="w-full bg-slate-100 border border-[#E0D7C6] rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="settings-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                Phone / WhatsApp Number
              </label>
              <input
                id="settings-phone"
                type="tel"
                placeholder="+263 77 000 0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="settings-bio" className="block text-xs font-semibold text-slate-700 mb-1">
              Operational Notes / Bio
            </label>
            <textarea
              id="settings-bio"
              rows={3}
              placeholder="Add your banking payout instructions, station hours, or operational specialization..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              style={{ backgroundColor: '#F59E0B', color: '#FFFFFF' }}
            >
              <Save className="w-3.5 h-3.5 text-white" />
              <span className="text-white font-bold">Save Profile Changes</span>
            </button>
          </div>
        </form>

        {/* Column 2: Google-to-Password Account Linking & Password Management */}
        <form
          id="settings-password"
          onSubmit={handlePasswordSubmit}
          className={`lg:col-span-5 bg-white border rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs flex flex-col justify-between transition-all duration-500 ${
            highlightedSection === 'settings-password'
              ? 'border-amber-500 ring-4 ring-amber-400/40 shadow-xl'
              : 'border-[#E8DFCE]'
          }`}
        >
          <div className="space-y-4">
            <div className="pb-3 border-b border-[#F0EBE1]">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-600" />
                <span>
                  {isPasswordLinked
                    ? 'Password & Dual-Provider Credentials'
                    : 'Set Up Password for Account'}
                </span>
                {highlightedSection === 'settings-password' && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold animate-pulse">
                    Focused Section
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isPasswordLinked
                  ? 'Your account is linked for both Google Sign-In and direct Email & Password authentication.'
                  : 'You signed in with Google. Set a password below so you can also log in directly with your email and password.'}
              </p>
            </div>

            {/* Linked Providers Status Row */}
            <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Google OAuth 2.0</span>
                <span className="font-mono font-bold text-emerald-700">
                  {isGoogleLinked ? 'Linked & Verified' : 'Available'}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-[#E8DFCE]">
                <span className="font-semibold text-slate-700">Email &amp; Password Login</span>
                <span
                  className={`font-mono font-bold ${
                    isPasswordLinked ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {isPasswordLinked ? 'Configured & Active' : 'Not Configured Yet'}
                </span>
              </div>
            </div>

            {pwdBanner && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{pwdBanner}</span>
              </div>
            )}
            {pwdError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {pwdError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label htmlFor="settings-new-pwd" className="block text-xs font-semibold text-slate-700 mb-1">
                  {isPasswordLinked ? 'New Password (min 8 chars) *' : 'Create Password (min 8 chars) *'}
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                  <input
                    id="settings-new-pwd"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Minimum 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="settings-confirm-pwd" className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm Password *
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                  <input
                    id="settings-confirm-pwd"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={pwdLoading}
            className="w-full mt-4 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
            style={{ backgroundColor: '#F59E0B', color: '#FFFFFF' }}
          >
            <KeyRound className="w-3.5 h-3.5 text-white" />
            <span className="text-white font-bold">
              {pwdLoading
                ? 'Saving Password...'
                : isPasswordLinked
                ? 'Update Account Password'
                : 'Set Password & Link to Account'}
            </span>
          </button>
        </form>
      </div>

      {/* Section 2.5: Biometric Security & Mobile Notifications */}
      <section
        id="settings-biometrics"
        className={`bg-white border rounded-3xl p-5 sm:p-6 space-y-5 shadow-xs transition-all duration-500 ${
          highlightedSection === 'settings-biometrics'
            ? 'border-amber-500 ring-4 ring-amber-400/40 shadow-xl'
            : 'border-[#E8DFCE]'
        }`}
      >
        <div className="pb-3 border-b border-[#F0EBE1] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Fingerprint className="w-4 h-4 text-emerald-600" />
              <span>Biometric Security &amp; Mobile Notifications</span>
              {highlightedSection === 'settings-biometrics' && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold animate-pulse">
                  Focused Section
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enable one-tap fingerprint/face unlock and manage instant status-bar notifications with vibration.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-mono font-bold text-emerald-800">
            {biometricSupported ? 'Biometrics Supported' : 'Passcode Protected'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Card: Default Eye Quick-Unlock Method */}
          <div className="col-span-1 lg:col-span-2 p-5 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shrink-0">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>Default Eye Quick-Unlock Method</span>
                    {privacyPrefSaved && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold animate-pulse">
                        Saved!
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Choose what happens immediately when you tap the Eye button to reveal protected figures.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              {/* Option 1: Auto */}
              <button
                type="button"
                onClick={() => handleSelectPrivacyPref('auto')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  privacyPref === 'auto'
                    ? 'bg-amber-50 border-amber-500 shadow-xs ring-1 ring-amber-500'
                    : 'bg-white border-[#E0D7C6] hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>⚡ Auto-Detect</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                      Recommended
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    If your phone supports fingerprint, sensor prompt appears immediately; otherwise password input opens.
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-700">
                  {privacyPref === 'auto' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Active Default</span>
                    </>
                  ) : (
                    <span className="text-slate-400 font-normal">Set as default</span>
                  )}
                </div>
              </button>

              {/* Option 2: Fingerprint */}
              <button
                type="button"
                onClick={() => handleSelectPrivacyPref('biometric')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  privacyPref === 'biometric'
                    ? 'bg-amber-50 border-amber-500 shadow-xs ring-1 ring-amber-500'
                    : 'bg-white border-[#E0D7C6] hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Fingerprint className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Fingerprint / Face</span>
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        biometricSupported ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {biometricSupported ? 'Supported' : 'Not Detected'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Always triggers your phone&apos;s fingerprint or face sensor prompt immediately when tapping the eye.
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-700">
                  {privacyPref === 'biometric' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Active Default</span>
                    </>
                  ) : (
                    <span className="text-slate-400 font-normal">Set as default</span>
                  )}
                </div>
              </button>

              {/* Option 3: Password */}
              <button
                type="button"
                onClick={() => handleSelectPrivacyPref('password')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  privacyPref === 'password'
                    ? 'bg-amber-50 border-amber-500 shadow-xs ring-1 ring-amber-500'
                    : 'bg-white border-[#E0D7C6] hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                      <span>Password</span>
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        isPasswordLinked ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {isPasswordLinked ? 'Configured' : 'Needs Setup'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Always opens the password input field directly (with autofocus ready for typing) without prompting biometrics.
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-700">
                  {privacyPref === 'password' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Active Default</span>
                    </>
                  ) : (
                    <span className="text-slate-400 font-normal">Set as default</span>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Card 1: Biometric Fingerprint / Face Unlock Toggle */}
          <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100/70 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                    <Fingerprint className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Fingerprint &amp; Face Unlock</span>
                    <span
                      className={`text-[11px] font-mono font-bold ${
                        enrolledBio ? 'text-emerald-700' : 'text-slate-500'
                      }`}
                    >
                      {enrolledBio ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>

                {/* Biometric Toggle Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(enrolledBio)}
                  onClick={handleToggleBiometrics}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    enrolledBio ? 'bg-amber-500' : 'bg-slate-300'
                  }`}
                  title={enrolledBio ? 'Disable Fingerprint Unlock' : 'Enable Fingerprint Unlock'}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      enrolledBio ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Use your device&apos;s fingerprint or face sensor to unlock Agro Planner instantly and view protected figures.
              </p>

              {bioStatusMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{bioStatusMsg}</span>
                </div>
              )}
              {bioErrorMsg && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  {bioErrorMsg}
                </div>
              )}
            </div>

            {enrolledBio && (
              <div className="pt-2 border-t border-[#F0EBE1] flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Sensor linked &amp; active</span>
                <button
                  type="button"
                  onClick={handleTestBiometricSensor}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold transition-colors cursor-pointer"
                >
                  Test Sensor Unlock
                </button>
              </div>
            )}
          </div>

          {/* Card 2: Notifications & Vibration Toggle */}
          <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100/70 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                    <BellRing className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Status Bar Notifications</span>
                    <span
                      className={`text-[11px] font-mono font-bold ${
                        notifPerm === 'granted' && notifEnabled ? 'text-emerald-700' : 'text-slate-500'
                      }`}
                    >
                      {notifPerm === 'granted' && notifEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>

                {/* Notifications Toggle Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifPerm === 'granted' && notifEnabled}
                  onClick={handleToggleNotifications}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    notifPerm === 'granted' && notifEnabled ? 'bg-amber-500' : 'bg-slate-300'
                  }`}
                  title={notifPerm === 'granted' && notifEnabled ? 'Disable Notifications' : 'Enable Notifications'}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      notifPerm === 'granted' && notifEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Receive instant notifications and subtle vibration alerts whenever ledger activities, approvals, or emergency announcements occur.
              </p>

              {notifStatusMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{notifStatusMsg}</span>
                </div>
              )}
            </div>

            {notifPerm === 'granted' && notifEnabled && (
              <div className="pt-2 border-t border-[#F0EBE1] flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Live alerts &amp; haptics active</span>
                <button
                  type="button"
                  onClick={handleSendTestNotification}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-amber-50 border border-[#E0D7C6] text-slate-900 text-xs font-bold transition-colors cursor-pointer"
                >
                  Send Test Alert
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Section 3: Security & Access Permissions */}
      <section
        id="settings-permissions"
        className={`bg-white border rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs transition-all duration-500 ${
          highlightedSection === 'settings-permissions'
            ? 'border-amber-500 ring-4 ring-amber-400/40 shadow-xl'
            : 'border-[#E8DFCE]'
        }`}
      >
        <div className="pb-3 border-b border-[#F0EBE1] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Security &amp; Access Permissions</span>
              {highlightedSection === 'settings-permissions' && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold animate-pulse">
                  Focused Section
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Overview of your account security status, role permissions, and protected access levels.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-mono font-bold text-emerald-800">
            Account Status: {activeMember.approvalStatus || 'APPROVED'}
          </span>
        </div>

        {/* Clearance Health Banner / Error Status */}
        {recentAlerts.length > 0 ? (
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-300 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Active Security Alerts &amp; Warnings ({recentAlerts.length})</span>
            </div>
            <div className="space-y-1.5">
              {recentAlerts.map((alert) => (
                <div key={alert.id} className="text-xs text-amber-900 bg-white/70 p-2.5 rounded-xl border border-amber-200">
                  <div className="font-semibold flex items-center justify-between">
                    <span>{alert.title}</span>
                    <span className="text-[11px] font-mono text-amber-700">{alert.severity}</span>
                  </div>
                  <p className="text-slate-600 mt-0.5 text-[11px]">{alert.message}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-700">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="text-xs">
              <div className="font-bold text-emerald-950">Account Security Verified</div>
              <p className="text-emerald-800 text-[11px] mt-0.5">
                Your account is fully verified and secure. All data safeguards, access permissions, and activity logs are operating normally with no issues detected.
              </p>
            </div>
          </div>
        )}

        {/* Clearance Attributes Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE]">
            <span className="text-[11px] text-slate-500 font-medium">Assigned Role</span>
            <div className="text-xs font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
              <span>{roleMeta.label}</span>
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE]">
            <span className="text-[11px] text-slate-500 font-medium">Assigned Farm Site</span>
            <div className="text-xs font-bold text-slate-900 mt-0.5 truncate">
              {assignedSite ? assignedSite.name : 'All Syndicate Sites'}
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE]">
            <span className="text-[11px] text-slate-500 font-medium">Data Protection</span>
            <div className="text-xs font-semibold text-emerald-700 mt-0.5 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>Encrypted &amp; Protected</span>
            </div>
          </div>
        </div>

        {/* Capability Matrix */}
        <div className="pt-2">
          <div className="text-xs font-bold text-slate-800 mb-2.5">
            Role Permissions &amp; Capabilities
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {capabilityMatrix.map((item) => (
              <div
                key={item.label}
                className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] flex items-start justify-between gap-2.5"
              >
                <span className="text-xs font-medium text-slate-800 leading-snug">
                  {item.label}
                </span>
                {item.allowed ? (
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 shrink-0">
                    <Check className="w-3.5 h-3.5" />
                    Granted
                  </span>
                ) : (
                  <span className="text-xs font-medium text-slate-400 flex items-center gap-1 shrink-0">
                    <X className="w-3.5 h-3.5" />
                    Restricted
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4: Workspace Appearance, Typography & Brand Studio */}
      <section
        id="settings-appearance"
        className={`bg-white border rounded-3xl p-5 sm:p-6 space-y-5 shadow-xs transition-all duration-500 ${
          highlightedSection === 'settings-appearance'
            ? 'border-amber-500 ring-4 ring-amber-400/40 shadow-xl'
            : 'border-[#E8DFCE]'
        }`}
      >
        <div className="pb-3 border-b border-[#F0EBE1] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Type className="w-4 h-4 text-amber-600" />
              <span>Workspace Typography &amp; Terrain Appearance</span>
              {highlightedSection === 'settings-appearance' && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold animate-pulse">
                  Focused Section
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Customize your local display typography and topographical farm terrain contour intensity.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <SunMedium className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-semibold text-slate-700">Terrain:</span>
            <div className="flex items-center gap-1 p-1 bg-[#FAF8F5] border border-[#E8DFCE] rounded-xl">
              {(['subtle', 'standard', 'expressive'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => onSelectBackgroundIntensity(lvl)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                    backgroundIntensity === lvl
                      ? 'tab-brand-active'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 5-Font Selector Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {FONT_OPTIONS.map((font) => {
            const isSelected = activeFontId === font.id;
            return (
              <button
                key={font.id}
                type="button"
                onClick={() => onSelectFont(font.id)}
                className={`text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-50/70 border-amber-500'
                    : 'bg-[#FAF8F5] border-[#E8DFCE] hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-xs font-bold text-slate-900 truncate ${font.cssClass}`}>
                    {font.familyDisplay}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{font.category}</p>
                <p className={`text-xs font-mono font-bold text-emerald-700 mt-2 tabular-nums ${font.cssClass}`}>
                  {font.sampleFigures}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Section 5: About App & BASOBASO SOFTWARES Attribution Card */}
      <section
        id="settings-about"
        className={`bg-white border-2 rounded-3xl p-5 sm:p-6 shadow-md space-y-4 transition-all duration-500 ${
          highlightedSection === 'settings-about'
            ? 'border-amber-500 ring-4 ring-amber-400/40 shadow-xl'
            : 'border-amber-400/70'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#F0EBE1]">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-base sm:text-lg font-black tracking-widest bg-gradient-to-r from-[#B45309] via-[#BE123C] to-[#047857] bg-clip-text text-transparent">
                {DEVELOPER_INFO.company}
              </span>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <span className="px-2.5 py-0.5 rounded-lg bg-amber-50 border border-amber-300 text-xs font-mono font-bold text-amber-900">
                Initial App Version {DEVELOPER_INFO.version}
              </span>
              {highlightedSection === 'settings-about' && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold animate-pulse">
                  Focused Section
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600">
              About Agro Planner · Developed and engineered by <strong>{DEVELOPER_INFO.company}</strong>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
            <a
              href={
                typeof window !== 'undefined' && (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
                  ? 'https://basobaso03.github.io/Agro-Planner/'
                  : '?website=true'
              }
              target={
                typeof window !== 'undefined' && (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
                  ? '_blank'
                  : undefined
              }
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-[#E0D7C6] text-slate-800 text-xs font-bold transition-colors cursor-pointer shadow-xs"
            >
              <span>Public Website ↗</span>
            </a>
            {onPreviewSplash && (
              <button
                type="button"
                onClick={onPreviewSplash}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Splash</span>
              </button>
            )}
          </div>
        </div>

        {/* Full Developer Contact & Social Links Grid with Modern Icons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <a
            href={`mailto:${DEVELOPER_INFO.email}`}
            className="p-3.5 rounded-2xl bg-[#FAF8F5] hover:bg-amber-50/70 border border-[#E8DFCE] flex items-center justify-between gap-2.5 transition-colors group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <ModernEmailIcon className="w-9 h-9 shrink-0 shadow-xs" />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-slate-500">Email</div>
                <div className="font-mono font-extrabold text-slate-900 group-hover:text-amber-700 truncate">
                  {DEVELOPER_INFO.email}
                </div>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </a>

          <a
            href={`https://wa.me/${DEVELOPER_INFO.whatsappIntl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-3.5 rounded-2xl bg-[#FAF8F5] hover:bg-emerald-50/70 border border-[#E8DFCE] flex items-center justify-between gap-2.5 transition-colors group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <ModernWhatsAppIcon className="w-9 h-9 shrink-0 shadow-xs" />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-slate-500">Call / WhatsApp</div>
                <div className="font-mono font-extrabold text-emerald-900 group-hover:text-emerald-700 truncate">
                  {DEVELOPER_INFO.phoneDisplay}
                </div>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </a>

          <a
            href={DEVELOPER_INFO.linkedInUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-3.5 rounded-2xl bg-[#FAF8F5] hover:bg-sky-50/70 border border-[#E8DFCE] flex items-center justify-between gap-2.5 transition-colors group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <ModernLinkedInIcon className="w-9 h-9 shrink-0 shadow-xs" />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-slate-500">LinkedIn</div>
                <div className="font-extrabold text-[#0A66C2] group-hover:underline truncate">
                  {DEVELOPER_INFO.linkedInName}
                </div>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </a>
        </div>
      </section>
    </div>
  );
};
