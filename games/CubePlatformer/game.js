// game.js — engine (requires levels.js loaded before this)

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

const VW = 800, VH = 500;
canvas.width  = VW;
canvas.height = VH;

const G          = 0.5;
const MAX_LEVELS = 10;

let cam, player, currentLvl, running, won, keys;
let timerStart, elapsedMs = 0;

// ── PLAYER FACTORY ───────────────────────────────────────────────────────────
function makePlayer(sx, sy) {
    return {
        x: sx, y: sy, w: 24, h: 24,
        dx: 0, dy: 0,
        jumps: 0, maxJumps: 2,
        onWall: false, wallDir: 0,
        onGround: false, prevY: sy,
        rotation: 0, spinSpeed: 0,
        sx, sy
    };
}

// ── INPUT ────────────────────────────────────────────────────────────────────
keys = {};
window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (/Space|ArrowUp|KeyW/.test(e.code) && running && !won) jump();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function jump() {
    if (player.onWall) {
        player.dy        = -11.5;
        player.dx        = -player.wallDir * 9;
        player.jumps     = 1;
        player.onWall    = false;
        player.spinSpeed = player.wallDir * 0.18;
    } else if (player.jumps < player.maxJumps) {
        player.dy    = -11.5;
        player.jumps++;
        const d = (keys['KeyD'] || keys['ArrowRight']) ? 1
                : (keys['KeyA'] || keys['ArrowLeft'])  ? -1
                : player.dx > 0 ? 1 : -1;
        player.spinSpeed = d * 0.15;
    }
}

// ── TOUCH CONTROLS ───────────────────────────────────────────────────────────
function setupTouch() {
    document.getElementById('touch-hud')?.remove();
    const hud = document.createElement('div');
    hud.id    = 'touch-hud';
    hud.innerHTML = `
    <style>
        #touch-hud { position:fixed; bottom:14px; left:0; width:100%;
            display:flex; justify-content:space-between;
            padding:0 14px; box-sizing:border-box; pointer-events:none; z-index:30; }
        .tb { width:58px; height:58px;
            background:rgba(255,255,255,.12);
            border:2px solid rgba(255,255,255,.3); border-radius:50%;
            display:flex; align-items:center; justify-content:center;
            font-size:18px; color:#fff; pointer-events:all;
            user-select:none; -webkit-user-select:none; }
        #t-dpad { display:flex; gap:10px; }
    </style>
    <div id="t-dpad">
        <div class="tb" id="tl">◀</div>
        <div class="tb" id="tr">▶</div>
    </div>
    <div class="tb" id="tj">▲</div>`;
    document.body.appendChild(hud);

    const bind = (id, code) => {
        const el = document.getElementById(id);
        el.addEventListener('touchstart', e => { e.preventDefault(); keys[code] = true;  }, { passive: false });
        el.addEventListener('touchend',   e => { e.preventDefault(); keys[code] = false; }, { passive: false });
    };
    bind('tl', 'KeyA');
    bind('tr', 'KeyD');
    document.getElementById('tj').addEventListener('touchstart', e => {
        e.preventDefault();
        if (running && !won) jump();
    }, { passive: false });
}

// ── TOAST NOTIFICATION ───────────────────────────────────────────────────────
function showToast(msg, color = '#22c55e') {
    let t = document.getElementById('fb-toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'fb-toast';
        t.style.cssText = `position:fixed;top:60px;right:18px;z-index:9999;
            padding:10px 18px;border-radius:10px;font-family:Nunito,sans-serif;
            font-size:13px;font-weight:700;color:#fff;opacity:0;
            transition:opacity .3s;box-shadow:0 4px 16px rgba(0,0,0,.3);
            pointer-events:none;max-width:260px;text-align:center;`;
        document.body.appendChild(t);
    }
    t.textContent  = msg;
    t.style.background = color;
    t.style.opacity    = '1';
    clearTimeout(t._hide);
    t._hide = setTimeout(() => { t.style.opacity = '0'; }, 2800);
}

// ── RESPAWN ──────────────────────────────────────────────────────────────────
function respawn() {
    player.x = player.sx; player.y = player.sy;
    player.dx = 0; player.dy = 0; player.jumps = 0;
    player.onWall = false; player.onGround = false;
    player.rotation = 0; player.spinSpeed = 0;
    timerStart = performance.now() - elapsedMs; // keep timer on respawn
}

// ── INIT ─────────────────────────────────────────────────────────────────────
function initGame(lvlNum) {
    const lvl   = LEVELS[lvlNum];
    currentLvl  = lvlNum;
    won         = false;
    running     = true;
    player      = makePlayer(lvl.spawn.x, lvl.spawn.y);
    cam         = { x: 0, y: 0 };
    timerStart  = performance.now();
    elapsedMs   = 0;
    setupTouch();
    requestAnimationFrame(loop);
}

