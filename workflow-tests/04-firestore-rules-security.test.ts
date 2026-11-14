import test from 'node:test';
import assert from 'node:assert/strict';
import { RulesEngineSimulator } from './helpers/rulesEngineSimulator.ts';
import { TEST_ACCOUNTS } from './helpers/testContext.ts';

const simulator = new RulesEngineSimulator();

// Populate members database for rule checks
simulator.registerMember(TEST_ACCOUNTS.agroAdmin.uid, {
  role: TEST_ACCOUNTS.agroAdmin.role,
  approvalStatus: TEST_ACCOUNTS.agroAdmin.approvalStatus,
  active: TEST_ACCOUNTS.agroAdmin.active,
  email: TEST_ACCOUNTS.agroAdmin.email,
  orgId: TEST_ACCOUNTS.agroAdmin.orgId,
});

simulator.registerMember(TEST_ACCOUNTS.agroTreasurer.uid, {
  role: TEST_ACCOUNTS.agroTreasurer.role,
  approvalStatus: TEST_ACCOUNTS.agroTreasurer.approvalStatus,
  active: TEST_ACCOUNTS.agroTreasurer.active,
  email: TEST_ACCOUNTS.agroTreasurer.email,
  orgId: TEST_ACCOUNTS.agroTreasurer.orgId,
});

simulator.registerMember(TEST_ACCOUNTS.agroOperator.uid, {
  role: TEST_ACCOUNTS.agroOperator.role,
  approvalStatus: TEST_ACCOUNTS.agroOperator.approvalStatus,
  active: TEST_ACCOUNTS.agroOperator.active,
  email: TEST_ACCOUNTS.agroOperator.email,
  orgId: TEST_ACCOUNTS.agroOperator.orgId,
});

simulator.registerMember(TEST_ACCOUNTS.agroMember.uid, {
  role: TEST_ACCOUNTS.agroMember.role,
  approvalStatus: TEST_ACCOUNTS.agroMember.approvalStatus,
  active: TEST_ACCOUNTS.agroMember.active,
  email: TEST_ACCOUNTS.agroMember.email,
  orgId: TEST_ACCOUNTS.agroMember.orgId,
});

simulator.registerMember(TEST_ACCOUNTS.ventureAdmin.uid, {
  role: TEST_ACCOUNTS.ventureAdmin.role,
  approvalStatus: TEST_ACCOUNTS.ventureAdmin.approvalStatus,
  active: TEST_ACCOUNTS.ventureAdmin.active,
  email: TEST_ACCOUNTS.ventureAdmin.email,
  orgId: TEST_ACCOUNTS.ventureAdmin.orgId,
});

simulator.registerMember(TEST_ACCOUNTS.ventureTreasurer.uid, {
  role: TEST_ACCOUNTS.ventureTreasurer.role,
  approvalStatus: TEST_ACCOUNTS.ventureTreasurer.approvalStatus,
  active: TEST_ACCOUNTS.ventureTreasurer.active,
  email: TEST_ACCOUNTS.ventureTreasurer.email,
  orgId: TEST_ACCOUNTS.ventureTreasurer.orgId,
});

simulator.registerMember(TEST_ACCOUNTS.marlvinPersonal.uid, {
  role: TEST_ACCOUNTS.marlvinPersonal.role,
  approvalStatus: TEST_ACCOUNTS.marlvinPersonal.approvalStatus,
  active: TEST_ACCOUNTS.marlvinPersonal.active,
  email: TEST_ACCOUNTS.marlvinPersonal.email,
  orgId: TEST_ACCOUNTS.marlvinPersonal.orgId,
});

simulator.registerMember(TEST_ACCOUNTS.intruder.uid, {
  role: TEST_ACCOUNTS.intruder.role,
  approvalStatus: TEST_ACCOUNTS.intruder.approvalStatus,
  active: TEST_ACCOUNTS.intruder.active,
  email: TEST_ACCOUNTS.intruder.email,
  orgId: TEST_ACCOUNTS.intruder.orgId,
});

