import fs from 'node:fs';
import path from 'node:path';
import type { OrgMember } from '../../src/types/agro.ts';
import type { Organization } from '../../src/types/organization.ts';

export interface TestAccountProfile {
  id: string;
  name: string;
  email: string;
  uid: string;
  role: 'ORG_ADMIN' | 'TREASURER' | 'GROUND_OPERATOR' | 'MEMBER' | 'FOUNDER_SUPERADMIN';
  orgId?: string;
  password?: string;
  targetContributionUsd?: number;
  approvalStatus: 'APPROVED' | 'PENDING_APPROVAL' | 'SUSPENDED';
  active: boolean;
}

export const TEST_ACCOUNTS: Record<string, TestAccountProfile> = {
  founder: {
    id: 'mem-founder-01',
    name: 'Marlvin Basera',
    email: 'baseramarlvin@gmail.com',
    uid: 'uid-founder-superadmin',
    role: 'ORG_ADMIN',
    orgId: 'org-marlvin-ops-01',
    approvalStatus: 'APPROVED',
    active: true,
  },
  marlvinPersonal: {
    id: 'mem-founder-01',
    name: 'Marlvin Basera',
    email: 'baseramarlvin@gmail.com',
    uid: 'uid-founder-superadmin',
    role: 'ORG_ADMIN',
    orgId: 'org-marlvin-ops-01',
    approvalStatus: 'APPROVED',
    active: true,
  },
  agroAdmin: {
    id: 'mem-admin-agro-01',
    name: 'Dr. Marlvin Basera',
    email: 'admin.farms@agroplanner.com',
    uid: 'uid-admin-agro-01',
    role: 'ORG_ADMIN',
    orgId: 'org-agro-prod-01',
    targetContributionUsd: 2000,
    approvalStatus: 'APPROVED',
    active: true,
  },
  agroTreasurer: {
    id: 'mem-treasurer-agro-02',
    name: 'Chipo Tendai',
    email: 'treasurer.chipo@agroplanner.com',
    uid: 'uid-treasurer-agro-02',
    role: 'TREASURER',
    orgId: 'org-agro-prod-01',
    targetContributionUsd: 1500,
    approvalStatus: 'APPROVED',
    active: true,
  },
  agroOperator: {
    id: 'mem-operator-agro-03',
    name: 'Kudzi Mutasa',
    email: 'operator.kudzi@agroplanner.com',
    uid: 'uid-operator-agro-03',
    role: 'GROUND_OPERATOR',
    orgId: 'org-agro-prod-01',
    approvalStatus: 'APPROVED',
    active: true,
  },
  agroMember: {
    id: 'mem-member-agro-04',
    name: 'Tafadzwa Rushwaya',
    email: 'investor.tafadzwa@agroplanner.com',
    uid: 'uid-member-agro-04',
    role: 'MEMBER',
    orgId: 'org-agro-prod-01',
    targetContributionUsd: 1500,
    approvalStatus: 'APPROVED',
    active: true,
  },
  agroMemberB: {
    id: 'mem-member-agro-05',
    name: 'Nyasha Chikwanha',
    email: 'investor.nyasha@agroplanner.com',
    uid: 'uid-member-agro-05',
    role: 'MEMBER',
    orgId: 'org-agro-prod-01',
    targetContributionUsd: 1000,
    approvalStatus: 'APPROVED',
    active: true,
  },
  ventureAdmin: {
    id: 'mem-admin-venture-01',
    name: 'Sarah Nyathi',
    email: 'admin.sarah@omnivendors.com',
    uid: 'uid-admin-venture-01',
    role: 'ORG_ADMIN',
    orgId: 'org-venture-prod-02',
    targetContributionUsd: 3000,
    approvalStatus: 'APPROVED',
    active: true,
  },
  ventureTreasurer: {
    id: 'mem-treasurer-venture-02',
    name: 'Brian Sibanda',
    email: 'treasurer.brian@omnivendors.com',
    uid: 'uid-treasurer-venture-02',
    role: 'TREASURER',
    orgId: 'org-venture-prod-02',
    targetContributionUsd: 3000,
    approvalStatus: 'APPROVED',
    active: true,
  },
  ventureMember: {
    id: 'mem-member-venture-03',
    name: 'Linda Moyo',
    email: 'investor.linda@omnivendors.com',
    uid: 'uid-member-venture-03',
    role: 'MEMBER',
    orgId: 'org-venture-prod-02',
    targetContributionUsd: 3000,
    approvalStatus: 'APPROVED',
    active: true,
  },
  ventureMember2: {
    id: 'mem-member-venture-04',
    name: 'Farai Dube',
    email: 'investor.farai@omnivendors.com',
    uid: 'uid-member-venture-04',
    role: 'MEMBER',
    orgId: 'org-venture-prod-02',
    targetContributionUsd: 2000,
    approvalStatus: 'APPROVED',
    active: true,
  },
  candidateValid: {
    id: 'mem-candidate-tariro-01',
    name: 'Tariro Gumbo',
    email: 'tariro.candidate@gmail.com',
    uid: 'uid-candidate-tariro-01',
    role: 'MEMBER',
    approvalStatus: 'PENDING_APPROVAL',
    active: false,
  },
  candidateRefresh: {
    id: 'mem-candidate-farai-02',
    name: 'Farai Moyo',
    email: 'farai.candidate@gmail.com',
    uid: 'uid-candidate-farai-02',
    role: 'MEMBER',
    approvalStatus: 'PENDING_APPROVAL',
    active: false,
  },
  intruder: {
    id: 'mem-attacker-01',
    name: 'Alex Cross (Intruder)',
    email: 'intruder.alex@external.io',
    uid: 'uid-attacker-01',
    role: 'MEMBER',
    orgId: 'org-rogue-isolated-03',
    approvalStatus: 'APPROVED',
    active: true,
  },
  suspendedMember: {
    id: 'mem-suspended-01',
    name: 'Simbarashe Sithole',
    email: 'simba.suspended@external.io',
    uid: 'uid-suspended-simba-01',
    role: 'MEMBER',
    orgId: 'org-agro-prod-01',
    approvalStatus: 'SUSPENDED',
    active: false,
  },
};

export function toOrgMember(profile: TestAccountProfile): OrgMember {
  return {
    id: profile.id,
    orgId: profile.orgId,
    uid: profile.uid,
    email: profile.email,
    fullName: profile.name,
    phoneOrEmail: profile.email,
    role: profile.role as any,
    approvalStatus: profile.approvalStatus as any,
    targetContributionUsd: profile.targetContributionUsd,
    joinedAt: new Date().toISOString(),
    active: profile.active,
  };
}

export function loadProductionFixtures() {
  const filePath = path.resolve('workflow-tests', 'fixtures', 'production-fixtures.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

export function loadRealTestImageBase64(filename: string): string {
  const filePath = path.resolve('workflow-tests', 'fixtures', 'images', filename);
  if (!fs.existsSync(filePath)) {
    return 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/';
  }
  const buffer = fs.readFileSync(filePath);
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}

