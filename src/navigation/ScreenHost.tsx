import React, { useEffect, useRef } from 'react';

export interface ScreenHostProps {
  screenKey: string;
  children: React.ReactNode;
  className?: string;
  animate?: boolean;
}

/**
 * ScreenHost: Animated host container for multi-stack screen transitions.
 * Ensures hardware-accelerated enter transitions and maintains smooth scrolling.
 */
export const ScreenHost: React.FC<ScreenHostProps> = ({
  screenKey,
  children,
  className = '',
  animate = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Smoothly scroll to top on screen transition
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [screenKey]);

  return (
    <div
      key={screenKey}
      ref={containerRef}
      className={`w-full flex-1 flex flex-col ${animate ? 'animate-fade-in' : ''
        } ${className}`}
    >
      {children}
    </div>
  );
};

