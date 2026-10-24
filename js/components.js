// Shared building blocks: top bar, band switcher, bottom nav, event rows.
import { bands } from './data.js';
import { TYPE_LABEL, MISSING_LABEL } from './data.js';
import { state, viewLabel, roleLabel, me, bandById, clashDates, chipsActive } from './store.js';
import { icons } from './icons.js';
import { esc, weekday, dayNum } from './utils.js';

export function switcherButton() {
  let dots;
  if (state.view === 'me' || state.view === 'all') {
    dots = bands.filter((b) => me.bands[b.id]).map((b) => `<span class="dot" style="background:${esc(b.color)}"></span>`).join('');
  } else {
    dots = `<span class="dot" style="background:${esc(bandById(state.view).color)}"></span>`;
  }
  return `<button type="button" class="switcher" data-action="open-sheet" aria-haspopup="dialog" aria-label="Switch band or view, current: ${esc(viewLabel())}">
    <span class="dots" aria-hidden="true">${dots}</span>
    <span class="switcher-label">${esc(viewLabel())}</span>${icons.chevronDown()}
  </button>`;
}

export function topBar(rightExtra = '') {
  return `<div class="topbar">
    ${switcherButton()}
    <div class="topbar-right">
      <span class="muted small">${esc(roleLabel())}</span>${rightExtra}
      <span class="avatar" aria-hidden="true">${esc(me.name[0])}</span>
    </div>
  </div>`;
}

export function bottomNav(active) {
  const tabs = [
    ['today', 'Today'], ['schedule', 'Schedule'], ['people', 'People'], ['money', 'Money'], ['docs', 'Docs']
  ];
  return `<nav class="bottomnav" aria-label="Main">${tabs.map(([id, label]) =>
    `<a href="#/${id}" class="${active === id ? 'active' : ''}" ${active === id ? 'aria-current="page"' : ''}>${icons[id]()}<span>${label}</span></a>`
  ).join('')}</nav>`;
}

export function sheet() {
  if (!state.sheetOpen) return '';
  const opt = (value, label, sub, dot) => {
    const on = state.view === value;
    return `<button type="button" class="sheet-opt ${on ? 'on' : ''}" data-action="set-view" data-view="${esc(value)}" aria-pressed="${on}">
      <span class="sheet-dot" style="${dot}" aria-hidden="true"></span>
      <span class="sheet-text"><span class="sheet-title">${esc(label)}</span><span class="muted small">${esc(sub)}</span></span>
      ${on ? icons.check(18) : ''}
    </button>`;
  };
  const myBands = bands.filter((b) => me.bands[b.id]);
  const multi = `background:conic-gradient(${myBands.map((b, i) => `${b.color} ${(i / myBands.length) * 360}deg ${((i + 1) / myBands.length) * 360}deg`).join(',')})`;
  return `<div class="sheet-backdrop" data-action="close-sheet"></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-label="Choose band or view">
    <div class="sheet-handle" aria-hidden="true"></div>
    ${opt('me', 'My view', 'Everything I am part of, across all bands', multi)}
    ${opt('all', 'All bands', 'Everything my bands have planned', 'background:#3A3F46')}
    <div class="sheet-sep">Bands</div>
    ${myBands.map((b) => opt(b.id, b.name, `${b.full !== b.name ? b.full + ' · ' : ''}${me.bands[b.id] === 'mgmt' ? 'MGMT' : 'Member'}`, `background:${b.color}`)).join('')}
  </div>`;
}

export function bandTag(bandId) {
  const b = bandById(bandId);
  return `<span class="tag" style="background:${esc(b.color)};color:${esc(b.ink)}">${esc(b.name)}</span>`;
}

export function chips() {
  if (!chipsActive()) return '';
  return `<div class="chips" role="group" aria-label="Show bands">${bands.filter((b) => me.bands[b.id]).map((b) => {
    const on = !state.hidden[b.id];
    return `<button type="button" class="chip ${on ? 'on' : ''}" data-action="toggle-band" data-band="${esc(b.id)}" aria-pressed="${on}">
      <span class="dot" style="background:${esc(b.color)}" aria-hidden="true"></span>${esc(b.name)}</button>`;
  }).join('')}</div>`;
}

export function subline(e, withTime = true) {
  const parts = [TYPE_LABEL[e.type], e.place];
  if (e.time && withTime) parts.push(e.time);
  return parts.filter(Boolean).join(' · ');
}

export function badges(e, clashes = clashDates()) {
  const out = [];
  if (clashes.has(e.date) && e.type !== 'off' && e.people.includes(me.id)) out.push(`<span class="badge red">${icons.warn(13)}Clash</span>`);
  (e.missing || []).forEach((m) => out.push(`<span class="badge amber">${icons.info(13)}${esc(MISSING_LABEL[m] || m)}</span>`));
  if (e.status === 'advanced') out.push(`<span class="badge green">${icons.check(13)}Advanced</span>`);
  return out.length ? `<span class="badges">${out.join('')}</span>` : '';
}

export function eventRow(e, { showDate = true, clashes } = {}) {
  const b = bandById(e.band);
  const date = showDate
    ? `<span class="row-date"><span class="wd">${esc(weekday(e.date).toUpperCase())}</span><span class="dn">${dayNum(e.date)}</span></span>`
    : `<span class="row-time">${esc(e.time || '—')}</span>`;
  return `<a class="row ${e.type === 'off' ? 'row-off' : ''}" href="#/day/${esc(e.id)}" style="--band:${esc(b.color)}">
    ${date}
    <span class="row-main">
      <span class="row-title"><span class="type-ico" aria-hidden="true">${icons[e.type](14)}</span>${esc(e.title)}</span>
      <span class="row-sub">${esc(subline(e, showDate))}</span>
      ${badges(e, clashes)}
    </span>
    ${bandTag(e.band)}
  </a>`;
}

export function empty(text) {
  return `<div class="empty">${esc(text)}</div>`;
}