// ── CAMERA ───────────────────────────────────────────────────────────────────
function updateCam(wW, wH) {
    cam.x += (player.x + player.w / 2 - VW / 2 - cam.x) * 0.12;
    cam.y += (player.y + player.h / 2 - VH / 2 - cam.y) * 0.12;
    cam.x  = Math.max(0, Math.min(cam.x, wW - VW));
    cam.y  = Math.max(0, Math.min(cam.y, wH - VH));
}

// ── SAVE TO FIREBASE ─────────────────────────────────────────────────────────
// FIX: was a fire-and-forget .then() with no .catch() — errors were invisible.
// Now it's a proper async function with full error handling + user feedback.
async function handleWinSave(secs) {
    const FB = window.FB;
    if (!FB) {
        console.warn('[game] FB not available — firebase.js not loaded?');
        return;
    }

    const u = FB.currentUser();
    if (!u) {
        // Not signed in — perfectly fine, just skip saving
        console.log('[game] No user signed in, skipping save');
        return;
    }

    try {
        // 1. Get profile (to read stored username / set it if missing)
        const profile  = await FB.getProfile(u.uid);
        const username = profile.username || u.displayName || 'Anonymous';

        // 2. Ensure photoURL is stored in profile
        if (!profile.photoURL && u.photoURL) {
            await FB.saveProfile(u.uid, { photoURL: u.photoURL, username }).catch(e => {
                console.warn('[game] saveProfile failed (non-fatal):', e.message);
            });
        }

        // 3. Save the time — this is where PERMISSION_DENIED usually surfaces
        const result = await FB.saveTime(u.uid, 'CubePlatformer', currentLvl, secs);

        if (result === 'saved') {
            showToast(`🏆 New best: ${secs.toFixed(3)}s saved!`, '#2563eb');
        } else if (result === 'not_best') {
            showToast(`⏱ Finished in ${secs.toFixed(3)}s`, '#64748b');
        } else {
            // result === 'error' — firebase.js already console.error'd the reason
            showToast('⚠️ Save failed — check console', '#ef4444');
        }

    } catch (e) {
        // Catch anything that escaped firebase.js
        console.error('[game] Unexpected save error:', e);
        showToast('⚠️ Save failed — check console', '#ef4444');
    }
}

// ── MAIN LOOP ────────────────────────────────────────────────────────────────
function loop() {
    if (!running || won) return;

    const lvl = LEVELS[currentLvl];
    elapsedMs = performance.now() - timerStart;

    // Movement
    if (keys['KeyD'] || keys['ArrowRight']) player.dx += 0.85;
    if (keys['KeyA'] || keys['ArrowLeft'])  player.dx -= 0.85;
    player.dx *= 0.83;
    player.x  += player.dx;

    player.prevY = player.y;
    player.dy   += G;
    player.y    += player.dy;

    player.x = Math.max(0, Math.min(player.x, lvl.w - player.w));
    if (player.y > lvl.h + 60) respawn();

    player.onWall   = false;
    player.onGround = false;

    // Platform collision
    lvl.platforms.forEach(p => {
        if (player.x + player.w <= p.x || player.x >= p.x + p.w ||
            player.y + player.h <= p.y || player.y >= p.y + p.h) return;

        const wasAbove = player.prevY + player.h <= p.y + 5;
        const wasBelow = player.prevY            >= p.y + p.h - 5;

        if (player.dy >= 0 && wasAbove) {
            player.y        = p.y - player.h;
            player.dy       = 0;
            player.jumps    = 0;
            player.onGround = true;
            const snap = Math.round(player.rotation / (Math.PI / 2)) * (Math.PI / 2);
            player.rotation += (snap - player.rotation) * 0.25;
            player.spinSpeed = 0;
        } else if (player.dy < 0 && wasBelow) {
            player.y  = p.y + p.h;
            player.dy = 0;
        } else {
            player.onWall  = true;
            player.wallDir = (player.x + player.w / 2 < p.x + p.w / 2) ? 1 : -1;
            player.dx      = 0;
            player.dy     *= 0.75;
        }
    });

    // Spin in air
    if (!player.onGround) {
        player.rotation  += player.spinSpeed;
        player.spinSpeed *= 0.98;
        if (Math.abs(player.spinSpeed) < 0.04) player.spinSpeed = player.dx * 0.012;
    }

    // Hazards
    lvl.hazards.forEach(h => {
        if (player.x + player.w > h.x && player.x < h.x + h.w &&
            player.y + player.h > h.y && player.y < h.y + h.h) {
            respawn();
        }
    });

    // Goal
    const g = lvl.goal;
    if (player.x + player.w > g.x && player.x < g.x + g.w &&
        player.y + player.h > g.y && player.y < g.y + g.h) {

        won     = true;
        running = false;

        const secs = elapsedMs / 1000;

        // Unlock next level in session
        const next = currentLvl + 1;
        const prog = parseInt(sessionStorage.getItem('cube_prog') || '1');
        if (next > prog && next <= MAX_LEVELS) sessionStorage.setItem('cube_prog', String(next));

        // FIX: fire-and-forget properly — don't block drawWin
        handleWinSave(secs);
        drawWin(secs);
        return;
    }

    updateCam(lvl.w, lvl.h);
    draw(lvl);
    requestAnimationFrame(loop);
}

