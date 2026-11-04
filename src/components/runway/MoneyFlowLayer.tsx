import React, { useEffect, useState } from 'react';
import { getCelebrationMode } from '../../utils/celebrations';

interface Particle {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  scale: number;
  delay: number;
  icon: string;
}

interface MoneyFlowLayerProps {
  active: boolean;
  onComplete?: () => void;
  count?: number;
  symbol?: string;
}

export const MoneyFlowLayer: React.FC<MoneyFlowLayerProps> = ({
  active,
  onComplete,
  count = 10,
  symbol = '🪙',
}) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) {
      setParticles([]);
      return;
    }

    const mode = getCelebrationMode();
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (mode === 'OFF' || prefersReducedMotion) {
      onComplete?.();
      return;
    }

    const actualCount = Math.min(14, mode === 'REDUCED' ? Math.min(count, 4) : count);
    const newParticles: Particle[] = [];

    for (let i = 0; i < actualCount; i++) {
      const angle = (Math.PI * 2 * i) / actualCount + (Math.random() - 0.5) * 0.4;
      const distance = 60 + Math.random() * 80;
      newParticles.push({
        id: i,
        x: 0,
        y: 0,
        tx: Math.cos(angle) * distance,
        ty: Math.sin(angle) * distance - 30,
        scale: 0.7 + Math.random() * 0.5,
        delay: i * 40,
        icon: symbol,
      });
    }

    setParticles(newParticles);

    const timer = setTimeout(() => {
      setParticles([]);
      onComplete?.();
    }, 1100);

    return () => clearTimeout(timer);
  }, [active, count, symbol, onComplete]);

  if (particles.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      aria-hidden="true"
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute animate-coin-arc text-xl select-none"
          style={
            {
              '--tx': `${p.tx}px`,
              '--ty': `${p.ty}px`,
              animationDelay: `${p.delay}ms`,
            } as React.CSSProperties
          }
        >
          {p.icon}
        </span>
      ))}
    </div>
  );
};

