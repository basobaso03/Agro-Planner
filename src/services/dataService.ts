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
  signInWithCredential,
  signInAnonymously,
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
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDocFromServer,
  getDocsFromServer,
  query,
  where,
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
  CheckpointCategory,
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
  OrgMember,
  TrackingMode,
  AnimalCheckpoint,
  FarmRecipeTemplate,
  DebtLiabilityEvent,
  DebtCategory,
  DebtRepaymentLog,
  LoanGivenEvent,
  LoanCategory,
  LoanRecoveryLog,
  CreditSaleEvent,
  CreditSalePaymentLog,
  CreditSaleDateExtensionLog,
  LivestockComputedStatus,
  FixedAssetGroupSummary,
  FeedInventorySummary,
  MemberEquitySummary,
  FinancialSummary,
} from '../types/agro.ts';
import type { Organization, OrganizationType } from '../types/organization.ts';
import { createEmptyProductionSnapshot, LEGACY_SEED_IDS } from '../data/seedData.ts';
import {
  computeAuditEventHash,
  computeLedgerRecordHash,
  sha256Hex,
  GENESIS_SHORT,
} from '../utils/cryptoHash.ts';
import {
  computeTargetSaleDate,
  computeLivestockStatus,
  generateVaccinationProtocols,
  computeFinancialSummary,
  computeFixedAssetGroups,
  computeFeedInventories,
  computeMemberEquities,
} from '../utils/calculations.ts';
import {
  areSystemNotificationsEnabled,
  dispatchSystemNotification,
  verifyDeviceBiometric,
} from '../utils/mobileHardware.ts';
import { compressImage } from '../utils/imageUpload.ts';
import { PERMISSIONS } from '../utils/permissions.ts';
import type {
  RunwayPlan,
  RunwayLine,
  RunwayPledge,
  RunwayPaymentClaim,
  RunwayTemplate,
  RunwayAllocation,
  RunwayMilestoneKey,
  RunwayPlanStatus,
  RunwayEnforcement,
  RunwayMode,
  RunwayTargetBasis,
  ContingencyMode,
  RunwayLinePriority,
  RunwayPhase,
} from '../types/runway.ts';
import { RunwayError } from '../types/runway.ts';
import {
  evaluateSpend,
  computeAvailableCash,
  computePlanTotals,
  computeFundingLayers,
  detectMilestones,
  deriveLineStatuses,
  round2,
  computeRecovery,
  computeRunwayMonths,
} from '../utils/runway.ts';
import { outboxService } from './outbox.ts';
import { appStorage } from './storage.ts';
import { nativeReminders } from '../native/reminders.ts';

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
  activeOrgId?: string;
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

export interface StoredCredentialRecord {
  verifierHash: string;
  hasPasswordSetup: boolean;
  updatedAt: string;
}

export function getStoredLocalCredentials(): Record<string, StoredCredentialRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_CREDENTIALS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function hasPasswordConfigured(member?: OrgMember | null): boolean {
  if (!member) return false;
  const email = (member.email || member.phoneOrEmail || '').trim().toLowerCase();
  const creds = getStoredLocalCredentials();
  return Boolean(
    member.hasPasswordSetup ||
    member.passwordVerifierHash ||
    (email && creds[email]?.hasPasswordSetup) ||
    (email && creds[email]?.verifierHash) ||
    (member.authProviders && member.authProviders.includes('password'))
  );
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
  const list = LEGACY_SEED_IDS[collectionKey] as readonly string[];
  return Array.isArray(list) && list.includes(id);
}

