# 04 — Screen Specifications & Overview Redesign

This document details:
1. The Mobile Banking Overview Redesign (icon · title · preview columns with privacy masking)
2. Sales on Credit Screen & Bottom Sheets (eliminating the "0 Active" issue)
3. Loans, Debts & Liabilities Hub Screen & Bottom Sheets
4. Complete Form-to-Bottom-Sheet Migration Inventory across the entire application
5. Agro-Farming Screen Specifications (Batch Detail, Checkpoint Agenda, Feed Inventory)
6. General Venture Screen Specifications (Operations Hub, Stock Inventory, General Sales)

---

## 1. Overview Screen: Mobile Banking Architecture

Inspired by modern fintech banking applications (Revolut, Monzo, Kuda Bank), the front screen provides immediate financial clarity with zero clutter.

### 1.1 Complete Visual Layout
```
┌────────────────────────────────────────────────────────┐
│ AppBar: [Org Name ▾] (Site Chip)    [✓ Synced] [🔔] [👁]│
├────────────────────────────────────────────────────────┤
│ ┌ Consolidated Balance Card ─────────────────────────┐ │
│ │ Total Adjusted Net Worth              $48,210.00   │ │ (CountUp animation)
│ │ ▲ +$1,420 (3.2%) this month                        │ │
│ │ ────────────────────────────────────────────────── │ │
│ │ Cash on Ground  │ Net Receivables  │ Total Debt    │ │
│ │ $6,120.00       │ $2,700.00        │ $900.00       │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│  (＋) Expense   (＋) Sale    (＋) Loan    (📣) Broadcast │ 4 Circular Quick Action Buttons (56dp)
│                                                        │
│ ── MONEY & WEALTH ──────────────────────────────────── │ Section Header (sticky small-caps)
│  [💰] Capital Pool           $12,400.00 Contributed  › │
│  [🧾] Sales on Credit        $2,300.00 (3 unpaid)    › │ Amber badge if overdue
│  [⚖] Loans & Debts          Debt $900 · Lent $400   › │
│  [🏗] Fixed Assets           14 items ($8,900.00)    › │
│  [🧭] Runway Plan            6.2 months remaining    › │ Progress indicator
│                                                        │
│ ── OPERATIONS (Agro Mode Only) ─────────────────────── │
│  [🐔] Livestock Batches      4 batches (1 due today) › │
│  [🏷] Biological Valuation   Flock value $5,100.00   › │
│                                                        │
│ ── OPERATIONS (General Venture Mode Only) ──────────── │
│  [📦] Inventory & Stock      $14,200 (2 low stock)   › │ Rose badge if reorder alert
│  [🏷] Monthly Sales Turnover $8,450.00 this month    › │
│                                                        │
│ ── RECENT PAGES ────────────────────────────────────── │
│  [🕒 Sale: CS-8812] [🕒 Batch: Cobb B-12] [🕒 Debt] ›   │ Horizontal Recents Carousel
│                                                        │
│ ── RECENT ACTIVITY ─────────────────────────────────── │
│  [Feed logged] 50kg Starter Broiler • 2h ago  -$42.00  │
│  [Credit Payment] John Doe • Yesterday        +$120.00 │
│  [View All Activity in Audit Ledger ›]                 │
└────────────────────────────────────────────────────────┘
```

### 1.2 `ListRow` Specification (Icon · Title · Preview Columns)
- **Geometry**: Height `64dp`, full width with horizontal padding `16dp`. Touch target `min-h-[48px]`.
- **Column 1 — Leading Icon Tile**:
  - `40×40dp` rounded container (`rounded-xl`).
  - Contextually tinted: Emerald for cash/pool, Amber for credit/receivables, Rose for liabilities/debts, Blue for runway/audit.
- **Column 2 — Title & Subtitle**:
  - `flex-1 min-w-0 pr-3`.
  - Title: 14sp bold (`font-bold text-slate-900 truncate`).
  - Subtitle: 12sp medium (`text-slate-500 truncate`).
