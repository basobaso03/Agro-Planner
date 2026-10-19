const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

// 1. Organic Sprout AP - Full Badge (500x500 base)
const badgeSvg = `<svg viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="500" height="500" rx="108" fill="#064e3b" />
  <rect x="20" y="20" width="460" height="460" rx="88" stroke="#34d399" stroke-width="6" stroke-opacity="0.3" fill="none" />
  <circle cx="250" cy="250" r="160" fill="#047857" fill-opacity="0.45" />
  <path d="M 125 385 C 130 260 190 140 240 95 C 248 150 215 250 180 385 Z" fill="#ffffff" />
  <path d="M 285 140 L 285 385" stroke="#ffffff" stroke-width="42" stroke-linecap="round" fill="none" />
  <path d="M 285 140 C 375 120 425 175 420 235 C 415 285 365 305 285 300" stroke="#ffffff" stroke-width="42" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  <path d="M 285 150 C 340 160 380 205 380 235 C 330 235 295 195 285 150 Z" fill="#10b981" />
  <path d="M 160 290 Q 230 270 310 280" stroke="#34d399" stroke-width="28" stroke-linecap="round" fill="none" />
  <path d="M 230 95 C 235 60 215 40 190 45 C 185 70 205 90 230 95 Z" fill="#6ee7b7" />
  <path d="M 245 95 C 275 65 310 70 320 90 C 295 105 270 105 245 95 Z" fill="#10b981" />
</svg>`;

// 2. Isolated Sprout Symbol (transparent, no badge background)
const isolatedSvg = `<svg viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="250" cy="250" r="160" fill="#047857" fill-opacity="0.45" />
  <path d="M 125 385 C 130 260 190 140 240 95 C 248 150 215 250 180 385 Z" fill="#ffffff" />
  <path d="M 285 140 L 285 385" stroke="#ffffff" stroke-width="42" stroke-linecap="round" fill="none" />
  <path d="M 285 140 C 375 120 425 175 420 235 C 415 285 365 305 285 300" stroke="#ffffff" stroke-width="42" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  <path d="M 285 150 C 340 160 380 205 380 235 C 330 235 295 195 285 150 Z" fill="#10b981" />
  <path d="M 160 290 Q 230 270 310 280" stroke="#34d399" stroke-width="28" stroke-linecap="round" fill="none" />
  <path d="M 230 95 C 235 60 215 40 190 45 C 185 70 205 90 230 95 Z" fill="#6ee7b7" />
  <path d="M 245 95 C 275 65 310 70 320 90 C 295 105 270 105 245 95 Z" fill="#10b981" />
</svg>`;

const scriptsDir = __dirname;
const outputBadgePath = path.join(scriptsDir, 'badge_1024.png');
const outputIsoPath = path.join(scriptsDir, 'isolated_1024.png');

const resvgBadge = new Resvg(badgeSvg, { fitTo: { mode: 'width', value: 1024 } });
fs.writeFileSync(outputBadgePath, resvgBadge.render().asPng());

const resvgIso = new Resvg(isolatedSvg, { fitTo: { mode: 'width', value: 1024 } });
fs.writeFileSync(outputIsoPath, resvgIso.render().asPng());

console.log('SUCCESS: Rendered badge_1024.png and isolated_1024.png');
