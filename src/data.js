// Static game data: tuning constants, items, nanobots, monsters, maps, NPCs, quests.

// View width adapts to the window's aspect ratio (960 at 16:9, up to 1280 on wide phones); height is fixed.
// Exported as a live binding so every module sees the current value.
export let VIEW_W = 960;
export const setViewWidth = (w) => (VIEW_W = w);
export const VIEW_H = 540;
export const GRAVITY = 2000;
export const JUMP_V = 700;
export const RUN_SPEED = 230;
export const CLIMB_SPEED = 150;
export const MAX_LV = 30;
export const INV_SIZE = 32;
export const BOT_CAP = 40;
export const BOT_MAX_LV = 20;
export const CURRENCY = 'cr';

export const expNeed = (lv) => Math.floor(25 * Math.pow(lv, 1.8) + 20);
export const botExpNeed = (lv) => Math.floor(30 * Math.pow(lv, 1.5));

// ---------- Items ----------
// type: use | etc | equip. Equip slots: head, body, chip. (Weapons are nanobots.)
// `price` = shop buy price; `sell` overrides the default sell value (35% of price).
export const ITEMS = {
  med_s: { name: 'Med Pack', type: 'use', icon: ['medkit', '#e03b3b'], hp: 50, price: 20, desc: 'Field bandages and a stim shot. Restores 50 HP.' },
  med_m: { name: 'Trauma Kit', type: 'use', icon: ['medkit', '#ff7a2a'], hp: 160, price: 70, desc: 'Restores 160 HP.' },
  cell_s: { name: 'Energy Cell', type: 'use', icon: ['cell', '#3bb0e0'], mp: 40, price: 30, desc: 'Recharges 40 EN.' },
  cell_m: { name: 'Fusion Cell', type: 'use', icon: ['cell', '#8a5cff'], mp: 120, price: 90, desc: 'Recharges 120 EN.' },
  recall: { name: 'Recall Beacon', type: 'use', icon: ['beacon', '#6af0ff'], town: true, price: 60, desc: 'Teleports you back to Metro Central.' },
  hoverboard: { name: 'Hoverboard', type: 'key', icon: ['board', '#40e0ff'], lv: 5, price: 1500, desc: 'Press R to ride. Much faster, but you have to hop off to fight.' },

  demon_horn: { name: 'Imp Horn', type: 'etc', icon: ['horn', '#d86a5a'], sell: 6, desc: 'Still hot from the rift.' },
  glitch_shard: { name: 'Glitch Shard', type: 'etc', icon: ['shard', '#ff5af0'], sell: 10, desc: 'A sliver of corrupted data. It flickers.' },
  hound_fang: { name: 'Hellhound Fang', type: 'etc', icon: ['fang', '#ffb060'], sell: 22, desc: 'Glows like a coal.' },
  shade_residue: { name: 'Shade Residue', type: 'etc', icon: ['orb', '#6a5aff'], sell: 32, desc: 'Cold black mist in a vial.' },
  brute_plate: { name: 'Brute Plating', type: 'etc', icon: ['plate', '#8a8f99'], sell: 45, desc: 'Demon flesh fused with scrap iron.' },
  sovereign_core: { name: 'Sovereign Core', type: 'etc', icon: ['core', '#ff3a6a'], sell: 600, rare: true, desc: 'The rift\'s heart. It still beats.' },

  street_cap: { name: 'Street Cap', type: 'equip', slot: 'head', def: 1, lv: 1, price: 40, icon: ['cap', '#3a6ae0'], color: '#3a6ae0', look: 'cap', desc: 'Backwards is optional.' },
  tac_visor: { name: 'Tac Visor', type: 'equip', slot: 'head', def: 3, dex: 1, lv: 4, price: 220, icon: ['visor', '#40e0ff'], color: '#40e0ff', look: 'visor', desc: 'HUD overlay with threat tracking.' },
  combat_helm: { name: 'Combat Helmet', type: 'equip', slot: 'head', def: 5, lv: 6, price: 420, icon: ['helm', '#5a6070'], color: '#5a6070', look: 'helm', desc: 'Standard GhostX issue.' },
  sovereign_crown: { name: 'Sovereign Horns', type: 'equip', slot: 'head', def: 9, hp: 120, lv: 12, sell: 2000, rare: true, icon: ['horns', '#ff4a6a'], color: '#ff4a6a', look: 'horns', desc: 'Wearing a demon\'s crown. Bold.' },

  hoodie: { name: 'Hoodie', type: 'equip', slot: 'body', def: 2, lv: 1, price: 20, icon: ['jacket', '#44475a'], color: '#44475a', desc: 'Comfortable. Not bulletproof.' },
  kevlar: { name: 'Kevlar Vest', type: 'equip', slot: 'body', def: 5, lv: 3, price: 200, icon: ['jacket', '#3a4a3a'], color: '#3a4a3a', desc: 'Stops most claws.' },
  nano_jacket: { name: 'Nano-Weave Jacket', type: 'equip', slot: 'body', def: 10, vit: 1, lv: 6, price: 750, icon: ['jacket', '#1a5aa8'], color: '#1a5aa8', desc: 'Self-repairing fibers.' },
  rift_plate: { name: 'Rift Plate', type: 'equip', slot: 'body', def: 17, vit: 3, lv: 9, sell: 600, rare: true, icon: ['jacket', '#a83a5a'], color: '#a83a5a', desc: 'Armor grown from brute plating.' },

  focus_chip: { name: 'Focus Chip', type: 'equip', slot: 'chip', str: 2, lv: 2, sell: 60, icon: ['chip', '#4fc08a'], desc: 'Boosts nanobot output.' },
  reflex_chip: { name: 'Reflex Chip', type: 'equip', slot: 'chip', dex: 4, str: 1, lv: 7, sell: 300, rare: true, icon: ['chip', '#c8c8ff'], desc: 'Overclocks your reaction time.' },
  sovereign_chip: { name: 'Sovereign Chip', type: 'equip', slot: 'chip', str: 5, dex: 5, vit: 5, lv: 10, sell: 2500, rare: true, icon: ['chip', '#ff4a6a'], desc: 'Rift energy, tamed. Mostly.' },
};

