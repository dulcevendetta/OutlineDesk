import React, { useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import type { BookmarkNode } from '../types/bookmarks';
import type { DropPosition } from '../lib/pdfOutlineText';

interface BookmarkTreePaneProps {
  bookmarks: BookmarkNode[];
  selectedId: string | null;
  editingId: string | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelect: (node: BookmarkNode) => void;
  onStartRename: (id: string) => void;
  onCommitRename: (id: string, newTitle: string) => void;
  onCancelRename: () => void;
  onToggleExpand: (id: string) => void;
  onDropBookmark: (draggedId: string, targetId: string, pos: DropPosition) => void;
  onAddFirstBookmark: () => void;
  onOpenAutoExtract: () => void;
  hasDocument: boolean;
}

export const BookmarkTreePane: React.FC<BookmarkTreePaneProps> = ({
  bookmarks,
  selectedId,
  editingId,
  searchQuery,
  onSearchChange,
  onSelect,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onToggleExpand,
  onDropBookmark,
  onAddFirstBookmark,
  onOpenAutoExtract,
  hasDocument,
}) => {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; pos: DropPosition } | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) {
      const findTitle = (list: BookmarkNode[]): string | null => {
        for (const n of list) {
          if (n.id === editingId) return n.title;
          const child = findTitle(n.children);
          if (child !== null) return child;
        }
        return null;
      };
      const t = findTitle(bookmarks);
      if (t !== null) {
        setDraftTitle(t);
        requestAnimationFrame(() => {
          editInputRef.current?.focus();
          editInputRef.current?.select();
        });
      }
    }
  }, [editingId, bookmarks]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const nodeMatchesOrHasMatchingChild = (node: BookmarkNode): boolean => {
    if (!normalizedQuery) return true;
    if (node.title.toLowerCase().includes(normalizedQuery)) return true;
    return node.children.some(nodeMatchesOrHasMatchingChild);
  };

  const renderTree = (nodes: BookmarkNode[], depth = 0) => {
    return nodes.map((node) => {
      if (!nodeMatchesOrHasMatchingChild(node)) return null;

      const isSelected = node.id === selectedId;
      const isEditing = node.id === editingId;
      const hasChildren = node.children.length > 0;
      const showChildren = hasChildren && (node.isExpanded || normalizedQuery.length > 0);
      const isDropBefore = dropTarget?.id === node.id && dropTarget.pos === 'before';
      const isDropInside = dropTarget?.id === node.id && dropTarget.pos === 'inside';
      const isDropAfter = dropTarget?.id === node.id && dropTarget.pos === 'after';

      return (
        <div key={node.id} className="select-none">
          <div
            draggable={!isEditing}
            onDragStart={(e) => {
              setDraggedId(node.id);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', node.id);
            }}
            onDragEnd={() => {
              setDraggedId(null);
              setDropTarget(null);
            }}
            onDragOver={(e) => {
              if (!draggedId || draggedId === node.id) return;
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              const relY = (e.clientY - rect.top) / rect.height;
              const pos: DropPosition =
                relY < 0.28 ? 'before' : relY > 0.72 ? 'after' : 'inside';
              setDropTarget({ id: node.id, pos });
            }}
            onDragLeave={() => {
              if (dropTarget?.id === node.id) {
                setDropTarget(null);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              const sourceId = draggedId || e.dataTransfer.getData('text/plain');
              if (sourceId && dropTarget && sourceId !== node.id) {
                onDropBookmark(sourceId, node.id, dropTarget.pos);
              }
              setDraggedId(null);
              setDropTarget(null);
            }}
            onClick={() => onSelect(node)}
            onDoubleClick={() => onStartRename(node.id)}
            style={{ paddingLeft: `${depth * 18 + 8}px` }}
            className={`relative group flex items-center gap-1.5 pr-3 min-h-[36px] py-1 text-sm cursor-pointer transition-colors ${
              isSelected
                ? 'bg-[#0067C0]/12 dark:bg-sky-500/18 text-slate-950 dark:text-white'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
            } ${isDropInside ? 'ring-1 ring-inset ring-[#0067C0] bg-[#0067C0]/8' : ''}`}
          >
            {isDropBefore && (
              <div className="absolute top-0 left-2 right-2 h-0.5 bg-[#0067C0] pointer-events-none" />
            )}
            {isDropAfter && (
              <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#0067C0] pointer-events-none" />
            )}

            {/* Expand/Collapse toggle */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (hasChildren) onToggleExpand(node.id);
              }}
              aria-label={node.isExpanded ? 'Collapse branch' : 'Expand branch'}
              className={`w-5 h-5 flex items-center justify-center rounded shrink-0 ${
                hasChildren
                  ? 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700/70'
                  : 'opacity-0 pointer-events-none'
              }`}
            >
              {hasChildren &&
                (showChildren ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                ))}
            </button>

            <Bookmark
              className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-slate-500"
              style={node.color ? { color: node.color } : undefined}
              aria-hidden="true"
            />

            {isEditing ? (
              <input
                ref={editInputRef}
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    onCommitRename(node.id, draftTitle.trim() || node.title);
                  } else if (e.key === 'Escape') {
                    onCancelRename();
                  }
                }}
                onBlur={() => onCommitRename(node.id, draftTitle.trim() || node.title)}
                className="flex-1 min-w-0 px-1.5 py-0.5 text-sm bg-white dark:bg-slate-900 border border-[#0067C0] rounded outline-none text-slate-900 dark:text-slate-100"
              />
            ) : (
              <span
                className={`flex-1 min-w-0 truncate ${node.bold ? 'font-semibold' : 'font-normal'} ${
                  node.italic ? 'italic' : ''
                }`}
                style={node.color ? { color: node.color } : undefined}
                title={`${node.title} (Double-click or F2 to rename)`}
              >
                {node.title}
              </span>
            )}

            <span className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400 shrink-0 pl-2">
              p.{node.pageNumber}
            </span>
          </div>

          {showChildren && renderTree(node.children, depth + 1)}
        </div>
      );
    });
  };

  return (
    <aside className="w-full lg:w-[350px] xl:w-[380px] shrink-0 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1B1F26] h-full overflow-hidden">
      {/* Pane Header & Search */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2.5 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xs font-semibold tracking-wide text-slate-600 dark:text-slate-300">
            Document Bookmarks
          </h2>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Drag to reorder · F2 rename
          </span>
        </div>

        <div className="relative">
          <Search
            className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter bookmarks..."
            aria-label="Filter bookmarks"
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-[#F8FAFC] dark:bg-[#14171C] border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#0067C0]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear filter"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto py-1.5">
        {!hasDocument ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-500 dark:text-slate-400">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              No PDF loaded
            </p>
            <p className="text-xs mt-1 max-w-[230px]">
              Open a PDF from your Windows PC or load the sample manual to inspect its bookmark tree.
            </p>
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center">
            <Bookmark className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              This PDF has no bookmarks yet
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-[240px] leading-relaxed">
              Create your first outline entry manually or scan the document typography to auto-generate chapters.
            </p>
            <div className="mt-4 flex flex-col gap-2 w-full max-w-[210px]">
              <button
                type="button"
                onClick={onAddFirstBookmark}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#0067C0] hover:bg-[#005A9E] rounded-md transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add First Bookmark</span>
              </button>
              <button
                type="button"
                onClick={onOpenAutoExtract}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Auto-Extract Headings</span>
              </button>
            </div>
          </div>
        ) : (
          renderTree(bookmarks)
        )}
      </div>
    </aside>
  );
};
