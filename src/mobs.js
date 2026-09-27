// Demons, the Rift Sovereign boss, projectiles, and ground loot.
import { G } from './state.js';
import { MOBS, ITEMS, GRAVITY, CURRENCY, RANKS } from './data.js';
import { addText, burst, shake, log, effect, banner, rand, randi, clamp } from './fx.js';
import { hurtPlayer, gainExp, physics, bodyBox, overlaps, registerHit } from './player.js';
import { addItem, countItem } from './items.js';

const VICTORY = {
  sovereign: ['VICTORY', 'The Rift Sovereign has fallen. The rift is closing.'],
  rei: ['DUEL WON', 'Rei lowers her blade.'],
  queen: ['VICTORY', 'The Hollow Queen is silenced.'],
};
import { gainBotExp, say, partnerBot } from './bots.js';
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
  // opts.scale: Rift Tower floor multiplier on HP, attack, defense and rewards.
  const sc = opts.scale || 1;
  if (sc !== 1) Object.assign(k, { hp: k.hp * sc, atk: k.atk * (1 + (sc - 1) * 0.6), def: k.def * (1 + (sc - 1) * 0.5), exp: k.exp * sc, gold: k.gold * sc, lv: k.lv + Math.round((sc - 1) * 8) });
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
    tower: !!opts.tower, // Rift Tower spawns never advance quests or the story
    face: Math.random() < 0.5 ? -1 : 1,
    alive: true, deadT: 0, aggro: false,
    state: 'idle', t: rand(0.5, 2.5),
    hurtT: 0, flash: 0, atkCd: rand(1.5, 3), anim: Math.random() * 10,
    showBar: 0,
    big: d.kind === 'boss' || d.kind === 'rival', // boss bar, long death, no knockback
  };
  if (m.big) {
    Object.assign(m, { st: 'intro', aiT: 1.6, atk: null, summons: 0 });
    G.boss = m;
  }
  G.mobs.push(m);
  return m;
}

