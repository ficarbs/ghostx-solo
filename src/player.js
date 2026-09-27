// Player: stats, movement physics, ladders, nanobot-driven combat, combo meter, leveling, death.
import { G } from './state.js';
import { VIEW_W, ITEMS, BRANCHES, TUNE_BONUS, MAX_LV, GRAVITY, JUMP_V, RUN_SPEED, CLIMB_SPEED, INV_SIZE, BOT_BASIC, RANKS, COMBO_TIME, BOT_TYPES, expNeed } from './data.js';
import * as input from './input.js';
import { addText, burst, shake, log, effect, banner, rand, clamp } from './fx.js';
import { damageMob } from './mobs.js';
import { quickPotion, countItem } from './items.js';
import { sfx } from './audio.js';
import { activeBot, botPower, botType, botSkills, botColor, botName, swapTo, newBot, say } from './bots.js';

export const MELEE_TIME = 0.32;
const COMBO = [
  { mult: 1.0, reach: 88, targets: 1, knock: 110 },
  { mult: 1.15, reach: 88, targets: 2, knock: 110 },
  { mult: 1.5, reach: 108, targets: 4, knock: 230 },
];

// `starter` is the nanobot species chosen at the start (one of STARTERS).
export function createPlayer(name, starter = 'kira') {
  const p = {
    name, lv: 1, exp: 0, gold: 50,
    base: { str: 5, dex: 5, vit: 5 },
    statPts: 0,
    equip: { head: null, body: 'hoodie', chip: null },
    inv: Array(INV_SIZE).fill(null),
    quests: {},
    bots: [], slots: [null, null, null], active: 0, seen: [starter], bestCombo: 0,
    missions: {}, storyDone: false, playTime: 0,
    enh: { head: 0, body: 0, chip: 0 },
    style: { hair: 'hair_black', jacket: 'jacket_gear', acc: 'acc_none' },
    owned: ['hair_black', 'jacket_gear', 'acc_none'],
  };
  const first = newBot(p, starter);
  p.bots.push(first);
  p.slots = [first.uid, null, null];
  p.inv[0] = { id: 'med_s', qty: 15 };
  p.inv[1] = { id: 'cell_s', qty: 8 };
  p.inv[2] = { id: 'recall', qty: 2 };
  initRuntime(p);
  recalc(p);
  p.hp = p.maxHp;
  p.mp = p.maxMp;
  return p;
}

export function initRuntime(p) {
  Object.assign(p, {
    x: 0, y: 0, vx: 0, vy: 0, w: 26, h: 58, face: 1,
    onGround: false, plat: null, rope: null, ropeCd: 0, dropT: 0, dropPlat: null,
    attackT: 0, attackHit: false, swing: 0, comboWin: 0, act: null, lastAtk: 99,
    invuln: 0, cd: {}, shield: 0, swapCd: 0,
    dead: false, potCd: 0, regenT: 0, walkT: 0, climbT: 0,
    hits: 0, hitT: 0, rank: 0, sync: 0, mounted: false,
    dodgeCd: 0, airDashed: false, perfectWin: 0, counterT: 0, lastHitT: 99,
    buffs: { atk: 0, ward: 0 }, mods: {},
    botX: null, botY: null,
  });
}

export function recalc(p) {
  const eq = Object.values(p.equip).filter(Boolean).map((id) => ITEMS[id]);
  // Slot tuning counts only while something is equipped in the slot.
  const tuned = Object.entries(p.enh || {}).filter(([slot, n]) => n && p.equip[slot]);
  const sum = (k) => eq.reduce((a, it) => a + (it[k] || 0), 0) + tuned.reduce((a, [slot, n]) => a + (TUNE_BONUS[slot][k] || 0) * n, 0);
  const bot = activeBot(p);
  // Branch-evolution modifiers of the active nanobot.
  const br = bot?.branch ? BRANCHES[botType(bot)].find((b) => b.id === bot.branch) : null;
  p.mods = br ? br.mods : {};
  p.str = p.base.str + sum('str');
  p.dex = p.base.dex + sum('dex');
  p.vit = p.base.vit + sum('vit');
  p.maxHp = 50 + p.lv * 25 + p.vit * 8 + sum('hp');
  p.maxMp = 25 + p.lv * 10;
  p.botAtk = bot ? botPower(bot) : 0;
  p.atk = 3 + p.botAtk + p.str * 1.6 + p.lv * 1.2;
  p.def = sum('def') + p.vit * 0.35;
  p.crit = Math.min(0.75, 0.05 + p.dex * 0.006 + (p.mods.crit || 0));
  if (p.hp !== undefined) {
    p.hp = Math.min(p.hp, p.maxHp);
    p.mp = Math.min(p.mp, p.maxMp);
  }
}

const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));

export function bodyBox(e) {
  return { x1: e.x - e.w / 2, x2: e.x + e.w / 2, y1: e.y - e.h, y2: e.y };
}

export function overlaps(a, b) {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}

// Gravity + one-way platform landing, shared by the player and ground drops.
export function physics(e, dt) {
  const map = G.map;
  e.vy = Math.min(e.vy + GRAVITY * dt, 1100);
  e.x = clamp(e.x + e.vx * dt, e.w / 2 + 2, map.w - e.w / 2 - 2);
  const prevY = e.y;
  e.y += e.vy * dt;
  e.onGround = false;
  if (e.vy >= 0) {
    const best = landing(e.x, prevY, e.y, e.dropT > 0 ? e.dropPlat : null);
    if (best) {
      e.y = best.y;
      e.vy = 0;
      e.onGround = true;
      e.plat = best;
    }
  }
  if (e.y > map.def.floor) {
    e.y = map.def.floor;
    e.vy = 0;
    e.onGround = true;
    e.plat = map.plats[0];
  }
}

