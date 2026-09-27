// Tech Jin's Workshop (slot tuning, fabricator), branch evolution choices, and cosmetic unlocks.
import { G } from './state.js';
import { ITEMS, TUNE_MAX, tuneCost, BRANCHES, RESPEC_COST, OUTFITS, BOT_ORDER, CURRENCY } from './data.js';
import { countItem, removeItem, addItem, canAdd } from './items.js';
import { recalc } from './player.js';
import { botByUid, botName, botType } from './bots.js';
import { log, banner, burst } from './fx.js';
import { sfx } from './audio.js';

const hasAll = (items) => items.every(([id, n]) => countItem(id) >= n);
const pay = (gold, items) => {
  G.player.gold -= gold;
  for (const [id, n] of items) removeItem(id, n);
};

// ---------- Slot tuning ----------

export function canTune(slot) {
  const p = G.player;
  const n = p.enh[slot];
  if (n >= TUNE_MAX) return false;
  const c = tuneCost(n);
  return p.gold >= c.gold && hasAll(c.items);
}

// Attempt one tuning step. From +4 up it can fail; a failure spends the cost but never lowers the level.
export function tune(slot) {
  const p = G.player;
  if (!canTune(slot)) return log('Not enough credits or materials to tune.', 'warn');
  const n = p.enh[slot];
  const c = tuneCost(n);
  pay(c.gold, c.items);
  if (Math.random() < c.chance) {
    p.enh[slot] = n + 1;
    recalc(p);
    sfx('levelup');
    log(`Tuning success: ${slot} slot is now +${n + 1}.`, 'lvl');
    banner('TUNING SUCCESS', `${slot[0].toUpperCase() + slot.slice(1)} slot +${n + 1}`);
  } else {
    sfx('hurt');
    log(`Tuning failed on the ${slot} slot. Materials were used up; the slot stays at +${n}.`, 'warn');
  }
  G.dirty = true;
  G.hooks.save?.();
}

// ---------- Fabricator ----------

export function canCraft(r) {
  const p = G.player;
  return p.lv >= r.lv && p.gold >= r.gold && hasAll(r.items) && canAdd(r.out, r.n);
}

export function craft(r) {
  if (!canCraft(r)) return log('Missing credits, materials, level, or bag space.', 'warn');
  pay(r.gold, r.items);
  addItem(r.out, r.n);
  sfx('buy');
  log(`Fabricated ${r.n > 1 ? r.n + '× ' : ''}${ITEMS[r.out].name}.`, 'loot');
  G.dirty = true;
  G.hooks.save?.();
}


// ---------- Branch evolution ----------

export const branchesFor = (b) => BRANCHES[botType(b)];
export const branchOf = (b) => (b.branch ? branchesFor(b).find((x) => x.id === b.branch) : null);

export function setBranch(uid, id, respec = false) {
  const p = G.player;
  const b = botByUid(uid);
  if (!b) return false;
  if (respec) {
    if (p.gold < RESPEC_COST) return log(`Re-spec costs ${RESPEC_COST} ${CURRENCY}.`, 'warn'), false;
    p.gold -= RESPEC_COST;
  }
  b.branch = id;
  const br = branchOf(b);
  recalc(p);
  sfx('evolve');
  burst(p.x, p.y - 40, '#ffe27a', 24, 240, { grav: 0, glow: true });
  log(`${botName(b)} took the ${br.name} branch: ${br.desc}`, 'lvl');
  G.dirty = true;
  G.hooks.save?.();
  return true;
}

// ---------- Cosmetics ----------

export function unlockMet(key) {
  const p = G.player;
  if (key === 'story') return !!p.storyDone;
  if (key === 'act2') return !!p.act2Done;
  if (key === 'act3') return !!p.act3Done;
  if (key === 'nanodex') return BOT_ORDER.every((sp) => p.seen.includes(sp));
  if (key === 'sss') return p.bestCombo >= 400;
  if (key === 'allS') return ['m1', 'm2', 'm3'].every((id) => p.missions[id]?.best === 'S');
  return false;
}

export const outfitById = (id) => Object.values(OUTFITS).flat().find((o) => o.id === id);
export const owns = (id) => G.player.owned.includes(id);

// Earned outfits are granted automatically once their condition is met.
export function checkUnlocks() {
  const p = G.player;
  for (const o of Object.values(OUTFITS).flat()) {
    if (o.unlock && !owns(o.id) && unlockMet(o.unlock)) {
      p.owned.push(o.id);
      log(`Outfit unlocked: ${o.name}! Wear it from the Wardrobe.`, 'rare');
      G.dirty = true;
    }
  }
}

export function buyOutfit(id) {
  const p = G.player;
  const o = outfitById(id);
  if (!o || owns(id) || !o.price) return;
  if (p.gold < o.price) return log(`Not enough ${CURRENCY}.`, 'warn');
  p.gold -= o.price;
  p.owned.push(id);
  sfx('buy');
  log(`Bought outfit: ${o.name}.`, 'loot');
  G.dirty = true;
  G.hooks.save?.();
}

export function wearOutfit(part, id) {
  if (!owns(id)) return;
  G.player.style[part] = id;
  sfx('ui');
  G.dirty = true;
  G.hooks.save?.();
}


// ---------- Legendary mods ----------

// Mod items in the bag that fit this bot's type.
export const modsFor = (b) => [...new Set(G.player.inv.filter((s) => s && ITEMS[s.id].type === 'mod' && ITEMS[s.id].botType === botType(b)).map((s) => s.id))];

export function installMod(uid, id) {
  const b = botByUid(uid);
  if (!b || b.mod || !countItem(id) || ITEMS[id].botType !== botType(b)) return;
  removeItem(id, 1);
  b.mod = id;
  recalc(G.player);
  sfx('evolve');
  log(`Installed ${ITEMS[id].name} on ${botName(b)}.`, 'lvl');
  G.dirty = true;
  G.hooks.save?.();
}

export function removeMod(uid) {
  const b = botByUid(uid);
  if (!b?.mod) return;
  if (!addItem(b.mod, 1)) return;
  log(`Removed ${ITEMS[b.mod].name} from ${botName(b)}.`);
  b.mod = null;
  recalc(G.player);
  G.dirty = true;
  G.hooks.save?.();
}
