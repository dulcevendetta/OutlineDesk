import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronsDownUp,
  ChevronsUpDown,
  FilePlus2,
  FolderOpen,
  Indent,
  Moon,
  Outdent,
  Plus,
  Redo2,
  SaveAll,
  Sparkles,
  Sun,
  Trash2,
  Undo2,
} from 'lucide-react';

interface CommandRibbonProps {
  onOpenFile: () => void;
  onSaveAs: () => void;
  onLoadSample: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onAddSibling: () => void;
  onAddChild: () => void;
  onIndent: () => void;
  onOutdent: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  hasDocument: boolean;
  hasSelection: boolean;
  hasBookmarks: boolean;
  isDark: boolean;
  onToggleTheme: () => void;
  fileName: string;
  pageCount: number;
  bookmarkCount: number;
  hasUnsavedChanges: boolean;
}

export const CommandRibbon: React.FC<CommandRibbonProps> = ({
  onOpenFile,
  onSaveAs,
  onLoadSample,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onAddSibling,
  onAddChild,
  onIndent,
  onOutdent,
  onMoveUp,
  onMoveDown,
  onDelete,
  onExpandAll,
  onCollapseAll,
  hasDocument,
  hasSelection,
  hasBookmarks,
  isDark,
  onToggleTheme,
  fileName,
  pageCount,
  bookmarkCount,
  hasUnsavedChanges,
}) => {
  const iconBtn =
    'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 transition-colors whitespace-nowrap shrink-0 disabled:opacity-35 disabled:pointer-events-none cursor-pointer focus-visible:outline-2 focus-visible:outline-[#0067C0]';

  const divider = <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 mx-1 shrink-0" aria-hidden="true" />;

  return (
    <div className="border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#171A21] shrink-0">
      <div className="px-4 py-1.5 flex items-center justify-between gap-4 overflow-x-auto">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onOpenFile}
            title="Open PDF from PC (Ctrl+O)"
            className={iconBtn}
          >
            <FolderOpen className="w-3.5 h-3.5 text-[#0067C0] dark:text-sky-400" />
            <span>Open PDF</span>
          </button>

          <button
            type="button"
            onClick={onSaveAs}
            disabled={!hasDocument}
            title="Save a copy as... (Ctrl+Shift+S)"
            className={iconBtn}
          >
            <SaveAll className="w-3.5 h-3.5" />
            <span>Save As</span>
          </button>

          <button
            type="button"
            onClick={onLoadSample}
            title="Load built-in 8-page sample manual PDF"
            className={iconBtn}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Sample PDF</span>
          </button>

          {divider}

          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            className={iconBtn}
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            aria-label="Redo"
            className={iconBtn}
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          {divider}

          <button
            type="button"
            onClick={onAddSibling}
            disabled={!hasDocument}
            title="Add Bookmark (Insert)"
            className={iconBtn}
          >
            <Plus className="w-3.5 h-3.5 text-[#0067C0] dark:text-sky-400" />
            <span>Add</span>
          </button>

          <button
            type="button"
            onClick={onAddChild}
            disabled={!hasDocument || !hasSelection}
            title="Add Child Bookmark (Ctrl+Enter)"
            className={iconBtn}
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            <span>Child</span>
          </button>

          <button
            type="button"
            onClick={onIndent}
            disabled={!hasSelection}
            title="Indent / Nest under previous sibling (Tab)"
            aria-label="Indent bookmark"
            className={iconBtn}
          >
            <Indent className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onOutdent}
            disabled={!hasSelection}
            title="Outdent / Promote level (Shift+Tab)"
            aria-label="Outdent bookmark"
            className={iconBtn}
          >
            <Outdent className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onMoveUp}
            disabled={!hasSelection}
            title="Move Up (Alt+Up)"
            aria-label="Move bookmark up"
            className={iconBtn}
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onMoveDown}
            disabled={!hasSelection}
            title="Move Down (Alt+Down)"
            aria-label="Move bookmark down"
            className={iconBtn}
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onDelete}
            disabled={!hasSelection}
            title="Delete Bookmark (Delete)"
            aria-label="Delete bookmark"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors whitespace-nowrap shrink-0 disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {divider}

          <button
            type="button"
            onClick={onExpandAll}
            disabled={!hasBookmarks}
            title="Expand all branches"
            aria-label="Expand all"
            className={iconBtn}
          >
            <ChevronsUpDown className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onCollapseAll}
            disabled={!hasBookmarks}
            title="Collapse all branches"
            aria-label="Collapse all"
            className={iconBtn}
          >
            <ChevronsDownUp className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right side: clean unboxed document metadata + theme toggle */}
        <div className="flex items-center gap-4 shrink-0">
          {hasDocument && (
            <div className="hidden xl:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
              <span className="font-medium text-slate-700 dark:text-slate-200 max-w-[220px] truncate">
                {fileName}
              </span>
              <span aria-hidden="true">·</span>
              <span>{pageCount} pages</span>
              <span aria-hidden="true">·</span>
              <span>{bookmarkCount} bookmarks</span>
              {hasUnsavedChanges && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-700 dark:text-amber-400 font-medium">Modified</span>
                </>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={onToggleTheme}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className={iconBtn}
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
