// firebase.js
// Requires Firebase v9 COMPAT scripts loaded before this file:
//   firebase-app-compat.js
//   firebase-auth-compat.js
//   firebase-database-compat.js
//
// ── FIREBASE RULES REQUIRED ─────────────────────────────────────────────────
// In Firebase Console → Realtime Database → Rules, paste this:
// {
//   "rules": {
//     "users": {
//       "$uid": {
//         ".read":  "$uid === auth.uid",
//         ".write": "$uid === auth.uid"
//       }
//     },
//     "leaderboard": {
//       ".read": true,
//       "$game": { "$level": { "$uid": { ".write": "$uid === auth.uid" } } }
//     }
//   }
// }
// ────────────────────────────────────────────────────────────────────────────

if (typeof firebase === 'undefined') {
    throw new Error('[FB] Firebase SDK not loaded. Add CDN <script> tags BEFORE firebase.js');
}
if (!firebase.apps || firebase.apps.length === 0) {
    firebase.initializeApp({
        apiKey:            'AIzaSyC_fNfUQUcdhicNNx-e0weEGURbz-mZs8g',
        authDomain:        'playconsole4u.firebaseapp.com',
        databaseURL:       'https://playconsole4u-default-rtdb.firebaseio.com',
        projectId:         'playconsole4u',
        storageBucket:     'playconsole4u.firebasestorage.app',
        messagingSenderId: '383598421108',
        appId:             '1:383598421108:web:12767cf3738cef9d8a9d21'
    });
}

const auth = firebase.auth();
const db   = firebase.database();

