// Two quest chains: the story from Captain Yoon, and nanobot requisitions from Tech Jin.
// Each chain offers one quest at a time, in order. Requisitions are the only source of new nanobots.
import { G } from './state.js';
import { QUESTS, BOT_QUESTS, ITEMS, MOBS, BOTS, MISSIONS, GRADES, CURRENCY } from './data.js';
import { countItem, removeItem, addItem, canAdd } from './items.js';
import { gainExp } from './player.js';
import { addBot } from './bots.js';
import { log, banner } from './fx.js';

export const CHAINS = { captain: QUESTS, jin: BOT_QUESTS };
export const ALL_QUESTS = [...QUESTS, ...BOT_QUESTS];

export function questState(id) {
  return G.player?.quests[id];
}

// The quest a giver is currently concerned with: the first one in their chain not yet completed.
export function currentQuest(giver = 'captain') {
  const p = G.player;
  if (!p) return null;
  return CHAINS[giver].find((q) => p.quests[q.id]?.status !== 'done') || null;
}

const gradeRank = (g) => GRADES.findIndex((x) => x.name === g);

export function goalRows(q) {
  const st = questState(q.id);
  const rows = [];
  for (const [type, n] of Object.entries(q.goal.kill || {})) {
    rows.push({ label: `Defeat ${MOBS[type].name}`, have: Math.min(n, st?.kills?.[type] || 0), need: n });
  }
  for (const [id, n] of Object.entries(q.goal.collect || {})) {
    rows.push({ label: `Collect ${ITEMS[id].name}`, have: Math.min(n, countItem(id)), need: n });
  }
  if (q.goal.mission) {
    const { id, grade } = q.goal.mission;
    const got = st?.mission;
    const ok = got && (!grade || gradeRank(got) <= gradeRank(grade));
    const name = MISSIONS.find((m) => m.id === id).name;
    rows.push({ label: `Clear ${name}${grade ? ` (grade ${grade}+)` : ''}`, have: ok ? 1 : 0, need: 1 });
  }
  return rows;
}

export function questReady(q) {
  const st = questState(q.id);
  return st?.status === 'active' && goalRows(q).every((r) => r.have >= r.need);
}

// '!' when a giver has a quest to offer, '?' when one is ready to turn in.
export function questMarker(giver) {
  const q = currentQuest(giver);
  if (!q) return null;
  const st = questState(q.id);
  if (!st) return G.player.lv >= q.lv ? '!' : null;
  return questReady(q) ? '?' : null;
}
export const elderMarker = () => questMarker('captain');

export function acceptQuest(q) {
  G.player.quests[q.id] = { status: 'active', kills: {} };
  log(`Quest accepted: ${q.name}`, 'quest');
  G.dirty = true;
  G.hooks.save?.();
}

// Called on every demon kill: advance kill goals of active quests in both chains.
export function onKill(type) {
  const p = G.player;
  for (const q of ALL_QUESTS) {
    const st = p.quests[q.id];
    if (!st || st.status !== 'active' || q.goal.kill?.[type] === undefined) continue;
    st.kills[type] = (st.kills[type] || 0) + 1;
    if (st.kills[type] <= q.goal.kill[type]) log(`${q.name}: ${MOBS[type].name} ${st.kills[type]}/${q.goal.kill[type]}`, 'quest');
    G.dirty = true;
  }
}

// Called when a mission is cleared: record the best grade for active requisitions that need it.
export function onMissionClear(missionId, grade) {
  const p = G.player;
  for (const q of BOT_QUESTS) {
    const st = p.quests[q.id];
    if (!st || st.status !== 'active' || q.goal.mission?.id !== missionId) continue;
    if (!st.mission || gradeRank(grade) < gradeRank(st.mission)) st.mission = grade;
    G.dirty = true;
  }
}

// Species a requisition can still give: its pick list minus bots already owned.
export function pickOptions(q) {
  const owned = new Set(G.player.bots.map((b) => b.sp));
  const opts = q.reward.pick.filter((sp) => !owned.has(sp));
  return opts.length ? opts : Object.keys(BOTS).filter((sp) => !owned.has(sp));
}

// Pay out a completed quest. For requisitions, `sp` is the nanobot the player chose.
export function completeQuest(q, sp) {
  if (!questReady(q)) return false;
  const items = q.reward.items || [];
  for (const [id, n] of items) {
    if (!canAdd(id, n)) {
      log('Make room in your bag before claiming the reward.', 'warn');
      return false;
    }
  }
  if (q.reward.pick && !sp) return false;
  for (const [id, n] of Object.entries(q.goal.collect || {})) removeItem(id, n);
  const p = G.player;
  p.quests[q.id].status = 'done';
  p.gold += q.reward.gold || 0;
  for (const [id, n] of items) addItem(id, n);
  if (sp) addBot(sp);
  log(`Quest complete: ${q.name}! +${q.reward.gold} ${CURRENCY}`, 'lvl');
  if (!sp) banner('QUEST COMPLETE', q.name);
  gainExp(q.reward.exp);
  G.dirty = true;
  G.hooks.save?.();
  return true;
}