// 1. ORGANIZATIONS COLLECTION
test('RULE-01: /organizations/{orgId} — Read, Create, Update, Delete access controls', () => {
  const adminAuth = { uid: TEST_ACCOUNTS.agroAdmin.uid, email: TEST_ACCOUNTS.agroAdmin.email };
  const memberAuth = { uid: TEST_ACCOUNTS.agroMember.uid, email: TEST_ACCOUNTS.agroMember.email };
  const unauth = null;

  // Unauthenticated cannot read or write
  assert.equal(
    simulator.evaluate({
      collection: 'organizations',
      docId: 'org-test',
      operation: 'read',
      auth: unauth,
    }).allowed,
    false
  );

  // Authenticated can read
  assert.equal(
    simulator.evaluate({
      collection: 'organizations',
      docId: 'org-test',
      operation: 'read',
      auth: memberAuth,
    }).allowed,
    true
  );

  // Authenticated can create with valid ID
  assert.equal(
    simulator.evaluate({
      collection: 'organizations',
      docId: 'org-valid-123',
      operation: 'create',
      auth: memberAuth,
      incomingData: { name: 'My Org' },
    }).allowed,
    true
  );

  // Invalid org ID (contains spaces or forbidden characters) -> DENIED
  assert.equal(
    simulator.evaluate({
      collection: 'organizations',
      docId: 'org invalid with spaces',
      operation: 'create',
      auth: memberAuth,
      incomingData: { name: 'My Org' },
    }).allowed,
    false
  );

  // Update: Admin can update
  assert.equal(
    simulator.evaluate({
      collection: 'organizations',
      docId: 'org-valid-123',
      operation: 'update',
      auth: adminAuth,
      incomingData: { name: 'Updated Org' },
    }).allowed,
    true
  );

  // Update: Non-admin member cannot update
  assert.equal(
    simulator.evaluate({
      collection: 'organizations',
      docId: 'org-valid-123',
      operation: 'update',
      auth: memberAuth,
      incomingData: { name: 'Hacked Org' },
    }).allowed,
    false
  );

  // Delete: Admin can delete; Member cannot
  assert.equal(
    simulator.evaluate({
      collection: 'organizations',
      docId: 'org-valid-123',
      operation: 'delete',
      auth: adminAuth,
    }).allowed,
    true
  );
  assert.equal(
    simulator.evaluate({
      collection: 'organizations',
      docId: 'org-valid-123',
      operation: 'delete',
      auth: memberAuth,
    }).allowed,
    false
  );
});

// 2. INVITATION CODES COLLECTION
test('RULE-02: /invite_codes/{code} — Lookup allowed, Delete restricted to Org Admin', () => {
  const memberAuth = { uid: TEST_ACCOUNTS.agroMember.uid, email: TEST_ACCOUNTS.agroMember.email };
  const adminAuth = { uid: TEST_ACCOUNTS.agroAdmin.uid, email: TEST_ACCOUNTS.agroAdmin.email };
  const unauth = null;

  // Single-document lookup allowed for authenticated candidate
  assert.equal(
    simulator.evaluate({
      collection: 'invite_codes',
      docId: 'SEED-9421',
      operation: 'read',
      auth: memberAuth,
    }).allowed,
    true
  );

  // Unauthenticated cannot read invite codes
  assert.equal(
    simulator.evaluate({
      collection: 'invite_codes',
      docId: 'SEED-9421',
      operation: 'read',
      auth: unauth,
    }).allowed,
    false
  );

  // Delete restricted to Admin
  assert.equal(
    simulator.evaluate({
      collection: 'invite_codes',
      docId: 'SEED-9421',
      operation: 'delete',
      auth: adminAuth,
    }).allowed,
    true
  );
  assert.equal(
    simulator.evaluate({
      collection: 'invite_codes',
      docId: 'SEED-9421',
      operation: 'delete',
      auth: memberAuth,
    }).allowed,
    false
  );
});

