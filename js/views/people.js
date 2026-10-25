// PEOPLE — band members and venue contacts for the current view.
import { viewBands, bandById, state, me, events, membersOf, roleName, contactsOf, mgmtBands, isMgmt } from '../store.js';
import { topBar, bandTag } from '../components.js';
import { icons } from '../icons.js';
import { esc, isDialable, todayISO, fmtDay } from '../utils.js';

export function renderPeople() {
  const vb = viewBands();
  const bandIds = vb.map((b) => b.id);

  // Members, merged across bands (one row per person, with a role per band)
  const people = {};
  vb.forEach((b) => membersOf(b.id).forEach((m) => {
    const p = people[m.uid] || (people[m.uid] = { uid: m.uid, name: m.name, instrument: m.instrument, phone: m.phone, roles: [] });
    p.roles.push({ band: b.id, role: m.role });
  }));
  const members = Object.values(people).sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((p) => {
    const roles = p.roles.map((r) =>
      `<span class="mini-role" style="--band:${esc(bandById(r.band).color)}">${esc(bandById(r.band).name)} · ${roleName(r.band, p.uid, r.role)}</span>`).join('');
    return `<div class="person">
      <span class="avatar" aria-hidden="true">${esc((p.name || '?')[0].toUpperCase())}</span>
      <span class="stack-2 grow"><span class="person-name">${esc(p.name || 'Someone')}${p.uid === me.id ? ' (you)' : ''}</span><span class="muted small">${esc([p.instrument, p.phone].filter(Boolean).join(' · '))}</span><span class="mini-roles">${roles}</span></span>
      ${p.uid !== me.id && isDialable(p.phone) ? `<a class="round-btn" href="tel:${esc(p.phone.replace(/[^\d+]/g, ''))}" aria-label="Call ${esc(p.name || '')}">${icons.phone(18)}</a>` : ''}
    </div>`;
  }).join('');

  // Team contacts (MGMT, booking, crew…), shared by the band
  const editable = mgmtBands().filter((b) => bandIds.includes(b.id));
  const team = vb.flatMap((b) => contactsOf(b.id)).map((c) => {
    const call = isDialable(c.phone) ? `<a class="round-btn" href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}" aria-label="Call ${esc(c.name || '')}">${icons.phone(18)}</a>` : '';
    const mail = c.email && c.email.includes('@') ? `<a class="round-btn" href="mailto:${esc(c.email)}" aria-label="Email ${esc(c.name || '')}">${icons.mail(18)}</a>` : '';
    const name = isMgmt(c.band) ? `<a class="person-name" href="#/contact/${esc(c.band)}/${esc(c.id)}">${esc(c.name || 'Contact')}</a>` : `<span class="person-name">${esc(c.name || 'Contact')}</span>`;
    return `<div class="person">
      <span class="tag-plain ${c.role === 'Emergency' ? 'danger-tag' : ''}">${esc(c.role || 'Contact')}</span>
      <span class="stack-2 grow">${name}<span class="muted small">${esc([c.phone, c.email, c.note].filter(Boolean).join(' · '))}</span>${vb.length > 1 ? `<span class="mini-roles">${bandTag(c.band)}</span>` : ''}</span>
      ${call}${mail}
    </div>`;
  }).join('');
  const teamHtml = `<h2 class="section-h">Team contacts</h2>
    ${team || `<div class="empty">${editable.length ? 'Add your tour manager, booking agency, FOH, driver or an emergency number.' : 'MGMT can add team contacts here (booking, tour manager, crew…).'}</div>`}
    ${editable.length ? `<a class="btn-outline" href="#/contact/${esc(editable[0].id)}/new">${icons.plus()} Add team contact</a>` : ''}`;

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
      ${teamHtml}
      <h2 class="section-h">${state.view === 'me' || state.view === 'all' ? 'Band members' : 'Members'}</h2>${members || '<div class="empty">No members yet.</div>'}
      <a class="btn-outline" href="#/me">Invite people</a>
      <h2 class="section-h">Venue contacts · upcoming</h2>${venues || '<div class="empty">Venue contacts you add to upcoming shows appear here.</div>'}
      <p class="app-version muted small" id="app-version"></p>
    </main>`;
}
