// EXPORT — guest PDF for support bands, crew, promoters, drivers (MGMT only).
import { state, mgmtBands, bandById, events, eventById, contactsOf, membersOf, docsOf, CONTACT_ROLES } from '../store.js';
import { esc, todayISO, fmtDay } from '../utils.js';
import { icons } from '../icons.js';
import { TYPE_LABEL } from '../data.js';

const FOR = ['Support band', 'Crew', 'Promoter', 'Driver'];
const SECTIONS = [['timetable', 'Timetable'], ['venue', 'Venue & load-in'], ['tech', 'Tech info'], ['travel', 'Travel'], ['hotel', 'Hotel'], ['catering', 'Catering']];

export function ensureExport(eventId) {
  const key = eventId || '';
  if (state.exp && state.exp.key === key) return state.exp;
  const e = eventId ? eventById(eventId) : null;
  const options = mgmtBands();
  const band = (e && options.some((b) => b.id === e.band) && e.band) || (options.find((b) => b.id === state.view) || options[0] || {}).id;
  state.exp = { key, band, eventId: e ? e.id : null, type: 'Support band' };
  return state.exp;
}

export function exportEvents(bandId) {
  const today = todayISO();
  return events.filter((e) => e.band === bandId && !e.suggested && e.date >= today && e.type !== 'rehearsal')
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
}

// Everyone who could be listed as a contact: team contacts + band members who allow it
export function exportContacts(bandId) {
  const team = contactsOf(bandId).map((c) => ({ key: 'c:' + c.id, name: c.name, role: c.role, phone: c.phone, email: c.email, note: c.note, ok: c.share !== false }));
  const members = membersOf(bandId).filter((m) => m.phone).map((m) => ({ key: 'm:' + m.uid, name: m.name, role: m.instrument || 'Band', phone: m.phone, ok: !!m.sharePhone }));
  return [...team, ...members];
}

// On-site contacts saved in the show days (venue → contact on site)
export function venueContactOptions(bandId) {
  return exportEvents(bandId).filter((e) => e.venue && e.venue.contact && (e.venue.contact.name || e.venue.contact.phone))
    .map((e) => ({ key: 'v:' + e.id, eventId: e.id, name: e.venue.contact.name || e.venue.name || 'Contact on site', role: e.venue.contact.role || 'Contact on site',
      phone: e.venue.contact.phone || '', day: `${fmtDay(e.date)}${e.venue.name ? ' · ' + e.venue.name : ''}`, ok: true }));
}

// The "PDF ready" box (kept in state so a live data update doesn't wipe it)
export function resultHtml() {
  const r = state.exportResult;
  if (!r) return '';
  return `<div class="card pad stack-8 pdf-ready" role="status">
    <span class="h2">PDF ready · ${r.days} ${r.days === 1 ? 'day' : 'days'}</span>
    <span class="muted small">${esc(r.fileName)}</span>
    <div class="btn-row">
      ${r.canShare ? '<button type="button" class="btn-primary" data-action="share-pdf">Share (WhatsApp, email…)</button>' : ''}
      <a class="btn-outline" href="${esc(r.url)}" download="${esc(r.fileName)}" target="_blank" rel="noopener">Open / download</a>
    </div>
    <p class="muted small">Plans changed? Just create a new PDF and send it again. The date it was made is printed at the bottom of every page.</p>
  </div>`;
}