function landing(x, prevY, y, skip) {
  let best = null;
  for (const pl of G.map.plats) {
    if (pl === skip) continue;
    if (prevY <= pl.y + 1 && y >= pl.y && x >= pl.x - 4 && x <= pl.x + pl.w + 4 && (!best || pl.y < best.y)) best = pl;
  }
  return best;
}

export const currentRank = (p = G.player) => RANKS[p.rank];

export function updatePlayer(dt) {
  const p = G.player;
  const map = G.map;
  for (const k in p.cd) p.cd[k] = Math.max(0, p.cd[k] - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  p.shield = Math.max(0, p.shield - dt);
  p.swapCd -= dt;
  p.ropeCd -= dt;
  p.dropT -= dt;
  p.potCd -= dt;
  p.comboWin -= dt;
  p.lastAtk += dt;
  p.dodgeCd -= dt;
  p.perfectWin -= dt;
  p.counterT -= dt;
  if (p.buffs) for (const k in p.buffs) if (p.buffs[k] > 0 && (p.buffs[k] -= dt) <= 0) log(k === 'atk' ? 'Overdrive Stim wore off.' : 'Ward Patch wore off.');
  p.lastHitT += dt;
  G.sayCd = (G.sayCd || 0) - dt;

  // Combo meter timeout
  if (p.hits > 0) {
    p.hitT -= dt;
    if (p.hitT <= 0) endCombo(p, false);
  }

  p.regenT += dt;
  if (p.regenT >= 4) {
    p.regenT = 0;
    if (!p.dead) {
      const mul = map.def.town ? 4 : 1;
      p.hp = Math.min(p.maxHp, p.hp + Math.ceil(p.maxHp * 0.02 * mul));
      p.mp = Math.min(p.maxMp, p.mp + Math.ceil(p.maxMp * 0.03 * mul));
      if (!map.def.town && Math.random() < 0.08) say('idle');
    }
  }

  updateCompanion(p, dt);
  if (p.dead) {
    p.vx = 0;
    physics(p, dt);
    return;
  }

  const blocked = G.ui.blocking;
  const held = (a) => !blocked && input.isDown(a);
  const tapped = (a) => !blocked && input.wasPressed(a);
  const L = held('left'), R = held('right'), U = held('up'), D = held('down');
  const jumpP = tapped('jump');

  if (tapped('hp')) quickPotion('hp');
  if (tapped('mp')) quickPotion('mp');
  for (let i = 0; i < 3; i++) if (tapped('slot' + (i + 1))) swapTo(i);
  for (let i = 0; i < 3; i++) if (tapped('skill' + (i + 1))) useSkill(p, i);
  if (tapped('skill4')) useSync(p);
  if (tapped('swapnext')) {
    for (let k = 1; k <= 3; k++) {
      const i = (p.active + k) % 3;
      if (p.slots[i] != null) {
        swapTo(i);
        break;
      }
    }
  }
  if (tapped('mount')) toggleMount(p);
  if (tapped('dodge')) tryDodge(p, L, R);

  if ((tapped('up') || tapped('interact')) && p.onGround && !p.act && p.attackT <= 0) {
    if (tryPortal(p) || tryNpc(p)) return;
  }

  if (p.act) updateAct(p, dt, L, R);
  else if (p.rope) updateRope(p, dt, L, R, U, D, jumpP);
  else move(p, dt, L, R, U, D, jumpP);

  if (p.onGround && Math.abs(p.vx) > 30) p.walkT += dt;
  if (p.onGround) p.airDashed = false;

  const type = typeOf(p);
  if (!p.act && !p.rope && p.attackT <= 0 && (tapped('attack') || held('attack'))) {
    dismount(p);
    startAttack(p, type);
  }
  if (p.attackT > 0) {
    p.attackT -= dt;
    if (type === 'blade' && !p.attackHit && p.attackT <= MELEE_TIME - 0.08) {
      p.attackHit = true;
      meleeHit(p);
    }
    if (p.attackT <= 0) p.comboWin = 0.3;
  }

  if (p.hp < p.maxHp * 0.25) say('low');
}

const typeOf = (p) => {
  const b = activeBot(p);
  return b ? botType(b) : 'blade';
};

function updateCompanion(p, dt) {
  const tx = p.x - p.face * 30;
  const ty = p.y - 78 + Math.sin(G.time * 3) * 4;
  if (p.botX == null || G.cam.snap) {
    p.botX = tx;
    p.botY = ty;
  }
  p.botX += (tx - p.botX) * Math.min(1, dt * 7);
  p.botY += (ty - p.botY) * Math.min(1, dt * 7);
  if (G.bubble) {
    G.bubble.t += dt;
    if (G.bubble.t > 2.6) G.bubble = null;
  }
}

function move(p, dt, L, R, U, D, jumpP) {
  const attacking = p.attackT > 0;
  const dir = (R ? 1 : 0) - (L ? 1 : 0);
  if (!attacking && dir) p.face = dir;
  const melee = typeOf(p) === 'blade';
  const speed = RUN_SPEED * (p.mounted ? 1.75 : 1);
  const target = attacking && p.onGround && melee ? 0 : dir * speed * (attacking ? 0.6 : 1);
  p.vx = approach(p.vx, target, (p.onGround ? 2600 : 900) * dt);

  if (p.ropeCd <= 0 && !attacking && (U || D)) {
    for (const r of G.map.ropes) {
      if (Math.abs(p.x - r.x) > 14) continue;
      if (U && p.y > r.top + 4 && p.y - p.h * 0.6 <= r.bottom) {
        grabRope(p, r);
        p.y = Math.min(p.y, r.bottom);
        return;
      }
      if (D && p.onGround && Math.abs(p.y - r.top) < 4) {
        grabRope(p, r);
        p.y = r.top + 8;
        return;
      }
    }
  }

  if (jumpP && p.onGround) {
    if (D && p.plat && !p.plat.floor) {
      p.dropT = 0.3;
      p.dropPlat = p.plat;
      p.onGround = false;
      p.y += 2;
    } else {
      p.vy = -JUMP_V * (p.mounted ? 1.12 : 1);
      p.onGround = false;
      sfx('jump');
      burst(p.x, p.y, 'rgba(220,220,230,0.7)', 5, 80, { grav: 0, angle: Math.PI, spread: 1.2 });
    }
  }
  physics(p, dt);
}

function grabRope(p, r) {
  dismount(p);
  p.rope = r;
  p.x = r.x;
  p.vx = 0;
  p.vy = 0;
  p.onGround = false;
  p.attackT = 0;
}

function updateRope(p, dt, L, R, U, D, jumpP) {
  const r = p.rope;
  p.vx = 0;
  p.vy = 0;
  p.x = r.x;
  p.onGround = false;
  if (U) p.y -= CLIMB_SPEED * dt;
  if (D) p.y += CLIMB_SPEED * dt;
  if (U || D) p.climbT += dt;
  if (p.y <= r.top) {
    p.y = r.top;
    p.rope = null;
    p.onGround = true;
    p.ropeCd = 0.2;
  } else if (p.y >= r.bottom) {
    p.y = r.bottom;
    p.rope = null;
    p.ropeCd = 0.2;
  }
  if (p.rope && jumpP && (L || R)) {
    p.rope = null;
    p.ropeCd = 0.35;
    p.face = R ? 1 : -1;
    p.vy = -JUMP_V * 0.55;
    p.vx = p.face * RUN_SPEED * 0.8;
  }
}

// What the player could interact with right now: 'talk' (NPC), 'enter' (gate), or null.
export function interactTarget(p = G.player) {
  if (!p || p.dead || !p.onGround || Math.abs(p.y - G.map.def.floor) > 4) return null;
  if (G.map.npcs.some((n) => Math.abs(p.x - n.x) < 45)) return 'talk';
  if (G.map.portals.some((pt) => Math.abs(p.x - pt.x) < 32)) return 'enter';
  return null;
}

function tryPortal(p) {
  for (const pt of G.map.portals) {
    if (Math.abs(p.x - pt.x) < 32 && Math.abs(p.y - G.map.def.floor) < 4) {
      G.hooks.travel(pt.to, pt.tp);
      return true;
    }
  }
  return false;
}

function tryNpc(p) {
  for (const n of G.map.npcs) {
    if (Math.abs(p.x - n.x) < 45 && Math.abs(p.y - G.map.def.floor) < 4) {
      G.hooks.talk(n.id);
      return true;
    }
  }
  return false;
}

// ---------- Damage helpers ----------

export function rollDamage(p, mult, m) {
  let d = p.atk * mult * rand(0.88, 1.12) * (1 + RANKS[p.rank].dmg) * (p.counterT > 0 ? 1.3 : 1);
  const crit = Math.random() < p.crit;
  if (crit) d *= 1.6 + (p.mods.critDmg || 0);
  if (p.buffs?.atk > 0) d *= 1.25;
  d = Math.max(1, Math.round(d - m.def));
  return { d, crit };
}

function hitMob(p, m, mult, opts = {}) {
  const { d, crit } = rollDamage(p, mult, m);
  damageMob(m, d, crit, opts.dir || Math.sign(m.x - p.x) || p.face, opts);
}

const mobBox = (m) => ({ x1: m.x - m.w / 2, x2: m.x + m.w / 2, y1: m.y - m.h, y2: m.y });
const liveMobs = () => G.mobs.filter((m) => m.alive);

function onScreen(m) {
  const c = G.cam;
  return m.x > c.x - 20 && m.x < c.x + VIEW_W + 20 && m.y > c.y - 20 && m.y - m.h < c.y + 480;
}

// ---------- Combo meter ----------

export function registerHit() {
  const p = G.player;
  p.hits++;
  p.lastHitT = 0;
  p.hitT = COMBO_TIME;
  if (p.hits > p.bestCombo) p.bestCombo = p.hits;
  if (!p.act || p.act.type !== 'sync') p.sync = Math.min(100, p.sync + 1 + p.rank * 0.4);
  let r = p.rank;
  while (r + 1 < RANKS.length && p.hits >= RANKS[r + 1].hits) r++;
  if (r > p.rank) {
    p.rank = r;
    G.hooks.rankUp?.(RANKS[r]);
    sfx('rank');
    if (r >= 3) say('combo', true);
  }
}

function endCombo(p, broken) {
  if (p.hits >= 10) log(`${broken ? 'Combo broken' : 'Combo'}: ${p.hits} hits · rank ${RANKS[p.rank].name}`, broken ? 'warn' : 'skill');
  p.hits = 0;
  p.hitT = 0;
  p.rank = 0;
  G.hooks.comboEnd?.(broken);
}

// ---------- Basic attacks ----------

function startAttack(p, type) {
  p.lastAtk = 0;
  if (type === 'blade') {
    p.swing = p.comboWin > 0 ? (p.swing + 1) % 3 : 0;
    p.attackT = MELEE_TIME;
    p.attackHit = false;
    sfx(p.swing === 2 ? 'slash3' : 'slash');
    return;
  }
  const B = BOT_BASIC[type];
  p.attackT = B.rate * (p.mods.rateMul || 1);
  const color = BOT_TYPES[type].color;
  const [ox, oy] = muzzle(p);
  const aim = autoAim(p, ox, oy, B.speed * B.life);
  sfx({ blaster: 'shoot', sniper: 'snipe', medic: 'orb' }[type]);
  if (type === 'blaster') {
    for (let i = 0; i < B.pellets; i++) {
      const a = aim + (i - (B.pellets - 1) / 2) * B.spread + rand(-0.03, 0.03);
      shot(ox, oy, a, B.speed, { mult: B.mult, life: B.life, r: 5, color, knock: 70 });
    }
  } else if (type === 'sniper') {
    shot(ox, oy, aim, B.speed, { mult: B.mult * (p.mods.basicMul || 1), life: B.life, r: 4, color, pierce: B.pierce + (p.mods.pierce || 0), knock: 140, trail: true });
  } else if (type === 'medic') {
    shot(ox, oy, aim, B.speed, { mult: B.mult, life: B.life, r: 7, color, leech: B.leech, knock: 60 });
  }
  burst(ox, oy, color, 5, 140, { grav: 0, glow: true, angle: p.face > 0 ? 0 : Math.PI, spread: 0.5 });
}

const muzzle = (p) => [p.x + p.face * 26, p.y - 40];

// Aim at the nearest enemy in front, within range and a modest vertical cone.
function autoAim(p, ox, oy, range) {
  let best = null, bd = Infinity;
  for (const m of liveMobs()) {
    const dx = (m.x - ox) * p.face;
    const dy = m.y - m.h / 2 - oy;
    if (dx < 0 || dx > range) continue;
    if (Math.abs(dy) > dx * 0.6 + 30) continue;
    const d = dx + Math.abs(dy) * 2;
    if (d < bd) {
      bd = d;
      best = m;
    }
  }
  const base = p.face > 0 ? 0 : Math.PI;
  if (!best) return base;
  const a = Math.atan2(best.y - best.h / 2 - oy, best.x - ox);
  return a;
}

function shot(x, y, ang, speed, o) {
  G.shots.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, t: 0, hit: new Set(), pierce: 0, ...o });
}

