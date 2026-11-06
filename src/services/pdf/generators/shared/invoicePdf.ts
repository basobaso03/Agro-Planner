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
import type { CreditSaleEvent } from '../../../../types/financials.ts';
import { formatCurrency } from '../../../../utils/currency.ts';

export interface InvoicePdfInput {
  organization?: Partial<Organization> | null;
  sale: CreditSaleEvent;
  operatorName?: string;
}

export function generateInvoicePdf(input: InvoicePdfInput): jsPDF {
  const doc = initBasePdf();

  const title = `TAX INVOICE & STATEMENT OF ACCOUNT: ${input.sale.id}`;
  const startY = drawBrandHeader(doc, {
    organization: input.organization,
    documentTitle: title,
    locationName: input.sale.locationName || 'Main Enterprise Branch',
    preparedBy: input.operatorName || input.sale.loggedByName || 'Sales Administrator',
    referenceId: input.sale.id,
    date: input.sale.saleDate,
  });

  const totalSale = input.sale.totalSaleAmount || input.sale.totalSaleAmountUsd || 0;
  const depositPaid = input.sale.depositPaidCash || input.sale.upfrontDepositUsd || 0;
  const balanceRemaining = input.sale.creditBalanceRemaining ?? input.sale.remainingCreditBalanceUsd ?? (totalSale - depositPaid);
  const isSettled = input.sale.status === 'SETTLED' || balanceRemaining <= 0;

  // 1. Stat Cards
  const cardsY = drawStatCards(doc, startY, [
    {
      label: 'Invoice Total',
      value: formatCurrency(totalSale),
      subtext: `Total goods & sales value`,
    },
    {
      label: 'Deposit Paid (Cash)',
      value: formatCurrency(depositPaid),
      subtext: 'Upfront liquid deposit',
      color: PDF_THEME.success,
    },
    {
      label: 'Credit Balance Due',
      value: formatCurrency(balanceRemaining),
      subtext: isSettled ? 'FULLY SETTLED' : `Due: ${input.sale.agreedSettlementDate ? input.sale.agreedSettlementDate.split('T')[0] : 'Immediate'}`,
      color: isSettled ? PDF_THEME.success : PDF_THEME.danger,
    },
    {
      label: 'Account Status',
      value: input.sale.status.replace(/_/g, ' '),
      subtext: isSettled ? 'Zero outstanding liabilities' : 'Awaiting installment',
      color: isSettled ? PDF_THEME.success : PDF_THEME.warning,
    },
  ]);

  let currentY = cardsY + 5;

  // 2. Bill To Box
  doc.setFillColor(...PDF_THEME.warmStone);
  doc.roundedRect(PDF_THEME.marginLeft, currentY, PDF_THEME.contentWidth, 18, 2, 2, 'F');
  doc.setDrawColor(...PDF_THEME.border);
  doc.setLineWidth(0.2);
  doc.roundedRect(PDF_THEME.marginLeft, currentY, PDF_THEME.contentWidth, 18, 2, 2, 'S');

  doc.setTextColor(...PDF_THEME.textMuted);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO / CUSTOMER DETAILS:', PDF_THEME.marginLeft + 4, currentY + 4.5);

  doc.setTextColor(...PDF_THEME.textPrimary);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(input.sale.customerName || 'Direct Customer', PDF_THEME.marginLeft + 4, currentY + 10);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...PDF_THEME.textMuted);
  const contactText = `Phone: ${input.sale.customerPhone || 'N/A'} | Terms: ${input.sale.paymentTerms || 'Standard Credit Terms'} | Address: ${input.sale.customerAddress || 'Local Market'}`;
  doc.text(contactText, PDF_THEME.marginLeft + 4, currentY + 14.5);

  currentY += 23;

  // 3. Line Items Table
  doc.setTextColor(...PDF_THEME.primaryDark);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('ITEMIZED GOODS & COMMODITIES DELIVERED', PDF_THEME.marginLeft, currentY);
  currentY += 3.5;

  const itemRows: any[] = [];
  if (input.sale.items && input.sale.items.length > 0) {
    input.sale.items.forEach((item, idx) => {
      itemRows.push([
        `Item #${idx + 1}`,
        item.livestockName || input.sale.livestockName || 'Commercial Commodity',
        `${item.quantitySold} units`,
        formatCurrency(item.unitPrice),
        formatCurrency(item.totalAmount || item.quantitySold * item.unitPrice),
      ]);
    });
  } else {
    itemRows.push([
      'Item #1',
      input.sale.livestockName || 'Commercial Farm Livestock / Goods',
      `${input.sale.quantitySold} units`,
      formatCurrency(input.sale.unitPrice),
      formatCurrency(totalSale),
    ]);
  }

  // Summary rows at bottom of table
  itemRows.push([
    '',
    '',
    '',
    'Gross Subtotal:',
    formatCurrency(totalSale),
  ]);
  itemRows.push([
    '',
    '',
    '',
    'Less Deposit Paid:',
    `-${formatCurrency(depositPaid)}`,
  ]);
  itemRows.push([
    '',
    '',
    '',
    'NET BALANCE REMAINING:',
    formatCurrency(balanceRemaining),
  ]);

  autoTable(doc, {
    ...COMMON_TABLE_STYLES,
    startY: currentY,
    head: [['Item Code', 'Description', 'Quantity Delivered', 'Unit Price', 'Line Total']],
    body: itemRows,
    headStyles: {
      ...COMMON_TABLE_STYLES.headStyles,
      fillColor: PDF_THEME.primaryDark,
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // 4. Payment History Logs Table
  const payments = input.sale.paymentLogs || [];
  if (payments.length > 0) {
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    doc.setTextColor(...PDF_THEME.primaryDark);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text('RECOVERED INSTALLMENTS & PAYMENT AUDIT', PDF_THEME.marginLeft, currentY);
    currentY += 3.5;

    const paymentRows = payments.map((p) => [
      p.paidAt ? p.paidAt.split('T')[0] : 'N/A',
      formatCurrency(p.amount),
      p.paymentMethod || 'Cash',
      p.receiptReference || 'Receipt on file',
      p.note || 'Installment collected',
      p.recordedByName || 'Finance Officer',
    ]);

    autoTable(doc, {
      ...COMMON_TABLE_STYLES,
      startY: currentY,
      head: [['Payment Date', 'Amount Paid', 'Payment Method', 'Receipt Ref', 'Note', 'Recorded By']],
      body: paymentRows,
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  // 5. Signatures Block
  if (currentY > 240) {
    doc.addPage();
    currentY = 20;
  }

  doc.setDrawColor(...PDF_THEME.border);
  doc.line(PDF_THEME.marginLeft, currentY + 12, PDF_THEME.marginLeft + 65, currentY + 12);
  doc.line(PDF_THEME.contentWidth - 55, currentY + 12, PDF_THEME.contentWidth + 14, currentY + 12);

  doc.setFontSize(7);
  doc.setTextColor(...PDF_THEME.textMuted);
  doc.text('Authorized Enterprise Signature', PDF_THEME.marginLeft, currentY + 16);
  doc.text('Customer Acknowledgment & Signature', PDF_THEME.contentWidth - 55, currentY + 16);

  drawMultiPageFooters(doc);

  return doc;
}

