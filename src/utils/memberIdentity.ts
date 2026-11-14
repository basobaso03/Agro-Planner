import type { OrgMember } from '../types/agro.ts';
import { sha256Hex } from './cryptoHash.ts';

const CLAIM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Generates an unambiguous uppercase alphanumeric random token using Web Crypto when available.
 */
export function randomSafeAlphanumeric(length: number): string {
  const bytes = new Uint8Array(length);
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CLAIM_ALPHABET[bytes[i] % CLAIM_ALPHABET.length];
  }
  return out;
}

/**
 * Generates a human-friendly per-member claim code (e.g. "CLM-7X9K2P4M").
 */
export function generateRandomClaimCode(): string {
  return `CLM-${randomSafeAlphanumeric(8)}`;
}

/**
 * Generates collision-safe unique IDs even when creating multiple records in the same millisecond.
 */
export function generateUniqueMemberId(prefix = 'mem'): string {
  return `${prefix}-${Date.now().toString(36)}-${randomSafeAlphanumeric(4).toLowerCase()}`;
}

/**
 * Normalizes a claim code string so hyphens/whitespace/case differences still verify reliably.
 */
export function normalizeClaimCode(raw: string): string {
  const compact = (raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (compact.startsWith('CLM') && compact.length > 3) {
    return `CLM-${compact.slice(3)}`;
  }
  return compact ? `CLM-${compact}` : '';
}

/**
 * Computes the deterministic SHA-256 document ID for `/claim_tokens/{hash}` inside a specific org.
 */
export function computeClaimTokenId(orgId: string, claimCode: string): string {
  const cleanOrg = (orgId || '').trim();
  const normalizedCode = normalizeClaimCode(claimCode);
  return sha256Hex(`${cleanOrg}:${normalizedCode}`);
}

/**
 * True only when the string represents a real email address (guards against mock placeholder strings).
 */
export function isValidRealEmail(contact?: string | null): boolean {
  const trimmed = (contact || '').trim().toLowerCase();
  if (!trimmed || !trimmed.includes('@')) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

/**
 * Returns every member identifier associated with this person (current id, Firebase Auth uid, and claimed placeholder aliases).
 */
export function getMemberMatchIds(
  member?: Pick<OrgMember, 'id' | 'uid' | 'linkedMemberIds'> | null
): Set<string> {
  const ids = new Set<string>();
  if (!member) return ids;
  if (member.id) ids.add(member.id);
  if (member.uid) ids.add(member.uid);
  if (Array.isArray(member.linkedMemberIds)) {
    for (const alias of member.linkedMemberIds) {
      if (alias && typeof alias === 'string') {
        ids.add(alias);
      }
    }
  }
  return ids;
}

/**
 * Checks whether a ledger `memberId` belongs to the given OrgMember (including historical claimed placeholder IDs).
 */
export function matchesMemberRecord(
  memberId: string | undefined | null,
  member?: Pick<OrgMember, 'id' | 'uid' | 'linkedMemberIds'> | null
): boolean {
  if (!memberId || !member) return false;
  return getMemberMatchIds(member).has(memberId);
}

/**
 * True when a member record represents an admin-created account that has not yet been claimed by a registered user.
 */
export function isUnclaimedPlaceholder(
  member?: Pick<OrgMember, 'isPlaceholder' | 'accountStatus' | 'uid' | 'claimedByUid'> | null
): boolean {
  if (!member) return false;
  if (member.accountStatus === 'CLAIMED') return false;
  if (member.accountStatus === 'UNCLAIMED' || member.accountStatus === 'CLAIM_PENDING') return true;
  return Boolean(member.isPlaceholder && !member.claimedByUid && !member.uid);
}

/**
 * True when a placeholder record has already been merged into a real authenticated user's profile.
 */
export function isClaimedTombstone(
  member?: Pick<OrgMember, 'accountStatus' | 'claimedByMemberId' | 'claimedByUid'> | null
): boolean {
  if (!member) return false;
  return member.accountStatus === 'CLAIMED';
}

/**
 * Filters org members for display & equity calculations:
 * - Scopes to `orgId` when supplied
 * - Hides claimed placeholder tombstones once their claiming active member record is present in the list
 *   (falling back safely if partial cloud sync hasn't delivered the updated active profile yet).
 */
export function filterVisibleOrgMembers(members: OrgMember[], orgId?: string): OrgMember[] {
  const orgScoped = orgId ? members.filter((m) => !m.orgId || m.orgId === orgId) : members;

  const activeLinkedIds = new Set<string>();
  const activePrimaryIds = new Set<string>();

  for (const m of orgScoped) {
    if (m.accountStatus !== 'CLAIMED') {
      activePrimaryIds.add(m.id);
      if (m.uid) activePrimaryIds.add(m.uid);
      if (Array.isArray(m.linkedMemberIds)) {
        for (const id of m.linkedMemberIds) {
          activeLinkedIds.add(id);
        }
      }
    }
  }

  return orgScoped.filter((m) => {
    if (m.accountStatus !== 'CLAIMED') return true;
    // Hide the claimed tombstone if an active member absorbs its ID or UID reference
    const absorbedByLinked = activeLinkedIds.has(m.id);
    const absorbedByClaimer = Boolean(
      (m.claimedByMemberId && activePrimaryIds.has(m.claimedByMemberId)) ||
      (m.claimedByUid && activePrimaryIds.has(m.claimedByUid))
    );
    return !(absorbedByLinked || absorbedByClaimer);
  });
}

/**
 * Computes fuzzy name similarity score (0..1) for suggesting likely registered-account matches in Admin Link UI.
 */
export function computeNameSimilarity(a: string, b: string): number {
  const norm = (s: string) =>
    (s || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  const tokensA = new Set(norm(a));
  const tokensB = new Set(norm(b));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let overlap = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap++;
  }
  return overlap / Math.max(tokensA.size, tokensB.size);
}

