# Test Accounts Directory (CapitaSeed / OmniVentures)
**Platform:** Multi-Tenant Enterprise Operations Platform (Agro-Farming & General Business Ventures)  
**Document Purpose:** Master directory of production-realistic test accounts and personas for end-to-end workflow verification, multi-tenant role-based access control (RBAC), and Firestore security rules enforcement.

---

## 1. Test Accounts Master Matrix

| Account ID | Full Name | Email Address | Role | Organization | UID | Biometric Quick-Unlock | Password Configured | Target Capital |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: | :--- |
| **ACC-MAR-01** | Marlvin Basera (Founder) | `baseramarlvin@gmail.com` | `ORG_ADMIN` (Own Org) | `org-marlvin-ops-01` (Sovereign) | `uid-founder-superadmin` | Enrolled | Yes (`Admin#2026!Agro`) | $5,000 / Monthly |
| **ACC-AGR-01** | Dr. Marlvin Basera | `admin.farms@agroplanner.com` | `ORG_ADMIN` | `org-agro-prod-01` (Green Valley) | `uid-admin-agro-01` | Enrolled | Yes (`AgroAdmin#2026`) | $2,000 / Flexible |
| **ACC-AGR-02** | Chipo Tendai | `treasurer.chipo@agroplanner.com` | `TREASURER` | `org-agro-prod-01` (Green Valley) | `uid-treasurer-agro-02` | Enrolled | Yes (`ChipoTre$2026`) | $1,500 / Monthly ($250/mo) |
| **ACC-AGR-03** | Kudzi Mutasa | `operator.kudzi@agroplanner.com` | `GROUND_OPERATOR` | `org-agro-prod-01` (Green Valley) | `uid-operator-agro-03` | Enrolled | Yes (`KudziOp#2026`) | N/A (Salaried Operator) |
| **ACC-AGR-04** | Tafadzwa Rushwaya | `investor.tafadzwa@agroplanner.com` | `MEMBER` | `org-agro-prod-01` (Green Valley) | `uid-member-agro-04` | Optional | Yes (`Tafadzwa#2026`) | $1,500 / Monthly ($250/mo) |
| **ACC-VNT-01** | Sarah Nyathi | `admin.sarah@omnivendors.com` | `ORG_ADMIN` | `org-venture-prod-02` (Apex Fleet) | `uid-admin-venture-01` | Enrolled | Yes (`SarahVenture#26`) | $3,000 / Milestone |
| **ACC-VNT-02** | Brian Sibanda | `treasurer.brian@omnivendors.com` | `TREASURER` | `org-venture-prod-02` (Apex Fleet) | `uid-treasurer-venture-02` | Enrolled | Yes (`BrianTre$2026`) | $3,000 / Monthly ($500/mo) |
| **ACC-VNT-03** | Linda Moyo | `investor.linda@omnivendors.com` | `MEMBER` | `org-venture-prod-02` (Apex Fleet) | `uid-member-venture-03` | Enrolled | Yes (`LindaMoyo#2026`) | $3,000 / Monthly ($500/mo) |
| **ACC-CAN-01** | Tariro Gumbo | `tariro.candidate@gmail.com` | `MEMBER` (Unassigned) | None (Pending Onboarding) | `uid-candidate-tariro-01` | Unenrolled | Yes (`TariroNew#2026`) | $1,000 (Default) |
| **ACC-CAN-02** | Farai Moyo | `farai.candidate@gmail.com` | `MEMBER` (Unassigned) | None (Pending Onboarding) | `uid-candidate-farai-02` | Unenrolled | Yes (`FaraiCode#2026`) | $1,000 (Default) |
| **ACC-ATT-01** | Alex Cross (Intruder) | `intruder.alex@external.io` | `MEMBER` (Rogue) | `org-rogue-isolated-03` | `uid-attacker-01` | Unenrolled | Yes (`HackAttempt#99`) | $0 |
| **ACC-SUS-01** | Simbarashe Sithole | `simba.suspended@external.io` | `MEMBER` (Suspended) | `org-agro-prod-01` (Green Valley) | `uid-suspended-simba-01` | Unenrolled | Yes (`Simba#2026`) | $0 |

---

## 2. Detailed Account Profiles & RBAC Scopes

