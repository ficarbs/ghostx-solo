// Procedural audio: synthesized sound effects and a small step-sequencer for per-zone music.
// Everything is generated with WebAudio, so there are no audio files.

let ac = null;
let master, musicBus, sfxBus, noiseBuf;
const settings = { master: 0.7, music: 0.5, sfx: 0.8 };
const lastPlayed = new Map();

export function initAudio() {
  if (ac) {
    if (ac.state === 'suspended') ac.resume();
    return;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  ac = new Ctx();
  master = ac.createGain();
  musicBus = ac.createGain();
  sfxBus = ac.createGain();
  musicBus.connect(master);
  sfxBus.connect(master);
  master.connect(ac.destination);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVolumes();
}

export function setVolumes(v) {
  Object.assign(settings, v);
  applyVolumes();
}

function applyVolumes() {
  if (!ac) return;
  master.gain.value = settings.master;
  musicBus.gain.value = settings.music * 0.35;
  sfxBus.gain.value = settings.sfx * 0.6;
}

// ---------- Synth primitives ----------

function tone(type, f0, f1, dur, vol = 0.3, when = 0, bus = sfxBus) {
  const t = ac.currentTime + when;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(bus);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, vol = 0.3, filter = 'highpass', freq = 1000, when = 0, freqEnd, bus = sfxBus) {
  const t = ac.currentTime + when;
  const s = ac.createBufferSource();
  s.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(freq, t);
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f);
  f.connect(g);
  g.connect(bus);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.02);
}

const SFX = {
  slash: () => { noise(0.12, 0.35, 'bandpass', 3000, 0, 900); tone('triangle', 900, 300, 0.08, 0.08); },
  slash3: () => { noise(0.18, 0.45, 'bandpass', 2400, 0, 600); tone('sawtooth', 500, 120, 0.15, 0.08); },
  shoot: () => { tone('square', 900, 260, 0.08, 0.12); noise(0.05, 0.15, 'highpass', 3000); },
  snipe: () => { tone('sawtooth', 1800, 120, 0.22, 0.14); noise(0.15, 0.3, 'bandpass', 1800, 0, 400); },
  orb: () => { tone('sine', 400, 900, 0.12, 0.18); },
  hit: () => { noise(0.08, 0.35, 'lowpass', 2200, 0, 300); tone('square', 180, 70, 0.06, 0.12); },
  crit: () => { noise(0.12, 0.5, 'lowpass', 4000, 0, 400); tone('square', 300, 60, 0.12, 0.18); tone('sine', 1400, 1800, 0.08, 0.08); },
  kill: () => { tone('square', 520, 80, 0.2, 0.12); noise(0.2, 0.25, 'lowpass', 1500, 0, 200); },
  hurt: () => { tone('sawtooth', 220, 70, 0.22, 0.22); noise(0.1, 0.25, 'lowpass', 900); },
  block: () => { tone('triangle', 1200, 1500, 0.1, 0.15); },
  jump: () => { tone('sine', 260, 520, 0.1, 0.1); },
  pickup: () => { tone('square', 660, 660, 0.05, 0.08); tone('square', 990, 990, 0.07, 0.08, 0.05); },
  coin: () => { tone('triangle', 1400, 1400, 0.04, 0.08); tone('triangle', 2100, 2100, 0.06, 0.07, 0.04); },
  core: () => [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.12, 0.12, i * 0.06)),
  levelup: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone('square', f, f, 0.14, 0.1, i * 0.07)),
  evolve: () => { [392, 523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone('triangle', f, f, 0.2, 0.12, i * 0.08)); noise(0.8, 0.12, 'highpass', 4000, 0.3); },
  swap: () => { tone('sine', 300, 1200, 0.12, 0.12); tone('triangle', 1200, 1600, 0.05, 0.06, 0.1); },
  explode: () => { noise(0.5, 0.6, 'lowpass', 1200, 0, 80); tone('sine', 120, 40, 0.4, 0.3); },
  portal: () => { tone('sine', 200, 1200, 0.4, 0.15); noise(0.4, 0.1, 'bandpass', 2000, 0, 6000); },
  rank: () => { tone('triangle', 1047, 1047, 0.1, 0.1); tone('triangle', 1568, 1568, 0.18, 0.1, 0.08); },
  sync: () => { tone('sawtooth', 110, 880, 0.9, 0.18); noise(1.0, 0.25, 'bandpass', 400, 0, 5000); },
  zap: () => { tone('sawtooth', 1500, 300, 0.1, 0.07); },
  heal: () => [523, 784, 1047].forEach((f, i) => tone('sine', f, f, 0.2, 0.12, i * 0.05)),
  shield: () => { tone('sine', 300, 600, 0.3, 0.14); tone('sine', 450, 900, 0.3, 0.08); },
  dash: () => { noise(0.2, 0.3, 'bandpass', 600, 0, 3000); },
  slam: () => { noise(0.35, 0.55, 'lowpass', 800, 0, 60); tone('sine', 90, 35, 0.35, 0.35); },
  boss_roar: () => { tone('sawtooth', 90, 45, 0.9, 0.3); noise(0.9, 0.3, 'lowpass', 500, 0, 120); },
  boss_fire: () => { tone('square', 300, 900, 0.2, 0.1); noise(0.2, 0.2, 'bandpass', 1500); },
  warn: () => { tone('square', 880, 880, 0.08, 0.08); tone('square', 880, 880, 0.08, 0.08, 0.14); },
  enemy_shot: () => { tone('sine', 700, 300, 0.15, 0.08); },
  mount: () => { tone('sawtooth', 80, 240, 0.35, 0.12); noise(0.3, 0.12, 'bandpass', 800, 0, 2400); },
  ui: () => { tone('triangle', 900, 900, 0.03, 0.06); },
  buy: () => { tone('triangle', 1200, 1200, 0.05, 0.08); tone('triangle', 1800, 1800, 0.08, 0.08, 0.05); },
  death: () => [392, 349, 311, 262].forEach((f, i) => tone('triangle', f, f * 0.98, 0.3, 0.14, i * 0.22)),
  victory: () => [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone('square', f, f, i === 5 ? 0.6 : 0.16, 0.1, i * 0.13)),
  wave: () => { tone('sawtooth', 220, 440, 0.25, 0.1); tone('sawtooth', 330, 660, 0.25, 0.08, 0.05); },
};

