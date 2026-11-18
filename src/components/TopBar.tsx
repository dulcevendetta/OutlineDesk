import React from 'react';
import { Download } from 'lucide-react';

interface TopBarProps {
  onOpenAutoExtract: () => void;
  onOpenBatchText: () => void;
  onOpenPageOffset: () => void;
  onOpenShortcuts: () => void;
  onSavePdf: () => void;
  hasDocument: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenAutoExtract,
  onOpenBatchText,
  onOpenPageOffset,
  onOpenShortcuts,
  onSavePdf,
  hasDocument,
  isSaving,
  hasUnsavedChanges,
}) => {
  return (
    <header className="h-14 px-5 flex items-center justify-between gap-8 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1B1F26] shrink-0">
      {/* Zone 1: Single text element wordmark */}
      <a
        href="#top"
        onClick={(e) => e.preventDefault()}
        className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
      >
        OutlineDesk
      </a>

      {/* Zone 2: Concise single-line navigation / tool links */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
        <button
          type="button"
          onClick={onOpenAutoExtract}
          disabled={!hasDocument}
          className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
        >
          Auto-Extract
        </button>
        <button
          type="button"
          onClick={onOpenBatchText}
          disabled={!hasDocument}
          className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
        >
          Text Outline
        </button>
        <button
          type="button"
          onClick={onOpenPageOffset}
          disabled={!hasDocument}
          className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
        >
          Page Offset
        </button>
        <button
          type="button"
          onClick={onOpenShortcuts}
          className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Shortcuts
        </button>
      </nav>

      {/* Zone 3: Single Primary Action */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onSavePdf}
          disabled={!hasDocument || isSaving}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0067C0] hover:bg-[#005A9E] active:bg-[#004E8C] rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-45 disabled:pointer-events-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0067C0]"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{isSaving ? 'Saving PDF...' : hasUnsavedChanges ? 'Save PDF *' : 'Save PDF'}</span>
        </button>
      </div>
    </header>
  );
};
