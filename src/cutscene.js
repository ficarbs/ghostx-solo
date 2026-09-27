// Story cutscenes: letterboxed dialogue with pixel portraits and typewriter text.
// Each scene plays once per save (tracked in player.scenes). Tap / click / Z / X / Enter advances; Skip ends it.
import { G } from './state.js';
import { NPCS } from './data.js';
import * as input from './input.js';
import { drawPortrait } from './render.js';
import { sfx, playMusic } from './audio.js';

const NAMES = { rei: 'Rei', queen: 'The Hollow Queen', bot: 'Your nanobot' };

// [speaker, line]. Speaker is an NPC id, 'player', 'rei', 'queen', or 'bot'.
export const SCENES = {
  act2_intro: [
    ['captain', 'Hunter. Good work out there. But the readings are wrong.'],
    ['jin', 'The rift didn\'t close. It folded over, like a mirror. There\'s a whole district on the other side.'],
    ['captain', 'A copy of our city, full of new demons. And someone was already in there before us.'],
    ['rei', '...Took you long enough, GhostX.'],
    ['player', 'Who is that?'],
    ['captain', 'Rei. She used to be one of ours. Come see me when you\'re ready. The east gate of the Rift Core is open now.'],
  ],
  mirror_enter: [
    ['bot', 'Everything\'s... backwards. Even the neon.'],
    ['player', 'Stay close. Something\'s watching from the glass.'],
  ],
  rival_pre: [
    ['rei', 'So GhostX finally sent someone who can actually fight.'],
    ['player', 'Captain Yoon says you\'re blocking the way east.'],
    ['rei', 'I\'m keeping amateurs from walking into the Queen\'s throne room. Show me you\'re not one.'],
    ['rei', 'Blade up, hunter.'],
  ],
  rival_post: [
    ['rei', '...Okay. You\'re not an amateur.'],
    ['rei', 'There\'s a Queen at the end of the Abyss Line. The Sovereign was guarding her, not the rift.'],
    ['player', 'Then help us.'],
    ['rei', 'I work alone. But the way east is open. Tell Yoon I said hi.'],
  ],
  abyss_enter: [
    ['bot', 'I don\'t like this. There\'s no floor under the floor.'],
    ['player', 'Then we don\'t fall.'],
  ],
  queen_pre: [
    ['queen', 'A little light, walking into the dark.'],
    ['queen', 'The Sovereign was my door. You broke it. So I will make you my new one.'],
    ['bot', 'Hunter... her readings are off every scale I have.'],
    ['player', 'Then we go past the scale. Together.'],
  ],
  act3_intro: [
    ['jin', 'Captain... the Queen\'s echo. It\'s not at the throne anymore.'],
    ['captain', 'Then where is it?'],
    ['jin', 'In Rei. She walked into the throne room after the fight and took it. Her signal is... hollow.'],
    ['bot', 'She saved us in the Mirror District. Why would she...'],
    ['captain', 'We bring her back, hunter. Not down. Back. Start at the old GhostX Academy, through the throne\'s back wall.'],
  ],
  academy_enter: [
    ['bot', 'This is where GhostX trained its first hunters. The drones here... they used to be like me.'],
    ['player', 'Then we set them free too.'],
  ],
  skyrail_enter: [
    ['rei', 'You followed me all the way out here? Go home, GhostX.'],
    ['player', 'Not without you.'],
  ],
  zero_pre: [
    ['rei', 'Do you hear it? The echo is so quiet in here. No rifts. No demons. Nothing.'],
    ['player', 'That\'s not quiet, Rei. That\'s empty.'],
    ['rei', 'Then let me show you how strong empty is.'],
    ['bot', 'Hunter, her power readings are higher than the Queen\'s!'],
    ['player', 'Then we hit harder. Together.'],
  ],
  zero_post: [
    ['rei', '...GhostX? Why are you... everything is so loud again.'],
    ['player', 'That\'s what being alive sounds like.'],
    ['rei', 'Tch. Don\'t get sentimental. ...Thanks, hunter.'],
    ['captain', 'All readings normal. Every rift, every echo. It\'s finally over.'],
    ['bot', 'Best. Team. Ever.'],
  ],
  queen_post: [
    ['queen', 'Every mirror... cracks...'],
    ['rei', 'Not bad, GhostX. Not bad at all.'],
    ['captain', 'All rifts reading zero. Both sides of the mirror. You did it, hunter.'],
    ['bot', 'We did it!'],
  ],
};

let active = null;

export const cutsceneActive = () => !!active;

export function playScene(id, onDone) {
  const p = G.player;
  if (!p || !SCENES[id] || p.scenes?.[id]) return onDone?.();
  p.scenes = p.scenes || {};
  p.scenes[id] = true;
  active = { lines: SCENES[id], i: -1, shown: 0, onDone };
  G.cutscene = true;
  playMusic('scene');
  const el = document.getElementById('cutscene');
  el.classList.remove('hidden');
  el.onclick = (e) => {
    if (e.target.closest('.cs-skip')) return end();
    advance();
  };
  el.querySelector('.cs-skip').onclick = (e) => {
    e.stopPropagation();
    end();
  };
  next();
}

function next() {
  active.i++;
  if (active.i >= active.lines.length) return end();
  const [who, text] = active.lines[active.i];
  active.text = text;
  active.shown = 0;
  const el = document.getElementById('cutscene');
  el.querySelector('.cs-name').textContent = who === 'player' ? G.player.name : NPCS[who]?.name || NAMES[who] || who;
  el.querySelector('.cs-text').textContent = '';
  drawPortrait(el.querySelector('.cs-portrait'), who);
  sfx('ui');
}

// First press finishes the typewriter; the next goes to the next line.
function advance() {
  if (!active) return;
  if (active.shown < active.text.length) active.shown = active.text.length;
  else next();
}

function end() {
  const done = active?.onDone;
  active = null;
  G.cutscene = false;
  document.getElementById('cutscene').classList.add('hidden');
  playMusic(G.map.def.music || G.map.def.theme);
  G.hooks.save?.();
  done?.();
}

export function frameCutscene(dt) {
  if (!active) return;
  if (['attack', 'jump', 'interact'].some((a) => input.wasPressed(a))) advance();
  if (input.wasPressed('esc')) return end();
  if (!active) return;
  if (active.shown < active.text.length) {
    active.shown = Math.min(active.text.length, active.shown + dt * 55);
    document.querySelector('#cutscene .cs-text').textContent = active.text.slice(0, Math.floor(active.shown));
  }
}