function meleeHit(p) {
  const c = COMBO[p.swing];
  const box = p.face > 0
    ? { x1: p.x - 10, x2: p.x + c.reach, y1: p.y - 78, y2: p.y + 8 }
    : { x1: p.x - c.reach, x2: p.x + 10, y1: p.y - 78, y2: p.y + 8 };
  const targets = liveMobs()
    .filter((m) => overlaps(mobBox(m), box))
    .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))
    .slice(0, c.targets);
  for (const m of targets) hitMob(p, m, c.mult, { knock: c.knock });
  effect({ type: 'slash', x: p.x + p.face * 36, y: p.y - 34, face: p.face, combo: p.swing, color: botColor(activeBot(p)), dur: 0.18 });
}

// Player projectiles, grenades, drones, and delayed strikes.
export function updateShots(dt) {
  const p = G.player;
  for (const s of G.shots) {
    s.t += dt;
    if (s.grav) s.vy += s.grav * dt;
    const prevY = s.y;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.trail || Math.random() < 0.4) G.parts.push({ x: s.x, y: s.y, vx: 0, vy: 0, life: s.trail ? 0.25 : 0.15, t: 0, color: s.color, size: s.r * 0.7, grav: 0, glow: true });
    for (const m of G.mobs) {
      if (!m.alive || s.hit.has(m)) continue;
      const b = mobBox(m);
      if (s.x + s.r + 4 > b.x1 && s.x - s.r - 4 < b.x2 && s.y + s.r + 6 > b.y1 && s.y - s.r - 6 < b.y2) {
        s.hit.add(m);
        if (s.aoe) {
          explode(s);
          break;
        }
        hitMob(p, m, s.mult, { knock: s.knock ?? 80, dir: Math.sign(s.vx) || p.face });
        if (s.leech) p.hp = Math.min(p.maxHp, p.hp + Math.max(1, Math.round(p.maxHp * s.leech * (p.mods.healMul || 1))));
        s.pierce--;
        if (s.pierce < 0) {
          s.dead = true;
          break;
        }
      }
    }
    if (s.aoe && !s.dead && s.vy > 0 && landing(s.x, prevY, s.y, null)) explode(s);
    if (s.t > s.life) {
      if (s.aoe && !s.dead) explode(s);
      s.dead = true;
    }
  }
  G.shots = G.shots.filter((s) => !s.dead);

  for (const d of G.drones) {
    d.t += dt;
    d.cd -= dt;
    const tx = p.x + Math.cos(G.time * 2 + d.ph) * 60, ty = p.y - 90 + Math.sin(G.time * 3 + d.ph) * 20;
    d.x += (tx - d.x) * Math.min(1, dt * 5);
    d.y += (ty - d.y) * Math.min(1, dt * 5);
    if (d.cd <= 0) {
      const target = liveMobs().filter((m) => Math.hypot(m.x - d.x, m.y - m.h / 2 - d.y) < 380).sort((a, b) => Math.abs(a.x - d.x) - Math.abs(b.x - d.x))[0];
      if (target) {
        d.cd = 0.45;
        shot(d.x, d.y, Math.atan2(target.y - target.h / 2 - d.y, target.x - d.x), 600, { mult: d.mult, life: 0.8, r: 4, color: '#60f0a0', knock: 30 });
      }
    }
  }
  G.drones = G.drones.filter((d) => d.t < d.life);

  for (const t of G.timers) {
    t.t -= dt;
    if (t.t <= 0 && !t.done) {
      t.done = true;
      t.fn();
    }
  }
  G.timers = G.timers.filter((t) => !t.done);
}