- **Column 3 — Trailing Preview Amount & Chevron**:
  - Amount: 14sp mono bold (`font-mono font-bold text-slate-900 text-right`).
  - Masked State: When `showNumbers === false`, displays `••••••`.
  - Sub-badge: Renders below amount if actionable (e.g. `1 Overdue` in rose badge or `2 Low Stock` in amber badge).
  - Trailing Chevron: `<ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />`.
- **Press State**: Smooth ripple `active:bg-slate-100 transition-colors`.

### 1.3 Removal of Mock / Fake Elements (Fixes B14)
- Remove hard-coded "15:00 Live" timeline marker from `HomeTab.tsx:503`.
- Replace static mock percentage "+100% Equity Pool" with real computed pool contribution percentage:
  $$\text{Pool Progress \%} = \min\left(100, \frac{\text{totalPool}}{\text{targetContributionUsd}} \times 100\right)$$
- Replace static "On Track" operator badge with real computed metric: completed checkpoints today vs pending checkpoints today.

---

## 2. Sales on Credit Screen & Bottom Sheets

Resolves the ugly "0 Active" badge on small phones and full-page modal issues.

### 2.1 Screen Architecture: `CreditSalesScreen.tsx`
- **Navigation Location**: Pushed onto Money Tab Stack (`navigate('creditSales')`).
- **AppBar**: Back arrow, title "Sales on Credit", overflow actions menu (`[Export CSV]`, `[Customer Directory]`).
- **Compact Summary Card**:
  - Rendered in a single responsive row (2 columns):
    - Column 1: `Outstanding Receivables` ($2,300.00 Owed by customers).
    - Column 2: `Total Cash Collected` ($4,850.00 in deposits & installments).
  - Clean font sizes: 18sp mono on small phones (<360px), 22sp on larger screens.
- **Filter Segment Bar (Fixes B21)**:
  - Filter chips: `[ All (12) ]  [ Outstanding (3) ]  [ Overdue (1) ]  [ Settled (8) ]`.
  - **Resolution of "0 Active"**: When `Outstanding` is 0, chip is styled in neutral gray (`bg-slate-100 text-slate-500 border-slate-200`). When `> 0`, it highlights in warm amber. The ugly amber badge inside `<h2>` is completely deleted.
- **Credit Sales Stream**:
  - Each item renders as a `SaleCard`: Customer name, phone, item/produce sold, due date with relative countdown badge (*"Due in 4 days"* or *"Overdue 3 days"* in pulsing rose), progress bar showing % paid, and remaining balance.
- **Floating Action Button (FAB)**:
  - Bottom-right anchored: `[＋ Record Credit Sale]`.

### 2.2 Bottom Sheets for Credit Sales

#### A. `RecordCreditSaleSheet.tsx` (Replaces in-page form)
- Form layout split into a compact 2-step flow to keep sheet height ≤ 75% viewport:
  - **Step 1: Customer & Items**:
    - Customer Name (with auto-suggest from past customers)
    - Phone number (`inputMode="tel"`)
    - Farm Site Location picker
    - Item / Livestock Batch picker (Agro) or Product (General)
    - Quantity sold & Unit selling price
  - **Step 2: Payment Terms & Deposit**:
    - Deposit paid upfront in cash (`inputMode="decimal"`)
    - Agreed Due Date (Quick chips: `[+7 Days]`, `[+14 Days]`, `[+30 Days]`, `[Custom]`)
    - Payment Terms note (`minlength="4"`)
- **Live Computation Strip**: Pinned directly above the footer:
  $$\text{Total Sale: \$X.XX} \quad|\quad \text{Deposit: \$Y.YY} \quad|\quad \textbf{Remaining Receivable: \$Z.ZZ}$$
- **Keyboard Handling**: Submit button stays pinned above virtual keyboard; numeric keypad pops on price and deposit fields.

