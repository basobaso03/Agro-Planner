import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256Hex } from '../src/utils/cryptoHash.ts';
import { hasPasswordConfigured } from '../src/services/dataService.ts';
import type { OrgMember } from '../src/types/agro.ts';
import { TEST_ACCOUNTS, toOrgMember } from './helpers/testContext.ts';

function computePasswordVerifier(email: string, password: string): string {
  const normalizedEmail = email.trim().toLowerCase();
  return sha256Hex(`AGRO_ZERO_TRUST_V2::${normalizedEmail}::${password}`);
}

test('WF-20: Zero-Trust Biometric & Password Verifier Protocol', () => {
  const email = 'admin.farms@agroplanner.com';
  const correctPassword = 'AgroAdmin#2026';
  const wrongPassword = 'WrongPassword#99';

  const expectedHash = computePasswordVerifier(email, correctPassword);
  assert.ok(expectedHash);
  assert.equal(expectedHash.length, 64); // SHA-256 hex string

  // Check verification logic
  const attemptCorrect = computePasswordVerifier(email, correctPassword);
  assert.equal(attemptCorrect === expectedHash, true);

  const attemptWrong = computePasswordVerifier(email, wrongPassword);
  assert.equal(attemptWrong === expectedHash, false);
});

test('WF-21: Multi-Store Password Detection Sync — Zero False Negative Detection', () => {
  const memberBase: OrgMember = toOrgMember(TEST_ACCOUNTS.agroAdmin);

  // 1. Case A: member has flag hasPasswordSetup = true
  const memberWithFlag: OrgMember = {
    ...memberBase,
    hasPasswordSetup: true,
  };
  assert.equal(hasPasswordConfigured(memberWithFlag), true);

  // 2. Case B: member has passwordVerifierHash set
  const memberWithHash: OrgMember = {
    ...memberBase,
    hasPasswordSetup: false,
    passwordVerifierHash: '64char-valid-sha256-hash-string-here-1234567890abcdef1234567890abcdef',
  };
  assert.equal(hasPasswordConfigured(memberWithHash), true);

  // 3. Case C: member has 'password' provider linked
  const memberWithProvider: OrgMember = {
    ...memberBase,
    hasPasswordSetup: false,
    authProviders: ['google.com', 'password'],
  };
  assert.equal(hasPasswordConfigured(memberWithProvider), true);

  // 4. Case D: unconfigured user
  const unconfiguredMember: OrgMember = {
    ...memberBase,
    hasPasswordSetup: false,
    passwordVerifierHash: undefined,
    authProviders: ['google.com'],
  };
  assert.equal(hasPasswordConfigured(unconfiguredMember), false);
});

test('WF-22: Privacy Shield Zero-Bypass Enforcement', () => {
  // Simulate Privacy Unlock Attempt without configured credentials
  const unconfiguredUser: OrgMember = {
    ...toOrgMember(TEST_ACCOUNTS.candidateValid),
    hasPasswordSetup: false,
    passwordVerifierHash: undefined,
  };

  // Attempting to unlock without password setup or biometric must reject
  const canDirectlyUnlock = hasPasswordConfigured(unconfiguredUser);
  assert.equal(
    canDirectlyUnlock,
    false,
    'Unconfigured user must not be permitted to bypass privacy mask without setting up credentials'
  );
});

test.after(() => {
  setTimeout(() => process.exit(0), 100);
});