function sanitizeSnapshotOfLegacySeed(snapshot: AgroStateSnapshot): AgroStateSnapshot {
  return {
    organizations: snapshot.organizations || [],
    activeOrgId: snapshot.activeOrgId,
    customRecipes: snapshot.customRecipes || [],
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
    debtLiabilities: snapshot.debtLiabilities || [],
    loansGiven: snapshot.loansGiven || [],
    creditSales: snapshot.creditSales || [],
    runwayPlans: snapshot.runwayPlans || [],
    runwayLines: snapshot.runwayLines || [],
    runwayPledges: snapshot.runwayPledges || [],
    runwayClaims: snapshot.runwayClaims || [],
    runwayTemplates: snapshot.runwayTemplates || [],
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
  private isSigningOut = false;

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

    // Configure persistent Outbox executor for cloud persistence
    outboxService.setExecutor(async (item) => {
      if (!firestoreDb) {
        initFirebaseInstance(this.getCustomFirebaseConfig());
      }
      if (!firestoreDb) throw new Error('Firestore is not available');
      if (item.collectionPath !== 'members') {
        await this.ensureCloudAuthUserAndMemberSynced(item.data?.orgId);
      }
      await setDoc(doc(firestoreDb, item.collectionPath, item.docId), item.data);
    });

    const customCfg = this.getCustomFirebaseConfig();
    const fb = initFirebaseInstance(customCfg);
    if (fb && fb.db) {
      void this.testConnection(fb.db);
      // Immediately connect live real-time listeners for all 9 collections
      this.attachCloudListeners(fb.db, this.currentUser?.uid || this.activeSession?.uid || 'active');

      // When the app resumes from background or closed state, immediately catch up on cloud notifications
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' && !this.isSigningOut && firestoreDb) {
            void this.syncWithCloudServer().catch(() => {
              // Ignore transient resume network error
            });
          }
        });
      }

      if (fb.auth) {
        onAuthStateChanged(fb.auth, (user) => {
          this.currentUser = user;
          this.authListeners.forEach((cb) => cb(user));
          if (user && !user.isAnonymous && !this.isSigningOut && fb.db) {
            void (async () => {
              const providers = user.providerData.map((p) => p.providerId).filter(Boolean);
              const email = (user.email || '').trim().toLowerCase();
              const cloudMem = await this.fetchAuthoritativeCloudMember(user.uid, email);
              if (this.isSigningOut || !this.currentUser || this.currentUser.uid !== user.uid) {
                return;
              }

              // STRICT ONLINE VALIDATION ON APP RESTART:
              // If the user has a Firebase Auth session but their record was wiped/deleted from Cloud Firestore,
              // immediately terminate the local session and require them to register again.
              if (!cloudMem && email !== PRIMARY_ADMIN_EMAIL) {
                await this.signOutCloud();
                return;
              }
              const existingMem = cloudMem || this.findMemberByUidOrEmail(user.uid, email);
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
                displayName: existingMem?.fullName || user.displayName || email.split('@')[0] || 'Member',
                emailVerified: user.emailVerified || providers.includes('google.com'),
                providers: mergedProviders.length > 0 ? mergedProviders : ['google.com'],
                isCloudAuth: true,
                activeOrgId: existingMem?.orgId || undefined,
              };
              this.setActiveSession(nextSession);
              this.attachCloudListeners(fb.db!, user.uid);
              this.ensureAuthenticatedMemberProfile({
                uid: nextSession.uid,
                email: nextSession.email,
                fullName: nextSession.displayName,
                providers: nextSession.providers,
                passwordVerifierHash: creds[email]?.verifierHash || existingMem?.passwordVerifierHash,
              });
              // Automatically retry any pending or failed outbox items now that cloud auth is active
              outboxService.retryFailed();
            })();
          }
          // Do NOT detach real-time listeners on mobile app startup or guest mode;
          // Listeners are only detached when the user explicitly clicks "Sign Out" via signOutCloud()
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

          // Purge requested user accounts from local state and credentials
          const PURGED_EMAILS = ['neetresearch25@gmail.com'];
          try {
            const storedCreds = getStoredLocalCredentials();
            let credsChanged = false;
            for (const pe of PURGED_EMAILS) {
              if (storedCreds[pe]) {
                delete storedCreds[pe];
                credsChanged = true;
              }
            }
            if (credsChanged) {
              window.localStorage.setItem(LOCAL_CREDENTIALS_STORAGE_KEY, JSON.stringify(storedCreds));
            }
            const sessRaw = window.localStorage.getItem(SESSION_STORAGE_KEY);
            if (sessRaw) {
              const sess = JSON.parse(sessRaw);
              if (sess && PURGED_EMAILS.includes((sess.email || '').trim().toLowerCase())) {
                window.localStorage.removeItem(SESSION_STORAGE_KEY);
                window.localStorage.removeItem('agro_active_org_id');
                window.localStorage.removeItem('agro_planner_active_org_id');
              }
            }
          } catch {}

          const creds = getStoredLocalCredentials();
          const filteredMembers = (cleaned.members || []).filter((m) => {
            const em = (m.email || m.phoneOrEmail || '').trim().toLowerCase();
            return !PURGED_EMAILS.includes(em);
          });
          const enrichedMembers = filteredMembers.map((m) => {
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

          // Remove duplicate un-org'd member profiles when an org-scoped profile exists for the same uid or email
          const orgBoundKeys = new Set<string>();
          for (const m of enrichedMembers) {
            if (m.orgId) {
              if (m.uid) orgBoundKeys.add(`uid:${m.uid}`);
              const em = (m.email || m.phoneOrEmail || '').trim().toLowerCase();
              if (em) orgBoundKeys.add(`email:${em}`);
            }
          }
          cleaned.members = enrichedMembers.filter((m) => {
            if (m.orgId) return true;
            if (m.uid && orgBoundKeys.has(`uid:${m.uid}`)) return false;
            const em = (m.email || m.phoneOrEmail || '').trim().toLowerCase();
            if (em && orgBoundKeys.has(`email:${em}`)) return false;
            return true;
          });

          // Backfill orgId on any expenses missing orgId (e.g. from fixed asset purchases)
          const locOrgMap = new Map<string, string>();
          for (const l of cleaned.locations || []) {
            if (l.orgId) locOrgMap.set(l.id, l.orgId);
          }
          const planOrgMap = new Map<string, string>();
          for (const p of cleaned.runwayPlans || []) {
            if (p.orgId) planOrgMap.set(p.id, p.orgId);
          }
          const fallbackOrgId = cleaned.activeOrgId || cleaned.organizations?.[0]?.id;
          cleaned.expenses = (cleaned.expenses || []).map((e) => {
            if (e.orgId) return e;
            const inferredOrgId =
              (e.runwayPlanId && planOrgMap.get(e.runwayPlanId)) ||
              (e.locationId && locOrgMap.get(e.locationId)) ||
              fallbackOrgId;
            return inferredOrgId ? { ...e, orgId: inferredOrgId } : e;
          });

          // Reconcile and link unlinked runway purchases (e.g. fixed asset purchases or runway line purchases)
          const allLines = cleaned.runwayLines || [];
          const allPlans = cleaned.runwayPlans || [];
          cleaned.expenses = (cleaned.expenses || []).map((e) => {
            let updated = { ...e };
            // If expense has no runwayLineId or runwayPlanId, match by line title or fixed asset note
            if (!updated.runwayLineId || !updated.runwayPlanId) {
              const matchedLine = allLines.find((l) => {
                if (updated.note && (updated.note.includes(l.title) || updated.note.includes(`Purchase of ${l.title}`))) return true;
                return false;
              });
              if (matchedLine) {
                updated.runwayLineId = matchedLine.id;
                updated.runwayPlanId = matchedLine.planId;
                const matchedPlan = allPlans.find((p) => p.id === matchedLine.planId);
                if (matchedPlan?.orgId) updated.orgId = matchedPlan.orgId;
                if (updated.approvalStatus === 'PENDING_MULTISIG') {
                  updated.approvalStatus = 'APPROVED';
                }
              }
            } else if (updated.runwayPlanId && updated.approvalStatus === 'PENDING_MULTISIG') {
              // Runway purchases are pre-approved in the capital plan
              updated.approvalStatus = 'APPROVED';
            }
            return updated;
          });

          // Deduplicate multiple contra-reversals referencing the same original transaction
          const seenExpenseContraRefs = new Set<string>();
          cleaned.expenses = (cleaned.expenses || []).filter((e) => {
            if (e.direction === 'CONTRA_REVERSAL' && e.referenceTransactionId) {
              if (seenExpenseContraRefs.has(e.referenceTransactionId)) {
                return false; // remove duplicate contra-reversal
              }
              seenExpenseContraRefs.add(e.referenceTransactionId);
            }
            return true;
          });

          // Also reconcile fixedAssets orgId to match the active organization or runway plan
          cleaned.fixedAssets = (cleaned.fixedAssets || []).map((a) => {
            if (a.orgId && a.orgId !== 'org-master') return a;
            const linkedExp = cleaned.expenses.find((e) => e.note && e.note.includes(a.assetName));
            if (linkedExp?.orgId) {
              return { ...a, orgId: linkedExp.orgId };
            }
            if (fallbackOrgId) {
              return { ...a, orgId: fallbackOrgId };
            }
            return a;
          });

          const seenAssetContraRefs = new Set<string>();
          cleaned.fixedAssets = (cleaned.fixedAssets || []).filter((a) => {
            if (a.direction === 'CONTRA_REVERSAL' && a.referenceTransactionId) {
              if (seenAssetContraRefs.has(a.referenceTransactionId)) {
                return false; // remove duplicate contra-reversal
              }
              seenAssetContraRefs.add(a.referenceTransactionId);
            }
            return true;
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

  public saveLocalState(nextState: AgroStateSnapshot, broadcast = true) {
    const cleaned = sanitizeSnapshotOfLegacySeed(nextState);
    this.state = cleaned;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
      } catch (e) {
        console.warn('LocalStorage quota warning:', e);
      }
      void appStorage.setItem(STORAGE_KEY, cleaned);
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

  public getActiveOrgId(): string {
    return (
      this.state.activeOrgId ||
      this.activeSession?.activeOrgId ||
      this.state.organizations?.[0]?.id ||
      'org-master'
    );
  }

  public computeLivestockStatuses(): LivestockComputedStatus[] {
    const orgId = this.getActiveOrgId();
    const entries = (this.state.livestockEntries || []).filter((e) => e.orgId === orgId);
    const events = (this.state.livestockEvents || []).filter((e) => e.orgId === orgId);
    const feed = (this.state.feedLedger || []).filter((f) => f.orgId === orgId);
    return entries.map((entry) => computeLivestockStatus(entry, events, feed));
  }

  public computeFixedAssetGroupSummaries(): FixedAssetGroupSummary[] {
    const orgId = this.getActiveOrgId();
    const assets = (this.state.fixedAssets || []).filter((a) => a.orgId === orgId);
    const locations = (this.state.locations || []).filter((l) => l.orgId === orgId);
    return computeFixedAssetGroups(assets, locations);
  }

  public computeFeedInventorySummaries(): FeedInventorySummary[] {
    const orgId = this.getActiveOrgId();
    const feed = (this.state.feedLedger || []).filter((f) => f.orgId === orgId);
    const locations = (this.state.locations || []).filter((l) => l.orgId === orgId);
    return computeFeedInventories(feed, locations);
  }

  public computeMemberEquitySummaries(): MemberEquitySummary[] {
    const orgId = this.getActiveOrgId();
    const members = (this.state.members || []).filter((m) => m.orgId === orgId);
    const contributions = (this.state.capitalContributions || []).filter((c) => c.orgId === orgId);
    const financials = this.computeFinancialSummary();

    // Fetch active runway plan to unify member targets from active pledges
    const activePlan = (this.state.runwayPlans || []).find(
      (p) =>
        (!orgId || p.orgId === orgId) &&
        (p.status === 'ACTIVE' || p.status === 'PLEDGING' || p.status === 'DRAFT')
    );
    const unifiedMembers = activePlan
      ? members.map((m) => {
          const pledge = (this.state.runwayPledges || []).find(
            (p) => p.planId === activePlan.id && p.memberId === m.id
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
      : members;

    return computeMemberEquities(unifiedMembers, contributions, financials.leftMoney);
  }

  public computeFinancialSummary(): FinancialSummary {
    const orgId = this.getActiveOrgId();
    const contributions = (this.state.capitalContributions || []).filter((c) => c.orgId === orgId);
    const expenses = (this.state.expenses || []).filter((e) => e.orgId === orgId);
    const debts = (this.state.debtLiabilities || []).filter((d) => d.orgId === orgId);
    const loans = (this.state.loansGiven || []).filter((l) => l.orgId === orgId);
    const creditSales = (this.state.creditSales || []).filter((cs) => cs.orgId === orgId);
    const fixedAssets = (this.state.fixedAssets || []).filter((a) => a.orgId === orgId);
    const livestockEvents = (this.state.livestockEvents || []).filter((e) => e.orgId === orgId);
    const livestockStatuses = this.computeLivestockStatuses();

    return computeFinancialSummary({
      capitalContributions: contributions,
      expenses,
      fixedAssets,
      livestockStatuses,
      livestockEvents,
      debtLiabilities: debts,
      loansGiven: loans,
      creditSales,
    });
  }

  public getFinancialSummary(): FinancialSummary {
    return this.computeFinancialSummary();
  }

  public toggleMilestone(batchId: string, milestoneKey: string, completed: boolean, actor: OrgMember) {
    return this.updateLivestockCheckpoint({
      livestockId: batchId,
      checkpointId: milestoneKey,
      updates: {
        completed,
        completedAt: completed ? new Date().toISOString() : undefined,
      },
      actor,
    });
  }

  public logFeedConsumption(params: {
    livestockId: string;
    quantityKg: number;
    feedBrandOrRation: string;
    date?: string;
    notes: string;
    photoDataUrl?: string;
    actor: OrgMember;
  }): FeedLedgerEvent {
    const entry = this.state.livestockEntries.find((e) => e.id === params.livestockId);
    const locationId = entry?.locationId || this.state.locations[0]?.id || 'loc-master';
    return this.logBatchDirectFeed({
      livestockId: params.livestockId,
      locationId,
      kgConsumed: params.quantityKg,
      feedType: params.feedBrandOrRation,
      note: params.notes,
      photoDataUrl: params.photoDataUrl,
      actor: params.actor,
    });
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

  private pickBestMemberRecord(candidates: OrgMember[]): OrgMember | undefined {
    if (candidates.length === 0) return undefined;
    if (candidates.length === 1) return candidates[0];

    const statusScore = (s?: MemberApprovalStatus, active?: boolean) => {
      if (s === 'APPROVED' || active) return 3;
      if (s === 'SUSPENDED') return 2;
      return 1; // PENDING_APPROVAL
    };
    const roleScore = (r?: Role | string) => {
      if (r === 'ORG_ADMIN' || r === 'SYNDICATE_ADMIN') return 4;
      if (r === 'TREASURER' || r === 'SYNDICATE_TREASURER') return 3;
      if (r === 'GROUND_OPERATOR') return 2;
      return 1; // MEMBER / REMOTE_INVESTOR
    };

    const sorted = [...candidates].sort((a, b) => {
      // Prefer records that already belong to an organization over un-org'd legacy stubs
      const orgDiff = (b.orgId ? 1 : 0) - (a.orgId ? 1 : 0);
      if (orgDiff !== 0) return orgDiff;
      const sDiff = statusScore(b.approvalStatus, b.active) - statusScore(a.approvalStatus, a.active);
      if (sDiff !== 0) return sDiff;
      const rDiff = roleScore(b.role) - roleScore(a.role);
      if (rDiff !== 0) return rDiff;
      return new Date(b.updatedAt || b.joinedAt || 0).getTime() - new Date(a.updatedAt || a.joinedAt || 0).getTime();
    });

    const winner = sorted[0];
    const allProviders = Array.from(new Set(candidates.flatMap((c) => c.authProviders || [])));
    const hasPwd = candidates.some((c) => c.hasPasswordSetup || Boolean(c.passwordVerifierHash));
    const verifierHash = candidates.find((c) => Boolean(c.passwordVerifierHash))?.passwordVerifierHash;
    const assignedLoc = winner.assignedLocationId || candidates.find((c) => Boolean(c.assignedLocationId))?.assignedLocationId;
    const orgId = winner.orgId || candidates.find((c) => Boolean(c.orgId))?.orgId;
    const phone = winner.phone || candidates.find((c) => Boolean(c.phone))?.phone;
    const jobTitle =
      winner.jobTitle && winner.jobTitle !== 'Organization Member' && winner.jobTitle !== 'Syndicate Member'
        ? winner.jobTitle
        : candidates.find((c) => c.jobTitle && c.jobTitle !== 'Organization Member' && c.jobTitle !== 'Syndicate Member')?.jobTitle || winner.jobTitle;

    return {
      ...winner,
      orgId,
      assignedLocationId: assignedLoc,
      phone,
      jobTitle,
      authProviders: allProviders,
      hasPasswordSetup: hasPwd,
      passwordVerifierHash: verifierHash,
    };
  }

  public findMemberByUidOrEmail(uid?: string, email?: string): OrgMember | undefined {
    const normEmail = (email || '').trim().toLowerCase();
    const matches = this.state.members.filter(
      (m) =>
        (uid && (m.id === uid || m.uid === uid)) ||
        (normEmail &&
          ((m.email || '').trim().toLowerCase() === normEmail ||
            (m.phoneOrEmail || '').trim().toLowerCase() === normEmail))
    );
    return this.pickBestMemberRecord(matches);
  }

  /**
   * Queries Cloud Firestore directly for any existing member matching uid or email
   * (including pre-authorized mem-xxx records or deterministic usr-xxx records),
   * merges them taking the highest clearance / APPROVED status, and caches into local state.
   */
  public async fetchAuthoritativeCloudMember(
    uid?: string,
    email?: string
  ): Promise<OrgMember | undefined> {
    if (!firestoreDb) {
      initFirebaseInstance(this.getCustomFirebaseConfig());
    }
    const normEmail = (email || '').trim().toLowerCase();
    const foundDocs: OrgMember[] = [];

    if (firestoreDb) {
      // 1. Check direct UID doc
      if (uid) {
        try {
          const snap = await getDocFromServer(doc(firestoreDb, 'members', uid)).catch(() =>
            getDoc(doc(firestoreDb!, 'members', uid))
          );
          if (snap.exists()) {
            foundDocs.push(snap.data() as OrgMember);
          }
        } catch {
          // Ignore lookup error
        }
      }

      // 2. Check deterministic email-hash doc (usr-...)
      if (normEmail) {
        const detId = `usr-${sha256Hex(normEmail).slice(0, 16)}`;
        if (detId !== uid) {
          try {
            const detSnap = await getDocFromServer(doc(firestoreDb, 'members', detId)).catch(() =>
              getDoc(doc(firestoreDb!, 'members', detId))
            );
            if (detSnap.exists()) {
              foundDocs.push(detSnap.data() as OrgMember);
            }
          } catch {
            // Ignore lookup error
          }
        }

        // 3. Query by email == normEmail and phoneOrEmail == normEmail
        try {
          const qEmail = query(collection(firestoreDb, 'members'), where('email', '==', normEmail));
          const qsEmail = await getDocsFromServer(qEmail).catch(() => getDocs(qEmail));
          qsEmail.docs.forEach((d) => foundDocs.push(d.data() as OrgMember));
        } catch {
          // Ignore query error
        }

        try {
          const qContact = query(collection(firestoreDb, 'members'), where('phoneOrEmail', '==', normEmail));
          const qsContact = await getDocsFromServer(qContact).catch(() => getDocs(qContact));
          qsContact.docs.forEach((d) => foundDocs.push(d.data() as OrgMember));
        } catch {
          // Ignore query error
        }
      }
    }

    if (!firestoreDb && !foundDocs.length) {
      const localMatch = this.findMemberByUidOrEmail(uid, normEmail);
      if (localMatch) {
        foundDocs.push(localMatch);
      }
    }

    const best = this.pickBestMemberRecord(foundDocs);
    if (best) {
      const otherMembers = this.state.members.filter(
        (m) =>
          m.id !== best.id &&
          !(uid && (m.id === uid || m.uid === uid)) &&
          !(
            normEmail &&
            ((m.email || '').trim().toLowerCase() === normEmail ||
              (m.phoneOrEmail || '').trim().toLowerCase() === normEmail)
          )
      );
      this.state.members = [...otherMembers, best];
    }
    return best;
  }

  public ensureAuthenticatedMemberProfile(params: {
    uid: string;
    email: string;
    fullName: string;
    phone?: string;
    jobTitle?: string;
    providers: string[];
    passwordVerifierHash?: string;
  }): OrgMember {
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
      const updatedMember: OrgMember = {
        ...existing,
        uid: params.uid || existing.uid || existing.id,
        email: normEmail || existing.email,
        fullName: existing.fullName || params.fullName.trim().slice(0, 120),
        phone: params.phone || existing.phone,
        jobTitle: params.jobTitle || existing.jobTitle,
        role: isPrimaryAdmin ? 'ORG_ADMIN' : existing.role,
        approvalStatus: isPrimaryAdmin
          ? 'APPROVED'
          : existing.approvalStatus || (existing.active ? 'APPROVED' : 'PENDING_APPROVAL'),
        active: isPrimaryAdmin ? true : existing.approvalStatus !== 'SUSPENDED',
        authProviders: mergedProviders,
        hasPasswordSetup: hasPassword,
        passwordVerifierHash,
        lastLoginAt: now,
      };

      const nextMembers = [
        ...this.state.members.filter(
          (m) =>
            m.id !== existing.id &&
            !(params.uid && (m.id === params.uid || m.uid === params.uid)) &&
            !(
              normEmail &&
              ((m.email || '').trim().toLowerCase() === normEmail ||
                (m.phoneOrEmail || '').trim().toLowerCase() === normEmail)
            )
        ),
        updatedMember,
      ];
      this.saveLocalState({ ...this.state, members: nextMembers });
      void this.persistDocumentToCloudIfActive('members', updatedMember.id, updatedMember);
      if (params.uid && params.uid !== updatedMember.id) {
        void this.persistDocumentToCloudIfActive('members', params.uid, {
          ...updatedMember,
          id: params.uid,
          uid: params.uid,
        });
      }
      return updatedMember;
    }

    // Create brand new member profile
    const memberId = params.uid || `mem-${Date.now().toString(36)}`;
    const initialRole: Role = isPrimaryAdmin ? 'ORG_ADMIN' : 'MEMBER';
    const initialApproval: MemberApprovalStatus = isPrimaryAdmin ? 'APPROVED' : 'PENDING_APPROVAL';
    const hasPwd = Boolean(
      params.passwordVerifierHash || params.providers.includes('password')
    );

    const newMember: OrgMember = {
      id: memberId,
      uid: params.uid,
      email: normEmail,
      fullName: (params.fullName || normEmail.split('@')[0] || 'Organization User').trim().slice(0, 120),
      phoneOrEmail: (params.phone?.trim() || normEmail).slice(0, 160),
      phone: params.phone?.trim().slice(0, 60),
      jobTitle: params.jobTitle?.trim().slice(0, 120) || (isPrimaryAdmin ? 'Managing Organization Founder' : 'Member'),
      preferredContact: 'EMAIL',
      role: initialRole,
      approvalStatus: initialApproval,
      authProviders: params.providers,
      hasPasswordSetup: hasPwd,
      passwordVerifierHash: params.passwordVerifierHash,
      joinedAt: now,
      updatedAt: now,
      lastLoginAt: now,
      active: true,
    };

    const audit = this.createChainedAuditEvent({
      actor: newMember,
      locationId: 'ALL',
      locationName: 'All Locations (Master Organization)',
      eventType: 'MEMBER_ADDED',
      severity: isPrimaryAdmin ? 'MILESTONE' : 'URGENT_GROUND',
      title: isPrimaryAdmin
        ? `Primary Farm Admin Initialized: ${newMember.fullName}`
        : `New Member Awaiting Approval: ${newMember.fullName}`,
      message: isPrimaryAdmin
        ? `${newMember.fullName} (${normEmail}) initialized as Farm Administrator.`
        : `${newMember.fullName} (${normEmail}) registered via ${params.providers.join(', ')} and is awaiting admin approval.`,
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
    void this.persistDocumentToCloudIfActive('audit_notifications', audit.id, audit);
    return newMember;
  }

  // ============================================================================
  // REAL AUTHENTICATION FLOWS (GOOGLE OAUTH + EMAIL/PASSWORD + ACCOUNT LINKING)
  // ============================================================================

  public async signInWithGoogleCloud(): Promise<OrgMember> {
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

      if (result.credential?.idToken) {
        try {
          if (!firebaseAuth) {
            initFirebaseInstance(this.getCustomFirebaseConfig());
          }
          if (firebaseAuth) {
            const credential = GoogleAuthProvider.credential(result.credential.idToken);
            const userCred = await signInWithCredential(firebaseAuth, credential);
            this.currentUser = userCred.user;
            if (userCred.user.uid) {
              uid = userCred.user.uid;
            }
          }
        } catch (bridgeErr) {
          console.warn('Could not bridge native Google credential to Firebase Web SDK:', bridgeErr);
        }
      }
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

    const existing = await this.fetchAuthoritativeCloudMember(uid, email);

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
      displayName: existing?.fullName || displayName || 'Member',
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
  }): Promise<OrgMember> {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanName = params.fullName.trim();
    if (!cleanEmail.includes('@') || cleanEmail.length < 5) {
      throw new Error('Please enter a valid email address.');
    }
    if (cleanName.length < 2) {
      throw new Error('Please enter your full name (at least 2 characters).');
    }
    if (params.password.length < 8) {
      throw new Error('Password must be at least 8 characters long for account security.');
    }

    // STRICTLY ONLINE CHECK: No offline dummy registration
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Online connection required: An active internet connection is required to register.');
    }

    if (!firebaseAuth || !firestoreDb) {
      initFirebaseInstance(this.getCustomFirebaseConfig());
    }

    if (!firebaseAuth || !firestoreDb) {
      throw new Error('Online connection required: Authentication service could not connect to cloud servers.');
    }

    // Check Cloud Firestore directly first
    let existing = await this.fetchAuthoritativeCloudMember(undefined, cleanEmail);
    if (existing && existing.hasPasswordSetup) {
      throw new Error('An account with this email is already registered online. Please sign in instead.');
    }

    let resolvedUid: string;
    let isCloudUser = true;

    try {
      const cred = await createUserWithEmailAndPassword(firebaseAuth, cleanEmail, params.password);
      resolvedUid = cred.user.uid;
      await updateProfile(cred.user, { displayName: cleanName });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('auth/email-already-in-use')) {
        try {
          const signInCred = await signInWithEmailAndPassword(firebaseAuth, cleanEmail, params.password);
          resolvedUid = signInCred.user.uid;
          await updateProfile(signInCred.user, { displayName: cleanName });
          const postAuthExisting = await this.fetchAuthoritativeCloudMember(resolvedUid, cleanEmail);
          if (postAuthExisting) {
            existing = postAuthExisting;
          }
        } catch {
          throw new Error('This email is already registered online. Please sign in with your password, or use Google Sign-In.');
        }
      } else {
        throw new Error(err instanceof Error ? err.message : 'Online registration failed. Please check your internet connection.');
      }
    }

    const now = new Date().toISOString();
    const isPrimaryAdmin = cleanEmail === PRIMARY_ADMIN_EMAIL;
    const initialRole: Role = isPrimaryAdmin ? 'ORG_ADMIN' : 'MEMBER';
    const initialApproval: MemberApprovalStatus = isPrimaryAdmin ? 'APPROVED' : 'PENDING_APPROVAL';

    const newMember: OrgMember = {
      id: resolvedUid,
      uid: resolvedUid,
      email: cleanEmail,
      fullName: cleanName,
      phoneOrEmail: (params.phone?.trim() || cleanEmail).slice(0, 160),
      phone: params.phone?.trim().slice(0, 60),
      jobTitle: params.jobTitle?.trim().slice(0, 120) || (isPrimaryAdmin ? 'Managing Organization Founder' : 'Member'),
      preferredContact: 'EMAIL',
      role: initialRole,
      approvalStatus: initialApproval,
      authProviders: ['password'],
      hasPasswordSetup: true,
      joinedAt: now,
      updatedAt: now,
      lastLoginAt: now,
      active: isPrimaryAdmin,
      // orgId is undefined so user encounters Gate 2 OrgOnboardingModal
    };

    // STRICTLY ONLINE WRITE: Directly write to Cloud Firestore without local queueing
    try {
      const cleanData = JSON.parse(JSON.stringify(newMember));
      await setDoc(doc(firestoreDb, 'members', resolvedUid), cleanData);
    } catch (cloudErr: any) {
      throw new Error(`Online registration failed while saving to database: ${cloudErr.message || 'Permission or network error.'}`);
    }

    const nextMembers = [
      ...this.state.members.filter(
        (m) => m.id !== newMember.id && m.uid !== newMember.uid && (m.email || '').toLowerCase() !== cleanEmail
      ),
      newMember,
    ];
    this.saveLocalState({ ...this.state, members: nextMembers });

    const session: AuthenticatedSession = {
      uid: resolvedUid,
      email: cleanEmail,
      displayName: cleanName,
      emailVerified: cleanEmail === PRIMARY_ADMIN_EMAIL || isCloudUser,
      providers: ['password'],
      isCloudAuth: true,
    };
    this.setActiveSession(session);

    this.attachCloudListeners(firestoreDb, resolvedUid);

    return newMember;
  }

  public async signInWithEmailAccount(params: {
    email: string;
    password: string;
  }): Promise<OrgMember> {
    const cleanEmail = params.email.trim().toLowerCase();
    if (!cleanEmail || !params.password) {
      throw new Error('Please enter both your email address and password.');
    }

    // STRICTLY ONLINE CHECK: No offline dummy login
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Online connection required: An active internet connection is required to sign in.');
    }

    if (!firebaseAuth || !firestoreDb) {
      initFirebaseInstance(this.getCustomFirebaseConfig());
    }

    if (!firebaseAuth || !firestoreDb) {
      throw new Error('Online connection required: Authentication service could not connect to cloud servers.');
    }

    // 1. Strictly authenticate with Firebase Auth online
    let user: any;
    try {
      const cred = await signInWithEmailAndPassword(firebaseAuth, cleanEmail, params.password);
      user = cred.user;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes('auth/wrong-password') ||
        msg.includes('auth/invalid-credential') ||
        msg.includes('auth/user-not-found') ||
        msg.includes('auth/invalid-email')
      ) {
        throw new Error('Invalid email or password. If your data was wiped or deleted, please register again to create your account.');
      }
      throw new Error(err instanceof Error ? err.message : 'Online authentication failed. Please check your internet connection.');
    }

    // 2. Fetch authoritative profile from Cloud Firestore online
    const cloudMember = await this.fetchAuthoritativeCloudMember(user.uid, cleanEmail);

    if (!cloudMember) {
      // User authenticated in Firebase Auth, but account was deleted/wiped from the database!
      // Strictly require re-registration
      throw new Error('Account record not found in the database. Your previous data was wiped. Please register again to set up your account.');
    }

    const providers = Array.from(
      new Set([
        ...user.providerData.map((p: any) => p.providerId),
        ...(cloudMember.authProviders || []),
        'password',
      ])
    );

    const now = new Date().toISOString();
    const updatedMember: OrgMember = {
      ...cloudMember,
      uid: user.uid,
      lastLoginAt: now,
      authProviders: providers,
    };

    // Update login timestamp in Cloud Firestore
    try {
      await setDoc(doc(firestoreDb, 'members', user.uid), JSON.parse(JSON.stringify(updatedMember)), { merge: true });
    } catch {
      // Non-fatal if permission-restricted
    }

    const nextMembers = [
      ...this.state.members.filter(
        (m) => m.id !== updatedMember.id && m.uid !== updatedMember.uid && (m.email || '').toLowerCase() !== cleanEmail
      ),
      updatedMember,
    ];
    this.saveLocalState({ ...this.state, members: nextMembers });

    this.setActiveSession({
      uid: user.uid,
      email: cleanEmail,
      displayName: updatedMember.fullName,
      emailVerified: true,
      providers,
      isCloudAuth: true,
      activeOrgId: updatedMember.orgId,
    });

    this.attachCloudListeners(firestoreDb, user.uid);
    return updatedMember;
  }

  /**
   * Unlocks the user's session using the device's hardware biometric sensor (Android Fingerprint / Face Unlock)
   */
  public async signInWithBiometrics(): Promise<OrgMember> {
    const enrolled = await verifyDeviceBiometric();
    const existing = await this.fetchAuthoritativeCloudMember(enrolled.memberId, enrolled.email);
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
      uid: member.uid || member.id,
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
    member: OrgMember;
    newPassword: string;
  }): Promise<OrgMember> {
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

    const updatedMember: OrgMember = {
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
      locationName: 'All Locations (Master Organization)',
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
  public verifyMemberPassword(member: OrgMember, plainPassword: string): boolean {
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
  }): OrgMember {
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

    const updatedMember: OrgMember = {
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
      updateProfile(firebaseAuth.currentUser, { displayName: cleanName }).catch(() => { });
    }

    const audit = this.createChainedAuditEvent({
      actor: updatedMember,
      locationId: updatedMember.assignedLocationId || 'ALL',
      locationName:
        this.state.locations.find((l) => l.id === updatedMember.assignedLocationId)?.name ||
        'All Locations (Master Organization)',
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
  public async adminUpdateMemberRoleAndAccess(params: {
    targetMemberId: string;
    role: Role;
    approvalStatus: MemberApprovalStatus;
    assignedLocationId?: string;
    note?: string;
    actor: OrgMember;
  }): Promise<OrgMember> {
    const actorEmail = (params.actor.email || params.actor.phoneOrEmail || '').trim().toLowerCase();
    const isPrivilegedAdmin = actorEmail === PRIMARY_ADMIN_EMAIL || PERMISSIONS.canManageMemberCRUD(params.actor);
    if (!isPrivilegedAdmin) {
      throw new Error('Access Denied: Only Organization Admins can modify member roles, clearances, or suspensions.');
    }
    const target = this.state.members.find((m) => m.id === params.targetMemberId);
    if (!target) throw new Error('Target member record not found.');

    // Multi-tenant boundary check: Admin of Org A cannot modify members of Org B
    if (params.actor.orgId && target.orgId && params.actor.orgId !== target.orgId) {
      throw new Error('Access Denied: You cannot modify members belonging to another organization.');
    }

    // Protect primary bootstrapped admin from accidental self-lockout
    if (
      (target.email || target.phoneOrEmail || '').toLowerCase() === PRIMARY_ADMIN_EMAIL &&
      target.id === params.actor.id &&
      (params.role !== 'ORG_ADMIN' || params.approvalStatus !== 'APPROVED')
    ) {
      throw new Error('The primary Founder Admin account cannot be demoted or suspended.');
    }

    const now = new Date().toISOString();
    const isNowActive = params.approvalStatus === 'APPROVED';
    const updatedMember: OrgMember = {
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
        : 'All Locations (Master Organization)';

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

    // 1. Write directly to Cloud Firestore if initialized and online
    if (!firestoreDb) {
      initFirebaseInstance(this.getCustomFirebaseConfig());
    }
    if (firestoreDb) {
      try {
        const cleanData = JSON.parse(JSON.stringify(updatedMember));
        await setDoc(doc(firestoreDb, 'members', updatedMember.id), cleanData);
        if (updatedMember.uid && updatedMember.uid !== updatedMember.id) {
          await setDoc(doc(firestoreDb, 'members', updatedMember.uid), {
            ...cleanData,
            id: updatedMember.uid,
            uid: updatedMember.uid,
          });
        }
        const targetEmail = (updatedMember.email || updatedMember.phoneOrEmail || '').trim().toLowerCase();
        if (targetEmail && targetEmail.includes('@')) {
          const q = query(collection(firestoreDb, 'members'), where('email', '==', targetEmail));
          const qs = await getDocs(q);
          for (const d of qs.docs) {
            if (d.id !== updatedMember.id && d.id !== updatedMember.uid) {
              await setDoc(doc(firestoreDb, 'members', d.id), {
                ...cleanData,
                id: d.id,
              });
            }
          }
        }
      } catch (cloudErr) {
        console.warn(`Cloud member update notice (${updatedMember.id}):`, cloudErr);
      }
    }

    // 2. Update local state and chained audit ledger
    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('audit_notifications', audit.id, audit);
    return updatedMember;
  }

  /**
   * Primary Founder Governance: Permanently delete an organization member (including other admins)
   */
  public async deleteMember(params: {
    targetMemberId: string;
    actor: OrgMember;
    reason?: string;
  }): Promise<void> {
    const actorEmail = (params.actor.email || params.actor.phoneOrEmail || '').trim().toLowerCase();
    const isPrivilegedAdmin = actorEmail === PRIMARY_ADMIN_EMAIL || PERMISSIONS.canManageMemberCRUD(params.actor);
    if (!isPrivilegedAdmin) {
      throw new Error('Access Denied: Only Organization Admins can delete members.');
    }

    const target = this.state.members.find(
      (m) => m.id === params.targetMemberId || (m.uid && m.uid === params.targetMemberId)
    );
    if (!target) throw new Error('Target member record not found.');

    const targetEmail = (target.email || target.phoneOrEmail || '').trim().toLowerCase();
    if (targetEmail === PRIMARY_ADMIN_EMAIL) {
      throw new Error('Zero-Trust Protection: The primary Founder Admin account cannot be deleted.');
    }

    // Multi-tenant boundary check: Admin of Org A cannot delete members of Org B
    if (params.actor.orgId && target.orgId && params.actor.orgId !== target.orgId) {
      throw new Error('Access Denied: You cannot delete members belonging to another organization.');
    }

    // 1. Delete from Cloud Firestore if active
    if (!firestoreDb) {
      initFirebaseInstance(this.getCustomFirebaseConfig());
    }
    if (firestoreDb) {
      try {
        await deleteDoc(doc(firestoreDb, 'members', target.id));
        if (target.uid && target.uid !== target.id) {
          await deleteDoc(doc(firestoreDb, 'members', target.uid));
        }
      } catch (cloudErr) {
        console.warn(`Cloud member delete notice (${target.id}):`, cloudErr);
      }
    }

    const now = new Date().toISOString();
    const reason = params.reason?.trim() || 'Account permanently deleted by Primary Founder Admin';

    // 2. Remove from local state only after cloud deletion completes
    const nextMembers = this.state.members.filter(
      (m) => m.id !== target.id && (!m.uid || m.uid !== target.uid)
    );

    // 3. Chained Audit Event
    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: target.assignedLocationId || 'ALL',
      locationName: 'All Locations (Master Organization)',
      eventType: 'MEMBER_DELETED',
      severity: 'WARNING_CONTRA',
      title: `Member Permanently Deleted: ${target.fullName}`,
      message: `${target.fullName} (${target.phoneOrEmail}, role: ${target.role}) was permanently deleted from the organization by Primary Admin. Reason: ${reason}.`,
      referenceEntityId: target.id,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      members: nextMembers,
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('audit_notifications', audit.id, audit);
  }

  /**
   * Permanently purge an account by email from local state, stored credentials, session and cloud
   */
  public purgeAccountByEmail(email: string): void {
    const norm = email.trim().toLowerCase();
    this.state = {
      ...this.state,
      members: (this.state.members || []).filter(
        (m) => (m.email || m.phoneOrEmail || '').trim().toLowerCase() !== norm
      ),
    };
    if (typeof window !== 'undefined') {
      try {
        const creds = getStoredLocalCredentials();
        if (creds[norm]) {
          delete creds[norm];
          window.localStorage.setItem(LOCAL_CREDENTIALS_STORAGE_KEY, JSON.stringify(creds));
        }
        const sessRaw = window.localStorage.getItem(SESSION_STORAGE_KEY);
        if (sessRaw) {
          const sess = JSON.parse(sessRaw);
          if ((sess?.email || '').trim().toLowerCase() === norm) {
            window.localStorage.removeItem(SESSION_STORAGE_KEY);
            this.activeSession = null;
          }
        }
        this.saveLocalState(this.state);
      } catch (e) {
        console.warn('Purge account local error:', e);
      }
    }
    if (!firestoreDb) {
      initFirebaseInstance(this.getCustomFirebaseConfig());
    }
    if (firestoreDb) {
      try {
        const qEmail = query(collection(firestoreDb, 'members'), where('email', '==', norm));
        getDocs(qEmail).then((snap) => {
          snap.forEach((d) => {
            deleteDoc(doc(firestoreDb!, 'members', d.id)).catch(() => {});
          });
        }).catch(() => {});
      } catch {}
    }
  }

  /**
   * Admin Utility: Wipe any legacy demo data or perform a clean production ledger reset
   */
  public async wipeAllDemoAndLedgerData(
    actor: OrgMember,
    mode: 'DEMO_ONLY' | 'FULL_RESET' = 'FULL_RESET'
  ): Promise<void> {
    if (actor.role !== 'ORG_ADMIN' && actor.role !== 'SYNDICATE_ADMIN') {
      throw new Error('Only an Organization Admin can execute a ledger purge.');
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
        { path: 'debt_liabilities', key: 'debtLiabilities' as const },
        { path: 'loans_given', key: 'loansGiven' as const },
        { path: 'credit_sales', key: 'creditSales' as const },
        { path: 'runway_plans', key: 'runwayPlans' as const },
        { path: 'runway_lines', key: 'runwayLines' as const },
        { path: 'runway_pledges', key: 'runwayPledges' as const },
        { path: 'runway_claims', key: 'runwayClaims' as const },
        { path: 'runway_templates', key: 'runwayTemplates' as const },
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
      orgId: actor.orgId || this.state.activeOrgId || 'org-master',
      sequenceNumber: 1,
      timestamp: now,
      actorId: actor.id,
      actorName: actor.fullName,
      actorRole: actor.role,
      locationId: 'ALL',
      locationName: 'All Locations (Master Organization)',
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
    this.isSigningOut = true;
    try {
      this.detachCloudListeners();

      if (Capacitor.isNativePlatform()) {
        try {
          await FirebaseAuthentication.signOut();
        } catch {
          // Ignore native signOut error
        }
      }

      if (firebaseAuth) {
        try {
          await signOut(firebaseAuth);
        } catch {
          // Ignore web signOut error
        }
      }

      this.currentUser = null;
      this.activeSession = null;

      // Clear persistent outbox queue and high-capacity IndexedDB appStorage
      outboxService.clearQueue();
      await appStorage.clearAll();

      if (typeof window !== 'undefined') {
        try {
          window.localStorage.clear();
        } catch {
          // Ignore storage clear error
        }
        try {
          window.sessionStorage.clear();
        } catch {
          // Ignore session storage clear error
        }
        if ('caches' in window) {
          try {
            const keys = await window.caches.keys();
            await Promise.all(keys.map((k) => window.caches.delete(k)));
          } catch {
            // Ignore cache clear error
          }
        }
      }

      const emptyState = createEmptyProductionSnapshot();
      this.state = emptyState;
      this.authListeners.forEach((cb) => cb(null));
      this.sessionListeners.forEach((cb) => cb(null));
      this.notifyListeners();
    } finally {
      this.isSigningOut = false;
    }
  }

  private mergeAndDeduplicateCloudMembers(rawDocs: unknown[]): OrgMember[] {
    const cloudMembers = (rawDocs as OrgMember[]).filter(
      (x) => x && x.id && !isLegacySeedId('members', x.id)
    );
    const creds = getStoredLocalCredentials();
    const existingLocalMap = new Map<string, OrgMember>();
    this.state.members.forEach((m) => existingLocalMap.set(m.id, m));

    const enriched = cloudMembers.map((cloudM) => {
      const localM =
        existingLocalMap.get(cloudM.id) ||
        Array.from(existingLocalMap.values()).find(
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

      // Preserve APPROVED status and assigned role if either cloud or local record was approved
      const resolvedApproval: MemberApprovalStatus =
        email === PRIMARY_ADMIN_EMAIL ||
          cloudM.approvalStatus === 'APPROVED' ||
          localM?.approvalStatus === 'APPROVED' ||
          cloudM.active
          ? 'APPROVED'
          : cloudM.approvalStatus || localM?.approvalStatus || 'PENDING_APPROVAL';

      const resolvedRole: Role =
        email === PRIMARY_ADMIN_EMAIL
          ? 'ORG_ADMIN'
          : cloudM.role && cloudM.role !== 'REMOTE_INVESTOR'
            ? cloudM.role
            : localM?.role && localM.role !== 'REMOTE_INVESTOR'
              ? localM.role
              : cloudM.role || localM?.role || 'REMOTE_INVESTOR';

      return {
        ...localM,
        ...cloudM,
        phoneOrEmail: cloudM.phoneOrEmail || localM?.phoneOrEmail || cloudM.email || localM?.email || email || 'member',
        role: resolvedRole,
        approvalStatus: resolvedApproval,
        active: resolvedApproval === 'APPROVED',
        assignedLocationId: cloudM.assignedLocationId || localM?.assignedLocationId,
        hasPasswordSetup: hasPassword,
        passwordVerifierHash,
        authProviders: mergedProviders,
      };
    });

    // Deduplicate by email / uid so a stale PENDING_APPROVAL doc never shadows an APPROVED doc for the same user
    const groupsByIdentity = new Map<string, OrgMember[]>();
    for (const mem of enriched) {
      const normEmail = (mem.email || (mem.phoneOrEmail?.includes('@') ? mem.phoneOrEmail : '') || '')
        .trim()
        .toLowerCase();
      const key = normEmail || mem.uid || mem.id;
      const list = groupsByIdentity.get(key) || [];
      list.push(mem);
      groupsByIdentity.set(key, list);
    }

    const deduplicated: OrgMember[] = [];
    for (const group of groupsByIdentity.values()) {
      const best = this.pickBestMemberRecord(group);
      if (best) {
        deduplicated.push(best);
      }
    }
    return deduplicated;
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

  private processIncomingAuditNotifications(rawDocs: unknown[]): void {
    const valid = (rawDocs as AuditNotificationEvent[])
      .filter((x) => x && x.id && !isLegacySeedId('auditNotifications', x.id))
      .map((n) => ({
        ...n,
        readByMemberIds: Array.isArray(n.readByMemberIds) ? n.readByMemberIds : [],
      }));
    const sorted = valid.sort((a, b) => (b.sequenceNumber || 0) - (a.sequenceNumber || 0));

    if (sorted.length === 0) {
      this.state.auditNotifications = [];
      return;
    }

    const NOTIFIED_IDS_STORAGE_KEY = 'agro_planner_notified_audit_ids_v1';
    let notifiedSet = new Set<string>();
    let hasPersistedHistory = false;

    if (typeof window !== 'undefined') {
      try {
        const rawNotified = window.localStorage.getItem(NOTIFIED_IDS_STORAGE_KEY);
        if (rawNotified) {
          const parsedIds = JSON.parse(rawNotified);
          if (Array.isArray(parsedIds)) {
            notifiedSet = new Set<string>(parsedIds);
            hasPersistedHistory = true;
          }
        }
      } catch {
        // Ignore storage parse error
      }
    }

    const activeUid = this.activeSession?.uid || this.currentUser?.uid || '';
    const activeEmail = (this.activeSession?.email || this.currentUser?.email || '').trim().toLowerCase();
    const activeMember = this.findMemberByUidOrEmail(activeUid, activeEmail);
    const myIdentityIds = new Set<string>(
      [activeUid, activeMember?.id, activeMember?.uid].filter((x): x is string => Boolean(x))
    );

    const now = Date.now();
    const toDispatch: AuditNotificationEvent[] = [];

    if (!hasPersistedHistory) {
      // First time initializing persistent notification tracker on this device:
      // Dispatch up to 3 unread notifications from the last 24 hours so closed-app alerts are caught,
      // then mark all existing IDs as seen so old historical logs don't spam.
      for (const item of sorted) {
        const isAuthoredByMe = Boolean(item.actorId && myIdentityIds.has(item.actorId));
        const isAlreadyRead = Array.isArray(item.readByMemberIds) && item.readByMemberIds.some((id) => myIdentityIds.has(id));
        const eventAgeMs = now - new Date(item.timestamp).getTime();
        const isWithin24Hours = eventAgeMs >= 0 && eventAgeMs <= 24 * 60 * 60 * 1000;

        if (!isAuthoredByMe && !isAlreadyRead && isWithin24Hours && toDispatch.length < 3) {
          toDispatch.push(item);
        }
        notifiedSet.add(item.id);
      }
    } else {
      // Device has a persisted notification history:
      // Any notification in Cloud that is NOT in notifiedSet was created while the app was closed,
      // backgrounded, or live! Dispatch all unread ones not authored by the current user (up to 5).
      for (const item of sorted) {
        if (!notifiedSet.has(item.id)) {
          notifiedSet.add(item.id);
          const isAuthoredByMe = Boolean(item.actorId && myIdentityIds.has(item.actorId));
          const isAlreadyRead = Array.isArray(item.readByMemberIds) && item.readByMemberIds.some((id) => myIdentityIds.has(id));

          if (!isAuthoredByMe && !isAlreadyRead && toDispatch.length < 5) {
            toDispatch.push(item);
          }
        }
      }
    }

    if (typeof window !== 'undefined') {
      try {
        // Keep the most recent 500 IDs in localStorage to bound storage size
        const boundedIds = Array.from(notifiedSet).slice(-500);
        window.localStorage.setItem(NOTIFIED_IDS_STORAGE_KEY, JSON.stringify(boundedIds));
      } catch {
        // Ignore storage quota warning
      }
    }

    if (toDispatch.length > 0 && areSystemNotificationsEnabled()) {
      // Dispatch in chronological order (oldest missed first, newest on top)
      for (const item of [...toDispatch].reverse()) {
        void dispatchSystemNotification({
          title: `Agro Planner · ${item.title || 'Broadcast'}`,
          body: item.message || '',
          tag: item.id,
          urgent: item.severity === 'URGENT_GROUND' || item.severity === 'WARNING_CONTRA',
          severity: item.severity,
          sequenceNumber: item.sequenceNumber,
        });
      }
    }

    this.state.auditNotifications = sorted;
  }

  private attachCloudListeners(db: Firestore, uid?: string) {
    const activeOrgId = this.getActiveOrgId();
    const listenerKey = `${uid ?? this.currentUser?.uid ?? 'anon'}::${activeOrgId}`;
    if (this.cloudSyncActive && this.activeListenerUid === listenerKey) {
      return;
    }
    this.detachCloudListeners();
    this.cloudSyncActive = true;
    this.activeListenerUid = listenerKey;

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
            this.state.members = this.mergeAndDeduplicateCloudMembers(docs);
          },
        },
        {
          path: 'capital_contributions',
          apply: (docs) => {
            const serverDocs = (docs as CapitalContributionEvent[]).filter(
              (x) => !isLegacySeedId('capitalContributions', x.id)
            );
            this.state.capitalContributions = outboxService.reconcileSnapshot(
              serverDocs,
              this.state.capitalContributions || [],
              'capital_contributions'
            );
          },
        },
        {
          path: 'expense_ledger',
          apply: (docs) => {
            const serverDocs = (docs as ExpenseLedgerEvent[]).filter(
              (x) => !isLegacySeedId('expenses', x.id)
            );
            this.state.expenses = outboxService.reconcileSnapshot(
              serverDocs,
              this.state.expenses || [],
              'expense_ledger'
            );
          },
        },
        {
          path: 'fixed_assets_ledger',
          apply: (docs) => {
            const serverDocs = (docs as FixedAssetLedgerEvent[]).filter(
              (x) => !isLegacySeedId('fixedAssets', x.id)
            );
            this.state.fixedAssets = outboxService.reconcileSnapshot(
              serverDocs,
              this.state.fixedAssets || [],
              'fixed_assets_ledger'
            );
          },
        },
        {
          path: 'livestock_entries',
          apply: (docs) => {
            const serverDocs = (docs as LivestockEntry[]).filter(
              (x) => !isLegacySeedId('livestockEntries', x.id)
            );
            this.state.livestockEntries = outboxService.reconcileSnapshot(
              serverDocs,
              this.state.livestockEntries || [],
              'livestock_entries'
            );
          },
        },
        {
          path: 'livestock_lifecycle_events',
          apply: (docs) => {
            const serverDocs = (docs as LivestockLifecycleEvent[]).filter(
              (x) => !isLegacySeedId('livestockEvents', x.id)
            );
            this.state.livestockEvents = outboxService.reconcileSnapshot(
              serverDocs,
              this.state.livestockEvents || [],
              'livestock_lifecycle_events'
            );
          },
        },
        {
          path: 'feed_ledger',
          apply: (docs) => {
            const serverDocs = (docs as FeedLedgerEvent[]).filter(
              (x) => !isLegacySeedId('feedLedger', x.id)
            );
            this.state.feedLedger = outboxService.reconcileSnapshot(
              serverDocs,
              this.state.feedLedger || [],
              'feed_ledger'
            );
          },
        },
        {
          path: 'audit_notifications',
          apply: (docs) => {
            this.processIncomingAuditNotifications(docs);
          },
        },
        {
          path: 'debt_liabilities',
          apply: (docs) => {
            this.state.debtLiabilities = outboxService.reconcileSnapshot(
              docs as DebtLiabilityEvent[],
              this.state.debtLiabilities || [],
              'debt_liabilities'
            );
          },
        },
        {
          path: 'loans_given',
          apply: (docs) => {
            this.state.loansGiven = outboxService.reconcileSnapshot(
              docs as LoanGivenEvent[],
              this.state.loansGiven || [],
              'loans_given'
            );
          },
        },
        {
          path: 'credit_sales',
          apply: (docs) => {
            this.state.creditSales = outboxService.reconcileSnapshot(
              docs as CreditSaleEvent[],
              this.state.creditSales || [],
              'credit_sales'
            );
          },
        },
        {
          path: 'runway_plans',
          apply: (docs) => {
            this.state.runwayPlans = outboxService.reconcileSnapshot(
              docs as RunwayPlan[],
              this.state.runwayPlans || [],
              'runway_plans'
            );
          },
        },
        {
          path: 'runway_lines',
          apply: (docs) => {
            this.state.runwayLines = outboxService.reconcileSnapshot(
              docs as RunwayLine[],
              this.state.runwayLines || [],
              'runway_lines'
            );
          },
        },
        {
          path: 'runway_pledges',
          apply: (docs) => {
            this.state.runwayPledges = outboxService.reconcileSnapshot(
              docs as RunwayPledge[],
              this.state.runwayPledges || [],
              'runway_pledges'
            );
          },
        },
        {
          path: 'runway_claims',
          apply: (docs) => {
            this.state.runwayClaims = outboxService.reconcileSnapshot(
              docs as RunwayPaymentClaim[],
              this.state.runwayClaims || [],
              'runway_claims'
            );
          },
        },
        {
          path: 'runway_templates',
          apply: (docs) => {
            this.state.runwayTemplates = outboxService.reconcileSnapshot(
              docs as RunwayTemplate[],
              this.state.runwayTemplates || [],
              'runway_templates'
            );
          },
        },
      ];

    collectionsMap.forEach(({ path, apply }) => {
      const targetQuery =
        path === 'locations' || path === 'members' || !activeOrgId
          ? collection(db, path)
          : query(collection(db, path), where('orgId', '==', activeOrgId));

      const unsub = onSnapshot(
        targetQuery,
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

  /**
   * Authoritative Cloud Synchronization:
   * Direct server roundtrip bypassing local IndexedDB cache via getDocsFromServer.
   * Completely purges locally deleted records so Cloud is 100% source of truth.
   */
  public async syncWithCloudServer(): Promise<{ success: boolean; itemCount: number; message: string }> {
    if (!firestoreDb) {
      initFirebaseInstance(this.getCustomFirebaseConfig());
    }
    if (!firestoreDb) {
      throw new Error('Firestore is not initialized. Please check network connectivity.');
    }

    const collections = [
      'locations',
      'members',
      'capital_contributions',
      'expense_ledger',
      'fixed_assets_ledger',
      'livestock_entries',
      'livestock_lifecycle_events',
      'feed_ledger',
      'audit_notifications',
      'debt_liabilities',
      'loans_given',
      'credit_sales',
      'runway_plans',
      'runway_lines',
      'runway_pledges',
      'runway_claims',
      'runway_templates',
    ];

    // Attempt to ensure an active Firebase Auth user session exists if available
    if (firebaseAuth && !firebaseAuth.currentUser) {
      try {
        await signInAnonymously(firebaseAuth);
      } catch (anonErr) {
        console.info('Anonymous auth sync attempt note:', anonErr);
      }
    }

    const activeOrgId = this.getActiveOrgId();
    const fetchCol = async (colPath: string) => {
      const q =
        colPath === 'locations' || colPath === 'members' || !activeOrgId
          ? collection(firestoreDb!, colPath)
          : query(collection(firestoreDb!, colPath), where('orgId', '==', activeOrgId));
      try {
        const snap = await getDocsFromServer(q);
        return { colPath, docs: snap.docs.map((d) => d.data()) };
      } catch (err) {
        console.warn(`Direct server query failed for ${colPath}, falling back to cache:`, err);
        try {
          const snap = await getDocs(q);
          return { colPath, docs: snap.docs.map((d) => d.data()) };
        } catch (innerErr) {
          console.warn(`Cache read also failed for ${colPath}:`, innerErr);
          return { colPath, docs: [] };
        }
      }
    };

    const results = await Promise.all(collections.map((c) => fetchCol(c)));
    let totalSynced = 0;

    for (const { colPath, docs } of results) {
      totalSynced += docs.length;
      if (colPath === 'locations') {
        this.state.locations = (docs as FarmLocation[]).filter((x) => !isLegacySeedId('locations', x.id));
      } else if (colPath === 'members') {
        this.state.members = this.mergeAndDeduplicateCloudMembers(docs);
      } else if (colPath === 'capital_contributions') {
        const serverDocs = (docs as CapitalContributionEvent[]).filter(
          (x) => !isLegacySeedId('capitalContributions', x.id)
        );
        this.state.capitalContributions = outboxService.reconcileSnapshot(
          serverDocs,
          this.state.capitalContributions || [],
          'capital_contributions'
        );
      } else if (colPath === 'expense_ledger') {
        const serverDocs = (docs as ExpenseLedgerEvent[]).filter(
          (x) => !isLegacySeedId('expenses', x.id)
        );
        this.state.expenses = outboxService.reconcileSnapshot(
          serverDocs,
          this.state.expenses || [],
          'expense_ledger'
        );
      } else if (colPath === 'fixed_assets_ledger') {
        const serverDocs = (docs as FixedAssetLedgerEvent[]).filter(
          (x) => !isLegacySeedId('fixedAssets', x.id)
        );
        this.state.fixedAssets = outboxService.reconcileSnapshot(
          serverDocs,
          this.state.fixedAssets || [],
          'fixed_assets_ledger'
        );
      } else if (colPath === 'livestock_entries') {
        const serverDocs = (docs as LivestockEntry[]).filter(
          (x) => !isLegacySeedId('livestockEntries', x.id)
        );
        this.state.livestockEntries = outboxService.reconcileSnapshot(
          serverDocs,
          this.state.livestockEntries || [],
          'livestock_entries'
        );
      } else if (colPath === 'livestock_lifecycle_events') {
        const serverDocs = (docs as LivestockLifecycleEvent[]).filter(
          (x) => !isLegacySeedId('livestockEvents', x.id)
        );
        this.state.livestockEvents = outboxService.reconcileSnapshot(
          serverDocs,
          this.state.livestockEvents || [],
          'livestock_lifecycle_events'
        );
      } else if (colPath === 'feed_ledger') {
        const serverDocs = (docs as FeedLedgerEvent[]).filter(
          (x) => !isLegacySeedId('feedLedger', x.id)
        );
        this.state.feedLedger = outboxService.reconcileSnapshot(
          serverDocs,
          this.state.feedLedger || [],
          'feed_ledger'
        );
      } else if (colPath === 'audit_notifications') {
        this.processIncomingAuditNotifications(docs);
      } else if (colPath === 'debt_liabilities') {
        this.state.debtLiabilities = outboxService.reconcileSnapshot(
          docs as DebtLiabilityEvent[],
          this.state.debtLiabilities || [],
          'debt_liabilities'
        );
      } else if (colPath === 'loans_given') {
        this.state.loansGiven = outboxService.reconcileSnapshot(
          docs as LoanGivenEvent[],
          this.state.loansGiven || [],
          'loans_given'
        );
      } else if (colPath === 'credit_sales') {
        this.state.creditSales = outboxService.reconcileSnapshot(
          docs as CreditSaleEvent[],
          this.state.creditSales || [],
          'credit_sales'
        );
      } else if (colPath === 'runway_plans') {
        this.state.runwayPlans = outboxService.reconcileSnapshot(
          docs as RunwayPlan[],
          this.state.runwayPlans || [],
          'runway_plans'
        );
      } else if (colPath === 'runway_lines') {
        this.state.runwayLines = outboxService.reconcileSnapshot(
          docs as RunwayLine[],
          this.state.runwayLines || [],
          'runway_lines'
        );
      } else if (colPath === 'runway_pledges') {
        this.state.runwayPledges = outboxService.reconcileSnapshot(
          docs as RunwayPledge[],
          this.state.runwayPledges || [],
          'runway_pledges'
        );
      } else if (colPath === 'runway_claims') {
        this.state.runwayClaims = outboxService.reconcileSnapshot(
          docs as RunwayPaymentClaim[],
          this.state.runwayClaims || [],
          'runway_claims'
        );
      } else if (colPath === 'runway_templates') {
        this.state.runwayTemplates = outboxService.reconcileSnapshot(
          docs as RunwayTemplate[],
          this.state.runwayTemplates || [],
          'runway_templates'
        );
      }
    }

    this.saveLocalState({ ...this.state }, true);
    return {
      success: true,
      itemCount: totalSynced,
      message: `Synchronized ${totalSynced} records live from cloud servers.`,
    };
  }

  /**
   * Ensures that an active Firebase Auth user exists and that their corresponding
   * `/members/$(request.auth.uid)` document in Cloud Firestore is synchronized with
   * their current approved organization and role. This prevents `permission-denied`
   * when legacy member IDs (e.g. `founder-basera`) differ from `request.auth.uid`.
   */
  private async ensureCloudAuthUserAndMemberSynced(targetOrgId?: string): Promise<void> {
    if (!firestoreDb) {
      initFirebaseInstance(this.getCustomFirebaseConfig());
    }
    if (!firestoreDb) return;

    if (firebaseAuth && !firebaseAuth.currentUser && this.activeSession) {
      try {
        await signInAnonymously(firebaseAuth);
      } catch {
        // Ignore anonymous auth fallback error
      }
    }

    const authUid = firebaseAuth?.currentUser?.uid;
    if (!authUid) return;

    const sessionEmail = (
      firebaseAuth?.currentUser?.email ||
      this.activeSession?.email ||
      ''
    )
      .trim()
      .toLowerCase();
    const localMember =
      this.findMemberByUidOrEmail(authUid, sessionEmail || undefined) ||
      (this.state.activeOrgId ? this.state.members.find((m) => m.orgId === this.state.activeOrgId) : null) ||
      this.state.members[0];

    const resolvedOrgId =
      targetOrgId ||
      localMember?.orgId ||
      this.activeSession?.activeOrgId ||
      (sessionEmail === PRIMARY_ADMIN_EMAIL ? (this.state.activeOrgId || 'org-master') : undefined);

    if (!resolvedOrgId && sessionEmail !== PRIMARY_ADMIN_EMAIL) {
      // Do not synthesize or force a default organization on a member who is onboarding
      return;
    }

    const syncedMemberDoc: OrgMember = {
      ...(localMember || {
        fullName: firebaseAuth?.currentUser?.displayName || 'Member',
        phoneOrEmail: sessionEmail || 'member@venture.local',
        role: sessionEmail === PRIMARY_ADMIN_EMAIL ? 'ORG_ADMIN' : 'MEMBER',
        joinedAt: new Date().toISOString(),
      }),
      id: authUid,
      uid: authUid,
      orgId: resolvedOrgId,
      role:
        sessionEmail === PRIMARY_ADMIN_EMAIL
          ? 'ORG_ADMIN'
          : localMember?.role || 'MEMBER',
      approvalStatus: localMember?.approvalStatus || (sessionEmail === PRIMARY_ADMIN_EMAIL ? 'APPROVED' : 'PENDING_APPROVAL'),
      active: sessionEmail === PRIMARY_ADMIN_EMAIL ? true : Boolean(localMember?.active),
    };

    try {
      const cleanMember = JSON.parse(JSON.stringify(syncedMemberDoc));
      await setDoc(doc(firestoreDb, 'members', authUid), cleanMember, { merge: true });
    } catch (syncErr) {
      console.warn(`Member auth pre-sync notice for ${authUid}:`, syncErr);
    }
  }

  private async persistDocumentToCloudIfActive(collectionPath: string, docId: string, data: object) {
    if (!firestoreDb) {
      initFirebaseInstance(this.getCustomFirebaseConfig());
    }
    const cleanData = JSON.parse(JSON.stringify(data));

    // Pre-flight document size reduction to prevent exceeding Firestore 1MB (1,048,576 bytes) document ceiling
    if (cleanData.imageUrl && typeof cleanData.imageUrl === 'string' && cleanData.imageUrl.length > 150000) {
      try {
        cleanData.imageUrl = await compressImage(cleanData.imageUrl, { maxWidth: 800, maxHeight: 800, quality: 0.65 });
      } catch {}
    }
    if (cleanData.photoUrl && typeof cleanData.photoUrl === 'string' && cleanData.photoUrl.length > 150000) {
      try {
        cleanData.photoUrl = await compressImage(cleanData.photoUrl, { maxWidth: 800, maxHeight: 800, quality: 0.65 });
      } catch {}
    }
    if (Array.isArray(cleanData.gallery) && cleanData.gallery.length > 0) {
      const recent = cleanData.gallery.slice(-6);
      cleanData.gallery = await Promise.all(
        recent.map(async (p: string) => {
          if (typeof p === 'string' && p.length > 120000) {
            try {
              return await compressImage(p, { maxWidth: 800, maxHeight: 800, quality: 0.65 });
            } catch {
              return p;
            }
          }
          return p;
        })
      );
    }

    outboxService.enqueue(collectionPath, docId, cleanData);

    if (firestoreDb) {
      try {
        if (collectionPath !== 'members') {
          await this.ensureCloudAuthUserAndMemberSynced(cleanData.orgId);
        } else {
          const authUid = firebaseAuth?.currentUser?.uid;
          if (
            authUid &&
            authUid !== docId &&
            (cleanData.uid === authUid ||
              (cleanData.email &&
                firebaseAuth?.currentUser?.email &&
                cleanData.email.trim().toLowerCase() ===
                  firebaseAuth.currentUser.email.trim().toLowerCase()))
          ) {
            await setDoc(doc(firestoreDb, 'members', authUid), {
              ...cleanData,
              id: authUid,
              uid: authUid,
            }).catch(() => {});
          }
        }
        // Protect against demoting an already approved member on app reinstall or new phone:
        if (collectionPath === 'members' && cleanData.approvalStatus === 'PENDING_APPROVAL') {
          try {
            const snap = await getDoc(doc(firestoreDb, 'members', docId));
            if (snap.exists()) {
              const cloud = snap.data() as OrgMember;
              if (cloud && cloud.approvalStatus === 'APPROVED') {
                console.log(`[Cloud] Preserved existing APPROVED status for member ${docId} from cloud.`);
                return;
              }
            }
            const targetEmail = (cleanData.email || cleanData.phoneOrEmail || '').trim().toLowerCase();
            if (targetEmail && targetEmail.includes('@')) {
              const q = query(collection(firestoreDb, 'members'), where('email', '==', targetEmail));
              const qs = await getDocs(q);
              const approvedMatch = qs.docs
                .map((d) => d.data() as OrgMember)
                .find((m) => m.approvalStatus === 'APPROVED' || m.active);
              if (approvedMatch) {
                console.log(`[Cloud] Preserved existing APPROVED status for email ${targetEmail} from cloud.`);
                await setDoc(doc(firestoreDb, 'members', docId), {
                  ...cleanData,
                  role: approvedMatch.role || cleanData.role,
                  approvalStatus: 'APPROVED',
                  active: true,
                  assignedLocationId: approvedMatch.assignedLocationId || cleanData.assignedLocationId,
                });
                return;
              }
            }
          } catch {
            // Ignore pre-check warning and continue
          }
        }
        await setDoc(doc(firestoreDb, collectionPath, docId), cleanData);
      } catch (error) {
        console.warn(`Cloud persistence notice (${collectionPath}/${docId}):`, error);
      }
    }
  }

  /**
   * Directly queries Cloud Firestore to check if the member's account has been approved by the admin.
   * If approved in the cloud, updates local state and wakes up reactive listeners immediately.
   */
  public async checkMemberApprovalStatus(memberId: string): Promise<OrgMember | null> {
    const targetEmail =
      this.activeSession?.email ||
      this.state.members.find((m) => m.id === memberId || m.uid === memberId)?.email;
    const targetUid = this.activeSession?.uid || memberId;

    const cloudDoc = await this.fetchAuthoritativeCloudMember(targetUid, targetEmail);
    if (cloudDoc) {
      this.saveLocalState({ ...this.state });
      return cloudDoc;
    }

    return (
      this.state.members.find(
        (m) => m.id === memberId || (m.uid && m.uid === memberId)
      ) || null
    );
  }

  /**
   * Appends a new SHA-256 cryptographically hash-chained AuditNotificationEvent
   */
  private createChainedAuditEvent(params: {
    actor: OrgMember;
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
    photoUrl?: string;
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
      orgId: params.actor.orgId || this.state.activeOrgId || 'org-master',
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
      photoUrl: params.photoUrl,
    };

    void this.persistDocumentToCloudIfActive(
      'audit_notifications',
      newAuditEvent.id,
      newAuditEvent
    );

    if (typeof window !== 'undefined') {
      try {
        const NOTIFIED_IDS_STORAGE_KEY = 'agro_planner_notified_audit_ids_v1';
        const raw = window.localStorage.getItem(NOTIFIED_IDS_STORAGE_KEY);
        const list = raw ? (JSON.parse(raw) as string[]) : [];
        if (Array.isArray(list)) {
          list.push(newAuditEvent.id);
          window.localStorage.setItem(NOTIFIED_IDS_STORAGE_KEY, JSON.stringify(list.slice(-500)));
        }
      } catch {
        // Ignore storage error
      }
    }

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
    actor: OrgMember;
  }): FarmLocation {
    const now = new Date().toISOString();
    const id = `loc-${Date.now().toString(36)}`;
    const newLoc: FarmLocation = {
      id,
      orgId: params.actor.orgId || this.state.activeOrgId || 'org-master',
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

  public updateLocation(params: {
    locationId: string;
    name: string;
    region: string;
    gpsCoordinates: string;
    primaryOperatorName: string;
    actor: OrgMember;
  }): FarmLocation {
    const targetLoc = this.state.locations.find((l) => l.id === params.locationId);
    if (!targetLoc) {
      throw new Error(`Farm site not found with ID: ${params.locationId}`);
    }
    if (!PERMISSIONS.canEditLocation(params.actor.role)) {
      throw new Error('Access Denied: Only Organization Admins can modify farm sites.');
    }

    const now = new Date().toISOString();
    const updatedLoc: FarmLocation = {
      ...targetLoc,
      name: params.name.trim().slice(0, 120),
      region: params.region.trim().slice(0, 120),
      gpsCoordinates: params.gpsCoordinates.trim().slice(0, 80) || targetLoc.gpsCoordinates,
      primaryOperatorName: params.primaryOperatorName.trim().slice(0, 120),
      updatedAt: now,
    };

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: updatedLoc.id,
      locationName: updatedLoc.name,
      eventType: 'SITE_UPDATED',
      severity: 'INFO',
      title: `Site Details Updated: ${updatedLoc.name}`,
      message: `Updated site details (${updatedLoc.region}), operator ${updatedLoc.primaryOperatorName}. GPS: ${updatedLoc.gpsCoordinates}.`,
      referenceEntityId: updatedLoc.id,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      locations: this.state.locations.map((l) => (l.id === updatedLoc.id ? updatedLoc : l)),
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('locations', updatedLoc.id, updatedLoc);
    return updatedLoc;
  }

  public deleteLocation(params: {
    locationId: string;
    actor: OrgMember;
  }): { success: boolean; message: string } {
    const targetLoc = this.state.locations.find((l) => l.id === params.locationId);
    if (!targetLoc) {
      throw new Error(`Farm site not found with ID: ${params.locationId}`);
    }
    if (!PERMISSIONS.canDeleteLocation(params.actor.role)) {
      throw new Error('Access Denied: Only Organization Admins can delete farm sites.');
    }

    // Safety check: Cannot delete location if active livestock exist here
    const activeAnimals = this.state.livestockEntries.filter((l) => l.locationId === params.locationId);
    if (activeAnimals.length > 0) {
      throw new Error(`Cannot delete site: There are ${activeAnimals.length} active animal batch(es) registered at this location. Please reassign or harvest them first.`);
    }

    const now = new Date().toISOString();
    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: 'ALL',
      locationName: 'All Locations',
      eventType: 'SITE_REMOVED',
      severity: 'WARNING_CONTRA',
      title: `Site Removed: ${targetLoc.name}`,
      message: `Site ${targetLoc.name} (${targetLoc.region}) was decommissioned by ${params.actor.fullName}.`,
      referenceEntityId: targetLoc.id,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      locations: this.state.locations.filter((l) => l.id !== params.locationId),
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    if (firestoreDb) {
      deleteDoc(doc(firestoreDb, 'locations', targetLoc.id)).catch((err) =>
        console.warn('Cloud deleteLocation warning:', err)
      );
    }
    return { success: true, message: `Site ${targetLoc.name} removed successfully.` };
  }

  public addMember(params: {
    fullName: string;
    phoneOrEmail: string;
    role: Role;
    assignedLocationId?: string;
    initialContributionUsd?: number;
    contributionNote?: string;
    actor: OrgMember;
  }): OrgMember {
    if (!PERMISSIONS.canManageMembers(params.actor.role)) {
      throw new Error('Access Denied: Only Organization Admins can create or authorize members.');
    }

    const now = new Date().toISOString();
    const id = `mem-${Date.now().toString(36)}`;
    const contact = params.phoneOrEmail.trim().slice(0, 160);
    const isEmail = contact.includes('@');

    const newMember: OrgMember = {
      id,
      orgId: params.actor.orgId || this.state.activeOrgId || 'org-master',
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
        'All Locations (Master Organization)',
      eventType: 'MEMBER_ADDED',
      severity: 'INFO',
      title: `Member Added: ${newMember.fullName}`,
      message: `${newMember.fullName} added to the organization as ${newMember.role.replace('_', ' ')} (Approved). Contact: ${newMember.phoneOrEmail}.`,
      referenceEntityId: newMember.id,
      timestamp: now,
    });
    updatedAudits.unshift(memberAudit);
    this.state.auditNotifications = updatedAudits;

    if (params.initialContributionUsd && params.initialContributionUsd > 0) {
      const capId = `TX-CAP-${Date.now().toString(36).toUpperCase()}`;
      const note =
        params.contributionNote?.trim() ||
        `Initial capital contribution by ${newMember.fullName} upon joining organization`;
      const capEvent: CapitalContributionEvent = {
        id: capId,
        orgId: newMember.orgId,
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
        locationName: 'All Locations (Master Organization)',
        eventType: 'CAPITAL_CONTRIBUTION',
        severity: 'FINANCIAL',
        title: `Capital Contributed: +$${capEvent.amount.toFixed(2)} (${newMember.fullName})`,
        message: `${capEvent.id}: ${note}. Added +$${capEvent.amount.toFixed(2)} to Organization Pool & Left Money.`,
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
    actor: OrgMember;
    runwayPlanId?: string;
    pledgeId?: string;
    claimId?: string;
  }): CapitalContributionEvent {
    if (!PERMISSIONS.canLogCapitalDeposit(params.actor.role)) {
      throw new Error('Access Denied: Only Treasurers and Organization Admins can record capital contributions.');
    }
    const member = this.state.members.find((m) => m.id === params.memberId);
    if (!member) throw new Error('Selected member not found.');
    if (params.note.trim().length < 4) {
      throw new Error('A mandatory explanation note (at least 4 characters) is required.');
    }

    const now = new Date().toISOString();
    const isContra = params.direction === 'CONTRA_REVERSAL';
    const id = `TX-CAP-${Date.now().toString(36).toUpperCase()}${isContra ? '-CONTRA' : ''}`;
    const cleanAmount = Number(params.amount.toFixed(2));
    const cleanNote = params.note.trim().slice(0, 500);

    let planId = params.runwayPlanId;
    let plgId = params.pledgeId;
    let clmId = params.claimId;

    if (isContra && params.referenceTransactionId) {
      const ref = this.state.capitalContributions.find((c) => c.id === params.referenceTransactionId);
      if (ref && ref.runwayPlanId) {
        planId = ref.runwayPlanId;
        plgId = ref.pledgeId;
        clmId = ref.claimId;
      }
    } else if (planId && !plgId) {
      const matchedPledge = (this.state.runwayPledges || []).find(
        (p) => p.planId === planId && p.memberId === member.id
      );
      if (matchedPledge) {
        plgId = matchedPledge.id;
      }
    }

    const newEvent: CapitalContributionEvent = {
      id,
      orgId: member.orgId || params.actor.orgId || this.state.activeOrgId || 'org-master',
      memberId: member.id,
      memberName: member.fullName,
      direction: params.direction,
      amount: cleanAmount,
      referenceTransactionId: params.referenceTransactionId,
      note: cleanNote,
      runwayPlanId: planId,
      pledgeId: plgId,
      claimId: clmId,
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

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: 'ALL',
      locationName: 'All Locations (Master Organization)',
      eventType: isContra ? 'CAPITAL_CONTRA' : 'CAPITAL_CONTRIBUTION',
      severity: isContra ? 'WARNING_CONTRA' : 'FINANCIAL',
      title: isContra
        ? `Capital Contra-Entry (${cleanAmount >= 0 ? '+' : ''}$${cleanAmount.toFixed(2)} for ${member.fullName})`
        : `Capital Contribution: +$${cleanAmount.toFixed(2)} by ${member.fullName}`,
      message: isContra
        ? `${id} referencing ${params.referenceTransactionId}: ${cleanNote}. Equity pool adjusted by ${cleanAmount >= 0 ? '+' : ''}$${cleanAmount.toFixed(2)}.`
        : `${id}: ${cleanNote}. Added +$${cleanAmount.toFixed(2)} to Organization Pool & Left Money.`,
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
    void this.persistDocumentToCloudIfActive('audit_notifications', audit.id, audit);
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
    actor: OrgMember;
    runwayAllocation?: RunwayAllocation;
    runwayPlanId?: string;
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

    let targetPlanId = params.runwayPlanId;
    const expAlloc = params.runwayAllocation;
    if (!targetPlanId && expAlloc?.mode === 'LINE') {
      const line = (this.state.runwayLines || []).find((l) => l.id === expAlloc.lineId);
      if (line) targetPlanId = line.planId;
    }
    const targetPlan = targetPlanId
      ? (this.state.runwayPlans || []).find((p) => p.id === targetPlanId)
      : undefined;

    const targetOrgId = targetPlan?.orgId || params.actor.orgId || loc.orgId || this.state.activeOrgId || 'org-master';

    let runwayPlanId: string | undefined;
    let runwayLineId: string | undefined;
    let runwayReserveDraw: number | undefined;
    let runwayAllocationNote: string | undefined;

    if (isContra && params.referenceTransactionId) {
      const alreadyReversed = this.state.expenses.some(
        (e) => e.direction === 'CONTRA_REVERSAL' && e.referenceTransactionId === params.referenceTransactionId
      );
      if (alreadyReversed) {
        throw new Error(`Expense transaction ${params.referenceTransactionId} has already been reversed.`);
      }
      const ref = this.state.expenses.find((e) => e.id === params.referenceTransactionId);
      if (ref && ref.runwayPlanId) {
        runwayPlanId = ref.runwayPlanId;
        runwayLineId = ref.runwayLineId;
        if (ref.runwayReserveDraw) {
          runwayReserveDraw = -Math.abs(ref.runwayReserveDraw);
        }
      }
    } else if (!isContra) {
      const tags = this.assertRunwayCompliance({
        orgId: targetOrgId,
        amount: cleanAmount,
        allocation: params.runwayAllocation,
        actor: params.actor,
        planId: targetPlanId,
      });
      runwayPlanId = tags.runwayPlanId || targetPlanId;
      runwayLineId = tags.runwayLineId || (params.runwayAllocation?.mode === 'LINE' ? params.runwayAllocation.lineId : undefined);
      runwayReserveDraw = tags.runwayReserveDraw;
      runwayAllocationNote = tags.runwayAllocationNote;
    }

    const requiresMultiSig = !isContra && cleanAmount > 150 && !runwayPlanId;
    const approvalStatus = requiresMultiSig ? 'PENDING_MULTISIG' : 'APPROVED';

    const newExpense: ExpenseLedgerEvent = {
      id,
      orgId: targetOrgId,
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
      runwayPlanId,
      runwayLineId,
      runwayReserveDraw,
      runwayAllocationNote,
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
    void this.persistDocumentToCloudIfActive('audit_notifications', audit.id, audit);

    if (newExpense.runwayPlanId && newExpense.approvalStatus === 'APPROVED') {
      this.checkAndBroadcastPlanMilestones(newExpense.runwayPlanId, params.actor);
    }

    return newExpense;
  }

  public approveMultiSigExpense(expenseId: string, actor: OrgMember): void {
    if (!PERMISSIONS.canApproveMultiSig(actor.role)) {
      throw new Error('Access Denied: Only Treasurers and Organization Admins can approve multi-sig expenses.');
    }
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
    if (firestoreDb) {
      updateDoc(doc(firestoreDb, 'expense_ledger', expenseId), {
        approvalStatus: 'APPROVED',
        approvedByMemberIds: updatedApprovedBy,
      }).catch((err) => console.warn('Cloud expense approval update warning:', err));
    }
    void this.persistDocumentToCloudIfActive('audit_notifications', audit.id, audit);

    if (target.runwayPlanId) {
      this.checkAndBroadcastPlanMilestones(target.runwayPlanId, actor);
    }
  }

  public getCurrentOrgLeftMoney(orgId?: string): number {
    const targetOrgId = orgId || this.state.activeOrgId || 'org-master';
    const orgContributions = (this.state.capitalContributions || []).filter(
      (c) => !c.orgId || c.orgId === targetOrgId
    );
    const orgExpenses = (this.state.expenses || []).filter(
      (e) => !e.orgId || e.orgId === targetOrgId
    );
    const orgFixedAssets = (this.state.fixedAssets || []).filter(
      (a) => !a.orgId || a.orgId === targetOrgId
    );
    const orgLivestockEntries = (this.state.livestockEntries || []).filter(
      (l) => !l.orgId || l.orgId === targetOrgId
    );
    const orgLivestockEvents = (this.state.livestockEvents || []).filter(
      (e) => !e.orgId || e.orgId === targetOrgId
    );
    const orgFeedEvents = (this.state.feedLedger || []).filter(
      (f) => !f.orgId || f.orgId === targetOrgId
    );
    const orgDebts = (this.state.debtLiabilities || []).filter(
      (d) => !d.orgId || d.orgId === targetOrgId
    );
    const orgLoans = (this.state.loansGiven || []).filter(
      (l) => !l.orgId || l.orgId === targetOrgId
    );
    const orgCreditSales = (this.state.creditSales || []).filter(
      (cs) => !cs.orgId || cs.orgId === targetOrgId
    );

    const livestockStatuses = orgLivestockEntries.map((entry) =>
      computeLivestockStatus(entry, orgLivestockEvents, orgFeedEvents)
    );

    const summary = computeFinancialSummary({
      capitalContributions: orgContributions,
      expenses: orgExpenses,
      fixedAssets: orgFixedAssets,
      livestockStatuses,
      livestockEvents: orgLivestockEvents,
      debtLiabilities: orgDebts,
      loansGiven: orgLoans,
      creditSales: orgCreditSales,
    });

    return summary.leftMoney;
  }

  public registerLivestock(params: {
    locationId: string;
    species: string;
    nameOrTag: string;
    trackingMode?: TrackingMode;
    entryDate?: string;
    initialAgeValue?: number;
    initialAgeUnit?: DurationUnit;
    targetDurationValue: number;
    targetDurationUnit: DurationUnit;
    initialHeadcount: number;
    purchaseCostTotal: number;
    targetSaleWeightKg?: number;
    notes: string;
    autoDeductPurchaseFromLeftMoney?: boolean;
    imageUrl?: string;
    gallery?: string[];
    customCheckpoints?: AnimalCheckpoint[];
    fundingSource?: 'CASH_POOL' | 'SUPPLIER_CREDIT' | 'DIRECTOR_LOAN';
    supplierCreditorName?: string;
    creditorName?: string;
    supplierCreditDueDate?: string;
    duePaymentDate?: string;
    configuredSalePricePerUnit?: number;
    configuredSalePricePerKg?: number;
    actor: OrgMember;
    runwayAllocation?: RunwayAllocation;
  }): LivestockEntry {
    const loc = this.state.locations.find((l) => l.id === params.locationId);
    if (!loc) throw new Error('Valid farm location is required.');
    if (params.notes.trim().length < 4) {
      throw new Error('Mandatory notes (at least 4 characters) are required.');
    }

    const now = new Date().toISOString();
    const id = `LSTK-${Date.now().toString(36).toUpperCase()}`;
    const entryDate = params.entryDate || now;
    const targetSaleDate = computeTargetSaleDate(
      entryDate,
      params.targetDurationValue,
      params.targetDurationUnit
    );

    const targetOrgId = params.actor.orgId || loc.orgId || this.state.activeOrgId || 'org-master';
    const currentLeftMoney = this.getCurrentOrgLeftMoney(targetOrgId);

    // Strict Overdraft & Funding Source Validation Guard:
    if (params.purchaseCostTotal > 0) {
      if (params.fundingSource === 'SUPPLIER_CREDIT') {
        // Trade credit from supplier: validated and processed as a liability without deducting phantom cash
      } else {
        if (currentLeftMoney <= 0) {
          throw new Error(
            `Insufficient liquid funds in Left Money ($0.00 available). Cannot purchase livestock ($${params.purchaseCostTotal.toFixed(2)}) with zero funds. Please deposit capital into the pool first.`
          );
        }
        if (params.purchaseCostTotal > currentLeftMoney) {
          throw new Error(
            `Insufficient liquid funds in Left Money pool. Purchase cost ($${params.purchaseCostTotal.toFixed(2)}) exceeds available cash ($${currentLeftMoney.toFixed(2)}). Please deposit capital into the pool first.`
          );
        }
      }
    }

    const galleryPhotos = params.gallery || (params.imageUrl ? [params.imageUrl] : []);

    const newEntry: LivestockEntry = {
      id,
      orgId: targetOrgId,
      locationId: loc.id,
      locationName: loc.name,
      species: params.species.trim().slice(0, 80),
      nameOrTag: params.nameOrTag.trim().slice(0, 140),
      trackingMode: params.trackingMode || 'BATCH',
      entryDate: params.entryDate || now,
      initialAgeValue: params.initialAgeValue ?? 1,
      initialAgeUnit: params.initialAgeUnit || 'DAYS',
      targetDurationValue: params.targetDurationValue,
      targetDurationUnit: params.targetDurationUnit,
      targetSaleDate,
      initialHeadcount: params.initialHeadcount,
      purchaseCostTotal: params.purchaseCostTotal,
      targetSaleWeightKg: params.targetSaleWeightKg,
      notes: params.notes.trim().slice(0, 500),
      createdByMemberName: params.actor.fullName,
      imageUrl: params.imageUrl || galleryPhotos[0],
      gallery: galleryPhotos,
      createdAt: now,
      customCheckpoints: params.customCheckpoints,
      fundingSource: params.fundingSource || (params.autoDeductPurchaseFromLeftMoney ? 'CASH_POOL' : undefined),
      configuredSalePricePerUnit: params.configuredSalePricePerUnit,
      configuredSalePricePerKg: params.configuredSalePricePerKg,
    };

    const initEventId = `EV-LSTK-${Date.now().toString(36).toUpperCase()}`;
    const entryTimestamp = params.entryDate || now;
    const initialLifecycleEvent: LivestockLifecycleEvent = {
      id: initEventId,
      orgId: newEntry.orgId,
      livestockId: newEntry.id,
      livestockName: newEntry.nameOrTag,
      locationId: loc.id,
      eventType: 'INITIAL_STOCK',
      headcountDelta: params.initialHeadcount,
      note: `Initial registration of ${params.initialHeadcount}x ${newEntry.species} (${newEntry.nameOrTag}). ${params.notes.trim()}`,
      loggedByName: params.actor.fullName,
      photoUrl: params.imageUrl || galleryPhotos[0],
      createdAt: entryTimestamp,
      auditHash: computeLedgerRecordHash(
        'LIVESTOCK_EVENT',
        initEventId,
        entryTimestamp,
        params.initialHeadcount,
        params.notes.trim()
      ),
    };

    const updatedAudits = [...this.state.auditNotifications];
    const updatedExpenses = [...this.state.expenses];
    const updatedDebts = [...(this.state.debtLiabilities || [])];

    // If acquired on supplier credit, record liability immediately
    if (params.fundingSource === 'SUPPLIER_CREDIT' && params.purchaseCostTotal > 0) {
      const debtId = `DEBT-${Date.now().toString(36).toUpperCase()}`;
      const creditor = (params.supplierCreditorName || (params as any).creditorName || '').trim() || 'Livestock Supplier';
      const debtNote = `Supplier credit for acquisition of ${params.initialHeadcount}x ${newEntry.nameOrTag} (${newEntry.species}) at ${loc.name}. Creditor: ${creditor}.`;
      const debtEvent: DebtLiabilityEvent = {
        id: debtId,
        orgId: newEntry.orgId || 'org-master',
        creditorName: creditor,
        category: 'SUPPLIER_CREDIT',
        principalAmount: Number(params.purchaseCostTotal.toFixed(2)),
        remainingBalance: Number(params.purchaseCostTotal.toFixed(2)),
        borrowDate: now,
        dueDate: params.supplierCreditDueDate || (params as any).duePaymentDate || new Date(Date.now() + 30 * 86400000).toISOString(),
        purposeNote: debtNote,
        status: 'OUTSTANDING',
        linkedBatchId: newEntry.id,
        referenceEntityId: newEntry.id,
        repayments: [],
        loggedByMemberId: params.actor.id,
        loggedByName: params.actor.fullName,
        createdAt: now,
        auditHash: computeLedgerRecordHash('DEBT', debtId, now, params.purchaseCostTotal, debtNote),
      };
      newEntry.fundingDebtId = debtId;
      updatedDebts.unshift(debtEvent);
      void this.persistDocumentToCloudIfActive('debt_liabilities', debtEvent.id, debtEvent);

      if (params.runwayAllocation && params.runwayAllocation.mode === 'LINE') {
        const line = (this.state.runwayLines || []).find((l) => l.id === (params.runwayAllocation as any).lineId);
        if (line) {
          line.linkedDebtId = debtId;
          void this.persistDocumentToCloudIfActive('runway_lines', line.id, line);
        }
      }
    }

    const regAudit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: loc.id,
      locationName: loc.name,
      eventType: 'LIVESTOCK_REGISTERED',
      severity: 'MILESTONE',
      title: `Registered ${params.initialHeadcount}x ${newEntry.species}: ${newEntry.nameOrTag}`,
      message: `${newEntry.nameOrTag} (${params.trackingMode}) stocked at ${loc.name}. Funding: ${params.fundingSource || (params.autoDeductPurchaseFromLeftMoney ? 'CASH_POOL' : 'NONE')}. Notes: ${newEntry.notes}`,
      deltaHeadcount: params.initialHeadcount,
      deltaFinancial: params.fundingSource === 'SUPPLIER_CREDIT' ? 0 : params.autoDeductPurchaseFromLeftMoney ? -params.purchaseCostTotal : 0,
      referenceEntityId: newEntry.id,
      photoUrl: params.imageUrl || galleryPhotos[0],
      timestamp: now,
    });
    updatedAudits.unshift(regAudit);
    this.state.auditNotifications = updatedAudits;

    if (params.fundingSource !== 'SUPPLIER_CREDIT' && params.autoDeductPurchaseFromLeftMoney && params.purchaseCostTotal > 0) {
      const tags = this.assertRunwayCompliance({
        orgId: targetOrgId,
        amount: params.purchaseCostTotal,
        allocation: params.runwayAllocation,
        actor: params.actor,
      });

      const expId = `TX-EXP-${Date.now().toString(36).toUpperCase()}`;
      const expNote = `Auto-logged livestock acquisition cost for ${params.initialHeadcount}x ${newEntry.nameOrTag} (${newEntry.species}) at ${loc.name}.`;
      const expEvent: ExpenseLedgerEvent = {
        id: expId,
        orgId: targetOrgId,
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
        receiptPhotoDataUrl: params.imageUrl,
        approvalStatus: 'APPROVED',
        approvedByMemberIds: [params.actor.id],
        runwayPlanId: tags.runwayPlanId,
        runwayLineId: tags.runwayLineId,
        runwayReserveDraw: tags.runwayReserveDraw,
        runwayAllocationNote: tags.runwayAllocationNote,
        createdAt: now,
        auditHash: computeLedgerRecordHash('EXPENSE', expId, now, params.purchaseCostTotal, expNote),
      };
      updatedExpenses.unshift(expEvent);
      void this.persistDocumentToCloudIfActive('expense_ledger', expEvent.id, expEvent);

      if (expEvent.runwayPlanId) {
        this.checkAndBroadcastPlanMilestones(expEvent.runwayPlanId, params.actor);
      }
    }

    const nextState: AgroStateSnapshot = {
      ...this.state,
      livestockEntries: [newEntry, ...this.state.livestockEntries],
      livestockEvents: [initialLifecycleEvent, ...this.state.livestockEvents],
      expenses: updatedExpenses,
      auditNotifications: updatedAudits,
      debtLiabilities: updatedDebts,
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('livestock_entries', newEntry.id, newEntry);
    void this.persistDocumentToCloudIfActive(
      'livestock_lifecycle_events',
      initialLifecycleEvent.id,
      initialLifecycleEvent
    );
    void this.persistDocumentToCloudIfActive('audit_notifications', regAudit.id, regAudit);
    return newEntry;
  }

  public addLivestockGalleryPhoto(params: {
    livestockId: string;
    photoUrl: string;
    caption?: string;
    actor: OrgMember;
  }): LivestockLifecycleEvent {
    const entry = this.state.livestockEntries.find((l) => l.id === params.livestockId);
    if (!entry) throw new Error('Livestock batch or animal not found.');
    if (!params.photoUrl) throw new Error('Photo URL or image data is required.');

    const now = new Date().toISOString();
    const id = `EV-LSTK-PHOTO-${Date.now().toString(36).toUpperCase()}`;
    const cleanCaption = (params.caption || `Ground photo update for ${entry.nameOrTag}`).trim().slice(0, 500);

    const newEvent: LivestockLifecycleEvent = {
      id,
      orgId: this.state.activeOrgId || this.state.organizations?.[0]?.id || entry.orgId || params.actor.orgId || 'org-master',
      livestockId: entry.id,
      livestockName: entry.nameOrTag,
      locationId: entry.locationId,
      eventType: 'PHOTO_PROGRESS',
      headcountDelta: 0,
      note: cleanCaption,
      loggedByName: params.actor.fullName,
      photoUrl: params.photoUrl,
      createdAt: now,
      auditHash: computeLedgerRecordHash(
        'LIVESTOCK_EVENT',
        id,
        now,
        0,
        cleanCaption
      ),
    };

    const currentGallery = entry.gallery || [];
    const updatedGallery = currentGallery.includes(params.photoUrl)
      ? currentGallery
      : [...currentGallery, params.photoUrl];

    const updatedEntry: LivestockEntry = {
      ...entry,
      imageUrl: entry.imageUrl || params.photoUrl,
      gallery: updatedGallery,
    };

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: entry.locationId,
      locationName: entry.locationName,
      eventType: 'GROUND_BROADCAST',
      severity: 'INFO',
      title: `Ground Photo Uploaded: ${entry.nameOrTag}`,
      message: `${entry.nameOrTag} photo evidence added by ${params.actor.fullName}: ${cleanCaption}`,
      referenceEntityId: entry.id,
      photoUrl: params.photoUrl,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      livestockEntries: this.state.livestockEntries.map((l) => (l.id === entry.id ? updatedEntry : l)),
      livestockEvents: [newEvent, ...this.state.livestockEvents],
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('livestock_entries', updatedEntry.id, updatedEntry);
    void this.persistDocumentToCloudIfActive('livestock_lifecycle_events', newEvent.id, newEvent);
    void this.persistDocumentToCloudIfActive('audit_notifications', audit.id, audit);
    return newEvent;
  }

  public updateLivestockEntry(params: {
    id: string;
    updates: {
      locationId?: string;
      species?: string;
      nameOrTag?: string;
      trackingMode?: TrackingMode;
      entryDate?: string;
      initialAgeValue?: number;
      initialAgeUnit?: DurationUnit;
      targetDurationValue?: number;
      targetDurationUnit?: DurationUnit;
      initialHeadcount?: number;
      purchaseCostTotal?: number;
      targetSaleWeightKg?: number;
      notes?: string;
      imageUrl?: string;
      gallery?: string[];
      customCheckpoints?: AnimalCheckpoint[];
      fundingSource?: 'CASH_POOL' | 'SUPPLIER_CREDIT' | 'DIRECTOR_LOAN';
      configuredSalePricePerUnit?: number;
      configuredSalePricePerKg?: number;
    };
    actor: OrgMember;
  }): LivestockEntry {
    const existing = this.state.livestockEntries.find((l) => l.id === params.id);
    if (!existing) throw new Error(`Livestock record "${params.id}" not found.`);

    let loc = params.updates.locationId
      ? this.state.locations.find((l) => l.id === params.updates.locationId)
      : this.state.locations.find((l) => l.id === existing.locationId);

    const locationId = loc ? loc.id : existing.locationId;
    const locationName = loc ? loc.name : existing.locationName;

    const entryDate = params.updates.entryDate || existing.entryDate;
    const targetDurationValue = params.updates.targetDurationValue ?? existing.targetDurationValue;
    const targetDurationUnit = params.updates.targetDurationUnit || existing.targetDurationUnit;

    const targetSaleDate = computeTargetSaleDate(
      entryDate,
      targetDurationValue,
      targetDurationUnit
    );

    const updatedEntry: LivestockEntry = {
      ...existing,
      ...params.updates,
      locationId,
      locationName,
      entryDate,
      targetDurationValue,
      targetDurationUnit,
      targetSaleDate,
      species: params.updates.species ? params.updates.species.trim().slice(0, 80) : existing.species,
      nameOrTag: params.updates.nameOrTag ? params.updates.nameOrTag.trim().slice(0, 140) : existing.nameOrTag,
      notes: params.updates.notes !== undefined ? params.updates.notes.trim().slice(0, 500) : existing.notes,
    };

    // If initial headcount changed, adjust initial stock lifecycle event
    if (params.updates.initialHeadcount !== undefined && params.updates.initialHeadcount !== existing.initialHeadcount) {
      const initEvent = this.state.livestockEvents.find(
        (e) => e.livestockId === existing.id && e.eventType === 'INITIAL_STOCK'
      );
      if (initEvent) {
        initEvent.headcountDelta = params.updates.initialHeadcount;
        void this.persistDocumentToCloudIfActive('livestock_lifecycle_events', initEvent.id, initEvent);
      }
    }

    const now = new Date().toISOString();
    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: updatedEntry.locationId,
      locationName: updatedEntry.locationName,
      eventType: 'GROUND_BROADCAST',
      severity: 'INFO',
      title: `Livestock Updated: ${updatedEntry.nameOrTag}`,
      message: `Updated batch specifications for ${updatedEntry.nameOrTag} (${updatedEntry.species}) at ${updatedEntry.locationName}.`,
      referenceEntityId: updatedEntry.id,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      livestockEntries: this.state.livestockEntries.map((l) => (l.id === existing.id ? updatedEntry : l)),
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('livestock_entries', updatedEntry.id, updatedEntry);
    void this.persistDocumentToCloudIfActive('audit_notifications', audit.id, audit);
    return updatedEntry;
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
    photoUrl?: string;
    actor: OrgMember;
  }): LivestockLifecycleEvent {
    const entry = this.state.livestockEntries.find((l) => l.id === params.livestockId);
    if (!entry) throw new Error('Livestock batch or animal not found.');
    if (params.note.trim().length < 4) {
      throw new Error('Mandatory note (at least 4 characters) is required.');
    }

    // Operational bounds validation: verify headcount availability
    const existingEvents = this.state.livestockEvents.filter((e) => e.livestockId === entry.id);
    const currentHeadcount = entry.initialHeadcount + existingEvents.reduce((acc, e) => acc + (e.headcountDelta || 0), 0);
    if (params.eventType === 'MORTALITY_LOSS' && params.headcountDelta) {
      const loss = Math.abs(params.headcountDelta);
      if (loss > currentHeadcount) {
        throw new Error(`Invalid mortality: Headcount loss (${loss}) exceeds current live headcount (${currentHeadcount}).`);
      }
    }
    if (params.eventType === 'SALE_DISPATCH' && params.headcountDelta) {
      const sold = Math.abs(params.headcountDelta);
      if (sold > currentHeadcount) {
        throw new Error(`Invalid sale: Harvest headcount (${sold}) exceeds current live headcount (${currentHeadcount}).`);
      }
    }
    if (params.eventType === 'SLAUGHTER_HARVEST' && params.headcountDelta) {
      const slaughtered = Math.abs(params.headcountDelta);
      if (slaughtered > currentHeadcount) {
        throw new Error(`Invalid harvest: Slaughter count (${slaughtered}) exceeds current live headcount (${currentHeadcount}).`);
      }
    }
    if (params.eventType === 'FARM_CONSUMPTION' && params.headcountDelta) {
      const consumed = Math.abs(params.headcountDelta);
      if (consumed > currentHeadcount) {
        throw new Error(`Invalid consumption: Count (${consumed}) exceeds current live headcount (${currentHeadcount}).`);
      }
    }

    const now = new Date().toISOString();
    const id = `EV-LSTK-${Date.now().toString(36).toUpperCase()}`;
    const cleanNote = params.note.trim().slice(0, 500);

    const newEvent: LivestockLifecycleEvent = {
      id,
      orgId: this.state.activeOrgId || this.state.organizations?.[0]?.id || entry.orgId || params.actor.orgId || 'org-master',
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
      photoUrl: params.photoUrl,
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
    } else if (params.eventType === 'SLAUGHTER_HARVEST') {
      auditType = 'GROUND_BROADCAST';
      severity = 'MILESTONE';
      title = `Slaughter & Harvest: ${Math.abs(params.headcountDelta)} processed from ${entry.nameOrTag}`;
    } else if (params.eventType === 'FARM_CONSUMPTION') {
      auditType = 'GROUND_BROADCAST';
      severity = 'INFO';
      title = `Farm / Internal Consumption: ${Math.abs(params.headcountDelta)} from ${entry.nameOrTag}`;
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
      photoUrl: params.photoUrl,
      timestamp: now,
    });

    let nextLivestockEntries = this.state.livestockEntries;
    if (params.photoUrl) {
      const currentGallery = entry.gallery || [];
      if (!currentGallery.includes(params.photoUrl)) {
        const updatedEntry: LivestockEntry = {
          ...entry,
          imageUrl: entry.imageUrl || params.photoUrl,
          gallery: [...currentGallery, params.photoUrl],
        };
        nextLivestockEntries = this.state.livestockEntries.map((l) =>
          l.id === entry.id ? updatedEntry : l
        );
        void this.persistDocumentToCloudIfActive('livestock_entries', updatedEntry.id, updatedEntry);
      }
    }

    const nextState: AgroStateSnapshot = {
      ...this.state,
      livestockEntries: nextLivestockEntries,
      livestockEvents: [newEvent, ...this.state.livestockEvents],
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('livestock_lifecycle_events', newEvent.id, newEvent);
    void this.persistDocumentToCloudIfActive('audit_notifications', audit.id, audit);
    return newEvent;
  }

  public dispatchLivestockMilestoneBroadcast(params: {
    livestockId: string;
    dayTarget: number;
    milestoneTitle: string;
    customNote?: string;
    actor: OrgMember;
  }): AuditNotificationEvent {
    const entry = this.state.livestockEntries.find((l) => l.id === params.livestockId);
    if (!entry) throw new Error('Livestock batch or animal not found.');

    const status = computeLivestockStatus(
      entry,
      this.state.livestockEvents,
      this.state.feedLedger
    );

    const proto = status.protocols.find((p) => p.dayTarget === params.dayTarget);
    const now = new Date().toISOString();
    const cleanTitle = (params.milestoneTitle || proto?.title || `Day ${params.dayTarget} Checkpoint`).trim();

    const weightComparison = status.latestWeightAvgKg != null
      ? `Recorded Weight: ${status.latestWeightAvgKg} kg${proto?.targetWeightKg ? ` (Benchmark: ${proto.targetWeightKg} kg)` : ''}`
      : proto?.targetWeightKg ? `Target S-Curve Weight: ${proto.targetWeightKg} kg` : '';

    const feedInfo = proto?.feedPhase ? `Feed Phase: ${proto.feedPhase}` : '';
    const headcountInfo = `Live Headcount: ${status.currentLiveHeadcount} head (${status.mortalityRatePercent}% mortality)`;
    const progressInfo = `Age: Day ${status.currentTotalAgeDays} on site (${status.daysLeftUntilSale} days left to market)`;
    const notePart = params.customNote?.trim() ? `Field Observation: ${params.customNote.trim()}` : (proto?.description ? `Protocol: ${proto.description}` : '');

    const message = [
      `Milestone checkpoint reached for ${entry.nameOrTag} (${entry.species}) at ${entry.locationName}.`,
      progressInfo,
      headcountInfo,
      weightComparison,
      feedInfo,
      notePart,
    ].filter(Boolean).join(' · ');

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: entry.locationId,
      locationName: entry.locationName,
      eventType: 'GROUND_BROADCAST',
      severity: 'MILESTONE',
      title: `Milestone: Day ${params.dayTarget} ${cleanTitle.replace(/^Day \d+:\s*/i, '')} — ${entry.nameOrTag}`,
      message,
      referenceEntityId: entry.id,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('audit_notifications', audit.id, audit);
    return audit;
  }

  public recordDebtLiability(params: {
    orgId?: string;
    creditorName: string;
    creditorContact?: string;
    category: DebtCategory;
    principalAmount: number;
    borrowDate?: string;
    dueDate?: string;
    interestRatePercent?: number;
    purposeNote: string;
    linkedBatchId?: string;
    linkedAssetId?: string;
    actor: OrgMember;
  }): DebtLiabilityEvent {
    if (!params.creditorName.trim()) throw new Error('Creditor name is required.');
    if (!params.principalAmount || params.principalAmount <= 0) {
      throw new Error('Principal amount must be greater than zero.');
    }
    if (params.purposeNote.trim().length < 4) {
      throw new Error('Mandatory purpose explanation (at least 4 characters) is required.');
    }

    const now = new Date().toISOString();
    const id = `DEBT-${Date.now().toString(36).toUpperCase()}`;
    const targetOrgId = params.orgId || params.actor.orgId || this.state.activeOrgId || 'org-master';
    const amount = Number(params.principalAmount.toFixed(2));

    const newDebt: DebtLiabilityEvent = {
      id,
      orgId: targetOrgId,
      creditorName: params.creditorName.trim(),
      creditorContact: params.creditorContact?.trim(),
      category: params.category,
      principalAmount: amount,
      remainingBalance: amount,
      borrowDate: params.borrowDate || now,
      dueDate: params.dueDate,
      interestRatePercent: params.interestRatePercent,
      purposeNote: params.purposeNote.trim(),
      status: 'OUTSTANDING',
      linkedBatchId: params.linkedBatchId,
      linkedAssetId: params.linkedAssetId,
      repayments: [],
      loggedByMemberId: params.actor.id,
      loggedByName: params.actor.fullName,
      createdAt: now,
      auditHash: computeLedgerRecordHash('DEBT', id, now, amount, params.purposeNote.trim()),
    };

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: 'ALL',
      locationName: 'Treasury Vault',
      eventType: 'FINANCIAL_TRANSACTION',
      severity: 'FINANCIAL',
      title: `Liability Recorded: $${amount.toFixed(2)} from ${newDebt.creditorName}`,
      message: `${newDebt.creditorName} (${newDebt.category}) obligation of $${amount.toFixed(2)} logged by ${params.actor.fullName}. Due: ${newDebt.dueDate ? new Date(newDebt.dueDate).toLocaleDateString() : 'Open term'}. Purpose: ${newDebt.purposeNote}`,
      referenceEntityId: id,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      debtLiabilities: [newDebt, ...(this.state.debtLiabilities || [])],
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('debt_liabilities', newDebt.id, newDebt);
    void this.persistDocumentToCloudIfActive('audit_notifications', audit.id, audit);

    if (newDebt.dueDate) {
      const numericDebtReminderId = Math.abs(id.split('').reduce((acc, c) => (acc << 5) - acc + c.charCodeAt(0), 0));
      void nativeReminders.scheduleDueReminders({
        id: numericDebtReminderId,
        title: `Debt Due: ${params.creditorName}`,
        body: `Payment of $${amount.toFixed(2)}`,
        dueDate: new Date(newDebt.dueDate),
        entityId: id,
        type: 'DEBT_LIABILITY',
      });
    }

    return newDebt;
  }

  public repayDebtLiability(params: {
    debtId: string;
    amount: number;
    paymentMethod: string;
    receiptReference?: string;
    note?: string;
    referenceNote?: string;
    actor: OrgMember;
    runwayAllocation?: RunwayAllocation;
  }): DebtRepaymentLog {
    const debt = (this.state.debtLiabilities || []).find((d) => d.id === params.debtId);
    if (!debt) throw new Error('Debt liability record not found.');
    if (params.amount <= 0) throw new Error('Repayment amount must be greater than zero.');
    if (params.amount > debt.remainingBalance) {
      throw new Error(`Repayment ($${params.amount.toFixed(2)}) exceeds remaining debt balance ($${debt.remainingBalance.toFixed(2)}).`);
    }

    const currentLeftMoney = this.getCurrentOrgLeftMoney(debt.orgId);
    if (params.amount > currentLeftMoney) {
      throw new Error(`Insufficient liquid funds in Left Money ($${currentLeftMoney.toFixed(2)} available) to disburse repayment of $${params.amount.toFixed(2)}.`);
    }

    this.assertRunwayCompliance({
      orgId: debt.orgId,
      amount: params.amount,
      allocation: params.runwayAllocation,
      actor: params.actor,
    });

    const now = new Date().toISOString();
    const repId = `REP-${Date.now().toString(36).toUpperCase()}`;
    const cleanNote = (params.note || params.referenceNote || '').trim() || `Debt repayment to ${debt.creditorName}`;

    const repLog: DebtRepaymentLog = {
      id: repId,
      amount: Number(params.amount.toFixed(2)),
      paidAt: now,
      paidByMemberId: params.actor.id,
      paidByName: params.actor.fullName,
      paymentMethod: params.paymentMethod || 'CASH',
      receiptReference: params.receiptReference,
      note: cleanNote,
      auditHash: computeLedgerRecordHash('DEBT_REPAYMENT', repId, now, params.amount, cleanNote),
    };

    const newBalance = Number((debt.remainingBalance - params.amount).toFixed(2));
    const updatedDebt: DebtLiabilityEvent = {
      ...debt,
      remainingBalance: newBalance,
      status: newBalance <= 0.001 ? 'SETTLED' : 'PARTIALLY_PAID',
      repayments: [repLog, ...(debt.repayments || [])],
    };

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: 'ALL',
      locationName: 'Treasury Vault',
      eventType: 'FINANCIAL_TRANSACTION',
      severity: 'FINANCIAL',
      title: `Debt Repayment: $${params.amount.toFixed(2)} to ${debt.creditorName}`,
      message: `Repayment of $${params.amount.toFixed(2)} paid to ${debt.creditorName} by ${params.actor.fullName}. Remaining balance: $${newBalance.toFixed(2)}.`,
      referenceEntityId: debt.id,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      debtLiabilities: (this.state.debtLiabilities || []).map((d) => (d.id === debt.id ? updatedDebt : d)),
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('debt_liabilities', updatedDebt.id, updatedDebt);
    void this.persistDocumentToCloudIfActive('audit_notifications', audit.id, audit);

    if (updatedDebt.status === 'SETTLED') {
      const numericDebtReminderId = Math.abs(debt.id.split('').reduce((acc, c) => (acc << 5) - acc + c.charCodeAt(0), 0));
      void nativeReminders.cancelReminders(numericDebtReminderId);
    }

    return repLog;
  }

  public recordLoanGiven(params: {
    orgId?: string;
    borrowerName: string;
    borrowerContact?: string;
    category?: LoanCategory;
    principalAmount: number;
    agreedReturnDate?: string;
    interestRatePercent?: number;
    collateralNote?: string;
    purposeNote?: string;
    reason?: string;
    actor: OrgMember;
    runwayAllocation?: RunwayAllocation;
  }): LoanGivenEvent {
    if (!params.borrowerName.trim()) throw new Error('Borrower name is required.');
    if (!params.principalAmount || params.principalAmount <= 0) {
      throw new Error('Loan amount must be greater than zero.');
    }
    const rawNote = (params.purposeNote || params.reason || '').trim();
    if (rawNote.length < 4) {
      throw new Error('Mandatory purpose explanation (at least 4 characters) is required.');
    }

    const targetOrgId = params.orgId || params.actor.orgId || this.state.activeOrgId || 'org-master';
    const currentLeftMoney = this.getCurrentOrgLeftMoney(targetOrgId);
    if (params.principalAmount > currentLeftMoney) {
      throw new Error(`Insufficient funds in Left Money ($${currentLeftMoney.toFixed(2)} available) to issue loan of $${params.principalAmount.toFixed(2)}.`);
    }

    this.assertRunwayCompliance({
      orgId: targetOrgId,
      amount: params.principalAmount,
      allocation: params.runwayAllocation,
      actor: params.actor,
    });

    const now = new Date().toISOString();
    const id = `LOAN-OUT-${Date.now().toString(36).toUpperCase()}`;
    const amount = Number(params.principalAmount.toFixed(2));

    const newLoan: LoanGivenEvent = {
      id,
      orgId: targetOrgId,
      borrowerName: params.borrowerName.trim(),
      borrowerContact: (params.borrowerContact || '').trim(),
      category: params.category || 'PARTNER_FARM_LOAN',
      principalAmount: amount,
      remainingBalance: amount,
      disbursedAt: now,
      agreedReturnDate: params.agreedReturnDate || new Date(Date.now() + 14 * 86400000).toISOString(),
      interestRatePercent: params.interestRatePercent,
      collateralNote: params.collateralNote,
      purposeNote: rawNote,
      status: 'ACTIVE',
      repayments: [],
      disbursedByMemberId: params.actor.id,
      disbursedByName: params.actor.fullName,
      createdAt: now,
      auditHash: computeLedgerRecordHash('LOAN_OUT', id, now, amount, rawNote),
    };

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: 'ALL',
      locationName: 'Treasury Vault',
      eventType: 'FINANCIAL_TRANSACTION',
      severity: 'FINANCIAL',
      title: `Loan Issued: $${amount.toFixed(2)} to ${newLoan.borrowerName}`,
      message: `Capital advance of $${amount.toFixed(2)} disbursed to ${newLoan.borrowerName} (${newLoan.category}) by ${params.actor.fullName}. Return date: ${new Date(newLoan.agreedReturnDate).toLocaleDateString()}. Note: ${newLoan.purposeNote}`,
      referenceEntityId: id,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      loansGiven: [newLoan, ...(this.state.loansGiven || [])],
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('loans_given', newLoan.id, newLoan);
    void this.persistDocumentToCloudIfActive('audit_notifications', audit.id, audit);

    if (newLoan.agreedReturnDate) {
      const numericLoanReminderId = Math.abs(id.split('').reduce((acc, c) => (acc << 5) - acc + c.charCodeAt(0), 0));
      void nativeReminders.scheduleDueReminders({
        id: numericLoanReminderId,
        title: `Loan Due: ${newLoan.borrowerName}`,
        body: `Repayment of $${amount.toFixed(2)} receivable from ${newLoan.borrowerName}`,
        dueDate: new Date(newLoan.agreedReturnDate),
        entityId: id,
        type: 'CREDIT_SALE',
      });
    }

    return newLoan;
  }

  public recoverLoanGiven(params: {
    loanId: string;
    amount: number;
    paymentMethod: string;
    receiptReference?: string;
    note?: string;
    referenceNote?: string;
    actor: OrgMember;
  }): LoanRecoveryLog {
    const loan = (this.state.loansGiven || []).find((l) => l.id === params.loanId);
    if (!loan) throw new Error('Loan record not found.');
    if (params.amount <= 0) throw new Error('Recovery amount must be greater than zero.');
    if (params.amount > loan.remainingBalance) {
      throw new Error(`Recovery ($${params.amount.toFixed(2)}) exceeds remaining loan balance ($${loan.remainingBalance.toFixed(2)}).`);
    }

    const now = new Date().toISOString();
    const recId = `REC-${Date.now().toString(36).toUpperCase()}`;
    const cleanNote = (params.note || params.referenceNote || '').trim() || `Loan recovery from ${loan.borrowerName}`;

    const recLog: LoanRecoveryLog = {
      id: recId,
      amount: Number(params.amount.toFixed(2)),
      recoveredAt: now,
      recordedByMemberId: params.actor.id,
      recordedByName: params.actor.fullName,
      paymentMethod: params.paymentMethod || 'CASH',
      receiptReference: params.receiptReference,
      note: cleanNote,
      auditHash: computeLedgerRecordHash('LOAN_RECOVERY', recId, now, params.amount, cleanNote),
    };

    const newBalance = Number((loan.remainingBalance - params.amount).toFixed(2));
    const updatedLoan: LoanGivenEvent = {
      ...loan,
      remainingBalance: newBalance,
      status: newBalance <= 0.001 ? 'RECOVERED' : 'PARTIALLY_RECOVERED',
      repayments: [recLog, ...(loan.repayments || [])],
    };

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: 'ALL',
      locationName: 'Treasury Vault',
      eventType: 'FINANCIAL_TRANSACTION',
      severity: 'FINANCIAL',
      title: `Loan Recovered: $${params.amount.toFixed(2)} from ${loan.borrowerName}`,
      message: `Recovery of $${params.amount.toFixed(2)} returned by ${loan.borrowerName}. Remaining balance: $${newBalance.toFixed(2)}.`,
      referenceEntityId: loan.id,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      loansGiven: (this.state.loansGiven || []).map((l) => (l.id === loan.id ? updatedLoan : l)),
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('loans_given', updatedLoan.id, updatedLoan);
    void this.persistDocumentToCloudIfActive('audit_notifications', audit.id, audit);

    if (newBalance <= 0.001) {
      const numericLoanReminderId = Math.abs(loan.id.split('').reduce((acc, c) => (acc << 5) - acc + c.charCodeAt(0), 0));
      void nativeReminders.cancelReminders(numericLoanReminderId);
    }

    return recLog;
  }

  public broadcastFinancialDueAlert(params: {
    entityType: 'DEBT_LIABILITY' | 'LOAN_GIVEN' | 'CREDIT_SALE';
    entityId: string;
    partyName: string;
    amount: number;
    dueDate: string;
    customNote?: string;
    actor: OrgMember;
  }): AuditNotificationEvent {
    const now = new Date().toISOString();
    const typeLabel =
      params.entityType === 'DEBT_LIABILITY'
        ? 'Debt Liability'
        : params.entityType === 'LOAN_GIVEN'
          ? 'Loan Advanced'
          : 'Credit Sale';

    const cleanDueDate = params.dueDate ? new Date(params.dueDate).toLocaleDateString() : 'Agreed Date';
    const title = `Org Alert: ${typeLabel} (${params.partyName}) — $${params.amount.toFixed(2)}`;
    const message = [
      `Notice to all team members regarding ${typeLabel} for ${params.partyName}.`,
      `Outstanding Amount: $${params.amount.toFixed(2)}`,
      `Agreed Due Date: ${cleanDueDate}`,
      params.customNote ? `Note: ${params.customNote}` : '',
    ]
      .filter(Boolean)
      .join(' · ');

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: 'ALL',
      locationName: 'Treasury & Operations',
      eventType: 'GROUND_BROADCAST',
      severity: 'WARNING_CONTRA',
      title,
      message,
      referenceEntityId: params.entityId,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('audit_notifications', audit.id, audit);
    return audit;
  }

  public recordCreditSale(params: {
    orgId?: string;
    locationId?: string;
    livestockId?: string;
    customerName: string;
    customerPhone?: string;
    customerContact?: string;
    customerAddress?: string;
    quantitySold?: number;
    unitPrice?: number;
    unitPriceUsd?: number;
    totalSaleAmountUsd?: number;
    depositPaidCash?: number;
    upfrontDepositUsd?: number;
    agreedSettlementDate?: string;
    targetDueDate?: string;
    paymentTerms?: string;
    notes?: string;
    note?: string;
    actor: OrgMember;
    items?: Array<{
      id?: string;
      livestockId?: string;
      livestockName?: string;
      quantitySold: number;
      unitPrice: number;
      totalAmount?: number;
    }>;
  }): CreditSaleEvent {
    if (!params.customerName.trim()) throw new Error('Customer name is required.');
    const rawNotes = params.notes || params.note || '';
    if (rawNotes.trim().length < 4) throw new Error('Mandatory notes (min 4 chars) are required.');

    const hasMultiItems = Boolean(params.items && params.items.length > 0);
    const quantitySold = hasMultiItems
      ? params.items!.reduce((acc, it) => acc + (it.quantitySold || 0), 0)
      : (params.quantitySold || 0);

    if (quantitySold <= 0) throw new Error('Quantity sold must be at least 1.');

    const computedItemsTotal = hasMultiItems
      ? params.items!.reduce((acc, it) => acc + (it.totalAmount ?? (it.quantitySold * it.unitPrice)), 0)
      : (quantitySold * (params.unitPrice || params.unitPriceUsd || 0));

    const totalAmount = Number((params.totalSaleAmountUsd || computedItemsTotal).toFixed(2));
    const unitPrice = params.unitPrice || params.unitPriceUsd || (quantitySold > 0 ? Number((totalAmount / quantitySold).toFixed(2)) : 0);

    if (totalAmount <= 0) throw new Error('Total sale amount must be greater than zero.');

    const resolvedLocId =
      params.locationId ||
      (params.livestockId
        ? this.state.livestockEntries.find((l) => l.id === params.livestockId)?.locationId
        : undefined) ||
      (hasMultiItems && params.items![0]?.livestockId
        ? this.state.livestockEntries.find((l) => l.id === params.items![0].livestockId)?.locationId
        : undefined) ||
      this.state.locations[0]?.id;
    const loc = this.state.locations.find((l) => l.id === resolvedLocId);
    if (!loc) throw new Error('Valid farm site location is required.');

    const deposit = Math.max(0, Number((params.depositPaidCash || params.upfrontDepositUsd || 0).toFixed(2)));
    if (deposit > totalAmount) {
      throw new Error(`Upfront deposit ($${deposit.toFixed(2)}) cannot exceed total sale amount ($${totalAmount.toFixed(2)}).`);
    }
    const creditRemaining = Number((totalAmount - deposit).toFixed(2));
    const settlementDate = params.agreedSettlementDate || params.targetDueDate || new Date(Date.now() + 14 * 86400000).toISOString();

    const now = new Date().toISOString();
    const id = `CSALE-${Date.now().toString(36).toUpperCase()}`;
    const targetOrgId = params.actor.orgId || loc.orgId || this.state.activeOrgId || 'org-master';

    const lifecycleEvents: LivestockLifecycleEvent[] = [];
    let primaryLivestockEntry: LivestockEntry | undefined;
    let combinedLivestockName: string | undefined;

    if (hasMultiItems) {
      const nameParts: string[] = [];
      const batchSoldMap = new Map<string, number>();

      for (const it of params.items!) {
        if (!it.livestockId) {
          throw new Error('Every item in a credit sale must be linked to an active livestock batch.');
        }
        const entry = this.state.livestockEntries.find((l) => l.id === it.livestockId);
        if (!entry) {
          throw new Error(`Livestock batch ${it.livestockId} not found in farm inventory.`);
        }
        if (!primaryLivestockEntry) primaryLivestockEntry = entry;

        const existingEvents = this.state.livestockEvents.filter((e) => e.livestockId === entry.id);
        const currentHeadcount =
          entry.initialHeadcount + existingEvents.reduce((acc, e) => acc + (e.headcountDelta || 0), 0);

        const totalSold = (batchSoldMap.get(entry.id) || 0) + it.quantitySold;
        batchSoldMap.set(entry.id, totalSold);

        if (totalSold > currentHeadcount) {
          throw new Error(
            `Invalid credit sale: Total quantity sold for ${entry.nameOrTag} (${totalSold}) exceeds available live headcount (${currentHeadcount}).`
          );
        }

        nameParts.push(`${it.quantitySold}x ${entry.nameOrTag}`);
        const eventId = `EVENT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const eventNote = `Credit sale of ${it.quantitySold}x ${entry.nameOrTag} to ${params.customerName}. Subtotal: $${(it.quantitySold * it.unitPrice).toFixed(2)}. Due: ${settlementDate}. ${rawNotes.trim()}`;
        lifecycleEvents.push({
          id: eventId,
          orgId: targetOrgId,
          livestockId: entry.id,
          livestockName: entry.nameOrTag,
          locationId: entry.locationId,
          eventType: 'SALE_DISPATCH',
          headcountDelta: -it.quantitySold,
          saleRevenueAmount: 0,
          reinvestmentPercentage: 100,
          referenceTransactionId: id,
          note: eventNote,
          loggedByName: params.actor.fullName,
          createdAt: now,
          auditHash: computeLedgerRecordHash('LIVESTOCK_EVENT', eventId, now, -it.quantitySold, eventNote),
        });
      }
      combinedLivestockName = nameParts.length > 0 ? nameParts.join(', ') : undefined;
    } else if (params.livestockId) {
      primaryLivestockEntry = this.state.livestockEntries.find((l) => l.id === params.livestockId);
      if (primaryLivestockEntry) {
        const existingEvents = this.state.livestockEvents.filter((e) => e.livestockId === primaryLivestockEntry!.id);
        const currentHeadcount =
          primaryLivestockEntry.initialHeadcount + existingEvents.reduce((acc, e) => acc + (e.headcountDelta || 0), 0);
        if (quantitySold > currentHeadcount) {
          throw new Error(
            `Invalid credit sale: Harvest headcount (${quantitySold}) exceeds current live headcount (${currentHeadcount}).`
          );
        }
        const eventId = `EVENT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const eventNote = `Credit sale of ${quantitySold}x to ${params.customerName}. Total: $${totalAmount}, Deposit: $${deposit}, Credit: $${creditRemaining}. Due: ${settlementDate}. ${rawNotes.trim()}`;
        lifecycleEvents.push({
          id: eventId,
          orgId: targetOrgId,
          livestockId: primaryLivestockEntry.id,
          livestockName: primaryLivestockEntry.nameOrTag,
          locationId: primaryLivestockEntry.locationId,
          eventType: 'SALE_DISPATCH',
          headcountDelta: -quantitySold,
          saleRevenueAmount: 0,
          reinvestmentPercentage: 100,
          referenceTransactionId: id,
          note: eventNote,
          loggedByName: params.actor.fullName,
          createdAt: now,
          auditHash: computeLedgerRecordHash('LIVESTOCK_EVENT', eventId, now, -quantitySold, eventNote),
        });
        combinedLivestockName = primaryLivestockEntry.nameOrTag;
      }
    }

    const newCreditSale: CreditSaleEvent = {
      id,
      orgId: targetOrgId,
      locationId: loc.id,
      locationName: loc.name,
      customerName: params.customerName.trim(),
      customerPhone: (params.customerPhone || params.customerContact || '').trim(),
      customerAddress: params.customerAddress?.trim(),
      livestockId: params.livestockId || (hasMultiItems ? params.items![0]?.livestockId : undefined),
      livestockName: combinedLivestockName || primaryLivestockEntry?.nameOrTag,
      quantitySold,
      unitPrice,
      totalSaleAmount: totalAmount,
      depositPaidCash: deposit,
      creditBalanceRemaining: creditRemaining,
      saleDate: now,
      agreedSettlementDate: settlementDate,
      paymentTerms: params.paymentTerms?.trim() || 'Credit sale with agreed settlement date',
      notes: rawNotes.trim(),
      status: creditRemaining <= 0 ? 'SETTLED' : deposit > 0 ? 'PARTIALLY_PAID' : 'OUTSTANDING',
      paymentLogs: [],
      dateExtensions: [],
      items: params.items,
      loggedByMemberId: params.actor.id,
      loggedByName: params.actor.fullName,
      createdAt: now,
      auditHash: computeLedgerRecordHash('CREDIT_SALE', id, now, totalAmount, rawNotes.trim()),
    };

    // Attach backward-compatible aliases
    Object.assign(newCreditSale, {
      remainingCreditBalanceUsd: creditRemaining,
      totalSaleAmountUsd: totalAmount,
      upfrontDepositUsd: deposit,
      targetDueDate: settlementDate,
    });

    // Broadcast to all members notifying about credit sale terms and due date
    const formattedDueDate = new Date(settlementDate).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const broadcastAudit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: loc.id,
      locationName: loc.name,
      eventType: 'CREDIT_SALE',
      severity: 'FINANCIAL',
      title: `Sale on Credit: ${params.customerName} ($${totalAmount.toFixed(2)})`,
      message: `Sale on credit logged by ${params.actor.fullName}: ${params.quantitySold}x ${primaryLivestockEntry ? primaryLivestockEntry.nameOrTag : combinedLivestockName || 'items'} sold to ${params.customerName}. Upfront deposit of $${deposit.toFixed(2)} received; remaining $${creditRemaining.toFixed(2)} due on ${formattedDueDate}. Terms: ${newCreditSale.paymentTerms}.`,
      referenceEntityId: id,
      timestamp: now,
    });

    // Pure Atomic Commit: All related state changes committed in a single snapshot update
    const nextState: AgroStateSnapshot = {
      ...this.state,
      livestockEvents: [
        ...lifecycleEvents,
        ...(this.state.livestockEvents || []),
      ],
      creditSales: [newCreditSale, ...(this.state.creditSales || [])],
      auditNotifications: [broadcastAudit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    for (const ev of lifecycleEvents) {
      void this.persistDocumentToCloudIfActive('livestock_lifecycle_events', ev.id, ev);
    }
    void this.persistDocumentToCloudIfActive('credit_sales', newCreditSale.id, newCreditSale);
    void this.persistDocumentToCloudIfActive('audit_notifications', broadcastAudit.id, broadcastAudit);

    // Schedule native due date reminder on Android AlarmManager
    const numericReminderId = Math.abs(id.split('').reduce((acc, c) => (acc << 5) - acc + c.charCodeAt(0), 0));
    void nativeReminders.scheduleDueReminders({
      id: numericReminderId,
      title: `Credit Sale: ${params.customerName}`,
      body: `Settlement of $${creditRemaining.toFixed(2)}`,
      dueDate: new Date(settlementDate),
      entityId: id,
      type: 'CREDIT_SALE',
    });

    return newCreditSale;
  }

  public extendCreditSaleDueDate(params: {
    creditSaleId: string;
    newAgreedDate?: string;
    newDueDate?: string;
    reason: string;
    actor: OrgMember;
  }): CreditSaleEvent {
    const sale = (this.state.creditSales || []).find((s) => s.id === params.creditSaleId);
    if (!sale) throw new Error('Credit sale record not found.');
    const newDate = params.newAgreedDate || params.newDueDate;
    if (!newDate) throw new Error('New agreed due date is required.');
    const rawReason = (params.reason || '').trim();
    if (rawReason.length < 4) {
      throw new Error('Mandatory justification reason required (at least 4 characters).');
    }

    const now = new Date().toISOString();
    const extId = `EXT-${Date.now().toString(36).toUpperCase()}`;
    const previousDate = sale.agreedSettlementDate || (sale as any).targetDueDate || '';

    const extensionLog: CreditSaleDateExtensionLog = {
      id: extId,
      previousDate,
      newAgreedDate: newDate,
      reason: rawReason,
      extendedAt: now,
      authorizedByMemberId: params.actor.id,
      authorizedByName: params.actor.fullName,
    };
    Object.assign(extensionLog, {
      previousDueDate: previousDate,
      newDueDate: newDate,
    });

    const updatedSale: CreditSaleEvent = {
      ...sale,
      agreedSettlementDate: newDate,
      dateExtensions: [extensionLog, ...(sale.dateExtensions || [])],
    };
    Object.assign(updatedSale, {
      targetDueDate: newDate,
      remainingCreditBalanceUsd: sale.creditBalanceRemaining,
    });

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: sale.locationId,
      locationName: sale.locationName,
      eventType: 'GROUND_BROADCAST',
      severity: 'WARNING_CONTRA',
      title: `Credit Sale Due Date Extended: ${sale.customerName}`,
      message: `Due date for ${sale.customerName} credit balance ($${sale.creditBalanceRemaining.toFixed(2)}) extended from ${new Date(previousDate).toLocaleDateString()} to ${new Date(newDate).toLocaleDateString()} by ${params.actor.fullName}. Reason: ${rawReason}`,
      referenceEntityId: sale.id,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      creditSales: (this.state.creditSales || []).map((s) => (s.id === sale.id ? updatedSale : s)),
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('credit_sales', updatedSale.id, updatedSale);
    void this.persistDocumentToCloudIfActive('audit_notifications', audit.id, audit);

    // Reschedule native reminder for the new agreed due date
    const numericReminderId = Math.abs(sale.id.split('').reduce((acc, c) => (acc << 5) - acc + c.charCodeAt(0), 0));
    void nativeReminders.cancelReminders(numericReminderId);
    void nativeReminders.scheduleDueReminders({
      id: numericReminderId,
      title: `Credit Sale: ${sale.customerName}`,
      body: `Settlement of $${sale.creditBalanceRemaining.toFixed(2)}`,
      dueDate: new Date(newDate),
      entityId: sale.id,
      type: 'CREDIT_SALE',
    });

    return updatedSale;
  }

  public recordCreditSalePayment(params: {
    creditSaleId: string;
    amount: number;
    paymentMethod?: string;
    receiptReference?: string;
    note?: string;
    referenceNote?: string;
    actor: OrgMember;
  }): CreditSalePaymentLog {
    const sale = (this.state.creditSales || []).find((s) => s.id === params.creditSaleId);
    if (!sale) throw new Error('Credit sale record not found.');
    if (params.amount <= 0) throw new Error('Payment amount must be greater than zero.');
    if (params.amount > sale.creditBalanceRemaining) {
      throw new Error(`Payment ($${params.amount.toFixed(2)}) exceeds remaining credit balance ($${sale.creditBalanceRemaining.toFixed(2)}).`);
    }

    const now = new Date().toISOString();
    const payId = `CSPAY-${Date.now().toString(36).toUpperCase()}`;
    const cleanNote = (params.note || params.referenceNote || '').trim() || `Credit installment from ${sale.customerName}`;

    const payLog: CreditSalePaymentLog = {
      id: payId,
      amount: Number(params.amount.toFixed(2)),
      paidAt: now,
      paymentMethod: params.paymentMethod || 'CASH',
      receiptReference: params.receiptReference,
      recordedByMemberId: params.actor.id,
      recordedByName: params.actor.fullName,
      note: cleanNote,
      auditHash: computeLedgerRecordHash('CREDIT_PAYMENT', payId, now, params.amount, cleanNote),
    };

    const newBalance = Number((sale.creditBalanceRemaining - params.amount).toFixed(2));
    const updatedSale: CreditSaleEvent = {
      ...sale,
      creditBalanceRemaining: newBalance,
      status: newBalance <= 0.001 ? 'SETTLED' : 'PARTIALLY_PAID',
      paymentLogs: [payLog, ...(sale.paymentLogs || [])],
    };
    Object.assign(updatedSale, {
      remainingCreditBalanceUsd: newBalance,
      targetDueDate: sale.agreedSettlementDate,
    });

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: sale.locationId,
      locationName: sale.locationName,
      eventType: 'FINANCIAL_TRANSACTION',
      severity: 'FINANCIAL',
      title: `Credit Payment Received: $${params.amount.toFixed(2)} from ${sale.customerName}`,
      message: `Installment payment of $${params.amount.toFixed(2)} collected from ${sale.customerName} via ${params.paymentMethod}. Remaining debt: $${newBalance.toFixed(2)}.`,
      referenceEntityId: sale.id,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      creditSales: (this.state.creditSales || []).map((s) => (s.id === sale.id ? updatedSale : s)),
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('credit_sales', updatedSale.id, updatedSale);
    void this.persistDocumentToCloudIfActive('audit_notifications', audit.id, audit);

    if (updatedSale.status === 'SETTLED') {
      const numericSaleReminderId = Math.abs(sale.id.split('').reduce((acc, c) => (acc << 5) - acc + c.charCodeAt(0), 0));
      void nativeReminders.cancelReminders(numericSaleReminderId);
    }

    return payLog;
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
    photoUrl?: string;
    actor: OrgMember;
    runwayAllocation?: RunwayAllocation;
    runwayPlanId?: string;
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

    let targetPlanId = params.runwayPlanId;
    const expAlloc = params.runwayAllocation;
    if (!targetPlanId && expAlloc?.mode === 'LINE') {
      const line = (this.state.runwayLines || []).find((l) => l.id === expAlloc.lineId);
      if (line) targetPlanId = line.planId;
    }
    const targetPlan = targetPlanId
      ? (this.state.runwayPlans || []).find((p) => p.id === targetPlanId)
      : undefined;

    const targetOrgId = targetPlan?.orgId || params.actor.orgId || loc.orgId || this.state.activeOrgId || 'org-master';

    const newAssetEvent: FixedAssetLedgerEvent = {
      id,
      orgId: targetOrgId,
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
      photoUrl: params.photoUrl,
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

    if (params.direction === 'CONTRA_REVERSAL' && params.referenceTransactionId) {
      const alreadyReversed = this.state.fixedAssets.some(
        (a) => a.direction === 'CONTRA_REVERSAL' && a.referenceTransactionId === params.referenceTransactionId
      );
      if (alreadyReversed) {
        throw new Error(`Fixed asset transaction ${params.referenceTransactionId} has already been reversed.`);
      }
    }
    const updatedAudits = [...this.state.auditNotifications];
    const updatedExpenses = [...this.state.expenses];

    const shouldDeduct = params.deductFromLeftMoney !== false && params.valueDelta > 0 && (params.direction === 'INITIAL' || params.direction === 'ADDITION');
    if (shouldDeduct) {
      const currentLeftMoney = this.getCurrentOrgLeftMoney(targetOrgId);

      if (currentLeftMoney <= 0) {
        throw new Error('Insufficient funds in Left Money pool ($0.00 available). Cannot purchase asset with zero money.');
      }
      if (params.valueDelta > currentLeftMoney) {
        throw new Error(`Insufficient funds in Left Money pool. Asset purchase ($${params.valueDelta.toFixed(2)}) exceeds available balance ($${currentLeftMoney.toFixed(2)}).`);
      }
    }

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
      deltaFinancial: shouldDeduct ? -Math.abs(params.valueDelta) : undefined,
      referenceEntityId: id,
      photoUrl: params.photoUrl,
      timestamp: now,
    });
    updatedAudits.unshift(assetAudit);
    this.state.auditNotifications = updatedAudits;

    if (shouldDeduct) {
      const tags = this.assertRunwayCompliance({
        orgId: targetOrgId,
        amount: params.valueDelta,
        allocation: params.runwayAllocation,
        actor: params.actor,
        planId: targetPlanId,
      });

      const expId = `TX-EXP-${Date.now().toString(36).toUpperCase()}`;
      const expNote = `Fixed asset acquisition: ${newAssetEvent.assetName} (${params.quantityDelta} units) at ${loc.name}. ${cleanNote}`;
      const expEvent: ExpenseLedgerEvent = {
        id: expId,
        orgId: targetOrgId,
        locationId: loc.id,
        locationName: loc.name,
        category: 'FIXED_ASSET_PURCHASE',
        direction: 'DEDUCTION',
        amount: Number(params.valueDelta.toFixed(2)),
        note: expNote.slice(0, 500),
        loggedByMemberId: params.actor.id,
        loggedByName: params.actor.fullName,
        gpsStamp: loc.gpsCoordinates,
        receiptPhotoDataUrl: params.photoUrl,
        approvalStatus: 'APPROVED',
        approvedByMemberIds: [params.actor.id],
        runwayPlanId: tags.runwayPlanId || targetPlanId,
        runwayLineId: tags.runwayLineId || (params.runwayAllocation?.mode === 'LINE' ? params.runwayAllocation.lineId : undefined),
        runwayReserveDraw: tags.runwayReserveDraw,
        runwayAllocationNote: tags.runwayAllocationNote,
        createdAt: now,
        auditHash: computeLedgerRecordHash('EXPENSE', expId, now, params.valueDelta, expNote),
      };
      updatedExpenses.unshift(expEvent);
      void this.persistDocumentToCloudIfActive('expense_ledger', expEvent.id, expEvent);

      if (expEvent.runwayPlanId) {
        this.checkAndBroadcastPlanMilestones(expEvent.runwayPlanId, params.actor);
      }
    }

    const nextState: AgroStateSnapshot = {
      ...this.state,
      fixedAssets: [newAssetEvent, ...this.state.fixedAssets],
      expenses: updatedExpenses,
      auditNotifications: updatedAudits,
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('fixed_assets_ledger', newAssetEvent.id, newAssetEvent);
    void this.persistDocumentToCloudIfActive('audit_notifications', assetAudit.id, assetAudit);
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
    actor: OrgMember;
  }): { outEvent: FixedAssetLedgerEvent; inEvent: FixedAssetLedgerEvent } {
    if (params.fromLocationId === params.toLocationId) {
      throw new Error('Destination location must be different from origin location.');
    }
    const fromLoc = this.state.locations.find((l) => l.id === params.fromLocationId);
    const toLoc = this.state.locations.find((l) => l.id === params.toLocationId);
    if (!fromLoc || !toLoc) throw new Error('Invalid origin or destination location.');
    if (params.actor.orgId && (fromLoc.orgId !== params.actor.orgId || toLoc.orgId !== params.actor.orgId)) {
      throw new Error('Access Denied: Assets cannot be transferred outside of your organization.');
    }
    if (params.note.trim().length < 4) {
      throw new Error('Mandatory transfer reason note is required.');
    }

    const now = new Date().toISOString();
    const outId = `AST-TR-OUT-${Date.now().toString(36).toUpperCase()}`;
    const inId = `AST-TR-IN-${Date.now().toString(36).toUpperCase()}`;
    const cleanNote = params.note.trim().slice(0, 450);

    const targetOrgId = fromLoc.orgId || params.actor.orgId || this.state.activeOrgId || 'org-master';

    const outEvent: FixedAssetLedgerEvent = {
      id: outId,
      orgId: targetOrgId,
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
      orgId: targetOrgId,
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
    void this.persistDocumentToCloudIfActive('audit_notifications', audit.id, audit);
    return { outEvent, inEvent };
  }

  public logBatchDirectFeed(params: {
    livestockId: string;
    locationId: string;
    kgConsumed: number;
    feedType: string;
    note?: string;
    photoDataUrl?: string;
    actor: OrgMember;
  }): FeedLedgerEvent {
    const loc = this.state.locations.find((l) => l.id === params.locationId);
    if (!loc) throw new Error('Valid farm location is required.');
    if (params.kgConsumed <= 0) throw new Error('Feed consumed quantity must be greater than 0 kg.');

    const cleanFeedType = params.feedType?.trim() || 'Standard Rations';
    const cleanNote = params.note?.trim() || `Daily feeding of ${params.kgConsumed} kg (${cleanFeedType})`;
    const now = new Date().toISOString();
    const id = `FD-EV-${Date.now().toString(36).toUpperCase()}`;

    const newFeedEvent: FeedLedgerEvent = {
      id,
      orgId: this.state.activeOrgId || this.state.organizations?.[0]?.id || params.actor.orgId || loc.orgId || 'org-master',
      locationId: loc.id,
      feedType: cleanFeedType.slice(0, 120),
      direction: 'DAILY_CONSUMPTION',
      bagsDelta: -Math.abs(params.kgConsumed),
      kgPerBag: 1,
      linkedLivestockId: params.livestockId,
      note: cleanNote.slice(0, 500),
      photoUrl: params.photoDataUrl,
      loggedByMemberId: params.actor.id,
      loggedByName: params.actor.fullName,
      createdAt: now,
      auditHash: computeLedgerRecordHash('FEED', id, now, params.kgConsumed, cleanNote),
    };

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: loc.id,
      locationName: loc.name,
      eventType: 'FEED_LOGGED',
      severity: 'INFO',
      title: `Feed Consumed: -${params.kgConsumed} kg ${cleanFeedType}`,
      message: `${id} at ${loc.name}: -${params.kgConsumed} kg (${cleanFeedType}). Note: ${cleanNote}`,
      referenceEntityId: id,
      photoUrl: params.photoDataUrl,
      timestamp: now,
    });

    const entry = this.state.livestockEntries.find((l) => l.id === params.livestockId);
    let nextLivestockEntries = this.state.livestockEntries;
    if (params.photoDataUrl && entry) {
      const currentGallery = entry.gallery || [];
      const nextGallery = currentGallery.includes(params.photoDataUrl)
        ? currentGallery
        : [...currentGallery, params.photoDataUrl];
      const updatedEntry: LivestockEntry = {
        ...entry,
        imageUrl: entry.imageUrl || params.photoDataUrl,
        gallery: nextGallery,
      };
      nextLivestockEntries = this.state.livestockEntries.map((l) =>
        l.id === entry.id ? updatedEntry : l
      );
      void this.persistDocumentToCloudIfActive('livestock_entries', updatedEntry.id, updatedEntry);
    }

    const nextState: AgroStateSnapshot = {
      ...this.state,
      livestockEntries: nextLivestockEntries,
      feedLedger: [newFeedEvent, ...this.state.feedLedger],
      auditNotifications: [audit, ...this.state.auditNotifications],
    };
    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('feed_ledger', newFeedEvent.id, newFeedEvent);
    void this.persistDocumentToCloudIfActive('audit_notifications', audit.id, audit);
    return newFeedEvent;
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
    actor: OrgMember;
  }): FeedLedgerEvent {
    const loc = this.state.locations.find((l) => l.id === params.locationId);
    if (!loc) throw new Error('Valid farm location is required.');
    if (params.note.trim().length < 4) {
      throw new Error('Mandatory note (at least 4 characters) is required.');
    }

    const now = new Date().toISOString();
    const id = `FD-EV-${Date.now().toString(36).toUpperCase()}`;
    const cleanNote = params.note.trim().slice(0, 500);

    // Feed inventory bounds validation
    if (params.direction === 'DAILY_CONSUMPTION') {
      const existingFeed = this.state.feedLedger.filter(
        (f) => f.locationId === loc.id && f.feedType === params.feedType.trim().slice(0, 120)
      );
      const currentStock = existingFeed.reduce((acc, f) => acc + f.bagsDelta, 0);
      const consumedBags = Math.abs(params.bagsDelta);
      if (consumedBags > currentStock) {
        throw new Error(`Insufficient feed stock: Consuming ${consumedBags} bags exceeds available stock of ${currentStock} bags at ${loc.name}.`);
      }
    }

    const signedBags =
      params.direction === 'DAILY_CONSUMPTION'
        ? -Math.abs(params.bagsDelta)
        : params.direction === 'STOCK_IN'
          ? Math.abs(params.bagsDelta)
          : params.bagsDelta;

    const newFeedEvent: FeedLedgerEvent = {
      id,
      orgId: params.actor.orgId || loc.orgId || this.state.activeOrgId || 'org-master',
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

    const unitLabel = newFeedEvent.kgPerBag > 1 ? 'bags' : 'kg';
    const quantityDetail =
      newFeedEvent.kgPerBag > 1
        ? `${signedBags >= 0 ? '+' : ''}${signedBags} bags (${Math.abs(signedBags * newFeedEvent.kgPerBag).toFixed(0)}kg)`
        : `${signedBags >= 0 ? '+' : ''}${signedBags} kg`;

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: loc.id,
      locationName: loc.name,
      eventType: 'FEED_LOGGED',
      severity: params.direction === 'CONTRA_REVERSAL' ? 'WARNING_CONTRA' : 'INFO',
      title: `Feed ${params.direction.replace(/_/g, ' ')}: ${signedBags >= 0 ? '+' : ''}${signedBags} ${unitLabel} ${newFeedEvent.feedType}`,
      message: `${id} at ${loc.name}: ${quantityDetail}. Note: ${cleanNote}`,
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
    void this.persistDocumentToCloudIfActive('audit_notifications', audit.id, audit);
    return newFeedEvent;
  }

  public postGroundBroadcast(params: {
    locationId: string;
    severity: NotificationSeverity;
    title: string;
    message: string;
    photoUrl?: string;
    actor: OrgMember;
  }): AuditNotificationEvent {
    if (params.message.trim().length < 4) {
      throw new Error('Broadcast message must be at least 4 characters.');
    }
    const locName =
      params.locationId === 'ALL'
        ? 'All Locations (Master Organization)'
        : this.state.locations.find((l) => l.id === params.locationId)?.name || 'Farm Site';

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: params.locationId,
      locationName: locName,
      eventType: 'GROUND_BROADCAST',
      severity: params.severity,
      title: params.title.trim() || `Ground Update from ${params.actor.fullName}`,
      message: params.message.trim(),
      photoUrl: params.photoUrl,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('audit_notifications', audit.id, audit);
    return audit;
  }

  public createOrganization(params: {
    name: string;
    type: OrganizationType;
    actor: OrgMember;
    defaultTargetContributionUsd?: number;
    contributionPaceDefault?: 'MONTHLY' | 'MILESTONE' | 'FLEXIBLE';
  }): Organization {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const orgId = `org-${now.toString(36)}`;
    const expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const currentInviteCode = `SEED-${rand}`;

    const newOrg: Organization = {
      id: orgId,
      name: params.name.trim().slice(0, 120),
      type: params.type,
      adminMemberId: params.actor.id,
      adminEmail: params.actor.email || params.actor.phoneOrEmail,
      createdAt: nowIso,
      updatedAt: nowIso,
      currentInviteCode,
      inviteCodeCreatedAt: nowIso,
      inviteCodeExpiresAt: expiresAt,
      defaultTargetContributionUsd: params.defaultTargetContributionUsd || 1000,
      contributionPaceDefault: params.contributionPaceDefault || 'MONTHLY',
      currency: 'USD',
      currencySymbol: '$',
      features: {
        livestockModule: params.type === 'AGRO_FARMING',
        farmSitesModule: true,
        feedInventoryModule: params.type === 'AGRO_FARMING',
        multiSigApprovals: true,
        publicAuditVerifier: true,
      },
    };

    // Update actor to be ORG_ADMIN of this organization
    const authUid = firebaseAuth?.currentUser?.uid || params.actor.uid;
    const updatedActor: OrgMember = {
      ...params.actor,
      uid: authUid || params.actor.uid || params.actor.id,
      orgId: newOrg.id,
      role: 'ORG_ADMIN',
      approvalStatus: 'APPROVED',
      active: true,
    };

    const audit = this.createChainedAuditEvent({
      actor: updatedActor,
      locationId: 'ALL',
      locationName: 'Organization Master',
      eventType: 'ORGANIZATION_CREATED',
      severity: 'MILESTONE',
      title: `Organization Created: ${newOrg.name}`,
      message: `Organization registered by ${updatedActor.fullName} (${newOrg.type.replace('_', ' ')}). 24-hr invitation code: ${currentInviteCode}.`,
      referenceEntityId: newOrg.id,
      timestamp: nowIso,
    });

    const actorEmail = (updatedActor.email || updatedActor.phoneOrEmail || '').trim().toLowerCase();
    const updatedMembers = this.state.members
      .map((m) => (m.id === updatedActor.id ? updatedActor : m))
      .filter((m) => {
        if (m.id === updatedActor.id) return true;
        if (m.orgId) return true;
        if (updatedActor.uid && m.uid === updatedActor.uid) return false;
        const mEmail = (m.email || m.phoneOrEmail || '').trim().toLowerCase();
        if (actorEmail && mEmail === actorEmail) return false;
        return true;
      });
    if (!updatedMembers.some((m) => m.id === updatedActor.id)) {
      updatedMembers.push(updatedActor);
    }

    const nextState: AgroStateSnapshot = {
      ...this.state,
      organizations: [...(this.state.organizations || []), newOrg],
      activeOrgId: newOrg.id,
      members: updatedMembers,
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    if (this.activeSession) {
      this.setActiveSession({
        ...this.activeSession,
        activeOrgId: newOrg.id,
      });
    }
    void this.persistDocumentToCloudIfActive('organizations', newOrg.id, newOrg);
    void this.persistDocumentToCloudIfActive('members', updatedActor.id, updatedActor);
    if (authUid && authUid !== updatedActor.id) {
      void this.persistDocumentToCloudIfActive('members', authUid, {
        ...updatedActor,
        id: authUid,
        uid: authUid,
      });
    }
    if (firestoreDb) {
      setDoc(doc(firestoreDb, 'invite_codes', currentInviteCode), {
        code: currentInviteCode,
        orgId: newOrg.id,
        orgName: newOrg.name,
        orgType: newOrg.type,
        adminName: updatedActor.fullName,
        expiresAt,
      }).catch((err) => console.warn('Invite code cloud save warning:', err));
    }
    return newOrg;
  }

  public getActiveOrganization(orgId?: string): Organization {
    const targetId = orgId || this.state.activeOrgId || 'org-master';
    const found = (this.state.organizations || []).find((o) => o.id === targetId);
    if (found) return found;

    const now = Date.now();
    const fallbackOrg: Organization = {
      id: targetId,
      name: 'CapitaSeed Master Syndicate',
      type: 'AGRO_FARMING',
      adminMemberId: 'mem-chipo',
      adminEmail: PRIMARY_ADMIN_EMAIL,
      createdAt: new Date(now - 30 * 86400000).toISOString(),
      updatedAt: new Date(now).toISOString(),
      currentInviteCode: 'SEED-8492',
      inviteCodeCreatedAt: new Date(now).toISOString(),
      inviteCodeExpiresAt: new Date(now + 365 * 86400000).toISOString(),
      defaultTargetContributionUsd: 1000,
      contributionPaceDefault: 'MONTHLY',
      currency: 'USD',
      currencySymbol: '$',
      description: 'Primary Agro-Farming & Joint Investment Workspace',
      features: {
        livestockModule: true,
        farmSitesModule: true,
        feedInventoryModule: true,
        multiSigApprovals: true,
        publicAuditVerifier: true,
      },
    };

    const nextState: AgroStateSnapshot = {
      ...this.state,
      organizations: [...(this.state.organizations || []), fallbackOrg],
      activeOrgId: targetId,
    };
    this.saveLocalState(nextState);
    return fallbackOrg;
  }

  public updateOrganization(params: {
    orgId: string;
    name?: string;
    type?: OrganizationType;
    defaultTargetContributionUsd?: number;
    contributionPaceDefault?: 'MONTHLY' | 'MILESTONE' | 'FLEXIBLE';
    actor: OrgMember;
  }): Organization {
    if (params.actor.role !== 'ORG_ADMIN' && params.actor.role !== 'SYNDICATE_ADMIN') {
      throw new Error('Access Denied: Only Organization Admins can update organization settings.');
    }
    const org = (this.state.organizations || []).find((o) => o.id === params.orgId);
    if (!org) {
      throw new Error(`Organization ${params.orgId} not found.`);
    }

    const nowIso = new Date().toISOString();
    const updatedType = params.type !== undefined ? params.type : org.type;
    const updatedOrg: Organization = {
      ...org,
      name: params.name !== undefined ? params.name.trim() : org.name,
      type: updatedType,
      defaultTargetContributionUsd:
        params.defaultTargetContributionUsd !== undefined
          ? params.defaultTargetContributionUsd
          : org.defaultTargetContributionUsd,
      contributionPaceDefault:
        params.contributionPaceDefault !== undefined
          ? params.contributionPaceDefault
          : org.contributionPaceDefault,
      features: {
        ...org.features,
        livestockModule: updatedType === 'AGRO_FARMING',
        feedInventoryModule: updatedType === 'AGRO_FARMING',
      },
      updatedAt: nowIso,
    };

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: 'ALL',
      locationName: 'Organization Master',
      eventType: 'ORGANIZATION_CREATED',
      severity: 'INFO',
      title: `Organization Settings Updated: ${updatedOrg.name}`,
      message: `${params.actor.fullName} updated organization details (Mode: ${updatedOrg.type}, Target: $${updatedOrg.defaultTargetContributionUsd}).`,
      referenceEntityId: updatedOrg.id,
      timestamp: nowIso,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      organizations: (this.state.organizations || []).map((o) => (o.id === updatedOrg.id ? updatedOrg : o)),
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('organizations', updatedOrg.id, updatedOrg);
    return updatedOrg;
  }

  public updateMemberCapitalTarget(params: {
    memberId: string;
    targetContributionUsd: number;
    contributionPace: 'MONTHLY' | 'MILESTONE' | 'FLEXIBLE';
    actor: OrgMember;
  }): OrgMember {
    const isSelf = params.actor.id === params.memberId;
    const isAdmin = params.actor.role === 'ORG_ADMIN' || params.actor.role === 'SYNDICATE_ADMIN';
    if (!isSelf && !isAdmin) {
      throw new Error('Access Denied: Only Admins or the member themselves can update capital targets.');
    }

    const targetMember = this.state.members.find((m) => m.id === params.memberId);
    if (!targetMember) {
      throw new Error(`Member ${params.memberId} not found.`);
    }

    const nowIso = new Date().toISOString();
    const cleanTarget = Math.max(0, params.targetContributionUsd);
    const updatedMember: OrgMember = {
      ...targetMember,
      targetContributionUsd: cleanTarget,
      contributionPace: params.contributionPace,
      updatedAt: nowIso,
    };

    // Keep Runway pledges synchronized if an active runway plan exists
    const activePlan = (this.state.runwayPlans || []).find(
      (p) =>
        (!targetMember.orgId || p.orgId === targetMember.orgId) &&
        (p.status === 'ACTIVE' || p.status === 'PLEDGING' || p.status === 'DRAFT')
    );

    let nextPledges = this.state.runwayPledges || [];
    let syncedPledge: RunwayPledge | null = null;

    if (activePlan && cleanTarget > 0) {
      const existingPledge = nextPledges.find(
        (p) => p.planId === activePlan.id && p.memberId === targetMember.id
      );

      const runwayPace =
        params.contributionPace === 'MONTHLY'
          ? 'MONTHLY'
          : params.contributionPace === 'MILESTONE'
          ? 'MILESTONE'
          : 'FLEXIBLE';

      if (existingPledge) {
        const eventType = cleanTarget >= existingPledge.amount ? 'INCREASE' : 'DECREASE';
        syncedPledge = {
          ...existingPledge,
          amount: cleanTarget,
          pace: runwayPace,
          history: [
            ...(existingPledge.history || []),
            {
              id: `PEV-${Date.now().toString(36).toUpperCase()}`,
              type: eventType,
              previousAmount: existingPledge.amount,
              newAmount: cleanTarget,
              note: `Pledge synchronized with member capital target by ${params.actor.fullName}`,
              byMemberId: params.actor.id,
              at: nowIso,
              auditHash: computeLedgerRecordHash('PLEDGE_EVENT', existingPledge.id, nowIso, cleanTarget, 'Target sync'),
            },
          ],
          updatedAt: nowIso,
        };
        nextPledges = nextPledges.map((p) => (p.id === syncedPledge!.id ? syncedPledge! : p));
      } else {
        const pledgeId = `PLG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        syncedPledge = {
          id: pledgeId,
          planId: activePlan.id,
          orgId: activePlan.orgId,
          memberId: targetMember.id,
          memberName: targetMember.fullName,
          amount: cleanTarget,
          pace: runwayPace,
          history: [
            {
              id: `PEV-${Date.now().toString(36).toUpperCase()}`,
              type: 'INITIAL',
              previousAmount: 0,
              newAmount: cleanTarget,
              note: `Initial pledge configured from member target by ${params.actor.fullName}`,
              byMemberId: params.actor.id,
              at: nowIso,
              auditHash: computeLedgerRecordHash('PLEDGE_EVENT', pledgeId, nowIso, cleanTarget, 'Target sync'),
            },
          ],
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        nextPledges = [syncedPledge, ...nextPledges];
      }
    }

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: 'ALL',
      locationName: 'Organization Master',
      eventType: 'MEMBER_PROFILE_UPDATED',
      severity: 'INFO',
      title: `Capital Target Updated: ${updatedMember.fullName}`,
      message: `${params.actor.fullName} configured capital target for ${updatedMember.fullName} to $${updatedMember.targetContributionUsd} (${updatedMember.contributionPace}).`,
      referenceEntityId: updatedMember.id,
      timestamp: nowIso,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      members: this.state.members.map((m) => (m.id === updatedMember.id ? updatedMember : m)),
      runwayPledges: nextPledges,
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('members', updatedMember.id, updatedMember);
    if (syncedPledge) {
      void this.persistDocumentToCloudIfActive('runway_pledges', syncedPledge.id, syncedPledge);
    }
    return updatedMember;
  }

  public refreshInviteCode(params: {
    orgId: string;
    actor: OrgMember;
  }): Organization {
    if (!PERMISSIONS.canRefreshInviteCode(params.actor.role)) {
      throw new Error('Access Denied: Only Organization Admins can refresh invitation codes.');
    }
    const org = (this.state.organizations || []).find((o) => o.id === params.orgId);
    if (!org) {
      throw new Error(`Organization ${params.orgId} not found.`);
    }

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const newCode = `SEED-${rand}`;

    const updatedOrg: Organization = {
      ...org,
      currentInviteCode: newCode,
      inviteCodeCreatedAt: nowIso,
      inviteCodeExpiresAt: expiresAt,
      updatedAt: nowIso,
    };

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: 'ALL',
      locationName: 'Organization Master',
      eventType: 'INVITE_CODE_REFRESHED',
      severity: 'INFO',
      title: `24-Hour Invite Code Refreshed: ${newCode}`,
      message: `${params.actor.fullName} refreshed the organization join code. Valid for 24 hours until ${new Date(expiresAt).toLocaleTimeString()}.`,
      referenceEntityId: updatedOrg.id,
      timestamp: nowIso,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      organizations: (this.state.organizations || []).map((o) => (o.id === updatedOrg.id ? updatedOrg : o)),
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('organizations', updatedOrg.id, updatedOrg);
    if (firestoreDb) {
      if (org.currentInviteCode) {
        deleteDoc(doc(firestoreDb, 'invite_codes', org.currentInviteCode)).catch(() => { });
      }
      setDoc(doc(firestoreDb, 'invite_codes', newCode), {
        code: newCode,
        orgId: updatedOrg.id,
        orgName: updatedOrg.name,
        orgType: updatedOrg.type,
        adminName: params.actor.fullName,
        expiresAt,
      }).catch((err) => console.warn('Cloud invite_codes write warning:', err));
    }
    return updatedOrg;
  }

  public async joinOrganizationWithCode(params: {
    inviteCode: string;
    actor: OrgMember;
  }): Promise<Organization> {
    const cleanCode = params.inviteCode.trim().toUpperCase();
    let orgData: any = null;

    if (firestoreDb) {
      try {
        const snap = await getDoc(doc(firestoreDb, 'invite_codes', cleanCode));
        if (snap.exists()) {
          const data = snap.data();
          if (new Date(data.expiresAt).getTime() < Date.now()) {
            throw new Error('This invitation code has expired after 24 hours. Please ask your administrator to refresh the code in Settings.');
          }
          const orgSnap = await getDoc(doc(firestoreDb, 'organizations', data.orgId));
          if (orgSnap.exists()) {
            orgData = orgSnap.data();
          }
        }
      } catch (err: any) {
        if (err.message && err.message.includes('expired')) throw err;
        console.warn('Cloud invite lookup fallback:', err);
      }
    }

    if (!orgData) {
      const foundOrg = (this.state.organizations || []).find(
        (o) => o.currentInviteCode && o.currentInviteCode.toUpperCase() === cleanCode
      );
      if (foundOrg) {
        if (new Date(foundOrg.inviteCodeExpiresAt).getTime() < Date.now()) {
          throw new Error('This invitation code has expired after 24 hours. Please ask your administrator to refresh the code in Settings.');
        }
        orgData = foundOrg;
      }
    }

    if (!orgData) {
      throw new Error('Invalid invitation code. Please verify the code with your organization administrator.');
    }

    const now = new Date().toISOString();
    const authUid = firebaseAuth?.currentUser?.uid || params.actor.uid;
    const updatedMember: OrgMember = {
      ...params.actor,
      uid: authUid || params.actor.uid || params.actor.id,
      orgId: orgData.id,
      role: 'MEMBER',
      approvalStatus: 'APPROVED',
      active: true,
      targetContributionUsd: orgData.defaultTargetContributionUsd || 1000,
      contributionPace: orgData.contributionPaceDefault || 'MONTHLY',
      updatedAt: now,
    };

    const audit = this.createChainedAuditEvent({
      actor: updatedMember,
      locationId: 'ALL',
      locationName: orgData.name,
      eventType: 'MEMBER_APPROVED',
      severity: 'INFO',
      title: `Member Joined: ${updatedMember.fullName}`,
      message: `${updatedMember.fullName} joined ${orgData.name} using 24-hr invitation code (${cleanCode}).`,
      referenceEntityId: updatedMember.id,
      timestamp: now,
    });

    const orgList = this.state.organizations || [];
    const hasOrg = orgList.some((o) => o.id === orgData.id);
    const nextState: AgroStateSnapshot = {
      ...this.state,
      organizations: hasOrg ? orgList : [...orgList, orgData],
      activeOrgId: orgData.id,
      members: this.state.members.some((m) => m.id === updatedMember.id)
        ? this.state.members.map((m) => (m.id === updatedMember.id ? updatedMember : m))
        : [...this.state.members, updatedMember],
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    if (this.activeSession) {
      this.setActiveSession({
        ...this.activeSession,
        activeOrgId: orgData.id,
      });
    }
    void this.persistDocumentToCloudIfActive('members', updatedMember.id, updatedMember);
    if (authUid && authUid !== updatedMember.id) {
      void this.persistDocumentToCloudIfActive('members', authUid, {
        ...updatedMember,
        id: authUid,
        uid: authUid,
      });
    }
    return orgData;
  }

  private getInitialCheckpointsForEntry(entry: LivestockEntry): AnimalCheckpoint[] {
    if (entry.customCheckpoints && entry.customCheckpoints.length > 0) {
      return [...entry.customCheckpoints];
    }
    const defaultProtocols = generateVaccinationProtocols(entry, 0, []);
    return defaultProtocols.map((p) => ({
      id: p.id,
      dayTarget: p.dayTarget,
      scheduledDate: p.scheduledDate,
      title: p.title,
      category: p.category as CheckpointCategory,
      targetWeightKg: p.targetWeightKg,
      feedPhase: p.feedPhase,
      instructions: p.description,
      completed: p.completed,
      reminderStatus: p.reminderStatus || 'SCHEDULED',
    }));
  }

  public addCheckpointToLivestock(params: {
    livestockId: string;
    checkpoint: Omit<AnimalCheckpoint, 'id' | 'completed' | 'reminderStatus'>;
    actor: OrgMember;
  }): AnimalCheckpoint {
    const entry = this.state.livestockEntries.find((l) => l.id === params.livestockId);
    if (!entry) throw new Error(`Livestock entry ${params.livestockId} not found.`);

    const id = `cp-${Date.now().toString(36)}`;
    const newCheckpoint: AnimalCheckpoint = {
      ...params.checkpoint,
      id,
      completed: false,
      reminderStatus: 'SCHEDULED',
    };

    const currentCheckpoints = this.getInitialCheckpointsForEntry(entry);
    const updatedCheckpoints = [...currentCheckpoints, newCheckpoint].sort(
      (a, b) => a.dayTarget - b.dayTarget
    );

    const updatedEntry: LivestockEntry = {
      ...entry,
      customCheckpoints: updatedCheckpoints,
    };

    const now = new Date().toISOString();
    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: entry.locationId,
      locationName: entry.locationName,
      eventType: 'CHECKPOINT_CUSTOMIZED',
      severity: 'INFO',
      title: `Checkpoint Added: ${newCheckpoint.title}`,
      message: `Added custom checkpoint (${newCheckpoint.title}, Day ${newCheckpoint.dayTarget}) to ${entry.nameOrTag}.`,
      referenceEntityId: entry.id,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      livestockEntries: this.state.livestockEntries.map((l) => (l.id === entry.id ? updatedEntry : l)),
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('livestock_entries', updatedEntry.id, updatedEntry);
    return newCheckpoint;
  }

  public updateLivestockCheckpoint(params: {
    livestockId: string;
    checkpointId: string;
    updates: Partial<AnimalCheckpoint>;
    actor: OrgMember;
  }): AnimalCheckpoint {
    const entry = this.state.livestockEntries.find((l) => l.id === params.livestockId);
    if (!entry) throw new Error(`Livestock entry ${params.livestockId} not found.`);

    const currentCheckpoints = this.getInitialCheckpointsForEntry(entry);
    const target = currentCheckpoints.find((c) => c.id === params.checkpointId);
    if (!target) throw new Error(`Checkpoint ${params.checkpointId} not found.`);

    const updated: AnimalCheckpoint = {
      ...target,
      ...params.updates,
    };

    const updatedCheckpoints = currentCheckpoints
      .map((c) => (c.id === params.checkpointId ? updated : c))
      .sort((a, b) => a.dayTarget - b.dayTarget);

    const updatedEntry: LivestockEntry = {
      ...entry,
      customCheckpoints: updatedCheckpoints,
    };

    const now = new Date().toISOString();
    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: entry.locationId,
      locationName: entry.locationName,
      eventType: 'CHECKPOINT_CUSTOMIZED',
      severity: 'INFO',
      title: `Checkpoint Updated: ${updated.title}`,
      message: `Updated custom checkpoint (${updated.title}) on ${entry.nameOrTag}.`,
      referenceEntityId: entry.id,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      livestockEntries: this.state.livestockEntries.map((l) => (l.id === entry.id ? updatedEntry : l)),
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('livestock_entries', updatedEntry.id, updatedEntry);
    return updated;
  }

  public deleteLivestockCheckpoint(params: {
    livestockId: string;
    checkpointId: string;
    actor: OrgMember;
  }): void {
    const entry = this.state.livestockEntries.find((l) => l.id === params.livestockId);
    if (!entry) throw new Error(`Livestock entry ${params.livestockId} not found.`);

    const currentCheckpoints = this.getInitialCheckpointsForEntry(entry);
    const target = currentCheckpoints.find((c) => c.id === params.checkpointId);
    const updatedCheckpoints = currentCheckpoints.filter((c) => c.id !== params.checkpointId);

    const updatedEntry: LivestockEntry = {
      ...entry,
      customCheckpoints: updatedCheckpoints,
    };

    const now = new Date().toISOString();
    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: entry.locationId,
      locationName: entry.locationName,
      eventType: 'CHECKPOINT_CUSTOMIZED',
      severity: 'INFO',
      title: `Checkpoint Removed: ${target?.title || params.checkpointId}`,
      message: `Deleted checkpoint from ${entry.nameOrTag}.`,
      referenceEntityId: entry.id,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      livestockEntries: this.state.livestockEntries.map((l) => (l.id === entry.id ? updatedEntry : l)),
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('livestock_entries', updatedEntry.id, updatedEntry);
  }

  public configureLivestockValuationPrice(params: {
    livestockId: string;
    configuredSalePricePerUnit: number;
    configuredSalePricePerKg?: number;
    actor: OrgMember;
  }): LivestockEntry {
    const entry = this.state.livestockEntries.find((l) => l.id === params.livestockId);
    if (!entry) throw new Error(`Livestock entry ${params.livestockId} not found.`);

    const updatedEntry: LivestockEntry = {
      ...entry,
      configuredSalePricePerUnit: params.configuredSalePricePerUnit,
      ...(params.configuredSalePricePerKg !== undefined
        ? { configuredSalePricePerKg: params.configuredSalePricePerKg }
        : {}),
    };

    const now = new Date().toISOString();
    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: entry.locationId,
      locationName: entry.locationName,
      eventType: 'LIVESTOCK_UPDATED',
      severity: 'INFO',
      title: `Valuation Configured: ${entry.nameOrTag}`,
      message: `Configured valuation price $${params.configuredSalePricePerUnit}/unit for ${entry.nameOrTag} (${entry.species}) by ${params.actor.fullName}.`,
      referenceEntityId: entry.id,
      timestamp: now,
      deltaFinancial: params.configuredSalePricePerUnit,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      livestockEntries: this.state.livestockEntries.map((l) => (l.id === entry.id ? updatedEntry : l)),
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('livestock_entries', updatedEntry.id, updatedEntry);
    return updatedEntry;
  }

  public saveCustomRecipeTemplate(params: {
    name: string;
    species: string;
    recommendedDurationDays: number;
    targetSaleWeightKg: number;
    checkpoints: Omit<AnimalCheckpoint, 'id' | 'completed' | 'completedAt' | 'reminderStatus'>[];
    actor: OrgMember;
    notes?: string;
  }): FarmRecipeTemplate {
    const now = new Date().toISOString();
    const id = `recipe-${Date.now().toString(36)}`;
    const template: FarmRecipeTemplate = {
      id,
      orgId: params.actor.orgId || 'org-master',
      name: params.name.trim().slice(0, 120),
      species: params.species.trim(),
      recommendedDurationDays: params.recommendedDurationDays,
      targetSaleWeightKg: params.targetSaleWeightKg,
      checkpoints: params.checkpoints,
      isCustomOrgRecipe: true,
      createdAt: now,
      notes: params.notes,
    };

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: 'ALL',
      locationName: 'Organization Recipes',
      eventType: 'RECIPE_TEMPLATE_SAVED',
      severity: 'INFO',
      title: `Custom Farm Recipe Saved: ${template.name}`,
      message: `Recipe saved with ${template.checkpoints.length} custom checkpoints by ${params.actor.fullName}.`,
      referenceEntityId: template.id,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      customRecipes: [...(this.state.customRecipes || []), template],
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('custom_recipes', template.id, template);
    return template;
  }

  public markNotificationRead(notificationId: string, memberId: string): AuditNotificationEvent | null {
    let target: AuditNotificationEvent | null = null;
    const updated = this.state.auditNotifications.map((n) => {
      if (n.id !== notificationId) return n;
      const readList = Array.isArray(n.readByMemberIds) ? n.readByMemberIds : [];
      if (readList.includes(memberId)) {
        target = n;
        return n;
      }
      const nextRead = [...readList, memberId];
      if (firestoreDb && !n.id.startsWith('local-')) {
        updateDoc(doc(firestoreDb, 'audit_notifications', n.id), {
          readByMemberIds: nextRead,
        }).catch((err) => console.warn('Cloud notification read update warning:', err));
      }
      target = { ...n, readByMemberIds: nextRead };
      return target;
    });

    this.saveLocalState({
      ...this.state,
      auditNotifications: updated,
    });
    return target;
  }

  public markAllNotificationsRead(memberId: string): void {
    const updated = this.state.auditNotifications.map((n) => {
      const readList = Array.isArray(n.readByMemberIds) ? n.readByMemberIds : [];
      if (readList.includes(memberId)) return n;
      const nextRead = [...readList, memberId];
      if (firestoreDb && !n.id.startsWith('local-')) {
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

  // ==========================================
  // RUNWAY CAPITAL PLANNING MODULE METHODS
  // ==========================================

  public assertRunwayCompliance(params: {
    orgId: string;
    amount: number;
    allocation?: RunwayAllocation;
    actor: OrgMember;
    planId?: string;
  }): {
    runwayPlanId?: string;
    runwayLineId?: string;
    runwayReserveDraw?: number;
    runwayAllocationNote?: string;
  } {
    let targetPlan: RunwayPlan | undefined;
    let targetLine: RunwayLine | undefined;

    // 1. If explicit allocation to a line, locate the line and its plan directly
    const alloc = params.allocation;
    if (alloc?.mode === 'LINE') {
      targetLine = (this.state.runwayLines || []).find((l) => l.id === alloc.lineId);
      if (targetLine) {
        targetPlan = (this.state.runwayPlans || []).find((p) => p.id === targetLine!.planId);
      }
    }

    // 2. If explicit planId passed
    if (!targetPlan && params.planId) {
      targetPlan = (this.state.runwayPlans || []).find((p) => p.id === params.planId);
    }

    // 3. Match active plan by orgId (supporting multi-tenant aliases)
    const candidateOrgIds = new Set<string>(
      [params.orgId, params.actor?.orgId, this.state.activeOrgId, 'org-master'].filter(
        Boolean
      ) as string[]
    );

    if (!targetPlan) {
      targetPlan = (this.state.runwayPlans || []).find(
        (p) => candidateOrgIds.has(p.orgId) && p.status === 'ACTIVE'
      );
    }

    // 4. If an explicit allocation was provided and no ACTIVE plan was found, check if a plan is in PLEDGING or DRAFT status
    if (!targetPlan && params.allocation) {
      targetPlan = (this.state.runwayPlans || []).find(
        (p) => candidateOrgIds.has(p.orgId) && (p.status === 'PLEDGING' || p.status === 'DRAFT')
      );
    }

    if (!targetPlan) {
      return {};
    }

    // If plan is not ACTIVE (e.g. user executing during PLEDGING phase or testing):
    // Still assign tags so the expense tracks properly against the plan and line
    if (targetPlan.status !== 'ACTIVE') {
      return {
        runwayPlanId: targetPlan.id,
        runwayLineId: targetLine?.id || (alloc?.mode === 'LINE' ? alloc.lineId : undefined),
        runwayReserveDraw: alloc?.mode === 'LINE' ? alloc.reserveDrawAmount : undefined,
        runwayAllocationNote: alloc?.mode === 'LINE' ? alloc.reserveReason : (alloc?.mode === 'CONTINGENCY' ? alloc.reason : undefined),
      };
    }

    const lines = (this.state.runwayLines || []).filter((l) => l.planId === targetPlan!.id);
    const leftMoney = this.getCurrentOrgLeftMoney(targetPlan.orgId || params.orgId);
    const availableCash = computeAvailableCash(leftMoney, this.state.expenses);

    const evalResult = evaluateSpend({
      plan: targetPlan,
      lines,
      expenses: this.state.expenses,
      allocation: params.allocation,
      amount: params.amount,
      availableCash,
      actorRole: params.actor.role,
      debts: this.state.debtLiabilities,
    });

    if (evalResult.advisoryWarning) {
      const now = new Date().toISOString();
      const audit = this.createChainedAuditEvent({
        actor: params.actor,
        locationId: targetPlan.locationId || 'ALL',
        locationName: 'Runway Capital Engine',
        eventType: 'RUNWAY_OFF_PLAN_WARNING',
        severity: 'INFO',
        title: `Off-Plan Spend Warning: ${targetPlan.name}`,
        message: `${params.actor.fullName} logged $${params.amount.toFixed(2)} without Runway plan allocation under ADVISORY enforcement.`,
        referenceEntityId: targetPlan.id,
        timestamp: now,
      });
      this.state.auditNotifications = [audit, ...this.state.auditNotifications];
      this.saveLocalState({ ...this.state });
      void this.persistDocumentToCloudIfActive('audit_notifications', audit.id, audit);
    }

    return evalResult.tags;
  }

  public checkAndBroadcastPlanMilestones(planId: string, actor: OrgMember): void {
    const plan = (this.state.runwayPlans || []).find((p) => p.id === planId);
    if (!plan) return;

    const lines = (this.state.runwayLines || []).filter((l) => l.planId === plan.id);
    const pledges = (this.state.runwayPledges || []).filter((p) => p.planId === plan.id);
    const contributions = (this.state.capitalContributions || []).filter((c) => c.runwayPlanId === plan.id);
    const expenses = (this.state.expenses || []).filter((e) => e.runwayPlanId === plan.id);
    const debts = (this.state.debtLiabilities || []).filter((d) => d.runwayPlanId === plan.id);

    const layers = computeFundingLayers(plan, lines, pledges, contributions, expenses, debts);

    // Calculate revenue from livestock sales and credit sales for break-even
    const salesRevenue = (this.state.livestockEvents || [])
      .filter((e) => e.eventType === 'SALE_DISPATCH')
      .reduce((acc, e) => acc + (e.saleRevenueAmount || 0), 0);
    const creditSaleReceipts = (this.state.creditSales || []).reduce((acc, cs) => {
      const repSum = (cs.paymentLogs || []).reduce((pAcc: number, p) => pAcc + (p.amount || 0), 0);
      return acc + repSum;
    }, 0);

    const recovery = computeRecovery(layers.executed, salesRevenue, creditSaleReceipts);
    const newMilestones = detectMilestones(layers, plan, recovery.isBreakEven);

    if (newMilestones.length === 0) return;

    const now = new Date().toISOString();
    const updatedMilestones = { ...(plan.milestonesReached || {}) };
    const newAudits: AuditNotificationEvent[] = [];

    for (const m of newMilestones) {
      updatedMilestones[m] = now;
      const title = `Runway Milestone: ${m.replace('_', ' ')} (${plan.name})`;
      const message = `${plan.name} reached milestone ${m.replace('_', ' ')}! Progress: Pledged ${layers.pledgedPct}%, Collected ${layers.collectedPct}%, Executed ${layers.executedPct}%.`;

      const audit = this.createChainedAuditEvent({
        actor,
        locationId: plan.locationId || 'ALL',
        locationName: 'Runway Capital Engine',
        eventType: 'RUNWAY_MILESTONE',
        severity: 'MILESTONE',
        title,
        message,
        referenceEntityId: plan.id,
        timestamp: now,
      });
      newAudits.unshift(audit);
      this.state.auditNotifications = [audit, ...(this.state.auditNotifications || [])];
    }

    const updatedPlan: RunwayPlan = {
      ...plan,
      milestonesReached: updatedMilestones,
      updatedAt: now,
    };

    const nextState: AgroStateSnapshot = {
      ...this.state,
      runwayPlans: (this.state.runwayPlans || []).map((p) => (p.id === plan.id ? updatedPlan : p)),
      auditNotifications: this.state.auditNotifications,
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('runway_plans', updatedPlan.id, updatedPlan);
    for (const aud of newAudits) {
      void this.persistDocumentToCloudIfActive('audit_notifications', aud.id, aud);
    }
  }

  public setRunwayModuleEnabled(params: {
    orgId: string;
    enabled: boolean;
    actor: OrgMember;
  }): Organization {
    if (!PERMISSIONS.canEnableRunwayModule(params.actor.role)) {
      throw new Error('Access Denied: Only Organization Admins can toggle the Runway Planning module.');
    }
    const targetOrgId = params.orgId || params.actor.orgId || this.state.activeOrgId || 'org-master';
    if (params.actor.orgId && params.actor.orgId !== targetOrgId) {
      throw new Error('Tenant Boundary Violation: Actor cannot modify another organization.');
    }

    if (!params.enabled) {
      const activeOrPledgingPlan = (this.state.runwayPlans || []).find(
        (p) => p.orgId === targetOrgId && (p.status === 'PLEDGING' || p.status === 'ACTIVE')
      );
      if (activeOrPledgingPlan) {
        throw new Error('Cannot disable Runway module while a plan is in PLEDGING or ACTIVE status.');
      }
    }

    const org = this.getActiveOrganization(targetOrgId);
    const updatedFeatures = {
      ...org.features,
      runwayModule: params.enabled,
    };
    const now = new Date().toISOString();
    const updatedOrg: Organization = {
      ...org,
      features: updatedFeatures,
      updatedAt: now,
    };

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: 'ALL',
      locationName: 'Organization Master',
      eventType: 'ORGANIZATION_CREATED',
      severity: 'INFO',
      title: `Runway Planning Module ${params.enabled ? 'Enabled' : 'Disabled'}`,
      message: `Runway Capital Planning module was ${params.enabled ? 'enabled' : 'disabled'} for ${org.name} by ${params.actor.fullName}.`,
      referenceEntityId: org.id,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      organizations: (this.state.organizations || []).map((o) => (o.id === org.id ? updatedOrg : o)),
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('organizations', updatedOrg.id, updatedOrg);
    void this.persistDocumentToCloudIfActive('audit_notifications', audit.id, audit);
    return updatedOrg;
  }

  public snoozeRunwayPromo(params: {
    orgId: string;
    days?: number;
    actor: OrgMember;
  }): Organization {
    const org = this.getActiveOrganization(params.orgId);
    const days = params.days ?? 7;
    const now = new Date();
    const snoozedUntil = new Date(now.getTime() + days * 86_400_000).toISOString();
    const count = (org.runwayPromoShownCount || 0) + 1;

    const updatedOrg: Organization = {
      ...org,
      runwayPromoSnoozedUntil: snoozedUntil,
      runwayPromoShownCount: count,
      updatedAt: now.toISOString(),
    };

    const nextState: AgroStateSnapshot = {
      ...this.state,
      organizations: (this.state.organizations || []).map((o) => (o.id === org.id ? updatedOrg : o)),
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('organizations', updatedOrg.id, updatedOrg);
    return updatedOrg;
  }

  public createRunwayPlan(params: {
    name: string;
    orgId?: string;
    orgType?: 'AGRO_FARMING' | 'GENERAL_VENTURE';
    mode?: RunwayMode;
    contingencyMode?: ContingencyMode;
    contingencyPercent?: number;
    contingencyFixedAmount?: number;
    targetBasis?: RunwayTargetBasis;
    activationThresholdPct?: number;
    startDate?: string;
    fundingDeadline?: string;
    breakEvenTargetDate?: string;
    locationId?: string;
    linkedLivestockId?: string;
    templateId?: string;
    showMemberPledges?: boolean;
    collectionMode?: 'ANYTIME' | 'BY_DEADLINE' | 'INSTALMENTS';
    enforcement?: RunwayEnforcement;
    spendEnforcement?: RunwayEnforcement;
    openingCashAdopted?: number;
    adoptOpeningCash?: boolean;
    phases?: (RunwayPhase | Omit<RunwayPhase, 'id'>)[];
    plannedFinancing?: { id: string; lenderName: string; amount: number; expectedDate?: string }[];
    lines?: (Partial<RunwayLine> & { title: string; category: string; qty: number; unitCost: number })[];
    actor: OrgMember;
  }): { plan: RunwayPlan; lines: RunwayLine[] } {
    if (!PERMISSIONS.canCreateRunwayPlan(params.actor.role)) {
      throw new Error('Access Denied: Only Organization Admins can create a Runway Plan.');
    }
    const targetOrgId = params.orgId || params.actor.orgId || this.state.activeOrgId || 'org-master';
    if (params.actor.orgId && params.actor.orgId !== targetOrgId) {
      throw new Error('Tenant Boundary Violation: Actor cannot create a plan for another organization.');
    }

    const org = this.getActiveOrganization(targetOrgId);
    const now = new Date().toISOString();
    const planId = `RWY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const adoptedCash =
      typeof params.openingCashAdopted === 'number'
        ? round2(Math.max(0, params.openingCashAdopted))
        : params.adoptOpeningCash
          ? round2(Math.max(0, this.getCurrentOrgLeftMoney(targetOrgId)))
          : 0;

    const newPlan: RunwayPlan = {
      id: planId,
      orgId: targetOrgId,
      name: params.name.trim().slice(0, 140),
      orgType: params.orgType || org.type,
      mode: params.mode || 'SIMPLE',
      status: 'DRAFT',
      enforcement: params.enforcement || params.spendEnforcement || 'STRICT',
      locationId: params.locationId,
      linkedLivestockId: params.linkedLivestockId,
      templateId: params.templateId,
      startDate: params.startDate || now,
      fundingDeadline: params.fundingDeadline,
      breakEvenTargetDate: params.breakEvenTargetDate,
      contingencyMode: params.contingencyMode || 'PERCENT',
      contingencyPercent: params.contingencyPercent ?? (org.type === 'AGRO_FARMING' ? 15 : 10),
      contingencyFixedAmount: params.contingencyFixedAmount,
      targetBasis: params.targetBasis || 'GROSS',
      activationThresholdPct: params.activationThresholdPct ?? 100,
      openingCashAdopted: adoptedCash,
      plannedFinancing: params.plannedFinancing || [],
      phases: (params.phases || []).map((p, idx) => ('id' in p ? (p as RunwayPhase) : { ...p, id: `PHASE-${idx + 1}` })),
      showMemberPledges: Boolean(params.showMemberPledges),
      collectionMode: params.collectionMode || 'ANYTIME',
      milestonesReached: {},
      version: 1,
      createdByMemberId: params.actor.id,
      createdByName: params.actor.fullName,
      createdAt: now,
      updatedAt: now,
      auditHash: computeLedgerRecordHash('RUNWAY_PLAN', planId, now, 0, params.name.trim()),
    };

    const createdLines: RunwayLine[] = (params.lines || []).map((l, index) => {
      const lineId = `RWL-${Date.now().toString(36).toUpperCase()}-${index}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
      const lineCost = round2((l.qty || 1) * (l.unitCost || 0));
      return {
        ...l,
        id: lineId,
        planId,
        orgId: targetOrgId,
        kind: l.kind || 'COST',
        title: (l.title || 'Budget Item').trim().slice(0, 140),
        category: (l.category || 'GENERAL').trim(),
        qty: Math.max(0.01, Number(l.qty) || 1),
        unitCost: Math.max(0, Number(l.unitCost) || 0),
        priority: l.priority || 'ESSENTIAL',
        excludeFromContingency: Boolean(l.excludeFromContingency),
        origin: 'PLAN',
        approval: 'APPROVED',
        sortOrder: index,
        createdAt: now,
        updatedAt: now,
        auditHash: computeLedgerRecordHash('RUNWAY_LINE', lineId, now, lineCost, l.title || 'Budget Item'),
      };
    });

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: params.locationId || 'ALL',
      locationName: 'Runway Capital Engine',
      eventType: 'RUNWAY_PLAN_CREATED',
      severity: 'FINANCIAL',
      title: `Runway Plan Created: ${newPlan.name}`,
      message: `Created Runway Plan "${newPlan.name}" (${newPlan.mode} mode, ${newPlan.contingencyPercent}% contingency) with ${createdLines.length} planned steps.`,
      referenceEntityId: newPlan.id,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      activeOrgId: targetOrgId,
      runwayPlans: [newPlan, ...(this.state.runwayPlans || [])],
      runwayLines: [...(this.state.runwayLines || []), ...createdLines],
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('runway_plans', newPlan.id, newPlan);
    for (const l of createdLines) {
      void this.persistDocumentToCloudIfActive('runway_lines', l.id, l);
    }
    void this.persistDocumentToCloudIfActive('audit_notifications', audit.id, audit);

    return { plan: newPlan, lines: createdLines };
  }

  public upsertRunwayLine(params: {
    planId: string;
    line: Partial<RunwayLine> & {
      title: string;
      category: string;
      qty: number;
      unitCost: number;
    };
    actor: OrgMember;
  }): RunwayLine {
    if (!PERMISSIONS.canEditRunwayDraft(params.actor.role)) {
      throw new Error('Access Denied: Only Admins and Treasurers can edit a Runway Plan draft.');
    }
    const plan = (this.state.runwayPlans || []).find((p) => p.id === params.planId);
    if (!plan) throw new Error('Runway plan not found.');
    if (params.actor.orgId && params.actor.orgId !== plan.orgId) {
      throw new Error('Tenant Boundary Violation: Actor cannot modify another organization\'s plan.');
    }
    if (plan.status !== 'DRAFT') {
      throw new RunwayError(
        'RUNWAY_PLAN_LOCKED',
        'Plan is locked. Lines cannot be directly edited after locking; propose an amendment instead.'
      );
    }

    const now = new Date().toISOString();
    const lineId = params.line.id || `RWL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const cost = round2(params.line.qty * params.line.unitCost);

    const existingLines = (this.state.runwayLines || []).filter((l) => l.planId === plan.id);
    const existingIndex = existingLines.findIndex((l) => l.id === lineId);

    const upsertedLine: RunwayLine = {
      id: lineId,
      planId: plan.id,
      orgId: plan.orgId,
      phaseId: params.line.phaseId,
      kind: params.line.kind || 'COST',
      title: params.line.title.trim().slice(0, 140),
      category: params.line.category.trim(),
      qty: params.line.qty,
      unitCost: params.line.unitCost,
      unitLabel: params.line.unitLabel,
      recurrence: params.line.recurrence,
      plannedDate: params.line.plannedDate,
      priority: params.line.priority || 'ESSENTIAL',
      excludeFromContingency: Boolean(params.line.excludeFromContingency),
      confidencePct: params.line.confidencePct,
      origin: 'PLAN',
      approval: 'APPROVED',
      sortOrder: params.line.sortOrder ?? (existingIndex >= 0 ? existingLines[existingIndex].sortOrder : existingLines.length),
      createdAt: existingIndex >= 0 ? existingLines[existingIndex].createdAt : now,
      updatedAt: now,
      auditHash: computeLedgerRecordHash('RUNWAY_LINE', lineId, now, cost, params.line.title.trim()),
    };

    let nextLines: RunwayLine[];
    if (existingIndex >= 0) {
      nextLines = (this.state.runwayLines || []).map((l) => (l.id === lineId ? upsertedLine : l));
    } else {
      nextLines = [...(this.state.runwayLines || []), upsertedLine];
    }

    const updatedPlan: RunwayPlan = {
      ...plan,
      updatedAt: now,
    };

    const nextState: AgroStateSnapshot = {
      ...this.state,
      runwayLines: nextLines,
      runwayPlans: (this.state.runwayPlans || []).map((p) => (p.id === plan.id ? updatedPlan : p)),
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('runway_lines', upsertedLine.id, upsertedLine);
    void this.persistDocumentToCloudIfActive('runway_plans', updatedPlan.id, updatedPlan);
    return upsertedLine;
  }

  public removeRunwayLine(params: {
    planId: string;
    lineId: string;
    actor: OrgMember;
  }): void {
    if (!PERMISSIONS.canEditRunwayDraft(params.actor.role)) {
      throw new Error('Access Denied: Only Admins and Treasurers can edit a Runway Plan draft.');
    }
    const plan = (this.state.runwayPlans || []).find((p) => p.id === params.planId);
    if (!plan) throw new Error('Runway plan not found.');
    if (params.actor.orgId && params.actor.orgId !== plan.orgId) {
      throw new Error('Tenant Boundary Violation: Actor cannot modify another organization\'s plan.');
    }
    if (plan.status !== 'DRAFT') {
      throw new RunwayError(
        'RUNWAY_PLAN_LOCKED',
        'Plan is locked. Lines cannot be deleted after locking.'
      );
    }

    const nextLines = (this.state.runwayLines || []).filter((l) => l.id !== params.lineId);
    const updatedPlan: RunwayPlan = {
      ...plan,
      updatedAt: new Date().toISOString(),
    };

    const nextState: AgroStateSnapshot = {
      ...this.state,
      runwayLines: nextLines,
      runwayPlans: (this.state.runwayPlans || []).map((p) => (p.id === plan.id ? updatedPlan : p)),
    };

    this.saveLocalState(nextState);
    if (firestoreDb && !params.lineId.startsWith('local-')) {
      deleteDoc(doc(firestoreDb, 'runway_lines', params.lineId)).catch((err) =>
        console.warn('Cloud runway line deletion warning:', err)
      );
    }
    void this.persistDocumentToCloudIfActive('runway_plans', updatedPlan.id, updatedPlan);
  }

  public reorderRunwayLines(params: {
    planId: string;
    lineIds: string[];
    actor: OrgMember;
  }): void {
    if (!PERMISSIONS.canEditRunwayDraft(params.actor.role)) {
      throw new Error('Access Denied: Only Admins and Treasurers can edit a Runway Plan draft.');
    }
    const plan = (this.state.runwayPlans || []).find((p) => p.id === params.planId);
    if (!plan) throw new Error('Runway plan not found.');
    if (plan.status !== 'DRAFT') {
      throw new RunwayError('RUNWAY_PLAN_LOCKED', 'Plan is locked.');
    }

    const nextLines = (this.state.runwayLines || []).map((l) => {
      if (l.planId !== plan.id) return l;
      const newOrder = params.lineIds.indexOf(l.id);
      return newOrder >= 0 ? { ...l, sortOrder: newOrder, updatedAt: new Date().toISOString() } : l;
    });

    this.saveLocalState({
      ...this.state,
      runwayLines: nextLines,
    });
  }

  public updateRunwayReserve(params: {
    planId: string;
    contingencyMode: ContingencyMode;
    contingencyPercent?: number;
    contingencyFixedAmount?: number;
    actor: OrgMember;
  }): RunwayPlan {
    if (!PERMISSIONS.canEditRunwayDraft(params.actor.role)) {
      throw new Error('Access Denied: Only Admins and Treasurers can edit a Runway Plan draft.');
    }
    const plan = (this.state.runwayPlans || []).find((p) => p.id === params.planId);
    if (!plan) throw new Error('Runway plan not found.');
    if (params.actor.orgId && params.actor.orgId !== plan.orgId) {
      throw new Error('Tenant Boundary Violation: Actor cannot modify another organization\'s plan.');
    }
    if (plan.status !== 'DRAFT') {
      throw new RunwayError('RUNWAY_PLAN_LOCKED', 'Plan is locked.');
    }

    const now = new Date().toISOString();
    const updatedPlan: RunwayPlan = {
      ...plan,
      contingencyMode: params.contingencyMode,
      contingencyPercent: params.contingencyPercent,
      contingencyFixedAmount: params.contingencyFixedAmount,
      updatedAt: now,
    };

    const nextState: AgroStateSnapshot = {
      ...this.state,
      runwayPlans: (this.state.runwayPlans || []).map((p) => (p.id === plan.id ? updatedPlan : p)),
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('runway_plans', updatedPlan.id, updatedPlan);
    return updatedPlan;
  }

  public updateRunwayRevenuePricing(params: {
    planId: string;
    livestockId: string;
    sellingPricePerUnit: number;
    pricingUnit?: 'HEAD' | 'KG';
    averageWeightKg?: number;
    actor: OrgMember;
  }): RunwayPlan {
    const plan = (this.state.runwayPlans || []).find((p) => p.id === params.planId);
    if (!plan) throw new Error('Runway plan not found.');
    if (params.actor.orgId && params.actor.orgId !== plan.orgId) {
      throw new Error('Tenant Boundary Violation: Actor cannot modify another organization\'s plan.');
    }

    const now = new Date().toISOString();
    const currentPricings = plan.livestockRevenuePricings || {};
    const updatedPlan: RunwayPlan = {
      ...plan,
      livestockRevenuePricings: {
        ...currentPricings,
        [params.livestockId]: {
          sellingPricePerUnit: Math.max(0, Number(params.sellingPricePerUnit) || 0),
          pricingUnit: params.pricingUnit || 'HEAD',
          averageWeightKg: params.averageWeightKg,
          updatedAt: now,
        },
      },
      updatedAt: now,
    };

    const nextState: AgroStateSnapshot = {
      ...this.state,
      runwayPlans: (this.state.runwayPlans || []).map((p) => (p.id === plan.id ? updatedPlan : p)),
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('runway_plans', updatedPlan.id, updatedPlan);
    return updatedPlan;
  }

  public lockRunwayPlan(params: {
    planId: string;
    enforcement?: RunwayEnforcement;
    activationThresholdPct?: number;
    adoptOpeningCash?: boolean;
    actor: OrgMember;
  }): RunwayPlan {
    if (!PERMISSIONS.canLockRunwayPlan(params.actor.role)) {
      throw new Error('Access Denied: Only Organization Admins can lock a Runway Plan.');
    }
    const plan = (this.state.runwayPlans || []).find((p) => p.id === params.planId);
    if (!plan) throw new Error('Runway plan not found.');
    if (params.actor.orgId && params.actor.orgId !== plan.orgId) {
      throw new Error('Tenant Boundary Violation: Actor cannot modify another organization\'s plan.');
    }
    if (plan.status !== 'DRAFT') {
      throw new Error('Only DRAFT plans can be locked for pledging.');
    }

    const lines = (this.state.runwayLines || []).filter((l) => l.planId === plan.id);
    const totals = computePlanTotals(plan, lines);
    if (totals.totalRequirement <= 0) {
      throw new Error('Cannot lock plan with zero total capital requirement. Please add at least one step.');
    }

    let openingCashAdopted = 0;
    if (params.adoptOpeningCash) {
      openingCashAdopted = Math.max(0, this.getCurrentOrgLeftMoney(plan.orgId));
    }

    const now = new Date().toISOString();
    const updatedPlan: RunwayPlan = {
      ...plan,
      status: 'PLEDGING',
      enforcement: params.enforcement || 'STRICT',
      activationThresholdPct: params.activationThresholdPct ?? 100,
      openingCashAdopted,
      lockedAt: now,
      updatedAt: now,
    };

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: plan.locationId || 'ALL',
      locationName: 'Runway Capital Engine',
      eventType: 'RUNWAY_PLAN_LOCKED',
      severity: 'FINANCIAL',
      title: `Runway Plan Locked: ${plan.name} ($${totals.totalRequirement.toFixed(2)})`,
      message: `Plan locked for member pledging. Total Capital Requirement: $${totals.totalRequirement.toFixed(2)} (Opening cash adopted: $${openingCashAdopted.toFixed(2)}).`,
      referenceEntityId: plan.id,
      timestamp: now,
    });
    this.state.auditNotifications = [audit, ...(this.state.auditNotifications || [])];

    const broadcast = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: plan.locationId || 'ALL',
      locationName: 'All Locations (Master Organization)',
      eventType: 'GROUND_BROADCAST',
      severity: 'MILESTONE',
      title: `Capital Plan Open for Pledges: ${plan.name}`,
      message: `Our organization needs $${totals.totalRequirement.toFixed(2)} for ${plan.name}. Add your pledge now to help us reach our target!`,
      referenceEntityId: plan.id,
      timestamp: now,
    });
    this.state.auditNotifications = [broadcast, ...(this.state.auditNotifications || [])];

    const nextState: AgroStateSnapshot = {
      ...this.state,
      runwayPlans: (this.state.runwayPlans || []).map((p) => (p.id === plan.id ? updatedPlan : p)),
      auditNotifications: this.state.auditNotifications,
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('runway_plans', updatedPlan.id, updatedPlan);
    void this.persistDocumentToCloudIfActive('audit_notifications', audit.id, audit);
    void this.persistDocumentToCloudIfActive('audit_notifications', broadcast.id, broadcast);
    return updatedPlan;
  }

  public pledgeToRunwayPlan(params: {
    planId: string;
    memberId: string;
    amount: number;
    pace?: 'ONE_OFF' | 'MONTHLY' | 'MILESTONE' | 'FLEXIBLE';
    instalments?: { dueDate: string; amount: number }[];
    note?: string;
    actor: OrgMember;
  }): RunwayPledge {
    if (!PERMISSIONS.canPledge(params.actor.role)) {
      throw new Error('Access Denied: You do not have permission to pledge.');
    }
    const plan = (this.state.runwayPlans || []).find((p) => p.id === params.planId);
    if (!plan) throw new Error('Runway plan not found.');
    if (params.actor.orgId && params.actor.orgId !== plan.orgId) {
      throw new Error('Tenant Boundary Violation: Actor cannot pledge to another organization\'s plan.');
    }

    if (plan.status === 'COMPLETED' || plan.status === 'ARCHIVED') {
      throw new Error(`Cannot pledge to a plan in ${plan.status} status. Pledging is only open during DRAFT, PLEDGING, and ACTIVE stages.`);
    }

    const isSelf = params.memberId === params.actor.id;
    const isPrivileged =
      params.actor.role === 'ORG_ADMIN' ||
      params.actor.role === 'SYNDICATE_ADMIN' ||
      params.actor.role === 'TREASURER';
    if (!isSelf && !isPrivileged) {
      throw new Error('Access Denied: Only Admins and Treasurers can record a pledge on behalf of another member.');
    }

    const member = this.state.members.find((m) => m.id === params.memberId);
    if (!member) throw new Error('Target member not found.');

    const cleanAmount = Number(params.amount.toFixed(2));
    if (cleanAmount <= 0) {
      throw new Error('Pledge amount must be greater than zero.');
    }

    const now = new Date().toISOString();
    const existingPledge = (this.state.runwayPledges || []).find(
      (p) => p.planId === plan.id && p.memberId === member.id
    );

    let updatedPledge: RunwayPledge;

    if (existingPledge) {
      if (cleanAmount < existingPledge.amount) {
        const paidContributions = (this.state.capitalContributions || [])
          .filter(
            (c) =>
              c.runwayPlanId === plan.id &&
              (c.pledgeId === existingPledge.id || c.memberId === member.id) &&
              c.direction !== 'CONTRA_REVERSAL'
          )
          .reduce((acc, c) => acc + c.amount, 0);

        if (cleanAmount < paidContributions) {
          throw new RunwayError(
            'RUNWAY_PLEDGE_BELOW_PAID',
            `Cannot reduce pledge ($${cleanAmount.toFixed(2)}) below amount already contributed ($${paidContributions.toFixed(2)}).`
          );
        }
      }

      const eventType: 'INCREASE' | 'DECREASE' = cleanAmount > existingPledge.amount ? 'INCREASE' : 'DECREASE';
      const historyEvent = {
        id: `PEV-${Date.now().toString(36).toUpperCase()}`,
        type: eventType,
        previousAmount: existingPledge.amount,
        newAmount: cleanAmount,
        note: params.note || `Pledge ${eventType.toLowerCase()}d from $${existingPledge.amount.toFixed(2)} to $${cleanAmount.toFixed(2)}`,
        byMemberId: params.actor.id,
        at: now,
        auditHash: computeLedgerRecordHash('PLEDGE_EVENT', existingPledge.id, now, cleanAmount, params.note || ''),
      };

      updatedPledge = {
        ...existingPledge,
        amount: cleanAmount,
        pace: params.pace || existingPledge.pace,
        instalments: params.instalments || existingPledge.instalments,
        history: [...(existingPledge.history || []), historyEvent],
        updatedAt: now,
      };
    } else {
      const pledgeId = `PLG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const historyEvent = {
        id: `PEV-${Date.now().toString(36).toUpperCase()}`,
        type: 'INITIAL' as const,
        previousAmount: 0,
        newAmount: cleanAmount,
        note: params.note || `Initial pledge of $${cleanAmount.toFixed(2)}`,
        byMemberId: params.actor.id,
        at: now,
        auditHash: computeLedgerRecordHash('PLEDGE_EVENT', pledgeId, now, cleanAmount, params.note || ''),
      };

      updatedPledge = {
        id: pledgeId,
        planId: plan.id,
        orgId: plan.orgId,
        memberId: member.id,
        memberName: member.fullName,
        amount: cleanAmount,
        pace: params.pace || 'ONE_OFF',
        instalments: params.instalments,
        history: [historyEvent],
        createdAt: now,
        updatedAt: now,
      };
    }

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: plan.locationId || 'ALL',
      locationName: 'Runway Capital Engine',
      eventType: 'RUNWAY_PLEDGE',
      severity: 'FINANCIAL',
      title: `Pledge: $${cleanAmount.toFixed(2)} by ${member.fullName}`,
      message: `${member.fullName} committed $${cleanAmount.toFixed(2)} toward ${plan.name} (${updatedPledge.pace}).`,
      referenceEntityId: updatedPledge.id,
      timestamp: now,
    });

    const nextPledges = existingPledge
      ? (this.state.runwayPledges || []).map((p) => (p.id === updatedPledge.id ? updatedPledge : p))
      : [updatedPledge, ...(this.state.runwayPledges || [])];

    const nextContributions = (this.state.capitalContributions || []).map((c) => {
      if (c.runwayPlanId === plan.id && c.memberId === member.id && !c.pledgeId) {
        return { ...c, pledgeId: updatedPledge.id };
      }
      return c;
    });

    const nextClaims = (this.state.runwayClaims || []).map((cl) => {
      if (cl.planId === plan.id && cl.memberId === member.id && !cl.pledgeId) {
        return { ...cl, pledgeId: updatedPledge.id };
      }
      return cl;
    });

    const paceMapping: 'MONTHLY' | 'MILESTONE' | 'FLEXIBLE' =
      params.pace === 'MONTHLY'
        ? 'MONTHLY'
        : params.pace === 'MILESTONE'
        ? 'MILESTONE'
        : params.pace === 'ONE_OFF'
        ? 'MILESTONE'
        : 'FLEXIBLE';

    const updatedMember: OrgMember = {
      ...member,
      targetContributionUsd: cleanAmount,
      contributionPace: paceMapping,
      updatedAt: now,
    };

    const nextMembers = this.state.members.map((m) =>
      m.id === updatedMember.id ? updatedMember : m
    );

    const nextState: AgroStateSnapshot = {
      ...this.state,
      members: nextMembers,
      runwayPledges: nextPledges,
      capitalContributions: nextContributions,
      runwayClaims: nextClaims,
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('members', updatedMember.id, updatedMember);
    void this.persistDocumentToCloudIfActive('runway_pledges', updatedPledge.id, updatedPledge);
    void this.persistDocumentToCloudIfActive('audit_notifications', audit.id, audit);

    this.checkAndBroadcastPlanMilestones(plan.id, params.actor);
    return updatedPledge;
  }

  public submitRunwayPaymentClaim(params: {
    planId: string;
    pledgeId?: string;
    memberId?: string;
    amount: number;
    method: string;
    reference?: string;
    note?: string;
    proofPhotoDataUrl?: string;
    autoConfirm?: boolean;
    actor: OrgMember;
  }): RunwayPaymentClaim {
    const plan = (this.state.runwayPlans || []).find((p) => p.id === params.planId);
    if (!plan) throw new Error('Runway plan not found.');
    if (params.actor.orgId && params.actor.orgId !== plan.orgId) {
      throw new Error('Tenant Boundary Violation: Actor cannot claim payment for another organization.');
    }

    const targetMemberId = params.memberId || params.actor.id;
    const isSelf = targetMemberId === params.actor.id;
    const isPrivileged = PERMISSIONS.canConfirmPaymentClaim(params.actor.role);
    if (!isSelf && !isPrivileged) {
      throw new Error('Access Denied: Only Admins and Treasurers can record a payment claim on behalf of another member.');
    }

    const targetMember =
      this.state.members.find((m) => m.id === targetMemberId) ||
      (isSelf ? params.actor : undefined);
    if (!targetMember) {
      throw new Error('Selected member not found.');
    }

    const pledge = (this.state.runwayPledges || []).find(
      (p) => (params.pledgeId ? p.id === params.pledgeId : p.planId === plan.id && p.memberId === targetMember.id)
    );

    const now = new Date().toISOString();
    const claimId = `CLM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const cleanAmount = Number(params.amount.toFixed(2));

    const claim: RunwayPaymentClaim = {
      id: claimId,
      planId: plan.id,
      orgId: plan.orgId,
      pledgeId: pledge ? pledge.id : '',
      memberId: targetMember.id,
      memberName: targetMember.fullName,
      amount: cleanAmount,
      method: params.method.trim(),
      reference: params.reference?.trim(),
      note: params.note?.trim(),
      proofPhotoDataUrl: params.proofPhotoDataUrl,
      receiptPhotoDataUrl: params.proofPhotoDataUrl,
      status: 'PENDING',
      createdAt: now,
      auditHash: computeLedgerRecordHash('PAYMENT_CLAIM', claimId, now, cleanAmount, params.method.trim()),
    };

    const nextState: AgroStateSnapshot = {
      ...this.state,
      runwayClaims: [claim, ...(this.state.runwayClaims || [])],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('runway_claims', claim.id, claim);

    if (params.autoConfirm && isPrivileged) {
      return this.resolveRunwayPaymentClaim({
        claimId: claim.id,
        decision: 'CONFIRM',
        note: params.note || 'Confirmed upon entry',
        actor: params.actor,
      });
    }

    return claim;
  }

  public resolveRunwayPaymentClaim(params: {
    claimId: string;
    decision: 'CONFIRM' | 'REJECT';
    note?: string;
    actor: OrgMember;
  }): RunwayPaymentClaim {
    if (!PERMISSIONS.canConfirmPaymentClaim(params.actor.role)) {
      throw new Error('Access Denied: Only Treasurers and Organization Admins can confirm or reject payment claims.');
    }
    const claim = (this.state.runwayClaims || []).find((c) => c.id === params.claimId);
    if (!claim) throw new Error('Payment claim not found.');
    if (params.actor.orgId && params.actor.orgId !== claim.orgId) {
      throw new Error('Tenant Boundary Violation: Actor cannot resolve claim for another organization.');
    }
    if (claim.status !== 'PENDING') {
      throw new Error(`Claim has already been resolved with status ${claim.status}.`);
    }

    const now = new Date().toISOString();
    let updatedClaim: RunwayPaymentClaim;

    if (params.decision === 'CONFIRM') {
      const matchedPledge = (this.state.runwayPledges || []).find(
        (p) =>
          (claim.pledgeId && p.id === claim.pledgeId) ||
          (p.planId === claim.planId && p.memberId === claim.memberId)
      );
      const resolvedPledgeId = claim.pledgeId || matchedPledge?.id;

      const contribution = this.logCapitalContribution({
        memberId: claim.memberId,
        direction: 'ADDITION',
        amount: claim.amount,
        note: `Runway Pay-in: ${claim.method} ${claim.reference || ''} - ${params.note || claim.note || ''}`.trim(),
        actor: params.actor,
        runwayPlanId: claim.planId,
        pledgeId: resolvedPledgeId || undefined,
        claimId: claim.id,
      });

      updatedClaim = {
        ...claim,
        pledgeId: resolvedPledgeId || claim.pledgeId,
        status: 'CONFIRMED',
        resolvedByMemberId: params.actor.id,
        resolutionNote: params.note || claim.note,
        contributionId: contribution.id,
        resolvedAt: now,
      };
    } else {
      updatedClaim = {
        ...claim,
        status: 'REJECTED',
        resolvedByMemberId: params.actor.id,
        resolutionNote: params.note || 'Rejected by treasurer',
        resolvedAt: now,
      };
    }

    const nextState: AgroStateSnapshot = {
      ...this.state,
      runwayClaims: (this.state.runwayClaims || []).map((c) => (c.id === claim.id ? updatedClaim : c)),
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('runway_claims', updatedClaim.id, updatedClaim);
    return updatedClaim;
  }

  public activateRunwayPlan(params: {
    planId: string;
    actor: OrgMember;
  }): RunwayPlan {
    if (!PERMISSIONS.canActivateRunwayPlan(params.actor.role)) {
      throw new Error('Access Denied: Only Organization Admins can activate a Runway Plan.');
    }
    const plan = (this.state.runwayPlans || []).find((p) => p.id === params.planId);
    if (!plan) throw new Error('Runway plan not found.');
    if (params.actor.orgId && params.actor.orgId !== plan.orgId) {
      throw new Error('Tenant Boundary Violation: Actor cannot modify another organization\'s plan.');
    }

    const existingActive = (this.state.runwayPlans || []).find(
      (p) => p.orgId === plan.orgId && p.status === 'ACTIVE' && p.id !== plan.id
    );
    if (existingActive) {
      throw new RunwayError(
        'RUNWAY_ACTIVE_PLAN_EXISTS',
        `Organization already has an ACTIVE plan: "${existingActive.name}". Complete or archive it before activating a new plan.`
      );
    }

    const lines = (this.state.runwayLines || []).filter((l) => l.planId === plan.id);
    const pledges = (this.state.runwayPledges || []).filter((p) => p.planId === plan.id);
    const contributions = (this.state.capitalContributions || []).filter((c) => c.runwayPlanId === plan.id);
    const expenses = (this.state.expenses || []).filter((e) => e.runwayPlanId === plan.id);
    const debts = (this.state.debtLiabilities || []).filter((d) => d.runwayPlanId === plan.id);

    const layers = computeFundingLayers(plan, lines, pledges, contributions, expenses, debts);
    const requiredTarget = round2(((plan.activationThresholdPct || 100) / 100) * layers.memberTarget);

    if (layers.collected < requiredTarget) {
      throw new RunwayError(
        'RUNWAY_THRESHOLD_NOT_MET',
        `Activation threshold not met. Collected $${layers.collected.toFixed(2)} of $${requiredTarget.toFixed(2)} (${plan.activationThresholdPct}% of $${layers.memberTarget.toFixed(2)} required).`
      );
    }

    const now = new Date().toISOString();
    const updatedPlan: RunwayPlan = {
      ...plan,
      status: 'ACTIVE',
      activatedAt: now,
      updatedAt: now,
    };

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: plan.locationId || 'ALL',
      locationName: 'Runway Capital Engine',
      eventType: 'RUNWAY_PLAN_ACTIVATED',
      severity: 'MILESTONE',
      title: `Runway Plan Activated: ${plan.name}`,
      message: `Plan activated with $${layers.collected.toFixed(2)} collected. STRICT Spend Gate is now active.`,
      referenceEntityId: plan.id,
      timestamp: now,
    });
    this.state.auditNotifications = [audit, ...(this.state.auditNotifications || [])];

    const broadcast = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: plan.locationId || 'ALL',
      locationName: 'All Locations (Master Organization)',
      eventType: 'GROUND_BROADCAST',
      severity: 'MILESTONE',
      title: `Execution Begins: ${plan.name}`,
      message: `${plan.name} is fully activated and execution has begun! Real-time progress updates will appear on your dashboard.`,
      referenceEntityId: plan.id,
      timestamp: now,
    });

    this.state.auditNotifications = [broadcast, ...(this.state.auditNotifications || [])];

    const nextState: AgroStateSnapshot = {
      ...this.state,
      runwayPlans: (this.state.runwayPlans || []).map((p) => (p.id === plan.id ? updatedPlan : p)),
      auditNotifications: this.state.auditNotifications,
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('runway_plans', updatedPlan.id, updatedPlan);
    void this.persistDocumentToCloudIfActive('audit_notifications', audit.id, audit);
    void this.persistDocumentToCloudIfActive('audit_notifications', broadcast.id, broadcast);
    return updatedPlan;
  }

  public proposeRunwayAmendment(params: {
    planId: string;
    title: string;
    category: string;
    qty?: number;
    unitCost?: number;
    note: string;
    priority?: RunwayLinePriority;
    phaseId?: string;
    actor: OrgMember;
  }): RunwayLine {
    if (!PERMISSIONS.canProposeAmendment(params.actor.role)) {
      throw new Error('Access Denied: You do not have permission to propose a plan amendment.');
    }
    const plan = (this.state.runwayPlans || []).find((p) => p.id === params.planId);
    if (!plan) throw new Error('Runway plan not found.');
    if (params.actor.orgId && params.actor.orgId !== plan.orgId) {
      throw new Error('Tenant Boundary Violation: Actor cannot modify another organization\'s plan.');
    }
    if (params.note.trim().length < 4) {
      throw new Error('Mandatory explanation note (at least 4 characters) is required for amendments.');
    }

    const now = new Date().toISOString();
    const lineId = `RWL-AMD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const qty = params.qty ?? 1;
    const unitCost = params.unitCost ?? 0;
    const cost = round2(qty * unitCost);

    const existingLines = (this.state.runwayLines || []).filter((l) => l.planId === plan.id);

    const amendmentLine: RunwayLine = {
      id: lineId,
      planId: plan.id,
      orgId: plan.orgId,
      phaseId: params.phaseId,
      kind: 'COST',
      title: params.title.trim().slice(0, 140),
      category: params.category.trim(),
      qty,
      unitCost,
      priority: params.priority || 'IMPORTANT',
      origin: 'AMENDMENT',
      approval: 'PROPOSED',
      proposedByMemberId: params.actor.id,
      amendmentNote: params.note.trim(),
      sortOrder: existingLines.length,
      createdAt: now,
      updatedAt: now,
      auditHash: computeLedgerRecordHash('RUNWAY_AMENDMENT', lineId, now, cost, params.note.trim()),
    };

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: plan.locationId || 'ALL',
      locationName: 'Runway Capital Engine',
      eventType: 'RUNWAY_AMENDMENT',
      severity: 'WARNING_CONTRA',
      title: `Plan Amendment Proposed: ${amendmentLine.title} ($${cost.toFixed(2)})`,
      message: `${params.actor.fullName} (${params.actor.role}) proposed adding "${amendmentLine.title}" ($${cost.toFixed(2)}) to ${plan.name}. Note: ${params.note}`,
      referenceEntityId: amendmentLine.id,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      runwayLines: [...(this.state.runwayLines || []), amendmentLine],
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('runway_lines', amendmentLine.id, amendmentLine);
    void this.persistDocumentToCloudIfActive('audit_notifications', audit.id, audit);
    return amendmentLine;
  }

  public resolveRunwayAmendment(params: {
    lineId: string;
    decision: 'APPROVE' | 'REJECT';
    note?: string;
    actor: OrgMember;
  }): RunwayLine {
    if (!PERMISSIONS.canApproveAmendment(params.actor.role)) {
      throw new Error('Access Denied: Only Organization Admins and Treasurers can approve or reject plan amendments.');
    }
    const line = (this.state.runwayLines || []).find((l) => l.id === params.lineId);
    if (!line) throw new Error('Amendment line not found.');
    if (params.actor.orgId && params.actor.orgId !== line.orgId) {
      throw new Error('Tenant Boundary Violation: Actor cannot modify another organization\'s plan.');
    }
    if (line.approval !== 'PROPOSED') {
      throw new Error(`Amendment line has already been resolved with status ${line.approval}.`);
    }

    if (line.proposedByMemberId === params.actor.id) {
      const otherApprovers = (this.state.members || []).filter(
        (m) =>
          m.orgId === line.orgId &&
          m.active &&
          m.approvalStatus === 'APPROVED' &&
          m.id !== params.actor.id &&
          (m.role === 'ORG_ADMIN' || m.role === 'SYNDICATE_ADMIN' || m.role === 'TREASURER')
      );
      if (otherApprovers.length > 0) {
        throw new Error('Maker-Checker violation: The proposer cannot approve their own amendment when other approvers exist.');
      }
    }

    const now = new Date().toISOString();
    const plan = (this.state.runwayPlans || []).find((p) => p.id === line.planId);

    const updatedLine: RunwayLine = {
      ...line,
      approval: params.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      approvedByMemberId: params.actor.id,
      updatedAt: now,
    };

    let updatedPlan: RunwayPlan | undefined;
    if (plan && params.decision === 'APPROVE') {
      updatedPlan = {
        ...plan,
        version: (plan.version || 1) + 1,
        updatedAt: now,
      };
    }

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: plan?.locationId || 'ALL',
      locationName: 'Runway Capital Engine',
      eventType: 'RUNWAY_AMENDMENT',
      severity: params.decision === 'APPROVE' ? 'FINANCIAL' : 'INFO',
      title: `Amendment ${params.decision === 'APPROVE' ? 'Approved' : 'Rejected'}: ${line.title}`,
      message: `${params.actor.fullName} ${params.decision.toLowerCase()}d amendment "${line.title}". ${params.note || ''}`.trim(),
      referenceEntityId: line.id,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      runwayLines: (this.state.runwayLines || []).map((l) => (l.id === line.id ? updatedLine : l)),
      runwayPlans: updatedPlan
        ? (this.state.runwayPlans || []).map((p) => (p.id === updatedPlan!.id ? updatedPlan! : p))
        : this.state.runwayPlans,
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('runway_lines', updatedLine.id, updatedLine);
    if (updatedPlan) {
      void this.persistDocumentToCloudIfActive('runway_plans', updatedPlan.id, updatedPlan);
    }
    void this.persistDocumentToCloudIfActive('audit_notifications', audit.id, audit);
    return updatedLine;
  }

  public spendAgainstRunwayPlan(params: {
    planId: string;
    allocation: RunwayAllocation;
    amount: number;
    locationId: string;
    category?: ExpenseCategory;
    note: string;
    actor: OrgMember;
    receiptPhotoDataUrl?: string;
  }): ExpenseLedgerEvent {
    return this.logExpense({
      locationId: params.locationId,
      category: params.category || 'OTHER',
      direction: 'DEDUCTION',
      amount: params.amount,
      note: params.note,
      actor: params.actor,
      receiptPhotoDataUrl: params.receiptPhotoDataUrl,
      runwayAllocation: params.allocation,
      runwayPlanId: params.planId,
    });
  }

  public closeRunwayPlan(params: {
    planId: string;
    note?: string;
    actor: OrgMember;
  }): RunwayPlan {
    if (!PERMISSIONS.canClosePlan(params.actor.role)) {
      throw new Error('Access Denied: Only Organization Admins can close a Runway Plan.');
    }
    const plan = (this.state.runwayPlans || []).find((p) => p.id === params.planId);
    if (!plan) throw new Error('Runway plan not found.');
    if (params.actor.orgId && params.actor.orgId !== plan.orgId) {
      throw new Error('Tenant Boundary Violation: Actor cannot modify another organization\'s plan.');
    }
    if (plan.status !== 'ACTIVE') {
      throw new Error(`Only ACTIVE plans can be closed (current status: ${plan.status}).`);
    }

    const now = new Date().toISOString();
    const updatedPlan: RunwayPlan = {
      ...plan,
      status: 'COMPLETED',
      completedAt: now,
      updatedAt: now,
    };

    const audit = this.createChainedAuditEvent({
      actor: params.actor,
      locationId: plan.locationId || 'ALL',
      locationName: 'Runway Capital Engine',
      eventType: 'RUNWAY_PLAN_CLOSED',
      severity: 'FINANCIAL',
      title: `Runway Plan Closed: ${plan.name}`,
      message: `Runway Plan "${plan.name}" marked COMPLETED by ${params.actor.fullName}. ${params.note || ''}`.trim(),
      referenceEntityId: plan.id,
      timestamp: now,
    });

    const nextState: AgroStateSnapshot = {
      ...this.state,
      runwayPlans: (this.state.runwayPlans || []).map((p) => (p.id === plan.id ? updatedPlan : p)),
      auditNotifications: [audit, ...this.state.auditNotifications],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('runway_plans', updatedPlan.id, updatedPlan);
    void this.persistDocumentToCloudIfActive('audit_notifications', audit.id, audit);
    return updatedPlan;
  }

  public saveRunwayTemplate(params: {
    name: string;
    orgId?: string;
    orgType: 'AGRO_FARMING' | 'GENERAL_VENTURE' | 'ANY';
    contingencyPercent: number;
    phases: Omit<RunwayPhase, 'id'>[];
    lines: Omit<RunwayLine, 'id' | 'planId' | 'orgId' | 'createdAt' | 'updatedAt' | 'auditHash' | 'approval' | 'origin'>[];
    actor: OrgMember;
  }): RunwayTemplate {
    if (!PERMISSIONS.canEditRunwayDraft(params.actor.role)) {
      throw new Error('Access Denied: Only Admins and Treasurers can save Runway templates.');
    }
    const targetOrgId = params.orgId || params.actor.orgId || this.state.activeOrgId;
    const now = new Date().toISOString();
    const templateId = `TMP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const template: RunwayTemplate = {
      id: templateId,
      orgId: targetOrgId,
      name: params.name.trim().slice(0, 120),
      orgType: params.orgType,
      contingencyPercent: params.contingencyPercent,
      phases: params.phases,
      lines: params.lines,
      isBuiltIn: false,
      createdAt: now,
    };

    const nextState: AgroStateSnapshot = {
      ...this.state,
      runwayTemplates: [...(this.state.runwayTemplates || []), template],
    };

    this.saveLocalState(nextState);
    void this.persistDocumentToCloudIfActive('runway_templates', template.id, template);
    return template;
  }

  public checkRunwayReminders(): void {
    const activePlans = (this.state.runwayPlans || []).filter((p) => p.status === 'ACTIVE');
    if (activePlans.length === 0) return;

    for (const plan of activePlans) {
      const leftMoney = this.getCurrentOrgLeftMoney(plan.orgId);
      const runwayMonths = computeRunwayMonths(leftMoney, this.state.expenses);

      if (runwayMonths < 0.5) {
        void dispatchSystemNotification({
          title: `Critical Runway Warning: ${plan.name}`,
          body: `Only ${(runwayMonths * 4.3).toFixed(0)} weeks of cash remaining ($${leftMoney.toFixed(2)} available). Action required.`,
          urgent: true,
          severity: 'URGENT_GROUND',
        });
      } else if (runwayMonths < 1.0) {
        void dispatchSystemNotification({
          title: `Low Runway Alert: ${plan.name}`,
          body: `Estimated ${(runwayMonths * 4.3).toFixed(0)} weeks of cash remaining ($${leftMoney.toFixed(2)} available).`,
          urgent: false,
          severity: 'FINANCIAL',
        });
      }
    }
  }

  public async checkDueProtocolReminders(actor?: OrgMember): Promise<number> {
    const defaultActor: OrgMember = actor || this.state.members[0] || {
      id: 'mem-system-protocol',
      orgId: (this.state.organizations && this.state.organizations[0]?.id) || 'org-master',
      fullName: 'Protocol Automation System',
      email: 'system@agro.local',
      role: 'ADMIN',
      status: 'ACTIVE',
      joinedAt: new Date().toISOString(),
    };

    const statuses = this.computeLivestockStatuses();
    const todayStr = new Date().toISOString().split('T')[0];
    let dispatchedCount = 0;

    for (const status of statuses) {
      const entry = status.entry;
      for (const proto of status.protocols) {
        if (proto.completed) continue;
        const isDue = proto.reminderStatus === 'DUE_TODAY';
        if (!isDue) continue;

        // Check if an audit broadcast was already dispatched today for this protocol milestone
        const alreadyDispatched = (this.state.auditNotifications || []).some(
          (a) =>
            a.referenceEntityId === entry.id &&
            a.title?.includes(`Day ${proto.dayTarget}`) &&
            a.timestamp?.startsWith(todayStr)
        );

        if (!alreadyDispatched) {
          this.dispatchLivestockMilestoneBroadcast({
            livestockId: entry.id,
            dayTarget: proto.dayTarget,
            milestoneTitle: proto.title,
            customNote: proto.description || `Morning protocol notification reaching all organization members.`,
            actor: defaultActor,
          });

          void dispatchSystemNotification({
            title: `🔔 Morning Protocol: ${entry.nameOrTag} (Day ${proto.dayTarget})`,
            body: `${proto.title} is scheduled today for ${entry.locationName}. All organization members have been notified.`,
            urgent: false,
            severity: 'MILESTONE',
          });

          dispatchedCount++;
        }
      }
    }

    return dispatchedCount;
  }
}

export const dataService = new AgroDataService();
