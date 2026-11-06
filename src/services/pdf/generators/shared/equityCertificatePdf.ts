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
import type { MemberEquitySummary, OrgMember } from '../../../../types/agro.ts';
import { formatCurrency } from '../../../../utils/currency.ts';

export interface EquityCertificatePdfInput {
  organization?: Partial<Organization> | null;
  equitySummaries: MemberEquitySummary[];
  totalPool: number;
  totalNav: number;
  targetMember?: OrgMember | null;
  operatorName?: string;
}

export function generateEquityCertificatePdf(input: EquityCertificatePdfInput): jsPDF {
  const doc = initBasePdf();

  const isIndividual = Boolean(input.targetMember);
  const title = isIndividual
    ? `SYNDICATE CAPITAL EQUITY CERTIFICATE: ${input.targetMember?.fullName.toUpperCase()}`
    : 'SYNDICATE CAPITAL POOL & PARTNER EQUITY STATEMENT';

  const startY = drawBrandHeader(doc, {
    organization: input.organization,
    documentTitle: title,
    preparedBy: input.operatorName || 'Syndicate Administrator',
    referenceId: input.targetMember ? input.targetMember.id : 'POOL-EQUITY-MASTER',
  });

  const memberSummary = input.targetMember
    ? input.equitySummaries.find((s) => s.member.id === input.targetMember?.id)
    : null;

  // 1. Stat Cards
  const cardsY = drawStatCards(doc, startY, [
    {
      label: 'Consolidated Capital Pool',
      value: formatCurrency(input.totalPool),
      subtext: 'Gross member contributed equity',
    },
    {
      label: 'Net Asset Value (NAV)',
      value: formatCurrency(input.totalNav),
      subtext: 'Solvent enterprise net worth',
      color: PDF_THEME.primaryMedium,
    },
    {
      label: isIndividual ? 'Member Equity Share' : 'Registered Partners',
      value: isIndividual && memberSummary ? `${memberSummary.profitSharePercentage.toFixed(2)}%` : `${input.equitySummaries.length} Partners`,
      subtext: isIndividual && memberSummary ? `Implied NAV: ${formatCurrency(memberSummary.impliedNavEquityUsd)}` : '100% equity allocated',
      color: PDF_THEME.success,
    },
  ]);

  let currentY = cardsY + 5;

  // 2. Partner Distribution Table
  doc.setTextColor(...PDF_THEME.primaryDark);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('PARTNER CAPITAL CONTRIBUTIONS & OWNERSHIP STAKES', PDF_THEME.marginLeft, currentY);
  currentY += 3.5;

  const rows = input.equitySummaries.map((s) => [
    s.member.fullName,
    s.member.role.replace(/_/g, ' '),
    formatCurrency(s.grossContributed),
    formatCurrency(s.contraAdjustments),
    formatCurrency(s.netContribution),
    `${s.profitSharePercentage.toFixed(2)}%`,
    formatCurrency(s.impliedNavEquityUsd),
    s.isGoalMet ? 'GOAL MET' : `${formatCurrency(s.remainingToTargetUsd)} remaining`,
  ]);

  autoTable(doc, {
    ...COMMON_TABLE_STYLES,
    startY: currentY,
    head: [['Partner Name', 'Governance Role', 'Gross Paid', 'Contra Rev', 'Net Equity ($)', 'Equity Stake (%)', 'Implied NAV ($)', 'Target Commitment']],
    body: rows,
    headStyles: {
      ...COMMON_TABLE_STYLES.headStyles,
      fillColor: PDF_THEME.primaryDark,
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 14;

  // 3. Certificate Endorsement Block
  if (currentY > 230) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFillColor(...PDF_THEME.warmStone);
  doc.roundedRect(PDF_THEME.marginLeft, currentY, PDF_THEME.contentWidth, 32, 2, 2, 'F');
  doc.setDrawColor(...PDF_THEME.border);
  doc.setLineWidth(0.2);
  doc.roundedRect(PDF_THEME.marginLeft, currentY, PDF_THEME.contentWidth, 32, 2, 2, 'S');

  doc.setTextColor(...PDF_THEME.primaryDark);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('CERTIFICATE OF CAPITAL PARTICIPATION & SHARE ALLOCATION', PDF_THEME.marginLeft + 6, currentY + 7);

  doc.setTextColor(...PDF_THEME.textMuted);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'This document certifies that the capital equity and syndicate ownership proportions listed above represent the audited, tamper-evident record of partner capital investments. Ownership percentages determine proportional distributions of syndicate net profits and retained asset liquidation rights.',
    PDF_THEME.marginLeft + 6,
    currentY + 13,
    { maxWidth: PDF_THEME.contentWidth - 12 }
  );

  doc.setDrawColor(...PDF_THEME.border);
  doc.line(PDF_THEME.marginLeft + 6, currentY + 26, PDF_THEME.marginLeft + 65, currentY + 26);
  doc.line(PDF_THEME.contentWidth - 55, currentY + 26, PDF_THEME.contentWidth + 14, currentY + 26);

  doc.text('Syndicate Managing Trustee', PDF_THEME.marginLeft + 6, currentY + 29.5);
  doc.text('Corporate Seal & Audit Stamp', PDF_THEME.contentWidth - 55, currentY + 29.5);

  drawMultiPageFooters(doc, 'Agro Planner - Legal Capital Participation & Equity Certificate');

  return doc;
}

