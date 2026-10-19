import React from 'react';

interface FarmTerrainBackgroundProps {
  intensity?: 'subtle' | 'standard' | 'expressive';
}

export const FarmTerrainBackground: React.FC<FarmTerrainBackgroundProps> = ({
  intensity = 'standard',
}) => {
  const opacityClass =
    intensity === 'subtle'
      ? 'opacity-40'
      : intensity === 'expressive'
      ? 'opacity-100'
      : 'opacity-75';

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 pointer-events-none -z-10 overflow-hidden transition-opacity duration-300 ${opacityClass}`}
    >
      <svg
        className="w-full h-full object-cover"
        viewBox="0 0 1440 1024"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Base Warm Sunlight Gradient */}
          <radialGradient
            id="soloraSunbeam"
            cx="20%"
            cy="15%"
            r="60%"
            fx="15%"
            fy="10%"
          >
            <stop offset="0%" stopColor="#FEF3C7" stopOpacity="0.65" />
            <stop offset="45%" stopColor="#FAF7F2" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#F5F0E6" stopOpacity="0.1" />
          </radialGradient>

          {/* Secondary Ambient Light Pod (Lower Right) */}
          <radialGradient
            id="ambientWarmth"
            cx="85%"
            cy="80%"
            r="50%"
          >
            <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.25" />
            <stop offset="60%" stopColor="#FAF7F2" stopOpacity="0" />
          </radialGradient>

          {/* Agricultural Field Grid Pattern */}
          <pattern
            id="agroGrid"
            width="80"
            height="80"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 80 0 L 0 0 0 80"
              fill="none"
              stroke="#E8DFCE"
              strokeWidth="0.75"
              strokeOpacity="0.4"
            />
            <circle cx="80" cy="0" r="1.5" fill="#D97706" fillOpacity="0.25" />
          </pattern>
        </defs>

        {/* Canvas Base Tones */}
        <rect width="100%" height="100%" fill="#FAF7F2" />
        <rect width="100%" height="100%" fill="url(#soloraSunbeam)" />
        <rect width="100%" height="100%" fill="url(#ambientWarmth)" />
        <rect width="100%" height="100%" fill="url(#agroGrid)" opacity="0.6" />

        {/* Organic Farm Topographical Contour Lines */}
        <g stroke="#D97706" strokeOpacity="0.08" strokeWidth="1.5" fill="none">
          {/* Ridge 1: Upper Terrace */}
          <path d="M-100 180 C 200 140, 480 260, 820 190 C 1120 130, 1340 240, 1600 170" />
          <path d="M-100 230 C 180 190, 490 310, 840 240 C 1140 180, 1360 290, 1600 220" />
          <path d="M-100 280 C 160 240, 500 360, 860 290 C 1160 230, 1380 340, 1600 270" strokeOpacity="0.05" />

          {/* Valley Contour: Pasture & Crop Section */}
          <path d="M-100 520 C 300 460, 620 620, 980 540 C 1240 480, 1420 580, 1600 530" stroke="#059669" strokeOpacity="0.06" strokeWidth="1.75" />
          <path d="M-100 580 C 280 520, 640 680, 1000 600 C 1260 540, 1440 640, 1600 590" stroke="#059669" strokeOpacity="0.04" />
          <path d="M-100 640 C 260 580, 660 740, 1020 660 C 1280 600, 1460 700, 1600 650" strokeOpacity="0.05" />

          {/* Ridge 2: Lower Ranch Boundary */}
          <path d="M-100 840 C 350 780, 720 920, 1080 850 C 1300 810, 1480 890, 1600 860" />
          <path d="M-100 900 C 330 840, 740 980, 1100 910 C 1320 870, 1500 950, 1600 920" strokeOpacity="0.04" />
        </g>

        {/* Precision Solar Angle Ray Lines (Matching Reference Modern Energy Aesthetic) */}
        <g stroke="#F59E0B" strokeOpacity="0.05" strokeWidth="1" strokeDasharray="6 8">
          <line x1="80" y1="0" x2="420" y2="1024" />
          <line x1="280" y1="0" x2="620" y2="1024" />
          <line x1="480" y1="0" x2="820" y2="1024" />
        </g>
      </svg>
    </div>
  );
};
