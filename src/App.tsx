import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import type {
  AgroStateSnapshot,
  AuditNotificationEvent,
  ExpenseCategory,
  FeedLedgerEvent,
  FixedAssetCategory,
  FixedAssetLedgerEvent,
  Role,
  OrgMember,
} from './types/agro.ts';
import {
  dataService,
  type AuthenticatedSession,
} from './services/dataService.ts';
import {
  computeFeedInventories,
  computeFinancialSummary,
  computeFixedAssetGroups,
  computeLivestockStatus,
  computeMemberEquities,
  computeSiteComparisons,
} from './utils/calculations.ts';
import type { RunwayAllocation } from './types/runway.ts';
import { NotificationDrawer } from './components/NotificationDrawer.tsx';
import { NotificationDetailModal } from './components/NotificationDetailModal.tsx';
import { ShieldAlert, LogOut } from 'lucide-react';
import { AuthGatePage } from './components/AuthGatePage.tsx';
import { OrgOnboardingModal } from './components/OrgOnboardingModal.tsx';
import { SiteManagerModal } from './components/SiteManagerModal.tsx';
import { FirstLoginBiometricPrompt } from './components/FirstLoginBiometricPrompt.tsx';
import { FarmTerrainBackground } from './components/FarmTerrainBackground.tsx';
import { nativeKeyboard } from './native/keyboard.ts';
import { nativeStatusBar } from './native/statusBar.ts';
import { nativeBiometrics } from './native/biometrics.ts';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { useBackHandler } from './navigation/useBackHandler.ts';
import { ThemeSettingsModal } from './components/ThemeSettingsModal.tsx';
import { PrivacyUnlockModal } from './components/PrivacyUnlockModal.tsx';
import { setPrivacyMask } from './utils/currency.ts';
import {
  authenticateOrEnrollBiometric,
  getEnrolledBiometricRecord,
  getPrivacyUnlockPreference,
  initializeNotificationChannels,
  initPushNotifications,
  isBiometricHardwareSupported,
  triggerHapticFeedback,
} from './utils/mobileHardware.ts';
import {
  checkForAppUpdates,
  markReleaseNotesSeenForVersion,
  type AppVersionConfig,
} from './services/appUpdateService.ts';
import { ForceUpdateModal } from './components/ForceUpdateModal.tsx';
import { PERMISSIONS } from './utils/permissions.ts';
import {
  filterVisibleOrgMembers,
  isValidRealEmail,
  matchesMemberRecord,
} from './utils/memberIdentity.ts';
import { FONT_OPTIONS, type FontStyleId } from './types/theme.ts';
import { SplashScreen } from './components/SplashScreen.tsx';
import { NavigationProvider } from './navigation/NavigationProvider.tsx';
import { AppBar } from './navigation/AppBar.tsx';
import { BottomNav } from './navigation/BottomNav.tsx';
import { RouteRenderer } from './navigation/RouteRenderer.tsx';
import { ToastProvider } from './components/ui/Toast.tsx';
import { LogExpenseSheet } from './sheets/expenses/LogExpenseSheet.tsx';
import { RecordCreditSaleSheet } from './sheets/credit/RecordCreditSaleSheet.tsx';
import { NewDebtSheet } from './sheets/loans/NewDebtSheet.tsx';
import { BroadcastSheet } from './sheets/common/BroadcastSheet.tsx';

