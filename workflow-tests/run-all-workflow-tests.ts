import { spawnSync } from 'node:child_process';
import path from 'node:path';

interface SuiteRunResult {
  name: string;
  file: string;
  passed: boolean;
  durationMs: number;
  output: string;
}

const suites = [
  {
    name: 'Suite 1: Auth & Organization Onboarding (Invites, Expiration & Refreshes)',
    file: 'workflow-tests/01-auth-org-onboarding.test.ts',
  },
  {
    name: 'Suite 2: Agro Farming Operations (Site A Norton, Site B Gweru Goats, Site C Macheke & Multi-Site Analytics)',
    file: 'workflow-tests/02-agro-farming-workflow.test.ts',
  },
  {
    name: 'Suite 3: General Business Venture (Capital Targets, Dual-Tier Multi-Sig, Fleet Assets & NAV)',
    file: 'workflow-tests/03-general-venture-workflow.test.ts',
  },
  {
    name: 'Suite 4: Firestore Security Rules Contract (All Collections, Append-Only & Audit Integrity)',
    file: 'workflow-tests/04-firestore-rules-security.test.ts',
  },
  {
    name: 'Suite 5: Zero-Trust Biometrics & Privacy Security (Fingerprint Default, Eye-Shield & Password Sync)',
    file: 'workflow-tests/05-biometrics-privacy-security.test.ts',
  },
  {
    name: 'Suite 6: Multi-Tenant Isolation & Zero Super-Admin Money Backdoor (Air-Gapped Ledgers)',
    file: 'workflow-tests/06-multi-tenant-isolation.test.ts',
  },
  {
    name: 'Suite 7: Member Governance & RBAC Lifecycle (Promote, Demote, Reassign & Suspend)',
    file: 'workflow-tests/07-member-governance-rbac.test.ts',
  },
  {
    name: 'Suite 8: Financial Redesign, 9-Pillar Wealth & Modern Banking Hub (Liabilities, Loans, Credit Sales & Valuation)',
    file: 'workflow-tests/08-financial-redesign-banking-hub.test.ts',
  },
];

console.log('\n========================================================================');
console.log('   CAPITASEED / OMNIVENTURES ENTERPRISE WORKFLOW & SECURITY TEST RUNNER');
console.log('========================================================================\n');

const results: SuiteRunResult[] = [];
let allPassed = true;

for (const suite of suites) {
  console.log(`▶ Executing: ${suite.name}...`);
  const start = Date.now();
  const run = spawnSync('npx', ['tsx', suite.file], {
    shell: true,
    encoding: 'utf8',
  });
  const durationMs = Date.now() - start;
  const passed = run.status === 0;

  if (!passed) allPassed = false;

  results.push({
    name: suite.name,
    file: suite.file,
    passed,
    durationMs,
    output: run.stdout + run.stderr,
  });

  const statusBadge = passed ? '✔ PASSED' : '✖ FAILED';
  console.log(`  ${statusBadge} in ${(durationMs / 1000).toFixed(2)}s\n`);
  if (!passed) {
    console.error(run.stdout);
    console.error(run.stderr);
  }
}

console.log('\n========================================================================');
console.log('                      EXECUTIVE TEST SUMMARY REPORT');
console.log('========================================================================');

results.forEach((r, idx) => {
  const icon = r.passed ? '✔' : '✖';
  console.log(`${icon} [${idx + 1}/${results.length}] ${r.name} (${(r.durationMs / 1000).toFixed(2)}s)`);
});

const totalDuration = results.reduce((acc, r) => acc + r.durationMs, 0);
console.log('------------------------------------------------------------------------');
console.log(`Total Suites: ${results.length} | Passed: ${results.filter((r) => r.passed).length} | Failed: ${results.filter((r) => !r.passed).length}`);
console.log(`Total Execution Time: ${(totalDuration / 1000).toFixed(2)}s`);
console.log(`Firestore Security Rules Compliancy: ${results[3].passed && results[5].passed ? '100% (VERIFIED)' : 'FAILED'}`);
console.log('========================================================================\n');

if (!allPassed) {
  process.exit(1);
} else {
  process.exit(0);
}