// 3. LOCATIONS COLLECTION
test('RULE-03: /locations/{locationId} — Only Admin can add, edit, or delete farm sites', () => {
  const adminAuth = { uid: TEST_ACCOUNTS.agroAdmin.uid, email: TEST_ACCOUNTS.agroAdmin.email };
  const memberAuth = { uid: TEST_ACCOUNTS.agroMember.uid, email: TEST_ACCOUNTS.agroMember.email };
  const operatorAuth = { uid: TEST_ACCOUNTS.agroOperator.uid, email: TEST_ACCOUNTS.agroOperator.email };

  // Admin can create location
  assert.equal(
    simulator.evaluate({
      collection: 'locations',
      docId: 'loc-norton-a',
      operation: 'create',
      auth: adminAuth,
      incomingData: { name: 'Site A' },
    }).allowed,
    true
  );

  // Member cannot create, edit, or delete location
  assert.equal(
    simulator.evaluate({
      collection: 'locations',
      docId: 'loc-norton-a',
      operation: 'create',
      auth: memberAuth,
      incomingData: { name: 'Site A' },
    }).allowed,
    false
  );
  assert.equal(
    simulator.evaluate({
      collection: 'locations',
      docId: 'loc-norton-a',
      operation: 'update',
      auth: memberAuth,
      incomingData: { name: 'Site A Modified' },
    }).allowed,
    false
  );
  assert.equal(
    simulator.evaluate({
      collection: 'locations',
      docId: 'loc-norton-a',
      operation: 'delete',
      auth: memberAuth,
    }).allowed,
    false
  );

  // Ground Operator cannot edit or delete location
  assert.equal(
    simulator.evaluate({
      collection: 'locations',
      docId: 'loc-norton-a',
      operation: 'delete',
      auth: operatorAuth,
    }).allowed,
    false
  );
});

// 4. MEMBERS COLLECTION & ROLE ESCALATION PREVENTION
test('RULE-04: /members/{memberId} — Prevents self role-escalation and approval tampering', () => {
  const memberUid = TEST_ACCOUNTS.agroMember.uid;
  const memberAuth = { uid: memberUid, email: TEST_ACCOUNTS.agroMember.email };
  const adminAuth = { uid: TEST_ACCOUNTS.agroAdmin.uid, email: TEST_ACCOUNTS.agroAdmin.email };

  const existingProfile = {
    id: memberUid,
    fullName: 'Tafadzwa Rushwaya',
    role: 'MEMBER',
    approvalStatus: 'APPROVED',
    active: true,
    bio: 'Initial Bio',
  };

  // Self update of non-restricted field (bio, name) -> ALLOWED
  assert.equal(
    simulator.evaluate({
      collection: 'members',
      docId: memberUid,
      operation: 'update',
      auth: memberAuth,
      existingData: existingProfile,
      incomingData: { ...existingProfile, bio: 'Updated Investor Bio' },
    }).allowed,
    true
  );

  // Self role-escalation: Member tries to change own role to 'ORG_ADMIN' -> STRICTLY DENIED!
  assert.equal(
    simulator.evaluate({
      collection: 'members',
      docId: memberUid,
      operation: 'update',
      auth: memberAuth,
      existingData: existingProfile,
      incomingData: { ...existingProfile, role: 'ORG_ADMIN' },
    }).allowed,
    false
  );

  // Admin updating member role -> ALLOWED
  assert.equal(
    simulator.evaluate({
      collection: 'members',
      docId: memberUid,
      operation: 'update',
      auth: adminAuth,
      existingData: existingProfile,
      incomingData: { ...existingProfile, role: 'TREASURER' },
    }).allowed,
    true
  );
});

