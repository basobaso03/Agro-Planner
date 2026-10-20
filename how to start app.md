# Agro Planner - How to Run & Build

## Option 1: Live Development Mode (Requires PC running dev server)
Use this when making code edits so changes update instantly on your phone:

**Terminal 1:**
```bash
npm run dev
```

**Terminal 2:**
```bash
npm run android:live
```
*(Note: In this mode, the phone connects to your PC via Wi-Fi/USB. If you stop the PC server, the live connection closes.)*

---

## Option 2: Compile Signed Release APK (1-Command Production Build)
Use this to build and sign the final standalone release application for public distribution:

```bash
npm run build:release
```
*Or directly via Node:*
```bash
node build-android-release.mjs
```

### What this command does automatically:
1. Verifies/creates the secure release keystore (`android/app/release.keystore`).
2. Displays the exact **SHA-1** & **SHA-256** fingerprints for Firebase Console verification.
3. Compiles the production web bundle (`npm run build`).
4. Syncs all native assets into Capacitor (`npx cap sync android`).
5. Signs and compiles the release APK with Gradle (`.\gradlew.bat assembleRelease`).
6. Automatically distributes the signed APK to `./apk/agro-planner.apk` and website download folders!