export function renderExport(eventId) {
  const x = ensureExport(eventId);
  const head = `<header class="head">
      <div class="topbar"><a class="link-btn" href="${x.eventId ? '#/day/' + esc(x.eventId) : '#/docs'}">Cancel</a><span class="muted small">MGMT</span></div>
      <div class="title-row"><h1>Guest PDF</h1></div>
    </header>`;
  if (!x.band) return head + '<main id="main"><div class="empty">Only MGMT can create guest PDFs.</div></main>';

  const options = mgmtBands();
  const evs = exportEvents(x.band);
  const preset = x.eventId ? [x.eventId] : evs.filter((e) => e.type === 'show').slice(0, 3).map((e) => e.id);
  const contacts = exportContacts(x.band);
  const okContacts = contacts.filter((c) => c.ok);
  const venueOpts = venueContactOptions(x.band);
  const presetVenue = venueOpts.find((c) => preset.includes(c.eventId));
  const primaryDefault = okContacts[0] ? okContacts[0].key : (presetVenue || venueOpts[0] || { key: 'new' }).key;
  const guestDocs = docsOf(x.band).filter((d) => !d.private && d.guest && /^https?:/i.test(d.url || ''));

  return head + `<main id="main">
    ${state.authError ? `<p class="form-error" role="alert">${esc(state.authError)}</p>` : ''}
    <form data-form="export" class="form">
      ${options.length > 1 ? `<label class="lbl">Band<select name="band">${options.map((b) => `<option value="${esc(b.id)}" ${b.id === x.band ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></label>`
        : `<input type="hidden" name="band" value="${esc(x.band)}">`}

      <fieldset class="choice"><legend class="lbl-text">For</legend><div class="choice-row">${FOR.map((f) =>
        `<label class="choice-opt"><input type="radio" name="type" value="${esc(f)}" ${x.type === f ? 'checked' : ''}><span>${esc(f)}</span></label>`).join('')}</div></fieldset>
      <label class="lbl">Name on the PDF (optional)<input type="text" name="name" maxlength="60" placeholder="e.g. the support band's name"></label>

      <fieldset class="choice"><legend class="lbl-text">Days</legend>
        ${evs.length ? `<div class="check-list">${evs.map((e) => `<label class="check"><input type="checkbox" name="days" value="${esc(e.id)}" ${preset.includes(e.id) ? 'checked' : ''}><span class="grow">${esc(fmtDay(e.date))} · ${esc(e.place || TYPE_LABEL[e.type])}<span class="muted"> · ${esc(e.title || '')}</span></span></label>`).join('')}</div>`
          : `<div class="empty">No upcoming shows, travel days or days off for ${esc(bandById(x.band).name)}.</div>`}
      </fieldset>

      <fieldset class="choice"><legend class="lbl-text">Include</legend><div class="choice-row">${SECTIONS.map(([k, label]) =>
        `<label class="choice-opt"><input type="checkbox" name="sections" value="${k}" ${k === 'travel' ? '' : 'checked'}><span>${esc(label)}</span></label>`).join('')}</div></fieldset>

      <fieldset class="choice"><legend class="lbl-text">Contacts</legend>
        ${contacts.length ? `<div class="check-list">${contacts.map((c) => `<label class="check ${c.ok ? '' : 'disabled'}"><input type="checkbox" name="contacts" value="${esc(c.key)}" ${c.ok ? 'checked' : 'disabled'}><span class="grow">${esc(c.name)} <span class="muted">· ${esc(c.role || '')}</span>${c.ok ? '' : '<span class="muted small"><br>Not shared in guest PDFs</span>'}</span></label>`).join('')}</div>`
          : `<p class="muted small">No team contacts saved yet. You can still pick the contact from the show day below, or add someone new.</p>`}
        <label class="lbl">Call this first (big box at the top)<select name="primary">
          ${okContacts.length ? `<optgroup label="Team contacts">${okContacts.map((c) => `<option value="${esc(c.key)}" ${c.key === primaryDefault ? 'selected' : ''}>${esc(c.name)} · ${esc(c.role || '')}</option>`).join('')}</optgroup>` : ''}
          ${venueOpts.length ? `<optgroup label="Contact on site (from the show days)">${venueOpts.map((c) => `<option value="${esc(c.key)}" ${c.key === primaryDefault ? 'selected' : ''}>${esc(c.name)} · ${esc(c.day)}</option>`).join('')}</optgroup>` : ''}
          <option value="new" ${primaryDefault === 'new' ? 'selected' : ''}>+ Add someone new…</option>
          <option value="" ${primaryDefault === '' ? 'selected' : ''}>Nobody (no box)</option>
        </select></label>
        <div class="stack-8 new-primary" ${primaryDefault === 'new' ? '' : 'hidden'}>
          <label class="lbl">Name<input type="text" name="np_name" maxlength="60" placeholder="e.g. Mex"></label>
          <label class="lbl">Role<select name="np_role">${CONTACT_ROLES.map((r) => `<option ${r === 'Tour manager' ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
          <label class="lbl">Phone<input type="tel" name="np_phone" maxlength="30" placeholder="+43 …"></label>
          <label class="lbl">Email (optional)<input type="email" name="np_email" maxlength="80"></label>
          <label class="check"><input type="checkbox" name="np_save" checked><span>Also save to team contacts for next time</span></label>
        </div>
        <label class="check"><input type="checkbox" name="venueContacts" checked><span>Contact on site for each day (from the events)</span></label>
      </fieldset>

      ${guestDocs.length ? `<fieldset class="choice"><legend class="lbl-text">Document links</legend><div class="check-list">${guestDocs.map((d) =>
        `<label class="check"><input type="checkbox" name="docs" value="${esc(d.id)}" checked><span>${esc(d.title)} <span class="muted">· ${esc(d.category)}</span></span></label>`).join('')}</div></fieldset>` : ''}

      <div class="away-note">${icons.lock(16)}<span>Never in the PDF: fees, deals, money, notes, guest list, who's on, and other bands' plans.</span></div>
      <button class="btn-primary" type="submit" ${evs.length ? '' : 'disabled'}>Create PDF</button>
    </form>
    <div id="export-result">${resultHtml()}</div>
  </main>`;
}
