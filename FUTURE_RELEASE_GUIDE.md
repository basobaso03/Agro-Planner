# Agro Planner — Future Release & APK Compilation Guide

This guide provides the complete, step-by-step workflow for compiling, versioning, and publishing future release versions of **Agro Planner** (Android APK and Public Website).

---

## ⚡ Quick Reference Commands

| Goal | Command | Description |
| :--- | :--- | :--- |
| **Verify Code** | `npm run lint` | Runs TypeScript typecheck to verify 0 errors before building. |
| **Build Signed APK** | `npm run build:release` | **1-Command Complete Production Build:** Compiles, signs, calculates size, auto-updates website config, and distributes APK. |
| **Build Play Store Bundle** | `node build-android-release.mjs --bundle` | Compiles a production signed `.aab` (Android App Bundle) for Google Play Console. |
| **Deploy Website & APK** | `git push origin main` | Pushes the newly compiled APK and updated website to GitHub Pages. |

> [!TIP]
> **Windows PowerShell Note:** If PowerShell shows a script execution error (`npm.ps1 cannot be loaded`), simply run via `cmd.exe`:
> ```cmd
> cmd.exe /c npm run build:release
> ```
> Or directly via Node:
> ```cmd
> node build-android-release.mjs
> ```

---

## 📋 The 3-Step Release Workflow

Follow these 3 simple steps whenever preparing a new release (e.g. `v1.0.1`):

### Step 1: Bump Version Numbers

1. **Android App Version:**
   Open [android/app/build.gradle](file:///c:/Users/dell/Desktop/My%20Projects/My%20Projects/agro-planner/android/app/build.gradle) and increment `versionCode` and `versionName`:
   ```gradle
   defaultConfig {
       applicationId "com.basobaso.agroplanner"
       minSdkVersion rootProject.ext.minSdkVersion
       targetSdkVersion rootProject.ext.targetSdkVersion
       versionCode 2         // <-- Increment integer by +1 each release (1, 2, 3...)
       versionName "1.0.1"   // <-- Customer-facing semantic version string
       ...
   }
   ```

2. **Public Website Version:**
   Open [public-website/index.html](file:///c:/Users/dell/Desktop/My%20Projects/My%20Projects/agro-planner/public-website/index.html) and update `version` in `APP_CONFIG` near line 1015:
   ```javascript
   const APP_CONFIG = {
     version: 'v1.0.1',       // <-- Set your new release tag here
     apkSize: '8.9 MB',       // <-- Auto-updated by build script, or edit manually
     apkName: 'agro-planner.apk'
   };
   ```
   *(All version badges on the navbar, hero, download tab, and terms will automatically reflect this value).*

---

### Step 2: Run the 1-Command Release Builder

In your project root terminal, execute:

```bash
npm run build:release
```
*(or `node build-android-release.mjs`)*

#### What the builder script does automatically:
1. **Pre-build cleanup:** Erases any old or nested `.apk` files from web folders to prevent app bloat.
2. **Release Keystore verification:** Loads `android/app/release.keystore` and prints the SHA-1 / SHA-256 fingerprints.
3. **Optimized Web Bundle:** Runs `npm run build` with Vite.
4. **Capacitor Android Sync:** Runs `npx cap sync android` to mirror assets into native Android container.
5. **Signed Gradle Compilation:** Runs `.\gradlew.bat assembleRelease` with full release signing keys.
6. **Automatic Size Measurement & HTML Sync:** Measures the exact size (e.g. `8.92 MB`), replaces `apkSize` in `public-website/index.html`, and mirrors it to `public/public-website/index.html`.
7. **Distribution Packaging:** Copies the signed APK to:
   - `./apk/agro-planner.apk` (Root distribution)
   - `./public-website/apk/agro-planner.apk` (Website download directory)

---

### Step 3: Commit & Push to GitHub

Once the build prints `✔ SUCCESS!`, commit the new build files and push to GitHub:

```bash
git add -A
git commit -m "release: v1.0.1 signed APK and updated release config"
git push origin main
```

Within ~60 seconds, **GitHub Pages** will automatically update:
- The live public website reflects the new version tag and file size.
- Visitors clicking **Download Official Android APK** will download the new `agro-planner.apk`.

---

## 🔐 Keystore & Firebase Configuration

### Release Keystore Details
- **Location:** `android/app/release.keystore`
- **Alias:** `agroplanner`
- **Password:** `AgroPlanner2026!`

> [!IMPORTANT]
> **NEVER DELETE `android/app/release.keystore`!**
> Android devices use the cryptographic signature inside this keystore to verify app upgrades. If an update is signed with a different keystore, existing users will see an `App not installed as package appears to be invalid` error when trying to upgrade.

### Custom Keystore Passwords (Optional)
If you wish to use different passwords in a CI/CD pipeline or terminal session, supply them via environment variables:
```bash
set RELEASE_KEY_ALIAS=myalias
set RELEASE_STORE_PASSWORD=mysecretpassword
set RELEASE_KEY_PASSWORD=mysecretpassword
node build-android-release.mjs
```

### Firebase Fingerprint Verification
If Google Sign-In or Firebase Phone Authentication fails on release builds:
1. Run `node build-android-release.mjs` and look at the printed fingerprints:
   ```text
   🔑 Release SHA-1:   XX:XX:XX:XX:...
   🔑 Release SHA-256: YY:YY:YY:YY:...
   ```
2. Go to [Firebase Console](https://console.firebase.google.com/) -> **Project Settings** -> **Your apps** -> **Agro Planner Android (`com.basobaso.agroplanner`)**.
3. Ensure the printed **SHA-1** and **SHA-256** are listed under **SHA certificate fingerprints**.

---

## 🪶 How App Size is Kept Lightweight (~8.9 MB)

Agro Planner maintains an ultra-compact ~8.9 MB download size through two built-in safeguards:

1. **Gradle Asset Filter:**
   In [android/app/build.gradle](file:///c:/Users/dell/Desktop/My%20Projects/My%20Projects/agro-planner/android/app/build.gradle):
   ```gradle
   aaptOptions {
       ignoreAssetsPattern = '!.svn:!.git:!.ds_store:!*.scc:.*:!CVS:!thumbs.db:!picasa.ini:!*~:*.apk'
   }
   ```
   This guarantees that `.apk` files are never accidentally packed inside another APK.

2. **Pre-Build Folder Sanitization:**
   `build-android-release.mjs` automatically deletes any accidental APKs located in `public/apk` or `dist/apk` prior to bundling.

---

## 🛠️ Troubleshooting & Frequently Asked Questions

### 1. Gradle Build Error: `JAVA_HOME is not set`
- Ensure OpenJDK or Oracle JDK 17+ is installed.
- Set your system environment variable:
  ```cmd
  set JAVA_HOME=C:\Program Files\Java\jdk-17
  ```

### 2. Clean Gradle Cache
If Gradle gets stuck or encounters stale cache:
```cmd
cd android
.\gradlew.bat clean
cd ..
npm run build:release
```

### 3. Google Play Store Submission
When ready to upload to Google Play:
```bash
node build-android-release.mjs --bundle
```
The resulting signed bundle will be created at:
`android/app/build/outputs/bundle/release/app-release.aab`
Upload this `.aab` file directly into the **Google Play Console** under **Production Release**.