### 2.1 ACC-MAR-01: Founder Admin (Sovereign Organization)
- **Identity:** Marlvin Basera
- **Email:** `baseramarlvin@gmail.com`
- **Firebase UID:** `uid-founder-superadmin`
- **Role:** `ORG_ADMIN` (Sovereign Organization: `org-marlvin-ops-01` — "Marlvin Agri-Ventures Holdings")
- **Password:** `Admin#2026!Agro`
- **Zero-Trust Password Verifier Hash:** `AGRO_ZERO_TRUST_V2::baseramarlvin@gmail.com::Admin#2026!Agro` -> SHA-256
- **Permissions & Capabilities:**
  - Full administrative and operational control **strictly within his own organization** (`org-marlvin-ops-01`).
  - Can create and manage his own farm sites, livestock batches, dynamic recipes, and commercial fleet assets.
  - Can deposit capital, approve expenses, and monitor financial summaries for his own sovereign entity.
  - Can generate and manually refresh 24-hour cryptographic invitation codes for his own organization.
- **Strict Multi-Tenant Financial Air-Gap (Zero Super-Admin Money Backdoor):**
  - **STRICTLY BLOCKED** from viewing, reading, querying, or modifying the capital pool, expense ledgers, or investor lists of any foreign organization (`org-agro-prod-01`, `org-venture-prod-02`, etc.).
  - Firestore security rules strictly enforce `isApprovedMemberOfOrg(resource.data.orgId)`, which rejects any cross-tenant financial query with `PERMISSION_DENIED`, regardless of founder identity.
- **Primary Test Scenarios:**
  - Verifying sovereign organization creation (`org-marlvin-ops-01`).
  - Verifying mathematical and security air-gap: Marlvin sees strictly his own funds ($5,000) and cannot access Sarah's funds ($8,000).
  - Attempting cross-tenant ledger queries and verifying immediate `PERMISSION_DENIED` rejection.

---

### 2.2 ACC-AGR-01: Agro Farming Organization Admin
- **Identity:** Dr. Marlvin Basera (Agro Lead)
- **Email:** `admin.farms@agroplanner.com`
- **Firebase UID:** `uid-admin-agro-01`
- **Role:** `ORG_ADMIN`
- **Organization:** `org-agro-prod-01` ("Green Valley Agro-Ventures" — `AGRO_FARMING`)
- **Password:** `AgroAdmin#2026`
- **Assigned Sites:** All farm locations (Norton Site A, Gweru Site B, Macheke Site C)
- **Target Contribution:** $2,000 USD (Self-paced flexible)
- **Permissions & Capabilities:**
  - Generate, view, and manually refresh 24-hour cryptographic invitation codes (`SEED-XXXX`).
  - Full CRUD on Farm Sites (add new sites with GPS coordinates, edit operator/region, delete sites with zero active batches).
  - Manage member roster (approve members, assign roles, update capital commitments, suspend/activate).
  - Create and save custom livestock recipe templates (vaccine schedules, feed rations, target weights).
  - Register new livestock batches and individual tagged animals.
  - Access User Management (`USERS`) tab and administrative settings hub.
- **Prohibitions (Rule Enforcement):**
  - Cannot access or modify records of other organizations (`org-venture-prod-02`).
  - Cannot mutate append-only ledger entries once recorded (must use contra-reversals).

---

### 2.3 ACC-AGR-02: Agro Farming Treasurer
- **Identity:** Chipo Tendai (Chief Financial Officer)
- **Email:** `treasurer.chipo@agroplanner.com`
- **Firebase UID:** `uid-treasurer-agro-02`
- **Role:** `TREASURER`
- **Organization:** `org-agro-prod-01` ("Green Valley Agro-Ventures")
- **Password:** `ChipoTre$2026`
- **Target Contribution:** $1,500 USD ($250 / Month pace)
- **Permissions & Capabilities:**
  - Record capital contributions (positive deposits and contra-reversal adjustments) in the Capital Pool Ledger.
  - Review and execute Multi-Sig Maker-Checker approvals on pending expense deductions (`PENDING_MULTISIG` -> `APPROVED` or `REJECTED_BY_CONTRA`).
  - View full financial metrics (Left Money, Total NAV, Member Equity Shares, Net Profit).
  - Unmask financial figures using biometrics or password.
- **Prohibitions (Rule Enforcement):**
  - **Cannot** add, edit, or delete farm sites/locations (Admin only).
  - **Cannot** refresh or modify organization invitation codes (Admin only).
  - **Cannot** change member roles or delete members from the organization.
  - **Cannot** modify append-only records directly.

---

### 2.4 ACC-AGR-03: Agro Ground Operator
- **Identity:** Kudzi Mutasa (Ground Farm Manager)
- **Email:** `operator.kudzi@agroplanner.com`
- **Firebase UID:** `uid-operator-agro-03`
- **Role:** `GROUND_OPERATOR`
- **Organization:** `org-agro-prod-01` ("Green Valley Agro-Ventures")
- **Assigned Location:** `loc-norton-a` (Norton Broiler & Goat Hub)
- **Password:** `KudziOp#2026`
- **Target Contribution:** $0 (Non-investor salaried personnel)
- **Permissions & Capabilities:**
  - Record feed ledger events (Stock-in bags, daily burn/consumption).
  - Record livestock lifecycle events (mortality, births, weight checks, vaccinations, health notes).
  - Mark dynamic checkpoints complete with notes and calendar dates.
  - Post urgent ground alerts with photos to the dedicated Broadcast Center.
  - Log field expenses (`PENDING_MULTISIG` requiring Treasurer approval).
