// Entry point: connects to the backend, picks the screen from the address
// (#/today, #/schedule, …), draws it, and handles taps and forms.
import {
  state, savePrefs, startSync, bands, me, bandsLoading, bandById
} from './store.js';
import { bottomNav, sheet } from './components.js';
import { renderToday } from './views/today.js';
import { renderSchedule, shiftMonth, gotoDate } from './views/schedule.js';
import { renderDay } from './views/day.js';
import { renderPeople } from './views/people.js';
import { renderLater } from './views/later.js';
import { renderSplash, renderBackendError, renderLogin, renderSetup, renderJoin, renderWelcome } from './views/auth.js';
import { renderMe } from './views/me.js';
import { renderBand, inviteUrl } from './views/band.js';
import { renderEditor, collectDraft, toEventData } from './views/editor.js';
import { friendlyError } from './backend/shared.js';
import { initUpdates, currentVersion } from './updates.js';

const app = document.getElementById('app');
const TABS = ['today', 'schedule', 'people', 'money', 'docs'];
const INVITE_KEY = 'tourapp.invite';
let backend = null;

// ---------- Invite links: ?invite=CODE ----------
const params = new URLSearchParams(location.search);
const inviteParam = params.get('invite');
if (inviteParam && /^[a-z0-9]{6,20}$/.test(inviteParam)) {
  try { localStorage.setItem(INVITE_KEY, inviteParam); } catch (e) { /* ignore */ }
  params.delete('invite');
  history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash);
}
try { state.pendingInvite = localStorage.getItem(INVITE_KEY); } catch (e) { state.pendingInvite = null; }
state.invite = undefined; // the loaded invite (undefined = not loaded yet)

function clearInvite() {
  state.pendingInvite = null;
  state.invite = undefined;
  try { localStorage.removeItem(INVITE_KEY); } catch (e) { /* ignore */ }
}

function loadInvite() {
  if (state.invite !== undefined || state.inviteLoading) return;
  state.inviteLoading = true;
  backend.getInvite(state.pendingInvite)
    .then((inv) => { state.invite = inv; })
    .catch(() => { state.invite = null; })
    .finally(() => {
      state.inviteLoading = false;
      if (state.invite && bands.some((b) => b.id === state.invite.bandId)) {
        const id = state.invite.bandId;
        clearInvite();
        location.hash = `#/band/${id}`;
      }
      render();
    });
}

// ---------- Routing & drawing ----------
function currentRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  return { name: parts[0] || 'today', arg: parts[1] ? decodeURIComponent(parts[1]) : undefined };
}

function screenFor(route) {
  if (state.backendError) return { html: renderBackendError() };
  if (!state.authReady) return { html: renderSplash() };
  if (!state.user) return { html: renderLogin() };
  if (state.profile === undefined) return { html: renderSplash() };
  if (!state.profile.name) return { html: renderSetup() };
  if (bandsLoading()) return { html: renderSplash('Loading your bands…') };
  if (state.pendingInvite) { loadInvite(); return { html: renderJoin(state.invite) }; }
  if (!bands.length && route.name !== 'me') return { html: renderWelcome() };

  const { name, arg } = route;
  let html;
  if (name === 'schedule') html = renderSchedule();
  else if (name === 'day') html = renderDay(arg);
  else if (name === 'people') html = renderPeople();
  else if (name === 'money' || name === 'docs') html = renderLater(name);
  else if (name === 'me') html = renderMe();
  else if (name === 'band') html = renderBand(arg);
  else if (name === 'new') html = renderEditor('new', arg);
  else if (name === 'edit') html = renderEditor('edit', arg);
  else html = renderToday();
  const tab = ['day'].includes(name) ? 'schedule' : (['me', 'band'].includes(name) ? null : (TABS.includes(name) ? name : 'today'));
  return { html, nav: !['new', 'edit'].includes(name), tab };
}

let lastHash = null;
function render() {
  const route = currentRoute();
  const oldMain = document.getElementById('main');
  const keepScroll = lastHash === location.hash && oldMain ? oldMain.scrollTop : 0;
  const s = screenFor(route);
  app.innerHTML = s.html + (s.nav ? bottomNav(s.tab) + sheet() : '');
  const main = document.getElementById('main');
  if (main) main.scrollTop = keepScroll;
  lastHash = location.hash;
  state.needsRender = false;

  if (state.sheetOpen) {
    const first = app.querySelector('.sheet-opt.on') || app.querySelector('.sheet-opt');
    if (first) first.focus();
  }
  const vEl = document.getElementById('app-version');
  if (vEl) currentVersion().then((ver) => { if (ver && vEl.isConnected) vEl.textContent = `App version ${ver}${backend && backend.kind === 'mock' ? ' · TEST MODE' : ''}`; });
}

