import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const rulesContent = fs.readFileSync(rulesPath, 'utf8');

const [host, portRaw] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const port = Number(portRaw || 8080);

let testEnv: RulesTestEnvironment;

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'agro-planner-rules-test',
    firestore: {
      rules: rulesContent,
      host,
      port,
    },
  });
});

test.after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

test.beforeEach(async () => {
  await testEnv.clearFirestore();
});

async function seedOrgAndMockData() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.collection('organizations').doc('org-agro-1').set({
      id: 'org-agro-1',
      name: 'Agro Seed Farm',
      type: 'AGRO_FARMING',
      adminMemberId: 'uid-admin-a',
      adminEmail: 'admin.a@farm.org',
    });
    await db.collection('organizations').doc('org-venture-2').set({
      id: 'org-venture-2',
      name: 'Other Venture',
      type: 'GENERAL_VENTURE',
      adminMemberId: 'uid-admin-b',
      adminEmail: 'admin.b@shop.org',
    });
    await db.collection('members').doc('uid-admin-a').set({
      id: 'uid-admin-a',
      uid: 'uid-admin-a',
      orgId: 'org-agro-1',
      email: 'admin.a@farm.org',
      role: 'ORG_ADMIN',
      approvalStatus: 'APPROVED',
      active: true,
    });
    await db.collection('members').doc('uid-admin-b').set({
      id: 'uid-admin-b',
      uid: 'uid-admin-b',
      orgId: 'org-venture-2',
      email: 'admin.b@shop.org',
      role: 'ORG_ADMIN',
      approvalStatus: 'APPROVED',
      active: true,
    });
    await db.collection('members').doc('uid-member-a').set({
      id: 'uid-member-a',
      uid: 'uid-member-a',
      orgId: 'org-agro-1',
      email: 'member.a@farm.org',
      role: 'MEMBER',
      approvalStatus: 'APPROVED',
      active: true,
    });
    await db.collection('members').doc('mem-mock-treasurer').set({
      id: 'mem-mock-treasurer',
      orgId: 'org-agro-1',
      fullName: 'Mock Treasurer',
      phoneOrEmail: '',
      role: 'TREASURER',
      approvalStatus: 'APPROVED',
      isPlaceholder: true,
      accountStatus: 'UNCLAIMED',
      claimCodeHash: 'tokenhash_treasurer_01',
      active: true,
    });
    await db.collection('claim_tokens').doc('tokenhash_treasurer_01').set({
      id: 'tokenhash_treasurer_01',
      orgId: 'org-agro-1',
      placeholderMemberId: 'mem-mock-treasurer',
      role: 'TREASURER',
      status: 'OPEN',
    });
    await db.collection('organizations').doc('org-agro-1').collection('claim_codes').doc('mem-mock-treasurer').set({
      id: 'mem-mock-treasurer',
      orgId: 'org-agro-1',
      placeholderMemberId: 'mem-mock-treasurer',
      claimCode: 'CLM-TEST2345',
      claimCodeHash: 'tokenhash_treasurer_01',
    });
    await db.collection('capital_contributions').doc('cap-mock-01').set({
      id: 'cap-mock-01',
      orgId: 'org-agro-1',
      memberId: 'mem-mock-treasurer',
      amount: 750,
      direction: 'INITIAL',
      note: 'Historical mock contribution',
      createdAt: '2026-01-01T00:00:00Z',
      auditHash: 'hash_cap_1',
    });
    await db.collection('runway_pledges').doc('plg-mock-01').set({
      id: 'plg-mock-01',
      orgId: 'org-agro-1',
      planId: 'pln-1',
      memberId: 'mem-mock-treasurer',
      amount: 1200,
      status: 'ACTIVE',
    });
    await db.collection('runway_pledges').doc('plg-other-02').set({
      id: 'plg-other-02',
      orgId: 'org-agro-1',
      planId: 'pln-1',
      memberId: 'mem-someone-else',
      amount: 900,
      status: 'ACTIVE',
    });
  });
}

test('CEL-01: /organizations/{orgId}/claim_codes readable/writable ONLY by verified same-org Admin', async () => {
  await seedOrgAndMockData();

  const adminA = testEnv.authenticatedContext('uid-admin-a', { email: 'admin.a@farm.org' }).firestore();
  const memberA = testEnv.authenticatedContext('uid-member-a', { email: 'member.a@farm.org' }).firestore();
  const adminB = testEnv.authenticatedContext('uid-admin-b', { email: 'admin.b@shop.org' }).firestore();

  const vaultRef = (db: any) =>
    db.collection('organizations').doc('org-agro-1').collection('claim_codes').doc('mem-mock-treasurer');

  await assertSucceeds(vaultRef(adminA).get());
  await assertFails(vaultRef(memberA).get());
  await assertFails(vaultRef(adminB).get());
  await assertFails(
    vaultRef(adminB).set({
      id: 'mem-mock-treasurer',
      orgId: 'org-agro-1',
      claimCode: 'HIJACK',
    })
  );
});

