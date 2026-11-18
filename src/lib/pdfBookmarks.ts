import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNull,
  PDFNumber,
  PDFObject,
  PDFRef,
  PDFString,
  StandardFonts,
  rgb,
} from 'pdf-lib';
import type { BookmarkNode, FitMode, PdfDocumentInfo } from '../types/bookmarks';
import { createBookmarkId } from './pdfOutlineText';

function decodePdfText(obj: PDFObject | undefined): string {
  if (!obj) return '';
  if (obj instanceof PDFString || obj instanceof PDFHexString) {
    return obj.decodeText();
  }
  return obj.toString();
}

function numberFromPdfObj(obj: PDFObject | undefined): number | null {
  if (obj instanceof PDFNumber) {
    return obj.asNumber();
  }
  return null;
}

function hexFromRgbArray(arr: PDFArray | undefined): string | null {
  if (!arr || arr.size() < 3) return null;
  const rObj = arr.lookup(0);
  const gObj = arr.lookup(1);
  const bObj = arr.lookup(2);
  if (
    !(rObj instanceof PDFNumber) ||
    !(gObj instanceof PDFNumber) ||
    !(bObj instanceof PDFNumber)
  ) {
    return null;
  }
  const toHex = (v: number) =>
    Math.min(255, Math.max(0, Math.round(v * 255)))
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  const hex = `#${toHex(rObj.asNumber())}${toHex(gObj.asNumber())}${toHex(bObj.asNumber())}`;
  return hex === '#000000' ? null : hex;
}

function rgbArrayFromHex(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [Number(r.toFixed(4)), Number(g.toFixed(4)), Number(b.toFixed(4))];
}

function collectNamedDests(
  pdfDoc: PDFDocument
): Map<string, PDFArray> {
  const map = new Map<string, PDFArray>();
  const catalog = pdfDoc.catalog;

  const extractDestValue = (val: PDFObject | undefined): PDFArray | null => {
    if (!val) return null;
    const resolved = pdfDoc.context.lookup(val);
    if (resolved instanceof PDFArray) return resolved;
    if (resolved instanceof PDFDict) {
      const d = resolved.lookup(PDFName.of('D'));
      if (d instanceof PDFArray) return d;
    }
    return null;
  };

  // Legacy /Dests dictionary in Catalog
  const legacyDests = catalog.lookup(PDFName.of('Dests'));
  if (legacyDests instanceof PDFDict) {
    for (const [key, value] of legacyDests.entries()) {
      const arr = extractDestValue(value);
      if (arr) {
        map.set(key.decodeText(), arr);
      }
    }
  }

  // Modern /Names -> /Dests name tree
  const namesDict = catalog.lookup(PDFName.of('Names'));
  if (namesDict instanceof PDFDict) {
    const destsTree = namesDict.lookup(PDFName.of('Dests'));
    const walkNameTree = (node: PDFObject | undefined) => {
      if (!(node instanceof PDFDict)) return;
      const namesArr = node.lookup(PDFName.of('Names'));
      if (namesArr instanceof PDFArray) {
        for (let i = 0; i + 1 < namesArr.size(); i += 2) {
          const k = decodePdfText(namesArr.lookup(i));
          const arr = extractDestValue(namesArr.lookup(i + 1));
          if (k && arr) {
            map.set(k, arr);
          }
        }
      }
      const kidsArr = node.lookup(PDFName.of('Kids'));
      if (kidsArr instanceof PDFArray) {
        for (let i = 0; i < kidsArr.size(); i++) {
          walkNameTree(kidsArr.lookup(i));
        }
      }
    };
    walkNameTree(destsTree);
  }

  return map;
}