// Live data changed: redraw, unless someone is typing in a form right now.
let raf = 0;
function scheduleRender() {
  const typing = app.contains(document.activeElement) && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if (state.formDirty || typing) { state.needsRender = true; return; }
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(render);
}

// ---------- Feedback ----------
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

async function run(fn) {
  state.busy = true;
  state.authError = null;
  state.authInfo = null;
  render();
  try {
    await fn();
  } catch (err) {
    state.authError = friendlyError(err);
  } finally {
    state.busy = false;
    state.formDirty = false;
    render();
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Link copied. Paste it into WhatsApp or an email.');
  } catch (e) {
    const el = document.querySelector('.invite-url');
    if (el) { el.focus(); el.select(); }
    toast('Select the link and copy it.');
  }
}

// ---------- Taps ----------
const actions = {
  'open-sheet': () => { state.sheetOpen = true; },
  'close-sheet': () => { state.sheetOpen = false; },
  'set-view': (el) => { state.view = el.dataset.view; state.sheetOpen = false; state.month = null; state.selected = null; },
  'toggle-band': (el) => { state.hidden[el.dataset.band] = !state.hidden[el.dataset.band]; },
  'set-mode': (el) => { state.scheduleMode = el.dataset.mode; },
  'month-prev': () => shiftMonth(-1),
  'month-next': () => shiftMonth(1),
  'pick-day': (el) => { state.selected = el.dataset.date; },
  'goto-date': (el) => { gotoDate(el.dataset.date); return 'nav'; },
  'toast': (el) => { toast(el.dataset.msg); return 'none'; },
  'reload': () => { location.reload(); return 'none'; },
  'auth-mode': (el) => { state.authMode = el.dataset.mode; state.authError = null; state.authInfo = null; },
  'google': () => { run(() => backend.signInGoogle()); return 'none'; },
  'sign-out': () => {
    if (!confirm('Sign out on this phone?')) return 'none';
    state.draft = null;
    state.authMode = 'signin';
    run(() => backend.signOut()).then(() => { location.hash = '#/today'; });
    return 'none';
  },
  'dismiss-invite': () => { clearInvite(); },
  'join-band': () => {
    const inv = state.invite;
    run(async () => {
      await backend.joinBand(me.id, inv, me);
      clearInvite();
      state.view = 'me';
      location.hash = '#/today';
      toast(`Welcome to ${inv.bandName}!`);
    });
    return 'none';
  },
  'new-invite': (el) => {
    const band = bandById(el.dataset.band);
    if (band.inviteCode && !confirm('Make a new link? The old link will stop working.')) return 'none';
    run(() => backend.createInvite(me.id, band));
    return 'none';
  },
  'share-invite': (el) => {
    const band = bandById(el.dataset.band);
    const url = inviteUrl(band.inviteCode);
    if (navigator.share) {
      navigator.share({ title: `Join ${band.name}`, text: `Join ${band.name} in our Tour App:`, url }).catch(() => {});
    } else copyText(url);
    return 'none';
  },
  'copy-invite': (el) => { copyText(inviteUrl(bandById(el.dataset.band).inviteCode)); return 'none'; },
  'set-role': (el) => { run(() => backend.setMemberRole(el.dataset.band, el.dataset.uid, el.dataset.role)); return 'none'; },
  'remove-member': (el) => {
    if (!confirm(`Remove ${el.dataset.name || 'this person'} from ${bandById(el.dataset.band).name}?`)) return 'none';
    run(() => backend.removeMember(el.dataset.band, el.dataset.uid));
    return 'none';
  },
  'leave-band': (el) => {
    if (!confirm(`Leave ${el.dataset.name}? You'll need a new invite link to come back.`)) return 'none';
    run(async () => { await backend.leaveBand(me.id, el.dataset.band); location.hash = '#/me'; });
    return 'none';
  },
  'cancel-edit': () => { state.draft = null; state.formDirty = false; return 'nav'; },
  'delete-event': () => {
    const d = state.draft;
    if (!d || !confirm(`Delete "${d.title || 'this event'}"? This can't be undone.`)) return 'none';
    run(async () => {
      await backend.deleteEvent(d.band, d.id);
      state.draft = null;
      location.hash = '#/schedule';
      toast('Event deleted.');
    });
    return 'none';
  }
};

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el) return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  const result = fn(el);
  if (result === 'none' || result === 'nav') return;
  savePrefs();
  render();
});

