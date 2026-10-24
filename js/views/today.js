// TODAY — what matters right now, for me.
import { baseEvents, clashDates, clashDescription, bandById, mgmtBands } from '../store.js';
import { topBar, eventRow, bandTag, subline } from '../components.js';
import { icons } from '../icons.js';
import { esc, todayISO, fmtDay, daysBetween, minutesOf, nowMinutes, fmtDuration, isDialable } from '../utils.js';
import { TYPE_LABEL } from '../data.js';

function whenLabel(today, date) {
  const n = daysBetween(today, date);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  return `In ${n} days · ${fmtDay(date)}`;
}

function clashWhen(today, date) {
  const n = daysBetween(today, date);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  return 'on ' + fmtDay(date);
}

function heroToday(e) {
  const b = bandById(e.band);
  const now = nowMinutes();
  let nextLabel = '';
  let countdown = '';
  if (e.timetable && e.timetable.length) {
    const next = e.timetable.find((t) => minutesOf(t.time) !== null && minutesOf(t.time) >= now);
    if (next) {
      nextLabel = `${next.label} · ${next.time}`;
      const diff = minutesOf(next.time) - now;
      countdown = diff <= 0 ? 'Now' : fmtDuration(diff);
    } else {
      nextLabel = 'All done for today';
    }
  } else if (e.time) {
    nextLabel = `${TYPE_LABEL[e.type]} · ${e.time}`;
    const diff = minutesOf(e.time) - now;
    countdown = diff > 0 ? fmtDuration(diff) : '';
  }
  return `<section class="hero" style="--band:${esc(b.color)}" aria-label="Next up">
    <div class="hero-top">${bandTag(e.band)}<span class="muted">${esc(TYPE_LABEL[e.type])} · ${esc(e.place || '')}</span></div>
    <a class="hero-title" href="#/day/${esc(e.id)}">${esc(e.title)}</a>
    ${nextLabel ? `<div class="hero-bottom">
      <div class="stack-2"><span class="label">Next call</span><span class="hero-next">${esc(nextLabel)}</span></div>
      ${countdown ? `<span class="countdown">${esc(countdown)}</span>` : ''}
    </div>` : ''}
  </section>`;
}

function heroLater(e, today) {
  const b = bandById(e.band);
  return `<a class="hero" href="#/day/${esc(e.id)}" style="--band:${esc(b.color)}" aria-label="Next up">
    <div class="hero-top">${bandTag(e.band)}<span class="muted">${esc(subline(e))}</span></div>
    <span class="hero-title">${esc(e.title)}</span>
    <div class="hero-bottom">
      <div class="stack-2"><span class="label">Next up</span><span class="hero-next">${esc(whenLabel(today, e.date))}</span></div>
    </div>
  </a>`;
}

function timeline(e) {
  if (!e.timetable || !e.timetable.length) return '';
  const now = nowMinutes();
  const nextIdx = e.timetable.findIndex((x) => minutesOf(x.time) !== null && minutesOf(x.time) >= now);
  return `<section class="card timeline" aria-label="Today's timeline">${e.timetable.map(({ time: t, label }, i) => {
    const done = nextIdx === -1 ? true : i < nextIdx;
    const isNext = i === nextIdx;
    return `<div class="tl-row ${done ? 'done' : ''} ${isNext ? 'next' : ''}">
      <span class="tl-time">${esc(t)}</span><span class="tl-label">${esc(label)}</span>
      ${done ? `<span class="tl-ico" role="img" aria-label="Done">${icons.check(16)}</span>` : ''}
      ${isNext ? '<span class="pill-next">NEXT</span>' : ''}
    </div>`;
  }).join('')}</section>`;
}

function quickLinks(e) {
  const v = e.venue;
  if (!v) return '';
  const addr = v.address && !/[[\]]/.test(v.address)
    ? `https://maps.apple.com/?q=${encodeURIComponent(v.name + ' ' + v.address)}` : null;
  const c = v.contact;
  const tiles = [];
  tiles.push(`<a class="tile" href="${addr ? esc(addr) : '#/day/' + esc(e.id)}" ${addr ? 'target="_blank" rel="noopener"' : ''}>
    ${icons.pin()}<span class="muted small">Venue · navigate</span><span class="tile-main">${esc(v.name)}</span></a>`);
  if (c) {
    const tel = isDialable(c.phone) ? `tel:${c.phone.replace(/\s/g, '')}` : `#/day/${e.id}`;
    tiles.push(`<a class="tile" href="${esc(tel)}">${icons.phone()}<span class="muted small">${esc(c.role)} · call</span><span class="tile-main">${esc(c.name)}</span></a>`);
  }
  return `<div class="grid-2">${tiles.join('')}</div>`;
}

export function renderToday() {
  const today = todayISO();
  const list = baseEvents();
  const clashes = clashDates();
  const todays = list.filter((e) => e.date === today);
  const upcoming = list.filter((e) => e.date > today);

  let body = '';
  let heroId = null;

  // Clash warning for the next two weeks
  const nextClash = [...clashes].sort().find((d) => d >= today && daysBetween(today, d) <= 14);
  const clashHtml = nextClash ? `<a class="warning" href="#/schedule" data-action="goto-date" data-date="${esc(nextClash)}">
      ${icons.warn(22)}<span class="stack-2"><span class="warning-title">Clash ${esc(clashWhen(today, nextClash))}</span>
      <span class="warning-text">${esc(clashDescription(nextClash))}.</span></span></a>` : '';

  if (todays.length) {
    const main = todays.find((e) => e.type === 'show') || todays[0];
    heroId = main.id;
    body += heroToday(main) + clashHtml + timeline(main) + quickLinks(main);
    body += `<a class="btn-outline" href="#/day/${esc(main.id)}">Open full day page</a>`;
    const others = todays.filter((e) => e.id !== main.id);
    if (others.length) body += `<h2 class="section-h">Also today</h2>` + others.map((e) => eventRow(e, { showDate: false, clashes })).join('');
  } else {
    body += `<div class="quiet">${icons.off(18)}<span>Nothing planned today.</span></div>`;
    if (upcoming.length) {
      heroId = upcoming[0].id;
      body += heroLater(upcoming[0], today);
    }
    body += clashHtml;
  }

  const coming = upcoming.filter((e) => e.id !== heroId).slice(0, 5);
  if (coming.length) {
    body += `<h2 class="section-h">Coming up</h2>` + coming.map((e) => eventRow(e, { clashes })).join('');
    body += `<a class="btn-outline" href="#/schedule">See full schedule</a>`;
  }
  if (!todays.length && !upcoming.length) {
    body += `<div class="empty">Nothing planned yet.</div>`;
    if (mgmtBands().length) body += `<a class="btn-primary" href="#/new">Add the first event</a>`;
  }

  return `<header class="head">
      ${topBar()}
      <div class="title-row"><h1>${esc(fmtDay(today))}</h1></div>
    </header>
    <main id="main">${body}</main>`;
}