function resolveDestArray(
  destObj: PDFObject | undefined,
  pdfDoc: PDFDocument,
  namedDests: Map<string, PDFArray>,
  pageRefToIndex: Map<string, number>
): {
  pageNumber: number;
  fitMode: FitMode;
  top: number | null;
  left: number | null;
  zoom: number | null;
} {
  const fallback = {
    pageNumber: 1,
    fitMode: 'XYZ' as FitMode,
    top: null,
    left: null,
    zoom: null,
  };

  if (!destObj) return fallback;
  const resolved = pdfDoc.context.lookup(destObj);

  let arr: PDFArray | null = null;
  if (resolved instanceof PDFArray) {
    arr = resolved;
  } else if (resolved instanceof PDFString || resolved instanceof PDFHexString) {
    arr = namedDests.get(resolved.decodeText()) ?? null;
  } else if (resolved instanceof PDFName) {
    arr = namedDests.get(resolved.decodeText()) ?? null;
  }

  if (!arr || arr.size() === 0) return fallback;

  let pageNumber = 1;
  const pageItem = arr.get(0);
  if (pageItem instanceof PDFRef) {
    pageNumber = pageRefToIndex.get(pageItem.toString()) ?? 1;
  } else if (pageItem instanceof PDFNumber) {
    pageNumber = Math.max(1, pageItem.asNumber() + 1);
  }

  const modeObj = arr.size() > 1 ? arr.lookup(1) : undefined;
  const modeStr = modeObj instanceof PDFName ? modeObj.decodeText() : 'XYZ';

  let fitMode: FitMode = 'XYZ';
  let left: number | null = null;
  let top: number | null = null;
  let zoom: number | null = null;

  if (modeStr === 'Fit' || modeStr === 'FitB') {
    fitMode = 'Fit';
  } else if (modeStr === 'FitH' || modeStr === 'FitBH') {
    fitMode = 'FitH';
    top = numberFromPdfObj(arr.lookup(2));
  } else if (modeStr === 'FitV' || modeStr === 'FitBV') {
    fitMode = 'FitV';
    left = numberFromPdfObj(arr.lookup(2));
  } else {
    fitMode = 'XYZ';
    left = numberFromPdfObj(arr.lookup(2));
    top = numberFromPdfObj(arr.lookup(3));
    const z = numberFromPdfObj(arr.lookup(4));
    zoom = z !== null && z > 0 ? z : null;
  }

  return { pageNumber, fitMode, top, left, zoom };
}

