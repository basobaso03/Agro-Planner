/**
 * Friendly Error Translation Engine
 */

export function getFriendlyErrorMessage(err: unknown): string {
  if (!err) return 'An unexpected error occurred. Please try again.';
  if (typeof err === 'string') return err;

  const msg = (err as Error).message || '';
  const lower = msg.toLowerCase();

  if (lower.includes('insufficient funds') || lower.includes('insufficient liquid cash')) {
    return msg;
  }
  if (lower.includes('runway spend gate blocked') || lower.includes('runway_allocation_required')) {
    return 'Spend Gate Blocked: This expense requires allocation against your active Runway Plan budget.';
  }
  if (lower.includes('runway_line_overrun')) {
    return 'Budget Overrun: This expenditure exceeds the remaining allocation for this budget line.';
  }
  if (lower.includes('permission-denied') || lower.includes('missing or insufficient permissions')) {
    return 'Permission Denied: Your member role does not have authorization for this action.';
  }
  if (lower.includes('quota') || lower.includes('storage')) {
    return 'Storage Limit Exceeded: Device storage is full. Please clear old photos in Storage Settings.';
  }

  return msg || 'Transaction failed. Please check inputs and retry.';
}