export const sellPrice = (id) => {
  const it = ITEMS[id];
  return it.sell ?? Math.floor((it.price || 0) * 0.35);
};

// ---------- Nanobots ----------
// Classless combat: your active nanobot is your weapon and decides your moveset.
export const BOT_TYPES = {
  blade: { name: 'Blade', color: '#5ad8ff', desc: 'Melee. Fast 3-hit combos, dashes and spins.' },
  blaster: { name: 'Blaster', color: '#ffb040', desc: 'Short range. Spread shots and grenades.' },
  sniper: { name: 'Sniper', color: '#c080ff', desc: 'Long range. Heavy piercing shots.' },
  medic: { name: 'Medic', color: '#60f0a0', desc: 'Support. Heals, shields and drone swarms.' },
};
export const BOT_TYPE_ORDER = ['blade', 'blaster', 'sniper', 'medic'];

// evo: names at stages 1 / 2 (lv 6) / 3 (lv 12). rarity: 1 common, 2 rare, 3 epic.
export const BOTS = {
  kira: { evo: ['Kira', 'Kira Edge', 'Kira Zero'], type: 'blade', atk: 6, rarity: 1, persona: 'cheerful' },
  razor: { evo: ['Razorfin', 'Razorwing', 'Razorking'], type: 'blade', atk: 9, rarity: 2, persona: 'grumpy' },
  oni: { evo: ['Oni-X', 'Oni-XR', 'Oni Omega'], type: 'blade', atk: 13, rarity: 3, persona: 'stoic' },
  pip: { evo: ['Pip', 'Pipster', 'Pipzilla'], type: 'blaster', atk: 5, rarity: 1, persona: 'nervous' },
  boomer: { evo: ['Boomer', 'Boom-Boom', 'Megaboom'], type: 'blaster', atk: 8, rarity: 2, persona: 'cheerful' },
  havoc: { evo: ['Havoc', 'Havoc Mk2', 'Havoc Prime'], type: 'blaster', atk: 12, rarity: 3, persona: 'grumpy' },
  lens: { evo: ['Lens', 'Longlens', 'Hawkeye'], type: 'sniper', atk: 6, rarity: 1, persona: 'stoic' },
  volt: { evo: ['Volt', 'Railvolt', 'Thunderail'], type: 'sniper', atk: 9, rarity: 2, persona: 'cheerful' },
  nyx: { evo: ['Nyx', 'Nyx Shade', 'Nyx Eclipse'], type: 'sniper', atk: 13, rarity: 3, persona: 'grumpy' },
  mote: { evo: ['Mote', 'Medimote', 'Seraph'], type: 'medic', atk: 4, rarity: 1, persona: 'nervous' },
  aegis: { evo: ['Aegis', 'Aegis II', 'Aegis Nova'], type: 'medic', atk: 7, rarity: 2, persona: 'stoic' },
  halo: { evo: ['Halo', 'Halo Prime', 'Archon'], type: 'medic', atk: 10, rarity: 3, persona: 'cheerful' },
};
export const BOT_ORDER = Object.keys(BOTS);
export const STARTERS = ['kira', 'pip', 'lens', 'mote'];

