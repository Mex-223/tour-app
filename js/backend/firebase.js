// Real backend: Firebase (logins + live database).
// Every phone talks to the same Firestore database, so changes show up everywhere.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail,
  updateProfile, signOut as fbSignOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, collection, onSnapshot, getDoc, setDoc, updateDoc, deleteDoc, writeBatch,
  arrayUnion, arrayRemove, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from '../firebase-config.js';
import { randomCode } from './shared.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Keeps a copy of the data on the phone, so the app works without signal
// and syncs changes once it's back online.
let db;
try {
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch (e) {
  db = initializeFirestore(app, {});
}

const userRef = (uid) => doc(db, 'users', uid);
const bandRef = (bandId) => doc(db, 'bands', bandId);
const memberRef = (bandId, uid) => doc(db, 'bands', bandId, 'members', uid);
const eventsCol = (bandId) => collection(db, 'bands', bandId, 'events');
const inviteRef = (code) => doc(db, 'invites', code);

// Writes are saved on the phone immediately and sent to Firebase in the background
// (so the app never hangs without signal). Problems are reported via onWriteError.
function w(promise) {
  promise.catch((err) => { if (backend.onWriteError) backend.onWriteError(err); });
}

const asUser = (u) => (u ? { uid: u.uid, email: u.email || '', displayName: u.displayName || '' } : null);

export const backend = {
  kind: 'firebase',

  onAuth(cb) { return onAuthStateChanged(auth, (u) => cb(asUser(u))); },
  async signInGoogle() { await signInWithPopup(auth, new GoogleAuthProvider()); },
  async signInEmail(email, password) { await signInWithEmailAndPassword(auth, email, password); },
  async signUpEmail(email, password, name) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name) {
      w(setDoc(userRef(cred.user.uid), { name, email }, { merge: true }));
      updateProfile(cred.user, { displayName: name }).catch(() => {});
    }
  },
  async resetPassword(email) { await sendPasswordResetEmail(auth, email); },
  async signOut() { await fbSignOut(auth); },

  watchProfile(uid, cb, onError) {
    return onSnapshot(userRef(uid), (s) => cb(s.exists() ? s.data() : null), onError);
  },
  async saveProfile(uid, data) { w(setDoc(userRef(uid), data, { merge: true })); },

  watchBand(bandId, cb, onError) {
    // 2nd argument: true when the server itself confirmed it (not just the copy on the phone)
    return onSnapshot(bandRef(bandId), { includeMetadataChanges: true },
      (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null, !s.metadata.fromCache && !s.metadata.hasPendingWrites), onError);
  },
  watchMembers(bandId, cb, onError) {
    return onSnapshot(collection(db, 'bands', bandId, 'members'), (q) => cb(q.docs.map((d) => ({ uid: d.id, ...d.data() }))), onError);
  },
  // ---------- Team contacts & documents (step 3) ----------
  watchList(bandId, name, cb, onError) {
    return onSnapshot(collection(db, 'bands', bandId, name), (q) => cb(q.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
  },
  async saveItem(bandId, name, id, data) {
    const ref = id ? doc(db, 'bands', bandId, name, id) : doc(collection(db, 'bands', bandId, name));
    w(setDoc(ref, { ...data, updatedAt: serverTimestamp() }));
    return ref.id;
  },
  async deleteItem(bandId, name, id) { w(deleteDoc(doc(db, 'bands', bandId, name, id))); },
  watchAway(bandId, cb, onError) {
    return onSnapshot(collection(db, 'bands', bandId, 'away'), (q) => cb(q.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
  },
  // "Not available" dates: one copy per band (same id), so every band sees them.
  async addAway(uid, bandIds, data) {
    const id = randomCode(12);
    const batch = writeBatch(db);
    bandIds.forEach((b) => batch.set(doc(db, 'bands', b, 'away', id), { ...data, uid, createdAt: serverTimestamp() }));
    w(batch.commit());
    return id;
  },
  async copyAway(bandId, period) {
    const { id, bands: _b, ...data } = period;
    w(setDoc(doc(db, 'bands', bandId, 'away', id), { from: data.from, to: data.to, note: data.note || '', name: data.name || '', uid: data.uid }));
  },
  async removeAway(bandIds, id) {
    const batch = writeBatch(db);
    bandIds.forEach((b) => batch.delete(doc(db, 'bands', b, 'away', id)));
    w(batch.commit());
  },
  async acceptSuggestion(bandId, eventId) {
    w(updateDoc(doc(db, 'bands', bandId, 'events', eventId), { suggested: false, updatedAt: serverTimestamp() }));
  },
  watchEvents(bandId, cb, onError) {
    return onSnapshot(eventsCol(bandId), (q) => cb(q.docs.map((d) => ({ id: d.id, band: bandId, ...d.data() }))), onError);
  },

  async createBand(uid, { name, color }, me) {
    const ref = doc(collection(db, 'bands'));
    const batch = writeBatch(db);
    batch.set(ref, { name, color, createdBy: uid, inviteCode: null, createdAt: serverTimestamp() });
    batch.set(memberRef(ref.id, uid), { role: 'mgmt', name: me.name, instrument: me.instrument || '' });
    batch.set(userRef(uid), { bandIds: arrayUnion(ref.id) }, { merge: true });
    w(batch.commit());
    return ref.id;
  },
  async updateBand(bandId, data) { w(updateDoc(bandRef(bandId), data)); },
  async transferOwnership(bandId, uid) { w(updateDoc(bandRef(bandId), { createdBy: uid })); },
  async setMemberRole(bandId, uid, role) { w(updateDoc(memberRef(bandId, uid), { role })); },
  async removeMember(bandId, uid) { w(deleteDoc(memberRef(bandId, uid))); },
  async updateMyMemberInfo(uid, bandIds, info) {
    bandIds.forEach((b) => updateDoc(memberRef(b, uid), info).catch(() => {}));
  },
  async leaveBand(uid, bandId) {
    const batch = writeBatch(db);
    batch.delete(memberRef(bandId, uid));
    batch.set(userRef(uid), { bandIds: arrayRemove(bandId) }, { merge: true });
    w(batch.commit());
  },
  // Owner alone in a band: remove the band completely.
  async deleteBand(uid, bandId) {
    const batch = writeBatch(db);
    batch.delete(memberRef(bandId, uid));
    batch.delete(bandRef(bandId));
    batch.set(userRef(uid), { bandIds: arrayRemove(bandId) }, { merge: true });
    w(batch.commit());
  },
  async forgetBand(uid, bandId) {
    w(setDoc(userRef(uid), { bandIds: arrayRemove(bandId) }, { merge: true }));
  },

  async saveEvent(bandId, eventId, data) {
    if (eventId) {
      w(setDoc(doc(db, 'bands', bandId, 'events', eventId), { ...data, updatedAt: serverTimestamp() }));
      return eventId;
    }
    const ref = doc(eventsCol(bandId));
    w(setDoc(ref, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    return ref.id;
  },
  async deleteEvent(bandId, eventId) { w(deleteDoc(doc(db, 'bands', bandId, 'events', eventId))); },

  // Invite link: one active code per band. A new link makes the old one stop working.
  async createInvite(uid, band) {
    const code = randomCode();
    const batch = writeBatch(db);
    batch.set(inviteRef(code), { bandId: band.id, bandName: band.name, createdBy: uid, createdAt: serverTimestamp() });
    if (band.inviteCode) batch.delete(inviteRef(band.inviteCode));
    batch.update(bandRef(band.id), { inviteCode: code });
    w(batch.commit());
    return code;
  },
  async getInvite(code) {
    const s = await getDoc(inviteRef(code));
    return s.exists() ? { code, ...s.data() } : null;
  },
  async joinBand(uid, invite, me) {
    const batch = writeBatch(db);
    batch.set(memberRef(invite.bandId, uid), { role: 'member', name: me.name, instrument: me.instrument || '', invite: invite.code });
    batch.set(userRef(uid), { bandIds: arrayUnion(invite.bandId) }, { merge: true });
    w(batch.commit());
  }
};