export function damageMob(m, dmg, crit, dir, opts = {}) {
  if (!m.alive) return;
  if (m.invuln > 0) {
    // Rei's dodge: the hit whiffs.
    addText(m.x, m.y - m.h - 8, 'MISS', 'info');
    return;
  }
  // Echo knights block basic attacks from the front (skills, crits and hits from behind get through).
  if (m.d.shield && opts.basic && !crit && !m.charging && dir === -m.face) {
    dmg = Math.max(1, Math.round(dmg * 0.2));
    addText(m.x, m.y - m.h - 20, 'BLOCK', 'info');
    burst(m.x + m.face * 20, m.y - m.h / 2, '#c8d8ff', 6, 140, { grav: 0, glow: true });
  }
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
  if (!m.big) {
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
  m.deadT = m.big ? 2.5 : 0.6;
  sfx('kill');
  G.hitstop = Math.max(G.hitstop, m.big ? 0.3 : 0.05);
  const p = G.player;
  const exp = Math.round(m.exp * (1 + RANKS[p.rank].exp));
  gainExp(exp);
  gainBotExp(exp);
  if (countItem('link_module')) {
    const pb = partnerBot(p);
    if (pb) gainBotExp(Math.round(exp * 0.5), pb);
  }
  dropLoot(m);
  burst(m.x, m.y - m.h / 2, m.type === 'wisp' ? '#ff5af0' : '#ff8a6a', 18, 220, { grav: -60, glow: true });
  if (Math.random() < 0.25) say('kill');
  if (!m.tower) onKill(m.type);
  if (m.big) {
    G.boss = null;
    shake(20);
    sfx('victory');
    const v = VICTORY[m.type] || ['VICTORY', `${m.name} has fallen.`];
    banner(v[0], m.ex ? `${m.name} has fallen.` : v[1]);
    log(`${m.name} has been defeated!`, 'lvl');
    for (const o of G.mobs) if (o !== m && o.alive && o.summoned) { o.alive = false; o.deadT = 0.5; }
    G.projs = [];
    G.hooks.bossDown?.(m);
    G.hooks.save?.();
  }
}

function dropLoot(m) {
  const [g1, g2] = m.d.gold;
  const coins = m.big ? 6 : 1;
  for (let i = 0; i < coins; i++) {
    G.drops.push(makeDrop(m, { gold: Math.round((randi(g1, g2) * m.goldMul) / coins) }));
  }
  for (const [id, chance] of m.d.drops) {
    if (Math.random() < chance * m.dropMul) G.drops.push(makeDrop(m, { id }));
  }
  // Quest-only drops (e.g. Min's toy drone) while their quest is active.
  for (const [id, it] of Object.entries(ITEMS)) {
    const qd = it.questDrop;
    if (qd && qd.from === m.type && G.player.quests[qd.quest]?.status === 'active' && !countItem(id) && Math.random() < qd.chance) G.drops.push(makeDrop(m, { id }));
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
    if (m.d.kind === 'rival') updateRival(m, dt);
    else if (m.type === 'queen') updateQueen(m, dt);
    else if (m.d.kind === 'boss') updateBoss(m, dt);
    else if (m.d.kind === 'floater') updateFloater(m, dt);
    else updateWalker(m, dt);

    if (!p.dead && !(m.d.kind === 'rival' && !m.charging) && overlaps(pb, { x1: m.x - m.w / 2 + 4, x2: m.x + m.w / 2 - 4, y1: m.y - m.h + 4, y2: m.y })) {
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
  } else if (m.pullT > 0) {
    // Void maw inhale: drags the player in, then bites.
    m.vx = 0;
    m.pullT -= dt;
    if (!p.dead && sameLevel && Math.abs(dx) < 340) {
      p.x -= Math.sign(dx) * 150 * dt;
      if (Math.random() < 0.6) G.parts.push({ x: m.x + dx * Math.random(), y: m.y - rand(10, 60), vx: -Math.sign(dx) * 220, vy: 0, life: 0.3, t: 0, color: '#8a5aff', size: 3, grav: 0 });
    }
    if (m.pullT <= 0) {
      m.atkCd = rand(3, 4);
      sfx('slam');
      effect({ type: 'ring', x: m.x + m.face * 30, y: m.y - 30, r: 70, color: '#8a5aff', dur: 0.3, round: true });
      if (!p.dead && sameLevel && Math.abs(dx) < 95) hurtPlayer(m.atkv * 1.4, m.x, true);
    }
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
      else if (m.d.stalk && adx < 300 && adx > 50) windup(m, 0.4);
      else if (m.d.pull && adx < 300) windup(m, 0.6);
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
  } else if (m.d.stalk) {
    // Glass stalker: blinks behind the player, then lunges.
    if (Math.abs(p.y - m.y) < 70) {
      burst(m.x, m.y - m.h / 2, '#bff4ff', 14, 180, { grav: 0, glow: true });
      m.x = clamp(p.x - p.face * 70, m.plat.x + m.w / 2, m.plat.x + m.plat.w - m.w / 2);
      m.face = Math.sign(p.x - m.x) || 1;
      burst(m.x, m.y - m.h / 2, '#bff4ff', 14, 180, { grav: 0, glow: true });
      sfx('portal');
    }
    m.charging = true;
    m.chargeT = 0.3;
    m.vx = m.face * 320;
  } else if (m.d.pull) {
    m.pullT = 1.0;
    sfx('boss_roar');
  } else if (m.d.pound) {
    // Shockwave along the platform: jump over it.
    m.atkCd = rand(2.6, 3.6);
    shake(8);
    sfx('slam');
    effect({ type: 'ring', x: m.x, y: m.y, r: 170, color: '#ffa030', dur: 0.4 });
    burst(m.x, m.y, '#a8a0a0', 20, 280, { up: -160, grav: 900 });
    if (!p.dead && p.onGround && Math.abs(p.y - m.y) < 20 && Math.abs(p.x - m.x) < 170) hurtPlayer(m.atkv * 1.3, m.x, true);
    // Hollow brutes slam twice: a second, wider wave follows.
    if (m.d.double) G.timers.push({ t: 0.5, fn: () => {
      if (!m.alive) return;
      shake(8);
      sfx('slam');
      effect({ type: 'ring', x: m.x, y: m.y, r: 230, color: '#e8e8ff', dur: 0.4 });
      if (!p.dead && p.onGround && Math.abs(p.y - m.y) < 20 && Math.abs(p.x - m.x) < 230) hurtPlayer(m.atkv * 1.2, m.x, true);
    } });
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
  // Shade sentinels: a visible aim line locks on, then a fast heavy bolt.
  if (m.d.snipe && m.aggro) {
    m.atkCd -= dt;
    if (m.aimT > 0) {
      m.aimT -= dt;
      m.casting = m.aimT;
      if (m.aimT <= 0) {
        const a = Math.atan2(m.aimY - (m.y - m.h / 2), m.aimX - m.x);
        G.projs.push({ x: m.x, y: m.y - m.h / 2, vx: Math.cos(a) * 950, vy: Math.sin(a) * 950, r: 9, dmg: m.atkv * 1.6, color: '#ff5a8a', t: 0, life: 2 });
        sfx('snipe');
        m.atkCd = rand(2.6, 3.4);
      }
    } else if (m.atkCd <= 0 && Math.abs(p.x - m.x) < 560) {
      m.aimT = 0.9;
      m.aimX = p.x;
      m.aimY = p.y - 30;
      effect({ type: 'aim', x1: m.x, y1: m.y - m.h / 2, x2: p.x, y2: p.y - 30, dur: 0.9 });
      sfx('warn');
    }
  }
  if (m.d.shoots && m.aggro) {
    m.atkCd -= dt;
    if (m.atkCd <= 0 && Math.abs(p.x - m.x) < 450) {
      m.atkCd = rand(2.4, 3.4);
      m.casting = 0.4;
      sfx('enemy_shot');
      const n = m.d.spread ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const a = Math.atan2(p.y - 30 - (m.y - m.h / 2), p.x - m.x) + (i - (n - 1) / 2) * 0.22;
        const sp = m.d.laser ? 560 : 260;
        G.projs.push({ x: m.x, y: m.y - m.h / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: m.d.laser ? 6 : 8, dmg: m.atkv * 0.9, color: m.d.laser ? '#ff3a4a' : m.d.spread ? '#bff4ff' : '#b8a8ff', t: 0, life: 3 });
      }
    }
  }
  m.casting = Math.max(0, (m.casting || 0) - dt);
}

// ---------- Rei, rival hunter ----------
// A hunter like you: closes in with a 3-hit slash combo, dashes through you, throws ground waves
// you can jump, and dodges your attacks. Faster below half HP.

function updateRival(m, dt) {
  const p = G.player;
  const map = G.map;
  const floor = map.def.floor;
  const hpf = m.hp / m.maxHp;
  const rage = hpf < 0.5 ? 1.35 : 1;
  const dx = p.x - m.x, adx = Math.abs(dx);
  m.aiT -= dt;
  m.invuln = Math.max(0, (m.invuln || 0) - dt);
  m.dodgeCd = (m.dodgeCd || 0) - dt;
  m.y = floor;
  if (m.st === 'intro') {
    if (m.aiT <= 0) { m.st = 'move'; m.aiT = 1; }
    return;
  }
  const a = m.atk;
  if (m.st === 'move') {
    m.face = Math.sign(dx) || m.face;
    const want = 70;
    m.vx = adx > want + 20 ? m.face * m.d.speed * rage : adx < want - 20 ? -m.face * m.d.speed * 0.6 : 0;
    // Dodge a basic attack or skill coming her way.
    if (m.dodgeCd <= 0 && adx < 130 && (p.attackT > 0 || p.act) && Math.random() < 0.5 * dt * 10) {
      m.st = 'dodge'; m.atk = { t: 0.35, dir: -Math.sign(dx) || 1 }; m.invuln = 0.35; m.dodgeCd = hpf < 0.5 ? 1.6 : 2.4;
      sfx('dash');
    } else if (m.aiT <= 0 && !p.dead) {
      const hollowMove = m.d.hollow ? pickHollowMove(m, hpf) : null;
      if (hollowMove) startHollowMove(m, hollowMove, p);
      else if (adx < 120) { m.st = 'slash'; m.atk = { t: 0.9, hits: 0, phase: 'wind' }; }
      else if (Math.random() < 0.5) { m.st = 'dash'; m.atk = { t: 0.75, phase: 'wind' }; effect({ type: 'alert', x: m.x, y: m.y - 80, dur: 0.35 }); }
      else { m.st = 'wave'; m.atk = { t: 0.6, fired: false, phase: 'wind' }; effect({ type: 'alert', x: m.x, y: m.y - 80, dur: 0.4 }); }
    }
  } else if (m.st === 'slash') {
    m.vx = 0;
    a.t -= dt * rage;
    // Three quick slashes at 0.6 / 0.35 / 0.1 remaining.
    const marks = [0.6, 0.35, 0.1];
    if (a.hits < 3 && a.t <= marks[a.hits]) {
      a.hits++;
      a.phase = a.hits % 2 ? 'hit' : 'wind';
      sfx(a.hits === 3 ? 'slash3' : 'slash');
      effect({ type: 'slash', x: m.x + m.face * 36, y: m.y - 34, face: m.face, combo: a.hits - 1, color: '#ff8ac8', dur: 0.18 });
      if (!p.dead && adx < 100 && Math.abs(p.y - m.y) < 60 && Math.sign(dx) === m.face) hurtPlayer(m.atkv * (a.hits === 3 ? 1.3 : 0.9), m.x, true);
    }
    if (a.t <= 0) endRival(m);
  } else if (m.st === 'dash') {
    a.t -= dt;
    if (a.phase === 'wind' && a.t <= 0.4) { a.phase = 'go'; sfx('dash'); }
    if (a.phase === 'go') {
      m.x = clamp(m.x + m.face * 760 * rage * dt, m.w, map.w - m.w);
      if (Math.random() < 0.8) G.parts.push({ x: m.x - m.face * 10, y: m.y - rand(10, 55), vx: -m.face * 60, vy: 0, life: 0.25, t: 0, color: '#ff8ac8', size: 3, grav: 0 });
      m.charging = true;
    } else m.vx = 0;
    if (a.t <= 0) { m.charging = false; endRival(m); }
  } else if (m.st === 'wave') {
    m.vx = 0;
    a.t -= dt;
    if (!a.fired && a.t <= 0.25) {
      a.fired = true;
      a.phase = 'hit';
      sfx('snipe');
      const n = hpf < 0.5 ? 2 : 1;
      for (let i = 0; i < n; i++) G.projs.push({ x: m.x + m.face * 30, y: floor - 18, vx: m.face * (420 + i * 160), vy: 0, r: 14, dmg: m.atkv, color: '#ff8ac8', t: 0, life: 3 });
    }
    if (a.t <= 0) endRival(m);
  } else if (m.st === 'beam') {
    m.vx = 0;
    a.t -= dt;
    if (!a.fired && a.t <= 0.3) {
      a.fired = true;
      a.phase = 'hit';
      effect({ type: 'hbeam', y: a.y, dur: 0.35 });
      shake(10);
      sfx('sync');
      if (!p.dead && Math.abs(p.y - 30 - a.y) < 34) hurtPlayer(m.atkv * 1.4, m.x, true);
    }
    if (a.t <= 0) endRival(m);
  } else if (m.st === 'storm') {
    // Three dashes in a row, turning to face you between each.
    a.t -= dt;
    a.leg -= dt;
    if (a.leg <= 0) {
      a.n++;
      a.leg = 0.42;
      m.face = Math.sign(dx) || m.face;
      effect({ type: 'alert', x: m.x, y: m.y - 80, dur: 0.18 });
      sfx('dash');
    }
    if (a.leg < 0.3) {
      m.x = clamp(m.x + m.face * 900 * dt, m.w, map.w - m.w);
      m.charging = true;
      if (Math.random() < 0.8) G.parts.push({ x: m.x - m.face * 10, y: m.y - rand(10, 55), vx: -m.face * 60, vy: 0, life: 0.25, t: 0, color: '#e8e8ff', size: 3, grav: 0 });
    } else m.charging = false;
    if (a.n >= 3 && a.leg <= 0.05) { m.charging = false; endRival(m); }
  } else if (m.st === 'summon') {
    m.vx = 0;
    a.t -= dt;
    if (!a.fired && a.t <= 0.4) {
      a.fired = true;
      for (let i = 0; i < 2; i++) {
        const d = spawnMob('hollow_drone', map.plats[0], clamp(m.x + (i ? 220 : -220), 80, map.w - 80));
        d.summoned = true;
        d.aggro = true;
        d.y = floor - 150;
        burst(d.x, d.y, '#e8e8ff', 16, 180, { glow: true, grav: 0 });
      }
      sfx('portal');
    }
    if (a.t <= 0) endRival(m);
  } else if (m.st === 'dodge') {
    a.t -= dt;
    m.x = clamp(m.x + a.dir * 520 * dt, m.w, map.w - m.w);
    if (a.t <= 0) { m.st = 'move'; m.atk = null; m.aiT = 0.25; }
  }
  if (m.st === 'move') m.x = clamp(m.x + m.vx * dt, m.w, map.w - m.w);
}

// Hollow Rei's extra moves: the Queen's beam, a triple-dash storm, and hollow-drone summons.
function pickHollowMove(m, hpf) {
  const r = Math.random();
  if (hpf < 0.3 && r < 0.3) return 'storm';
  if (hpf < 0.6 && r < 0.25) return 'beam';
  if (hpf < 0.8 && r < 0.12 && G.mobs.filter((o) => o.alive && o.summoned).length < 2) return 'summon';
  return null;
}

function startHollowMove(m, move, p) {
  m.st = move;
  if (move === 'beam') {
    m.atk = { t: 1.05, fired: false, y: p.y - 30, phase: 'wind' };
    effect({ type: 'hbeam', y: p.y - 30, dur: 0.75, warn: true });
    sfx('warn');
  } else if (move === 'storm') {
    m.atk = { t: 1.4, leg: 0, n: 0, phase: 'go' };
  } else m.atk = { t: 0.9, fired: false };
}

function endRival(m) {
  m.st = 'move';
  m.atk = null;
  m.aiT = (m.hp / m.maxHp < 0.5 ? rand(0.4, 0.8) : rand(0.8, 1.3));
}

// ---------- The Hollow Queen ----------
// Hovers and keeps her distance. Void beams sweep a whole row (jump to a platform or dodge through),
// gravity pulls you in before a shockwave, mirror clones join in, and below 25% she adds a shard nova.

function updateQueen(m, dt) {
  const p = G.player;
  const map = G.map;
  const floor = map.def.floor;
  const hpf = m.hp / m.maxHp;
  const dx = p.x - m.x;
  m.aiT -= dt;
  m.y = floor - 30 + Math.sin(m.anim * 1.6) * 8;
  if (m.st === 'intro') {
    if (m.aiT <= 0) { m.st = 'move'; m.aiT = 1.2; }
    return;
  }
  const a = m.atk;
  if (m.st === 'move') {
    m.face = Math.sign(dx) || m.face;
    const want = 260;
    const tx = p.x - m.face * want;
    m.x = clamp(m.x + clamp(tx - m.x, -1, 1) * m.d.speed * dt, m.w / 2, map.w - m.w / 2);
    if (m.aiT <= 0 && !p.dead) {
      const opts = ['beam', 'beam', 'gravity', 'rain'];
      if (hpf < 0.7 && G.mobs.filter((o) => o.alive && o.summoned).length < 3) opts.push('clones');
      if (hpf < 0.25) opts.push('nova', 'nova');
      const pick = opts[Math.floor(Math.random() * opts.length)];
      m.st = pick;
      if (pick === 'beam') {
        // Aim the beam at the player's current row.
        const by = p.y - 30;
        m.atk = { t: 1.15, fired: false, y: by, phase: 'wind' };
        effect({ type: 'hbeam', y: by, dur: 0.8, warn: true });
        sfx('warn');
      } else if (pick === 'gravity') {
        m.atk = { t: 1.6, fired: false, phase: 'wind' };
        effect({ type: 'alert', x: m.x, y: m.y - m.h - 20, dur: 0.6 });
        sfx('boss_roar');
      } else if (pick === 'rain') m.atk = { t: 1.3, fired: false };
      else if (pick === 'clones') m.atk = { t: 1.0, fired: false };
      else if (pick === 'nova') m.atk = { t: 1.0, fired: false, phase: 'wind' };
    }
    return;
  }
  a.t -= dt;
  if (m.st === 'beam') {
    if (!a.fired && a.t <= 0.35) {
      a.fired = true;
      a.phase = 'hit';
      effect({ type: 'hbeam', y: a.y, dur: 0.35 });
      shake(10);
      sfx('sync');
      if (!p.dead && Math.abs(p.y - 30 - a.y) < 34) hurtPlayer(m.atkv * 1.5, m.x, true);
    }
  } else if (m.st === 'gravity') {
    if (a.t > 0.5) {
      if (!p.dead) p.x -= Math.sign(dx) * 170 * dt;
      if (Math.random() < 0.8) G.parts.push({ x: m.x + dx * Math.random(), y: m.y - rand(20, 120), vx: -Math.sign(dx) * 260, vy: 0, life: 0.3, t: 0, color: '#c8c8ff', size: 3, grav: 0 });
    } else if (!a.fired) {
      a.fired = true;
      a.phase = 'hit';
      effect({ type: 'ring', x: m.x, y: floor, r: 230, color: '#e8e8ff', dur: 0.45 });
      shake(12);
      sfx('slam');
      if (!p.dead && Math.abs(p.x - m.x) < 230 && p.y > floor - 50) hurtPlayer(m.atkv * 1.3, m.x, true);
    }
  } else if (m.st === 'rain') {
    if (!a.fired) {
      a.fired = true;
      sfx('warn');
      for (let i = 0; i < 9; i++) {
        const x = i === 0 ? p.x : rand(80, map.w - 80);
        effect({ type: 'warn', x, y: floor, dur: 0.9 });
        G.projs.push({ x, y: G.cam.y - 30, vx: 0, vy: 720, r: 13, dmg: m.atkv * 1.1, color: '#bff4ff', t: 0, life: 5, delay: 0.9 });
      }
    }
  } else if (m.st === 'clones') {
    if (!a.fired && a.t <= 0.5) {
      a.fired = true;
      for (let i = 0; i < 2; i++) {
        const w = spawnMob('mirror_wraith', map.plats[0], clamp(m.x + (i ? 200 : -200), 80, map.w - 80));
        w.summoned = true;
        w.aggro = true;
        w.y = floor - 140;
        burst(w.x, w.y, '#bff4ff', 16, 180, { glow: true, grav: 0 });
      }
      sfx('portal');
    }
  } else if (m.st === 'nova') {
    if (!a.fired && a.t <= 0.4) {
      a.fired = true;
      a.phase = 'hit';
      sfx('explode');
      for (let i = 0; i < 14; i++) {
        const ang = (i / 14) * Math.PI * 2;
        G.projs.push({ x: m.x, y: m.y - 70, vx: Math.cos(ang) * 300, vy: Math.sin(ang) * 300, r: 11, dmg: m.atkv, color: '#e8e8ff', t: 0, life: 3 });
      }
    }
  }
  if (a.t <= 0) {
    m.st = 'move';
    m.atk = null;
    m.aiT = hpf < 0.25 ? rand(0.5, 0.9) : hpf < 0.5 ? rand(0.8, 1.3) : rand(1.2, 1.8);
  }
}

// ---------- Rift Sovereign ----------

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
