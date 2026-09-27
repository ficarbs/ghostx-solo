// Demons, the Rift Sovereign boss, projectiles, and ground loot.
import { G } from './state.js';
import { MOBS, ITEMS, GRAVITY, CURRENCY, RANKS } from './data.js';
import { addText, burst, shake, log, effect, banner, rand, randi, clamp } from './fx.js';
import { hurtPlayer, gainExp, physics, bodyBox, overlaps, registerHit } from './player.js';
import { addItem } from './items.js';
import { gainBotExp, say } from './bots.js';
import { onKill } from './quests.js';
import { sfx } from './audio.js';

let uid = 0;

// opts.elite: tougher mission variant. opts.ex: post-game boss. Both scale stats and rewards.
export function spawnMob(type, plat, x, opts = {}) {
  const d = MOBS[type];
  const floating = d.kind === 'floater';
  const k = opts.ex ? { hp: 3.2, atk: 1.7, def: 2, exp: 4, gold: 3, drop: 1, size: 1.1, lv: 8 }
    : opts.elite ? { hp: 3, atk: 1.3, def: 1.5, exp: 3, gold: 3, drop: 2.5, size: 1.25, lv: 2 }
    : { hp: 1, atk: 1, def: 1, exp: 1, gold: 1, drop: 1, size: 1, lv: 0 };
  const m = {
    id: ++uid, type, d, plat,
    x, y: floating ? plat.y - rand(40, 70) : plat.y,
    homeX: x, homeY: plat.y - 55,
    vx: 0, vy: 0, w: d.w * k.size, h: d.h * k.size, size: k.size,
    hp: Math.round(d.hp * k.hp), maxHp: Math.round(d.hp * k.hp),
    atkv: d.atk * k.atk, def: Math.round(d.def * k.def), exp: Math.round(d.exp * k.exp),
    goldMul: k.gold, dropMul: k.drop, lv: d.lv + k.lv,
    name: opts.ex ? d.name + ' EX' : opts.elite ? 'Elite ' + d.name : d.name,
    elite: !!opts.elite, ex: !!opts.ex,
    face: Math.random() < 0.5 ? -1 : 1,
    alive: true, deadT: 0, aggro: false,
    state: 'idle', t: rand(0.5, 2.5),
    hurtT: 0, flash: 0, atkCd: rand(1.5, 3), anim: Math.random() * 10,
    showBar: 0,
  };
  if (d.kind === 'boss') {
    Object.assign(m, { st: 'intro', aiT: 1.6, atk: null, summons: 0 });
    G.boss = m;
  }
  G.mobs.push(m);
  return m;
}

export function damageMob(m, dmg, crit, dir, opts = {}) {
  if (!m.alive) return;
  m.hp -= dmg;
  m.flash = 0.12;
  m.showBar = 4;
  m.aggro = true;
  registerHit();
  sfx(crit ? 'crit' : 'hit');
  if (crit) G.hitstop = Math.max(G.hitstop, 0.04);
  addText(m.x + rand(-8, 8), m.y - m.h - 8, crit ? dmg + '!' : dmg, crit ? 'crit' : 'dmg');
  burst(m.x, m.y - m.h / 2, crit ? '#ffb347' : '#fff3c4', crit ? 12 : 6, crit ? 260 : 180, { grav: 200, glow: true });
  effect({ type: 'hit', x: m.x - dir * 6, y: m.y - m.h / 2, dur: 0.12, crit });
  // Demons nearby join the fight.
  for (const o of G.mobs) if (o !== m && o.alive && !o.aggro && Math.abs(o.x - m.x) < 260 && Math.abs(o.y - m.y) < 120) o.aggro = true;
  if (m.d.kind !== 'boss') {
    const heavy = m.d.heavy ? 0.3 : 1;
    m.hurtT = m.d.heavy ? 0.08 : 0.25;
    m.vx = dir * (opts.knock ?? 120) * heavy;
    if (opts.up && m.d.kind === 'walker' && !m.d.heavy) {
      m.vy = -opts.up;
      m.airborne = true;
    }
  }
  if (m.hp <= 0) killMob(m);
}

