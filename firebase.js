// firebase.js
// ═══════════════════════════════════════════════════════════════════
//  DB SHAPE:
//  users/{uid}/
//    name  : "PlayerName"
//    photo : "https://..."
//    G/                          Games
//      CP/                       CubePlatformer
//        C/S/                    Collection → Skins
//          eq   : "default"      equipped skin id
//          own/ : { default:true, ghost:true, ... }
//        L/                      Levels
//          L1 : { t, ts }        t = seconds, ts = epoch ms
//          L2 : { t, ts }
//
//  LB/CP/{1..10}/{uid}/          Leaderboard (fast reads)
//    { t, ts, name, photo }
//
// ── PASTE THESE RULES IN Firebase Console → RTDB → Rules ──────────
// {
//   "rules": {
//     "users": {
//       "$uid": {
//         ".read":  "$uid === auth.uid",
//         ".write": "$uid === auth.uid"
//       }
//     },
//     "LB": {
//       "CP": {
//         "$level": {
//           ".read": "auth != null",
//           ".indexOn": ["t"],
//           "$uid": { ".write": "$uid === auth.uid" }
//         }
//       }
//     }
//   }
// }
// ═══════════════════════════════════════════════════════════════════

if (typeof firebase === 'undefined')
  throw new Error('[FB] Load Firebase SDK <script> tags BEFORE firebase.js');

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

// ── PATH HELPERS ──────────────────────────────────────────────────────────────
const _lvl  = (uid, n) => `users/${uid}/G/CP/L/L${n}`;
const _skin = (uid)    => `users/${uid}/G/CP/C/S`;
const _lb   = (uid, n) => `LB/CP/${n}/${uid}`;

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

// ── FIRST SIGN-IN DEFAULTS ────────────────────────────────────────────────────
async function _ensureDefaults(user) {
  try {
    const snap = await db.ref(`users/${user.uid}`).get();
    const val  = snap.exists() ? (snap.val() || {}) : {};
    const up   = {};
    if (!val.name)                       up.name                    = user.displayName || 'Anonymous';
    if (!val.photo && user.photoURL)     up.photo                   = user.photoURL;
    if (!val.G?.CP?.C?.S?.eq)            up['G/CP/C/S/eq']          = 'default';
    if (!val.G?.CP?.C?.S?.own?.default)  up['G/CP/C/S/own/default'] = true;
    if (Object.keys(up).length) await db.ref(`users/${user.uid}`).update(up);
  } catch (e) { console.warn('[FB] _ensureDefaults:', e.message); }
}

// ── PROFILE ───────────────────────────────────────────────────────────────────
async function getProfile(uid) {
  try {
    const s = await db.ref(`users/${uid}`).get();
    return s.exists() ? (s.val() || {}) : {};
  } catch (e) { console.warn('[FB] getProfile:', e.message); return {}; }
}

async function saveProfile(uid, name, photo) {
  const u = {};
  if (name  != null) u.name  = name;
  if (photo != null) u.photo = photo;
  await db.ref(`users/${uid}`).update(u);
}

// ── SKINS  →  users/{uid}/G/CP/C/S/ ──────────────────────────────────────────
async function getSkinData(uid) {
  try {
    const s = await db.ref(_skin(uid)).get();
    if (!s.exists()) return { eq: 'default', own: { default: true } };
    const v = s.val() || {};
    return { eq: v.eq || 'default', own: v.own || { default: true } };
  } catch (e) { return { eq: 'default', own: { default: true } }; }
}

async function equipSkin(uid, skinId) {
  await db.ref(`${_skin(uid)}/eq`).set(skinId);
}

async function unlockSkin(uid, skinId) {
  await db.ref(`${_skin(uid)}/own/${skinId}`).set(true);
}

// ── SAVE TIME  →  users/{uid}/G/CP/L/L{n}  +  LB/CP/{n}/{uid} ───────────────
// Returns { saved, isRecord, prev }
async function saveLevelTime(uid, levelNum, seconds) {
  try {
    const snap     = await db.ref(_lvl(uid, levelNum)).get();
    const t        = Math.round(seconds * 1000) / 1000;
    const prev     = snap.exists() ? snap.val().t : null;
    const isRecord = prev === null || t < prev;

    if (isRecord) {
      const profile = await getProfile(uid);
      const name    = profile.name  || currentUser()?.displayName || 'Anonymous';
      const photo   = profile.photo || currentUser()?.photoURL    || '';
      const ts      = Date.now();

      // Atomic write to both paths
      await db.ref().update({
        [_lvl(uid, levelNum)]: { t, ts },
        [_lb (uid, levelNum)]: { t, ts, name, photo }
      });

      // Milestone skin unlocks
      const UNLOCKS = { 2:'ghost', 4:'neon', 6:'fire', 8:'void', 10:'rainbow' };
      if (UNLOCKS[levelNum]) unlockSkin(uid, UNLOCKS[levelNum]).catch(() => {});

      console.log(`[FB] ✓ L${levelNum} new PB: ${t}s`);
    } else {
      console.log(`[FB] L${levelNum}: ${t}s (best stays ${prev}s)`);
    }

    return { saved: isRecord, isRecord, prev };

  } catch (e) {
    console.error('[FB] saveLevelTime FAILED:', e.code, e.message);
    if (e.code === 'PERMISSION_DENIED')
      console.error('[FB] → Paste the Rules block from the top of firebase.js into Firebase Console → RTDB → Rules');
    return { saved: false, isRecord: false, prev: null };
  }
}

// ── GET MY TIMES  →  users/{uid}/G/CP/L/ ─────────────────────────────────────
// Returns { L1:{ t,ts }, L2:{ t,ts }, ... }
async function getMyTimes(uid) {
  try {
    const s = await db.ref(`users/${uid}/G/CP/L`).get();
    return s.exists() ? (s.val() || {}) : {};
  } catch (e) { console.warn('[FB] getMyTimes:', e.message); return {}; }
}

// ── LEADERBOARD  →  LB/CP/{levelNum}/ ────────────────────────────────────────
// Requires .indexOn: ["t"] in Rules (see header). THROWS on error.
// Returns [{ uid, name, photo, t, ts }, ...] sorted asc by t
async function getLeaderboard(levelNum) {
  const snap = await db.ref(`LB/CP/${levelNum}`)
    .orderByChild('t')
    .limitToFirst(200)
    .get();
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
console.log('[FB] loaded ✓  shape: G/CP/{C/S + L}  |  LB/CP');