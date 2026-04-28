// game.js — requires levels.js loaded first
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const VW = 800, VH = 500;
canvas.width = VW;
canvas.height = VH;

const G = 0.5;
let cam, player, currentLvl, running, won, keys;
let timerStart = 0, elapsedMs = 0;
let activeSkin = 'default';
let currentSkin = null;

const SKINS = {
  default: { body: null, eye: '#fff', pupil: 'rgba(0,0,0,.55)', shine: 'rgba(255,255,255,.35)', label: 'Default', jump: 1, accel: 1, air: 1 },
  ghost:   { body: 'rgba(220,230,255,.75)', eye: '#c4b5fd', pupil: 'rgba(60,20,120,.6)', shine: 'rgba(255,255,255,.5)', label: 'Ghost', jump: 1.06, accel: 0.95, air: 1.08 },
  neon:    { body: '#00ff88', eye: '#fff', pupil: '#004422', shine: 'rgba(255,255,255,.5)', label: 'Neon', jump: 1.02, accel: 1.08, air: 1.02 },
  fire:    { body: '#ff4400', eye: '#ffe066', pupil: '#7a2000', shine: 'rgba(255,200,50,.45)', label: 'Fire', jump: 1.1, accel: 1.0, air: 0.98 },
  void:    { body: '#0d0d1a', eye: '#818cf8', pupil: 'rgba(0,0,0,.9)', shine: 'rgba(130,140,250,.35)', label: 'Void', jump: 1.15, accel: 0.93, air: 1.12 },
  rainbow: { body: null, rainbow: true, eye: '#fff', pupil: '#333', shine: 'rgba(255,255,255,.4)', label: 'Rainbow', jump: 1.08, accel: 1.02, air: 1.0 }
};

function mkPlayer(sx, sy) {
  return {
    x: sx, y: sy, w: 24, h: 24, dx: 0, dy: 0,
    jumps: 0, maxJumps: 2, onWall: false, wallDir: 0,
    onGround: false, prevY: sy, rotation: 0, spinSpeed: 0,
    sx, sy
  };
}

keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (/Space|ArrowUp|KeyW/.test(e.code) && running && !won) doJump();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function doJump() {
  const skin = currentSkin || SKINS.default;
  const jumpPow = 11.5 * skin.jump;
  if (player.onWall) {
    player.dy = -jumpPow;
    player.dx = -player.wallDir * 9 * skin.accel;
    player.jumps = 1;
    player.onWall = false;
    player.spinSpeed = player.wallDir * 0.18;
  } else if (player.jumps < player.maxJumps) {
    player.dy = -jumpPow;
    player.jumps++;
    const d = keys['KeyD'] || keys['ArrowRight'] ? 1 : keys['KeyA'] || keys['ArrowLeft'] ? -1 : player.dx > 0 ? 1 : -1;
    player.spinSpeed = d * 0.15;
  }
}

function setupTouch() {
  document.getElementById('touch-hud')?.remove();
  const hud = document.createElement('div');
  hud.id = 'touch-hud';
  hud.innerHTML = `<style>
#touch-hud{position:fixed;bottom:14px;left:0;width:100%;display:flex;justify-content:space-between;padding:0 16px;box-sizing:border-box;pointer-events:none;z-index:30}
.tb{width:60px;height:60px;background:rgba(255,255,255,.1);border:2px solid rgba(255,255,255,.25);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;color:#fff;pointer-events:all;user-select:none;-webkit-user-select:none}
#t-dpad{display:flex;gap:12px}
</style>
<div id="t-dpad"><div class="tb" id="tl">◀</div><div class="tb" id="tr">▶</div></div>
<div class="tb" id="tj">▲</div>`;
  document.body.appendChild(hud);
  const bind = (id, code) => {
    const el = document.getElementById(id);
    el.addEventListener('touchstart', e => { e.preventDefault(); keys[code] = true; }, { passive: false });
    el.addEventListener('touchend', e => { e.preventDefault(); keys[code] = false; }, { passive: false });
  };
  bind('tl', 'KeyA');
  bind('tr', 'KeyD');
  document.getElementById('tj').addEventListener('touchstart', e => {
    e.preventDefault();
    if (running && !won) doJump();
  }, { passive: false });
}

