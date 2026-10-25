// Entry point: connects to the backend, picks the screen from the address
// (#/today, #/schedule, …), draws it, and handles taps and forms.
import {
  state, savePrefs, startSync, bands, me, bandsLoading, bandById, isMgmt, myAway, docsOf
} from './store.js';
const docsOfBand = docsOf;

import { bottomNav, sheet, sidebar, navSheet } from './components.js';
import { availableNavApps, getNavApp, setNavApp, openNav } from './nav.js';
import { renderToday } from './views/today.js';
import { renderSchedule, shiftMonth, gotoDate } from './views/schedule.js';
import { renderDay } from './views/day.js';
import { renderPeople } from './views/people.js';
import { renderStock, renderSell, renderNights, renderNight, renderProductForm, renderBundleForm } from './views/merch.js';
import { installMerch } from './merch-actions.js';
import { renderSplash, renderBackendError, renderLogin, renderSetup, renderJoin, renderWelcome } from './views/auth.js';
import { renderMe } from './views/me.js';
import { renderBand, inviteUrl } from './views/band.js';
import { renderEditor, collectDraft, toEventData } from './views/editor.js';
import { renderContactForm } from './views/contacts.js';
import { renderDocs, renderDocForm } from './views/docs.js';
import { renderExport, exportEvents, exportContacts, venueContactOptions, resultHtml } from './views/export.js';
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
  const dec = (x) => (x ? decodeURIComponent(x) : undefined);
  return { name: parts[0] || 'today', arg: dec(parts[1]), arg2: dec(parts[2]), arg3: dec(parts[3]) };
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

  const { name, arg, arg2, arg3 } = route;
  let html;
  if (name === 'schedule') html = renderSchedule();
  else if (name === 'day') html = renderDay(arg);
  else if (name === 'people') html = renderPeople();
  else if (name === 'money') html = renderStock();
  else if (name === 'merch' && arg === 'sell') html = renderSell();
  else if (name === 'merch' && arg === 'nights') html = renderNights();
  else if (name === 'merch' && arg === 'night') html = renderNight(arg2 || '');
  else if (name === 'merch' && arg === 'product') html = renderProductForm(arg2);
  else if (name === 'merch' && arg === 'bundle') html = renderBundleForm(arg2);
  else if (name === 'merch') html = renderStock();
  else if (name === 'docs') html = renderDocs();
  else if (name === 'doc') html = renderDocForm(arg, arg2, arg3 === 'p');
  else if (name === 'contact') html = renderContactForm(arg, arg2);
  else if (name === 'export') html = renderExport(arg);
  else if (name === 'me') html = renderMe();
  else if (name === 'band') html = renderBand(arg);
  else if (name === 'new') html = renderEditor('new', arg);
  else if (name === 'edit') html = renderEditor('edit', arg);
  else html = renderToday();
  const parent = { day: 'schedule', contact: 'people', doc: 'docs', export: 'docs', merch: 'money' };
  const tab = parent[name] || (['me', 'band'].includes(name) ? null : (TABS.includes(name) ? name : 'today'));
  const form = ['new', 'edit', 'contact', 'doc', 'export'].includes(name) || (name === 'merch' && ['product', 'bundle'].includes(arg));
  return { html, nav: !form, tab, shell: true, side: ['me', 'band'].includes(name) ? 'me' : tab };
}

