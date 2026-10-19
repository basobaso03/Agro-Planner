const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const RES_DIR = path.join(ROOT_DIR, 'android', 'app', 'src', 'main', 'res');

// Base Organic Sprout AP SVG inner elements
const EMBLEM_INNER_SVG = `
  <circle cx="250" cy="250" r="160" fill="#047857" fill-opacity="0.45" />
  <path d="M 125 385 C 130 260 190 140 240 95 C 248 150 215 250 180 385 Z" fill="#ffffff" />
  <path d="M 285 140 L 285 385" stroke="#ffffff" stroke-width="42" stroke-linecap="round" fill="none" />
  <path d="M 285 140 C 375 120 425 175 420 235 C 415 285 365 305 285 300" stroke="#ffffff" stroke-width="42" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  <path d="M 285 150 C 340 160 380 205 380 235 C 330 235 295 195 285 150 Z" fill="#10b981" />
  <path d="M 160 290 Q 230 270 310 280" stroke="#34d399" stroke-width="28" stroke-linecap="round" fill="none" />
  <path d="M 230 95 C 235 60 215 40 190 45 C 185 70 205 90 230 95 Z" fill="#6ee7b7" />
  <path d="M 245 95 C 275 65 310 70 320 90 C 295 105 270 105 245 95 Z" fill="#10b981" />
`;

// 1. Standard Squircle / Rounded Badge SVG
const SQUIRCLE_BADGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500" fill="none">
  <rect width="500" height="500" rx="108" fill="#064e3b" />
  <rect x="20" y="20" width="460" height="460" rx="88" stroke="#34d399" stroke-width="6" stroke-opacity="0.3" fill="none" />
  ${EMBLEM_INNER_SVG}
</svg>`;

// 2. Circular Badge SVG for round launchers
const CIRCULAR_BADGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500" fill="none">
  <circle cx="250" cy="250" r="250" fill="#064e3b" />
  <circle cx="250" cy="250" r="236" stroke="#34d399" stroke-width="6" stroke-opacity="0.3" fill="none" />
  ${EMBLEM_INNER_SVG}
</svg>`;

// 3. Adaptive Foreground SVG (108x108 viewport with safe zone: emblem scaled to 62% in center)
const ADAPTIVE_FOREGROUND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" width="108" height="108" fill="none">
  <g transform="translate(19.5, 19.5) scale(0.138)">
    ${EMBLEM_INNER_SVG}
  </g>
</svg>`;

function renderSvgToPng(svgStr, targetWidth, targetHeight) {
  const resvg = new Resvg(svgStr, {
    fitTo: targetHeight
      ? { mode: 'height', value: targetHeight }
      : { mode: 'width', value: targetWidth },
  });
  return resvg.render().asPng();
}

// 4. Splash Screen SVG generator
function createSplashSvg(width, height) {
  const isPortrait = height >= width;
  const iconSize = Math.round(isPortrait ? Math.min(width * 0.44, 420) : Math.min(height * 0.46, 360));
  const iconX = Math.round((width - iconSize) / 2);
  const iconY = Math.round(isPortrait ? height * 0.34 - iconSize / 2 : height * 0.42 - iconSize / 2);

  const titleY = iconY + iconSize + Math.round(iconSize * 0.26);
  const titleFontSize = Math.max(22, Math.round(iconSize * 0.22));
  const subtitleY = titleY + Math.round(titleFontSize * 0.75);
  const subtitleFontSize = Math.max(10, Math.round(titleFontSize * 0.32));

  const bottomY = isPortrait ? height - Math.round(height * 0.08) : height - Math.round(height * 0.09);
  const bottomFontSize = Math.max(12, Math.round(titleFontSize * 0.36));
  const bottomTagY = bottomY - Math.round(bottomFontSize * 1.15);
  const bottomTagFontSize = Math.max(9, Math.round(bottomFontSize * 0.65));

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FAF7F2" />
      <stop offset="100%" stop-color="#F2EDE4" />
    </linearGradient>
    <linearGradient id="titleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#047857" />
      <stop offset="35%" stop-color="#10b981" />
      <stop offset="70%" stop-color="#f59e0b" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>
    <linearGradient id="basobasoGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#b45309" />
      <stop offset="50%" stop-color="#be123c" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#064e3b" flood-opacity="0.18" />
    </filter>
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="url(#bgGrad)" />

  <!-- Ambient Decorative Rings -->
  <circle cx="${width / 2}" cy="${iconY + iconSize / 2}" r="${iconSize * 0.85}" fill="none" stroke="#10b981" stroke-width="1.5" stroke-opacity="0.15" />
  <circle cx="${width / 2}" cy="${iconY + iconSize / 2}" r="${iconSize * 1.15}" fill="none" stroke="#f59e0b" stroke-width="1" stroke-opacity="0.12" stroke-dasharray="6,6" />

  <!-- Centered Organic Sprout AP Logo Badge -->
  <g transform="translate(${iconX}, ${iconY}) scale(${iconSize / 500})" filter="url(#shadow)">
    <rect width="500" height="500" rx="108" fill="#064e3b" />
    <rect x="20" y="20" width="460" height="460" rx="88" stroke="#34d399" stroke-width="6" stroke-opacity="0.3" fill="none" />
    ${EMBLEM_INNER_SVG}
  </g>

  <!-- Title: Agro Planner with gradient fill -->
  <text x="${width / 2}" y="${titleY}" text-anchor="middle" font-family="'Segoe UI', -apple-system, Roboto, sans-serif" font-weight="900" font-size="${titleFontSize}" fill="url(#titleGrad)" letter-spacing="1">Agro Planner</text>

  <!-- Subtitle -->
  <text x="${width / 2}" y="${subtitleY}" text-anchor="middle" font-family="'Segoe UI', -apple-system, Roboto, sans-serif" font-weight="600" font-size="${subtitleFontSize}" fill="#64748b" letter-spacing="2">MULTI-LOCATION LIVESTOCK &amp; SYNDICATE ERP</text>

  <!-- Bottom Developer Attribution -->
  <text x="${width / 2}" y="${bottomTagY}" text-anchor="middle" font-family="'Segoe UI', -apple-system, Roboto, sans-serif" font-weight="700" font-size="${bottomTagFontSize}" fill="#94a3b8" letter-spacing="3">ENGINEERED BY</text>
  <text x="${width / 2}" y="${bottomY}" text-anchor="middle" font-family="'Segoe UI', -apple-system, Roboto, sans-serif" font-weight="900" font-size="${bottomFontSize}" fill="url(#basobasoGrad)" letter-spacing="4">BASOBASO SOFTWARES</text>
</svg>`;
}

