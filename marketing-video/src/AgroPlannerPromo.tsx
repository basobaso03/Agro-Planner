import React from 'react';
import { Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Scene1Hook } from './Scene1Hook';
import { Scene2Intro } from './Scene2Intro';
import { Scene3Livestock } from './Scene3Livestock';
import { Scene4Treasury } from './Scene4Treasury';
import { Scene5Outro } from './Scene5Outro';

export const AgroPlannerPromo: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Subtle ambient animated background gradient shift
  const bgHue = interpolate(frame, [0, durationInFrames], [155, 170]);
  const bottomBarWidth = (frame / durationInFrames) * 100;

  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: '#051B14',
        backgroundImage: `
          radial-gradient(circle at 50% 15%, hsla(${bgHue}, 80%, 22%, 0.55) 0%, transparent 60%),
          radial-gradient(circle at 85% 85%, rgba(245, 158, 11, 0.12) 0%, transparent 50%),
          radial-gradient(circle at 15% 80%, rgba(16, 185, 129, 0.15) 0%, transparent 50%)
        `,
        fontFamily: '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
        position: 'relative',
        overflow: 'hidden',
        color: '#FFFFFF',
      }}
    >
      {/* Subtle modern geometric background grid lines */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          opacity: 0.8,
          pointerEvents: 'none',
        }}
      />

      {/* Floating ambient glow spots */}
      <div
        style={{
          position: 'absolute',
          top: -150,
          right: -150,
          width: 600,
          height: 600,
          borderRadius: 9999,
          background: 'rgba(52, 211, 153, 0.15)',
          filter: 'blur(90px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -150,
          left: -150,
          width: 600,
          height: 600,
          borderRadius: 9999,
          background: 'rgba(245, 158, 11, 0.1)',
          filter: 'blur(90px)',
          pointerEvents: 'none',
        }}
      />

      {/* Scene 1 (0s - 6s): Hook */}
      <Sequence from={0} durationInFrames={180}>
        <Scene1Hook />
        <Audio src={staticFile('audio/scene1.mp3')} volume={1} startFrom={0} />
      </Sequence>

      {/* Scene 2 (6s - 12s): Brand Reveal */}
      <Sequence from={180} durationInFrames={180}>
        <Scene2Intro />
        <Audio src={staticFile('audio/scene2.mp3')} volume={1} startFrom={0} />
      </Sequence>

      {/* Scene 3 (12s - 18s): Precision Livestock */}
      <Sequence from={360} durationInFrames={180}>
        <Scene3Livestock />
        <Audio src={staticFile('audio/scene3.mp3')} volume={1} startFrom={0} />
      </Sequence>

      {/* Scene 4 (18s - 24s): Collective Treasury */}
      <Sequence from={540} durationInFrames={180}>
        <Scene4Treasury />
        <Audio src={staticFile('audio/scene4.mp3')} volume={1} startFrom={0} />
      </Sequence>

      {/* Scene 5 (24s - 30s): Grand Finale & CTA */}
      <Sequence from={720} durationInFrames={180}>
        <Scene5Outro />
        <Audio src={staticFile('audio/scene5.mp3')} volume={1} startFrom={0} />
      </Sequence>

      {/* Persistent sleek bottom progress bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: `${bottomBarWidth}%`,
          height: 6,
          background: 'linear-gradient(90deg, #10B981, #F59E0B)',
          boxShadow: '0 0 12px rgba(16, 185, 129, 0.8)',
          zIndex: 50,
        }}
      />
    </div>
  );
};
