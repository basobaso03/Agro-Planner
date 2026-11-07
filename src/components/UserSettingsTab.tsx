import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
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
  RefreshCw,
  Building2,
  Copy,
  Users,
  ChevronRight,
  ArrowLeft,
  Smartphone,
  Info,
  Compass,
  Loader2,
} from 'lucide-react';
import {
  getCelebrationMode,
  setCelebrationMode,
  type CelebrationMode,
} from '../utils/celebrations.ts';
import type { FarmLocation, OrgMember } from '../types/agro.ts';
import type { Organization, OrganizationType } from '../types/organization.ts';
import {
  dataService,
  hasPasswordConfigured,
  getStoredLocalCredentials,
  type AuthenticatedSession,
} from '../services/dataService.ts';
import { PERMISSIONS, getRoleMeta } from '../utils/permissions.ts';
import { FONT_OPTIONS, type FontStyleId } from '../types/theme.ts';
import {
  DEVELOPER_INFO,
  ModernEmailIcon,
  ModernLinkedInIcon,
  ModernWhatsAppIcon,
} from './DeveloperBrandInfo.tsx';
import { MemberRoleSheet } from '../sheets/common/MemberRoleSheet.tsx';
import { useNavigation } from '../navigation/useNavigation.ts';
import { useBackHandler } from '../navigation/useBackHandler.ts';
import {
  areSystemNotificationsEnabled,
  checkAsyncNotificationPermission,
  dispatchSystemNotification,
  enrollDeviceBiometric,
  getEnrolledBiometricRecord,
  getNotificationPermissionState,
  getPrivacyUnlockPreference,
  isBiometricHardwareSupported,
  isVibrationEnabled,
  removeEnrolledBiometricRecord,
  requestSystemNotificationPermission,
  setPrivacyUnlockPreference,
  setSystemNotificationsPreference,
  setVibrationEnabled,
  verifyDeviceBiometric,
  type EnrolledBiometricRecord,
  type PrivacyUnlockMethod,
} from '../utils/mobileHardware.ts';

interface UserSettingsTabProps {
  activeMember: OrgMember;
  session: AuthenticatedSession | null;
  locations: FarmLocation[];
  activeOrg?: Organization | null;
  activeFontId?: FontStyleId;
  onSelectFont?: (fontId: FontStyleId) => void;
  backgroundIntensity?: 'subtle' | 'standard' | 'expressive';
  onSelectBackgroundIntensity?: (intensity: 'subtle' | 'standard' | 'expressive') => void;
  onPreviewSplash?: () => void;
  onCheckUpdates?: () => void;
  onSignOut: () => void;
  targetSection?: string | null;
}

type SettingsCategory =
  | 'OVERVIEW'
  | 'ORGANIZATION'
  | 'PROFILE'
  | 'SECURITY'
  | 'APPEARANCE'
  | 'NOTIFICATIONS'
  | 'ABOUT';

