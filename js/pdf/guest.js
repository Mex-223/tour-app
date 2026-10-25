// Builds the guest PDF (for support bands, crew, promoters, drivers):
// page 1 = who to call, team contacts, venue contacts, document links;
// then one page per selected day. Never contains money, fees or other bands' plans.
import { PdfDoc, A4 } from './writer.js';
import { fmtDay, fmtDayLong, isDialable } from '../utils.js';
import { TYPE_LABEL } from '../data.js';

const M = 48;                 // page margin
const W = A4.w - M * 2;       // content width
const INK = '#14161A';
const MUTED = '#5A5E66';
const LINE = '#DADCE0';

const tel = (p) => (isDialable(p) ? 'tel:' + String(p).replace(/[^\d+]/g, '') : null);
const mail = (e) => (e && /@/.test(e) ? 'mailto:' + e : null);
const maps = (q) => 'https://maps.google.com/?q=' + encodeURIComponent(q);

class Layout {
  constructor(doc, footer) {
    this.doc = doc;
    this.footer = footer;
    this.pageNo = 0;
    this.newPage();
  }
  newPage() {
    this.doc.addPage();
    this.pageNo += 1;
    this.y = M;
    const fy = A4.h - 34;
    this.doc.line(M, fy - 8, A4.w - M, fy - 8, { color: LINE });
    this.doc.text(M, fy, this.footer, { size: 8, color: MUTED });
    this.doc.text(A4.w - M, fy, `Page ${this.pageNo}`, { size: 8, color: MUTED, align: 'right' });
  }
  ensure(h) { if (this.y + h > A4.h - 60) this.newPage(); }
  gap(h) { this.y += h; }
  // Paragraph with wrapping; returns height used
  para(text, { x = M, w = W, size = 11, bold = false, color = INK, lh = 1.35, link = null } = {}) {
    const lines = this.doc.wrap(text, size, bold, w);
    const h = lines.length * size * lh;
    this.ensure(h);
    lines.forEach((l, i) => {
      this.doc.text(x, this.y + i * size * lh, l, { size, bold, color });
      if (link) this.doc.link(x, this.y + i * size * lh - 1, this.doc.width(l, size, bold), size * lh, link);
    });
    this.y += h;
    return h;
  }
  label(text) { this.para(String(text).toUpperCase(), { size: 8.5, bold: true, color: MUTED }); this.gap(2); }
  heading(text) { this.ensure(40); this.gap(8); this.para(text, { size: 15, bold: true }); this.gap(6); }
  rule(color = INK, lw = 2) { this.doc.line(M, this.y, A4.w - M, this.y, { color, lw }); this.gap(14); }
  // "Label: value" row (value may be a link)
  field(label, value, link) {
    if (!value) return;
    const lw = 92;
    const lines = this.doc.wrap(value, 11, false, W - lw);
    this.ensure(lines.length * 15 + 2);
    this.doc.text(M, this.y + 1, label, { size: 9, bold: true, color: MUTED });
    lines.forEach((l, i) => {
      this.doc.text(M + lw, this.y + i * 15, l, { size: 11, color: link ? '#1A56C4' : INK });
      if (link) this.doc.link(M + lw, this.y + i * 15 - 1, this.doc.width(l, 11), 15, link);
    });
    this.y += lines.length * 15 + 4;
  }
}

function contactCard(L, c, x, y, w) {
  const d = L.doc;
  d.rect(x, y, w, 74, { stroke: LINE, lw: 1 });
  d.text(x + 12, y + 11, String(c.role || 'Contact').toUpperCase(), { size: 8, bold: true, color: c.role === 'Emergency' ? '#9B1C1C' : MUTED });
  d.text(x + 12, y + 25, d.wrap(c.name || '', 12, true, w - 24)[0] || '', { size: 12, bold: true });
  let ly = y + 42;
  if (c.phone) {
    d.text(x + 12, ly, c.phone, { size: 10.5, color: tel(c.phone) ? '#1A56C4' : INK });
    if (tel(c.phone)) d.link(x + 12, ly - 1, d.width(c.phone, 10.5), 14, tel(c.phone));
    ly += 15;
  }
  if (c.email) {
    const e = d.wrap(c.email, 10, false, w - 24)[0];
    d.text(x + 12, ly, e, { size: 10, color: mail(c.email) ? '#1A56C4' : INK });
    if (mail(c.email)) d.link(x + 12, ly - 1, d.width(e, 10), 14, mail(c.email));
  }
}

