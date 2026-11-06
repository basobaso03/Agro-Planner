/**
 * PDF Filename Sanitizer & Builder
 * Guarantees that exported PDF filenames NEVER contain underscores (`_`).
 */

export interface FormatFilenameOptions {
  orgName?: string;
  documentType: string;
  entityName?: string;
  date?: string | Date;
}

/**
 * Strictly sanitizes a PDF filename, guaranteeing that:
 * 1. Zero underscores exist in the output filename.
 * 2. Unsafe filesystem and URI characters are removed/replaced.
 * 3. Consecutive dashes and spaces are normalized.
 * 4. The extension ends with `.pdf`.
 */
export function sanitizePdfFilename(rawName: string): string {
  if (!rawName || typeof rawName !== 'string') {
    return 'Agro-Planner-Document.pdf';
  }

  // 1. Mandatory Rule: Replace ALL underscores with hyphens
  let clean = rawName.replace(/_/g, '-');

  // 2. Strip filesystem reserved & dangerous characters (including brackets and parens)
  clean = clean.replace(/[/\\:*?"<>|#%&{}\\$!'@+`=()[\]]/g, '-');

  // 3. Normalize spaces and multiple consecutive hyphens
  clean = clean.replace(/\s+/g, '-').replace(/-+/g, '-');

  // 4. Trim leading and trailing hyphens and whitespace
  clean = clean.replace(/^-+|-+$/g, '').trim();

  // If input was completely stripped, fallback to standard safe name
  if (!clean || clean === '-') {
    clean = 'Agro-Planner-Document';
  }

  // 5. Ensure lowercase .pdf extension
  if (!clean.toLowerCase().endsWith('.pdf')) {
    clean = clean + '.pdf';
  } else if (!clean.endsWith('.pdf')) {
    clean = clean.slice(0, -4) + '.pdf';
  }

  // 6. Absolute guard assertion: guarantee zero underscores
  while (clean.includes('_')) {
    clean = clean.replace(/_/g, '-');
  }

  return clean;
}

/**
 * Builds a standardized, human-readable export filename without underscores.
 * Format: `[OrgName]-[DocumentType]-[EntityName]-[Date].pdf`
 */
export function buildExportFilename(options: FormatFilenameOptions): string {
  const parts: string[] = [];

  const rawOrg = options.orgName ? options.orgName.trim() : 'Agro-Planner';
  parts.push(rawOrg);

  const rawDocType = options.documentType ? options.documentType.trim() : 'Report';
  parts.push(rawDocType);

  if (options.entityName && options.entityName.trim()) {
    parts.push(options.entityName.trim());
  }

  let datePart: string;
  if (options.date instanceof Date) {
    datePart = options.date.toISOString().split('T')[0];
  } else if (typeof options.date === 'string' && options.date.trim()) {
    datePart = options.date.includes('T') ? options.date.split('T')[0] : options.date.trim();
  } else {
    datePart = new Date().toISOString().split('T')[0];
  }
  parts.push(datePart);

  // Join parts with hyphen and run comprehensive sanitizer
  const combined = parts.join('-');
  return sanitizePdfFilename(combined);
}
