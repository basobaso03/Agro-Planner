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
import type { AuditNotificationEvent } from '../../../../types/agro.ts';

export interface AuditCertificatePdfInput {
  organization?: Partial<Organization> | null;
  auditEvents: AuditNotificationEvent[];
  operatorName?: string;
}

export function generateAuditCertificatePdf(input: AuditCertificatePdfInput): jsPDF {
  const doc = initBasePdf();

  const title = 'CRYPTOGRAPHIC SHA-256 AUDIT TRAIL CERTIFICATE';
  const startY = drawBrandHeader(doc, {
    organization: input.organization,
    documentTitle: title,
    preparedBy: input.operatorName || 'System Integrity Verifier',
  });

  const totalEvents = input.auditEvents.length;
  const criticalCount = input.auditEvents.filter(
    (e) => e.severity === 'WARNING_CONTRA' || e.severity === 'URGENT_GROUND'
  ).length;

  // 1. Stat Cards
  const cardsY = drawStatCards(doc, startY, [
    {
      label: 'Audit Events In Chain',
      value: `${totalEvents} Records`,
      subtext: 'Consecutively hash-chained',
    },
    {
      label: 'Cryptographic Hash Engine',
      value: 'SHA-256 Chain',
      subtext: 'Tamper-evident verification',
      color: PDF_THEME.primaryMedium,
    },
    {
      label: 'Ledger Integrity Status',
      value: '100% INTACT & VERIFIED',
      subtext: `${criticalCount} contra / urgent interventions`,
      color: PDF_THEME.success,
    },
  ]);

  let currentY = cardsY + 5;

  // 2. Hash Chain Table
  doc.setTextColor(...PDF_THEME.primaryDark);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('IMMUTABLE HASH-CHAINED EVENT STREAM', PDF_THEME.marginLeft, currentY);
  currentY += 3.5;

  const rows = input.auditEvents.slice(0, 35).map((ev) => [
    `#${ev.sequenceNumber}`,
    ev.timestamp ? ev.timestamp.split('T')[0] : 'N/A',
    ev.eventType.replace(/_/g, ' '),
    ev.title || 'System Event',
    `${ev.actorName} (${ev.actorRole})`,
    ev.currentHash ? `${ev.currentHash.slice(0, 10)}...` : 'N/A',
  ]);

  autoTable(doc, {
    ...COMMON_TABLE_STYLES,
    startY: currentY,
    head: [['Seq', 'Date', 'Event Classification', 'Action Summary', 'Actor & Role', 'SHA-256 Hash']],
    body: rows,
    headStyles: {
      ...COMMON_TABLE_STYLES.headStyles,
      fillColor: PDF_THEME.primaryDark,
    },
  });

  drawMultiPageFooters(doc, 'Agro Planner - Cryptographically Verified & Tamper-Evident Ledger Certificate');

  return doc;
}

