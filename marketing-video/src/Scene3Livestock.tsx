import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const Scene3Livestock: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({ frame, fps, config: { damping: 14 } });
  const uiSpring = spring({ frame: frame - 15, fps, config: { damping: 14 } });
  const card1Spring = spring({ frame: frame - 30, fps, config: { damping: 15 } });
  const card2Spring = spring({ frame: frame - 45, fps, config: { damping: 15 } });
  const card3Spring = spring({ frame: frame - 60, fps, config: { damping: 15 } });

  const opacity = interpolate(frame, [150, 180], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Animated progress bar
  const progress = interpolate(frame, [30, 90], [0, 85], {
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
      }}
    >
      {/* Category Pill */}
      <div
        style={{
          transform: `scale(${titleSpring})`,
          opacity: titleSpring,
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          borderRadius: 9999,
          padding: '8px 24px',
          color: '#34D399',
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: 'uppercase',
          marginBottom: 16,
        }}
      >
        FEATURE SPOTLIGHT
      </div>

      <h2
        style={{
          fontSize: 54,
          fontWeight: 900,
          color: '#FFFFFF',
          margin: '0 0 12px 0',
          textAlign: 'center',
          transform: `translateY(${interpolate(titleSpring, [0, 1], [30, 0])}px)`,
          opacity: titleSpring,
        }}
      >
        Smart Livestock Milestones &amp; Custom Recipes
      </h2>

      <p
        style={{
          fontSize: 24,
          color: '#94A3B8',
          margin: '0 0 40px 0',
          textAlign: 'center',
          maxWidth: 900,
          opacity: titleSpring,
        }}
      >
        Ditch rigid templates. Cook custom livestock recipes, auto-calculate target dates, and track flock health with precision.
      </p>

      {/* Mock UI Dashboard */}
      <div
        style={{
          width: '100%',
          maxWidth: 1250,
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(52, 211, 153, 0.3)',
          borderRadius: 24,
          padding: '36px 40px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          transform: `scale(${uiSpring})`,
          opacity: uiSpring,
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 28,
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            paddingBottom: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 36 }}>🐔</span>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#FFFFFF' }}>
                Cobb 500 Broiler Flock — Batch #08
              </div>
              <div style={{ fontSize: 16, color: '#34D399', fontWeight: 600 }}>
                Day 24 of 42 • Active Lifecycle • Site Alpha
              </div>
            </div>
          </div>
          <div
            style={{
              background: '#047857',
              color: '#FFFFFF',
              fontWeight: 800,
              padding: '8px 20px',
              borderRadius: 12,
              fontSize: 16,
            }}
          >
            ● OPTIMAL GROWTH
          </div>
        </div>

        {/* 3 Interactive KPI Cards */}
        <div style={{ display: 'flex', gap: 24, marginBottom: 28 }}>
          <div
            style={{
              flex: 1,
              background: 'rgba(30, 41, 59, 0.7)',
              borderRadius: 16,
              padding: 20,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              transform: `translateY(${interpolate(card1Spring, [0, 1], [30, 0])}px)`,
              opacity: card1Spring,
            }}
          >
            <div style={{ fontSize: 15, color: '#94A3B8', marginBottom: 6 }}>Current Milestone</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#FFFFFF' }}>Finisher Feed Phase</div>
            <div style={{ fontSize: 14, color: '#34D399', marginTop: 4 }}>Next: Harvest Window in 18d</div>
          </div>

          <div
            style={{
              flex: 1,
              background: 'rgba(30, 41, 59, 0.7)',
              borderRadius: 16,
              padding: 20,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              transform: `translateY(${interpolate(card2Spring, [0, 1], [30, 0])}px)`,
              opacity: card2Spring,
            }}
          >
            <div style={{ fontSize: 15, color: '#94A3B8', marginBottom: 6 }}>Cumulative Feed Intake</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#FFFFFF' }}>1,850 kg / 2,100 kg</div>
            <div style={{ fontSize: 14, color: '#FBBF24', marginTop: 4 }}>Feed Conversion Ratio: 1.52</div>
          </div>

          <div
            style={{
              flex: 1,
              background: 'rgba(30, 41, 59, 0.7)',
              borderRadius: 16,
              padding: 20,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              transform: `translateY(${interpolate(card3Spring, [0, 1], [30, 0])}px)`,
              opacity: card3Spring,
            }}
          >
            <div style={{ fontSize: 15, color: '#94A3B8', marginBottom: 6 }}>Flock Livability</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#34D399' }}>98.6% Survival</div>
            <div style={{ fontSize: 14, color: '#94A3B8', marginTop: 4 }}>1,480 / 1,500 Birds Active</div>
          </div>
        </div>

        {/* Milestone Progress Bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 16, color: '#CBD5E1', fontWeight: 600 }}>
              Milestone Checklist &amp; Vaccination Schedule
            </span>
            <span style={{ fontSize: 16, color: '#34D399', fontWeight: 800 }}>
              {Math.round(progress)}% Completed
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: 14,
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 9999,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #10B981, #34D399)',
                borderRadius: 9999,
                boxShadow: '0 0 15px rgba(52, 211, 153, 0.6)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

