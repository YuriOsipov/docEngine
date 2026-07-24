import { cssFontSizeToPdfPt, cssFontWeightToPdfBold, DEFAULT_BODY_FONT_PT } from './style-mapper.js';
import {
  parseCssColor,
  pdfInlineCodeStyle,
  pdfMarkStyle,
} from './rich-text-pdf-styles.js';

const VOID_TAGS = new Set(['br']);
const BOLD_TAGS = new Set(['b', 'strong']);
const ITALIC_TAGS = new Set(['i', 'em']);
const UNDERLINE_TAGS = new Set(['u']);
const STRIKE_TAGS = new Set(['s', 'strike']);
const HEADING_SCALE: Record<string, number> = { h1: 1.6, h2: 1.35, h3: 1.15 };
const HEADING_MARGIN: Record<string, number[]> = {
  h1: [0, 6, 0, 3],
  h2: [0, 5, 0, 2],
  h3: [0, 4, 0, 2],
};

export type PdfInlinePart = any;
export type PdfTextBlock = { parts: PdfInlinePart[]; alignment?: string; margin?: number[] };

type HtmlNode = Record<string, any>;

type ConverterState = {
  baseFontSize: number;
  baseFont?: string;
  blocks: PdfTextBlock[];
  currentParts: PdfInlinePart[];
  currentAlignment?: string;
  styleStack: Record<string, any>[];
};

/**
 * Convert a limited HTML fragment to pdfmake content blocks.
 */
export function htmlToPdfBlocks(
  html: any,
  options: { baseFontSize?: number; baseFont?: string } = {},
): PdfTextBlock[] {
  const source = plainTextNewlinesToBrHtml(String(html ?? '').trim());
  if (!source) return [];

  const state = createConverterState(
    options.baseFontSize ?? DEFAULT_BODY_FONT_PT,
    options.baseFont,
  );
  walkNodes(parseHtml(source), state);
  flushBlock(state);
  return state.blocks;
}

/**
 * Flat inline parts for emptiness checks and legacy callers.
 */
export function htmlToPdfText(
  html: any,
  options: { baseFontSize?: number; baseFont?: string } = {},
): PdfInlinePart[] {
  const blocks = htmlToPdfBlocks(html, options);
  if (!blocks.length) return [];

  const parts: PdfInlinePart[] = [];
  for (const block of blocks) {
    if (parts.length) parts.push('\n');
    parts.push(...block.parts);
  }
  return parts;
}

const BLOCK_LEVEL_HTML_RE = /<(h[1-3]|ul|ol|li|div|p)(\s|>|\/)/i;

export function isBlockLevelHtml(html: any): boolean {
  return BLOCK_LEVEL_HTML_RE.test(String(html ?? ''));
}

function createConverterState(baseFontSize: number, baseFont?: string): ConverterState {
  const baseStyle: Record<string, any> = {};
  if (baseFont) baseStyle.font = baseFont;

  return {
    baseFontSize,
    baseFont,
    blocks: [],
    currentParts: [],
    currentAlignment: undefined,
    styleStack: [baseStyle],
  };
}

function parseHtml(html: string): HtmlNode[] {
  const root: HtmlNode[] = [];
  const stack: Array<{ tag: string; children: HtmlNode[] }> = [{ tag: '#root', children: root }];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\s*([^>]*)\/?>|([^<]+)/g;

  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    if (match[4] !== undefined) {
      const text = decodeHtmlEntities(match[4]);
      if (text) stack[stack.length - 1].children.push({ type: 'text', text });
      continue;
    }

    const closing = match[1] === '/';
    const tag = match[2].toLowerCase();
    const attrs = match[3] ?? '';
    const selfClosing = attrs.endsWith('/') || VOID_TAGS.has(tag);

    if (closing) {
      while (stack.length > 1) {
        const top = stack.pop();
        if (top?.tag === tag) break;
      }
      continue;
    }

    if (tag === 'br') {
      stack[stack.length - 1].children.push({ type: 'br' });
      continue;
    }

    const node: HtmlNode = {
      type: 'element',
      tag,
      attrs: parseAttrs(attrs.replace(/\/$/, '')),
      children: [],
    };
    stack[stack.length - 1].children.push(node);
    if (!selfClosing) stack.push(node as { tag: string; children: HtmlNode[] });
  }

  return root;
}

