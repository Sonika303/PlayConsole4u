// firebase.js
// ════════════════════════════════════════════════════════════════
//  NEW DB SHAPE:
//  users/{uid}/
//    name   : "PlayerName"
//    photo  : "https://..."
//    C/                        ← Collection
//      S/                      ← Skins
//        eq  : "default"       ← equipped skin id
//        own/                  ← unlocked skin ids
//          default : true
//          ghost   : true
//    D/                        ← Data
//      CubePlatformer/
//        L/                    ← Levels
//          L1 : { t, ts }      ← t = seconds (float), ts = epoch ms
//          L2 : { t, ts }
//
//  LB/                         ← Leaderboard (top-level, fast reads, no full scan)
//    CubePlatformer/
//      1/  { uid: { t, ts, name, photo } }
//      2/  { uid: { t, ts, name, photo } }
//
// ════════════════════════════════════════════════════════════════
// PASTE THESE RULES IN Firebase Console → Realtime DB → Rules:
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
//       "CubePlatformer": {
//         "$level": {
//           "$uid": { ".write": "$uid === auth.uid" }
//         }
//       }
//     }
//   }
// }
// ════════════════════════════════════════════════════════════════

if (typeof firebase === 'undefined')
  throw new Error('[FB] Firebase SDK scripts must be loaded BEFORE firebase.js');

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

// ── AUTH ──────────────────────────────────────────────────────────────────────
const signInGoogle = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
const signOut      = () => auth.signOut();
const currentUser  = () => auth.currentUser;

function onAuthChange(cb) {
  auth.onAuthStateChanged(async user => {
    if (user) await _ensureDefaults(user).catch(e => console.warn('[FB] ensureDefaults:', e.message));
    cb(user);
  });
}

// ── DEFAULT DATA SETUP ────────────────────────────────────────────────────────
async function _ensureDefaults(user) {
  const snap = await db.ref(`users/${user.uid}`).get();
  const val  = snap.exists() ? (snap.val() || {}) : {};
  const up   = {};
  if (!val.name)               up.name            = user.displayName || 'Anonymous';
  if (!val.photo && user.photoURL) up.photo        = user.photoURL;
  if (!val.C?.S?.own?.default) up['C/S/own/default'] = true;
  if (!val.C?.S?.eq)           up['C/S/eq']         = 'default';
  if (Object.keys(up).length)  await db.ref(`users/${user.uid}`).update(up);
}

// ── PROFILE ───────────────────────────────────────────────────────────────────
async function getProfile(uid) {
  try {
    const snap = await db.ref(`users/${uid}`).get();
    return snap.exists() ? (snap.val() || {}) : {};
  } catch(e) { console.warn('[FB] getProfile:', e.message); return {}; }
}

async function saveProfile(uid, name, photo) {
  const u = {};
  if (name  != null) u.name  = name;
  if (photo != null) u.photo = photo;
  await db.ref(`users/${uid}`).update(u);
}

// ── SKINS  ( users/{uid}/C/S/ ) ───────────────────────────────────────────────
// Returns { eq: 'default', own: { default: true, ... } }
async function getSkinData(uid) {
  try {
    const snap = await db.ref(`users/${uid}/C/S`).get();
    if (!snap.exists()) return { eq: 'default', own: { default: true } };
    const v = snap.val() || {};
    return { eq: v.eq || 'default', own: v.own || { default: true } };
  } catch(e) { return { eq: 'default', own: { default: true } }; }
}

async function equipSkin(uid, skinId) {
  await db.ref(`users/${uid}/C/S/eq`).set(skinId);
}

async function unlockSkin(uid, skinId) {
  await db.ref(`users/${uid}/C/S/own/${skinId}`).set(true);
}

// ── LEVEL TIMES  ( users/{uid}/D/CubePlatformer/L/L{n} ) ─────────────────────
// Also writes to LB/ for fast leaderboard reads
// Returns { saved, isRecord, prev }
async function saveLevelTime(uid, levelNum, seconds) {
  const lvlPath = `users/${uid}/D/CubePlatformer/L/L${levelNum}`;
  const lbPath  = `LB/CubePlatformer/${levelNum}/${uid}`;
  try {
    const snap     = await db.ref(lvlPath).get();
    const t        = Math.round(seconds * 1000) / 1000;
    const prev     = snap.exists() ? snap.val().t : null;
    const isRecord = (prev === null || t < prev);

    if (isRecord) {
      const profile = await getProfile(uid);
      const name    = profile.name  || currentUser()?.displayName || 'Anonymous';
      const photo   = profile.photo || currentUser()?.photoURL    || '';

      await db.ref().update({
        [lvlPath]: { t, ts: Date.now() },
        [lbPath]:  { t, ts: Date.now(), name, photo }
      });

      // Auto-unlock skins at milestone levels
      const UNLOCK = { 2:'ghost', 4:'neon', 6:'fire', 8:'void', 10:'rainbow' };
      if (UNLOCK[levelNum]) {
        await unlockSkin(uid, UNLOCK[levelNum]).catch(() => {});
      }
      console.log(`[FB] ✓ L${levelNum}: ${t}s — new record`);
    } else {
      console.log(`[FB] L${levelNum}: ${t}s — not a PB (best: ${prev}s)`);
    }
    return { saved: isRecord, isRecord, prev };

  } catch(e) {
    console.error('[FB] saveLevelTime FAILED:', e.code, e.message);
    if (e.code === 'PERMISSION_DENIED')
      console.error('[FB] → PERMISSION_DENIED: paste the DB rules shown at the top of firebase.js');
    return { saved: false, isRecord: false, prev: null };
  }
}

// Returns { L1: { t, ts }, L2: { t, ts }, ... }
async function getMyTimes(uid) {
  try {
    const snap = await db.ref(`users/${uid}/D/CubePlatformer/L`).get();
    return snap.exists() ? (snap.val() || {}) : {};
  } catch(e) { console.warn('[FB] getMyTimes:', e.message); return {}; }
}

// ── LEADERBOARD  ( LB/CubePlatformer/{n}/ ) ──────────────────────────────────
// Returns [{ uid, name, photo, t, ts }, ...] sorted by t asc
async function getLeaderboard(levelNum) {
  try {
    const snap = await db.ref(`LB/CubePlatformer/${levelNum}`)
      .orderByChild('t').limitToFirst(200).get();
    if (!snap.exists()) return [];
    const rows = [];
    snap.forEach(child => {
      const v = child.val();
      rows.push({ uid: child.key, name: v.name || 'Anonymous', photo: v.photo || '', t: v.t, ts: v.ts || 0 });
    });
    rows.sort((a, b) => a.t - b.t);
    return rows;
  } catch(e) {
    console.error('[FB] getLeaderboard:', e.code, e.message);
    throw e; // let caller show the error
  }
}

// ── EXPORT ────────────────────────────────────────────────────────────────────
window.FB = {
  signInGoogle, signOut, onAuthChange, currentUser,
  getProfile, saveProfile,
  getSkinData, equipSkin, unlockSkin,
  saveLevelTime, getMyTimes,
  getLeaderboard
};
console.log('[FB] firebase.js loaded ✓  (new DB shape: C/S + D/CubePlatformer/L + LB)');