export function buildGuestPdf({ band, recipientType, recipientName, events, sections, contacts, primary, venueContacts, docs, createdAt }) {
  const doc = new PdfDoc();
  const footer = `${band.name} · tour info · created ${createdAt} with Tour App · please don't share publicly`;
  const L = new Layout(doc, footer);
  const sorted = events.slice().sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const range = sorted.length ? (sorted.length === 1 ? fmtDay(sorted[0].date) : `${fmtDay(sorted[0].date)} – ${fmtDay(sorted[sorted.length - 1].date)}`) : '';

  // ---------- Page 1: overview & contacts ----------
  L.label(`Tour info for ${recipientName || recipientType}`);
  L.para(`${band.name}${range ? ' · ' + range : ''}`, { size: 24, bold: true, lh: 1.2 });
  L.gap(4);
  if (sorted.length) L.para(sorted.map((e) => `${fmtDay(e.date)} ${e.place || TYPE_LABEL[e.type] || ''}`).join('  ·  '), { size: 11, color: MUTED });
  L.gap(10);
  L.rule();

  if (primary) {
    L.ensure(96);
    const y0 = L.y;
    doc.rect(M, y0, W, 86, { fill: '#FFF4DF', stroke: '#F0D19A' });
    doc.text(M + 16, y0 + 14, 'CALL THIS FIRST', { size: 8.5, bold: true, color: '#7A5300' });
    doc.text(M + 16, y0 + 30, primary.name || '', { size: 18, bold: true });
    const sub = [primary.role, primary.note].filter(Boolean).join(' · ');
    if (sub) doc.text(M + 16, y0 + 52, doc.wrap(sub, 10, false, W - 32)[0], { size: 10, color: MUTED });
    let x = M + 16;
    if (primary.phone) {
      doc.text(x, y0 + 66, primary.phone, { size: 12, bold: true, color: tel(primary.phone) ? '#1A56C4' : INK });
      if (tel(primary.phone)) doc.link(x, y0 + 65, doc.width(primary.phone, 12, true), 16, tel(primary.phone));
      x += doc.width(primary.phone, 12, true) + 24;
    }
    if (primary.email) {
      doc.text(x, y0 + 67, primary.email, { size: 11, color: mail(primary.email) ? '#1A56C4' : INK });
      if (mail(primary.email)) doc.link(x, y0 + 66, doc.width(primary.email, 11), 15, mail(primary.email));
    }
    L.y = y0 + 86 + 10;
  }

  const others = contacts.filter((c) => c !== primary);
  if (others.length) {
    L.heading('Team contacts');
    const colW = (W - 12) / 2;
    for (let i = 0; i < others.length; i += 2) {
      L.ensure(84);
      contactCard(L, others[i], M, L.y, colW);
      if (others[i + 1]) contactCard(L, others[i + 1], M + colW + 12, L.y, colW);
      L.y += 84;
    }
  }

  if (venueContacts) {
    const rows = sorted.filter((e) => e.venue && e.venue.contact && (e.venue.contact.name || e.venue.contact.phone));
    if (rows.length) {
      L.heading('Contact on site, by day');
      rows.forEach((e) => {
        const c = e.venue.contact;
        L.ensure(30);
        doc.text(M, L.y, fmtDay(e.date), { size: 10.5, bold: true });
        doc.text(M + 92, L.y, doc.wrap([e.venue.name, e.place].filter(Boolean).join(', '), 10.5, false, 170)[0] || '', { size: 10.5 });
        doc.text(M + 272, L.y, doc.wrap([c.name, c.role].filter(Boolean).join(' · '), 10.5, false, 130)[0] || '', { size: 10.5 });
        if (c.phone) {
          doc.text(A4.w - M, L.y, c.phone, { size: 10.5, color: tel(c.phone) ? '#1A56C4' : INK, align: 'right' });
          if (tel(c.phone)) doc.link(A4.w - M - doc.width(c.phone, 10.5), L.y - 1, doc.width(c.phone, 10.5), 15, tel(c.phone));
        }
        L.y += 18;
        doc.line(M, L.y - 4, A4.w - M, L.y - 4, { color: '#ECEDEF' });
      });
    }
  }

  if (docs && docs.length) {
    L.heading('Documents');
    docs.forEach((d) => {
      L.ensure(20);
      doc.text(M, L.y, String(d.category || 'Document').toUpperCase(), { size: 8, bold: true, color: MUTED });
      const t = doc.wrap(d.title || d.url, 11, false, W - 110)[0];
      doc.text(M + 92, L.y - 2, t, { size: 11, color: '#1A56C4' });
      doc.link(M + 92, L.y - 3, doc.width(t, 11), 15, d.url);
      L.y += 18;
    });
  }

  // ---------- One page per day ----------
  sorted.forEach((e, i) => {
    L.newPage();
    L.label(`Day ${i + 1} of ${sorted.length} · ${TYPE_LABEL[e.type] || 'Event'}`);
    L.para(`${fmtDay(e.date)}${e.place ? ' · ' + e.place : ''}`, { size: 24, bold: true, lh: 1.2 });
    L.gap(2);
    L.para(`${band.name} · ${e.title || ''}`, { size: 11, color: MUTED });
    L.gap(8);
    L.rule();

    if (sections.has('timetable')) {
      const tt = (e.timetable && e.timetable.length) ? e.timetable : (e.time ? [{ time: e.time, label: `${TYPE_LABEL[e.type] || 'Start'}${e.end ? ' (until ' + e.end + ')' : ''}` }] : []);
      if (tt.length) {
        L.heading('Timetable');
        tt.forEach((t) => {
          L.ensure(20);
          doc.text(M, L.y, t.time, { size: 11.5, bold: true });
          const lines = doc.wrap(t.label, 11.5, false, W - 70);
          lines.forEach((l, k) => doc.text(M + 62, L.y + k * 15, l, { size: 11.5 }));
          L.y += lines.length * 15 + 4;
          doc.line(M, L.y - 3, A4.w - M, L.y - 3, { color: '#ECEDEF' });
        });
      }
    }

    const v = e.venue || {};
    if (sections.has('venue') && (v.name || v.address || v.loadIn || (v.contact && (v.contact.name || v.contact.phone)))) {
      L.heading('Venue');
      L.field('Venue', v.name);
      if (v.address) L.field('Address', v.address, /[[\]]/.test(v.address) ? null : maps([v.name, v.address].filter(Boolean).join(' ')));
      L.field('Load-in', v.loadIn);
      const c = v.contact || {};
      if (c.name || c.phone) L.field('On site', [c.name, c.role].filter(Boolean).join(' · '));
      if (c.phone) L.field('Phone', c.phone, tel(c.phone));
      if (sections.has('tech')) L.field('Tech', v.tech);
    }

    const tr = e.travel || {};
    if (sections.has('travel') && (tr.depart || tr.from || tr.method || tr.driver)) {
      L.heading('Travel');
      L.field('Departure', [tr.depart, tr.from].filter(Boolean).join(' · '));
      L.field('Method', tr.method);
      L.field('Driver', tr.driver);
    }

    const h = e.hotel || {};
    if (sections.has('hotel') && (h.name || h.address)) {
      L.heading('Hotel');
      L.field('Hotel', h.name);
      if (h.address) L.field('Address', h.address, /[[\]]/.test(h.address) ? null : maps([h.name, h.address].filter(Boolean).join(' ')));
      L.field('Check-in', h.checkIn);
    }

    const ca = e.catering || {};
    if (sections.has('catering') && (ca.text || ca.time)) {
      L.heading('Catering');
      L.field('What', ca.text);
      L.field('When', ca.time);
      L.field('Dietary', ca.diet ? 'Send your dietary needs to the contact above.' : '');
    }

    const next = sorted[i + 1];
    if (next) {
      L.gap(10);
      L.ensure(50);
      const y0 = L.y;
      doc.rect(M, y0, W, 40, { fill: '#F4F5F6' });
      doc.text(M + 14, y0 + 9, 'NEXT', { size: 8, bold: true, color: MUTED });
      doc.text(M + 14, y0 + 22, doc.wrap(`${fmtDayLong(next.date)}${next.place ? ' · ' + next.place : ''}${next.travel && next.travel.depart ? ' · departure ' + next.travel.depart : ''}`, 11, false, W - 28)[0], { size: 11 });
      L.y = y0 + 50;
    }
  });

  return doc;
}
