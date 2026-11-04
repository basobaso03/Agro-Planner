# 05 — Android Framework Capabilities Missing from the Web Layer

Web applications running inside an Android WebView lack essential Android framework features that native apps possess out of the box. This document identifies those framework gaps, specifies the corresponding Android platform capability and Capacitor plugin, and establishes the typed wrapper architecture in `src/native/`.

---

## 1. Android Native Feature Matrix

| # | Native Android Framework Feature | Web Layer Limitation | Target Android Integration | Plugin & API |
|---|---|---|---|---|
| **1** | **InputMethodManager (IME Keyboard)** | WebView resizes unpredictably; inputs jump or hide behind soft keyboard (B7, B18). | Coordinate layout with real keyboard insets; disable web resizing; pin footers above IME. | `@capacitor/keyboard` (`resize: "none"`) + `useKeyboardInset` |
| **2** | **WindowInsetsController & Edge-to-Edge** | App leaves black/white status bar bars; notches and home indicator obscure buttons. | Full edge-to-edge rendering with light/dark icons, transparent system bars, and CSS `safe-area-inset-*`. | `@capacitor/status-bar` + `@capacitor/app` |
| **3** | **Vibrator & CombinedVibration (Haptics)** | `navigator.vibrate` is blocked or uncalibrated on many WebViews; no subtle clicks. | Android tactile feedback: tick, click, heavy click, success notification, warning, and error pulses. | `@capacitor/haptics` (`Haptics.impact`, `Haptics.notification`) |
| **4** | **OnBackInvokedDispatcher & Predictive Back** | Brittle DOM close-button query hack (B12); Back exits app unexpectedly; no gesture animation. | Android 14+ Predictive Back gesture with prioritized multi-level back stack. | `@capacitor/app` + `android:enableOnBackInvokedCallback="true"` |
| **5** | **AndroidX Core SplashScreen** | White screen flash while WebView boots and JavaScript parses. | Native system splash showing brand logo instantly; hides cleanly when React renders. | `@capacitor/splash-screen` (`SplashScreen.hide()`) |
| **6** | **ShareCompat (System Share Sheet)** | `window.open` and raw `wa.me` links fail or open new browser tabs. | Native Android Share Sheet for sharing statements, credit balances, receipts, and invite codes. | `@capacitor/share` (`Share.share(...)`) |
| **7** | **ClipboardManager** | `navigator.clipboard` requires secure HTTPS context and frequently throws in WebViews. | Native clipboard access with toast confirmation feedback. | `@capacitor/clipboard` |
| **8** | **Camera Intent & MediaStore (Scoped Storage)** | `<input type="file">` suffers double-tap bugs (Frontend plan Issue 10), EXIF rotation loss, and memory crashes. | Hardware camera capture and gallery selection with EXIF auto-rotation and client compression. | `@capacitor/camera` |
| **9** | **App-Private Storage (Internal FilesDir)** | Base64 images in `localStorage` trigger quota exceptions and silent data loss (B3). | Store images as binary files in app-private storage (`FilesystemDirectory.Data`); save only file paths in state. | `@capacitor/filesystem` |
| **10** | **SharedPreferences** | `localStorage` can be cleared by WebView storage eviction under memory pressure. | Encrypted Android SharedPreferences for session auth tokens and device settings. | `@capacitor/preferences` |
| **11** | **ConnectivityManager (Network Monitor)** | No awareness of offline state; user submits forms into the void with no queue. | Real-time network listener driving `SyncChip` and auto-triggering outbox flush on reconnect. | `@capacitor/network` |
| **12** | **LocationManager (Geolocation)** | GPS permissions in WebView trigger browser popups; times out on ground logs. | Hardware GPS stamping with pre-permission educational bottom sheet and battery-saving timeout. | `@capacitor/geolocation` |
| **13** | **AlarmManager & NotificationManager (Reminders)** | Web Push requires complex service workers and fails when app process is closed. | Scheduled local notifications for Credit Due Dates (T-2d, T-0), Debts, Checkpoints, and Runway milestones. | `@capacitor/local-notifications` |
| **14** | **Runtime Permission Rationale (Android 13+)** | Android 13+ blocks notifications (`POST_NOTIFICATIONS`) and camera without runtime prompts. | Pre-permission bottom sheets explaining *why* permission is needed before triggering native dialog. | Custom `PermissionSheet.tsx` + Plugin check |
| **15** | **Intent Actions (Dialer & WhatsApp)** | Standard links can fail or prompt "open in browser". | Native intents launching Phone Dialer (`Intent.ACTION_DIAL`) and WhatsApp direct chat. | `@capacitor/app-launcher` + `<queries>` in Manifest |
| **16** | **BiometricPrompt & Android Keystore** | Biometrics only masked numbers; app state was exposed when returning from background. | Biometric app lock challenge when returning to the app after 5 minutes of inactivity. | `@aparajita/capacitor-biometric-auth` |
| **17** | **LauncherApps (App Icon Shortcuts)** | No quick launcher entry points from home screen. | Long-press app icon shortcuts: *Record Credit Sale*, *Log Expense*, *Broadcast Center*. | Native `shortcuts.xml` / `@capawesome/capacitor-app-shortcuts` |
| **18** | **SwipeRefreshLayout (Pull-to-Refresh)** | Users expect Android pull-down gesture to refresh data. | Smooth pull-to-refresh on scrollable screens triggering cloud sync. | Web touch gesture component (`usePullToRefresh.ts`) |
| **19** | **ScreenOrientation** | Accidental rotation on mobile phones breaks form layouts and keyboard positioning. | Lock portrait orientation on phones (< 600dp); allow dynamic orientation on tablets. | `@capacitor/screen-orientation` |
| **20** | **Accessibility (sp Units & TalkBack)** | Hardcoded pixel fonts clip under Android system font scaling (1.0× to 1.3×); icon buttons lack labels. | Responsive typography scaling, touch targets ≥ 48dp, and TalkBack `aria-label` tags. | Token CSS & Semantic HTML |

