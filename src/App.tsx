import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  PRIMARY_ADMIN_EMAIL,
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
import { Header } from './components/Header.tsx';
import { NotificationDrawer } from './components/NotificationDrawer.tsx';
import { HomeTab } from './components/HomeTab.tsx';
import { LivestockTab } from './components/LivestockTab.tsx';
import { ExpensesFeedTab } from './components/ExpensesFeedTab.tsx';
import { PoolEquityTab } from './components/PoolEquityTab.tsx';
import { AssetsTab } from './components/AssetsTab.tsx';
import { AuditAlertsTab } from './components/AuditAlertsTab.tsx';
import { BroadcastCenterTab } from './components/BroadcastCenterTab.tsx';
import { UserManagementTab } from './components/UserManagementTab.tsx';
import { UserSettingsTab } from './components/UserSettingsTab.tsx';
import { ShieldAlert, LogOut, ArrowLeft } from 'lucide-react';
import { AuthGatePage } from './components/AuthGatePage.tsx';
import { OrgOnboardingModal } from './components/OrgOnboardingModal.tsx';
import { SiteManagerModal } from './components/SiteManagerModal.tsx';
import { FirstLoginBiometricPrompt } from './components/FirstLoginBiometricPrompt.tsx';
import { FarmTerrainBackground } from './components/FarmTerrainBackground.tsx';
import { FloatingNavbar } from './components/FloatingNavbar.tsx';
import { ThemeSettingsModal } from './components/ThemeSettingsModal.tsx';
import { PrivacyUnlockModal } from './components/PrivacyUnlockModal.tsx';
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
import { FONT_OPTIONS, type FontStyleId } from './types/theme.ts';
import { SplashScreen } from './components/SplashScreen.tsx';

export type ActiveTab =
  | 'HOME'
  | 'LIVESTOCK'
  | 'EXPENSES'
  | 'POOL'
  | 'ASSETS'
  | 'BROADCASTS'
  | 'AUDIT'
  | 'USERS'
  | 'SETTINGS';

