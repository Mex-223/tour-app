// Shared building blocks: top bar, band switcher, bottom nav, event rows.
import { TYPE_LABEL, MISSING_LABEL } from './data.js';
import { state, viewLabel, roleLabel, me, bands, bandById, clashDates, chipsActive, roleName, awayConflicts } from './store.js';
import { icons } from './icons.js';
import { esc, weekday, dayNum } from './utils.js';

export function switcherButton() {
  let dots;
  if (state.view === 'me' || state.view === 'all') {
    dots = bands.map((b) => `<span class="dot" style="background:${esc(b.color)}"></span>`).join('');
  } else {
    dots = `<span class="dot" style="background:${esc(bandById(state.view).color)}"></span>`;
  }
  return `<button type="button" class="switcher" data-action="open-sheet" aria-haspopup="dialog" aria-label="Switch band or view, current: ${esc(viewLabel())}">
    <span class="dots" aria-hidden="true">${dots}</span>
    <span class="switcher-label">${esc(viewLabel())}</span>${icons.chevronDown()}
  </button>`;
}

export function topBar(rightExtra = '') {
  return `<div class="topbar topbar-main">
    ${switcherButton()}
    <div class="topbar-right">
      <span class="muted small">${esc(roleLabel())}</span>${rightExtra}
      <a class="avatar" href="#/me" aria-label="My profile and bands">${esc((me.name || '?')[0].toUpperCase())}</a>
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

// Laptop / desktop: sidebar with views, sections and profile (hidden on phones via CSS).
export function sidebar(active) {
  const myBands = bands;
  const multi = myBands.length === 0 ? 'background:#3A3F46' : `background:conic-gradient(${myBands.map((b, i) => `${b.color} ${(i / myBands.length) * 360}deg ${((i + 1) / myBands.length) * 360}deg`).join(',')})`;
  const view = (value, label, dot, role = '') => {
    const on = state.view === value;
    return `<button type="button" class="side-item ${on ? 'on' : ''}" data-action="set-view" data-view="${esc(value)}" aria-pressed="${on}">
      <span class="side-dot" style="${dot}" aria-hidden="true"></span><span class="grow">${esc(label)}</span>${role ? `<span class="side-role">${esc(role)}</span>` : ''}</button>`;
  };
  const tabs = [['today', 'Today'], ['schedule', 'Schedule'], ['people', 'People'], ['money', 'Money'], ['docs', 'Docs']];
  return `<aside class="sidebar" aria-label="Sidebar">
    <a class="side-logo" href="#/today"><span class="logo small-logo" aria-hidden="true"><i style="background:${esc((myBands[0] || {}).color || '#F5A524')};width:80%"></i><i style="background:${esc((myBands[1] || {}).color || '#5B8CFF')};width:60%"></i><i style="background:${esc((myBands[2] || {}).color || '#E46AA8')};width:70%"></i></span>Tour</a>
    <nav class="side-group" aria-label="View">
      <span class="side-h">View</span>
      ${view('me', 'My view', multi)}
      ${view('all', 'All bands', 'background:#3A3F46')}
      ${myBands.map((b) => view(b.id, b.name, `background:${b.color}`, me.bands[b.id] === 'mgmt' ? roleName(b.id, me.id, 'mgmt') : '')).join('')}
    </nav>
    <nav class="side-group" aria-label="Main">
      <span class="side-h">App</span>
      ${tabs.map(([id, label]) => `<a href="#/${id}" class="side-item ${active === id ? 'on' : ''}" ${active === id ? 'aria-current="page"' : ''}>${icons[id](18)}<span>${label}</span></a>`).join('')}
    </nav>
    <a class="side-profile ${active === 'me' ? 'on' : ''}" href="#/me">
      <span class="avatar" aria-hidden="true">${esc((me.name || '?')[0].toUpperCase())}</span>
      <span class="stack-2"><span class="person-name">${esc(me.name)}</span><span class="muted small">${esc(me.instrument || 'Profile')} · bands &amp; invites</span></span>
    </a>
  </aside>`;
}

// "Navigate with…" chooser
export function navSheet(apps) {
  if (!state.navQuery) return '';
  return `<div class="sheet-backdrop nav-backdrop" data-action="nav-close"></div>
  <div class="sheet nav-sheet" role="dialog" aria-modal="true" aria-label="Navigate with">
    <div class="sheet-handle" aria-hidden="true"></div>
    <div class="sheet-sep">Navigate with</div>
    <p class="muted small nav-q">${esc(state.navQuery)}</p>
    ${apps.map((a) => `<button type="button" class="sheet-opt" data-action="nav-go" data-app="${esc(a.id)}">
      <span class="nav-app-ico" aria-hidden="true">${icons.pin(18)}</span><span class="sheet-text"><span class="sheet-title">${esc(a.name)}</span></span></button>`).join('')}
    <label class="check nav-remember"><input type="checkbox" id="nav-remember"><span>Remember on this device (change it in your profile)</span></label>
  </div>`;
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
  const myBands = bands;
  const multi = myBands.length === 0 ? 'background:#3A3F46' : `background:conic-gradient(${myBands.map((b, i) => `${b.color} ${(i / myBands.length) * 360}deg ${((i + 1) / myBands.length) * 360}deg`).join(',')})`;
  return `<div class="sheet-backdrop" data-action="close-sheet"></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-label="Choose band or view">
    <div class="sheet-handle" aria-hidden="true"></div>
    ${opt('me', 'My view', 'Everything I am part of, across all bands', multi)}
    ${opt('all', 'All bands', 'Everything my bands have planned', 'background:#3A3F46')}
    <div class="sheet-sep">Bands</div>
    ${myBands.map((b) => opt(b.id, b.name, roleName(b.id, me.id, me.bands[b.id]), `background:${b.color}`)).join('')}
    <a class="sheet-link" href="#/me">Manage bands, invites &amp; profile</a>
  </div>`;
}

export function bandTag(bandId) {
  const b = bandById(bandId);
  return `<span class="tag" style="background:${esc(b.color)};color:${esc(b.ink)}">${esc(b.name)}</span>`;
}

export function chips() {
  if (!chipsActive()) return '';
  if (bands.length < 2) return '';
  return `<div class="chips" role="group" aria-label="Show bands">${bands.map((b) => {
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
  if (e.suggested) out.push(`<span class="badge blue">${icons.plus(13)}Suggested by ${esc(e.suggestedByName || 'a member')}</span>`);
  const away = awayConflicts(e);
  if (away.length) out.push(`<span class="badge amber">${icons.info(13)}${esc(away.map((a) => a.uid === me.id ? 'You' : a.name).join(', '))} not available</span>`);
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
  return `<a class="row ${e.type === 'off' ? 'row-off' : ''} ${e.suggested ? 'row-suggested' : ''}" href="#/day/${esc(e.id)}" style="--band:${esc(b.color)}">
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
