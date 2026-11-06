import React, { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastOptions {
  type?: 'success' | 'error' | 'info';
  title?: string;
  message: string;
  undoAction?: () => void;
  durationMs?: number;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title?: string;
  message: string;
  undoAction?: () => void;
  durationMs?: number;
}

interface ToastContextType {
  showToast: (
    messageOrOptions: string | ToastOptions,
    type?: 'success' | 'error' | 'info',
    undoAction?: () => void
  ) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (
      messageOrOptions: string | ToastOptions,
      type: 'success' | 'error' | 'info' = 'success',
      undoAction?: () => void
    ) => {
      const id = `TOAST_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      let toastItem: ToastMessage;

      if (typeof messageOrOptions === 'string') {
        toastItem = { id, message: messageOrOptions, type, undoAction };
      } else {
        toastItem = {
          id,
          title: messageOrOptions.title,
          message: messageOrOptions.message,
          type: messageOrOptions.type || 'success',
          undoAction: messageOrOptions.undoAction,
          durationMs: messageOrOptions.durationMs,
        };
      }

      setToasts((prev) => [...prev, toastItem]);

      const timeoutMs = toastItem.durationMs || (toastItem.type === 'error' ? 5000 : 4000);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, timeoutMs);
    },
    []
  );

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const portalTarget =
    typeof document !== 'undefined' ? document.getElementById('toast-root') || document.body : null;

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {portalTarget &&
        createPortal(
          <div
            aria-live="polite"
            className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none px-4 w-full max-w-md"
          >
            {toasts.map((toast) => (
              <div
                key={toast.id}
                role="status"
                className="pointer-events-auto w-full py-3 px-4 rounded-2xl shadow-2xl border border-slate-800/80 bg-slate-950 text-white flex items-center justify-between gap-3 animate-fade-in backdrop-blur-lg ring-1 ring-white/10"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="shrink-0 mt-0.5">
                    {toast.type === 'error' ? (
                      <div className="w-5 h-5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                        <AlertCircle className="w-3.5 h-3.5 text-white" />
                      </div>
                    ) : toast.type === 'info' ? (
                      <div className="w-5 h-5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                        <Info className="w-3.5 h-3.5 text-white" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-white text-slate-950 flex items-center justify-center font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-950" />
                      </div>
                    )}
                  </div>
                  <div className="text-xs leading-snug min-w-0">
                    {toast.title && <div className="font-bold text-white mb-0.5 tracking-tight">{toast.title}</div>}
                    <div className="font-medium text-slate-300">{toast.message}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {toast.undoAction && (
                    <button
                      type="button"
                      onClick={() => {
                        toast.undoAction?.();
                        removeToast(toast.id);
                      }}
                      className="text-xs font-bold underline text-white hover:text-slate-300 cursor-pointer"
                    >
                      Undo
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeToast(toast.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>,
          portalTarget
        )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: (msg: string | ToastOptions) => {
        console.log('[Toast fallback]', msg);
      },
    };
  }
  return ctx;
};
