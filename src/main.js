// Entry point: wires modules together and runs the game loop.
import { G } from './state.js';
import { initInput, endFrame, pollGamepad } from './input.js';
import { createPlayer, updatePlayer, updateShots } from './player.js';
import { updateMobs, updateProjs, updateDrops } from './mobs.js';
import { updateSpawners, travel } from './world.js';
import { updateMission } from './missions.js';
import { updateFx, log } from './fx.js';
import { initRender, render, updateCamera } from './render.js';
import { initUI, frameUI } from './ui.js';
import { hasSave, saveGame, loadSave } from './save.js';
import { initAudio } from './audio.js';
import { loadSettings } from './settings.js';

window.G = G; // handy for debugging from the console
initInput();
loadSettings();
// Browsers only allow audio after a user gesture.
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, initAudio);
initRender(document.getElementById('view'));
G.hooks.save = saveGame;
G.hooks.travel = travel;

function newGame(name, starter) {
  G.player = createPlayer(name, starter);
  start('plaza', 'spawn');
  log(`Welcome to GhostX HQ, ${name}.`, 'sys');
  log('Talk to Captain Yoon (↑ near her) to begin. Tech Jin gives requisitions for new nanobots.', 'sys');
}

function continueGame() {
  const s = loadSave();
  if (!s) return newGame('Hunter');
  G.player = s.player;
  start(s.mapId, s.mapId === 'plaza' ? 'spawn' : 'west');
  log(`Welcome back, ${s.player.name}.`, 'sys');
}

initUI({ hasSave, onNew: newGame, onContinue: continueGame });

function start(mapId, portal) {
  G.started = true;
  travel(mapId, portal);
}

let last = performance.now();
let saveT = 0;

function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  step(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug hook: advance the simulation manually (e.g. when the tab is hidden and rAF is paused).
window.__tick = (seconds, fps = 60) => {
  for (let i = 0; i < seconds * fps; i++) step(1 / fps);
};

function step(dt) {
  // Slow-motion after a perfect dodge.
  if (G.slowT > 0) {
    G.slowT -= dt;
    dt *= 0.35;
  }
  if (G.started && G.hitstop > 0) {
    G.hitstop -= dt;
    render();
    frameUI(dt);
    return;
  }
  pollGamepad();
  if (G.started && (G.paused || G.cutscene)) {
    render();
    frameUI(dt);
    endFrame();
    return;
  }
  if (G.started) {
    G.time += dt;
    G.player.playTime += dt;
    updatePlayer(dt);
    updateMobs(dt);
    updateShots(dt);
    updateProjs(dt);
    updateDrops(dt);
    updateSpawners(dt);
    updateMission(dt);
    updateFx(dt);
    updateCamera(dt);
    saveT += dt;
    if (saveT > 20) {
      saveT = 0;
      saveGame();
    }
  }
  render();
  frameUI(dt);
  endFrame();
}

window.addEventListener('beforeunload', () => G.started && saveGame());
