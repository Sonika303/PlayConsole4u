// firebase.js
// ═══════════════════════════════════════════════
//  DB SHAPE:
//  users/{uid}/
//    name                       → "PlayerName"
//    photo                      → "https://..."
//    C/S/                       → Collection / Skins
//      eq   : "default"         → equipped skin
//      own/ : { default:true }  → owned skins
//    G/CP/L/                    → Games / CubePlatformer / Levels
//      L1  : { t, ts }
//      L2  : { t, ts }
//
//  LB/CP/{levelNum}/{uid}/      → Leaderboard (fast reads)
//      { t, ts, name, photo }
//
// ── FIREBASE RULES (paste in Console → RTDB → Rules) ──
// {
//   "rules": {
//     "users": {
//       "$uid": {
//         ".read":  "$uid === auth.uid",
//         ".write": "$uid === auth.uid"
//       }
//     },
//     "LB": {
//       ".read": "auth != null",
//       "CP": {
//         "$lvl": {
//           "$uid": { ".write": "$uid === auth.uid" }
//         }
//       }
//     }
//   }
// }
// ═══════════════════════════════════════════════

if (typeof firebase === 'undefined')
  throw new Error('[FB] Load Firebase SDK scripts BEFORE firebase.js');

if (!firebase.apps.length)
  firebase.initializeApp({
    apiKey:            'AIzaSyC_fNfUQUcdhicNNx-e0weEGURbz-mZs8g',
    authDomain:        'playconsole4u.firebaseapp.com',
    databaseURL:       'https://playconsole4u-default-rtdb.firebaseio.com',
    projectId:         'playconsole4u',
    storageBucket:     'playconsole4u.firebasestorage.app',
    messagingSenderId: '383598421108',
    appId:             '1:383598421108:web:12767cf3738cef9d8a9d21'
  });

const auth = firebase.auth();
const db   = firebase.database();

// ── helpers ───────────────────────────────────────────────────────────────────
function _lvlPath(uid, n) { return `users/${uid}/G/CP/L/L${n}`; }
function _lbPath (uid, n) { return `LB/CP/${n}/${uid}`; }

function _logErr(fn, e) {
  console.error(`[FB] ${fn}:`, e.code || '', e.message);
  if (e.code === 'PERMISSION_DENIED')
    console.error('[FB] → Fix: paste the Rules block shown at the top of firebase.js into Firebase Console → Realtime Database → Rules');
}

// ── AUTO SETUP (first sign-in) ────────────────────────────────────────────────
async function _ensureDefaults(user) {
  try {
    const snap = await db.ref(`users/${user.uid}`).get();
    const val  = snap.exists() ? (snap.val() || {}) : {};
    const up   = {};
    if (!val.name)                   up.name         = user.displayName || 'Anonymous';
    if (!val.photo && user.photoURL) up.photo        = user.photoURL;
    if (!val.C?.S?.eq)               up['C/S/eq']    = 'default';
    if (!val.C?.S?.own?.default)     up['C/S/own/default'] = true;
    if (Object.keys(up).length) await db.ref(`users/${user.uid}`).update(up);
  } catch (e) { console.warn('[FB] _ensureDefaults:', e.message); }
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
const signInGoogle = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
const signOut      = () => auth.signOut();
const currentUser  = () => auth.currentUser;

function onAuthChange(cb) {
  auth.onAuthStateChanged(async user => {
    if (user) await _ensureDefaults(user);
    cb(user);
  });
}

// ── PROFILE ───────────────────────────────────────────────────────────────────
async function getProfile(uid) {
  try {
    const s = await db.ref(`users/${uid}`).get();
    return s.exists() ? (s.val() || {}) : {};
  } catch (e) { _logErr('getProfile', e); return {}; }
}

async function saveProfile(uid, name, photo) {
  const u = {};
  if (name  != null) u.name  = name;
  if (photo != null) u.photo = photo;
  await db.ref(`users/${uid}`).update(u);
}

// ── SKINS ─────────────────────────────────────────────────────────────────────
async function getSkinData(uid) {
  try {
    const s = await db.ref(`users/${uid}/C/S`).get();
    if (!s.exists()) return { eq: 'default', own: { default: true } };
    const v = s.val() || {};
    return { eq: v.eq || 'default', own: v.own || { default: true } };
  } catch (e) { return { eq: 'default', own: { default: true } }; }
}

async function equipSkin(uid, skinId) {
  await db.ref(`users/${uid}/C/S/eq`).set(skinId);
}

async function unlockSkin(uid, skinId) {
  await db.ref(`users/${uid}/C/S/own/${skinId}`).set(true);
}

// ── SAVE TIME  →  users/{uid}/G/CP/L/L{n}  +  LB/CP/{n}/{uid} ───────────────
// Returns { saved, isRecord, prev }
async function saveLevelTime(uid, levelNum, seconds) {
  try {
    const snap     = await db.ref(_lvlPath(uid, levelNum)).get();
    const t        = Math.round(seconds * 1000) / 1000;   // 3 decimal places
    const prev     = snap.exists() ? snap.val().t : null;
    const isRecord = prev === null || t < prev;

    if (isRecord) {
      const profile = await getProfile(uid);
      const name    = profile.name  || currentUser()?.displayName || 'Anonymous';
      const photo   = profile.photo || currentUser()?.photoURL    || '';
      const ts      = Date.now();

      await db.ref().update({
        [_lvlPath(uid, levelNum)]: { t, ts },
        [_lbPath (uid, levelNum)]: { t, ts, name, photo }
      });

      // Milestone skin unlocks
      const UNLOCKS = { 2:'ghost', 4:'neon', 6:'fire', 8:'void', 10:'rainbow' };
      if (UNLOCKS[levelNum]) unlockSkin(uid, UNLOCKS[levelNum]).catch(() => {});

      console.log(`[FB] ✓ L${levelNum} new PB: ${t}s`);
    }

    return { saved: isRecord, isRecord, prev };

  } catch (e) {
    _logErr('saveLevelTime', e);
    return { saved: false, isRecord: false, prev: null };
  }
}

// ── GET MY TIMES  →  users/{uid}/G/CP/L ──────────────────────────────────────
// Returns { L1:{ t,ts }, L2:{ t,ts }, ... }
async function getMyTimes(uid) {
  try {
    const s = await db.ref(`users/${uid}/G/CP/L`).get();
    return s.exists() ? (s.val() || {}) : {};
  } catch (e) { console.warn('[FB] getMyTimes:', e.message); return {}; }
}

// ── LEADERBOARD  →  LB/CP/{levelNum} ─────────────────────────────────────────
// Returns [{ uid, name, photo, t, ts }, ...] sorted asc
async function getLeaderboard(levelNum) {
  const snap = await db.ref(`LB/CP/${levelNum}`)
    .orderByChild('t').limitToFirst(200).get();   // throws on PERMISSION_DENIED
  if (!snap.exists()) return [];
  const rows = [];
  snap.forEach(c => {
    const v = c.val();
    rows.push({ uid: c.key, name: v.name || 'Anonymous', photo: v.photo || '', t: v.t, ts: v.ts || 0 });
  });
  rows.sort((a, b) => a.t - b.t);
  return rows;
}

// ── EXPORT ────────────────────────────────────────────────────────────────────
window.FB = {
  signInGoogle, signOut, onAuthChange, currentUser,
  getProfile, saveProfile,
  getSkinData, equipSkin, unlockSkin,
  saveLevelTime, getMyTimes,
  getLeaderboard
};
console.log('[FB] loaded ✓  shape: users/G/CP/L  |  LB/CP  |  C/S skins');