function explode(s) {
  sfx('explode');
  s.dead = true;
  const p = G.player;
  for (const m of liveMobs()) {
    const b = mobBox(m);
    const nx = clamp(s.x, b.x1, b.x2), ny = clamp(s.y, b.y1, b.y2);
    if (Math.hypot(nx - s.x, ny - s.y) < s.aoe) hitMob(p, m, s.mult, { knock: 180, up: 380 });
  }
  effect({ type: 'blast', x: s.x, y: s.y, r: s.aoe, color: s.color, dur: 0.35 });
  burst(s.x, s.y, s.color, 26, 360, { grav: 300, glow: true });
  burst(s.x, s.y, '#fff2c0', 10, 200, { grav: 0, glow: true });
  shake(9);
}

// ---------- Skills ----------

// Hoverboard: fast travel, but no fighting while riding.
function toggleMount(p) {
  if (p.mounted) return dismount(p);
  if (p.dead || p.act || p.rope) return;
  if (!countItem('hoverboard')) return log('You need a Hoverboard (Tech Jin sells them).', 'warn');
  p.mounted = true;
  sfx('mount');
  burst(p.x, p.y, '#40e0ff', 14, 160, { grav: 0, glow: true });
}

export function dismount(p) {
  if (!p.mounted) return;
  p.mounted = false;
  burst(p.x, p.y, '#40e0ff', 8, 120, { grav: 0, glow: true });
}

