export interface AppVersionConfig {
  latestVersion: string;
  minSupportedVersion: string;
  forceUpdate: boolean;
  downloadUrl: string;
  title: string;
  releaseNotes: string;
}

export const CURRENT_APP_VERSION = '1.0.2';

/**
 * Primary and fallback remote endpoints for version.json on the GitHub repository / GitHub Pages.
 * Checked on every application startup and foreground resume with cache-busting timestamps.
 */
export const VERSION_CHECK_URL = 'https://basobaso03.github.io/Agro-Planner/version.json';

const VERSION_CHECK_ENDPOINTS = [
  'https://basobaso03.github.io/Agro-Planner/version.json',
  'https://raw.githubusercontent.com/basobaso03/Agro-Planner/main/version.json',
  'https://raw.githubusercontent.com/basobaso03/Agro-Planner/main/public/version.json',
  'https://basobaso03.github.io/Agro-Planner/public-website/version.json'
];

const LAST_SEEN_RELEASE_KEY = 'agro_planner_last_seen_release_version_v1';

/**
 * Compares two semantic version strings (e.g., "1.0.1" vs "1.0.2").
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 */
export function compareSemver(v1: string, v2: string): number {
  const clean1 = String(v1 || '0.0.0').replace(/^v/i, '').trim();
  const clean2 = String(v2 || '0.0.0').replace(/^v/i, '').trim();
  const parts1 = clean1.split('.').map(n => parseInt(n, 10) || 0);
  const parts2 = clean2.split('.').map(n => parseInt(n, 10) || 0);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

export function hasSeenReleaseNotesForVersion(version: string): boolean {
  try {
    return localStorage.getItem(LAST_SEEN_RELEASE_KEY) === version;
  } catch {
    return false;
  }
}

export function markReleaseNotesSeenForVersion(version: string): void {
  try {
    localStorage.setItem(LAST_SEEN_RELEASE_KEY, version);
  } catch {
    // Ignore storage quota errors
  }
}

async function fetchRemoteVersionConfig(): Promise<AppVersionConfig | null> {
  const timestamp = Date.now();

  for (const endpoint of VERSION_CHECK_ENDPOINTS) {
    try {
      const response = await fetch(`${endpoint}?t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) continue;

      const data = await response.json();
      if (data && typeof data.latestVersion === 'string' && typeof data.minSupportedVersion === 'string') {
        return {
          latestVersion: data.latestVersion,
          minSupportedVersion: data.minSupportedVersion,
          forceUpdate: Boolean(data.forceUpdate),
          downloadUrl: data.downloadUrl || 'https://basobaso03.github.io/Agro-Planner/#download',
          title: data.title || `Agro Planner Update (v${data.latestVersion})`,
          releaseNotes: data.releaseNotes || ''
        };
      }
    } catch {
      // Try next endpoint in fallback chain
    }
  }

  return null;
}

export interface AppUpdateCheckResult {
  hasUpdate: boolean;
  isForced: boolean;
  isBelowMin: boolean;
  isNewReleaseAnnouncement: boolean;
  config: AppVersionConfig | null;
}

export async function checkForAppUpdates(): Promise<AppUpdateCheckResult> {
  try {
    const config = await fetchRemoteVersionConfig();
    if (!config) {
      return {
        hasUpdate: false,
        isForced: false,
        isBelowMin: false,
        isNewReleaseAnnouncement: false,
        config: null
      };
    }

    const isBelowMin = compareSemver(CURRENT_APP_VERSION, config.minSupportedVersion) < 0;
    const isBelowLatest = compareSemver(CURRENT_APP_VERSION, config.latestVersion) < 0;

    // Force update if installed version is below minimum supported version OR if forceUpdate flag is active and below latest
    const isForced = isBelowMin || (config.forceUpdate && isBelowLatest);
    const hasUpdate = isBelowLatest || isBelowMin;

    // Also detect if user hasn't seen the release announcement for the remote latestVersion yet
    const isNewReleaseAnnouncement = !hasUpdate && !hasSeenReleaseNotesForVersion(config.latestVersion);

    return {
      hasUpdate,
      isForced,
      isBelowMin,
      isNewReleaseAnnouncement,
      config
    };
  } catch (err) {
    console.warn('[AppUpdate] Failed to check for updates (offline or unreachable):', err);
    return {
      hasUpdate: false,
      isForced: false,
      isBelowMin: false,
      isNewReleaseAnnouncement: false,
      config: null
    };
  }
}

