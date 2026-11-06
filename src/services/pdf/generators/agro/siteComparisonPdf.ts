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
import type { SiteComparisonSummary } from '../../../../types/agro.ts';
import { formatCurrency } from '../../../../utils/currency.ts';

export interface SiteComparisonPdfInput {
  organization?: Partial<Organization> | null;
  siteSummaries: SiteComparisonSummary[];
  operatorName?: string;
}

export function generateSiteComparisonPdf(input: SiteComparisonPdfInput): jsPDF {
  const doc = initBasePdf();

  const title = 'MULTI-SITE & PADDOCK COMPARATIVE PERFORMANCE REPORT';
  const startY = drawBrandHeader(doc, {
    organization: input.organization,
    documentTitle: title,
    preparedBy: input.operatorName || 'Operations Director',
  });

  const totalHeadcount = input.siteSummaries.reduce((sum, s) => sum + (s.activeAnimalHeadcount || 0), 0);
  const totalExpenses = input.siteSummaries.reduce((sum, s) => sum + (s.siteApprovedExpenses || 0), 0);
  const totalRevenue = input.siteSummaries.reduce((sum, s) => sum + (s.siteSalesRevenue || 0), 0);

  // 1. Stat Cards
  const cardsY = drawStatCards(doc, startY, [
    {
      label: 'Monitored Sites',
      value: `${input.siteSummaries.length} Locations`,
      subtext: 'Paddocks, Kraals & Facilities',
    },
    {
      label: 'Total Active Animals',
      value: `${totalHeadcount.toLocaleString()} head`,
      subtext: 'Across all enterprise locations',
    },
    {
      label: 'Approved Disbursements',
      value: formatCurrency(totalExpenses),
      subtext: 'Operational feed & labor spend',
      color: PDF_THEME.warning,
    },
    {
      label: 'Realized Revenue',
      value: formatCurrency(totalRevenue),
      subtext: `Net: ${formatCurrency(totalRevenue - totalExpenses)}`,
      color: totalRevenue >= totalExpenses ? PDF_THEME.success : PDF_THEME.danger,
    },
  ]);

  let currentY = cardsY + 5;

  // 2. Comparative Matrix Table
  doc.setTextColor(...PDF_THEME.primaryDark);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPARATIVE LOCATION KPI BENCHMARKS', PDF_THEME.marginLeft, currentY);
  currentY += 3.5;

  const rows = input.siteSummaries.map((s) => [
    s.location.name,
    s.location.region || 'Commercial Zone',
    `${s.activeAnimalHeadcount.toLocaleString()} head (${s.activeBatchCount} batches)`,
    `${s.siteMortalityRatePercent.toFixed(1)}%`,
    formatCurrency(s.siteApprovedExpenses),
    formatCurrency(s.siteFixedAssetValue),
    formatCurrency(s.siteSalesRevenue),
  ]);

  autoTable(doc, {
    ...COMMON_TABLE_STYLES,
    startY: currentY,
    head: [['Farm Site / Paddock', 'Region', 'Active Headcount', 'Mortality Rate', 'Disbursed Cost', 'Asset Value', 'Sales Revenue']],
    body: rows,
    headStyles: {
      ...COMMON_TABLE_STYLES.headStyles,
      fillColor: PDF_THEME.primaryDark,
    },
  });

  drawMultiPageFooters(doc);

  return doc;
}

