import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeClaimTokenId,
  computeNameSimilarity,
  filterVisibleOrgMembers,
  generateRandomClaimCode,
  generateUniqueMemberId,
  getMemberMatchIds,
  isClaimedTombstone,
  isUnclaimedPlaceholder,
  isValidRealEmail,
  matchesMemberRecord,
  normalizeClaimCode,
} from './memberIdentity.ts';
import type { OrgMember } from '../types/agro.ts';

test('generateRandomClaimCode and normalizeClaimCode produce canonical unambiguous CLM tokens', () => {
  const code = generateRandomClaimCode();
  assert.match(code, /^CLM-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
  assert.equal(normalizeClaimCode(' clm 7x9k 2p4m '), 'CLM-7X9K2P4M');
  assert.equal(normalizeClaimCode('7x9k2p4m'), 'CLM-7X9K2P4M');
  assert.equal(normalizeClaimCode('   '), '');
});

test('generateUniqueMemberId produces collision-free IDs inside a synchronous batch loop', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 50; i++) {
    seen.add(generateUniqueMemberId('mem-mock'));
  }
  assert.equal(seen.size, 50);
});

test('computeClaimTokenId produces deterministic org-scoped SHA-256 lookup hashes', () => {
  const h1 = computeClaimTokenId('org-agro-1', 'clm-7x9k-2p4m');
  const h2 = computeClaimTokenId('org-agro-1', 'CLM7X9K2P4M');
  const hOtherOrg = computeClaimTokenId('org-venture-2', 'CLM-7X9K2P4M');

  assert.equal(h1.length, 64);
  assert.equal(h1, h2);
  assert.notEqual(h1, hOtherOrg);
});

test('isValidRealEmail distinguishes genuine email addresses from blank or mock placeholder strings', () => {
  assert.equal(isValidRealEmail('investor@example.com'), true);
  assert.equal(isValidRealEmail('  USER+tag@domain.co.zw '), true);
  assert.equal(isValidRealEmail(''), false);
  assert.equal(isValidRealEmail('unregistered'), false);
  assert.equal(isValidRealEmail('+263771234567'), false);
  assert.equal(isValidRealEmail(undefined), false);
});

test('getMemberMatchIds and matchesMemberRecord unify primary id, Firebase uid, and linked placeholder aliases', () => {
  const claimedMember: OrgMember = {
    id: 'uid-real-01',
    uid: 'uid-real-01',
    orgId: 'org-1',
    fullName: 'Tariro Moyo',
    phoneOrEmail: 'tariro@example.com',
    role: 'MEMBER',
    approvalStatus: 'APPROVED',
    accountStatus: 'ACTIVE',
    linkedMemberIds: ['mem-mock-t1', 'mem-mock-t2'],
    joinedAt: '2026-01-01T00:00:00Z',
    active: true,
  };

  const ids = getMemberMatchIds(claimedMember);
  assert.equal(ids.has('uid-real-01'), true);
  assert.equal(ids.has('mem-mock-t1'), true);
  assert.equal(ids.has('mem-mock-t2'), true);

  assert.equal(matchesMemberRecord('mem-mock-t1', claimedMember), true);
  assert.equal(matchesMemberRecord('mem-mock-t2', claimedMember), true);
  assert.equal(matchesMemberRecord('uid-real-01', claimedMember), true);
  assert.equal(matchesMemberRecord('unrelated-id', claimedMember), false);
});

test('isUnclaimedPlaceholder and filterVisibleOrgMembers hide claimed tombstones once absorbed without dropping partial sync fallback', () => {
  const unclaimed: OrgMember = {
    id: 'mem-mock-1',
    orgId: 'org-1',
    fullName: 'Mock Contributor A',
    phoneOrEmail: '',
    role: 'MEMBER',
    approvalStatus: 'APPROVED',
    isPlaceholder: true,
    accountStatus: 'UNCLAIMED',
    joinedAt: '2026-01-01T00:00:00Z',
    active: true,
  };

  const claimedTombstone: OrgMember = {
    id: 'mem-mock-2',
    orgId: 'org-1',
    fullName: 'Mock Contributor B',
    phoneOrEmail: '',
    role: 'MEMBER',
    approvalStatus: 'APPROVED',
    isPlaceholder: true,
    accountStatus: 'CLAIMED',
    claimedByUid: 'uid-real-b',
    claimedByMemberId: 'uid-real-b',
    joinedAt: '2026-01-01T00:00:00Z',
    active: false,
  };

  const realClaimer: OrgMember = {
    id: 'uid-real-b',
    uid: 'uid-real-b',
    orgId: 'org-1',
    fullName: 'Contributor B Real',
    phoneOrEmail: 'b@example.com',
    role: 'MEMBER',
    approvalStatus: 'APPROVED',
    isPlaceholder: false,
    accountStatus: 'ACTIVE',
    linkedMemberIds: ['mem-mock-2'],
    joinedAt: '2026-02-01T00:00:00Z',
    active: true,
  };

  const otherOrgMember: OrgMember = {
    id: 'uid-other',
    orgId: 'org-2',
    fullName: 'Other Tenant',
    phoneOrEmail: 'o@example.com',
    role: 'ORG_ADMIN',
    approvalStatus: 'APPROVED',
    joinedAt: '2026-01-01T00:00:00Z',
    active: true,
  };

  assert.equal(isUnclaimedPlaceholder(unclaimed), true);
  assert.equal(isUnclaimedPlaceholder(claimedTombstone), false);
  assert.equal(isUnclaimedPlaceholder(realClaimer), false);
  assert.equal(isClaimedTombstone(claimedTombstone), true);

  // When claiming real user is present, tombstone is filtered out cleanly
  const visibleMerged = filterVisibleOrgMembers(
    [unclaimed, claimedTombstone, realClaimer, otherOrgMember],
    'org-1'
  );
  assert.deepEqual(
    visibleMerged.map((m) => m.id),
    ['mem-mock-1', 'uid-real-b']
  );

  // Fallback during partial cloud sync: tombstone remains visible if active claimer doc isn't synced yet
  const visiblePartialSync = filterVisibleOrgMembers([unclaimed, claimedTombstone], 'org-1');
  assert.deepEqual(
    visiblePartialSync.map((m) => m.id),
    ['mem-mock-1', 'mem-mock-2']
  );
});

test('computeNameSimilarity ranks matching and swapped name tokens intuitively', () => {
  assert.equal(computeNameSimilarity('Rudo Chikwanda', 'Rudo Chikwanda'), 1);
  assert.equal(computeNameSimilarity('Chikwanda Rudo', 'Rudo Chikwanda'), 1);
  assert.equal(computeNameSimilarity('Rudo Chikwanda', 'Rudo Moyo'), 0.5);
  assert.equal(computeNameSimilarity('Rudo Chikwanda', 'John Doe'), 0);
});

