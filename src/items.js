// Inventory and equipment helpers.
import { G } from './state.js';
import { ITEMS, BOTS, BOT_ORDER } from './data.js';
import { log, addText, burst } from './fx.js';
import { recalc } from './player.js';
import { addBot } from './bots.js';
import { sfx } from './audio.js';

const STACK = 999;

export function freeSlots() {
  return G.player.inv.filter((s) => !s).length;
}

export function canAdd(id, qty = 1) {
  const p = G.player;
  const it = ITEMS[id];
  if (it.type !== 'equip') {
    let room = 0;
    for (const s of p.inv) if (s && s.id === id) room += STACK - s.qty;
    if (room >= qty) return true;
    return freeSlots() >= Math.ceil((qty - room) / STACK);
  }
  return freeSlots() >= qty;
}

export function addItem(id, qty = 1) {
  const p = G.player;
  const it = ITEMS[id];
  if (!canAdd(id, qty)) {
    log('Your bag is full.', 'warn');
    return false;
  }
  if (it.type !== 'equip') {
    for (const s of p.inv) {
      if (s && s.id === id && s.qty < STACK) {
        const n = Math.min(qty, STACK - s.qty);
        s.qty += n;
        qty -= n;
        if (!qty) break;
      }
    }
  }
  while (qty > 0) {
    const i = p.inv.indexOf(null);
    const n = it.type === 'equip' ? 1 : Math.min(qty, STACK);
    p.inv[i] = { id, qty: n };
    qty -= n;
  }
  G.dirty = true;
  return true;
}

export function countItem(id) {
  return G.player.inv.reduce((a, s) => a + (s && s.id === id ? s.qty : 0), 0);
}

export function removeItem(id, qty) {
  const p = G.player;
  for (let i = p.inv.length - 1; i >= 0 && qty > 0; i--) {
    const s = p.inv[i];
    if (s && s.id === id) {
      const n = Math.min(qty, s.qty);
      s.qty -= n;
      qty -= n;
      if (s.qty <= 0) p.inv[i] = null;
    }
  }
  G.dirty = true;
}

export function useSlot(i) {
  const p = G.player;
  const s = p.inv[i];
  if (!s || p.dead) return;
  const it = ITEMS[s.id];
  if (it.type === 'equip') return equip(i);
  if (it.type !== 'use') return;
  if (p.potCd > 0) return;
  if (it.town) {
    if (G.map.def.town) return log('You are already at Metro Central.');
    consume(i);
    G.hooks.travel('plaza', 'spawn');
    return;
  }
  if (it.capsule) {
    const commons = BOT_ORDER.filter((sp) => BOTS[sp].rarity === 1);
    if (!addBot(commons[Math.floor(Math.random() * commons.length)])) return;
    consume(i);
    return;
  }
  if (it.hp && p.hp >= p.maxHp && !it.mp) return log('Your HP is already full.');
  if (it.mp && p.mp >= p.maxMp && !it.hp) return log('Your MP is already full.');
  if (it.hp) {
    p.hp = Math.min(p.maxHp, p.hp + it.hp);
    addText(p.x, p.y - 80, '+' + it.hp, 'heal');
    burst(p.x, p.y - 30, '#7dff9a', 10, 120, { grav: -150 });
  }
  if (it.mp) {
    p.mp = Math.min(p.maxMp, p.mp + it.mp);
    addText(p.x + 14, p.y - 70, '+' + it.mp, 'mp');
    burst(p.x, p.y - 30, '#7db8ff', 10, 120, { grav: -150 });
  }
  p.potCd = 0.25;
  sfx('heal');
  consume(i);
}

function consume(i) {
  const s = G.player.inv[i];
  s.qty--;
  if (s.qty <= 0) G.player.inv[i] = null;
  G.dirty = true;
}

export function equip(i) {
  const p = G.player;
  const s = p.inv[i];
  const it = ITEMS[s.id];
  if (p.lv < it.lv) return log(`You need level ${it.lv} to equip ${it.name}.`, 'warn');
  const old = p.equip[it.slot];
  p.equip[it.slot] = s.id;
  p.inv[i] = old ? { id: old, qty: 1 } : null;
  recalc(p);
  log(`Equipped ${it.name}.`);
  G.dirty = true;
}

export function unequip(slot) {
  const p = G.player;
  const id = p.equip[slot];
  if (!id) return;
  if (!freeSlots()) return log('Your bag is full.', 'warn');
  p.equip[slot] = null;
  p.inv[p.inv.indexOf(null)] = { id, qty: 1 };
  recalc(p);
  G.dirty = true;
}

// Q / W hotkeys: pick the best potion for the situation.
export function quickPotion(kind) {
  const p = G.player;
  const [small, big] = kind === 'hp' ? ['med_s', 'med_m'] : ['cell_s', 'cell_m'];
  const missing = kind === 'hp' ? p.maxHp - p.hp : p.maxMp - p.mp;
  const order = missing > (kind === 'hp' ? 110 : 80) ? [big, small] : [small, big];
  for (const id of order) {
    const i = p.inv.findIndex((s) => s && s.id === id);
    if (i >= 0) return useSlot(i);
  }
  log(kind === 'hp' ? 'No med packs left!' : 'No energy cells left!', 'warn');
}
