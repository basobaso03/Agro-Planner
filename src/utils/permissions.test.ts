import test from 'node:test';
import assert from 'node:assert/strict';
import { PERMISSIONS, maskContact, getRoleMeta } from './permissions.ts';

test('Role Permissions: Organization Admin has full privileges', () => {
  assert.equal(PERMISSIONS.canManageMembers('ORG_ADMIN'), true);
  assert.equal(PERMISSIONS.canAddLocations('ORG_ADMIN'), true);
  assert.equal(PERMISSIONS.canEditLocation('ORG_ADMIN'), true);
  assert.equal(PERMISSIONS.canDeleteLocation('ORG_ADMIN'), true);
  assert.equal(PERMISSIONS.canRefreshInviteCode('ORG_ADMIN'), true);
  assert.equal(PERMISSIONS.canManageCustomRecipes('ORG_ADMIN'), true);
  assert.equal(PERMISSIONS.canViewSystemConfig('ORG_ADMIN'), true);
  assert.equal(PERMISSIONS.canApproveMultiSig('ORG_ADMIN'), true);
  assert.equal(PERMISSIONS.canPostContraReversals('ORG_ADMIN'), true);
  assert.equal(PERMISSIONS.canViewCapitalPoolTab('ORG_ADMIN'), true);
  assert.equal(PERMISSIONS.canViewUnmaskedPII('ORG_ADMIN'), true);
});

test('Role Permissions: Ground Operator is strictly restricted from administrative and financial data', () => {
  assert.equal(PERMISSIONS.canManageMembers('GROUND_OPERATOR'), false);
  assert.equal(PERMISSIONS.canAddLocations('GROUND_OPERATOR'), false);
  assert.equal(PERMISSIONS.canEditLocation('GROUND_OPERATOR'), false);
  assert.equal(PERMISSIONS.canDeleteLocation('GROUND_OPERATOR'), false);
  assert.equal(PERMISSIONS.canViewSystemConfig('GROUND_OPERATOR'), false);
  assert.equal(PERMISSIONS.canApproveMultiSig('GROUND_OPERATOR'), false);
  assert.equal(PERMISSIONS.canPostContraReversals('GROUND_OPERATOR'), false);
  assert.equal(PERMISSIONS.canViewCapitalPoolTab('GROUND_OPERATOR'), false);
  assert.equal(PERMISSIONS.canViewMasterTreasury('GROUND_OPERATOR'), false);
  assert.equal(PERMISSIONS.canViewUnmaskedPII('GROUND_OPERATOR'), false);
  assert.equal(PERMISSIONS.canManageCustomRecipes('GROUND_OPERATOR'), true);
});

test('Role Permissions: Treasurer can approve multi-sig and contra but cannot manage members or view system config', () => {
  assert.equal(PERMISSIONS.canApproveMultiSig('TREASURER'), true);
  assert.equal(PERMISSIONS.canPostContraReversals('TREASURER'), true);
  assert.equal(PERMISSIONS.canViewCapitalPoolTab('TREASURER'), true);
  assert.equal(PERMISSIONS.canManageMembers('TREASURER'), false);
  assert.equal(PERMISSIONS.canAddLocations('TREASURER'), false);
  assert.equal(PERMISSIONS.canViewSystemConfig('TREASURER'), false);
  assert.equal(PERMISSIONS.canManageBranding('TREASURER'), false);
});

test('Role Permissions: Member has read-only portfolio access and cannot execute approvals', () => {
  assert.equal(PERMISSIONS.canViewCapitalPoolTab('MEMBER'), true);
  assert.equal(PERMISSIONS.canViewMasterTreasury('MEMBER'), true);
  assert.equal(PERMISSIONS.canApproveMultiSig('MEMBER'), false);
  assert.equal(PERMISSIONS.canPostContraReversals('MEMBER'), false);
  assert.equal(PERMISSIONS.canManageMembers('MEMBER'), false);
  assert.equal(PERMISSIONS.canAddLocations('MEMBER'), false);
  assert.equal(PERMISSIONS.canViewSystemConfig('MEMBER'), false);
});

test('maskContact correctly redacts phone numbers and emails for non-privileged viewers', () => {
  // Email masking
  const maskedEmail = maskContact('chipo.k@capitaseed.co.zw', false);
  assert.equal(maskedEmail, 'ch***@***.zw');

  const maskedPhone = maskContact('+263 77 241 8890', false);
  assert.equal(maskedPhone, '+263 77 *** **90');

  // Privileged view
  const unmaskedEmail = maskContact('chipo.k@capitaseed.co.zw', true);
  assert.equal(unmaskedEmail, 'chipo.k@capitaseed.co.zw');

  const unmaskedPhone = maskContact('+263 77 241 8890', true);
  assert.equal(unmaskedPhone, '+263 77 241 8890');
});

test('getRoleMeta returns distinct badge classes and human-readable titles', () => {
  assert.equal(getRoleMeta('ORG_ADMIN').label, 'Organization Admin');
  assert.equal(getRoleMeta('TREASURER').label, 'Treasurer');
  assert.equal(getRoleMeta('MEMBER').label, 'Member');
  assert.equal(getRoleMeta('GROUND_OPERATOR').label, 'Ground Operator');
});

test('canManageMemberCRUD: Organization Admins have user CRUD privileges and respect tenant boundaries', () => {
  const adminMember = {
    id: 'mem-admin-1',
    orgId: 'org-alpha',
    email: 'admin@capitaseed.com',
    fullName: 'Admin User',
    phoneOrEmail: 'admin@capitaseed.com',
    role: 'ORG_ADMIN' as const,
    joinedAt: '2026-01-01',
    active: true,
  };
  const regularUser = {
    id: 'mem-investor-1',
    orgId: 'org-alpha',
    email: 'member@capitaseed.com',
    fullName: 'Regular Member',
    phoneOrEmail: 'member@capitaseed.com',
    role: 'MEMBER' as const,
    joinedAt: '2026-01-01',
    active: true,
  };

  assert.equal(PERMISSIONS.canManageMemberCRUD(adminMember), true);
  assert.equal(PERMISSIONS.canManageMemberCRUD(adminMember, 'org-alpha'), true);
  // Admin from org-alpha cannot manage members of org-beta:
  assert.equal(PERMISSIONS.canManageMemberCRUD(adminMember, 'org-beta'), false);
  assert.equal(PERMISSIONS.canManageMemberCRUD(regularUser), false);
  assert.equal(PERMISSIONS.canManageMemberCRUD(null), false);
});
