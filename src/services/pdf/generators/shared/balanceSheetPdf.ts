import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  initBasePdf,
  drawBrandHeader,
  drawStatCards,
  drawMultiPageFooters,
} from '../../core/pdfDocumentBuilder.ts';
import { COMMON_TABLE_STYLES, PDF_THEME } from '../../core/pdfTheme.ts';
import type { Organization } from '../../../../types/organization.ts';
import type { ExtendedFinancialSummary } from '../../../../types/financials.ts';
import { formatCurrency } from '../../../../utils/currency.ts';

export interface BalanceSheetPdfInput {
  organization?: Partial<Organization> | null;
  summary: ExtendedFinancialSummary;
  operatorName?: string;
}

export function generateBalanceSheetPdf(input: BalanceSheetPdfInput): jsPDF {
  const doc = initBasePdf();

  const title = '9-PILLARS INSTITUTIONAL BALANCE SHEET & SOLVENCY STATEMENT';
  const startY = drawBrandHeader(doc, {
    organization: input.organization,
    documentTitle: title,
    preparedBy: input.operatorName || 'Principal Financial Controller',
  });

  const nav = input.summary.totalNav || input.summary.totalSyndicateNav || 0;
  const leftMoney = input.summary.leftMoney || 0;
  const assetsValue = (input.summary.totalFixedAssetsValue || 0) + (input.summary.estimatedActiveLivestockValue || 0);
  const totalLiabilities = input.summary.totalBorrowedDebtOutstanding || 0;

  // 1. Stat Cards
  const cardsY = drawStatCards(doc, startY, [
    {
      label: 'Net Asset Value (NAV)',
      value: formatCurrency(nav),
      subtext: 'True enterprise equity',
      color: nav >= 0 ? PDF_THEME.success : PDF_THEME.danger,
    },
    {
      label: 'Liquid Cash / Left Money',
      value: formatCurrency(leftMoney),
      subtext: 'Uncommitted bank & cash',
      color: PDF_THEME.primaryDark,
    },
    {
      label: 'Assets (Bio + Fixed)',
      value: formatCurrency(assetsValue),
      subtext: 'Infrastructure & livestock',
      color: PDF_THEME.primaryMedium,
    },
    {
      label: 'Creditor Liabilities',
      value: formatCurrency(totalLiabilities),
      subtext: totalLiabilities > 0 ? 'Outstanding creditor obligations' : 'Zero debt liabilities',
      color: totalLiabilities > 0 ? PDF_THEME.warning : PDF_THEME.success,
    },
  ]);

  let currentY = cardsY + 5;

  // 2. Pillars Breakdown Table
  doc.setTextColor(...PDF_THEME.primaryDark);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('9-PILLAR FINANCIAL POSITION BREAKDOWN', PDF_THEME.marginLeft, currentY);
  currentY += 3.5;

  const rows = [
    ['Pillar 1: Liquid Cash on Hand (Left Money)', formatCurrency(input.summary.leftMoney), 'Current Liquid Asset', 'Cash in banks, EcoCash & cashbox'],
    ['Pillar 2: Cumulative Capital Pool Contributed', formatCurrency(input.summary.totalPool), 'Partner Equity', 'Total capital subscribed by members'],
    ['Pillar 3: Approved Operational Disbursements', formatCurrency(input.summary.approvedExpenses), 'Historical Outflow', 'Multi-sig verified operational expenses'],
    ['Pillar 4: Cumulative Sales Revenue Realized', formatCurrency(input.summary.totalSalesRevenue), 'Income Generation', 'Gross market and farmgate revenue'],
    ['Pillar 5: Depreciated Fixed Assets Valuation', formatCurrency(input.summary.totalFixedAssetsValue), 'Non-Current Asset', 'Machinery, irrigation, housing & cold storage'],
    ['Pillar 6: Active Biological / Stock Valuation', formatCurrency(input.summary.estimatedActiveLivestockValue), 'Current Biological Asset', 'Fair value of live herd/flock biomass'],
    ['Pillar 7: Customer Credit Sales Receivables', formatCurrency(input.summary.totalCreditSalesOutstanding || 0), 'Current Receivable', 'Short-term credit extended to buyers'],
    ['Pillar 8: External Debt & Creditor Liabilities', formatCurrency(input.summary.totalBorrowedDebtOutstanding || 0), 'Current / Long-term Liability', 'Supplier trade credit and debt facilities'],
    ['Pillar 9: Recoverable Loans Given to Partners', formatCurrency(input.summary.totalLoansGivenOutstanding || 0), 'Receivable Asset', 'Outgrower advances and partner loans'],
    ['CONSOLIDATED SOLVENT NET ASSET VALUE (NAV)', formatCurrency(nav), 'TOTAL NET WORTH', 'Solvent enterprise equity position'],
  ];

  autoTable(doc, {
    ...COMMON_TABLE_STYLES,
    startY: currentY,
    head: [['Balance Sheet Pillar', 'Amount ($)', 'Balance Classification', 'Accounting Note']],
    body: rows,
    headStyles: {
      ...COMMON_TABLE_STYLES.headStyles,
      fillColor: PDF_THEME.primaryDark,
    },
  });

  drawMultiPageFooters(doc);

  return doc;
}

