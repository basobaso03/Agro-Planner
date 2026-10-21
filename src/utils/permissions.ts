import type { Role, SyndicateMember } from '../types/agro.ts';

export const PRIMARY_ADMIN_EMAIL = 'baseramarlvin@gmail.com';

/**
 * Role-Based Access Control (RBAC) & Data Redaction Engine
 * Defines security boundaries between Syndicate Admin, Treasurer, Remote Investor, and Ground Operator.
 */

export const PERMISSIONS = {
  // Master Liquid Capital Pool & Total Investor NAV
  canViewMasterTreasury: (role: Role): boolean => {
    return role === 'SYNDICATE_ADMIN' || role === 'TREASURER' || role === 'REMOTE_INVESTOR';
  },

  // Full Capital Pool & Investor Equity Ledger Tab
  canViewCapitalPoolTab: (role: Role): boolean => {
    return role === 'SYNDICATE_ADMIN' || role === 'TREASURER' || role === 'REMOTE_INVESTOR';
  },

  // Accessing the Syndicate Members management tab
  canManageMembers: (role: Role): boolean => {
    return role === 'SYNDICATE_ADMIN';
  },

  // Founder-Only Zero-Trust Clearance: Only the primary founder email can add, edit, suspend, or delete members
  canManageMemberCRUD: (member?: SyndicateMember | null): boolean => {
    if (!member) return false;
    const email = (member.email || member.phoneOrEmail || '').trim().toLowerCase();
    return email === PRIMARY_ADMIN_EMAIL;
  },

  // Adding Legal Farm Locations
  canAddLocations: (role: Role): boolean => {
    return role === 'SYNDICATE_ADMIN';
  },

  // Logging Direct Capital Deposits or Capital Injections
  canLogCapitalDeposit: (role: Role): boolean => {
    return role === 'SYNDICATE_ADMIN' || role === 'TREASURER';
  },

  // Maker-Checker Governance: Approving Expenses > $150
  canApproveMultiSig: (role: Role): boolean => {
    return role === 'SYNDICATE_ADMIN' || role === 'TREASURER';
  },

  // Posting Accounting Contra-Reversals on any Ledger
  canPostContraReversals: (role: Role): boolean => {
    return role === 'SYNDICATE_ADMIN' || role === 'TREASURER';
  },

  // Configuring Profit Reinvestment Splits vs Investor Dividends on Sales
  canConfigureProfitSplits: (role: Role): boolean => {
    return role === 'SYNDICATE_ADMIN' || role === 'TREASURER';
  },

  // Adjusting Fixed Capital Asset Book Values / Depreciation
  canAdjustAssetValuation: (role: Role): boolean => {
    return role === 'SYNDICATE_ADMIN' || role === 'TREASURER';
  },

  // Viewing System-Level Technical Configuration (Firebase Credentials Override, Cloud Disconnect, Capacitor APK)
  canViewSystemConfig: (role: Role): boolean => {
    return role === 'SYNDICATE_ADMIN';
  },

  // Viewing Cryptographic SHA-256 Ledger Forensics
  canViewHashChain: (role: Role): boolean => {
    return role === 'SYNDICATE_ADMIN' || role === 'TREASURER' || role === 'REMOTE_INVESTOR';
  },

  // Modifying Official Syndicate Brand Logos and Theme Defaults
  canManageBranding: (role: Role): boolean => {
    return role === 'SYNDICATE_ADMIN';
  },

  // Seeing other members' personal phone numbers or email addresses unmasked
  canViewUnmaskedPII: (role: Role): boolean => {
    return role === 'SYNDICATE_ADMIN';
  },

  // Seeing all individual investor equity stakes and dollar amounts vs just one's own stake
  canViewAllInvestorStakes: (role: Role): boolean => {
    return role === 'SYNDICATE_ADMIN' || role === 'TREASURER';
  },
};

/**
 * Redacts personal contact details (phone numbers / email addresses) for privacy.
 */
export function maskContact(contact: string, isPrivileged: boolean = false): string {
  if (isPrivileged || !contact) return contact;

  const trimmed = contact.trim();
  if (trimmed.includes('@')) {
    const [user, domain] = trimmed.split('@');
    const maskedUser =
      user.length > 2
        ? `${user.slice(0, 2)}***`
        : `${user[0] || '*'}***`;
    const domainParts = domain.split('.');
    const maskedDomain =
      domainParts.length > 1
        ? `***.${domainParts[domainParts.length - 1]}`
        : '***';
    return `${maskedUser}@${maskedDomain}`;
  }

  // Phone number masking (e.g. +263 77 241 8890 -> +263 77 *** **90)
  if (trimmed.length > 7) {
    const prefix = trimmed.slice(0, 8).trim();
    const suffix = trimmed.slice(-2);
    return `${prefix} *** **${suffix}`;
  }

  return '***-***';
}

/**
 * Returns user-facing badge configuration for the member's security role
 */
export function getRoleMeta(role: Role): {
  label: string;
  badgeClass: string;
  desc: string;
} {
  switch (role) {
    case 'SYNDICATE_ADMIN':
      return {
        label: 'Syndicate Admin',
        badgeClass: 'bg-purple-900/80 text-purple-200 border-purple-700/60',
        desc: 'Full administrative authority across all syndicate ledgers, members, and cloud configuration.',
      };
    case 'TREASURER':
      return {
        label: 'Syndicate Treasurer',
        badgeClass: 'bg-amber-900/80 text-amber-200 border-amber-700/60',
        desc: 'Multi-sig expense authorizer, capital pool custodian, and contra-entry auditor.',
      };
    case 'REMOTE_INVESTOR':
      return {
        label: 'Remote Investor',
        badgeClass: 'bg-emerald-900/80 text-emerald-200 border-emerald-700/60',
        desc: 'Capital contributor with real-time portfolio, dividend, and growth telemetry access.',
      };
    case 'GROUND_OPERATOR':
      return {
        label: 'Ground Operator',
        badgeClass: 'bg-sky-900/80 text-sky-200 border-sky-700/60',
        desc: 'Field station operator managing daily livestock feeding, weigh-ins, receipts, and site dispatches.',
      };
  }
}