export function sfx(name) {
  if (!ac || ac.state !== 'running' || !SFX[name]) return;
  const now = performance.now();
  if (now - (lastPlayed.get(name) || 0) < 35) return;
  lastPlayed.set(name, now);
  SFX[name]();
}

// ---------- Music ----------
// Each track: tempo, root (MIDI), minor-scale chord progression (scale degrees), and layer toggles.
const TRACKS = {
  plaza: { bpm: 92, root: 50, prog: [0, 5, 3, 4], lead: true, drums: 1 },
  alley: { bpm: 112, root: 45, prog: [0, 0, 5, 6], lead: true, drums: 2 },
  subway: { bpm: 120, root: 43, prog: [0, 3, 0, 4], lead: false, drums: 2 },
  rooftop: { bpm: 128, root: 47, prog: [0, 5, 2, 6], lead: true, drums: 3 },
  rift: { bpm: 142, root: 41, prog: [0, 1, 0, 6], lead: true, drums: 3, boss: true },
  mission: { bpm: 134, root: 44, prog: [0, 6, 5, 4], lead: true, drums: 3 },
  ending: { bpm: 84, root: 52, prog: [0, 5, 2, 4], lead: true, drums: 0 },
  mirror: { bpm: 118, root: 49, prog: [0, 2, 5, 4], lead: true, drums: 2 },
  abyss: { bpm: 104, root: 40, prog: [0, 1, 0, 5], lead: false, drums: 2 },
  throne: { bpm: 150, root: 42, prog: [0, 6, 1, 5], lead: true, drums: 3, boss: true },
  rival: { bpm: 146, root: 46, prog: [0, 3, 6, 5], lead: true, drums: 3 },
  academy: { bpm: 110, root: 48, prog: [0, 4, 5, 3], lead: true, drums: 2 },
  skyrail: { bpm: 126, root: 51, prog: [0, 5, 6, 4], lead: true, drums: 3 },
  zero: { bpm: 156, root: 45, prog: [0, 1, 6, 5], lead: true, drums: 3, boss: true },
  tower: { bpm: 138, root: 43, prog: [0, 6, 4, 5], lead: true, drums: 3 },
  scene: { bpm: 72, root: 50, prog: [0, 5, 3, 4], lead: false, drums: 0 },
};
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

