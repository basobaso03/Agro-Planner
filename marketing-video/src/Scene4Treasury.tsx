import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const Scene4Treasury: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({ frame, fps, config: { damping: 14 } });
  const uiSpring = spring({ frame: frame - 15, fps, config: { damping: 14 } });
  const row1Spring = spring({ frame: frame - 30, fps, config: { damping: 14 } });
  const row2Spring = spring({ frame: frame - 45, fps, config: { damping: 14 } });
  const row3Spring = spring({ frame: frame - 60, fps, config: { damping: 14 } });

  const opacity = interpolate(frame, [150, 180], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const poolProgress = interpolate(frame, [20, 80], [0, 92], {
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
          background: 'rgba(245, 158, 11, 0.15)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          borderRadius: 9999,
          padding: '8px 24px',
          color: '#FBBF24',
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: 'uppercase',
          marginBottom: 16,
        }}
      >
        FINANCIAL GOVERNANCE
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
        Collective Treasury &amp; Transparent Ledger
      </h2>

      <p
        style={{
          fontSize: 24,
          color: '#94A3B8',
          margin: '0 0 40px 0',
          textAlign: 'center',
          maxWidth: 950,
          opacity: titleSpring,
        }}
      >
        Zero-trust financial transparency. Every member contribution, purchase deduction, and runway forecast is recorded in real time.
      </p>

      {/* Treasury Card */}
      <div
        style={{
          width: '100%',
          maxWidth: 1250,
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: 24,
          padding: '36px 40px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          transform: `scale(${uiSpring})`,
          opacity: uiSpring,
        }}
      >
        {/* Top Header stats */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 24,
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            paddingBottom: 20,
          }}
        >
          <div>
            <div style={{ fontSize: 16, color: '#94A3B8' }}>Organisation Master Treasury Pool</div>
            <div style={{ fontSize: 34, fontWeight: 900, color: '#FCD34D' }}>
              $46,000.00 <span style={{ fontSize: 20, color: '#94A3B8', fontWeight: 500 }}>/ $50,000 Target</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, color: '#94A3B8', marginBottom: 4 }}>Secured with 24hr Invite Code</div>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: 18,
                background: 'rgba(255,255,255,0.1)',
                padding: '6px 14px',
                borderRadius: 8,
                color: '#34D399',
                display: 'inline-block',
              }}
            >
              AGRO-SEC-9821
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 16, color: '#E2E8F0', fontWeight: 600 }}>
              Member Contribution Target Completion
            </span>
            <span style={{ fontSize: 16, color: '#FBBF24', fontWeight: 800 }}>
              {Math.round(poolProgress)}% Funded
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
                width: `${poolProgress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #F59E0B, #FBBF24)',
                borderRadius: 9999,
                boxShadow: '0 0 15px rgba(245, 158, 11, 0.6)',
              }}
            />
          </div>
        </div>

        {/* Live Immutable Ledger Entries */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(30, 41, 59, 0.6)',
              borderRadius: 12,
              padding: '14px 20px',
              borderLeft: '4px solid #10B981',
              transform: `translateY(${interpolate(row1Spring, [0, 1], [20, 0])}px)`,
              opacity: row1Spring,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>📥</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF' }}>
                Member Contribution: Sarah T. (Monthly Quota)
              </span>
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#34D399' }}>+$2,500.00</span>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(30, 41, 59, 0.6)',
              borderRadius: 12,
              padding: '14px 20px',
              borderLeft: '4px solid #EF4444',
              transform: `translateY(${interpolate(row2Spring, [0, 1], [20, 0])}px)`,
              opacity: row2Spring,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>🚜</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF' }}>
                Operational Purchase: Solar Brooder Heater &amp; Gas
              </span>
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#F87171' }}>-$1,240.00</span>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(30, 41, 59, 0.6)',
              borderRadius: 12,
              padding: '14px 20px',
              borderLeft: '4px solid #3B82F6',
              transform: `translateY(${interpolate(row3Spring, [0, 1], [20, 0])}px)`,
              opacity: row3Spring,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>📊</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF' }}>
                Runway Forecast: Operational Liquidity Guaranteed
              </span>
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#60A5FA' }}>14 Months Runway</span>
          </div>
        </div>
      </div>
    </div>
  );
};

