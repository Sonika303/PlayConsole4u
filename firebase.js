// ─────────────────────────────────────────────
//  firebase.js  — Auth + Realtime DB helpers
//  Uses Firebase CDN (compat v9)
// ─────────────────────────────────────────────

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

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.database();

// ── AUTH ─────────────────────────────────────
const googleProvider = new firebase.auth.GoogleAuthProvider();

function signInGoogle() {
  return auth.signInWithPopup(googleProvider);
}
function signOut() {
  return auth.signOut();
}
function onAuthChange(cb) {
  auth.onAuthStateChanged(cb);
}
function currentUser() {
  return auth.currentUser;
}

// ── USERNAME ──────────────────────────────────
async function setUsername(uid, username) {
  await db.ref(`users/${uid}/username`).set(username);
}
async function getUsername(uid) {
  const snap = await db.ref(`users/${uid}/username`).get();
  return snap.exists() ? snap.val() : null;
}

// ── BEST TIMES ───────────────────────────────
// Stored at: bestTimes/{uid}/level_{n}  = seconds (float)
async function saveBestTime(uid, level, seconds) {
  const ref  = db.ref(`bestTimes/${uid}/level_${level}`);
  const snap = await ref.get();
  if (!snap.exists() || seconds < snap.val()) {
    await ref.set(seconds);
    return true; // new record
  }
  return false;
}
async function getBestTimes(uid) {
  const snap = await db.ref(`bestTimes/${uid}`).get();
  return snap.exists() ? snap.val() : {};
}

// ── LEADERBOARD ──────────────────────────────
// Stored at: leaderboard/level_{n}/{uid} = { username, time, ts }
async function submitLeaderboard(uid, username, level, seconds) {
  const ref  = db.ref(`leaderboard/level_${level}/${uid}`);
  const snap = await ref.get();
  if (!snap.exists() || seconds < snap.val().time) {
    await ref.set({ username: username || 'Anonymous', time: seconds, ts: Date.now() });
  }
}

// Returns top N entries for a level, ordered by time ASC
async function getLeaderboard(level, limit = 100) {
  const snap = await db.ref(`leaderboard/level_${level}`)
    .orderByChild('time').limitToFirst(limit).get();
  if (!snap.exists()) return [];
  const rows = [];
  snap.forEach(child => rows.push({ uid: child.key, ...child.val() }));
  return rows; // already sorted by time ASC
}

// expose globally
window.FB = {
  signInGoogle, signOut, onAuthChange, currentUser,
  setUsername, getUsername,
  saveBestTime, getBestTimes,
  submitLeaderboard, getLeaderboard
};