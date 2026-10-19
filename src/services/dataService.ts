import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  EmailAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  linkWithCredential,
  updatePassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDocFromServer,
  onSnapshot,
  type Firestore,
} from 'firebase/firestore';
import defaultFirebaseConfig from '../../firebase-applet-config.json';
import type {
  AgroStateSnapshot,
  AssetCondition,
  AuditEventType,
  AuditNotificationEvent,
  CapitalContributionEvent,
  DurationUnit,
  ExpenseCategory,
  ExpenseLedgerEvent,
  FarmLocation,
  FeedLedgerEvent,
  FixedAssetCategory,
  FixedAssetLedgerEvent,
  LivestockEntry,
  LivestockLifecycleEvent,
  MemberApprovalStatus,
  NotificationSeverity,
  Role,
  SyndicateMember,
  TrackingMode,
} from '../types/agro.ts';
import { createEmptyProductionSnapshot, LEGACY_SEED_IDS } from '../data/seedData.ts';
import {
  computeAuditEventHash,
  computeLedgerRecordHash,
  sha256Hex,
  GENESIS_SHORT,
} from '../utils/cryptoHash.ts';
import { computeTargetSaleDate } from '../utils/calculations.ts';
import {
  areSystemNotificationsEnabled,
  dispatchSystemNotification,
  verifyDeviceBiometric,
} from '../utils/mobileHardware.ts';

export const PRIMARY_ADMIN_EMAIL = 'baseramarlvin@gmail.com';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export interface CustomFirebaseConfig {
  apiKey: string;
  projectId: string;
  appId: string;
  authDomain?: string;
  firestoreDatabaseId?: string;
}

export interface AuthenticatedSession {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  providers: string[];
  isCloudAuth: boolean;
  signedInAt?: number; // Epoch timestamp in ms
  expiresAt?: number;  // Epoch timestamp in ms (default: 3 days after login)
  freshlyAuthenticated?: boolean; // True only during active login turn; false when loaded from storage
}

export const SESSION_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 Days in milliseconds

const LEGACY_STORAGE_KEY = 'agro_planner_immutable_ledger_v1';
const STORAGE_KEY = 'agro_planner_immutable_ledger_v2_prod';
const SESSION_STORAGE_KEY = 'agro_planner_active_auth_session_v2';
const CUSTOM_FB_KEY = 'agro_planner_custom_firebase_config_v1';
const LOCAL_CREDENTIALS_STORAGE_KEY = 'agro_planner_local_credentials_v2';
const CHANNEL_NAME = 'agro_planner_realtime_bus';

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;
let firebaseAuth: Auth | null = null;

interface StoredCredentialRecord {
  verifierHash: string;
  hasPasswordSetup: boolean;
  updatedAt: string;
}

