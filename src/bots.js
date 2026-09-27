// Nanobots: collection, active slot, leveling/evolution, overclocking, and companion chatter.
import { G } from './state.js';
import { BOTS, BOT_TYPES, BOT_SKILLS, PERSONA, BOT_MAX_LV, RARITY, OVERCLOCK, MOD_POWER, botExpNeed } from './data.js';
import { countItem, removeItem } from './items.js';
import { log, banner, burst, effect } from './fx.js';
import { recalc, swapStrike } from './player.js';
import { sfx } from './audio.js';

export const STAGE_LV = [1, 6, 12];
export const stageOf = (b) => (b.lv >= STAGE_LV[2] ? 3 : b.lv >= STAGE_LV[1] ? 2 : 1);
export const botName = (b) => BOTS[b.sp].evo[stageOf(b) - 1];
export const botType = (b) => BOTS[b.sp].type;
export const botColor = (b) => BOT_TYPES[botType(b)].color;

export function botPower(b) {
  const s = BOTS[b.sp];
  return s.atk * (1 + 0.08 * (b.lv - 1)) * [1, 1.25, 1.6][stageOf(b) - 1] * (1 + 0.1 * b.stars) * (b.mod ? 1 + MOD_POWER : 1);
}

// Twin Link partner: the bot in the next occupied slot after the active one.
export function partnerBot(p = G.player) {
  if (!p) return null;
  for (let k = 1; k < 3; k++) {
    const uid = p.slots[(p.active + k) % 3];
    if (uid != null && uid !== p.slots[p.active]) return p.bots.find((b) => b.uid === uid) || null;
  }
  return null;
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
  const b = newBot(p, sp);
  p.bots.push(b);
  if (!p.seen.includes(sp)) p.seen.push(sp);
  const empty = p.slots.indexOf(null);
  if (empty >= 0) p.slots[empty] = b.uid;
  const s = BOTS[sp];
  log(`New nanobot: ${s.evo[0]} (${RARITY[s.rarity]} ${BOT_TYPES[s.type].name})${empty >= 0 ? ` · slotted into [${empty + 1}]` : ' · equip it with N'}`, 'rare');
  banner('NANOBOT ACQUIRED', `${s.evo[0]} · ${RARITY[s.rarity]} ${BOT_TYPES[s.type].name}`);
  sfx('core');
  G.dirty = true;
  return b;
}

export function gainBotExp(n, b = activeBot(G.player)) {
  const p = G.player;
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
      if (stageOf(b) === 3 && !b.branch) G.hooks.branchChoice?.(b);
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
  swapStrike(p);
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

// Overclock: +1 star (+10% power), paid in credits and demon loot (see OVERCLOCK in data.js).
export const overclockCost = (b) => (b.stars < OVERCLOCK.length ? OVERCLOCK[b.stars] : null);

export function canOverclock(b) {
  const c = overclockCost(b);
  return !!c && G.player.gold >= c.gold && c.items.every(([id, n]) => countItem(id) >= n);
}

export function overclock(uid) {
  const p = G.player;
  const b = botByUid(uid);
  if (!b) return false;
  const c = overclockCost(b);
  if (!c) return log(`${botName(b)} is already at 5 stars.`, 'warn'), false;
  if (!canOverclock(b)) return log('Not enough credits or materials to overclock.', 'warn'), false;
  p.gold -= c.gold;
  for (const [id, n] of c.items) removeItem(id, n);
  b.stars++;
  sfx('evolve');
  log(`Overclock complete: ${botName(b)} is now ${'★'.repeat(b.stars)}.`, 'lvl');
  banner('OVERCLOCKED', `${botName(b)} ${'★'.repeat(b.stars)}`);
  recalc(p);
  G.dirty = true;
  G.hooks.save?.();
  return true;
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
