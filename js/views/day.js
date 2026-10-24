// DAY PAGE — everything about one event, in collapsible sections.
import { eventById, bandById, personById, isMgmt } from '../store.js';
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

function addRow(title) {
  return `<button type="button" class="sec-add" data-action="toast" data-msg="Editing comes in step 2, together with logins.">
    <span class="sec-title">${esc(title)}</span><span class="add-hint">${icons.plus()}Add</span></button>`;
}

const field = (label, value) => value ? `<div class="field"><span class="label">${esc(label)}</span><span>${esc(value)}</span></div>` : '';

function phoneLink(phone, label) {
  if (!isDialable(phone)) return '';
  return `<a class="round-btn" href="tel:${esc(phone.replace(/\s/g, ''))}" aria-label="${esc(label)}">${icons.phone(18)}</a>`;
}

export function renderDay(id) {
  const e = eventById(id);
  if (!e) {
    return `<header class="head"><div class="topbar"><a class="icon-btn back" href="#/schedule" aria-label="Back to schedule">${icons.chevronLeft()}</a></div></header>
      <main id="main"><div class="empty">This event doesn't exist (anymore).</div></main>`;
  }
  const b = bandById(e.band);
  let html = '';

  if (e.timetable) {
    html += section('Timetable', `${e.timetable.length} items`, `<div class="tt">${e.timetable.map(([t, l]) =>
      `<span class="tt-time">${esc(t)}</span><span>${esc(l)}</span>`).join('')}</div>`, true);
  } else if (e.time) {
    html += section('Time', `${e.time}${e.end ? '–' + e.end : ''}`, `<div class="tt"><span class="tt-time">${esc(e.time)}</span><span>${esc(TYPE_LABEL[e.type])} starts</span>${e.end ? `<span class="tt-time">${esc(e.end)}</span><span>Ends</span>` : ''}</div>`, true);
  } else if (e.type !== 'off') {
    html += addRow('Timetable');
  }

  const who = e.people.map(personById).filter(Boolean);
  html += section("Who's on", `${who.length} people`, `<div class="pills">${who.map((p) =>
    `<span class="pill">${esc(p.name)} · ${esc(p.instrument)}</span>`).join('')}</div>`);

  if (e.venue) {
    const v = e.venue;
    const c = v.contact;
    const mapUrl = v.address && !/[[\]]/.test(v.address) ? `https://maps.apple.com/?q=${encodeURIComponent(v.name + ' ' + v.address)}` : null;
    html += section('Venue', v.name, `
      ${field('Address', v.address)}${field('Load-in', v.loadIn)}${field('Tech', v.tech)}
      ${c ? `<div class="contact-line"><div class="field grow"><span class="label">Contact person</span><span>${esc(c.name)} · ${esc(c.role)}</span><span class="muted small">${esc(c.phone || '')}</span></div>
        ${phoneLink(c.phone, 'Call venue contact')}
        ${mapUrl ? `<a class="round-btn" href="${esc(mapUrl)}" target="_blank" rel="noopener" aria-label="Navigate to venue">${icons.pin(18)}</a>` : ''}</div>` : ''}`, true);
  } else if (e.type === 'show') {
    html += addRow('Venue');
  }

  if (e.travel) {
    const t = e.travel;
    html += section('Travel', `${t.method}${t.depart ? ' · ' + t.depart : ''}`, `<div class="grid-2 fields">
      ${field('Departure', `${t.depart}${t.from ? ' · ' + t.from : ''}`)}${field('Driver', t.driver)}${field('Method', t.method)}${field('Est. cost', t.cost)}</div>`);
  } else if (e.type === 'show') {
    html += addRow('Travel');
  }

  if (e.hotel) {
    html += section('Hotel', e.hotel.name, `${field('Address', e.hotel.address)}${field('Check-in', e.hotel.checkIn)}`);
  } else if (e.type === 'show' || e.type === 'travel') {
    html += addRow('Hotel');
  }

  if (e.catering) {
    html += section('Catering / dinner', e.catering.time ? `${e.catering.time} at venue` : '', `<p>${esc(e.catering.text)}</p>${e.catering.diet ? `<p class="muted small">Dietary: ${esc(e.catering.diet)}</p>` : ''}`);
  } else if (e.type === 'show') {
    html += addRow('Catering / dinner');
  }

  if (e.guests) {
    const pct = Math.round((e.guests.used / e.guests.total) * 100);
    html += section('Guest list', `${e.guests.used} of ${e.guests.total} slots`, `<div class="meter"><div style="width:${pct}%;background:${esc(b.color)}"></div></div>`);
  } else if (e.type === 'show') {
    html += addRow('Guest list');
  }

  if (e.setlist) html += section('Setlist', e.setlist, `<p class="muted">[Attach setlist PDF or add songs]</p>`);
  else if (e.type === 'show') html += addRow('Setlist');

  html += addRow(e.type === 'show' ? 'Notes & after-show rating' : 'Notes');

  return `<header class="head day-head">
      <div class="topbar">
        <a class="icon-btn back" href="#/schedule" aria-label="Back to schedule">${icons.chevronLeft()}</a>
        <span class="muted small">${isMgmt(e.band) ? 'You can edit this (MGMT)' : 'View only'}</span>
      </div>
      <div class="day-meta">${bandTag(e.band)}<span class="muted">${esc(TYPE_LABEL[e.type])}</span>${badges(e)}</div>
      <h1 class="day-title">${esc(e.title)}</h1>
      <span class="muted">${esc(fmtDayLong(e.date))}${e.place ? ' · ' + esc(e.place) : ''}</span>
    </header>
    <main id="main" style="--band:${esc(b.color)}">${html}</main>`;
}
