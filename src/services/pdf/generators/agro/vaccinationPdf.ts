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
import type { LivestockEntry, AnimalCheckpoint } from '../../../../types/agro.ts';

export interface VaccinationPdfInput {
  organization?: Partial<Organization> | null;
  livestock: LivestockEntry;
  checkpoints: AnimalCheckpoint[];
  operatorName?: string;
  veterinarianNotes?: string;
}

export function generateVaccinationPdf(input: VaccinationPdfInput): jsPDF {
  const doc = initBasePdf();

  const title = `BIOSECURITY & VACCINATION HEALTH CERTIFICATE: ${input.livestock.nameOrTag.toUpperCase()}`;
  const startY = drawBrandHeader(doc, {
    organization: input.organization,
    documentTitle: title,
    locationName: input.livestock.locationName || 'Farm Paddock',
    preparedBy: input.operatorName || 'Field Veterinarian / Health Officer',
    referenceId: input.livestock.id,
  });

  const completedCount = input.checkpoints.filter((c) => c.completed).length;
  const totalCount = input.checkpoints.length;
  const compliancePct = totalCount > 0 ? (completedCount / totalCount) * 100 : 100;

  // 1. Stat Cards
  const cardsY = drawStatCards(doc, startY, [
    {
      label: 'Batch / Flock ID',
      value: input.livestock.nameOrTag,
      subtext: `${input.livestock.species} (${input.livestock.initialHeadcount} birds/animals)`,
    },
    {
      label: 'Protocol Compliance',
      value: `${compliancePct.toFixed(0)}%`,
      subtext: `${completedCount} of ${totalCount} milestones completed`,
      color: compliancePct >= 80 ? PDF_THEME.success : PDF_THEME.warning,
    },
    {
      label: 'Biosecurity Clearance',
      value: compliancePct >= 80 ? 'CLEARED / CERTIFIED' : 'PENDING PROTOCOL',
      subtext: 'Market & Abattoir Inspected',
      color: compliancePct >= 80 ? PDF_THEME.success : PDF_THEME.warning,
    },
  ]);

  let currentY = cardsY + 5;

  // 2. Protocols Table
  doc.setTextColor(...PDF_THEME.primaryDark);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('SCHEDULED MEDICAL & BIOSECURITY PROTOCOLS', PDF_THEME.marginLeft, currentY);
  currentY += 3.5;

  const rows = input.checkpoints.map((cp) => [
    `Day ${cp.dayTarget}`,
    cp.scheduledDate ? cp.scheduledDate.split('T')[0] : '---',
    cp.category.replace(/_/g, ' '),
    cp.title,
    cp.completed ? 'COMPLETED' : 'PENDING / SCHEDULED',
    cp.completedAt ? cp.completedAt.split('T')[0] : '---',
    cp.completedNote || cp.description || 'Standard protocol followed',
  ]);

  autoTable(doc, {
    ...COMMON_TABLE_STYLES,
    startY: currentY,
    head: [['Day Target', 'Scheduled Date', 'Category', 'Protocol Title', 'Status', 'Completed Date', 'Field Notes']],
    body: rows,
    headStyles: {
      ...COMMON_TABLE_STYLES.headStyles,
      fillColor: PDF_THEME.primaryDark,
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 12;

  // 3. Veterinary Sign-off Box
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
  doc.text('VETERINARY & FARM SUPERVISOR CERTIFICATION', PDF_THEME.marginLeft + 6, currentY + 7);

  doc.setTextColor(...PDF_THEME.textMuted);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(
    input.veterinarianNotes ||
      'I hereby certify that the livestock batch identified above has undergone the biological health and vaccination protocols noted above. All medications administered adhere to statutory withdrawal periods and agricultural safety standards.',
    PDF_THEME.marginLeft + 6,
    currentY + 13,
    { maxWidth: PDF_THEME.contentWidth - 12 }
  );

  doc.setDrawColor(...PDF_THEME.border);
  doc.line(PDF_THEME.marginLeft + 6, currentY + 26, PDF_THEME.marginLeft + 70, currentY + 26);
  doc.line(PDF_THEME.contentWidth - 60, currentY + 26, PDF_THEME.contentWidth + 4, currentY + 26);

  doc.text('Authorized Field Inspector Signature', PDF_THEME.marginLeft + 6, currentY + 29.5);
  doc.text('Farm Manager / Syndicate Stamp', PDF_THEME.contentWidth - 60, currentY + 29.5);

  drawMultiPageFooters(doc, 'Agro Planner - Certified Animal Health & Food Safety Documentation');

  return doc;
}