test('CEL-02: /claim_tokens denies list enumeration, enforces atomic getAfter() batch claim, blocks escalation & replay', async () => {
  await seedOrgAndMockData();

  const newcomerCtx = testEnv.authenticatedContext('uid-newcomer-01', { email: 'newcomer@farm.org' });
  const newcomerDb = newcomerCtx.firestore();

  // Enumeration query (list) is denied
  await assertFails(newcomerDb.collection('claim_tokens').get());

  // Direct single-get works
  const tokSnap = await assertSucceeds(newcomerDb.collection('claim_tokens').doc('tokenhash_treasurer_01').get());
  assert.equal(tokSnap.exists, true);

  // Role escalation attempt inside batch (token.role = TREASURER, claimant tries ORG_ADMIN) -> FAILS
  const badBatch = newcomerDb.batch();
  badBatch.update(newcomerDb.collection('claim_tokens').doc('tokenhash_treasurer_01'), {
    status: 'CLAIMED',
    claimedByUid: 'uid-newcomer-01',
  });
  badBatch.update(newcomerDb.collection('members').doc('mem-mock-treasurer'), {
    accountStatus: 'CLAIMED',
    claimedByUid: 'uid-newcomer-01',
    claimedByMemberId: 'uid-newcomer-01',
    active: false,
  });
  badBatch.set(newcomerDb.collection('members').doc('uid-newcomer-01'), {
    id: 'uid-newcomer-01',
    uid: 'uid-newcomer-01',
    orgId: 'org-agro-1',
    role: 'ORG_ADMIN',
    approvalStatus: 'APPROVED',
    active: true,
    linkedMemberIds: ['mem-mock-treasurer'],
    redeemedClaimTokenHash: 'tokenhash_treasurer_01',
  });
  await assertFails(badBatch.commit());

  // Valid atomic 3-doc batch inheriting TREASURER role -> SUCCEEDS
  const goodBatch = newcomerDb.batch();
  goodBatch.update(newcomerDb.collection('claim_tokens').doc('tokenhash_treasurer_01'), {
    status: 'CLAIMED',
    claimedByUid: 'uid-newcomer-01',
  });
  goodBatch.update(newcomerDb.collection('members').doc('mem-mock-treasurer'), {
    accountStatus: 'CLAIMED',
    claimedByUid: 'uid-newcomer-01',
    claimedByMemberId: 'uid-newcomer-01',
    active: false,
  });
  goodBatch.set(newcomerDb.collection('members').doc('uid-newcomer-01'), {
    id: 'uid-newcomer-01',
    uid: 'uid-newcomer-01',
    orgId: 'org-agro-1',
    role: 'TREASURER',
    approvalStatus: 'APPROVED',
    active: true,
    linkedMemberIds: ['mem-mock-treasurer'],
    redeemedClaimTokenHash: 'tokenhash_treasurer_01',
  });
  await assertSucceeds(goodBatch.commit());

  // Replay attack by second newcomer -> FAILS
  const secondDb = testEnv.authenticatedContext('uid-second-02', { email: 'second@farm.org' }).firestore();
  const replayBatch = secondDb.batch();
  replayBatch.update(secondDb.collection('claim_tokens').doc('tokenhash_treasurer_01'), {
    status: 'CLAIMED',
    claimedByUid: 'uid-second-02',
  });
  replayBatch.update(secondDb.collection('members').doc('mem-mock-treasurer'), {
    accountStatus: 'CLAIMED',
    claimedByUid: 'uid-second-02',
    active: false,
  });
  await assertFails(replayBatch.commit());

  // Claimer CAN migrate their newly linked mock Runway pledge onto uid-newcomer-01, CANNOT hijack unlinked pledge
  await assertSucceeds(
    newcomerDb.collection('runway_pledges').doc('plg-mock-01').update({
      memberId: 'uid-newcomer-01',
    })
  );
  await assertFails(
    newcomerDb.collection('runway_pledges').doc('plg-other-02').update({
      memberId: 'uid-newcomer-01',
    })
  );
});

test('CEL-03: /member_claim_requests & /capital_contributions immutability enforcement', async () => {
  await seedOrgAndMockData();

  const adminA = testEnv.authenticatedContext('uid-admin-a', { email: 'admin.a@farm.org' }).firestore();
  const memberA = testEnv.authenticatedContext('uid-member-a', { email: 'member.a@farm.org' }).firestore();
  const adminB = testEnv.authenticatedContext('uid-admin-b', { email: 'admin.b@shop.org' }).firestore();

  // Member creates PENDING claim request
  await assertSucceeds(
    memberA.collection('member_claim_requests').doc('creq-01').set({
      id: 'creq-01',
      orgId: 'org-agro-1',
      placeholderMemberId: 'mem-mock-treasurer',
      placeholderName: 'Mock Treasurer',
      requesterUid: 'uid-member-a',
      status: 'PENDING',
    })
  );

  // Member CANNOT self-approve
  await assertFails(
    memberA.collection('member_claim_requests').doc('creq-01').update({
      status: 'APPROVED',
    })
  );

  // Cross-org Admin B CANNOT approve
  await assertFails(
    adminB.collection('member_claim_requests').doc('creq-01').update({
      status: 'APPROVED',
    })
  );

  // Same-org Admin A CAN approve
  await assertSucceeds(
    adminA.collection('member_claim_requests').doc('creq-01').update({
      status: 'APPROVED',
      resolvedByUid: 'uid-admin-a',
    })
  );

  // capital_contributions update stays strictly forbidden even for Admin
  await assertFails(
    adminA.collection('capital_contributions').doc('cap-mock-01').update({
      memberId: 'uid-member-a',
    })
  );
});