// Overclock: +1 star (+10% power) per level, paid in credits and demon loot. Index = current stars.
export const OVERCLOCK = [
  { gold: 150, items: [['demon_horn', 6]] },
  { gold: 400, items: [['glitch_shard', 6]] },
  { gold: 900, items: [['hound_fang', 6]] },
  { gold: 1800, items: [['shade_residue', 6]] },
  { gold: 3500, items: [['brute_plate', 6], ['sovereign_core', 1]] },
];
export const RARITY = ['', 'Common', 'Rare', 'Epic'];

// Basic attack per type. rate = seconds between attacks.
export const BOT_BASIC = {
  blade: { rate: 0.32, desc: '3-hit melee combo' },
  blaster: { rate: 0.3, pellets: 3, spread: 0.13, speed: 720, life: 0.32, mult: 0.4, desc: 'Short-range spread shot' },
  sniper: { rate: 0.55, speed: 1500, life: 0.45, mult: 1.35, pierce: 1, desc: 'Long-range piercing shot' },
  medic: { rate: 0.4, speed: 520, life: 0.8, mult: 0.85, leech: 0.01, desc: 'Energy orb that heals you on hit' },
};

// A / S / D skills per type. Unlocked by the active bot's level.
export const BOT_SKILLS = {
  blade: [
    { id: 'dash', key: 'A', name: 'Phase Dash', unlock: 1, mp: 8, cd: 1.2, mult: 1.6, desc: 'Dash through enemies, hitting all of them. Brief invulnerability.' },
    { id: 'slam', key: 'S', name: 'Ground Breaker', unlock: 4, mp: 14, cd: 3, mult: 2.4, desc: 'Smash the ground, launching nearby enemies. Plunges if airborne.' },
    { id: 'whirl', key: 'D', name: 'Cyclone Edge', unlock: 8, mp: 24, cd: 7, mult: 0.75, desc: 'Spin for 1.2s, cutting everything around you. You can move.' },
  ],
  blaster: [
    { id: 'scatter', key: 'A', name: 'Scatter Burst', unlock: 1, mp: 10, cd: 1.5, mult: 0.8, desc: 'Fire a 7-pellet cone and hop backwards.' },
    { id: 'grenade', key: 'S', name: 'Frag Grenade', unlock: 4, mp: 14, cd: 3, mult: 2.6, desc: 'Lob a grenade that explodes in a wide blast.' },
    { id: 'overdrive', key: 'D', name: 'Overdrive', unlock: 8, mp: 24, cd: 8, mult: 0.5, desc: 'Unload a rapid stream of shots for 2 seconds.' },
  ],
  sniper: [
    { id: 'pierce', key: 'A', name: 'Rail Shot', unlock: 1, mp: 10, cd: 1.6, mult: 2.3, desc: 'A charged round that pierces every enemy in a line.' },
    { id: 'backstep', key: 'S', name: 'Evasion Shot', unlock: 4, mp: 12, cd: 2.5, mult: 1.9, desc: 'Leap backwards while firing a heavy round.' },
    { id: 'orbital', key: 'D', name: 'Orbital Strike', unlock: 8, mp: 26, cd: 9, mult: 4.2, desc: 'Mark the ground ahead. A satellite beam hits after a short delay.' },
  ],
  medic: [
    { id: 'repair', key: 'A', name: 'Repair Pulse', unlock: 1, mp: 16, cd: 6, heal: 0.25, mult: 1.0, desc: 'Heal 25% HP and damage nearby enemies.' },
    { id: 'barrier', key: 'S', name: 'Barrier', unlock: 4, mp: 18, cd: 12, dur: 4, desc: 'A shield that blocks all damage for 4 seconds.' },
    { id: 'swarm', key: 'D', name: 'Drone Swarm', unlock: 8, mp: 24, cd: 10, mult: 0.7, desc: 'Deploy 3 attack drones for 7 seconds.' },
  ],
};

