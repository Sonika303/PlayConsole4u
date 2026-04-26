// firebase.js
// Requires Firebase v8 compat CDN scripts loaded BEFORE this file:
//   firebase-app.js → firebase-auth.js → firebase-database.js

// ── CONFIG ──────────────────────────────────────────────────────────────────
const firebaseConfig = {
    apiKey:            "AIzaSyC_fNfUQUcdhicNNx-e0weEGURbz-mZs8g",
    authDomain:        "playconsole4u.firebaseapp.com",
    databaseURL:       "https://playconsole4u-default-rtdb.firebaseio.com",
    projectId:         "playconsole4u",
    storageBucket:     "playconsole4u.firebasestorage.app",
    messagingSenderId: "383598421108",
    appId:             "1:383598421108:web:12767cf3738cef9d8a9d21",
    measurementId:     "G-FFXMD1550D"
};

// BUG 1 FIX: firebase object might not exist yet → guard with a clear error
if (typeof firebase === 'undefined') {
    throw new Error('[FB] Firebase SDK not loaded. Add the CDN <script> tags BEFORE firebase.js');
}

// BUG 2 FIX: apps is an array, not a length property on the namespace in some versions
if (!firebase.apps || firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db   = firebase.database();

// ── AUTH ────────────────────────────────────────────────────────────────────
function signInGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    return auth.signInWithPopup(provider);
}

function signOut()        { return auth.signOut(); }
function onAuthChange(cb) { auth.onAuthStateChanged(cb); }
function currentUser()    { return auth.currentUser; }  // sync, returns null if not signed in

// ── USER PROFILE ─────────────────────────────────────────────────────────────
async function saveProfile(uid, data) {
    if (!uid) throw new Error('[FB] saveProfile: uid is required');
    // BUG 3 FIX: filter out undefined values — Firebase rejects them
    const clean = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== undefined && v !== null)
    );
    await db.ref(`users/${uid}`).update(clean);
}

async function getProfile(uid) {
    if (!uid) return {};
    try {
        const snap = await db.ref(`users/${uid}`).get();
        return snap.exists() ? snap.val() : {};
    } catch (e) {
        console.warn('[FB] getProfile failed:', e.message);
        return {};
    }
}

// ── GAME TIMES ───────────────────────────────────────────────────────────────
function levelRef(uid, game, level) {
    // BUG 4 FIX: sanitise game name — spaces/slashes break Firebase paths
    const safeGame = game.replace(/[.#$[\]/\s]/g, '_');
    return db.ref(`users/${uid}/games/${safeGame}/Level_${level}`);
}

// Returns: 'saved' | 'not_best' | 'error'
async function saveTime(uid, game, level, seconds) {
    if (!uid)  { console.warn('[FB] saveTime: no uid'); return 'error'; }
    if (!game) { console.warn('[FB] saveTime: no game'); return 'error'; }

    try {
        const ref  = levelRef(uid, game, level);
        const snap = await ref.get();
        const t    = parseFloat(seconds.toFixed(3));

        if (!snap.exists() || t < snap.val().time) {
            await ref.set({ time: t, ts: Date.now() });
            console.log(`[FB] ✓ Saved Level ${level}: ${t}s`);
            return 'saved';
        }
        console.log(`[FB] Not a PB (${t}s vs ${snap.val().time}s)`);
        return 'not_best';
    } catch (e) {
        // BUG 5 FIX: expose the real error — 99% of the time this is a
        // Firebase Realtime Database RULES rejection (PERMISSION_DENIED).
        // Fix: go to Firebase Console → Realtime Database → Rules and set:
        // {
        //   "rules": {
        //     "users": {
        //       "$uid": {
        //         ".read":  "$uid === auth.uid",
        //         ".write": "$uid === auth.uid"
        //       }
        //     }
        //   }
        // }
        console.error('[FB] saveTime FAILED:', e.code, e.message);
        if (e.code === 'PERMISSION_DENIED') {
            console.error(
                '[FB] → PERMISSION_DENIED: your Firebase Realtime Database rules are blocking writes.\n' +
                '       Go to: Firebase Console → Realtime Database → Rules\n' +
                '       Set rules to allow authenticated users to write their own data.'
            );
        }
        return 'error';
    }
}

// Get all level times for one user+game
async function getMyTimes(uid, game) {
    if (!uid) return {};
    try {
        const safeGame = game.replace(/[.#$[\]/\s]/g, '_');
        const snap = await db.ref(`users/${uid}/games/${safeGame}`).get();
        return snap.exists() ? snap.val() : {};
    } catch (e) {
        console.warn('[FB] getMyTimes failed:', e.message);
        return {};
    }
}

// ── LEADERBOARD ──────────────────────────────────────────────────────────────
async function getAllTimesForLevel(game, level) {
    try {
        const safeGame = game.replace(/[.#$[\]/\s]/g, '_');
        const usersSnap = await db.ref('users').get();
        if (!usersSnap.exists()) return [];

        const rows = [];
        usersSnap.forEach(userSnap => {
            const uid      = userSnap.key;
            const val      = userSnap.val() || {};
            const username = val.username  || 'Anonymous';
            const photoURL = val.photoURL  || '';
            const entry    = (val.games?.[safeGame])?.[`Level_${level}`];
            if (entry?.time != null) {
                rows.push({ uid, username, photoURL, time: entry.time, ts: entry.ts });
            }
        });

        rows.sort((a, b) => a.time - b.time);
        return rows;
    } catch (e) {
        console.warn('[FB] getAllTimesForLevel failed:', e.message);
        return [];
    }
}

// ── EXPORTED NAMESPACE ───────────────────────────────────────────────────────
window.FB = {
    signInGoogle,
    signOut,
    onAuthChange,
    currentUser,
    saveProfile,
    getProfile,
    saveTime,
    getMyTimes,
    getAllTimesForLevel
};

console.log('[FB] firebase.js loaded ✓');