function killMob(m) {
  m.alive = false;
  m.hp = 0;
  m.deadT = m.d.kind === 'boss' ? 2.5 : 0.6;
  sfx('kill');
  G.hitstop = Math.max(G.hitstop, m.d.kind === 'boss' ? 0.3 : 0.05);
  const p = G.player;
  const exp = Math.round(m.exp * (1 + RANKS[p.rank].exp));
  gainExp(exp);
  gainBotExp(exp);
  dropLoot(m);
  burst(m.x, m.y - m.h / 2, m.type === 'wisp' ? '#ff5af0' : '#ff8a6a', 18, 220, { grav: -60, glow: true });
  if (Math.random() < 0.25) say('kill');
  onKill(m.type);
  if (m.d.kind === 'boss') {
    G.boss = null;
    shake(20);
    sfx('victory');
    banner('VICTORY', 'The Rift Sovereign has fallen. The rift is closing.');
    log('Rift Sovereign has been defeated!', 'lvl');
    for (const o of G.mobs) if (o !== m && o.alive && o.summoned) { o.alive = false; o.deadT = 0.5; }
    G.projs = [];
    G.hooks.bossDown?.(m);
    G.hooks.save?.();
  }
}

function dropLoot(m) {
  const [g1, g2] = m.d.gold;
  const coins = m.d.kind === 'boss' ? 6 : 1;
  for (let i = 0; i < coins; i++) {
    G.drops.push(makeDrop(m, { gold: Math.round((randi(g1, g2) * m.goldMul) / coins) }));
  }
  for (const [id, chance] of m.d.drops) {
    if (Math.random() < chance * m.dropMul) G.drops.push(makeDrop(m, { id }));
  }
}

function makeDrop(m, o) {
  return { ...o, x: m.x + rand(-12, 12), y: m.y - m.h / 2, vx: rand(-110, 110), vy: rand(-420, -280), w: 16, h: 16, t: 0, onGround: false, dropT: 0 };
}

export function updateDrops(dt) {
  const p = G.player;
  for (const d of G.drops) {
    d.t += dt;
    if (!d.onGround) {
      physics(d, dt);
      if (d.onGround) d.vx = 0;
    }
    if (!p.dead && d.t > 0.4 && Math.abs(d.x - p.x) < 28 && d.y > p.y - p.h - 10 && d.y < p.y + 10) {
      if (d.gold) {
        p.gold += d.gold;
        sfx('coin');
        addText(d.x, d.y - 20, `+${d.gold} ${CURRENCY}`, 'gold');
        d.taken = true;
        G.dirty = true;
      } else if (addItem(d.id, 1)) {
        const it = ITEMS[d.id];
        sfx('pickup');
        log(`Picked up ${it.name}.`, it.rare ? 'rare' : 'loot');
        d.taken = true;
        if (it.rare) burst(d.x, d.y, '#ffd86a', 16, 200, { grav: -50, glow: true });
      }
    }
  }
  G.drops = G.drops.filter((d) => !d.taken && d.t < 90);
}

export function updateProjs(dt) {
  const p = G.player;
  const pb = bodyBox(p);
  for (const pr of G.projs) {
    pr.t += dt;
    if (pr.delay > 0) {
      pr.delay -= dt;
      continue;
    }
    pr.vy += (pr.grav || 0) * dt;
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    if (Math.random() < 0.6) G.parts.push({ x: pr.x, y: pr.y, vx: rand(-20, 20), vy: rand(-20, 20), life: 0.3, t: 0, color: pr.color, size: pr.r * 0.5, grav: 0, glow: true });
    const hb = { x1: pr.x - pr.r, x2: pr.x + pr.r, y1: pr.y - pr.r, y2: pr.y + pr.r };
    if (!p.dead && overlaps(pb, hb)) {
      hurtPlayer(pr.dmg, pr.x, true);
      pr.dead = true;
      burst(pr.x, pr.y, pr.color, 10, 160, { glow: true, grav: 0 });
    }
    if (pr.y > G.map.def.floor) {
      pr.dead = true;
      burst(pr.x, G.map.def.floor - 4, pr.color, 8, 180, { glow: true, up: -120 });
    }
    if (pr.t > pr.life) pr.dead = true;
  }
  G.projs = G.projs.filter((pr) => !pr.dead);
}

