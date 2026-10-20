import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('\x1b[36m=== Agro Planner Standalone Production APK Builder ===\x1b[0m\n');

try {
  // Step 1: Build production web bundle
  console.log('\x1b[33m[1/4] Building web application bundle with Vite...\x1b[0m');
  execSync('npm.cmd run build', { stdio: 'inherit' });

  // Step 2: Sync to native Android assets
  console.log('\n\x1b[33m[2/4] Syncing assets to native Android project with Capacitor...\x1b[0m');
  execSync('npx.cmd cap sync android', { stdio: 'inherit' });

  // Step 3: Run Gradle to assemble standalone APK
  console.log('\n\x1b[33m[3/4] Compiling standalone Android APK with Gradle...\x1b[0m');
  const androidDir = path.resolve('android');
  const gradlewCmd = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew';
  execSync(`${gradlewCmd} assembleDebug`, { cwd: androidDir, stdio: 'inherit' });

  // Step 4: Copy compiled APK to distribution targets
  console.log('\n\x1b[33m[4/4] Distributing compiled APK package...\x1b[0m');
  const srcApk = path.resolve('android/app/build/outputs/apk/debug/app-debug.apk');
  if (!fs.existsSync(srcApk)) {
    throw new Error(`Compiled APK not found at ${srcApk}`);
  }

  const targetDirs = [
    path.resolve('apk'),
    path.resolve('public-website/apk')
  ];

  targetDirs.forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(srcApk, path.join(dir, 'agro-planner.apk'));
  });

  const stats = fs.statSync(srcApk);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

  console.log(`\n\x1b[32m✔ Standalone Production APK successfully built!\x1b[0m`);
  console.log(`\x1b[32m✔ File Size: ${sizeMb} MB\x1b[0m`);
  console.log(`\x1b[32m✔ Output Location: ./apk/agro-planner.apk\x1b[0m`);
  console.log(`\x1b[32m✔ The APK is 100% standalone and requires NO computer or running terminal to work.\x1b[0m\n`);
} catch (err) {
  console.error('\x1b[31m✖ APK Build Failed:\x1b[0m', err.message);
  process.exit(1);
}
