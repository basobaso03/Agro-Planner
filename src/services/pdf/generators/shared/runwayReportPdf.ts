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
import type { RunwayPlan, RunwayLine, RunwayFundingLayers } from '../../../../types/runway.ts';
import type { ExpenseLedgerEvent, LivestockLifecycleEvent, CreditSaleEvent } from '../../../../types/agro.ts';
import { buildVarianceReport, findOffPlanSpend, computeRecovery } from '../../../../utils/runway.ts';
import { formatCurrency } from '../../../../utils/currency.ts';

export interface RunwayReportPdfInput {
  organization?: Partial<Organization> | null;
  plan: RunwayPlan;
  lines: RunwayLine[];
  expenses: ExpenseLedgerEvent[];
  layers: RunwayFundingLayers;
  livestockEvents?: LivestockLifecycleEvent[];
  creditSales?: CreditSaleEvent[];
  operatorName?: string;
}

export function generateRunwayReportPdf(input: RunwayReportPdfInput): jsPDF {
  const doc = initBasePdf();

  const title = `EXECUTIVE RUNWAY PLAN & CAPITAL VARIANCE REPORT: ${(input.plan.name || input.plan.title || 'Plan').toUpperCase()}`;
  const startY = drawBrandHeader(doc, {
    organization: input.organization,
    documentTitle: title,
    preparedBy: input.operatorName || 'Runway Capital Committee',
    referenceId: input.plan.id,
    date: input.plan.startDate,
  });

  // Calculate Cash Sales & Credit Receipts for recovery
  const planStart = new Date(input.plan.activatedAt || input.plan.startDate).getTime();
  const planEnd = input.plan.completedAt ? new Date(input.plan.completedAt).getTime() : Infinity;

  const cashSales = (input.livestockEvents || [])
    .filter((e) => {
      if (e.eventType !== 'SALE_DISPATCH' || !(e.saleRevenueAmount && e.saleRevenueAmount > 0)) return false;
      const t = new Date(e.createdAt).getTime();
      return t >= planStart && t <= planEnd;
    })
    .reduce((acc, e) => acc + (e.saleRevenueAmount || 0), 0);

  const creditReceipts = (input.creditSales || []).reduce((acc, cs) => {
    const saleDate = new Date(cs.createdAt || (cs as any).saleDate || 0).getTime();
    const deposit = saleDate >= planStart && saleDate <= planEnd ? cs.depositPaidCash || 0 : 0;
    const paymentLogsSum = (cs.paymentLogs || [])
      .filter((p) => {
        const t = new Date(p.paidAt).getTime();
        return t >= planStart && t <= planEnd;
      })
      .reduce((pAcc, p) => pAcc + (p.amount || 0), 0);
    return acc + deposit + paymentLogsSum;
  }, 0);

  const varianceReport = buildVarianceReport(input.plan, input.lines, input.expenses, [], cashSales, creditReceipts);
  const offPlanExpenses = findOffPlanSpend(input.plan, input.expenses);
  const recovery = computeRecovery(input.layers.executed, cashSales, creditReceipts);

  // 1. Stat Cards
  const cardsY = drawStatCards(doc, startY, [
    {
      label: 'Target Capital Budget',
      value: formatCurrency(input.layers.target || 0),
      subtext: `Target Basis: ${input.plan.targetBasis}`,
    },
    {
      label: 'Executed Ground Spend',
      value: formatCurrency(input.layers.executed || 0),
      subtext: `${((input.layers.executed / (input.layers.target || 1)) * 100).toFixed(0)}% budget utilized`,
      color: PDF_THEME.warning,
    },
    {
      label: 'Collected Capital',
      value: formatCurrency(input.layers.collected || 0),
      subtext: `Pledged: ${formatCurrency(input.layers.pledged || 0)}`,
      color: PDF_THEME.primaryMedium,
    },
    {
      label: 'Break-Even Recovery',
      value: `${(recovery.recoveredPct || 0).toFixed(1)}%`,
      subtext: recovery.isBreakEven
        ? 'BREAK-EVEN ACHIEVED'
        : `Deficit: ${formatCurrency(recovery.shortfall)}`,
      color: recovery.isBreakEven ? PDF_THEME.success : PDF_THEME.danger,
    },
  ]);

  let currentY = cardsY + 5;

  // 2. Budget vs Actual Variance Table
  doc.setTextColor(...PDF_THEME.primaryDark);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('LINE-BY-LINE BUDGET ALLOCATIONS & VARIANCE', PDF_THEME.marginLeft, currentY);
  currentY += 3.5;

  const lineRows = (varianceReport.lineReports || []).map((lv) => [
    lv.title,
    lv.category,
    formatCurrency(lv.planned),
    formatCurrency(lv.spent),
    formatCurrency(lv.variance),
    lv.status.replace(/_/g, ' '),
  ]);

  autoTable(doc, {
    ...COMMON_TABLE_STYLES,
    startY: currentY,
    head: [['Line Item Name', 'Kind', 'Budget Planned', 'Ground Spend', 'Variance ($)', 'Status']],
    body: lineRows,
    headStyles: {
      ...COMMON_TABLE_STYLES.headStyles,
      fillColor: PDF_THEME.primaryDark,
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // 3. Off-Plan Spend Section (if any)
  if (offPlanExpenses.length > 0) {
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    doc.setTextColor(...PDF_THEME.danger);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text('UNBUDGETED / OFF-PLAN EXPENDITURE ALERTS', PDF_THEME.marginLeft, currentY);
    currentY += 3.5;

    const offRows = offPlanExpenses.map((oe) => [
      oe.createdAt ? oe.createdAt.split('T')[0] : 'N/A',
      oe.category.replace(/_/g, ' '),
      formatCurrency(oe.amount),
      oe.note || 'No budget line assigned',
      oe.loggedByName || 'Operator',
    ]);

    autoTable(doc, {
      ...COMMON_TABLE_STYLES,
      startY: currentY,
      head: [['Date', 'Category', 'Amount', 'Expense Description', 'Logged By']],
      body: offRows,
      headStyles: {
        ...COMMON_TABLE_STYLES.headStyles,
        fillColor: PDF_THEME.danger,
      },
    });
  }

  drawMultiPageFooters(doc, 'Agro Planner - Runway Capital Governance & Spend Control Statement');

  return doc;
}

