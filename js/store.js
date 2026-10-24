// App state + the questions we ask the data ("what should I see right now?").
import { bands, events, people, ME } from './data.js';
import { todayISO } from './utils.js';

const KEY = 'tourapp.prefs.v1';

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
}

const saved = loadPrefs();

export const state = {
  view: saved.view || 'me',          // 'me' | 'all' | a band id
  hidden: saved.hidden || {},        // bands hidden by the filter chips
  scheduleMode: saved.scheduleMode || 'month', // 'month' | 'list'
  month: null,                        // 'YYYY-MM' shown in the calendar
  selected: null,                     // selected day in the calendar
  sheetOpen: false                    // band switcher open?
};

export function savePrefs() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ view: state.view, hidden: state.hidden, scheduleMode: state.scheduleMode }));
  } catch (e) { /* private mode etc. — the app still works */ }
}

if (state.view !== 'me' && state.view !== 'all' && !bands.some((b) => b.id === state.view)) state.view = 'me';

export const me = people.find((p) => p.id === ME);
export const bandById = (id) => bands.find((b) => b.id === id);
export const personById = (id) => people.find((p) => p.id === id);
export const eventById = (id) => events.find((e) => e.id === id);
export const isMgmt = (bandId) => me.bands[bandId] === 'mgmt';

const byDateTime = (a, b) => (a.date + (a.time || '99:99')).localeCompare(b.date + (b.time || '99:99'));

// Events for the current switcher choice (ignores the filter chips).
export function baseEvents() {
  let list;
  if (state.view === 'me') list = events.filter((e) => e.people.includes(ME));
  else if (state.view === 'all') list = events.filter((e) => me.bands[e.band]);
  else list = events.filter((e) => e.band === state.view);
  return list.slice().sort(byDateTime);
}

// Filter chips only apply in "My view" and "All bands".
export const chipsActive = () => state.view === 'me' || state.view === 'all';

export function visibleEvents() {
  const list = baseEvents();
  return chipsActive() ? list.filter((e) => !state.hidden[e.band]) : list;
}

// A clash = on one day, I'm needed by more than one band.
export function clashDates() {
  const byDate = {};
  events.forEach((e) => {
    if (e.type === 'off' || !e.people.includes(ME)) return;
    (byDate[e.date] = byDate[e.date] || new Set()).add(e.band);
  });
  return new Set(Object.keys(byDate).filter((d) => byDate[d].size > 1));
}

export function clashDescription(date) {
  const list = events.filter((e) => e.date === date && e.type !== 'off' && e.people.includes(ME)).sort(byDateTime);
  return list.map((e) => `${bandById(e.band).name} ${e.type === 'show' ? 'show' : e.type}${e.time ? ' ' + e.time : ''}${e.type === 'show' ? ' in ' + e.place : ''}`).join(' and ');
}

export function viewLabel() {
  if (state.view === 'me') return 'My view';
  if (state.view === 'all') return 'All bands';
  return bandById(state.view).name;
}

export function viewBands() {
  if (state.view === 'me' || state.view === 'all') return bands.filter((b) => me.bands[b.id]);
  return [bandById(state.view)];
}

export function roleLabel() {
  if (state.view !== 'me' && state.view !== 'all') return `${me.name} · ${isMgmt(state.view) ? 'MGMT' : 'Member'}`;
  return `${me.name} · ${me.instrument}`;
}

export function defaultMonth() {
  const today = todayISO();
  const next = visibleEvents().find((e) => e.date >= today);
  return (next ? next.date : today).slice(0, 7);
}
