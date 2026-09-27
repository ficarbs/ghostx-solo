// Instanced wave missions: launch, wave spawning, grading, rewards, and records.
import { G } from './state.js';
import { MISSIONS, GRADES, MOBS, ITEMS, CURRENCY, TOWER } from './data.js';
import { spawnMob } from './mobs.js';
import { gainExp } from './player.js';
import { gainBotExp } from './bots.js';
import { onMissionClear } from './quests.js';
import { addItem } from './items.js';
import { banner, log, burst, rand } from './fx.js';
import { sfx } from './audio.js';

export const missionById = (id) => MISSIONS.find((m) => m.id === id);

export function missionLocked(m) {
  const p = G.player;
  if ((m.post || m.act2) && !p.storyDone) return 'Defeat the Rift Sovereign to unlock';
  if (m.post2 && !p.act2Done) return 'Defeat the Hollow Queen to unlock';
  if (m.act3 && !p.act2Done) return 'Defeat the Hollow Queen to unlock';
  if (p.lv < m.lv) return `Requires level ${m.lv}`;
  return null;
}

export function startMission(id) {
  const def = missionById(id);
  if (!def || missionLocked(def)) return;
  G.hooks.travel(def.arena, 'start');
  const p = G.player;
  G.mission = { def, wave: -1, state: 'intro', timer: 2.5, t: 0, dmg: 0, lastHp: p.hp, best: 0, arena: def.arena };
  banner(def.name.toUpperCase(), 'Get ready...');
  log(`Mission started: ${def.name}`, 'quest');
}

export function updateMission(dt) {
  const M = G.mission;
  if (!M) return;
  const p = G.player;
  if (G.map.id !== M.arena) {
    // Left the arena (recall beacon, cashing out, or knocked out).
    if (M.tower) log(`Rift Tower run ended on floor ${M.floor}. Best: floor ${G.player.towerBest || 0}.`, 'quest');
    else if (M.state !== 'done') log(`Mission aborted: ${M.def.name}`, 'warn');
    G.mission = null;
    return;
  }
  if (p.hp < M.lastHp) M.dmg += M.lastHp - p.hp;
  M.lastHp = p.hp;
  M.best = Math.max(M.best, p.hits);

  if (M.state === 'intro' || M.state === 'between') {
    M.timer -= dt;
    if (M.state === 'between') M.t += dt;
    if (M.timer <= 0) nextWave(M);
  } else if (M.state === 'fight') {
    M.t += dt;
    if (!G.mobs.some((m) => m.alive)) {
      if (M.wave < M.def.waves.length - 1) {
        M.state = 'between';
        M.timer = 2;
        banner('WAVE CLEAR', `Next wave incoming`);
      } else if (M.tower) towerFloorClear(M);
      else finish(M);
    }
  }
}

export function remaining() {
  return G.mobs.filter((m) => m.alive).length;
}

function nextWave(M) {
  M.wave++;
  M.state = 'fight';
  const p = G.player;
  const plats = G.map.plats;
  for (const [type, n, flag, scale] of M.def.waves[M.wave]) {
    const d = MOBS[type];
    for (let i = 0; i < n; i++) {
      let pl, x, tries = 0;
      do {
        pl = d.kind === 'boss' || d.kind === 'rival' ? plats[0] : plats[Math.floor(Math.random() * plats.length)];
        x = rand(pl.x + 30 + d.w / 2, pl.x + pl.w - 30 - d.w / 2);
        tries++;
      } while ((pl.w < d.w * 1.4 + 60 || (Math.abs(x - p.x) < 180 && Math.abs(pl.y - p.y) < 120)) && tries < 30);
      const m = spawnMob(type, pl, x, { elite: flag === 'elite', ex: flag === 'ex', scale, tower: !!M.tower });
      m.aggro = true;
      burst(m.x, m.y - m.h / 2, '#ff4a8a', 18, 220, { grav: 0, glow: true });
    }
  }
  sfx('wave');
  if (M.tower) banner(`FLOOR ${M.floor}`, M.floor % 5 === 0 ? 'Boss floor' : 'Rift Tower');
  else banner(`WAVE ${M.wave + 1} / ${M.def.waves.length}`, M.def.name);
}

function grade(M) {
  const p = G.player;
  let score = 100;
  score -= Math.min(50, Math.max(0, (M.t - M.def.par) / M.def.par) * 60);
  score -= Math.min(35, (M.dmg / p.maxHp) * 25);
  score += Math.min(20, M.best / 10);
  return GRADES.find((g) => score >= g.score);
}