export default function App() {
  const [state, setState] = useState<AgroStateSnapshot>(() => dataService.getState());
  const [activeSession, setActiveSession] = useState<AuthenticatedSession | null>(() =>
    dataService.getActiveSession()
  );
  const [selectedLocationId, setSelectedLocationId] = useState<string>('ALL');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeNotificationDetail, setActiveNotificationDetail] = useState<AuditNotificationEvent | null>(null);
  const [mobileFrameMode, setMobileFrameMode] = useState(false);
  const [cloudUserEmail, setCloudUserEmail] = useState<string | null>(null);
  const [showThemeModal, setShowThemeModal] = useState(false);

  // Deep-linking target section inside Settings tab (e.g. 'biometrics', 'password', 'profile')
  const [settingsTargetSection, setSettingsTargetSection] = useState<string | null>(null);

  // STRICT SECURITY RULE:
  // When opened via local authentication (biometric, local session restore, PIN, etc.),
  // numbers MUST be hidden automatically. ONLY full cloud Google login or Email/Password login
  // reveals numbers automatically on entry.
  const [showNumbers, setShowNumbers] = useState<boolean>(() => {
    const session = dataService.getActiveSession();
    const isCloudFresh = Boolean(
      session?.freshlyAuthenticated &&
      (session.authLoginType === 'cloud_google' || session.authLoginType === 'cloud_password')
    );
    setPrivacyMask(!isCloudFresh);
    return isCloudFresh;
  });
  const [showPrivacyModal, setShowPrivacyModal] = useState<boolean>(false);
  const [privacyModalError, setPrivacyModalError] = useState<string | null>(null);
  const [privacyModalMode, setPrivacyModalMode] = useState<'password' | 'setup'>('password');
  const [isAuthenticatingPrivacy, setIsAuthenticatingPrivacy] = useState(false);

  // Quick Action Bottom Sheets State
  const [showLogExpenseSheet, setShowLogExpenseSheet] = useState(false);
  const [showRecordSaleSheet, setShowRecordSaleSheet] = useState(false);
  const [showNewDebtSheet, setShowNewDebtSheet] = useState(false);
  const [showBroadcastSheet, setShowBroadcastSheet] = useState(false);

  // Native Android & Flutter Typography State (persisted to localStorage)
  const [activeFontId, setActiveFontId] = useState<FontStyleId>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('agro_active_font');
      if (saved && FONT_OPTIONS.some((f) => f.id === saved)) {
        return saved as FontStyleId;
      }
    }
    return 'android-native';
  });

  // Custom Background Intensity State
  const [bgIntensity, setBgIntensity] = useState<'subtle' | 'standard' | 'expressive'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('agro_bg_intensity');
      if (saved === 'subtle' || saved === 'standard' || saved === 'expressive') {
        return saved;
      }
    }
    return 'standard';
  });

  // In-App Splash Screen State
  const [showSplash, setShowSplash] = useState(true);
  const [previewSplash, setPreviewSplash] = useState(false);

  // Remote App Version Control & Force Update Gate State
  const [updateConfig, setUpdateConfig] = useState<AppVersionConfig | null>(null);
  const [isForcedUpdate, setIsForcedUpdate] = useState(false);
  const [isBelowMinVersion, setIsBelowMinVersion] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const runOnlineVersionCheck = async (showEvenIfCurrent = false) => {
    const res = await checkForAppUpdates();
    if (res.config) {
      setUpdateConfig(res.config);
      setIsForcedUpdate(res.isForced);
      setIsBelowMinVersion(res.isBelowMin);
      if (res.isForced || res.hasUpdate || res.isNewReleaseAnnouncement || showEvenIfCurrent) {
        setShowUpdateModal(true);
      }
    }
  };

  const handleSelectFont = (fontId: FontStyleId) => {
    setActiveFontId(fontId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('agro_active_font', fontId);
    }
  };

  const handleSelectBgIntensity = (intensity: 'subtle' | 'standard' | 'expressive') => {
    setBgIntensity(intensity);
    if (typeof window !== 'undefined') {
      localStorage.setItem('agro_bg_intensity', intensity);
    }
  };

  // Sync active font class directly to document.body
  useEffect(() => {
    const fontOpt = FONT_OPTIONS.find((f) => f.id === activeFontId);
    if (fontOpt && typeof document !== 'undefined') {
      document.body.className = `${fontOpt.cssClass} bg-[#FAF7F2] text-slate-900`;
    }
  }, [activeFontId]);

  useEffect(() => {
    // Lock portrait orientation on mobile phones (< 600px) per Android plan
    if (typeof window !== 'undefined' && window.innerWidth < 600) {
      void ScreenOrientation.lock({ orientation: 'portrait' }).catch(() => { });
    }

    // Initialize Android Notification Channels, Push Notifications, and tap handler
    void nativeStatusBar.setLightStyle();
    void initializeNotificationChannels();
    void initPushNotifications((event) => {
      if (event?.actionId === 'mark_read' && event.notificationId) {
        const mem = dataService.getState().members.find((m) => m.id === activeMember?.id) || activeMember;
        if (mem?.id) {
          dataService.markNotificationRead(event.notificationId, mem.id);
        }
        return;
      }
      if (event?.notificationId) {
        const found = (dataService.getState().auditNotifications || []).find((n) => n.id === event.notificationId);
        if (found) {
          setActiveNotificationDetail(found);
          return;
        }
      }
      setDrawerOpen(true);
    });

    // Fetch version.json from the GitHub repository online on every application startup
    void runOnlineVersionCheck(false);

    // Track 5-minute background inactivity for biometric auto-lock
    let backgroundTimestamp = 0;
    const appStateListenerPromise = CapacitorApp.addListener('appStateChange', async (appState) => {
      if (!appState.isActive) {
        backgroundTimestamp = Date.now();
      } else {
        const elapsed = Date.now() - backgroundTimestamp;
        if (backgroundTimestamp > 0 && elapsed >= 5 * 60 * 1000) {
          setShowNumbers(false);
          const currentSession = dataService.getActiveSession();
          if (currentSession) {
            const hasBio = await nativeBiometrics.isAvailable();
            if (hasBio) {
              const success = await nativeBiometrics.authenticate('Capital Seed Inactivity Challenge: Confirm Identity');
              if (success) {
                setShowNumbers(true);
              } else {
                setShowPrivacyModal(true);
              }
            } else {
              setShowPrivacyModal(true);
            }
          }
        }
        backgroundTimestamp = 0;
      }
    });

    // Also re-verify version.json whenever the application returns to the foreground
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void runOnlineVersionCheck(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const unsubState = dataService.subscribe((next) => {
      setState(next);
    });
    const unsubAuth = dataService.subscribeAuth((user) => {
      setCloudUserEmail(user?.email || null);
    });
    const unsubSession = dataService.subscribeSession((session) => {
      setActiveSession(session);
      if (session) {
        // STRICT RULE: Only show numbers if actively logged in via Google or Email/Password.
        // If opened using local authentication (biometrics, restored local session, etc.), numbers MUST be hidden automatically.
        const isCloudFresh = Boolean(
          session.freshlyAuthenticated &&
          (session.authLoginType === 'cloud_google' || session.authLoginType === 'cloud_password')
        );
        setShowNumbers(isCloudFresh);
        setPrivacyMask(!isCloudFresh);
      } else {
        setShowNumbers(false);
        setPrivacyMask(true);
        setSelectedLocationId('ALL');
        setDrawerOpen(false);
        setShowPrivacyModal(false);
        setPrivacyModalError(null);
      }
    });
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      void appStateListenerPromise.then((handle) => handle.remove()).catch(() => { });
      unsubState();
      unsubAuth();
      unsubSession();
    };
  }, []);

  // Enforce session validity across multi-device password changes and session revocations
  useEffect(() => {
    if (activeSession) {
      dataService.checkAndEnforceActiveSessionValidity();
    }
  }, [activeSession, state.members]);

  // Resolve the authenticated user's OrgMember profile strictly from activeSession
  const activeMember: OrgMember | null = useMemo(() => {
    if (!activeSession) return null;
    const normEmail = isValidRealEmail(activeSession.email)
      ? activeSession.email.trim().toLowerCase()
      : '';

    const matches = state.members.filter(
      (m) =>
        m.accountStatus !== 'CLAIMED' &&
        (m.id === activeSession.uid ||
          m.uid === activeSession.uid ||
          (normEmail &&
            ((isValidRealEmail(m.email) && m.email!.trim().toLowerCase() === normEmail) ||
              (isValidRealEmail(m.phoneOrEmail) && m.phoneOrEmail!.trim().toLowerCase() === normEmail))))
    );

    const found =
      matches.find((m) => Boolean(m.orgId) && (m.approvalStatus === 'APPROVED' || m.active)) ||
      matches.find((m) => Boolean(m.orgId)) ||
      matches.find((m) => m.approvalStatus === 'APPROVED' || m.active) ||
      matches[0];

    const filterLegacyOrg = (orgId?: string | null) => {
      if (!orgId) return undefined;
      const clean = orgId.trim();
      if (!clean || clean === 'org-master' || clean === 'org-default') return undefined;
      return clean;
    };

    if (found) {
      const userOrgId = filterLegacyOrg(found.orgId) || filterLegacyOrg(activeSession.activeOrgId);
      return {
        ...found,
        orgId: userOrgId,
        approvalStatus: found.approvalStatus === 'SUSPENDED' ? 'SUSPENDED' : 'APPROVED',
        active: found.approvalStatus !== 'SUSPENDED',
      };
    }

    // Fallback transient profile while state syncs
    return {
      id: activeSession.uid,
      uid: activeSession.uid,
      email: normEmail,
      fullName: activeSession.displayName || normEmail.split('@')[0] || 'Member',
      phoneOrEmail: normEmail,
      role: 'MEMBER',
      approvalStatus: 'APPROVED',
      orgId: filterLegacyOrg(activeSession.activeOrgId),
      authProviders: activeSession.providers,
      hasPasswordSetup: activeSession.providers.includes('password'),
      joinedAt: new Date().toISOString(),
      active: true,
    };
  }, [activeSession, state.members]);

  // Resolve Active Organization
  const activeOrg = useMemo(() => {
    if (!activeMember?.orgId || activeMember.orgId === 'org-master') return null;
    return (
      (state.organizations || []).find((o) => o.id === activeMember.orgId) ||
      dataService.getActiveOrganization(activeMember.orgId)
    );
  }, [activeMember?.orgId, state.organizations]);

  const isAgroEnabled = useMemo(() => {
    if (!activeOrg) return true;
    return activeOrg.type === 'AGRO_FARMING' || Boolean(activeOrg.features?.livestockModule);
  }, [activeOrg]);

  // Site Manager Full CRUD Modal State
  const [showSiteManagerModal, setShowSiteManagerModal] = useState(false);

  // First-Login Biometric Fingerprint Enrollment Prompt State
  // STRICT RULE: Biometric enrollment is only prompted AFTER the user has completed organization onboarding.
  const [showFirstLoginBioPrompt, setShowFirstLoginBioPrompt] = useState(false);
  useEffect(() => {
    if (!activeMember || !activeMember.orgId || activeMember.orgId === 'org-master') {
      setShowFirstLoginBioPrompt(false);
      return;
    }
    const promptKey = `first_login_bio_prompt_seen_${activeMember.id}`;
    if (typeof window !== 'undefined' && !localStorage.getItem(promptKey)) {
      void isBiometricHardwareSupported().then((supported) => {
        const alreadyEnrolled = Boolean(getEnrolledBiometricRecord());
        if (supported && !alreadyEnrolled) {
          setShowFirstLoginBioPrompt(true);
        }
      });
    }
  }, [activeMember?.id, activeMember?.orgId]);



  useEffect(() => {
    if (activeOrg?.id) {
      dataService.checkRunwayReminders();
      if (activeMember) {
        void dataService.checkDueProtocolReminders(activeMember);
      }
    }
  }, [activeOrg?.id, activeMember?.id]);

  useEffect(() => {
    nativeKeyboard.init();
    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    if (isDark) {
      void nativeStatusBar.setDarkStyle();
    } else {
      void nativeStatusBar.setLightStyle();
    }
  }, []);

  // Priority 50: App-level modals and drawer
  useBackHandler(
    50,
    () => {
      if (showThemeModal) {
        setShowThemeModal(false);
        return true;
      }
      if (showPrivacyModal) {
        setShowPrivacyModal(false);
        return true;
      }
      if (showUpdateModal && !isForcedUpdate) {
        setShowUpdateModal(false);
        return true;
      }
      if (activeNotificationDetail) {
        setActiveNotificationDetail(null);
        return true;
      }
      if (drawerOpen) {
        setDrawerOpen(false);
        return true;
      }
      if (settingsTargetSection) {
        setSettingsTargetSection(null);
        return true;
      }
      return false;
    },
    [showThemeModal, showPrivacyModal, showUpdateModal, isForcedUpdate, activeNotificationDetail, drawerOpen, settingsTargetSection]
  );

  const handleToggleShowNumbers = async () => {
    if (showNumbers) {
      // Direct hide without authentication
      setShowNumbers(false);
      setPrivacyMask(true);
      return;
    }

    if (!activeMember) return;

    // Check credentials and preferences
    const hasPassword = Boolean(activeMember.hasPasswordSetup && activeMember.passwordVerifierHash);
    const hasBiometric = Boolean(getEnrolledBiometricRecord());
    const pref = getPrivacyUnlockPreference();

    // If user has not configured either security method yet
    if (!hasPassword && !hasBiometric) {
      setPrivacyModalMode('setup');
      setPrivacyModalError(null);
      setShowPrivacyModal(true);
      return;
    }

    // Check hardware support
    const isBioSupported = await isBiometricHardwareSupported();

    // Determine whether to launch biometric sensor directly
    const shouldPromptBiometric =
      (pref === 'biometric' || (pref === 'auto' && isBioSupported)) &&
      (hasBiometric || isBioSupported);

    if (shouldPromptBiometric) {
      setIsAuthenticatingPrivacy(true);
      try {
        await authenticateOrEnrollBiometric({
          memberId: activeMember.id,
          email: activeMember.email || activeMember.phoneOrEmail,
          fullName: activeMember.fullName,
        });
        // Biometric verification succeeded!
        setShowNumbers(true);
        setPrivacyMask(false);
        setIsAuthenticatingPrivacy(false);
        return;
      } catch (err: unknown) {
        setIsAuthenticatingPrivacy(false);
        const msg = err instanceof Error ? err.message : String(err);
        const isCancelled = /cancel|dismiss/i.test(msg);

        // If biometric was cancelled or failed, immediately open password input!
        if (hasPassword) {
          setPrivacyModalMode('password');
          setPrivacyModalError(isCancelled ? null : msg || 'Biometric verification did not succeed.');
          setShowPrivacyModal(true);
          return;
        } else {
          // No password set yet, prompt to create password
          setPrivacyModalMode('setup');
          setPrivacyModalError(msg);
          setShowPrivacyModal(true);
          return;
        }
      }
    }

    // If default is password, or phone does not support biometric:
    // Immediately open password input directly!
    setPrivacyModalMode('password');
    setPrivacyModalError(null);
    setShowPrivacyModal(true);
  };

  const currentOrgId = activeMember?.orgId;

  // Strict Tenant-Scoped Collections (Zero Cross-Tenant Money Leaks)
  const orgCapitalContributions = useMemo(() => {
    if (!currentOrgId) return [];
    return state.capitalContributions.filter((c) => c.orgId === currentOrgId);
  }, [state.capitalContributions, currentOrgId]);

  const orgExpenses = useMemo(() => {
    if (!currentOrgId) return [];
    return state.expenses.filter((e) => e.orgId === currentOrgId);
  }, [state.expenses, currentOrgId]);

  const orgFixedAssets = useMemo(() => {
    if (!currentOrgId) return [];
    return state.fixedAssets.filter((a) => a.orgId === currentOrgId);
  }, [state.fixedAssets, currentOrgId]);

  const orgLocations = useMemo(() => {
    if (!currentOrgId) return [];
    return state.locations.filter((l) => l.orgId === currentOrgId);
  }, [state.locations, currentOrgId]);

  const orgLivestockEntries = useMemo(() => {
    if (!currentOrgId) return [];
    return state.livestockEntries.filter((l) => l.orgId === currentOrgId);
  }, [state.livestockEntries, currentOrgId]);

  const orgLivestockEvents = useMemo(() => {
    if (!currentOrgId) return [];
    return state.livestockEvents.filter((e) => e.orgId === currentOrgId);
  }, [state.livestockEvents, currentOrgId]);

  const orgFeedLedger = useMemo(() => {
    if (!currentOrgId) return [];
    return state.feedLedger.filter((f) => f.orgId === currentOrgId);
  }, [state.feedLedger, currentOrgId]);

  const orgMembers = useMemo(() => {
    if (!currentOrgId) return [];
    return filterVisibleOrgMembers(state.members, currentOrgId);
  }, [state.members, currentOrgId]);

  const orgDebtLiabilities = useMemo(() => {
    if (!currentOrgId) return [];
    return (state.debtLiabilities || []).filter((d) => d.orgId === currentOrgId);
  }, [state.debtLiabilities, currentOrgId]);

  const orgLoansGiven = useMemo(() => {
    if (!currentOrgId) return [];
    return (state.loansGiven || []).filter((l) => l.orgId === currentOrgId);
  }, [state.loansGiven, currentOrgId]);

  const orgCreditSales = useMemo(() => {
    if (!currentOrgId) return [];
    return (state.creditSales || []).filter((s) => s.orgId === currentOrgId);
  }, [state.creditSales, currentOrgId]);

  const selectedLocationName = useMemo(() => {
    if (selectedLocationId === 'ALL') return 'All Locations (Organization-Wide)';
    return (
      orgLocations.find((l) => l.id === selectedLocationId)?.name || 'Selected Site'
    );
  }, [orgLocations, selectedLocationId]);

  // All Livestock Computed Statuses
  const allLivestockStatuses = useMemo(() => {
    return orgLivestockEntries.map((entry) =>
      computeLivestockStatus(entry, orgLivestockEvents, orgFeedLedger)
    );
  }, [orgLivestockEntries, orgLivestockEvents, orgFeedLedger]);

  // Filtered by selectedLocationId
  const visibleLivestockStatuses = useMemo(() => {
    if (selectedLocationId === 'ALL') return allLivestockStatuses;
    return allLivestockStatuses.filter(
      (s) => s.entry.locationId === selectedLocationId
    );
  }, [allLivestockStatuses, selectedLocationId]);

  const visibleExpenses = useMemo(() => {
    if (!isAgroEnabled || selectedLocationId === 'ALL') return orgExpenses;
    return orgExpenses.filter((e) => e.locationId === selectedLocationId);
  }, [orgExpenses, selectedLocationId, isAgroEnabled]);

  const financials = useMemo(() => {
    return computeFinancialSummary({
      capitalContributions: orgCapitalContributions,
      expenses: orgExpenses,
      fixedAssets: orgFixedAssets,
      livestockStatuses: allLivestockStatuses,
      livestockEvents: orgLivestockEvents,
      debtLiabilities: orgDebtLiabilities,
      loansGiven: orgLoansGiven,
      creditSales: orgCreditSales,
      filterLocationId: isAgroEnabled ? selectedLocationId : 'ALL',
    });
  }, [
    orgCapitalContributions,
    orgExpenses,
    orgFixedAssets,
    allLivestockStatuses,
    orgLivestockEvents,
    orgDebtLiabilities,
    orgLoansGiven,
    orgCreditSales,
    selectedLocationId,
    isAgroEnabled,
  ]);

  const memberEquities = useMemo(() => {
    // Unify member targets from active runway plan pledges
    const activePlan = (state.runwayPlans || []).find(
      (p) =>
        (!currentOrgId || p.orgId === currentOrgId) &&
        (p.status === 'ACTIVE' || p.status === 'PLEDGING' || p.status === 'DRAFT')
    );
    const unifiedMembers = activePlan
      ? orgMembers.map((m) => {
        const pledge = (state.runwayPledges || []).find(
          (p) =>
            p.planId === activePlan.id &&
            p.status !== 'MERGED' &&
            p.status !== 'WITHDRAWN' &&
            matchesMemberRecord(p.memberId, m)
        );
        if (pledge && pledge.amount > 0) {
          return {
            ...m,
            targetContributionUsd: pledge.amount,
            contributionPace: (pledge.pace === 'ONE_OFF' ? 'MILESTONE' : pledge.pace) || m.contributionPace,
          };
        }
        return m;
      })
      : orgMembers;

    return computeMemberEquities(
      unifiedMembers,
      orgCapitalContributions,
      financials.totalNav
    );
  }, [orgMembers, orgCapitalContributions, financials.totalNav, state.runwayPlans, state.runwayPledges, currentOrgId]);

  const fixedAssetGroups = useMemo(() => {
    return computeFixedAssetGroups(
      orgFixedAssets,
      orgLocations,
      selectedLocationId
    );
  }, [orgFixedAssets, orgLocations, selectedLocationId]);

  const feedSummaries = useMemo(() => {
    return computeFeedInventories(
      orgFeedLedger,
      orgLocations,
      selectedLocationId
    );
  }, [orgFeedLedger, orgLocations, selectedLocationId]);

  const siteComparisons = useMemo(() => {
    return computeSiteComparisons({
      locations: orgLocations,
      expenses: orgExpenses,
      fixedAssets: orgFixedAssets,
      livestockStatuses: allLivestockStatuses,
      livestockEvents: orgLivestockEvents,
    });
  }, [
    orgLocations,
    allLivestockStatuses,
    orgExpenses,
    orgFixedAssets,
    orgLivestockEvents,
  ]);

  const visibleNotifications = useMemo(() => {
    const orgId = activeMember?.orgId;
    if (!orgId) return [];
    const orgAudit = (state.auditNotifications || []).filter(
      (n) =>
        n.orgId === orgId &&
        (n.eventType as string) !== 'SECURITY_CREDENTIAL_LINKED' &&
        (n.eventType as string) !== 'MEMBER_PROFILE_UPDATED'
    );

    if (selectedLocationId === 'ALL') return orgAudit;
    return orgAudit.filter(
      (n: AuditNotificationEvent) => n.locationId === 'ALL' || n.locationId === selectedLocationId
    );
  }, [state.auditNotifications, selectedLocationId, activeMember?.orgId]);

  const latestBroadcast = useMemo(() => {
    return visibleNotifications.find(
      (n: AuditNotificationEvent) =>
        n.severity === 'URGENT_GROUND' ||
        n.severity === 'MILESTONE' ||
        n.severity === 'INFO'
    );
  }, [visibleNotifications]);

  const unreadCount = useMemo(() => {
    if (!activeMember) return 0;
    return visibleNotifications.filter(
      (n: AuditNotificationEvent) => !(n.readByMemberIds || []).includes(activeMember.id)
    ).length;
  }, [visibleNotifications, activeMember]);

  const activeFontCss =
    FONT_OPTIONS.find((f) => f.id === activeFontId)?.cssClass || 'font-style-android';

  const handleSignOut = async () => {
    setShowNumbers(false);
    setSelectedLocationId('ALL');
    setDrawerOpen(false);
    setShowPrivacyModal(false);
    setPrivacyModalError(null);
    try {
      await dataService.signOutCloud();
    } finally {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  };

  // GATE 1: Unauthenticated users must sign in or register
  if (!activeSession || !activeMember) {
    return (
      <NavigationProvider>
        <ToastProvider>
          {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
          {previewSplash && (
            <SplashScreen
              isManualPreview
              duration={5000}
              onFinish={() => setPreviewSplash(false)}
            />
          )}
          {showUpdateModal && updateConfig && (
            <ForceUpdateModal
              config={updateConfig}
              isForced={isForcedUpdate}
              isBelowMin={isBelowMinVersion}
              onClose={() => {
                if (!isForcedUpdate) {
                  setShowUpdateModal(false);
                  markReleaseNotesSeenForVersion(updateConfig.latestVersion);
                }
              }}
            />
          )}
          <div className={`min-h-screen relative flex flex-col ${activeFontCss}`}>
            <FarmTerrainBackground intensity={bgIntensity} />
            <AuthGatePage />
          </div>
        </ToastProvider>
      </NavigationProvider>
    );
  }

  // GATE 2: Organization Onboarding Check
  // STRICT RULE: If the authenticated user is not attached to any organization yet (or has legacy fallback), present the onboarding modal (Create Org or Join with 24-hr Code)
  if (!activeMember.orgId || activeMember.orgId === 'org-master' || activeMember.orgId === 'org-default') {
    return (
      <NavigationProvider>
        <ToastProvider>
          {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
          {previewSplash && (
            <SplashScreen
              isManualPreview
              duration={5000}
              onFinish={() => setPreviewSplash(false)}
            />
          )}
          <div className={`min-h-screen relative flex flex-col ${activeFontCss}`}>
            <FarmTerrainBackground intensity={bgIntensity} />
            <OrgOnboardingModal
              activeMember={activeMember}
              onOrganizationSelected={() => {
                // State updates automatically via reactive dataService subscription
              }}
              onSignOut={handleSignOut}
            />
          </div>
        </ToastProvider>
      </NavigationProvider>
    );
  }

  // GATE 3: Security Clearance Check (Only explicitly suspended members of an organization are blocked)
  if (activeMember.approvalStatus === 'SUSPENDED') {
    return (
      <NavigationProvider>
        <ToastProvider>
          {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
          {previewSplash && (
            <SplashScreen
              isManualPreview
              duration={5000}
              onFinish={() => setPreviewSplash(false)}
            />
          )}
          {showUpdateModal && updateConfig && (
            <ForceUpdateModal
              config={updateConfig}
              isForced={isForcedUpdate}
              isBelowMin={isBelowMinVersion}
              onClose={() => {
                if (!isForcedUpdate) {
                  setShowUpdateModal(false);
                  markReleaseNotesSeenForVersion(updateConfig.latestVersion);
                }
              }}
            />
          )}
          <div className={`min-h-screen relative flex items-center justify-center p-4 ${activeFontCss}`}>
            <FarmTerrainBackground intensity={bgIntensity} />
            <div className="w-full max-w-md bg-white border border-[#E8DFCE] rounded-3xl p-6 sm:p-7 shadow-2xl text-slate-950 space-y-4 relative z-10 text-center animate-fade-in">
              <div className="w-14 h-14 rounded-2xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700 mx-auto">
                <ShieldAlert className="w-8 h-8 text-rose-600" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-black text-slate-950">
                  Account Suspended
                </h2>
                <p className="text-xs text-slate-600 font-medium">
                  Your membership in <strong>{activeOrg?.name || 'the organization'}</strong> has been temporarily suspended by an administrator.
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-950 text-left font-medium leading-relaxed">
                Access to organization ledgers, operational sites, and assets is restricted while suspended. Please contact your organization administrator or founder to restore active status.
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-900 text-white text-xs font-black transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out of Account</span>
                </button>
              </div>
            </div>
          </div>
        </ToastProvider>
      </NavigationProvider>
    );
  }

  // GATE 4: Approved & Active Organization Member Workspace
  return (
    <NavigationProvider>
      <ToastProvider>
        {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
        {previewSplash && (
          <SplashScreen
            isManualPreview
            duration={5000}
            onFinish={() => setPreviewSplash(false)}
          />
        )}
        {showUpdateModal && updateConfig && (
          <ForceUpdateModal
            config={updateConfig}
            isForced={isForcedUpdate}
            isBelowMin={isBelowMinVersion}
            onClose={() => {
              if (!isForcedUpdate) {
                setShowUpdateModal(false);
                markReleaseNotesSeenForVersion(updateConfig.latestVersion);
              }
            }}
          />
        )}
        <div
          style={{
            height: 'var(--vvh, 100dvh)',
            maxHeight: 'var(--vvh, 100dvh)',
          }}
          className={`overflow-hidden relative flex flex-col ${activeFontCss} ${mobileFrameMode
            ? 'max-w-[430px] mx-auto border-x border-[#E8DFCE] shadow-2xl bg-[#FAF7F2]'
            : 'w-full'
            }`}
        >
          {/* Procedural Topographical Farm Terrain Background */}
          <FarmTerrainBackground intensity={bgIntensity} />

          {/* Android-Native AppBar with hardware back button & site selector */}
          <AppBar
            orgName={activeOrg?.name}
            locations={isAgroEnabled ? orgLocations : []}
            selectedLocationId={selectedLocationId}
            onSelectLocation={isAgroEnabled ? setSelectedLocationId : undefined}
            showNumbers={showNumbers}
            onToggleShowNumbers={handleToggleShowNumbers}
            unreadNotificationsCount={unreadCount}
            onOpenNotifications={() => setDrawerOpen(true)}
            onOpenSiteManager={isAgroEnabled ? () => setShowSiteManagerModal(true) : undefined}
          />

          {/* Main Viewport rendering Active Screen within Multi-Stack Navigation */}
          <main className="flex-1 min-h-0 w-full pb-24 overflow-y-auto overflow-x-hidden">
            <RouteRenderer
              state={state}
              activeMember={activeMember}
              locations={orgLocations}
              selectedLocationId={selectedLocationId}
              financials={financials}
              memberEquities={memberEquities}
              livestockStatuses={visibleLivestockStatuses}
              fixedAssetGroups={fixedAssetGroups}
              feedSummaries={feedSummaries}
              isAgroEnabled={isAgroEnabled}
              showNumbers={showNumbers}
              onToggleShowNumbers={handleToggleShowNumbers}
              cloudUserEmail={cloudUserEmail}
              onRefresh={async () => {
                await dataService.syncWithCloudServer();
              }}
              onSignOut={handleSignOut}
              onLogExpense={() => setShowLogExpenseSheet(true)}
              onRecordSale={() => setShowRecordSaleSheet(true)}
              onAddLoanDebt={() => setShowNewDebtSheet(true)}
              onBroadcast={() => setShowBroadcastSheet(true)}
              onOpenSiteManager={isAgroEnabled ? () => setShowSiteManagerModal(true) : undefined}
              onOpenNotifications={() => setDrawerOpen(true)}
              onSelectNotification={(item) => setActiveNotificationDetail(item)}
            />
          </main>

          {/* 4-Tab Bottom Navigation Bar */}
          <BottomNav isAgroEnabled={isAgroEnabled} />

          {/* Quick Action Bottom Sheets */}
          <LogExpenseSheet
            isOpen={showLogExpenseSheet}
            onClose={() => setShowLogExpenseSheet(false)}
            activeMember={activeMember}
          />

          <RecordCreditSaleSheet
            isOpen={showRecordSaleSheet}
            onClose={() => setShowRecordSaleSheet(false)}
            activeMember={activeMember}
          />

          <NewDebtSheet
            isOpen={showNewDebtSheet}
            onClose={() => setShowNewDebtSheet(false)}
            activeMember={activeMember}
          />

          <BroadcastSheet
            isOpen={showBroadcastSheet}
            onClose={() => setShowBroadcastSheet(false)}
            activeMember={activeMember}
          />

          {/* Typography & Theme Studio Modal */}
          <ThemeSettingsModal
            isOpen={showThemeModal}
            onClose={() => setShowThemeModal(false)}
            activeFontId={activeFontId}
            onSelectFont={handleSelectFont}
            backgroundIntensity={bgIntensity}
            onSelectBackgroundIntensity={handleSelectBgIntensity}
          />

          {/* Notification & Ground Broadcast Slide-Over Drawer */}
          <NotificationDrawer
            isOpen={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            notifications={visibleNotifications}
            activeMember={activeMember}
            locations={orgLocations}
            onMarkAllRead={() => dataService.markAllNotificationsRead(activeMember.id)}
            onMarkRead={(id) => dataService.markNotificationRead(id, activeMember.id)}
            onMarkUnread={(id) => dataService.markNotificationUnread(id, activeMember.id)}
            onOpenDetails={(item) => setActiveNotificationDetail(item)}
            onPostBroadcast={(data) =>
              dataService.postGroundBroadcast({ ...data, actor: activeMember })
            }
          />

          {/* Dedicated Rich Notification Detail Modal */}
          <NotificationDetailModal
            isOpen={Boolean(activeNotificationDetail)}
            onClose={() => setActiveNotificationDetail(null)}
            notification={activeNotificationDetail}
            activeMember={activeMember}
            onMarkRead={(id) => dataService.markNotificationRead(id, activeMember.id)}
            onMarkUnread={(id) => dataService.markNotificationUnread(id, activeMember.id)}
          />

          {/* Security Re-Authentication for Unhiding System Numbers */}
          <PrivacyUnlockModal
            isOpen={showPrivacyModal}
            onClose={() => {
              setShowPrivacyModal(false);
              setPrivacyModalError(null);
            }}
            activeMember={activeMember}
            onNavigateToSettings={(sec?: string) => {
              setSettingsTargetSection(sec || 'biometrics');
              setShowPrivacyModal(false);
            }}
            initialError={privacyModalError}
            initialMode={privacyModalMode}
            onSuccess={() => {
              setShowNumbers(true);
              setPrivacyMask(false);
              setShowPrivacyModal(false);
              setPrivacyModalError(null);
            }}
          />

          {/* Full CRUD Site Manager Modal */}
          <SiteManagerModal
            isOpen={showSiteManagerModal}
            onClose={() => setShowSiteManagerModal(false)}
            locations={orgLocations}
            activeMember={activeMember}
            onSiteSelected={(id) => setSelectedLocationId(id)}
          />

          {/* First-Login Fingerprint Biometric Prompt */}
          {showFirstLoginBioPrompt && (
            <FirstLoginBiometricPrompt
              memberId={activeMember.id}
              memberEmail={activeMember.email || activeMember.phoneOrEmail}
              memberName={activeMember.fullName}
              onDone={() => {
                if (typeof window !== 'undefined') {
                  localStorage.setItem(`first_login_bio_prompt_seen_${activeMember.id}`, 'true');
                }
                setShowFirstLoginBioPrompt(false);
              }}
            />
          )}
        </div>
      </ToastProvider>
    </NavigationProvider>
  );
}
