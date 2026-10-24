// EVENT EDITOR — new / edit / delete an event (MGMT only).
import { state, mgmtBands, membersOf, eventById, isMgmt, bandById } from '../store.js';
import { TYPE_LABEL, MISSING_LABEL } from '../data.js';
import { esc, todayISO } from '../utils.js';
import { icons } from '../icons.js';

const TYPES = ['show', 'rehearsal', 'travel', 'off', 'promo'];

function blankDraft(key, date) {
  const options = mgmtBands();
  const preferred = options.find((b) => b.id === state.view) || options[0];
  const band = preferred ? preferred.id : null;
  return {
    key, id: null, band, type: 'show', title: '', date: /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : todayISO(),
    time: '', end: '', place: '', people: band ? membersOf(band).map((m) => m.uid) : [],
    status: null, missing: [], timetable: [], venue: { contact: {} }, travel: {}, hotel: {}, catering: {}, guests: {}, setlist: '', notes: ''
  };
}

function draftFromEvent(key, e) {
  const c = JSON.parse(JSON.stringify(e));
  return {
    key, id: e.id, band: e.band, type: c.type || 'show', title: c.title || '', date: c.date, time: c.time || '', end: c.end || '',
    place: c.place || '', people: c.people || [], status: c.status || null, missing: c.missing || [], timetable: c.timetable || [],
    venue: { ...(c.venue || {}), contact: { ...((c.venue && c.venue.contact) || {}) } }, travel: c.travel || {}, hotel: c.hotel || {},
    catering: c.catering || {}, guests: c.guests || {}, setlist: c.setlist || '', notes: c.notes || ''
  };
}

export function ensureDraft(mode, arg) {
  const key = `${mode}:${arg || ''}`;
  if (state.draft && state.draft.key === key) return state.draft;
  if (mode === 'edit') {
    const e = eventById(arg);
    state.draft = e ? draftFromEvent(key, e) : null;
  } else {
    state.draft = blankDraft(key, arg);
  }
  return state.draft;
}

const v = (x) => esc(x == null ? '' : x);
const input = (label, name, value, attrs = '') =>
  `<label class="lbl">${label}<input type="text" name="${name}" value="${v(value)}" ${attrs}></label>`;

function group(title, inner, open = false) {
  return `<details class="sec" ${open ? 'open' : ''}><summary><span class="sec-title">${esc(title)}</span>${icons.chevronDown(18)}</summary><div class="sec-body">${inner}</div></details>`;
}

