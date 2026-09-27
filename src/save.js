// localStorage save/load. Storage can be unavailable (private mode), so every access is guarded.
import { G } from './state.js';
import { INV_SIZE, MAPS } from './data.js';
import { initRuntime, recalc } from './player.js';

// v2 = nanobot era. v1 saves (fantasy version) are incompatible and ignored.
const KEY = 'ghostx-solo-save-v2';

export function hasSave() {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export function saveGame() {
  const p = G.player;
  if (!p || !G.map) return false;
  const mapId = G.map.def.instance ? 'plaza' : G.map.def.boss ? 'rooftop' : G.map.id;
  const data = {
    v: 2, savedAt: Date.now(), mapId,
    name: p.name, lv: p.lv, exp: p.exp, gold: p.gold,
    base: p.base, statPts: p.statPts,
    equip: p.equip, inv: p.inv, quests: p.quests, hp: p.dead ? 1 : p.hp, mp: p.mp,
    bots: p.bots, slots: p.slots, active: p.active, seen: p.seen, bestCombo: p.bestCombo,
    missions: p.missions, storyDone: p.storyDone, playTime: p.playTime,
    enh: p.enh, style: p.style, owned: p.owned,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    const inv = Array(INV_SIZE).fill(null);
    (d.inv || []).slice(0, INV_SIZE).forEach((s, i) => (inv[i] = s));
    const p = {
      name: d.name, lv: d.lv, exp: d.exp, gold: d.gold,
      base: d.base, statPts: d.statPts,
      equip: { head: null, body: null, chip: null, ...d.equip },
      inv, quests: d.quests || {},
      bots: d.bots, slots: d.slots, active: d.active ?? 0, seen: d.seen || [], bestCombo: d.bestCombo || 0,
      missions: d.missions || {}, storyDone: !!d.storyDone, playTime: d.playTime || 0,
      enh: { head: 0, body: 0, chip: 0, ...d.enh },
      style: { hair: 'hair_black', jacket: 'jacket_gear', acc: 'acc_none', ...d.style },
      owned: d.owned || ['hair_black', 'jacket_gear', 'acc_none'],
    };
    initRuntime(p);
    recalc(p);
    p.hp = Math.max(1, Math.min(d.hp ?? p.maxHp, p.maxHp));
    p.mp = Math.min(d.mp ?? p.maxMp, p.maxMp);
    return { player: p, mapId: MAPS[d.mapId] ? d.mapId : 'plaza' };
  } catch {
    return null;
  }
}

export function deleteSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}