function shoot(x, y, tx, ty, speed, dmg, color, r = 9, o = {}) {
  const a = Math.atan2(ty - y, tx - x);
  G.projs.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r, dmg, color, t: 0, life: 4, ...o });
}

export function updateMobs(dt) {
  const p = G.player;
  const pb = bodyBox(p);
  for (const m of G.mobs) {
    m.anim += dt;
    if (!m.alive) {
      m.deadT -= dt;
      continue;
    }
    m.flash -= dt;
    m.hurtT -= dt;
    m.showBar -= dt;
    if (m.d.kind === 'boss') updateBoss(m, dt);
    else if (m.d.kind === 'floater') updateFloater(m, dt);
    else updateWalker(m, dt);

    if (!p.dead && overlaps(pb, { x1: m.x - m.w / 2 + 4, x2: m.x + m.w / 2 - 4, y1: m.y - m.h + 4, y2: m.y })) {
      const attacking = m.st === 'lunge' || m.charging || m.pouncing || m.diving > 0;
      const mul = m.st === 'lunge' ? 1.4 : m.charging ? 1.3 : m.pouncing || m.diving > 0 ? 1.2 : 1;
      hurtPlayer(m.atkv * mul, m.x, attacking);
    }
  }
  G.mobs = G.mobs.filter((m) => m.alive || m.deadT > 0);
}

function senseAggro(m) {
  const p = G.player;
  const dx = p.x - m.x;
  const dy = p.y - m.y;
  if (p.dead) {
    m.aggro = false;
    return;
  }
  if (!m.aggro && m.d.aggro && Math.abs(dx) < m.d.aggro && Math.abs(dy) < 140) m.aggro = true;
  if (m.aggro && (Math.abs(dx) > 650 || Math.abs(dy) > 400)) m.aggro = false;
}