// Personality lines shown in the companion's speech bubble.
export const PERSONA = {
  cheerful: {
    swap: ['Let\'s gooo!', 'My turn!', 'Ready when you are!'],
    kill: ['Boom! Got \'em!', 'Too easy!', 'Next!'],
    low: ['Hang in there!', 'Heal up, quick!'],
    evolve: ['I feel... AMAZING!'],
    combo: ['We\'re on FIRE!', 'Keep it going!!'],
    idle: ['Nice night for demon hunting!', 'Hey, what\'s that over there?'],
  },
  grumpy: {
    swap: ['Fine. I\'ll do it.', 'Ugh. Finally.'],
    kill: ['Stay down.', 'Pathetic.'],
    low: ['You\'re gonna get us scrapped.', 'Heal. Now.'],
    evolve: ['...Not bad.'],
    combo: ['Hmph. Decent.', 'Don\'t get cocky.'],
    idle: ['Are we done yet?', 'I hate this city.'],
  },
  stoic: {
    swap: ['Engaging.', 'Online.'],
    kill: ['Target neutralized.', 'Threat removed.'],
    low: ['Integrity critical.', 'Recommend healing.'],
    evolve: ['Evolution complete.'],
    combo: ['Rhythm stable.', 'Efficiency rising.'],
    idle: ['Scanning.', 'No threats detected.'],
  },
  nervous: {
    swap: ['M-me? Okay!', 'I\'ll do my best!'],
    kill: ['D-did I do that?', 'Sorry! ...Not sorry?'],
    low: ['We should run! RUN!', 'This is bad bad bad!'],
    evolve: ['Whoa, whoa, WHOA!'],
    combo: ['Th-this is kinda fun?', 'Don\'t stop now!'],
    idle: ['Did you hear that?', 'I don\'t like the dark...'],
  },
};

// Combo ranks: hits needed, EXP bonus, damage bonus.
export const RANKS = [
  { name: 'D', hits: 0, exp: 0, dmg: 0, color: '#9aa0b0' },
  { name: 'C', hits: 10, exp: 0.05, dmg: 0.02, color: '#7ad0ff' },
  { name: 'B', hits: 25, exp: 0.1, dmg: 0.04, color: '#7affb0' },
  { name: 'A', hits: 50, exp: 0.2, dmg: 0.06, color: '#ffe06a' },
  { name: 'S', hits: 100, exp: 0.35, dmg: 0.08, color: '#ffa040' },
  { name: 'SS', hits: 200, exp: 0.5, dmg: 0.1, color: '#ff5a8a' },
  { name: 'SSS', hits: 400, exp: 0.75, dmg: 0.12, color: '#ff4af0' },
];
export const COMBO_TIME = 3;

// ---------- Monsters ----------
// kind: walker (patrols a platform) | floater (hovers) | boss.
export const MOBS = {
  imp: { name: 'Rift Imp', lv: 1, hp: 40, atk: 11, def: 0, exp: 10, speed: 55, w: 34, h: 40, kind: 'walker', aggro: 0, gold: [3, 8],
    drops: [['demon_horn', 0.5], ['med_s', 0.12], ['focus_chip', 0.01]] },
  wisp: { name: 'Glitch Wisp', lv: 3, hp: 62, atk: 16, def: 1, exp: 18, speed: 50, w: 30, h: 34, kind: 'floater', aggro: 220, gold: [5, 12],
    drops: [['glitch_shard', 0.55], ['cell_s', 0.15], ['focus_chip', 0.02]] },
  hound: { name: 'Hellhound', lv: 5, hp: 160, atk: 27, def: 3, exp: 42, speed: 80, w: 66, h: 40, kind: 'walker', aggro: 300, charge: true, gold: [10, 22],
    drops: [['hound_fang', 0.45], ['med_s', 0.2], ['kevlar', 0.03], ['tac_visor', 0.02]] },
  specter: { name: 'Shade Specter', lv: 7, hp: 250, atk: 37, def: 5, exp: 70, speed: 55, w: 34, h: 62, kind: 'floater', aggro: 340, shoots: true, gold: [15, 30],
    drops: [['shade_residue', 0.45], ['med_m', 0.08], ['cell_m', 0.05], ['reflex_chip', 0.015]] },
  brute: { name: 'Iron Brute', lv: 9, hp: 500, atk: 50, def: 10, exp: 120, speed: 38, w: 72, h: 60, kind: 'walker', aggro: 180, gold: [25, 45],
    drops: [['brute_plate', 0.5], ['med_m', 0.12], ['rift_plate', 0.02], ['combat_helm', 0.02]] },
  sovereign: { name: 'Rift Sovereign', lv: 12, hp: 14000, atk: 64, def: 12, exp: 1500, speed: 90, w: 130, h: 110, kind: 'boss', aggro: 9999, gold: [800, 1200],
    drops: [['sovereign_core', 1], ['med_m', 1], ['sovereign_crown', 0.35], ['sovereign_chip', 0.3]] },
};

