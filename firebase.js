// firebase.js — Auth + Realtime DB
// Requires Firebase compat SDKs loaded before this file

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

// Only init once
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db   = firebase.database();

// ── Helpers ───────────────────────────────────
function requireAuth() {
  const u = auth.currentUser;
  if (!u) throw new Error('Not authenticated');
  return u;
}

// ── AUTH ──────────────────────────────────────
function signInGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  return auth.signInWithPopup(provider);
}

function signOut() {
  return auth.signOut();
}

// cb(user|null) called immediately + on every change
function onAuthChange(cb) {
  auth.onAuthStateChanged(cb);
}

function currentUser() {
  return auth.currentUser;
}

// ── USERNAME ──────────────────────────────────
async function setUsername(uid, username) {
  requireAuth();
  await db.ref(`users/${uid}/username`).set(username.trim());
}

async function getUsername(uid) {
  try {
    const snap = await db.ref(`users/${uid}/username`).get();
    return snap.exists() ? snap.val() : null;
  } catch (e) {
    console.warn('getUsername failed:', e.message);
    return null;
  }
}

// ── BEST TIMES ────────────────────────────────
// Saves only if it's a new personal record
async function saveBestTime(uid, level, seconds) {
  requireAuth();
  const ref  = db.ref(`bestTimes/${uid}/level_${level}`);
  try {
    const snap = await ref.get();
    if (!snap.exists() || seconds < snap.val()) {
      await ref.set(parseFloat(seconds.toFixed(3)));
      return true; // new record
    }
    return false;
  } catch (e) {
    console.warn('saveBestTime failed:', e.message);
    return false;
  }
}

async function getBestTimes(uid) {
  try {
    const snap = await db.ref(`bestTimes/${uid}`).get();
    return snap.exists() ? snap.val() : {};
  } catch (e) {
    console.warn('getBestTimes failed:', e.message);
    return {};
  }
}

// ── LEADERBOARD ───────────────────────────────
// Submits only if it's a personal best
async function submitLeaderboard(uid, username, level, seconds) {
  requireAuth();
  const ref = db.ref(`leaderboard/level_${level}/${uid}`);
  try {
    const snap = await ref.get();
    const time  = parseFloat(seconds.toFixed(3));
    if (!snap.exists() || time < snap.val().time) {
      await ref.set({
        username: (username || 'Anonymous').trim(),
        time,
        ts: Date.now()
      });
    }
  } catch (e) {
    console.warn('submitLeaderboard failed:', e.message);
  }
}

// Returns up to `limit` entries sorted by time ASC
async function getLeaderboard(level, limit = 200) {
  try {
    const snap = await db.ref(`leaderboard/level_${level}`)
      .orderByChild('time')
      .limitToFirst(limit)
      .get();
    if (!snap.exists()) return [];
    const rows = [];
    snap.forEach(child => rows.push({ uid: child.key, ...child.val() }));
    // Firebase orderByChild is ASC already — return as-is
    return rows;
  } catch (e) {
    console.warn('getLeaderboard failed:', e.message);
    return [];
  }
}

// ── Expose globally ───────────────────────────
window.FB = {
  signInGoogle,
  signOut,
  onAuthChange,
  currentUser,
  setUsername,
  getUsername,
  saveBestTime,
  getBestTimes,
  submitLeaderboard,
  getLeaderboard
};