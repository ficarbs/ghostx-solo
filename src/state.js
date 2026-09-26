// Shared mutable game state. Everything in the running world hangs off G.
export const G = {
  started: false,
  time: 0,
  map: null,
  player: null,
  mobs: [],
  drops: [],
  projs: [], // enemy projectiles
  shots: [], // player projectiles
  drones: [],
  timers: [], // delayed skill effects
  bubble: null, // companion speech bubble
  sayCd: 0,
  hitstop: 0, // brief freeze on heavy hits
  mission: null, // active instanced mission, see missions.js
  parts: [],
  texts: [],
  effects: [],
  spawners: [],
  boss: null,
  cam: { x: 0, y: 0, shake: 0 },
  ui: { blocking: false },
  dirty: true, // set when inventory/stats/quests change so open windows re-render
  hooks: {}, // filled by ui/main: log, banner, talk, death, save, travel
};