// ---------- Maps ----------
// Platforms: [x, y, width]. Index 0 is always the generated floor, so plats[] start at index 1.
// ladders: [platformIndex, fractionAlongPlatform] — the ladder hangs down to the next surface.
// spawns: [mobType, platformIndex, count]
export const MAPS = {
  plaza: {
    name: 'Metro Central', theme: 'plaza', w: 2200, h: 620, floor: 560, town: true, lvText: 'GhostX HQ · Safe Zone',
    plats: [[260, 450, 240], [1450, 450, 280], [1560, 340, 200]],
    ropes: [[3, 0.3]],
    npcs: [{ id: 'captain', x: 640 }, { id: 'mina', x: 960 }, { id: 'jin', x: 1250 }, { id: 'terminal', x: 1880 }],
    portals: [{ id: 'east', x: 2110, to: 'alley', tp: 'west' }],
    spawnX: 300,
    spawns: [],
  },
  alley: {
    name: 'Neon Alley', theme: 'alley', w: 3000, h: 1000, floor: 940, lvText: 'Lv 1–4',
    plats: [[200, 830, 440], [860, 830, 480], [1580, 830, 460], [2260, 830, 520],
      [420, 720, 380], [1120, 710, 520], [1900, 715, 420],
      [650, 600, 400], [1450, 595, 480], [2200, 600, 440]],
    ropes: [[5, 0.1], [6, 0.9], [7, 0.5], [8, 0.2], [9, 0.5], [10, 0.8]],
    portals: [{ id: 'west', x: 90, to: 'plaza', tp: 'east' }, { id: 'east', x: 2910, to: 'subway', tp: 'west' }],
    spawns: [['imp', 0, 6], ['imp', 1, 2], ['imp', 2, 2], ['imp', 3, 2], ['imp', 4, 2],
      ['wisp', 5, 2], ['wisp', 6, 2], ['wisp', 7, 2], ['wisp', 8, 2], ['wisp', 9, 2], ['wisp', 10, 2]],
  },
  subway: {
    name: 'Line 9 Depot', theme: 'subway', w: 3200, h: 1000, floor: 940, lvText: 'Lv 4–7',
    plats: [[150, 830, 500], [900, 830, 600], [1750, 830, 500], [2500, 830, 500],
      [400, 715, 450], [1200, 720, 550], [2100, 715, 500],
      [700, 600, 500], [1600, 600, 450], [2400, 605, 450]],
    ropes: [[5, 0.15], [6, 0.85], [7, 0.5], [8, 0.2], [9, 0.6], [10, 0.8]],
    portals: [{ id: 'west', x: 90, to: 'alley', tp: 'east' }, { id: 'east', x: 3110, to: 'rooftop', tp: 'west' }],
    spawns: [['hound', 0, 5], ['hound', 1, 1], ['hound', 2, 2], ['hound', 3, 1], ['hound', 4, 2],
      ['wisp', 5, 2], ['wisp', 6, 2], ['wisp', 7, 2], ['hound', 8, 1], ['hound', 9, 1], ['hound', 10, 1]],
  },
  rooftop: {
    name: 'Skyline Rooftops', theme: 'rooftop', w: 3400, h: 1100, floor: 1040, lvText: 'Lv 7–11',
    plats: [[200, 930, 600], [1050, 930, 700], [2000, 930, 600], [2800, 930, 450],
      [450, 820, 500], [1300, 815, 600], [2250, 820, 550],
      [250, 705, 450], [900, 700, 550], [1700, 700, 500], [2450, 705, 500],
      [600, 590, 500], [1350, 585, 550], [2100, 590, 500]],
    ropes: [[5, 0.1], [6, 0.9], [7, 0.5], [8, 0.8], [9, 0.3], [10, 0.5], [11, 0.7], [12, 0.2], [13, 0.5], [14, 0.8]],
    portals: [{ id: 'west', x: 90, to: 'subway', tp: 'east' }, { id: 'east', x: 3310, to: 'rift', tp: 'west' }],
    spawns: [['brute', 0, 4], ['brute', 1, 1], ['brute', 2, 1], ['brute', 3, 1],
      ['specter', 5, 1], ['specter', 6, 2], ['specter', 7, 1], ['specter', 8, 1], ['specter', 9, 2],
      ['specter', 10, 1], ['specter', 11, 1], ['specter', 12, 1], ['specter', 13, 2], ['specter', 14, 1]],
  },
  arena_alley: {
    name: 'Op: Alley Outbreak', theme: 'alley', w: 1600, h: 700, floor: 640, lvText: 'Mission', instance: true, music: 'mission',
    plats: [[180, 530, 300], [1120, 530, 300], [560, 420, 480], [220, 310, 260], [1120, 310, 260]],
    ropes: [[1, 0.5], [2, 0.5], [3, 0.1], [3, 0.9], [4, 0.5], [5, 0.5]],
    portals: [],
    spawnX: 800,
    spawns: [],
  },
  arena_subway: {
    name: 'Op: Depot Lockdown', theme: 'subway', w: 1600, h: 700, floor: 640, lvText: 'Mission', instance: true, music: 'mission',
    plats: [[180, 530, 300], [1120, 530, 300], [560, 420, 480], [220, 310, 260], [1120, 310, 260]],
    ropes: [[1, 0.5], [2, 0.5], [3, 0.1], [3, 0.9], [4, 0.5], [5, 0.5]],
    portals: [],
    spawnX: 800,
    spawns: [],
  },
  arena_rooftop: {
    name: 'Op: Rooftop Siege', theme: 'rooftop', w: 1600, h: 700, floor: 640, lvText: 'Mission', instance: true, music: 'mission',
    plats: [[180, 530, 300], [1120, 530, 300], [560, 420, 480], [220, 310, 260], [1120, 310, 260]],
    ropes: [[1, 0.5], [2, 0.5], [3, 0.1], [3, 0.9], [4, 0.5], [5, 0.5]],
    portals: [],
    spawnX: 800,
    spawns: [],
  },
  arena_rift: {
    name: 'Op: Rift Breach', theme: 'rift', w: 1600, h: 700, floor: 640, lvText: 'Mission', instance: true, music: 'mission',
    plats: [[180, 530, 300], [1120, 530, 300], [560, 420, 480], [220, 310, 260], [1120, 310, 260]],
    ropes: [[1, 0.5], [2, 0.5], [3, 0.1], [3, 0.9], [4, 0.5], [5, 0.5]],
    portals: [],
    spawnX: 800,
    spawns: [],
  },
  rift: {
    name: 'The Rift Core', theme: 'rift', w: 1600, h: 700, floor: 640, lvText: 'Boss · Lv 12',
    plats: [[250, 530, 260], [1090, 530, 260], [620, 420, 360]],
    ropes: [],
    portals: [{ id: 'west', x: 90, to: 'rooftop', tp: 'east' }],
    boss: { type: 'sovereign', x: 1150 },
    spawns: [],
  },
};

