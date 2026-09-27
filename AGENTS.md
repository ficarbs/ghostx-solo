# Agent notes

Read `README.md` first: it lists every game system, the file map, the debug hooks and the balance harness. This file covers how to work on the code.

## Run and check

- `node server.js`, then open http://localhost:8124. Plain ES modules with no bundler, no npm install and no dependencies.
- There is no test suite. Verify changes in a browser. The dev console exposes the game state:
  - `const { G } = await import('/src/state.js')` gives you all state (player, map, mobs, boss).
  - `__tick(seconds)` steps the simulation deterministically, so it works even while the tab is hidden.
  - Modules are cached, so reload the page after editing a file.
- For boss balance, use `simFight` from `tools/sim.js`. The arenas are `rift`, `duel`, `throne` and `zero`, plus `ex: true` for Sovereign EX.
- Test on a phone-sized viewport as well (landscape, e.g. 844×390). Touch controls turn on automatically on touch devices.

## Architecture rules

- **Design space.** Everything is laid out in a fixed design space `VIEW_W × 540`. VIEW_W is a live binding that ranges from 960 to 1280 depending on aspect ratio. The whole `#game` element is scaled with a CSS transform. Never use viewport units inside the game.
- **Pixel art.** The world renders into a half-resolution buffer (`PX = 2`) and is upscaled with nearest-neighbour.
  - Characters are baked into sprites with `bake(key, box, draw)` in `src/pixel.js`, then drawn with `blit`.
  - Draw text through `later()`, so it lands in the crisp screen-space pass.
- **UI.** The UI is a DOM overlay (`src/ui.js`) and windows are registered in `WINDOWS`.
  - `--wz` is the UI zoom: 1.25 on touch, where `body.touch` is set.
  - `keepOnScreen()` keeps windows above the HUD.
  - Windows must scroll inside `.win-body`, never the page.
- **Input.** Keyboard, gamepad and touch all feed the same actions in `src/input.js`. Touch uses `setVirtual(action, bool)`.
  - The touch ATK button becomes TALK or ENTER through `interactTarget()`.
  - That swap is suppressed mid-fight (an alerted demon nearby or a boss alive), so knockback can't send the player through a gate.
- **Content.** All content lives in `src/data.js`: items, bots, mobs, maps, NPCs, quests and missions. The Act 2 and Act 3 blocks are appended at the end.
  - Quest chains live in `CHAINS` (`src/quests.js`).
  - Gates and bosses are gated by `conditionMet(key)`.
  - Cutscenes are defined in `SCENES` (`src/cutscene.js`) and each plays once per save.
- **Tower and mission mobs.** Mobs spawned by the Rift Tower carry `tower: true`. They must never call `onKill` or advance the story, so keep that guard when you touch spawning.
- **Saves.** Saves use the localStorage key `ghostx-solo-save-v2` and settings use `ghostx-solo-settings`. If you add a field to the player, default it on load in `src/save.js` so old saves keep working.
- **No blocking browser dialogs.** Never use `alert`, `confirm` or `prompt`, because the claude.ai artifact host blocks them. Use `askConfirm()` from `src/ui.js`.

## Style

- Vanilla JS, 2-space indentation, single quotes and semicolons, all matching the existing code.
- Keep comments short and only where the intent isn't obvious.
- All art and audio are generated in code. Don't add asset files (the only exception is the home-screen icons in `icons/`).
- Update `README.md` when you add or change a player-facing system, and keep the How to Play window (`helpHTML()` in `src/ui.js`) short.

## Shipping

- `node tools/build-artifact.js` writes `dist/index.html` (gitignored) for the claude.ai artifact. Only Claude can publish to that link.
- The live game is on GitHub Pages at https://ficarbs.github.io/ghostx-solo/. Every push to `main` redeploys it straight from the repo root, with no build step, so only push `main` once the game runs cleanly.
- Asset paths must stay relative (`src/main.js`, not `/src/main.js`), because the site is served from the `/ghostx-solo/` subpath.
- Commit in small, descriptive steps.
