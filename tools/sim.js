// Balance harness: runs an autopilot boss fight inside the real game loop.
// Usage (browser console on the game page):
//   const { simFight } = await import('/tools/sim.js');
//   await simFight({ lv: 11, sp: 'razor', botLv: 12, gear: { head: 'combat_helm', body: 'nano_jacket', chip: 'focus_chip' } });
import { G } from '../src/state.js';
import { createPlayer, recalc } from '../src/player.js';
import { botType } from '../src/bots.js';
import { travel } from '../src/world.js';
import { startMission } from '../src/missions.js';

const key = (code, type) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
const HOLD = ['KeyX', 'KeyZ', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyQ', 'KeyW'];

// Stat points are split 60% STR / 25% VIT / 15% DEX, as a typical player would.
export async function simFight({ lv, sp, botLv, stars = 0, gear = {}, ex = false, maxT = 240, dist }) {
  const p = createPlayer('Sim');
  G.player = p;
  G.started = true;
  p.lv = lv;
  const pts = 5 * (lv - 1);
  p.base.str += Math.round(pts * 0.6);
  p.base.vit += Math.round(pts * 0.25);
  p.base.dex += pts - Math.round(pts * 0.6) - Math.round(pts * 0.25);
  p.bots = [{ uid: 1, sp, lv: botLv, exp: 0, stars }];
  p.slots = [1, null, null];
  p.active = 0;
  Object.assign(p.equip, gear);
  p.inv[0] = { id: 'med_m', qty: 10 };
  p.inv[1] = { id: 'cell_m', qty: 10 };
  p.storyDone = true;
  recalc(p);
  p.hp = p.maxHp;
  p.mp = p.maxMp;
  if (ex) startMission('m5');
  else travel('rift', 'west');
  window.__tick(3.5);

  const type = botType(p.bots[0]);
  const want = dist ?? { blade: 70, blaster: 130, sniper: 380, medic: 220 }[type];
  let t = 0;
  while (G.boss && !p.dead && t < maxT) {
    const b = G.boss;
    const dx = b.x - p.x;
    const danger = b.st === 'sweep' || (b.st === 'lunge' && b.atk?.phase === 'wind');
    key('ArrowLeft', 'keyup');
    key('ArrowRight', 'keyup');
    if (Math.abs(dx) > want + 30) key(dx > 0 ? 'ArrowRight' : 'ArrowLeft', 'keydown');
    else if (Math.abs(dx) < want - 30) key(dx > 0 ? 'ArrowLeft' : 'ArrowRight', 'keydown');
    else p.face = Math.sign(dx) || 1;
    if (danger && p.onGround) key('KeyX', 'keydown');
    key('KeyZ', 'keydown');
    for (const k of ['KeyA', 'KeyS', 'KeyD', 'KeyF']) key(k, 'keydown');
    if (p.hp < p.maxHp * 0.45) key('KeyQ', 'keydown');
    if (p.mp < 30) key('KeyW', 'keydown');
    window.__tick(0.1);
    for (const k of HOLD) key(k, 'keyup');
    t += 0.1;
  }
  key('ArrowLeft', 'keyup');
  key('ArrowRight', 'keyup');
  const meds = p.inv.find((s) => s && s.id === 'med_m');
  return {
    type, atk: Math.round(p.atk), def: Math.round(p.def), maxHp: p.maxHp,
    won: !G.boss, dead: p.dead, t: Math.round(t),
    bossLeft: G.boss ? Math.round((G.boss.hp / G.boss.maxHp) * 100) + '%' : '0%',
    medsUsed: 10 - (meds ? meds.qty : 0), best: p.bestCombo,
  };
}
