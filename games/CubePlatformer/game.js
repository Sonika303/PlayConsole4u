// game.js — Cube Platformer engine (requires levels.js first)
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const VW = 800, VH = 500;
canvas.width = VW; canvas.height = VH;

const G = 0.5;
const MAX_LEVELS = 10;
let cam, player, currentLvl, running, won, keys;
let timerStart, elapsedMs = 0;

function makePlayer(sx,sy){
  return{x:sx,y:sy,w:24,h:24,dx:0,dy:0,jumps:0,maxJumps:2,
         onWall:false,wallDir:0,onGround:false,prevY:sy,
         rotation:0,spinSpeed:0,sx,sy};
}

// ── INPUT ──────────────────────────────────────
keys={};
window.addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(/Space|ArrowUp|KeyW/.test(e.code)&&running&&!won)jump();
});
window.addEventListener('keyup',e=>{keys[e.code]=false});

function jump(){
  if(player.onWall){
    player.dy=-11.5;player.dx=-player.wallDir*9;
    player.jumps=1;player.onWall=false;
    player.spinSpeed=player.wallDir*0.18;
  }else if(player.jumps<player.maxJumps){
    player.dy=-11.5;player.jumps++;
    const d=keys['KeyD']||keys['ArrowRight']?1:keys['KeyA']||keys['ArrowLeft']?-1:player.dx>0?1:-1;
    player.spinSpeed=d*0.15;
  }
}

// ── TOUCH ──────────────────────────────────────
function setupTouch(){
  document.getElementById('touch-hud')?.remove();
  const hud=document.createElement('div');hud.id='touch-hud';
  hud.innerHTML=`<style>
#touch-hud{position:fixed;bottom:14px;left:0;width:100%;display:flex;
  justify-content:space-between;padding:0 14px;box-sizing:border-box;pointer-events:none;z-index:30}
.tb{width:58px;height:58px;background:rgba(255,255,255,.08);
  border:2px solid rgba(255,255,255,.2);border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  font-size:18px;color:#fff;pointer-events:all;user-select:none;-webkit-user-select:none}
#t-dpad{display:flex;gap:10px}
</style>
<div id="t-dpad"><div class="tb" id="tl">◀</div><div class="tb" id="tr">▶</div></div>
<div class="tb" id="tj">▲</div>`;
  document.body.appendChild(hud);
  const bind=(id,code)=>{
    const el=document.getElementById(id);
    el.addEventListener('touchstart',e=>{e.preventDefault();keys[code]=true},{passive:false});
    el.addEventListener('touchend',  e=>{e.preventDefault();keys[code]=false},{passive:false});
  };
  bind('tl','KeyA');bind('tr','KeyD');
  document.getElementById('tj').addEventListener('touchstart',e=>{
    e.preventDefault();if(running&&!won)jump();
  },{passive:false});
}

function respawn(){
  player.x=player.sx;player.y=player.sy;
  player.dx=0;player.dy=0;player.jumps=0;
  player.onWall=false;player.onGround=false;
  player.rotation=0;player.spinSpeed=0;
}

function initGame(lvlNum){
  const lvl=LEVELS[lvlNum];
  currentLvl=lvlNum;won=false;running=true;
  player=makePlayer(lvl.spawn.x,lvl.spawn.y);
  cam={x:0,y:0};
  timerStart=performance.now();elapsedMs=0;
  setupTouch();
  requestAnimationFrame(loop);
}

function updateCam(wW,wH){
  cam.x+=(player.x+player.w/2-VW/2-cam.x)*0.12;
  cam.y+=(player.y+player.h/2-VH/2-cam.y)*0.12;
  cam.x=Math.max(0,Math.min(cam.x,wW-VW));
  cam.y=Math.max(0,Math.min(cam.y,wH-VH));
}

// ── LOOP ───────────────────────────────────────
function loop(){
  if(!running||won)return;
  const lvl=LEVELS[currentLvl];
  elapsedMs=performance.now()-timerStart;

  if(keys['KeyD']||keys['ArrowRight'])player.dx+=0.85;
  if(keys['KeyA']||keys['ArrowLeft']) player.dx-=0.85;
  player.dx*=0.83;
  player.x+=player.dx;
  player.prevY=player.y;
  player.dy+=G;
  player.y+=player.dy;

  player.x=Math.max(0,Math.min(player.x,lvl.w-player.w));
  if(player.y>lvl.h+60)respawn();

  player.onWall=false;player.onGround=false;

  lvl.platforms.forEach(p=>{
    if(player.x+player.w<=p.x||player.x>=p.x+p.w)return;
    if(player.y+player.h<=p.y||player.y>=p.y+p.h)return;
    const wasAbove=player.prevY+player.h<=p.y+5;
    const wasBelow=player.prevY>=p.y+p.h-5;
    if(player.dy>=0&&wasAbove){
      player.y=p.y-player.h;player.dy=0;player.jumps=0;player.onGround=true;
      const snap=Math.round(player.rotation/(Math.PI/2))*(Math.PI/2);
      player.rotation+=(snap-player.rotation)*0.25;player.spinSpeed=0;
    }else if(player.dy<0&&wasBelow){
      player.y=p.y+p.h;player.dy=0;
    }else{
      player.onWall=true;
      player.wallDir=(player.x+player.w/2<p.x+p.w/2)?1:-1;
      player.dx=0;player.dy*=0.75;
    }
  });

  if(!player.onGround){
    player.rotation+=player.spinSpeed;
    player.spinSpeed*=0.98;
    if(Math.abs(player.spinSpeed)<0.04)player.spinSpeed=player.dx*0.012;
  }

  lvl.hazards.forEach(h=>{
    if(player.x+player.w>h.x&&player.x<h.x+h.w&&player.y+player.h>h.y&&player.y<h.y+h.h)respawn();
  });

  const g=lvl.goal;
  if(player.x+player.w>g.x&&player.x<g.x+g.w&&player.y+player.h>g.y&&player.y<g.y+g.h){
    won=true;running=false;
    const secs=elapsedMs/1000;
    const next=currentLvl+1;
    const prog=parseInt(sessionStorage.getItem('cube_prog')||'1');
    if(next>prog&&next<=MAX_LEVELS)sessionStorage.setItem('cube_prog',String(next));
    // Save to Firebase if logged in
    const u=window.FB?.currentUser();
    if(u){
      window.FB.getUsername(u.uid).then(uname=>{
        const name=uname||u.displayName||'Anonymous';
        window.FB.saveBestTime(u.uid,currentLvl,secs);
        window.FB.submitLeaderboard(u.uid,name,currentLvl,secs);
      });
    }
    drawWin(secs);return;
  }

  updateCam(lvl.w,lvl.h);
  draw(lvl);
  requestAnimationFrame(loop);
}

