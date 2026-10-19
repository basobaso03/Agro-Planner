import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AgroStateSnapshot,
  AuditNotificationEvent,
  ExpenseCategory,
  FeedLedgerEvent,
  FixedAssetCategory,
  FixedAssetLedgerEvent,
  Role,
  SyndicateMember,
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
import { initializeNotificationChannels } from './utils/mobileHardware.ts';
import { Header } from './components/Header.tsx';
import { NotificationDrawer } from './components/NotificationDrawer.tsx';
import { HomeTab } from './components/HomeTab.tsx';
import { LivestockTab } from './components/LivestockTab.tsx';
import { ExpensesFeedTab } from './components/ExpensesFeedTab.tsx';
import { PoolEquityTab } from './components/PoolEquityTab.tsx';
import { AssetsTab } from './components/AssetsTab.tsx';
import { AuditAlertsTab } from './components/AuditAlertsTab.tsx';
import { UserManagementTab } from './components/UserManagementTab.tsx';
import { UserSettingsTab } from './components/UserSettingsTab.tsx';
import { AuthGatePage } from './components/AuthGatePage.tsx';
import { PendingApprovalLobby } from './components/PendingApprovalLobby.tsx';
import { FarmTerrainBackground } from './components/FarmTerrainBackground.tsx';
import { FloatingNavbar } from './components/FloatingNavbar.tsx';
import { ThemeSettingsModal } from './components/ThemeSettingsModal.tsx';
import { PrivacyUnlockModal } from './components/PrivacyUnlockModal.tsx';
import {
  authenticateOrEnrollBiometric,
  getEnrolledBiometricRecord,
  getPrivacyUnlockPreference,
  isBiometricHardwareSupported,
  triggerHapticFeedback,
} from './utils/mobileHardware.ts';
import { PERMISSIONS } from './utils/permissions.ts';
import { FONT_OPTIONS, type FontStyleId } from './types/theme.ts';
import { SplashScreen } from './components/SplashScreen.tsx';