export function renderEditor(mode, arg) {
  const d = ensureDraft(mode, arg);
  const back = mode === 'edit' && d ? `#/day/${esc(d.id)}` : '#/schedule';
  const head = (title) => `<header class="head">
      <div class="topbar">
        <a class="link-btn" href="${back}" data-action="cancel-edit">Cancel</a>
        <span class="muted small">${mode === 'edit' ? 'Editing' : 'New event'}</span>
      </div>
      <div class="title-row"><h1>${esc(title)}</h1></div>
    </header>`;

  if (!d || !d.band || !isMgmt(d.band)) {
    return head('Not allowed') + `<main id="main"><div class="empty">${mode === 'edit' && !d
      ? 'This event doesn\'t exist anymore.'
      : 'Only MGMT can add or edit events. Ask your band\'s MGMT to make you MGMT if you should plan things too.'}</div></main>`;
  }

  const options = mgmtBands();
  const members = membersOf(d.band);
  const tt = (d.timetable || []).map((t) => `${t.time} ${t.label}`).join('\n');

  const bandField = mode === 'new' && options.length > 1
    ? `<label class="lbl">Band<select name="band">${options.map((b) => `<option value="${esc(b.id)}" ${b.id === d.band ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></label>`
    : `<input type="hidden" name="band" value="${esc(d.band)}"><p class="muted small">Band: <strong style="color:${esc(bandById(d.band).color)}">${esc(bandById(d.band).name)}</strong></p>`;

  const typeField = `<fieldset class="choice"><legend class="lbl-text">Type</legend><div class="choice-row">${TYPES.map((t) =>
    `<label class="choice-opt"><input type="radio" name="type" value="${t}" ${d.type === t ? 'checked' : ''}><span>${icons[t](15)}${esc(TYPE_LABEL[t])}</span></label>`).join('')}</div></fieldset>`;

  const people = `<fieldset class="choice"><legend class="lbl-text">Who's needed</legend>
    <div class="check-list">${members.map((m) => `<label class="check"><input type="checkbox" name="people" value="${esc(m.uid)}" ${d.people.includes(m.uid) ? 'checked' : ''}><span>${esc(m.name || 'Someone')}${m.instrument ? ` <span class="muted">· ${esc(m.instrument)}</span>` : ''}</span></label>`).join('')}</div>
    <p class="muted small">Everyone ticked gets this in their My view, and clashes with their other bands are flagged.</p></fieldset>`;

  const status = `<fieldset class="choice"><legend class="lbl-text">Status</legend><div class="check-list">
    <label class="check"><input type="checkbox" name="status" value="advanced" ${d.status === 'advanced' ? 'checked' : ''}><span>Advanced (all details confirmed with the venue)</span></label>
    ${Object.entries(MISSING_LABEL).map(([k, label]) => `<label class="check"><input type="checkbox" name="missing" value="${k}" ${d.missing.includes(k) ? 'checked' : ''}><span>${esc(label)}</span></label>`).join('')}
  </div></fieldset>`;

  const c = d.venue.contact || {};
  return head(mode === 'edit' ? (d.title || 'Edit event') : 'New event') + `<main id="main">
    ${state.authError ? `<p class="form-error" role="alert">${esc(state.authError)}</p>` : ''}
    <form data-form="event" class="form" novalidate>
      ${bandField}
      ${typeField}
      ${input('Title', 'title', d.title, 'maxlength="80" placeholder="e.g. Club show, Band rehearsal"')}
      <div class="grid-3">
        <label class="lbl">Date<input type="date" name="date" value="${v(d.date)}" required></label>
        <label class="lbl">Start<input type="time" name="time" value="${v(d.time)}"></label>
        <label class="lbl">End<input type="time" name="end" value="${v(d.end)}"></label>
      </div>
      ${input('City / place', 'place', d.place, 'maxlength="80" placeholder="e.g. Graz or Proberaum"')}
      ${people}
      ${group('Timetable', `<label class="lbl">One line per item: time, then what<textarea name="timetable" rows="6" placeholder="14:00 Load-in&#10;16:30 Soundcheck&#10;19:30 Doors&#10;21:15 Our set · 75 min">${esc(tt)}</textarea></label>`, (d.timetable || []).length > 0)}
      ${group('Venue & contact person', `
        ${input('Venue name', 'venue_name', d.venue.name, 'maxlength="80"')}
        ${input('Address', 'venue_address', d.venue.address, 'maxlength="160"')}
        ${input('Load-in / parking', 'venue_loadIn', d.venue.loadIn, 'maxlength="160"')}
        ${input('Tech (PA, backline, monitors)', 'venue_tech', d.venue.tech, 'maxlength="200"')}
        <div class="grid-2">${input('Contact name', 'contact_name', c.name, 'maxlength="60"')}${input('Role', 'contact_role', c.role, 'maxlength="40" placeholder="Promoter"')}</div>
        <label class="lbl">Contact phone<input type="tel" name="contact_phone" value="${v(c.phone)}" maxlength="30" placeholder="+43 …"></label>`)}
      ${group('Travel', `<div class="grid-2">
        ${input('Departure time', 'travel_depart', d.travel.depart, 'maxlength="10" placeholder="13:15"')}
        ${input('From', 'travel_from', d.travel.from, 'maxlength="60"')}
        ${input('Method', 'travel_method', d.travel.method, 'maxlength="40" placeholder="Van, train…"')}
        ${input('Driver', 'travel_driver', d.travel.driver, 'maxlength="60"')}</div>
        ${input('Est. cost', 'travel_cost', d.travel.cost, 'maxlength="30" placeholder="€"')}`)}
      ${group('Hotel', `${input('Hotel name', 'hotel_name', d.hotel.name, 'maxlength="80"')}${input('Address', 'hotel_address', d.hotel.address, 'maxlength="160"')}${input('Check-in', 'hotel_checkIn', d.hotel.checkIn, 'maxlength="20"')}`)}
      ${group('Catering / dinner', `${input('What', 'catering_text', d.catering.text, 'maxlength="160" placeholder="Hot meal for 6, rider drinks"')}${input('Time', 'catering_time', d.catering.time, 'maxlength="20"')}${input('Dietary notes', 'catering_diet', d.catering.diet, 'maxlength="120"')}`)}
      ${group('Guest list', `<div class="grid-2"><label class="lbl">Used<input type="number" min="0" name="guests_used" value="${v(d.guests.used)}"></label><label class="lbl">Total slots<input type="number" min="0" name="guests_total" value="${v(d.guests.total)}"></label></div>`)}
      ${group('Setlist', `<label class="lbl">Songs or a note<textarea name="setlist" rows="5">${esc(d.setlist)}</textarea></label>`)}
      ${group('Notes', `<label class="lbl">Anything else<textarea name="notes" rows="4">${esc(d.notes)}</textarea></label>`, !!d.notes)}
      ${status}
      <button class="btn-primary" type="submit" ${state.busy ? 'disabled' : ''}>${mode === 'edit' ? 'Save changes' : 'Add to schedule'}</button>
      ${mode === 'edit' ? '<button type="button" class="btn-outline danger" data-action="delete-event">Delete event</button>' : ''}
    </form>
  </main>`;
}

// ---- Reading the form back into an event ----
function parseTimetable(text) {
  return String(text || '').split('\n').map((line) => {
    const m = line.match(/^\s*(\d{1,2})[:.](\d{2})\s*[-–·:]?\s*(.*)$/);
    if (!m) return null;
    return { time: `${m[1].padStart(2, '0')}:${m[2]}`, label: m[3].trim() };
  }).filter(Boolean).sort((a, b) => a.time.localeCompare(b.time));
}

export function collectDraft(form) {
  const f = new FormData(form);
  const g = (n) => String(f.get(n) || '').trim();
  const num = (n) => (g(n) === '' ? null : Math.max(0, parseInt(g(n), 10) || 0));
  const d = state.draft || {};
  return {
    ...d,
    band: g('band') || d.band,
    type: g('type') || 'show',
    title: g('title'),
    date: g('date'),
    time: g('time'),
    end: g('end'),
    place: g('place'),
    people: f.getAll('people').map(String),
    status: f.get('status') ? 'advanced' : null,
    missing: f.getAll('missing').map(String),
    timetable: parseTimetable(f.get('timetable')),
    venue: { name: g('venue_name'), address: g('venue_address'), loadIn: g('venue_loadIn'), tech: g('venue_tech'), contact: { name: g('contact_name'), role: g('contact_role'), phone: g('contact_phone') } },
    travel: { depart: g('travel_depart'), from: g('travel_from'), method: g('travel_method'), driver: g('travel_driver'), cost: g('travel_cost') },
    hotel: { name: g('hotel_name'), address: g('hotel_address'), checkIn: g('hotel_checkIn') },
    catering: { text: g('catering_text'), time: g('catering_time'), diet: g('catering_diet') },
    guests: { used: num('guests_used'), total: num('guests_total') },
    setlist: g('setlist'),
    notes: g('notes')
  };
}

// Remove empty values (Firestore doesn't accept "undefined", and empty fields are just noise).
function clean(value) {
  if (Array.isArray(value)) return value.map(clean).filter((x) => x !== undefined);
  if (value && typeof value === 'object') {
    const out = {};
    Object.entries(value).forEach(([k, x]) => {
      const c = clean(x);
      if (c === undefined) return;
      if (c && typeof c === 'object' && !Array.isArray(c) && Object.keys(c).length === 0) return;
      out[k] = c;
    });
    return out;
  }
  if (value === '' || value === null || value === undefined || Number.isNaN(value)) return undefined;
  return value;
}

export function toEventData(d) {
  const data = clean({
    type: d.type, title: d.title || TYPE_LABEL[d.type] || 'Event', date: d.date, time: d.time, end: d.end, place: d.place,
    status: d.status, missing: d.missing, timetable: d.timetable, venue: d.venue, travel: d.travel, hotel: d.hotel,
    catering: d.catering, guests: d.guests, setlist: d.setlist, notes: d.notes
  });
  data.people = d.people || []; // keep even when empty
  return data;
}
