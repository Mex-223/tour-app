// DAY PAGE — everything about one event, in collapsible sections.
import { eventById, bandById, personById, isMgmt, awayConflicts, me } from '../store.js';
import { bandTag, badges } from '../components.js';
import { icons } from '../icons.js';
import { esc, fmtDayLong, isDialable } from '../utils.js';
import { TYPE_LABEL } from '../data.js';

function section(title, summary, content, open = false) {
  return `<details class="sec" ${open ? 'open' : ''}>
    <summary><span class="sec-title">${esc(title)}</span><span class="muted small">${esc(summary || '')}</span>${icons.chevronDown(18)}</summary>
    <div class="sec-body">${content}</div>
  </details>`;
}

function addRow(title, e, canEdit) {
  const action = canEdit
    ? `href="#/edit/${esc(e.id)}"`
    : 'data-action="toast" data-msg="Only MGMT of this band can edit this."';
  return `<a class="sec-add" ${action} role="button">
    <span class="sec-title">${esc(title)}</span><span class="add-hint">${icons.plus()}Add</span></a>`;
}

const field = (label, value) => value ? `<div class="field"><span class="label">${esc(label)}</span><span>${esc(value)}</span></div>` : '';
const hasAny = (obj) => obj && Object.values(obj).some((v) => (v && typeof v === 'object') ? hasAny(v) : !!v);

function phoneLink(phone, label) {
  if (!isDialable(phone)) return '';
  return `<a class="round-btn" href="tel:${esc(phone.replace(/\s/g, ''))}" aria-label="${esc(label)}">${icons.phone(18)}</a>`;
}