export const NPCS = {
  captain: { name: 'Captain Yoon', role: 'quest', greet: 'Rifts are tearing open all over the city. GhostX needs every hunter we\'ve got. That means you.' },
  mina: { name: 'Dr. Mina', role: 'shop', shop: ['med_s', 'med_m', 'cell_s', 'cell_m', 'recall'],
    greet: 'Med packs, energy cells, recall beacons. Stay in one piece out there.' },
  terminal: { name: 'Mission Terminal', role: 'missions', greet: 'GHOSTX TACTICAL NETWORK · Select an operation.' },
  jin: { name: 'Tech Jin', role: 'shop', lab: true, shop: ['hoverboard', 'kevlar', 'nano_jacket', 'street_cap', 'tac_visor', 'combat_helm'],
    greet: 'Gear\'s on the rack, and the lab can overclock your nanobots. Want a new partner? Finish a requisition for me and I\'ll build one.' },
};

// Instanced wave missions from the Mission Terminal. Groups: [mobType, count, 'elite'|'ex'?].
// par = target clear time in seconds. post: requires the story to be finished.
export const MISSIONS = [
  { id: 'm1', name: 'Alley Outbreak', lv: 2, arena: 'arena_alley', par: 70,
    desc: 'Imps and glitch wisps are pouring out of a fresh tear. Hold the alley for three waves.',
    waves: [[['imp', 6]], [['imp', 4], ['wisp', 3]], [['wisp', 4], ['imp', 3], ['imp', 1, 'elite']]],
    reward: { exp: 110, gold: 200 } },
  { id: 'm2', name: 'Depot Lockdown', lv: 5, arena: 'arena_subway', par: 85,
    desc: 'A hellhound pack has the depot sealed. Break the lockdown.',
    waves: [[['hound', 4]], [['hound', 3], ['wisp', 4]], [['hound', 4], ['hound', 1, 'elite']]],
    reward: { exp: 400, gold: 450, items: [['cell_m', 0.5]] } },
  { id: 'm3', name: 'Rooftop Siege', lv: 8, arena: 'arena_rooftop', par: 100,
    desc: 'Specters and brutes are massing on the skyline. Hit them before they move.',
    waves: [[['specter', 4]], [['brute', 2], ['specter', 3]], [['specter', 4], ['brute', 1, 'elite']]],
    reward: { exp: 1200, gold: 950, items: [['med_m', 1]] } },
  { id: 'm4', name: 'Rift Breach', lv: 12, post: true, arena: 'arena_rift', par: 130,
    desc: 'Aftershocks from the core. Every demon type, elites included, in four waves.',
    waves: [[['imp', 4, 'elite'], ['wisp', 4]], [['hound', 4], ['specter', 3]], [['brute', 3], ['specter', 3, 'elite']], [['hound', 2, 'elite'], ['brute', 2, 'elite']]],
    reward: { exp: 3500, gold: 2400, items: [['med_m', 1], ['cell_m', 1]] } },
  { id: 'm5', name: 'Sovereign EX', lv: 18, post: true, arena: 'arena_rift', par: 180,
    desc: 'The Sovereign has reformed, stronger than before. Only the best hunters return from this.',
    waves: [[['sovereign', 1, 'ex']]],
    reward: { exp: 10000, gold: 7000, items: [['sovereign_crown', 0.5], ['sovereign_chip', 0.5]] } },
];

