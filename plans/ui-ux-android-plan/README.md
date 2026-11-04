# CapitaSeed — Complete UI/UX & Android-Native Plan

**Scope:** Both workspace modes (`AGRO_FARMING` and `GENERAL_VENTURE`).  
**Status:** Planning only. Strict constraint: no code or test files were changed in this session.  
**Aligned with:** `plans/Frontend plan` (Issues 1–12), `plans/redesign plan` (9 Pillars & Banking Hub), `plans/runway plan` (Capital Planning & Spend Gate), and `workflow-tests/` (Suites 01–09).

---

## Document Index

| # | Document | Detailed Contents |
|---|---|---|
| **01** | [01-audit-gaps-and-bugs.md](01-audit-gaps-and-bugs.md) | Exhaustive evidence-based bug and gap audit (B1–B24). File and line references for every silent failure point, rule mismatch, and UI flaw. |
| **02** | [02-navigation-architecture.md](02-navigation-architecture.md) | Multi-stack navigation engine, persistent Recents system ("stores opened pages"), Android 14+ predictive back, and removal of unrequested swipe tab hopping. |
| **03** | [03-design-system-and-bottom-sheets.md](03-design-system-and-bottom-sheets.md) | Solora tokens (deleting CSS `!important` hacks), `<BottomSheet>` framework (max 88dvh), virtual keyboard engine (`--kb`), sticky error banners, and elimination of the ugly "0 Active" badge. |
| **04** | [04-screens-and-overview-redesign.md](04-screens-and-overview-redesign.md) | Mobile banking Overview redesign (`ListRow` with icon · title · preview columns and number masking), Credit Sales screen & sheets, Loans & Debts hub, Agro Batch Detail, and General Operations Hub (`OperationsHubScreen`). |
| **05** | [05-android-native-capabilities.md](05-android-native-capabilities.md) | 20 Android native framework features missing from web: IME keyboard insets, edge-to-edge, haptics, AlarmManager reminders, Scoped Storage camera pipeline, Share sheet, app lock, and shortcuts. |
| **06** | [06-forms-data-reliability.md](06-forms-data-reliability.md) | Complete resolution of *"forms are not actually sending data and I get nothing"*: rule contract fix, Outbox Reconciler preventing sync wipeouts, atomic transactions, and `useForm` engine. |
| **07** | [07-files-roadmap-and-tests.md](07-files-roadmap-and-tests.md) | Exhaustive inventory of files to create, modify, and delete, phased implementation roadmap, new test suites 10–13, and acceptance criteria sign-off. |

---

## Executive Summary: What Was Broken & Why Forms "Send Nothing"

1. **The Cloud Sync Wipeout Bug (B20 — The Smoking Gun)**:
   - In `dataService.ts:2171-2220` (`syncWithCloudServer`) and `dataService.ts:2097-2101` (`attachCloudListeners`), local state arrays (`this.state.creditSales = docs as CreditSaleEvent[]`, etc.) are replaced directly with cloud docs.
   - When an operator submits a credit sale, debt, or expense, the cloud write is rejected (due to B1 field mismatch, B22 treasurer role check, B23 note < 4 chars, or offline status).
   - In `dataService.ts:2272-2274`, `persistDocumentToCloudIfActive` swallows the rejection with `console.warn`.
   - On the next cloud snapshot or sync, the server returns an empty list, **permanently erasing the local record**. The user experiences this as *"forms are not sending data and I get nothing"*.
2. **Invisible Validation Errors (B5, B21)**:
   - Error banners in `CreditSalesModal.tsx:289`, `LoansDebtsModal.tsx:440`, and `ExpensesFeedTab.tsx:1005` render at line 1 of the scroll body. When the user scrolls down to the submit button on mobile, errors are off-screen above the viewport. Submitting an invalid form produces zero feedback.
3. **Ugly "0 Active" Header Badge (B21)**:
   - In `CreditSalesModal.tsx:218-220`, `<span className="... bg-amber-100 text-amber-800 ...">{activeSalesCount} Active</span>` is nested directly inside the `<h2>` title, forcing line wraps on small phones and alarming users with an amber badge when 0 credit is active.
4. **Uncontrolled Swipe Navigation (B10)**:
   - The touch listener in `App.tsx:463-526` cycled through `accessibleTabs` (10 tabs, including `POOL`, `ASSETS`, `AUDIT`, `USERS`, `RUNWAY`, `SETTINGS`). Horizontal swipes hurled users into confusing, unrequested screens.
5. **Missing Navigation Memory & Back Stack (B11, B12)**:
   - Tabs unmounted on every switch (`activeTab === 'X' && <XTab/>`), discarding form inputs, filters, and scroll. Back gestures clicked DOM buttons via `querySelector` or exited the app.
6. **General Venture Dead Tab (B13)**:
   - `FloatingNavbar.tsx:41` showed an "Operations" tab for non-agro workspaces, but `App.tsx:351-353` bounced `LIVESTOCK` to `HOME`. General organizations lacked an operational hub.
7. **Android Framework Absence (B19)**:
   - Plugins referenced in `capacitor.config.json` (`Keyboard`, `SplashScreen`) were never installed. Haptics fell back to unreliable `navigator.vibrate`, and photos stored as base64 in `localStorage` triggered silent quota drops (B3).

---

## Architectural Decisions Solidified for Production

1. **Navigation Engine**: In-house typed multi-stack router with an independent back stack per tab, overlay sheet stack, and persistent Recents system (last 8 opened screens) with `history.pushState` PWA/Android alignment.
2. **Bottom Navigation**: 4 primary destinations:
   - **Overview** (consolidated mobile banking hub)
   - **Livestock** (Agro) or **Operations** (General Venture)
   - **Money** (Credit Sales, Loans/Debts, Expenses, Pool, Assets, Runway)
   - **More** (Members, Audit, Broadcasts, Recents, Settings, Sync, Storage)
3. **Forms Architecture**: 100% bottom sheets (`<BottomSheet>` / `<FormSheet>`). Max height `min(88dvh, visualViewportHeight - safeTop - 12px)`. Never reaches status bar. Action footer stays pinned directly above virtual keyboard via `--kb` variable.
4. **General Venture Operations Hub**: Full `OperationsHubScreen` providing Sales Invoicing (cash/credit), Stock Inventory In/Out, SKU Catalog, and Warehouse management.
5. **Data Reliability**: Outbox reconciler merges cloud snapshots with pending local writes, preventing data loss. Pure `Validate → Build → Commit` atomic transactions.
6. **Automated Verification**: 4 new test suites (Suites 10–13) asserting rules payload parity, outbox snapshot resilience, sheet keyboard adaptation, and 320px viewport matrix.
