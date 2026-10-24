// TEST backend: behaves like Firebase, but everything stays in this browser.
// Used only when the address contains ?mock (for testing without touching real data).
// ?mock=demo starts with example bands and you signed in as Mex.
import { randomCode } from './shared.js';

const KEY = 'tourapp.mock.v1';
let db = load();
const authListeners = new Set();
const watchers = new Set();

function empty() {
  return { users: {}, bands: {}, members: {}, events: {}, invites: {}, accounts: {}, current: null };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return empty();
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* ignore */ }
}

const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const later = (fn) => setTimeout(fn, 0);
const deny = () => { const e = new Error('Missing or insufficient permissions.'); e.code = 'permission-denied'; throw e; };
const authErr = (code) => { const e = new Error(code); e.code = code; throw e; };
const uid = () => db.current;
const isMember = (b) => !!(db.members[b] && db.members[b][uid()]);
const isMgmt = (b) => isMember(b) && db.members[b][uid()].role === 'mgmt';

function changed() {
  persist();
  watchers.forEach((w) => later(w.fire));
}

function watch(read) {
  const w = {
    fire: () => {
      try { w.cb(read()); } catch (e) { if (w.onError) w.onError(e); }
    }
  };
  return w;
}

function addWatcher(read, cb, onError) {
  const w = watch(read);
  w.cb = cb;
  w.onError = onError;
  watchers.add(w);
  later(w.fire);
  return () => watchers.delete(w);
}

function setUser(u) {
  db.current = u;
  persist();
  const user = u ? { uid: u, email: db.users[u] && db.users[u].email || '', displayName: '' } : null;
  authListeners.forEach((cb) => later(() => cb(user)));
}

export function seedDemo(demo) {
  // demo = { bands, people, events } from data.js
  db = empty();
  const ids = { mex: 'u-mex' };
  demo.people.forEach((p) => { ids[p.id] = ids[p.id] || `u-${p.id}`; });
  demo.bands.forEach((b) => {
    db.bands[b.id] = { name: b.name, color: b.color, createdBy: 'u-mex', inviteCode: null };
    db.members[b.id] = {};
    db.events[b.id] = {};
  });
  demo.people.forEach((p) => {
    Object.entries(p.bands).forEach(([bandId, role]) => {
      db.members[bandId][ids[p.id]] = { role, name: p.name, instrument: p.instrument };
    });
  });
  demo.events.forEach((e) => {
    const { id, band, ...rest } = e;
    db.events[band][id] = { ...clone(rest), people: e.people.map((p) => ids[p]) };
  });
  db.users['u-mex'] = { name: 'Mex', instrument: 'Drums', email: 'mex@example.com', bandIds: demo.bands.map((b) => b.id) };
  db.accounts['mex@example.com'] = { uid: 'u-mex', password: 'test123' };
  db.current = 'u-mex';
  persist();
}

export function resetMock() { db = empty(); persist(); }

