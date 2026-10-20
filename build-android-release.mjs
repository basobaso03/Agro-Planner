import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = __dirname;

console.log('\x1b[36m========================================================\x1b[0m');
console.log('\x1b[36m   Agro Planner - Signed Release APK Compiler           \x1b[0m');
console.log('\x1b[36m========================================================\x1b[0m\n');

// 1. Resolve keytool executable
function findKeytool() {
  if (process.env.JAVA_HOME) {
    const javaHomeKeytool = path.join(
      process.env.JAVA_HOME,
      'bin',
      process.platform === 'win32' ? 'keytool.exe' : 'keytool'
    );
    if (fs.existsSync(javaHomeKeytool)) {
      return `"${javaHomeKeytool}"`;
    }
  }
  return 'keytool';
}

const keytoolCmd = findKeytool();
const androidAppDir = path.join(projectRoot, 'android', 'app');
const keystorePath = path.join(androidAppDir, 'release.keystore');
const keyAlias = process.env.RELEASE_KEY_ALIAS || 'agroplanner';
const storePass = process.env.RELEASE_STORE_PASSWORD || 'AgroPlanner2026!';

try {
  // Step 0: Ensure Release Keystore exists
  console.log('\x1b[33m[1/5] Checking Release Keystore...\x1b[0m');
  if (!fs.existsSync(keystorePath)) {
    console.log('  ➜ Keystore not found. Generating a secure production release keystore...');
    const dname = 'CN=Agro Planner, OU=Production, O=AgroPlanner, L=Harare, ST=Harare, C=ZW';
    const genCmd = `${keytoolCmd} -genkeypair -v -keystore "${keystorePath}" -alias "${keyAlias}" -keyalg RSA -keysize 2048 -validity 10000 -storepass "${storePass}" -keypass "${storePass}" -dname "${dname}"`;
    execSync(genCmd, { stdio: 'pipe' });
    console.log('  ✔ Created release keystore at: android/app/release.keystore');
  } else {
    console.log('  ✔ Found existing release keystore at: android/app/release.keystore');
  }

  // Print Keystore Fingerprints for Firebase verification
  try {
    const certOutput = execSync(
      `${keytoolCmd} -list -v -keystore "${keystorePath}" -alias "${keyAlias}" -storepass "${storePass}"`,
      { encoding: 'utf-8' }
    );
    const sha1Match = certOutput.match(/SHA1:\s*([A-F0-9:]+)/i);
    const sha256Match = certOutput.match(/SHA256:\s*([A-F0-9:]+)/i);

    if (sha1Match) {
      console.log(`  🔑 \x1b[32mRelease SHA-1:\x1b[0m   ${sha1Match[1]}`);
    }
    if (sha256Match) {
      console.log(`  🔑 \x1b[32mRelease SHA-256:\x1b[0m ${sha256Match[1]}`);
    }
    console.log('  ℹ  Ensure this SHA-1 is added in your Firebase Console for Google Sign-In.\n');
  } catch {
    console.log('  (Could not read cert fingerprint directly, continuing build...)\n');
  }

  // Step 1: Pre-build cleanup of any nested APK files in web asset directories
  console.log('\x1b[33m[2/5] Cleaning web directories to prevent APK nesting...\x1b[0m');
  const strayApkPaths = [
    path.join(projectRoot, 'public', 'apk'),
    path.join(projectRoot, 'public', 'public-website', 'apk'),
    path.join(projectRoot, 'dist', 'apk'),
    path.join(projectRoot, 'dist', 'public-website', 'apk'),
    path.join(projectRoot, 'android', 'app', 'src', 'main', 'assets', 'public', 'apk'),
    path.join(projectRoot, 'android', 'app', 'src', 'main', 'assets', 'public', 'public-website', 'apk'),
  ];
  strayApkPaths.forEach((p) => {
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
  });

  // Step 2: Production Web Bundle
  console.log('\x1b[33m[3/5] Building optimized web bundle with Vite...\x1b[0m');
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  execSync(`${npmCmd} run build`, { cwd: projectRoot, stdio: 'inherit' });

  // Step 3: Sync to native Android assets
  console.log('\n\x1b[33m[4/5] Syncing web assets to native Android project with Capacitor...\x1b[0m');
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  execSync(`${npxCmd} cap sync android`, { cwd: projectRoot, stdio: 'inherit' });

  // Step 4: Run Gradle to assemble Release APK
  console.log('\n\x1b[33m[5/5] Compiling Signed Release APK with Gradle...\x1b[0m');
  const androidDir = path.join(projectRoot, 'android');
  const gradlewCmd = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew';

  // Pass environment variables to Gradle build
  const env = {
    ...process.env,
    RELEASE_STORE_PASSWORD: storePass,
    RELEASE_KEY_ALIAS: keyAlias,
    RELEASE_KEY_PASSWORD: storePass,
  };

  const isBundle = process.argv.includes('--bundle') || process.argv.includes('--aab');
  const gradleTask = isBundle ? 'bundleRelease' : 'assembleRelease';

  execSync(`${gradlewCmd} ${gradleTask}`, { cwd: androidDir, env, stdio: 'inherit' });

  // Step 5: Verify and distribute compiled APK
  console.log('\n\x1b[33mPackaging and distributing Release files...\x1b[0m');
  const releaseApk = path.join(androidAppDir, 'build', 'outputs', 'apk', 'release', 'app-release.apk');
  const unsignedApk = path.join(androidAppDir, 'build', 'outputs', 'apk', 'release', 'app-release-unsigned.apk');
  const releaseAab = path.join(androidAppDir, 'build', 'outputs', 'bundle', 'release', 'app-release.aab');

  const srcFile = fs.existsSync(releaseApk)
    ? releaseApk
    : isBundle && fs.existsSync(releaseAab)
    ? releaseAab
    : fs.existsSync(unsignedApk)
    ? unsignedApk
    : null;

  if (!srcFile) {
    throw new Error(
      `Release output not found in ${path.join(androidAppDir, 'build', 'outputs')}. Check Gradle build log.`
    );
  }

  const isSigned = srcFile === releaseApk;
  const stats = fs.statSync(srcFile);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

  const targets = [
    path.join(projectRoot, 'apk'),
    path.join(projectRoot, 'public-website', 'apk'),
  ];

  targets.forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(srcFile, path.join(dir, 'agro-planner.apk'));
  });

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
  } catch (syncErr) {
    console.warn('  (Could not auto-update website size config, continuing...)', syncErr.message);
  }

  console.log('\n\x1b[32m✔ SUCCESS! Standalone Release APK Generated Successfully!\x1b[0m');
  console.log(`\x1b[32m✔ File Size: ${sizeMb} MB\x1b[0m`);
  console.log(`\x1b[32m✔ Signature: ${isSigned ? 'SIGNED (Ready for public install)' : 'UNSIGNED'}\x1b[0m`);
  console.log(`\x1b[32m✔ Root APK:    ./apk/agro-planner.apk\x1b[0m`);
  console.log(`\x1b[32m✔ Website APK: ./public-website/apk/agro-planner.apk\x1b[0m\n`);
  console.log('You can now:');
  console.log('  1. Share ./apk/agro-planner.apk directly via WhatsApp or Email');
  console.log('  2. Host it on your website for instant downloads');
  console.log('  3. Users can install it directly on any Android device without development tools.\n');
} catch (err) {
  console.error('\n\x1b[31m✖ Release Build Failed:\x1b[0m', err.message);
  process.exit(1);
}