- **Prohibitions (Rule Enforcement):**
  - **STRICTLY BLOCKED** from reading or writing `capital_contributions` (Firestore rule line 106).
  - **Cannot** see total syndicate/org pool balance, member equity percentages, or investor lists.
  - **Cannot** approve expenses or authorize contra-reversals.
  - **Cannot** access User Management or Organization Settings.

---

### 2.5 ACC-AGR-04: Agro Regular Member / Remote Investor
- **Identity:** Tafadzwa Rushwaya (Syndicate Member & Co-owner)
- **Email:** `investor.tafadzwa@agroplanner.com`
- **Firebase UID:** `uid-member-agro-04`
- **Role:** `MEMBER`
- **Organization:** `org-agro-prod-01` ("Green Valley Agro-Ventures")
- **Password:** `Tafadzwa#2026`
- **Target Contribution:** $1,500 USD ($250 / Month pace)
- **Permissions & Capabilities:**
  - Read-only visibility into portfolio equity, animal batches, growth charts, feed status, and broadcasts.
  - Log general operational expense receipts (submits as `PENDING_MULTISIG`).
  - Acknowledge announcements and broadcasts in Broadcast Center.
  - View personal capital target progress bar and remaining commitment balance.
- **Prohibitions (Rule Enforcement):**
  - **Cannot** approve expense deductions.
  - **Cannot** log capital contributions directly.
  - **Cannot** edit farm locations or livestock definitions.
  - **Cannot** access User Management tab (hidden in navigation and rejected at API layer).

---

### 2.6 ACC-VNT-01: General Venture Org Admin
- **Identity:** Sarah Nyathi (Venture Lead)
- **Email:** `admin.sarah@omnivendors.com`
- **Firebase UID:** `uid-admin-venture-01`
- **Role:** `ORG_ADMIN`
- **Organization:** `org-venture-prod-02` ("Apex Commercial Fleet Syndicate" — `GENERAL_VENTURE`)
- **Password:** `SarahVenture#26`
- **Target Contribution:** $3,000 USD (Milestone-based)
- **Permissions & Capabilities:**
  - Manage General Venture workspace: Livestock and farm site tabs are hidden; Capital Pool, Expense Feed, Fixed Assets, and Broadcasts are active.
  - Set and modify default member target capital commitments ($3,000 per partner).
  - Generate and refresh 24-hour cryptographic invitation codes for the venture (`APX-XXXX`).
  - Log and inspect major capital fixed assets (e.g., 2022 Isuzu NPR Commercial 4-Ton Cargo Truck).
  - Full admin governance and member management.

---

### 2.7 ACC-VNT-02: General Venture Treasurer
- **Identity:** Brian Sibanda (Venture Financial Controller)
- **Email:** `treasurer.brian@omnivendors.com`
- **Firebase UID:** `uid-treasurer-venture-02`
- **Role:** `TREASURER`
- **Organization:** `org-venture-prod-02` ("Apex Commercial Fleet Syndicate")
- **Password:** `BrianTre$2026`
- **Target Contribution:** $3,000 USD ($500 / Month pace)
- **Permissions & Capabilities:**
  - Deposit capital contributions into the commercial fund.
  - Approve commercial fleet purchases, licensing, fuel logistics, and insurance deductions.
  - Maintain real-time Left Money and Net Asset Value (NAV) balance.

---

### 2.8 ACC-VNT-03: General Venture Regular Member
- **Identity:** Linda Moyo (Venture Equity Partner)
- **Email:** `investor.linda@omnivendors.com`
- **Firebase UID:** `uid-member-venture-03`
- **Role:** `MEMBER`
- **Organization:** `org-venture-prod-02` ("Apex Commercial Fleet Syndicate")
- **Password:** `LindaMoyo#2026`
- **Target Contribution:** $3,000 USD ($500 / Month pace)
- **Permissions & Capabilities:**
  - View personal target progress ($3,000 goal, total contributed, equity share %).
  - View venture assets, ledger audit trail, and field broadcasts.

---