function parseAttrs(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(attrString)) !== null) {
    attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attrs;
}

function walkNodes(nodes: HtmlNode[], state: ConverterState): void {
  for (const node of nodes) {
    convertNode(node, state);
  }
}

function convertNode(node: HtmlNode, state: ConverterState): void {
  if (node.type === 'text') {
    appendInline(String(node.text ?? ''), state);
    return;
  }

  if (node.type === 'br') {
    appendHardLineBreak(state);
    return;
  }

  const tag = String(node.tag ?? '');
  const children = (node.children ?? []) as HtmlNode[];

  if (tag === 'ul' || tag === 'ol') {
    flushBlock(state);
    let index = 0;
    for (const child of children) {
      if (child.type !== 'element' || child.tag !== 'li') continue;
      state.currentAlignment = undefined;
      appendInline(tag === 'ol' ? `${++index}. ` : '• ', state);
      walkNodes((child.children ?? []) as HtmlNode[], state);
      flushBlock(state);
    }
    return;
  }

  if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
    flushBlock(state);
    const scale = HEADING_SCALE[tag];
    pushStyle(state, { bold: true, fontSize: Math.round(state.baseFontSize * scale * 10) / 10 });
    walkNodes(children, state);
    popStyle(state);
    flushBlock(state, HEADING_MARGIN[tag]);
    return;
  }

  if (tag === 'div' || tag === 'p') {
    flushBlock(state);
    const alignment = parseElementAlignment(node.attrs ?? {});
    if (alignment) state.currentAlignment = alignment;
    walkNodes(children, state);
    flushBlock(state);
    return;
  }

  if (BOLD_TAGS.has(tag)) {
    pushStyle(state, { bold: true });
    walkNodes(children, state);
    popStyle(state);
    return;
  }

  if (ITALIC_TAGS.has(tag)) {
    pushStyle(state, { italics: true });
    walkNodes(children, state);
    popStyle(state);
    return;
  }

  if (UNDERLINE_TAGS.has(tag)) {
    pushStyle(state, { decoration: 'underline' });
    walkNodes(children, state);
    popStyle(state);
    return;
  }

  if (STRIKE_TAGS.has(tag)) {
    pushStyle(state, { decoration: 'lineThrough' });
    walkNodes(children, state);
    popStyle(state);
    return;
  }

  if (tag === 'mark') {
    pushStyle(state, pdfMarkStyle(parseInlineStyle(String(node.attrs?.style ?? ''), state.baseFontSize)));
    walkNodes(children, state);
    popStyle(state);
    return;
  }

  if (tag === 'code') {
    pushStyle(state, pdfInlineCodeStyle(state.baseFontSize, parseInlineStyle(String(node.attrs?.style ?? ''), state.baseFontSize)));
    walkNodes(children, state);
    popStyle(state);
    return;
  }

  if (tag === 'span') {
    pushStyle(state, parseInlineStyle(String(node.attrs?.style ?? ''), state.baseFontSize));
    walkNodes(children, state);
    popStyle(state);
    return;
  }

  walkNodes(children, state);
}

function pushStyle(state: ConverterState, extra: Record<string, any>): void {
  state.styleStack.push({ ...currentStyle(state), ...extra });
}

function popStyle(state: ConverterState): void {
  if (state.styleStack.length > 1) state.styleStack.pop();
}

function currentStyle(state: ConverterState): Record<string, any> {
  return { ...state.styleStack[state.styleStack.length - 1] };
}

