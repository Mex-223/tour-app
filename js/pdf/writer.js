// A tiny PDF writer: text (Helvetica / Helvetica-Bold), lines, boxes and clickable links.
// Runs entirely on the phone — no server, no outside library.
// Coordinates are in points (1/72 inch) from the TOP-LEFT of an A4 page.
import { HELV, HELV_BOLD } from './metrics.js';

export const A4 = { w: 595.28, h: 841.89 };

// Unicode → WinAnsi (Windows-1252) byte, the encoding of the built-in PDF fonts.
const CP1252 = {
  0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88,
  0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93,
  0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B,
  0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F
};
const REPLACE = { '→': '->', '←': '<-', '✓': 'v', '✔': 'v', '…': '...', ' ': ' ', '\t': ' ' };

export function toWinAnsi(str) {
  let out = '';
  for (const ch of String(str == null ? '' : str)) {
    if (REPLACE[ch]) { out += REPLACE[ch]; continue; }
    const c = ch.codePointAt(0);
    if (c >= 32 && c < 127) out += ch;
    else if (c >= 0xA0 && c <= 0xFF) out += String.fromCharCode(c);
    else if (CP1252[c]) out += String.fromCharCode(CP1252[c]);
    else if (c === 10 || c === 13) out += ' ';
    else out += '?';
  }
  return out;
}

function hexToRgb(hex) {
  const h = String(hex || '#000000').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
const num = (v) => (Math.round(v * 100) / 100).toString();
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

export class PdfDoc {
  constructor() {
    this.pages = [];
    this.page = null;
  }

  addPage() {
    this.page = { ops: [], links: [] };
    this.pages.push(this.page);
    return this.page;
  }

  // Width of a text in points
  width(str, size, bold = false) {
    const table = bold ? HELV_BOLD : HELV;
    let w = 0;
    const s = toWinAnsi(str);
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      w += table[c - 32] || 556;
    }
    return (w * size) / 1000;
  }

  // Split text into lines that fit maxWidth
  wrap(str, size, bold, maxWidth) {
    const lines = [];
    String(str == null ? '' : str).split(/\n/).forEach((para) => {
      const words = para.split(/\s+/).filter(Boolean);
      let line = '';
      words.forEach((word) => {
        const test = line ? line + ' ' + word : word;
        if (this.width(test, size, bold) <= maxWidth || !line) {
          line = test;
          // A single word longer than the line: cut it
          while (this.width(line, size, bold) > maxWidth && line.length > 1) {
            let cut = line.length - 1;
            while (cut > 1 && this.width(line.slice(0, cut), size, bold) > maxWidth) cut--;
            lines.push(line.slice(0, cut));
            line = line.slice(cut);
          }
        } else {
          lines.push(line);
          line = word;
        }
      });
      lines.push(line);
    });
    return lines;
  }

  text(x, y, str, { size = 11, bold = false, color = '#14161A', align = 'left' } = {}) {
    const s = toWinAnsi(str);
    let tx = x;
    if (align === 'right') tx = x - this.width(str, size, bold);
    if (align === 'center') tx = x - this.width(str, size, bold) / 2;
    const [r, g, b] = hexToRgb(color);
    // y is the top of the text line; PDF wants the baseline from the bottom
    const base = A4.h - y - size * 0.8;
    this.page.ops.push(`BT /${bold ? 'F2' : 'F1'} ${num(size)} Tf ${num(r)} ${num(g)} ${num(b)} rg ${num(tx)} ${num(base)} Td (${esc(s)}) Tj ET`);
  }

  rect(x, y, w, h, { fill = null, stroke = null, lw = 1 } = {}) {
    const parts = [];
    if (fill) { const [r, g, b] = hexToRgb(fill); parts.push(`${num(r)} ${num(g)} ${num(b)} rg`); }
    if (stroke) { const [r, g, b] = hexToRgb(stroke); parts.push(`${num(r)} ${num(g)} ${num(b)} RG ${num(lw)} w`); }
    parts.push(`${num(x)} ${num(A4.h - y - h)} ${num(w)} ${num(h)} re`);
    parts.push(fill && stroke ? 'B' : fill ? 'f' : 'S');
    this.page.ops.push(parts.join(' '));
  }

  line(x1, y1, x2, y2, { color = '#DADCE0', lw = 1 } = {}) {
    const [r, g, b] = hexToRgb(color);
    this.page.ops.push(`${num(r)} ${num(g)} ${num(b)} RG ${num(lw)} w ${num(x1)} ${num(A4.h - y1)} m ${num(x2)} ${num(A4.h - y2)} l S`);
  }

  // Clickable area (tel:, mailto:, https:)
  link(x, y, w, h, url) {
    if (!url) return;
    this.page.links.push({ x, y, w, h, url: toWinAnsi(url) });
  }

  // Build the file
  toBytes() {
    const objs = [];
    const add = (body) => { objs.push(body); return objs.length; };
    const catalogId = add(null);
    const pagesId = add(null);
    const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const pageIds = [];
    this.pages.forEach((p) => {
      const content = p.ops.join('\n');
      const contentId = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
      const annots = p.links.map((l) => add(
        `<< /Type /Annot /Subtype /Link /Rect [${num(l.x)} ${num(A4.h - l.y - l.h)} ${num(l.x + l.w)} ${num(A4.h - l.y)}] /Border [0 0 0] /A << /S /URI /URI (${esc(l.url)}) >> >>`
      ));
      const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${A4.w} ${A4.h}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${contentId} 0 R${annots.length ? ` /Annots [${annots.map((a) => `${a} 0 R`).join(' ')}]` : ''} >>`);
      pageIds.push(pageId);
    });
    objs[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objs[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

    let out = '%PDF-1.4\n%âãÏÓ\n';
    const offsets = [];
    objs.forEach((body, i) => {
      offsets.push(out.length);
      out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach((o) => { out += `${String(o).padStart(10, '0')} 00000 n \n`; });
    out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
    return bytes;
  }

  toBlob() {
    return new Blob([this.toBytes()], { type: 'application/pdf' });
  }
}