async function initGame(lvlNum) {
  currentLvl = lvlNum;
  won = false;
  running = true;

  const lvl = LEVELS[lvlNum];
  lvl.platforms.forEach(p => {
    if (p.moving) {
      p._t = 0;
      p._ox = p.x;
      p._oy = p.y;
    }
  });

  player = mkPlayer(lvl.spawn.x, lvl.spawn.y);
  cam = { x: 0, y: 0 };
  timerStart = performance.now();
  elapsedMs = 0;

  const u = window.FB?.currentUser();
  if (u) {
    try {
      const sd = await window.FB.getSkinData(u.uid);
      activeSkin = sd.eq || 'default';
    } catch (_) {
      activeSkin = 'default';
    }
  } else {
    activeSkin = 'default';
  }

  currentSkin = SKINS[activeSkin] || SKINS.default;
  setupTouch();
  requestAnimationFrame(loop);
}

function resetPlayer() {
  player.x = player.sx;
  player.y = player.sy;
  player.dx = 0;
  player.dy = 0;
  player.jumps = 0;
  player.onWall = false;
  player.onGround = false;
  player.rotation = 0;
  player.spinSpeed = 0;
  timerStart = performance.now() - elapsedMs;
}

function updateCam(wW, wH) {
  cam.x += (player.x + player.w / 2 - VW / 2 - cam.x) * 0.12;
  cam.y += (player.y + player.h / 2 - VH / 2 - cam.y) * 0.12;
  cam.x = Math.max(0, Math.min(cam.x, wW - VW));
  cam.y = Math.max(0, Math.min(cam.y, wH - VH));
}

function loop() {
  if (!running || won) return;

  const lvl = LEVELS[currentLvl];
  const skin = currentSkin || SKINS.default;
  elapsedMs = performance.now() - timerStart;

  lvl.platforms.forEach(p => {
    if (!p.moving) return;
    p._t += p.moving.speed * 0.016;
    const offset = Math.sin(p._t) * p.moving.range;
    const prevPx = p.x, prevPy = p.y;
    if (p.moving.axis === 'x') p.x = p._ox + offset;
    else p.y = p._oy + offset;
    if (player.onGround) {
      const wasOnThis =
        player.x + player.w > prevPx &&
        player.x < prevPx + p.w &&
        Math.abs((player.y + player.h) - prevPy) < 3;
      if (wasOnThis) {
        player.x += p.x - prevPx;
        player.y += p.y - prevPy;
      }
    }
  });

  if (keys['KeyD'] || keys['ArrowRight']) player.dx += 0.85 * skin.accel;
  if (keys['KeyA'] || keys['ArrowLeft']) player.dx -= 0.85 * skin.accel;
  player.dx *= 0.83;
  player.x += player.dx;
  player.prevY = player.y;
  player.dy += G;
  player.y += player.dy;
  player.x = Math.max(0, Math.min(player.x, lvl.w - player.w));
  if (player.y > lvl.h + 80) resetPlayer();

  player.onWall = false;
  player.onGround = false;

  for (const p of lvl.platforms) {
    if (player.x + player.w <= p.x || player.x >= p.x + p.w) continue;
    if (player.y + player.h <= p.y || player.y >= p.y + p.h) continue;

    const wasAbove = player.prevY + player.h <= p.y + 5;
    const wasBelow = player.prevY >= p.y + p.h - 5;

    if (player.dy >= 0 && wasAbove) {
      player.y = p.y - player.h;
      player.dy = 0;
      player.jumps = 0;
      player.onGround = true;
      const snap = Math.round(player.rotation / (Math.PI / 2)) * (Math.PI / 2);
      player.rotation += (snap - player.rotation) * 0.25;
      player.spinSpeed = 0;
    } else if (player.dy < 0 && wasBelow) {
      player.y = p.y + p.h;
      player.dy = 0;
    } else {
      player.onWall = true;
      player.wallDir = (player.x + player.w / 2 < p.x + p.w / 2) ? 1 : -1;
      player.dx = 0;
      player.dy *= 0.75;
    }
  }

  for (const b of lvl.bouncePads) {
    if (
      player.x + player.w > b.x &&
      player.x < b.x + b.w &&
      player.y + player.h > b.y &&
      player.y + player.h < b.y + b.h + 12 &&
      player.dy > 0
    ) {
      player.dy = -(b.force);
      player.y = b.y - player.h;
      player.jumps = 0;
      player.spinSpeed = (player.dx > 0 ? 1 : -1) * 0.3;
    }
  }

  for (const h of lvl.hazards) {
    if (
      player.x + player.w > h.x &&
      player.x < h.x + h.w &&
      player.y + player.h > h.y &&
      player.y < h.y + h.h
    ) {
      resetPlayer();
      break;
    }
  }

  if (!player.onGround) {
    player.rotation += player.spinSpeed;
    player.spinSpeed *= 0.98;
    if (Math.abs(player.spinSpeed) < 0.04) player.spinSpeed = player.dx * 0.012 * skin.air;
  }

  const g = lvl.goal;
  if (
    player.x + player.w > g.x &&
    player.x < g.x + g.w &&
    player.y + player.h > g.y &&
    player.y < g.y + g.h
  ) {
    won = true;
    running = false;
    const secs = elapsedMs / 1000;

    const prog = parseInt(sessionStorage.getItem('cube_prog') || '1');
    if (currentLvl + 1 > prog && currentLvl + 1 <= MAX_LEVELS) {
      sessionStorage.setItem('cube_prog', String(currentLvl + 1));
    }

    const u = window.FB?.currentUser();
    if (u) {
      window.FB.getProfile(u.uid).then(prof => {
        const up = {};
        if (!prof.name) up.name = u.displayName || 'Anonymous';
        if (!prof.photo) up.photo = '';
        if (Object.keys(up).length) window.FB.saveProfile(u.uid, up.name, up.photo);
      }).catch(() => {});
      window.FB.saveLevelTime(u.uid, currentLvl, secs)
        .then(res => drawWin(secs, res.isRecord, res.prev))
        .catch(() => drawWin(secs, false, null));
    } else {
      drawWin(secs, false, null);
    }
    return;
  }

  updateCam(lvl.w, lvl.h);
  draw(lvl);
  requestAnimationFrame(loop);
}