function updateWalker(m, dt) {
  const p = G.player;
  const pl = m.plat;
  senseAggro(m);
  const dx = p.x - m.x;
  const sameLevel = Math.abs(p.y - m.y) < 70;

  if (m.hurtT > 0) {
    m.vx *= Math.pow(0.02, dt);
    m.charging = false;
  } else if (m.windup > 0) {
    m.vx = 0;
    m.windup -= dt;
    if (m.windup <= 0) releaseAttack(m);
  } else if (m.charging) {
    m.chargeT -= dt;
    if (Math.random() < 0.7) burst(m.x - m.face * 20, m.y - 4, 'rgba(210,190,150,0.8)', 1, 60, { grav: 0 });
    if (m.chargeT <= 0) {
      m.charging = false;
      m.atkCd = rand(2.5, 4);
    }
  } else if (m.aggro && sameLevel) {
    m.face = Math.sign(dx) || m.face;
    m.vx = Math.abs(dx) < 10 ? 0 : m.face * m.d.speed * 1.5;
    m.atkCd -= dt;
    const adx = Math.abs(dx);
    if (m.atkCd <= 0 && !m.airborne) {
      if (m.d.charge && adx < 260 && adx > 60) windup(m, 0.45);
      else if (m.d.pounce && adx < 170 && adx > 30) windup(m, 0.35);
      else if (m.d.pound && adx < 150) windup(m, 0.65);
    }
  } else {
    m.t -= dt;
    if (m.t <= 0) {
      m.t = rand(1.2, 3.2);
      m.state = Math.random() < 0.35 ? 'idle' : 'walk';
      if (m.state === 'walk') m.face = Math.random() < 0.5 ? -1 : 1;
    }
    m.vx = m.state === 'walk' ? m.face * m.d.speed : 0;
  }

  m.x += m.vx * dt;
  // Keep demons on the same platform from stacking on one spot.
  for (const o of G.mobs) {
    if (o === m || !o.alive || o.plat !== pl || o.d.kind !== 'walker') continue;
    const gap = (m.w + o.w) * 0.35, d = m.x - o.x;
    if (Math.abs(d) < gap) m.x += (Math.sign(d) || (m.id < o.id ? -1 : 1)) * Math.min(gap - Math.abs(d), 80 * dt);
  }
  const minX = pl.x + m.w / 2, maxX = pl.x + pl.w - m.w / 2;
  if (m.x < minX) {
    m.x = minX;
    if (!m.aggro) m.face = 1;
    m.charging = false;
  } else if (m.x > maxX) {
    m.x = maxX;
    if (!m.aggro) m.face = -1;
    m.charging = false;
  }
  if (m.airborne) {
    m.vy += GRAVITY * dt;
    m.y += m.vy * dt;
    if (m.y >= pl.y) {
      m.y = pl.y;
      m.vy = 0;
      m.airborne = false;
      if (m.pouncing) {
        m.pouncing = false;
        m.vx = 0;
        m.atkCd = rand(1.6, 2.6);
        burst(m.x, m.y, 'rgba(210,190,150,0.8)', 6, 100, { grav: 0 });
      }
    }
  }
}

function windup(m, t) {
  m.windup = t;
  m.vx = 0;
  effect({ type: 'alert', x: m.x, y: m.y - m.h * m.size - 18, dur: t });
}

// The telegraphed attack fires when the windup ends.
function releaseAttack(m) {
  const p = G.player;
  if (m.d.charge) {
    m.charging = true;
    m.chargeT = 0.7;
    m.vx = m.face * 380;
  } else if (m.d.pounce) {
    m.pouncing = true;
    m.airborne = true;
    m.vy = -430;
    m.vx = m.face * 280;
    sfx('jump');
  } else if (m.d.pound) {
    // Shockwave along the platform: jump over it.
    m.atkCd = rand(2.6, 3.6);
    shake(8);
    sfx('slam');
    effect({ type: 'ring', x: m.x, y: m.y, r: 170, color: '#ffa030', dur: 0.4 });
    burst(m.x, m.y, '#a8a0a0', 20, 280, { up: -160, grav: 900 });
    if (!p.dead && p.onGround && Math.abs(p.y - m.y) < 20 && Math.abs(p.x - m.x) < 170) hurtPlayer(m.atkv * 1.3, m.x, true);
  }
}