function useSkill(p, i) {
  dismount(p);
  const bot = activeBot(p);
  const sk = botSkills(bot)[i];
  if (!sk || p.dead || p.rope) return;
  // Skills can cancel the tail of a dodge; otherwise an action in progress blocks them.
  if (p.act && !(isDodge(p.act) && p.act.t < p.act.cancelAt)) return;
  if (bot.lv < sk.unlock) {
    log(`${sk.name} unlocks when ${bot ? 'this nanobot' : 'your nanobot'} reaches level ${sk.unlock}.`, 'warn');
    return;
  }
  if (p.cd[sk.id] > 0) return;
  if (p.mp < sk.mp) {
    addText(p.x, p.y - 80, 'Not enough EN', 'info');
    return;
  }
  p.mp -= sk.mp;
  p.cd[sk.id] = sk.cd * (p.mods.cd?.[sk.id] ?? 1);
  const mult = sk.mult * (p.mods.skillDmg?.[sk.id] ?? 1);
  p.attackT = 0;
  p.lastAtk = 0;
  const color = botColor(bot);
  const [ox, oy] = muzzle(p);

  switch (sk.id) {
    case 'dash':
      sfx('dash');
      p.act = { type: 'dash', t: 0.22, hit: new Set(), mult };
      p.invuln = Math.max(p.invuln, 0.3);
      p.vx = p.face * 950;
      p.vy = 0;
      burst(p.x, p.y - 30, color, 12, 160, { grav: 0, angle: p.face > 0 ? Math.PI : 0, spread: 0.4, glow: true });
      break;
    case 'slam':
      p.act = p.onGround ? { type: 'slam', phase: 'wind', t: 0.16, mult } : { type: 'slam', phase: 'fall', t: 2, mult };
      break;
    case 'whirl':
      sfx('slash3');
      p.act = { type: 'whirl', t: 1.2 * (p.mods.whirlMul || 1), tick: 0, mult };
      break;
    case 'scatter': {
      sfx('shoot');
      const aim = autoAim(p, ox, oy, 260);
      for (let k = 0; k < 7; k++) shot(ox, oy, aim + (k - 3) * 0.09, 760, { mult, life: 0.34, r: 6, color, knock: 160 });
      if (p.onGround) {
        p.vx = -p.face * 260;
        p.vy = -260;
        p.onGround = false;
      }
      shake(5);
      burst(ox, oy, '#fff0c0', 12, 260, { grav: 0, glow: true, angle: p.face > 0 ? 0 : Math.PI, spread: 0.6 });
      break;
    }
    case 'grenade':
      sfx('jump');
      shot(ox, oy - 6, p.face > 0 ? -0.75 : Math.PI + 0.75, 620, { mult, life: 1.6, r: 7, color: '#ffd060', grav: 1500, aoe: 125 * (p.mods.aoeMul || 1), pierce: 99 });
      break;
    case 'overdrive':
      p.act = { type: 'overdrive', t: 2 * (p.mods.overdriveMul || 1), tick: 0, mult };
      break;
    case 'pierce':
      sfx('snipe');
      shot(ox, oy, autoAim(p, ox, oy, 900), 2300, { mult, life: 0.4, r: 8, color, pierce: 99, knock: 200, trail: true });
      effect({ type: 'beam', x: ox, y: oy, face: p.face, color, dur: 0.25 });
      shake(6);
      break;
    case 'backstep':
      sfx('snipe');
      shot(ox, oy, autoAim(p, ox, oy, 700), 1800, { mult, life: 0.45, r: 6, color, pierce: 2, knock: 220, trail: true });
      p.vx = -p.face * 420;
      p.vy = -460;
      p.onGround = false;
      p.invuln = Math.max(p.invuln, 0.35);
      break;
    case 'orbital': {
      let tx = p.x + p.face * 240;
      const near = liveMobs().filter((m) => (m.x - p.x) * p.face > 0 && Math.abs(m.x - p.x) < 450).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
      if (near) tx = near.x;
      const ty = p.y;
      effect({ type: 'mark', x: tx, y: ty, color, dur: 0.75 });
      sfx('warn');
      G.timers.push({ t: 0.75, fn: () => {
        for (const m of liveMobs()) {
          if (Math.abs(m.x - tx) < 95 + m.w / 2 && m.y > ty - 420 && m.y - m.h < ty + 60) hitMob(p, m, mult, { knock: 60, up: 300 });
        }
        effect({ type: 'orbital', x: tx, y: ty, color, dur: 0.45 });
        sfx('explode');
        burst(tx, ty, color, 30, 380, { grav: 200, glow: true, angle: -Math.PI / 2, spread: 1.2 });
        shake(12);
      } });
      break;
    }
    case 'repair': {
      sfx('heal');
      const heal = Math.round(p.maxHp * sk.heal * (p.mods.healMul || 1));
      p.hp = Math.min(p.maxHp, p.hp + heal);
      addText(p.x, p.y - 80, '+' + heal, 'heal');
      for (const m of liveMobs()) if (Math.abs(m.x - p.x) < 140 && Math.abs(m.y - p.y) < 120) hitMob(p, m, mult, { knock: 200 });
      effect({ type: 'ring', x: p.x, y: p.y - 30, r: 140, color, dur: 0.45, round: true });
      burst(p.x, p.y - 30, color, 24, 240, { grav: -100, glow: true });
      break;
    }
    case 'barrier':
      sfx('shield');
      p.shield = sk.dur + (p.mods.barrierAdd || 0);
      log('Barrier up: incoming damage is blocked.', 'skill');
      burst(p.x, p.y - 30, color, 20, 200, { grav: 0, glow: true });
      break;
    case 'swarm':
      sfx('swap');
      const nd = p.mods.drones || 3;
      for (let k = 0; k < nd; k++) G.drones.push({ x: p.x, y: p.y - 60, t: 0, life: 7, cd: 0.3 + k * 0.15, ph: (k * Math.PI * 2) / nd, mult });
      break;
  }
}

