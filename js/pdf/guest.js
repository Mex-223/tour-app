// Builds the guest PDF (for support bands, crew, promoters, drivers).
// Layout: header + "call this first" + contacts, then each day as a compact block
// (band-coloured header, timetable left, venue right, small cards for catering/hotel/travel).
// Never contains money, fees, notes, guest list or other bands' plans.
import { PdfDoc, A4 } from './writer.js';
import { fmtDay, fmtDayLong, isDialable } from '../utils.js';
import { TYPE_LABEL } from '../data.js';

const M = 42;                 // page margin
const W = A4.w - M * 2;       // content width
const INK = '#14161A';
const MUTED = '#5A5E66';
const LINE = '#DADCE0';
const SOFT = '#ECEDEF';
const LINK = '#1A56C4';
const FOOT = 60;              // space kept free for the footer

const tel = (p) => (isDialable(p) ? 'tel:' + String(p).replace(/[^\d+]/g, '') : null);
const mail = (e) => (e && /@/.test(e) ? 'mailto:' + e : null);
const maps = (q) => 'https://maps.google.com/?q=' + encodeURIComponent(q);
const placeholder = (s) => /[[\]]/.test(s || '');

// Mix a colour with white (t = 0..1 how much white)
function tint(hex, t) {
  const h = String(hex || '#F5A524').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  const mix = (c) => Math.round(c + (255 - c) * t).toString(16).padStart(2, '0');
  return '#' + mix((n >> 16) & 255) + mix((n >> 8) & 255) + mix(n & 255);
}

