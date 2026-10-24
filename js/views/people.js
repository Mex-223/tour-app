// PEOPLE — band members and contacts for the current view.
import { people, contacts, events } from '../data.js';
import { viewBands, bandById, state, me } from '../store.js';
import { topBar, bandTag } from '../components.js';
import { icons } from '../icons.js';
import { esc, isDialable, todayISO, fmtDay } from '../utils.js';

function contactActions(phone, email) {
  let out = '';
  if (isDialable(phone)) out += `<a class="round-btn" href="tel:${esc(phone.replace(/\s/g, ''))}" aria-label="Call">${icons.phone(18)}</a>`;
  if (email && email.includes('@')) out += `<a class="round-btn" href="mailto:${esc(email)}" aria-label="Email">${icons.mail(18)}</a>`;
  return out;
}

export function renderPeople() {
  const bandIds = viewBands().map((b) => b.id);
  const inView = (p) => bandIds.some((id) => p.bands[id]);

  const members = people.filter(inView).map((p) => {
    const roles = bandIds.filter((id) => p.bands[id]).map((id) =>
      `<span class="mini-role" style="--band:${esc(bandById(id).color)}">${esc(bandById(id).name)} · ${p.bands[id] === 'mgmt' ? 'MGMT' : 'Member'}</span>`).join('');
    return `<div class="person">
      <span class="avatar" aria-hidden="true">${esc(p.name.replace(/[[\]]/g, '')[0] || '?')}</span>
      <span class="stack-2 grow"><span class="person-name">${esc(p.name)}${p.id === me.id ? ' (you)' : ''}</span><span class="muted small">${esc(p.instrument)}</span><span class="mini-roles">${roles}</span></span>
    </div>`;
  }).join('');

  const team = contacts.filter((c) => c.bands.some((id) => bandIds.includes(id))).map((c) => `<div class="person">
      <span class="tag-plain">${esc(c.tag)}</span>
      <span class="stack-2 grow"><span class="person-name">${esc(c.name)}</span><span class="muted small">${esc(c.phone)} · ${esc(c.email)}</span>
      <span class="mini-roles">${c.bands.filter((id) => bandIds.includes(id)).map((id) => bandTag(id)).join('')}</span></span>
      ${contactActions(c.phone, c.email)}
    </div>`).join('');

  const today = todayISO();
  const venues = events.filter((e) => bandIds.includes(e.band) && e.venue && e.venue.contact && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => `<a class="person" href="#/day/${esc(e.id)}">
      <span class="stack-2 grow"><span class="person-name">${esc(e.venue.contact.name)} · ${esc(e.venue.contact.role)}</span>
      <span class="muted small">${esc(e.venue.name)}, ${esc(e.place)} · ${esc(fmtDay(e.date))}</span></span>
      ${bandTag(e.band)}
    </a>`).join('');

  return `<header class="head">
      ${topBar()}
      <div class="title-row"><h1>People</h1></div>
    </header>
    <main id="main">
      <h2 class="section-h">Team contacts</h2>${team || '<div class="empty">No contacts yet.</div>'}
      <h2 class="section-h">Venue contacts · upcoming</h2>${venues || '<div class="empty">No venue contacts for upcoming shows.</div>'}
      <h2 class="section-h">${state.view === 'me' || state.view === 'all' ? 'Band members' : 'Members'}</h2>${members}
      <p class="app-version muted small" id="app-version"></p>
    </main>`;
}