// F: spend a full Sync gauge on a screen-wide nanobot ultimate.
function useSync(p) {
  if (p.sync >= 100) dismount(p);
  if (p.dead || p.act || p.rope) return;
  if (p.sync < 100) {
    addText(p.x, p.y - 80, `Sync ${Math.floor(p.sync)}%`, 'info');
    return;
  }
  p.sync = 0;
  p.attackT = 0;
  p.act = { type: 'sync', t: 1.5, tick: 0.3, n: 0 };
  sfx('sync');
  p.invuln = Math.max(p.invuln, 1.8);
  banner('NANO SYNC', `${botName(activeBot(p))} · full power`);
  shake(10);
  say('combo', true);
}

const isDodge = (a) => a && (a.type === 'roll' || a.type === 'airdash');

// Dodge: a ground roll or (once per jump) an air dash, with brief invulnerability. It can cancel a basic
// attack, Cyclone Edge, Overdrive, and the recovery of Ground Breaker.
function tryDodge(p, L, R) {
  if (p.dead || p.rope || p.dodgeCd > 0) return;
  const a = p.act;
  if (a && !(a.type === 'whirl' || a.type === 'overdrive' || (a.type === 'slam' && a.phase === 'recover'))) return;
  if (!p.onGround && p.airDashed) return;
  const dir = (R ? 1 : 0) - (L ? 1 : 0) || p.face;
  p.face = dir;
  dismount(p);
  p.attackT = 0;
  if (p.onGround) {
    p.act = { type: 'roll', t: 0.34, dir, cancelAt: 0.2 };
    p.invuln = Math.max(p.invuln, 0.28);
    p.dodgeCd = 0.5;
    burst(p.x, p.y, 'rgba(210,220,235,0.8)', 8, 120, { grav: 0, angle: dir > 0 ? Math.PI : 0, spread: 0.7 });
  } else {
    p.airDashed = true;
    p.act = { type: 'airdash', t: 0.18, dir, cancelAt: 0.1 };
    p.invuln = Math.max(p.invuln, 0.16);
    p.dodgeCd = 0.3;
    p.vy = 0;
    burst(p.x, p.y - 30, botColor(activeBot(p)), 10, 160, { grav: 0, glow: true, angle: dir > 0 ? Math.PI : 0, spread: 0.4 });
  }
  p.perfectWin = 0.16;
  p.perfectDone = false;
  sfx('dash');
}

