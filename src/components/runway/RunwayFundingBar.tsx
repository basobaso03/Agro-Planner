import React from 'react';
import type { RunwayFundingLayers } from '../../types/runway';
import { CountUp } from './CountUp';
import { formatMoney, isPrivacyMasked } from '../../utils/currency';

interface RunwayFundingBarProps {
  layers: RunwayFundingLayers;
  showLabels?: boolean;
  compact?: boolean;
  className?: string;
  showNumbers?: boolean;
}

export const RunwayFundingBar: React.FC<RunwayFundingBarProps> = ({
  layers,
  showLabels = true,
  compact = false,
  className = '',
  showNumbers,
}) => {
  const isMasked = showNumbers !== undefined ? !showNumbers : isPrivacyMasked();
  const target = layers.totalRequirement || 1;
  const collectedPct = Math.min(100, Math.max(0, (layers.collected / target) * 100));
  const pledgedPct = Math.min(100, Math.max(0, (layers.pledged / target) * 100));
  const executedPct = Math.min(100, Math.max(0, (layers.executed / target) * 100));

  // Contingency reserve tick position
  const nonReservePct =
    target > 0 ? Math.max(0, Math.min(100, ((target - (layers.reserveLeft + layers.reserveUsed)) / target) * 100)) : 100;

  return (
    <div className={`w-full space-y-2 ${className}`}>
      {/* Top summary row */}
      {showLabels && (
        <div className="flex items-center justify-between text-xs sm:text-sm font-medium">
          <div className="flex items-center space-x-2">
            <span className="text-gray-900 dark:text-gray-100 font-bold">
              <CountUp value={layers.collected} decimals={0} showNumbers={!isMasked} />
            </span>
            <span className="text-gray-400">/</span>
            <span className="text-gray-500 dark:text-gray-400">
              {isMasked ? '•••••• Target' : `${formatMoney(layers.totalRequirement, true)} Target`}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${layers.collectedPct >= 100
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300'
                }`}
            >
              {isMasked ? '••% Paid-in' : `${layers.collectedPct}% Paid-in`}
            </span>
            {layers.pledgedPct > layers.collectedPct && (
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                ({isMasked ? '••% Pledged' : `${layers.pledgedPct}% Pledged`})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Multi-layer Bar */}
      <div
        className={`relative w-full rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden shadow-inner ${compact ? 'h-2.5' : 'h-4 sm:h-5'
          }`}
        role="progressbar"
        aria-valuenow={layers.collectedPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Runway Funding Progress"
      >
        {/* Layer 3: Pledged commitments (translucent amber stripe) */}
        <div
          className="absolute inset-y-0 left-0 bg-amber-400/50 dark:bg-amber-500/40 transition-all duration-700 ease-out"
          style={{ width: `${pledgedPct}%` }}
        />

        {/* Layer 2: Paid-in ground cash (solid indigo) */}
        <div
          className="absolute inset-y-0 left-0 bg-indigo-600 dark:bg-indigo-500 transition-all duration-700 ease-out"
          style={{ width: `${collectedPct}%` }}
        />

        {/* Layer 1: Executed spend (solid emerald) */}
        {executedPct > 0 && (
          <div
            className="absolute inset-y-0 left-0 bg-emerald-500 dark:bg-emerald-400 transition-all duration-700 ease-out"
            style={{ width: `${executedPct}%` }}
          />
        )}

        {/* Contingency Reserve Tick */}
        {layers.reserveLeft + layers.reserveUsed > 0 && nonReservePct < 99 && (
          <div
            className="absolute inset-y-0 w-0.5 bg-rose-400/70 dark:bg-rose-500/70 z-10"
            style={{ left: `${nonReservePct}%` }}
            title={isMasked ? 'Contingency reserve threshold' : `Contingency reserve threshold (${formatMoney(layers.reserveLeft + layers.reserveUsed, true)})`}
          />
        )}
      </div>

      {/* Bottom legend chips */}
      {showLabels && !compact && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400 pt-0.5">
          {layers.executed > 0 && (
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Executed: {formatMoney(layers.executed, !isMasked)}</span>
            </div>
          )}
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 dark:bg-indigo-500" />
            <span>Cash Paid In: {formatMoney(layers.collected, !isMasked)}</span>
          </div>
          {layers.pledged > layers.collected && (
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400/60" />
              <span>Pledged: {formatMoney(layers.pledged, !isMasked)}</span>
            </div>
          )}
          {layers.reserveLeft > 0 && (
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
              <span>Reserve Left: {formatMoney(layers.reserveLeft, !isMasked)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

