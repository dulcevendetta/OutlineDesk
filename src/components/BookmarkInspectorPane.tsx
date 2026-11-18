import React from 'react';
import { Bold, Crosshair, Italic, RotateCcw } from 'lucide-react';
import type { BookmarkNode, FitMode, PdfDocumentInfo } from '../types/bookmarks';

interface BookmarkInspectorPaneProps {
  selectedBookmark: BookmarkNode | null;
  currentPage: number;
  pageCount: number;
  docInfo: PdfDocumentInfo | null;
  onUpdateBookmark: (id: string, patch: Partial<BookmarkNode>) => void;
  onTogglePickTarget: () => void;
  isPickTargetActive: boolean;
  onToggleOpenOutlinesOnLoad: (val: boolean) => void;
}

const COLOR_SWATCHES: Array<{ label: string; value: string | null }> = [
  { label: 'Default', value: null },
  { label: 'Sapphire', value: '#0067C0' },
  { label: 'Crimson', value: '#B91C1C' },
  { label: 'Emerald', value: '#0F766E' },
  { label: 'Amber', value: '#B45309' },
  { label: 'Slate', value: '#475569' },
];

const FIT_MODES: Array<{ value: FitMode; label: string; hint: string }> = [
  { value: 'XYZ', label: 'XYZ', hint: 'Exact top/left offset & zoom' },
  { value: 'Fit', label: 'Fit', hint: 'Fit entire page inside window' },
  { value: 'FitH', label: 'FitH', hint: 'Fit page width at Top Y' },
  { value: 'FitV', label: 'FitV', hint: 'Fit page height at Left X' },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const BookmarkInspectorPane: React.FC<BookmarkInspectorPaneProps> = ({
  selectedBookmark,
  currentPage,
  pageCount,
  docInfo,
  onUpdateBookmark,
  onTogglePickTarget,
  isPickTargetActive,
  onToggleOpenOutlinesOnLoad,
}) => {
  return (
    <aside className="w-full lg:w-[300px] xl:w-[320px] shrink-0 flex flex-col border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1B1F26] h-full overflow-y-auto">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <h2 className="font-display text-xs font-semibold tracking-wide text-slate-600 dark:text-slate-300">
          Bookmark Properties
        </h2>
      </div>

      {!selectedBookmark ? (
        <div className="flex-1 p-5 flex flex-col justify-center text-center text-slate-500 dark:text-slate-400">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            No bookmark selected
          </p>
          <p className="text-xs mt-1 leading-relaxed">
            Select a bookmark in the outline tree to edit its label, page destination, viewport fit mode, and typography.
          </p>
        </div>
      ) : (
        <div className="flex-1 p-4 space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <label
              htmlFor="bm-title"
              className="block text-xs font-medium text-slate-600 dark:text-slate-300"
            >
              Bookmark Label
            </label>
            <input
              id="bm-title"
              type="text"
              value={selectedBookmark.title}
              onChange={(e) =>
                onUpdateBookmark(selectedBookmark.id, { title: e.target.value })
              }
              className="w-full px-2.5 py-1.5 text-sm bg-[#F8FAFC] dark:bg-[#14171C] border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#0067C0]"
            />
          </div>

          {/* Target Page */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="bm-page"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                Target Page
              </label>
              <button
                type="button"
                onClick={() =>
                  onUpdateBookmark(selectedBookmark.id, { pageNumber: currentPage })
                }
                disabled={selectedBookmark.pageNumber === currentPage}
                className="text-[11px] font-medium text-[#0067C0] dark:text-sky-400 hover:underline disabled:opacity-40 disabled:no-underline cursor-pointer"
              >
                Use Current (p.{currentPage})
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="bm-page"
                type="number"
                min={1}
                max={pageCount || 1}
                value={selectedBookmark.pageNumber}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!Number.isNaN(val)) {
                    onUpdateBookmark(selectedBookmark.id, {
                      pageNumber: Math.min(pageCount || 1, Math.max(1, val)),
                    });
                  }
                }}
                className="w-24 px-2.5 py-1.5 font-mono text-sm tabular-nums bg-[#F8FAFC] dark:bg-[#14171C] border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#0067C0]"
              />
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                of {pageCount || 1}
              </span>
            </div>
          </div>

          {/* Fit Mode Segmented Control */}
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              Destination View Mode
            </span>
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-[#14171C] rounded-md border border-slate-200 dark:border-slate-800">
              {FIT_MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() =>
                    onUpdateBookmark(selectedBookmark.id, { fitMode: m.value })
                  }
                  title={m.hint}
                  className={`py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                    selectedBookmark.fitMode === m.value
                      ? 'bg-white dark:bg-[#252B34] text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {FIT_MODES.find((m) => m.value === selectedBookmark.fitMode)?.hint}
            </p>
          </div>

          {/* Coordinates for XYZ / FitH / FitV */}
          {selectedBookmark.fitMode !== 'Fit' && (
            <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Viewport Coordinates
                </span>
                <button
                  type="button"
                  onClick={onTogglePickTarget}
                  className={`inline-flex items-center gap-1 text-[11px] font-medium cursor-pointer ${
                    isPickTargetActive
                      ? 'text-[#0067C0] dark:text-sky-400 underline'
                      : 'text-[#0067C0] dark:text-sky-400 hover:underline'
                  }`}
                >
                  <Crosshair className="w-3 h-3" />
                  <span>{isPickTargetActive ? 'Picking...' : 'Pick on Page'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {(selectedBookmark.fitMode === 'XYZ' ||
                  selectedBookmark.fitMode === 'FitH') && (
                  <div>
                    <label
                      htmlFor="bm-top"
                      className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1"
                    >
                      Top Y (pt)
                    </label>
                    <input
                      id="bm-top"
                      type="number"
                      placeholder="Auto"
                      value={selectedBookmark.top ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        onUpdateBookmark(selectedBookmark.id, {
                          top: raw === '' ? null : Number(raw),
                        });
                      }}
                      className="w-full px-2 py-1 font-mono text-xs tabular-nums bg-[#F8FAFC] dark:bg-[#14171C] border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#0067C0]"
                    />
                  </div>
                )}

                {(selectedBookmark.fitMode === 'XYZ' ||
                  selectedBookmark.fitMode === 'FitV') && (
                  <div>
                    <label
                      htmlFor="bm-left"
                      className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1"
                    >
                      Left X (pt)
                    </label>
                    <input
                      id="bm-left"
                      type="number"
                      placeholder="Auto"
                      value={selectedBookmark.left ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        onUpdateBookmark(selectedBookmark.id, {
                          left: raw === '' ? null : Number(raw),
                        });
                      }}
                      className="w-full px-2 py-1 font-mono text-xs tabular-nums bg-[#F8FAFC] dark:bg-[#14171C] border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#0067C0]"
                    />
                  </div>
                )}

                {selectedBookmark.fitMode === 'XYZ' && (
                  <div>
                    <label
                      htmlFor="bm-zoom"
                      className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1"
                    >
                      Zoom (%)
                    </label>
                    <input
                      id="bm-zoom"
                      type="number"
                      placeholder="Inherit"
                      min={10}
                      max={600}
                      value={
                        selectedBookmark.zoom !== null
                          ? Math.round(selectedBookmark.zoom * 100)
                          : ''
                      }
                      onChange={(e) => {
                        const raw = e.target.value;
                        onUpdateBookmark(selectedBookmark.id, {
                          zoom: raw === '' ? null : Math.max(0.1, Number(raw) / 100),
                        });
                      }}
                      className="w-full px-2 py-1 font-mono text-xs tabular-nums bg-[#F8FAFC] dark:bg-[#14171C] border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#0067C0]"
                    />
                  </div>
                )}

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateBookmark(selectedBookmark.id, {
                        top: null,
                        left: null,
                        zoom: null,
                      })
                    }
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Clear Offsets</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Typography Style & Color */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              Style & Color
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  onUpdateBookmark(selectedBookmark.id, { bold: !selectedBookmark.bold })
                }
                aria-pressed={selectedBookmark.bold}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer ${
                  selectedBookmark.bold
                    ? 'bg-[#0067C0]/12 border-[#0067C0] text-[#0067C0] dark:text-sky-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Bold className="w-3.5 h-3.5" />
                <span>Bold</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateBookmark(selectedBookmark.id, { italic: !selectedBookmark.italic })
                }
                aria-pressed={selectedBookmark.italic}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer ${
                  selectedBookmark.italic
                    ? 'bg-[#0067C0]/12 border-[#0067C0] text-[#0067C0] dark:text-sky-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Italic className="w-3.5 h-3.5" />
                <span>Italic</span>
              </button>
            </div>

            <div className="flex items-center gap-2 pt-1">
              {COLOR_SWATCHES.map((swatch) => {
                const isActive = selectedBookmark.color === swatch.value;
                return (
                  <button
                    key={swatch.label}
                    type="button"
                    title={swatch.label}
                    aria-label={`Set bookmark color ${swatch.label}`}
                    onClick={() =>
                      onUpdateBookmark(selectedBookmark.id, { color: swatch.value })
                    }
                    className={`w-6 h-6 rounded border flex items-center justify-center cursor-pointer transition-transform ${
                      isActive
                        ? 'ring-2 ring-[#0067C0] ring-offset-1 dark:ring-offset-[#1B1F26] scale-105'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                    style={{
                      backgroundColor: swatch.value ?? 'transparent',
                    }}
                  >
                    {swatch.value === null && (
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        Aa
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Document Settings Footer */}
      {docInfo && (
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#171A21] space-y-3 shrink-0">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={docInfo.openOutlinesOnLoad}
              onChange={(e) => onToggleOpenOutlinesOnLoad(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-[#0067C0] focus:ring-[#0067C0]"
            />
            <span className="text-xs text-slate-700 dark:text-slate-300 leading-snug">
              Open Bookmarks panel automatically in Adobe Acrobat &amp; Edge
            </span>
          </label>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1 pt-2 border-t border-slate-200/70 dark:border-slate-800 tabular-nums">
            <div className="flex justify-between gap-2">
              <span>File</span>
              <span className="font-medium text-slate-700 dark:text-slate-200 truncate max-w-[180px]">
                {docInfo.fileName}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Size</span>
              <span className="font-mono">{formatBytes(docInfo.fileSize)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Pages</span>
              <span className="font-mono">{docInfo.pageCount}</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