// 5. CAPITAL CONTRIBUTIONS (APPEND ONLY & ROLE GUARDS)
test('RULE-05: /capital_contributions/{entryId} — Strict append-only and Ground Operator read isolation', () => {
  const treasurerAuth = { uid: TEST_ACCOUNTS.agroTreasurer.uid, email: TEST_ACCOUNTS.agroTreasurer.email };
  const memberAuth = { uid: TEST_ACCOUNTS.agroMember.uid, email: TEST_ACCOUNTS.agroMember.email };
  const operatorAuth = { uid: TEST_ACCOUNTS.agroOperator.uid, email: TEST_ACCOUNTS.agroOperator.email };
  const adminAuth = { uid: TEST_ACCOUNTS.agroAdmin.uid, email: TEST_ACCOUNTS.agroAdmin.email };

  const validCapitalData = {
    orgId: TEST_ACCOUNTS.agroAdmin.orgId,
    memberId: TEST_ACCOUNTS.agroMember.id,
    amount: 1500,
    direction: 'INITIAL',
    note: 'Initial capital investment tranche',
    createdAt: new Date().toISOString(),
    auditHash: 'valid-sha256-hash-capital-contribution',
  };

  // 1. Read: Approved Member of same org can read
  assert.equal(
    simulator.evaluate({
      collection: 'capital_contributions',
      docId: 'TX-CAP-001',
      operation: 'read',
      auth: memberAuth,
      existingData: validCapitalData,
    }).allowed,
    true
  );

  // 2. Read: Ground Operator is STRICTLY DENIED from reading capital contributions (Rule line 106)
  assert.equal(
    simulator.evaluate({
      collection: 'capital_contributions',
      docId: 'TX-CAP-001',
      operation: 'read',
      auth: operatorAuth,
      existingData: validCapitalData,
    }).allowed,
    false
  );

  // 2b. ZERO SUPER-ADMIN MONEY BACKDOOR & CROSS-TENANT ISOLATION:
  // Even founder Marlvin (in his own org) CANNOT read Sarah's Venture Org capital contributions!
  const ventureCapitalData = {
    orgId: 'org-venture-prod-02',
    memberId: TEST_ACCOUNTS.ventureMember.id,
    amount: 3000,
    direction: 'INITIAL',
    note: 'Commercial fleet pool deposit',
    createdAt: new Date().toISOString(),
    auditHash: 'valid-sha256-hash-venture-contribution',
  };
  const marlvinAuth = { uid: TEST_ACCOUNTS.marlvinPersonal.uid, email: TEST_ACCOUNTS.marlvinPersonal.email };

  assert.equal(
    simulator.evaluate({
      collection: 'capital_contributions',
      docId: 'TX-CAP-VNT-01',
      operation: 'read',
      auth: marlvinAuth,
      existingData: ventureCapitalData,
    }).allowed,
    false,
    'Marlvin must be strictly blocked from viewing other organization money'
  );

  // Cross-tenant: Venture Treasurer cannot read Agro Org capital contributions
  const ventureTreasurerAuth = { uid: TEST_ACCOUNTS.ventureTreasurer.uid, email: TEST_ACCOUNTS.ventureTreasurer.email };
  assert.equal(
    simulator.evaluate({
      collection: 'capital_contributions',
      docId: 'TX-CAP-001',
      operation: 'read',
      auth: ventureTreasurerAuth,
      existingData: validCapitalData,
    }).allowed,
    false,
    'Cross-tenant treasurer must be strictly blocked from viewing foreign organization money'
  );

  // 3. Create: Treasurer can create
  assert.equal(
    simulator.evaluate({
      collection: 'capital_contributions',
      docId: 'TX-CAP-001',
      operation: 'create',
      auth: treasurerAuth,
      incomingData: validCapitalData,
    }).allowed,
    true
  );

  // 4. Create: Regular Member cannot create capital contribution directly
  assert.equal(
    simulator.evaluate({
      collection: 'capital_contributions',
      docId: 'TX-CAP-002',
      operation: 'create',
      auth: memberAuth,
      incomingData: validCapitalData,
    }).allowed,
    false
  );

  // 5. UPDATE: Capital Contributions is strictly APPEND-ONLY (allow update: if false;)
  // ANY UPDATE ATTEMPT MUST BE DENIED EVEN FOR ADMIN OR TREASURER!
  assert.equal(
    simulator.evaluate({
      collection: 'capital_contributions',
      docId: 'TX-CAP-001',
      operation: 'update',
      auth: treasurerAuth,
      existingData: validCapitalData,
      incomingData: { ...validCapitalData, amount: 9999 },
    }).allowed,
    false
  );
  assert.equal(
    simulator.evaluate({
      collection: 'capital_contributions',
      docId: 'TX-CAP-001',
      operation: 'update',
      auth: adminAuth,
      existingData: validCapitalData,
      incomingData: { ...validCapitalData, amount: 9999 },
    }).allowed,
    false
  );
});