export async function parsePdfDocument(
  bytes: Uint8Array,
  fileName: string
): Promise<{ info: PdfDocumentInfo; bookmarks: BookmarkNode[] }> {
  const pdfDoc = await PDFDocument.load(bytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });

  const pages = pdfDoc.getPages();
  const pageRefToIndex = new Map<string, number>();
  const pageDimensions = pages.map((page, idx) => {
    pageRefToIndex.set(page.ref.toString(), idx + 1);
    return page.getSize();
  });

  const pageModeObj = pdfDoc.catalog.lookup(PDFName.of('PageMode'));
  const openOutlinesOnLoad =
    pageModeObj instanceof PDFName && pageModeObj.decodeText() === 'UseOutlines';

  const namedDests = collectNamedDests(pdfDoc);
  const bookmarks: BookmarkNode[] = [];

  const outlinesRef = pdfDoc.catalog.get(PDFName.of('Outlines'));
  const outlinesDict = outlinesRef ? pdfDoc.context.lookup(outlinesRef) : undefined;

  const visited = new Set<string>();

  const parseOutlineLevel = (firstRef: PDFObject | undefined): BookmarkNode[] => {
    const items: BookmarkNode[] = [];
    let currentRef = firstRef;

    while (currentRef) {
      if (currentRef instanceof PDFRef) {
        const key = currentRef.toString();
        if (visited.has(key)) break;
        visited.add(key);
      }

      const dict = pdfDoc.context.lookup(currentRef);
      if (!(dict instanceof PDFDict)) break;

      const title = decodePdfText(dict.lookup(PDFName.of('Title'))) || 'Untitled Bookmark';

      let destSource: PDFObject | undefined = dict.get(PDFName.of('Dest'));
      if (!destSource) {
        const actionObj = dict.lookup(PDFName.of('A'));
        if (actionObj instanceof PDFDict) {
          const subtype = actionObj.lookup(PDFName.of('S'));
          if (subtype instanceof PDFName && subtype.decodeText() === 'GoTo') {
            destSource = actionObj.get(PDFName.of('D'));
          }
        }
      }

      const dest = resolveDestArray(destSource, pdfDoc, namedDests, pageRefToIndex);

      const colorArr = dict.lookup(PDFName.of('C'));
      const color = colorArr instanceof PDFArray ? hexFromRgbArray(colorArr) : null;

      const flagsObj = dict.lookup(PDFName.of('F'));
      const flags = flagsObj instanceof PDFNumber ? flagsObj.asNumber() : 0;
      const italic = (flags & 1) !== 0;
      const bold = (flags & 2) !== 0;

      const countObj = dict.lookup(PDFName.of('Count'));
      const countVal = countObj instanceof PDFNumber ? countObj.asNumber() : 0;
      const isExpanded = countVal >= 0;

      const firstChild = dict.get(PDFName.of('First'));
      const children = firstChild ? parseOutlineLevel(firstChild) : [];

      items.push({
        id: createBookmarkId(),
        title,
        pageNumber: Math.min(pages.length || 1, Math.max(1, dest.pageNumber)),
        fitMode: dest.fitMode,
        top: dest.top,
        left: dest.left,
        zoom: dest.zoom,
        color,
        bold,
        italic,
        isExpanded,
        children,
      });

      currentRef = dict.get(PDFName.of('Next'));
    }

    return items;
  };

  if (outlinesDict instanceof PDFDict) {
    const first = outlinesDict.get(PDFName.of('First'));
    if (first) {
      bookmarks.push(...parseOutlineLevel(first));
    }
  }

  return {
    info: {
      fileName,
      fileSize: bytes.byteLength,
      pageCount: pages.length,
      title: pdfDoc.getTitle() || fileName.replace(/\.pdf$/i, ''),
      author: pdfDoc.getAuthor() || '',
      openOutlinesOnLoad,
      pageDimensions,
    },
    bookmarks,
  };
}

interface OutlineBuildItem {
  node: BookmarkNode;
  ref: PDFRef;
  parentRef: PDFRef;
  prevRef: PDFRef | null;
  nextRef: PDFRef | null;
  children: OutlineBuildItem[];
  visibleCount: number; // positive visible descendants if expanded, negative total descendants if collapsed
}

function buildOutlineTreeRefs(
  nodes: BookmarkNode[],
  parentRef: PDFRef,
  pdfDoc: PDFDocument
): { items: OutlineBuildItem[]; visibleTotal: number } {
  const refs = nodes.map(() => pdfDoc.context.nextRef());
  const items: OutlineBuildItem[] = [];
  let visibleTotal = 0;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const ref = refs[i];
    const prevRef = i > 0 ? refs[i - 1] : null;
    const nextRef = i < nodes.length - 1 ? refs[i + 1] : null;

    const childResult =
      node.children.length > 0
        ? buildOutlineTreeRefs(node.children, ref, pdfDoc)
        : { items: [], visibleTotal: 0 };

    const totalSubItems = childResult.visibleTotal;
    const countForDict =
      childResult.items.length === 0
        ? 0
        : node.isExpanded
        ? totalSubItems
        : -totalSubItems;

    visibleTotal += 1 + (node.isExpanded ? totalSubItems : 0);

    items.push({
      node,
      ref,
      parentRef,
      prevRef,
      nextRef,
      children: childResult.items,
      visibleCount: countForDict,
    });
  }

  return { items, visibleTotal };
}