// Dodging through an attack at the last instant: slow-motion, Sync, and a short damage boost.
function perfectDodge(p) {
  p.perfectDone = true;
  p.counterT = 1.5;
  p.sync = Math.min(100, p.sync + 15);
  G.slowT = 0.45;
  addText(p.x, p.y - p.h - 20, 'PERFECT', 'crit');
  effect({ type: 'ring', x: p.x, y: p.y - 30, r: 90, color: '#bff4ff', dur: 0.4, round: true });
  sfx('rank');
  say('combo', true);
}

// Swapping bots right after landing a hit: the incoming bot opens with a free attack.
export function swapStrike(p) {
  if (p.lastHitT > 0.6 || p.dead || p.rope) return;
  const type = typeOf(p);
  const color = botColor(activeBot(p));
  const [ox, oy] = muzzle(p);
  p.sync = Math.min(100, p.sync + 5);
  p.lastAtk = 0;
  addText(p.x, p.y - p.h - 24, 'SWAP STRIKE', 'info');
  if (type === 'blade') {
    const box = p.face > 0 ? { x1: p.x - 20, x2: p.x + 120, y1: p.y - 90, y2: p.y + 8 } : { x1: p.x - 120, x2: p.x + 20, y1: p.y - 90, y2: p.y + 8 };
    for (const m of liveMobs()) if (overlaps(mobBox(m), box)) hitMob(p, m, 1.4, { knock: 200 });
    effect({ type: 'slash', x: p.x + p.face * 44, y: p.y - 34, face: p.face, combo: 2, color, dur: 0.22 });
    sfx('slash3');
  } else if (type === 'blaster') {
    const aim = autoAim(p, ox, oy, 260);
    for (let k = 0; k < 5; k++) shot(ox, oy, aim + (k - 2) * 0.1, 760, { mult: 0.6, life: 0.34, r: 6, color, knock: 140 });
    sfx('shoot');
  } else if (type === 'sniper') {
    shot(ox, oy, autoAim(p, ox, oy, 900), 2200, { mult: 1.8, life: 0.4, r: 7, color, pierce: 99, knock: 180, trail: true });
    effect({ type: 'beam', x: ox, y: oy, face: p.face, color, dur: 0.2 });
    sfx('snipe');
  } else {
    const heal = Math.round(p.maxHp * 0.06 * (p.mods.healMul || 1));
    p.hp = Math.min(p.maxHp, p.hp + heal);
    addText(p.x, p.y - 80, '+' + heal, 'heal');
    for (const m of liveMobs()) if (Math.abs(m.x - p.x) < 130 && Math.abs(m.y - p.y) < 110) hitMob(p, m, 1.0, { knock: 160 });
    effect({ type: 'ring', x: p.x, y: p.y - 30, r: 130, color, dur: 0.35, round: true });
    sfx('heal');
  }
}

function updateAct(p, dt, L, R) {
  const a = p.act;
  a.t -= dt;
  if (a.type === 'roll') {
    p.vx = a.dir * (a.t > 0.1 ? 520 : 200);
    physics(p, dt);
    if (Math.random() < 0.5) burst(p.x - a.dir * 8, p.y - 2, 'rgba(200,210,225,0.7)', 1, 60, { grav: 0 });
    if (a.t <= 0) {
      p.act = null;
      p.vx = a.dir * 120;
    }
    return;
  }
  if (a.type === 'airdash') {
    p.vy = 0;
    p.x = clamp(p.x + a.dir * 760 * dt, p.w / 2 + 2, G.map.w - p.w / 2 - 2);
    G.parts.push({ x: p.x - a.dir * 12, y: p.y - rand(10, 55), vx: -a.dir * 40, vy: 0, life: 0.22, t: 0, color: botColor(activeBot(p)), size: 3, grav: 0 });
    if (a.t <= 0) {
      p.act = null;
      p.vx = a.dir * 220;
    }
    return;
  }
  if (a.type === 'dash') {
    p.vy = 0;
    p.x = clamp(p.x + p.vx * dt, p.w / 2 + 2, G.map.w - p.w / 2 - 2);
    const box = { x1: p.x - 42, x2: p.x + 42, y1: p.y - 72, y2: p.y + 6 };
    for (const m of liveMobs()) {
      if (!a.hit.has(m) && overlaps(mobBox(m), box)) {
        a.hit.add(m);
        hitMob(p, m, a.mult, { knock: 260 });
      }
    }
    if (Math.random() < 0.8) G.parts.push({ x: p.x - p.face * 10, y: p.y - rand(10, 55), vx: -p.face * 60, vy: 0, life: 0.25, t: 0, color: botColor(activeBot(p)), size: 3, grav: 0, glow: true });
    if (a.t <= 0) {
      p.act = null;
      p.vx = p.face * 120;
    }
    return;
  }
  if (a.type === 'slam') {
    p.vx = 0;
    if (a.phase === 'fall') {
      p.vy = 1300;
      physics(p, dt);
      if (p.onGround || a.t <= 0) slamImpact(p, a);
    } else if (a.phase === 'wind') {
      physics(p, dt);
      if (a.t <= 0) slamImpact(p, a);
    } else {
      physics(p, dt);
      if (a.t <= 0) p.act = null;
    }
    return;
  }
  if (a.type === 'whirl' || a.type === 'overdrive') {
    const dir = (R ? 1 : 0) - (L ? 1 : 0);
    if (a.type === 'overdrive' && dir) p.face = dir;
    p.vx = approach(p.vx, dir * RUN_SPEED * 0.55, 2000 * dt);
    physics(p, dt);
    a.tick -= dt;
    if (a.tick <= 0 && a.type === 'whirl') {
      a.tick = 0.15;
      const cx = p.x, cy = p.y - 30, r = 110;
      for (const m of liveMobs()) {
        const nx = clamp(cx, m.x - m.w / 2, m.x + m.w / 2);
        const ny = clamp(cy, m.y - m.h, m.y);
        if ((nx - cx) ** 2 + (ny - cy) ** 2 < r * r) hitMob(p, m, a.mult, { knock: 60 });
      }
    } else if (a.tick <= 0) {
      a.tick = 0.07;
      sfx('shoot');
      const [ox, oy] = muzzle(p);
      shot(ox, oy, autoAim(p, ox, oy, 300) + rand(-0.12, 0.12), 800, { mult: a.mult, life: 0.35, r: 5, color: '#ffb040', knock: 40 });
      if (Math.random() < 0.5) shake(2);
    }
    if (a.t <= 0) p.act = null;
    return;
  }
  if (a.type === 'sync') {
    p.vx = 0;
    p.vy = 0;
    a.tick -= dt;
    if (a.tick <= 0 && a.n < 6) {
      a.tick = 0.18;
      a.n++;
      const color = botColor(activeBot(p));
      for (const m of liveMobs()) {
        if (!onScreen(m)) continue;
        hitMob(p, m, 1.25, { knock: 40 });
        effect({ type: 'zap', x1: p.botX, y1: p.botY, x2: m.x, y2: m.y - m.h / 2, color, dur: 0.15 });
      }
      shake(5);
      sfx('zap');
    }
    if (a.t <= 0) p.act = null;
  }
}

