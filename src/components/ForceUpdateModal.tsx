import React from 'react';
import { AppVersionConfig, CURRENT_APP_VERSION } from '../services/appUpdateService';
import { Download, AlertTriangle, Sparkles, X, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface ForceUpdateModalProps {
  config: AppVersionConfig | null;
  isForced: boolean;
  isBelowMin?: boolean;
  onClose?: () => void;
}

export const ForceUpdateModal: React.FC<ForceUpdateModalProps> = ({
  config,
  isForced,
  isBelowMin = false,
  onClose
}) => {
  if (!config) return null;

  const isUpToDate = CURRENT_APP_VERSION === config.latestVersion && !isForced;

  const handleUpdate = () => {
    window.open(config.downloadUrl, '_system');
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none">
      <div
        className={`w-full max-w-md bg-white border-2 rounded-3xl p-6 shadow-2xl relative overflow-hidden ${
          isForced
            ? 'border-amber-500 shadow-amber-500/20'
            : 'border-emerald-500 shadow-emerald-500/20'
        }`}
      >
        {/* Soft decorative background glow */}
        <div
          className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl pointer-events-none ${
            isForced ? 'bg-amber-100' : 'bg-emerald-100'
          }`}
        />

        {/* Header */}
        <div className="flex items-start justify-between mb-4 relative z-10">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                isForced
                  ? 'bg-amber-100 text-amber-700 border border-amber-300 shadow-xs'
                  : 'bg-emerald-100 text-emerald-700 border border-emerald-300 shadow-xs'
              }`}
            >
              {isForced ? <ShieldAlert className="w-6 h-6 text-amber-700" /> : <Sparkles className="w-6 h-6 text-emerald-700" />}
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-950 leading-tight">
                {config.title || 'CapitaSeed Update Available'}
              </h3>
              {/* High-contrast badges with black text color */}
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-950 border border-slate-300 shadow-xs">
                  Installed: v{CURRENT_APP_VERSION}
                </span>
                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-slate-950 border border-emerald-400 shadow-xs">
                  Latest: v{config.latestVersion}
                </span>
                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-slate-950 border border-amber-400 shadow-xs">
                  Min Required: v{config.minSupportedVersion}
                </span>
              </div>
            </div>
          </div>

          {!isForced && onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:text-slate-950 hover:bg-slate-200 transition-colors border border-slate-200 cursor-pointer"
              aria-label="Close release notes"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Warning Banner for Forced / Minimum Version Block */}
        {isForced ? (
          <div className="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-300 text-slate-950 text-xs leading-relaxed flex items-start gap-3 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-amber-900 uppercase tracking-wider text-[11px] mb-1">
                {isBelowMin
                  ? `Version v${CURRENT_APP_VERSION} Is No Longer Supported`
                  : 'Mandatory Security & Ledger Update Required'}
              </p>
              <span className="text-slate-900 font-medium">
                Your installed application version (<strong className="text-slate-950 font-black">v{CURRENT_APP_VERSION}</strong>) is below the minimum
                required version (<strong className="text-slate-950 font-black">v{config.minSupportedVersion}</strong>). Access to CapitaSeed is locked
                until you install <strong className="text-emerald-700 font-black">v{config.latestVersion}</strong> to ensure cloud ledger compatibility.
              </span>
            </div>
          </div>
        ) : isUpToDate ? (
          <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-slate-950 text-xs leading-relaxed flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-slate-900 font-medium">
              You are running the latest supported release (<strong className="text-slate-950 font-black">v{CURRENT_APP_VERSION}</strong>). Here is what is
              included in this version:
            </span>
          </div>
        ) : null}

        {/* Release Notes */}
        {config.releaseNotes && (
          <div className="mb-6">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
              Release Information &amp; What&apos;s New in v{config.latestVersion}
            </h4>
            <div className="bg-[#FAF8F5] border border-[#E8DFCE] rounded-2xl p-4 max-h-52 overflow-y-auto text-xs text-slate-950 space-y-2 leading-relaxed whitespace-pre-line font-medium shadow-xs">
              {config.releaseNotes}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5">
          {(!isUpToDate || isForced) && (
            <button
              onClick={handleUpdate}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-sm tracking-wide shadow-lg shadow-emerald-700/20 border border-emerald-500 flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer"
            >
              <Download className="w-4 h-4 text-white shrink-0" />
              <span className="text-white drop-shadow-sm">
                Download &amp; Install Official v{config.latestVersion} Now
              </span>
            </button>
          )}

          {!isForced && onClose && (
            <button
              onClick={onClose}
              className="w-full py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-950 font-black text-xs transition-colors border border-slate-300 cursor-pointer"
            >
              {isUpToDate ? 'Continue to CapitaSeed' : 'Remind Me Later'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
