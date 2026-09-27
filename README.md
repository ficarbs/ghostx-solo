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
| Shift / V | Dodge-roll (air dash when airborne) |
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

**Gamepad** (standard mapping) is also supported: A jump · X attack · B dodge · Y/LB/RB skills · RT sync · LT next bot · left-stick click med pack · right-stick click hoverboard · Back nanobots · Start pause.

## Systems

- **Nanobots:** there are 12 species in 4 types.
  - **Blade** (melee): a 3-hit combo, plus dash, ground slam and spin skills.
  - **Blaster** (short range): spread shots, plus scatter, grenade and overdrive skills.
  - **Sniper** (long range): piercing shots, plus rail shot, evasion shot and orbital strike skills.
  - **Medic** (support): orbs that heal you on hit, plus repair, barrier and drone swarm skills.
- **Mythic nanobots:** four Mythic-rarity bots (Eclipse, Nova, Phantom, Genesis) come from Act 2 requisitions. The Nanodex now has 16 species.
- **Starter choice:** a new game begins by choosing your first nanobot from the four commons: Kira (Blade), Pip (Blaster), Lens (Sniper) or Mote (Medic).
- **Requisitions:** Tech Jin's requisition quests are the only source of new nanobots. There are 11, offered one at a time and gated by level. Each gives exactly one bot, and you pick which from its offer list. Later requisitions require Mission Terminal clears at a set grade.
- **Evolution:** bots level up from kills and evolve at levels 6 and 12, which changes their name and look.
- **Branch evolution:** at its final form (nanobot Lv 12) each bot specializes into one of two branches for its type:
  - Blade: Ronin (crits) or Tempest (skill cooldowns).
  - Blaster: Artillery (grenade) or Gatling (fire rate).
  - Sniper: Deadeye (crit, Rail Shot) or Railgun (pierce).
  - Medic: Seraph (healing) or Warden (barrier, drones).

  You can re-spec at the Nano Lab for 1000 cr.
- **Overclock:** at Tech Jin's Nano Lab you can spend credits plus demon loot to add +1★ (+10% power, max 5★). The last star also needs the Sovereign Core.
- **Personality:** each bot has one of four personalities (cheerful, grumpy, stoic, nervous) and comments in speech bubbles.
- **Nanodex:** tracks which of the 12 species you've collected.
- **Combo meter:** consecutive hits climb through ranks D → C → B → A → S → SS → SSS for bonus EXP (up to +75%) and damage. Getting hit breaks the combo. Hits also fill the **Sync** gauge, and F spends it on an ultimate that hits every enemy on screen.
- **World:**
  - Act 1: Metro Central (hub) → Neon Alley → Line 9 Depot → Skyline Rooftops → The Rift Core (Rift Sovereign).
  - Act 2: The Rift Core's east gate → Shattered Mirror District (Lv 12–16) → the Glasshouse Rooftop duel with Rei → The Abyss Line (Lv 16–20) → Throne of Echoes (The Hollow Queen, Lv 22).
  - Gates with red bars are sealed until the story opens them.
- **Story:** 10 quests from Captain Yoon across two acts, with cutscenes at key beats (letterboxed, pixel portraits, typewriter text, skippable). Each act ends with an ending screen and new unlocks.
- **Rival:** Rei, an ex-GhostX hunter, duels you with a 3-hit slash combo, a dash strike, ground waves (jump them), and dodges of her own.
- **The Hollow Queen:** the final boss. She uses row-sweeping void beams (change height or dodge), a gravity pull into a shockwave, shard rain, and mirror-wraith clones, adding a shard nova below 25% HP.
- **Side quests:** Grandma Soon (Metro Central), Little Min (Neon Alley) and Conductor Park (Line 9, later the Mirror District) give 6 side quests, with quest-only drops and exclusive cosmetic rewards.
- **Act 2 demons:**
  - Mirror Wraiths fire 3-way shards and blink.
  - Glass Stalkers teleport behind you and lunge.
  - Echo Swarms dive.
  - Void Maws inhale you, then bite.
- **Mission Terminal** (east side of Metro Central): repeatable instanced wave operations, including gold-glowing **elite** demons. Each clear is graded **S/A/B/C** on time vs. par, damage taken and best combo, and the grade multiplies rewards (×0.8 to ×1.5). The post-game adds **Rift Breach** (4 elite-heavy waves) and **Sovereign EX** (Lv 20, about 3× HP and 1.7× damage).
- **Hoverboard:** 1.75× speed and a higher jump. Attacking, using a skill or taking a hit knocks you off.
- **Audio:** every sound effect is synthesized with WebAudio, and each zone has its own procedural music track, plus boss, mission and ending themes. You can set master, music and effects volume and turn screen shake on or off in Settings (O).
- **Workshop** (Tech Jin):
  - **Slot Tuning:** tunes each gear slot from +1 to +10 (head/body: DEF+HP, chip: STR+DEX) with credits and demon loot. From +4 up a tune can fail, spending the cost but never lowering the level. Tuning stays with the slot when you change gear.
  - **Fabricator:** crafts potions, 60-second battle buffs (Overdrive Stim +25% damage, Ward Patch −25% damage taken), and four craft-only gear pieces.
- **Wardrobe** (Dr. Mina): cosmetic hair, jacket and accessory options with a live preview. Some are bought; others are earned by clearing the story, getting S on the first three missions, completing the Nanodex, or reaching an SSS combo.
- **Touch interaction:** next to a character the ATK button becomes **TALK**, and at a gate it becomes **ENTER**. Keyboard players can also press Enter.
- **Dodging:** a ground roll and a once-per-jump air dash, both with brief invulnerability. A dodge can cancel a basic attack, Cyclone Edge, Overdrive or Ground Breaker's recovery, and skills can cancel the tail of a dodge. Dodging a real attack at the last instant (a projectile, charge, pounce, dive, lunge, sweep or shockwave) triggers a **Perfect**: slow-motion, +15 Sync, and +30% damage for 1.5s.
- **Swap Strike:** swapping nanobots within 0.6s of landing a hit makes the incoming bot fire a free type-specific attack, so combos can chain across swaps.
- **Enemy AI:** attacks are telegraphed with a red **!**. Imps pounce, hellhounds charge, brutes raise a fist and send a shockwave along the platform (jump it), glitch wisps swoop, and specters shoot and blink away when you get close. Hitting one demon pulls in its neighbours, demons spread out instead of stacking, and brutes barely flinch.
- **Game feel:** hitstop on crits and kills, screen shake, hit sparks and damage numbers.
- **Pixel art:** the world renders at half resolution and is upscaled with hard edges. Characters, demons, NPCs and nanobots are baked from their vector designs into cached, outlined pixel sprites (`src/pixel.js`). Text draws crisp on top in pixel fonts (Pixelify Sans, Press Start 2P).
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
| `src/workshop.js` | Slot tuning, fabricator, branch evolution, cosmetic unlocks |
| `src/cutscene.js` | Story scenes and the cutscene player |
| `src/touch.js` | On-screen joystick and buttons (context-sensitive Talk/Enter) |
| `src/pixel.js` | Pixel-art sprite baking helpers |
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