function finish(M) {
  M.state = 'done';
  const p = G.player;
  const g = grade(M);
  const r = M.def.reward;
  const exp = Math.round(r.exp * g.mult);
  const gold = Math.round(r.gold * g.mult);
  p.gold += gold;
  gainExp(exp);
  gainBotExp(exp);
  const got = [];
  for (const [id, chance] of r.items || []) {
    if (Math.random() < chance * g.mult && addItem(id, 1)) got.push(ITEMS[id].name);
  }
  const rec = (p.missions[M.def.id] ||= { best: null, clears: 0, bestTime: null });
  rec.clears++;
  if (!rec.best || GRADES.findIndex((x) => x.name === g.name) < GRADES.findIndex((x) => x.name === rec.best)) rec.best = g.name;
  if (rec.bestTime == null || M.t < rec.bestTime) rec.bestTime = Math.round(M.t * 10) / 10;
  onMissionClear(M.def.id, g.name);

  // Exit gate appears in the middle of the arena.
  G.map.portals.push({ id: 'exit', x: G.map.w / 2, to: 'plaza', tp: 'spawn' });
  sfx('victory');
  log(`Mission clear: ${M.def.name} · Grade ${g.name} · +${gold} ${CURRENCY}`, 'lvl');
  G.dirty = true;
  G.hooks.missionResult?.({ def: M.def, grade: g, time: M.t, dmg: Math.round(M.dmg), best: M.best, exp, gold, got });
  G.hooks.save?.();
}

export const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// ---------- Rift Tower (endless) ----------
// Each floor is one wave from a band of demons, scaled up per floor; every 5th floor is a boss.
// Rewards are banked as each floor is cleared, and you choose to continue or cash out.

export const towerLocked = () => (G.player.act2Done ? null : 'Defeat the Hollow Queen to unlock');

const TOWER_DEF = { id: 'tower', name: 'Rift Tower', arena: 'arena_tower', par: 0, waves: [] };
const TOWER_MATS = ['demon_horn', 'glitch_shard', 'hound_fang', 'shade_residue', 'brute_plate', 'mirror_shard', 'void_core', 'hollow_fragment', 'echo_plate', 'sentinel_lens'];

function towerFloor(f) {
  const scale = 1 + TOWER.scalePerFloor * (f - 1);
  if (f % 5 === 0) {
    const boss = TOWER.bosses[(f / 5 - 1) % TOWER.bosses.length];
    return [[boss, 1, null, Math.max(0.6, scale * 0.55)]];
  }
  const pool = TOWER.pools.find((b) => f <= b.upTo).mobs;
  const n = Math.min(10, 3 + Math.floor(f / 2));
  const groups = [];
  for (let i = 0; i < n; i++) groups.push([pool[Math.floor(Math.random() * pool.length)], 1, null, scale]);
  if (f >= 4 && f % 2 === 0) groups.push([pool[Math.floor(Math.random() * pool.length)], 1, 'elite', scale]);
  return groups;
}

export function startTower() {
  if (towerLocked()) return;
  G.hooks.travel(TOWER_DEF.arena, 'start');
  const p = G.player;
  G.mission = { def: { ...TOWER_DEF, waves: [towerFloor(1)] }, tower: true, floor: 1, wave: -1, state: 'intro', timer: 2.5, t: 0, dmg: 0, lastHp: p.hp, best: 0, arena: TOWER_DEF.arena, banked: { gold: 0, exp: 0 } };
  banner('RIFT TOWER', 'How high can you climb?');
  log('Rift Tower: clear a floor to bank its rewards. Continue or cash out between floors.', 'quest');
}

function towerFloorClear(M) {
  const p = G.player;
  const f = M.floor;
  M.state = 'choice';
  const gold = Math.round(150 * f * (1 + f / 10));
  const exp = Math.round(80 * Math.pow(f, 1.6));
  p.gold += gold;
  gainExp(exp);
  gainBotExp(exp);
  const mat = TOWER_MATS[Math.min(TOWER_MATS.length - 1, Math.floor((f - 1) / 2) + Math.floor(Math.random() * 3))];
  const qty = f % 5 === 0 ? 5 : 1 + Math.floor(Math.random() * 2);
  addItem(mat, qty);
  M.banked.gold += gold;
  M.banked.exp += exp;
  if (f > (p.towerBest || 0)) p.towerBest = f;
  sfx('victory');
  G.dirty = true;
  G.hooks.save?.();
  G.hooks.towerChoice?.({ floor: f, gold, exp, mat: ITEMS[mat].name, qty, banked: M.banked, best: p.towerBest });
}

export function towerContinue() {
  const M = G.mission;
  if (!M?.tower || M.state !== 'choice') return;
  M.floor++;
  M.def.waves = [towerFloor(M.floor)];
  M.wave = -1;
  M.state = 'between';
  M.timer = 1.5;
  const p = G.player;
  p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.25));
  p.mp = Math.min(p.maxMp, p.mp + Math.round(p.maxMp * 0.25));
}

export function towerCashOut() {
  G.hooks.travel('plaza', 'spawn');
}
