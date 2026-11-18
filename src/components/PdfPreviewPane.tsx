import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Crosshair,
  FolderOpen,
  Maximize2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { pdfjsLib } from '../lib/pdfHeadingExtractor';
import type { BookmarkNode, PageDimension } from '../types/bookmarks';

interface PdfPreviewPaneProps {
  pdfBytes: Uint8Array | null;
  currentPage: number;
  pageCount: number;
  pageDimensions: PageDimension[];
  selectedBookmark: BookmarkNode | null;
  isPickTargetActive: boolean;
  onTogglePickTarget: () => void;
  onPageChange: (page: number) => void;
  onPickPageCoordinate: (pageNumber: number, yTopPoints: number, xLeftPoints: number) => void;
  onOpenFile: () => void;
  onFileDrop: (file: File) => void;
}

export const PdfPreviewPane: React.FC<PdfPreviewPaneProps> = ({
  pdfBytes,
  currentPage,
  pageCount,
  pageDimensions,
  selectedBookmark,
  isPickTargetActive,
  onTogglePickTarget,
  onPageChange,
  onPickPageCoordinate,
  onOpenFile,
  onFileDrop,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  const [zoomMode, setZoomMode] = useState<'fit-width' | 'manual'>('fit-width');
  const [manualScale, setManualScale] = useState<number>(1.15);
  const [renderedSize, setRenderedSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [hoverYPoints, setHoverYPoints] = useState<number | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [pageInput, setPageInput] = useState(String(currentPage));
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  // Load PDF document into PDF.js whenever bytes change
  useEffect(() => {
    let cancelled = false;

    const loadDoc = async () => {
      if (pdfDocRef.current) {
        await pdfDocRef.current.cleanup();
        pdfDocRef.current = null;
      }
      if (!pdfBytes) return;

      try {
        setRenderError(null);
        const task = pdfjsLib.getDocument({ data: pdfBytes.slice() });
        const doc = await task.promise;
        if (cancelled) {
          await task.destroy();
          return;
        }
        pdfDocRef.current = doc;
        // Trigger render via page effect
        setRenderedSize((s) => ({ ...s }));
      } catch (err) {
        if (!cancelled) {
          setRenderError(err instanceof Error ? err.message : 'Unable to render PDF preview.');
        }
      }
    };

    loadDoc();
    return () => {
      cancelled = true;
    };
  }, [pdfBytes]);

  // Render current page on canvas
  useEffect(() => {
    let cancelled = false;

    const renderPage = async () => {
      const doc = pdfDocRef.current;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!doc || !canvas || !container || currentPage < 1 || currentPage > doc.numPages) {
        return;
      }

      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }

      try {
        const page = await doc.getPage(currentPage);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        let scale = manualScale;
        if (zoomMode === 'fit-width') {
          const availableWidth = Math.max(320, container.clientWidth - 64);
          scale = Math.min(2.2, availableWidth / baseViewport.width);
        }

        const dpr = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale });
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        setRenderedSize({
          width: Math.floor(viewport.width),
          height: Math.floor(viewport.height),
        });

        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        const task = page.render({ canvasContext: context, viewport, canvas });
        renderTaskRef.current = task;
        await task.promise;
      } catch (err: unknown) {
        if (
          err &&
          typeof err === 'object' &&
          'name' in err &&
          (err as { name: string }).name === 'RenderingCancelledException'
        ) {
          return;
        }
      }
    };

    renderPage();

    const handleResize = () => {
      if (zoomMode === 'fit-width') {
        renderPage();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', handleResize);
    };
  }, [pdfBytes, currentPage, zoomMode, manualScale]);

  const currentDim = pageDimensions[currentPage - 1] ?? { width: 612, height: 792 };

  const computeMarkerTopPx = (pdfYTop: number | null): number | null => {
    if (pdfYTop === null || renderedSize.height === 0 || currentDim.height === 0) return null;
    const ratioFromTop = 1 - pdfYTop / currentDim.height;
    const px = ratioFromTop * renderedSize.height;
    return Math.min(renderedSize.height, Math.max(0, px));
  };

  const selectedTargetPx =
    selectedBookmark &&
    selectedBookmark.pageNumber === currentPage &&
    (selectedBookmark.fitMode === 'XYZ' || selectedBookmark.fitMode === 'FitH')
      ? computeMarkerTopPx(selectedBookmark.top)
      : null;

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPickTargetActive || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const clickX = e.clientX - rect.left;
    const pdfY = Math.round((1 - clickY / rect.height) * currentDim.height);
    const pdfX = Math.round((clickX / rect.width) * currentDim.width);
    onPickPageCoordinate(currentPage, pdfY, pdfX);
  };

  const handleCanvasMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPickTargetActive || !canvasRef.current) {
      if (hoverYPoints !== null) setHoverYPoints(null);
      return;
    }
    const rect = canvasRef.current.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const pdfY = Math.round((1 - clickY / rect.height) * currentDim.height);
    setHoverYPoints(pdfY);
  };

  const commitPageInput = () => {
    const parsed = parseInt(pageInput, 10);
    if (!Number.isNaN(parsed) && pageCount > 0) {
      onPageChange(Math.min(pageCount, Math.max(1, parsed)));
    } else {
      setPageInput(String(currentPage));
    }
  };

  return (
    <section
      className="flex-1 min-w-0 flex flex-col bg-[#EAEFF5] dark:bg-[#101318] h-full overflow-hidden relative"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingFile(true);
      }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingFile(false);
        const file = e.dataTransfer.files?.[0];
        if (file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
          onFileDrop(file);
        }
      }}
    >
      {/* Preview Toolbar */}
      <div className="h-11 px-4 flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1B1F26] shrink-0">
        {/* Page Navigation */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={!pdfBytes || currentPage <= 1}
            aria-label="Previous page"
            className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
            <span>Page</span>
            <input
              type="text"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={commitPageInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitPageInput();
              }}
              disabled={!pdfBytes}
              aria-label="Current page number"
              className="w-11 px-1.5 py-0.5 text-center font-mono text-xs bg-[#F8FAFC] dark:bg-[#14171C] border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#0067C0]"
            />
            <span className="font-mono text-slate-400">/ {pageCount || 0}</span>
          </div>

          <button
            type="button"
            onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
            disabled={!pdfBytes || currentPage >= pageCount}
            aria-label="Next page"
            className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Interactive Y-Coordinate Target Picker */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePickTarget}
            disabled={!pdfBytes || !selectedBookmark}
            title="Click anywhere on the PDF page to set the exact vertical destination for the selected bookmark"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 disabled:pointer-events-none cursor-pointer ${
              isPickTargetActive
                ? 'bg-[#0067C0] text-white'
                : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>{isPickTargetActive ? 'Click Page to Set Y-Target' : 'Pick Y-Target'}</span>
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setZoomMode('manual');
              setManualScale((s) => Math.max(0.5, Number((s - 0.15).toFixed(2))));
            }}
            disabled={!pdfBytes}
            aria-label="Zoom out"
            className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300 w-12 text-center">
            {zoomMode === 'fit-width' ? 'Fit' : `${Math.round(manualScale * 100)}%`}
          </span>
          <button
            type="button"
            onClick={() => {
              setZoomMode('manual');
              setManualScale((s) => Math.min(2.4, Number((s + 0.15).toFixed(2))));
            }}
            disabled={!pdfBytes}
            aria-label="Zoom in"
            className="p-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoomMode('fit-width')}
            disabled={!pdfBytes}
            title="Fit page width"
            aria-label="Fit page width"
            className={`p-1.5 rounded text-xs cursor-pointer ${
              zoomMode === 'fit-width'
                ? 'bg-slate-100 dark:bg-slate-800 text-[#0067C0] dark:text-sky-400'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-6 flex items-start justify-center relative"
      >
        {!pdfBytes ? (
          <div className="my-auto max-w-md w-full border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1B1F26] rounded-lg p-8 text-center">
            <FolderOpen className="w-10 h-10 text-[#0067C0] mx-auto mb-3" />
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Drop a PDF file here
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              Your PDF stays completely local in memory on your Windows PC. No files are uploaded to external servers.
            </p>
            <button
              type="button"
              onClick={onOpenFile}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0067C0] hover:bg-[#005A9E] rounded-md transition-colors cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Browse Windows Files</span>
            </button>
          </div>
        ) : renderError ? (
          <div className="my-auto max-w-md w-full bg-white dark:bg-[#1B1F26] border border-rose-200 dark:border-rose-900 rounded-lg p-6 text-center">
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">
              Preview unavailable
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{renderError}</p>
          </div>
        ) : (
          <div className="relative inline-block shadow-sm border border-slate-300/80 dark:border-slate-700 bg-white">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasMove}
              onMouseLeave={() => setHoverYPoints(null)}
              className={isPickTargetActive ? 'cursor-crosshair block' : 'block'}
            />

            {/* Saved Y-Target Destination Guide Line */}
            {selectedTargetPx !== null && (
              <div
                style={{ top: `${selectedTargetPx}px` }}
                className="absolute left-0 right-0 pointer-events-none flex items-center"
              >
                <div className="w-full border-t-2 border-dashed border-[#0067C0]" />
                <span className="absolute right-2 -top-5 px-1.5 py-0.5 text-[10px] font-mono font-medium bg-[#0067C0] text-white rounded">
                  Target Y: {Math.round(selectedBookmark?.top ?? 0)} pt
                </span>
              </div>
            )}

            {/* Live Hover Y Coordinate Readout while picking */}
            {isPickTargetActive && hoverYPoints !== null && (
              <div className="fixed bottom-5 left-1/2 -translate-x-1/2 px-3 py-1.5 text-xs font-mono bg-slate-900 text-white rounded shadow-md pointer-events-none z-20">
                Click to set destination: Page {currentPage} · Y = {hoverYPoints} pt
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drag-over File Overlay */}
      {isDraggingFile && (
        <div className="absolute inset-0 bg-[#0067C0]/12 backdrop-blur-[1px] border-2 border-dashed border-[#0067C0] flex items-center justify-center z-30 pointer-events-none">
          <div className="bg-white dark:bg-[#1B1F26] px-6 py-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm text-center">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Release to open PDF in OutlineDesk
            </p>
          </div>
        </div>
      )}
    </section>
  );
};
