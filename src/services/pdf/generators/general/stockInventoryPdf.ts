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

export interface StockInventoryPdfInput {
  organization?: Partial<Organization> | null;
  items: Array<{
    feedType: string;
    locationName: string;
    remainingBags?: number;
    currentBagsBalance?: number;
    remainingKg?: number;
    currentKgBalance?: number;
    totalBagsStockedIn?: number;
    totalBagsConsumed?: number;
  }>;
  operatorName?: string;
}

export function generateStockInventoryPdf(input: StockInventoryPdfInput): jsPDF {
  const doc = initBasePdf();

  const title = 'STOCK INVENTORY AUDIT & SKU CATALOG STATEMENT';
  const startY = drawBrandHeader(doc, {
    organization: input.organization,
    documentTitle: title,
    preparedBy: input.operatorName || 'Warehouse Inventory Controller',
  });

  const totalItems = input.items.length;
  const totalUnits = input.items.reduce(
    (sum, item) => sum + (item.remainingBags ?? item.currentBagsBalance ?? 0),
    0
  );
  const lowStockCount = input.items.filter(
    (item) => (item.remainingBags ?? item.currentBagsBalance ?? 0) <= 5
  ).length;

  // 1. Stat Cards
  const cardsY = drawStatCards(doc, startY, [
    {
      label: 'Cataloged SKUs',
      value: `${totalItems} Products`,
      subtext: 'Active cataloged inventory lines',
    },
    {
      label: 'Total Units on Hand',
      value: `${totalUnits.toLocaleString()} Units`,
      subtext: 'Physical warehouse count',
    },
    {
      label: 'Inventory Health',
      value: lowStockCount > 0 ? `${lowStockCount} SKUs Low Stock` : 'Healthy Buffers',
      subtext: lowStockCount > 0 ? 'Reorder threshold triggered' : 'All SKUs above minimum',
      color: lowStockCount > 0 ? PDF_THEME.warning : PDF_THEME.success,
    },
  ]);

  let currentY = cardsY + 5;

  // 2. Inventory SKU Table
  doc.setTextColor(...PDF_THEME.primaryDark);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('WAREHOUSE STOCK BALANCES BY PRODUCT LINE', PDF_THEME.marginLeft, currentY);
  currentY += 3.5;

  const rows = input.items.map((item) => {
    const bal = item.remainingBags ?? item.currentBagsBalance ?? 0;
    const isLow = bal <= 5;
    return [
      item.feedType,
      item.locationName || 'Main Store',
      `${(item.totalBagsStockedIn || 0).toLocaleString()} units`,
      `${(item.totalBagsConsumed || 0).toLocaleString()} units`,
      `${bal.toLocaleString()} units`,
      isLow ? 'LOW STOCK (REORDER)' : 'ADEQUATE',
    ];
  });

  autoTable(doc, {
    ...COMMON_TABLE_STYLES,
    startY: currentY,
    head: [['Product Name / SKU', 'Warehouse / Branch', 'Total Inward', 'Total Dispatched', 'Stock on Hand', 'Stock Status']],
    body: rows,
    headStyles: {
      ...COMMON_TABLE_STYLES.headStyles,
      fillColor: PDF_THEME.primaryDark,
    },
  });

  drawMultiPageFooters(doc);

  return doc;
}

