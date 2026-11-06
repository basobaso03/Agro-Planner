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
import type { FeedInventorySummary, FeedLedgerEvent } from '../../../../types/agro.ts';

export interface FeedInventoryPdfInput {
  organization?: Partial<Organization> | null;
  summaries: FeedInventorySummary[];
  feedEvents?: FeedLedgerEvent[];
  operatorName?: string;
}

export function generateFeedInventoryPdf(input: FeedInventoryPdfInput): jsPDF {
  const doc = initBasePdf();

  const title = 'FEED INVENTORY AUDIT & DAILY BURN RATE REPORT';
  const startY = drawBrandHeader(doc, {
    organization: input.organization,
    documentTitle: title,
    preparedBy: input.operatorName || 'Feed Store Supervisor',
  });

  const totalBagsInStock = input.summaries.reduce((sum, s) => sum + (s.remainingBags || s.currentBagsBalance || 0), 0);
  const totalDailyBurn = input.summaries.reduce((sum, s) => sum + (s.estimatedDailyBurnBags || 0), 0);
  const averageDaysBuffer = totalDailyBurn > 0 ? (totalBagsInStock / totalDailyBurn).toFixed(0) : '30+';

  // 1. Stat Cards
  const cardsY = drawStatCards(doc, startY, [
    {
      label: 'Total Bags in Stock',
      value: `${totalBagsInStock.toFixed(1)} Bags`,
      subtext: `${(totalBagsInStock * 50).toLocaleString()} kg total biomass feed`,
    },
    {
      label: 'Daily Feed Burn Rate',
      value: `${totalDailyBurn.toFixed(1)} Bags/Day`,
      subtext: `${(totalDailyBurn * 50).toFixed(0)} kg daily consumption`,
    },
    {
      label: 'Inventory Buffer',
      value: `${averageDaysBuffer} Days Remaining`,
      subtext: totalDailyBurn > 0 && Number(averageDaysBuffer) < 7 ? 'CRITICAL: REORDER REQUIRED' : 'Adequate Supply Buffer',
      color: totalDailyBurn > 0 && Number(averageDaysBuffer) < 7 ? PDF_THEME.danger : PDF_THEME.success,
    },
  ]);

  let currentY = cardsY + 5;

  // 2. Feed Type Summary Table
  doc.setTextColor(...PDF_THEME.primaryDark);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('1. FEED BALANCES BY RATION & LOCATION', PDF_THEME.marginLeft, currentY);
  currentY += 3.5;

  const summaryRows = input.summaries.map((s) => [
    s.locationName || 'Main Farm Site',
    s.feedType,
    `${(s.totalBagsStockedIn || 0).toFixed(1)} bags`,
    `${(s.totalBagsConsumed || 0).toFixed(1)} bags`,
    `${(s.remainingBags || s.currentBagsBalance || 0).toFixed(1)} bags`,
    `${((s.remainingBags || s.currentBagsBalance || 0) * (s.kgPerBag || 50)).toLocaleString()} kg`,
    s.daysRemaining !== undefined && s.daysRemaining < 999 ? `${s.daysRemaining} days` : 'N/A',
  ]);

  autoTable(doc, {
    ...COMMON_TABLE_STYLES,
    startY: currentY,
    head: [['Location', 'Feed Type / Ration', 'Total Stock In', 'Total Consumed', 'Bags Remaining', 'Kg Remaining', 'Days Buffer']],
    body: summaryRows,
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // 3. Recent Feed Logs Table
  const events = input.feedEvents || [];
  if (events.length > 0) {
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    doc.setTextColor(...PDF_THEME.primaryDark);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text('2. RECENT FEED MOVEMENTS & CONSUMPTION LOGS', PDF_THEME.marginLeft, currentY);
    currentY += 3.5;

    const eventRows = events.slice(0, 15).map((ev) => [
      ev.createdAt ? ev.createdAt.split('T')[0] : 'N/A',
      ev.feedType,
      ev.direction === 'STOCK_IN' ? `+${ev.bagsDelta} bags (IN)` : `-${Math.abs(ev.bagsDelta)} bags (OUT)`,
      ev.note || 'Feed logged on ground',
      ev.loggedByName || 'Operator',
    ]);

    autoTable(doc, {
      ...COMMON_TABLE_STYLES,
      startY: currentY,
      head: [['Date', 'Ration Type', 'Movement Delta', 'Notes & Livestock Batch', 'Logged By']],
      body: eventRows,
    });
  }

  drawMultiPageFooters(doc);

  return doc;
}

