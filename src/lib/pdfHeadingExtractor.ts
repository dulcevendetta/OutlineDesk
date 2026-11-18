import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { BookmarkNode, DetectedHeading } from '../types/bookmarks';
import { createNewBookmark } from './pdfOutlineText';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export { pdfjsLib };

interface TextSpan {
  str: string;
  fontSize: number;
  y: number;
  x: number;
}

/**
 * Scans PDF pages using PDF.js text layer to cluster font sizes and detect Chapter / Section headings.
 */
export async function extractHeadingsFromPdf(
  pdfBytes: Uint8Array,
  minFontRatio = 1.18
): Promise<{ headings: DetectedHeading[]; bodyFontSize: number }> {
  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice() });
  const pdf = await loadingTask.promise;

  const fontFrequency = new Map<number, number>();
  const pageLines: Array<{
    pageNumber: number;
    y: number;
    text: string;
    fontSize: number;
  }> = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const spans: TextSpan[] = [];

    for (const item of content.items) {
      if (!('str' in item)) continue;
      const text = item.str;
      if (!text.trim()) continue;
      const transform = item.transform;
      const fontSize = Math.round(Math.hypot(transform[0], transform[1]) * 10) / 10;
      const x = transform[4];
      const y = transform[5];

      spans.push({ str: text, fontSize, y, x });

      const roundedKey = Math.round(fontSize * 2) / 2;
      fontFrequency.set(roundedKey, (fontFrequency.get(roundedKey) ?? 0) + text.trim().length);
    }

    // Group spans into lines by Y proximity
    spans.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: Array<{ y: number; spans: TextSpan[] }> = [];
    for (const span of spans) {
      const last = lines[lines.length - 1];
      if (last && Math.abs(last.y - span.y) <= Math.max(3, span.fontSize * 0.35)) {
        last.spans.push(span);
      } else {
        lines.push({ y: span.y, spans: [span] });
      }
    }

    for (const line of lines) {
      line.spans.sort((a, b) => a.x - b.x);
      const joined = line.spans
        .map((s) => s.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!joined || joined.length < 2 || joined.length > 140) continue;
      // Ignore pure page numbers like "Page 3" or "3"
      if (/^(page\s+)?\d+(\s+of\s+\d+)?$/i.test(joined)) continue;

      const maxFont = Math.max(...line.spans.map((s) => s.fontSize));
      pageLines.push({
        pageNumber: p,
        y: line.y,
        text: joined,
        fontSize: maxFont,
      });
    }
  }

  await loadingTask.destroy();

  // Most frequent font size is assumed to be body text
  let bodyFontSize = 10.5;
  let maxChars = -1;
  for (const [size, count] of fontFrequency.entries()) {
    if (count > maxChars) {
      maxChars = count;
      bodyFontSize = size;
    }
  }

  const threshold = bodyFontSize * minFontRatio;
  const candidateLines = pageLines.filter((l) => l.fontSize >= threshold);

  // Cluster unique heading font sizes (descending) into up to 3 levels
  const distinctSizes = Array.from(
    new Set(candidateLines.map((l) => Math.round(l.fontSize * 2) / 2))
  ).sort((a, b) => b - a);

  const headings: DetectedHeading[] = candidateLines.map((line, idx) => {
    const rounded = Math.round(line.fontSize * 2) / 2;
    const rank = distinctSizes.indexOf(rounded);
    const level: 1 | 2 | 3 = rank <= 0 ? 1 : rank === 1 ? 2 : 3;
    return {
      id: `hd_${idx}_${line.pageNumber}`,
      title: line.text,
      pageNumber: line.pageNumber,
      yTop: Math.round(line.y + line.fontSize + 8),
      fontSize: line.fontSize,
      level,
      selected: true,
    };
  });

  return { headings, bodyFontSize };
}

export function buildTreeFromHeadings(headings: DetectedHeading[]): BookmarkNode[] {
  const selected = headings.filter((h) => h.selected);
  const root: BookmarkNode[] = [];
  const stack: Array<{ level: number; node: BookmarkNode }> = [];

  for (const h of selected) {
    const node = createNewBookmark({
      title: h.title,
      pageNumber: h.pageNumber,
      fitMode: 'XYZ',
      top: h.yTop,
      bold: h.level === 1,
      italic: false,
    });

    while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].node.children.push(node);
    }

    stack.push({ level: h.level, node });
  }

  return root;
}