function appendHardLineBreak(state: ConverterState): void {
  const last = state.currentParts[state.currentParts.length - 1];
  if (typeof last === 'string') {
    state.currentParts[state.currentParts.length - 1] = last + '\n';
    return;
  }
  if (last && typeof last === 'object' && 'text' in last) {
    last.text = String(last.text ?? '') + '\n';
    return;
  }
  state.currentParts.push('\n');
}

function appendInline(text: string, state: ConverterState): void {
  const cleaned = String(text).replace(/\u00a0/g, ' ');
  if (!cleaned) return;

  const style = currentStyle(state);
  const part = styleToPart(cleaned, style);
  const last = state.currentParts[state.currentParts.length - 1];

  if (typeof part === 'string' && typeof last === 'string') {
    state.currentParts[state.currentParts.length - 1] = last + part;
    return;
  }

  if (
    typeof part === 'object' &&
    typeof last === 'object' &&
    part.text &&
    last.text &&
    JSON.stringify({ ...last, text: undefined }) === JSON.stringify({ ...part, text: undefined })
  ) {
    last.text = String(last.text) + String(part.text);
    return;
  }

  state.currentParts.push(part);
}

function styleToPart(text: string, style: Record<string, any>): PdfInlinePart {
  const props: Record<string, any> = { text };
  if (style.font) props.font = style.font;
  if (style.bold === true) props.bold = true;
  else if (style.bold === false) props.bold = false;
  if (style.italics) props.italics = true;
  if (style.fontSize) props.fontSize = style.fontSize;
  if (style.decoration) props.decoration = style.decoration;
  if (style.color) props.color = style.color;
  if (style.background) props.background = style.background;
  if (Object.keys(props).length === 1) return text;
  return props;
}

function flushBlock(state: ConverterState, margin?: number[]): void {
  if (!state.currentParts.length) {
    return;
  }

  const block: PdfTextBlock = { parts: state.currentParts };
  if (state.currentAlignment) block.alignment = state.currentAlignment;
  if (margin) block.margin = margin;
  state.blocks.push(block);
  state.currentParts = [];
  state.currentAlignment = undefined;
}

function parseElementAlignment(attrs: Record<string, string>): string | undefined {
  const styleAlignment = parseBlockStyle(String(attrs.style ?? '')).alignment;
  if (styleAlignment) return styleAlignment;

  const className = String(attrs.class ?? '');
  const match = className.match(/document-align--(left|center|right|justify)/);
  return match?.[1];
}

function parseBlockStyle(styleValue: string): { alignment?: string } {
  const out: { alignment?: string } = {};
  for (const rule of styleValue.split(';')) {
    const colon = rule.indexOf(':');
    if (colon === -1) continue;
    const prop = rule.slice(0, colon).trim().toLowerCase();
    const value = rule.slice(colon + 1).trim().toLowerCase();
    if (prop === 'text-align' && ['left', 'center', 'right', 'justify'].includes(value)) {
      out.alignment = value;
    }
  }
  return out;
}

function parseInlineStyle(styleValue: string, emBasePt: number): Record<string, any> {
  const emBasePx = (emBasePt * 96) / 72;
  const out: Record<string, any> = {};
  for (const rule of styleValue.split(';')) {
    const colon = rule.indexOf(':');
    if (colon === -1) continue;
    const prop = rule.slice(0, colon).trim().toLowerCase();
    const value = rule.slice(colon + 1).trim();
    const lower = value.toLowerCase();

    if (prop === 'font-weight') {
      const bold = cssFontWeightToPdfBold(value);
      if (bold === true) out.bold = true;
      else if (bold === false) out.bold = false;
    } else if (prop === 'font-style' && lower === 'italic') {
      out.italics = true;
    } else if (prop === 'text-decoration' || prop === 'text-decoration-line') {
      if (lower.includes('underline')) out.decoration = 'underline';
      if (lower.includes('line-through')) out.decoration = 'lineThrough';
    } else if (prop === 'font-size') {
      const fontSize = parseFontSizePt(value, emBasePx);
      if (fontSize) out.fontSize = fontSize;
    } else if (prop === 'color') {
      const color = parseCssColor(value);
      if (color) out.color = color;
    } else if (prop === 'background-color' || prop === 'background') {
      const background = parseCssColor(value);
      if (background) out.background = background;
    }
  }
  return out;
}