export function buildGuestPdf({ band, recipientType, recipientName, events, sections, contacts, primary, venueContacts, docs, createdAt }) {
  const doc = new PdfDoc();
  const accent = band.color || '#F5A524';
  const accentInk = band.ink || '#1A1206';
  const light = tint(accent, 0.86);
  const footer = `${band.name} · tour info · created ${createdAt} with Tour App · please don't share publicly`;
  let pageNo = 0;
  let y = M;

  const newPage = () => {
    doc.addPage();
    pageNo += 1;
    y = M;
    const fy = A4.h - 32;
    doc.line(M, fy - 8, A4.w - M, fy - 8, { color: LINE });
    doc.text(M, fy, footer, { size: 7.5, color: MUTED });
    doc.text(A4.w - M, fy, `Page ${pageNo}`, { size: 7.5, color: MUTED, align: 'right' });
  };
  const room = () => A4.h - FOOT - y;
  const ensure = (h) => { if (room() < h) newPage(); };

  // Draw wrapped text at (x, top) within width w; returns height. measureOnly to just measure.
  const block = (x, top, w, text, { size = 10.5, bold = false, color = INK, lh = 1.32, link = null, measureOnly = false } = {}) => {
    if (!text) return 0;
    const lines = doc.wrap(text, size, bold, w);
    if (!measureOnly) {
      lines.forEach((l, i) => {
        doc.text(x, top + i * size * lh, l, { size, bold, color: link ? LINK : color });
        if (link) doc.link(x, top + i * size * lh - 1, doc.width(l, size, bold), size * lh, link);
      });
    }
    return lines.length * size * lh;
  };
  const label = (x, top, text, color = MUTED) => { doc.text(x, top, String(text).toUpperCase(), { size: 7.5, bold: true, color }); return 12; };

  const sorted = events.slice().sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const range = sorted.length ? (sorted.length === 1 ? fmtDay(sorted[0].date) : `${fmtDay(sorted[0].date)} – ${fmtDay(sorted[sorted.length - 1].date)}`) : '';
  const who = (recipientName || '').trim();

  // ---------- Header ----------
  newPage();
  label(M, y, `Tour info for ${who || recipientType}`);
  const tagW = doc.width(band.name, 9, true) + 16;
  doc.rect(A4.w - M - tagW, y - 3, tagW, 16, { fill: accent });
  doc.text(A4.w - M - tagW + 8, y, band.name, { size: 9, bold: true, color: accentInk });
  y += 14;
  y += block(M, y, W - tagW - 10, `${band.name}${range ? ' · ' + range : ''}`, { size: 22, bold: true, lh: 1.15 });
  y += 2;
  if (sorted.length > 1) y += block(M, y, W, sorted.map((e) => `${fmtDay(e.date)} ${e.place || ''}`.trim()).join('   ·   '), { size: 10, color: MUTED });
  y += 8;
  doc.line(M, y, A4.w - M, y, { color: INK, lw: 1.6 });
  y += 14;

  // ---------- Contacts ----------
  if (primary) {
    const h = 68;
    doc.rect(M, y, W, h, { fill: light, stroke: tint(accent, 0.6) });
    doc.rect(M, y, 4, h, { fill: accent });
    label(M + 16, y + 10, 'Call this first', '#5A4300');
    doc.text(M + 16, y + 24, primary.name || '', { size: 18, bold: true });
    const sub = [primary.role, primary.note].filter(Boolean).join(' · ');
    if (sub) doc.text(M + 16, y + 48, doc.wrap(sub, 10.5, false, W * 0.62)[0], { size: 10.5, color: MUTED });
    // phone / email on the right
    let ry = y + 18;
    if (primary.phone) {
      doc.text(A4.w - M - 16, ry, primary.phone, { size: 16, bold: true, color: tel(primary.phone) ? LINK : INK, align: 'right' });
      if (tel(primary.phone)) doc.link(A4.w - M - 16 - doc.width(primary.phone, 16, true), ry - 1, doc.width(primary.phone, 16, true), 20, tel(primary.phone));
      ry += 23;
    }
    if (primary.email) {
      doc.text(A4.w - M - 16, ry, primary.email, { size: 11.5, color: mail(primary.email) ? LINK : INK, align: 'right' });
      if (mail(primary.email)) doc.link(A4.w - M - 16 - doc.width(primary.email, 11.5), ry - 1, doc.width(primary.email, 11.5), 15, mail(primary.email));
    }
    y += h + 10;
  }

  const others = contacts.filter((c) => c !== primary);
  if (others.length) {
    const cols = 3;
    const gap = 8;
    const cw = (W - gap * (cols - 1)) / cols;
    const ch = 64;
    for (let i = 0; i < others.length; i += cols) {
      ensure(ch + 8);
      others.slice(i, i + cols).forEach((c, k) => {
        const x = M + k * (cw + gap);
        doc.rect(x, y, cw, ch, { stroke: LINE });
        label(x + 10, y + 9, c.role || 'Contact', c.role === 'Emergency' ? '#9B1C1C' : MUTED);
        doc.text(x + 10, y + 23, doc.wrap(c.name || '', 12.5, true, cw - 20)[0] || '', { size: 12.5, bold: true });
        const line = c.phone || c.email || '';
        const link = c.phone ? tel(c.phone) : mail(c.email);
        if (line) {
          const t = doc.wrap(line, 12, true, cw - 20)[0];
          doc.text(x + 10, y + 42, t, { size: 12, bold: true, color: link ? LINK : INK });
          if (link) doc.link(x + 10, y + 41, doc.width(t, 12, true), 16, link);
        }
      });
      y += ch + gap;
    }
  }

  // On-site contacts table only helps when there are several days
  if (venueContacts && sorted.length > 1) {
    const rows = sorted.filter((e) => e.venue && e.venue.contact && (e.venue.contact.name || e.venue.contact.phone));
    if (rows.length) {
      ensure(30 + rows.length * 20);
      y += 4;
      label(M, y, 'Contact on site, by day');
      y += 14;
      rows.forEach((e) => {
        const c = e.venue.contact;
        doc.text(M, y, fmtDay(e.date), { size: 11, bold: true });
        doc.text(M + 82, y, doc.wrap([e.venue.name, e.place].filter(Boolean).join(', '), 11, false, 160)[0] || '', { size: 11 });
        doc.text(M + 252, y, doc.wrap([c.name, c.role].filter(Boolean).join(' · '), 11, true, 140)[0] || '', { size: 11, bold: true });
        if (c.phone) {
          doc.text(A4.w - M, y, c.phone, { size: 11.5, bold: true, color: tel(c.phone) ? LINK : INK, align: 'right' });
          if (tel(c.phone)) doc.link(A4.w - M - doc.width(c.phone, 11.5, true), y - 1, doc.width(c.phone, 11.5, true), 15, tel(c.phone));
        }
        y += 19;
        doc.line(M, y - 4, A4.w - M, y - 3, { color: SOFT });
      });
      y += 4;
    }
  }

  if (docs && docs.length) {
    ensure(28);
    label(M, y, 'Documents');
    let x = M + 70;
    docs.forEach((d) => {
      const t = d.title || d.category || 'Document';
      const tw = doc.width(t, 10);
      if (x + tw > A4.w - M) { x = M + 70; y += 14; }
      doc.text(x, y - 1, t, { size: 10, color: LINK });
      doc.link(x, y - 2, tw, 14, d.url);
      x += tw + 18;
    });
    y += 20;
  }

  // ---------- Days ----------
  sorted.forEach((e, i) => {
    // A day starts on a new page only if the current one doesn't have enough room
    if (i > 0 || y > M + 40) {
      if (room() < 340) newPage(); else y += 12;
    }

    // Day header bar in the band colour
    const hh = 40;
    doc.rect(M, y, W, hh, { fill: light });
    doc.rect(M, y, 5, hh, { fill: accent });
    doc.text(M + 16, y + 8, `${fmtDay(e.date)}${e.place ? ' · ' + e.place : ''}`, { size: 16, bold: true });
    doc.text(M + 16, y + 27, doc.wrap(`${band.name} · ${e.title || TYPE_LABEL[e.type] || ''}`, 9.5, false, W * 0.6)[0], { size: 9.5, color: MUTED });
    doc.text(A4.w - M - 14, y + 10, `Day ${i + 1} of ${sorted.length}`, { size: 8.5, bold: true, color: MUTED, align: 'right' });
    doc.text(A4.w - M - 14, y + 24, TYPE_LABEL[e.type] || '', { size: 8.5, color: MUTED, align: 'right' });
    y += hh + 14;

    // Two columns: timetable | venue
    const lx = M;
    const lw = W * 0.5;
    const rx = M + W * 0.55;
    const rw = W * 0.45;
    let ly = y;
    let ry = y;

    const tt = (e.timetable && e.timetable.length) ? e.timetable : (e.time ? [{ time: e.time, label: `${TYPE_LABEL[e.type] || 'Start'}${e.end ? ' (until ' + e.end + ')' : ''}` }] : []);
    if (sections.has('timetable') && tt.length) {
      ly += label(lx, ly, 'Timetable');
      tt.forEach((t) => {
        const lines = doc.wrap(t.label, 10.5, false, lw - 54);
        const rh = lines.length * 13.5 + 6;
        const mine = who && who.length > 1 && String(t.label).toLowerCase().includes(who.toLowerCase());
        if (mine) doc.rect(lx - 4, ly - 3, lw + 4, rh, { fill: '#FFF4DF' });
        doc.text(lx, ly, t.time, { size: 10.5, bold: true, color: INK });
        lines.forEach((l, k) => doc.text(lx + 50, ly + k * 13.5, l, { size: 10.5, bold: mine }));
        ly += rh;
        doc.line(lx, ly - 3, lx + lw, ly - 3, { color: SOFT });
      });
    }

    const v = e.venue || {};
    if (sections.has('venue') && (v.name || v.address || v.loadIn || (v.contact && (v.contact.name || v.contact.phone)))) {
      ry += label(rx, ry, 'Venue');
      if (v.name) ry += block(rx, ry, rw, v.name, { size: 12, bold: true }) + 2;
      if (v.address) ry += block(rx, ry, rw, v.address, { size: 10, link: placeholder(v.address) ? null : maps([v.name, v.address].filter(Boolean).join(' ')) }) + 6;
      if (v.loadIn) { ry += label(rx, ry, 'Load-in & parking'); ry += block(rx, ry, rw, v.loadIn, { size: 10 }) + 6; }
      const c = v.contact || {};
      if (c.name || c.phone) {
        ry += label(rx, ry, 'Contact on site');
        ry += block(rx, ry, rw, [c.name, c.role].filter(Boolean).join(' · '), { size: 11.5, bold: true });
        if (c.phone) ry += block(rx, ry, rw, c.phone, { size: 13, bold: true, link: tel(c.phone) });
        ry += 6;
      }
      if (sections.has('tech') && v.tech) { ry += label(rx, ry, 'Tech'); ry += block(rx, ry, rw, v.tech, { size: 10 }) + 6; }
    }
    y = Math.max(ly, ry) + 8;

    // Small cards: catering, hotel, travel
    const cards = [];
    const ca = e.catering || {};
    if (sections.has('catering') && (ca.text || ca.time)) cards.push(['Catering', [[ca.time, false], [ca.text, false], [ca.diet ? 'Dietary needs? Tell the contact above.' : '', false]]]);
    const h = e.hotel || {};
    if (sections.has('hotel') && (h.name || h.address)) cards.push(['Hotel', [[h.name, true], [h.address, false, placeholder(h.address) || !h.address ? null : maps([h.name, h.address].filter(Boolean).join(' '))], [h.checkIn ? 'Check-in ' + h.checkIn : '', false]]]);
    const tr = e.travel || {};
    if (sections.has('travel') && (tr.depart || tr.from || tr.method || tr.driver)) cards.push(['Travel', [[[tr.depart, tr.from].filter(Boolean).join(' · '), true], [tr.method, false], [tr.driver ? 'Driver: ' + tr.driver : '', false]]]);
    if (cards.length) {
      const gap = 8;
      const cw = (W - gap * (cards.length - 1)) / cards.length;
      const heights = cards.map(([, rows]) => 16 + rows.reduce((s, [t, b]) => s + block(0, 0, cw - 20, t, { size: 9.5, bold: b, measureOnly: true }), 0) + 8);
      const ch = Math.max(...heights);
      ensure(ch + 6);
      cards.forEach(([title, rows], k) => {
        const x = M + k * (cw + gap);
        doc.rect(x, y, cw, ch, { stroke: LINE });
        let cy = y + 9;
        cy += label(x + 10, cy, title) + 2;
        rows.forEach(([t, b, link]) => { cy += block(x + 10, cy, cw - 20, t, { size: 9.5, bold: b, link }); });
      });
      y += ch + 8;
    }

    // Next day
    const next = sorted[i + 1];
    if (next) {
      ensure(30);
      doc.rect(M, y, W, 24, { fill: '#F4F5F6' });
      doc.text(M + 10, y + 8, 'NEXT', { size: 7.5, bold: true, color: MUTED });
      doc.text(M + 44, y + 7, doc.wrap(`${fmtDayLong(next.date)}${next.place ? ' · ' + next.place : ''}${next.travel && next.travel.depart ? ' · departure ' + next.travel.depart : ''}`, 10, false, W - 60)[0], { size: 10 });
      y += 30;
    }
  });

  return doc;
}