function updateFloater(m, dt) {
  const p = G.player;
  senseAggro(m);
  const pl = m.plat;
  m.blinkCd = (m.blinkCd || 0) - dt;
  // Wisps: telegraphed swoop at the player.
  if (m.d.dive && m.hurtT <= 0) {
    if (m.diving > 0) {
      m.diving -= dt;
      m.x += m.dvx * dt;
      m.y = Math.min(m.y + m.dvy * dt, pl.floor ? pl.y - 10 : pl.y + 80);
      if (m.diving <= 0) m.atkCd = rand(2, 3.2);
      return;
    }
    if (m.diveWind > 0) {
      m.diveWind -= dt;
      m.casting = m.diveWind;
      if (m.diveWind <= 0) {
        const a = Math.atan2(p.y - 30 - m.y, p.x - m.x);
        m.dvx = Math.cos(a) * 430;
        m.dvy = Math.sin(a) * 430;
        m.diving = 0.45;
        sfx('dash');
      }
      return;
    }
    if (m.aggro) {
      m.atkCd -= dt;
      if (m.atkCd <= 0 && Math.hypot(p.x - m.x, p.y - m.y) < 260) {
        m.diveWind = 0.45;
        effect({ type: 'alert', x: m.x, y: m.y - m.h - 18, dur: 0.45 });
      }
    }
  }
  // Specters: blink away when the player gets close.
  if (m.d.blink && m.aggro && m.blinkCd <= 0 && Math.abs(p.x - m.x) < 110 && Math.abs(p.y - m.y) < 100) {
    burst(m.x, m.y - m.h / 2, '#8a7aff', 16, 200, { grav: 0, glow: true });
    m.x = clamp(p.x + (m.x < p.x ? -1 : 1) * 260, pl.x - 100, pl.x + pl.w + 100);
    m.blinkCd = 3.5;
    m.atkCd = Math.min(m.atkCd, 0.6);
    burst(m.x, m.y - m.h / 2, '#8a7aff', 16, 200, { grav: 0, glow: true });
    sfx('portal');
  }
  let tx, ty;
  if (m.aggro) {
    tx = p.x;
    ty = p.y - 40;
    m.face = Math.sign(p.x - m.x) || m.face;
  } else {
    tx = m.homeX + Math.sin(m.anim * 0.4) * 90;
    ty = m.homeY;
    m.face = Math.sign(tx - m.x) || m.face;
  }
  tx = clamp(tx, pl.x - 120, pl.x + pl.w + 120);
  ty = clamp(ty, pl.y - 200, pl.floor ? pl.y - 20 : pl.y + 60) + Math.sin(m.anim * 2.4) * 8;
  if (m.hurtT > 0) {
    m.x += m.vx * dt;
    m.vx *= Math.pow(0.05, dt);
  } else {
    const sp = m.d.speed * (m.aggro ? 1.3 : 1);
    const dx = tx - m.x, dy = ty - m.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist > 4 && !(m.aggro && m.d.shoots && dist < 180)) {
      m.x += (dx / dist) * sp * dt;
      m.y += (dy / dist) * sp * dt;
    }
  }
  if (m.d.shoots && m.aggro) {
    m.atkCd -= dt;
    if (m.atkCd <= 0 && Math.abs(p.x - m.x) < 450) {
      m.atkCd = rand(2.4, 3.4);
      m.casting = 0.4;
      sfx('enemy_shot');
      shoot(m.x, m.y - m.h / 2, p.x, p.y - 30, 250, m.atkv * 0.9, '#b8a8ff', 8, { life: 3 });
    }
  }
  m.casting = Math.max(0, (m.casting || 0) - dt);
}

// ---------- Gumiho boss ----------

