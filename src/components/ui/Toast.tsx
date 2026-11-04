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
                className={`pointer-events-auto w-full py-3 px-4 rounded-2xl shadow-xl border flex items-center justify-between gap-3 animate-fade-in backdrop-blur-md ${toast.type === 'error'
                    ? 'bg-rose-950/90 text-rose-50 border-rose-800'
                    : toast.type === 'info'
                      ? 'bg-slate-900/90 text-slate-50 border-slate-700'
                      : 'bg-emerald-950/95 text-emerald-50 border-emerald-800'
                  }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="shrink-0 mt-0.5">
                    {toast.type === 'error' ? (
                      <AlertCircle className="w-5 h-5 text-rose-400" />
                    ) : toast.type === 'info' ? (
                      <Info className="w-5 h-5 text-sky-400" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    )}
                  </div>
                  <div className="text-xs leading-snug min-w-0">
                    {toast.title && <div className="font-bold mb-0.5">{toast.title}</div>}
                    <div className="font-medium text-slate-200">{toast.message}</div>
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
                      className="text-xs font-bold underline text-amber-300 hover:text-amber-200"
                    >
                      Undo
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeToast(toast.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white"
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
