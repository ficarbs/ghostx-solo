// On-screen touch controls: a floating joystick on the left, action buttons on the right.
// Controls live inside the 960x540 design space so they scale with the rest of the UI.
import { setVirtual } from './input.js';
import { settings } from './settings.js';
import { skillIcon } from './icons.js';

const BUTTONS = [
  { a: 'attack', cls: 'attack', label: 'ATK' },
  { a: 'jump', cls: 'jump', label: 'JUMP' },
  { a: 'dodge', cls: 'dodge', label: 'DODGE' },
  { a: 'skill1', cls: 'sk sk1', label: 'A' },
  { a: 'skill2', cls: 'sk sk2', label: 'S' },
  { a: 'skill3', cls: 'sk sk3', label: 'D' },
  { a: 'skill4', cls: 'sk sk4', label: 'F' },
  { a: 'swapnext', cls: 'mini swap', label: '⇄' },
  { a: 'hp', cls: 'mini hp', label: '+HP' },
  { a: 'mp', cls: 'mini mp', label: '+EN' },
  { a: 'mount', cls: 'mini mount', label: 'RIDE' },
  { a: 'pause', cls: 'mini pause', label: 'II' },
];

let root, stick, knob, getScale;
let stickId = null, origin = null, stickShift = { x: 0, y: 0 };
const DEAD_X = 16, DEAD_Y = 26, RADIUS = 60;

export const isTouchDevice = () => (window.matchMedia && matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0;

export function touchEnabled() {
  return settings.touch === 'on' || (settings.touch !== 'off' && isTouchDevice());
}

export function initTouch(ui, scaleFn) {
  getScale = scaleFn;
  root = document.createElement('div');
  root.id = 'touch';
  root.innerHTML = `<div id="stick-zone"><div id="stick"><div class="knob"></div></div></div>` +
    BUTTONS.map((b) => `<button class="tb ${b.cls}" data-a="${b.a}"><span>${b.label}</span></button>`).join('');
  ui.appendChild(root);
  stick = root.querySelector('#stick');
  knob = stick.querySelector('.knob');

  for (const btn of root.querySelectorAll('.tb')) {
    // The attack button turns into Talk / Enter next to a character or gate.
    const actionOf = () => (btn.dataset.a === 'attack' && atkMode ? 'interact' : btn.dataset.a);
    let a = btn.dataset.a;
    const down = (e) => {
      e.preventDefault();
      capture(btn, e);
      btn.classList.add('on');
      a = actionOf();
      setVirtual(a, true);
    };
    const up = (e) => {
      e.preventDefault();
      btn.classList.remove('on');
      setVirtual(a, false);
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('lostpointercapture', up);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  const zone = root.querySelector('#stick-zone');
  zone.addEventListener('pointerdown', (e) => {
    if (stickId !== null) return;
    e.preventDefault();
    stickId = e.pointerId;
    capture(zone, e);
    const r = zone.getBoundingClientRect();
    const s = getScale();
    origin = { x: e.clientX, y: e.clientY };
    // Keep the ring fully on screen; the knob is still measured from where the finger landed.
    const fx = (e.clientX - r.left) / s, fy = (e.clientY - r.top) / s;
    const cx = Math.max(RADIUS + 4, Math.min(zone.offsetWidth - RADIUS - 4, fx));
    const cy = Math.max(RADIUS + 4, Math.min(zone.offsetHeight - RADIUS - 4, fy));
    stickShift = { x: fx - cx, y: fy - cy };
    stick.style.left = cx + 'px';
    stick.style.top = cy + 'px';
    stick.classList.add('active');
    moveStick(e);
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickId) moveStick(e);
  });
  const release = (e) => {
    if (e.pointerId === stickId) releaseStick();
  };
  zone.addEventListener('pointerup', release);
  zone.addEventListener('pointercancel', release);
  zone.addEventListener('lostpointercapture', release);
  // The lift can land outside the zone, or iOS can swallow it (screen edges, overlays, map
  // changes), which would leave a direction held. Listen page-wide as a backstop.
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  const allUp = (e) => {
    if (e.touches.length === 0) releaseAll();
  };
  window.addEventListener('touchend', allUp);
  window.addEventListener('touchcancel', allUp);
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => document.hidden && releaseAll());
  applyTouchMode();
}

function releaseStick() {
  stickId = null;
  stick.classList.remove('active');
  knob.style.transform = '';
  for (const a of ['left', 'right', 'up', 'down']) setVirtual(a, false);
}

// No finger on the screen: nothing may stay held.
function releaseAll() {
  if (!root) return;
  releaseStick();
  for (const btn of root.querySelectorAll('.tb')) btn.classList.remove('on');
  for (const b of BUTTONS) setVirtual(b.a, false);
  setVirtual('interact', false);
}

// Capture keeps a drag tracked when the finger slides off the control. It can throw for
// pointers the browser doesn't consider active, which must never block the input itself.
function capture(el, e) {
  try {
    el.setPointerCapture(e.pointerId);
  } catch {
    /* not capturable */
  }
}

function moveStick(e) {
  const s = getScale();
  let dx = (e.clientX - origin.x) / s, dy = (e.clientY - origin.y) / s;
  const len = Math.hypot(dx, dy);
  const kx = dx + stickShift.x, ky = dy + stickShift.y, klen = Math.hypot(kx, ky);
  const k = klen > RADIUS ? RADIUS / klen : 1;
  knob.style.transform = `translate(${kx * k}px, ${ky * k}px)`;
  if (len > RADIUS) {
    dx = (dx / len) * RADIUS;
    dy = (dy / len) * RADIUS;
  }
  setVirtual('left', dx < -DEAD_X);
  setVirtual('right', dx > DEAD_X);
  setVirtual('up', dy < -DEAD_Y);
  // Down must be the main direction, so running with a slight downward tilt never drops you.
  setVirtual('down', dy > DEAD_Y && dy > Math.abs(dx) * 0.7);
}

let atkMode = null;
export function setAttackMode(mode) {
  if (!root || mode === atkMode) return;
  atkMode = mode;
  const btn = root.querySelector('.tb.attack');
  btn.querySelector('span').textContent = mode === 'talk' ? 'TALK' : mode === 'enter' ? 'ENTER' : 'ATK';
  btn.classList.toggle('talk', !!mode);
}

export function applyTouchMode() {
  document.body.classList.toggle('touch', touchEnabled());
}

// Mirror the active nanobot's skill icons onto the touch skill buttons.
export function refreshTouchSkills(skills, color) {
  if (!root) return;
  skills.forEach((sk, i) => {
    const b = root.querySelector(`.sk${i + 1}`);
    if (b) b.style.backgroundImage = `url(${skillIcon(sk.id, color).url})`;
  });
  const f = root.querySelector('.sk4');
  if (f) f.style.backgroundImage = `url(${skillIcon('sync', '#ffe27a').url})`;
}
