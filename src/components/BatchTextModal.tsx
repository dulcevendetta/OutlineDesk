import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, Copy, Download, FileText, X } from 'lucide-react';
import {
  parseOutlineFromText,
  serializeOutlineToText,
} from '../lib/pdfOutlineText';
import type { BookmarkNode } from '../types/bookmarks';

interface BatchTextModalProps {
  isOpen: boolean;
  initialTab: 'text' | 'offset';
  bookmarks: BookmarkNode[];
  pageCount: number;
  fileName: string;
  onClose: () => void;
  onApplyOutline: (nodes: BookmarkNode[], mode: 'replace' | 'append') => void;
  onShiftPages: (delta: number) => void;
}

export const BatchTextModal: React.FC<BatchTextModalProps> = ({
  isOpen,
  initialTab,
  bookmarks,
  pageCount,
  fileName,
  onClose,
  onApplyOutline,
  onShiftPages,
}) => {
  const [activeTab, setActiveTab] = useState<'text' | 'offset'>(initialTab);
  const [outlineText, setOutlineText] = useState('');
  const [copied, setCopied] = useState(false);
  const [offsetDelta, setOffsetDelta] = useState<string>('0');

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setOutlineText(serializeOutlineToText(bookmarks));
      setOffsetDelta('0');
      setCopied(false);
    }
  }, [isOpen, initialTab, bookmarks]);

  if (!isOpen) return null;

  const parsedPreview = parseOutlineFromText(outlineText, pageCount || 1);
  const parsedDelta = parseInt(offsetDelta, 10);
  const validDelta = !Number.isNaN(parsedDelta) ? parsedDelta : 0;

  const downloadFile = (content: string, ext: string, mime: string) => {
    const base = fileName.replace(/\.pdf$/i, '') || 'bookmarks';
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${base}_bookmarks.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/45 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-tools-title"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-[#1B1F26] border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2
              id="batch-tools-title"
              className="font-display text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Batch Outline Tools
            </h2>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#14171C] rounded-md">
              <button
                type="button"
                onClick={() => setActiveTab('text')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                  activeTab === 'text'
                    ? 'bg-white dark:bg-[#252B34] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Indented Text Outline
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('offset')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                  activeTab === 'offset'
                    ? 'bg-white dark:bg-[#252B34] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Page Number Offset
              </button>
            </div>
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

        {activeTab === 'text' ? (
          <>
            <div className="p-5 flex-1 flex flex-col gap-3 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
                <p>
                  Indent lines with 2 spaces per child level. Separate page numbers with{' '}
                  <code className="font-mono px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                    Tab
                  </code>
                  ,{' '}
                  <code className="font-mono px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                    -&gt;
                  </code>
                  , or{' '}
                  <code className="font-mono px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                    /
                  </code>
                  .
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(outlineText);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1800);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadFile(outlineText, 'txt', 'text/plain;charset=utf-8')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>.TXT</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadFile(
                        JSON.stringify(bookmarks, null, 2),
                        'json',
                        'application/json'
                      )
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <FileText className="w-3 h-3" />
                    <span>.JSON</span>
                  </button>
                </div>
              </div>

              <textarea
                value={outlineText}
                onChange={(e) => setOutlineText(e.target.value)}
                spellCheck={false}
                placeholder={'Chapter 1: Introduction\t1\n  1.1 Scope\t2\nChapter 2: Setup\t5'}
                className="flex-1 min-h-[280px] w-full p-3 font-mono text-xs leading-relaxed bg-[#F8FAFC] dark:bg-[#14171C] border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#0067C0] resize-none"
              />
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#171A21] flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                Parsed {parsedPreview.length} top-level entries (max page {pageCount})
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
                  disabled={parsedPreview.length === 0}
                  onClick={() => {
                    onApplyOutline(parsedPreview, 'append');
                    onClose();
                  }}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100 bg-white dark:bg-[#252B34] border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  Append
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onApplyOutline(parsedPreview, 'replace');
                    onClose();
                  }}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#0067C0] hover:bg-[#005A9E] rounded-md cursor-pointer"
                >
                  Replace Tree
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="p-6 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Shift All Bookmark Page Numbers
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Useful when a PDF includes unnumbered cover pages or Roman-numeral front matter that offsets printed Table of Contents page numbers. Values are clamped between 1 and {pageCount}.
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <label
                    htmlFor="offset-delta"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Page Shift Delta
                  </label>
                  <input
                    id="offset-delta"
                    type="number"
                    value={offsetDelta}
                    onChange={(e) => setOffsetDelta(e.target.value)}
                    className="w-32 px-3 py-2 font-mono text-sm tabular-nums bg-[#F8FAFC] dark:bg-[#14171C] border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#0067C0]"
                  />
                </div>

                <div className="flex items-center gap-2 pt-5">
                  {[-5, -1, 1, 2, 4, 6].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setOffsetDelta(String(preset))}
                      className="px-2.5 py-1.5 font-mono text-xs border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      {preset > 0 ? `+${preset}` : preset}
                    </button>
                  ))}
                </div>
              </div>

              {bookmarks.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-md divide-y divide-slate-100 dark:divide-slate-800">
                  <div className="px-3.5 py-2 bg-[#F8FAFC] dark:bg-[#14171C] text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Preview (first 4 top-level bookmarks)
                  </div>
                  {bookmarks.slice(0, 4).map((b) => {
                    const nextPage = Math.min(pageCount, Math.max(1, b.pageNumber + validDelta));
                    return (
                      <div
                        key={b.id}
                        className="px-3.5 py-2 flex items-center justify-between text-xs"
                      >
                        <span className="truncate text-slate-700 dark:text-slate-200 pr-4">
                          {b.title}
                        </span>
                        <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300 flex items-center gap-1.5 shrink-0">
                          <span>p.{b.pageNumber}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span className="font-semibold text-[#0067C0] dark:text-sky-400">
                            p.{nextPage}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#171A21] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={validDelta === 0 || bookmarks.length === 0}
                onClick={() => {
                  onShiftPages(validDelta);
                  onClose();
                }}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#0067C0] hover:bg-[#005A9E] rounded-md disabled:opacity-40 cursor-pointer"
              >
                Apply {validDelta > 0 ? `+${validDelta}` : validDelta} Page Shift
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