export async function writePdfBookmarks(
  originalBytes: Uint8Array,
  bookmarks: BookmarkNode[],
  openOutlinesOnLoad: boolean
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });

  const pages = pdfDoc.getPages();
  const catalog = pdfDoc.catalog;

  if (bookmarks.length === 0) {
    catalog.delete(PDFName.of('Outlines'));
    if (!openOutlinesOnLoad) {
      catalog.delete(PDFName.of('PageMode'));
    }
    return pdfDoc.save();
  }

  const outlinesRootRef = pdfDoc.context.nextRef();
  const { items: rootItems, visibleTotal } = buildOutlineTreeRefs(
    bookmarks,
    outlinesRootRef,
    pdfDoc
  );

  const outlinesDict = pdfDoc.context.obj({
    Type: 'Outlines',
    First: rootItems[0].ref,
    Last: rootItems[rootItems.length - 1].ref,
    Count: visibleTotal,
  });
  pdfDoc.context.assign(outlinesRootRef, outlinesDict);

  const writeItems = (items: OutlineBuildItem[]) => {
    for (const item of items) {
      const { node, ref, parentRef, prevRef, nextRef, children, visibleCount } = item;
      const pageIndex = Math.min(Math.max(0, node.pageNumber - 1), Math.max(0, pages.length - 1));
      const pageRef = pages[pageIndex].ref;

      const destArray = PDFArray.withContext(pdfDoc.context);
      destArray.push(pageRef);

      if (node.fitMode === 'Fit') {
        destArray.push(PDFName.of('Fit'));
      } else if (node.fitMode === 'FitH') {
        destArray.push(PDFName.of('FitH'));
        destArray.push(node.top !== null ? PDFNumber.of(Math.round(node.top * 100) / 100) : PDFNull);
      } else if (node.fitMode === 'FitV') {
        destArray.push(PDFName.of('FitV'));
        destArray.push(node.left !== null ? PDFNumber.of(Math.round(node.left * 100) / 100) : PDFNull);
      } else {
        destArray.push(PDFName.of('XYZ'));
        destArray.push(node.left !== null ? PDFNumber.of(Math.round(node.left * 100) / 100) : PDFNull);
        destArray.push(node.top !== null ? PDFNumber.of(Math.round(node.top * 100) / 100) : PDFNull);
        destArray.push(node.zoom !== null ? PDFNumber.of(node.zoom) : PDFNull);
      }

      const itemDict = PDFDict.withContext(pdfDoc.context);
      itemDict.set(PDFName.of('Title'), PDFHexString.fromText(node.title));
      itemDict.set(PDFName.of('Parent'), parentRef);
      itemDict.set(PDFName.of('Dest'), destArray);

      if (prevRef) itemDict.set(PDFName.of('Prev'), prevRef);
      if (nextRef) itemDict.set(PDFName.of('Next'), nextRef);

      if (children.length > 0) {
        itemDict.set(PDFName.of('First'), children[0].ref);
        itemDict.set(PDFName.of('Last'), children[children.length - 1].ref);
        itemDict.set(PDFName.of('Count'), PDFNumber.of(visibleCount));
      }

      if (node.color) {
        const parsedRgb = rgbArrayFromHex(node.color);
        if (parsedRgb) {
          const colorArr = PDFArray.withContext(pdfDoc.context);
          colorArr.push(PDFNumber.of(parsedRgb[0]));
          colorArr.push(PDFNumber.of(parsedRgb[1]));
          colorArr.push(PDFNumber.of(parsedRgb[2]));
          itemDict.set(PDFName.of('C'), colorArr);
        }
      }

      const flags = (node.italic ? 1 : 0) | (node.bold ? 2 : 0);
      if (flags !== 0) {
        itemDict.set(PDFName.of('F'), PDFNumber.of(flags));
      }

      pdfDoc.context.assign(ref, itemDict);

      if (children.length > 0) {
        writeItems(children);
      }
    }
  };

  writeItems(rootItems);

  catalog.set(PDFName.of('Outlines'), outlinesRootRef);
  if (openOutlinesOnLoad) {
    catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
  } else {
    const existingMode = catalog.lookup(PDFName.of('PageMode'));
    if (existingMode instanceof PDFName && existingMode.decodeText() === 'UseOutlines') {
      catalog.set(PDFName.of('PageMode'), PDFName.of('UseNone'));
    }
  }

  return pdfDoc.save();
}

