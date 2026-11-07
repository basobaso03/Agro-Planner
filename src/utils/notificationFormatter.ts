import type {
  AuditNotificationEvent,
  AuditEventType,
  NotificationSeverity,
  Role,
} from '../types/agro.ts';
import { getRoleMeta } from './permissions.ts';

export type NotificationCategory =
  | 'FINANCE'
  | 'LIVESTOCK'
  | 'RUNWAY'
  | 'OPERATIONS'
  | 'SECURITY';

export interface FormattedNarrative {
  primarySummary: string;
  notes?: string;
  referenceId?: string;
  deductionInfo?: string;
}

export interface FormattedNotification {
  id: string;
  sequenceNumber: number;
  timestamp: string;
  relativeTime: string;
  formattedDate: string;
  formattedTime: string;
  category: NotificationCategory;
  categoryLabel: string;
  categoryStyles: {
    bg: string;
    text: string;
    border: string;
    dot: string;
  };
  severity: NotificationSeverity;
  severityStyles: {
    bg: string;
    text: string;
    border: string;
  };
  cleanTitle: string;
  mobileTitle: string;
  shortSummary: string;
  fullMessage: string;
  narrative: FormattedNarrative;
  actor: {
    id: string;
    name: string;
    role: Role;
    roleLabel: string;
  };
  locationName: string;
  referenceEntityId?: string;
  metricBadge?: {
    label: string;
    value: string;
    isPositive?: boolean;
    isNeutral?: boolean;
  };
  targetRoute?: {
    routeId: string;
    params?: Record<string, string>;
    actionLabel: string;
  };
  photoUrl?: string;
}

/**
 * Calculates human-friendly relative time (e.g. "Just now", "5m ago", "2h ago", "Yesterday")
 */
export function getRelativeTime(timestampStr: string): string {
  try {
    const timestamp = new Date(timestampStr).getTime();
    if (isNaN(timestamp)) return '';
    const now = Date.now();
    const diffMs = now - timestamp;
    if (diffMs < 0) return 'Just now';

    const diffSeconds = Math.floor(diffMs / 1000);
    if (diffSeconds < 60) return 'Just now';

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return new Date(timestamp).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

/**
 * Strips raw internal prefixes (e.g. "AUD-002-...", "EXP-019:", "Ref: TXN-...")
 * from human preview text.
 */
export function cleanRawMessage(rawText: string): string {
  if (!rawText) return '';
  let cleaned = rawText.trim();

  // Strip leading internal ID patterns like AUD-001-A123: or EXP-999: or AST-001:
  cleaned = cleaned.replace(/^[A-Z]{3,4}-\d{3,}-[A-Z0-9]+(\s*\(Ref:[^)]+\))?:\s*/i, '');
  cleaned = cleaned.replace(/^[A-Z]{3,4}-\d{3,}:\s*/i, '');

  // Strip or replace unfriendly technical cryptographic labels
  cleaned = cleaned.replace(/\bzero-trust sha-?256\b/gi, 'Securely verified');
  cleaned = cleaned.replace(/\bsha-?256\b/gi, 'verified');

  // Strip any raw 64-character or 16+ hex hashes if present in messages
  cleaned = cleaned.replace(/\b[a-f0-9]{64}\b/gi, '');
  cleaned = cleaned.replace(/\b[a-f0-9]{16,}\b/gi, '');

  // Convert technical enum constants with underscores to human labels
  cleaned = cleaned.replace(/\bAGRO_FARMING\b/g, 'Agro-Farming');
  cleaned = cleaned.replace(/\bGENERAL_VENTURE\b/g, 'General Venture');
  cleaned = cleaned.replace(/\bMILESTONE_BASED\b/g, 'Milestone-Based');
  cleaned = cleaned.replace(/\bINDIVIDUAL_TAG\b/g, 'Individual Tag');

  return cleaned.trim();
}

/**
 * Parses and formats narrative message text into clear, elegant structured components
 */
export function parseNarrativeText(rawMessage: string, referenceEntityId?: string): FormattedNarrative {
  if (!rawMessage) return { primarySummary: '' };

  let text = cleanRawMessage(rawMessage);
  let notes: string | undefined;
  let refId = referenceEntityId;
  let deductionInfo: string | undefined;

  // Extract inline reference e.g. (Ref: TXN-382910)
  const refMatch = text.match(/\(Ref:\s*([^\)]+)\)/i);
  if (refMatch) {
    if (!refId) refId = refMatch[1].trim();
    text = text.replace(/\(Ref:\s*([^\)]+)\)/i, '').trim();
  }

  // Extract Deduction info e.g. "Deducted from Left Money." or "- Deducted from Left Money"
  if (/deducted from left money/i.test(text)) {
    deductionInfo = 'Deducted from Organization Left Money';
    text = text.replace(/[-–]?\s*Deducted from Left Money\.?/i, '').trim();
  }

  // Extract "Note: ..." or "Notes: ..." or "Reason: ..."
  const noteMatch = text.match(/\b(Notes?|Reason):\s*(.+)$/i);
  if (noteMatch) {
    notes = noteMatch[2].trim();
    text = text.substring(0, noteMatch.index).trim();
  }

  // Clean trailing punctuation or separators
  text = text.replace(/[-–:;,]\s*$/, '').trim();

  return {
    primarySummary: text || cleanRawMessage(rawMessage),
    notes,
    referenceId: refId,
    deductionInfo,
  };
}

