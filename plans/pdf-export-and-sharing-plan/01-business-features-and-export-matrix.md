# Document 01: Business Features & Comprehensive Export Matrix

## 1. Operating Models Analysis

Agro Planner caters to two distinct operational architectures governed by `Organization.type`:

### 1.1 Agro-Farming (`AGRO_FARMING`)
Designed for rural, peri-urban, and commercial farming enterprises, syndicates, and co-operatives.
* **Core Biological Tracking**:
  * Livestock entries by Batch (e.g. 500 Broiler chicks, 1,000 Layer pullets) or Individual Tagging (e.g. Stud Boer Goats `#GOAT-ZW-19`, Cattle tag `#COW-804`).
  * Dynamic age countdowns (Initial age + Days on Farm -> Current total age in days/weeks/months/years).
  * Market readiness calculations and countdown urgency badges (`NORMAL`, `PREPARE_MARKET`, `READY_FOR_SALE`).
  * Append-only lifecycle events: Initial stocking, mortality losses, offspring births, sale dispatches, slaughter/harvest, farm consumption, weight gain sampling, and contra-adjustments.
  * Vaccination & medication protocols (checkpoint agendas scheduled by day target, feed transitions, biosecurity reviews).
  * Feed inventory ledger: Bag balance tracking (50kg standard or custom kg), daily burn rates, estimated days of remaining buffer, feed conversion ratios (FCR).
  * Multi-site comparison: Comparative analytics between locations, kraals, or paddocks (density, expenses, mortalities, harvest yields).
* **Target PDF Sharing Needs**:
  * Farm managers sharing health and vaccination records with state veterinary inspectors and abattoir buyers.
  * Co-operative syndicates sharing batch mortality and feeding costs with non-resident remote investors.
  * Dispatch delivery notes and slaughter harvest sheets for butchery and retail buyers.

### 1.2 General Venture (`GENERAL_VENTURE`)
Designed for non-farming businesses, wholesale distributors, retail shops, light manufacturing, and service ventures.
* **Core Commercial Operations**:
  * Stock Inventory SKU catalog: Product categories, unit costs, retail prices, reorder thresholds, and warehouse location tags.
  * Stock Movement Ledger: Inflow receipts (Goods Received Notes), customer dispatches, warehouse-to-store transfers, damaged/expired stock write-offs, and stocktake reconciliation adjustments.
  * Operations Hub: Workflow approvals, multi-signature voucher authorizations, vendor pay-outs, and equipment maintenance logs.
* **Target PDF Sharing Needs**:
  * Warehouse supervisors sharing Goods Received Notes (GRN) and dispatch delivery waybills with suppliers and logistics partners.
  * Store managers sharing physical stocktake audit count sheets with business owners and accountants.
  * Managing directors presenting multi-sig operational expenditure authorizations to board members.

---

## 2. Common Enterprise Financials & Governance (Both Types)

Regardless of operating mode, every organization runs on the unified Capital Seed 9-pillar financial engine:
1. **Liquid Cash / Left Money**: Real physical cash in bank accounts, mobile wallets (EcoCash, InnBucks, M-Pesa), and cash registers.
2. **Capital Pool & Syndicate Equities**: Gross partner contributions, contra reversals, net equity shares, target commitment pace, and milestone pacing.
3. **Approved Expenses Feed**: Categorized operational spend with GPS coordinates, receipt photo captures, and multi-signature approvals.
4. **Sales Revenue & Reinvestment**: Total cash sales, gross margins, dividend distributions vs. retained reinvestment.
5. **Fixed Assets Ledger**: Depreciable equipment, tractors, irrigation rigs, solar power, cold storage facilities, and condition ratings.
6. **Active Stock / Livestock Value**: Fair market valuation of live biological assets or physical commercial inventory.
7. **Credit Sales & Receivables**: Customer credit sales, down-payment deposits, installment schedules, overdue warnings, and repayment logs.
8. **Loans & Debts Hub**: Supplier trade credit, equipment debt liabilities, and outgrower/partner advances with amortization schedules.
9. **Net Asset Value (NAV) & Solvency**: Consolidated balance sheet valuation, net financial position, and equity per partner.
10. **Runway Capital Planning Engine**: Strict budget gates, burn-rate modeling, contingency reserves, pledge pacing, and break-even recovery.
11. **Cryptographic SHA-256 Audit Stream**: Tamper-evident hash-chained activity stream ensuring institutional non-repudiation.

---

## 3. Comprehensive Master Export Matrix

The following matrix maps every app screen, user trigger, and business type to its dedicated, branded PDF export:

