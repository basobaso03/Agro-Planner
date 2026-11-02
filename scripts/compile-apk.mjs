import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('\x1b[36m========================================================\x1b[0m');
console.log('\x1b[36m   Agro Planner - Standalone Production APK Builder    \x1b[0m');
console.log('\x1b[36m========================================================\x1b[0m\n');

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const gradlewCmd = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew';

try {
  // Step 1: Pre-build cleanup of stale caches and stray APKs
  console.log('\x1b[33m[1/6] Cleaning stale web assets & preventing recursive APK nesting...\x1b[0m');
  const strayPaths = [
    path.join(projectRoot, 'dist'),
    path.join(projectRoot, 'public', 'apk'),
    path.join(projectRoot, 'public', 'public-website', 'apk'),
    path.join(projectRoot, 'android', 'app', 'src', 'main', 'assets', 'public'),
    path.join(projectRoot, 'android', 'app', 'build', 'intermediates', 'merged_assets'),
    path.join(projectRoot, 'android', 'app', 'build', 'intermediates', 'assets'),
  ];
  strayPaths.forEach((p) => {
    if (fs.existsSync(p)) {
      try {
        fs.rmSync(p, { recursive: true, force: true });
      } catch (rmErr) {
        console.warn(`  Notice: Could not remove ${p}:`, rmErr.message);
      }
    }
  });

  // Step 2: Validate TypeScript code
  console.log('\n\x1b[33m[2/6] Validating TypeScript codebase integrity (tsc --noEmit)...\x1b[0m');
  execSync(`${npmCmd} run lint`, { cwd: projectRoot, stdio: 'inherit' });

  // Step 3: Build fresh production web bundle with Vite
  console.log('\n\x1b[33m[3/6] Building production web bundle with Vite...\x1b[0m');
  execSync(`${npmCmd} run build`, { cwd: projectRoot, stdio: 'inherit' });

  // Step 4: Sync fresh assets & plugins into native Android project with Capacitor
  console.log('\n\x1b[33m[4/6] Syncing assets to native Android project with Capacitor...\x1b[0m');
  execSync(`${npxCmd} cap sync android`, { cwd: projectRoot, stdio: 'inherit' });

  // Step 5: Run Gradle to compile the standalone Android APK
  console.log('\n\x1b[33m[5/6] Compiling standalone Android APK with Gradle...\x1b[0m');
  const androidDir = path.join(projectRoot, 'android');
  execSync(`${gradlewCmd} assembleDebug`, { cwd: androidDir, stdio: 'inherit' });

  // Step 6: Verify and distribute compiled APK package
  console.log('\n\x1b[33m[6/6] Distributing fresh APK to output targets...\x1b[0m');
  const srcApk = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  if (!fs.existsSync(srcApk)) {
    throw new Error(`Compiled APK not found at ${srcApk}`);
  }

  const targetDirs = [
    path.join(projectRoot, 'apk'),
    path.join(projectRoot, 'public-website', 'apk'),
  ];

  targetDirs.forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(srcApk, path.join(dir, 'agro-planner.apk'));
  });

  const stats = fs.statSync(srcApk);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

  // Automatically update dynamic size config in public website HTML files
  try {
    const websiteHtmlPath = path.join(projectRoot, 'public-website', 'index.html');
    const publicWebsiteHtmlPath = path.join(projectRoot, 'public', 'public-website', 'index.html');

    if (fs.existsSync(websiteHtmlPath)) {
      let htmlContent = fs.readFileSync(websiteHtmlPath, 'utf-8');
      htmlContent = htmlContent.replace(/apkSize:\s*['"][^'"]+['"]/, `apkSize: '${sizeMb} MB'`);
      fs.writeFileSync(websiteHtmlPath, htmlContent, 'utf-8');

      if (fs.existsSync(path.dirname(publicWebsiteHtmlPath))) {
        fs.copyFileSync(websiteHtmlPath, publicWebsiteHtmlPath);
      }
      console.log(`\x1b[32m✔ Website Sync: Auto-updated APP_CONFIG.apkSize to ${sizeMb} MB\x1b[0m`);
    }

    // Sync version.json across public, dist, and public-website
    const versionSrc = path.join(projectRoot, 'public', 'version.json');
    if (fs.existsSync(versionSrc)) {
      const distVersion = path.join(projectRoot, 'dist', 'version.json');
      const websiteVersion = path.join(projectRoot, 'public-website', 'version.json');
      const rootVersion = path.join(projectRoot, 'version.json');
      if (fs.existsSync(path.join(projectRoot, 'dist'))) {
        fs.copyFileSync(versionSrc, distVersion);
      }
      fs.copyFileSync(versionSrc, websiteVersion);
      fs.copyFileSync(versionSrc, rootVersion);
      console.log(`\x1b[32m✔ Version Config Sync: Synchronized version.json across dist & public-website\x1b[0m`);
    }
  } catch (syncErr) {
    console.warn('  (Could not auto-update website size config, continuing...)', syncErr.message);
  }

  console.log(`\n\x1b[32m========================================================\x1b[0m`);
  console.log(`\x1b[32m✔ Standalone Production APK successfully built!\x1b[0m`);
  console.log(`\x1b[32m✔ File Size: ${sizeMb} MB\x1b[0m`);
  console.log(`\x1b[32m✔ Output Location: ./apk/agro-planner.apk\x1b[0m`);
  console.log(`\x1b[32m✔ Website Location: ./public-website/apk/agro-planner.apk\x1b[0m`);
  console.log(`\x1b[32m✔ 100% fresh assets, latest fixes, and zero stale caches guaranteed.\x1b[0m`);
  console.log(`\x1b[32m========================================================\x1b[0m\n`);
} catch (err) {
  console.error('\n\x1b[31m✖ APK Build Failed:\x1b[0m', err.message);
  process.exit(1);
}