function updateBoss(m, dt) {
  const p = G.player;
  const map = G.map;
  const floor = map.def.floor;
  const hpf = m.hp / m.maxHp;
  const dx = p.x - m.x;
  m.aiT -= dt;
  m.y = floor;

  if (m.st === 'intro') {
    if (m.aiT <= 0) {
      m.st = 'move';
      m.aiT = 1.5;
    }
    return;
  }

  if (m.st === 'move') {
    m.face = Math.sign(dx) || m.face;
    m.vx = Math.abs(dx) < 90 ? 0 : m.face * m.d.speed * (hpf < 0.35 ? 1.4 : 1);
    m.x = clamp(m.x + m.vx * dt, m.w / 2, map.w - m.w / 2);
    if (m.aiT <= 0 && !p.dead) chooseBossAttack(m, hpf, dx);
    return;
  }

  const a = m.atk;
  a.t -= dt;
  if (m.st === 'fire') {
    if (!a.fired && a.t <= 0.5) {
      a.fired = true;
      const n = hpf < 0.5 ? 7 : 5;
      const base = Math.atan2(p.y - 40 - (m.y - 70), p.x - m.x);
      for (let i = 0; i < n; i++) {
        const ang = base + (i - (n - 1) / 2) * 0.16;
        G.projs.push({ x: m.x + m.face * 40, y: m.y - 70, vx: Math.cos(ang) * 330, vy: Math.sin(ang) * 330, r: 11, dmg: m.atkv * 1.1, color: '#ff6ad5', t: 0, life: 4 });
      }
      burst(m.x + m.face * 40, m.y - 70, '#ff8ae0', 16, 220, { glow: true, grav: 0 });
      sfx('boss_fire');
    }
  } else if (m.st === 'lunge') {
    if (a.phase === 'wind' && a.t <= 0) {
      a.phase = 'go';
      a.t = 0.9;
      shake(6);
    }
    if (a.phase === 'go') {
      m.x += m.face * 720 * dt;
      if (Math.random() < 0.8) burst(m.x - m.face * 50, m.y - 10, '#fff', 2, 90, { grav: 0 });
      if (m.x < m.w / 2 || m.x > map.w - m.w / 2) {
        m.x = clamp(m.x, m.w / 2, map.w - m.w / 2);
        a.t = 0;
        shake(10);
      }
    }
  } else if (m.st === 'sweep') {
    if (!a.fired && a.t <= 0.35) {
      a.fired = true;
      effect({ type: 'sweep', x: m.x, y: floor, face: m.face, dur: 0.35 });
      sfx('slam');
      shake(8);
      if (!p.dead && Math.abs(p.x - m.x) < 230 && p.y > floor - 40) hurtPlayer(m.atkv * 1.35, m.x, true);
    }
  } else if (m.st === 'summon') {
    if (!a.fired && a.t <= 0.4) {
      a.fired = true;
      for (let i = 0; i < 2; i++) {
        const w = spawnMob('wisp', map.plats[0], clamp(m.x + (i ? 120 : -120), 60, map.w - 60));
        w.summoned = true;
        w.aggro = true;
        w.y = floor - 120;
        burst(w.x, w.y, '#6cf0ff', 14, 160, { glow: true, grav: 0 });
      }
      m.summons++;
      sfx('portal');
    }
  } else if (m.st === 'rain') {
    if (!a.fired) {
      a.fired = true;
      sfx('warn');
      for (let i = 0; i < 7; i++) {
        const x = i === 0 ? p.x : rand(80, map.w - 80);
        effect({ type: 'warn', x, y: floor, dur: 0.9 });
        G.projs.push({ x, y: G.cam.y - 30, vx: 0, vy: 700, r: 13, dmg: m.atkv * 1.2, color: '#ff4fa0', t: 0, life: 5, delay: 0.9 });
      }
    }
  }

  if (a.t <= 0 && a.phase !== 'wind') {
    m.st = 'move';
    m.atk = null;
    m.aiT = hpf < 0.35 ? rand(0.5, 0.9) : rand(0.9, 1.5);
  }
}

function chooseBossAttack(m, hpf, dx) {
  const opts = ['fire', 'lunge'];
  if (Math.abs(dx) < 260) opts.push('sweep', 'sweep');
  if (hpf < 0.6 && G.mobs.filter((o) => o.alive && o.summoned).length < 3) opts.push('summon');
  if (hpf < 0.35) opts.push('rain', 'rain');
  const pick = opts[Math.floor(Math.random() * opts.length)];
  m.face = Math.sign(dx) || m.face;
  m.st = pick;
  if (pick === 'fire') m.atk = { t: 0.9 };
  else if (pick === 'lunge') {
    m.atk = { t: 0.7, phase: 'wind' };
    sfx('boss_roar');
    effect({ type: 'alert', x: m.x, y: m.y - m.h - 30, dur: 0.7 });
  } else if (pick === 'sweep') {
    m.atk = { t: 0.95 };
    effect({ type: 'alert', x: m.x, y: m.y - m.h - 30, dur: 0.6 });
  } else if (pick === 'summon') m.atk = { t: 1.0 };
  else if (pick === 'rain') m.atk = { t: 1.4 };
}