| Screen / Page | Route ID | Business Mode | PDF Document Name | Trigger Action | Key Contents & Breakdown |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Batch Detail** | `batchDetail` | `AGRO_FARMING` | **Livestock Batch Lifecycle Report** | Header Share Button | Full headcount reconciliation, mortality %, age trajectory, feed consumed, FCR, cost vs revenue margin, checkpoint log. |
| **Batch Detail** | `batchDetail` | `AGRO_FARMING` | **Vaccination & Health Certificate** | Protocol Tab Export | Completed vaccines, medications, administering operator, dates, batch ID, site location, veterinary compliance. |
| **Checkpoint Agenda** | `checkpointAgenda` | `AGRO_FARMING` | **Flock / Herd Vaccination Schedule** | Top Bar Export | Calendar of upcoming and overdue medical checkpoints, instructions, dosage, and feed transition phases. |
| **Site Comparison** | `siteCompare` | `AGRO_FARMING` | **Multi-Site Farm Performance Report** | Header Action | Comparative matrix of sites/paddocks: animal density, expenses, asset value, mortality rates, revenue per site. |
| **Feed Inventory** | `feedInventory` | `AGRO_FARMING` | **Feed Inventory & Burn Rate Audit** | Screen Header | Stock in vs daily burn, bag balances, remaining days of buffer, reorder urgency, historical feed logs. |
| **Stock Inventory** | `stockInventory` | `GENERAL_VENTURE` | **Stock Inventory Valuation & Catalog** | Catalog Header | Complete SKU catalog, unit costs, selling prices, quantities on hand, total inventory asset value, reorder warnings. |
| **Stock Movement** | `stockMovementLedger` | `GENERAL_VENTURE` | **Goods Movement & Dispatch Waybill** | Ledger Filter / Share | Inflow receipts, dispatch waybills, transfers between branches, damage adjustments, operator verification hashes. |
| **Sale Detail** | `saleDetail` | Both (Agro & General) | **Commercial Invoice & Credit Statement** | Sale Actions | Itemized goods/livestock, unit price, total, upfront cash deposit, balance remaining, payment history, extension logs. |
| **Credit Sales Hub** | `creditSales` | Both (Agro & General) | **Aged Receivables & Debtor Aging Report** | Header Share Button | Summary of all debtor accounts, overdue credit, payment statuses (`OUTSTANDING`, `PARTIALLY_PAID`, `SETTLED`), recovery total. |
| **Debt Detail** | `debtDetail` | Both (Agro & General) | **Creditor Liability & Repayment Schedule** | Debt Actions | Creditor details, principal, interest rate, repayment logs, remaining balance, linked assets or livestock batches. |
| **Loan Detail** | `loanDetail` | Both (Agro & General) | **Loan Agreement & Recovery Statement** | Loan Actions | Disbursed principal, collateral notes, agreed return date, recovery installments, borrower contact, current status. |
| **Loans & Debts Hub** | `loansDebts` | Both (Agro & General) | **Solvency & Liabilities Balance Report** | Header Export | Consolidated summary of all liabilities owed vs receivables lent, net lending position, settlement dates. |
| **Expenses Feed** | `expenses` | Both (Agro & General) | **Operational Spend & Expense Voucher** | Batch Export / Share | Itemized expenses by category (feed, wages, fuel, logistics), approval status, GPS tags, contra reversals, attached receipt notes. |
| **Runway Planning** | `runway` / `runwayPlan` | Both (Agro & General) | **Executive Runway Plan & Variance Report** | Runway Actions / Report | Planned budget lines, spend gates, executed spend, contingency reserve draw, pledge progress, break-even recovery chart. |
| **Capital Pool** | `capitalPool` | Both (Agro & General) | **Syndicate Equity & Contribution Certificate** | Header / Member Tile | Gross contributions, contra deductions, net equity %, target commitment progress, implied NAV equity, dividend distributions. |
| **Financial Summary** | `financialSummary` | Both (Agro & General) | **9-Pillars Institutional Balance Sheet** | Header Share Button | 9-Pillar net worth, Left Money, Capital Pool, Assets, Debts, Livestock/Stock Value, true Net Asset Value (NAV). |
| **Fixed Assets** | `fixedAssets` | Both (Agro & General) | **Fixed Assets & Equipment Register** | Register Header | Asset group, category, location, current quantity, depreciated value, latest physical condition rating. |
| **Audit Ledger** | `auditLedger` | Both (Agro & General) | **Tamper-Evident SHA-256 Audit Certificate** | Header Verification | Chronological immutable event stream, previous hash, current hash, actor roles, timestamped verification stamp. |