function draw(lvl) {
  const gr = ctx.createLinearGradient(0, 0, 0, VH);
  gr.addColorStop(0, lvl.bgA);
  gr.addColorStop(1, lvl.bgB);
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, VW, VH);

  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  for (const p of lvl.platforms) {
    ctx.fillStyle = p.c;
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.w, p.h, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.beginPath();
    ctx.roundRect(p.x + 3, p.y + 2, p.w - 6, Math.min(4, p.h / 2), 3);
    ctx.fill();
    if (p.moving) {
      ctx.strokeStyle = lvl.accent + '66';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(p.x + 1, p.y + 1, p.w - 2, p.h - 2, 5);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }

  for (const b of lvl.bouncePads) {
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 4);
    ctx.fill();
    const coils = 4;
    ctx.strokeStyle = lvl.accent;
    ctx.lineWidth = 2;
    for (let i = 0; i < coils; i++) {
      const cx = b.x + (b.w / coils) * (i + 0.5);
      ctx.beginPath();
      ctx.moveTo(cx - 4, b.y + b.h);
      ctx.lineTo(cx + 4, b.y + 2);
      ctx.stroke();
    }
    ctx.fillStyle = lvl.accent;
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▲', b.x + b.w / 2, b.y - 3);
    ctx.textAlign = 'left';
    ctx.lineWidth = 1;
  }

  for (const h of lvl.hazards) {
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
  }

  const g = lvl.goal;
  ctx.fillStyle = lvl.accent;
  ctx.shadowColor = lvl.accent;
  ctx.shadowBlur = 22;
  ctx.beginPath();
  ctx.roundRect(g.x, g.y, g.w, g.h, 6);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('★', g.x + g.w / 2, g.y + g.h / 2 + 5);
  ctx.textAlign = 'left';

  drawPlayer(lvl.accent);
  ctx.restore();
  drawHUD(lvl);
}

