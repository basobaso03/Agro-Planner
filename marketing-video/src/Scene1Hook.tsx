import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const Scene1Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring
  const titleSpring = spring({ frame, fps, config: { damping: 14 } });
  const cardSpring1 = spring({ frame: frame - 25, fps, config: { damping: 14 } });
  const cardSpring2 = spring({ frame: frame - 40, fps, config: { damping: 14 } });
  const cardSpring3 = spring({ frame: frame - 55, fps, config: { damping: 14 } });

  // Fade out towards transition
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
        padding: '0 80px',
        textAlign: 'center',
      }}
    >
      {/* Category Pill */}
      <div
        style={{
          transform: `scale(${titleSpring})`,
          opacity: titleSpring,
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: 9999,
          padding: '10px 28px',
          color: '#F87171',
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: 'uppercase',
          marginBottom: 24,
        }}
      >
        The Agriculture & Venture Challenge
      </div>

      {/* Main Punchy Hook */}
      <h1
        style={{
          fontSize: 68,
          fontWeight: 900,
          color: '#FFFFFF',
          lineHeight: 1.15,
          maxWidth: 1300,
          margin: '0 0 24px 0',
          transform: `translateY(${interpolate(titleSpring, [0, 1], [40, 0])}px)`,
          opacity: titleSpring,
        }}
      >
        Tired of Managing Multi-Million Farms &amp; Joint Funds on{' '}
        <span
          style={{
            background: 'linear-gradient(135deg, #F87171, #EF4444)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textDecoration: 'underline wavy #EF4444',
          }}
        >
          Scattered Paper &amp; Spreadsheets?
        </span>
      </h1>

      <p
        style={{
          fontSize: 28,
          color: '#94A3B8',
          maxWidth: 950,
          margin: '0 0 48px 0',
          lineHeight: 1.5,
          opacity: titleSpring,
        }}
      >
        Missed vaccination milestones, untracked expenses, and zero transparency between contributors lead to costly losses.
      </p>

      {/* 3 Pain point Cards */}
      <div
        style={{
          display: 'flex',
          gap: 32,
          width: '100%',
          maxWidth: 1350,
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            flex: 1,
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 20,
            padding: '28px 24px',
            transform: `translateY(${interpolate(cardSpring1, [0, 1], [50, 0])}px)`,
            opacity: cardSpring1,
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#FCA5A5', marginBottom: 8 }}>
            Livestock Blindspots
          </div>
          <div style={{ fontSize: 18, color: '#94A3B8', lineHeight: 1.4 }}>
            Feed waste, missed dates, and unmonitored mortality rates eat into farm profit.
          </div>
        </div>

        <div
          style={{
            flex: 1,
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 20,
            padding: '28px 24px',
            transform: `translateY(${interpolate(cardSpring2, [0, 1], [50, 0])}px)`,
            opacity: cardSpring2,
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>💸</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#FCD34D', marginBottom: 8 }}>
            Fund Disagreements
          </div>
          <div style={{ fontSize: 18, color: '#94A3B8', lineHeight: 1.4 }}>
            Unclear partner contributions, missing receipts, and lost audit trails.
          </div>
        </div>

        <div
          style={{
            flex: 1,
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 20,
            padding: '28px 24px',
            transform: `translateY(${interpolate(cardSpring3, [0, 1], [50, 0])}px)`,
            opacity: cardSpring3,
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>📵</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#FCA5A5', marginBottom: 8 }}>
            Zero Offline Sync
          </div>
          <div style={{ fontSize: 18, color: '#94A3B8', lineHeight: 1.4 }}>
            Remote farms lose connection and critical field records vanish into thin air.
          </div>
        </div>
      </div>
    </div>
  );
};