---

## 4. Deep-Dive Document Specifications

### 4.1 Livestock Batch Lifecycle Report (`AGRO_FARMING`)
* **Intended Audience**: Syndicate remote investors, farm owners, loan officers, agricultural off-takers.
* **Sections**:
  1. *Executive Header*: Batch Name/Tag (e.g. "Broiler Batch #04"), Species, Breed, Entry Date, Location/Paddock, Primary Operator.
  2. *Growth & Harvest Status*: Current Age (days/weeks), Target Market Readiness Date, Days Remaining, Countdown Urgency Badge.
  3. *Headcount Reconciliation*: Initial Stock (n), Mortalities (n), Births/Additions (n), Sold/Harvested (n), Current Live Headcount (n), Mortality Rate (%).
  4. *Feed & Weight Performance*: Total Feed Consumed (Bags & Kg), Latest Average Weight (kg), Estimated Total Biomass (kg), Feed Conversion Ratio (FCR).
  5. *Financial Margin*: Initial Stock Acquisition Cost, Accumulated Feed & Medical Disbursements, Configured/Expected Market Price, Projected Gross Revenue, Net Projected Farm Profit Margin.
  6. *Recent Event Log*: Chronological table of the last 10 lifecycle events with operator stamps and SHA-256 verification hashes.

### 4.2 Customer Commercial Invoice & Credit Statement (Shared)
* **Intended Audience**: Buyers, butcheries, supermarkets, restaurants, credit customers.
* **Sections**:
  1. *Invoice Header*: Organization Name, Contact, Invoice Reference ID (`CSALE-XXXX`), Date of Issue, Due Date.
  2. *Bill-To Information*: Customer Name, Phone, Address/Town, Agreed Payment Terms.
  3. *Itemized Breakdown*: Batch/Product Description, Unit Quantity, Unit Price, Line Total.
  4. *Financial Summary Table*: Gross Total Amount, Less Down-Payment Deposit (Cash Paid), Net Credit Balance Outstanding, Overdue Status Badge.
  5. *Payment History Audit*: Date, Amount Paid, Payment Method (Cash, EcoCash, Bank Transfer, InnBucks), Receipt Reference, Recorded By Member.
  6. *Agreed Settlement & Terms*: Formal payment notice, date extension agreements (if any), authorized signatory line.

### 4.3 Executive Runway Capital Plan & Variance Recovery Report (Shared)
* **Intended Audience**: Equity partners, bank managers, venture directors, executive committee.
* **Sections**:
  1. *Plan Metadata*: Plan Title, Organization, Start Date, Funding Deadline, Break-Even Target Date, Enforcement Mode (`STRICT` vs `ADVISORY`).
  2. *Executive Hero Badges*: Total Target Budget, Executed Ground Disbursements, Available Liquid Cash, Contingency Reserve Remaining, Break-Even Recovery Status.
  3. *Funding Layers Breakdown*: Member Pledges Collected vs Target, Planned Financing Received, Opening Cash Adopted.
  4. *Budget Lines Reconciliation*: Planned Allocation vs Actual Spend vs Variance by Line Item and Phase.
  5. *Off-Plan Spend Alerts*: Itemized listing of any unauthorized or unbudgeted disbursements logged during the plan window.
  6. *Revenue & Break-Even Trajectory*: Actual cash sales plus credit receipts realized vs total capital spent, showing exact break-even percentage.

### 4.4 9-Pillars Institutional Balance Sheet (Shared)
* **Intended Audience**: External auditors, tax authorities, syndicate partners, banks.
* **Sections**:
  1. *Enterprise Overview*: Organization Legal Entity, Registration Date, Base Currency, Date of Balance Sheet.
  2. *Current Assets (Liquid & Receivables)*: Left Money (Bank/Cash), Customer Credit Receivables, Recoverable Partner Loans Given.
  3. *Biological & Physical Inventory Assets*: Active Livestock Value (Herd/Flock Biomass), Physical Stock Inventory (Warehouses/Stores).
  4. *Non-Current Fixed Assets*: Land Infrastructure, Housing, Irrigation, Machinery, Solar/Water Equipment, less cumulative depreciation.
  5. *Total Liabilities*: Borrowed Debt Liabilities, Outstanding Supplier Trade Credit, Unearned Customer Pre-Orders.
  6. *Net Asset Value (NAV) & Equity*: Solvent Net Asset Value, Gross Partner Capital Contributed, Retained Reinvested Earnings.
  7. *Partner Equity Distribution Table*: Member Name, Role, Net Capital Contributed ($), Equity Stake (%), Implied NAV Share ($).

