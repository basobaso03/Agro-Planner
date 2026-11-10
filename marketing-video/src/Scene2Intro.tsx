import React from 'react';
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

export const Scene2Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({ frame, fps, config: { damping: 12, mass: 0.8 } });
  const textSpring = spring({ frame: frame - 15, fps, config: { damping: 14 } });
  const pillsSpring = spring({ frame: frame - 30, fps, config: { damping: 14 } });

  const opacity = interpolate(frame, [150, 180], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        opacity,
        textAlign: 'center',
        position: 'relative',
      }}
    >
      {/* Background radial glow */}
      <div
        style={{
          position: 'absolute',
          width: 800,
          height: 800,
          borderRadius: 9999,
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Floating Logo with glow */}
      <div
        style={{
          transform: `scale(${logoSpring}) rotate(${interpolate(logoSpring, [0, 1], [-15, 0])}deg)`,
          opacity: logoSpring,
          marginBottom: 32,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: -15,
            borderRadius: 36,
            background: 'linear-gradient(135deg, #10B981, #059669)',
            filter: 'blur(25px)',
            opacity: 0.6,
          }}
        />
        <Img
          src={staticFile('icon.png')}
          style={{
            width: 140,
            height: 140,
            borderRadius: 32,
            border: '2px solid rgba(255,255,255,0.4)',
            boxShadow: '0 20px 50px rgba(16,185,129,0.5)',
            position: 'relative',
          }}
        />
      </div>

      {/* Small eyebrow text */}
      <div
        style={{
          transform: `translateY(${interpolate(textSpring, [0, 1], [30, 0])}px)`,
          opacity: textSpring,
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: 4,
          color: '#34D399',
          textTransform: 'uppercase',
          marginBottom: 12,
        }}
      >
        INTRODUCING
      </div>

      {/* Hero Title */}
      <h1
        style={{
          transform: `translateY(${interpolate(textSpring, [0, 1], [30, 0])}px)`,
          opacity: textSpring,
          fontSize: 78,
          fontWeight: 900,
          color: '#FFFFFF',
          margin: '0 0 16px 0',
          letterSpacing: -1,
        }}
      >
        AGRO PLANNER
      </h1>

      {/* Subtitle */}
      <p
        style={{
          transform: `translateY(${interpolate(textSpring, [0, 1], [30, 0])}px)`,
          opacity: textSpring,
          fontSize: 32,
          color: '#E2E8F0',
          maxWidth: 900,
          lineHeight: 1.4,
          margin: '0 0 40px 0',
          fontWeight: 600,
        }}
      >
        The Enterprise Farm ERP &amp; Collective Treasury Engine
      </p>

      {/* Byline */}
      <div
        style={{
          fontSize: 18,
          color: '#94A3B8',
          letterSpacing: 2,
          textTransform: 'uppercase',
          marginBottom: 44,
          opacity: textSpring,
        }}
      >
        Crafted by <span style={{ color: '#FBBF24', fontWeight: 800 }}>BASOBASO SOFTWARES</span>
      </div>

      {/* Feature Badges */}
      <div
        style={{
          display: 'flex',
          gap: 20,
          transform: `scale(${pillsSpring})`,
          opacity: pillsSpring,
        }}
      >
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            backdropFilter: 'blur(10px)',
            borderRadius: 9999,
            padding: '12px 28px',
            color: '#A7F3D0',
            fontSize: 20,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span>🌱</span> Precision Livestock Milestones
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            backdropFilter: 'blur(10px)',
            borderRadius: 9999,
            padding: '12px 28px',
            color: '#FDE68A',
            fontSize: 20,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span>💰</span> Collective Treasury &amp; Pools
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            backdropFilter: 'blur(10px)',
            borderRadius: 9999,
            padding: '12px 28px',
            color: '#BAE6FD',
            fontSize: 20,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span>🔒</span> Biometric &amp; Offline First
        </div>
      </div>
    </div>
  );
};