// ── DRAW ─────────────────────────────────────────────────────────────────────
function draw(lvl) {
    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, VH);
    grad.addColorStop(0, lvl.bgA);
    grad.addColorStop(1, lvl.bgB);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VW, VH);

    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    // Platforms
    lvl.platforms.forEach(p => {
        // Drop shadow
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath();
        ctx.roundRect(p.x + 3, p.y + 4, p.w, p.h, 5);
        ctx.fill();
        // Body
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.roundRect(p.x, p.y, p.w, p.h, 5);
        ctx.fill();
        // Shine
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.roundRect(p.x + 3, p.y + 2, p.w - 6, Math.min(5, p.h / 2), 3);
        ctx.fill();
    });

    // Hazards
    lvl.hazards.forEach(h => {
        ctx.fillStyle = '#7f1d1d';
        ctx.beginPath();
        ctx.roundRect(h.x, h.y, h.w, h.h, 3);
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        const n = Math.floor(h.w / 14);
        for (let i = 0; i < n; i++) {
            const sx = h.x + i * 14 + 7;
            ctx.beginPath();
            ctx.moveTo(sx - 5, h.y);
            ctx.lineTo(sx, h.y - 9);
            ctx.lineTo(sx + 5, h.y);
            ctx.closePath();
            ctx.fill();
        }
    });

    // Goal
    const g = lvl.goal;
    ctx.fillStyle   = lvl.accent;
    ctx.shadowColor = lvl.accent;
    ctx.shadowBlur  = 20;
    ctx.beginPath();
    ctx.roundRect(g.x, g.y, g.w, g.h, 6);
    ctx.fill();
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = '#fff';
    ctx.font        = 'bold 14px sans-serif';
    ctx.textAlign   = 'center';
    ctx.fillText('★', g.x + g.w / 2, g.y + g.h / 2 + 5);
    ctx.textAlign   = 'left';

    // Player
    const hw = player.w / 2, hh = player.h / 2;

    ctx.save();
    ctx.translate(player.x + hw, player.y + hh);

    // Shadow (not rotated)
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(2, hh + 4, hw + 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Spinning body
    ctx.rotate(player.rotation);
    ctx.fillStyle = lvl.accent;
    ctx.beginPath();
    ctx.roundRect(-hw, -hh, player.w, player.h, 4);
    ctx.fill();

    // Shine
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.beginPath();
    ctx.roundRect(-hw + 3, -hh + 3, hw - 2, hh - 2, 3);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-3, -2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.arc(-3, -2, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.restore(); // end camera

    // HUD bar
    const t = (elapsedMs / 1000).toFixed(2);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(10, 10, 310, 32, 9);
    ctx.fill();
    ctx.fillStyle = lvl.accent;
    ctx.font      = 'bold 11px Nunito, sans-serif';
    ctx.fillText(`LVL ${currentLvl}/${MAX_LEVELS}  ·  ${lvl.name}  ·  ⏱ ${t}s`, 18, 31);
}

// ── WIN SCREEN ────────────────────────────────────────────────────────────────
function drawWin(secs) {
    const lvl = LEVELS[currentLvl];

    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    ctx.fillRect(0, 0, VW, VH);

    // Glow
    const grd = ctx.createRadialGradient(VW/2, VH/2, 0, VW/2, VH/2, 180);
    grd.addColorStop(0, lvl.accent + '44');
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, VW, VH);

    ctx.textAlign = 'center';

    ctx.fillStyle   = lvl.accent;
    ctx.font        = 'bold 48px Nunito, sans-serif';
    ctx.shadowColor = lvl.accent;
    ctx.shadowBlur  = 24;
    ctx.fillText('✓  LEVEL CLEAR!', VW / 2, VH / 2 - 56);
    ctx.shadowBlur  = 0;

    ctx.fillStyle = '#fff';
    ctx.font      = 'bold 24px Nunito, sans-serif';
    ctx.fillText('⏱  ' + secs.toFixed(3) + 's', VW / 2, VH / 2 - 12);

    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font      = 'bold 15px Nunito, sans-serif';
    ctx.fillText(
        currentLvl >= MAX_LEVELS ? '🎉 YOU BEAT ALL 10 LEVELS!' : `Level ${currentLvl + 1} unlocked ★`,
        VW / 2, VH / 2 + 24
    );

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font      = '12px Nunito, sans-serif';
    ctx.fillText('Tap or click to continue', VW / 2, VH / 2 + 56);
    ctx.textAlign = 'left';

    const back = () => location.reload();
    canvas.addEventListener('click',    back, { once: true });
    canvas.addEventListener('touchend', back, { once: true });
}