/**
 * Generates a real 8-page technical reference PDF with pre-existing hierarchical bookmarks
 * so users can test reading, editing, Y-coordinate targeting, auto-extraction, and saving right away.
 */
export async function createSamplePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle('Windows Workstation & PDF Architecture Reference');
  doc.setAuthor('OutlineDesk Documentation');

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  const pagesSpec = [
    {
      heading: 'Windows Workstation & PDF Architecture Reference',
      sub: 'Technical Specification · Edition 2026',
      sections: [
        { title: 'Document Overview', body: 'This sample PDF demonstrates hierarchical outlines, XYZ vertical coordinates, and Windows viewer navigation behavior.' },
        { title: 'Quick Start Checklist', body: '1. Select any bookmark in the left tree to jump to its target page.\n2. Use Pick Y-Target on the page preview to set exact vertical scroll offsets.\n3. Export or save your updated PDF with embedded ISO 32000 outlines.' },
      ],
    },
    {
      heading: 'Chapter 1: PDF Outline Tree Structure',
      sub: 'Page 2 · Core Catalog & Linked Lists',
      sections: [
        { title: '1.1 Root Outlines Dictionary', body: 'The document catalog references an Outlines dictionary containing First, Last, and Count entries. Windows PDF viewers inspect PageMode /UseOutlines to open the navigation pane automatically.' },
        { title: '1.2 Parent, Prev, and Next Pointers', body: 'Each bookmark item forms a doubly linked list with its siblings via Prev and Next references while pointing back to its Parent container.' },
      ],
    },
    {
      heading: 'Chapter 2: Destination Fit Modes',
      sub: 'Page 3 · Viewport Coordinate Specifications',
      sections: [
        { title: '2.1 XYZ Coordinate Destinations', body: 'XYZ specifies [page /XYZ left top zoom]. Clicking anywhere on the preview canvas captures the exact PDF point height from the bottom edge of the page.' },
        { title: '2.2 FitH and Fit Page Modes', body: 'FitH positions the page width to fill the window at a specific vertical top offset. Fit scales the entire page into the viewer pane.' },
      ],
    },
    {
      heading: 'Chapter 3: Typography & Color Styling',
      sub: 'Page 4 · Visual Hierarchy in Bookmarks',
      sections: [
        { title: '3.1 Style Bitmask Flags (/F)', body: 'PDF 1.4+ supports bit 1 (italic) and bit 2 (bold) on outline items so major chapters stand out clearly in Edge, Acrobat, and Foxit Reader.' },
        { title: '3.2 RGB Color Arrays (/C)', body: 'Three normalized floating-point values between 0.0 and 1.0 tint high-priority sections without altering the underlying document pages.' },
      ],
    },
    {
      heading: 'Chapter 4: Auto-Extracting Headings',
      sub: 'Page 5 · Font-Size Clustering Workflow',
      sections: [
        { title: '4.1 Detecting Section Titles', body: 'Many scanned or word-processed PDFs lack bookmarks entirely. Scanning font sizes across pages recovers Chapter and Section trees in seconds.' },
        { title: '4.2 Normalizing Page Offsets', body: 'Front matter such as Roman-numeral prefaces often shifts printed page numbers by +4 or +6 pages. Use Batch Page Offset to align every bookmark at once.' },
      ],
    },
    {
      heading: 'Chapter 5: Windows Viewer Compatibility',
      sub: 'Page 6 · Edge, Acrobat, SumatraPDF & Foxit',
      sections: [
        { title: '5.1 UTF-16BE Unicode Titles', body: 'OutlineDesk encodes bookmark titles with UTF-16BE byte-order marks so accents, em-dashes, and non-Latin scripts render accurately on Windows.' },
        { title: '5.2 Saving Safely Without Re-encoding Pages', body: 'Page vector streams, fonts, and embedded images remain untouched; only the catalog Outlines and PageMode dictionaries are rewritten.' },
      ],
    },
    {
      heading: 'Appendix A: Keyboard Shortcuts',
      sub: 'Page 7 · Rapid Keyboard Navigation',
      sections: [
        { title: 'A.1 Tree Editing Keys', body: 'F2 renames the selected bookmark. Insert adds a sibling. Ctrl+Enter adds a nested child. Tab indents and Shift+Tab outdents.' },
        { title: 'A.2 Reordering & History', body: 'Alt+Up and Alt+Down reorder siblings cleanly. Ctrl+Z and Ctrl+Y step backward and forward through your full editing history.' },
      ],
    },
    {
      heading: 'Appendix B: Indented Text Outline Format',
      sub: 'Page 8 · Bulk Editing in Text Editors',
      sections: [
        { title: 'B.1 Tab-Delimited Hierarchy', body: 'Export the bookmark tree to indented plain text, edit hundreds of entries in Notepad or VS Code, and paste them back in one click.' },
      ],
    },
  ];

  pagesSpec.forEach((spec, index) => {
    const page = doc.addPage([612, 792]); // US Letter
    const { width, height } = page.getSize();

    // Subtle header rule
    page.drawRectangle({
      x: 54,
      y: height - 58,
      width: width - 108,
      height: 2,
      color: rgb(0, 0.4, 0.75),
    });

    page.drawText(spec.sub, {
      x: 54,
      y: height - 48,
      size: 9.5,
      font: fontBold,
      color: rgb(0.35, 0.42, 0.52),
    });

    page.drawText(spec.heading, {
      x: 54,
      y: height - 104,
      size: 20,
      font: fontBold,
      color: rgb(0.08, 0.12, 0.18),
    });

    let cursorY = height - 165;
    for (const sec of spec.sections) {
      page.drawText(sec.title, {
        x: 54,
        y: cursorY,
        size: 13.5,
        font: fontBold,
        color: rgb(0, 0.36, 0.68),
      });
      cursorY -= 24;

      const lines = sec.body.split('\n');
      for (const line of lines) {
        // Simple word wrap at ~78 chars
        const words = line.split(' ');
        let current = '';
        for (const word of words) {
          if ((current + ' ' + word).trim().length > 78) {
            page.drawText(current.trim(), {
              x: 54,
              y: cursorY,
              size: 10.5,
              font: fontRegular,
              color: rgb(0.2, 0.25, 0.33),
            });
            cursorY -= 16;
            current = word;
          } else {
            current = (current + ' ' + word).trim();
          }
        }
        if (current) {
          page.drawText(current, {
            x: 54,
            y: cursorY,
            size: 10.5,
            font: fontRegular,
            color: rgb(0.2, 0.25, 0.33),
          });
          cursorY -= 16;
        }
      }
      cursorY -= 26;
    }

    page.drawText(`Page ${index + 1} of ${pagesSpec.length}`, {
      x: width - 118,
      y: 36,
      size: 9,
      font: fontRegular,
      color: rgb(0.45, 0.5, 0.58),
    });
  });

  const rawBytes = await doc.save();

  const initialBookmarks: BookmarkNode[] = [
    {
      id: createBookmarkId(),
      title: 'Cover & Quick Start',
      pageNumber: 1,
      fitMode: 'XYZ',
      top: 740,
      left: null,
      zoom: null,
      color: '#0067C0',
      bold: true,
      italic: false,
      isExpanded: true,
      children: [],
    },
    {
      id: createBookmarkId(),
      title: 'Chapter 1: PDF Outline Tree Structure',
      pageNumber: 2,
      fitMode: 'XYZ',
      top: 720,
      left: null,
      zoom: null,
      color: null,
      bold: true,
      italic: false,
      isExpanded: true,
      children: [
        {
          id: createBookmarkId(),
          title: '1.1 Root Outlines Dictionary',
          pageNumber: 2,
          fitMode: 'XYZ',
          top: 635,
          left: null,
          zoom: null,
          color: null,
          bold: false,
          italic: false,
          isExpanded: true,
          children: [],
        },
        {
          id: createBookmarkId(),
          title: '1.2 Parent, Prev, and Next Pointers',
          pageNumber: 2,
          fitMode: 'XYZ',
          top: 500,
          left: null,
          zoom: null,
          color: null,
          bold: false,
          italic: false,
          isExpanded: true,
          children: [],
        },
      ],
    },
    {
      id: createBookmarkId(),
      title: 'Chapter 2: Destination Fit Modes',
      pageNumber: 3,
      fitMode: 'XYZ',
      top: 720,
      left: null,
      zoom: null,
      color: null,
      bold: true,
      italic: false,
      isExpanded: true,
      children: [
        {
          id: createBookmarkId(),
          title: '2.1 XYZ Coordinate Destinations',
          pageNumber: 3,
          fitMode: 'XYZ',
          top: 635,
          left: null,
          zoom: null,
          color: null,
          bold: false,
          italic: false,
          isExpanded: true,
          children: [],
        },
        {
          id: createBookmarkId(),
          title: '2.2 FitH and Fit Page Modes',
          pageNumber: 3,
          fitMode: 'FitH',
          top: 500,
          left: null,
          zoom: null,
          color: null,
          bold: false,
          italic: false,
          isExpanded: true,
          children: [],
        },
      ],
    },
    {
      id: createBookmarkId(),
      title: 'Chapter 3: Typography & Color Styling',
      pageNumber: 4,
      fitMode: 'XYZ',
      top: 720,
      left: null,
      zoom: null,
      color: null,
      bold: true,
      italic: false,
      isExpanded: false,
      children: [
        {
          id: createBookmarkId(),
          title: '3.1 Style Bitmask Flags (/F)',
          pageNumber: 4,
          fitMode: 'XYZ',
          top: 635,
          left: null,
          zoom: null,
          color: null,
          bold: false,
          italic: true,
          isExpanded: true,
          children: [],
        },
        {
          id: createBookmarkId(),
          title: '3.2 RGB Color Arrays (/C)',
          pageNumber: 4,
          fitMode: 'XYZ',
          top: 500,
          left: null,
          zoom: null,
          color: '#0F766E',
          bold: false,
          italic: false,
          isExpanded: true,
          children: [],
        },
      ],
    },
    {
      id: createBookmarkId(),
      title: 'Chapter 4: Auto-Extracting Headings',
      pageNumber: 5,
      fitMode: 'XYZ',
      top: 720,
      left: null,
      zoom: null,
      color: null,
      bold: true,
      italic: false,
      isExpanded: true,
      children: [],
    },
    {
      id: createBookmarkId(),
      title: 'Chapter 5: Windows Viewer Compatibility',
      pageNumber: 6,
      fitMode: 'XYZ',
      top: 720,
      left: null,
      zoom: null,
      color: null,
      bold: true,
      italic: false,
      isExpanded: true,
      children: [],
    },
    {
      id: createBookmarkId(),
      title: 'Appendices',
      pageNumber: 7,
      fitMode: 'Fit',
      top: null,
      left: null,
      zoom: null,
      color: '#475569',
      bold: true,
      italic: false,
      isExpanded: true,
      children: [
        {
          id: createBookmarkId(),
          title: 'Appendix A: Keyboard Shortcuts',
          pageNumber: 7,
          fitMode: 'XYZ',
          top: 720,
          left: null,
          zoom: null,
          color: null,
          bold: false,
          italic: false,
          isExpanded: true,
          children: [],
        },
        {
          id: createBookmarkId(),
          title: 'Appendix B: Indented Text Outline Format',
          pageNumber: 8,
          fitMode: 'XYZ',
          top: 720,
          left: null,
          zoom: null,
          color: null,
          bold: false,
          italic: false,
          isExpanded: true,
          children: [],
        },
      ],
    },
  ];

  return writePdfBookmarks(rawBytes, initialBookmarks, true);
}
