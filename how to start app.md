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

## Option 2: Production Standalone APK (100% Independent - No PC or Terminal Needed!)
Use this to compile a final `.apk` that can be installed on ANY Android phone. Once installed:
- It **does NOT depend** on your PC or any running terminal.
- Your computer can be turned off.
- The app runs completely from internal device storage (`https://localhost/`).
- Works offline in remote fields and syncs directly to Firebase Cloud Firestore.

### How to Compile the Standalone APK:

1. **Build web assets and sync to native Android:**
   ```bash
   npm run build
   npx cap sync android
   ```

2. **Compile the Standalone APK:**
   - **Using Terminal (Windows):**
     ```bash
     cd android
     .\gradlew.bat assembleDebug
     cd ..
     ```
   - **OR Using Android Studio:**
     Open the `android/` folder in Android Studio and select:
     **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**.

3. **Locate your compiled APK:**
   The output APK is generated at:
   `android/app/build/outputs/apk/debug/app-debug.apk`

4. **Distribute:**
   Copy this file to `apk/agro-planner.apk`. You can share it directly on WhatsApp, email, or let users download it from your public website download button. Anyone can install and use it independently!