export default function App() {
  const [state, setState] = useState<AgroStateSnapshot>(() => dataService.getState());
  const [activeSession, setActiveSession] = useState<AuthenticatedSession | null>(() =>
    dataService.getActiveSession()
  );
  const [selectedLocationId, setSelectedLocationId] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<ActiveTab>('HOME');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileFrameMode, setMobileFrameMode] = useState(false);
  const [cloudUserEmail, setCloudUserEmail] = useState<string | null>(null);
  const [showThemeModal, setShowThemeModal] = useState(false);

  // Deep-linking target section inside Settings tab (e.g. 'biometrics', 'password', 'profile')
  const [settingsTargetSection, setSettingsTargetSection] = useState<string | null>(null);

  const handleNavigateTab = (tab: ActiveTab, section?: string | null) => {
    if (section) {
      setSettingsTargetSection(section);
    } else if (tab !== 'SETTINGS') {
      setSettingsTargetSection(null);
    }
    setActiveTab(tab);
  };

  // Number Privacy Masking: Show on fresh login, default to hide (••••••) on restored local session
  const [showNumbers, setShowNumbers] = useState<boolean>(() =>
    Boolean(dataService.getActiveSession()?.freshlyAuthenticated)
  );
  const [showPrivacyModal, setShowPrivacyModal] = useState<boolean>(false);
  const [privacyModalError, setPrivacyModalError] = useState<string | null>(null);
  const [privacyModalMode, setPrivacyModalMode] = useState<'password' | 'setup'>('password');
  const [isAuthenticatingPrivacy, setIsAuthenticatingPrivacy] = useState(false);

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

  // Universal smooth scroll centering for any active input field when mobile keyboard opens
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        // Delay 260ms to let virtual keyboard slide into position
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 260);
      }
    };

    window.addEventListener('focusin', handleFocusIn);
    return () => window.removeEventListener('focusin', handleFocusIn);
  }, []);

  useEffect(() => {
    // Initialize Android Notification Channels, Push Notifications, and tap handler
    void initializeNotificationChannels();
    void initPushNotifications(() => {
      setDrawerOpen(true);
    });

    // Fetch version.json from the GitHub repository online on every application startup
    void runOnlineVersionCheck(false);

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
        // If newly logged in freshly, set showNumbers to true; if restored from storage, freshlyAuthenticated is false
        setShowNumbers(Boolean(session.freshlyAuthenticated));
      } else {
        setShowNumbers(false);
        setActiveTab('HOME');
        setSelectedLocationId('ALL');
        setDrawerOpen(false);
        setShowPrivacyModal(false);
        setPrivacyModalError(null);
      }
    });
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unsubState();
      unsubAuth();
      unsubSession();
    };
  }, []);

  // Resolve the authenticated user's OrgMember profile strictly from activeSession
  const activeMember: OrgMember | null = useMemo(() => {
    if (!activeSession) return null;
    const normEmail = activeSession.email.trim().toLowerCase();
    const isPrimaryAdmin = normEmail === PRIMARY_ADMIN_EMAIL;

    const matches = state.members.filter(
      (m) =>
        m.id === activeSession.uid ||
        m.uid === activeSession.uid ||
        (normEmail &&
          ((m.email || '').trim().toLowerCase() === normEmail ||
            (m.phoneOrEmail || '').trim().toLowerCase() === normEmail))
    );

    const found =
      matches.find((m) => m.approvalStatus === 'APPROVED' || m.active) || matches[0];

    if (found) {
      if (isPrimaryAdmin && (found.role !== 'ORG_ADMIN' || found.approvalStatus !== 'APPROVED')) {
        return {
          ...found,
          role: 'ORG_ADMIN',
          approvalStatus: 'APPROVED',
          active: true,
        };
      }
      return found;
    }

    // Fallback transient profile while state syncs
    return {
      id: activeSession.uid,
      uid: activeSession.uid,
      email: normEmail,
      fullName: activeSession.displayName || normEmail.split('@')[0] || 'Member',
      phoneOrEmail: normEmail,
      role: isPrimaryAdmin ? 'ORG_ADMIN' : 'MEMBER',
      approvalStatus: 'APPROVED',
      authProviders: activeSession.providers,
      hasPasswordSetup: activeSession.providers.includes('password'),
      joinedAt: new Date().toISOString(),
      active: true,
    };
  }, [activeSession, state.members]);

  // Resolve Active Organization
  const activeOrg = useMemo(() => {
    if (!activeMember?.orgId) return null;
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
  const [showFirstLoginBioPrompt, setShowFirstLoginBioPrompt] = useState(false);
  useEffect(() => {
    if (!activeMember) return;
    const promptKey = `first_login_bio_prompt_seen_${activeMember.id}`;
    if (typeof window !== 'undefined' && !localStorage.getItem(promptKey)) {
      void isBiometricHardwareSupported().then((supported) => {
        const alreadyEnrolled = Boolean(getEnrolledBiometricRecord());
        if (supported && !alreadyEnrolled) {
          setShowFirstLoginBioPrompt(true);
        }
      });
    }
  }, [activeMember?.id]);

  // Dynamic list of tabs accessible to the active user's role
  const accessibleTabs = useMemo<ActiveTab[]>(() => {
    if (!activeMember) return ['HOME'];
    const tabs: ActiveTab[] = ['HOME'];
    if (isAgroEnabled) {
      tabs.push('LIVESTOCK');
    }
    tabs.push('EXPENSES');
    if (PERMISSIONS.canViewCapitalPoolTab(activeMember.role)) {
      tabs.push('POOL');
    }
    tabs.push('ASSETS', 'BROADCASTS', 'AUDIT');
    if (PERMISSIONS.canManageMembers(activeMember.role)) {
      tabs.push('USERS');
    }
    tabs.push('SETTINGS');
    return tabs;
  }, [activeMember, isAgroEnabled]);

  // Strict role & workspace enforcement: bounce unauthorized tabs to HOME
  useEffect(() => {
    if (activeMember && activeTab === 'USERS' && !PERMISSIONS.canManageMembers(activeMember.role)) {
      setActiveTab('HOME');
    }
    if (!isAgroEnabled && activeTab === 'LIVESTOCK') {
      setActiveTab('HOME');
    }
  }, [activeMember, activeTab, isAgroEnabled]);

  // Touch gesture listener for horizontal swiping right or left to switch between tabs
  const touchStartRef = useRef<{ x: number; y: number; time: number; target: HTMLElement | null } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
      target: e.target as HTMLElement | null,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.changedTouches.length !== 1) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const deltaTime = Date.now() - touchStartRef.current.time;
    const startTarget = touchStartRef.current.target;
    touchStartRef.current = null;

    // Disregard long drags (> 650ms) or short jitters (< 50px)
    if (deltaTime > 650) return;
    if (Math.abs(deltaX) < 50) return;
    // Gesture must be predominantly horizontal (1.3x more horizontal than vertical)
    if (Math.abs(deltaX) < Math.abs(deltaY) * 1.3) return;

    // Avoid hijacking touches on inputs, sliders, modals, or horizontal tables/scroll-containers
    if (startTarget) {
      if (
        startTarget.closest(
          'input, textarea, select, button, [role="slider"], [role="dialog"], .overflow-x-auto, [data-prevent-swipe]'
        )
      ) {
        return;
      }
    }

    const currentIndex = accessibleTabs.indexOf(activeTab);
    if (currentIndex === -1) return;

    if (deltaX < 0) {
      // Swiping Left -> Next tab
      if (currentIndex < accessibleTabs.length - 1) {
        const nextTab = accessibleTabs[currentIndex + 1];
        handleNavigateTab(nextTab);
        triggerHapticFeedback([20]);
      }
    } else {
      // Swiping Right -> Previous tab
      if (currentIndex > 0) {
        const prevTab = accessibleTabs[currentIndex - 1];
        handleNavigateTab(prevTab);
        triggerHapticFeedback([20]);
      }
    }
  };

  const handleToggleShowNumbers = async () => {
    if (showNumbers) {
      // Direct hide without authentication
      setShowNumbers(false);
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
    return state.members.filter((m) => m.orgId === currentOrgId);
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

  const pendingUsersCount = useMemo(() => {
    return orgMembers.filter(
      (m) => m.approvalStatus === 'PENDING_APPROVAL' || (!m.approvalStatus && !m.active)
    ).length;
  }, [orgMembers]);

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
    if (selectedLocationId === 'ALL') return orgExpenses;
    return orgExpenses.filter((e) => e.locationId === selectedLocationId);
  }, [orgExpenses, selectedLocationId]);

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
      filterLocationId: selectedLocationId,
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
  ]);

  const memberEquities = useMemo(() => {
    return computeMemberEquities(
      orgMembers,
      orgCapitalContributions,
      financials.totalNav
    );
  }, [orgMembers, orgCapitalContributions, financials.totalNav]);

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
    if (selectedLocationId === 'ALL') return state.auditNotifications;
    return state.auditNotifications.filter(
      (n: AuditNotificationEvent) => n.locationId === 'ALL' || n.locationId === selectedLocationId
    );
  }, [state.auditNotifications, selectedLocationId]);

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

  const handleSignOut = () => {
    setShowNumbers(false);
    setActiveTab('HOME');
    setSelectedLocationId('ALL');
    setDrawerOpen(false);
    setShowPrivacyModal(false);
    setPrivacyModalError(null);
    void dataService.signOutCloud();
  };

  // GATE 1: Unauthenticated users must sign in or register
  if (!activeSession || !activeMember) {
    return (
      <>
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
      </>
    );
  }

  // GATE 2: Organization Onboarding Check
  // If the authenticated user is not attached to any organization yet, present the onboarding modal (Create Org or Join with 24-hr Code)
  if (!activeMember.orgId) {
    return (
      <>
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
      </>
    );
  }

  // GATE 3: Zero-Trust Clearance Check (Suspended users are blocked)
  if (activeMember.approvalStatus === 'SUSPENDED' || !activeMember.active) {
    return (
      <>
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
      </>
    );
  }

  // GATE 4: Approved & Active Organization Member Workspace
  return (
    <>
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
        className={`min-h-screen relative flex flex-col ${activeFontCss} ${mobileFrameMode
          ? 'max-w-[430px] mx-auto border-x border-[#E8DFCE] shadow-2xl bg-[#FAF7F2]'
          : 'w-full'
          }`}
      >
        {/* Procedural Topographical Farm Terrain Background */}
        <FarmTerrainBackground intensity={bgIntensity} />

        {/* Top App Bar & Location Switcher (Persona Switcher Removed) */}
        <Header
          locations={orgLocations}
          selectedLocationId={selectedLocationId}
          onSelectLocation={setSelectedLocationId}
          activeMember={activeMember}
          pendingUsersCount={pendingUsersCount}
          unreadCount={unreadCount}
          onOpenNotifications={() => setDrawerOpen(true)}
          onNavigateTab={handleNavigateTab}
          onSignOut={handleSignOut}
          onOpenSiteManager={() => setShowSiteManagerModal(true)}
          organizationName={activeOrg?.name}
          workspaceMode={activeOrg?.type}
          mobileFrameMode={mobileFrameMode}
          onToggleMobileFrame={() => setMobileFrameMode(!mobileFrameMode)}
          isCloudConnected={Boolean(cloudUserEmail || activeSession.isCloudAuth)}
          showNumbers={showNumbers}
          onToggleShowNumbers={handleToggleShowNumbers}
          isAuthenticatingPrivacy={isAuthenticatingPrivacy}
        />

        {/* Main Scrollable Viewport with Touch Gesture Swiping between Tabs */}
        <main
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className={`flex-1 px-4 pt-4 pb-28 select-none-touch ${mobileFrameMode ? 'w-full' : 'max-w-6xl w-full mx-auto'
            }`}
        >
          {/* Back to Overview Hub banner when navigating subpages from the Banking Hub */}
          {activeTab !== 'HOME' && activeTab !== 'LIVESTOCK' && activeTab !== 'EXPENSES' && (
            <div className="mb-4 flex items-center justify-between bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 rounded-2xl backdrop-blur-sm">
              <button
                type="button"
                onClick={() => handleNavigateTab('HOME')}
                className="inline-flex items-center gap-2 text-xs font-bold text-amber-900 hover:text-amber-950 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>← Back to Overview Hub</span>
              </button>
              <span className="text-[11px] font-mono font-bold text-amber-800">
                Hub Subpage · {activeTab}
              </span>
            </div>
          )}

          {activeTab === 'HOME' && (
            <HomeTab
              financials={financials}
              livestockStatuses={visibleLivestockStatuses}
              siteComparisons={siteComparisons}
              latestBroadcast={latestBroadcast}
              selectedLocationName={selectedLocationName}
              activeMember={activeMember}
              locations={orgLocations}
              onNavigateTab={handleNavigateTab}
              onSelectLocation={setSelectedLocationId}
              onPostBroadcast={(data) =>
                dataService.postGroundBroadcast({ ...data, actor: activeMember })
              }
              showNumbers={showNumbers}
              isAgroEnabled={isAgroEnabled}
              debtLiabilities={orgDebtLiabilities}
              loansGiven={orgLoansGiven}
              creditSales={orgCreditSales}
              livestockEntries={orgLivestockEntries}
              pendingUsersCount={pendingUsersCount}
              unreadBroadcastsCount={unreadCount}
              totalMembersCount={orgMembers.length}
              totalFixedAssetsCount={orgFixedAssets.length}
              totalAuditCount={state.auditNotifications?.length || 0}
            />
          )}

          {activeTab === 'LIVESTOCK' && isAgroEnabled && (
            <LivestockTab
              livestockStatuses={visibleLivestockStatuses}
              locations={orgLocations}
              selectedLocationId={selectedLocationId}
              activeMember={activeMember}
              memberEquities={memberEquities}
              leftMoney={financials.leftMoney}
              onRegisterLivestock={(data) =>
                dataService.registerLivestock({ ...data, actor: activeMember })
              }
              onLogLifecycleEvent={(data) =>
                dataService.logLivestockLifecycleEvent({
                  ...data,
                  actor: activeMember,
                })
              }
              onAddLivestockPhoto={(livestockId: string, photoUrl: string, caption?: string) =>
                dataService.addLivestockGalleryPhoto({
                  livestockId,
                  photoUrl,
                  caption,
                  actor: activeMember,
                })
              }
              onBroadcastMilestone={(data) =>
                dataService.dispatchLivestockMilestoneBroadcast({
                  ...data,
                  actor: activeMember,
                })
              }
              showNumbers={showNumbers}
            />
          )}

          {activeTab === 'EXPENSES' && (
            <ExpensesFeedTab
              expenses={visibleExpenses}
              feedSummaries={feedSummaries}
              financials={financials}
              locations={orgLocations}
              livestockStatuses={allLivestockStatuses}
              selectedLocationId={selectedLocationId}
              activeMember={activeMember}
              onLogExpense={(data: {
                locationId: string;
                batchOrAnimalId?: string;
                category: ExpenseCategory;
                direction: 'DEDUCTION' | 'CONTRA_REVERSAL';
                amount: number;
                referenceTransactionId?: string;
                note: string;
                gpsStamp?: string;
                receiptPhotoDataUrl?: string;
              }) =>
                dataService.logExpense({ ...data, actor: activeMember })
              }
              onApproveMultiSig={(txId: string) =>
                dataService.approveMultiSigExpense(txId, activeMember)
              }
              onLogFeedEvent={(data: {
                locationId: string;
                feedType: string;
                direction: FeedLedgerEvent['direction'];
                bagsDelta: number;
                kgPerBag: number;
                linkedLivestockId?: string;
                referenceTransactionId?: string;
                note: string;
              }) =>
                dataService.logFeedEvent({ ...data, actor: activeMember })
              }
              showNumbers={showNumbers}
            />
          )}

          {activeTab === 'POOL' && (
            <PoolEquityTab
              financials={financials}
              memberEquities={memberEquities}
              capitalContributions={orgCapitalContributions}
              locations={orgLocations}
              activeMember={activeMember}
              onAddMember={(data: {
                fullName: string;
                phoneOrEmail: string;
                role: Role;
                assignedLocationId?: string;
                initialContributionUsd?: number;
                contributionNote?: string;
              }) =>
                dataService.addMember({ ...data, actor: activeMember })
              }
              onLogContribution={(data: {
                memberId: string;
                direction: 'ADDITION' | 'CONTRA_REVERSAL';
                amount: number;
                referenceTransactionId?: string;
                note: string;
              }) =>
                dataService.logCapitalContribution({ ...data, actor: activeMember })
              }
              showNumbers={showNumbers}
            />
          )}

          {activeTab === 'ASSETS' && (
            <AssetsTab
              assetGroups={fixedAssetGroups}
              locations={orgLocations}
              selectedLocationId={selectedLocationId}
              activeMember={activeMember}
              leftMoney={financials.leftMoney}
              onLogAssetEvent={(data: {
                assetGroupId?: string;
                assetName: string;
                category: FixedAssetCategory;
                locationId: string;
                direction: FixedAssetLedgerEvent['direction'];
                quantityDelta: number;
                valueDelta: number;
                condition: FixedAssetLedgerEvent['condition'];
                referenceTransactionId?: string;
                note: string;
                deductFromLeftMoney?: boolean;
                photoUrl?: string;
              }) =>
                dataService.logFixedAssetEvent({ ...data, actor: activeMember })
              }
              onTransferAsset={(data: {
                assetGroupId: string;
                assetName: string;
                category: FixedAssetCategory;
                fromLocationId: string;
                toLocationId: string;
                quantityToTransfer: number;
                valueToTransfer: number;
                condition: FixedAssetLedgerEvent['condition'];
                note: string;
              }) =>
                dataService.transferFixedAssetBetweenLocations({
                  ...data,
                  actor: activeMember,
                })
              }
              showNumbers={showNumbers}
            />
          )}

          {activeTab === 'BROADCASTS' && (
            <BroadcastCenterTab
              notifications={visibleNotifications}
              locations={orgLocations}
              activeMember={activeMember}
              onPostBroadcast={(data) =>
                dataService.postGroundBroadcast({ ...data, actor: activeMember })
              }
              showNumbers={showNumbers}
            />
          )}

          {activeTab === 'AUDIT' && (
            <AuditAlertsTab
              auditNotifications={visibleNotifications}
              locations={orgLocations}
              activeMember={activeMember}
              cloudUserEmail={cloudUserEmail}
              onPostBroadcast={(data) =>
                dataService.postGroundBroadcast({ ...data, actor: activeMember })
              }
              activeFontId={activeFontId}
              onSelectFont={handleSelectFont}
              backgroundIntensity={bgIntensity}
              onSelectBackgroundIntensity={handleSelectBgIntensity}
              onOpenThemeModal={() => setShowThemeModal(true)}
              showNumbers={showNumbers}
            />
          )}

          {activeTab === 'USERS' && PERMISSIONS.canManageMembers(activeMember.role) && (
            <UserManagementTab
              members={orgMembers}
              locations={orgLocations}
              activeMember={activeMember}
              activeOrg={activeOrg}
              showNumbers={showNumbers}
            />
          )}

          {activeTab === 'SETTINGS' && (
            <UserSettingsTab
              activeMember={activeMember}
              session={activeSession}
              locations={orgLocations}
              activeOrg={activeOrg}
              activeFontId={activeFontId}
              onSelectFont={handleSelectFont}
              backgroundIntensity={bgIntensity}
              onSelectBackgroundIntensity={handleSelectBgIntensity}
              onPreviewSplash={() => setPreviewSplash(true)}
              onCheckUpdates={() => void runOnlineVersionCheck(true)}
              onSignOut={handleSignOut}
              targetSection={settingsTargetSection}
            />
          )}
        </main>

        {/* Signature CapitaSeed Floating Navigation Bar */}
        <FloatingNavbar
          activeTab={activeTab}
          onNavigateTab={handleNavigateTab}
          mobileFrameMode={mobileFrameMode}
          activeRole={activeMember.role}
          pendingUsersCount={pendingUsersCount}
          unreadBroadcastsCount={unreadCount}
          isAgroEnabled={isAgroEnabled}
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
          onPostBroadcast={(data) =>
            dataService.postGroundBroadcast({ ...data, actor: activeMember })
          }
        />

        {/* Security Re-Authentication for Unhiding System Numbers */}
        <PrivacyUnlockModal
          isOpen={showPrivacyModal}
          onClose={() => {
            setShowPrivacyModal(false);
            setPrivacyModalError(null);
          }}
          activeMember={activeMember}
          onNavigateToSettings={(sec?: string) => handleNavigateTab('SETTINGS', sec || 'biometrics')}
          initialError={privacyModalError}
          initialMode={privacyModalMode}
          onSuccess={() => {
            setShowNumbers(true);
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
    </>
  );
}
