# GhostX Solo

A single-player, browser-based 2D side-scrolling action RPG inspired by **GhostX Ultimate** (GameKiss, 2011). You hunt rift demons across a neon city with **nanobots**. There are no classes: your active nanobot is your weapon and decides your moveset. All the art is drawn in code, so there are no asset files.

## Run

```bash
node server.js
```

Open http://localhost:8124. The game uses ES modules, so it needs to be served over HTTP.

## Controls

| Key | Action |
| --- | --- |
| ← → | Move |
| ↑ | Climb ladder · enter gate · talk |
| ↓ | Climb down · ↓ + jump drops through a platform |
| X / Alt / Space | Jump |
| Z / Ctrl | Attack (hold) |
| 1 2 3 | Swap active nanobot |
| A S D | Nanobot skills (unlock at nanobot Lv 1 / 4 / 8) |
| F | Nano Sync ultimate (needs a full Sync gauge) |
| Q / W | Med pack / energy cell |
| R | Hoverboard (buy from Tech Jin) |
| Tab | Next nanobot |
| P | Pause |
| N I C J O H | Nanobots, Inventory, Character, Story, Settings, Help |

On macOS, Ctrl+arrow can switch desktops, so use Z to attack.

**Gamepad** (standard mapping) is also supported: A jump · X attack · B/Y/RB skills · RT sync · LB next bot · LT med pack · right-stick click hoverboard · Back nanobots · Start pause.

## Systems

- **Nanobots:** there are 12 species in 4 types.
  - **Blade** (melee): a 3-hit combo, plus dash, ground slam and spin skills.
  - **Blaster** (short range): spread shots, plus scatter, grenade and overdrive skills.
  - **Sniper** (long range): piercing shots, plus rail shot, evasion shot and orbital strike skills.
  - **Medic** (support): orbs that heal you on hit, plus repair, barrier and drone swarm skills.
- **Evolution:** bots level up from kills and evolve at levels 6 and 12, which changes their name and look.
- **Fusion:** at Tech Jin's Nano Lab you can fuse a duplicate into a bot for +1★ (max 5★).
- **Personality:** each bot has one of four personalities (cheerful, grumpy, stoic, nervous) and comments in speech bubbles.
- **Collecting:** nanobot cores drop from demons, with rarer cores from tougher demons. Capsules are sold in the shop, and the Nanodex tracks which species you've found.
- **Combo meter:** consecutive hits climb through ranks D → C → B → A → S → SS → SSS for bonus EXP (up to +75%) and damage. Getting hit breaks the combo. Hits also fill the **Sync** gauge, and F spends it on an ultimate that hits every enemy on screen.
- **World:** Metro Central (hub) → Neon Alley → Line 9 Depot → Skyline Rooftops → The Rift Core, where you fight the Rift Sovereign boss.
- **Story:** a 5-mission chain from Captain Yoon that ends at the Rift Sovereign. Beating it plays an ending with your run stats and unlocks the post-game.
- **Mission Terminal** (east side of Metro Central): repeatable instanced wave operations, including gold-glowing **elite** demons. Each clear is graded **S/A/B/C** on time vs. par, damage taken and best combo, and the grade multiplies rewards (×0.8 to ×1.5). The post-game adds **Rift Breach** (4 elite-heavy waves) and **Sovereign EX** (Lv 20, about 3× HP and 1.7× damage).
- **Hoverboard:** 1.75× speed and a higher jump. Attacking, using a skill or taking a hit knocks you off.
- **Audio:** every sound effect is synthesized with WebAudio, and each zone has its own procedural music track, plus boss, mission and ending themes. You can set master, music and effects volume and turn screen shake on or off in Settings (O).
- **Game feel:** hitstop on crits and kills, screen shake, hit sparks and damage numbers.
- **Saving:** autosaves to `localStorage` under the key `ghostx-solo-save-v2`.

## Code map

| File | Purpose |
| --- | --- |
| `src/data.js` | All tuning: items, nanobots, skills, ranks, demons, maps, NPCs, missions |
| `src/bots.js` | Nanobot collection, leveling/evolution, swap, fusion, speech bubbles |
| `src/botart.js` | Procedural nanobot + weapon-form drawing |
| `src/player.js` | Movement, per-type attacks and skills, projectiles, combo meter, Sync |
| `src/mobs.js` | Demon AI, Rift Sovereign boss, loot and core drops |
| `src/world.js` | Map loading, gates, respawns |
| `src/missions.js` | Instanced wave missions, grading, rewards |
| `src/audio.js` | Synthesized SFX and step-sequenced music |
| `src/settings.js` | Volume / screen-shake preferences |
| `src/render.js` | Canvas drawing (city backgrounds, characters, effects) |
| `src/ui.js` | DOM HUD, combo meter, windows, Nano Lab, dialogs |

Debug: `G` holds all state in the console, and `__tick(seconds)` steps the simulation.

Balance: `tools/sim.js` runs an autopilot boss fight inside the real game loop:

```js
const { simFight } = await import('/tools/sim.js');
await simFight({ lv: 11, sp: 'razor', botLv: 12, gear: { head: 'combat_helm', body: 'nano_jacket', chip: 'focus_chip' } });
```

The autopilot dodges perfectly, so humans should expect fights to take roughly 2× as long. Current results: the story boss falls in about 30–60s at Lv 11, and Sovereign EX in about 60–70s at Lv 20–30.

## Publishing

The shareable build lives at https://claude.ai/artifact/4TWwpwDBVTZrvQCMDLWqT4 (share it from that page's Share menu).

```bash
node tools/build-artifact.js
```

This writes `dist/index.html`, which is the page without its document wrapper, because the Artifact host supplies its own. It also prints the `files` map (`style.css` + `src/*.js`) to publish alongside it. Saves live in each player's own browser (`localStorage`). The build declares no runtime capabilities on purpose: declaring `db`, which a shared leaderboard would need, makes an artifact organization-internal and blocks public links.
