// Keyboard input: tracks held keys by code and one-frame "pressed" actions.
const KEYMAP = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  KeyZ: 'attack', ControlLeft: 'attack', ControlRight: 'attack',
  KeyX: 'jump', AltLeft: 'jump', AltRight: 'jump', Space: 'jump',
  KeyA: 'skill1', KeyS: 'skill2', KeyD: 'skill3', KeyF: 'skill4',
  Digit1: 'slot1', Digit2: 'slot2', Digit3: 'slot3',
  KeyQ: 'hp', KeyW: 'mp',
  KeyI: 'inv', KeyC: 'char', KeyE: 'char', KeyN: 'bots', KeyK: 'bots', KeyJ: 'quests', KeyH: 'help',
  KeyR: 'mount', KeyO: 'settings', KeyP: 'pause', Tab: 'swapnext',
  Escape: 'esc',
};

const downCodes = new Set();
const pressed = new Set();

function isTyping(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
}

export function initInput() {
  window.addEventListener('keydown', (e) => {
    if (isTyping(e)) return;
    const a = KEYMAP[e.code];
    if (!a) return;
    e.preventDefault();
    if (!e.repeat) pressed.add(a);
    downCodes.add(e.code);
  });
  window.addEventListener('keyup', (e) => {
    downCodes.delete(e.code);
  });
  window.addEventListener('blur', () => downCodes.clear());
}

export function isDown(action) {
  if (padDown.has(action) || virtualDown.has(action)) return true;
  for (const code of downCodes) if (KEYMAP[code] === action) return true;
  return false;
}

// ---------- Gamepad (standard mapping) ----------
// A jump · X attack · B/Y/RB skills 1-3 · RT sync · LB swap · LT med pack · RS-click mount · Back bots · Start pause
const PAD_BUTTONS = {
  0: 'jump', 2: 'attack', 1: 'skill1', 3: 'skill2', 5: 'skill3', 7: 'skill4',
  4: 'swapnext', 6: 'hp', 11: 'mount', 8: 'bots', 9: 'pause',
  12: 'up', 13: 'down', 14: 'left', 15: 'right',
};
let padDown = new Set();

export function pollGamepad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = [...pads].find((g) => g && g.connected);
  const now = new Set();
  if (gp) {
    gp.buttons.forEach((b, i) => {
      if ((b.pressed || b.value > 0.5) && PAD_BUTTONS[i]) now.add(PAD_BUTTONS[i]);
    });
    const [ax = 0, ay = 0] = gp.axes;
    if (ax < -0.45) now.add('left');
    if (ax > 0.45) now.add('right');
    if (ay < -0.6) now.add('up');
    if (ay > 0.6) now.add('down');
  }
  for (const a of now) if (!padDown.has(a)) pressed.add(a);
  padDown = now;
}

// ---------- Virtual input (on-screen touch controls) ----------
const virtualDown = new Set();

export function setVirtual(action, down) {
  if (down && !virtualDown.has(action)) pressed.add(action);
  if (down) virtualDown.add(action);
  else virtualDown.delete(action);
}

export function wasPressed(action) {
  return pressed.has(action);
}

export function endFrame() {
  pressed.clear();
}