export const GRADES = [
  { name: 'S', score: 90, mult: 1.5, color: '#ffd24a' },
  { name: 'A', score: 75, mult: 1.2, color: '#6affa8' },
  { name: 'B', score: 55, mult: 1.0, color: '#5ae0ff' },
  { name: 'C', score: 0, mult: 0.8, color: '#9aa0b0' },
];

// Nanobot requisitions from Tech Jin: the only way to get new nanobots. One active at a time, one bot each.
// goal.mission = { id, grade } requires clearing that Mission Terminal operation at that grade or better.
// reward.pick = the species offered; you choose one you don't own yet.
export const BOT_QUESTS = [
  { id: 'n1', name: 'Field Test', lv: 2, goal: { kill: { imp: 8 } }, reward: { exp: 60, gold: 80, pick: ['kira', 'pip', 'lens', 'mote'] },
    offer: 'I\'ve got frames for the other starter bots, but I need combat data to calibrate them. Take down eight rift imps.',
    progress: 'Rift imps crawl around Neon Alley.', done: 'Good data. Pick a frame and I\'ll boot it up.' },
  { id: 'n2', name: 'Signal Hunt', lv: 4, goal: { collect: { glitch_shard: 6 } }, reward: { exp: 150, gold: 150, pick: ['kira', 'pip', 'lens', 'mote'] },
    offer: 'Glitch shards make great core buffers. Bring me six and I\'ll build you another one.',
    progress: 'Glitch wisps drop shards in Neon Alley and Line 9.', done: 'These will do. Which one do you want?' },
  { id: 'n3', name: 'Hound Parts', lv: 5, goal: { kill: { hound: 6 }, collect: { hound_fang: 4 } }, reward: { exp: 350, gold: 300, pick: ['razor', 'boomer', 'volt', 'aegis'] },
    offer: 'Hellhound fangs conduct rift energy. That means rare-grade frames. Six hounds, four fangs.',
    progress: 'Hellhounds prowl the Line 9 Depot.', done: 'Rare-grade parts. Choose your build.' },
  { id: 'n4', name: 'Depot Lockdown Data', lv: 6, goal: { mission: { id: 'm2', grade: 'B' } }, reward: { exp: 400, gold: 400, pick: ['razor', 'boomer', 'volt', 'aegis'] },
    offer: 'Run Depot Lockdown from the Mission Terminal and clear it with a B or better. I\'ll record the telemetry.',
    progress: 'Mission Terminal · Depot Lockdown · grade B or better.', done: 'Clean telemetry. Pick one.' },
  { id: 'n5', name: 'Shade Samples', lv: 7, goal: { collect: { shade_residue: 6 } }, reward: { exp: 700, gold: 600, pick: ['kira', 'pip', 'lens', 'mote', 'razor', 'boomer', 'volt', 'aegis'] },
    offer: 'Shade residue stabilizes nano-cores. Six vials, please.',
    progress: 'Shade specters haunt the Skyline Rooftops.', done: 'Stable cores. Any frame you like.' },
  { id: 'n6', name: 'Brute Force', lv: 9, goal: { kill: { brute: 6 } }, reward: { exp: 1100, gold: 900, pick: ['razor', 'boomer', 'volt', 'aegis'] },
    offer: 'Iron brutes have the densest plating in the city. Put down six.',
    progress: 'Iron brutes guard the rooftop floors.', done: 'Heavy-duty. Choose.' },
  { id: 'n7', name: 'Siege Protocol', lv: 11, goal: { mission: { id: 'm3', grade: 'A' } }, reward: { exp: 1800, gold: 1500, pick: ['oni', 'havoc', 'nyx', 'halo'] },
    offer: 'Epic-grade frames need elite telemetry. Clear Rooftop Siege with an A or better.',
    progress: 'Mission Terminal · Rooftop Siege · grade A or better.', done: 'Epic grade. You earned this one.' },
  { id: 'n8', name: 'The Core', lv: 12, goal: { collect: { sovereign_core: 1 } }, reward: { exp: 2500, gold: 2000, pick: ['oni', 'havoc', 'nyx', 'halo'] },
    offer: 'Bring me the Sovereign\'s core. I want to build something with it.',
    progress: 'The Rift Sovereign waits in the Rift Core.', done: 'It\'s still beating. Pick your epic.' },
  { id: 'n9', name: 'Breach Protocol', lv: 16, goal: { mission: { id: 'm4' } }, reward: { exp: 5000, gold: 3000, pick: ['oni', 'havoc', 'nyx', 'halo'] },
    offer: 'Clear Rift Breach. Any grade. I just need to know it can be done.',
    progress: 'Mission Terminal · Rift Breach.', done: 'You survived it. Choose.' },
  { id: 'n10', name: 'Sovereign Echo', lv: 20, goal: { mission: { id: 'm5' } }, reward: { exp: 9000, gold: 6000, pick: BOT_ORDER },
    offer: 'Sovereign EX. Beat it and I\'ll build whatever you want.',
    progress: 'Mission Terminal · Sovereign EX.', done: 'Unbelievable. Anything you want.' },
  { id: 'n11', name: 'Perfect Record', lv: 22, goal: { mission: { id: 'm4', grade: 'S' } }, reward: { exp: 12000, gold: 8000, pick: BOT_ORDER },
    offer: 'Last frame I\'ve got. Earn an S on Rift Breach.',
    progress: 'Mission Terminal · Rift Breach · grade S.', done: 'Flawless. The last frame is yours.' },
];

