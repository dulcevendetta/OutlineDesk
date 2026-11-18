export type FitMode = 'XYZ' | 'Fit' | 'FitH' | 'FitV';

export interface BookmarkNode {
  id: string;
  title: string;
  pageNumber: number; // 1-based page index
  fitMode: FitMode;
  top: number | null; // PDF points from bottom of page
  left: number | null; // PDF points from left of page
  zoom: number | null; // e.g. 1.0 = 100%, null = inherit
  color: string | null; // Hex '#RRGGBB' or null for default
  bold: boolean;
  italic: boolean;
  isExpanded: boolean;
  children: BookmarkNode[];
}

export interface PageDimension {
  width: number;
  height: number;
}

export interface PdfDocumentInfo {
  fileName: string;
  fileSize: number;
  pageCount: number;
  title: string;
  author: string;
  openOutlinesOnLoad: boolean;
  pageDimensions: PageDimension[];
}

export interface DetectedHeading {
  id: string;
  title: string;
  pageNumber: number;
  yTop: number;
  fontSize: number;
  level: 1 | 2 | 3;
  selected: boolean;
}