export const backend = {
  kind: 'mock',

  onAuth(cb) {
    authListeners.add(cb);
    const u = db.current;
    later(() => cb(u ? { uid: u, email: (db.users[u] && db.users[u].email) || '', displayName: '' } : null));
    return () => authListeners.delete(cb);
  },
  async signInGoogle() {
    const email = 'google.user@example.com';
    if (!db.accounts[email]) { db.accounts[email] = { uid: 'u-google', password: null }; db.users['u-google'] = { email }; }
    setUser(db.accounts[email].uid);
  },
  async signInEmail(email, password) {
    const a = db.accounts[email.toLowerCase()];
    if (!a || a.password !== password) authErr('auth/invalid-credential');
    setUser(a.uid);
  },
  async signUpEmail(email, password, name) {
    email = email.toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) authErr('auth/invalid-email');
    if (!password || password.length < 6) authErr('auth/weak-password');
    if (db.accounts[email]) authErr('auth/email-already-in-use');
    const id = 'u-' + randomCode(6);
    db.accounts[email] = { uid: id, password };
    db.users[id] = { email, name: name || '' };
    setUser(id);
  },
  async resetPassword(email) { if (!db.accounts[email.toLowerCase()]) authErr('auth/user-not-found'); },
  async signOut() { setUser(null); },

  watchProfile(u, cb, onError) {
    return addWatcher(() => (u === uid() ? clone(db.users[u] || null) : deny()), cb, onError);
  },
  async saveProfile(u, data) {
    if (u !== uid()) deny();
    db.users[u] = { ...(db.users[u] || {}), ...clone(data) };
    changed();
  },

  watchBand(b, cb, onError) {
    return addWatcher(() => {
      if (!db.bands[b]) return null;
      if (!isMember(b)) deny();
      return { id: b, ...clone(db.bands[b]) };
    }, cb, onError);
  },
  watchMembers(b, cb, onError) {
    return addWatcher(() => {
      if (!isMember(b)) deny();
      return Object.entries(db.members[b] || {}).map(([id, m]) => ({ uid: id, ...clone(m) }));
    }, cb, onError);
  },
  watchEvents(b, cb, onError) {
    return addWatcher(() => {
      if (!isMember(b)) deny();
      return Object.entries(db.events[b] || {}).map(([id, e]) => ({ id, band: b, ...clone(e) }));
    }, cb, onError);
  },

  async createBand(u, { name, color }, me) {
    const id = 'b-' + randomCode(8);
    db.bands[id] = { name, color, createdBy: u, inviteCode: null };
    db.members[id] = { [u]: { role: 'mgmt', name: me.name, instrument: me.instrument || '' } };
    db.events[id] = {};
    const p = db.users[u] || (db.users[u] = {});
    p.bandIds = Array.from(new Set([...(p.bandIds || []), id]));
    changed();
    return id;
  },
  async updateBand(b, data) { if (!isMgmt(b)) deny(); Object.assign(db.bands[b], clone(data)); changed(); },
  async setMemberRole(b, u, role) { if (!isMgmt(b)) deny(); db.members[b][u].role = role; changed(); },
  async removeMember(b, u) { if (!isMgmt(b) && u !== uid()) deny(); delete db.members[b][u]; changed(); },
  async updateMyMemberInfo(u, bandIds, info) {
    bandIds.forEach((b) => { if (db.members[b] && db.members[b][u]) Object.assign(db.members[b][u], info); });
    changed();
  },
  async leaveBand(u, b) {
    if (db.members[b]) delete db.members[b][u];
    const p = db.users[u];
    if (p) p.bandIds = (p.bandIds || []).filter((x) => x !== b);
    changed();
  },
  async forgetBand(u, b) {
    const p = db.users[u];
    if (p) p.bandIds = (p.bandIds || []).filter((x) => x !== b);
    changed();
  },

  async saveEvent(b, eventId, data) {
    if (!isMgmt(b)) deny();
    const id = eventId || 'e-' + randomCode(8);
    db.events[b][id] = clone(data);
    changed();
    return id;
  },
  async deleteEvent(b, eventId) { if (!isMgmt(b)) deny(); delete db.events[b][eventId]; changed(); },

  async createInvite(u, band) {
    if (!isMgmt(band.id)) deny();
    const code = randomCode();
    if (band.inviteCode) delete db.invites[band.inviteCode];
    db.invites[code] = { bandId: band.id, bandName: band.name, createdBy: u };
    db.bands[band.id].inviteCode = code;
    changed();
    return code;
  },
  async getInvite(code) { return db.invites[code] ? { code, ...clone(db.invites[code]) } : null; },
  async joinBand(u, invite, me) {
    if (!db.invites[invite.code] || db.invites[invite.code].bandId !== invite.bandId) deny();
    db.members[invite.bandId][u] = { role: 'member', name: me.name, instrument: me.instrument || '', invite: invite.code };
    const p = db.users[u] || (db.users[u] = {});
    p.bandIds = Array.from(new Set([...(p.bandIds || []), invite.bandId]));
    changed();
  }
};