function slamImpact(p, a) {
  sfx('slam');
  a.phase = 'recover';
  a.t = 0.25;
  for (const m of liveMobs()) {
    if (Math.abs(m.x - p.x) < 140 + m.w / 2 && m.y > p.y - 110 && m.y - m.h < p.y + 20) {
      hitMob(p, m, a.mult, { knock: 80, up: 480 });
    }
  }
  shake(11);
  effect({ type: 'ring', x: p.x, y: p.y, r: 150, color: '#ffe2a0', dur: 0.4 });
  burst(p.x, p.y, '#a8a8b8', 24, 320, { up: -200, grav: 900 });
  burst(p.x, p.y - 4, botColor(activeBot(p)), 10, 250, { grav: 0, glow: true, angle: -Math.PI / 2, spread: 1.4 });
}

// ---------- Damage taken, experience, death ----------

// `attack` marks damage from a real enemy attack (not just touching a demon); only those count for perfect dodges.
export function hurtPlayer(raw, fromX, attack = false) {
  const p = G.player;
  if (p.dead) return;
  if (p.invuln > 0) {
    if (attack && isDodge(p.act) && p.perfectWin > 0 && !p.perfectDone) perfectDodge(p);
    return;
  }
  if (p.shield > 0) {
    addText(p.x, p.y - p.h - 12, 'BLOCK', 'info');
    sfx('block');
    p.invuln = 0.4;
    burst(p.x, p.y - 30, '#60f0a0', 8, 160, { grav: 0, glow: true });
    return;
  }
  dismount(p);
  const ward = p.buffs?.ward > 0 ? 0.75 : 1;
  const d = Math.max(1, Math.round(raw * rand(0.9, 1.1) * ward - p.def));
  p.hp -= d;
  sfx('hurt');
  addText(p.x, p.y - p.h - 12, d, 'hurt');
  p.invuln = 1.0;
  shake(4);
  if (p.hits > 0) endCombo(p, true);
  if (!p.act) {
    p.rope = null;
    p.vx = (p.x < fromX ? -1 : 1) * 240;
    p.vy = -320;
    p.onGround = false;
    p.attackT = 0;
  }
  if (p.hp <= 0) die(p);
}

function die(p) {
  p.hp = 0;
  p.dead = true;
  p.act = null;
  p.rope = null;
  p.shield = 0;
  if (p.hits) endCombo(p, true);
  const loss = Math.min(p.exp, Math.floor(expNeed(p.lv) * 0.08));
  p.exp -= loss;
  log(`You have fallen. Lost ${loss} EXP.`, 'warn');
  sfx('death');
  G.drones = [];
  G.dirty = true;
  G.hooks.death?.(loss);
}

export function revive() {
  const p = G.player;
  p.dead = false;
  p.hp = Math.ceil(p.maxHp * 0.5);
  p.mp = Math.ceil(p.maxMp * 0.5);
  G.hooks.travel('plaza', 'spawn');
}

export function gainExp(n) {
  const p = G.player;
  if (p.lv >= MAX_LV) return;
  p.exp += n;
  addText(p.x, p.y - p.h - 30, `+${n} EXP`, 'exp');
  let leveled = false;
  while (p.lv < MAX_LV && p.exp >= expNeed(p.lv)) {
    p.exp -= expNeed(p.lv);
    p.lv++;
    p.statPts += 5;
    leveled = true;
  }
  if (p.lv >= MAX_LV) p.exp = 0;
  if (leveled) {
    recalc(p);
    p.hp = p.maxHp;
    p.mp = p.maxMp;
    effect({ type: 'levelup', dur: 1.6 });
    burst(p.x, p.y - 30, '#ffe27a', 40, 360, { grav: -100, glow: true });
    sfx('levelup');
    banner('LEVEL UP!', `You are now level ${p.lv} · +5 stat points`);
    log(`Level up! You are now level ${p.lv}.`, 'lvl');
    G.hooks.save?.();
  }
  G.dirty = true;
}