#### B. `RecordPaymentSheet.tsx`
- Used to log partial customer installments or full settlement.
- Prefills with full remaining balance; includes quick chip `[Pay in Full]`.
- Payment method chips: `[Cash (USD)]`, `[EcoCash]`, `[Bank Transfer]`, `[InnBucks]`.
- Updates remaining balance instantly and dispatches member notification broadcast.

#### C. `ExtendDueDateSheet.tsx`
- Used when a customer requests more time to pay.
- Displays previous agreed date and full history of previous extensions.
- Quick chips for extension: `[+7 Days]`, `[+14 Days]`, `[+30 Days]`.
- Mandatory extension reason note (enforces `note.length >= 4` for Firestore audit compliance).

---

## 3. Loans, Debts & Liabilities Hub Screen & Bottom Sheets

### 3.1 Screen Architecture: `LoansDebtsScreen.tsx`
- **Navigation Location**: Pushed onto Money Tab Stack (`navigate('loansDebts')`).
- **AppBar Sticky Segment Control**:
  - Two prominent segments: **Borrowed (Liabilities Owed by Us)** | **Lent (Loans Advanced to Others)**.
  - Smooth animated indicator bar tracking the active segment.
- **Summary Strip**:
  - Borrowed view: `Total Outstanding Debt: $900.00` (Supplier credit & loans).
  - Lent view: `Total Outstanding Loans: $400.00` (Outgrower advances).
- **List Cards**:
  - Creditor / Borrower name, contact number, category chip (`Supplier Credit`, `Bank Loan`, `Director Advance`), due date badge, remaining balance.
- **FAB**:
  - Dynamically updates with active segment: `[＋ New Debt Liability]` or `[＋ Advance New Loan]`.

### 3.2 Bottom Sheets for Loans & Debts

#### A. `NewDebtSheet.tsx` (Borrowed Money / Supplier Credit)
- Fields: Creditor Name, Contact, Category picker, Principal Amount, Agreed Due Date, Explanation Note (≥ 4 chars).
- Gating: Restricted to Treasurer and Org Admin roles. For unauthorized roles, the FAB is hidden and an informative banner explains governance permissions.

#### B. `RepayDebtSheet.tsx` (Cash Out Repayment)
- Amount, payment method, reference, note.
- **Runway Spend Gate Integration**: If a Runway Plan is ACTIVE, routes through `SpendGateSheet` to allocate repayment against budget line or draw from Contingency Reserve without breaking double-entry invariant.
- Insufficient liquid cash check: Prevents repayment exceeding available `leftMoney`.

#### C. `NewLoanSheet.tsx` (Lending Cash to Outgrowers/Partners)
- Borrower Name, Contact, Loan Category, Principal Amount, Return Date, Collateral Note, Purpose.
- Liquid Cash Guard: Strictly validates `principalAmount <= leftMoney`.

#### D. `RecoverLoanSheet.tsx` (Inflow Cash Recovery)
- Records incoming recovery payments, restoring liquid `leftMoney` and updating loan ledger.

---

## 4. Complete Form-to-Bottom-Sheet Migration Inventory

Every form across the app is converted to `<FormSheet>` / `<BottomSheet>`. Full-screen modals with nested views are eliminated.

