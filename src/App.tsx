/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AutoExtractModal } from './components/AutoExtractModal';
import { BatchTextModal } from './components/BatchTextModal';
import { BookmarkInspectorPane } from './components/BookmarkInspectorPane';
import { BookmarkTreePane } from './components/BookmarkTreePane';
import { CommandRibbon } from './components/CommandRibbon';
import { PdfPreviewPane } from './components/PdfPreviewPane';
import { ShortcutsModal } from './components/ShortcutsModal';
import { TopBar } from './components/TopBar';
import {
  createSamplePdf,
  parsePdfDocument,
  writePdfBookmarks,
} from './lib/pdfBookmarks';
import {
  cloneBookmarks,
  countAllBookmarks,
  createNewBookmark,
  deleteBookmarkById,
  findBookmarkById,
  getVisibleBookmarkIds,
  indentBookmark,
  insertChildInto,
  insertSiblingAfter,
  moveBookmarkDown,
  moveBookmarkRelative,
  moveBookmarkUp,
  outdentBookmark,
  setAllExpanded,
  shiftAllPageNumbers,
  updateBookmarkById,
  type DropPosition,
} from './lib/pdfOutlineText';
import type { BookmarkNode, PdfDocumentInfo } from './types/bookmarks';

interface FileSystemWritable {
  write: (data: Uint8Array) => Promise<void>;
  close: () => Promise<void>;
}

interface FileSystemHandleLike {
  getFile: () => Promise<File>;
  createWritable: () => Promise<FileSystemWritable>;
}

declare global {
  interface Window {
    showOpenFilePicker?: (options?: unknown) => Promise<FileSystemHandleLike[]>;
    showSaveFilePicker?: (options?: unknown) => Promise<FileSystemHandleLike>;
  }
}

