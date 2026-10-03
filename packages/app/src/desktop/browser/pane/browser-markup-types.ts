export type MarkupShapeType = "rect" | "arrow" | "freehand" | "crop";

export interface MarkupPoint {
  x: number;
  y: number;
}

export interface MarkupShape {
  id: string;
  type: MarkupShapeType;
  color: string;
  lineWidth: number;
  // For rect / crop:
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  // For arrow:
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  // For freehand:
  points?: MarkupPoint[];
}

export interface BrowserAnnotationPayload {
  url: string;
  title: string;
  timestamp: string;
  viewport: {
    width: number;
    height: number;
  };
  shapes: MarkupShape[];
  textComment?: string;
  highlightedElementSummary?: string;
  screenshotBase64?: string;
}