---

## 2. Installation & Native Configuration

### 2.1 NPM Packages to Install
```bash
npm install @capacitor/keyboard \
            @capacitor/status-bar \
            @capacitor/haptics \
            @capacitor/splash-screen \
            @capacitor/share \
            @capacitor/clipboard \
            @capacitor/camera \
            @capacitor/filesystem \
            @capacitor/preferences \
            @capacitor/network \
            @capacitor/geolocation \
            @capacitor/app-launcher \
            @capacitor/browser \
            @capacitor/screen-orientation
npx cap sync android
```

### 2.2 `android/app/src/main/AndroidManifest.xml` Updates
```xml
<!-- Enable Android 14+ Predictive Back -->
<application
    android:enableOnBackInvokedCallback="true"
    android:hardwareAccelerated="true"
    android:icon="@mipmap/ic_launcher"
    android:label="@string/app_name"
    android:theme="@style/AppTheme.NoActionBar">

    <!-- Launcher App Shortcuts -->
    <meta-data
        android:name="android.app.shortcuts"
        android:resource="@xml/shortcuts" />

    <!-- Queries for WhatsApp and Dialer Intents (Android 11+ Package Visibility) -->
    <queries>
        <package android:name="com.whatsapp" />
        <package android:name="com.whatsapp.w4b" />
        <intent>
            <action android:name="android.intent.action.DIAL" />
            <data android:scheme="tel" />
        </intent>
    </queries>
</application>
```

---

## 3. Typed Native Wrapper Architecture (`src/native/`)

To guarantee that unit tests run cleanly in jsdom/Node and the web developer workflow (`npm run dev`) functions without errors, every native capability is accessed through a wrapper with a graceful web fallback.

