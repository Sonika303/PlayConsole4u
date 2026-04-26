// firebase.js
// Structure: users/{uid}/username, users/{uid}/photoURL
//            users/{uid}/games/CubePlatformer/Level_1 = { time, ts }

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
function signInGoogle() {
  return auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
}
function signOut()          { return auth.signOut(); }
function onAuthChange(cb)   { auth.onAuthStateChanged(cb); }
function currentUser()      { return auth.currentUser; }

// ── USER PROFILE ──────────────────────────────
async function saveProfile(uid, data) {
  // data = { username?, photoURL? }
  await db.ref(`users/${uid}`).update(data);
}
async function getProfile(uid) {
  try {
    const snap = await db.ref(`users/${uid}`).get();
    return snap.exists() ? snap.val() : {};
  } catch { return {}; }
}

// ── GAME TIMES ────────────────────────────────
// path: users/{uid}/games/CubePlatformer/Level_{n}
function levelRef(uid, game, level) {
  return db.ref(`users/${uid}/games/${game}/Level_${level}`);
}

// Save only if personal best
async function saveTime(uid, game, level, seconds) {
  const ref  = levelRef(uid, game, level);
  const snap = await ref.get();
  const t    = parseFloat(seconds.toFixed(3));
  if (!snap.exists() || t < snap.val().time) {
    await ref.set({ time: t, ts: Date.now() });
    return true;
  }
  return false;
}

// Get all level times for one user+game
async function getMyTimes(uid, game) {
  try {
    const snap = await db.ref(`users/${uid}/games/${game}`).get();
    return snap.exists() ? snap.val() : {};
  } catch { return {}; }
}

// ── ALL PLAYERS TIMES (for leaderboard) ───────
// Reads ALL users, collects their Level_N time, sorts by time
async function getAllTimesForLevel(game, level) {
  try {
    // We read every user's specific level entry
    // Firebase doesn't support cross-user queries directly,
    // so we read users/{*}/games/{game}/Level_{level} via a shallow scan
    const usersSnap = await db.ref('users').get();
    if (!usersSnap.exists()) return [];
    const rows = [];
    usersSnap.forEach(userSnap => {
      const uid      = userSnap.key;
      const profile  = userSnap.val();
      const username = profile.username || 'Anonymous';
      const photoURL = profile.photoURL || '';
      const games    = profile.games || {};
      const gameData = games[game] || {};
      const entry    = gameData[`Level_${level}`];
      if (entry && entry.time != null) {
        rows.push({ uid, username, photoURL, time: entry.time, ts: entry.ts });
      }
    });
    rows.sort((a, b) => a.time - b.time);
    return rows;
  } catch (e) {
    console.warn('getAllTimesForLevel:', e.message);
    return [];
  }
}

window.FB = {
  signInGoogle, signOut, onAuthChange, currentUser,
  saveProfile, getProfile,
  saveTime, getMyTimes,
  getAllTimesForLevel
};