// ── HELPERS ──────────────────────────────────────────────────────────────────
function _safe(s) { return String(s).replace(/[.#$[\]/\s]/g, '_'); }

function _logPermError(fn, e) {
    console.error(`[FB] ${fn} FAILED:`, e.code || '', e.message);
    if (e.code === 'PERMISSION_DENIED') {
        console.error(
            '[FB] → PERMISSION_DENIED\n' +
            '     Fix your Firebase Realtime Database Rules.\n' +
            '     See the rules comment at the top of firebase.js'
        );
    }
}

// ── AUTO-SETUP DEFAULT PROFILE FOR NEW USERS ─────────────────────────────────
async function _ensureProfile(user) {
    try {
        const snap = await db.ref(`users/${user.uid}`).get();
        const existing = snap.exists() ? (snap.val() || {}) : {};
        const updates  = {};

        // Only write fields that are missing
        if (!existing.username)
            updates.username  = user.displayName || ('Player' + Math.floor(Math.random() * 9000 + 1000));
        if (!existing.photoURL && user.photoURL)
            updates.photoURL  = user.photoURL;
        if (!existing.email && user.email)
            updates.email     = user.email;
        if (!existing.createdAt)
            updates.createdAt = Date.now();

        if (Object.keys(updates).length > 0) {
            await db.ref(`users/${user.uid}`).update(updates);
            console.log('[FB] ✓ Default profile created for', user.uid, updates);
        }
    } catch (e) {
        _logPermError('_ensureProfile', e);
    }
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
function signInGoogle() {
    return auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
}
function signOut()     { return auth.signOut(); }
function currentUser() { return auth.currentUser; }  // sync – null if not signed in

// Wraps onAuthStateChanged; auto-creates default profile on first sign-in
function onAuthChange(cb) {
    auth.onAuthStateChanged(async (user) => {
        if (user) await _ensureProfile(user);
        cb(user);
    });
}

// ── PROFILE ───────────────────────────────────────────────────────────────────
async function getProfile(uid) {
    if (!uid) return {};
    try {
        const snap = await db.ref(`users/${uid}`).get();
        return snap.exists() ? (snap.val() || {}) : {};
    } catch (e) {
        _logPermError('getProfile', e);
        return {};
    }
}

async function saveProfile(uid, data) {
    if (!uid) throw new Error('[FB] saveProfile: uid required');
    // Strip undefined/null — Firebase rejects them and kills the write
    const clean = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v != null && v !== undefined)
    );
    await db.ref(`users/${uid}`).update(clean);
}

// Returns just the username string (or '' if not set)
async function getUsername(uid) {
    if (!uid) return '';
    try {
        const snap = await db.ref(`users/${uid}/username`).get();
        return snap.exists() ? snap.val() : '';
    } catch (e) {
        _logPermError('getUsername', e);
        return '';
    }
}

// Sets just the username
async function setUsername(uid, username) {
    if (!uid)                        throw new Error('[FB] setUsername: uid required');
    if (!username || username.length < 2) throw new Error('Username must be at least 2 characters');
    await db.ref(`users/${uid}/username`).set(username.trim());
    // Also update leaderboard entries so name shows correctly
    try {
        const gamesSnap = await db.ref(`users/${uid}/games/CubePlatformer`).get();
        if (gamesSnap.exists()) {
            const updates = {};
            gamesSnap.forEach(lvlSnap => {
                const lvlNum = lvlSnap.key.replace('Level_', '');
                updates[`leaderboard/CubePlatformer/${lvlNum}/${uid}/username`] = username.trim();
            });
            if (Object.keys(updates).length) await db.ref().update(updates);
        }
    } catch (_) { /* non-critical */ }
}

// ── GAME TIMES ────────────────────────────────────────────────────────────────
// Saves best time; also writes to /leaderboard/ for fast global reads
// Returns: 'saved' | 'not_best' | 'error'
async function saveTime(uid, game, level, seconds) {
    if (!uid) { console.warn('[FB] saveTime: no uid — user not signed in'); return 'error'; }

    try {
        const safeGame = _safe(game);
        const userRef  = db.ref(`users/${uid}/games/${safeGame}/Level_${level}`);
        const snap     = await userRef.get();
        const t        = parseFloat(seconds.toFixed(3));

        if (!snap.exists() || t < snap.val().time) {
            // Get username for leaderboard entry
            const profile  = await getProfile(uid);
            const username = profile.username || currentUser()?.displayName || 'Anonymous';
            const photoURL = profile.photoURL || currentUser()?.photoURL    || '';

            // Write both simultaneously
            await db.ref().update({
                [`users/${uid}/games/${safeGame}/Level_${level}`]: { time: t, ts: Date.now() },
                [`leaderboard/${safeGame}/${level}/${uid}`]:       { time: t, ts: Date.now(), username, photoURL }
            });

            console.log(`[FB] ✓ New best – Level ${level}: ${t}s`);
            return 'saved';
        }

        console.log(`[FB] Not a PB (${t}s, best is ${snap.val().time}s)`);
        return 'not_best';

    } catch (e) {
        _logPermError('saveTime', e);
        return 'error';
    }
}

// Returns best times keyed as { level_1: time, level_2: time, ... }
// (lowercase keys match game.html's bestTimes['level_'+i] lookups)
async function getBestTimes(uid) {
    if (!uid) return {};
    try {
        const snap = await db.ref(`users/${uid}/games/CubePlatformer`).get();
        if (!snap.exists()) return {};
        const result = {};
        snap.forEach(child => {
            // child.key is "Level_1" — normalise to lowercase "level_1"
            result[child.key.toLowerCase()] = child.val().time;
        });
        return result;
    } catch (e) {
        _logPermError('getBestTimes', e);
        return {};
    }
}

// Raw level data for a game
async function getMyTimes(uid, game) {
    if (!uid) return {};
    try {
        const snap = await db.ref(`users/${uid}/games/${_safe(game)}`).get();
        return snap.exists() ? snap.val() : {};
    } catch (e) {
        console.warn('[FB] getMyTimes:', e.message);
        return {};
    }
}

// ── LEADERBOARD ───────────────────────────────────────────────────────────────
// Reads from /leaderboard/ — fast, no full user scan needed
// Returns [{uid, username, photoURL, time, ts}, ...] sorted by time asc
async function getLeaderboard(levelNum, limit = 100) {
    try {
        const snap = await db.ref(`leaderboard/CubePlatformer/${levelNum}`)
            .orderByChild('time')
            .limitToFirst(limit)
            .get();

        if (!snap.exists()) return [];

        const rows = [];
        snap.forEach(child => {
            const v = child.val();
            rows.push({
                uid:      child.key,
                username: v.username || 'Anonymous',
                photoURL: v.photoURL || '',
                time:     v.time,
                ts:       v.ts
            });
        });

        rows.sort((a, b) => a.time - b.time);
        return rows;
    } catch (e) {
        // Fallback: read from users/ if leaderboard/ path doesn't exist yet
        console.warn('[FB] getLeaderboard (leaderboard/ path):', e.message, '— falling back to users/');
        return _leaderboardFallback(levelNum, limit);
    }
}

// Fallback: read all users (slower, for old data before leaderboard/ existed)
async function _leaderboardFallback(levelNum, limit) {
    try {
        const snap = await db.ref('users').get();
        if (!snap.exists()) return [];
        const rows = [];
        snap.forEach(userSnap => {
            const v     = userSnap.val() || {};
            const entry = v.games?.CubePlatformer?.[`Level_${levelNum}`];
            if (entry?.time != null) {
                rows.push({
                    uid:      userSnap.key,
                    username: v.username || 'Anonymous',
                    photoURL: v.photoURL || '',
                    time:     entry.time,
                    ts:       entry.ts
                });
            }
        });
        rows.sort((a, b) => a.time - b.time);
        return rows.slice(0, limit);
    } catch (e) {
        _logPermError('_leaderboardFallback', e);
        return [];
    }
}

// Backwards-compat alias
async function getAllTimesForLevel(game, level) {
    return getLeaderboard(level);
}

// ── EXPORT ────────────────────────────────────────────────────────────────────
window.FB = {
    // Auth
    signInGoogle, signOut, onAuthChange, currentUser,
    // Profile
    getProfile, saveProfile, getUsername, setUsername,
    // Times
    saveTime, getBestTimes, getMyTimes,
    // Leaderboard
    getLeaderboard, getAllTimesForLevel
};

console.log('[FB] firebase.js loaded ✓');