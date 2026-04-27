// firebase.js
// DB shape:
//   users/{uid}/name   = "PlayerName"
//   users/{uid}/photo  = "https://..."
//   users/{uid}/games/CubePlatformer/L1 = { t: 12.345, ts: 1713000000000 }

const firebaseConfig = {
  apiKey: "AIzaSyC_fNfUQUcdhicNNx-e0weEGURbz-mZs8g",
  authDomain: "playconsole4u.firebaseapp.com",
  databaseURL: "https://playconsole4u-default-rtdb.firebaseio.com",
  projectId: "playconsole4u",
  storageBucket: "playconsole4u.firebasestorage.app",
  messagingSenderId: "383598421108",
  appId: "1:383598421108:web:12767cf3738cef9d8a9d21",
  measurementId: "G-FFXMD1550D"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.database();

// ── AUTH ──────────────────────────────────────
const signInGoogle = () =>
  auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
const signOut      = () => auth.signOut();
const onAuthChange = cb => auth.onAuthStateChanged(cb);
const currentUser  = () => auth.currentUser;

// ── PROFILE ───────────────────────────────────
async function saveProfile(uid, name, photo) {
  const u = {};
  if (name  != null) u.name  = name;
  if (photo != null) u.photo = photo;
  await db.ref(`users/${uid}`).update(u);
}

async function getProfile(uid) {
  const snap = await db.ref(`users/${uid}`).get();
  return snap.exists() ? snap.val() : {};
}

// ── SAVE LEVEL TIME ───────────────────────────
// Returns { saved, isRecord, prev }
async function saveLevelTime(uid, levelNum, seconds) {
  const key  = `L${levelNum}`;
  const ref  = db.ref(`users/${uid}/games/CubePlatformer/${key}`);
  const snap = await ref.get();
  const t    = Math.round(seconds * 1000) / 1000;
  const prev = snap.exists() ? snap.val().t : null;
  const isRecord = (prev === null || t < prev);
  if (isRecord) await ref.set({ t, ts: Date.now() });
  return { saved: isRecord, isRecord, prev };
}

// ── GET MY TIMES ──────────────────────────────
async function getMyTimes(uid) {
  const snap = await db.ref(`users/${uid}/games/CubePlatformer`).get();
  return snap.exists() ? snap.val() : {};
}

// ── LEADERBOARD ───────────────────────────────
// Reads ALL users (requires auth != null in rules), extracts level entry, sorts by time.
// THROWS on error so callers can handle it.
async function getLeaderboard(levelNum) {
  const key  = `L${levelNum}`;
  const snap = await db.ref('users').get(); // throws if permission denied
  if (!snap.exists()) return [];
  const rows = [];
  snap.forEach(child => {
    const uid   = child.key;
    const val   = child.val();
    const name  = val.name  || 'Anonymous';
    const photo = val.photo || '';
    const entry = val?.games?.CubePlatformer?.[key];
    if (entry && entry.t != null) {
      rows.push({ uid, name, photo, t: entry.t, ts: entry.ts || 0 });
    }
  });
  rows.sort((a, b) => a.t - b.t);
  return rows;
}

window.FB = {
  signInGoogle, signOut, onAuthChange, currentUser,
  saveProfile, getProfile,
  saveLevelTime, getMyTimes,
  getLeaderboard
};