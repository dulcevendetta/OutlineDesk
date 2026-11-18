import React from 'react';
import { Keyboard, Monitor, X } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS: Array<{ keys: string; action: string }> = [
  { keys: 'Ctrl + O', action: 'Open PDF file from Windows PC' },
  { keys: 'Ctrl + S', action: 'Save PDF with updated bookmarks' },
  { keys: 'Ctrl + Shift + S', action: 'Save PDF copy as...' },
  { keys: 'Ctrl + Z / Ctrl + Y', action: 'Undo / Redo bookmark edits' },
  { keys: 'Insert', action: 'Add sibling bookmark after selection' },
  { keys: 'Ctrl + Enter', action: 'Add nested child bookmark' },
  { keys: 'F2 / Double-click', action: 'Rename selected bookmark inline' },
  { keys: 'Tab / Shift + Tab', action: 'Indent (nest) / Outdent (promote) bookmark' },
  { keys: 'Alt + Up / Alt + Down', action: 'Move selected bookmark up or down' },
  { keys: 'Delete', action: 'Delete selected bookmark & children' },
  { keys: 'Up / Down Arrows', action: 'Navigate visible bookmark tree' },
];

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/45 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <div className="w-full max-w-lg bg-white dark:bg-[#1B1F26] border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2
            id="shortcuts-title"
            className="font-display text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2"
          >
            <Keyboard className="w-4 h-4 text-[#0067C0] dark:text-sky-400" />
            <span>Windows Keyboard Shortcuts &amp; Desktop Tips</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-md">
            {SHORTCUTS.map((s) => (
              <div
                key={s.keys}
                className="px-3.5 py-2.5 flex items-center justify-between gap-4 text-xs"
              >
                <span className="text-slate-700 dark:text-slate-300">{s.action}</span>
                <kbd className="font-mono text-[11px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 shrink-0">
                  {s.keys}
                </kbd>
              </div>
            ))}
          </div>

          <div className="p-3.5 bg-[#F8FAFC] dark:bg-[#14171C] border border-slate-200 dark:border-slate-800 rounded-md space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <Monitor className="w-3.5 h-3.5 text-[#0067C0] dark:text-sky-400" />
              <span>Running as a Standalone Windows Desktop App</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              In Microsoft Edge or Google Chrome on Windows, open the browser menu and select{' '}
              <span className="font-medium text-slate-800 dark:text-slate-200">
                Apps → Install this site as an app
              </span>{' '}
              to launch OutlineDesk in its own borderless Windows taskbar window with direct local file access.
            </p>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#171A21] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-[#0067C0] hover:bg-[#005A9E] rounded-md cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
