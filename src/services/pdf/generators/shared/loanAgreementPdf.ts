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
import type { LoanGivenEvent } from '../../../../types/financials.ts';
import { formatCurrency } from '../../../../utils/currency.ts';

export interface LoanAgreementPdfInput {
  organization?: Partial<Organization> | null;
  loan: LoanGivenEvent;
  operatorName?: string;
}

export function generateLoanAgreementPdf(input: LoanAgreementPdfInput): jsPDF {
  const doc = initBasePdf();

  const title = `OUTGROWER LOAN CONTRACT & RECOVERY STATEMENT: ${input.loan.borrowerName.toUpperCase()}`;
  const startY = drawBrandHeader(doc, {
    organization: input.organization,
    documentTitle: title,
    preparedBy: input.operatorName || input.loan.disbursedByName || 'Outgrower Schemes Officer',
    referenceId: input.loan.id,
    date: input.loan.disbursedAt,
  });

  const principal = input.loan.principalAmount || 0;
  const balance = input.loan.remainingBalance || 0;
  const recovered = principal - balance;
  const isRecovered = input.loan.status === 'RECOVERED' || balance <= 0;

  // 1. Stat Cards
  const cardsY = drawStatCards(doc, startY, [
    {
      label: 'Principal Disbursed',
      value: formatCurrency(principal),
      subtext: input.loan.category.replace(/_/g, ' '),
    },
    {
      label: 'Cumulative Recovered',
      value: formatCurrency(recovered),
      subtext: `${((recovered / (principal || 1)) * 100).toFixed(1)}% recovery rate`,
      color: PDF_THEME.success,
    },
    {
      label: 'Remaining Receivable',
      value: formatCurrency(balance),
      subtext: isRecovered ? 'FULLY RECOVERED' : `Agreed Date: ${input.loan.agreedReturnDate ? input.loan.agreedReturnDate.split('T')[0] : 'Flexible'}`,
      color: isRecovered ? PDF_THEME.success : PDF_THEME.warning,
    },
    {
      label: 'Facility Status',
      value: input.loan.status.replace(/_/g, ' '),
      subtext: isRecovered ? 'Contract closed' : 'Active advance',
      color: isRecovered ? PDF_THEME.success : PDF_THEME.warning,
    },
  ]);

  let currentY = cardsY + 5;

  // 2. Borrower Particulars & Terms
  doc.setTextColor(...PDF_THEME.primaryDark);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('CONTRACT TERMS & COLLATERAL PARTICULARS', PDF_THEME.marginLeft, currentY);
  currentY += 3.5;

  autoTable(doc, {
    ...COMMON_TABLE_STYLES,
    startY: currentY,
    head: [['Field', 'Contract Term', 'Field', 'Contract Term']],
    body: [
      ['Borrower / Outgrower Name', input.loan.borrowerName, 'Scheme / Loan Category', input.loan.category.replace(/_/g, ' ')],
      ['Contact Phone / Address', input.loan.borrowerContact || 'Recorded on file', 'Interest Rate', input.loan.interestRatePercent ? `${input.loan.interestRatePercent}% p.a.` : '0.0% (Subsidized Advance)'],
      ['Date Disbursed', input.loan.disbursedAt ? input.loan.disbursedAt.split('T')[0] : 'N/A', 'Agreed Settlement Date', input.loan.agreedReturnDate ? input.loan.agreedReturnDate.split('T')[0] : 'Post-Harvest'],
      ['Purpose of Advance', input.loan.purposeNote || 'Input financing / Seed capital', 'Collateral / Offtake Terms', input.loan.collateralNote || 'Harvest deduction at farmgate'],
    ],
    headStyles: {
      ...COMMON_TABLE_STYLES.headStyles,
      fillColor: PDF_THEME.primaryMedium,
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // 3. Recovery Installments Table
  const recoveries = input.loan.repayments || [];
  if (recoveries.length > 0) {
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    doc.setTextColor(...PDF_THEME.primaryDark);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text('HARVEST RECOVERY & INSTALLMENT REPAYMENTS', PDF_THEME.marginLeft, currentY);
    currentY += 3.5;

    const recRows = recoveries.map((r) => [
      r.recoveredAt ? r.recoveredAt.split('T')[0] : 'N/A',
      formatCurrency(r.amount),
      r.paymentMethod || 'Harvest Produce Offset',
      r.receiptReference || 'Receipt Verified',
      r.note || 'Recovery log',
      r.recordedByName || 'Scheme Agent',
    ]);

    autoTable(doc, {
      ...COMMON_TABLE_STYLES,
      startY: currentY,
      head: [['Recovery Date', 'Amount Recovered', 'Channel / Mechanism', 'Receipt Ref', 'Note', 'Recorded By']],
      body: recRows,
    });
  }

  drawMultiPageFooters(doc);

  return doc;
}

