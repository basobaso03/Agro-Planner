import React from 'react';

export type LogoId = 'organic-sprout';

interface LogoSvgProps {
  id?: string;
  size?: number | string;
  className?: string;
  variant?: 'badge' | 'isolated';
}

/**
 * Official Permanent Brand Logo for Agro Planner
 * Concept: Organic Sprout AP Monogram
 * Fluid botanical typography where the stalk of "A" curves upward as a primary plant stem,
 * and the bowl of "P" unfurls like a fresh seedling leaf.
 */
export const LogoSvg: React.FC<LogoSvgProps> = ({
  size = '100%',
  className = '',
  variant = 'badge',
}) => {
  return (
    <svg
      viewBox="0 0 500 500"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: size, height: size }}
      className={className}
      aria-label="Agro Planner Organic Sprout AP Logo"
    >
      {variant === 'badge' && (
        <>
          <rect width="500" height="500" rx="108" fill="#064e3b" />
          <rect
            x="20"
            y="20"
            width="460"
            height="460"
            rx="88"
            stroke="#34d399"
            strokeWidth="6"
            strokeOpacity="0.3"
          />
        </>
      )}

      {/* Ambient organic disk */}
      <circle cx="250" cy="250" r="160" fill="#047857" fillOpacity="0.45" />

      {/* The "A" stalk arching upward like a growth shoot */}
      <path
        d="M 125 385 C 130 260 190 140 240 95 C 248 150 215 250 180 385 Z"
        fill="#ffffff"
      />

      {/* The straight right stem of "P" */}
      <path
        d="M 285 140 L 285 385"
        stroke="#ffffff"
        strokeWidth="42"
        strokeLinecap="round"
      />

      {/* Sprouting Bowl of "P" forming a living leaf canopy */}
      <path
        d="M 285 140 C 375 120 425 175 420 235 C 415 285 365 305 285 300"
        stroke="#ffffff"
        strokeWidth="42"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Emerging Leaf Blade in the bowl */}
      <path
        d="M 285 150 C 340 160 380 205 380 235 C 330 235 295 195 285 150 Z"
        fill="#10b981"
      />

      {/* Organic crossbar uniting A and P as an upward angled foliage limb */}
      <path
        d="M 160 290 Q 230 270 310 280"
        stroke="#34d399"
        strokeWidth="28"
        strokeLinecap="round"
      />

      {/* Seed pod motif at the base of A */}
      <path
        d="M 230 95 C 235 60 215 40 190 45 C 185 70 205 90 230 95 Z"
        fill="#6ee7b7"
      />

      {/* Secondary bud at the apex of P */}
      <path
        d="M 245 95 C 275 65 310 70 320 90 C 295 105 270 105 245 95 Z"
        fill="#10b981"
      />
    </svg>
  );
};

export const OrganicSproutLogo = LogoSvg;

export function getSvgString(variant: 'badge' | 'isolated' = 'badge'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" fill="none">
  ${variant === 'badge' ? '<rect width="500" height="500" rx="108" fill="#064e3b"/><rect x="20" y="20" width="460" height="460" rx="88" stroke="#34d399" stroke-width="6" stroke-opacity="0.3"/>' : ''}
  <circle cx="250" cy="250" r="160" fill="#047857" fill-opacity="0.45"/>
  <path d="M 125 385 C 130 260 190 140 240 95 C 248 150 215 250 180 385 Z" fill="#ffffff"/>
  <path d="M 285 140 L 285 385" stroke="#ffffff" stroke-width="42" stroke-linecap="round"/>
  <path d="M 285 140 C 375 120 425 175 420 235 C 415 285 365 305 285 300" stroke="#ffffff" stroke-width="42" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M 285 150 C 340 160 380 205 380 235 C 330 235 295 195 285 150 Z" fill="#10b981"/>
  <path d="M 160 290 Q 230 270 310 280" stroke="#34d399" stroke-width="28" stroke-linecap="round"/>
  <path d="M 230 95 C 235 60 215 40 190 45 C 185 70 205 90 230 95 Z" fill="#6ee7b7"/>
  <path d="M 245 95 C 275 65 310 70 320 90 C 295 105 270 105 245 95 Z" fill="#10b981"/>
</svg>`;
}
