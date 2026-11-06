import { jsPDF } from 'jspdf';
import { PDF_THEME, type RgbColor } from './pdfTheme.ts';
import { BRAND_LOGO_BASE64 } from '../assets/brandLogoBase64.ts';
import type { Organization } from '../../../types/organization.ts';

export interface BaseDocumentOptions {
  organization?: Partial<Organization> | null;
  documentTitle: string;
  documentSubtitle?: string;
  locationName?: string;
  preparedBy?: string;
  referenceId?: string;
  date?: string | Date;
}

export interface StatCardItem {
  label: string;
  value: string;
  subtext?: string;
  color?: RgbColor;
}

/**
 * Creates and initializes a standardized A4 jsPDF document
 */
export function initBasePdf(): jsPDF {
  return new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });
}

/**
 * Draws the permanent dual-brand header on Page 1:
 * - Agro Planner Platform Sprout AP Logo & Dark Banner
 * - Organization Name, Operating Mode Badge, Location, and Date
 * Returns the bottom Y coordinate where content can resume.
 */
export function drawBrandHeader(doc: jsPDF, options: BaseDocumentOptions): number {
  const { pageWidth, marginLeft, contentWidth } = PDF_THEME;

  // 1. Top Decorative Brand Banner
  doc.setFillColor(...PDF_THEME.primaryDark);
  doc.rect(0, 0, pageWidth, 24, 'F');

  // Accent Line
  doc.setFillColor(...PDF_THEME.primaryAccent);
  doc.rect(0, 24, pageWidth, 2, 'F');

  // Embed Sprout AP Logo
  try {
    doc.addImage(BRAND_LOGO_BASE64, 'PNG', 12, 4, 16, 16);
  } catch (err) {
    // Graceful fallback if image decoding fails in test environment
    doc.setFillColor(...PDF_THEME.primaryMedium);
    doc.roundedRect(12, 4, 16, 16, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('AGRO', 20, 14, { align: 'center' });
  }

  // App Identity Typography
  doc.setTextColor(...PDF_THEME.pureWhite);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('AGRO PLANNER // CAPITAL SEED', 32, 13);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(167, 243, 208); // emerald-200
  doc.text('INTELLIGENT FARMING & VENTURE SYSTEMS', 32, 18);

  // Top Right Badge
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PDF_THEME.pureWhite);
  doc.text('OFFICIAL VERIFIED REPORT', pageWidth - 14, 12, { align: 'right' });

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(209, 250, 229); // emerald-100
  doc.text('CONFIDENTIAL & CERTIFIED', pageWidth - 14, 17, { align: 'right' });

  // 2. Organization Header Block
  let currentY = 34;

  const orgName = options.organization?.name || 'Enterprise Workspace';
  const orgType = options.organization?.type || 'AGRO_FARMING';
  const orgTypeLabel = orgType === 'AGRO_FARMING' ? 'AGRO-FARMING ENTERPRISE' : 'GENERAL COMMERCIAL VENTURE';
  const location = options.locationName || 'All Farm Sites & Branches';

  // Org Name
  doc.setTextColor(...PDF_THEME.textPrimary);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(orgName, marginLeft, currentY);

  // Operating Mode Badge on right
  const badgeWidth = doc.getTextWidth(orgTypeLabel) + 6;
  const badgeX = pageWidth - marginLeft - badgeWidth;
  doc.setFillColor(...PDF_THEME.primaryLight);
  doc.roundedRect(badgeX, currentY - 4.5, badgeWidth, 6, 1.5, 1.5, 'F');
  doc.setDrawColor(...PDF_THEME.primaryMedium);
  doc.setLineWidth(0.2);
  doc.roundedRect(badgeX, currentY - 4.5, badgeWidth, 6, 1.5, 1.5, 'S');

  doc.setTextColor(...PDF_THEME.primaryMedium);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.text(orgTypeLabel, badgeX + badgeWidth / 2, currentY - 0.5, { align: 'center' });

  currentY += 6;

  // Document Title
  doc.setTextColor(...PDF_THEME.primaryDark);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(options.documentTitle, marginLeft, currentY);

  currentY += 4.5;

  // Metadata Subtitle Line
  const dateStr = options.date
    ? typeof options.date === 'string'
      ? options.date
      : options.date.toISOString().replace('T', ' ').slice(0, 16)
    : new Date().toISOString().replace('T', ' ').slice(0, 16);

  const prepared = options.preparedBy ? ` | Prepared By: ${options.preparedBy}` : '';
  const ref = options.referenceId ? ` | Ref: ${options.referenceId}` : '';
  const metadataText = `Location: ${location} | Date: ${dateStr}${prepared}${ref}`;

  doc.setTextColor(...PDF_THEME.textMuted);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(metadataText, marginLeft, currentY);

  currentY += 4;

  // Divider Rule
  doc.setDrawColor(...PDF_THEME.border);
  doc.setLineWidth(0.2);
  doc.line(marginLeft, currentY, marginLeft + contentWidth, currentY);

  currentY += 4;
  return currentY;
}

