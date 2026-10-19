import test from 'node:test';
import assert from 'node:assert/strict';
import { PERMISSIONS, maskContact, getRoleMeta } from './permissions.ts';

test('Role Permissions: Syndicate Admin has full privileges', () => {
  assert.equal(PERMISSIONS.canManageMembers('SYNDICATE_ADMIN'), true);
  assert.equal(PERMISSIONS.canAddLocations('SYNDICATE_ADMIN'), true);
  assert.equal(PERMISSIONS.canViewSystemConfig('SYNDICATE_ADMIN'), true);
  assert.equal(PERMISSIONS.canApproveMultiSig('SYNDICATE_ADMIN'), true);
  assert.equal(PERMISSIONS.canPostContraReversals('SYNDICATE_ADMIN'), true);
  assert.equal(PERMISSIONS.canViewCapitalPoolTab('SYNDICATE_ADMIN'), true);
  assert.equal(PERMISSIONS.canViewUnmaskedPII('SYNDICATE_ADMIN'), true);
});

test('Role Permissions: Ground Operator is strictly restricted from administrative and financial data', () => {
  assert.equal(PERMISSIONS.canViewCapitalPoolTab('GROUND_OPERATOR'), false);
  assert.equal(PERMISSIONS.canManageMembers('GROUND_OPERATOR'), false);
  assert.equal(PERMISSIONS.canAddLocations('GROUND_OPERATOR'), false);
  assert.equal(PERMISSIONS.canViewSystemConfig('GROUND_OPERATOR'), false);
  assert.equal(PERMISSIONS.canViewHashChain('GROUND_OPERATOR'), false);
  assert.equal(PERMISSIONS.canApproveMultiSig('GROUND_OPERATOR'), false);
  assert.equal(PERMISSIONS.canPostContraReversals('GROUND_OPERATOR'), false);
  assert.equal(PERMISSIONS.canConfigureProfitSplits('GROUND_OPERATOR'), false);
  assert.equal(PERMISSIONS.canAdjustAssetValuation('GROUND_OPERATOR'), false);
  assert.equal(PERMISSIONS.canViewUnmaskedPII('GROUND_OPERATOR'), false);
});

test('Role Permissions: Treasurer can approve multi-sig and contra but cannot manage members or view system config', () => {
  assert.equal(PERMISSIONS.canApproveMultiSig('TREASURER'), true);
  assert.equal(PERMISSIONS.canPostContraReversals('TREASURER'), true);
  assert.equal(PERMISSIONS.canLogCapitalDeposit('TREASURER'), true);
  assert.equal(PERMISSIONS.canManageMembers('TREASURER'), false);
  assert.equal(PERMISSIONS.canViewSystemConfig('TREASURER'), false);
  assert.equal(PERMISSIONS.canAddLocations('TREASURER'), false);
});

test('Role Permissions: Remote Investor has read-only portfolio access and cannot execute approvals', () => {
  assert.equal(PERMISSIONS.canViewCapitalPoolTab('REMOTE_INVESTOR'), true);
  assert.equal(PERMISSIONS.canApproveMultiSig('REMOTE_INVESTOR'), false);
  assert.equal(PERMISSIONS.canPostContraReversals('REMOTE_INVESTOR'), false);
  assert.equal(PERMISSIONS.canManageMembers('REMOTE_INVESTOR'), false);
  assert.equal(PERMISSIONS.canViewSystemConfig('REMOTE_INVESTOR'), false);
  assert.equal(PERMISSIONS.canViewUnmaskedPII('REMOTE_INVESTOR'), false);
});

test('maskContact correctly redacts phone numbers and emails for non-privileged viewers', () => {
  // Unprivileged masking
  const maskedEmail = maskContact('chipo.k@agrosyndicate.co.zw', false);
  assert.equal(maskedEmail, 'ch***@***.zw');

  const maskedPhone = maskContact('+263 77 241 8890', false);
  assert.equal(maskedPhone, '+263 77 *** **90');

  // Privileged view
  const unmaskedEmail = maskContact('chipo.k@agrosyndicate.co.zw', true);
  assert.equal(unmaskedEmail, 'chipo.k@agrosyndicate.co.zw');

  const unmaskedPhone = maskContact('+263 77 241 8890', true);
  assert.equal(unmaskedPhone, '+263 77 241 8890');
});

test('getRoleMeta returns distinct badge classes and human-readable titles', () => {
  assert.equal(getRoleMeta('SYNDICATE_ADMIN').label, 'Syndicate Admin');
  assert.equal(getRoleMeta('TREASURER').label, 'Syndicate Treasurer');
  assert.equal(getRoleMeta('REMOTE_INVESTOR').label, 'Remote Investor');
  assert.equal(getRoleMeta('GROUND_OPERATOR').label, 'Ground Operator');
});
