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
import type {
  LivestockEntry,
  LivestockComputedStatus,
  LivestockLifecycleEvent,
} from '../../../../types/agro.ts';
import { formatCurrency } from '../../../../utils/currency.ts';

export interface BatchLifecyclePdfInput {
  organization?: Partial<Organization> | null;
  livestock: LivestockEntry;
  computedStatus: LivestockComputedStatus;
  lifecycleEvents?: LivestockLifecycleEvent[];
  operatorName?: string;
}

export function generateBatchLifecyclePdf(input: BatchLifecyclePdfInput): jsPDF {
  const doc = initBasePdf();

  const title = `LIVESTOCK BATCH LIFECYCLE REPORT: ${input.livestock.nameOrTag.toUpperCase()}`;
  const startY = drawBrandHeader(doc, {
    organization: input.organization,
    documentTitle: title,
    locationName: input.livestock.locationName || 'Farm Paddock',
    preparedBy: input.operatorName || input.livestock.createdByMemberName || 'Ground Operator',
    referenceId: input.livestock.id,
  });

  // 1. Executive Stat Cards
  const cardsY = drawStatCards(doc, startY, [
    {
      label: 'Live Headcount',
      value: `${input.computedStatus.currentLiveHeadcount} head`,
      subtext: `${input.computedStatus.totalMortalities} mortalities (${input.computedStatus.mortalityRatePercent.toFixed(1)}%)`,
    },
    {
      label: 'Current Age',
      value: input.computedStatus.formattedCurrentAge,
      subtext: `${input.computedStatus.daysOnFarm} days on farm`,
    },
    {
      label: 'Market Readiness',
      value: input.computedStatus.countdownBadgeText,
      subtext: `Target: ${input.livestock.targetSaleDate ? input.livestock.targetSaleDate.split('T')[0] : 'Open'}`,
      color:
        input.computedStatus.countdownUrgency === 'READY_FOR_SALE'
          ? PDF_THEME.success
          : input.computedStatus.countdownUrgency === 'PREPARE_MARKET'
          ? PDF_THEME.warning
          : PDF_THEME.primaryDark,
    },
    {
      label: 'Feed Consumed',
      value: `${input.computedStatus.totalFeedConsumedKg.toLocaleString()} kg`,
      subtext: `Est Biomass: ${((input.computedStatus.latestWeightAvgKg || 1) * input.computedStatus.currentLiveHeadcount).toFixed(0)} kg`,
    },
    {
      label: 'Projected Revenue',
      value: formatCurrency(input.computedStatus.totalExpectedRevenueUsd || input.computedStatus.estimatedCurrentValueUsd || 0),
      subtext: `Margin: ${formatCurrency(input.computedStatus.totalProjectedMarginUsd || 0)}`,
      color: PDF_THEME.primaryMedium,
    },
  ]);

  let currentY = cardsY + 4;

  // 2. Section: Batch Acquisition & Genetic Profile
  doc.setTextColor(...PDF_THEME.primaryDark);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('1. BATCH PROFILE & BIOLOGICAL SPECIFICATIONS', PDF_THEME.marginLeft, currentY);
  currentY += 3.5;

  autoTable(doc, {
    ...COMMON_TABLE_STYLES,
    startY: currentY,
    head: [['Parameter', 'Specification', 'Parameter', 'Specification']],
    body: [
      ['Species / Breed', input.livestock.species, 'Initial Headcount', `${input.livestock.initialHeadcount} animals`],
      ['Tracking Mode', input.livestock.trackingMode, 'Initial Stock Acquisition Cost', formatCurrency(input.livestock.purchaseCostTotal || 0)],
      ['Entry Date', input.livestock.entryDate ? input.livestock.entryDate.split('T')[0] : 'N/A', 'Target Duration', `${input.livestock.targetDurationValue} ${input.livestock.targetDurationUnit.toLowerCase()}`],
      ['Target Sale Weight', `${input.livestock.targetSaleWeightKg || 0} kg avg`, 'Funding Source', input.livestock.fundingSource || 'CASH_POOL'],
    ],
    headStyles: {
      ...COMMON_TABLE_STYLES.headStyles,
      fillColor: PDF_THEME.primaryMedium,
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 7;

  // 3. Section: Headcount & Biological Balance Table
  doc.setTextColor(...PDF_THEME.primaryDark);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('2. HEADCOUNT RECONCILIATION & DISPOSITION AUDIT', PDF_THEME.marginLeft, currentY);
  currentY += 3.5;

  autoTable(doc, {
    ...COMMON_TABLE_STYLES,
    startY: currentY,
    head: [['Metric', 'Quantity', 'Percentage of Initial Stock', 'Financial Impact / Status']],
    body: [
      ['Initial Stock Inflow', `${input.livestock.initialHeadcount} head`, '100.0%', formatCurrency(input.livestock.purchaseCostTotal || 0)],
      ['Mortality Losses', `-${input.computedStatus.totalMortalities} head`, `${input.computedStatus.mortalityRatePercent.toFixed(1)}%`, 'Unrecoverable Biological Loss'],
      ['Births / Offspring', `+${input.computedStatus.totalBirths} head`, `${((input.computedStatus.totalBirths / (input.livestock.initialHeadcount || 1)) * 100).toFixed(1)}%`, 'Flock Addition'],
      ['Harvested / Slaughtered', `${input.computedStatus.totalSlaughteredOrConsumed || 0} head`, '---', 'Abattoir / Farm Kitchen'],
      ['Sold to Market', `${input.computedStatus.totalSold} head`, `${((input.computedStatus.totalSold / (input.livestock.initialHeadcount || 1)) * 100).toFixed(1)}%`, 'Revenue Dispatch'],
      ['Current Living Inventory', `${input.computedStatus.currentLiveHeadcount} head`, `${((input.computedStatus.currentLiveHeadcount / (input.livestock.initialHeadcount || 1)) * 100).toFixed(1)}%`, 'ACTIVE ON GROUND'],
    ],
  });

  currentY = (doc as any).lastAutoTable.finalY + 7;

  // 4. Section: Lifecycle Event Audit Log
  const events = input.lifecycleEvents || input.computedStatus.lifecycleEvents || [];
  if (events.length > 0) {
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    doc.setTextColor(...PDF_THEME.primaryDark);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text('3. IMMUTABLE LIFECYCLE EVENT AUDIT STREAM', PDF_THEME.marginLeft, currentY);
    currentY += 3.5;

    const eventRows = events.slice(0, 20).map((ev) => [
      ev.createdAt ? ev.createdAt.split('T')[0] : 'N/A',
      ev.eventType.replace(/_/g, ' '),
      ev.headcountDelta > 0 ? `+${ev.headcountDelta}` : ev.headcountDelta < 0 ? `${ev.headcountDelta}` : '0',
      ev.saleRevenueAmount ? formatCurrency(ev.saleRevenueAmount) : ev.weightAvgKg ? `${ev.weightAvgKg} kg` : '---',
      ev.note || 'Recorded on ground',
      ev.loggedByName || 'Operator',
    ]);

    autoTable(doc, {
      ...COMMON_TABLE_STYLES,
      startY: currentY,
      head: [['Date', 'Event Type', 'Headcount Delta', 'Weight / Revenue', 'Operational Note', 'Logged By']],
      body: eventRows,
    });
  }

  // 5. Post-render pass: Multi-page footers & page numbers
  drawMultiPageFooters(doc);

  return doc;
}

