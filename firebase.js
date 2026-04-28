import { auth, db } from './firebase.config.js';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "firebase/auth";
import { ref, get, update, set } from "firebase/database";

const _user = uid => `users/${uid}`;
const _lvl = (uid, n) => `users/${uid}/G/CP/L/L${n}`;
const _skin = uid => `users/${uid}/G/CP/C/S`;

const signInGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
const signOutUser = () => auth.signOut();
const currentUser = () => auth.currentUser;

function onAuthChange(cb) {
  onAuthStateChanged(auth, async user => {
    if (user) await _ensureDefaults(user);
    cb(user);
  });
}

async function _ensureDefaults(user) {
  try {
    const snap = await get(ref(db, _user(user.uid)));
    const val = snap.exists() ? (snap.val() || {}) : {};
    const up = {};
    if (!val.name) up.name = user.displayName || 'Anonymous';
    if (!val.photo && user.photoURL) up.photo = user.photoURL;
    if (!val.G?.CP?.C?.S?.eq) up['G/CP/C/S/eq'] = 'default';
    if (!val.G?.CP?.C?.S?.own?.default) up['G/CP/C/S/own/default'] = true;
    if (Object.keys(up).length) await update(ref(db, _user(user.uid)), up);
  } catch (e) {
    console.warn('[FB] _ensureDefaults:', e.message);
  }
}

async function getProfile(uid) {
  try {
    const s = await get(ref(db, _user(uid)));
    return s.exists() ? (s.val() || {}) : {};
  } catch (e) {
    console.warn('[FB] getProfile:', e.message);
    return {};
  }
}

async function saveProfile(uid, name, photo) {
  const u = {};
  if (name != null) u.name = name;
  if (photo != null) u.photo = photo;
  await update(ref(db, _user(uid)), u);
}

async function getSkinData(uid) {
  try {
    const s = await get(ref(db, _skin(uid)));
    if (!s.exists()) return { eq: 'default', own: { default: true } };
    const v = s.val() || {};
    return { eq: v.eq || 'default', own: v.own || { default: true } };
  } catch {
    return { eq: 'default', own: { default: true } };
  }
}

async function equipSkin(uid, skinId) {
  await set(ref(db, `${_skin(uid)}/eq`), skinId);
}

async function unlockSkin(uid, skinId) {
  await set(ref(db, `${_skin(uid)}/own/${skinId}`), true);
}

async function saveLevelTime(uid, levelNum, seconds) {
  try {
    const snap = await get(ref(db, _lvl(uid, levelNum)));
    const t = Math.round(seconds * 1000) / 1000;
    const prev = snap.exists() ? snap.val().t : null;
    const isRecord = prev === null || t < prev;

    if (isRecord) {
      const profile = await getProfile(uid);
      const name = profile.name || currentUser()?.displayName || 'Anonymous';
      const photo = profile.photo || currentUser()?.photoURL || '';
      const ts = Date.now();

      await update(ref(db), {
        [_lvl(uid, levelNum)]: { t, ts },
        [`users/${uid}/G/CP/LB/L${levelNum}`]: { t, ts, name, photo }
      });

      const UNLOCKS = { 2:'ghost', 4:'neon', 6:'fire', 8:'void', 10:'rainbow' };
      if (UNLOCKS[levelNum]) unlockSkin(uid, UNLOCKS[levelNum]).catch(() => {});
    }

    return { saved: isRecord, isRecord, prev };
  } catch (e) {
    console.error('[FB] saveLevelTime FAILED:', e.code, e.message);
    return { saved: false, isRecord: false, prev: null };
  }
}

async function getMyTimes(uid) {
  try {
    const s = await get(ref(db, `users/${uid}/G/CP/L`));
    return s.exists() ? (s.val() || {}) : {};
  } catch (e) {
    console.warn('[FB] getMyTimes:', e.message);
    return {};
  }
}

async function getLeaderboard(levelNum) {
  try {
    const usersSnap = await get(ref(db, 'users'));
    if (!usersSnap.exists()) return [];

    const rows = [];
    usersSnap.forEach(userSnap => {
      const uid = userSnap.key;
      const v = userSnap.child(`G/CP/L/L${levelNum}`).val();
      if (v && typeof v.t === 'number') {
        rows.push({
          uid,
          name: userSnap.child('name').val() || 'Anonymous',
          photo: userSnap.child('photo').val() || '',
          t: v.t,
          ts: v.ts || 0
        });
      }
    });

    rows.sort((a, b) => a.t - b.t);
    return rows;
  } catch (e) {
    console.error('[FB] getLeaderboard:', e.message);
    return [];
  }
}

window.FB = {
  signInGoogle,
  signOut: signOutUser,
  onAuthChange,
  currentUser,
  getProfile,
  saveProfile,
  getSkinData,
  equipSkin,
  unlockSkin,
  saveLevelTime,
  getMyTimes,
  getLeaderboard
};

console.log('[FB] loaded ✓ users-only, no root LB');