| Domain | Current Component / In-Page Form | Target Bottom Sheet Component | Height Spec | Key Inputs & Guards |
|---|---|---|---|---|
| **Credit** | `CreditSalesModal.tsx` (NEW) | `RecordCreditSaleSheet.tsx` | 75% dvh | Customer, qty, price, deposit, due chips, terms |
| **Credit** | `CreditSalesModal.tsx` (REPAY) | `RecordPaymentSheet.tsx` | 55% dvh | Amount, method, receipt ref, note |
| **Credit** | `CreditSalesModal.tsx` (EXTEND) | `ExtendDueDateSheet.tsx` | 55% dvh | New date chips, extension reason (≥4 chars) |
| **Debt** | `LoansDebtsModal.tsx` (NEW_DEBT) | `NewDebtSheet.tsx` | 65% dvh | Creditor, category, principal, due, note |
| **Debt** | `LoansDebtsModal.tsx` (REPAY) | `RepayDebtSheet.tsx` | 60% dvh | Amount, method, Runway Spend Gate allocation |
| **Loan** | `LoansDebtsModal.tsx` (NEW_LOAN) | `NewLoanSheet.tsx` | 65% dvh | Borrower, principal, return date, collateral |
| **Loan** | `LoansDebtsModal.tsx` (RECOVER) | `RecoverLoanSheet.tsx` | 55% dvh | Recovery amount, method, ref, note |
| **Expenses** | `ExpensesFeedTab.tsx` (Log Modal) | `LogExpenseSheet.tsx` | 75% dvh | Location, category, batch, amount, photo, note |
| **Expenses** | `ExpensesFeedTab.tsx` (Contra Modal) | `ContraExpenseSheet.tsx` | 55% dvh | Original tx ID, contra reason (≥4 chars) |
| **Assets** | `AssetsTab.tsx` (Create Modal) | `AssetSheet.tsx` | 70% dvh | Name, flexible category, cost, location, pool check |
| **Assets** | `AssetsTab.tsx` (Adjust Modal) | `AdjustAssetSheet.tsx` | 55% dvh | Direction, delta, impairment/revaluation reason |
| **Assets** | `AssetsTab.tsx` (Transfer Modal) | `TransferAssetSheet.tsx` | 55% dvh | Origin site, destination site, condition note |
| **Pool** | `PoolEquityTab.tsx` (Add Member) | `AddMemberSheet.tsx` | 60% dvh | Full name, email/phone, role, contribution pace |
| **Pool** | `PoolEquityTab.tsx` (Contribution) | `ContributionSheet.tsx` | 60% dvh | Member, amount, payment method, reference, note |
| **Pool** | `PoolEquityTab.tsx` (Target Modal) | `TargetFundraisingSheet.tsx` | 50% dvh | Target dollar amount, fundraising deadline |
| **Agro** | `LivestockTab.tsx` (Register Batch) | `RegisterBatchSheet.tsx` | 75% dvh | Species freely editable, name, qty, duration, unit |
| **Agro** | `LivestockTab.tsx` (Log Feed) | `FeedEventSheet.tsx` | 60% dvh | Batch, feed qty (kg), ration phase, photo |
| **Agro** | `LivestockTab.tsx` (Log Action) | `LogLivestockActionSheet.tsx` | 65% dvh | Mortality count, weigh-in kg, health note |
| **Agro** | `LivestockTab.tsx` (Checkpoint) | `CheckpointSheet.tsx` | 65% dvh | Target day, auto-date preview, instructions |
| **Agro** | `LivestockTab.tsx` (Contra) | `HeadcountContraSheet.tsx` | 55% dvh | Adjustment count, high-contrast warning, reason |
| **General** | *New Screen* | `RecordGeneralSaleSheet.tsx` | 70% dvh | Customer, items, cash/credit toggle, deposit |
| **General** | *New Screen* | `StockInSheet.tsx` | 65% dvh | Item, quantity, unit cost, supplier, site |
| **General** | *New Screen* | `StockOutSheet.tsx` | 55% dvh | Item, quantity consumed/shrinkage, reason |
| **Team** | `UserManagementTab.tsx` | `MemberRoleSheet.tsx` | 50% dvh | Member role selection, location assignment |
| **Team** | `UserManagementTab.tsx` | `InviteCodeSheet.tsx` | 55% dvh | Organization invite code, copy, WhatsApp share |
| **Settings**| `UserSettingsTab.tsx` | `OrgSettingsSheet.tsx` | 65% dvh | Org name, currency selection, workspace type |
| **Settings**| `UserSettingsTab.tsx` | `NotificationPrefsSheet.tsx`| 60% dvh | Reminder alert toggles (due dates, runway) |
| **Runway** | `runway/RunwayWizard.tsx` | `RunwayWizard` (Pushed Screen)| 100% | Guided 4-step wizard with step progress indicator |
| **Runway** | `runway/SpendGateDialog.tsx` | `SpendGateSheet.tsx` | 60% dvh | Line allocation picker, Contingency buffer draw |
| **Runway** | `runway/AmendmentSheet.tsx` | `AmendmentSheet.tsx` | 60% dvh | Budget line adjustment, amount delta, reason |