// 6. EXPENSE LEDGER (MULTI-SIG & MANDATORY AUDIT FIELDS)
test('RULE-06: /expense_ledger/{entryId} — Audit fields guard & restricted update fields', () => {
  const memberAuth = { uid: TEST_ACCOUNTS.agroMember.uid, email: TEST_ACCOUNTS.agroMember.email };
  const treasurerAuth = { uid: TEST_ACCOUNTS.agroTreasurer.uid, email: TEST_ACCOUNTS.agroTreasurer.email };

  const validExpense = {
    orgId: TEST_ACCOUNTS.agroMember.orgId,
    locationId: 'loc-norton-a',
    category: 'FEED',
    amount: 640,
    direction: 'DEDUCTION',
    note: 'Broiler starter feed delivery 20 bags',
    createdAt: new Date().toISOString(),
    auditHash: 'valid-sha256-expense-hash',
    approvalStatus: 'PENDING_MULTISIG',
    approvedByMemberIds: [],
  };

  // Valid create by approved member -> ALLOWED
  assert.equal(
    simulator.evaluate({
      collection: 'expense_ledger',
      docId: 'TX-EXP-101',
      operation: 'create',
      auth: memberAuth,
      incomingData: validExpense,
    }).allowed,
    true
  );

  // Invalid create: note too short (<4 chars) -> DENIED
  assert.equal(
    simulator.evaluate({
      collection: 'expense_ledger',
      docId: 'TX-EXP-102',
      operation: 'create',
      auth: memberAuth,
      incomingData: { ...validExpense, note: 'abc' },
    }).allowed,
    false
  );

  // Invalid create: missing auditHash -> DENIED
  const { auditHash, ...missingHash } = validExpense;
  assert.equal(
    simulator.evaluate({
      collection: 'expense_ledger',
      docId: 'TX-EXP-103',
      operation: 'create',
      auth: memberAuth,
      incomingData: missingHash,
    }).allowed,
    false
  );

  // Update: Treasurer updating ONLY approvalStatus and approvedByMemberIds -> ALLOWED
  assert.equal(
    simulator.evaluate({
      collection: 'expense_ledger',
      docId: 'TX-EXP-101',
      operation: 'update',
      auth: treasurerAuth,
      existingData: validExpense,
      incomingData: {
        ...validExpense,
        approvalStatus: 'APPROVED',
        approvedByMemberIds: [TEST_ACCOUNTS.agroTreasurer.id],
      },
    }).allowed,
    true
  );

  // Update: Tampering with expense amount during approval -> STRICTLY DENIED!
  assert.equal(
    simulator.evaluate({
      collection: 'expense_ledger',
      docId: 'TX-EXP-101',
      operation: 'update',
      auth: treasurerAuth,
      existingData: validExpense,
      incomingData: {
        ...validExpense,
        amount: 1000, // Tampered!
        approvalStatus: 'APPROVED',
        approvedByMemberIds: [TEST_ACCOUNTS.agroTreasurer.id],
      },
    }).allowed,
    false
  );
});

