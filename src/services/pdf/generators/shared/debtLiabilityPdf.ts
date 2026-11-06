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
import type { DebtLiabilityEvent } from '../../../../types/financials.ts';
import { formatCurrency } from '../../../../utils/currency.ts';

export interface DebtLiabilityPdfInput {
  organization?: Partial<Organization> | null;
  debt: DebtLiabilityEvent;
  operatorName?: string;
}

export function generateDebtLiabilityPdf(input: DebtLiabilityPdfInput): jsPDF {
  const doc = initBasePdf();

  const title = `CREDITOR DEBT LIABILITY STATEMENT: ${input.debt.creditorName.toUpperCase()}`;
  const startY = drawBrandHeader(doc, {
    organization: input.organization,
    documentTitle: title,
    preparedBy: input.operatorName || input.debt.loggedByName || 'Finance Director',
    referenceId: input.debt.id,
    date: input.debt.borrowDate,
  });

  const principal = input.debt.principalAmount || 0;
  const balance = input.debt.remainingBalance || 0;
  const repaid = principal - balance;
  const isSettled = input.debt.status === 'SETTLED' || balance <= 0;

  // 1. Stat Cards
  const cardsY = drawStatCards(doc, startY, [
    {
      label: 'Principal Borrowed',
      value: formatCurrency(principal),
      subtext: input.debt.category.replace(/_/g, ' '),
    },
    {
      label: 'Cumulative Repaid',
      value: formatCurrency(repaid),
      subtext: `${((repaid / (principal || 1)) * 100).toFixed(1)}% amortization`,
      color: PDF_THEME.success,
    },
    {
      label: 'Remaining Balance',
      value: formatCurrency(balance),
      subtext: isSettled ? 'FULLY SETTLED' : `Due: ${input.debt.dueDate ? input.debt.dueDate.split('T')[0] : 'Open Amortization'}`,
      color: isSettled ? PDF_THEME.success : PDF_THEME.danger,
    },
    {
      label: 'Liability Status',
      value: input.debt.status.replace(/_/g, ' '),
      subtext: isSettled ? 'Zero outstanding creditor claim' : 'Active debt obligation',
      color: isSettled ? PDF_THEME.success : PDF_THEME.warning,
    },
  ]);

  let currentY = cardsY + 5;

  // 2. Creditor Particulars
  doc.setTextColor(...PDF_THEME.primaryDark);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('CREDITOR TERMS & FACILITY PARTICULARS', PDF_THEME.marginLeft, currentY);
  currentY += 3.5;

  autoTable(doc, {
    ...COMMON_TABLE_STYLES,
    startY: currentY,
    head: [['Field', 'Agreement Term', 'Field', 'Agreement Term']],
    body: [
      ['Creditor / Financial Institution', input.debt.creditorName, 'Category of Debt', input.debt.category.replace(/_/g, ' ')],
      ['Contact Details', input.debt.creditorContact || 'On Corporate File', 'Interest Rate', input.debt.interestRatePercent ? `${input.debt.interestRatePercent}% p.a.` : '0.0% (Zero Interest)'],
      ['Origination Borrow Date', input.debt.borrowDate ? input.debt.borrowDate.split('T')[0] : 'N/A', 'Maturity / Due Date', input.debt.dueDate ? input.debt.dueDate.split('T')[0] : 'Flexible Terms'],
      ['Purpose of Facility', input.debt.purposeNote || 'Operational financing', 'Linked Entity / Asset', input.debt.linkedBatchId || input.debt.linkedAssetId || 'General Enterprise Pool'],
    ],
    headStyles: {
      ...COMMON_TABLE_STYLES.headStyles,
      fillColor: PDF_THEME.primaryMedium,
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // 3. Repayment Schedule & History Logs
  const repayments = input.debt.repayments || [];
  if (repayments.length > 0) {
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    doc.setTextColor(...PDF_THEME.primaryDark);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text('HISTORICAL REPAYMENTS & DEBT AMORTIZATION LOG', PDF_THEME.marginLeft, currentY);
    currentY += 3.5;

    const repRows = repayments.map((r) => [
      r.paidAt ? r.paidAt.split('T')[0] : 'N/A',
      formatCurrency(r.amount),
      r.paymentMethod || 'Bank Transfer',
      r.receiptReference || 'Reference Verified',
      r.note || 'Repayment installment',
      r.paidByName || 'Treasurer',
    ]);

    autoTable(doc, {
      ...COMMON_TABLE_STYLES,
      startY: currentY,
      head: [['Payment Date', 'Repaid Amount', 'Channel / Method', 'Receipt Ref', 'Note', 'Executed By']],
      body: repRows,
    });
  }

  drawMultiPageFooters(doc);

  return doc;
}