async function main() {
  console.log('--- Generating Brand Assets ---');

  // 1. Write public/icon.svg
  fs.writeFileSync(path.join(PUBLIC_DIR, 'icon.svg'), SQUIRCLE_BADGE_SVG.trim());
  console.log('✓ Written public/icon.svg');

  // 2. Generate Web Icons
  const webIcons = [
    { name: 'icon.png', size: 512, svg: SQUIRCLE_BADGE_SVG },
    { name: 'pwa-512x512.png', size: 512, svg: SQUIRCLE_BADGE_SVG },
    { name: 'pwa-192x192.png', size: 192, svg: SQUIRCLE_BADGE_SVG },
    { name: 'apple-touch-icon.png', size: 180, svg: SQUIRCLE_BADGE_SVG },
    { name: 'favicon.png', size: 64, svg: SQUIRCLE_BADGE_SVG },
  ];

  for (const item of webIcons) {
    const png = renderSvgToPng(item.svg, item.size, item.size);
    fs.writeFileSync(path.join(PUBLIC_DIR, item.name), png);
    console.log(`✓ Written public/${item.name} (${item.size}x${item.size})`);
  }

  // 3. Android Mipmap Icons
  const mipmapDensities = [
    { folder: 'mipmap-mdpi', launcherSize: 48, fgSize: 108 },
    { folder: 'mipmap-hdpi', launcherSize: 72, fgSize: 162 },
    { folder: 'mipmap-xhdpi', launcherSize: 96, fgSize: 216 },
    { folder: 'mipmap-xxhdpi', launcherSize: 144, fgSize: 324 },
    { folder: 'mipmap-xxxhdpi', launcherSize: 192, fgSize: 432 },
  ];

  for (const d of mipmapDensities) {
    const targetDir = path.join(RES_DIR, d.folder);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    // ic_launcher.png (squircle badge)
    const launcherPng = renderSvgToPng(SQUIRCLE_BADGE_SVG, d.launcherSize, d.launcherSize);
    fs.writeFileSync(path.join(targetDir, 'ic_launcher.png'), launcherPng);

    // ic_launcher_round.png (circular badge)
    const roundPng = renderSvgToPng(CIRCULAR_BADGE_SVG, d.launcherSize, d.launcherSize);
    fs.writeFileSync(path.join(targetDir, 'ic_launcher_round.png'), roundPng);

    // ic_launcher_foreground.png (adaptive foreground)
    const fgPng = renderSvgToPng(ADAPTIVE_FOREGROUND_SVG, d.fgSize, d.fgSize);
    fs.writeFileSync(path.join(targetDir, 'ic_launcher_foreground.png'), fgPng);

    console.log(`✓ Updated ${d.folder} icons`);
  }

  // 4. Update Android ic_launcher_background.xml
  const bgXmlPath = path.join(RES_DIR, 'values', 'ic_launcher_background.xml');
  if (fs.existsSync(bgXmlPath)) {
    const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#064e3b</color>
</resources>
`;
    fs.writeFileSync(bgXmlPath, xmlContent);
    console.log('✓ Updated values/ic_launcher_background.xml to #064e3b');
  }

  // 5. Android Splash Screen Drawables
  const splashTargets = [
    { folder: 'drawable', width: 480, height: 320 },
    { folder: 'drawable-land-mdpi', width: 480, height: 320 },
    { folder: 'drawable-land-hdpi', width: 800, height: 480 },
    { folder: 'drawable-land-xhdpi', width: 1280, height: 720 },
    { folder: 'drawable-land-xxhdpi', width: 1600, height: 960 },
    { folder: 'drawable-land-xxxhdpi', width: 1920, height: 1280 },
    { folder: 'drawable-port-mdpi', width: 320, height: 480 },
    { folder: 'drawable-port-hdpi', width: 480, height: 800 },
    { folder: 'drawable-port-xhdpi', width: 720, height: 1280 },
    { folder: 'drawable-port-xxhdpi', width: 960, height: 1600 },
    { folder: 'drawable-port-xxxhdpi', width: 1280, height: 1920 },
  ];

  for (const s of splashTargets) {
    const targetDir = path.join(RES_DIR, s.folder);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    const splashSvg = createSplashSvg(s.width, s.height);
    const splashPng = renderSvgToPng(splashSvg, s.width, s.height);
    fs.writeFileSync(path.join(targetDir, 'splash.png'), splashPng);
    console.log(`✓ Updated ${s.folder}/splash.png (${s.width}x${s.height})`);
  }

  console.log('\nAll App Icons and Splash Screens generated successfully!');
}

main().catch((err) => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
