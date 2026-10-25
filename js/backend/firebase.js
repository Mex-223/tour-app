// Real backend: Firebase (logins + live database).
// Every phone talks to the same Firestore database, so changes show up everywhere.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail,
  updateProfile, signOut as fbSignOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeFirestore, getFirestore, terminate, persistentLocalCache, persistentMultipleTabManager,
  doc, collection, onSnapshot, getDoc, setDoc, updateDoc, deleteDoc, writeBatch,
  arrayUnion, arrayRemove, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from '../firebase-config.js';
import { randomCode } from './shared.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Keeps a copy of the data on the phone, so the app works without signal
// and syncs changes once it's back online.
function makeDb() {
  try {
    return initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch (e) {
    try { return initializeFirestore(app, {}); } catch (e2) { return getFirestore(app); }
  }
}
let db = makeDb();

// iPhones sometimes close the app's local storage while it's in the background.
// Firebase then shuts its connection down ("The client has already been terminated").
// We detect that, open a fresh connection and repeat what was being done.
const isTerminated = (err) => /terminated/i.test((err && (err.message || err.code)) || '');
function alive() {
  // Making an (unused) batch asks Firebase whether the connection is still open.
  try { writeBatch(db); return true; } catch (e) { return !isTerminated(e); }
}
let resets = [];
function reconnect() {
  if (alive()) return true;
  // Safety net against endless loops: at most 3 reconnects within 30 seconds.
  const now = Date.now();
  resets = resets.filter((t) => now - t < 30000);
  if (resets.length >= 3) { if (backend.onFatal) backend.onFatal(); return false; }
  resets.push(now);
  try { terminate(db).catch(() => {}); } catch (e) { /* already gone */ }
  db = makeDb();
  if (!alive()) {
    // Couldn't get a fresh connection: let the app reload (it keeps the form filled in).
    if (backend.onFatal) backend.onFatal();
    return false;
  }
  if (backend.onReset) setTimeout(() => backend.onReset(), 0); // restart live updates
  return true;
}
function ensureAlive() { if (!alive()) reconnect(); }

// Run something that talks to Firebase; if the connection was shut down, reconnect and try once more.
function withRetry(fn) {
  ensureAlive();
  try {
    return Promise.resolve(fn()).catch((err) => {
      if (isTerminated(err) && reconnect()) return fn();
      throw err;
    });
  } catch (err) {
    if (isTerminated(err) && reconnect()) return Promise.resolve(fn());
    return Promise.reject(err);
  }
}

// Listen for live updates; if the connection dies, reconnect (the app then restarts all listeners).
function listen(makeRef, opts, onNext, onError) {
  const handleError = (err) => {
    if (isTerminated(err)) { reconnect(); return; }
    if (onError) onError(err);
  };
  const start = () => (opts ? onSnapshot(makeRef(), opts, onNext, handleError) : onSnapshot(makeRef(), onNext, handleError));
  try { return start(); } catch (err) {
    if (isTerminated(err) && reconnect()) return start();
    throw err;
  }
}

// Writes are saved on the phone immediately and sent to Firebase in the background
// (so the app never hangs without signal). Problems are reported via onWriteError.
function w(fn) {
  withRetry(fn).catch((err) => { if (backend.onWriteError) backend.onWriteError(err); });
}
// New document ids are made up front, so a repeated save uses the same id.
const newId = () => randomCode(20);

const asUser = (u) => (u ? { uid: u.uid, email: u.email || '', displayName: u.displayName || '' } : null);

// Refs are always made from the *current* connection (db can be replaced after a reconnect).
const userRef = (uid) => doc(db, 'users', uid);
const bandRef = (bandId) => doc(db, 'bands', bandId);
const memberRef = (bandId, uid) => doc(db, 'bands', bandId, 'members', uid);
const sub = (bandId, name, id) => (id ? doc(db, 'bands', bandId, name, id) : collection(db, 'bands', bandId, name));
const inviteRef = (code) => doc(db, 'invites', code);
const rows = (q, extra = {}) => q.docs.map((d) => ({ id: d.id, ...extra, ...d.data() }));

export const backend = {
  kind: 'firebase',

  // Called by the app: check the connection (e.g. when the app comes back from the background)
  checkConnection() { ensureAlive(); },

  onAuth(cb) { return onAuthStateChanged(auth, (u) => cb(asUser(u))); },
  async signInGoogle() { await signInWithPopup(auth, new GoogleAuthProvider()); },
  async signInEmail(email, password) { await signInWithEmailAndPassword(auth, email, password); },
  async signUpEmail(email, password, name) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name) {
      w(() => setDoc(userRef(cred.user.uid), { name, email }, { merge: true }));
      updateProfile(cred.user, { displayName: name }).catch(() => {});
    }
  },
  async resetPassword(email) { await sendPasswordResetEmail(auth, email); },
  async signOut() { await fbSignOut(auth); },

  watchProfile(uid, cb, onError) {
    return listen(() => userRef(uid), null, (s) => cb(s.exists() ? s.data() : null), onError);
  },
  async saveProfile(uid, data) { w(() => setDoc(userRef(uid), data, { merge: true })); },

  watchBand(bandId, cb, onError) {
    // 2nd argument: true when the server itself confirmed it (not just the copy on the phone)
    return listen(() => bandRef(bandId), { includeMetadataChanges: true },
      (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null, !s.metadata.fromCache && !s.metadata.hasPendingWrites), onError);
  },
  watchMembers(bandId, cb, onError) {
    return listen(() => sub(bandId, 'members'), null, (q) => cb(q.docs.map((d) => ({ uid: d.id, ...d.data() }))), onError);
  },
  watchEvents(bandId, cb, onError) {
    return listen(() => sub(bandId, 'events'), null, (q) => cb(rows(q, { band: bandId })), onError);
  },
  // ---------- Team contacts & documents ----------
  watchList(bandId, name, cb, onError) {
    return listen(() => sub(bandId, name), null, (q) => cb(rows(q)), onError);
  },
  async saveItem(bandId, name, id, data) {
    const key = id || newId();
    w(() => setDoc(sub(bandId, name, key), { ...data, updatedAt: serverTimestamp() }));
    return key;
  },
  async deleteItem(bandId, name, id) { w(() => deleteDoc(sub(bandId, name, id))); },

  // ---------- "Not available" dates: one copy per band (same id), so every band sees them ----------
  watchAway(bandId, cb, onError) {
    return listen(() => sub(bandId, 'away'), null, (q) => cb(rows(q)), onError);
  },
  async addAway(uid, bandIds, data) {
    const id = randomCode(12);
    w(() => {
      const batch = writeBatch(db);
      bandIds.forEach((b) => batch.set(sub(b, 'away', id), { ...data, uid, createdAt: serverTimestamp() }));
      return batch.commit();
    });
    return id;
  },
  async copyAway(bandId, period) {
    w(() => setDoc(sub(bandId, 'away', period.id), { from: period.from, to: period.to, note: period.note || '', name: period.name || '', uid: period.uid }));
  },
  async removeAway(bandIds, id) {
    w(() => {
      const batch = writeBatch(db);
      bandIds.forEach((b) => batch.delete(sub(b, 'away', id)));
      return batch.commit();
    });
  },

  // ---------- Bands & members ----------
  async createBand(uid, { name, color }, me) {
    const id = newId();
    w(() => {
      const batch = writeBatch(db);
      batch.set(bandRef(id), { name, color, createdBy: uid, inviteCode: null, createdAt: serverTimestamp() });
      batch.set(memberRef(id, uid), { role: 'mgmt', name: me.name, instrument: me.instrument || '' });
      batch.set(userRef(uid), { bandIds: arrayUnion(id) }, { merge: true });
      return batch.commit();
    });
    return id;
  },
  async updateBand(bandId, data) { w(() => updateDoc(bandRef(bandId), data)); },
  async transferOwnership(bandId, uid) { w(() => updateDoc(bandRef(bandId), { createdBy: uid })); },
  async setMemberRole(bandId, uid, role) { w(() => updateDoc(memberRef(bandId, uid), { role })); },
  async removeMember(bandId, uid) { w(() => deleteDoc(memberRef(bandId, uid))); },
  async updateMyMemberInfo(uid, bandIds, info) {
    bandIds.forEach((b) => withRetry(() => updateDoc(memberRef(b, uid), info)).catch(() => {}));
  },
  async leaveBand(uid, bandId) {
    w(() => {
      const batch = writeBatch(db);
      batch.delete(memberRef(bandId, uid));
      batch.set(userRef(uid), { bandIds: arrayRemove(bandId) }, { merge: true });
      return batch.commit();
    });
  },
  // Owner alone in a band: remove the band completely.
  async deleteBand(uid, bandId) {
    w(() => {
      const batch = writeBatch(db);
      batch.delete(memberRef(bandId, uid));
      batch.delete(bandRef(bandId));
      batch.set(userRef(uid), { bandIds: arrayRemove(bandId) }, { merge: true });
      return batch.commit();
    });
  },
  async forgetBand(uid, bandId) {
    w(() => setDoc(userRef(uid), { bandIds: arrayRemove(bandId) }, { merge: true }));
  },

  // ---------- Events ----------
  async saveEvent(bandId, eventId, data) {
    if (eventId) {
      w(() => setDoc(sub(bandId, 'events', eventId), { ...data, updatedAt: serverTimestamp() }));
      return eventId;
    }
    const id = newId();
    w(() => setDoc(sub(bandId, 'events', id), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    return id;
  },
  async deleteEvent(bandId, eventId) { w(() => deleteDoc(sub(bandId, 'events', eventId))); },
  async acceptSuggestion(bandId, eventId) {
    w(() => updateDoc(sub(bandId, 'events', eventId), { suggested: false, updatedAt: serverTimestamp() }));
  },

  // ---------- Invite links: one active code per band; a new link makes the old one stop working ----------
  async createInvite(uid, band) {
    const code = randomCode();
    w(() => {
      const batch = writeBatch(db);
      batch.set(inviteRef(code), { bandId: band.id, bandName: band.name, createdBy: uid, createdAt: serverTimestamp() });
      if (band.inviteCode) batch.delete(inviteRef(band.inviteCode));
      batch.update(bandRef(band.id), { inviteCode: code });
      return batch.commit();
    });
    return code;
  },
  async getInvite(code) {
    const s = await withRetry(() => getDoc(inviteRef(code)));
    return s.exists() ? { code, ...s.data() } : null;
  },
  async joinBand(uid, invite, me) {
    w(() => {
      const batch = writeBatch(db);
      batch.set(memberRef(invite.bandId, uid), { role: 'member', name: me.name, instrument: me.instrument || '', invite: invite.code });
      batch.set(userRef(uid), { bandIds: arrayUnion(invite.bandId) }, { merge: true });
      return batch.commit();
    });
  }
};
