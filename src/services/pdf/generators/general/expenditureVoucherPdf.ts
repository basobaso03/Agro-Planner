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
import type { ExpenseLedgerEvent } from '../../../../types/agro.ts';
import { formatCurrency } from '../../../../utils/currency.ts';

export interface ExpenditureVoucherPdfInput {
  organization?: Partial<Organization> | null;
  expenses: ExpenseLedgerEvent[];
  operatorName?: string;
  categoryFilter?: string;
}

export function generateExpenditureVoucherPdf(input: ExpenditureVoucherPdfInput): jsPDF {
  const doc = initBasePdf();

  const title = 'OPERATIONAL EXPENDITURE & DISBURSEMENT VOUCHER';
  const startY = drawBrandHeader(doc, {
    organization: input.organization,
    documentTitle: title,
    preparedBy: input.operatorName || 'Treasurer / Finance Officer',
  });

  const totalGross = input.expenses.reduce((sum, e) => sum + (e.direction === 'DEDUCTION' ? e.amount : -e.amount), 0);
  const approvedCount = input.expenses.filter((e) => e.approvalStatus === 'APPROVED').length;
  const pendingCount = input.expenses.filter((e) => e.approvalStatus === 'PENDING_MULTISIG').length;

  // 1. Stat Cards
  const cardsY = drawStatCards(doc, startY, [
    {
      label: 'Total Disbursements',
      value: formatCurrency(totalGross),
      subtext: `${input.expenses.length} voucher records`,
      color: PDF_THEME.primaryDark,
    },
    {
      label: 'Multi-Sig Approved',
      value: `${approvedCount} Vouchers`,
      subtext: 'Fully verified & countersigned',
      color: PDF_THEME.success,
    },
    {
      label: 'Pending Multi-Sig',
      value: `${pendingCount} Vouchers`,
      subtext: pendingCount > 0 ? 'Awaiting treasurer authorization' : 'Zero pending approvals',
      color: pendingCount > 0 ? PDF_THEME.warning : PDF_THEME.success,
    },
  ]);

  let currentY = cardsY + 5;

  // 2. Voucher Table
  doc.setTextColor(...PDF_THEME.primaryDark);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('AUTHORIZED OPERATIONAL EXPENSE VOUCHERS', PDF_THEME.marginLeft, currentY);
  currentY += 3.5;

  const rows = input.expenses.slice(0, 30).map((e) => [
    e.createdAt ? e.createdAt.split('T')[0] : 'N/A',
    e.category.replace(/_/g, ' '),
    e.direction === 'CONTRA_REVERSAL' ? `-${formatCurrency(e.amount)} (CONTRA)` : formatCurrency(e.amount),
    e.approvalStatus.replace(/_/g, ' '),
    e.note || 'Authorized expenditure',
    e.loggedByName || 'Operator',
  ]);

  autoTable(doc, {
    ...COMMON_TABLE_STYLES,
    startY: currentY,
    head: [['Date', 'Category', 'Disbursed Amount', 'Multi-Sig Status', 'Payment Description & Purpose', 'Disbursed By']],
    body: rows,
  });

  currentY = (doc as any).lastAutoTable.finalY + 12;

  // 3. Signatory Block
  if (currentY > 230) {
    doc.addPage();
    currentY = 20;
  }

  doc.setDrawColor(...PDF_THEME.border);
  doc.line(PDF_THEME.marginLeft, currentY + 14, PDF_THEME.marginLeft + 65, currentY + 14);
  doc.line(PDF_THEME.contentWidth - 55, currentY + 14, PDF_THEME.contentWidth + 14, currentY + 14);

  doc.setFontSize(7);
  doc.setTextColor(...PDF_THEME.textMuted);
  doc.text('Authorized Finance Officer / Treasurer', PDF_THEME.marginLeft, currentY + 18);
  doc.text('Managing Director / Executive Approval', PDF_THEME.contentWidth - 55, currentY + 18);

  drawMultiPageFooters(doc);

  return doc;
}