/**
 * Generates a clean 1-line summary suitable for mobile phone notifications and preview cards
 */
export function generateShortSummary(title: string, rawMessage: string, maxLen = 85): string {
  const cleanMsg = cleanRawMessage(rawMessage);
  if (!cleanMsg) return title;

  const sentence = cleanMsg.split(/[\.\n]/)[0].trim();
  const candidate = sentence || cleanMsg;

  if (candidate.length <= maxLen) return candidate;
  return candidate.slice(0, maxLen - 1).trim() + '…';
}

/**
 * Maps event types to domain categories
 */
export function getEventCategory(eventType: AuditEventType): NotificationCategory {
  switch (eventType) {
    case 'CAPITAL_CONTRIBUTION':
    case 'CAPITAL_CONTRA':
    case 'EXPENSE_LOGGED':
    case 'EXPENSE_APPROVED':
    case 'EXPENSE_CONTRA':
    case 'ASSET_LOGGED':
    case 'ASSET_CONTRA':
    case 'CREDIT_SALE':
    case 'FINANCIAL_TRANSACTION':
      return 'FINANCE';

    case 'LIVESTOCK_REGISTERED':
    case 'LIVESTOCK_MORTALITY':
    case 'LIVESTOCK_BIRTH':
    case 'LIVESTOCK_SALE':
    case 'LIVESTOCK_CONTRA':
    case 'LIVESTOCK_UPDATED':
    case 'FEED_LOGGED':
    case 'CHECKPOINT_CUSTOMIZED':
    case 'RECIPE_TEMPLATE_SAVED':
      return 'LIVESTOCK';

    case 'RUNWAY_PLAN_CREATED':
    case 'RUNWAY_PLAN_LOCKED':
    case 'RUNWAY_PLAN_ACTIVATED':
    case 'RUNWAY_PLEDGE':
    case 'RUNWAY_PAYMENT':
    case 'RUNWAY_AMENDMENT':
    case 'RUNWAY_RESERVE_DRAW':
    case 'RUNWAY_MILESTONE':
    case 'RUNWAY_OFF_PLAN_WARNING':
    case 'RUNWAY_PLAN_CLOSED':
      return 'RUNWAY';

    case 'GROUND_BROADCAST':
    case 'SITE_REGISTERED':
    case 'SITE_UPDATED':
    case 'SITE_REMOVED':
      return 'OPERATIONS';

    case 'ORGANIZATION_CREATED':
    case 'ORGANIZATION_UPDATED':
    case 'INVITE_CODE_REFRESHED':
    case 'MEMBER_ADDED':
    case 'MEMBER_APPROVED':
    case 'MEMBER_ROLE_CHANGED':
    case 'MEMBER_SUSPENDED':
    case 'MEMBER_DELETED':
    case 'MEMBER_PROFILE_UPDATED':
    case 'SECURITY_CREDENTIAL_LINKED':
    case 'SYSTEM_LEDGER_RESET':
    default:
      return 'SECURITY';
  }
}

