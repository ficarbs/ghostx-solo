// Quest chain from Captain Yoon: availability, progress, turn-in.
import { G } from './state.js';
import { QUESTS, ITEMS, MOBS, CURRENCY } from './data.js';
import { countItem, removeItem, addItem, canAdd } from './items.js';
import { gainExp } from './player.js';
import { addBot } from './bots.js';
import { log, banner } from './fx.js';

export function questState(id) {
  return G.player?.quests[id];
}

// The quest the captain is currently concerned with: first one not yet completed.
export function currentQuest() {
  const p = G.player;
  if (!p) return null;
  return QUESTS.find((q) => p.quests[q.id]?.status !== 'done') || null;
}

export function goalRows(q) {
  const st = questState(q.id);
  const rows = [];
  for (const [type, n] of Object.entries(q.goal.kill || {})) {
    const have = Math.min(n, st?.kills?.[type] || 0);
    rows.push({ label: `Defeat ${MOBS[type].name}`, have, need: n });
  }
  for (const [id, n] of Object.entries(q.goal.collect || {})) {
    rows.push({ label: `Collect ${ITEMS[id].name}`, have: Math.min(n, countItem(id)), need: n });
  }
  return rows;
}

export function questReady(q) {
  const st = questState(q.id);
  return st?.status === 'active' && goalRows(q).every((r) => r.have >= r.need);
}

export function elderMarker() {
  const q = currentQuest();
  if (!q) return null;
  const st = questState(q.id);
  if (!st) return G.player.lv >= q.lv ? '!' : null;
  return questReady(q) ? '?' : null;
}

export function acceptQuest(q) {
  G.player.quests[q.id] = { status: 'active', kills: {} };
  log(`Quest accepted: ${q.name}`, 'quest');
  G.dirty = true;
  G.hooks.save?.();
}

export function completeQuest(q) {
  if (!questReady(q)) return false;
  const items = q.reward.items || [];
  for (const [id, n] of items) {
    if (!canAdd(id, n)) {
      log('Make room in your bag before claiming the reward.', 'warn');
      return false;
    }
  }
  for (const [id, n] of Object.entries(q.goal.collect || {})) removeItem(id, n);
  const p = G.player;
  p.quests[q.id].status = 'done';
  p.gold += q.reward.gold || 0;
  for (const [id, n] of items) addItem(id, n);
  for (const sp of q.reward.bots || []) addBot(sp);
  log(`Quest complete: ${q.name}! +${q.reward.gold} ${CURRENCY}`, 'lvl');
  banner('QUEST COMPLETE', q.name);
  gainExp(q.reward.exp);
  G.dirty = true;
  G.hooks.save?.();
  return true;
}
