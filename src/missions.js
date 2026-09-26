// Instanced wave missions: launch, wave spawning, grading, rewards, and records.
import { G } from './state.js';
import { MISSIONS, GRADES, MOBS, ITEMS, BOTS, CURRENCY } from './data.js';
import { spawnMob } from './mobs.js';
import { gainExp } from './player.js';
import { addBot, gainBotExp } from './bots.js';
import { addItem } from './items.js';
import { banner, log, burst, rand } from './fx.js';
import { sfx } from './audio.js';

export const missionById = (id) => MISSIONS.find((m) => m.id === id);

export function missionLocked(m) {
  const p = G.player;
  if (m.post && !p.storyDone) return 'Defeat the Rift Sovereign to unlock';
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
    // Left the arena (recall beacon or knocked out).
    if (M.state !== 'done') log(`Mission aborted: ${M.def.name}`, 'warn');
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
      } else finish(M);
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
  for (const [type, n, flag] of M.def.waves[M.wave]) {
    const d = MOBS[type];
    for (let i = 0; i < n; i++) {
      let pl, x, tries = 0;
      do {
        pl = d.kind === 'boss' ? plats[0] : plats[Math.floor(Math.random() * plats.length)];
        x = rand(pl.x + 30 + d.w / 2, pl.x + pl.w - 30 - d.w / 2);
        tries++;
      } while ((pl.w < d.w * 1.4 + 60 || (Math.abs(x - p.x) < 180 && Math.abs(pl.y - p.y) < 120)) && tries < 30);
      const m = spawnMob(type, pl, x, { elite: flag === 'elite', ex: flag === 'ex' });
      m.aggro = true;
      burst(m.x, m.y - m.h / 2, '#ff4a8a', 18, 220, { grav: 0, glow: true });
    }
  }
  sfx('wave');
  banner(`WAVE ${M.wave + 1} / ${M.def.waves.length}`, M.def.name);
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
  for (const [sp, chance] of r.bots || []) {
    if (Math.random() < chance * g.mult && addBot(sp)) got.push(`${BOTS[sp].evo[0]} (nanobot)`);
  }
  const rec = (p.missions[M.def.id] ||= { best: null, clears: 0, bestTime: null });
  rec.clears++;
  if (!rec.best || GRADES.findIndex((x) => x.name === g.name) < GRADES.findIndex((x) => x.name === rec.best)) rec.best = g.name;
  if (rec.bestTime == null || M.t < rec.bestTime) rec.bestTime = Math.round(M.t * 10) / 10;

  // Exit gate appears in the middle of the arena.
  G.map.portals.push({ id: 'exit', x: G.map.w / 2, to: 'plaza', tp: 'spawn' });
  sfx('victory');
  log(`Mission clear: ${M.def.name} · Grade ${g.name} · +${gold} ${CURRENCY}`, 'lvl');
  G.dirty = true;
  G.hooks.missionResult?.({ def: M.def, grade: g, time: M.t, dmg: Math.round(M.dmg), best: M.best, exp, gold, got });
  G.hooks.save?.();
}

export const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
