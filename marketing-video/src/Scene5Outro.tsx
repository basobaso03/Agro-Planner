import React from 'react';
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

export const Scene5Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({ frame, fps, config: { damping: 12 } });
  const titleSpring = spring({ frame: frame - 15, fps, config: { damping: 14 } });
  const ctaSpring = spring({ frame: frame - 30, fps, config: { damping: 12, mass: 0.9 } });
  const badgesSpring = spring({ frame: frame - 45, fps, config: { damping: 14 } });

  // Subtle breathing pulse for CTA button
  const pulse = Math.sin(frame / 10) * 0.03 + 1;

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
        textAlign: 'center',
        position: 'relative',
        padding: '0 60px',
      }}
    >
      {/* Glow rings */}
      <div
        style={{
          position: 'absolute',
          width: 900,
          height: 900,
          borderRadius: 9999,
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.22) 0%, transparent 65%)',
          pointerEvents: 'none',
        }}
      />

      {/* App Logo */}
      <div
        style={{
          transform: `scale(${logoSpring})`,
          opacity: logoSpring,
          marginBottom: 24,
          position: 'relative',
        }}
      >
        <Img
          src={staticFile('icon.png')}
          style={{
            width: 120,
            height: 120,
            borderRadius: 28,
            border: '2px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 15px 45px rgba(16, 185, 129, 0.45)',
          }}
        />
      </div>

      {/* Main Headline */}
      <h2
        style={{
          fontSize: 64,
          fontWeight: 900,
          color: '#FFFFFF',
          margin: '0 0 16px 0',
          lineHeight: 1.15,
          maxWidth: 1100,
          transform: `translateY(${interpolate(titleSpring, [0, 1], [30, 0])}px)`,
          opacity: titleSpring,
        }}
      >
        Ready to Transform Your Farm &amp; Treasury?
      </h2>

      <p
        style={{
          fontSize: 26,
          color: '#94A3B8',
          maxWidth: 850,
          margin: '0 0 36px 0',
          lineHeight: 1.4,
          opacity: titleSpring,
        }}
      >
        Streamline livestock cycles, protect group capital, and gain full operational visibility with Agro Planner.
      </p>

      {/* Big Action CTA Card */}
      <div
        style={{
          transform: `scale(${ctaSpring * pulse})`,
          opacity: ctaSpring,
          background: 'linear-gradient(135deg, #10B981, #047857)',
          padding: '22px 54px',
          borderRadius: 9999,
          boxShadow: '0 15px 35px rgba(16, 185, 129, 0.5), inset 0 1px 0 rgba(255,255,255,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 36,
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 26 }}>📲</span>
        <span style={{ fontSize: 28, fontWeight: 900, color: '#FFFFFF', letterSpacing: 0.5 }}>
          Get Agro Planner Now
        </span>
      </div>

      {/* Trust Badges */}
      <div
        style={{
          display: 'flex',
          gap: 36,
          transform: `translateY(${interpolate(badgesSpring, [0, 1], [30, 0])}px)`,
          opacity: badgesSpring,
          marginBottom: 32,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#E2E8F0', fontSize: 18, fontWeight: 700 }}>
          <span>✓</span> Native Android APK Release
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#E2E8F0', fontSize: 18, fontWeight: 700 }}>
          <span>✓</span> Progressive Web App (PWA)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#E2E8F0', fontSize: 18, fontWeight: 700 }}>
          <span>✓</span> Zero-Trust Multi-Tenant Security
        </div>
      </div>

      {/* Website URL & Copyright Footer */}
      <div
        style={{
          fontSize: 20,
          color: '#64748B',
          opacity: badgesSpring,
        }}
      >
        Visit: <span style={{ color: '#FBBF24', fontWeight: 800 }}>basobaso03.github.io/Agro-Planner</span> • Produced by BASOBASO SOFTWARES
      </div>
    </div>
  );
};

