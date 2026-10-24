// App state + live data from the backend + the questions we ask the data
// ("what should I see right now?").
import { PALETTE } from './data.js';
import { todayISO } from './utils.js';

const KEY = 'tourapp.prefs.v1';

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
}
const saved = loadPrefs();

export const state = {
  // UI
  view: saved.view || 'me',          // 'me' | 'all' | a band id
  hidden: saved.hidden || {},        // bands hidden by the filter chips
  scheduleMode: saved.scheduleMode || 'month',
  month: null,
  selected: null,
  sheetOpen: false,
  draft: null,                        // event editor values while editing
  formDirty: false,
  busy: false,
  // Live data
  backendError: null,
  authReady: false,
  user: null,
  profile: undefined,                 // undefined = still loading, null/{} = none yet
  bandDocs: {},
  memberLists: {},
  eventLists: {},
  pendingInvite: null
};

export function savePrefs() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ view: state.view, hidden: state.hidden, scheduleMode: state.scheduleMode }));
  } catch (e) { /* private mode etc. — the app still works */ }
}

// ---------- Derived data (live bindings: importers always see the latest) ----------
export let me = { id: null, name: '', instrument: '', bands: {} };
export let bands = [];
export let events = [];

export function inkFor(color) {
  const hit = PALETTE.find((p) => p.color.toLowerCase() === String(color).toLowerCase());
  if (hit) return hit.ink;
  return '#111111';
}

export function recompute() {
  const uid = state.user ? state.user.uid : null;
  const p = state.profile || {};
  const ids = (p.bandIds || []).filter((id) => state.bandDocs[id] && (state.memberLists[id] || []).some((m) => m.uid === uid));
  bands = ids.map((id) => ({
    id,
    name: state.bandDocs[id].name || 'Band',
    full: state.bandDocs[id].name || 'Band',
    color: state.bandDocs[id].color || PALETTE[0].color,
    ink: inkFor(state.bandDocs[id].color || PALETTE[0].color),
    inviteCode: state.bandDocs[id].inviteCode || null,
    createdBy: state.bandDocs[id].createdBy
  })).sort((a, b) => a.name.localeCompare(b.name));
  const roles = {};
  bands.forEach((b) => {
    const mine = (state.memberLists[b.id] || []).find((m) => m.uid === uid);
    if (mine) roles[b.id] = mine.role;
  });
  me = { id: uid, name: p.name || '', instrument: p.instrument || '', email: state.user ? state.user.email : '', bands: roles };
  events = bands.flatMap((b) => (state.eventLists[b.id] || []).map((e) => normalizeEvent(e, b.id)));
  if (state.view !== 'me' && state.view !== 'all' && !bands.some((b) => b.id === state.view)) state.view = 'me';
}

function normalizeEvent(e, bandId) {
  return {
    ...e,
    band: bandId,
    people: Array.isArray(e.people) ? e.people : [],
    timetable: Array.isArray(e.timetable) ? e.timetable.filter((t) => t && t.time) : undefined,
    missing: Array.isArray(e.missing) ? e.missing : []
  };
}