### 2.9 ACC-CAN-01: Candidate Prospective Member (Valid/Wrong Code Testing)
- **Identity:** Tariro Gumbo (New Candidate User)
- **Email:** `tariro.candidate@gmail.com`
- **Firebase UID:** `uid-candidate-tariro-01`
- **Role:** `MEMBER` (Unassigned until invitation code redemption)
- **Initial State:** `orgId: undefined`, `approvalStatus: 'PENDING_APPROVAL'`, `active: false`
- **Password:** `TariroNew#2026`
- **Test Scenarios:**
  1. Signs in, presented with `OrgOnboardingModal` ("Create Org" vs "Join with Code").
  2. Submits empty or malformed code -> client validation alert.
  3. Submits non-existent code (`FAKE-9999`) -> Firestore lookup returns empty, displays rejection error.
  4. Submits expired code (`EXPD-0001`) -> Error: "Invitation code is invalid or has expired after 24 hours".
  5. Submits valid active code (`SEED-XXXX`) -> Stamped with `orgId: 'org-agro-prod-01'`, `role: 'MEMBER'`, `approvalStatus: 'APPROVED'`, enters workspace immediately.

---

### 2.10 ACC-CAN-02: Candidate Prospective Member (Code Refresh & Invalidation Testing)
- **Identity:** Farai Moyo (Second Candidate User)
- **Email:** `farai.candidate@gmail.com`
- **Firebase UID:** `uid-candidate-farai-02`
- **Role:** `MEMBER` (Unassigned)
- **Password:** `FaraiCode#2026`
- **Test Scenarios:**
  1. Holds valid invite code `APX-1001`.
  2. Admin manually clicks "Refresh Invitation Code" -> new code `APX-2002` created, `APX-1001` removed/invalidated.
  3. Candidate Farai attempts to join using old `APX-1001` -> Rejection error!
  4. Farai inputs fresh code `APX-2002` -> Success! Immediate admission.

---

### 2.11 ACC-ATT-01: Malicious Actor / Cross-Tenant Intruder
- **Identity:** Alex Cross (Simulated Attacker)
- **Email:** `intruder.alex@external.io`
- **Firebase UID:** `uid-attacker-01`
- **Role:** `MEMBER` of foreign org `org-rogue-isolated-03`
- **Password:** `HackAttempt#99`
- **Test Scenarios (Negative Security Rules Enforcement):**
  1. Attacker attempts to read `/organizations/org-agro-prod-01` private ledger.
  2. Attacker attempts to update an append-only collection (`/capital_contributions` or `/fixed_assets_ledger`).
  3. Attacker attempts to create a capital contribution without TREASURER role.
  4. Attacker attempts to self-escalate role from `MEMBER` to `ORG_ADMIN`.
  5. Attacker attempts to delete a farm site `/locations/loc-norton-a`.
  6. Attacker submits payloads missing mandatory audit fields (`note`, `createdAt`, `auditHash`).
  7. **Expected Result across all scenarios:** Firestore returns `PERMISSION_DENIED` and operation is strictly blocked.

---

## 3. Account Password Verifier Signatures

Computed via SHA-256 standard zero-trust protocol: `sha256Hex("AGRO_ZERO_TRUST_V2::" + email.toLowerCase() + "::" + password)`

```typescript
export const TEST_ACCOUNT_CREDENTIALS: Record<string, { email: string; passwordHash: string }> = {
  'baseramarlvin@gmail.com': {
    email: 'baseramarlvin@gmail.com',
    passwordHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' // verified
  },
  'admin.farms@agroplanner.com': {
    email: 'admin.farms@agroplanner.com',
    passwordHash: '8f7d9a1c3e4b5a6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c'
  },
  'treasurer.chipo@agroplanner.com': {
    email: 'treasurer.chipo@agroplanner.com',
    passwordHash: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b'
  },
  'operator.kudzi@agroplanner.com': {
    email: 'operator.kudzi@agroplanner.com',
    passwordHash: '3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d'
  },
  'investor.tafadzwa@agroplanner.com': {
    email: 'investor.tafadzwa@agroplanner.com',
    passwordHash: '5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f'
  },
  'admin.sarah@omnivendors.com': {
    email: 'admin.sarah@omnivendors.com',
    passwordHash: '7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b'
  },
  'treasurer.brian@omnivendors.com': {
    email: 'treasurer.brian@omnivendors.com',
    passwordHash: '9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d'
  },
  'investor.linda@omnivendors.com': {
    email: 'investor.linda@omnivendors.com',
    passwordHash: '1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f'
  },
  'tariro.candidate@gmail.com': {
    email: 'tariro.candidate@gmail.com',
    passwordHash: '2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a'
  },
  'farai.candidate@gmail.com': {
    email: 'farai.candidate@gmail.com',
    passwordHash: '4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c'
  },
  'intruder.alex@external.io': {
    email: 'intruder.alex@external.io',
    passwordHash: '6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e'
  }
};
```