function getStoredLocalCredentials(): Record<string, StoredCredentialRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_CREDENTIALS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredLocalCredential(email: string, verifierHash: string) {
  if (typeof window === 'undefined' || !email) return;
  try {
    const norm = email.trim().toLowerCase();
    const current = getStoredLocalCredentials();
    current[norm] = {
      verifierHash,
      hasPasswordSetup: true,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(LOCAL_CREDENTIALS_STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.warn('Failed to save local credential storage:', err);
  }
}

function computePasswordVerifier(email: string, password: string): string {
  const normalizedEmail = email.trim().toLowerCase();
  return sha256Hex(`AGRO_ZERO_TRUST_V2::${normalizedEmail}::${password}`);
}

function isLegacySeedId(collectionKey: keyof typeof LEGACY_SEED_IDS, id: string): boolean {
  const list = LEGACY_SEED_IDS[collectionKey];
  return Array.isArray(list) && list.includes(id);
}

function sanitizeSnapshotOfLegacySeed(snapshot: AgroStateSnapshot): AgroStateSnapshot {
  return {
    locations: (snapshot.locations || []).filter((x) => !isLegacySeedId('locations', x.id)),
    members: (snapshot.members || []).filter((x) => !isLegacySeedId('members', x.id)),
    capitalContributions: (snapshot.capitalContributions || []).filter(
      (x) => !isLegacySeedId('capitalContributions', x.id)
    ),
    expenses: (snapshot.expenses || []).filter((x) => !isLegacySeedId('expenses', x.id)),
    fixedAssets: (snapshot.fixedAssets || []).filter((x) => !isLegacySeedId('fixedAssets', x.id)),
    livestockEntries: (snapshot.livestockEntries || []).filter(
      (x) => !isLegacySeedId('livestockEntries', x.id)
    ),
    livestockEvents: (snapshot.livestockEvents || []).filter(
      (x) => !isLegacySeedId('livestockEvents', x.id)
    ),
    feedLedger: (snapshot.feedLedger || []).filter((x) => !isLegacySeedId('feedLedger', x.id)),
    auditNotifications: (snapshot.auditNotifications || []).filter(
      (x) => !isLegacySeedId('auditNotifications', x.id)
    ),
  };
}

function initFirebaseInstance(customConfig?: CustomFirebaseConfig | null) {
  try {
    const cfg = customConfig?.apiKey ? customConfig : defaultFirebaseConfig;
    if (!cfg || !cfg.apiKey || !cfg.projectId) {
      return null;
    }
    const existingApps = getApps();
    const appName = customConfig?.apiKey ? 'agro-custom-app' : '[DEFAULT]';
    const existing = existingApps.find((a) => a.name === appName);
    firebaseApp = existing || initializeApp(cfg, appName === '[DEFAULT]' ? undefined : appName);

    const dbId = (cfg as { firestoreDatabaseId?: string }).firestoreDatabaseId;
    try {
      firestoreDb = dbId
        ? initializeFirestore(
            firebaseApp,
            {
              localCache: persistentLocalCache({
                tabManager: persistentSingleTabManager({}),
              }),
            },
            dbId
          )
        : initializeFirestore(firebaseApp, {
            localCache: persistentLocalCache({
              tabManager: persistentSingleTabManager({}),
            }),
          });
    } catch {
      firestoreDb = dbId
        ? getFirestore(firebaseApp, dbId)
        : getFirestore(firebaseApp);
    }
    firebaseAuth = getAuth(firebaseApp);
    return { app: firebaseApp, db: firestoreDb, auth: firebaseAuth };
  } catch (err) {
    console.warn('Firebase initialization fallback to local ledger:', err);
    return null;
  }
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: firebaseAuth?.currentUser?.uid ?? null,
      email: firebaseAuth?.currentUser?.email ?? null,
      emailVerified: firebaseAuth?.currentUser?.emailVerified ?? null,
      isAnonymous: firebaseAuth?.currentUser?.isAnonymous ?? null,
      tenantId: firebaseAuth?.currentUser?.tenantId ?? null,
      providerInfo:
        firebaseAuth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

type StateListener = (state: AgroStateSnapshot) => void;
type SessionListener = (session: AuthenticatedSession | null) => void;

class AgroDataService {
  private state: AgroStateSnapshot;
  private listeners: Set<StateListener> = new Set();
  private channel: BroadcastChannel | null = null;
  private currentUser: User | null = null;
  private activeSession: AuthenticatedSession | null = null;
  private authListeners: Set<(user: User | null) => void> = new Set();
  private sessionListeners: Set<SessionListener> = new Set();
  private firestoreUnsubscribes: (() => void)[] = [];
  private cloudSyncActive = false;
  private activeListenerUid: string | null = null;

  constructor() {
    this.state = this.loadCleanProductionState();
    this.activeSession = this.loadPersistedSession();

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event) => {
        if (event.data && event.data.type === 'STATE_UPDATED') {
          this.state = sanitizeSnapshotOfLegacySeed(event.data.payload);
          this.notifyListeners();
        }
      };
    }

    const customCfg = this.getCustomFirebaseConfig();
    const fb = initFirebaseInstance(customCfg);
    if (fb && fb.db) {
      void this.testConnection(fb.db);
      if (fb.auth) {
        onAuthStateChanged(fb.auth, (user) => {
          this.currentUser = user;
          this.authListeners.forEach((cb) => cb(user));
          if (user && fb.db) {
            const providers = user.providerData.map((p) => p.providerId).filter(Boolean);
            const email = (user.email || '').trim().toLowerCase();
            const existingMem = this.findMemberByUidOrEmail(user.uid, email);
            const creds = getStoredLocalCredentials();
            const hasLocalCred = Boolean(email && creds[email]);
            const mergedProviders = Array.from(
              new Set([
                ...providers,
                ...(existingMem?.authProviders || []),
                ...(existingMem?.hasPasswordSetup || hasLocalCred ? ['password'] : []),
              ])
            );
            const nextSession: AuthenticatedSession = {
              uid: user.uid,
              email: email || existingMem?.email || '',
              displayName: user.displayName || existingMem?.fullName || email.split('@')[0] || 'Member',
              emailVerified: user.emailVerified || providers.includes('google.com'),
              providers: mergedProviders.length > 0 ? mergedProviders : ['google.com'],
              isCloudAuth: true,
            };
            this.setActiveSession(nextSession);
            this.attachCloudListeners(fb.db, user.uid);
            this.ensureAuthenticatedMemberProfile({
              uid: nextSession.uid,
              email: nextSession.email,
              fullName: nextSession.displayName,
              providers: nextSession.providers,
              passwordVerifierHash: creds[email]?.verifierHash || existingMem?.passwordVerifierHash,
            });
          } else {
            this.detachCloudListeners();
            // In native mobile & offline mode, preserve persisted session so user stays logged in
            // Active session is only cleared when the user explicitly clicks "Sign Out" via signOutCloud()
          }
        });
      }
    }
  }

  private async testConnection(db: Firestore) {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.error('Please check your Firebase configuration.');
      }
    }
  }

  private loadCleanProductionState(): AgroStateSnapshot {
    if (typeof window === 'undefined') {
      return createEmptyProductionSnapshot();
    }
    try {
      // Remove legacy v1 demo seed key permanently
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AgroStateSnapshot;
        if (parsed && typeof parsed === 'object') {
          const cleaned = sanitizeSnapshotOfLegacySeed(parsed);
          const creds = getStoredLocalCredentials();
          cleaned.members = (cleaned.members || []).map((m) => {
            const email = (m.email || m.phoneOrEmail || '').trim().toLowerCase();
            const rec = email ? creds[email] : null;
            if (rec || m.passwordVerifierHash || m.hasPasswordSetup) {
              const hash = m.passwordVerifierHash || rec?.verifierHash;
              const providers = Array.from(new Set([...(m.authProviders || []), 'password']));
              return {
                ...m,
                hasPasswordSetup: true,
                passwordVerifierHash: hash,
                authProviders: providers,
              };
            }
            return m;
          });
          return cleaned;
        }
      }
    } catch (e) {
      console.warn('Failed to parse cached ledger state, initializing clean snapshot:', e);
    }
    const clean = createEmptyProductionSnapshot();
    this.saveLocalState(clean, false);
    return clean;
  }

  private loadPersistedSession(): AuthenticatedSession | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw) as AuthenticatedSession;

      const now = Date.now();
      // Check 3-day expiration (expiresAt or 3 days from signedInAt)
      if (session.expiresAt && now > session.expiresAt) {
        console.info('Session expired (>3 days). Requiring re-authentication.');
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
        return null;
      }
      if (session.signedInAt && now - session.signedInAt > SESSION_TTL_MS) {
        console.info('Session exceeded 3-day TTL. Requiring re-authentication.');
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
        return null;
      }

      // Loaded from persistent storage: not a fresh active login turn
      return {
        ...session,
        freshlyAuthenticated: false,
      };
    } catch {
      return null;
    }
  }

  private setActiveSession(session: AuthenticatedSession | null) {
    const now = Date.now();
    const enrichedSession: AuthenticatedSession | null = session
      ? {
          ...session,
          signedInAt: session.signedInAt || now,
          expiresAt: session.expiresAt || (now + SESSION_TTL_MS),
          freshlyAuthenticated: session.freshlyAuthenticated ?? true,
        }
      : null;

    this.activeSession = enrichedSession;
    if (typeof window !== 'undefined') {
      if (enrichedSession) {
        window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(enrichedSession));
      } else {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
    this.sessionListeners.forEach((cb) => cb(enrichedSession));
  }

  private saveLocalState(nextState: AgroStateSnapshot, broadcast = true) {
    const cleaned = sanitizeSnapshotOfLegacySeed(nextState);
    this.state = cleaned;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
      } catch (e) {
        console.warn('LocalStorage quota warning:', e);
      }
    }
    if (broadcast && this.channel) {
      this.channel.postMessage({ type: 'STATE_UPDATED', payload: cleaned });
    }
    this.notifyListeners();
  }

  private notifyListeners() {
    const snapshot = { ...this.state };
    this.listeners.forEach((cb) => cb(snapshot));
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => {
      this.listeners.delete(listener);
    };
  }

  public subscribeAuth(listener: (user: User | null) => void): () => void {
    this.authListeners.add(listener);
    listener(this.currentUser);
    return () => {
      this.authListeners.delete(listener);
    };
  }

  public subscribeSession(listener: SessionListener): () => void {
    this.sessionListeners.add(listener);
    listener(this.activeSession);
    return () => {
      this.sessionListeners.delete(listener);
    };
  }

  public getState(): AgroStateSnapshot {
    return this.state;
  }

  public getActiveSession(): AuthenticatedSession | null {
    return this.activeSession;
  }

  public isCloudConnected(): boolean {
    return this.cloudSyncActive && Boolean(this.currentUser || this.activeSession);
  }

  public getCustomFirebaseConfig(): CustomFirebaseConfig | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(CUSTOM_FB_KEY);
      return raw ? (JSON.parse(raw) as CustomFirebaseConfig) : null;
    } catch {
      return null;
    }
  }

  public setCustomFirebaseConfig(config: CustomFirebaseConfig | null) {
    if (typeof window === 'undefined') return;
    if (!config || !config.apiKey) {
      window.localStorage.removeItem(CUSTOM_FB_KEY);
      initFirebaseInstance(null);
    } else {
      window.localStorage.setItem(CUSTOM_FB_KEY, JSON.stringify(config));
      initFirebaseInstance(config);
    }
    this.notifyListeners();
  }

  public findMemberByUidOrEmail(uid?: string, email?: string): SyndicateMember | undefined {
    const normEmail = (email || '').trim().toLowerCase();
    return this.state.members.find(
      (m) =>
        (uid && (m.id === uid || m.uid === uid)) ||
        (normEmail &&
          ((m.email || '').trim().toLowerCase() === normEmail ||
            m.phoneOrEmail.trim().toLowerCase() === normEmail))
    );
  }

  public ensureAuthenticatedMemberProfile(params: {
    uid: string;
    email: string;
    fullName: string;
    phone?: string;
    jobTitle?: string;
    providers: string[];
    passwordVerifierHash?: string;
  }): SyndicateMember {
    const now = new Date().toISOString();
    const normEmail = params.email.trim().toLowerCase();
    const isPrimaryAdmin = normEmail === PRIMARY_ADMIN_EMAIL;

    const existing = this.findMemberByUidOrEmail(params.uid, normEmail);
    const creds = getStoredLocalCredentials();
    const credRec = normEmail ? creds[normEmail] : null;

    if (existing) {
      const hasPassword = Boolean(
        params.passwordVerifierHash ||
          existing.passwordVerifierHash ||
          existing.hasPasswordSetup ||
          credRec?.hasPasswordSetup ||
          params.providers.includes('password')
      );
      const passwordVerifierHash =
        params.passwordVerifierHash ||
        existing.passwordVerifierHash ||
        credRec?.verifierHash;

      const mergedProviders = Array.from(
        new Set([
          ...(existing.authProviders || []),
          ...params.providers,
          ...(hasPassword ? ['password'] : []),
        ])
      );
      const updatedMember: SyndicateMember = {
        ...existing,
        uid: params.uid || existing.uid || existing.id,
        email: normEmail || existing.email,
        fullName: existing.fullName || params.fullName.trim().slice(0, 120),
        phone: params.phone || existing.phone,
        jobTitle: params.jobTitle || existing.jobTitle,
        role: isPrimaryAdmin ? 'SYNDICATE_ADMIN' : existing.role,
        approvalStatus: isPrimaryAdmin
          ? 'APPROVED'
          : existing.approvalStatus || (existing.active ? 'APPROVED' : 'PENDING_APPROVAL'),
        active: isPrimaryAdmin ? true : existing.approvalStatus === 'APPROVED' || existing.active,
        authProviders: mergedProviders,
        hasPasswordSetup: hasPassword,
        passwordVerifierHash,
        lastLoginAt: now,
      };

      const nextMembers = this.state.members.map((m) =>
        m.id === existing.id ? updatedMember : m
      );
      this.saveLocalState({ ...this.state, members: nextMembers });
      void this.persistDocumentToCloudIfActive('members', updatedMember.id, updatedMember);
      return updatedMember;
    }

    // Create brand new member profile
    const memberId = params.uid || `mem-${Date.now().toString(36)}`;
    const initialRole: Role = isPrimaryAdmin ? 'SYNDICATE_ADMIN' : 'REMOTE_INVESTOR';
    const initialApproval: MemberApprovalStatus = isPrimaryAdmin ? 'APPROVED' : 'PENDING_APPROVAL';
    const hasPwd = Boolean(
      params.passwordVerifierHash || params.providers.includes('password')
    );

    const newMember: SyndicateMember = {
      id: memberId,
      uid: params.uid,
      email: normEmail,
      fullName: (params.fullName || normEmail.split('@')[0] || 'Syndicate User').trim().slice(0, 120),
      phoneOrEmail: (params.phone?.trim() || normEmail).slice(0, 160),
      phone: params.phone?.trim().slice(0, 60),
      jobTitle: params.jobTitle?.trim().slice(0, 120) || (isPrimaryAdmin ? 'Managing Syndicate Founder' : 'Syndicate Member'),
      preferredContact: 'EMAIL',
      role: initialRole,
      approvalStatus: initialApproval,
      authProviders: params.providers,
      hasPasswordSetup: hasPwd,
      passwordVerifierHash: params.passwordVerifierHash,
      joinedAt: now,
      updatedAt: now,
      lastLoginAt: now,
      active: isPrimaryAdmin,
    };

    const audit = this.createChainedAuditEvent({
      actor: newMember,
      locationId: 'ALL',
      locationName: 'All Locations (Master Syndicate)',
      eventType: 'MEMBER_ADDED',
      severity: isPrimaryAdmin ? 'MILESTONE' : 'URGENT_GROUND',
      title: isPrimaryAdmin
        ? `Primary Syndicate Admin Initialized: ${newMember.fullName}`
        : `New Account Awaiting Clearance: ${newMember.fullName}`,
      message: isPrimaryAdmin
        ? `${newMember.fullName} (${normEmail}) authenticated and initialized as Master SYNDICATE_ADMIN.`
        : `${newMember.fullName} (${normEmail}) registered via ${params.providers.join(', ')} and entered the Zero-Trust Pending Approval Lobby.`,
      referenceEntityId: newMember.id,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      members: [...this.state.members, newMember],
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('members', newMember.id, newMember);
    return newMember;
  }

  // ============================================================================
  // REAL AUTHENTICATION FLOWS (GOOGLE OAUTH + EMAIL/PASSWORD + ACCOUNT LINKING)
  // ============================================================================

  public async signInWithGoogleCloud(): Promise<SyndicateMember> {
    let uid = '';
    let email = '';
    let displayName = '';

    if (Capacitor.isNativePlatform()) {
      // 1. Native Mobile Flow (Capacitor Android/iOS via Google Play Services)
      const result = await FirebaseAuthentication.signInWithGoogle();
      const user = result.user;
      uid = user?.uid || '';
      email = (user?.email || '').trim().toLowerCase();
      displayName = user?.displayName || email.split('@')[0] || 'Member';
    } else {
      // 2. Web Browser Flow (Firebase Web SDK)
      if (!firebaseAuth) {
        const fb = initFirebaseInstance(this.getCustomFirebaseConfig());
        if (!fb?.auth) throw new Error('Firebase Auth is not initialized.');
      }
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const res = await signInWithPopup(firebaseAuth!, provider);
      const user = res.user;
      uid = user.uid;
      email = (user.email || '').trim().toLowerCase();
      displayName = user.displayName || email.split('@')[0] || 'Member';
    }

    const existing = this.findMemberByUidOrEmail(uid, email);
    const mergedProviders = Array.from(
      new Set([
        'google.com',
        ...(existing?.authProviders || []),
        ...(existing?.hasPasswordSetup ? ['password'] : []),
      ])
    );

    const session: AuthenticatedSession = {
      uid,
      email,
      displayName: displayName || existing?.fullName || 'Member',
      emailVerified: true,
      providers: mergedProviders,
      isCloudAuth: true,
    };
    this.setActiveSession(session);

    if (firestoreDb) {
      this.attachCloudListeners(firestoreDb, uid);
    }

    const member = this.ensureAuthenticatedMemberProfile({
      uid,
      email,
      fullName: session.displayName,
      providers: mergedProviders,
    });

    return member;
  }

  public async registerWithEmailAccount(params: {
    fullName: string;
    email: string;
    phone: string;
    jobTitle?: string;
    password: string;
  }): Promise<SyndicateMember> {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanName = params.fullName.trim();
    if (!cleanEmail.includes('@') || cleanEmail.length < 5) {
      throw new Error('Please enter a valid email address.');
    }
    if (cleanName.length < 2) {
      throw new Error('Please enter your full name (at least 2 characters).');
    }
    if (params.password.length < 8) {
      throw new Error('Password must be at least 8 characters long for Zero-Trust security.');
    }

    const existing = this.findMemberByUidOrEmail(undefined, cleanEmail);
    if (existing && existing.hasPasswordSetup) {
      throw new Error('An account with this email already has a password configured. Please sign in instead.');
    }

    const verifierHash = computePasswordVerifier(cleanEmail, params.password);
    let resolvedUid = existing?.uid || existing?.id || `usr-${sha256Hex(cleanEmail).slice(0, 16)}`;
    let isCloudUser = false;

    if (!firebaseAuth) {
      initFirebaseInstance(this.getCustomFirebaseConfig());
    }

    if (firebaseAuth) {
      try {
        const cred = await createUserWithEmailAndPassword(firebaseAuth, cleanEmail, params.password);
        resolvedUid = cred.user.uid;
        isCloudUser = true;
        await updateProfile(cred.user, { displayName: cleanName });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('auth/email-already-in-use')) {
          throw new Error('This email is already registered. Please sign in or use Google Sign-In.');
        }
        // If Email/Password provider is not yet enabled in Firebase Console (operation-not-allowed),
        // proceed seamlessly with our cryptographic Zero-Trust verifier vault
      }
    }

    const mergedProviders = Array.from(
      new Set([...(existing?.authProviders || []), 'password'])
    );

    const member = this.ensureAuthenticatedMemberProfile({
      uid: resolvedUid,
      email: cleanEmail,
      fullName: cleanName,
      phone: params.phone.trim(),
      jobTitle: params.jobTitle?.trim(),
      providers: mergedProviders,
      passwordVerifierHash: verifierHash,
    });

    const session: AuthenticatedSession = {
      uid: member.id,
      email: cleanEmail,
      displayName: member.fullName,
      emailVerified: cleanEmail === PRIMARY_ADMIN_EMAIL || isCloudUser,
      providers: mergedProviders,
      isCloudAuth: isCloudUser,
    };
    this.setActiveSession(session);

    return member;
  }

  public async signInWithEmailAccount(params: {
    email: string;
    password: string;
  }): Promise<SyndicateMember> {
    const cleanEmail = params.email.trim().toLowerCase();
    if (!cleanEmail || !params.password) {
      throw new Error('Please enter both your email address and password.');
    }

    const verifierHash = computePasswordVerifier(cleanEmail, params.password);
    const existingLocal = this.findMemberByUidOrEmail(undefined, cleanEmail);

    if (!firebaseAuth) {
      initFirebaseInstance(this.getCustomFirebaseConfig());
    }

    // 1. Try Firebase Auth Email/Password sign in first
    if (firebaseAuth) {
      try {
        const cred = await signInWithEmailAndPassword(firebaseAuth, cleanEmail, params.password);
        const user = cred.user;
        const providers = Array.from(
          new Set([
            ...user.providerData.map((p) => p.providerId),
            ...(existingLocal?.authProviders || []),
            'password',
          ])
        );
        const member = this.ensureAuthenticatedMemberProfile({
          uid: user.uid,
          email: cleanEmail,
          fullName: user.displayName || existingLocal?.fullName || cleanEmail.split('@')[0],
          providers,
          passwordVerifierHash: verifierHash,
        });
        this.setActiveSession({
          uid: member.id,
          email: cleanEmail,
          displayName: member.fullName,
          emailVerified: true,
          providers,
          isCloudAuth: true,
        });
        return member;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('auth/wrong-password') || msg.includes('auth/invalid-credential')) {
          // Also check if user linked password via cryptographic verifier in Settings
          if (!existingLocal || existingLocal.passwordVerifierHash !== verifierHash) {
            throw new Error('Invalid email or password. Please verify your credentials.');
          }
        }
      }
    }

    // 2. Verify against Zero-Trust Cryptographic Password Verifier (supports Google accounts that linked a password in Settings!)
    if (existingLocal && existingLocal.passwordVerifierHash === verifierHash) {
      const providers = Array.from(
        new Set([...(existingLocal.authProviders || []), 'password'])
      );
      const updated = this.ensureAuthenticatedMemberProfile({
        uid: existingLocal.uid || existingLocal.id,
        email: cleanEmail,
        fullName: existingLocal.fullName,
        providers,
        passwordVerifierHash: verifierHash,
      });
      this.setActiveSession({
        uid: updated.id,
        email: cleanEmail,
        displayName: updated.fullName,
        emailVerified: true,
        providers,
        isCloudAuth: Boolean(this.currentUser),
      });
      return updated;
    }

    if (existingLocal && !existingLocal.hasPasswordSetup) {
      throw new Error(
        'This account was created with Google Sign-In and does not have a password set yet. Please click "Continue with Google" and set up your password in Settings.'
      );
    }

    throw new Error('No account found with matching email and password. Please register or sign in with Google.');
  }

  /**
   * Unlocks the user's session using the device's hardware biometric sensor (Android Fingerprint / Face Unlock)
   */
  public async signInWithBiometrics(): Promise<SyndicateMember> {
    const enrolled = await verifyDeviceBiometric();
    const existing = this.findMemberByUidOrEmail(enrolled.memberId, enrolled.email);
    const providers = Array.from(
      new Set([...(existing?.authProviders || ['google.com']), 'biometric'])
    );
    const member = this.ensureAuthenticatedMemberProfile({
      uid: existing?.uid || enrolled.memberId,
      email: enrolled.email,
      fullName: existing?.fullName || enrolled.fullName,
      providers,
    });

    this.setActiveSession({
      uid: member.id,
      email: enrolled.email,
      displayName: member.fullName,
      emailVerified: true,
      providers,
      isCloudAuth: Boolean(this.currentUser),
    });

    return member;
  }

  /**
   * Allows a Google-authenticated user (or existing password user) to set up or change their password
   * so they can sign in with either Google OAuth or Email + Password.
   */
  public async setupOrUpdatePasswordForCurrentUser(params: {
    member: SyndicateMember;
    newPassword: string;
  }): Promise<SyndicateMember> {
    if (params.newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }
    const email = (params.member.email || params.member.phoneOrEmail || this.activeSession?.email || '')
      .trim()
      .toLowerCase();
    if (!email.includes('@')) {
      throw new Error('A valid email address on your profile is required to link a password.');
    }

    const verifierHash = computePasswordVerifier(email, params.newPassword);

    // Attempt native Firebase Auth credential linking if signed in via Google
    if (firebaseAuth?.currentUser) {
      const user = firebaseAuth.currentUser;
      const hasPasswordProvider = user.providerData.some((p) => p.providerId === 'password');
      try {
        if (!hasPasswordProvider) {
          const credential = EmailAuthProvider.credential(email, params.newPassword);
          await linkWithCredential(user, credential);
        } else {
          await updatePassword(user, params.newPassword);
        }
      } catch (err: unknown) {
        // Even if Firebase requires recent login or EmailAuthProvider is not enabled in console,
        // we still persist the cryptographic SHA-256 verifier on the member record so hybrid login succeeds.
        console.info('Firebase native link fallback to cryptographic verifier:', err);
      }
    }

    // Persist to dedicated local credential storage immediately
    saveStoredLocalCredential(email, verifierHash);

    const now = new Date().toISOString();
    const mergedProviders = Array.from(
      new Set([...(params.member.authProviders || ['google.com']), 'password'])
    );

    const updatedMember: SyndicateMember = {
      ...params.member,
      email,
      authProviders: mergedProviders,
      hasPasswordSetup: true,
      passwordVerifierHash: verifierHash,
      updatedAt: now,
    };

    const audit = this.createChainedAuditEvent({
      actor: updatedMember,
      locationId: 'ALL',
      locationName: 'All Locations (Master Syndicate)',
      eventType: 'SECURITY_CREDENTIAL_LINKED',
      severity: 'INFO',
      title: `Password Credential Configured: ${updatedMember.fullName}`,
      message: `${updatedMember.fullName} (${email}) configured dual-provider password authentication (${mergedProviders.join(' + ')}).`,
      referenceEntityId: updatedMember.id,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      members: this.state.members.map((m) =>
        m.id === updatedMember.id ||
        (m.uid && updatedMember.uid && m.uid === updatedMember.uid) ||
        (m.email && m.email.trim().toLowerCase() === email) ||
        (m.phoneOrEmail && m.phoneOrEmail.trim().toLowerCase() === email)
          ? {
              ...m,
              ...updatedMember,
              id: m.id,
              uid: m.uid || updatedMember.uid,
              hasPasswordSetup: true,
              passwordVerifierHash: verifierHash,
              authProviders: mergedProviders,
            }
          : m
      ),
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('members', updatedMember.id, updatedMember);
    if (updatedMember.uid && updatedMember.uid !== updatedMember.id) {
      void this.persistDocumentToCloudIfActive('members', updatedMember.uid, updatedMember);
    }

    if (this.activeSession) {
      this.setActiveSession({
        ...this.activeSession,
        providers: mergedProviders,
      });
    }

    return updatedMember;
  }

  /**
   * Verifies member password to authorize unmasking sensitive numbers
   */
  public verifyMemberPassword(member: SyndicateMember, plainPassword: string): boolean {
    const email = (member.email || member.phoneOrEmail || this.activeSession?.email || '').trim().toLowerCase();
    const verifierHash = computePasswordVerifier(email, plainPassword);
    const creds = getStoredLocalCredentials();
    const storedHash = member.passwordVerifierHash || (email ? creds[email]?.verifierHash : undefined);
    return Boolean(storedHash && storedHash === verifierHash);
  }

  /**
   * Allows any authenticated user to edit their personal details (Name, Phone, Job Title, Bio, Preferred Contact)
   */
  public updateOwnMemberProfile(params: {
    memberId: string;
    fullName: string;
    phone: string;
    jobTitle: string;
    bio: string;
    preferredContact: 'EMAIL' | 'WHATSAPP' | 'SMS';
  }): SyndicateMember {
    const existing = this.state.members.find((m) => m.id === params.memberId);
    if (!existing) throw new Error('Member profile not found.');
    if (params.fullName.trim().length < 2) {
      throw new Error('Full name must be at least 2 characters.');
    }

    const now = new Date().toISOString();
    const cleanName = params.fullName.trim().slice(0, 120);
    const cleanPhone = params.phone.trim().slice(0, 60);
    const cleanTitle = params.jobTitle.trim().slice(0, 120);
    const cleanBio = params.bio.trim().slice(0, 400);

    const updatedMember: SyndicateMember = {
      ...existing,
      fullName: cleanName,
      phone: cleanPhone,
      phoneOrEmail: cleanPhone || existing.email || existing.phoneOrEmail,
      jobTitle: cleanTitle,
      bio: cleanBio,
      preferredContact: params.preferredContact,
      updatedAt: now,
    };

    if (firebaseAuth?.currentUser) {
      updateProfile(firebaseAuth.currentUser, { displayName: cleanName }).catch(() => {});
    }

    const audit = this.createChainedAuditEvent({
      actor: updatedMember,
      locationId: updatedMember.assignedLocationId || 'ALL',
      locationName:
        this.state.locations.find((l) => l.id === updatedMember.assignedLocationId)?.name ||
        'All Locations (Master Syndicate)',
      eventType: 'MEMBER_PROFILE_UPDATED',
      severity: 'INFO',
      title: `Profile Details Updated: ${updatedMember.fullName}`,
      message: `${updatedMember.fullName} updated account profile details (Title: ${cleanTitle || 'Member'}, Contact: ${params.preferredContact}).`,
      referenceEntityId: updatedMember.id,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      members: this.state.members.map((m) =>
        m.id === updatedMember.id ? updatedMember : m
      ),
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('members', updatedMember.id, updatedMember);

    if (this.activeSession && this.activeSession.uid === updatedMember.id) {
      this.setActiveSession({
        ...this.activeSession,
        displayName: cleanName,
      });
    }

    return updatedMember;
  }

  /**
   * Admin Governance: Switch user roles, approve pending registrations, assign sites, or suspend accounts
   */
  public adminUpdateMemberRoleAndAccess(params: {
    targetMemberId: string;
    role: Role;
    approvalStatus: MemberApprovalStatus;
    assignedLocationId?: string;
    note?: string;
    actor: SyndicateMember;
  }): SyndicateMember {
    if (params.actor.role !== 'SYNDICATE_ADMIN') {
      throw new Error('Zero-Trust Violation: Only a Syndicate Admin can modify member roles or clearances.');
    }
    const target = this.state.members.find((m) => m.id === params.targetMemberId);
    if (!target) throw new Error('Target member record not found.');

    // Protect primary bootstrapped admin from accidental self-lockout
    if (
      (target.email || '').toLowerCase() === PRIMARY_ADMIN_EMAIL &&
      (params.role !== 'SYNDICATE_ADMIN' || params.approvalStatus !== 'APPROVED')
    ) {
      throw new Error('The primary Founder Syndicate Admin account cannot be demoted or suspended.');
    }

    const now = new Date().toISOString();
    const isNowActive = params.approvalStatus === 'APPROVED';
    const updatedMember: SyndicateMember = {
      ...target,
      role: params.role,
      approvalStatus: params.approvalStatus,
      active: isNowActive,
      assignedLocationId: params.assignedLocationId || undefined,
      updatedAt: now,
    };

    const wasPending = target.approvalStatus === 'PENDING_APPROVAL';
    const eventType: AuditEventType =
      params.approvalStatus === 'SUSPENDED'
        ? 'MEMBER_SUSPENDED'
        : wasPending && params.approvalStatus === 'APPROVED'
        ? 'MEMBER_APPROVED'
        : 'MEMBER_ROLE_CHANGED';

    const assignedSiteName =
      params.assignedLocationId && params.assignedLocationId !== 'ALL'
        ? this.state.locations.find((l) => l.id === params.assignedLocationId)?.name || 'Assigned Site'
        : 'All Locations (Master Syndicate)';

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: params.assignedLocationId || 'ALL',
      locationName: assignedSiteName,
      eventType,
      severity: params.approvalStatus === 'SUSPENDED' ? 'WARNING_CONTRA' : 'MILESTONE',
      title:
        eventType === 'MEMBER_APPROVED'
          ? `Member Approved & Cleared: ${updatedMember.fullName} (${params.role.replace('_', ' ')})`
          : eventType === 'MEMBER_SUSPENDED'
          ? `Member Access Suspended: ${updatedMember.fullName}`
          : `Role & Access Updated: ${updatedMember.fullName} → ${params.role.replace('_', ' ')}`,
      message: `${params.actor.fullName} updated ${updatedMember.fullName}: Role=${params.role}, Status=${params.approvalStatus}, Site=${assignedSiteName}.${params.note ? ` Note: ${params.note}` : ''}`,
      referenceEntityId: updatedMember.id,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      members: this.state.members.map((m) =>
        m.id === updatedMember.id ? updatedMember : m
      ),
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('members', updatedMember.id, updatedMember);
    return updatedMember;
  }

  /**
   * Admin Utility: Wipe any legacy demo data or perform a clean production ledger reset
   */
  public async wipeAllDemoAndLedgerData(
    actor: SyndicateMember,
    mode: 'DEMO_ONLY' | 'FULL_RESET' = 'FULL_RESET'
  ): Promise<void> {
    if (actor.role !== 'SYNDICATE_ADMIN') {
      throw new Error('Only a Syndicate Admin can execute a ledger purge.');
    }

    const now = new Date().toISOString();

    if (firestoreDb && this.currentUser) {
      const collectionsToClean = [
        { path: 'locations', key: 'locations' as const },
        { path: 'capital_contributions', key: 'capitalContributions' as const },
        { path: 'expense_ledger', key: 'expenses' as const },
        { path: 'fixed_assets_ledger', key: 'fixedAssets' as const },
        { path: 'livestock_entries', key: 'livestockEntries' as const },
        { path: 'livestock_lifecycle_events', key: 'livestockEvents' as const },
        { path: 'feed_ledger', key: 'feedLedger' as const },
        { path: 'audit_notifications', key: 'auditNotifications' as const },
      ];

      for (const col of collectionsToClean) {
        try {
          const snap = await getDocs(collection(firestoreDb, col.path));
          for (const d of snap.docs) {
            if (mode === 'FULL_RESET' || isLegacySeedId(col.key, d.id)) {
              await deleteDoc(doc(firestoreDb, col.path, d.id));
            }
          }
        } catch (err) {
          console.warn(`Cleanup note on ${col.path}:`, err);
        }
      }

      // Clean demo members from Firestore while keeping real authenticated users
      try {
        const memSnap = await getDocs(collection(firestoreDb, 'members'));
        for (const d of memSnap.docs) {
          if (isLegacySeedId('members', d.id)) {
            await deleteDoc(doc(firestoreDb, 'members', d.id));
          }
        }
      } catch (err) {
        console.warn('Cleanup note on members:', err);
      }
    }

    if (mode === 'DEMO_ONLY') {
      const cleaned = sanitizeSnapshotOfLegacySeed(this.state);
      this.saveLocalState(cleaned);
      return;
    }

    // FULL_RESET: Keep real non-demo members (at minimum the current Admin), wipe all ledgers, and create a fresh Genesis audit block
    const realMembers = this.state.members.filter(
      (m) => !isLegacySeedId('members', m.id)
    );
    const preservedMembers = realMembers.length > 0 ? realMembers : [actor];

    const genesisHash = computeAuditEventHash({
      previousHash: GENESIS_SHORT,
      timestamp: now,
      actorId: actor.id,
      locationId: 'ALL',
      eventType: 'SYSTEM_LEDGER_RESET',
      payloadSummary: `Clean Production Ledger Initialized::All demo and prior records purged by ${actor.fullName}.`,
    });

    const genesisAudit: AuditNotificationEvent = {
      id: `AUD-001-${Date.now().toString(36).toUpperCase()}`,
      sequenceNumber: 1,
      timestamp: now,
      actorId: actor.id,
      actorName: actor.fullName,
      actorRole: actor.role,
      locationId: 'ALL',
      locationName: 'All Locations (Master Syndicate)',
      eventType: 'SYSTEM_LEDGER_RESET',
      severity: 'MILESTONE',
      title: 'Clean Production Ledger Initialized',
      message: `All legacy demo records purged by ${actor.fullName}. Zero-Trust SHA-256 ledger initialized at Sequence #1.`,
      previousHash: GENESIS_SHORT,
      currentHash: genesisHash,
      readByMemberIds: [actor.id],
    };

    const freshSnapshot: AgroStateSnapshot = {
      locations: [],
      members: preservedMembers,
      capitalContributions: [],
      expenses: [],
      fixedAssets: [],
      livestockEntries: [],
      livestockEvents: [],
      feedLedger: [],
      auditNotifications: [genesisAudit],
    };

    this.saveLocalState(freshSnapshot);
    void this.persistDocumentToCloudIfActive('audit_notifications', genesisAudit.id, genesisAudit);
  }

  private async purgeLegacyCloudSeedIfPresent(db: Firestore): Promise<void> {
    const seedCollections: { path: string; ids: string[] }[] = [
      { path: 'locations', ids: LEGACY_SEED_IDS.locations },
      { path: 'members', ids: LEGACY_SEED_IDS.members },
      { path: 'capital_contributions', ids: LEGACY_SEED_IDS.capitalContributions },
      { path: 'expense_ledger', ids: LEGACY_SEED_IDS.expenses },
      { path: 'fixed_assets_ledger', ids: LEGACY_SEED_IDS.fixedAssets },
      { path: 'livestock_entries', ids: LEGACY_SEED_IDS.livestockEntries },
      { path: 'livestock_lifecycle_events', ids: LEGACY_SEED_IDS.livestockEvents },
      { path: 'feed_ledger', ids: LEGACY_SEED_IDS.feedLedger },
      { path: 'audit_notifications', ids: LEGACY_SEED_IDS.auditNotifications },
    ];

    for (const col of seedCollections) {
      for (const seedId of col.ids) {
        try {
          await deleteDoc(doc(db, col.path, seedId));
        } catch {
          // Ignore if already absent or restricted
        }
      }
    }
  }

  public async signOutCloud(): Promise<void> {
    if (firebaseAuth) {
      try {
        await signOut(firebaseAuth);
      } catch {
        // Ignore signOut error
      }
    }
    this.detachCloudListeners();
    this.setActiveSession(null);
    this.notifyListeners();
  }

  private detachCloudListeners() {
    this.firestoreUnsubscribes.forEach((unsub) => {
      try {
        unsub();
      } catch {
        // Ignore unsubscribe error
      }
    });
    this.firestoreUnsubscribes = [];
    this.cloudSyncActive = false;
    this.activeListenerUid = null;
  }

  private attachCloudListeners(db: Firestore, uid?: string) {
    if (this.cloudSyncActive && uid && this.activeListenerUid === uid) {
      return;
    }
    this.detachCloudListeners();
    this.cloudSyncActive = true;
    this.activeListenerUid = uid ?? this.currentUser?.uid ?? null;

    const collectionsMap: {
      path: string;
      apply: (docs: unknown[]) => void;
    }[] = [
      {
        path: 'locations',
        apply: (docs) => {
          this.state.locations = (docs as FarmLocation[]).filter(
            (x) => !isLegacySeedId('locations', x.id)
          );
        },
      },
      {
        path: 'members',
        apply: (docs) => {
          const cloudMembers = (docs as SyndicateMember[]).filter(
            (x) => !isLegacySeedId('members', x.id)
          );
          if (cloudMembers.length > 0) {
            const creds = getStoredLocalCredentials();
            const byId = new Map<string, SyndicateMember>();
            this.state.members.forEach((m) => {
              if (!isLegacySeedId('members', m.id)) byId.set(m.id, m);
            });
            cloudMembers.forEach((cloudM) => {
              const localM =
                byId.get(cloudM.id) ||
                Array.from(byId.values()).find(
                  (x) =>
                    (x.email && cloudM.email && x.email.trim().toLowerCase() === cloudM.email.trim().toLowerCase()) ||
                    (x.uid && cloudM.uid && x.uid === cloudM.uid)
                );
              const email = (cloudM.email || localM?.email || '').trim().toLowerCase();
              const credRec = email ? creds[email] : null;

              const hasPassword = Boolean(
                cloudM.hasPasswordSetup ||
                  localM?.hasPasswordSetup ||
                  cloudM.passwordVerifierHash ||
                  localM?.passwordVerifierHash ||
                  credRec?.hasPasswordSetup
              );
              const passwordVerifierHash =
                cloudM.passwordVerifierHash ||
                localM?.passwordVerifierHash ||
                credRec?.verifierHash;

              const mergedProviders = Array.from(
                new Set([
                  ...(cloudM.authProviders || []),
                  ...(localM?.authProviders || []),
                  ...(hasPassword ? ['password'] : []),
                ])
              );

              const mergedMember: SyndicateMember = {
                ...localM,
                ...cloudM,
                hasPasswordSetup: hasPassword,
                passwordVerifierHash,
                authProviders: mergedProviders,
              };

              byId.set(cloudM.id, mergedMember);

              // If cloud document lacked the password flag, update Firestore so cloud catches up
              if (hasPassword && (!cloudM.hasPasswordSetup || !cloudM.passwordVerifierHash)) {
                void this.persistDocumentToCloudIfActive('members', cloudM.id, mergedMember);
              }
            });
            this.state.members = Array.from(byId.values());
          }
        },
      },
      {
        path: 'capital_contributions',
        apply: (docs) => {
          this.state.capitalContributions = (docs as CapitalContributionEvent[]).filter(
            (x) => !isLegacySeedId('capitalContributions', x.id)
          );
        },
      },
      {
        path: 'expense_ledger',
        apply: (docs) => {
          this.state.expenses = (docs as ExpenseLedgerEvent[]).filter(
            (x) => !isLegacySeedId('expenses', x.id)
          );
        },
      },
      {
        path: 'fixed_assets_ledger',
        apply: (docs) => {
          this.state.fixedAssets = (docs as FixedAssetLedgerEvent[]).filter(
            (x) => !isLegacySeedId('fixedAssets', x.id)
          );
        },
      },
      {
        path: 'livestock_entries',
        apply: (docs) => {
          this.state.livestockEntries = (docs as LivestockEntry[]).filter(
            (x) => !isLegacySeedId('livestockEntries', x.id)
          );
        },
      },
      {
        path: 'livestock_lifecycle_events',
        apply: (docs) => {
          this.state.livestockEvents = (docs as LivestockLifecycleEvent[]).filter(
            (x) => !isLegacySeedId('livestockEvents', x.id)
          );
        },
      },
      {
        path: 'feed_ledger',
        apply: (docs) => {
          this.state.feedLedger = (docs as FeedLedgerEvent[]).filter(
            (x) => !isLegacySeedId('feedLedger', x.id)
          );
        },
      },
      {
        path: 'audit_notifications',
        apply: (docs) => {
          const valid = (docs as AuditNotificationEvent[]).filter(
            (x) => !isLegacySeedId('auditNotifications', x.id)
          );
          const sorted = valid.sort((a, b) => b.sequenceNumber - a.sequenceNumber);
          if (sorted.length > 0) {
            // Check for new incoming notifications authored by other members
            const existingIds = new Set(this.state.auditNotifications.map((n) => n.id));
            const currentUserId = this.currentUser?.uid;
            for (const item of sorted) {
              if (!existingIds.has(item.id) && item.actorId !== currentUserId) {
                if (areSystemNotificationsEnabled()) {
                  void dispatchSystemNotification({
                    title: `Agro Planner · ${item.title}`,
                    body: item.message,
                    tag: item.id,
                    urgent: item.severity === 'URGENT_GROUND' || item.severity === 'WARNING_CONTRA',
                    severity: item.severity,
                    sequenceNumber: item.sequenceNumber,
                  });
                }
              }
            }
            this.state.auditNotifications = sorted;
          }
        },
      },
    ];

    collectionsMap.forEach(({ path, apply }) => {
      const unsub = onSnapshot(
        collection(db, path),
        (snap) => {
          const items = snap.docs.map((d) => d.data());
          apply(items);
          this.saveLocalState({ ...this.state }, false);
        },
        (err) => {
          console.warn(`Firestore listener notice (${path}):`, err);
        }
      );
      this.firestoreUnsubscribes.push(unsub);
    });
  }

  private async persistDocumentToCloudIfActive(collectionPath: string, docId: string, data: object) {
    if (this.cloudSyncActive && this.currentUser && firestoreDb) {
      try {
        const cleanData = JSON.parse(JSON.stringify(data));
        await setDoc(doc(firestoreDb, collectionPath, docId), cleanData);
      } catch (error) {
        console.warn(`Cloud persistence warning (${collectionPath}/${docId}):`, error);
      }
    }
  }

  /**
   * Appends a new SHA-256 cryptographically hash-chained AuditNotificationEvent
   */
  private createChainedAuditEvent(params: {
    actor: SyndicateMember;
    locationId: string;
    locationName: string;
    eventType: AuditEventType;
    severity: NotificationSeverity;
    title: string;
    message: string;
    deltaFinancial?: number;
    deltaHeadcount?: number;
    referenceEntityId?: string;
    timestamp?: string;
  }): AuditNotificationEvent {
    const existingSorted = [...this.state.auditNotifications].sort(
      (a, b) => a.sequenceNumber - b.sequenceNumber
    );
    const latestBlock = existingSorted[existingSorted.length - 1];
    const previousHash = latestBlock ? latestBlock.currentHash : GENESIS_SHORT;
    const sequenceNumber = latestBlock ? latestBlock.sequenceNumber + 1 : 1;
    const timestamp = params.timestamp || new Date().toISOString();

    const currentHash = computeAuditEventHash({
      previousHash,
      timestamp,
      actorId: params.actor.id,
      locationId: params.locationId,
      eventType: params.eventType,
      payloadSummary: `${params.title}::${params.message}`,
    });

    const newAuditEvent: AuditNotificationEvent = {
      id: `AUD-${String(sequenceNumber).padStart(3, '0')}-${Date.now().toString(36).toUpperCase()}`,
      sequenceNumber,
      timestamp,
      actorId: params.actor.id,
      actorName: params.actor.fullName,
      actorRole: params.actor.role,
      locationId: params.locationId,
      locationName: params.locationName,
      eventType: params.eventType,
      severity: params.severity,
      title: params.title.slice(0, 160),
      message: params.message.slice(0, 800),
      deltaFinancial: params.deltaFinancial,
      deltaHeadcount: params.deltaHeadcount,
      referenceEntityId: params.referenceEntityId,
      previousHash,
      currentHash,
      readByMemberIds: [params.actor.id],
    };

    void this.persistDocumentToCloudIfActive(
      'audit_notifications',
      newAuditEvent.id,
      newAuditEvent
    );

    if (areSystemNotificationsEnabled()) {
      void dispatchSystemNotification({
        title: `Agro Planner · ${newAuditEvent.title}`,
        body: newAuditEvent.message,
        tag: newAuditEvent.id,
        urgent:
          newAuditEvent.severity === 'URGENT_GROUND' ||
          newAuditEvent.severity === 'WARNING_CONTRA',
        severity: newAuditEvent.severity,
        sequenceNumber: newAuditEvent.sequenceNumber,
      });
    }

    return newAuditEvent;
  }

  // ============================================================================
  // APPEND-ONLY LEDGER MUTATIONS (ZERO EDITS, ZERO DELETES)
  // ============================================================================

  public addLocation(params: {
    name: string;
    region: string;
    gpsCoordinates: string;
    primaryOperatorName: string;
    actor: SyndicateMember;
  }): FarmLocation {
    const now = new Date().toISOString();
    const id = `loc-${Date.now().toString(36)}`;
    const newLoc: FarmLocation = {
      id,
      name: params.name.trim().slice(0, 120),
      region: params.region.trim().slice(0, 120),
      gpsCoordinates: params.gpsCoordinates.trim().slice(0, 80) || '-17.8292, 31.0522',
      primaryOperatorName: params.primaryOperatorName.trim().slice(0, 120),
      createdAt: now,
      createdBy: params.actor.id,
    };

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: newLoc.id,
      locationName: newLoc.name,
      eventType: 'GROUND_BROADCAST',
      severity: 'MILESTONE',
      title: `New Farm Site Registered: ${newLoc.name}`,
      message: `Added ${newLoc.name} (${newLoc.region}) with ground operator ${newLoc.primaryOperatorName}. GPS: ${newLoc.gpsCoordinates}.`,
      referenceEntityId: newLoc.id,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      locations: [...this.state.locations, newLoc],
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('locations', newLoc.id, newLoc);
    return newLoc;
  }

  public addMember(params: {
    fullName: string;
    phoneOrEmail: string;
    role: Role;
    assignedLocationId?: string;
    initialContributionUsd?: number;
    contributionNote?: string;
    actor: SyndicateMember;
  }): SyndicateMember {
    const now = new Date().toISOString();
    const id = `mem-${Date.now().toString(36)}`;
    const contact = params.phoneOrEmail.trim().slice(0, 160);
    const isEmail = contact.includes('@');

    const newMember: SyndicateMember = {
      id,
      email: isEmail ? contact.toLowerCase() : undefined,
      fullName: params.fullName.trim().slice(0, 120),
      phoneOrEmail: contact,
      phone: !isEmail ? contact : undefined,
      role: params.role,
      approvalStatus: 'APPROVED',
      assignedLocationId: params.assignedLocationId || undefined,
      joinedAt: now,
      updatedAt: now,
      active: true,
    };

    const updatedContributions = [...this.state.capitalContributions];
    const updatedAudits = [...this.state.auditNotifications];

    const memberAudit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: params.assignedLocationId || 'ALL',
      locationName:
        this.state.locations.find((l) => l.id === params.assignedLocationId)?.name ||
        'All Locations (Master Syndicate)',
      eventType: 'MEMBER_ADDED',
      severity: 'INFO',
      title: `Pre-Authorized Member Added: ${newMember.fullName}`,
      message: `${newMember.fullName} added to the syndicate as ${newMember.role.replace('_', ' ')} (Approved). Contact: ${newMember.phoneOrEmail}.`,
      referenceEntityId: newMember.id,
      timestamp: now,
    });
    updatedAudits.unshift(memberAudit);
    this.state.auditNotifications = updatedAudits;

    if (params.initialContributionUsd && params.initialContributionUsd > 0) {
      const capId = `TX-CAP-${Date.now().toString(36).toUpperCase()}`;
      const note =
        params.contributionNote?.trim() ||
        `Initial capital contribution by ${newMember.fullName} upon joining syndicate`;
      const capEvent: CapitalContributionEvent = {
        id: capId,
        memberId: newMember.id,
        memberName: newMember.fullName,
        direction: 'INITIAL',
        amount: Number(params.initialContributionUsd.toFixed(2)),
        note,
        createdAt: now,
        createdByMemberId: params.actor.id,
        auditHash: computeLedgerRecordHash('CAPITAL', capId, now, params.initialContributionUsd, note),
      };
      updatedContributions.unshift(capEvent);
      void this.persistDocumentToCloudIfActive('capital_contributions', capEvent.id, capEvent);

      const capAudit = this.createChainedAuditEvent({
        actor: params.actor,
        locationId: 'ALL',
        locationName: 'All Locations (Master Syndicate)',
        eventType: 'CAPITAL_CONTRIBUTION',
        severity: 'FINANCIAL',
        title: `Capital Contributed: +$${capEvent.amount.toFixed(2)} (${newMember.fullName})`,
        message: `${capEvent.id}: ${note}. Added +$${capEvent.amount.toFixed(2)} to Syndicate Pool & Left Money.`,
        deltaFinancial: capEvent.amount,
        referenceEntityId: capEvent.id,
      });
      updatedAudits.unshift(capAudit);
    }

    const nextState: AgroStateSnapshot = {
      ...this.state,
      members: [...this.state.members, newMember],
      capitalContributions: updatedContributions,
      auditNotifications: updatedAudits,
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('members', newMember.id, newMember);
    return newMember;
  }

  public logCapitalContribution(params: {
    memberId: string;
    direction: 'ADDITION' | 'CONTRA_REVERSAL';
    amount: number;
    referenceTransactionId?: string;
    note: string;
    actor: SyndicateMember;
  }): CapitalContributionEvent {
    const member = this.state.members.find((m) => m.id === params.memberId);
    if (!member) throw new Error('Selected member not found.');
    if (params.note.trim().length < 4) {
      throw new Error('A mandatory explanation note (at least 4 characters) is required.');
    }

    const now = new Date().toISOString();
    const id = `TX-CAP-${Date.now().toString(36).toUpperCase()}${params.direction === 'CONTRA_REVERSAL' ? '-CONTRA' : ''}`;
    const cleanAmount = Number(params.amount.toFixed(2));
    const cleanNote = params.note.trim().slice(0, 500);

    const newEvent: CapitalContributionEvent = {
      id,
      memberId: member.id,
      memberName: member.fullName,
      direction: params.direction,
      amount: cleanAmount,
      referenceTransactionId: params.referenceTransactionId,
      note: cleanNote,
      createdAt: now,
      createdByMemberId: params.actor.id,
      auditHash: computeLedgerRecordHash(
        'CAPITAL',
        id,
        now,
        cleanAmount,
        cleanNote,
        params.referenceTransactionId
      ),
    };

    const isContra = params.direction === 'CONTRA_REVERSAL';
    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: 'ALL',
      locationName: 'All Locations (Master Syndicate)',
      eventType: isContra ? 'CAPITAL_CONTRA' : 'CAPITAL_CONTRIBUTION',
      severity: isContra ? 'WARNING_CONTRA' : 'FINANCIAL',
      title: isContra
        ? `Capital Contra-Entry (${cleanAmount >= 0 ? '+' : ''}$${cleanAmount.toFixed(2)} for ${member.fullName})`
        : `Capital Contribution: +$${cleanAmount.toFixed(2)} by ${member.fullName}`,
      message: isContra
        ? `${id} referencing ${params.referenceTransactionId}: ${cleanNote}. Equity pool adjusted by ${cleanAmount >= 0 ? '+' : ''}$${cleanAmount.toFixed(2)}.`
        : `${id}: ${cleanNote}. Added +$${cleanAmount.toFixed(2)} to Syndicate Pool & Left Money.`,
      deltaFinancial: cleanAmount,
      referenceEntityId: id,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      capitalContributions: [newEvent, ...this.state.capitalContributions],
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('capital_contributions', newEvent.id, newEvent);
    return newEvent;
  }

  public logExpense(params: {
    locationId: string;
    batchOrAnimalId?: string;
    category: ExpenseCategory;
    direction: 'DEDUCTION' | 'CONTRA_REVERSAL';
    amount: number;
    referenceTransactionId?: string;
    note: string;
    gpsStamp?: string;
    receiptPhotoDataUrl?: string;
    actor: SyndicateMember;
  }): ExpenseLedgerEvent {
    const loc = this.state.locations.find((l) => l.id === params.locationId);
    if (!loc) throw new Error('Farm location is required.');
    if (params.note.trim().length < 4) {
      throw new Error('Mandatory detailed note is required explaining what the money was used for.');
    }

    const now = new Date().toISOString();
    const isContra = params.direction === 'CONTRA_REVERSAL';
    const id = `TX-EXP-${Date.now().toString(36).toUpperCase()}${isContra ? '-CONTRA' : ''}`;
    const cleanAmount = Number(params.amount.toFixed(2));
    const cleanNote = params.note.trim().slice(0, 500);

    const requiresMultiSig = !isContra && cleanAmount > 150;
    const approvalStatus = requiresMultiSig ? 'PENDING_MULTISIG' : 'APPROVED';

    const newExpense: ExpenseLedgerEvent = {
      id,
      locationId: loc.id,
      locationName: loc.name,
      batchOrAnimalId: params.batchOrAnimalId || undefined,
      category: params.category,
      direction: params.direction,
      amount: cleanAmount,
      referenceTransactionId: params.referenceTransactionId,
      note: cleanNote,
      loggedByMemberId: params.actor.id,
      loggedByName: params.actor.fullName,
      gpsStamp: params.gpsStamp || loc.gpsCoordinates,
      receiptPhotoDataUrl: params.receiptPhotoDataUrl,
      approvalStatus,
      approvedByMemberIds: [params.actor.id],
      createdAt: now,
      auditHash: computeLedgerRecordHash(
        'EXPENSE',
        id,
        now,
        cleanAmount,
        cleanNote,
        params.referenceTransactionId
      ),
    };

    const leftMoneyImpact = -cleanAmount;

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: loc.id,
      locationName: loc.name,
      eventType: isContra ? 'EXPENSE_CONTRA' : 'EXPENSE_LOGGED',
      severity: isContra ? 'WARNING_CONTRA' : requiresMultiSig ? 'URGENT_GROUND' : 'FINANCIAL',
      title: isContra
        ? `Expense Contra-Reversal (${leftMoneyImpact >= 0 ? '+' : ''}$${leftMoneyImpact.toFixed(2)} Left Money)`
        : requiresMultiSig
        ? `Multi-Sig Approval Needed: $${cleanAmount.toFixed(2)} (${params.category.replace('_', ' ')})`
        : `Expense Deducted: -$${cleanAmount.toFixed(2)} (${params.category.replace('_', ' ')})`,
      message: isContra
        ? `${id} linked to ${params.referenceTransactionId}: ${cleanNote}. Left Money impact: ${leftMoneyImpact >= 0 ? '+' : ''}$${leftMoneyImpact.toFixed(2)}.`
        : `${id} at ${loc.name}: ${cleanNote}${requiresMultiSig ? ' [Status: PENDING MULTI-SIG APPROVAL > $150]' : ' [Deducted from Left Money]'}.`,
      deltaFinancial: leftMoneyImpact,
      referenceEntityId: id,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      expenses: [newExpense, ...this.state.expenses],
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('expense_ledger', newExpense.id, newExpense);
    return newExpense;
  }

  public approveMultiSigExpense(expenseId: string, actor: SyndicateMember): void {
    const target = this.state.expenses.find((e) => e.id === expenseId);
    if (!target) throw new Error('Expense transaction not found.');
    if (target.approvalStatus === 'APPROVED') return;

    const updatedApprovedBy = Array.from(new Set([...target.approvedByMemberIds, actor.id]));
    const updatedExpense: ExpenseLedgerEvent = {
      ...target,
      approvalStatus: 'APPROVED',
      approvedByMemberIds: updatedApprovedBy,
    };

    const audit = this.createChainedAuditEvent({
      actor,
      locationId: target.locationId,
      locationName: target.locationName,
      eventType: 'EXPENSE_APPROVED',
      severity: 'FINANCIAL',
      title: `Multi-Sig Expense Approved: -$${target.amount.toFixed(2)}`,
      message: `${actor.fullName} (${actor.role}) approved ${target.id} ($${target.amount.toFixed(2)} — ${target.note}). Deducted from Left Money.`,
      deltaFinancial: -target.amount,
      referenceEntityId: target.id,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      expenses: this.state.expenses.map((e) => (e.id === expenseId ? updatedExpense : e)),
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    if (this.cloudSyncActive && this.currentUser && firestoreDb) {
      updateDoc(doc(firestoreDb, 'expense_ledger', expenseId), {
        approvalStatus: 'APPROVED',
        approvedByMemberIds: updatedApprovedBy,
      }).catch((err) => console.warn('Cloud expense approval update warning:', err));
    }
  }

  public registerLivestock(params: {
    locationId: string;
    species: string;
    nameOrTag: string;
    trackingMode: TrackingMode;
    entryDate: string;
    initialAgeValue: number;
    initialAgeUnit: DurationUnit;
    targetDurationValue: number;
    targetDurationUnit: DurationUnit;
    initialHeadcount: number;
    purchaseCostTotal: number;
    targetSaleWeightKg?: number;
    notes: string;
    autoDeductPurchaseFromLeftMoney: boolean;
    actor: SyndicateMember;
  }): LivestockEntry {
    const loc = this.state.locations.find((l) => l.id === params.locationId);
    if (!loc) throw new Error('Valid farm location is required.');
    if (params.notes.trim().length < 4) {
      throw new Error('Mandatory notes (at least 4 characters) are required.');
    }

    const now = new Date().toISOString();
    const id = `LSTK-${Date.now().toString(36).toUpperCase()}`;
    const targetSaleDate = computeTargetSaleDate(
      params.entryDate,
      params.targetDurationValue,
      params.targetDurationUnit
    );

    const newEntry: LivestockEntry = {
      id,
      locationId: loc.id,
      locationName: loc.name,
      species: params.species.trim().slice(0, 80),
      nameOrTag: params.nameOrTag.trim().slice(0, 140),
      trackingMode: params.trackingMode,
      entryDate: params.entryDate,
      initialAgeValue: params.initialAgeValue,
      initialAgeUnit: params.initialAgeUnit,
      targetDurationValue: params.targetDurationValue,
      targetDurationUnit: params.targetDurationUnit,
      targetSaleDate,
      initialHeadcount: params.initialHeadcount,
      purchaseCostTotal: params.purchaseCostTotal,
      targetSaleWeightKg: params.targetSaleWeightKg,
      notes: params.notes.trim().slice(0, 500),
      createdByMemberName: params.actor.fullName,
      createdAt: now,
    };

    const initEventId = `EV-LSTK-${Date.now().toString(36).toUpperCase()}`;
    const initialLifecycleEvent: LivestockLifecycleEvent = {
      id: initEventId,
      livestockId: newEntry.id,
      livestockName: newEntry.nameOrTag,
      locationId: loc.id,
      eventType: 'INITIAL_STOCK',
      headcountDelta: params.initialHeadcount,
      note: `Initial registration of ${params.initialHeadcount}x ${newEntry.species} (${newEntry.nameOrTag}). ${params.notes.trim()}`,
      loggedByName: params.actor.fullName,
      createdAt: now,
      auditHash: computeLedgerRecordHash(
        'LIVESTOCK_EVENT',
        initEventId,
        now,
        params.initialHeadcount,
        params.notes.trim()
      ),
    };

    const updatedAudits = [...this.state.auditNotifications];
    const updatedExpenses = [...this.state.expenses];

    const regAudit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: loc.id,
      locationName: loc.name,
      eventType: 'LIVESTOCK_REGISTERED',
      severity: 'MILESTONE',
      title: `Registered ${params.initialHeadcount}x ${newEntry.species}: ${newEntry.nameOrTag}`,
      message: `${newEntry.nameOrTag} (${params.trackingMode}) stocked at ${loc.name}. Target duration: ${params.targetDurationValue} ${params.targetDurationUnit.toLowerCase()}. Notes: ${newEntry.notes}`,
      deltaHeadcount: params.initialHeadcount,
      deltaFinancial: params.autoDeductPurchaseFromLeftMoney ? -params.purchaseCostTotal : 0,
      referenceEntityId: newEntry.id,
      timestamp: now,
    });
    updatedAudits.unshift(regAudit);
    this.state.auditNotifications = updatedAudits;

    if (params.autoDeductPurchaseFromLeftMoney && params.purchaseCostTotal > 0) {
      const expId = `TX-EXP-${Date.now().toString(36).toUpperCase()}`;
      const expNote = `Auto-logged livestock acquisition cost for ${params.initialHeadcount}x ${newEntry.nameOrTag} (${newEntry.species}) at ${loc.name}.`;
      const expEvent: ExpenseLedgerEvent = {
        id: expId,
        locationId: loc.id,
        locationName: loc.name,
        batchOrAnimalId: newEntry.id,
        category: 'LIVESTOCK_PURCHASE',
        direction: 'DEDUCTION',
        amount: Number(params.purchaseCostTotal.toFixed(2)),
        note: expNote,
        loggedByMemberId: params.actor.id,
        loggedByName: params.actor.fullName,
        gpsStamp: loc.gpsCoordinates,
        approvalStatus: 'APPROVED',
        approvedByMemberIds: [params.actor.id],
        createdAt: now,
        auditHash: computeLedgerRecordHash('EXPENSE', expId, now, params.purchaseCostTotal, expNote),
      };
      updatedExpenses.unshift(expEvent);
      void this.persistDocumentToCloudIfActive('expense_ledger', expEvent.id, expEvent);
    }

    const nextState: AgroStateSnapshot = {
      ...this.state,
      livestockEntries: [newEntry, ...this.state.livestockEntries],
      livestockEvents: [initialLifecycleEvent, ...this.state.livestockEvents],
      expenses: updatedExpenses,
      auditNotifications: updatedAudits,
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('livestock_entries', newEntry.id, newEntry);
    void this.persistDocumentToCloudIfActive(
      'livestock_lifecycle_events',
      initialLifecycleEvent.id,
      initialLifecycleEvent
    );
    return newEntry;
  }

  public logLivestockLifecycleEvent(params: {
    livestockId: string;
    eventType: LivestockLifecycleEvent['eventType'];
    headcountDelta: number;
    weightAvgKg?: number;
    saleRevenueAmount?: number;
    reinvestmentPercentage?: number;
    referenceTransactionId?: string;
    note: string;
    actor: SyndicateMember;
  }): LivestockLifecycleEvent {
    const entry = this.state.livestockEntries.find((l) => l.id === params.livestockId);
    if (!entry) throw new Error('Livestock batch or animal not found.');
    if (params.note.trim().length < 4) {
      throw new Error('Mandatory note (at least 4 characters) is required.');
    }

    const now = new Date().toISOString();
    const id = `EV-LSTK-${Date.now().toString(36).toUpperCase()}`;
    const cleanNote = params.note.trim().slice(0, 500);

    const newEvent: LivestockLifecycleEvent = {
      id,
      livestockId: entry.id,
      livestockName: entry.nameOrTag,
      locationId: entry.locationId,
      eventType: params.eventType,
      headcountDelta: params.headcountDelta,
      weightAvgKg: params.weightAvgKg,
      saleRevenueAmount: params.saleRevenueAmount,
      reinvestmentPercentage: params.reinvestmentPercentage,
      referenceTransactionId: params.referenceTransactionId,
      note: cleanNote,
      loggedByName: params.actor.fullName,
      createdAt: now,
      auditHash: computeLedgerRecordHash(
        'LIVESTOCK_EVENT',
        id,
        now,
        params.headcountDelta,
        cleanNote,
        params.referenceTransactionId
      ),
    };

    let auditType: AuditEventType = 'GROUND_BROADCAST';
    let severity: NotificationSeverity = 'INFO';
    let title = `${entry.nameOrTag}: ${params.eventType.replace(/_/g, ' ')}`;
    let deltaFinancial: number | undefined = undefined;

    if (params.eventType === 'MORTALITY_LOSS') {
      auditType = 'LIVESTOCK_MORTALITY';
      severity = 'URGENT_GROUND';
      title = `Mortality Logged: ${params.headcountDelta} in ${entry.nameOrTag}`;
    } else if (params.eventType === 'BIRTH_OFFSPRING') {
      auditType = 'LIVESTOCK_BIRTH';
      severity = 'MILESTONE';
      title = `New Offspring Born: +${params.headcountDelta} in ${entry.nameOrTag}`;
    } else if (params.eventType === 'SALE_DISPATCH') {
      auditType = 'LIVESTOCK_SALE';
      severity = 'FINANCIAL';
      const rev = params.saleRevenueAmount || 0;
      const reinvPct = params.reinvestmentPercentage ?? 100;
      const reinvestedUsd = Number((rev * (reinvPct / 100)).toFixed(2));
      deltaFinancial = reinvestedUsd;
      title = `Livestock Sale: $${rev.toFixed(2)} (${Math.abs(params.headcountDelta)} sold from ${entry.nameOrTag})`;
    } else if (params.eventType === 'HEADCOUNT_CONTRA_ADJUSTMENT') {
      auditType = 'LIVESTOCK_CONTRA';
      severity = 'WARNING_CONTRA';
      title = `Headcount Contra-Adjustment (${params.headcountDelta >= 0 ? '+' : ''}${params.headcountDelta}) on ${entry.nameOrTag}`;
    } else if (params.eventType === 'VACCINATION_HEALTH' || params.eventType === 'WEIGHT_CHECK') {
      auditType = 'GROUND_BROADCAST';
      severity = 'INFO';
      title = `${params.eventType === 'WEIGHT_CHECK' ? 'Weight Check' : 'Health Protocol'}: ${entry.nameOrTag}`;
    }

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: entry.locationId,
      locationName: entry.locationName,
      eventType: auditType,
      severity,
      title,
      message: `${id}${params.referenceTransactionId ? ` (Ref: ${params.referenceTransactionId})` : ''}: ${cleanNote}`,
      deltaFinancial,
      deltaHeadcount: params.headcountDelta !== 0 ? params.headcountDelta : undefined,
      referenceEntityId: id,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      livestockEvents: [newEvent, ...this.state.livestockEvents],
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('livestock_lifecycle_events', newEvent.id, newEvent);
    return newEvent;
  }

  public logFixedAssetEvent(params: {
    assetGroupId?: string;
    assetName: string;
    category: FixedAssetCategory;
    locationId: string;
    direction: FixedAssetLedgerEvent['direction'];
    quantityDelta: number;
    valueDelta: number;
    condition: AssetCondition;
    referenceTransactionId?: string;
    note: string;
    deductFromLeftMoney?: boolean;
    actor: SyndicateMember;
  }): FixedAssetLedgerEvent {
    const loc = this.state.locations.find((l) => l.id === params.locationId);
    if (!loc) throw new Error('Valid farm location is required.');
    if (params.note.trim().length < 4) {
      throw new Error('Mandatory note is required for fixed asset ledger events.');
    }

    const now = new Date().toISOString();
    const id = `AST-EV-${Date.now().toString(36).toUpperCase()}`;
    const groupId = params.assetGroupId || `AGRP-${Date.now().toString(36).toUpperCase()}`;
    const cleanNote = params.note.trim().slice(0, 500);

    const newAssetEvent: FixedAssetLedgerEvent = {
      id,
      assetGroupId: groupId,
      assetName: params.assetName.trim().slice(0, 140),
      category: params.category,
      locationId: loc.id,
      direction: params.direction,
      quantityDelta: params.quantityDelta,
      valueDelta: Number(params.valueDelta.toFixed(2)),
      condition: params.condition,
      referenceTransactionId: params.referenceTransactionId,
      note: cleanNote,
      loggedByName: params.actor.fullName,
      createdAt: now,
      auditHash: computeLedgerRecordHash(
        'ASSET',
        id,
        now,
        params.valueDelta,
        cleanNote,
        params.referenceTransactionId
      ),
    };

    const isContra =
      params.direction === 'CONTRA_REVERSAL' || params.direction === 'DEDUCTION';
    const updatedAudits = [...this.state.auditNotifications];
    const updatedExpenses = [...this.state.expenses];

    const assetAudit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: loc.id,
      locationName: loc.name,
      eventType: isContra ? 'ASSET_CONTRA' : 'ASSET_LOGGED',
      severity: isContra ? 'WARNING_CONTRA' : 'FINANCIAL',
      title: isContra
        ? `Fixed Asset Adjustment: ${newAssetEvent.assetName} (${params.valueDelta >= 0 ? '+' : ''}$${params.valueDelta.toFixed(2)})`
        : `Fixed Asset Logged: ${newAssetEvent.assetName} ($${params.valueDelta.toFixed(2)})`,
      message: `${id} at ${loc.name}: Qty ${params.quantityDelta >= 0 ? '+' : ''}${params.quantityDelta}, Val ${params.valueDelta >= 0 ? '+' : ''}$${params.valueDelta.toFixed(2)}. Note: ${cleanNote}`,
      deltaFinancial: params.deductFromLeftMoney ? -Math.abs(params.valueDelta) : undefined,
      referenceEntityId: id,
      timestamp: now,
    });
    updatedAudits.unshift(assetAudit);
    this.state.auditNotifications = updatedAudits;

    if (params.deductFromLeftMoney && params.valueDelta > 0) {
      const expId = `TX-EXP-${Date.now().toString(36).toUpperCase()}`;
      const expNote = `Fixed asset acquisition: ${newAssetEvent.assetName} (${params.quantityDelta} units) at ${loc.name}. ${cleanNote}`;
      const expEvent: ExpenseLedgerEvent = {
        id: expId,
        locationId: loc.id,
        locationName: loc.name,
        category: 'FIXED_ASSET_PURCHASE',
        direction: 'DEDUCTION',
        amount: Number(params.valueDelta.toFixed(2)),
        note: expNote.slice(0, 500),
        loggedByMemberId: params.actor.id,
        loggedByName: params.actor.fullName,
        gpsStamp: loc.gpsCoordinates,
        approvalStatus: 'APPROVED',
        approvedByMemberIds: [params.actor.id],
        createdAt: now,
        auditHash: computeLedgerRecordHash('EXPENSE', expId, now, params.valueDelta, expNote),
      };
      updatedExpenses.unshift(expEvent);
      void this.persistDocumentToCloudIfActive('expense_ledger', expEvent.id, expEvent);
    }

    const nextState: AgroStateSnapshot = {
      ...this.state,
      fixedAssets: [newAssetEvent, ...this.state.fixedAssets],
      expenses: updatedExpenses,
      auditNotifications: updatedAudits,
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('fixed_assets_ledger', newAssetEvent.id, newAssetEvent);
    return newAssetEvent;
  }

  public transferFixedAssetBetweenLocations(params: {
    assetGroupId: string;
    assetName: string;
    category: FixedAssetCategory;
    fromLocationId: string;
    toLocationId: string;
    quantityToTransfer: number;
    valueToTransfer: number;
    condition: AssetCondition;
    note: string;
    actor: SyndicateMember;
  }): { outEvent: FixedAssetLedgerEvent; inEvent: FixedAssetLedgerEvent } {
    if (params.fromLocationId === params.toLocationId) {
      throw new Error('Destination location must be different from origin location.');
    }
    const fromLoc = this.state.locations.find((l) => l.id === params.fromLocationId);
    const toLoc = this.state.locations.find((l) => l.id === params.toLocationId);
    if (!fromLoc || !toLoc) throw new Error('Invalid origin or destination location.');
    if (params.note.trim().length < 4) {
      throw new Error('Mandatory transfer reason note is required.');
    }

    const now = new Date().toISOString();
    const outId = `AST-TR-OUT-${Date.now().toString(36).toUpperCase()}`;
    const inId = `AST-TR-IN-${Date.now().toString(36).toUpperCase()}`;
    const cleanNote = params.note.trim().slice(0, 450);

    const outEvent: FixedAssetLedgerEvent = {
      id: outId,
      assetGroupId: params.assetGroupId,
      assetName: params.assetName,
      category: params.category,
      locationId: fromLoc.id,
      direction: 'TRANSFER_OUT',
      quantityDelta: -Math.abs(params.quantityToTransfer),
      valueDelta: -Math.abs(Number(params.valueToTransfer.toFixed(2))),
      condition: params.condition,
      note: `TRANSFER OUT to ${toLoc.name}: ${cleanNote}`,
      loggedByName: params.actor.fullName,
      createdAt: now,
      auditHash: computeLedgerRecordHash(
        'ASSET_TRANSFER_OUT',
        outId,
        now,
        -Math.abs(params.valueToTransfer),
        cleanNote
      ),
    };

    const inEvent: FixedAssetLedgerEvent = {
      id: inId,
      assetGroupId: params.assetGroupId,
      assetName: params.assetName,
      category: params.category,
      locationId: toLoc.id,
      direction: 'TRANSFER_IN',
      quantityDelta: Math.abs(params.quantityToTransfer),
      valueDelta: Math.abs(Number(params.valueToTransfer.toFixed(2))),
      condition: params.condition,
      referenceTransactionId: outId,
      note: `TRANSFER IN from ${fromLoc.name}: ${cleanNote}`,
      loggedByName: params.actor.fullName,
      createdAt: now,
      auditHash: computeLedgerRecordHash(
        'ASSET_TRANSFER_IN',
        inId,
        now,
        Math.abs(params.valueToTransfer),
        cleanNote,
        outId
      ),
    };

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: toLoc.id,
      locationName: `${fromLoc.name} → ${toLoc.name}`,
      eventType: 'ASSET_LOGGED',
      severity: 'MILESTONE',
      title: `Inter-Site Transfer: ${params.quantityToTransfer}x ${params.assetName}`,
      message: `Paired append-only transfer (${outId} & ${inId}) from ${fromLoc.name} to ${toLoc.name} ($${params.valueToTransfer.toFixed(2)}). Note: ${cleanNote}`,
      referenceEntityId: inId,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      fixedAssets: [inEvent, outEvent, ...this.state.fixedAssets],
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('fixed_assets_ledger', outEvent.id, outEvent);
    void this.persistDocumentToCloudIfActive('fixed_assets_ledger', inEvent.id, inEvent);
    return { outEvent, inEvent };
  }

  public logFeedEvent(params: {
    locationId: string;
    feedType: string;
    direction: FeedLedgerEvent['direction'];
    bagsDelta: number;
    kgPerBag: number;
    linkedLivestockId?: string;
    referenceTransactionId?: string;
    note: string;
    actor: SyndicateMember;
  }): FeedLedgerEvent {
    const loc = this.state.locations.find((l) => l.id === params.locationId);
    if (!loc) throw new Error('Valid farm location is required.');
    if (params.note.trim().length < 4) {
      throw new Error('Mandatory note (at least 4 characters) is required.');
    }

    const now = new Date().toISOString();
    const id = `FD-EV-${Date.now().toString(36).toUpperCase()}`;
    const cleanNote = params.note.trim().slice(0, 500);
    const signedBags =
      params.direction === 'DAILY_CONSUMPTION'
        ? -Math.abs(params.bagsDelta)
        : params.direction === 'STOCK_IN'
        ? Math.abs(params.bagsDelta)
        : params.bagsDelta;

    const newFeedEvent: FeedLedgerEvent = {
      id,
      locationId: loc.id,
      feedType: params.feedType.trim().slice(0, 120),
      direction: params.direction,
      bagsDelta: Number(signedBags.toFixed(2)),
      kgPerBag: params.kgPerBag || 50,
      linkedLivestockId: params.linkedLivestockId || undefined,
      referenceTransactionId: params.referenceTransactionId,
      note: cleanNote,
      loggedByName: params.actor.fullName,
      createdAt: now,
      auditHash: computeLedgerRecordHash(
        'FEED',
        id,
        now,
        signedBags,
        cleanNote,
        params.referenceTransactionId
      ),
    };

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: loc.id,
      locationName: loc.name,
      eventType: 'FEED_LOGGED',
      severity: params.direction === 'CONTRA_REVERSAL' ? 'WARNING_CONTRA' : 'INFO',
      title: `Feed ${params.direction.replace('_', ' ')}: ${signedBags >= 0 ? '+' : ''}${signedBags} bags ${newFeedEvent.feedType}`,
      message: `${id} at ${loc.name}: ${signedBags >= 0 ? '+' : ''}${signedBags} bags (${Math.abs(signedBags * newFeedEvent.kgPerBag).toFixed(0)}kg). Note: ${cleanNote}`,
      referenceEntityId: id,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      feedLedger: [newFeedEvent, ...this.state.feedLedger],
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('feed_ledger', newFeedEvent.id, newFeedEvent);
    return newFeedEvent;
  }

  public postGroundBroadcast(params: {
    locationId: string;
    severity: NotificationSeverity;
    title: string;
    message: string;
    actor: SyndicateMember;
  }): AuditNotificationEvent {
    if (params.message.trim().length < 4) {
      throw new Error('Broadcast message must be at least 4 characters.');
    }
    const locName =
      params.locationId === 'ALL'
        ? 'All Locations (Master Syndicate)'
        : this.state.locations.find((l) => l.id === params.locationId)?.name || 'Farm Site';

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: params.locationId,
      locationName: locName,
      eventType: 'GROUND_BROADCAST',
      severity: params.severity,
      title: params.title.trim() || `Ground Update from ${params.actor.fullName}`,
      message: params.message.trim(),
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    return audit;
  }

  public markAllNotificationsRead(memberId: string): void {
    const updated = this.state.auditNotifications.map((n) => {
      if (n.readByMemberIds.includes(memberId)) return n;
      const nextRead = [...n.readByMemberIds, memberId];
      if (this.cloudSyncActive && this.currentUser && firestoreDb) {
        updateDoc(doc(firestoreDb, 'audit_notifications', n.id), {
          readByMemberIds: nextRead,
        }).catch((err) => console.warn('Cloud notification read update warning:', err));
      }
      return { ...n, readByMemberIds: nextRead };
    });

    this.saveLocalState({
      ...this.state,
      auditNotifications: updated,
    });
  }
}

export const dataService = new AgroDataService();
