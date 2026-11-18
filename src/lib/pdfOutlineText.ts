import type { BookmarkNode, FitMode } from '../types/bookmarks';

export function createBookmarkId(): string {
  return `bm_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function createNewBookmark(
  partial?: Partial<Omit<BookmarkNode, 'id' | 'children'>> & { children?: BookmarkNode[] }
): BookmarkNode {
  return {
    id: createBookmarkId(),
    title: partial?.title ?? 'Untitled Bookmark',
    pageNumber: partial?.pageNumber ?? 1,
    fitMode: partial?.fitMode ?? 'XYZ',
    top: partial?.top ?? null,
    left: partial?.left ?? null,
    zoom: partial?.zoom ?? null,
    color: partial?.color ?? null,
    bold: partial?.bold ?? false,
    italic: partial?.italic ?? false,
    isExpanded: partial?.isExpanded ?? true,
    children: partial?.children ?? [],
  };
}

export function cloneBookmarks(nodes: BookmarkNode[]): BookmarkNode[] {
  return nodes.map((node) => ({
    ...node,
    children: cloneBookmarks(node.children),
  }));
}

export function countAllBookmarks(nodes: BookmarkNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1 + countAllBookmarks(node.children);
  }
  return count;
}

export function findBookmarkById(nodes: BookmarkNode[], id: string | null): BookmarkNode | null {
  if (!id) return null;
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findBookmarkById(node.children, id);
    if (found) return found;
  }
  return null;
}

export function updateBookmarkById(
  nodes: BookmarkNode[],
  id: string,
  updater: (node: BookmarkNode) => BookmarkNode
): BookmarkNode[] {
  return nodes.map((node) => {
    if (node.id === id) {
      return updater(node);
    }
    if (node.children.length > 0) {
      return {
        ...node,
        children: updateBookmarkById(node.children, id, updater),
      };
    }
    return node;
  });
}

export function deleteBookmarkById(nodes: BookmarkNode[], id: string): BookmarkNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => ({
      ...node,
      children: deleteBookmarkById(node.children, id),
    }));
}

export function insertSiblingAfter(
  nodes: BookmarkNode[],
  targetId: string | null,
  newNode: BookmarkNode
): BookmarkNode[] {
  if (!targetId) {
    return [...nodes, newNode];
  }

  const result: BookmarkNode[] = [];
  let inserted = false;

  for (const node of nodes) {
    if (node.id === targetId) {
      result.push(node);
      result.push(newNode);
      inserted = true;
    } else if (node.children.length > 0) {
      const nextChildren = insertSiblingAfter(node.children, targetId, newNode);
      if (nextChildren !== node.children) {
        inserted = true;
      }
      result.push({ ...node, children: nextChildren });
    } else {
      result.push(node);
    }
  }

  return inserted ? result : nodes;
}

export function insertChildInto(
  nodes: BookmarkNode[],
  parentId: string,
  newNode: BookmarkNode
): BookmarkNode[] {
  return nodes.map((node) => {
    if (node.id === parentId) {
      return {
        ...node,
        isExpanded: true,
        children: [...node.children, newNode],
      };
    }
    if (node.children.length > 0) {
      return {
        ...node,
        children: insertChildInto(node.children, parentId, newNode),
      };
    }
    return node;
  });
}

export function moveBookmarkUp(nodes: BookmarkNode[], id: string): BookmarkNode[] {
  const index = nodes.findIndex((n) => n.id === id);
  if (index > 0) {
    const next = [...nodes];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    return next;
  }
  return nodes.map((node) => ({
    ...node,
    children: moveBookmarkUp(node.children, id),
  }));
}

export function moveBookmarkDown(nodes: BookmarkNode[], id: string): BookmarkNode[] {
  const index = nodes.findIndex((n) => n.id === id);
  if (index !== -1 && index < nodes.length - 1) {
    const next = [...nodes];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    return next;
  }
  return nodes.map((node) => ({
    ...node,
    children: moveBookmarkDown(node.children, id),
  }));
}

export function indentBookmark(nodes: BookmarkNode[], id: string): BookmarkNode[] {
  const index = nodes.findIndex((n) => n.id === id);
  if (index > 0) {
    const prevSibling = nodes[index - 1];
    const target = nodes[index];
    const next = [...nodes];
    next.splice(index, 1);
    next[index - 1] = {
      ...prevSibling,
      isExpanded: true,
      children: [...prevSibling.children, target],
    };
    return next;
  }
  return nodes.map((node) => ({
    ...node,
    children: indentBookmark(node.children, id),
  }));
}

export function outdentBookmark(nodes: BookmarkNode[], id: string): BookmarkNode[] {
  for (let i = 0; i < nodes.length; i++) {
    const parent = nodes[i];
    const childIndex = parent.children.findIndex((c) => c.id === id);
    if (childIndex !== -1) {
      const target = parent.children[childIndex];
      const remainingBefore = parent.children.slice(0, childIndex);
      const trailingSiblings = parent.children.slice(childIndex + 1);

      const updatedParent: BookmarkNode = {
        ...parent,
        children: remainingBefore,
      };
      const promotedTarget: BookmarkNode = {
        ...target,
        children: [...target.children, ...trailingSiblings],
      };

      const next = [...nodes];
      next.splice(i, 1, updatedParent, promotedTarget);
      return next;
    }

    if (parent.children.length > 0) {
      const updatedChildren = outdentBookmark(parent.children, id);
      if (updatedChildren !== parent.children) {
        const next = [...nodes];
        next[i] = { ...parent, children: updatedChildren };
        return next;
      }
    }
  }
  return nodes;
}

function containsId(node: BookmarkNode, targetId: string): boolean {
  if (node.id === targetId) return true;
  return node.children.some((c) => containsId(c, targetId));
}

function extractNode(
  nodes: BookmarkNode[],
  id: string
): { extracted: BookmarkNode | null; rest: BookmarkNode[] } {
  let extracted: BookmarkNode | null = null;
  const rest: BookmarkNode[] = [];

  for (const node of nodes) {
    if (node.id === id) {
      extracted = node;
      continue;
    }
    if (node.children.length > 0) {
      const inner = extractNode(node.children, id);
      if (inner.extracted) {
        extracted = inner.extracted;
        rest.push({ ...node, children: inner.rest });
        continue;
      }
    }
    rest.push(node);
  }

  return { extracted, rest };
}

export type DropPosition = 'before' | 'inside' | 'after';

export function moveBookmarkRelative(
  nodes: BookmarkNode[],
  draggedId: string,
  targetId: string,
  position: DropPosition
): BookmarkNode[] {
  if (draggedId === targetId) return nodes;
  const draggedNode = findBookmarkById(nodes, draggedId);
  if (!draggedNode || containsId(draggedNode, targetId)) {
    return nodes;
  }

  const { extracted, rest } = extractNode(nodes, draggedId);
  if (!extracted) return nodes;

  const insertInto = (list: BookmarkNode[]): { list: BookmarkNode[]; done: boolean } => {
    const nextList: BookmarkNode[] = [];
    let done = false;

    for (const item of list) {
      if (item.id === targetId) {
        done = true;
        if (position === 'before') {
          nextList.push(extracted, item);
        } else if (position === 'after') {
          nextList.push(item, extracted);
        } else {
          nextList.push({
            ...item,
            isExpanded: true,
            children: [...item.children, extracted],
          });
        }
      } else if (!done && item.children.length > 0) {
        const inner = insertInto(item.children);
        if (inner.done) {
          done = true;
          nextList.push({ ...item, children: inner.list });
        } else {
          nextList.push(item);
        }
      } else {
        nextList.push(item);
      }
    }

    return { list: nextList, done };
  };

  const result = insertInto(rest);
  return result.done ? result.list : nodes;
}

export function setAllExpanded(nodes: BookmarkNode[], expanded: boolean): BookmarkNode[] {
  return nodes.map((node) => ({
    ...node,
    isExpanded: expanded,
    children: setAllExpanded(node.children, expanded),
  }));
}

export function shiftAllPageNumbers(
  nodes: BookmarkNode[],
  delta: number,
  maxPages: number
): BookmarkNode[] {
  return nodes.map((node) => ({
    ...node,
    pageNumber: Math.min(maxPages, Math.max(1, node.pageNumber + delta)),
    children: shiftAllPageNumbers(node.children, delta, maxPages),
  }));
}

export function getVisibleBookmarkIds(nodes: BookmarkNode[], query: string): string[] {
  const q = query.trim().toLowerCase();
  const ids: string[] = [];

  const walk = (list: BookmarkNode[]) => {
    for (const node of list) {
      const matches = !q || node.title.toLowerCase().includes(q);
      if (matches) {
        ids.push(node.id);
      }
      if (node.children.length > 0 && (node.isExpanded || q.length > 0)) {
        walk(node.children);
      }
    }
  };

  walk(nodes);
  return ids;
}

/**
 * Serializes bookmarks to clean indented outline text format:
 * Title\tPageNumber\t[flags]
 * Compatible with Windows batch workflows & JPdfBookmarks-style indented outlines.
 */
export function serializeOutlineToText(nodes: BookmarkNode[], depth = 0): string {
  const lines: string[] = [];
  const indent = '  '.repeat(depth);

  for (const node of nodes) {
    const flags: string[] = [];
    if (node.bold) flags.push('bold');
    if (node.italic) flags.push('italic');
    if (node.color) flags.push(node.color);
    if (node.fitMode !== 'XYZ' || node.top !== null) {
      const topPart = node.top !== null ? `@${Math.round(node.top)}` : '';
      flags.push(`${node.fitMode}${topPart}`);
    }

    const suffix = flags.length > 0 ? `\t[${flags.join(', ')}]` : '';
    lines.push(`${indent}${node.title}\t${node.pageNumber}${suffix}`);
    if (node.children.length > 0) {
      lines.push(serializeOutlineToText(node.children, depth + 1));
    }
  }

  return lines.join('\n');
}

/**
 * Parses indented outline text into a hierarchical BookmarkNode tree.
 * Supports:
 *   - Tab-separated: "  1.1 Overview\t4"
 *   - Arrow-separated: "  1.1 Overview -> 4"
 *   - Slash-separated (JPdfBookmarks style): "  1.1 Overview/4"
 *   - Trailing page number: "  1.1 Overview   4"
 */
export function parseOutlineFromText(text: string, maxPages: number): BookmarkNode[] {
  const rawLines = text.split(/\r?\n/);
  const root: BookmarkNode[] = [];
  const stack: Array<{ indent: number; node: BookmarkNode }> = [];

  for (const rawLine of rawLines) {
    if (!rawLine.trim()) continue;

    // Count leading whitespace (tabs count as 2 spaces)
    const leadingMatch = rawLine.match(/^([ \t]*)(.*)$/);
    const leading = leadingMatch ? leadingMatch[1].replace(/\t/g, '  ') : '';
    const indent = leading.length;
    let body = (leadingMatch ? leadingMatch[2] : rawLine).trim();

    let bold = false;
    let italic = false;
    let color: string | null = null;
    let fitMode: FitMode = 'XYZ';
    let top: number | null = null;

    // Check optional trailing [flags]
    const flagMatch = body.match(/\s+\[([^\]]+)\]\s*$/);
    if (flagMatch) {
      body = body.slice(0, flagMatch.index).trim();
      const parts = flagMatch[1].split(',').map((s) => s.trim());
      for (const part of parts) {
        if (part.toLowerCase() === 'bold') bold = true;
        else if (part.toLowerCase() === 'italic') italic = true;
        else if (/^#[0-9a-fA-F]{6}$/.test(part)) color = part.toUpperCase();
        else {
          const fitMatch = part.match(/^(XYZ|Fit|FitH|FitV)(?:@(-?\d+(?:\.\d+)?))?$/i);
          if (fitMatch) {
            const normalized = fitMatch[1].toUpperCase();
            fitMode =
              normalized === 'FIT'
                ? 'Fit'
                : normalized === 'FITH'
                ? 'FitH'
                : normalized === 'FITV'
                ? 'FitV'
                : 'XYZ';
            if (fitMatch[2] !== undefined) {
              top = Number(fitMatch[2]);
            }
          }
        }
      }
    }

    let title = body;
    let pageNumber = 1;

    // Match tab, "->", "/", or trailing whitespace + integer page number
    const tabMatch = body.match(/^(.*?)\t+(\d+)\s*$/);
    const arrowMatch = body.match(/^(.*?)\s*->\s*(\d+)\s*$/);
    const slashMatch = body.match(/^(.*?)\/(\d+)\s*$/);
    const spaceMatch = body.match(/^(.*?)\s{2,}(\d+)\s*$/);

    const matched = tabMatch || arrowMatch || slashMatch || spaceMatch;
    if (matched) {
      title = matched[1].trim();
      pageNumber = Math.min(maxPages, Math.max(1, parseInt(matched[2], 10)));
    }

    if (!title) continue;

    const node = createNewBookmark({
      title,
      pageNumber,
      fitMode,
      top,
      bold,
      italic,
      color,
    });

    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].node.children.push(node);
    }

    stack.push({ indent, node });
  }

  return root;
}