// Quests chain from Captain Yoon. goal.kill counts kills after accepting; goal.collect checks inventory.
export const QUESTS = [
  { id: 'q1', name: 'Street Sweep', lv: 1,
    goal: { kill: { imp: 10 } },
    reward: { exp: 90, gold: 120, items: [['street_cap', 1], ['med_s', 10]] },
    offer: 'Rift imps are crawling out of the dumpsters in Neon Alley. Clear out ten of them. Take the east gate.',
    progress: 'Neon Alley is through the east gate of Metro Central.',
    done: 'Clean work. Tech Jin has requisition orders for new nanobots. Talk to him when you want another partner.' },
  { id: 'q2', name: 'Glitch in the System', lv: 3,
    goal: { collect: { glitch_shard: 8 } },
    reward: { exp: 200, gold: 200, items: [['cell_s', 10], ['focus_chip', 1]] },
    offer: 'Those flickering wisps are corrupting the city grid. Bring me eight glitch shards so the lab can study them.',
    progress: 'Glitch wisps drift above the fire escapes in Neon Alley.',
    done: 'Perfect samples. The lab put together a focus chip for you. Slot it in.' },
  { id: 'q3', name: 'Hounds Below', lv: 5,
    goal: { kill: { hound: 8 }, collect: { hound_fang: 5 } },
    reward: { exp: 500, gold: 450, items: [['med_m', 10], ['cell_m', 5]] },
    offer: 'Hellhounds have nested in the Line 9 subway depot. Put down eight and bring five fangs as proof.',
    progress: 'Line 9 Depot is past Neon Alley. Watch for their charge.',
    done: 'Five fangs. The trains can run again. Take these elixirs. You\'ve earned them.' },
  { id: 'q4', name: 'Rooftop Purge', lv: 7,
    goal: { kill: { specter: 12, brute: 5 } },
    reward: { exp: 1300, gold: 900, items: [['reflex_chip', 1]] },
    offer: 'Specters and iron brutes hold the skyline. Take back the rooftops: twelve specters, five brutes.',
    progress: 'Skyline Rooftops are east of the Line 9 Depot.',
    done: 'The skyline is ours again. Slot this reflex chip. You\'ll need it for what comes next.' },
  { id: 'q5', name: 'Close the Rift', lv: 10,
    goal: { kill: { sovereign: 1 } },
    reward: { exp: 3500, gold: 3000, items: [['med_m', 20]] },
    offer: 'We found the source. The Rift Sovereign is holding the main rift open from the core beyond the rooftops. End it.',
    progress: 'The Rift Core is through the eastern gate of the Skyline Rooftops.',
    done: 'The rift is closing. You did it, hunter. Metro Central owes you everything.' },
];
