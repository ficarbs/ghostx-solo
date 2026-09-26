// Nanobots: collection, active slot, leveling/evolution, fusion, and companion chatter.
import { G } from './state.js';
import { BOTS, BOT_TYPES, BOT_SKILLS, PERSONA, BOT_CAP, BOT_MAX_LV, RARITY, CURRENCY, botExpNeed } from './data.js';
import { log, banner, burst, effect } from './fx.js';
import { recalc } from './player.js';
import { sfx } from './audio.js';

export const STAGE_LV = [1, 6, 12];
export const stageOf = (b) => (b.lv >= STAGE_LV[2] ? 3 : b.lv >= STAGE_LV[1] ? 2 : 1);
export const botName = (b) => BOTS[b.sp].evo[stageOf(b) - 1];
export const botType = (b) => BOTS[b.sp].type;
export const botColor = (b) => BOT_TYPES[botType(b)].color;

export function botPower(b) {
  const s = BOTS[b.sp];
  return s.atk * (1 + 0.08 * (b.lv - 1)) * [1, 1.25, 1.6][stageOf(b) - 1] * (1 + 0.1 * b.stars);
}

export function activeBot(p = G.player) {
  const uid = p?.slots[p.active];
  return p?.bots.find((b) => b.uid === uid) || null;
}

export function botByUid(uid) {
  return G.player.bots.find((b) => b.uid === uid) || null;
}

export function botSkills(b) {
  return b ? BOT_SKILLS[botType(b)] : [];
}

export function newBot(p, sp) {
  const uid = p.bots.reduce((m, b) => Math.max(m, b.uid), 0) + 1;
  return { uid, sp, lv: 1, exp: 0, stars: 0 };
}

export function addBot(sp) {
  const p = G.player;
  if (p.bots.length >= BOT_CAP) {
    log('Nanobot storage is full. Fuse or release some at Tech Jin\'s lab.', 'warn');
    return null;
  }
  const b = newBot(p, sp);
  p.bots.push(b);
  if (!p.seen.includes(sp)) p.seen.push(sp);
  const empty = p.slots.indexOf(null);
  if (empty >= 0) p.slots[empty] = b.uid;
  const s = BOTS[sp];
  log(`New nanobot: ${s.evo[0]} (${RARITY[s.rarity]} ${BOT_TYPES[s.type].name})${empty >= 0 ? ` · slotted into [${empty + 1}]` : ' · equip it with N'}`, 'rare');
  banner('NANOBOT ACQUIRED', `${s.evo[0]} · ${RARITY[s.rarity]} ${BOT_TYPES[s.type].name}`);
  G.dirty = true;
  return b;
}

export function gainBotExp(n) {
  const p = G.player;
  const b = activeBot(p);
  if (!b || b.lv >= BOT_MAX_LV) return;
  b.exp += n;
  let leveled = false;
  while (b.lv < BOT_MAX_LV && b.exp >= botExpNeed(b.lv)) {
    const before = stageOf(b);
    b.exp -= botExpNeed(b.lv);
    b.lv++;
    leveled = true;
    for (const sk of botSkills(b)) {
      if (sk.unlock === b.lv) log(`${botName(b)} learned ${sk.name}! Press ${sk.key}.`, 'skill');
    }
    if (stageOf(b) > before) {
      const oldName = BOTS[b.sp].evo[before - 1];
      banner('EVOLUTION!', `${oldName} evolved into ${botName(b)}`);
      log(`${oldName} evolved into ${botName(b)}!`, 'lvl');
      effect({ type: 'evolve', dur: 1.4 });
      sfx('evolve');
      burst(p.botX ?? p.x, p.botY ?? p.y - 70, botColor(b), 40, 300, { grav: 0, glow: true });
      say('evolve', true);
    }
  }
  if (b.lv >= BOT_MAX_LV) b.exp = 0;
  if (leveled) {
    log(`${botName(b)} reached nanobot level ${b.lv}.`, 'skill');
    recalc(p);
  }
  G.dirty = true;
}

export function swapTo(i) {
  const p = G.player;
  if (p.slots[i] == null || i === p.active || p.dead) return;
  if (p.swapCd > 0) return;
  p.active = i;
  p.swapCd = 0.5;
  p.attackT = 0;
  if (p.act && p.act.type !== 'sync') p.act = null;
  recalc(p);
  const b = activeBot(p);
  burst(p.x, p.y - 36, botColor(b), 16, 200, { grav: 0, glow: true });
  effect({ type: 'swap', dur: 0.3, color: botColor(b) });
  sfx('swap');
  say('swap');
  G.dirty = true;
}

export function equipBot(uid, slot) {
  const p = G.player;
  const other = p.slots.indexOf(uid);
  if (other >= 0) p.slots[other] = p.slots[slot];
  p.slots[slot] = uid;
  if (p.slots[p.active] == null) p.active = p.slots.findIndex((s) => s != null);
  recalc(p);
  G.dirty = true;
}

export function unslot(slot) {
  const p = G.player;
  if (p.slots.filter((s) => s != null).length <= 1) return log('You need at least one nanobot equipped.', 'warn');
  p.slots[slot] = null;
  if (p.active === slot) p.active = p.slots.findIndex((s) => s != null);
  recalc(p);
  G.dirty = true;
}

export const fuseCost = (b) => 100 * BOTS[b.sp].rarity * (b.stars + 1);

// Fuse a duplicate of the same species into `target`: +1 star (max 5), keeps the higher level.
export function fuse(targetUid, fodderUid) {
  const p = G.player;
  const t = botByUid(targetUid), f = botByUid(fodderUid);
  if (!t || !f || t === f || t.sp !== f.sp) return false;
  if (t.stars >= 5) return log(`${botName(t)} is already at 5 stars.`, 'warn'), false;
  const cost = fuseCost(t);
  if (p.gold < cost) return log(`Fusion costs ${cost} ${CURRENCY}.`, 'warn'), false;
  p.gold -= cost;
  t.stars++;
  if (f.lv > t.lv) {
    t.lv = f.lv;
    t.exp = f.exp;
  }
  removeBot(f.uid);
  log(`Fusion complete: ${botName(t)} is now ${'★'.repeat(t.stars)}.`, 'lvl');
  sfx('evolve');
  banner('FUSION COMPLETE', `${botName(t)} ${'★'.repeat(t.stars)}`);
  recalc(p);
  G.dirty = true;
  return true;
}

export function release(uid) {
  const p = G.player;
  if (p.slots.includes(uid)) return log('Unequip that nanobot before releasing it.', 'warn');
  const b = botByUid(uid);
  if (!b) return;
  const v = 25 * BOTS[b.sp].rarity * (1 + b.stars);
  removeBot(uid);
  p.gold += v;
  log(`Released ${botName(b)} for ${v} ${CURRENCY} of scrap.`, 'loot');
  G.dirty = true;
}

function removeBot(uid) {
  const p = G.player;
  p.bots = p.bots.filter((b) => b.uid !== uid);
  const si = p.slots.indexOf(uid);
  if (si >= 0) {
    p.slots[si] = null;
    if (p.active === si) p.active = p.slots.findIndex((s) => s != null);
  }
}

// Companion speech bubble. kind: swap | kill | low | evolve | combo | idle
export function say(kind, force = false) {
  const b = activeBot();
  if (!b) return;
  if (!force && G.sayCd > 0) return;
  const lines = PERSONA[BOTS[b.sp].persona][kind];
  if (!lines) return;
  G.bubble = { text: lines[Math.floor(Math.random() * lines.length)], t: 0 };
  G.sayCd = 4;
}
