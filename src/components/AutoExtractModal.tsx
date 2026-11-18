import React, { useEffect, useState } from 'react';
import { CheckSquare, Loader2, Sparkles, Square, X } from 'lucide-react';
import { buildTreeFromHeadings, extractHeadingsFromPdf } from '../lib/pdfHeadingExtractor';
import type { BookmarkNode, DetectedHeading } from '../types/bookmarks';

interface AutoExtractModalProps {
  isOpen: boolean;
  pdfBytes: Uint8Array | null;
  onClose: () => void;
  onImport: (nodes: BookmarkNode[], mode: 'replace' | 'append') => void;
}

export const AutoExtractModal: React.FC<AutoExtractModalProps> = ({
  isOpen,
  pdfBytes,
  onClose,
  onImport,
}) => {
  const [ratio, setRatio] = useState(1.18);
  const [headings, setHeadings] = useState<DetectedHeading[]>([]);
  const [bodyFontSize, setBodyFontSize] = useState<number>(10.5);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !pdfBytes) return;
    let cancelled = false;

    const scan = async () => {
      setIsScanning(true);
      setError(null);
      try {
        const res = await extractHeadingsFromPdf(pdfBytes, ratio);
        if (!cancelled) {
          setHeadings(res.headings);
          setBodyFontSize(res.bodyFontSize);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to scan document text.');
        }
      } finally {
        if (!cancelled) {
          setIsScanning(false);
        }
      }
    };

    scan();
    return () => {
      cancelled = true;
    };
  }, [isOpen, pdfBytes, ratio]);

  if (!isOpen) return null;

  const selectedCount = headings.filter((h) => h.selected).length;

  const toggleAll = (selected: boolean) => {
    setHeadings((prev) => prev.map((h) => ({ ...h, selected })));
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/45 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auto-extract-title"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-[#1B1F26] border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2
              id="auto-extract-title"
              className="font-display text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-[#0067C0] dark:text-sky-400" />
              <span>Auto-Extract Headings from PDF Typography</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              Detected body font: {bodyFontSize} pt · Found {headings.length} candidate headings
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sensitivity Controls */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#14171C] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label
              htmlFor="font-ratio-select"
              className="text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Heading Size Threshold
            </label>
            <select
              id="font-ratio-select"
              value={ratio}
              onChange={(e) => setRatio(Number(e.target.value))}
              className="px-2.5 py-1 text-xs bg-white dark:bg-[#1B1F26] border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#0067C0]"
            >
              <option value={1.08}>Inclusive (≥ 1.08× body size)</option>
              <option value={1.18}>Balanced (≥ 1.18× body size)</option>
              <option value={1.35}>Major Chapters Only (≥ 1.35×)</option>
            </select>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => toggleAll(true)}
              className="text-[#0067C0] dark:text-sky-400 hover:underline cursor-pointer"
            >
              Select All
            </button>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <button
              type="button"
              onClick={() => toggleAll(false)}
              className="text-slate-600 dark:text-slate-400 hover:underline cursor-pointer"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Results Table */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
          {isScanning ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#0067C0]" />
              <span className="text-xs">Scanning PDF pages for heading fonts...</span>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-xs text-rose-600 dark:text-rose-400">
              {error}
            </div>
          ) : headings.length === 0 ? (
            <div className="py-14 px-6 text-center">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                No distinct heading fonts detected at this threshold
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Try lowering the threshold to Inclusive (1.08×), or use Text Outline to paste a Table of Contents.
              </p>
            </div>
          ) : (
            headings.map((h) => (
              <div
                key={h.id}
                onClick={() =>
                  setHeadings((prev) =>
                    prev.map((item) =>
                      item.id === h.id ? { ...item, selected: !item.selected } : item
                    )
                  )
                }
                className="px-5 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer text-xs"
              >
                {h.selected ? (
                  <CheckSquare className="w-4 h-4 text-[#0067C0] shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400 shrink-0" />
                )}

                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 w-7 shrink-0">
                  H{h.level}
                </span>

                <span
                  style={{ paddingLeft: `${(h.level - 1) * 14}px` }}
                  className={`flex-1 min-w-0 truncate ${
                    h.level === 1
                      ? 'font-semibold text-slate-900 dark:text-slate-100'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {h.title}
                </span>

                <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                  {h.fontSize} pt
                </span>
                <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300 tabular-nums w-12 text-right shrink-0">
                  p.{h.pageNumber}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#171A21] flex items-center justify-between gap-4">
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {selectedCount} of {headings.length} headings selected
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={() => {
                onImport(buildTreeFromHeadings(headings), 'append');
                onClose();
              }}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100 bg-white dark:bg-[#252B34] border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
            >
              Append to Tree
            </button>
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={() => {
                onImport(buildTreeFromHeadings(headings), 'replace');
                onClose();
              }}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-[#0067C0] hover:bg-[#005A9E] rounded-md disabled:opacity-40 cursor-pointer"
            >
              Replace Bookmarks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