---

## 5. Agro-Farming Screen Specifications

### 5.1 `BatchDetailScreen.tsx` (Replaces 134 KB Monolith)
- **Navigation Location**: Livestock Tab Stack (`navigate('batchDetail', { batchId })`).
- **Header Card**:
  - Batch Name (e.g. *"Broiler Batch #12"*), Species (*"Cobb 500"*), Arrival Date, Day Age (e.g. *"Day 24 of 42"*), Total Living Headcount, Mortality Rate (%).
  - Progress bar tracking target harvest date.
- **Sticky Sub-Navigation Segment**:
  - `[ Overview ]  [ Checkpoints ]  [ Feed Ledger ]  [ Weight Curves ]  [ Gallery ]  [ Sales ]`
- **Sub-Tab Views**:
  - **Checkpoints**: Full chronological agenda with completion status, operator instructions, target weights.
  - **Feed Ledger**: Historical feed consumption records, total feed consumed (kg), Feed Conversion Ratio (FCR).
  - **Weight Curves**: Real vs standard breed weight trajectory chart.
  - **Gallery**: Visual photo timeline of birds/animals with camera capture.
  - **Sales**: Batch-linked sales on credit and cash sales.

### 5.2 `CheckpointAgendaScreen.tsx`
- Cross-batch daily operational timeline: What feed, vaccines, and weigh-ins are due across all batches today and this week.

### 5.3 `FeedInventoryScreen.tsx`
- Total bags and kilograms in storage by ration (Starter, Grower, Finisher), daily burn rate, and projected stock-out date.

---

## 6. General Venture Screen Specifications (Fixes B13)

Resolves the dead "Operations" tab bug. General Venture organizations receive a fully functional, production-ready operational management suite.

### 6.1 `OperationsHubScreen.tsx` (The Operations Tab for General Venture)
- **Navigation Location**: Bottom Tab 2 for General Workspaces (`OPERATIONS`).
- **Executive Operational KPI Grid**:
  - `Total Inventory Value`: Depreciated/market valuation of all products on hand.
  - `Monthly Sales Turnover`: Gross sales (cash + credit) generated this calendar month.
  - `Low Stock Warnings`: Items at or below reorder threshold.
  - `Pending Receivables`: Uncollected credit invoices from customers.
- **Quick Action Row**:
  - `[＋ Record Sale]` (Cash or Credit)
  - `[＋ Receive Stock / Stock In]`
  - `[- Log Stock Usage / Stock Out]`
  - `[＋ Add New Product / SKU]`
- **Searchable Inventory Ledger**:
  - Search bar + Category filter chips (`Raw Materials`, `Finished Goods`, `Packaging`, `Consumables`).
  - Table / Card Rows: Item Title, SKU, Current Stock Count, Unit Cost, Selling Price, Total Line Value, and Stock Status Pill (`In Stock ✓` in emerald or `Low Stock ⚠` in rose).
- **Recent Stock Movements & Sales Stream**:
  - Real-time audit log of stock in, customer sales, supplier returns, and damage write-offs.

### 6.2 `StockInventoryScreen.tsx` & Detail Views
- Complete tracking of warehouse sites, incoming shipment invoices, supplier accounts, and inventory stock audits.