// 7. FIXED ASSETS, FEED & LIVESTOCK EVENTS (APPEND-ONLY VERIFICATION)
test('RULE-07: Append-Only Collections — Update is blocked across all roles', () => {
  const adminAuth = { uid: TEST_ACCOUNTS.agroAdmin.uid, email: TEST_ACCOUNTS.agroAdmin.email };
  const appendOnlyCollections = [
    'fixed_assets_ledger',
    'livestock_lifecycle_events',
    'feed_ledger',
  ];

  for (const col of appendOnlyCollections) {
    const res = simulator.evaluate({
      collection: col,
      docId: 'ENTRY-001',
      operation: 'update',
      auth: adminAuth,
      existingData: { orgId: TEST_ACCOUNTS.agroAdmin.orgId, note: 'Original note', createdAt: 'now', auditHash: 'hash' },
      incomingData: { orgId: TEST_ACCOUNTS.agroAdmin.orgId, note: 'Tampered note', createdAt: 'now', auditHash: 'hash' },
    });
    assert.equal(res.allowed, false, `Expected ${col} update to be strictly false`);
  }
});

// 8. CATCH-ALL DEFAULT DENY
test('RULE-08: Catch-All Rule — Any unlisted collection or path is strictly denied', () => {
  const adminAuth = { uid: TEST_ACCOUNTS.agroAdmin.uid, email: TEST_ACCOUNTS.agroAdmin.email };

  const unlistedCollections = ['internal_secrets', 'system_keys', 'user_passwords', 'root_config'];
  for (const col of unlistedCollections) {
    assert.equal(
      simulator.evaluate({
        collection: col,
        docId: 'secret-doc',
        operation: 'read',
        auth: adminAuth,
      }).allowed,
      false
    );
    assert.equal(
      simulator.evaluate({
        collection: col,
        docId: 'secret-doc',
        operation: 'create',
        auth: adminAuth,
        incomingData: { secret: '123' },
      }).allowed,
      false
    );
  }
});

// 9. ADMIN-ONLY CLAIM CODE VAULT (/organizations/{orgId}/claim_codes/{placeholderId})
test('RULE-09: /organizations/{orgId}/claim_codes — Strictly isolated to verified Admin of same org', () => {
  const adminAuth = { uid: TEST_ACCOUNTS.agroAdmin.uid, email: TEST_ACCOUNTS.agroAdmin.email };
  const memberAuth = { uid: TEST_ACCOUNTS.agroMember.uid, email: TEST_ACCOUNTS.agroMember.email };
  const crossOrgAdmin = { uid: TEST_ACCOUNTS.ventureAdmin.uid, email: TEST_ACCOUNTS.ventureAdmin.email };

  assert.equal(
    simulator.evaluate({
      collection: 'claim_codes',
      orgId: TEST_ACCOUNTS.agroAdmin.orgId,
      docId: 'mem-mock-01',
      operation: 'read',
      auth: adminAuth,
    }).allowed,
    true
  );

  // Regular member or cross-org Admin CANNOT read plaintext claim codes
  assert.equal(
    simulator.evaluate({
      collection: 'claim_codes',
      orgId: TEST_ACCOUNTS.agroAdmin.orgId,
      docId: 'mem-mock-01',
      operation: 'read',
      auth: memberAuth,
    }).allowed,
    false
  );
  assert.equal(
    simulator.evaluate({
      collection: 'claim_codes',
      orgId: TEST_ACCOUNTS.agroAdmin.orgId,
      docId: 'mem-mock-01',
      operation: 'create',
      auth: crossOrgAdmin,
      incomingData: { orgId: TEST_ACCOUNTS.agroAdmin.orgId, claimCode: 'CLM-STOLEN' },
    }).allowed,
    false
  );
});