let lastHash = null;
function render() {
  const route = currentRoute();
  const oldMain = document.getElementById('main');
  const keepScroll = lastHash === location.hash && oldMain ? oldMain.scrollTop : 0;
  const s = screenFor(route);
  app.className = s.shell ? 'has-shell' : '';
  app.innerHTML = s.shell
    ? `<div class="shell">${sidebar(s.side)}<div class="content">${s.html}</div></div>${s.nav ? bottomNav(s.tab) + sheet() : ''}${navSheet(availableNavApps())}`
    : s.html;
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

// My "not available" dates should exist in every band I'm in (e.g. after joining a new one).
const awayCopied = new Set();
function reconcileAway() {
  if (!backend || !me.id) return;
  const today = new Date().toISOString().slice(0, 10);
  myAway().filter((a) => a.to >= today).forEach((a) => {
    bands.forEach((b) => {
      const key = `${a.id}:${b.id}`;
      if (a.bands.includes(b.id) || awayCopied.has(key) || !state.awayLists[b.id]) return;
      awayCopied.add(key);
      backend.copyAway(b.id, a).catch(() => {});
    });
  });
}

// Live data changed: redraw, unless someone is typing in a form right now.
let raf = 0;
function scheduleRender() {
  reconcileAway();
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
  'make-owner': (el) => {
    const band = bandById(el.dataset.band);
    if (!confirm(`Make ${el.dataset.name || 'this person'} the owner of ${band.name}? You'll stay MGMT, but they will lead the band and could change your role.`)) return 'none';
    run(async () => { await backend.transferOwnership(band.id, el.dataset.uid); toast('Ownership handed over.'); });
    return 'none';
  },
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
  'remove-away': (el) => {
    run(() => backend.removeAway(el.dataset.bands.split(','), el.dataset.id));
    return 'none';
  },
  'accept-suggestion': (el) => {
    run(async () => { await backend.acceptSuggestion(el.dataset.band, el.dataset.id); toast('Accepted. It\'s on the schedule now.'); });
    return 'none';
  },
  'decline-suggestion': (el) => {
    const withdraw = el.dataset.withdraw === '1';
    if (!confirm(withdraw ? 'Withdraw your suggestion?' : 'Decline this suggestion? It will be removed.')) return 'none';
    run(async () => { await backend.deleteEvent(el.dataset.band, el.dataset.id); location.hash = '#/schedule'; toast(withdraw ? 'Suggestion withdrawn.' : 'Suggestion declined.'); });
    return 'none';
  },
  'delete-contact': (el) => {
    if (!confirm('Delete this contact?')) return 'none';
    run(async () => { await backend.deleteItem(el.dataset.band, 'contacts', el.dataset.id); location.hash = '#/people'; toast('Contact deleted.'); });
    return 'none';
  },
  'delete-doc': (el) => {
    if (!confirm('Delete this document link? (The file itself stays where it is.)')) return 'none';
    run(async () => { await backend.deleteItem(el.dataset.band, el.dataset.private ? 'privateDocs' : 'docs', el.dataset.id); location.hash = '#/docs'; toast('Deleted.'); });
    return 'none';
  },
  'navigate': (el) => {
    const app = getNavApp();
    if (app) { openNav(app, el.dataset.q); return 'none'; }
    state.navQuery = el.dataset.q;
  },
  'nav-go': (el) => {
    const remember = document.getElementById('nav-remember');
    if (remember && remember.checked) setNavApp(el.dataset.app);
    openNav(el.dataset.app, state.navQuery);
    state.navQuery = null;
  },
  'nav-close': () => { state.navQuery = null; },
  'share-pdf': () => {
    const f = state.lastPdf;
    if (!f) return 'none';
    if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: f.name }).catch(() => {});
    return 'none';
  },
  'delete-band': (el) => {
    if (!confirm(`Delete ${el.dataset.name} with all its events? This can't be undone.`)) return 'none';
    run(async () => { await backend.deleteBand(me.id, el.dataset.band); location.hash = '#/me'; toast('Band deleted.'); });
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
    setNavApp(String(f.get('navApp') || '') || null);
    const info = { name: f.get('name').trim(), instrument: String(f.get('instrument') || '').trim(), phone: String(f.get('phone') || '').trim(), sharePhone: !!f.get('sharePhone') };
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
  'away-add': (f) => {
    const from = String(f.get('from') || '');
    let to = String(f.get('to') || '') || from;
    if (!from) { state.authError = 'Please pick a start date.'; render(); return; }
    if (to < from) to = from;
    run(async () => {
      await backend.addAway(me.id, bands.map((b) => b.id), { from, to, note: String(f.get('note') || '').trim(), name: me.name });
      state.authInfo = 'Saved. Your bands can see it now.';
    });
  },
  contact: (f, form) => {
    const band = String(f.get('band') || form.dataset.band);
    const data = {
      name: String(f.get('name') || '').trim(), role: String(f.get('role') || 'Other'), phone: String(f.get('phone') || '').trim(),
      email: String(f.get('email') || '').trim(), note: String(f.get('note') || '').trim(), share: !!f.get('share')
    };
    run(async () => { await backend.saveItem(band, 'contacts', form.dataset.id || null, data); location.hash = '#/people'; toast('Contact saved.'); });
  },
  doc: (f, form) => {
    const band = String(f.get('band') || form.dataset.band);
    let url = String(f.get('url') || '').trim();
    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
    const priv = !!f.get('private');
    const wasPriv = form.dataset.private === '1';
    const data = { title: String(f.get('title') || '').trim(), category: String(f.get('category') || 'Other'), url, note: String(f.get('note') || '').trim(), guest: !priv && !!f.get('guest') };
    run(async () => {
      const id = form.dataset.id || null;
      if (id && priv !== wasPriv) {
        await backend.deleteItem(band, wasPriv ? 'privateDocs' : 'docs', id);
        await backend.saveItem(band, priv ? 'privateDocs' : 'docs', null, data);
      } else {
        await backend.saveItem(band, priv ? 'privateDocs' : 'docs', id, data);
      }
      location.hash = '#/docs';
      toast('Saved.');
    });
  },
  export: async (f) => {
    const band = bandById(String(f.get('band')));
    const days = f.getAll('days').map(String);
    if (!days.length) { state.authError = 'Pick at least one day.'; render(); return; }
    const evs = exportEvents(band.id).filter((e) => days.includes(e.id));
    const allContacts = exportContacts(band.id).filter((c) => c.ok);
    const chosen = f.getAll('contacts').map(String);
    const contacts = allContacts.filter((c) => chosen.includes(c.key));
    const pick = String(f.get('primary') ?? '');
    let primary = null;
    if (pick === 'new') {
      const np = { name: String(f.get('np_name') || '').trim(), role: String(f.get('np_role') || 'Other'), phone: String(f.get('np_phone') || '').trim(), email: String(f.get('np_email') || '').trim() };
      if (!np.name || !(np.phone || np.email)) { toast('For "Call this first", please add a name and a phone number (or email).'); return; }
      primary = { key: 'new', ...np };
      if (f.get('np_save') && !state.exp.savedNew) {
        state.exp.savedNew = true; // only save once, even if the PDF is created again
        backend.saveItem(band.id, 'contacts', null, { ...np, note: '', share: true }).catch(() => {});
      }
    } else if (pick.startsWith('v:')) {
      primary = venueContactOptions(band.id).find((c) => c.key === pick) || null;
    } else if (pick) {
      primary = contacts.find((c) => c.key === pick) || allContacts.find((c) => c.key === pick) || null;
    }
    const ordered = primary ? [primary, ...contacts.filter((c) => c !== primary)] : contacts;
    const docIds = f.getAll('docs').map(String);
    const docs = docsOfBand(band.id).filter((d) => docIds.includes(d.id));
    const type = String(f.get('type') || 'Support band');
    const who = String(f.get('name') || '').trim();
    const { buildGuestPdf } = await import('./pdf/guest.js');
    const created = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const pdf = buildGuestPdf({ band, recipientType: type, recipientName: who, events: evs, sections: new Set(f.getAll('sections').map(String)),
      contacts: ordered, primary, venueContacts: !!f.get('venueContacts'), docs, createdAt: created });
    const slug = (s) => String(s).replace(/ß/g, 'ss').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
    const fileName = `${slug(band.name)}-tour-info${who ? '-' + slug(who) : ''}.pdf`;
    const blob = pdf.toBlob();
    const file = new File([blob], fileName, { type: 'application/pdf' });
    state.lastPdf = file;
    if (state.lastPdfUrl) URL.revokeObjectURL(state.lastPdfUrl);
    state.lastPdfUrl = URL.createObjectURL(blob);
    const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    state.exportResult = { fileName, days: evs.length, canShare, url: state.lastPdfUrl };
    state.formDirty = true; // keep the choices on screen
    const box = document.getElementById('export-result');
    if (box) {
      box.innerHTML = resultHtml();
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
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
    const data = toEventData(d);
    const suggesting = !d.id && !isMgmt(d.band);
    if (suggesting) Object.assign(data, { suggested: true, suggestedBy: me.id, suggestedByName: me.name });
    run(async () => {
      const id = await backend.saveEvent(d.band, d.id, data);
      state.draft = null;
      location.hash = `#/day/${id}`;
      toast(suggesting ? 'Suggestion sent to MGMT.' : d.id ? 'Saved.' : 'Added to the schedule.');
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
  if (ev.target.closest('form[data-form="event"], form[data-form="profile"], form[data-form="band-settings"], form[data-form="create-band"], form[data-form="contact"], form[data-form="doc"], form[data-form="export"], form[data-form="away-add"], form[data-form="product"], form[data-form="bundle"], form[data-form="night"]')) state.formDirty = true;
});

document.addEventListener('change', (ev) => {
  // Guest PDF: "Add someone new" shows the fields for the new contact
  if (ev.target.name === 'primary' && ev.target.closest('form[data-form="export"]')) {
    const box = ev.target.form.querySelector('.new-primary');
    if (box) box.hidden = ev.target.value !== 'new';
    return;
  }
  // Guest PDF: switching the band shows that band's days and contacts
  if (ev.target.name === 'band' && ev.target.closest('form[data-form="export"]')) {
    if (state.exp) state.exp.band = ev.target.value;
    state.formDirty = false;
    render();
    return;
  }
  // Editor: switching the band updates the list of people; a new date updates "not available" marks
  if ((ev.target.name === 'band' || ev.target.name === 'date') && ev.target.closest('form[data-form="event"]')) {
    const d = collectDraft(ev.target.form);
    if (ev.target.name === 'band') d.people = (state.memberLists[d.band] || []).map((m) => m.uid);
    state.draft = d;
    state.formDirty = false;
    render();
  }
});

document.addEventListener('focusout', () => {
  setTimeout(() => { if (state.needsRender && !state.formDirty) scheduleRender(); }, 0);
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && state.navQuery) { state.navQuery = null; render(); return; }
  if (ev.key === 'Escape' && state.pick) { state.pick = null; render(); return; }
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
  if (route.name !== 'export') { state.exp = null; state.exportResult = null; }
  if (!(route.name === 'merch' && route.arg === 'product')) state.pd = null;
  state.pick = null;
  document.getElementById('toast').classList.remove('show');
  render();
});

installMerch({ getBackend: () => backend, render, toast, run, actions, forms });

// ---------- Start ----------
const RECOVER_KEY = 'tourapp.recover';
function restoreAfterReload() {
  try {
    const raw = sessionStorage.getItem(RECOVER_KEY);
    if (!raw) return;
    sessionStorage.removeItem(RECOVER_KEY);
    const r = JSON.parse(raw);
    if (!r || Date.now() - r.at > 5 * 60 * 1000) return;
    if (r.draft && r.hash === location.hash) state.draft = r.draft;
    setTimeout(() => toast('The connection was reset. Your changes are still here, please tap save again.'), 800);
  } catch (e) { /* ignore */ }
}

async function boot() {
  restoreAfterReload();
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
  // Last resort if the connection can't be reopened: reload, but keep the form filled in.
  backend.onFatal = () => {
    try { sessionStorage.setItem(RECOVER_KEY, JSON.stringify({ hash: location.hash, draft: state.draft, at: Date.now() })); } catch (e) { /* ignore */ }
    location.reload();
  };
  startSync(backend, scheduleRender);
  // Coming back from the background: make sure the connection is still open.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && backend.checkConnection) backend.checkConnection();
  });
}

boot();
initUpdates();