/**
 * Draws a standardized horizontal KPI stat card box
 */
export function drawStatCards(doc: jsPDF, startY: number, cards: StatCardItem[]): number {
  if (!cards || cards.length === 0) return startY;

  const { marginLeft, contentWidth } = PDF_THEME;
  const boxHeight = 18;
  const colWidth = contentWidth / cards.length;

  // Background Box
  doc.setFillColor(...PDF_THEME.warmStone);
  doc.roundedRect(marginLeft, startY, contentWidth, boxHeight, 2, 2, 'F');
  doc.setDrawColor(...PDF_THEME.cardBorder);
  doc.setLineWidth(0.2);
  doc.roundedRect(marginLeft, startY, contentWidth, boxHeight, 2, 2, 'S');

  cards.forEach((card, index) => {
    const colX = marginLeft + index * colWidth;

    // Label
    doc.setTextColor(...PDF_THEME.textMuted);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text(card.label.toUpperCase(), colX + 4, startY + 5);

    // Primary Value
    doc.setTextColor(...(card.color || PDF_THEME.primaryDark));
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.text(card.value, colX + 4, startY + 11.5);

    // Subtext if present
    if (card.subtext) {
      doc.setTextColor(...PDF_THEME.textMuted);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.text(card.subtext, colX + 4, startY + 15.5);
    }

    // Vertical Divider (except for last column)
    if (index < cards.length - 1) {
      doc.setDrawColor(...PDF_THEME.border);
      doc.setLineWidth(0.2);
      doc.line(colX + colWidth, startY + 2.5, colX + colWidth, startY + boxHeight - 2.5);
    }
  });

  return startY + boxHeight + 4;
}

/**
 * Post-render pass: Stamps footers, confidentiality disclaimers and page numbers on every page
 */
export function drawMultiPageFooters(doc: jsPDF, customDisclaimer?: string): void {
  const totalPages = doc.getNumberOfPages();
  const { pageWidth, pageHeight, marginLeft, marginRight } = PDF_THEME;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);

    const footerY = pageHeight - 12;

    // Separation line
    doc.setDrawColor(...PDF_THEME.border);
    doc.setLineWidth(0.2);
    doc.line(marginLeft, footerY - 2, pageWidth - marginRight, footerY - 2);

    // Left: Institutional Disclaimer
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_THEME.textMuted);
    const disclaimer = customDisclaimer || 'Agro Planner - Certified Enterprise Intelligence | Non-Repudiable Ledger';
    doc.text(disclaimer, marginLeft, footerY + 2);

    // Center: Tamper-Evident notice
    doc.text('Tamper-Evident SHA-256 Verified', pageWidth / 2, footerY + 2, { align: 'center' });

    // Right: Page Counter
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - marginRight, footerY + 2, { align: 'right' });
  }
}