// 10. CLAIM TOKENS & ATOMIC CLAIM BATCH (/claim_tokens + /members getAfter())
test('RULE-10: /claim_tokens & atomic placeholder claim prevent enumeration, replay & role escalation', () => {
  const adminAuth = { uid: TEST_ACCOUNTS.agroAdmin.uid, email: TEST_ACCOUNTS.agroAdmin.email };
  const newcomerAuth = { uid: 'uid-newcomer-claim-01', email: 'newcomer@agro.com' };
  const tokenHash = 'sha256_token_abc123';
  const orgId = TEST_ACCOUNTS.agroAdmin.orgId!;

  // Listing /claim_tokens is strictly denied to prevent offline scanning
  assert.equal(
    simulator.evaluate({
      collection: 'claim_tokens',
      docId: tokenHash,
      operation: 'list',
      auth: newcomerAuth,
    }).allowed,
    false
  );

  // Admin can mint OPEN token for their org; non-admin cannot
  const openToken = {
    id: tokenHash,
    orgId,
    placeholderMemberId: 'mem-mock-treasurer',
    role: 'TREASURER',
    status: 'OPEN',
  };
  assert.equal(
    simulator.evaluate({
      collection: 'claim_tokens',
      docId: tokenHash,
      operation: 'create',
      auth: adminAuth,
      incomingData: openToken,
    }).allowed,
    true
  );
  assert.equal(
    simulator.evaluate({
      collection: 'claim_tokens',
      docId: tokenHash,
      operation: 'create',
      auth: newcomerAuth,
      incomingData: openToken,
    }).allowed,
    false
  );

  simulator.registerClaimToken(tokenHash, openToken);

  const afterToken = {
    ...openToken,
    status: 'CLAIMED',
    claimedByUid: newcomerAuth.uid,
  };

  // Atomic batch: Claimant creating own member doc matching token.role ('TREASURER') with valid getAfter token -> ALLOWED
  assert.equal(
    simulator.evaluate({
      collection: 'members',
      docId: newcomerAuth.uid,
      operation: 'create',
      auth: newcomerAuth,
      incomingData: {
        id: newcomerAuth.uid,
        uid: newcomerAuth.uid,
        orgId,
        role: 'TREASURER',
        approvalStatus: 'APPROVED',
        active: true,
        linkedMemberIds: ['mem-mock-treasurer'],
        redeemedClaimTokenHash: tokenHash,
      },
      getAfterClaimToken: afterToken,
    }).allowed,
    true
  );

  // Role escalation attempt during claim (token says TREASURER, claimant tries ORG_ADMIN) -> DENIED!
  assert.equal(
    simulator.evaluate({
      collection: 'members',
      docId: newcomerAuth.uid,
      operation: 'create',
      auth: newcomerAuth,
      incomingData: {
        id: newcomerAuth.uid,
        uid: newcomerAuth.uid,
        orgId,
        role: 'ORG_ADMIN',
        approvalStatus: 'APPROVED',
        active: true,
        linkedMemberIds: ['mem-mock-treasurer'],
        redeemedClaimTokenHash: tokenHash,
      },
      getAfterClaimToken: afterToken,
    }).allowed,
    false
  );

  // Claimant updating UNCLAIMED placeholder -> CLAIMED tombstone atomically -> ALLOWED; Replay -> DENIED!
  const mockDoc = {
    id: 'mem-mock-treasurer',
    orgId,
    role: 'TREASURER',
    isPlaceholder: true,
    accountStatus: 'UNCLAIMED',
    claimCodeHash: tokenHash,
    active: true,
  };
  assert.equal(
    simulator.evaluate({
      collection: 'members',
      docId: mockDoc.id,
      operation: 'update',
      auth: newcomerAuth,
      existingData: mockDoc,
      incomingData: {
        ...mockDoc,
        accountStatus: 'CLAIMED',
        claimedByUid: newcomerAuth.uid,
        active: false,
      },
      getAfterClaimToken: afterToken,
    }).allowed,
    true
  );
  assert.equal(
    simulator.evaluate({
      collection: 'members',
      docId: mockDoc.id,
      operation: 'update',
      auth: { uid: 'uid-second-user', email: 'second@agro.com' },
      existingData: { ...mockDoc, accountStatus: 'CLAIMED', active: false },
      incomingData: { ...mockDoc, accountStatus: 'CLAIMED', claimedByUid: 'uid-second-user', active: false },
      getAfterClaimToken: { ...openToken, status: 'CLAIMED', claimedByUid: 'uid-second-user' },
    }).allowed,
    false
  );
});