export function renderDay(id) {
  const e = eventById(id);
  if (!e) {
    return `<header class="head"><div class="topbar"><a class="icon-btn back" href="#/schedule" aria-label="Back to schedule">${icons.chevronLeft()}</a></div></header>
      <main id="main"><div class="empty">This event doesn't exist (anymore), or you're not in this band.</div></main>`;
  }
  const b = bandById(e.band);
  const canEdit = isMgmt(e.band);
  let html = '';

  if (e.suggested) {
    const mine = e.suggestedBy === me.id;
    html += `<section class="suggest-box">
      <span><strong>Suggested by ${esc(mine ? 'you' : e.suggestedByName || 'a member')}.</strong> ${canEdit ? 'Accept it to put it on the schedule, or decline.' : 'MGMT will accept or decline it.'}</span>
      <div class="btn-row">
        ${canEdit ? `<button type="button" class="btn-primary" data-action="accept-suggestion" data-band="${esc(e.band)}" data-id="${esc(e.id)}">Accept</button>
          <button type="button" class="btn-outline danger" data-action="decline-suggestion" data-band="${esc(e.band)}" data-id="${esc(e.id)}">Decline</button>` : ''}
        ${!canEdit && mine ? `<button type="button" class="btn-outline danger" data-action="decline-suggestion" data-band="${esc(e.band)}" data-id="${esc(e.id)}" data-withdraw="1">Withdraw</button>` : ''}
      </div>
    </section>`;
  }
  const away = awayConflicts(e);
  if (away.length) {
    html += `<div class="away-note">${icons.off(16)}<span><strong>Not available that day:</strong> ${away.map((a) => esc(a.uid === me.id ? 'You' : a.name) + (a.note ? ` <span class="muted">(${esc(a.note)})</span>` : '')).join(', ')}</span></div>`;
  }

  if (e.timetable && e.timetable.length) {
    html += section('Timetable', `${e.timetable.length} items`, `<div class="tt">${e.timetable.map((t) =>
      `<span class="tt-time">${esc(t.time)}</span><span>${esc(t.label)}</span>`).join('')}</div>`, true);
  } else if (e.time) {
    html += section('Time', `${e.time}${e.end ? '–' + e.end : ''}`, `<div class="tt"><span class="tt-time">${esc(e.time)}</span><span>${esc(TYPE_LABEL[e.type] || 'Event')} starts</span>${e.end ? `<span class="tt-time">${esc(e.end)}</span><span>Ends</span>` : ''}</div>`, true);
  } else if (e.type !== 'off') {
    html += addRow('Timetable', e, canEdit);
  }

  const who = e.people.map(personById).filter(Boolean);
  html += section("Who's on", who.length === 1 ? '1 person' : `${who.length} people`, who.length
    ? `<div class="pills">${who.map((p) => `<span class="pill">${esc(p.name)}${p.instrument ? ' · ' + esc(p.instrument) : ''}</span>`).join('')}</div>`
    : '<p class="muted">Nobody selected yet.</p>');

  if (hasAny(e.venue)) {
    const v = e.venue;
    const c = v.contact || {};
    const addr = [v.name, v.address].filter(Boolean).join(' ');
    const mapUrl = v.address && !/[[\]]/.test(v.address) ? `https://maps.apple.com/?q=${encodeURIComponent(addr)}` : null;
    html += section('Venue', v.name || '', `
      ${field('Address', v.address)}${field('Load-in', v.loadIn)}${field('Tech', v.tech)}
      ${(c.name || c.phone) ? `<div class="contact-line"><div class="field grow"><span class="label">Contact person</span><span>${esc(c.name || '')}${c.role ? ' · ' + esc(c.role) : ''}</span><span class="muted small">${esc(c.phone || '')}</span></div>
        ${phoneLink(c.phone, 'Call venue contact')}</div>` : ''}
      ${mapUrl ? `<a class="btn-outline" href="${esc(mapUrl)}" target="_blank" rel="noopener">${icons.pin(18)}&nbsp;Navigate</a>` : ''}`, true);
  } else if (e.type === 'show') {
    html += addRow('Venue', e, canEdit);
  }

  if (hasAny(e.travel)) {
    const t = e.travel;
    html += section('Travel', [t.method, t.depart].filter(Boolean).join(' · '), `<div class="grid-2 fields">
      ${field('Departure', [t.depart, t.from].filter(Boolean).join(' · '))}${field('Driver', t.driver)}${field('Method', t.method)}${field('Est. cost', t.cost)}</div>`);
  } else if (e.type === 'show' || e.type === 'travel') {
    html += addRow('Travel', e, canEdit);
  }

  if (hasAny(e.hotel)) {
    html += section('Hotel', e.hotel.name || '', `${field('Address', e.hotel.address)}${field('Check-in', e.hotel.checkIn)}`);
  } else if (e.type === 'show' || e.type === 'travel') {
    html += addRow('Hotel', e, canEdit);
  }

  if (hasAny(e.catering)) {
    html += section('Catering / dinner', e.catering.time ? `${e.catering.time}` : '', `${e.catering.text ? `<p>${esc(e.catering.text)}</p>` : ''}${e.catering.diet ? `<p class="muted small">Dietary: ${esc(e.catering.diet)}</p>` : ''}`);
  } else if (e.type === 'show') {
    html += addRow('Catering / dinner', e, canEdit);
  }

  if (e.guests && e.guests.total) {
    const used = e.guests.used || 0;
    const pct = Math.min(100, Math.round((used / e.guests.total) * 100));
    html += section('Guest list', `${used} of ${e.guests.total} slots`, `<div class="meter"><div style="width:${pct}%;background:${esc(b.color)}"></div></div>`);
  } else if (e.type === 'show') {
    html += addRow('Guest list', e, canEdit);
  }

  if (e.setlist) html += section('Setlist', '', `<p style="white-space:pre-line">${esc(e.setlist)}</p>`);
  else if (e.type === 'show') html += addRow('Setlist', e, canEdit);

  if (e.notes) html += section('Notes', '', `<p style="white-space:pre-line">${esc(e.notes)}</p>`, true);
  else html += addRow('Notes', e, canEdit);

  const right = canEdit
    ? `<a class="btn-small" href="#/edit/${esc(e.id)}">Edit</a>`
    : '<span class="muted small">View only</span>';

  return `<header class="head day-head">
      <div class="topbar">
        <a class="icon-btn back" href="#/schedule" aria-label="Back to schedule">${icons.chevronLeft()}</a>
        ${right}
      </div>
      <div class="day-meta">${bandTag(e.band)}<span class="muted">${esc(TYPE_LABEL[e.type] || 'Event')}</span>${badges(e)}</div>
      <h1 class="day-title">${esc(e.title || TYPE_LABEL[e.type] || 'Event')}</h1>
      <span class="muted">${esc(fmtDayLong(e.date))}${e.place ? ' · ' + esc(e.place) : ''}</span>
    </header>
    <main id="main" style="--band:${esc(b.color)}">${html}</main>`;
}