export const bandById = (id) => bands.find((b) => b.id === id) || { id, name: '?', color: '#555', ink: '#fff' };
export const membersOf = (bandId) => (state.memberLists[bandId] || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
export function personById(uid) {
  for (const b of bands) {
    const m = (state.memberLists[b.id] || []).find((x) => x.uid === uid);
    if (m) return { id: uid, name: m.name || 'Someone', instrument: m.instrument || '' };
  }
  return null;
}
export const eventById = (id) => events.find((e) => e.id === id);
export const isMgmt = (bandId) => me.bands[bandId] === 'mgmt';
export const mgmtBands = () => bands.filter((b) => isMgmt(b.id));

const byDateTime = (a, b) => (a.date + (a.time || '99:99')).localeCompare(b.date + (b.time || '99:99'));

// Events for the current switcher choice (ignores the filter chips).
export function baseEvents() {
  let list;
  if (state.view === 'me') list = events.filter((e) => e.people.includes(me.id));
  else if (state.view === 'all') list = events.slice();
  else list = events.filter((e) => e.band === state.view);
  return list.sort(byDateTime);
}

export const chipsActive = () => state.view === 'me' || state.view === 'all';

export function visibleEvents() {
  const list = baseEvents();
  return chipsActive() ? list.filter((e) => !state.hidden[e.band]) : list;
}

// A clash = on one day, I'm needed by more than one band.
export function clashDates() {
  const byDate = {};
  events.forEach((e) => {
    if (e.type === 'off' || !e.people.includes(me.id)) return;
    (byDate[e.date] = byDate[e.date] || new Set()).add(e.band);
  });
  return new Set(Object.keys(byDate).filter((d) => byDate[d].size > 1));
}

export function clashDescription(date) {
  const list = events.filter((e) => e.date === date && e.type !== 'off' && e.people.includes(me.id)).sort(byDateTime);
  return list.map((e) => `${bandById(e.band).name} ${e.type === 'show' ? 'show' : e.type}${e.time ? ' ' + e.time : ''}${e.type === 'show' && e.place ? ' in ' + e.place : ''}`).join(' and ');
}

export function viewLabel() {
  if (state.view === 'me') return 'My view';
  if (state.view === 'all') return 'All bands';
  return bandById(state.view).name;
}

export function viewBands() {
  if (state.view === 'me' || state.view === 'all') return bands;
  return [bandById(state.view)];
}

export function roleLabel() {
  if (state.view !== 'me' && state.view !== 'all') return `${me.name} · ${isMgmt(state.view) ? 'MGMT' : 'Member'}`;
  return me.instrument ? `${me.name} · ${me.instrument}` : me.name;
}

export function defaultMonth() {
  const today = todayISO();
  const next = visibleEvents().find((e) => e.date >= today);
  return (next ? next.date : today).slice(0, 7);
}

// ---------- Live sync with the backend ----------
let backendRef = null;
let onChange = () => {};
let unsubProfile = null;
const bandSubs = {}; // bandId -> [unsub, unsub, unsub]

function stopBand(id) {
  (bandSubs[id] || []).forEach((u) => { try { u(); } catch (e) { /* ignore */ } });
  delete bandSubs[id];
  delete state.bandDocs[id];
  delete state.memberLists[id];
  delete state.eventLists[id];
}

function stopAll() {
  if (unsubProfile) { unsubProfile(); unsubProfile = null; }
  Object.keys(bandSubs).forEach(stopBand);
}

// Right after creating or joining a band, Firebase can briefly answer "not a member"
// because the save hasn't reached the server yet. So we wait and try again a few
// times before deciding we really lost access (removed from the band / band deleted).
const retries = {};
function lostBand(id) {
  if (!bandSubs[id]) return; // already handled (all three listeners report the same problem)
  stopBand(id);
  const n = (retries[id] || 0) + 1;
  retries[id] = n;
  if (n <= 5) {
    setTimeout(() => {
      const ids = (state.profile && state.profile.bandIds) || [];
      if (ids.includes(id) && !bandSubs[id]) syncBands(ids);
    }, 1000 * n);
  } else {
    delete retries[id];
    if (state.user && backendRef) backendRef.forgetBand(state.user.uid, id).catch(() => {});
  }
  changed();
}

function syncBands(ids) {
  Object.keys(bandSubs).forEach((id) => { if (!ids.includes(id)) stopBand(id); });
  ids.forEach((id) => {
    if (bandSubs[id]) return;
    const onErr = (err) => { if (err && err.code === 'permission-denied') lostBand(id); };
    bandSubs[id] = [
      backendRef.watchBand(id, (doc, confirmed = true) => {
        if (!doc) { if (confirmed) lostBand(id); return; }
        if (confirmed) retries[id] = 0;
        state.bandDocs[id] = doc;
        changed();
      }, onErr),
      backendRef.watchMembers(id, (list) => { state.memberLists[id] = list; changed(); }, onErr),
      backendRef.watchEvents(id, (list) => { state.eventLists[id] = list; changed(); }, onErr)
    ];
  });
}

function changed() {
  recompute();
  onChange();
}

export function startSync(backend, cb) {
  backendRef = backend;
  onChange = cb;
  backend.onAuth((user) => {
    stopAll();
    state.user = user;
    state.profile = undefined;
    state.authReady = true;
    if (user) {
      unsubProfile = backend.watchProfile(user.uid, (p) => {
        state.profile = p || {};
        syncBands(state.profile.bandIds || []);
        changed();
      }, () => { state.profile = state.profile || {}; changed(); });
    }
    changed();
  });
}

// Bands still loading? (profile lists them but their data hasn't arrived yet)
export function bandsLoading() {
  const ids = (state.profile && state.profile.bandIds) || [];
  return ids.some((id) => !state.bandDocs[id] || !state.memberLists[id] || !state.eventLists[id]);
}