export type ActiveTab =
  | 'HOME'
  | 'LIVESTOCK'
  | 'EXPENSES'
  | 'POOL'
  | 'ASSETS'
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

  // Solora 5-Font State (persisted to localStorage)
  const [activeFontId, setActiveFontId] = useState<FontStyleId>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('agro_active_font');
      if (saved && FONT_OPTIONS.some((f) => f.id === saved)) {
        return saved as FontStyleId;
      }
    }
    return 'modern-geometric';
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
    // Initialize Android Notification Channels and check permissions
    void initializeNotificationChannels();

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
      }
    });
    return () => {
      unsubState();
      unsubAuth();
      unsubSession();
    };
  }, []);

  // Resolve the authenticated user's SyndicateMember profile strictly from activeSession
  const activeMember: SyndicateMember | null = useMemo(() => {
    if (!activeSession) return null;
    const normEmail = activeSession.email.trim().toLowerCase();
    const isPrimaryAdmin = normEmail === PRIMARY_ADMIN_EMAIL;

    const found = state.members.find(
      (m) =>
        m.id === activeSession.uid ||
        m.uid === activeSession.uid ||
        (normEmail &&
          ((m.email || '').trim().toLowerCase() === normEmail ||
            m.phoneOrEmail.trim().toLowerCase() === normEmail))
    );

    if (found) {
      if (isPrimaryAdmin && (found.role !== 'SYNDICATE_ADMIN' || found.approvalStatus !== 'APPROVED')) {
        return {
          ...found,
          role: 'SYNDICATE_ADMIN',
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
      fullName: activeSession.displayName || normEmail.split('@')[0] || 'Syndicate User',
      phoneOrEmail: normEmail,
      role: isPrimaryAdmin ? 'SYNDICATE_ADMIN' : 'REMOTE_INVESTOR',
      approvalStatus: isPrimaryAdmin ? 'APPROVED' : 'PENDING_APPROVAL',
      authProviders: activeSession.providers,
      hasPasswordSetup: activeSession.providers.includes('password'),
      joinedAt: new Date().toISOString(),
      active: isPrimaryAdmin,
    };
  }, [activeSession, state.members]);

  // Dynamic list of tabs accessible to the active user's role
  const accessibleTabs = useMemo<ActiveTab[]>(() => {
    if (!activeMember) return ['HOME'];
    const tabs: ActiveTab[] = ['HOME', 'LIVESTOCK', 'EXPENSES'];
    if (PERMISSIONS.canViewCapitalPoolTab(activeMember.role)) {
      tabs.push('POOL');
    }
    tabs.push('ASSETS', 'AUDIT');
    if (PERMISSIONS.canManageMembers(activeMember.role)) {
      tabs.push('USERS');
    }
    tabs.push('SETTINGS');
    return tabs;
  }, [activeMember]);

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

  const pendingUsersCount = useMemo(() => {
    return state.members.filter(
      (m) => m.approvalStatus === 'PENDING_APPROVAL' || (!m.approvalStatus && !m.active)
    ).length;
  }, [state.members]);

  const selectedLocationName = useMemo(() => {
    if (selectedLocationId === 'ALL') return 'All Locations (Master Syndicate)';
    return (
      state.locations.find((l) => l.id === selectedLocationId)?.name || 'Selected Site'
    );
  }, [state.locations, selectedLocationId]);

  // All Livestock Computed Statuses
  const allLivestockStatuses = useMemo(() => {
    return state.livestockEntries.map((entry) =>
      computeLivestockStatus(entry, state.livestockEvents, state.feedLedger)
    );
  }, [state.livestockEntries, state.livestockEvents, state.feedLedger]);

  // Filtered by selectedLocationId
  const visibleLivestockStatuses = useMemo(() => {
    if (selectedLocationId === 'ALL') return allLivestockStatuses;
    return allLivestockStatuses.filter(
      (s) => s.entry.locationId === selectedLocationId
    );
  }, [allLivestockStatuses, selectedLocationId]);

  const visibleExpenses = useMemo(() => {
    if (selectedLocationId === 'ALL') return state.expenses;
    return state.expenses.filter((e) => e.locationId === selectedLocationId);
  }, [state.expenses, selectedLocationId]);

  const financials = useMemo(() => {
    return computeFinancialSummary({
      capitalContributions: state.capitalContributions,
      expenses: state.expenses,
      fixedAssets: state.fixedAssets,
      livestockStatuses: allLivestockStatuses,
      livestockEvents: state.livestockEvents,
      filterLocationId: selectedLocationId,
    });
  }, [
    state.capitalContributions,
    state.expenses,
    state.fixedAssets,
    allLivestockStatuses,
    state.livestockEvents,
    selectedLocationId,
  ]);

  const memberEquities = useMemo(() => {
    return computeMemberEquities(
      state.members,
      state.capitalContributions,
      financials.totalSyndicateNav
    );
  }, [state.members, state.capitalContributions, financials.totalSyndicateNav]);

  const fixedAssetGroups = useMemo(() => {
    return computeFixedAssetGroups(
      state.fixedAssets,
      state.locations,
      selectedLocationId
    );
  }, [state.fixedAssets, state.locations, selectedLocationId]);

  const feedSummaries = useMemo(() => {
    return computeFeedInventories(
      state.feedLedger,
      state.locations,
      selectedLocationId
    );
  }, [state.feedLedger, state.locations, selectedLocationId]);

  const siteComparisons = useMemo(() => {
    return computeSiteComparisons({
      locations: state.locations,
      expenses: state.expenses,
      fixedAssets: state.fixedAssets,
      livestockStatuses: allLivestockStatuses,
      livestockEvents: state.livestockEvents,
    });
  }, [
    state.locations,
    allLivestockStatuses,
    state.expenses,
    state.fixedAssets,
    state.livestockEvents,
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
      (n: AuditNotificationEvent) => !n.readByMemberIds.includes(activeMember.id)
    ).length;
  }, [visibleNotifications, activeMember]);

  const activeFontCss =
    FONT_OPTIONS.find((f) => f.id === activeFontId)?.cssClass || 'font-style-geometric';

  const handleSignOut = () => {
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
        <div className={`min-h-screen relative flex flex-col ${activeFontCss}`}>
          <FarmTerrainBackground intensity={bgIntensity} />
          <AuthGatePage />
        </div>
      </>
    );
  }

  // GATE 2: Zero-Trust Clearance Check (Pending Approval or Suspended users stay in the lobby)
  const effectiveApproval =
    activeMember.approvalStatus || (activeMember.active ? 'APPROVED' : 'PENDING_APPROVAL');
  if (effectiveApproval !== 'APPROVED') {
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
          <PendingApprovalLobby
            member={activeMember}
            onSignOut={handleSignOut}
          />
        </div>
      </>
    );
  }

  // GATE 3: Approved & Active Syndicate Member Workspace
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
      <div
        className={`min-h-screen relative flex flex-col ${activeFontCss} ${
          mobileFrameMode
            ? 'max-w-[430px] mx-auto border-x border-[#E8DFCE] shadow-2xl bg-[#FAF7F2]'
            : 'w-full'
        }`}
      >
      {/* Procedural Topographical Farm Terrain Background */}
      <FarmTerrainBackground intensity={bgIntensity} />

      {/* Top App Bar & Location Switcher (Persona Switcher Removed) */}
      <Header
        locations={state.locations}
        selectedLocationId={selectedLocationId}
        onSelectLocation={setSelectedLocationId}
        activeMember={activeMember}
        pendingUsersCount={pendingUsersCount}
        unreadCount={unreadCount}
        onOpenNotifications={() => setDrawerOpen(true)}
        onNavigateTab={handleNavigateTab}
        onSignOut={handleSignOut}
        onAddLocation={(data) =>
          dataService.addLocation({ ...data, actor: activeMember })
        }
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
        className={`flex-1 px-4 pt-4 pb-28 select-none-touch ${
          mobileFrameMode ? 'w-full' : 'max-w-6xl w-full mx-auto'
        }`}
      >
        {activeTab === 'HOME' && (
          <HomeTab
            financials={financials}
            livestockStatuses={visibleLivestockStatuses}
            siteComparisons={siteComparisons}
            latestBroadcast={latestBroadcast}
            selectedLocationName={selectedLocationName}
            activeMember={activeMember}
            locations={state.locations}
            onNavigateTab={handleNavigateTab}
            onSelectLocation={setSelectedLocationId}
            onPostBroadcast={(data) =>
              dataService.postGroundBroadcast({ ...data, actor: activeMember })
            }
            showNumbers={showNumbers}
          />
        )}

        {activeTab === 'LIVESTOCK' && (
          <LivestockTab
            livestockStatuses={visibleLivestockStatuses}
            locations={state.locations}
            selectedLocationId={selectedLocationId}
            activeMember={activeMember}
            memberEquities={memberEquities}
            onRegisterLivestock={(data) =>
              dataService.registerLivestock({ ...data, actor: activeMember })
            }
            onLogLifecycleEvent={(data) =>
              dataService.logLivestockLifecycleEvent({
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
            locations={state.locations}
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
            capitalContributions={state.capitalContributions}
            locations={state.locations}
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
            locations={state.locations}
            selectedLocationId={selectedLocationId}
            activeMember={activeMember}
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

        {activeTab === 'AUDIT' && (
          <AuditAlertsTab
            auditNotifications={visibleNotifications}
            locations={state.locations}
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

        {activeTab === 'USERS' && (
          <UserManagementTab
            members={state.members}
            locations={state.locations}
            activeMember={activeMember}
            showNumbers={showNumbers}
          />
        )}

        {activeTab === 'SETTINGS' && (
          <UserSettingsTab
            activeMember={activeMember}
            session={activeSession}
            locations={state.locations}
            activeFontId={activeFontId}
            onSelectFont={handleSelectFont}
            backgroundIntensity={bgIntensity}
            onSelectBackgroundIntensity={handleSelectBgIntensity}
            onPreviewSplash={() => setPreviewSplash(true)}
            onSignOut={handleSignOut}
            targetSection={settingsTargetSection}
          />
        )}
      </main>

      {/* Signature Solora Floating Navigation Bar */}
      <FloatingNavbar
        activeTab={activeTab}
        onNavigateTab={handleNavigateTab}
        mobileFrameMode={mobileFrameMode}
        activeRole={activeMember.role}
        pendingUsersCount={pendingUsersCount}
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
        locations={state.locations}
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
    </div>
    </>
  );
}