export const UserSettingsTab: React.FC<UserSettingsTabProps> = ({
  activeMember,
  session,
  locations,
  activeOrg,
  activeFontId = 'font-sans',
  onSelectFont = () => { },
  backgroundIntensity = 'standard',
  onSelectBackgroundIntensity = () => { },
  onPreviewSplash,
  onCheckUpdates,
  onSignOut,
  targetSection = null,
}) => {
  const { navigate, goBack } = useNavigation();

  const getCategoryTitle = (cat: SettingsCategory): string => {
    switch (cat) {
      case 'ORGANIZATION':
        return 'Organization & Team';
      case 'PROFILE':
        return 'Personal Profile';
      case 'SECURITY':
        return 'Security & Biometrics';
      case 'APPEARANCE':
        return 'Display & Typography';
      case 'NOTIFICATIONS':
        return 'Notifications & Cloud Sync';
      case 'ABOUT':
        return 'About Capital Seed';
      default:
        return 'Organisation & Account Settings';
    }
  };

  // Navigation View State
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>(() => {
    if (targetSection === 'password' || targetSection === 'biometric' || targetSection === 'security') {
      return 'SECURITY';
    }
    if (targetSection === 'profile') return 'PROFILE';
    if (targetSection === 'appearance' || targetSection === 'theme') return 'APPEARANCE';
    if (targetSection === 'organization' || targetSection === 'org' || targetSection === 'team') return 'ORGANIZATION';
    if (targetSection === 'notifications' || targetSection === 'alerts') return 'NOTIFICATIONS';
    if (targetSection === 'about' || targetSection === 'developer') return 'ABOUT';
    return 'OVERVIEW';
  });

  useEffect(() => {
    if (!targetSection) {
      setActiveCategory('OVERVIEW');
      return;
    }
    if (targetSection === 'password' || targetSection === 'biometric' || targetSection === 'security') {
      setActiveCategory('SECURITY');
    } else if (targetSection === 'profile') {
      setActiveCategory('PROFILE');
    } else if (targetSection === 'appearance' || targetSection === 'theme') {
      setActiveCategory('APPEARANCE');
    } else if (targetSection === 'organization' || targetSection === 'org' || targetSection === 'team') {
      setActiveCategory('ORGANIZATION');
    } else if (targetSection === 'notifications' || targetSection === 'alerts') {
      setActiveCategory('NOTIFICATIONS');
    } else if (targetSection === 'about' || targetSection === 'developer') {
      setActiveCategory('ABOUT');
    }
  }, [targetSection]);

  const handleSelectCategory = (cat: SettingsCategory) => {
    setActiveCategory(cat);
    if (cat === 'OVERVIEW') {
      goBack();
    } else {
      navigate('settings', { section: cat.toLowerCase() }, getCategoryTitle(cat));
    }
  };

  const handleBackToOverview = () => {
    setActiveCategory('OVERVIEW');
    goBack();
  };

  useBackHandler(
    25,
    () => {
      if (activeCategory !== 'OVERVIEW') {
        setActiveCategory('OVERVIEW');
        if (targetSection) {
          return false; // Let NAV_PROVIDER_STACK pop the pushed sub-route
        }
        return true;
      }
      return false;
    },
    [activeCategory, targetSection]
  );

  // Profile Editor State
  const [fullName, setFullName] = useState(activeMember.fullName);
  const [email, setEmail] = useState(
    activeMember.email || (activeMember.phoneOrEmail?.includes('@') ? activeMember.phoneOrEmail : '')
  );
  const [phone, setPhone] = useState(
    activeMember.phone || (!activeMember.phoneOrEmail?.includes('@') ? activeMember.phoneOrEmail : '')
  );
  const [bio, setBio] = useState(activeMember.bio || '');
  const [profileBanner, setProfileBanner] = useState('');
  const [profileError, setProfileError] = useState('');

  // Password State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pwdBanner, setPwdBanner] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  // 24-Hr Invite Code & Org Details State
  const [inviteCodeCopied, setInviteCodeCopied] = useState(false);
  const [isRefreshingCode, setIsRefreshingCode] = useState(false);
  const [orgBanner, setOrgBanner] = useState('');
  const [editOrgName, setEditOrgName] = useState(activeOrg?.name || '');
  const [editOrgType, setEditOrgType] = useState<OrganizationType>(activeOrg?.type || 'AGRO_FARMING');
  const [editOrgTarget, setEditOrgTarget] = useState(String(activeOrg?.defaultTargetContributionUsd || 1000));
  const [editOrgPace, setEditOrgPace] = useState<'MONTHLY' | 'MILESTONE' | 'FLEXIBLE'>(activeOrg?.contributionPaceDefault || 'MONTHLY');
  const [isSavingOrg, setIsSavingOrg] = useState(false);

  // Complete Account Deletion State
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleConfirmDeleteAccount = async () => {
    setIsDeletingAccount(true);
    setDeleteError(null);
    try {
      await dataService.deleteAccount(activeMember);
      setShowDeleteAccountModal(false);
      onSignOut?.();
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete account. Please try again.');
    } finally {
      setIsDeletingAccount(false);
    }
  };
  const [orgSaveError, setOrgSaveError] = useState('');

  useEffect(() => {
    if (activeOrg) {
      setEditOrgName(activeOrg.name);
      setEditOrgType(activeOrg.type);
      setEditOrgTarget(String(activeOrg.defaultTargetContributionUsd || 1000));
      setEditOrgPace(activeOrg.contributionPaceDefault || 'MONTHLY');
    }
  }, [activeOrg?.id, activeOrg?.updatedAt]);

  // Hardware Biometric & Notification State
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
  const [vibrationOn, setVibrationOn] = useState<boolean>(() => isVibrationEnabled());
  const [celebrationModeState, setCelebrationModeState] = useState<CelebrationMode>(() => getCelebrationMode());
  const [privacyPref, setPrivacyPref] = useState<PrivacyUnlockMethod>(() =>
    getPrivacyUnlockPreference()
  );
  const [privacyPrefSaved, setPrivacyPrefSaved] = useState<boolean>(false);

  // Cloud Sync State
  const [isSyncingSettings, setIsSyncingSettings] = useState(false);
  const [settingsSyncMsg, setSettingsSyncMsg] = useState<string | null>(null);

  // Multi-Device Session Revocation State
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [revokeError, setRevokeError] = useState('');

  const handleRevokeAllSessions = async () => {
    setRevokeError('');
    setRevokeLoading(true);
    try {
      await dataService.revokeAllSessionsForCurrentUser();
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : 'Failed to sign out all sessions.');
      setRevokeLoading(false);
    }
  };

  // Team Member Role Management State
  const [roleModalMember, setRoleModalMember] = useState<OrgMember | null>(null);
  const [, setMembersListTick] = useState(0);

  useEffect(() => {
    return dataService.subscribe(() => {
      setMembersListTick((t) => t + 1);
    });
  }, []);

  useEffect(() => {
    isBiometricHardwareSupported().then(setBiometricSupported).catch(() => { });
    checkAsyncNotificationPermission().then(setNotifPerm).catch(() => { });
  }, []);

  const isAdmin = PERMISSIONS.canManageMembers(activeMember.role);
  const roleMeta = getRoleMeta(activeMember.role);
  const isPasswordConfigured = hasPasswordConfigured(activeMember);
  const isAgro = activeOrg?.type !== 'GENERAL_VENTURE';

  const orgMembers = dataService.getState().members.filter(
    (m) => !activeMember.orgId || m.orgId === activeMember.orgId
  );

  const handleCopyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setInviteCodeCopied(true);
    setTimeout(() => setInviteCodeCopied(false), 2500);
  };

  const handleRefreshCode = () => {
    if (!activeOrg) return;
    setIsRefreshingCode(true);
    setOrgBanner('');
    try {
      const updated = dataService.refreshInviteCode({
        orgId: activeOrg.id,
        actor: activeMember,
      });
      setOrgBanner(`Fresh 24-hr code generated: ${updated.currentInviteCode}`);
    } catch (err: unknown) {
      setOrgBanner(err instanceof Error ? err.message : 'Failed to refresh code.');
    } finally {
      setIsRefreshingCode(false);
    }
  };

  const handleSaveOrgSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg) return;
    if (!editOrgName.trim()) {
      setOrgSaveError('Organization name is required.');
      return;
    }
    setOrgSaveError('');
    setIsSavingOrg(true);
    setOrgBanner('');
    try {
      const updated = dataService.updateOrganization({
        orgId: activeOrg.id,
        name: editOrgName.trim(),
        type: editOrgType,
        defaultTargetContributionUsd: Number(editOrgTarget) || 1000,
        contributionPaceDefault: editOrgPace,
        actor: activeMember,
      });
      setOrgBanner(`Organization "${updated.name}" updated successfully.`);
    } catch (err: unknown) {
      setOrgSaveError(err instanceof Error ? err.message : 'Failed to update organization settings.');
    } finally {
      setIsSavingOrg(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileBanner('');
    setProfileError('');
    if (!fullName.trim()) {
      setProfileError('Full Name cannot be empty.');
      return;
    }
    try {
      dataService.updateOwnMemberProfile({
        memberId: activeMember.id,
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        jobTitle: activeMember.role,
        bio: bio.trim(),
        preferredContact: email.trim() ? 'EMAIL' : 'WHATSAPP',
      });
      setProfileBanner('Profile updated successfully.');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile.');
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdBanner('');
    setPwdError('');

    // If password is already configured, strictly require and verify the old/current password
    if (isPasswordConfigured) {
      if (!oldPassword.trim()) {
        setPwdError('Please enter your current password to authorize this change.');
        return;
      }
      const isOldCorrect = await dataService.verifyMemberPasswordAsync(activeMember, oldPassword);
      if (!isOldCorrect) {
        setPwdError('Current password is incorrect. Please verify your existing password.');
        return;
      }
      if (oldPassword === newPassword) {
        setPwdError('New password must be different from your current password.');
        return;
      }
    }

    if (newPassword.length < 8) {
      setPwdError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('Passwords do not match.');
      return;
    }
    const targetEmail = (email || activeMember.email || activeMember.phoneOrEmail || '').trim();
    if (!targetEmail.includes('@')) {
      setPwdError('Please enter a valid email address in your profile to link a password.');
      return;
    }
    setPwdLoading(true);
    try {
      await dataService.setupOrUpdatePasswordForCurrentUser({
        member: activeMember,
        newPassword,
        newEmail: targetEmail,
        oldPassword: isPasswordConfigured ? oldPassword : undefined,
      });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwdBanner('Your account password has been updated and is active.');
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : 'Could not configure password.');
    } finally {
      setPwdLoading(false);
    }
  };

  const handleToggleBiometrics = async () => {
    setBioStatusMsg('');
    setBioErrorMsg('');
    if (enrolledBio) {
      removeEnrolledBiometricRecord();
      setEnrolledBio(null);
      setBioStatusMsg('Fingerprint unlock has been turned off on this device.');
    } else {
      try {
        const rec = await enrollDeviceBiometric({
          memberId: activeMember.id,
          email: activeMember.email || session?.email || activeMember.phoneOrEmail,
          fullName: activeMember.fullName,
        });
        setEnrolledBio(rec);
        setPrivacyUnlockPreference('biometric');
        setPrivacyPref('biometric');
        setBioStatusMsg('Fingerprint unlock enabled and configured as default!');
      } catch (err) {
        setBioErrorMsg(
          err instanceof Error
            ? err.message
            : 'Could not complete biometric setup. Ensure device has fingerprint hardware configured.'
        );
      }
    }
  };

  const handleTestBiometricSensor = async () => {
    setBioStatusMsg('');
    setBioErrorMsg('');
    try {
      const verified = await verifyDeviceBiometric();
      setBioStatusMsg(`Identity verified! Fingerprint is operational for ${verified.fullName}.`);
    } catch (err) {
      setBioErrorMsg(err instanceof Error ? err.message : 'Biometric verification failed.');
    }
  };

  const handleSelectPrivacyPref = (method: PrivacyUnlockMethod) => {
    setPrivacyUnlockPreference(method);
    setPrivacyPref(method);
    setPrivacyPrefSaved(true);
    setTimeout(() => setPrivacyPrefSaved(false), 2500);
  };

  return (
    <div className="space-y-5 animate-fade-in pb-20 text-slate-950">
      {/* Top Profile Summary Card - Displayed only on Overview Hub */}
      {activeCategory === 'OVERVIEW' && (
        <div className="p-5 sm:p-6 rounded-3xl bg-white border border-[#E8DFCE] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-black text-xl shadow-md shadow-emerald-700/20 shrink-0">
              {activeMember.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-black text-slate-950 break-words">{activeMember.fullName}</h1>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap shrink-0 shadow-2xs ${roleMeta.badgeClass}`}>
                  {roleMeta.label}
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium break-all">
                {activeMember.email || activeMember.phoneOrEmail}
              </p>
              {activeOrg && (
                <p className="text-[11px] font-bold text-emerald-800 flex items-center gap-1 mt-0.5">
                  <Building2 className="w-3 h-3 text-emerald-600" />
                  <span>{activeOrg.name} ({activeOrg.type === 'AGRO_FARMING' ? 'Agro-Farming' : 'General Venture'})</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <button
              type="button"
              onClick={onSignOut}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Sign out of this device only"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-600" />
              <span>Sign Out</span>
            </button>
            <button
              type="button"
              onClick={() => setShowRevokeModal(true)}
              className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Sign out all devices and require fresh authentication everywhere"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              <span>Sign Out All Devices</span>
            </button>
          </div>
        </div>
      )}

      {/* VIEW A: CATEGORIZED HUB MENU */}
      {activeCategory === 'OVERVIEW' ? (
        <div className="space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 px-1">
            Settings Categories
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Category 1: Organization & Workspace */}
            <div
              onClick={() => handleSelectCategory('ORGANIZATION')}
              className="p-4 rounded-3xl bg-white border border-[#E8DFCE] hover:border-emerald-500 transition-all cursor-pointer shadow-xs flex items-center justify-between group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 shrink-0">
                  <Building2 className="w-5 h-5 text-emerald-700" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-950">Organization &amp; Team</h3>
                    {isAdmin && (
                      <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-purple-100 text-purple-900 border border-purple-300 uppercase">
                        Admin
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                    {isAdmin ? 'Invitation code, capital targets, and org profile' : 'Organization profile, rules and capital targets'}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-0.5 transition-all" />
            </div>

            {/* Category 2: Personal Profile & Contact */}
            <div
              onClick={() => handleSelectCategory('PROFILE')}
              className="p-4 rounded-3xl bg-white border border-[#E8DFCE] hover:border-emerald-500 transition-all cursor-pointer shadow-xs flex items-center justify-between group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-800 shrink-0">
                  <UserIcon className="w-5 h-5 text-slate-700" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-slate-950">Personal Profile</h3>
                  <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                    Display name, contact email, phone, bio, and password
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-0.5 transition-all" />
            </div>

            {/* Category 3: Security & Credentials */}
            <div
              onClick={() => handleSelectCategory('SECURITY')}
              className="p-4 rounded-3xl bg-white border border-[#E8DFCE] hover:border-emerald-500 transition-all cursor-pointer shadow-xs flex items-center justify-between group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 shrink-0">
                  <Fingerprint className="w-5 h-5 text-amber-700" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="text-sm font-black text-slate-950">Security &amp; Biometrics</h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 border shadow-2xs ${enrolledBio
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-amber-50 text-amber-900 border-amber-300'
                        }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${enrolledBio ? 'bg-emerald-600' : 'bg-amber-500'}`} />
                      {enrolledBio ? 'Fingerprint Active' : 'Setup Needed'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                    Default fingerprint sensor, account password &amp; privacy shield
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-0.5 transition-all" />
            </div>

            {/* Category 4: Appearance & Typography */}
            <div
              onClick={() => handleSelectCategory('APPEARANCE')}
              className="p-4 rounded-3xl bg-white border border-[#E8DFCE] hover:border-emerald-500 transition-all cursor-pointer shadow-xs flex items-center justify-between group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-teal-100 border border-teal-300 flex items-center justify-center text-teal-800 shrink-0">
                  <Type className="w-5 h-5 text-teal-700" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-slate-950">Display &amp; Android Typography</h3>
                  <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                    High-contrast mobile typography &amp; OLED terrain contrast
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-0.5 transition-all" />
            </div>

            {/* Category 5: System Notifications & Cloud Sync */}
            <div
              onClick={() => handleSelectCategory('NOTIFICATIONS')}
              className="p-4 rounded-3xl bg-white border border-[#E8DFCE] hover:border-emerald-500 transition-all cursor-pointer shadow-xs flex items-center justify-between group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-sky-100 border border-sky-300 flex items-center justify-center text-sky-800 shrink-0">
                  <BellRing className="w-5 h-5 text-sky-700" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-slate-950">Notifications &amp; Cloud Sync</h3>
                  <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                    Mobile push alerts, vibration, and manual cloud sync
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-0.5 transition-all" />
            </div>

            {/* Category 6: About Capital Seed & Architecture */}
            <div
              onClick={() => handleSelectCategory('ABOUT')}
              className="p-4 rounded-3xl bg-white border border-[#E8DFCE] hover:border-emerald-500 transition-all cursor-pointer shadow-xs flex items-center justify-between group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-purple-100 border border-purple-300 flex items-center justify-center text-purple-800 shrink-0">
                  <Info className="w-5 h-5 text-purple-700" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-slate-950">About Capital Seed &amp; Support</h3>
                  <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                    Release notes, security ledger verifier, and developer contact
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>

          {/* Danger Zone: Permanent Account Deletion */}
          <div className="pt-2">
            <div className="p-4 rounded-3xl bg-rose-50/80 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-rose-950 font-black text-xs uppercase tracking-wide">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Permanent Account Deletion</span>
                </div>
                <p className="text-[11px] text-rose-800 font-medium">
                  Irreversibly delete your account, authentication credentials, and membership documents from cloud and device.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowDeleteAccountModal(true)}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors shrink-0"
              >
                Delete Account Completely
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* VIEW B: DETAIL CATEGORY VIEW */
        <div className="space-y-4">
          <button
            type="button"
            onClick={handleBackToOverview}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-950 text-xs font-black transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to All Settings</span>
          </button>

          {/* 1. ORGANIZATION DETAIL VIEW */}
          {activeCategory === 'ORGANIZATION' && (
            <div className="p-5 sm:p-6 rounded-3xl bg-white border border-[#E8DFCE] space-y-4 shadow-xs">
              <div className="pb-3 border-b border-[#F0EBE1]">
                <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-700" />
                  <span>Organization Governance &amp; Registration Details</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {isAdmin
                    ? 'View organization profile parameters, team member roles, and active invitation code'
                    : 'View organization profile parameters and capital rules'}
                </p>
              </div>

              {orgBanner && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{orgBanner}</span>
                </div>
              )}

              {/* Active Organization Invite Code (ADMIN ONLY) */}
              {isAdmin && (
                <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-500 tracking-wide">
                        Active Organization Invite Code
                      </span>
                      <div className="text-2xl font-mono font-black text-emerald-900 mt-0.5">
                        {activeOrg?.currentInviteCode || 'SEED-8492'}
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Share this invitation code with new members to join {activeOrg?.name || 'this organization'}.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyInviteCode(activeOrg?.currentInviteCode || 'SEED-8492')}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        {inviteCodeCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{inviteCodeCopied ? 'Code Copied' : 'Copy Invite Code'}</span>
                      </button>
                      <button
                        type="button"
                        disabled={isRefreshingCode}
                        onClick={handleRefreshCode}
                        className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingCode ? 'animate-spin' : ''}`} />
                        <span>Refresh Code</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Comprehensive Registration Data Summary Card */}
              <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#F0EBE1]">
                  <h4 className="text-xs font-black text-slate-950 uppercase tracking-wide">
                    Organization Registration Details
                  </h4>
                  <span className="text-[10px] font-mono font-bold text-slate-500">
                    ID: {activeOrg?.id || 'None'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Organization Name</span>
                    <strong className="text-slate-900 font-bold text-sm">{activeOrg?.name || 'No Active Workspace'}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Workspace Operating Type</span>
                    <span className="text-emerald-800 font-bold">
                      {activeOrg?.type === 'AGRO_FARMING'
                        ? 'Agro-Farming & Livestock Enterprise'
                        : 'General Business Venture / Pooled Fund'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Target Capital Commitment</span>
                    <strong className="font-mono text-slate-900 font-bold">
                      ${(activeOrg?.defaultTargetContributionUsd || 1000).toLocaleString()}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Contribution Pace</span>
                    <span className="text-slate-800 font-semibold">
                      {activeOrg?.contributionPaceDefault === 'MONTHLY'
                        ? 'Monthly Agreed Commitment'
                        : activeOrg?.contributionPaceDefault === 'MILESTONE'
                          ? 'Milestone-Based Capital Calls'
                          : 'Flexible / Self-Paced'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Founder / Lead Contact</span>
                    <span className="text-slate-800 font-medium">
                      {activeOrg?.founderContact || activeMember.fullName}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Registration Date</span>
                    <span className="font-mono text-slate-800">
                      {activeOrg?.createdAt
                        ? new Date(activeOrg.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                        : 'Active Registration'}
                    </span>
                  </div>
                  {isAgro && (
                    <div className="sm:col-span-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Farm Sites / Registered Locations</span>
                      <span className="text-slate-800 font-medium">
                        {locations.length > 0
                          ? `${locations.length} Active Sites (${locations.map((l) => l.name).join(', ')})`
                          : 'No farm sites registered'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {orgSaveError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-950 font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{orgSaveError}</span>
                </div>
              )}

              {/* Editable Organization Details Form (ADMIN ONLY) */}
              {isAdmin && (
                <form onSubmit={handleSaveOrgSettings} className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] space-y-3.5">
                  <div className="flex items-center justify-between pb-2 border-b border-[#F0EBE1]">
                    <h4 className="text-xs font-black text-slate-950 uppercase tracking-wide">
                      Update Organization Profile &amp; Rules
                    </h4>
                    <span className="text-[10px] font-bold text-slate-500">
                      Admin Settings
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-black text-slate-950 mb-1">
                        Organization Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editOrgName}
                        onChange={(e) => setEditOrgName(e.target.value)}
                        placeholder="e.g. Apex Ventures"
                        className="w-full bg-white border border-[#E0D7C6] rounded-xl px-3 py-2 text-xs text-slate-950 font-bold focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-950 mb-1">
                        Workspace Operating Mode <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={editOrgType}
                        onChange={(e) => setEditOrgType(e.target.value as OrganizationType)}
                        className="w-full bg-white border border-[#E0D7C6] rounded-xl px-2.5 py-2 text-xs text-slate-950 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="AGRO_FARMING">Agro-Farming &amp; Livestock Enterprise</option>
                        <option value="GENERAL_VENTURE">General Business Venture / Pooled Fund</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-950 mb-1">
                        Default Target Capital ($) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={editOrgTarget}
                        onChange={(e) => setEditOrgTarget(e.target.value)}
                        className="w-full bg-white border border-[#E0D7C6] rounded-xl px-3 py-2 text-xs text-slate-950 font-mono font-bold focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-950 mb-1">
                        Contribution Pace <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={editOrgPace}
                        onChange={(e) => setEditOrgPace(e.target.value as 'MONTHLY' | 'MILESTONE' | 'FLEXIBLE')}
                        className="w-full bg-white border border-[#E0D7C6] rounded-xl px-2.5 py-2 text-xs text-slate-950 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="MONTHLY">Monthly Agreed Commitment</option>
                        <option value="MILESTONE">Milestone-Based Capital Calls</option>
                        <option value="FLEXIBLE">Flexible / Self-Paced</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isSavingOrg}
                      className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSavingOrg ? 'Saving Changes...' : 'Save Organization Settings'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Team Members & Access Roles (Admin Only) */}
              {isAdmin && (
                <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#F0EBE1]">
                    <div>
                      <h4 className="text-xs font-black text-slate-950 uppercase tracking-wide flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-emerald-700" />
                        <span>Team Members &amp; Access Roles</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        {isAgro
                          ? 'Manage member roles, permissions, and farm location assignments'
                          : 'Manage member roles, operational clearances, and administrative access'}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                      {orgMembers.length} Partners
                    </span>
                  </div>

                  <div className="space-y-2">
                    {orgMembers.map((member) => {
                      const isSelf = member.id === activeMember.id;
                      const memberRoleMeta = getRoleMeta(member.role);
                      return (
                        <div
                          key={member.id}
                          className="p-3 rounded-xl bg-white border border-[#E8DFCE] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold flex items-center justify-center text-xs shrink-0">
                              {member.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-black text-slate-950 break-words">
                                  {member.fullName}
                                </span>
                                {isSelf && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                                    You
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-500 block truncate">
                                {member.email || member.phoneOrEmail}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap shrink-0 shadow-2xs ${memberRoleMeta.badgeClass}`}>
                              {memberRoleMeta.label}
                            </span>
                            <button
                              type="button"
                              onClick={() => setRoleModalMember(member)}
                              className="px-3 py-1.5 rounded-xl bg-[#FAF8F5] hover:bg-[#F0EBE1] border border-[#E0D7C6] text-slate-800 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                            >
                              ⚙️ Change Role
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. PERSONAL PROFILE VIEW */}
          {activeCategory === 'PROFILE' && (
            <div className="space-y-4">
              {/* Clean Personal Profile Preview */}
              <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-50 via-teal-50 to-white border border-emerald-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-black text-lg shadow-sm shrink-0">
                    {(fullName || activeMember.fullName || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-slate-950 truncate">
                        {fullName || activeMember.fullName}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-2xs ${isPasswordConfigured
                          ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                          : 'bg-amber-100 text-amber-950 border-amber-300'
                          }`}
                      >
                        {isPasswordConfigured ? 'Password Active ✓' : 'No Password Set'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium truncate">
                      {email || activeMember.email || phone || activeMember.phoneOrEmail}
                    </p>
                    {bio && (
                      <p className="text-[11px] text-slate-500 italic truncate max-w-md">
                        &ldquo;{bio}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Personal Profile Details Editor */}
              <form
                onSubmit={handleProfileSubmit}
                className="p-5 sm:p-6 rounded-3xl bg-white border border-[#E8DFCE] space-y-4 shadow-xs"
              >
                <div className="pb-3 border-b border-[#F0EBE1]">
                  <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                    <UserIcon className="w-5 h-5 text-emerald-700" />
                    <span>Personal Profile Details</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Update your personal contact details visible to your verified partners
                  </p>
                </div>

                {profileBanner && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 font-bold">
                    {profileBanner}
                  </div>
                )}
                {profileError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-950 font-bold">
                    {profileError}
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-black text-slate-950 mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3.5 py-2.5 text-xs text-slate-950 font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-950 mb-1">
                      Email Address (for password sign-in &amp; account recovery)
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. farmer@example.com"
                      className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3.5 py-2.5 text-xs text-slate-950 font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-950 mb-1">
                      Phone Number (WhatsApp / SMS)
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+263 7..."
                      className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3.5 py-2.5 text-xs text-slate-950 font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-950 mb-1">Short Bio / Notes</label>
                    <textarea
                      rows={2}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Brief note about your role or specialization"
                      className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl px-3.5 py-2.5 text-xs text-slate-950 font-medium focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs cursor-pointer shadow-xs transition-colors"
                  >
                    Save Profile Changes
                  </button>
                </div>
              </form>

              {/* Account Password Section in Profile */}
              <form
                onSubmit={handlePasswordSubmit}
                className="p-5 sm:p-6 rounded-3xl bg-white border border-[#E8DFCE] space-y-4 shadow-xs"
              >
                <div className="pb-3 border-b border-[#F0EBE1] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                      <KeyRound className="w-5 h-5 text-amber-700" />
                      <span>Account Password &amp; Sign-In Credentials</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Set or update your password to sign in via email or unlock the privacy shield
                    </p>
                  </div>
                  <span
                    className={`whitespace-nowrap shrink-0 self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-black ${isPasswordConfigured
                      ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                      : 'bg-amber-100 text-amber-950 border border-amber-300'
                      }`}
                  >
                    {isPasswordConfigured ? 'Configured & Active ✓' : 'Not Configured Yet'}
                  </span>
                </div>

                {pwdBanner && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 font-bold">
                    {pwdBanner}
                  </div>
                )}
                {pwdError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-950 font-bold">
                    {pwdError}
                  </div>
                )}

                <div className="space-y-3">
                  {isPasswordConfigured && (
                    <div>
                      <label className="block text-xs font-black text-slate-950 mb-1">
                        Current Password <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          placeholder="Enter your current password"
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                          className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl pl-3.5 pr-11 py-2.5 text-xs text-slate-950 font-bold focus:outline-none focus:border-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-2 p-1.5 rounded-lg text-amber-800 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-black text-slate-950 mb-1">
                        {isPasswordConfigured ? 'New Password' : 'New Password (min 8 chars)'} <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          placeholder="Enter new password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl pl-3.5 pr-11 py-2.5 text-xs text-slate-950 font-bold focus:outline-none focus:border-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-2 p-1.5 rounded-lg text-amber-800 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-950 mb-1">
                        {isPasswordConfigured ? 'Confirm New Password' : 'Confirm Password'} <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          placeholder="Re-enter password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl pl-3.5 pr-11 py-2.5 text-xs text-slate-950 font-bold focus:outline-none focus:border-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-2 p-1.5 rounded-lg text-amber-800 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-950 font-black text-xs transition-colors cursor-pointer shadow-2xs"
                  >
                    {showPassword ? (
                      <>
                        <EyeOff className="w-4 h-4 text-amber-800 shrink-0" />
                        <span>Hide Passwords</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4 text-amber-800 shrink-0" />
                        <span>Show Passwords</span>
                      </>
                    )}
                  </button>

                  <button
                    type="submit"
                    disabled={pwdLoading}
                    className="py-2.5 px-5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-black text-xs cursor-pointer shadow-xs transition-colors"
                  >
                    {pwdLoading ? 'Saving Password...' : isPasswordConfigured ? 'Update Password' : 'Save & Link Password'}
                  </button>
                </div>
              </form>

              {/* Multi-Device Session Security & Global Sign Out */}
              <div className="p-5 sm:p-6 rounded-3xl bg-white border border-[#E8DFCE] space-y-4 shadow-xs">
                <div className="pb-3 border-b border-[#F0EBE1] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-rose-600" />
                      <span>Device Sessions &amp; Global Access Control</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Enforce fresh sign-in across all smartphones, tablets, and computers connected to your account
                    </p>
                  </div>
                  <span className="whitespace-nowrap shrink-0 self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-100 text-slate-800 border border-slate-300">
                    Session Epoch: v{activeMember.sessionVersion || 1}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950 space-y-2">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold">
                        Multi-Device Invalidation Protection:
                      </p>
                      <p className="text-slate-700 leading-relaxed">
                        Whenever you change your password on this or any device, all other active devices are automatically invalidated and blocked from continuing until they authenticate afresh with your new password.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE]">
                    <span className="text-slate-600 font-bold">Last Password Change:</span>
                    <span className="font-black text-slate-900">
                      {activeMember.passwordChangedAt
                        ? new Date(activeMember.passwordChangedAt).toLocaleString()
                        : 'No recent change'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE]">
                    <span className="text-slate-600 font-bold">Last Global Session Revocation:</span>
                    <span className="font-black text-slate-900">
                      {activeMember.sessionsRevokedAt
                        ? new Date(activeMember.sessionsRevokedAt).toLocaleString()
                        : 'Never revoked'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <p className="text-[11px] text-slate-500 font-medium">
                    Lost a phone or suspect someone else is signed in? Terminate all sessions now.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowRevokeModal(true)}
                    className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors shrink-0"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>Sign Out All Devices</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. SECURITY, PASSWORD & BIOMETRICS VIEW */}
          {activeCategory === 'SECURITY' && (
            <div className="space-y-4">
              {/* Biometrics Panel (Default) */}
              <div className="p-5 sm:p-6 rounded-3xl bg-white border border-[#E8DFCE] space-y-4 shadow-xs">
                <div className="pb-3 border-b border-[#F0EBE1] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                      <Fingerprint className="w-5 h-5 text-emerald-700 shrink-0" />
                      <span>Biometric Fingerprint Security</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Fast one-touch authentication using your Android biometric sensor
                    </p>
                  </div>
                  <span
                    className={`self-start sm:self-auto px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 border shadow-2xs ${enrolledBio
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${enrolledBio ? 'bg-emerald-600' : 'bg-slate-400'}`} />
                    {enrolledBio ? 'Enrolled & Active' : 'Not Active'}
                  </span>
                </div>

                {bioStatusMsg && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 font-bold">
                    {bioStatusMsg}
                  </div>
                )}
                {bioErrorMsg && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-950 font-bold">
                    {bioErrorMsg}
                  </div>
                )}

                <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-black text-slate-950">Android Fingerprint Sensor</p>
                    <p className="text-[11px] text-slate-600 font-medium">
                      {enrolledBio
                        ? `Enrolled for ${enrolledBio.fullName} (${enrolledBio.email})`
                        : 'Tap enroll to activate biometric authentication'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {enrolledBio && (
                      <button
                        type="button"
                        onClick={handleTestBiometricSensor}
                        className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-900 font-bold text-xs cursor-pointer"
                      >
                        Test Sensor
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleToggleBiometrics}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-colors cursor-pointer ${enrolledBio
                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                        }`}
                    >
                      {enrolledBio ? 'Remove Fingerprint' : 'Enroll Fingerprint'}
                    </button>
                  </div>
                </div>

                {/* Privacy Shield Method Selector */}
                <div className="pt-2 border-t border-[#F0EBE1] space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-950">
                      Default Eye Quick-Unlock Method:
                    </label>
                    {privacyPrefSaved && (
                      <span className="text-[11px] text-emerald-800 font-bold animate-in fade-in">
                        Preference Saved ✓
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleSelectPrivacyPref('biometric')}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${privacyPref === 'biometric'
                        ? 'bg-emerald-50 border-emerald-500 font-black text-emerald-950 ring-1 ring-emerald-500'
                        : 'bg-[#FAF8F5] border-[#E8DFCE] text-slate-700 hover:border-slate-300'
                        }`}
                    >
                      <Fingerprint className="w-4 h-4 text-emerald-700 shrink-0" />
                      <div>
                        <span className="block text-xs">Fingerprint Sensor</span>
                        <span className="block text-[10px] text-slate-500 font-medium">Recommended Default</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectPrivacyPref('password')}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${privacyPref === 'password'
                        ? 'bg-amber-50 border-amber-500 font-black text-amber-950 ring-1 ring-amber-500'
                        : 'bg-[#FAF8F5] border-[#E8DFCE] text-slate-700 hover:border-slate-300'
                        }`}
                    >
                      <KeyRound className="w-4 h-4 text-amber-700 shrink-0" />
                      <div>
                        <span className="block text-xs">Password Input</span>
                        <span className="block text-[10px] text-slate-500 font-medium">Type Password</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Password Management Panel */}
              <form
                onSubmit={handlePasswordSubmit}
                className="p-5 sm:p-6 rounded-3xl bg-white border border-[#E8DFCE] space-y-4 shadow-xs"
              >
                <div className="pb-3 border-b border-[#F0EBE1] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                      <KeyRound className="w-5 h-5 text-amber-700" />
                      <span>Account Password &amp; Credentials</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Set or update your password to sign in via email or unlock the privacy shield
                    </p>
                  </div>
                  <span
                    className={`whitespace-nowrap shrink-0 self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-black ${isPasswordConfigured
                      ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                      : 'bg-amber-100 text-amber-950 border border-amber-300'
                      }`}
                  >
                    {isPasswordConfigured ? 'Configured & Active ✓' : 'Not Configured Yet'}
                  </span>
                </div>

                {pwdBanner && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 font-bold">
                    {pwdBanner}
                  </div>
                )}
                {pwdError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-950 font-bold">
                    {pwdError}
                  </div>
                )}

                <div className="space-y-3">
                  {isPasswordConfigured && (
                    <div>
                      <label className="block text-xs font-black text-slate-950 mb-1">
                        Current Password <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          placeholder="Enter your current password"
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                          className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl pl-3.5 pr-11 py-2.5 text-xs text-slate-950 font-bold focus:outline-none focus:border-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-2 p-1.5 rounded-lg text-amber-800 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-black text-slate-950 mb-1">
                        {isPasswordConfigured ? 'New Password' : 'New Password (min 8 chars)'} <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          placeholder="Enter new password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl pl-3.5 pr-11 py-2.5 text-xs text-slate-950 font-bold focus:outline-none focus:border-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-2 p-1.5 rounded-lg text-amber-800 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-950 mb-1">
                        {isPasswordConfigured ? 'Confirm New Password' : 'Confirm Password'} <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          placeholder="Re-enter password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full bg-[#FAF8F5] border border-[#E0D7C6] rounded-xl pl-3.5 pr-11 py-2.5 text-xs text-slate-950 font-bold focus:outline-none focus:border-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-2 p-1.5 rounded-lg text-amber-800 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-950 font-black text-xs transition-colors cursor-pointer shadow-2xs"
                  >
                    {showPassword ? (
                      <>
                        <EyeOff className="w-4 h-4 text-amber-800 shrink-0" />
                        <span>Hide Passwords</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4 text-amber-800 shrink-0" />
                        <span>Show Passwords</span>
                      </>
                    )}
                  </button>

                  <button
                    type="submit"
                    disabled={pwdLoading}
                    className="py-2.5 px-5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-black text-xs cursor-pointer shadow-xs transition-colors"
                  >
                    {pwdLoading ? 'Saving Password...' : isPasswordConfigured ? 'Update Password' : 'Save & Link Password'}
                  </button>
                </div>
              </form>

              {/* Multi-Device Session Security & Global Sign Out */}
              <div className="p-5 sm:p-6 rounded-3xl bg-white border border-[#E8DFCE] space-y-4 shadow-xs">
                <div className="pb-3 border-b border-[#F0EBE1] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-rose-600" />
                      <span>Device Sessions &amp; Global Access Control</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Enforce fresh sign-in across all smartphones, tablets, and computers connected to your account
                    </p>
                  </div>
                  <span className="whitespace-nowrap shrink-0 self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-100 text-slate-800 border border-slate-300">
                    Session Epoch: v{activeMember.sessionVersion || 1}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950 space-y-2">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold">
                        Multi-Device Invalidation Protection:
                      </p>
                      <p className="text-slate-700 leading-relaxed">
                        Whenever you change your password on this or any device, all other active devices are automatically invalidated and blocked from continuing until they authenticate afresh with your new password.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE]">
                    <span className="text-slate-600 font-bold">Last Password Change:</span>
                    <span className="font-black text-slate-900">
                      {activeMember.passwordChangedAt
                        ? new Date(activeMember.passwordChangedAt).toLocaleString()
                        : 'No recent change'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF8F5] border border-[#E8DFCE]">
                    <span className="text-slate-600 font-bold">Last Global Session Revocation:</span>
                    <span className="font-black text-slate-900">
                      {activeMember.sessionsRevokedAt
                        ? new Date(activeMember.sessionsRevokedAt).toLocaleString()
                        : 'Never revoked'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <p className="text-[11px] text-slate-500 font-medium">
                    Lost a phone or suspect someone else is signed in? Terminate all sessions now.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowRevokeModal(true)}
                    className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors shrink-0"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>Sign Out All Devices</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 4. APPEARANCE & TYPOGRAPHY VIEW */}
          {activeCategory === 'APPEARANCE' && (
            <div className="p-5 sm:p-6 rounded-3xl bg-white border border-[#E8DFCE] space-y-4 shadow-xs">
              <div className="pb-3 border-b border-[#F0EBE1]">
                <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                  <Palette className="w-5 h-5 text-teal-700" />
                  <span>Typography &amp; Android Display Appearance</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Optimize font rendering and terrain background contrast for your mobile device
                </p>
              </div>

              {/* Font Style Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-950">
                  Select Mobile Typography Font:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {FONT_OPTIONS.map((font) => (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => onSelectFont(font.id)}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${activeFontId === font.id
                        ? 'bg-teal-50 border-teal-500 font-black text-slate-950 ring-2 ring-teal-500/20 shadow-xs'
                        : 'bg-[#FAF8F5] border-[#E8DFCE] hover:border-slate-300'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-950">{font.name}</span>
                        {activeFontId === font.id && (
                          <Check className="w-4 h-4 text-teal-700 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium mt-1">
                        {font.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Background Terrain Contrast */}
              <div className="pt-3 border-t border-[#F0EBE1] space-y-2">
                <label className="block text-xs font-black text-slate-950">
                  Farm Terrain Background Intensity:
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {(['subtle', 'standard', 'expressive'] as const).map((intensity) => (
                    <button
                      key={intensity}
                      type="button"
                      onClick={() => onSelectBackgroundIntensity(intensity)}
                      className={`p-3 rounded-2xl border text-center capitalize text-xs transition-all cursor-pointer ${backgroundIntensity === intensity
                        ? 'bg-emerald-100 border-emerald-500 font-black text-emerald-950 ring-1 ring-emerald-500'
                        : 'bg-[#FAF8F5] border-[#E8DFCE] font-bold text-slate-700 hover:border-slate-300'
                        }`}
                    >
                      {intensity === 'subtle' ? 'Subtle (OLED)' : intensity}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  &quot;Subtle&quot; maximizes battery life and text readability in bright sunlight.
                </p>
              </div>
            </div>
          )}

          {/* 5. NOTIFICATIONS & CLOUD SYNC VIEW */}
          {activeCategory === 'NOTIFICATIONS' && (
            <div className="p-5 sm:p-6 rounded-3xl bg-white border border-[#E8DFCE] space-y-4 shadow-xs">
              <div className="pb-3 border-b border-[#F0EBE1]">
                <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                  <BellRing className="w-5 h-5 text-sky-700" />
                  <span>Mobile Notifications &amp; Sync</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Configure hardware push vibration and sync real-time ledger telemetry
                </p>
              </div>

              {notifStatusMsg && (
                <div className="p-3 rounded-xl bg-sky-50 border border-sky-300 text-xs text-sky-950 font-bold">
                  {notifStatusMsg}
                </div>
              )}

              {/* Haptic Vibration Toggle */}
              <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-black text-slate-950 block">Haptic Touch &amp; Navigation Vibration</span>
                  <span className="text-[11px] text-slate-600 font-medium">
                    {vibrationOn ? 'Vibration feedback is currently enabled' : 'Vibration is muted on button taps and tabs'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !vibrationOn;
                    setVibrationEnabled(nextVal);
                    setVibrationOn(nextVal);
                    if (nextVal && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                      try {
                        navigator.vibrate([40]);
                      } catch { }
                    }
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition-colors cursor-pointer shadow-xs ${vibrationOn
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                    }`}
                >
                  {vibrationOn ? 'Vibration: ON' : 'Vibration: OFF'}
                </button>
              </div>

              {/* Celebration FX & Haptics Mode */}
              <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-black text-slate-950 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Milestone Celebration FX &amp; Particles</span>
                  </span>
                  <span className="text-[11px] text-slate-600 font-medium">
                    Animated coin flow particles and vibration upon recording pay-ins or reaching funding milestones.
                  </span>
                </div>
                <select
                  value={celebrationModeState}
                  onChange={(e) => {
                    const mode = e.target.value as CelebrationMode;
                    setCelebrationMode(mode);
                    setCelebrationModeState(mode);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white cursor-pointer"
                >
                  <option value="FULL">Full Celebrations (Particles + Haptics)</option>
                  <option value="REDUCED">Reduced Motion (Fewer Particles)</option>
                  <option value="OFF">Turn Off FX (Static Numbers)</option>
                </select>
              </div>

              <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-black text-slate-950 block">Device Notification Alerts</span>
                  <span className="text-[11px] text-slate-600 font-medium">
                    Status: {notifPerm === 'granted' ? 'Allowed on this device' : 'Permission needed'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const granted = await requestSystemNotificationPermission();
                    setNotifPerm(granted ? 'granted' : 'denied');
                    if (granted) {
                      await dispatchSystemNotification({
                        title: 'CapitaSeed Test Notification',
                        body: 'Push alerts and vibration are fully active!',
                      });
                      setNotifStatusMsg('Notification sent successfully!');
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-xs cursor-pointer shadow-xs"
                >
                  Request / Test Alert
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-black text-slate-950 block">Cloud Server Sync</span>
                  <span className="text-[11px] text-slate-600 font-medium">
                    {settingsSyncMsg || 'Synchronizes cloud ledger blocks and clears local cache'}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={isSyncingSettings}
                  onClick={async () => {
                    setIsSyncingSettings(true);
                    try {
                      await dataService.syncWithCloudServer();
                      setSettingsSyncMsg('Cloud synchronization completed successfully.');
                    } catch {
                      setSettingsSyncMsg('Sync completed from local offline storage.');
                    } finally {
                      setIsSyncingSettings(false);
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-900 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSettings ? 'animate-spin' : ''}`} />
                  <span>Sync Cloud</span>
                </button>
              </div>

              {onCheckUpdates && (
                <div className="pt-2 flex justify-start">
                  <button
                    type="button"
                    onClick={onCheckUpdates}
                    className="text-xs text-emerald-800 font-bold hover:underline flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Check for Application Updates</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 6. ABOUT CAPITASEED & DEVELOPER INFO VIEW */}
          {activeCategory === 'ABOUT' && (
            <div className="p-5 sm:p-6 rounded-3xl bg-white border border-[#E8DFCE] space-y-4 shadow-xs">
              <div className="pb-3 border-b border-[#F0EBE1]">
                <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                  <Info className="w-5 h-5 text-purple-700" />
                  <span>About Capital Seed Platform</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Universal operations &amp; shared pooled capital platform (Agro &amp; General Ventures)
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8DFCE] space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-600">Application Version</span>
                  <span className="font-mono font-black text-slate-950">v1.0.5</span>
                </div>
              </div>

              {onPreviewSplash && (
                <button
                  type="button"
                  onClick={onPreviewSplash}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs border border-slate-300 transition-colors cursor-pointer"
                >
                  Preview Launch Splash Screen
                </button>
              )}

              {/* Developer Contact Card */}
              <div className="pt-2 border-t border-[#F0EBE1] space-y-2">
                <span className="text-xs font-black text-slate-950 block">Lead Architect &amp; Support:</span>
                <p className="text-xs font-bold text-slate-800">{DEVELOPER_INFO.linkedInName} · {DEVELOPER_INFO.company}</p>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <a
                    href={`mailto:${DEVELOPER_INFO.email}`}
                    className="inline-flex items-center gap-1.5 text-xs text-emerald-800 font-bold hover:underline"
                  >
                    <ModernEmailIcon className="w-4 h-4" />
                    <span>{DEVELOPER_INFO.email}</span>
                  </a>
                  <a
                    href={`https://wa.me/${DEVELOPER_INFO.whatsappIntl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-emerald-800 font-bold hover:underline"
                  >
                    <ModernWhatsAppIcon className="w-4 h-4" />
                    <span>WhatsApp Support</span>
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-rose-300 space-y-4 text-slate-900">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-300 text-rose-700 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-950">Delete Account Completely?</h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                This action is <strong>permanent and irreversible</strong>. Your user account ({activeMember.email || activeMember.phoneOrEmail}), credentials, and member documents will be deleted completely from Cloud Firestore and Firebase Authentication.
              </p>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-900 font-semibold">
                {deleteError}
              </div>
            )}

            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-medium">
              ⚠️ If you wish to rejoin this or any other organization later, you will need to register a new account or be re-invited.
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingAccount}
                onClick={() => setShowDeleteAccountModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingAccount}
                onClick={handleConfirmDeleteAccount}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                {isDeletingAccount ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Yes, Delete Completely</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Sign Out All Devices */}
      {showRevokeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700 mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-950">
                Sign Out All Devices &amp; Sessions?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                This will immediately invalidate and terminate active sessions across every phone, tablet, and computer signed into <span className="font-bold text-slate-900">{activeMember.email || activeMember.phoneOrEmail}</span>.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>All devices will start afresh signing in</span>
              </p>
              <p className="text-[11px] text-slate-600">
                This includes this current device. You and any other active sessions will be returned to the sign-in screen and will need to authenticate afresh with your credentials.
              </p>
            </div>

            {revokeError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-950 font-bold">
                {revokeError}
              </div>
            )}

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                disabled={revokeLoading}
                onClick={() => {
                  setShowRevokeModal(false);
                  setRevokeError('');
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={revokeLoading}
                onClick={handleRevokeAllSessions}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                {revokeLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing Out...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4" />
                    <span>Yes, Sign Out All</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Role & Clearance Management Sheet */}
      {roleModalMember && (
        <MemberRoleSheet
          isOpen={Boolean(roleModalMember)}
          onClose={() => setRoleModalMember(null)}
          member={roleModalMember}
          activeMember={activeMember}
        />
      )}
    </div>
  );
};
