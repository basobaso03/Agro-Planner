/**
 * PDF Visual Theme, Branding Palette & Dimensional Constants
 */

export type RgbColor = [number, number, number];

export const PDF_THEME = {
  // Brand Palette
  primaryDark: [6, 78, 59] as RgbColor,      // #064e3b - Forest Emerald (Header banner, major headings)
  primaryAccent: [16, 185, 129] as RgbColor, // #10b981 - Emerald Accent rule & highlights
  primaryMedium: [4, 120, 87] as RgbColor,   // #047857 - Section subtitles & primary badges
  primaryLight: [236, 253, 245] as RgbColor, // #ecfdf5 - Badge background emerald tint

  // Neutral Document Palette
  warmStone: [248, 246, 240] as RgbColor,    // #f8f6f0 - KPI summary box / stat cards
  zebraRow: [248, 250, 252] as RgbColor,     // #f8fafc - Table alternating rows
  textPrimary: [15, 23, 42] as RgbColor,     // #0f172a - Midnight Slate (high contrast body)
  textMuted: [100, 116, 139] as RgbColor,    // #64748b - Captions, subtitles, footers
  border: [226, 232, 240] as RgbColor,       // #e2e8f0 - Hairlines, card borders
  cardBorder: [203, 213, 225] as RgbColor,   // #cbd5e1 - Card strokes
  pureWhite: [255, 255, 255] as RgbColor,

  // Semantic Indicators
  danger: [220, 38, 38] as RgbColor,         // #dc2626 - Mortalities, overdue, alert
  dangerLight: [254, 242, 242] as RgbColor,  // #fef2f2 - Danger badge bg
  success: [22, 163, 74] as RgbColor,        // #16a34a - Break-even, goals met
  successLight: [240, 253, 244] as RgbColor, // #f0fdf4 - Success badge bg
  warning: [217, 119, 6] as RgbColor,        // #d97706 - Pending, advisory
  warningLight: [254, 243, 199] as RgbColor, // #fef3c7 - Warning badge bg

  // Standard A4 Layout Dimensions (mm)
  pageWidth: 210,
  pageHeight: 297,
  marginLeft: 14,
  marginRight: 14,
  marginTop: 14,
  marginBottom: 16,
  contentWidth: 182, // 210 - 28
};

export const COMMON_TABLE_STYLES = {
  theme: 'grid' as const,
  headStyles: {
    fillColor: PDF_THEME.primaryDark,
    textColor: PDF_THEME.pureWhite,
    fontSize: 8,
    fontStyle: 'bold' as const,
    halign: 'left' as const,
    cellPadding: 2.5,
  },
  bodyStyles: {
    textColor: PDF_THEME.textPrimary,
    fontSize: 7.5,
    cellPadding: 2.2,
  },
  alternateRowStyles: {
    fillColor: PDF_THEME.zebraRow,
  },
  tableLineColor: PDF_THEME.border,
  tableLineWidth: 0.15,
  margin: { left: PDF_THEME.marginLeft, right: PDF_THEME.marginRight },
};

