// On-screen touch controls: a floating joystick on the left, action buttons on the right.
// Controls live inside the 960x540 design space so they scale with the rest of the UI.
import { setVirtual } from './input.js';
import { settings } from './settings.js';
import { skillIcon } from './icons.js';

const BUTTONS = [
  { a: 'attack', cls: 'attack', label: 'ATK' },
  { a: 'jump', cls: 'jump', label: 'JUMP' },
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
let stickId = null, origin = null;
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
    const a = btn.dataset.a;
    const down = (e) => {
      e.preventDefault();
      capture(btn, e);
      btn.classList.add('on');
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
    stick.style.left = (e.clientX - r.left) / s + 'px';
    stick.style.top = (e.clientY - r.top) / s + 'px';
    stick.classList.add('active');
    moveStick(e);
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickId) moveStick(e);
  });
  const release = (e) => {
    if (e.pointerId !== stickId) return;
    stickId = null;
    stick.classList.remove('active');
    knob.style.transform = '';
    for (const a of ['left', 'right', 'up', 'down']) setVirtual(a, false);
  };
  zone.addEventListener('pointerup', release);
  zone.addEventListener('pointercancel', release);
  zone.addEventListener('lostpointercapture', release);
  applyTouchMode();
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
  if (len > RADIUS) {
    dx = (dx / len) * RADIUS;
    dy = (dy / len) * RADIUS;
  }
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
  setVirtual('left', dx < -DEAD_X);
  setVirtual('right', dx > DEAD_X);
  setVirtual('up', dy < -DEAD_Y);
  setVirtual('down', dy > DEAD_Y);
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
