import { triggerHapticFeedback } from './mobileHardware.ts';
import type { RunwayMilestoneKey } from '../types/runway.ts';

export type CelebrationMode = 'FULL' | 'REDUCED' | 'OFF';

const CELEBRATION_MODE_KEY = 'agro_runway_celebration_mode';

/**
 * Returns current effective celebration mode.
 * Automatically respects `prefers-reduced-motion` and low-end hardware.
 */
export function getCelebrationMode(): CelebrationMode {
  if (typeof window === 'undefined') return 'REDUCED';

  try {
    const saved = localStorage.getItem(CELEBRATION_MODE_KEY) as CelebrationMode | null;
    if (saved === 'OFF') return 'OFF';
    if (saved === 'REDUCED') return 'REDUCED';

    // Check system prefers-reduced-motion
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return 'REDUCED';
    }

    // Downgrade on constrained mobile hardware (<= 4 CPU cores) if user hasn't explicitly set FULL
    if (!saved && typeof navigator !== 'undefined' && navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) {
      return 'REDUCED';
    }

    return saved || 'FULL';
  } catch {
    return 'REDUCED';
  }
}

export function setCelebrationMode(mode: CelebrationMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CELEBRATION_MODE_KEY, mode);
  } catch {
    // Quota ignore
  }
}

export function hasMilestoneCelebrated(planId: string, milestone: RunwayMilestoneKey | string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const key = `runway_celebrated_${planId}_${milestone}`;
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

export function markMilestoneCelebrated(planId: string, milestone: RunwayMilestoneKey | string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `runway_celebrated_${planId}_${milestone}`;
    localStorage.setItem(key, 'true');
  } catch {
    // Quota ignore
  }
}

export function shouldTriggerCelebration(planId: string, milestone: RunwayMilestoneKey | string): boolean {
  const mode = getCelebrationMode();
  if (mode === 'OFF') return false;
  return !hasMilestoneCelebrated(planId, milestone);
}

export function triggerHapticForMilestone(milestone: RunwayMilestoneKey | string): void {
  switch (milestone) {
    case 'FULLY_PLEDGED':
      triggerHapticFeedback([100, 50, 100, 50, 200]);
      break;
    case 'FULLY_FUNDED':
    case 'ACTIVATED':
      triggerHapticFeedback([150, 60, 150, 60, 300]);
      break;
    case 'FIRST_SALE':
    case 'BREAK_EVEN':
      triggerHapticFeedback([200, 100, 200, 100, 400]);
      break;
    case 'HALF_FUNDED':
    case 'QUARTER_FUNDED':
    default:
      triggerHapticFeedback([80, 40, 80]);
      break;
  }
}

