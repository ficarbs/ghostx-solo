// Map loading, travel between maps, and monster respawning.
import { G } from './state.js';
import { MAPS } from './data.js';
import { spawnMob } from './mobs.js';
import { conditionMet } from './quests.js';
import { buildMapArt } from './render.js';
import { banner, rand } from './fx.js';
import { sfx, playMusic } from './audio.js';

const RESPAWN = 7;

export function loadMap(id) {
  const def = MAPS[id];
  const plats = [{ x: 0, y: def.floor, w: def.w, floor: true }, ...def.plats.map(([x, y, w]) => ({ x, y, w }))];
  const ropes = def.ropes.map(([pi, f]) => {
    const p = plats[pi];
    const x = Math.round(p.x + p.w * f);
    let bottom = def.floor;
    for (const q of plats) {
      if (q !== p && q.y > p.y + 20 && q.y < bottom && x >= q.x && x <= q.x + q.w) bottom = q.y;
    }
    return { x, top: p.y, bottom };
  });
  G.map = {
    id, def, w: def.w, h: def.h, plats, ropes,
    portals: [...def.portals], // copied: missions add an exit gate at runtime
    npcs: def.npcs || [],
  };
  G.mobs = [];
  G.drops = [];
  G.projs = [];
  G.shots = [];
  G.drones = [];
  G.timers = [];
  G.parts = [];
  G.texts = [];
  G.effects = [];
  G.boss = null;
  G.spawners = [];
  for (const [type, pi, count] of def.spawns) {
    for (let i = 0; i < count; i++) {
      const s = { type, plat: plats[pi], mob: null, timer: 0 };
      spawnFrom(s);
      G.spawners.push(s);
    }
  }
  // Story bosses stop respawning once their chapter is done (the arena becomes a passage).
  if (def.boss && !(def.boss.until && conditionMet(def.boss.until))) spawnMob(def.boss.type, plats[0], def.boss.x);
  buildMapArt(G.map);
}

function spawnFrom(s) {
  const pl = s.plat;
  const x = rand(pl.x + 30, pl.x + pl.w - 30);
  s.mob = spawnMob(s.type, pl, x);
}

export function updateSpawners(dt) {
  for (const s of G.spawners) {
    if (s.mob && s.mob.alive) continue;
    s.timer += dt;
    if (s.timer >= RESPAWN) {
      s.timer = 0;
      // Don't pop a monster right on top of the player.
      spawnFrom(s);
      if (Math.abs(s.mob.x - G.player.x) < 80 && Math.abs(s.mob.y - G.player.y) < 80) {
        s.mob.x = s.mob.x < G.player.x ? Math.max(s.plat.x + 20, s.mob.x - 160) : Math.min(s.plat.x + s.plat.w - 20, s.mob.x + 160);
      }
    }
  }
}

export function travel(mapId, portalId) {
  const p = G.player;
  loadMap(mapId);
  const def = G.map.def;
  const portal = G.map.portals.find((pt) => pt.id === portalId);
  p.x = portal ? portal.x : def.spawnX ?? def.w / 2;
  p.y = def.floor;
  p.vx = 0;
  p.vy = 0;
  p.rope = null;
  p.act = null;
  p.attackT = 0;
  p.onGround = true;
  p.plat = G.map.plats[0];
  p.invuln = Math.max(p.invuln, 1.5);
  G.cam.snap = true;
  banner(def.name, def.lvText);
  sfx('portal');
  playMusic(def.music || def.theme);
  G.hooks.log?.(`Entered ${def.name}.`, 'sys');
  G.hooks.mapChanged?.();
  G.hooks.save?.();
}