let track = null;
let step = 0;
let nextTime = 0;
let timer = null;
let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

export function playMusic(name) {
  if (!ac) return;
  const t = TRACKS[name] || TRACKS.plaza;
  if (track === t) return;
  track = t;
  step = 0;
  seed = name.length * 977 + 13;
  nextTime = ac.currentTime + 0.1;
  if (!timer) timer = setInterval(schedule, 50);
}

export function stopMusic() {
  track = null;
}

function note(freq, when, dur, type, vol) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(vol, when + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o.connect(g);
  g.connect(musicBus);
  o.start(when);
  o.stop(when + dur + 0.05);
}

function drum(kind, when) {
  if (kind === 'kick') {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.frequency.setValueAtTime(140, when);
    o.frequency.exponentialRampToValueAtTime(40, when + 0.15);
    g.gain.setValueAtTime(0.5, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.18);
    o.connect(g);
    g.connect(musicBus);
    o.start(when);
    o.stop(when + 0.2);
  } else {
    const s = ac.createBufferSource();
    s.buffer = noiseBuf;
    const f = ac.createBiquadFilter();
    f.type = kind === 'hat' ? 'highpass' : 'bandpass';
    f.frequency.value = kind === 'hat' ? 7000 : 1800;
    const g = ac.createGain();
    const len = kind === 'hat' ? 0.04 : 0.14;
    g.gain.setValueAtTime(kind === 'hat' ? 0.12 : 0.3, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + len);
    s.connect(f);
    f.connect(g);
    g.connect(musicBus);
    s.start(when, Math.random() * 0.5);
    s.stop(when + len + 0.02);
  }
}

// Look-ahead scheduler: 16th-note steps, 4 bars per chord cycle.
function schedule() {
  if (!track || !ac) return;
  const spb = 60 / track.bpm / 4;
  while (nextTime < ac.currentTime + 0.15) {
    const s = step % 64;
    const chordDeg = track.prog[Math.floor(s / 16)];
    const deg = (d) => track.root + MINOR[((chordDeg + d) % 7 + 7) % 7] + 12 * Math.floor((chordDeg + d) / 7);
    const beat = s % 16;
    // Bass: root on 8ths with an octave hop
    if (beat % 2 === 0) note(midi(deg(0) - 12 + (beat % 8 === 6 ? 12 : 0)), nextTime, spb * 1.8, 'sawtooth', 0.09);
    // Pad: triad at the start of each chord
    if (beat === 0) for (const d of [0, 2, 4]) note(midi(deg(d) + 12), nextTime, spb * 15, 'triangle', 0.05);
    // Lead: sparse arpeggio
    if (track.lead && (beat === 0 || beat === 3 || beat === 6 || beat === 10 || beat === 12) && rnd() < 0.8) {
      note(midi(deg([0, 2, 4, 6][Math.floor(rnd() * 4)]) + 24), nextTime, spb * 2, 'square', 0.035);
    }
    // Drums
    if (track.drums >= 1 && beat % 8 === 0) drum('kick', nextTime);
    if (track.drums >= 2 && beat % 8 === 4) drum('snare', nextTime);
    if (track.drums >= 2 && beat % 2 === 0) drum('hat', nextTime);
    if (track.drums >= 3 && (beat === 10 || beat === 14)) drum('kick', nextTime);
    nextTime += spb;
    step++;
  }
}
