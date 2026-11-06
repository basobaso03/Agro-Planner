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
import type { FeedLedgerEvent } from '../../../../types/agro.ts';

export interface StockMovementPdfInput {
  organization?: Partial<Organization> | null;
  events: FeedLedgerEvent[];
  filterType?: string;
  operatorName?: string;
}

export function generateStockMovementPdf(input: StockMovementPdfInput): jsPDF {
  const doc = initBasePdf();

  const title = 'GOODS MOVEMENT, INWARD RECEIPTS & DISPATCH AUDIT';
  const startY = drawBrandHeader(doc, {
    organization: input.organization,
    documentTitle: title,
    preparedBy: input.operatorName || 'Logistics & Dispatch Manager',
  });

  const stockInEvents = input.events.filter((e) => e.direction === 'STOCK_IN');
  const dispatchEvents = input.events.filter((e) => e.direction === 'DAILY_CONSUMPTION');
  const contraEvents = input.events.filter((e) => e.direction === 'CONTRA_REVERSAL');

  const totalInwardUnits = stockInEvents.reduce((sum, e) => sum + (e.bagsDelta || 0), 0);
  const totalOutwardUnits = dispatchEvents.reduce((sum, e) => sum + Math.abs(e.bagsDelta || 0), 0);

  // 1. Stat Cards
  const cardsY = drawStatCards(doc, startY, [
    {
      label: 'Total Movement Events',
      value: `${input.events.length} Logs`,
      subtext: `Filter: ${input.filterType || 'All Operations'}`,
    },
    {
      label: 'Goods Received (Inward)',
      value: `+${totalInwardUnits.toLocaleString()} Units`,
      subtext: `${stockInEvents.length} receipt shipments`,
      color: PDF_THEME.success,
    },
    {
      label: 'Dispatched / Outward',
      value: `-${totalOutwardUnits.toLocaleString()} Units`,
      subtext: `${dispatchEvents.length} customer dispatches`,
      color: PDF_THEME.warning,
    },
    {
      label: 'Contra Adjustments',
      value: `${contraEvents.length} Reversals`,
      subtext: 'Audited inventory corrections',
      color: contraEvents.length > 0 ? PDF_THEME.primaryMedium : PDF_THEME.textMuted,
    },
  ]);

  let currentY = cardsY + 5;

  // 2. Movements Table
  doc.setTextColor(...PDF_THEME.primaryDark);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('IMMUTABLE STOCK DISPATCH & RECEIPT LOG', PDF_THEME.marginLeft, currentY);
  currentY += 3.5;

  const rows = input.events.slice(0, 35).map((ev) => [
    ev.createdAt ? ev.createdAt.split('T')[0] : 'N/A',
    ev.feedType,
    ev.direction === 'STOCK_IN'
      ? 'GOODS RECEIVED (IN)'
      : ev.direction === 'CONTRA_REVERSAL'
      ? 'CONTRA REVERSAL'
      : 'DISPATCH / OUTFLOW',
    ev.direction === 'STOCK_IN' ? `+${ev.bagsDelta}` : `-${Math.abs(ev.bagsDelta)}`,
    ev.note || 'Recorded in inventory stream',
    ev.loggedByName || 'Storekeeper',
  ]);

  autoTable(doc, {
    ...COMMON_TABLE_STYLES,
    startY: currentY,
    head: [['Date', 'Product / SKU', 'Movement Type', 'Units Delta', 'Waybill Reference / Note', 'Authorized By']],
    body: rows,
  });

  drawMultiPageFooters(doc);

  return doc;
}