export default function App() {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [docInfo, setDocInfo] = useState<PdfDocumentInfo | null>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkNode[]>([]);
  const [past, setPast] = useState<BookmarkNode[][]>([]);
  const [future, setFuture] = useState<BookmarkNode[][]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isPickTargetActive, setIsPickTargetActive] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDark, setIsDark] = useState<boolean>(false);

  const [showAutoExtract, setShowAutoExtract] = useState<boolean>(false);
  const [batchModal, setBatchModal] = useState<{ open: boolean; tab: 'text' | 'offset' }>({
    open: false,
    tab: 'text',
  });
  const [showShortcuts, setShowShortcuts] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; kind: 'info' | 'error' } | null>(
    null
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileHandleRef = useRef<FileSystemHandleLike | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, kind: 'info' | 'error' = 'info') => {
    setToast({ message, kind });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3200);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const loadPdfBytes = useCallback(
    async (bytes: Uint8Array, fileName: string, handle: FileSystemHandleLike | null = null) => {
      try {
        const parsed = await parsePdfDocument(bytes, fileName);
        fileHandleRef.current = handle;
        setPdfBytes(bytes);
        setDocInfo(parsed.info);
        setBookmarks(parsed.bookmarks);
        setPast([]);
        setFuture([]);
        setSelectedId(parsed.bookmarks[0]?.id ?? null);
        setEditingId(null);
        setCurrentPage(parsed.bookmarks[0]?.pageNumber ?? 1);
        setIsPickTargetActive(false);
        setHasUnsavedChanges(false);
      } catch (err) {
        showToast(
          err instanceof Error ? `Failed to open PDF: ${err.message}` : 'Failed to open PDF.',
          'error'
        );
      }
    },
    [showToast]
  );

  const handleLoadSample = useCallback(async () => {
    const sampleBytes = await createSamplePdf();
    await loadPdfBytes(sampleBytes, 'Windows_PDF_Architecture_Sample.pdf', null);
    showToast('Loaded 8-page Windows Reference sample PDF');
  }, [loadPdfBytes, showToast]);

  // Auto-load sample PDF on startup for immediate populated workstation experience
  useEffect(() => {
    handleLoadSample();
  }, [handleLoadSample]);

  const commitBookmarks = useCallback(
    (next: BookmarkNode[], recordHistory = true) => {
      if (recordHistory) {
        setPast((prev) => [...prev.slice(-39), cloneBookmarks(bookmarks)]);
        setFuture([]);
      }
      setBookmarks(next);
      setHasUnsavedChanges(true);
    },
    [bookmarks]
  );

  const handleUndo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setPast((prev) => prev.slice(0, -1));
    setFuture((prev) => [cloneBookmarks(bookmarks), ...prev]);
    setBookmarks(previous);
    setHasUnsavedChanges(true);
  }, [past, bookmarks]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((prev) => prev.slice(1));
    setPast((prev) => [...prev, cloneBookmarks(bookmarks)]);
    setBookmarks(next);
    setHasUnsavedChanges(true);
  }, [future, bookmarks]);

  const handleOpenFile = useCallback(async () => {
    // Prefer File System Access API when supported outside restricted iframes
    if (window.showOpenFilePicker && window.self === window.top) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [
            {
              description: 'PDF Documents',
              accept: { 'application/pdf': ['.pdf'] },
            },
          ],
          multiple: false,
        });
        if (handle) {
          const file = await handle.getFile();
          const buffer = await file.arrayBuffer();
          await loadPdfBytes(new Uint8Array(buffer), file.name, handle);
          showToast(`Opened ${file.name}`);
          return;
        }
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') {
          return;
        }
      }
    }
    fileInputRef.current?.click();
  }, [loadPdfBytes, showToast]);

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const buffer = await file.arrayBuffer();
    await loadPdfBytes(new Uint8Array(buffer), file.name, null);
    showToast(`Opened ${file.name}`);
  };

  const handleFileDrop = async (file: File) => {
    const buffer = await file.arrayBuffer();
    await loadPdfBytes(new Uint8Array(buffer), file.name, null);
    showToast(`Opened ${file.name}`);
  };

  const triggerDownload = (bytes: Uint8Array, suggestedName: string) => {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const blob = new Blob([copy], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSavePdf = useCallback(
    async (forceSaveAs = false) => {
      if (!pdfBytes || !docInfo) return;
      setIsSaving(true);
      try {
        const updatedBytes = await writePdfBookmarks(
          pdfBytes,
          bookmarks,
          docInfo.openOutlinesOnLoad
        );

        const defaultName = docInfo.fileName.replace(/\.pdf$/i, '') + '_bookmarked.pdf';

        if (!forceSaveAs && fileHandleRef.current) {
          const writable = await fileHandleRef.current.createWritable();
          await writable.write(updatedBytes);
          await writable.close();
          setPdfBytes(updatedBytes);
          setHasUnsavedChanges(false);
          showToast(`Saved changes directly to ${docInfo.fileName}`);
        } else if (forceSaveAs && window.showSaveFilePicker && window.self === window.top) {
          try {
            const handle = await window.showSaveFilePicker({
              suggestedName: defaultName,
              types: [
                {
                  description: 'PDF Document',
                  accept: { 'application/pdf': ['.pdf'] },
                },
              ],
            });
            const writable = await handle.createWritable();
            await writable.write(updatedBytes);
            await writable.close();
            fileHandleRef.current = handle;
            const savedFile = await handle.getFile();
            setPdfBytes(updatedBytes);
            setDocInfo((prev) =>
              prev ? { ...prev, fileName: savedFile.name, fileSize: updatedBytes.byteLength } : prev
            );
            setHasUnsavedChanges(false);
            showToast(`Saved ${savedFile.name}`);
          } catch (err: unknown) {
            if (
              err &&
              typeof err === 'object' &&
              'name' in err &&
              (err as { name: string }).name === 'AbortError'
            ) {
              return;
            }
            triggerDownload(updatedBytes, defaultName);
            setPdfBytes(updatedBytes);
            setHasUnsavedChanges(false);
            showToast(`Downloaded ${defaultName}`);
          }
        } else {
          triggerDownload(updatedBytes, defaultName);
          setPdfBytes(updatedBytes);
          setHasUnsavedChanges(false);
          showToast(`Saved ${defaultName} (${countAllBookmarks(bookmarks)} bookmarks)`);
        }
      } catch (err) {
        showToast(
          err instanceof Error ? `Save failed: ${err.message}` : 'Failed to save PDF.',
          'error'
        );
      } finally {
        setIsSaving(false);
      }
    },
    [pdfBytes, docInfo, bookmarks, showToast]
  );

  // Tree mutation handlers
  const handleAddSibling = useCallback(() => {
    if (!docInfo) return;
    const newNode = createNewBookmark({
      title: `Section on Page ${currentPage}`,
      pageNumber: currentPage,
      fitMode: 'XYZ',
    });
    const next = insertSiblingAfter(bookmarks, selectedId, newNode);
    commitBookmarks(next);
    setSelectedId(newNode.id);
    setEditingId(newNode.id);
  }, [docInfo, currentPage, bookmarks, selectedId, commitBookmarks]);

  const handleAddChild = useCallback(() => {
    if (!docInfo || !selectedId) return;
    const newNode = createNewBookmark({
      title: `Subsection on Page ${currentPage}`,
      pageNumber: currentPage,
      fitMode: 'XYZ',
    });
    const next = insertChildInto(bookmarks, selectedId, newNode);
    commitBookmarks(next);
    setSelectedId(newNode.id);
    setEditingId(newNode.id);
  }, [docInfo, selectedId, currentPage, bookmarks, commitBookmarks]);

  const handleDelete = useCallback(() => {
    if (!selectedId) return;
    const visible = getVisibleBookmarkIds(bookmarks, searchQuery);
    const idx = visible.indexOf(selectedId);
    const fallbackId =
      visible[idx + 1] ?? (idx > 0 ? visible[idx - 1] : null);

    const next = deleteBookmarkById(bookmarks, selectedId);
    commitBookmarks(next);
    setSelectedId(fallbackId && findBookmarkById(next, fallbackId) ? fallbackId : next[0]?.id ?? null);
  }, [selectedId, bookmarks, searchQuery, commitBookmarks]);

  const handleIndent = useCallback(() => {
    if (!selectedId) return;
    const next = indentBookmark(bookmarks, selectedId);
    if (next !== bookmarks) commitBookmarks(next);
  }, [selectedId, bookmarks, commitBookmarks]);

  const handleOutdent = useCallback(() => {
    if (!selectedId) return;
    const next = outdentBookmark(bookmarks, selectedId);
    if (next !== bookmarks) commitBookmarks(next);
  }, [selectedId, bookmarks, commitBookmarks]);

  const handleMoveUp = useCallback(() => {
    if (!selectedId) return;
    const next = moveBookmarkUp(bookmarks, selectedId);
    if (next !== bookmarks) commitBookmarks(next);
  }, [selectedId, bookmarks, commitBookmarks]);

  const handleMoveDown = useCallback(() => {
    if (!selectedId) return;
    const next = moveBookmarkDown(bookmarks, selectedId);
    if (next !== bookmarks) commitBookmarks(next);
  }, [selectedId, bookmarks, commitBookmarks]);

  const handleUpdateBookmark = useCallback(
    (id: string, patch: Partial<BookmarkNode>) => {
      const next = updateBookmarkById(bookmarks, id, (node) => ({
        ...node,
        ...patch,
      }));
      commitBookmarks(next);
      if (patch.pageNumber !== undefined) {
        setCurrentPage(patch.pageNumber);
      }
    },
    [bookmarks, commitBookmarks]
  );

  const handlePickPageCoordinate = useCallback(
    (pageNumber: number, yTopPoints: number, xLeftPoints: number) => {
      if (!selectedId) return;
      const target = findBookmarkById(bookmarks, selectedId);
      if (!target) return;
      const nextFit = target.fitMode === 'Fit' || target.fitMode === 'FitV' ? 'XYZ' : target.fitMode;
      handleUpdateBookmark(selectedId, {
        pageNumber,
        fitMode: nextFit,
        top: yTopPoints,
        left: nextFit === 'XYZ' ? xLeftPoints : target.left,
      });
      setIsPickTargetActive(false);
      showToast(`Destination set to Page ${pageNumber}, Y = ${yTopPoints} pt`);
    },
    [selectedId, bookmarks, handleUpdateBookmark, showToast]
  );

  // Global keyboard shortcuts matching Windows desktop conventions
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleOpenFile();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSavePdf(e.shiftKey);
        return;
      }

      if (isInputFocused || showAutoExtract || batchModal.open || showShortcuts) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (e.key === 'Insert') {
        e.preventDefault();
        handleAddSibling();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleAddChild();
      } else if (e.key === 'F2' && selectedId) {
        e.preventDefault();
        setEditingId(selectedId);
      } else if (e.key === 'Delete' && selectedId) {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'Tab' && selectedId) {
        e.preventDefault();
        if (e.shiftKey) handleOutdent();
        else handleIndent();
      } else if (e.altKey && e.key === 'ArrowUp' && selectedId) {
        e.preventDefault();
        handleMoveUp();
      } else if (e.altKey && e.key === 'ArrowDown' && selectedId) {
        e.preventDefault();
        handleMoveDown();
      } else if (!e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        const visible = getVisibleBookmarkIds(bookmarks, searchQuery);
        if (visible.length === 0) return;
        e.preventDefault();
        const curIdx = selectedId ? visible.indexOf(selectedId) : -1;
        const nextIdx =
          e.key === 'ArrowDown'
            ? Math.min(visible.length - 1, curIdx + 1)
            : Math.max(0, curIdx === -1 ? 0 : curIdx - 1);
        const nextNode = findBookmarkById(bookmarks, visible[nextIdx]);
        if (nextNode) {
          setSelectedId(nextNode.id);
          setCurrentPage(nextNode.pageNumber);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleOpenFile,
    handleSavePdf,
    handleUndo,
    handleRedo,
    handleAddSibling,
    handleAddChild,
    handleDelete,
    handleIndent,
    handleOutdent,
    handleMoveUp,
    handleMoveDown,
    selectedId,
    bookmarks,
    searchQuery,
    showAutoExtract,
    batchModal.open,
    showShortcuts,
  ]);

  const selectedBookmark = findBookmarkById(bookmarks, selectedId);
  const totalBookmarks = countAllBookmarks(bookmarks);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#F3F5F8] dark:bg-[#14171C] text-slate-900 dark:text-slate-100">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFileInputChange}
        className="hidden"
      />

      <TopBar
        onOpenAutoExtract={() => setShowAutoExtract(true)}
        onOpenBatchText={() => setBatchModal({ open: true, tab: 'text' })}
        onOpenPageOffset={() => setBatchModal({ open: true, tab: 'offset' })}
        onOpenShortcuts={() => setShowShortcuts(true)}
        onSavePdf={() => handleSavePdf(false)}
        hasDocument={Boolean(pdfBytes)}
        isSaving={isSaving}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      <CommandRibbon
        onOpenFile={handleOpenFile}
        onSaveAs={() => handleSavePdf(true)}
        onLoadSample={handleLoadSample}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        onAddSibling={handleAddSibling}
        onAddChild={handleAddChild}
        onIndent={handleIndent}
        onOutdent={handleOutdent}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        onDelete={handleDelete}
        onExpandAll={() => setBookmarks((prev) => setAllExpanded(prev, true))}
        onCollapseAll={() => setBookmarks((prev) => setAllExpanded(prev, false))}
        hasDocument={Boolean(pdfBytes)}
        hasSelection={Boolean(selectedBookmark)}
        hasBookmarks={bookmarks.length > 0}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        fileName={docInfo?.fileName ?? ''}
        pageCount={docInfo?.pageCount ?? 0}
        bookmarkCount={totalBookmarks}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      {/* Main 3-Pane Windows Workstation Split */}
      <main className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        <BookmarkTreePane
          bookmarks={bookmarks}
          selectedId={selectedId}
          editingId={editingId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelect={(node) => {
            setSelectedId(node.id);
            setCurrentPage(node.pageNumber);
          }}
          onStartRename={(id) => setEditingId(id)}
          onCommitRename={(id, newTitle) => {
            setEditingId(null);
            const current = findBookmarkById(bookmarks, id);
            if (current && current.title !== newTitle) {
              handleUpdateBookmark(id, { title: newTitle });
            }
          }}
          onCancelRename={() => setEditingId(null)}
          onToggleExpand={(id) => {
            setBookmarks((prev) =>
              updateBookmarkById(prev, id, (n) => ({
                ...n,
                isExpanded: !n.isExpanded,
              }))
            );
          }}
          onDropBookmark={(draggedId, targetId, pos: DropPosition) => {
            const next = moveBookmarkRelative(bookmarks, draggedId, targetId, pos);
            if (next !== bookmarks) {
              commitBookmarks(next);
              setSelectedId(draggedId);
            }
          }}
          onAddFirstBookmark={handleAddSibling}
          onOpenAutoExtract={() => setShowAutoExtract(true)}
          hasDocument={Boolean(pdfBytes)}
        />

        <PdfPreviewPane
          pdfBytes={pdfBytes}
          currentPage={currentPage}
          pageCount={docInfo?.pageCount ?? 0}
          pageDimensions={docInfo?.pageDimensions ?? []}
          selectedBookmark={selectedBookmark}
          isPickTargetActive={isPickTargetActive}
          onTogglePickTarget={() => setIsPickTargetActive((v) => !v)}
          onPageChange={(p) => setCurrentPage(p)}
          onPickPageCoordinate={handlePickPageCoordinate}
          onOpenFile={handleOpenFile}
          onFileDrop={handleFileDrop}
        />

        <BookmarkInspectorPane
          selectedBookmark={selectedBookmark}
          currentPage={currentPage}
          pageCount={docInfo?.pageCount ?? 0}
          docInfo={docInfo}
          onUpdateBookmark={handleUpdateBookmark}
          onTogglePickTarget={() => setIsPickTargetActive((v) => !v)}
          isPickTargetActive={isPickTargetActive}
          onToggleOpenOutlinesOnLoad={(val) => {
            setDocInfo((prev) => (prev ? { ...prev, openOutlinesOnLoad: val } : prev));
            setHasUnsavedChanges(true);
          }}
        />
      </main>

      {/* Modals */}
      <AutoExtractModal
        isOpen={showAutoExtract}
        pdfBytes={pdfBytes}
        onClose={() => setShowAutoExtract(false)}
        onImport={(nodes, mode) => {
          const next = mode === 'replace' ? nodes : [...bookmarks, ...nodes];
          commitBookmarks(next);
          if (nodes[0]) {
            setSelectedId(nodes[0].id);
            setCurrentPage(nodes[0].pageNumber);
          }
          showToast(
            `${mode === 'replace' ? 'Replaced tree with' : 'Appended'} ${countAllBookmarks(nodes)} extracted bookmarks`
          );
        }}
      />

      <BatchTextModal
        isOpen={batchModal.open}
        initialTab={batchModal.tab}
        bookmarks={bookmarks}
        pageCount={docInfo?.pageCount ?? 1}
        fileName={docInfo?.fileName ?? 'document.pdf'}
        onClose={() => setBatchModal((prev) => ({ ...prev, open: false }))}
        onApplyOutline={(nodes, mode) => {
          const next = mode === 'replace' ? nodes : [...bookmarks, ...nodes];
          commitBookmarks(next);
          if (nodes[0]) {
            setSelectedId(nodes[0].id);
            setCurrentPage(nodes[0].pageNumber);
          }
          showToast(`Applied ${countAllBookmarks(nodes)} bookmarks from text outline`);
        }}
        onShiftPages={(delta) => {
          const next = shiftAllPageNumbers(bookmarks, delta, docInfo?.pageCount ?? 1);
          commitBookmarks(next);
          showToast(`Shifted all bookmark targets by ${delta > 0 ? `+${delta}` : delta} pages`);
        }}
      />

      <ShortcutsModal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />

      {/* Non-intrusive Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-md border shadow-md text-xs font-medium ${
            toast.kind === 'error'
              ? 'bg-rose-50 dark:bg-rose-950 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              : 'bg-slate-900 dark:bg-slate-100 border-slate-800 dark:border-slate-200 text-white dark:text-slate-900'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