// 11. MEMBER CLAIM REQUESTS (/member_claim_requests/{requestId})
test('RULE-11: /member_claim_requests — Requester creates PENDING only for self; only Admin resolves', () => {
  const adminAuth = { uid: TEST_ACCOUNTS.agroAdmin.uid, email: TEST_ACCOUNTS.agroAdmin.email };
  const memberAuth = { uid: TEST_ACCOUNTS.agroMember.uid, email: TEST_ACCOUNTS.agroMember.email };
  const orgId = TEST_ACCOUNTS.agroAdmin.orgId!;

  const pendingReq = {
    id: 'CREQ-001',
    orgId,
    placeholderMemberId: 'mem-mock-01',
    requesterUid: memberAuth.uid,
    status: 'PENDING',
  };

  assert.equal(
    simulator.evaluate({
      collection: 'member_claim_requests',
      docId: 'CREQ-001',
      operation: 'create',
      auth: memberAuth,
      incomingData: pendingReq,
    }).allowed,
    true
  );

  // Member cannot self-approve a claim request
  assert.equal(
    simulator.evaluate({
      collection: 'member_claim_requests',
      docId: 'CREQ-001',
      operation: 'update',
      auth: memberAuth,
      existingData: pendingReq,
      incomingData: { ...pendingReq, status: 'APPROVED' },
    }).allowed,
    false
  );

  // Admin can approve/reject within their own org
  assert.equal(
    simulator.evaluate({
      collection: 'member_claim_requests',
      docId: 'CREQ-001',
      operation: 'update',
      auth: adminAuth,
      existingData: pendingReq,
      incomingData: { ...pendingReq, status: 'APPROVED' },
    }).allowed,
    true
  );
});

// 12. RUNWAY PLEDGES RE-BINDING PROTECTION
test('RULE-12: /runway_pledges update permits member consolidation only onto own uid for linkedMemberIds', () => {
  const orgId = TEST_ACCOUNTS.agroAdmin.orgId!;
  const memberUid = 'uid-claimed-pledger';
  const memberAuth = { uid: memberUid, email: 'pledger@agro.com' };
  simulator.registerMember(memberUid, {
    role: 'MEMBER',
    approvalStatus: 'APPROVED',
    active: true,
    orgId,
    linkedMemberIds: ['mem-mock-pledger'],
  });

  const placeholderPledge = {
    id: 'PLG-MOCK-1',
    orgId,
    planId: 'PLN-1',
    memberId: 'mem-mock-pledger',
    amount: 500,
    status: 'ACTIVE',
  };

  // Linked owner can consolidate mock pledge onto their own uid
  assert.equal(
    simulator.evaluate({
      collection: 'runway_pledges',
      docId: 'PLG-MOCK-1',
      operation: 'update',
      auth: memberAuth,
      existingData: placeholderPledge,
      incomingData: { ...placeholderPledge, memberId: memberUid },
    }).allowed,
    true
  );

  // Hijacking an unrelated member's pledge -> DENIED!
  assert.equal(
    simulator.evaluate({
      collection: 'runway_pledges',
      docId: 'PLG-OTHER',
      operation: 'update',
      auth: memberAuth,
      existingData: { ...placeholderPledge, memberId: 'mem-unrelated' },
      incomingData: { ...placeholderPledge, memberId: memberUid },
    }).allowed,
    false
  );
});

test.after(() => {
  setTimeout(() => process.exit(0), 100);
});