// ── DRAW ───────────────────────────────────────
function draw(lvl){
  const grad=ctx.createLinearGradient(0,0,0,VH);
  grad.addColorStop(0,lvl.bgA);grad.addColorStop(1,lvl.bgB);
  ctx.fillStyle=grad;ctx.fillRect(0,0,VW,VH);

  ctx.save();ctx.translate(-cam.x,-cam.y);

  // Platforms
  lvl.platforms.forEach(p=>{
    ctx.fillStyle=p.c;
    ctx.beginPath();ctx.roundRect(p.x,p.y,p.w,p.h,5);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.13)';
    ctx.beginPath();ctx.roundRect(p.x+3,p.y+2,p.w-6,Math.min(5,p.h/2),3);ctx.fill();
  });

  // Hazards
  lvl.hazards.forEach(h=>{
    ctx.fillStyle='#7f1d1d';
    ctx.beginPath();ctx.roundRect(h.x,h.y,h.w,h.h,3);ctx.fill();
    ctx.fillStyle='#ef4444';
    const n=Math.floor(h.w/14);
    for(let i=0;i<n;i++){
      const sx=h.x+i*14+7;
      ctx.beginPath();ctx.moveTo(sx-5,h.y);ctx.lineTo(sx,h.y-9);ctx.lineTo(sx+5,h.y);
      ctx.closePath();ctx.fill();
    }
  });

  // Goal — use level accent color
  const g=lvl.goal;
  ctx.fillStyle=lvl.accent||'#fbbf24';
  ctx.shadowColor=lvl.accent||'#fbbf24';ctx.shadowBlur=18;
  ctx.beginPath();ctx.roundRect(g.x,g.y,g.w,g.h,6);ctx.fill();
  ctx.shadowBlur=0;
  ctx.fillStyle='#fff';ctx.font='bold 14px sans-serif';
  ctx.textAlign='center';ctx.fillText('★',g.x+g.w/2,g.y+g.h/2+5);ctx.textAlign='left';

  // Player
  const hw=player.w/2,hh=player.h/2;
  ctx.save();ctx.translate(player.x+hw,player.y+hh);
  ctx.fillStyle='rgba(255,255,255,.15)';
  ctx.beginPath();ctx.ellipse(2,hh+4,hw+2,4,0,0,Math.PI*2);ctx.fill();
  ctx.rotate(player.rotation);
  ctx.fillStyle=lvl.accent||'#2563eb';
  ctx.beginPath();ctx.roundRect(-hw,-hh,player.w,player.h,4);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.35)';
  ctx.beginPath();ctx.roundRect(-hw+3,-hh+3,hw-2,hh-2,3);ctx.fill();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-3,-2,3,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(0,0,0,.5)';ctx.beginPath();ctx.arc(-3,-2,1.5,0,Math.PI*2);ctx.fill();
  ctx.restore();

  ctx.restore();

  // HUD — timer + level
  const t=elapsedMs/1000;
  const tStr=t.toFixed(2)+'s';
  ctx.fillStyle='rgba(0,0,0,.55)';
  ctx.beginPath();ctx.roundRect(10,10,310,30,8);ctx.fill();
  ctx.fillStyle=lvl.accent||'#fff';
  ctx.font='bold 11px Nunito,sans-serif';
  ctx.fillText(`LVL ${currentLvl}/${MAX_LEVELS}  ·  ${lvl.name}  ·  ⏱ ${tStr}`,18,30);
}

// ── WIN ────────────────────────────────────────
function drawWin(secs){
  const lvl=LEVELS[currentLvl];
  ctx.fillStyle='rgba(0,0,0,.88)';ctx.fillRect(0,0,VW,VH);
  ctx.fillStyle=lvl.accent||'#60a5fa';
  ctx.font='bold 46px Nunito,sans-serif';ctx.textAlign='center';
  ctx.fillText('✓  LEVEL CLEAR!',VW/2,VH/2-60);
  ctx.fillStyle='#fff';ctx.font='bold 22px Nunito,sans-serif';
  ctx.fillText(`⏱  ${secs.toFixed(2)}s`,VW/2,VH/2-20);
  ctx.fillStyle='#ccc';ctx.font='bold 16px Nunito,sans-serif';
  ctx.fillText(currentLvl>=MAX_LEVELS?'🎉 ALL LEVELS COMPLETE!':
    `Level ${currentLvl+1} unlocked ★`,VW/2,VH/2+18);
  ctx.fillStyle='#888';ctx.font='13px Nunito,sans-serif';
  ctx.fillText('Click or tap to continue',VW/2,VH/2+52);
  ctx.textAlign='left';
  const back=()=>location.reload();
  canvas.addEventListener('click',back,{once:true});
  canvas.addEventListener('touchend',back,{once:true});
}