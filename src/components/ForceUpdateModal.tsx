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
    <div className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="w-full max-w-md bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 shadow-2xl shadow-emerald-500/10 relative overflow-hidden">
        {/* Glow background effect */}
        <div
          className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl pointer-events-none ${
            isForced ? 'bg-amber-500/20' : 'bg-emerald-500/20'
          }`}
        />

        {/* Header */}
        <div className="flex items-start justify-between mb-4 relative z-10">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                isForced
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {isForced ? <ShieldAlert className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-lg font-black text-white leading-tight">
                {config.title || 'Update Available'}
              </h3>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Installed: v{CURRENT_APP_VERSION}
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Latest: v{config.latestVersion}
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Min Required: v{config.minSupportedVersion}
                </span>
              </div>
            </div>
          </div>

          {!isForced && onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white transition-colors"
              aria-label="Close release notes"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Warning Banner for Forced / Minimum Version Block */}
        {isForced ? (
          <div className="mb-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs leading-relaxed flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-amber-300 uppercase tracking-wider text-[11px] mb-1">
                {isBelowMin
                  ? `Version v${CURRENT_APP_VERSION} Is No Longer Supported`
                  : 'Mandatory Security & Ledger Update Required'}
              </p>
              <span>
                Your installed application version (<strong>v{CURRENT_APP_VERSION}</strong>) is below the minimum
                required version (<strong>v{config.minSupportedVersion}</strong>). Access to Agro Planner is locked
                until you install <strong>v{config.latestVersion}</strong> to ensure cloud ledger compatibility.
              </span>
            </div>
          </div>
        ) : isUpToDate ? (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-200 text-xs leading-relaxed flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              You are running the latest supported release (<strong>v{CURRENT_APP_VERSION}</strong>). Here is what is
              included in this version:
            </span>
          </div>
        ) : null}

        {/* Release Notes */}
        {config.releaseNotes && (
          <div className="mb-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Release Information &amp; What&apos;s New in v{config.latestVersion}
            </h4>
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 max-h-52 overflow-y-auto text-xs text-slate-300 space-y-2 leading-relaxed whitespace-pre-line">
              {config.releaseNotes}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5">
          {(!isUpToDate || isForced) && (
            <button
              onClick={handleUpdate}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <Download className="w-4 h-4" />
              Download &amp; Install Official v{config.latestVersion} Now
            </button>
          )}

          {!isForced && onClose && (
            <button
              onClick={onClose}
              className="w-full py-3 px-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 font-semibold text-xs transition-colors"
            >
              {isUpToDate ? 'Continue to Agro Planner' : 'Remind Me Later'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