function parseFontSizePt(value: string, emBasePx: number): number | null {
  const pt = cssFontSizeToPdfPt(value, emBasePx);
  if (pt == null || pt < 4 || pt > 72) return null;
  return Math.round(pt * 10) / 10;
}

function decodeHtmlEntities(value: string): string {
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function plainTextToPdfText(text: any): PdfInlinePart[] {
  const value = String(text ?? '');
  if (!value) return [];
  return [value];
}

/**
 * Replace literal newlines outside HTML tags with <br> so line breaks survive HTML parsing.
 */
export function plainTextNewlinesToBrHtml(html: any): string {
  const value = String(html ?? '');
  if (!value.includes('\n')) return value;

  let result = '';
  let inTag = false;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (ch === '<') inTag = true;
    if (!inTag && ch === '\n') {
      result += '<br>';
      continue;
    }
    result += ch;
    if (ch === '>') inTag = false;
  }
  return result;
}

export function withPdfStyle(parts: PdfInlinePart[], style: Record<string, any>): PdfInlinePart[] {
  if (!parts.length || !Object.keys(style).length) return parts;
  return parts.map((part) => {
    if (typeof part === 'string') return { text: part, ...style };
    return { ...style, ...part };
  });
}

/**
 * When a paragraph mixes bold and normal inline parts, pdfmake inherits bold from
 * defaultStyle unless non-bold fragments set bold: false explicitly.
 */
export function stampExplicitPdfBold(parts: PdfInlinePart[]): PdfInlinePart[] {
  if (!parts.length) return parts;
  const hasBold = parts.some((part) => typeof part === 'object' && part?.bold === true);
  if (!hasBold) return parts;

  return parts.map((part) => {
    if (typeof part === 'object' && part?.bold === true) return part;
    if (typeof part === 'string') return { text: part, bold: false };
    return { ...part, bold: false };
  });
}

/**
 * Ensure every inline pdfmake text part has an explicit embedded font.
 */
export function ensurePdfPartFonts(parts: PdfInlinePart[], fontName: string): PdfInlinePart[] {
  if (!parts.length || !fontName) return parts;
  return parts.map((part) => {
    if (typeof part === 'string') return { text: part, font: fontName };
    if (part?.font) return part;
    return { ...part, font: fontName };
  });
}

/**
 * Apply inline style, explicit bold stamping, and embedded font to pdfmake text parts.
 */
export function finalizePdfInlineParts(
  parts: PdfInlinePart[],
  { font, inlineStyle = {} }: { font?: string; inlineStyle?: Record<string, any> } = {},
): PdfInlinePart[] {
  let out = parts;
  if (inlineStyle && Object.keys(inlineStyle).length) {
    out = withPdfStyle(out, inlineStyle);
  }
  out = stampExplicitPdfBold(out);
  const fontName = String(inlineStyle?.font ?? font ?? '');
  if (fontName) out = ensurePdfPartFonts(out, fontName);
  return out;
}

export function pdfBlocksHaveContent(blocks: PdfTextBlock[]): boolean {
  return blocks.some((block) => pdfTextContent(block.parts));
}

export function pdfTextContent(parts: PdfInlinePart[]): string {
  return parts
    .map((part) => (typeof part === 'string' ? part : String(part.text ?? '')))
    .join('')
    .replace(/\u200B/g, '')
    .trim();
}
