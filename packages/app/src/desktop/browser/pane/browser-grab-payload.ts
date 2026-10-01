export interface BrowserGrabAccessibility {
  role?: string;
  ariaLabel?: string;
  accessibleName?: string;
}

export interface BrowserGrabComputedStyles {
  display: string;
  position: string;
  color: string;
  backgroundColor: string;
  fontSize: string;
  fontWeight: string;
  padding: string;
  margin: string;
  border: string;
}

export interface BrowserGrabTarget {
  tag: string;
  id?: string;
  className?: string;
  selector: string;
  rect: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  textContent: string;
  component?: string;
  source?: string;
  nearbyContext?: string;
  computedStyles?: BrowserGrabComputedStyles;
  accessibility?: BrowserGrabAccessibility;
  html?: string;
}

export interface BrowserGrabPayload {
  url: string;
  title?: string;
  target: BrowserGrabTarget;
  timestamp?: number;
}

export function formatComputedStyles(styles: BrowserGrabComputedStyles): string {
  const parts: string[] = [];
  if (styles.display) parts.push(`display: ${styles.display}`);
  if (styles.position) parts.push(`position: ${styles.position}`);
  if (styles.color) parts.push(`color: ${styles.color}`);
  if (styles.backgroundColor) parts.push(`background-color: ${styles.backgroundColor}`);
  if (styles.fontSize) parts.push(`font-size: ${styles.fontSize}`);
  if (styles.fontWeight) parts.push(`font-weight: ${styles.fontWeight}`);
  if (styles.padding) parts.push(`padding: ${styles.padding}`);
  if (styles.margin) parts.push(`margin: ${styles.margin}`);
  if (styles.border) parts.push(`border: ${styles.border}`);
  return parts.join("; ");
}

export function formatAccessibility(acc: BrowserGrabAccessibility): string {
  const parts: string[] = [];
  if (acc.role) parts.push(`role="${acc.role}"`);
  if (acc.ariaLabel) parts.push(`aria-label="${acc.ariaLabel}"`);
  if (acc.accessibleName) parts.push(`name="${acc.accessibleName}"`);
  return parts.join(", ");
}

export function formatGrabPayloadAsText(payload: BrowserGrabPayload): string {
  const { target, url, title } = payload;
  const lines: string[] = [];

  const contextTitle = title ? ` (${title})` : "";
  lines.push(`Attached browser context from ${url}${contextTitle}:`);

  const tag = (target.tag || "element").toLowerCase().replace(/^<|>$/g, "");
  const idStr = target.id ? `#${target.id.replace(/^#/, "")}` : "";
  const classNames = target.className
    ? target.className
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((c) => c.replace(/^\.+/, ""))
        .join(".")
    : "";
  const classStr = classNames ? `.${classNames}` : "";
  lines.push(`- Selected element: <${tag}${idStr}${classStr}>`);

  if (target.component) {
    lines.push(`- Component: ${target.component}`);
  }

  if (target.source) {
    lines.push(`- Source: ${target.source}`);
  }

  if (target.selector) {
    lines.push(`- Selector: ${target.selector}`);
  }

  if (target.rect) {
    const width = Math.round(target.rect.width);
    const height = Math.round(target.rect.height);
    const left = Math.round(target.rect.left);
    const top = Math.round(target.rect.top);
    lines.push(`- Dimensions: ${width}x${height} at (${left}, ${top})`);
  }

  if (target.textContent && target.textContent.trim()) {
    lines.push(`- Text content: "${target.textContent.trim()}"`);
  }

  if (target.nearbyContext && target.nearbyContext.trim()) {
    lines.push(`- Nearby context: ${target.nearbyContext.trim()}`);
  }

  if (target.computedStyles) {
    const stylesStr = formatComputedStyles(target.computedStyles);
    if (stylesStr) {
      lines.push(`- Computed styles: ${stylesStr}`);
    }
  }

  if (target.accessibility) {
    const accStr = formatAccessibility(target.accessibility);
    if (accStr) {
      lines.push(`- Accessibility: ${accStr}`);
    }
  }

  if (target.html && target.html.trim()) {
    lines.push(`- HTML:\n${target.html.trim()}`);
  }

  return lines.join("\n");
}
