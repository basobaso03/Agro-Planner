import React from 'react';

export interface FieldProps {
  label: string;
  error?: string | null;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({
  label,
  error,
  required = false,
  hint,
  children,
}) => {
  return (
    <div className="space-y-1.5 text-left">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-800 tracking-tight">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        {hint && <span className="text-[11px] text-slate-400 font-medium">{hint}</span>}
      </div>

      <div data-invalid={Boolean(error)}>{children}</div>

      {error && (
        <p role="alert" className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 mt-1">
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};