// ---------- Forms ----------
const forms = {
  signin: (f) => run(() => backend.signInEmail(f.get('email').trim(), f.get('password'))),
  signup: (f) => run(() => backend.signUpEmail(f.get('email').trim(), f.get('password'), f.get('name').trim())),
  reset: (f) => run(async () => {
    await backend.resetPassword(f.get('email').trim());
    state.authMode = 'signin';
    state.authInfo = 'Check your inbox for the reset link.';
  }),
  setup: (f) => run(() => backend.saveProfile(me.id, {
    name: f.get('name').trim(), instrument: String(f.get('instrument') || '').trim(), email: state.user.email || ''
  })),
  profile: (f) => run(async () => {
    const info = { name: f.get('name').trim(), instrument: String(f.get('instrument') || '').trim() };
    await backend.saveProfile(me.id, info);
    await backend.updateMyMemberInfo(me.id, bands.map((b) => b.id), info);
    state.authInfo = 'Saved.';
  }),
  'join-code': (f) => {
    const raw = String(f.get('code') || '').trim();
    const m = raw.match(/[?&]invite=([a-z0-9]{6,20})/i) || raw.match(/^([a-z0-9]{6,20})$/i);
    if (!m) {
      state.authError = 'That doesn\'t look like an invite link. Copy the whole link from the message and try again.';
      render();
      return;
    }
    const code = m[1].toLowerCase();
    try { localStorage.setItem(INVITE_KEY, code); } catch (e) { /* ignore */ }
    state.pendingInvite = code;
    state.invite = undefined;
    state.authError = null;
    state.formDirty = false;
    render();
  },
  'create-band': (f) => run(async () => {
    const id = await backend.createBand(me.id, { name: f.get('name').trim(), color: f.get('color') }, me);
    location.hash = `#/band/${id}`;
    toast('Band created. Now invite your bandmates.');
  }),
  'band-settings': (f, form) => run(async () => {
    await backend.updateBand(form.dataset.band, { name: f.get('name').trim(), color: f.get('color') });
    toast('Saved.');
  }),
  event: (f, form) => {
    const d = collectDraft(form);
    state.draft = d;
    if (!d.date) { state.authError = 'Please pick a date.'; render(); return; }
    run(async () => {
      const id = await backend.saveEvent(d.band, d.id, toEventData(d));
      state.draft = null;
      location.hash = `#/day/${id}`;
      toast(d.id ? 'Saved.' : 'Added to the schedule.');
    });
  }
};

document.addEventListener('submit', (ev) => {
  const form = ev.target.closest('form[data-form]');
  if (!form) return;
  ev.preventDefault();
  const fn = forms[form.dataset.form];
  if (fn) fn(new FormData(form), form);
});

document.addEventListener('input', (ev) => {
  if (ev.target.closest('form[data-form="event"], form[data-form="profile"], form[data-form="band-settings"], form[data-form="create-band"]')) state.formDirty = true;
});

document.addEventListener('change', (ev) => {
  // Editor: switching the band updates the list of people
  if (ev.target.name === 'band' && ev.target.closest('form[data-form="event"]')) {
    const d = collectDraft(ev.target.form);
    d.people = (state.memberLists[d.band] || []).map((m) => m.uid);
    state.draft = d;
    state.formDirty = false;
    render();
  }
});

document.addEventListener('focusout', () => {
  setTimeout(() => { if (state.needsRender && !state.formDirty) scheduleRender(); }, 0);
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && state.sheetOpen) {
    state.sheetOpen = false;
    render();
    const btn = document.querySelector('.switcher');
    if (btn) btn.focus();
  }
});

window.addEventListener('hashchange', () => {
  const route = currentRoute();
  state.sheetOpen = false;
  state.formDirty = false;
  state.authError = null;
  state.authInfo = null;
  if (!['new', 'edit'].includes(route.name)) state.draft = null;
  document.getElementById('toast').classList.remove('show');
  render();
});

// ---------- Start ----------
async function boot() {
  render();
  try {
    if (params.has('mock')) {
      const mock = await import('./backend/mock.js');
      if (params.get('mock') === 'demo') {
        mock.seedDemo(await import('./data.js'));
        params.set('mock', '1');
        history.replaceState(null, '', location.pathname + '?' + params + location.hash);
      }
      backend = mock.backend;
    } else {
      backend = (await import('./backend/firebase.js')).backend;
    }
  } catch (err) {
    console.error(err);
    state.backendError = err;
    render();
    return;
  }
  backend.onWriteError = (err) => toast(friendlyError(err));
  startSync(backend, scheduleRender);
}

boot();
initUpdates();