function drawPlayer(accent) {
  const skin = currentSkin || SKINS.default;
  const hw = player.w / 2, hh = player.h / 2;
  ctx.save();
  ctx.translate(player.x + hw, player.y + hh);
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.beginPath();
  ctx.ellipse(2, hh + 4, hw + 2, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(player.rotation);
  if (skin.rainbow) {
    const rg = ctx.createLinearGradient(-hw, -hh, hw, hh);
    const t = (Date.now() % 2000) / 2000;
    const hsl = h => `hsl(${(h * 360 + t * 360) % 360}, 100%, 60%)`;
    rg.addColorStop(0, hsl(0));
    rg.addColorStop(0.33, hsl(0.33));
    rg.addColorStop(0.66, hsl(0.66));
    rg.addColorStop(1, hsl(1));
    ctx.fillStyle = rg;
  } else {
    ctx.fillStyle = skin.body || accent;
  }
  ctx.beginPath();
  ctx.roundRect(-hw, -hh, player.w, player.h, 4);
  ctx.fill();
  ctx.fillStyle = skin.shine;
  ctx.beginPath();
  ctx.roundRect(-hw + 3, -hh + 3, hw - 2, hh - 2, 3);
  ctx.fill();
  ctx.fillStyle = skin.eye;
  ctx.beginPath();
  ctx.arc(-3, -2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin.pupil;
  ctx.beginPath();
  ctx.arc(-3, -2, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHUD(lvl) {
  const t = (elapsedMs / 1000).toFixed(2);
  ctx.fillStyle = 'rgba(0,0,0,.65)';
  ctx.beginPath();
  ctx.roundRect(10, 10, 290, 30, 8);
  ctx.fill();
  ctx.fillStyle = lvl.accent;
  ctx.font = 'bold 11px Nunito,sans-serif';
  ctx.fillText(`LVL ${currentLvl}/${MAX_LEVELS} · ⏱ ${t}s · SKIN: ${(currentSkin || SKINS.default).label}`, 18, 30);
}

function drawWin(secs, isRecord, prev) {
  const lvl = LEVELS[currentLvl];
  ctx.fillStyle = 'rgba(0,0,0,.92)';
  ctx.fillRect(0, 0, VW, VH);
  const grd = ctx.createRadialGradient(VW / 2, VH / 2, 0, VW / 2, VH / 2, 200);
  grd.addColorStop(0, lvl.accent + '44');
  grd.addColorStop(1, 'transparent');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, VW, VH);

  ctx.textAlign = 'center';
  ctx.fillStyle = lvl.accent;
  ctx.shadowColor = lvl.accent;
  ctx.shadowBlur = 28;
  ctx.font = 'bold 46px Nunito,sans-serif';
  ctx.fillText('✓  LEVEL CLEAR!', VW / 2, VH / 2 - 64);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 26px Nunito,sans-serif';
  ctx.fillText('⏱  ' + secs.toFixed(3) + 's', VW / 2, VH / 2 - 18);

  if (isRecord) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 13px Nunito,sans-serif';
    ctx.fillText('🏅 NEW PERSONAL BEST!' + (prev != null ? `  (prev: ${prev.toFixed(3)}s)` : ''), VW / 2, VH / 2 + 14);
  }

  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.font = 'bold 14px Nunito,sans-serif';
  ctx.fillText(
    currentLvl >= MAX_LEVELS ? '🎉 YOU BEAT ALL 10 LEVELS!' : 'Level ' + (currentLvl + 1) + ' unlocked ★',
    VW / 2,
    VH / 2 + (isRecord ? 38 : 22)
  );
  ctx.fillStyle = 'rgba(255,255,255,.28)';
  ctx.font = '12px Nunito,sans-serif';
  ctx.fillText('Tap or click to continue', VW / 2, VH / 2 + (isRecord ? 62 : 46));
  ctx.textAlign = 'left';

  const back = () => location.reload();
  canvas.addEventListener('click', back, { once: true });
  canvas.addEventListener('touchend', back, { once: true });
}