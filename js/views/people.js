// PEOPLE — band members and venue contacts for the current view.
import { viewBands, bandById, state, me, events, membersOf, roleName } from '../store.js';
import { topBar, bandTag } from '../components.js';
import { icons } from '../icons.js';
import { esc, isDialable, todayISO, fmtDay } from '../utils.js';

export function renderPeople() {
  const vb = viewBands();
  const bandIds = vb.map((b) => b.id);

  // Members, merged across bands (one row per person, with a role per band)
  const people = {};
  vb.forEach((b) => membersOf(b.id).forEach((m) => {
    const p = people[m.uid] || (people[m.uid] = { uid: m.uid, name: m.name, instrument: m.instrument, roles: [] });
    p.roles.push({ band: b.id, role: m.role });
  }));
  const members = Object.values(people).sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((p) => {
    const roles = p.roles.map((r) =>
      `<span class="mini-role" style="--band:${esc(bandById(r.band).color)}">${esc(bandById(r.band).name)} · ${roleName(r.band, p.uid, r.role)}</span>`).join('');
    return `<div class="person">
      <span class="avatar" aria-hidden="true">${esc((p.name || '?')[0].toUpperCase())}</span>
      <span class="stack-2 grow"><span class="person-name">${esc(p.name || 'Someone')}${p.uid === me.id ? ' (you)' : ''}</span>${p.instrument ? `<span class="muted small">${esc(p.instrument)}</span>` : ''}<span class="mini-roles">${roles}</span></span>
    </div>`;
  }).join('');

  const today = todayISO();
  const venues = events.filter((e) => bandIds.includes(e.band) && e.venue && e.venue.contact && (e.venue.contact.name || e.venue.contact.phone) && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => {
      const c = e.venue.contact;
      const call = isDialable(c.phone) ? `<a class="round-btn" href="tel:${esc(c.phone.replace(/\s/g, ''))}" aria-label="Call ${esc(c.name || 'contact')}">${icons.phone(18)}</a>` : '';
      return `<div class="person">
        <a class="stack-2 grow" href="#/day/${esc(e.id)}"><span class="person-name">${esc(c.name || 'Contact')}${c.role ? ' · ' + esc(c.role) : ''}</span>
        <span class="muted small">${esc([e.venue.name, e.place].filter(Boolean).join(', '))} · ${esc(fmtDay(e.date))}</span></a>
        ${bandTag(e.band)}${call}
      </div>`;
    }).join('');

  return `<header class="head">
      ${topBar()}
      <div class="title-row"><h1>People</h1></div>
    </header>
    <main id="main">
      <h2 class="section-h">${state.view === 'me' || state.view === 'all' ? 'Band members' : 'Members'}</h2>${members || '<div class="empty">No members yet.</div>'}
      <a class="btn-outline" href="#/me">Invite people</a>
      <h2 class="section-h">Venue contacts · upcoming</h2>${venues || '<div class="empty">Venue contacts you add to upcoming shows appear here.</div>'}
      <section class="card later">
        <span class="later-step">${icons.lock(16)}Coming in step 3</span>
        <ul><li>Team contacts: MGMT, booking, crew, emergency</li><li>Guest PDF export with contacts</li></ul>
      </section>
      <p class="app-version muted small" id="app-version"></p>
    </main>`;
}