/**
 * Clean, high-contrast, black-and-white / refined monochrome category styling
 */
function getCategoryStyles(category: NotificationCategory) {
  switch (category) {
    case 'FINANCE':
      return {
        bg: 'bg-white',
        text: 'text-slate-900',
        border: 'border-slate-300',
        dot: 'bg-slate-950',
      };
    case 'LIVESTOCK':
      return {
        bg: 'bg-white',
        text: 'text-slate-900',
        border: 'border-slate-300',
        dot: 'bg-slate-700',
      };
    case 'RUNWAY':
      return {
        bg: 'bg-white',
        text: 'text-slate-900',
        border: 'border-slate-300',
        dot: 'bg-slate-900',
      };
    case 'OPERATIONS':
      return {
        bg: 'bg-white',
        text: 'text-slate-900',
        border: 'border-slate-300',
        dot: 'bg-slate-800',
      };
    case 'SECURITY':
    default:
      return {
        bg: 'bg-white',
        text: 'text-slate-900',
        border: 'border-slate-300',
        dot: 'bg-slate-950',
      };
  }
}

/**
 * Clean black and white severity badge styling
 */
function getSeverityStyles(severity: NotificationSeverity) {
  switch (severity) {
    case 'URGENT_GROUND':
      return {
        bg: 'bg-slate-950',
        text: 'text-white',
        border: 'border-slate-950',
      };
    case 'WARNING_CONTRA':
      return {
        bg: 'bg-slate-900',
        text: 'text-white',
        border: 'border-slate-900',
      };
    case 'MILESTONE':
      return {
        bg: 'bg-slate-100',
        text: 'text-slate-900',
        border: 'border-slate-300',
      };
    case 'FINANCIAL':
      return {
        bg: 'bg-slate-100',
        text: 'text-slate-900',
        border: 'border-slate-300',
      };
    case 'INFO':
    default:
      return {
        bg: 'bg-slate-50',
        text: 'text-slate-700',
        border: 'border-slate-200',
      };
  }
}

/**
 * Determines contextual deep-link route based on event type and reference IDs
 */
function resolveTargetRoute(
  event: AuditNotificationEvent,
  category: NotificationCategory
): { routeId: string; params?: Record<string, string>; actionLabel: string } | undefined {
  const { eventType, referenceEntityId } = event;

  if (category === 'FINANCE') {
    if (eventType === 'CREDIT_SALE') {
      return {
        routeId: 'creditSales',
        params: referenceEntityId ? { saleId: referenceEntityId } : undefined,
        actionLabel: 'View Credit Sales',
      };
    }
    if (eventType === 'EXPENSE_LOGGED' || eventType === 'EXPENSE_APPROVED' || eventType === 'EXPENSE_CONTRA') {
      return {
        routeId: 'expenses',
        params: referenceEntityId ? { expenseId: referenceEntityId } : undefined,
        actionLabel: 'View Expenses',
      };
    }
    if (eventType === 'CAPITAL_CONTRIBUTION' || eventType === 'CAPITAL_CONTRA') {
      return {
        routeId: 'capitalPool',
        actionLabel: 'View Capital Pool',
      };
    }
    if (eventType === 'ASSET_LOGGED' || eventType === 'ASSET_CONTRA') {
      return {
        routeId: 'fixedAssets',
        actionLabel: 'View Assets',
      };
    }
    return {
      routeId: 'financialSummary',
      actionLabel: 'View Financials',
    };
  }

  if (category === 'LIVESTOCK') {
    return {
      routeId: 'operations',
      params: referenceEntityId ? { batchId: referenceEntityId } : undefined,
      actionLabel: 'View Operations',
    };
  }

  if (category === 'RUNWAY') {
    return {
      routeId: 'runway',
      actionLabel: 'View Runway Plan',
    };
  }

  if (category === 'OPERATIONS') {
    if (eventType === 'GROUND_BROADCAST') {
      return {
        routeId: 'broadcasts',
        actionLabel: 'View Broadcasts',
      };
    }
    return {
      routeId: 'operations',
      actionLabel: 'View Operations',
    };
  }

  if (category === 'SECURITY') {
    if (
      eventType === 'MEMBER_ADDED' ||
      eventType === 'MEMBER_APPROVED' ||
      eventType === 'MEMBER_ROLE_CHANGED' ||
      eventType === 'MEMBER_SUSPENDED'
    ) {
      return {
        routeId: 'members',
        actionLabel: 'View Members',
      };
    }
    return {
      routeId: 'auditLedger',
      actionLabel: 'Inspect Ledger',
    };
  }

  return undefined;
}

