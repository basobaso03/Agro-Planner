export type FontStyleId =
  | 'modern-geometric'
  | 'clean-tech'
  | 'editorial-serif'
  | 'industrial-mono'
  | 'humanist-modern';

export interface FontOption {
  id: FontStyleId;
  name: string;
  cssClass: string;
  familyDisplay: string;
  category: 'Geometric' | 'Clean Tech' | 'Editorial' | 'Monospace' | 'Humanist';
  description: string;
  previewText: string;
  sampleFigures: string;
}

export const FONT_OPTIONS: FontOption[] = [
  {
    id: 'modern-geometric',
    name: 'Modern Geometric (Solora Default)',
    cssClass: 'font-style-geometric',
    familyDisplay: 'Plus Jakarta Sans',
    category: 'Geometric',
    description: 'Crisp, contemporary geometric proportions with high optical clarity. Modeled after the Solora solar monitoring UI.',
    previewText: 'PowerVault X5 · Real-time Livestock Syndication',
    sampleFigures: '$2,585.00 · 296 Live Birds',
  },
  {
    id: 'clean-tech',
    name: 'Clean Tech',
    cssClass: 'font-style-tech',
    familyDisplay: 'Inter',
    category: 'Clean Tech',
    description: 'Precision neo-grotesque engineered for high legibility across dense financial spreadsheets and farm audits.',
    previewText: 'Harare Master Syndicate · Verified Ledger',
    sampleFigures: '+0.8 kWh · $9,300 ROI (62%)',
  },
  {
    id: 'editorial-serif',
    name: 'Editorial Serif',
    cssClass: 'font-style-serif',
    familyDisplay: 'Playfair Display',
    category: 'Editorial',
    description: 'Distinguished luxury editorial typography for executive syndicate certificates, investor dividends, and annual accounts.',
    previewText: 'Agro Syndicate Heritage & Land Portfolio',
    sampleFigures: 'NAV $8,580.59 · Harare Central',
  },
  {
    id: 'industrial-mono',
    name: 'Industrial Monospace',
    cssClass: 'font-style-mono',
    familyDisplay: 'JetBrains Mono',
    category: 'Monospace',
    description: 'Developer-grade monospaced figures ensuring strict columnar alignment for cryptographically verified SHA-256 blocks.',
    previewText: 'SHA-256 IMMUTABLE LEDGER VERIFIED',
    sampleFigures: '0000..7f2a · SEQ #109 APPROVED',
  },
  {
    id: 'humanist-modern',
    name: 'Humanist Modern',
    cssClass: 'font-style-humanist',
    familyDisplay: 'DM Sans',
    category: 'Humanist',
    description: 'Soft, friendly human-centric curves with comfortable open apertures, ideal for mobile fieldwork and rapid touch interaction.',
    previewText: 'Gweru Homestead Ranch · Batch 12 Readiness',
    sampleFigures: '13 Days Left · 18 Boer Goats',
  },
];
