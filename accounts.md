# AgroPlanner Syndicate Test Accounts Credentials

This document records the official testing accounts created for production end-to-end verification across all 8 modules and access roles. These accounts are active in Firebase Cloud Authentication and Firestore, and have been populated with real farming data, lifecycle cycles, and photos.

---

## Testing Credentials Summary

| Role | Name | Email Address | Password | Assigned Farm Site | Permissions & Access Scope |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Founder / Super Admin** | Marlvin Basera | `baseramarlvin@gmail.com` | *(User's Personal Auth)* | All Locations | Full syndicate access, user approvals, role assignments, ledger reset |
| **Syndicate Admin** | Farai Chidzero | `admin.farms@agroplanner.com` | `AgroFarmAdmin2026!` | All Locations | Member management, operational approvals, capital allocation |
| **Syndicate Treasurer** | Nyasha Moyo | `treasurer.audit@agroplanner.com` | `AgroTreasurer2026!` | All Locations | Multi-sig expense dual-approval (>$150), capital pool management, financial audits |
| **Ground Operator (Harare)** | Tendai Mukanya | `operator.harare@agroplanner.com` | `AgroOperatorHarare2026!` | Harare East Broiler Farm | Daily weigh-ins, vaccination logs, feed logging, mortality, ground broadcasts, gallery uploads |
| **Ground Operator (Bulawayo)** | Sibongile Ndlovu | `operator.bulawayo@agroplanner.com` | `AgroOperatorByo2026!` | Bulawayo Goat & Livestock Ranch | Daily goat/cattle logging, kid birth registrations, ranch asset transfers, ground dispatches |
| **Remote Investor 1** | Tariro Masawi | `investor.tariro@agroplanner.com` | `AgroInvestorTariro2026!` | Global Portfolio | Capital deposits, read-only livestock progress, ground gallery monitoring, financial ledger verification |
| **Remote Investor 2** | Kudzai Gumbo | `investor.kudzi@agroplanner.com` | `AgroInvestorKudzi2026!` | Global Portfolio | Capital deposits, returns tracking, visual audit stream, receipt inspection |

---

## Role Permission Matrix in Production

| Operation | Founder / Admin | Treasurer | Ground Operator | Remote Investor |
| :--- | :---: | :---: | :---: | :---: |
| **Approve New Members & Assign Roles** | ✅ | ❌ | ❌ | ❌ |
| **Deposit Capital into Left Money Pool** | ✅ | ✅ | ❌ | ✅ |
| **Log Operational Farm Expense** | ✅ | ✅ | ✅ (Own Station) | ❌ |
| **Multi-Sig Dual Approval (>$150)** | ✅ | ✅ | ❌ | ❌ |
| **Post Financial Contra-Reversal** | ✅ | ✅ | ❌ | ❌ |
| **Register New Livestock Batch** | ✅ | ✅ | ✅ (Own Station) | ❌ |
| **Log Livestock Lifecycle Event & Photos** | ✅ | ✅ | ✅ (Own Station) | ❌ |
| **Execute Final Livestock Sale Dispatch** | ✅ | ✅ | ✅ (Own Station) | ❌ |
| **Register & Transfer Fixed Assets** | ✅ | ✅ | ✅ (Own Station) | ❌ |
| **Adjust Fixed Asset Valuation** | ✅ | ✅ | ❌ | ❌ |
| **Post Ground Broadcast & Photo Dispatches** | ✅ | ✅ | ✅ | ❌ |
| **Inspect Visual Galleries & Receipt Photos** | ✅ | ✅ | ✅ | ✅ |
| **Verify SHA-256 Cryptographic Chain** | ✅ | ✅ | ❌ | ✅ |

---

## Instructions for Inspection

1. Launch or open the AgroPlanner application in your browser.
2. Sign in using any of the credentials above to inspect the experience from that specific user's perspective.
   - E.g., Sign in as `operator.harare@agroplanner.com` to see the streamlined ground station UI, photo uploads, and weigh-in logging without financial vault controls.
   - E.g., Sign in as `investor.tariro@agroplanner.com` to see the full capital pool, equity distribution, photo galleries of the batches, and immutable audit trail.
   - E.g., Sign in as `treasurer.audit@agroplanner.com` to see multi-sig pending expense counters, contra-reversals, and ledger validations.
3. All live test batches, lifecycle events, expenses, assets, receipts, and photos will remain intact in Firebase for your inspection.

