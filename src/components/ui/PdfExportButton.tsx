import React, { useState } from 'react';
import { Share2, FileDown, Loader2 } from 'lucide-react';
import type { jsPDF } from 'jspdf';
import { shareOrDownloadPdf } from '../../services/pdf/pdfShareCoordinator.ts';
import { useToast } from './Toast.tsx';

export interface PdfExportButtonProps {
  label?: string;
  generateDoc: () => jsPDF | Promise<jsPDF>;
  filename: string;
  title: string;
  subject?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  icon?: 'share' | 'download';
  onSuccess?: () => void;
}

export const PdfExportButton: React.FC<PdfExportButtonProps> = ({
  label = 'Share PDF',
  generateDoc,
  filename,
  title,
  subject,
  variant = 'secondary',
  size = 'sm',
  className = '',
  icon = 'share',
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleExport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;

    setLoading(true);
    try {
      const doc = await generateDoc();
      const shared = await shareOrDownloadPdf({
        doc,
        rawFilename: filename,
        title,
        subject,
        onSuccess: () => {
          showToast(`Exported "${title}" successfully.`);
          onSuccess?.();
        },
        onError: (err) => {
          showToast(`Export error: ${err.message || 'Could not export PDF'}`);
        },
      });

      if (shared) {
        // Document handled
      }
    } catch (err: any) {
      console.error('PDF generation error:', err);
      showToast(`Export error: ${err.message || 'Generation failed'}`);
    } finally {
      setLoading(false);
    }
  };

  const sizeClasses = {
    sm: 'px-2.5 py-1.5 text-xs rounded-xl gap-1.5',
    md: 'px-3.5 py-2 text-sm rounded-xl gap-2',
    lg: 'px-4 py-2.5 text-base rounded-2xl gap-2.5',
  }[size];

  const variantClasses = {
    primary:
      'bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-xs border border-emerald-800 transition-colors cursor-pointer',
    secondary:
      'bg-white hover:bg-stone-50 text-slate-800 font-bold border border-[#E8DFCE] shadow-2xs transition-colors cursor-pointer',
    outline:
      'bg-transparent hover:bg-emerald-50 text-emerald-800 font-bold border border-emerald-300 transition-colors cursor-pointer',
    ghost:
      'bg-transparent hover:bg-stone-100 text-slate-700 font-medium transition-colors cursor-pointer',
    icon:
      'p-2 rounded-xl border border-[#E8DFCE] bg-white hover:bg-stone-50 text-slate-700 transition-colors cursor-pointer',
  }[variant];

  const IconComponent = icon === 'download' ? FileDown : Share2;

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleExport}
        disabled={loading}
        title={label}
        aria-label={label}
        className={`inline-flex items-center justify-center ${variantClasses} ${className} disabled:opacity-50`}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
        ) : (
          <IconComponent className="w-4 h-4 text-emerald-800" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading}
      className={`inline-flex items-center justify-center ${sizeClasses} ${variantClasses} ${className} disabled:opacity-50`}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
      ) : (
        <IconComponent className="w-3.5 h-3.5 text-emerald-800" />
      )}
      <span>{loading ? 'Preparing...' : label}</span>
    </button>
  );
};