```
src/native/
  ├── haptics.ts        # Hardware vibration patterns with user setting check
  ├── keyboard.ts       # IME height listener & inset injector
  ├── statusBar.ts      # Edge-to-edge styling & light/dark icon toggles
  ├── share.ts          # Native share sheet with Web Share API fallback
  ├── clipboard.ts      # Native clipboard copy with toast confirmation
  ├── camera.ts         # Photo capture & gallery picker with compression
  ├── files.ts          # File system persistence for receipts and galleries
  ├── network.ts        # Connectivity status subscriber
  ├── reminders.ts      # AlarmManager scheduled local notifications
  ├── appLauncher.ts    # Dialer and WhatsApp direct intent launcher
  └── biometrics.ts     # BiometricPrompt & auto-lock challenge engine
```

### 3.1 Code Example: `src/native/haptics.ts`
```ts
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isVibrationEnabled } from '../utils/mobileHardware.ts';

export const nativeHaptics = {
  impact: async (style: ImpactStyle = ImpactStyle.Light) => {
    if (!isVibrationEnabled()) return;
    try {
      await Haptics.impact({ style });
    } catch {
      // Fallback for desktop/web
      if ('vibrate' in navigator) navigator.vibrate(15);
    }
  },
  success: async () => {
    if (!isVibrationEnabled()) return;
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch {
      if ('vibrate' in navigator) navigator.vibrate([20, 60, 20]);
    }
  },
  error: async () => {
    if (!isVibrationEnabled()) return;
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch {
      if ('vibrate' in navigator) navigator.vibrate([50, 100, 50]);
    }
  },
};
```

### 3.2 Code Example: `src/native/reminders.ts` (Scheduled Local Due Date Notifications)
```ts
import { LocalNotifications } from '@capacitor/local-notifications';

export interface DueReminderParams {
  id: number;
  title: string;
  body: string;
  dueDate: Date;
  entityId: string;
  type: 'CREDIT_SALE' | 'DEBT_LIABILITY' | 'LOAN_RETURN' | 'CHECKPOINT';
}

export const nativeReminders = {
  scheduleDueReminders: async (params: DueReminderParams) => {
    const dueTime = params.dueDate.getTime();
    const twoDaysBefore = dueTime - 2 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const notifications = [];

    // T-2 Days Warning
    if (twoDaysBefore > now) {
      notifications.push({
        id: params.id * 10 + 1,
        title: `Upcoming: ${params.title}`,
        body: `${params.body} is due in 2 days.`,
        schedule: { at: new Date(twoDaysBefore) },
        extra: { entityId: params.entityId, type: params.type },
      });
    }

    // Due Date Morning Alert (08:00 AM on due date)
    if (dueTime > now) {
      notifications.push({
        id: params.id * 10 + 2,
        title: `Due Today: ${params.title}`,
        body: `${params.body} is due today for settlement.`,
        schedule: { at: new Date(dueTime) },
        extra: { entityId: params.entityId, type: params.type },
      });
    }

    if (notifications.length > 0) {
      try {
        await LocalNotifications.schedule({ notifications });
      } catch (err) {
        console.warn('Local notifications schedule notice:', err);
      }
    }
  },
  cancelReminders: async (id: number) => {
    try {
      await LocalNotifications.cancel({
        notifications: [{ id: id * 10 + 1 }, { id: id * 10 + 2 }],
      });
    } catch {
      // Ignore if not scheduled
    }
  },
};
```

### 3.3 Code Example: `src/native/files.ts` (Image Filesystem Pipeline)
Replaces base64 in `localStorage` JSON:
```ts
import { Filesystem, Directory } from '@capacitor/filesystem';

export const nativeFiles = {
  saveImageBinary: async (base64Data: string, filename: string): Promise<string> => {
    try {
      const result = await Filesystem.writeFile({
        path: `photos/${filename}`,
        data: base64Data,
        directory: Directory.Data,
        recursive: true,
      });
      return result.uri;
    } catch {
      // In web fallback, store in IndexedDB or temporary object URL
      return base64Data;
    }
  },
  readImageBinary: async (path: string): Promise<string> => {
    try {
      const file = await Filesystem.readFile({ path });
      return `data:image/jpeg;base64,${file.data}`;
    } catch {
      return path; // Already a URL or base64
    }
  },
};
```