/**
 * Extracts and formats key metric badges (e.g. +$1,200.00, -4 Birds)
 */
function extractMetricBadge(event: AuditNotificationEvent): {
  label: string;
  value: string;
  isPositive?: boolean;
  isNeutral?: boolean;
} | undefined {
  if (typeof event.deltaFinancial === 'number' && event.deltaFinancial !== 0) {
    const isPos = event.deltaFinancial > 0;
    return {
      label: 'Financial Shift',
      value: `${isPos ? '+' : ''}$${event.deltaFinancial.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      isPositive: isPos,
    };
  }

  if (typeof event.deltaHeadcount === 'number' && event.deltaHeadcount !== 0) {
    const isPos = event.deltaHeadcount > 0;
    return {
      label: 'Headcount Shift',
      value: `${isPos ? '+' : ''}${event.deltaHeadcount} ${Math.abs(event.deltaHeadcount) === 1 ? 'Unit' : 'Units'}`,
      isPositive: isPos,
    };
  }

  return undefined;
}

/**
 * Derives contextual emoji for mobile notifications
 */
function getCategoryEmoji(category: NotificationCategory, severity: NotificationSeverity): string {
  if (severity === 'URGENT_GROUND' || severity === 'WARNING_CONTRA') {
    return '🚨';
  }
  switch (category) {
    case 'FINANCE':
      return '💰';
    case 'LIVESTOCK':
      return '🐣';
    case 'RUNWAY':
      return '📊';
    case 'OPERATIONS':
      return '📢';
    case 'SECURITY':
    default:
      return '🛡️';
  }
}

/**
 * Master parser and formatter for AuditNotificationEvent
 */
export function formatNotification(event: AuditNotificationEvent): FormattedNotification {
  const category = getEventCategory(event.eventType);
  const categoryLabelMap: Record<NotificationCategory, string> = {
    FINANCE: 'Finance',
    LIVESTOCK: 'Livestock',
    RUNWAY: 'Runway',
    OPERATIONS: 'Operations',
    SECURITY: 'Security & Audit',
  };

  const cleanTitle = event.title
    .replace(/^Agro Planner\s*[·•-]\s*/i, '')
    .replace(/\bzero-trust sha-?256\b/gi, 'Securely Verified')
    .replace(/\bsha-?256\b/gi, 'Verified')
    .trim();
  const shortSummary = generateShortSummary(cleanTitle, event.message);
  const emoji = getCategoryEmoji(category, event.severity);
  const mobileTitle = `${emoji} ${cleanTitle}`;

  const roleMeta = getRoleMeta(event.actorRole);
  const dateObj = new Date(event.timestamp);
  const narrative = parseNarrativeText(event.message, event.referenceEntityId);

  return {
    id: event.id,
    sequenceNumber: event.sequenceNumber,
    timestamp: event.timestamp,
    relativeTime: getRelativeTime(event.timestamp),
    formattedDate: isNaN(dateObj.getTime())
      ? ''
      : dateObj.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    formattedTime: isNaN(dateObj.getTime())
      ? ''
      : dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    category,
    categoryLabel: categoryLabelMap[category],
    categoryStyles: getCategoryStyles(category),
    severity: event.severity,
    severityStyles: getSeverityStyles(event.severity),
    cleanTitle,
    mobileTitle,
    shortSummary,
    fullMessage: cleanRawMessage(event.message),
    narrative,
    actor: {
      id: event.actorId,
      name: event.actorName,
      role: event.actorRole,
      roleLabel: roleMeta.label,
    },
    locationName: event.locationName || 'All Sites',
    referenceEntityId: event.referenceEntityId,
    metricBadge: extractMetricBadge(event),
    targetRoute: resolveTargetRoute(event, category),
    photoUrl: event.photoUrl,
  };
}
