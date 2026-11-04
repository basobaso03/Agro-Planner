export type OrganizationType = 'AGRO_FARMING' | 'GENERAL_VENTURE';

export interface OrganizationFeatures {
  livestockModule: boolean;
  farmSitesModule: boolean;
  feedInventoryModule: boolean;
  multiSigApprovals: boolean;
  publicAuditVerifier: boolean;
  runwayModule?: boolean;
}

export interface Organization {
  id: string; // e.g. 'org-k8x1a...'
  name: string; // e.g. 'Green Valley Farming' or 'Apex Capital Fund'
  type: OrganizationType;
  adminMemberId: string;
  adminEmail: string;
  createdAt: string;
  updatedAt: string;

  // 24-Hour Expiring Invitation Code
  currentInviteCode: string; // e.g. 'SEED-8492'
  inviteCodeCreatedAt: string;
  inviteCodeExpiresAt: string; // ISO string 24h from generation

  // Target Capital Contribution Configuration
  defaultTargetContributionUsd: number;
  contributionPaceDefault: 'MONTHLY' | 'MILESTONE' | 'FLEXIBLE';
  currency: string; // 'USD'
  currencySymbol: string; // '$'
  description?: string;
  founderContact?: string;

  // Adaptive Workspace Features
  features: OrganizationFeatures;

  // Runway Planning Module Configuration
  runwayPromoSnoozedUntil?: string;
  runwayPromoShownCount?: number;
  runwayDefaults?: {
    mode: 'SIMPLE' | 'ADVANCED';
    contingencyPercent: number;
  };
}

export interface InviteCodeLookup {
  code: string;
  orgId: string;
  orgName: string;
  orgType: OrganizationType;
  adminName: string;
  expiresAt: string;
}

