// SCHEDULE — month calendar or list, with band filter chips.
import { state, visibleEvents, clashDates, bandById, defaultMonth, mgmtBands } from '../store.js';
import { topBar, chips, eventRow, empty } from '../components.js';
import { icons } from '../icons.js';
import { esc, todayISO, monthTitle, toISO, fmtDay, isoWeek, mondayOf, addDays, shortMonth, dayNum } from '../utils.js';

function monthGrid(list, clashes) {
  const ym = state.month;
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(y, m, 0).getDate();
  const today = todayISO();

  const byDate = {};
  list.forEach((e) => { (byDate[e.date] = byDate[e.date] || []).push(e); });

  if (!state.selected || state.selected.slice(0, 7) !== ym) {
    state.selected = today.slice(0, 7) === ym ? today : (Object.keys(byDate).filter((d) => d.startsWith(ym)).sort()[0] || `${ym}-01`);
  }

  let cells = '';
  for (let i = 0; i < offset; i++) cells += '<div class="cal-blank"></div>';
  for (let d = 1; d <= days; d++) {
    const iso = toISO(new Date(y, m - 1, d));
    const evs = byDate[iso] || [];
    const sel = state.selected === iso;
    const clash = clashes.has(iso) && evs.length > 0;
    const shown = evs.slice(0, 3).map((e) => `<span class="cal-ev ${e.type === 'rehearsal' || e.type === 'off' ? 'soft' : ''}" style="--c:${esc(bandById(e.band).color)}">${e.time ? `<b>${esc(e.time)}</b> ` : ''}${esc(e.title)}</span>`).join('');
    const more = evs.length > 3 ? `<span class="cal-more">+${evs.length - 3} more</span>` : '';
    const bars = evs.slice(0, 3).map((e) => `<span class="bar ${e.type === 'rehearsal' || e.type === 'off' ? 'soft' : ''}" style="background:${esc(bandById(e.band).color)}"></span>`).join('');
    const label = `${d} ${monthTitle(ym).split(' ')[0]}, ${evs.length ? evs.length + (evs.length === 1 ? ' event' : ' events') : 'nothing planned'}${clash ? ', clash' : ''}`;
    cells += `<button type="button" class="cal-day ${sel ? 'sel' : ''} ${iso === today ? 'is-today' : ''}" data-action="pick-day" data-date="${iso}" aria-pressed="${sel}" aria-label="${esc(label)}">
      <span class="cal-top"><span class="cal-num">${d}</span>${clash ? `<span class="cal-clash">${icons.warn(12)}</span>` : ''}</span>
      <span class="cal-bars">${bars}</span>
      <span class="cal-evs">${shown}${more}</span>
    </button>`;
  }

  const sel = state.selected;
  const agenda = (byDate[sel] || []);
  const clashNote = clashes.has(sel) && agenda.length
    ? `<div class="warning small-warning">${icons.warn(18)}<span>You're booked by two bands on this day. Check who is needed where.</span></div>` : '';

  return `<div class="sched"><div class="cal">
      <div class="cal-head" aria-hidden="true"><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span></div>
      <div class="cal-grid">${cells}</div>
      <div class="legend"><span><i class="lg"></i>Show / travel</span><span><i class="lg soft"></i>Rehearsal / off</span><span>${icons.warn(11)}Clash</span></div>
    </div>
    <section aria-label="Selected day" class="agenda">
      <h2 class="section-h">${esc(fmtDay(sel))}</h2>
      ${clashNote}
      ${agenda.length ? agenda.map((e) => eventRow(e, { showDate: false, clashes })).join('') : empty('Nothing planned for the selected bands.')}
      ${mgmtBands().length ? `<a class="btn-outline desk-only" href="#/new/${esc(sel)}">${icons.plus()} Add event on ${esc(fmtDay(sel))}</a>` : ''}
    </section></div>`;
}

function listView(list, clashes) {
  const today = todayISO();
  const upcoming = list.filter((e) => e.date >= today);
  if (!upcoming.length) return empty('Nothing planned from today on.');
  let html = '';
  let week = null;
  upcoming.forEach((e) => {
    const mon = mondayOf(e.date);
    if (mon !== week) {
      week = mon;
      const sun = addDays(mon, 6);
      const range = shortMonth(mon) === shortMonth(sun)
        ? `${dayNum(mon)}–${dayNum(sun)} ${shortMonth(sun)}`
        : `${dayNum(mon)} ${shortMonth(mon)} – ${dayNum(sun)} ${shortMonth(sun)}`;
      html += `<h2 class="section-h">Week ${isoWeek(e.date)} · ${esc(range)}</h2>`;
    }
    html += eventRow(e, { clashes });
  });
  return html;
}

export function renderSchedule() {
  if (!state.month) state.month = defaultMonth();
  const list = visibleEvents();
  const clashes = clashDates();
  const isMonth = state.scheduleMode === 'month';

  const toggle = `<div class="seg" role="group" aria-label="View">
    <button type="button" data-action="set-mode" data-mode="month" class="${isMonth ? 'on' : ''}" aria-pressed="${isMonth}">Month</button>
    <button type="button" data-action="set-mode" data-mode="list" class="${!isMonth ? 'on' : ''}" aria-pressed="${!isMonth}">List</button>
  </div>`;

  const title = isMonth
    ? `<div class="month-nav">
        <button type="button" class="icon-btn" data-action="month-prev" aria-label="Previous month">${icons.chevronLeft()}</button>
        <h1>${esc(monthTitle(state.month))}</h1>
        <button type="button" class="icon-btn" data-action="month-next" aria-label="Next month">${icons.chevronRight()}</button>
      </div>`
    : '<h1>Upcoming</h1>';

  const mainHtml = isMonth ? monthGrid(list, clashes) : listView(list, clashes);
  const canAdd = mgmtBands().length > 0;
  const addBtn = canAdd
    ? `<a class="add-btn" href="#/new/${esc(isMonth && state.selected ? state.selected : todayISO())}" aria-label="New event">${icons.plus(22)}</a>` : '';
  return `<header class="head head-wide">
      ${topBar(addBtn)}
      <div class="title-row">${title}<span class="desk-spacer"></span><span class="desk-only">${chips()}</span>${toggle}${canAdd ? `<a class="btn-new desk-only" href="#/new/${esc(isMonth && state.selected ? state.selected : todayISO())}">${icons.plus()} New event</a>` : ''}</div>
      <div class="phone-only">${chips()}</div>
    </header>
    <main id="main" class="${isMonth ? 'main-wide' : ''}">${mainHtml}</main>`;
}

export function shiftMonth(delta) {
  const [y, m] = state.month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  state.month = toISO(d).slice(0, 7);
  state.selected = null;
}

export function gotoDate(iso) {
  state.scheduleMode = 'month';
  state.month = iso.slice(0, 7);
  state.selected = iso;
}
