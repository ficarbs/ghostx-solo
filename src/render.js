// Canvas rendering: parallax city backgrounds, pre-baked terrain, characters, nanobots, demons, and effects.
import { G } from './state.js';
import { VIEW_W, VIEW_H, ITEMS, NPCS, BOTS } from './data.js';
import { clamp } from './fx.js';
import { itemIcon } from './icons.js';
import { MELEE_TIME } from './player.js';
import { questMarker } from './quests.js';
import { activeBot, botType, botColor, stageOf } from './bots.js';
import { drawBot, drawWeapon } from './botart.js';
import { crispen, silhouette } from './pixel.js';

// Rendering runs in two passes. The world is drawn into a low-res buffer (one pixel = PX design units)
// and upscaled with hard edges for the pixel-art look; characters are baked into crisp outlined sprites.
// Text (damage numbers, name tags, bubbles) is drawn afterwards on the full-resolution screen.
export const PX = 2;
let ctx; // current drawing target: the low-res world buffer, the screen, or a sprite being baked
let main; // on-screen canvas
let lo, lctx; // low-res world buffer
let k = 1; // screen pixels per low-res pixel
let BAKING = false; // true while drawing into a sprite bake: soft glows are skipped (drawn live instead)
const PI = Math.PI;
const NEON = ['#ff4a8a', '#40e0ff', '#ffe040', '#a060ff', '#5aff9a'];
const SIGNS = ['노래방', 'PC방', '편의점', '치킨', 'HOTEL', '24H', 'CAFE', 'GAME', '약국', 'BAR'];

const THEMES = {
  plaza: { sky: ['#070a1c', '#1a1a4a', '#4a2a6a'], far: '#1c1c3c', mid: '#121230', ground: '#26262e', groundTop: '#6a6a78', plat: '#2e3440', platTop: '#f0c040', moon: '#dfe8ff', fog: 'rgba(120,160,255,0.04)' },
  alley: { sky: ['#0a0414', '#2a0a34', '#5a1a4a'], far: '#1e0c28', mid: '#140820', ground: '#1c1820', groundTop: '#3a3440', plat: '#2a2630', platTop: '#8a7a90', moon: '#ffd8f0', fog: 'rgba(255,80,200,0.05)' },
  subway: { sky: ['#050608', '#0c0e14', '#161a22'], far: '#10141c', mid: '#1a1e28', ground: '#23262c', groundTop: '#d8a830', plat: '#2e3238', platTop: '#6a7078', underground: true, fog: 'rgba(255,200,120,0.04)' },
  rooftop: { sky: ['#03050f', '#101a40', '#2c3570'], far: '#161c3c', mid: '#0c1028', ground: '#2a2a30', groundTop: '#4a4a54', plat: '#34343c', platTop: '#8a8a96', moon: '#f4f0d8', bigMoon: true, fog: 'rgba(160,180,255,0.05)' },
  rift: { sky: ['#0a0208', '#3a0620', '#7a1040'], far: '#2a0616', mid: '#1a0410', ground: '#1e0e14', groundTop: '#ff2a6a', plat: '#2a1018', platTop: '#ff4a8a', moon: '#ff3a6a', bigMoon: true, fog: 'rgba(255,40,100,0.06)' },
};

export function initRender(canvas) {
  main = canvas.getContext('2d');
  lo = document.createElement('canvas');
  lctx = lo.getContext('2d');
  ctx = lctx;
}

// Size the low-res buffer to the view, and the screen canvas to a whole multiple of it so every
// art pixel lands on the same number of screen pixels.
export function setRenderScale(s) {
  const lw = Math.ceil(VIEW_W / PX), lh = Math.ceil(VIEW_H / PX);
  if (lo.width !== lw || lo.height !== lh) {
    lo.width = lw;
    lo.height = lh;
  }
  k = Math.max(1, Math.min(4, Math.round(s * PX)));
  const c = main.canvas;
  if (c.width !== lw * k || c.height !== lh * k) {
    c.width = lw * k;
    c.height = lh * k;
  }
}

// ---------- Sprite baking ----------

const sprites = new Map();
const flashes = new WeakMap();

// Draw a frame once into a small canvas at art resolution, crispen it, and cache it by key.
// box = [x0, y0, w, h] in design units around the sprite's anchor (feet / centre).
function bake(key, box, draw) {
  let c = sprites.get(key);
  if (c) return c;
  const [x0, y0, w, h] = box;
  c = document.createElement('canvas');
  c.width = Math.ceil(w / PX) + 2;
  c.height = Math.ceil(h / PX) + 2;
  const bx = c.getContext('2d');
  bx.lineCap = 'round';
  bx.lineJoin = 'round';
  bx.setTransform(1 / PX, 0, 0, 1 / PX, 1 - x0 / PX, 1 - y0 / PX);
  const prev = ctx, wasBaking = BAKING;
  ctx = bx;
  BAKING = true;
  try {
    draw();
  } finally {
    ctx = prev;
    BAKING = wasBaking;
  }
  crispen(c);
  c.ox = 1 - x0 / PX;
  c.oy = 1 - y0 / PX;
  if (sprites.size > 3000) sprites.clear();
  sprites.set(key, c);
  return c;
}

function flashOf(c) {
  let f = flashes.get(c);
  if (!f) flashes.set(c, (f = silhouette(c)));
  return f;
}

// Draw a baked sprite with its anchor at world (x, y), snapped to the art-pixel grid.
function blit(c, x, y, flip = 1) {
  ctx.save();
  ctx.translate(Math.round(x / PX) * PX, Math.round(y / PX) * PX);
  if (flip < 0) ctx.scale(-1, 1);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, -c.ox * PX, -c.oy * PX, c.width * PX, c.height * PX);
  ctx.restore();
}

// Text queued during the world pass, drawn crisp in the screen pass.
let overlay = null;
const later = (fn) => (overlay ? overlay.push(fn) : fn());

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const canvasOf = (w, h) => {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  return c;
};

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const c = (s) => clamp(Math.round(((n >> s) & 255) * k), 0, 255);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---------- Map art (built once per map) ----------

export function buildMapArt(map) {
  const th = THEMES[map.def.theme];
  const seed = [...map.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
  map.theme = th;
  map.stars = [];
  const r0 = rng(seed);
  if (!th.underground) for (let i = 0; i < 80; i++) map.stars.push([r0() * VIEW_W, r0() * VIEW_H * 0.5, r0() * 1.4 + 0.3, r0() * 6]);
  buildLayers(map);
  map.art = buildTerrain(map, th, rng(seed + 3));
}

// Parallax layers depend on the view width, so they're rebuilt when the window's aspect ratio changes.
export function buildLayers(map) {
  const seed = [...map.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
  map.layers = [buildFar(map, map.theme, 0.12, rng(seed + 1)), buildMid(map, map.theme, 0.32, rng(seed + 2))];
}

function layerCanvas(map, f) {
  const w = VIEW_W + (map.w - VIEW_W) * f + 40;
  return { c: canvasOf(w, VIEW_H + 160), f };
}

function skyline(x, w, base, minH, maxH, r, color, lit, tilt = 0) {
  for (let i = 0; i < w; ) {
    const bw = 40 + r() * 70;
    const bh = minH + r() * (maxH - minH);
    x.save();
    x.translate(i + bw / 2, base);
    if (tilt) x.rotate((r() - 0.5) * tilt);
    x.fillStyle = color;
    x.fillRect(-bw / 2, -bh, bw, bh + 200);
    if (r() < 0.3) x.fillRect(-2, -bh - 20 - r() * 30, 3, 40);
    if (lit) {
      for (let wy = -bh + 8; wy < -6; wy += 10) {
        for (let wx = -bw / 2 + 5; wx < bw / 2 - 5; wx += 8) {
          if (r() < lit) {
            x.fillStyle = r() < 0.8 ? 'rgba(255,220,140,0.55)' : 'rgba(140,220,255,0.55)';
            x.fillRect(wx, wy, 3, 4);
          }
        }
      }
    }
    x.restore();
    i += bw + r() * 6;
  }
}

function buildFar(map, th, f, r) {
  const L = layerCanvas(map, f);
  const x = L.c.getContext('2d');
  const w = L.c.width, h = L.c.height;
  const theme = map.def.theme;
  if (th.underground) {
    x.fillStyle = th.far;
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < w; i += 220) {
      x.fillStyle = '#07090e';
      x.beginPath(); x.moveTo(i + 30, h); x.lineTo(i + 30, h * 0.45); x.arc(i + 110, h * 0.45, 80, PI, 0); x.lineTo(i + 190, h); x.fill();
      x.fillStyle = 'rgba(255,210,120,0.5)';
      x.fillRect(i + 100, h * 0.28, 20, 4);
    }
    return L;
  }
  skyline(x, w, h * 0.62, 90, 260, r, shade(th.far, 0.8), 0.12, theme === 'rift' ? 0.5 : 0);
  skyline(x, w, h * 0.72, 60, 180, r, th.far, 0.18, theme === 'rift' ? 0.35 : 0);
  return L;
}

function buildMid(map, th, f, r) {
  const L = layerCanvas(map, f);
  const x = L.c.getContext('2d');
  const w = L.c.width, h = L.c.height;
  const base = h * 0.84;
  const theme = map.def.theme;
  if (theme === 'subway') {
    x.fillStyle = th.mid;
    x.fillRect(0, h * 0.3, w, h);
    x.strokeStyle = 'rgba(255,255,255,0.05)';
    for (let yy = h * 0.3; yy < h; yy += 14) { x.beginPath(); x.moveTo(0, yy); x.lineTo(w, yy); x.stroke(); }
    for (let i = 0; i < w; i += 28) { x.beginPath(); x.moveTo(i, h * 0.3); x.lineTo(i, h); x.stroke(); }
    for (let i = 60; i < w; i += 260) {
      x.fillStyle = '#12151c';
      x.fillRect(i, h * 0.3, 26, h);
      x.fillStyle = '#2a8a4a';
      x.fillRect(i + 60, h * 0.42, 120, 22);
      x.fillStyle = '#fff';
      x.font = 'bold 13px sans-serif';
      x.fillText('9  DEPOT', i + 80, h * 0.42 + 16);
    }
    return L;
  }
  if (theme === 'rift') {
    for (let i = 0; i < w; i += 90 + r() * 120) {
      const y = h * (0.2 + r() * 0.5), s = 10 + r() * 30;
      x.fillStyle = th.mid;
      x.beginPath(); x.moveTo(i, y); x.lineTo(i + s, y - s * 0.4); x.lineTo(i + s * 1.6, y + s * 0.3); x.lineTo(i + s * 0.5, y + s * 0.8); x.closePath(); x.fill();
      x.fillStyle = 'rgba(255,60,120,0.5)';
      x.fillRect(i + s * 0.5, y, 2, s * 0.5);
    }
    skyline(x, w, base, 40, 140, r, th.mid, 0, 0.6);
    return L;
  }
  skyline(x, w, base, 80, theme === 'rooftop' ? 140 : 220, r, th.mid, theme === 'alley' ? 0.05 : 0.1);
  for (let i = 30; i < w; i += 90 + r() * 140) neonSign(x, i, base - 60 - r() * 120, r, theme === 'alley' ? 1 : 0.7);
  if (theme === 'rooftop') for (let i = 50; i < w; i += 200 + r() * 200) waterTower(x, i, base - 40 - r() * 60, th.mid);
  return L;
}

function neonSign(x, cx, cy, r, big) {
  const col = NEON[Math.floor(r() * NEON.length)];
  const text = SIGNS[Math.floor(r() * SIGNS.length)];
  const vertical = r() < 0.5;
  x.save();
  x.font = `bold ${Math.round(14 * big)}px sans-serif`;
  x.shadowColor = col;
  x.shadowBlur = 12;
  x.fillStyle = col;
  if (vertical) {
    [...text].forEach((ch, i) => x.fillText(ch, cx, cy + i * 16 * big));
  } else {
    x.strokeStyle = col;
    x.lineWidth = 2;
    const tw = x.measureText(text).width;
    x.strokeRect(cx - 4, cy - 14 * big, tw + 8, 18 * big);
    x.fillText(text, cx, cy);
  }
  x.restore();
}

function waterTower(x, cx, base, color) {
  x.fillStyle = color;
  x.fillRect(cx - 18, base - 50, 36, 34);
  x.beginPath(); x.moveTo(cx - 20, base - 50); x.lineTo(cx, base - 64); x.lineTo(cx + 20, base - 50); x.fill();
  x.fillRect(cx - 16, base - 16, 3, 20);
  x.fillRect(cx + 13, base - 16, 3, 20);
}

function buildTerrain(map, th, r) {
  const c = canvasOf(map.w, map.h);
  const x = c.getContext('2d');
  const def = map.def;
  const theme = def.theme;
  const F = def.floor;
  x.lineCap = 'round';
  x.lineJoin = 'round';

  if (theme === 'plaza') {
    storefront(x, 640, F, 260, 'GHOSTX HQ', '#40e0ff', '#1a2440');
    storefront(x, 960, F, 200, 'MED LAB', '#5aff9a', '#1a3028');
    storefront(x, 1250, F, 220, 'TECH · NANO', '#ffb040', '#302418');
    for (let i = 120; i < map.w; i += 300) streetLamp(x, i, F);
    for (let i = 1600; i < map.w - 200; i += 180) neonSign(x, i, F - 170 - r() * 60, r, 1);
  } else if (theme === 'alley') {
    for (let i = 0; i < map.w; i += 160) brickWall(x, i, F, 160, 200 + r() * 200);
    for (let i = 200; i < map.w; i += 260 + r() * 200) dumpster(x, i, F);
    for (let i = 100; i < map.w; i += 220 + r() * 160) neonSign(x, i, F - 180 - r() * 300, r, 1.2);
    wires(x, map.w, 120, r);
  } else if (theme === 'subway') {
    for (let i = 300; i < map.w; i += 900) trainCar(x, i, F);
    for (let i = 0; i < map.w; i += 240) ceilingLight(x, i + 120, 60);
    for (let i = 150; i < map.w; i += 420) pillar(x, i, F, map.h);
  } else if (theme === 'rooftop') {
    for (let i = 150; i < map.w; i += 260 + r() * 200) acUnit(x, i, F);
    for (let i = 400; i < map.w; i += 700) waterTower(x, i, F - 10, '#1a1e2c');
    for (let i = 0; i < map.w; i += 90) antenna(x, i + r() * 60, F, r);
  } else if (theme === 'rift') {
    riftTear(x, map.w / 2 + 250, F);
    for (let i = 100; i < map.w; i += 260) brokenPillar(x, i, F, r);
  }

  // Floor
  x.fillStyle = th.ground;
  x.fillRect(0, F, map.w, map.h - F);
  x.fillStyle = th.groundTop;
  x.fillRect(0, F, map.w, theme === 'subway' ? 5 : 7);
  x.fillStyle = 'rgba(0,0,0,0.3)';
  x.fillRect(0, F + 7, map.w, 4);
  if (theme === 'plaza' || theme === 'rooftop') {
    x.strokeStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < map.w; i += 48) { x.beginPath(); x.moveTo(i, F + 7); x.lineTo(i, F + 30); x.stroke(); }
  } else if (theme === 'rift') {
    x.strokeStyle = '#ff2a6a';
    x.shadowColor = '#ff2a6a';
    x.shadowBlur = 8;
    for (let i = 40; i < map.w; i += 120 + r() * 80) {
      x.beginPath(); x.moveTo(i, F + 8); x.lineTo(i + 14, F + 20); x.lineTo(i + 6, F + 34); x.lineTo(i + 20, F + 50); x.stroke();
    }
    x.shadowBlur = 0;
  }

  // Ladders
  for (const rp of map.ropes) {
    x.strokeStyle = '#8a90a0';
    x.lineWidth = 3;
    x.beginPath(); x.moveTo(rp.x - 8, rp.top - 4); x.lineTo(rp.x - 8, rp.bottom); x.moveTo(rp.x + 8, rp.top - 4); x.lineTo(rp.x + 8, rp.bottom); x.stroke();
    x.lineWidth = 2;
    for (let y = rp.top + 6; y < rp.bottom; y += 12) { x.beginPath(); x.moveTo(rp.x - 8, y); x.lineTo(rp.x + 8, y); x.stroke(); }
  }

  // Platforms
  for (const p of map.plats) {
    if (p.floor) continue;
    const h = 16;
    x.fillStyle = 'rgba(0,0,0,0.3)';
    x.fillRect(p.x + 4, p.y + h, p.w - 8, 6);
    x.fillStyle = th.plat;
    x.fillRect(p.x, p.y, p.w, h);
    if (theme === 'alley' || theme === 'subway') {
      x.fillStyle = 'rgba(0,0,0,0.35)';
      for (let i = p.x + 4; i < p.x + p.w - 4; i += 7) x.fillRect(i, p.y + 5, 3, h - 6);
    }
    x.fillStyle = th.platTop;
    x.fillRect(p.x - 2, p.y - 1, p.w + 4, 4);
    if (theme === 'plaza' || theme === 'rift') {
      x.fillStyle = theme === 'plaza' ? '#1a1a1a' : '#4a0a20';
      for (let i = p.x; i < p.x + p.w - 8; i += 16) x.fillRect(i + 8, p.y - 1, 8, 4);
    }
    if (theme === 'rooftop') {
      x.fillStyle = '#5a5a66';
      for (let i = p.x + 6; i < p.x + p.w; i += 30) x.fillRect(i, p.y - 14, 2, 14);
      x.fillRect(p.x, p.y - 15, p.w, 2);
    }
  }
  return c;
}

function storefront(x, cx, F, w, name, col, bg) {
  const top = F - 190;
  x.fillStyle = bg;
  x.fillRect(cx - w / 2, top, w, 190);
  x.fillStyle = 'rgba(160,200,255,0.12)';
  x.fillRect(cx - w / 2 + 14, top + 60, w - 28, 116);
  x.strokeStyle = 'rgba(255,255,255,0.15)';
  x.lineWidth = 2;
  x.strokeRect(cx - w / 2 + 14, top + 60, w - 28, 116);
  x.beginPath(); x.moveTo(cx, top + 60); x.lineTo(cx, F - 14); x.stroke();
  x.fillStyle = '#0a0c14';
  x.fillRect(cx - w / 2 - 6, top + 10, w + 12, 36);
  x.save();
  x.font = 'bold 18px sans-serif';
  x.textAlign = 'center';
  x.shadowColor = col;
  x.shadowBlur = 14;
  x.fillStyle = col;
  x.fillText(name, cx, top + 35);
  x.restore();
  const g = x.createLinearGradient(0, top + 46, 0, top + 140);
  g.addColorStop(0, hexA(col, 0.25));
  g.addColorStop(1, hexA(col, 0));
  x.fillStyle = g;
  x.fillRect(cx - w / 2, top + 46, w, 100);
}

function streetLamp(x, cx, F) {
  x.fillStyle = '#2a2e38';
  x.fillRect(cx - 2, F - 150, 4, 150);
  x.fillRect(cx - 2, F - 150, 26, 4);
  x.fillStyle = '#e8f4ff';
  x.fillRect(cx + 16, F - 147, 12, 4);
  const g = x.createLinearGradient(0, F - 146, 0, F);
  g.addColorStop(0, 'rgba(220,240,255,0.25)');
  g.addColorStop(1, 'rgba(220,240,255,0)');
  x.fillStyle = g;
  x.beginPath(); x.moveTo(cx + 16, F - 146); x.lineTo(cx + 28, F - 146); x.lineTo(cx + 70, F); x.lineTo(cx - 26, F); x.closePath(); x.fill();
}

function brickWall(x, cx, F, w, h) {
  x.fillStyle = '#2a1a22';
  x.fillRect(cx, F - h, w, h);
  x.strokeStyle = 'rgba(0,0,0,0.3)';
  x.lineWidth = 1;
  for (let y = F - h; y < F; y += 12) {
    for (let i = cx + ((y / 12) % 2 ? 0 : 12); i < cx + w; i += 24) x.strokeRect(i, y, 24, 12);
  }
}

function dumpster(x, cx, F) {
  x.fillStyle = '#2a5a3a';
  x.fillRect(cx - 34, F - 40, 68, 40);
  x.fillStyle = '#1e4a2e';
  x.fillRect(cx - 36, F - 46, 72, 8);
  x.fillStyle = '#111';
  x.fillRect(cx - 30, F - 4, 8, 4);
  x.fillRect(cx + 22, F - 4, 8, 4);
}

function wires(x, w, y, r) {
  x.strokeStyle = 'rgba(0,0,0,0.6)';
  x.lineWidth = 1.5;
  for (let k = 0; k < 3; k++) {
    x.beginPath();
    for (let i = 0; i < w; i += 200) {
      x.moveTo(i, y + k * 30);
      x.quadraticCurveTo(i + 100, y + k * 30 + 40 + r() * 20, i + 200, y + k * 30);
    }
    x.stroke();
  }
}

function trainCar(x, cx, F) {
  x.fillStyle = '#3a4050';
  x.fillRect(cx, F - 140, 560, 130);
  x.fillStyle = '#2a8a4a';
  x.fillRect(cx, F - 70, 560, 8);
  x.fillStyle = 'rgba(255,230,160,0.35)';
  for (let i = 30; i < 540; i += 80) x.fillRect(cx + i, F - 120, 50, 40);
  x.fillStyle = '#1a1e28';
  for (const dx of [60, 480]) {
    x.beginPath(); x.arc(cx + dx, F - 8, 12, 0, PI * 2); x.fill();
  }
}

function ceilingLight(x, cx, y) {
  x.fillStyle = '#ffe8a0';
  x.fillRect(cx - 30, y, 60, 5);
  const g = x.createLinearGradient(0, y, 0, y + 260);
  g.addColorStop(0, 'rgba(255,230,160,0.18)');
  g.addColorStop(1, 'rgba(255,230,160,0)');
  x.fillStyle = g;
  x.beginPath(); x.moveTo(cx - 30, y); x.lineTo(cx + 30, y); x.lineTo(cx + 120, y + 260); x.lineTo(cx - 120, y + 260); x.fill();
}

function pillar(x, cx, F, h) {
  x.fillStyle = '#1e222a';
  x.fillRect(cx - 16, 0, 32, F);
  x.fillStyle = '#d8a830';
  for (let y = F - 60; y < F; y += 20) x.fillRect(cx - 16, y, 32, 8);
}

function acUnit(x, cx, F) {
  x.fillStyle = '#5a5e6a';
  x.fillRect(cx - 30, F - 44, 60, 44);
  x.fillStyle = '#3a3e48';
  x.beginPath(); x.arc(cx, F - 22, 15, 0, PI * 2); x.fill();
  x.strokeStyle = '#6a6e7a';
  x.beginPath(); x.moveTo(cx - 12, F - 22); x.lineTo(cx + 12, F - 22); x.moveTo(cx, F - 34); x.lineTo(cx, F - 10); x.stroke();
}

function antenna(x, cx, F, r) {
  if (r() > 0.4) return;
  const h = 60 + r() * 80;
  x.strokeStyle = '#3a3e48';
  x.lineWidth = 2;
  x.beginPath(); x.moveTo(cx, F); x.lineTo(cx, F - h); x.stroke();
  x.fillStyle = '#ff3040';
  x.beginPath(); x.arc(cx, F - h, 3, 0, PI * 2); x.fill();
}

function riftTear(x, cx, F) {
  const g = x.createRadialGradient(cx, F - 200, 10, cx, F - 200, 220);
  g.addColorStop(0, 'rgba(255,80,160,0.55)');
  g.addColorStop(1, 'rgba(255,80,160,0)');
  x.fillStyle = g;
  x.fillRect(cx - 240, F - 440, 480, 440);
  x.fillStyle = '#ff9ad0';
  x.beginPath();
  x.moveTo(cx, F - 400);
  x.lineTo(cx + 30, F - 300); x.lineTo(cx + 10, F - 250); x.lineTo(cx + 40, F - 150); x.lineTo(cx + 5, F - 60);
  x.lineTo(cx - 5, F - 60); x.lineTo(cx - 35, F - 160); x.lineTo(cx - 10, F - 240); x.lineTo(cx - 30, F - 310);
  x.closePath();
  x.fill();
  x.fillStyle = '#fff';
  x.fillRect(cx - 2, F - 360, 4, 280);
}

function brokenPillar(x, cx, F, r) {
  const h = 60 + r() * 140;
  x.fillStyle = '#2a1018';
  x.beginPath(); x.moveTo(cx - 16, F); x.lineTo(cx - 16, F - h); x.lineTo(cx - 4, F - h - 14); x.lineTo(cx + 6, F - h + 6); x.lineTo(cx + 16, F - h - 4); x.lineTo(cx + 16, F); x.fill();
}

// ---------- Camera ----------

// The HUD covers the bottom of the screen, so the camera may scroll that far past the map bottom.
const HUD_H = 80;
const maxCamY = (m) => m.h - VIEW_H + HUD_H;

export function updateCamera(dt) {
  const p = G.player, m = G.map, c = G.cam;
  const tx = clamp(p.x - VIEW_W / 2, 0, m.w - VIEW_W);
  const ty = clamp(p.y - VIEW_H * 0.58, 0, maxCamY(m));
  if (c.snap) {
    c.x = tx;
    c.y = ty;
    c.snap = false;
  } else {
    c.x += (tx - c.x) * Math.min(1, dt * 8);
    c.y += (ty - c.y) * Math.min(1, dt * 5);
  }
}

// ---------- Frame ----------

export function render() {
  ctx = lctx;
  lctx.setTransform(1 / PX, 0, 0, 1 / PX, 0, 0);
  lctx.imageSmoothingEnabled = true;
  if (!G.started || !G.map) {
    renderTitle();
    present();
    return;
  }
  const map = G.map, th = map.theme, cam = G.cam;
  overlay = [];
  drawSky(th, map);
  const camBottom = maxCamY(map);
  for (const L of map.layers) {
    const oy = -120 + (camBottom - cam.y) * L.f * 0.5;
    ctx.drawImage(L.c, Math.round((-cam.x * L.f) / PX) * PX, Math.round(oy / PX) * PX);
  }

  const sx = (Math.random() - 0.5) * G.cam.shake, sy = (Math.random() - 0.5) * G.cam.shake;
  const cx = Math.round((-cam.x + sx) / PX) * PX, cy = Math.round((-cam.y + sy) / PX) * PX;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.drawImage(map.art, 0, 0);

  for (const pt of map.portals) drawPortal(pt, map.def.floor);
  for (const n of map.npcs) drawNpc(n, map.def.floor);
  for (const d of G.drops) drawDrop(d);
  for (const m of G.mobs) drawMob(m);
  drawPlayer(G.player);
  for (const d of G.drones) drawDrone(d);
  for (const s of G.shots) drawShot(s);
  for (const pr of G.projs) drawProj(pr);
  for (const e of G.effects) drawEffect(e);
  drawParticles();
  ctx.restore();

  ctx.fillStyle = th.fog;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  vignette();
  if (G.player.dead) {
    ctx.fillStyle = 'rgba(20,0,10,0.35)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  present();

  // Screen pass: crisp text over the upscaled world.
  ctx = main;
  main.setTransform(k / PX, 0, 0, k / PX, 0, 0);
  main.save();
  main.translate(cx, cy);
  for (const fn of overlay) fn();
  drawTexts();
  drawHints(map);
  drawBubble();
  main.restore();
  overlay = null;
  ctx = lctx;
}

function present() {
  main.setTransform(1, 0, 0, 1, 0, 0);
  main.imageSmoothingEnabled = false;
  main.drawImage(lo, 0, 0, main.canvas.width, main.canvas.height);
}

function drawSky(th, map) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, th.sky[0]);
  g.addColorStop(0.6, th.sky[1]);
  g.addColorStop(1, th.sky[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (th.underground) return;
  for (const [sx, sy, sr, ph] of map.stars) {
    ctx.globalAlpha = 0.4 + Math.sin(G.time * 2 + ph) * 0.3;
    ctx.fillStyle = '#fff';
    ctx.fillRect(sx, sy, sr, sr);
  }
  ctx.globalAlpha = 1;
  const mx = VIEW_W * 0.78 - G.cam.x * 0.02, my = 90 - G.cam.y * 0.02;
  const mr = th.bigMoon ? 70 : 34;
  const gl = ctx.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 2.6);
  gl.addColorStop(0, hexA(th.moon, 0.35));
  gl.addColorStop(1, hexA(th.moon, 0));
  ctx.fillStyle = gl;
  ctx.fillRect(mx - mr * 3, my - mr * 3, mr * 6, mr * 6);
  ctx.fillStyle = th.moon;
  ctx.beginPath(); ctx.arc(mx, my, mr, 0, PI * 2); ctx.fill();
  if (map.def.theme === 'rift') {
    ctx.fillStyle = '#1a0008';
    ctx.beginPath(); ctx.ellipse(mx, my, mr * 0.18, mr * 0.8, 0, 0, PI * 2); ctx.fill();
  }
}

function vignette() {
  const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

// ---------- World objects ----------

function drawPortal(pt, floor) {
  const t = G.time;
  ctx.save();
  ctx.translate(pt.x, floor);
  ctx.fillStyle = '#2a2e38';
  ctx.fillRect(-34, -118, 8, 118);
  ctx.fillRect(26, -118, 8, 118);
  ctx.fillRect(-38, -124, 76, 10);
  const g = ctx.createLinearGradient(0, -114, 0, 0);
  g.addColorStop(0, 'rgba(90,220,255,0.15)');
  g.addColorStop(0.5, 'rgba(90,220,255,0.45)');
  g.addColorStop(1, 'rgba(160,100,255,0.25)');
  ctx.fillStyle = g;
  ctx.fillRect(-26, -114, 52, 114);
  ctx.strokeStyle = 'rgba(200,245,255,0.8)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const y = -((t * 60 + i * 30) % 114);
    ctx.beginPath(); ctx.moveTo(-24, y); ctx.lineTo(24, y); ctx.stroke();
  }
  ctx.fillStyle = '#40e0ff';
  ctx.fillRect(-36, -122, 72, 3);
  ctx.restore();
}

function nameTag(text, x, y, color = '#fff', bg = 'rgba(10,8,20,0.7)') {
  later(() => {
    ctx.font = '12px "Pixelify Sans", "Trebuchet MS", sans-serif';
    const w = Math.ceil(ctx.measureText(text).width) + 10;
    ctx.fillStyle = bg;
    ctx.fillRect(Math.round(x - w / 2), y, w, 15);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y + 11.5);
  });
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shadow(x, y, w) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(x, y, w, 4, 0, 0, PI * 2); ctx.fill();
}

function legs(sw, color, air, shoe = '#e8eef8') {
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  const a1 = air ? -0.5 : sw * 0.7, a2 = air ? 0.4 : -sw * 0.7;
  for (const a of [a1, a2]) {
    const fx = Math.sin(a) * 20, fy = -22 + Math.cos(a) * 20;
    ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.fillStyle = shoe;
    ctx.fillRect(fx - 3, fy - 2, 9, 4);
  }
}

function face(x, y, skin, hair, style) {
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(x, y, 10, 0, PI * 2); ctx.fill();
  ctx.fillStyle = hair;
  if (style === 'spiky') {
    ctx.beginPath();
    ctx.moveTo(x - 11, y + 2);
    ctx.lineTo(x - 13, y - 8); ctx.lineTo(x - 7, y - 10); ctx.lineTo(x - 6, y - 16); ctx.lineTo(x, y - 12);
    ctx.lineTo(x + 4, y - 17); ctx.lineTo(x + 6, y - 10); ctx.lineTo(x + 12, y - 9); ctx.lineTo(x + 8, y - 4);
    ctx.lineTo(x - 5, y - 5); ctx.lineTo(x - 7, y + 4);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(x - 1, y - 2, 10.5, PI * 0.95, PI * 2.05); ctx.fill();
    ctx.fillRect(x - 11, y - 3, 5, style === 'long' ? 18 : 8);
  }
  ctx.fillStyle = '#1a1420';
  ctx.fillRect(x + 4, y - 1, 2, 3);
}

function drawNpc(n, floor) {
  const t = G.time;
  const facing = G.player.x < n.x ? -1 : 1;
  const f = Math.floor(t * 1.4 + n.x * 0.01) % 2;
  const tf = n.id === 'terminal' ? Math.floor(t * 3) % 4 : 0;
  ctx.save();
  ctx.translate(n.x, floor);
  shadow(0, 0, 18);
  if (n.id === 'terminal') {
    const hg = ctx.createLinearGradient(0, -110, 0, -48);
    hg.addColorStop(0, 'rgba(64,224,255,0)');
    hg.addColorStop(1, 'rgba(64,224,255,0.35)');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.moveTo(-30, -104); ctx.lineTo(30, -104); ctx.lineTo(16, -48); ctx.lineTo(-16, -48); ctx.fill();
  }
  ctx.restore();
  const spr = bake(`N|${n.id}|${f}|${tf}`, [-44, -116, 88, 122], () => npcBody(n.id, f ? -2 : 0, tf));
  blit(spr, n.x, floor, facing);

  nameTag(NPCS[n.id].name, n.x, floor + 4, '#bfe6ff');
  if (n.id === 'captain' || n.id === 'jin') {
    const mk = questMarker(n.id);
    if (mk) {
      later(() => {
        ctx.font = '28px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = mk === '?' ? '#8affb0' : '#ffd84a';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        const y = floor - 92 + (Math.floor(t * 4) % 2) * 4;
        ctx.strokeText(mk, n.x, y);
        ctx.fillText(mk, n.x, y);
      });
    }
  }
}

function npcBody(id, bob, tf) {
  if (id === 'captain') {
    legs(0, '#1a1e2c', 0, '#111');
    ctx.fillStyle = '#23304a';
    ctx.beginPath(); ctx.moveTo(-11, -48 + bob); ctx.lineTo(11, -48 + bob); ctx.lineTo(13, -14); ctx.lineTo(-13, -14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8c040'; ctx.fillRect(6, -44 + bob, 4, 3); ctx.fillRect(-10, -44 + bob, 4, 3);
    ctx.fillStyle = '#40e0ff'; ctx.fillRect(-4, -38 + bob, 8, 2);
    face(1, -58 + bob, '#f1c9a0', '#1a1420', 'long');
    ctx.fillStyle = '#1a1420'; ctx.beginPath(); ctx.arc(-10, -52 + bob, 4, 0, PI * 2); ctx.fill();
    ctx.fillStyle = '#23304a';
    ctx.fillRect(-10, -72 + bob, 22, 6); ctx.fillRect(-4, -68 + bob, 20, 3);
    ctx.fillStyle = '#e8c040'; ctx.fillRect(0, -71 + bob, 4, 3);
  } else if (id === 'mina') {
    legs(0, '#2a2e38', 0, '#e8eef8');
    ctx.fillStyle = '#f4f6fa';
    ctx.beginPath(); ctx.moveTo(-11, -48 + bob); ctx.lineTo(11, -48 + bob); ctx.lineTo(14, -8); ctx.lineTo(-14, -8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5aff9a'; ctx.fillRect(-2, -46 + bob, 4, 18);
    face(1, -58 + bob, '#f1c9a0', '#3a2418', 'bun');
    ctx.fillStyle = '#3a2418'; ctx.beginPath(); ctx.arc(-6, -68 + bob, 5, 0, PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.fillRect(2, -60 + bob, 7, 2);
    ctx.fillStyle = '#40e0ff'; ctx.fillRect(10, -36 + bob, 10, 14);
    ctx.fillStyle = '#d8f8ff'; ctx.fillRect(12, -34 + bob, 6, 2);
  } else if (id === 'terminal') {
    ctx.fillStyle = '#1a2030';
    ctx.fillRect(-16, -44, 32, 44);
    ctx.fillStyle = '#2a3448';
    ctx.fillRect(-20, -48, 40, 6);
    ctx.fillStyle = '#40e0ff';
    ctx.fillRect(-10, -36, 20, 3);
    ctx.fillRect(-10, -28, 14, 3);
    ctx.fillStyle = '#a0f0ff';
    ctx.fillRect(-26, -100, 52, 2); ctx.fillRect(-26, -72, 52, 2); ctx.fillRect(-26, -100, 2, 30); ctx.fillRect(24, -100, 2, 30);
    for (let i = 0; i < 3; i++) ctx.fillRect(-20, -94 + i * 8, 10 + ((i * 17 + tf * 7) % 28), 3);
  } else if (id === 'jin') {
    legs(0, '#c86a20', 0, '#3a2a1a');
    ctx.fillStyle = '#e07a2a';
    ctx.fillRect(-14, -50 + bob, 28, 32);
    ctx.fillStyle = '#b85a18'; ctx.fillRect(-14, -30 + bob, 28, 3);
    ctx.fillStyle = '#d8a078';
    ctx.fillRect(-18, -48 + bob, 5, 20);
    ctx.fillRect(13, -48 + bob, 5, 20);
    face(1, -60 + bob, '#d8a078', '#2a1a10', 'spiky');
    ctx.fillStyle = '#2a2e38'; ctx.fillRect(-9, -68 + bob, 20, 5);
    ctx.fillStyle = '#ffb040'; ctx.fillRect(-6, -67 + bob, 6, 3); ctx.fillRect(3, -67 + bob, 6, 3);
    ctx.fillStyle = '#8a90a0'; ctx.fillRect(17, -42 + bob, 4, 22); ctx.fillRect(13, -46 + bob, 12, 6);
  }
}

function drawDrop(d) {
  const bob = d.onGround ? Math.sin(G.time * 4 + d.x) * 2 - 4 : 0;
  ctx.globalAlpha = d.t > 80 ? (Math.floor(d.t * 8) % 2 ? 0.3 : 1) : 1;
  if (d.gold) {
    ctx.save();
    ctx.translate(d.x, d.y - 8 + bob);
    ctx.scale(Math.cos(G.time * 5 + d.x), 1);
    ctx.fillStyle = '#40e0ff';
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 0); ctx.lineTo(0, 8); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8feff'; ctx.fillRect(-1, -4, 2, 8);
    ctx.restore();
  } else {
    const ic = itemIcon(d.id).canvas;
    if (ITEMS[d.id].rare) {
      const g = ctx.createRadialGradient(d.x, d.y - 14 + bob, 2, d.x, d.y - 14 + bob, 24);
      g.addColorStop(0, 'rgba(255,220,120,0.6)');
      g.addColorStop(1, 'rgba(255,220,120,0)');
      ctx.fillStyle = g;
      ctx.fillRect(d.x - 26, d.y - 40 + bob, 52, 52);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(ic, Math.round((d.x - 16) / PX) * PX, Math.round((d.y - 30 + bob) / PX) * PX, 32, 32);
    ctx.drawImage(ic, d.x - 12, d.y - 24 + bob, 24, 24);
  }
  ctx.globalAlpha = 1;
}

function drawShot(s) {
  const g = ctx.createRadialGradient(s.x, s.y, 1, s.x, s.y, s.r * 2);
  g.addColorStop(0, '#fff');
  g.addColorStop(0.4, s.color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 2, 0, PI * 2); ctx.fill();
}

function drawProj(pr) {
  if (pr.delay > 0) return;
  const g = ctx.createRadialGradient(pr.x, pr.y, 1, pr.x, pr.y, pr.r * 2.2);
  g.addColorStop(0, '#fff');
  g.addColorStop(0.35, pr.color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r * 2.2, 0, PI * 2); ctx.fill();
}

function drawDrone(d) {
  const f = Math.floor(G.time * 5) % 2;
  const spr = bake(`D|${f}`, [-24, -24, 48, 48], () => {
    ctx.scale(0.6, 0.6);
    drawBot(ctx, 'medic', 1, '#60f0a0', f ? 0.16 : 0, 1, true);
  });
  ctx.globalAlpha = d.life - d.t < 1 ? Math.max(0, d.life - d.t) : 1;
  blit(spr, d.x, d.y);
  ctx.globalAlpha = 1;
}

function drawParticles() {
  for (const p of G.parts) {
    ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
    ctx.fillStyle = p.color;
    if (p.glow) {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, PI * 2); ctx.fill();
    } else ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

const TEXT_STYLE = {
  dmg: ['#ffe066', 20], crit: ['#ff8c3a', 26], hurt: ['#ff4d6d', 20], heal: ['#6dff8a', 18],
  mp: ['#6db8ff', 18], exp: ['#c6a8ff', 14], gold: ['#7af0ff', 14], info: ['#ffffff', 14],
};

function drawTexts() {
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  for (const t of G.texts) {
    const [col, size] = TEXT_STYLE[t.kind] || TEXT_STYLE.info;
    const pop = t.t < 0.1 ? 1 + (0.1 - t.t) * 5 : 1;
    ctx.globalAlpha = t.t > 0.7 ? Math.max(0, 1 - (t.t - 0.7) / 0.4) : 1;
    ctx.font = `700 ${Math.round(size * pop)}px "Pixelify Sans", "Trebuchet MS", sans-serif`;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = 4;
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = col;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

function drawHints(map) {
  const p = G.player;
  if (p.dead || !p.onGround) return;
  let hint = null;
  for (const pt of map.portals) if (Math.abs(p.x - pt.x) < 32) hint = [pt.x, map.def.floor - 150, '↑ Enter'];
  for (const n of map.npcs) if (Math.abs(p.x - n.x) < 45 && Math.abs(p.y - map.def.floor) < 4) hint = [n.x, map.def.floor - 112, '↑ Talk'];
  if (hint) nameTag(hint[2], hint[0], hint[1] + Math.sin(G.time * 5) * 2, '#bfe6ff');
}

function drawBubble() {
  const b = G.bubble, p = G.player;
  if (!b || p.dead || p.botX == null) return;
  const x = p.botX, y = p.botY - 26;
  ctx.font = '12px "Pixelify Sans", "Trebuchet MS", sans-serif';
  const w = ctx.measureText(b.text).width + 14;
  ctx.globalAlpha = b.t > 2.2 ? Math.max(0, (2.6 - b.t) / 0.4) : Math.min(1, b.t * 8);
  ctx.fillStyle = 'rgba(245,250,255,0.95)';
  roundRect(x - w / 2, y - 18, w, 18, 6);
  ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x, y + 6); ctx.lineTo(x + 4, y); ctx.fill();
  ctx.fillStyle = '#10141c';
  ctx.textAlign = 'center';
  ctx.fillText(b.text, x, y - 5);
  ctx.globalAlpha = 1;
}

// ---------- Effects ----------

function drawEffect(e) {
  const k = e.t / e.dur;
  ctx.save();
  switch (e.type) {
    case 'slash':
      ctx.translate(e.x, e.y);
      ctx.scale(e.face, 1);
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = e.combo === 2 ? '#ffffff' : e.color || '#e0f4ff';
      ctx.lineWidth = 10 * (1 - k) + 2;
      ctx.beginPath();
      if (e.combo === 0) ctx.arc(-14, 0, 46, -1.4, 1.0);
      else if (e.combo === 1) ctx.arc(-14, 0, 46, 1.2, -1.2, true);
      else { ctx.moveTo(-20, 0); ctx.lineTo(60 + k * 30, 0); }
      ctx.stroke();
      ctx.globalAlpha = (1 - k) * 0.35;
      ctx.lineWidth = 24 * (1 - k);
      ctx.stroke();
      break;
    case 'ring':
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = e.color || '#ffe2a0';
      ctx.lineWidth = 6 * (1 - k) + 1;
      ctx.beginPath();
      if (e.round) ctx.arc(e.x, e.y, e.r * (0.3 + k), 0, PI * 2);
      else ctx.ellipse(e.x, e.y, e.r * (0.3 + k), 18 * (0.3 + k), 0, 0, PI * 2);
      ctx.stroke();
      break;
    case 'blast': {
      ctx.globalAlpha = 1 - k;
      const g = ctx.createRadialGradient(e.x, e.y, 2, e.x, e.y, e.r * (0.5 + k * 0.6));
      g.addColorStop(0, '#fff');
      g.addColorStop(0.4, e.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.5 + k * 0.6), 0, PI * 2); ctx.fill();
      break;
    }
    case 'beam':
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = e.color;
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 20;
      ctx.fillRect(e.face > 0 ? e.x : e.x - 900, e.y - 5 * (1 - k) - 1, 900, 10 * (1 - k) + 2);
      break;
    case 'mark':
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(e.t * 30);
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(e.x, e.y, 95 * (1 - k * 0.3), 14, 0, 0, PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(e.x - 20, e.y); ctx.lineTo(e.x + 20, e.y); ctx.moveTo(e.x, e.y - 10); ctx.lineTo(e.x, e.y + 10); ctx.stroke();
      break;
    case 'orbital': {
      ctx.globalAlpha = 1 - k;
      const g = ctx.createLinearGradient(e.x - 90, 0, e.x + 90, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, '#ffffff');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(e.x - 90, G.cam.y - 20, 180, e.y - G.cam.y + 20);
      ctx.fillStyle = hexA(e.color, 0.6);
      ctx.fillRect(e.x - 40, G.cam.y - 20, 80, e.y - G.cam.y + 20);
      break;
    }
    case 'zap':
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = e.color;
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(e.x1, e.y1);
      for (let i = 1; i < 6; i++) {
        const f = i / 6;
        ctx.lineTo(e.x1 + (e.x2 - e.x1) * f + (Math.random() - 0.5) * 20, e.y1 + (e.y2 - e.y1) * f + (Math.random() - 0.5) * 20);
      }
      ctx.lineTo(e.x2, e.y2);
      ctx.stroke();
      break;
    case 'swap':
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(G.player.x, G.player.y - 32, 20 + k * 40, 0, PI * 2); ctx.stroke();
      break;
    case 'roar':
    case 'evolve': {
      const p = G.player;
      ctx.globalAlpha = Math.sin(k * PI);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.arc(p.botX ?? p.x, p.botY ?? p.y - 70, 10 + k * 90 + i * 16, 0, PI * 2); ctx.stroke();
      }
      break;
    }
    case 'levelup': {
      const p = G.player;
      ctx.globalAlpha = Math.sin(k * PI);
      const g = ctx.createLinearGradient(0, p.y - 260, 0, p.y);
      g.addColorStop(0, 'rgba(120,230,255,0)');
      g.addColorStop(1, 'rgba(120,230,255,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(p.x - 40, p.y - 260, 80, 260);
      ctx.font = '16px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
      ctx.strokeText('LEVEL UP!', p.x, p.y - 100 - k * 30);
      ctx.fillStyle = '#7af0ff';
      ctx.fillText('LEVEL UP!', p.x, p.y - 100 - k * 30);
      break;
    }
    case 'hit': {
      ctx.translate(e.x, e.y);
      ctx.rotate(e.t * 10);
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = e.crit ? '#ffb347' : '#fff';
      const s = (e.crit ? 22 : 14) * (0.5 + k);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 ? s * 0.3 : s;
        ctx.lineTo(Math.cos((i / 8) * PI * 2) * r, Math.sin((i / 8) * PI * 2) * r);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'alert':
      ctx.font = '20px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
      ctx.strokeText('!', e.x, e.y);
      ctx.fillStyle = '#ff4040';
      ctx.fillText('!', e.x, e.y);
      break;
    case 'warn':
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(e.t * 30);
      ctx.fillStyle = '#ff2a6a';
      ctx.fillRect(e.x - 18, G.cam.y, 36, e.y - G.cam.y);
      ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.ellipse(e.x, e.y, 26, 6, 0, 0, PI * 2); ctx.fill();
      break;
    case 'sweep':
      ctx.translate(e.x, e.y - 30);
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = '#ff6a9a';
      ctx.lineWidth = 14 * (1 - k) + 2;
      ctx.beginPath(); ctx.ellipse(0, 0, 230, 40, 0, 0, PI * 2); ctx.stroke();
      break;
  }
  ctx.restore();
}

// ---------- Player + companion ----------

function weaponAngle(p, type) {
  const a = p.act;
  if (a) {
    if (a.type === 'dash') return { ang: 0.05, ext: 8 };
    if (a.type === 'whirl') return { ang: G.time * 28, ext: 4 };
    if (a.type === 'slam') return a.phase === 'recover' ? { ang: 1.35, ext: 6 } : { ang: -1.8, ext: 0 };
    if (a.type === 'overdrive') return { ang: (Math.random() - 0.5) * 0.12, ext: 4 - Math.random() * 3 };
    if (a.type === 'sync') return { ang: -0.6, ext: 2 };
  }
  if (type === 'blade') {
    if (p.attackT > 0) {
      const k = clamp((1 - p.attackT / MELEE_TIME) / 0.45, 0, 1);
      const e = 1 - (1 - k) * (1 - k);
      if (p.swing === 0) return { ang: -1.9 + e * 3.0, ext: 2 };
      if (p.swing === 1) return { ang: 1.2 - e * 2.8, ext: 2 };
      return { ang: 0.02, ext: -4 + e * 16 };
    }
    return { ang: 1.15, ext: 0 };
  }
  const recoil = p.attackT > 0 ? Math.max(0, p.attackT - 0.15) * 20 : 0;
  return { ang: -recoil * 0.03, ext: 6 - recoil };
}

// Weapon form is out while fighting; otherwise the nanobot floats beside you as a companion.
const armed = (p) => !!p.act || p.attackT > 0 || p.lastAtk < 0.9;

// Reduce the player's continuous state to a small set of sprite frames.
function playerPose(p, type) {
  const t = G.time;
  const q = {
    mounted: !!p.mounted,
    hover: p.mounted ? (Math.floor(t * 4) % 2) * 2 : 0,
    lean: p.act?.type === 'dash' ? 0.25 : 0,
    rope: !!p.rope,
    climb: p.rope ? (Math.sin(p.climbT * 12) > 0 ? 1 : -1) : 0,
    air: !p.onGround && !p.rope,
    sw: 0,
    bob: 0,
    w: null,
  };
  if (p.onGround && Math.abs(p.vx) > 30 && !p.mounted) {
    const f = Math.floor((p.walkT * 14) / (PI / 3)) % 6;
    q.sw = Math.round(Math.sin((f * PI) / 3) * 100) / 100;
    q.bob = Math.round(Math.abs(Math.cos((f * PI) / 3))) * 2;
  } else if (!q.air) q.bob = (Math.floor(t * 1.5) % 2) * 2;
  if (armed(p)) {
    const s = weaponAngle(p, type);
    const a = Math.atan2(Math.sin(s.ang), Math.cos(s.ang));
    q.w = { ang: Math.round(a / 0.2) * 0.2, ext: Math.round(s.ext / 2) * 2 };
  }
  q.key = [+q.mounted, q.hover, q.lean, q.rope ? q.climb : 'n', +q.air, q.sw, q.bob, q.w ? `${q.w.ang.toFixed(1)},${q.w.ext}` : '-'].join('|');
  return q;
}

function drawPlayer(p) {
  const t = G.time;
  const bot = activeBot(p);
  const type = bot ? botType(bot) : 'blade';
  const color = bot ? botColor(bot) : '#5ad8ff';
  const stage = bot ? stageOf(bot) : 1;
  if (p.dead) {
    const ko = bake('KO', [-24, -36, 48, 40], () => {
      ctx.fillStyle = '#3a3e4a';
      roundRect(-18, -30, 36, 30, 6);
      ctx.fill();
      ctx.fillStyle = '#ff3a4a';
      ctx.fillRect(-7, -20, 14, 4);
      ctx.fillRect(-2, -25, 4, 14);
    });
    blit(ko, p.x, p.y);
    return;
  }

  // Live (unbaked) layers: shield, sync aura, shadow, hoverboard glow.
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.shield > 0) {
    ctx.strokeStyle = hexA('#60f0a0', 0.5 + 0.3 * Math.sin(t * 10));
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, -32, 40, 0, PI * 2); ctx.stroke();
  }
  if (p.act?.type === 'sync') {
    const g = ctx.createRadialGradient(0, -30, 5, 0, -30, 90);
    g.addColorStop(0, hexA(color, 0.5));
    g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-90, -120, 180, 180);
  }
  if (p.onGround) shadow(0, 0, 16);
  if (p.mounted) {
    ctx.fillStyle = hexA('#40e0ff', 0.35);
    ctx.beginPath(); ctx.ellipse(0, 2, 26, 5, 0, 0, PI * 2); ctx.fill();
    if (Math.random() < 0.6) G.parts.push({ x: p.x - p.face * 26, y: p.y - 4, vx: -p.face * 80 - p.vx * 0.3, vy: 0, life: 0.25, t: 0, color: '#40e0ff', size: 3, grav: 0 });
  }
  ctx.restore();

  const q = playerPose(p, type);
  const jacket = ITEMS[p.equip.body]?.color || '#44475a';
  const head = p.equip.head || '';
  const spr = bake(`P|${type}|${stage}|${jacket}|${head}|${q.key}`, [-76, -128, 170, 144], () => drawPlayerBody(q, type, stage, color, jacket, head));
  if (p.invuln > 0 && !p.act && Math.floor(t * 20) % 2) ctx.globalAlpha = 0.45;
  blit(spr, p.x, p.y, p.face);
  ctx.globalAlpha = 1;

  if (p.act?.type === 'whirl') {
    ctx.save();
    ctx.translate(p.x, p.y - 30);
    ctx.strokeStyle = hexA(color, 0.8);
    ctx.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      const a0 = G.time * 22 + i * 2.1;
      ctx.beginPath(); ctx.ellipse(0, 0, 100, 40, 0, a0, a0 + 1.3); ctx.stroke();
    }
    ctx.restore();
  }
  drawCompanion(p, type, stage, color, t);
  nameTag(p.name, p.x, p.y + 6, '#fff', 'rgba(20,60,120,0.8)');
}

// The player at the origin, facing right, in one pose. Baked into a sprite by drawPlayer.
function drawPlayerBody(q, type, stage, color, jacket, headId) {
  if (q.mounted) {
    ctx.fillStyle = '#1a2030';
    roundRect(-24, -8 + q.hover, 48, 7, 3);
    ctx.fill();
    ctx.fillStyle = '#40e0ff';
    ctx.fillRect(-20, -4 + q.hover, 40, 2);
    ctx.fillStyle = '#ff3a8a';
    ctx.fillRect(-26, -7 + q.hover, 4, 5);
    ctx.translate(0, -8 + q.hover);
  }
  ctx.rotate(q.lean);

  if (q.rope) {
    const c = q.climb;
    ctx.strokeStyle = '#23262e'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-4, -22); ctx.lineTo(-5, -4 + c * 4); ctx.moveTo(4, -22); ctx.lineTo(5, -4 - c * 4); ctx.stroke();
    ctx.fillStyle = jacket;
    ctx.fillRect(-10, -46, 20, 26);
    ctx.strokeStyle = jacket; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-8, -44); ctx.lineTo(-7, -64 + c * 4); ctx.moveTo(8, -44); ctx.lineTo(7, -64 - c * 4); ctx.stroke();
    ctx.fillStyle = '#16121a';
    ctx.beginPath(); ctx.arc(0, -56, 11, 0, PI * 2); ctx.fill();
    return;
  }

  const sw = q.sw, bob = q.bob;
  // Back arm
  ctx.strokeStyle = shade(jacket, 0.7);
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-3, -42 + bob); ctx.lineTo(-7 - sw * 5, -26 + bob); ctx.stroke();

  legs(sw, '#23262e', q.air);

  // Jacket
  ctx.fillStyle = jacket;
  ctx.beginPath();
  ctx.moveTo(-9, -47 + bob); ctx.lineTo(9, -47 + bob); ctx.lineTo(11, -20); ctx.lineTo(-11, -20); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8eef8';
  ctx.fillRect(-2, -46 + bob, 5, 10);
  ctx.fillStyle = color;
  ctx.fillRect(-11, -24 + bob, 22, 2);
  ctx.fillRect(5, -42 + bob, 3, 3);

  face(1, -57 + bob, '#f1c9a0', '#16121a', 'spiky');
  ctx.fillStyle = color;
  ctx.fillRect(-2, -72 + bob, 3, 6);

  const head = headId ? ITEMS[headId] : null;
  if (head) {
    ctx.fillStyle = head.color;
    if (head.look === 'cap') {
      ctx.beginPath(); ctx.arc(1, -60 + bob, 11, PI, 0); ctx.fill();
      ctx.fillRect(1, -62 + bob, 16, 4);
    } else if (head.look === 'visor') {
      ctx.fillStyle = '#10141c'; ctx.fillRect(-4, -61 + bob, 15, 6);
      ctx.fillStyle = head.color; ctx.fillRect(-2, -60 + bob, 13, 3);
    } else if (head.look === 'helm') {
      ctx.beginPath(); ctx.arc(1, -59 + bob, 12, PI, 0); ctx.fill();
      ctx.fillRect(-11, -60 + bob, 24, 4);
      ctx.fillStyle = '#40e0ff'; ctx.fillRect(2, -59 + bob, 10, 3);
    } else if (head.look === 'horns') {
      ctx.beginPath(); ctx.moveTo(-6, -64 + bob); ctx.quadraticCurveTo(-14, -78 + bob, -8, -86 + bob); ctx.quadraticCurveTo(-8, -76 + bob, -2, -66 + bob); ctx.fill();
      ctx.beginPath(); ctx.moveTo(6, -64 + bob); ctx.quadraticCurveTo(14, -78 + bob, 10, -86 + bob); ctx.quadraticCurveTo(8, -76 + bob, 3, -66 + bob); ctx.fill();
    }
  }

  // Front arm + weapon form
  const shX = 3, shY = -42 + bob;
  if (q.w) {
    const hx = shX + Math.cos(q.w.ang) * 12 + q.w.ext, hy = shY + Math.sin(q.w.ang) * 12;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(q.w.ang);
    drawWeapon(ctx, type, stage, color, true);
    ctx.restore();
    ctx.strokeStyle = jacket; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(shX, shY); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = '#f1c9a0';
    ctx.beginPath(); ctx.arc(hx, hy, 3, 0, PI * 2); ctx.fill();
  } else {
    ctx.strokeStyle = jacket; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(shX, shY); ctx.lineTo(6 + sw * 5, -26 + bob); ctx.stroke();
  }
}

function drawCompanion(p, type, stage, color, t) {
  if (p.botX == null) return;
  const sync = p.act?.type === 'sync';
  if (armed(p) && !sync) return;
  const bot = activeBot(p);
  const rar = bot ? BOTS[bot.sp].rarity : 1;
  const sc = sync ? 1.8 : 1;
  const r = (stage >= 3 ? 26 + Math.sin(t * 4) * 2 : 18) * sc;
  const g = ctx.createRadialGradient(p.botX, p.botY, 1, p.botX, p.botY, r);
  g.addColorStop(0, hexA(color, 0.6));
  g.addColorStop(1, hexA(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(p.botX - r, p.botY - r, r * 2, r * 2);
  const f = Math.floor(t * 5) % 2;
  const spr = bake(`B|${type}|${stage}|${rar}|${f}|${sc}`, [-40 * sc, -40 * sc, 80 * sc, 80 * sc], () => {
    ctx.scale(sc, sc);
    drawBot(ctx, type, stage, color, f ? 0.16 : 0, rar, true);
  });
  blit(spr, p.botX, p.botY, p.face);
}

// ---------- Demons ----------

// Sprite bounds per demon type, [x0, y0, w, h] around the feet anchor (facing right).
const MOB_BOX = {
  imp: [-32, -52, 68, 58], wisp: [-20, -48, 40, 52], hound: [-54, -62, 108, 66],
  specter: [-26, -76, 64, 90], brute: [-38, -90, 84, 94], sovereign: [-172, -188, 294, 196],
};
const MOB_GLOW = { wisp: 'rgba(255,80,220,', specter: 'rgba(110,90,255,' };

function drawMob(m) {
  let rise = 0, alpha = 1;
  if (!m.alive) {
    const kk = m.deadT / (m.d.kind === 'boss' ? 2.5 : 0.6);
    alpha = Math.max(0, kk);
    rise = (1 - kk) * 20;
  }
  // Live (unbaked) layers: shadow, auras.
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(m.x, m.y - rise);
  if (m.d.kind !== 'floater' && m.alive) shadow(0, rise, m.w * 0.45);
  const aura = (r, y, c) => {
    const g = ctx.createRadialGradient(0, y, 2, 0, y, r);
    g.addColorStop(0, c + '0.55)');
    g.addColorStop(1, c + '0)');
    ctx.fillStyle = g;
    ctx.fillRect(-r, y - r, r * 2, r * 2);
  };
  if (m.elite && m.alive) aura(m.h, -m.h / 2, 'rgba(255,200,60,');
  if (MOB_GLOW[m.type]) aura(m.type === 'wisp' ? 30 : 36, -m.h / 2, MOB_GLOW[m.type]);
  if (m.type === 'sovereign' && ((m.st === 'lunge' && m.atk?.phase === 'wind') || m.st === 'sweep' || m.st === 'rain')) aura(130, -60, 'rgba(255,40,100,');
  ctx.restore();

  const f = Math.floor(m.anim * 8) % 16;
  const moving = Math.abs(m.vx) > 5 || m.st === 'lunge';
  const fake = {
    ...m, anim: f / 8, vx: moving ? 10 : 0,
    windup: m.windup > 0 ? 1 : 0, charging: !!m.charging, casting: m.casting > 0 ? 1 : 0,
    hurtT: m.hurtT > 0 ? 1 : 0, aggro: !!m.aggro, atk: m.atk ? { phase: m.atk.phase } : null,
  };
  const key = `M|${m.type}|${m.size}|${f}|${+moving}|${+fake.aggro}|${fake.windup}|${+fake.charging}|${fake.casting}|${fake.hurtT}|${m.st || ''}|${fake.atk?.phase || ''}`;
  let spr = bake(key, MOB_BOX[m.type].map((v) => v * m.size), () => {
    ctx.scale(m.size, m.size);
    MOB_DRAW[m.type]?.(fake);
  });
  if (m.flash > 0) spr = flashOf(spr);
  ctx.globalAlpha = alpha;
  blit(spr, m.x, m.y - rise, m.face);
  ctx.globalAlpha = 1;
  if (m.type === 'wisp' && m.alive && Math.random() < 0.25) G.parts.push({ x: m.x + (Math.random() - 0.5) * 16, y: m.y - 30, vx: 0, vy: -40, life: 0.5, t: 0, color: '#ff9af0', size: 3, grav: 0 });

  if (m.alive && m.elite) nameTag(m.name, m.x, m.y + 4, '#ffd24a');
  if (m.alive && m.d.kind !== 'boss' && (m.showBar > 0 || m.elite)) {
    const w = Math.max(36, m.w);
    const y = m.y - m.h - 14;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(m.x - w / 2 - 2, y - 2, w + 4, 8);
    ctx.fillStyle = '#e8384f';
    ctx.fillRect(m.x - w / 2, y, w * (m.hp / m.maxHp), 4);
  }
}

function eyes(x1, x2, y, color, r = 2.5) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(x1, y, r * 1.4, r);
  if (x2 != null) ctx.fillRect(x2, y, r * 1.4, r);
  ctx.restore();
}

const MOB_DRAW = {
  imp(m) {
    const moving = Math.abs(m.vx) > 5;
    const bob = moving ? Math.abs(Math.sin(m.anim * 12)) * 3 : Math.sin(m.anim * 3);
    const l = moving ? Math.sin(m.anim * 12) * 4 : 0;
    ctx.fillStyle = '#6a1a1e';
    ctx.fillRect(-9 + l, -9, 6, 9);
    ctx.fillRect(3 - l, -9, 6, 9);
    ctx.strokeStyle = '#8a2226'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-12, -14 - bob); ctx.quadraticCurveTo(-24, -12, -22, -26 + Math.sin(m.anim * 6) * 3); ctx.stroke();
    ctx.fillStyle = '#5a1418';
    const flap = Math.sin(m.anim * 16) * 4;
    ctx.beginPath(); ctx.moveTo(-6, -26 - bob); ctx.lineTo(-20, -36 - bob + flap); ctx.lineTo(-10, -20 - bob); ctx.fill();
    ctx.fillStyle = '#b8302e';
    ctx.beginPath(); ctx.ellipse(0, -20 - bob, 14, 14, 0, 0, PI * 2); ctx.fill();
    ctx.fillStyle = '#2a0a0c';
    ctx.beginPath(); ctx.moveTo(-8, -31 - bob); ctx.lineTo(-11, -42 - bob); ctx.lineTo(-3, -33 - bob); ctx.fill();
    ctx.beginPath(); ctx.moveTo(5, -33 - bob); ctx.lineTo(9, -43 - bob); ctx.lineTo(10, -30 - bob); ctx.fill();
    eyes(2, 8, -25 - bob, m.aggro ? '#ffea40' : '#ffa030');
    ctx.fillStyle = '#1a0406';
    ctx.fillRect(2, -16 - bob, 10, 3);
    ctx.fillStyle = '#fff';
    ctx.fillRect(4, -16 - bob, 2, 2); ctx.fillRect(8, -16 - bob, 2, 2);
  },
  wisp(m) {
    const f = Math.sin(m.anim * 10) * 3;
    ctx.fillStyle = '#ff9af0';
    ctx.beginPath();
    ctx.moveTo(-12, -10);
    ctx.quadraticCurveTo(-14, -26, -4 + f, -40);
    ctx.quadraticCurveTo(0, -30, 4, -34 - f);
    ctx.quadraticCurveTo(14, -24, 12, -10);
    ctx.quadraticCurveTo(0, 0, -12, -10);
    ctx.fill();
    // glitch blocks
    ctx.fillStyle = Math.floor(m.anim * 12) % 2 ? '#40ffff' : '#ffffff';
    for (let i = 0; i < 3; i++) ctx.fillRect(((m.anim * 37 + i * 13) % 24) - 12, -30 + i * 8, 4, 3);
    ctx.fillStyle = '#300a30';
    ctx.fillRect(-6, -19, 4, 5);
    ctx.fillRect(3, -19, 4, 5);
  },
  hound(m) {
    const moving = Math.abs(m.vx) > 5;
    const l = moving ? Math.sin(m.anim * (m.charging ? 22 : 12)) * 6 : 0;
    const crouch = m.windup > 0 ? 5 : 0;
    ctx.strokeStyle = '#ff7020'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-30, -26 + crouch); ctx.quadraticCurveTo(-42, -30, -44, -42 + Math.sin(m.anim * 6) * 4); ctx.stroke();
    ctx.fillStyle = '#1a1214';
    for (const [lx, ph] of [[-20, 1], [-12, -1], [14, -1], [22, 1]]) ctx.fillRect(lx + l * ph, -14 + crouch, 6, 14 - crouch);
    ctx.fillStyle = '#231a1c';
    ctx.beginPath(); ctx.ellipse(0, -24 + crouch, 32, 12, 0, 0, PI * 2); ctx.fill();
    ctx.strokeStyle = '#ff5a10'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-18, -30 + crouch); ctx.lineTo(-10, -24 + crouch); ctx.lineTo(-2, -30 + crouch); ctx.lineTo(8, -24 + crouch); ctx.stroke();
    // fiery mane
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? '#ff9a30' : '#ff4a10';
      const fx = 10 + i * 4, fh = 10 + Math.sin(m.anim * 14 + i) * 4;
      ctx.beginPath(); ctx.moveTo(fx - 4, -32 + crouch); ctx.lineTo(fx, -32 - fh + crouch); ctx.lineTo(fx + 4, -32 + crouch); ctx.fill();
    }
    ctx.fillStyle = '#231a1c';
    ctx.beginPath(); ctx.moveTo(22, -36 + crouch); ctx.lineTo(44, -28 + crouch); ctx.lineTo(40, -20 + crouch); ctx.lineTo(22, -18 + crouch); ctx.fill();
    ctx.beginPath(); ctx.moveTo(24, -36 + crouch); ctx.lineTo(28, -48 + crouch); ctx.lineTo(32, -36 + crouch); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(34, -22 + crouch, 2, 3); ctx.fillRect(38, -22 + crouch, 2, 3);
    eyes(32, null, -31 + crouch, m.aggro ? '#ffea40' : '#ff7020', 3);
  },
  specter(m) {
    const f = Math.sin(m.anim * 3);
    ctx.globalAlpha *= 0.9;
    ctx.fillStyle = '#12101c';
    ctx.beginPath();
    ctx.moveTo(-10, -58);
    ctx.quadraticCurveTo(2, -70, 12, -56);
    ctx.lineTo(16, -6);
    for (let i = 16; i >= -16; i -= 8) ctx.quadraticCurveTo(i - 4, 6 + Math.sin(m.anim * 6 + i) * 5, i - 8, -6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#6a5aff'; ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#d8dcea';
    ctx.beginPath(); ctx.ellipse(4, -50, 7, 9, 0, 0, PI * 2); ctx.fill();
    ctx.fillStyle = '#12101c';
    ctx.fillRect(0, -52, 3, 5); ctx.fillRect(6, -52, 3, 5);
    eyes(0.5, 6.5, -51, m.aggro ? '#8a7aff' : '#3a3a5a', 2);
    ctx.strokeStyle = '#12101c'; ctx.lineWidth = 4;
    const reach = m.casting > 0 ? 12 : 0;
    ctx.beginPath(); ctx.moveTo(6, -38 + f); ctx.lineTo(18 + reach, -32 - reach * 0.5); ctx.stroke();
    if (m.casting > 0) {
      ctx.fillStyle = '#b8a8ff';
      ctx.beginPath(); ctx.arc(20 + reach, -33 - reach * 0.5, 5, 0, PI * 2); ctx.fill();
    }
  },
  brute(m) {
    const moving = Math.abs(m.vx) > 5;
    const l = moving ? Math.sin(m.anim * 8) * 4 : 0;
    ctx.fillStyle = '#3a1a1e';
    ctx.fillRect(-20 + l, -20, 14, 20);
    ctx.fillRect(6 - l, -20, 14, 20);
    ctx.fillStyle = '#6a2a2a';
    roundRect(-28, -54, 56, 38, 10);
    ctx.fill();
    ctx.fillStyle = '#7a8090';
    ctx.fillRect(-26, -52, 24, 16);
    ctx.fillRect(4, -40, 20, 10);
    ctx.fillStyle = '#ff5a30';
    ctx.fillRect(-18, -46, 3, 3); ctx.fillRect(10, -36, 3, 3);
    ctx.fillStyle = '#6a2a2a';
    ctx.beginPath(); ctx.arc(10, -60, 11, 0, PI * 2); ctx.fill();
    ctx.fillStyle = '#e8d8c0';
    ctx.beginPath(); ctx.moveTo(2, -66); ctx.lineTo(-4, -80); ctx.lineTo(6, -68); ctx.fill();
    ctx.beginPath(); ctx.moveTo(16, -68); ctx.lineTo(24, -80); ctx.lineTo(20, -64); ctx.fill();
    eyes(12, null, -62, m.aggro ? '#ffa030' : '#6a3a2a', 3);
    ctx.fillStyle = '#7a8090';
    const punch = m.aggro ? Math.max(0, Math.sin(m.anim * 5)) * 6 : 0;
    roundRect(20 + punch, -42, 16, 16, 4);
    ctx.fill();
  },
  sovereign(m) {
    const t = m.anim;
    const st = m.st;
    const wind = (st === 'lunge' && m.atk?.phase === 'wind') || st === 'sweep';
    if (!BAKING && (wind || st === 'rain')) {
      const g = ctx.createRadialGradient(0, -60, 10, 0, -60, 130);
      g.addColorStop(0, 'rgba(255,40,100,0.4)');
      g.addColorStop(1, 'rgba(255,40,100,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-140, -190, 280, 220);
    }
    // Tendrils
    const whip = st === 'sweep' ? Math.sin(t * 20) * 0.5 : 0;
    for (let i = 0; i < 7; i++) {
      const a = -2.9 + i * 0.25 + Math.sin(t * 2 + i) * 0.1 + whip;
      const len = 80 + (i % 3) * 14;
      const ex = -30 + Math.cos(a) * len, ey = -60 + Math.sin(a) * len;
      ctx.strokeStyle = '#2a0a18';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(-30, -60);
      ctx.quadraticCurveTo(-30 + Math.cos(a + 0.6) * len * 0.6, -60 + Math.sin(a + 0.6) * len * 0.6, ex, ey);
      ctx.stroke();
      ctx.fillStyle = '#ff2a6a';
      ctx.beginPath(); ctx.arc(ex, ey, 5, 0, PI * 2); ctx.fill();
    }
    const run = Math.abs(m.vx) > 5 || st === 'lunge';
    const l = run ? Math.sin(t * (st === 'lunge' ? 24 : 10)) * 8 : 0;
    ctx.fillStyle = '#1a0610';
    ctx.fillRect(-26 + l, -40, 18, 40);
    ctx.fillRect(10 - l, -40, 18, 40);
    // Torso
    ctx.fillStyle = '#3a0c1e';
    ctx.beginPath(); ctx.moveTo(-40, -100); ctx.lineTo(44, -100); ctx.lineTo(30, -36); ctx.lineTo(-28, -36); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5a1428';
    ctx.beginPath(); ctx.ellipse(-40, -96, 18, 12, 0, 0, PI * 2); ctx.ellipse(44, -96, 18, 12, 0, 0, PI * 2); ctx.fill();
    // Core
    const pulse = 8 + Math.sin(t * 6) * 2;
    const cg = ctx.createRadialGradient(4, -72, 1, 4, -72, pulse * 2);
    cg.addColorStop(0, '#fff');
    cg.addColorStop(0.4, '#ff3a6a');
    cg.addColorStop(1, 'rgba(255,40,100,0)');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(4, -72, pulse * 2, 0, PI * 2); ctx.fill();
    // Arm reaching forward
    ctx.strokeStyle = '#3a0c1e'; ctx.lineWidth = 12;
    const reach = st === 'fire' ? 20 : 0;
    ctx.beginPath(); ctx.moveTo(40, -92); ctx.lineTo(62 + reach, -70); ctx.stroke();
    ctx.fillStyle = '#ff5a8a';
    ctx.beginPath(); ctx.arc(66 + reach, -68, st === 'fire' ? 9 : 5, 0, PI * 2); ctx.fill();
    // Head + crown horns
    ctx.fillStyle = '#2a0814';
    ctx.beginPath(); ctx.arc(6, -118, 18, 0, PI * 2); ctx.fill();
    ctx.fillStyle = '#e8d0d8';
    ctx.beginPath(); ctx.moveTo(-8, -128); ctx.quadraticCurveTo(-26, -150, -14, -170); ctx.quadraticCurveTo(-14, -148, -2, -132); ctx.fill();
    ctx.beginPath(); ctx.moveTo(18, -130); ctx.quadraticCurveTo(38, -152, 28, -172); ctx.quadraticCurveTo(26, -150, 12, -134); ctx.fill();
    ctx.fillStyle = '#ff3a6a';
    ctx.beginPath(); ctx.moveTo(-2, -134); ctx.lineTo(6, -150); ctx.lineTo(14, -134); ctx.fill();
    eyes(6, 14, -122, '#ff2050', 3.5);
  },
};

// ---------- Title backdrop ----------

const titleLights = Array.from({ length: 90 }, () => [Math.random(), 260 + Math.random() * 220, Math.random()]);

function renderTitle() {
  const t = performance.now() / 1000;
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, '#05030c');
  g.addColorStop(0.6, '#2a0a34');
  g.addColorStop(1, '#6a1040');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const gl = ctx.createRadialGradient(VIEW_W / 2, 190, 10, VIEW_W / 2, 190, 260);
  gl.addColorStop(0, 'rgba(255,60,140,0.5)');
  gl.addColorStop(1, 'rgba(255,60,140,0)');
  ctx.fillStyle = gl;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // Rift tear
  ctx.fillStyle = '#ffb0e0';
  ctx.beginPath();
  ctx.moveTo(VIEW_W / 2, 40); ctx.lineTo(VIEW_W / 2 + 22, 130); ctx.lineTo(VIEW_W / 2 + 6, 190); ctx.lineTo(VIEW_W / 2 + 28, 300); ctx.lineTo(VIEW_W / 2, 360);
  ctx.lineTo(VIEW_W / 2 - 24, 290); ctx.lineTo(VIEW_W / 2 - 6, 200); ctx.lineTo(VIEW_W / 2 - 20, 120); ctx.closePath();
  ctx.fill();
  // Skyline
  ctx.fillStyle = '#0a0612';
  let x = 0;
  let i = 0;
  while (x < VIEW_W) {
    const w = 40 + ((i * 53) % 60), h = 80 + ((i * 97) % 180);
    ctx.fillRect(x, VIEW_H - h, w, h);
    x += w + 4;
    i++;
  }
  for (const [lx, ly, ph] of titleLights) {
    ctx.fillStyle = Math.sin(t * 2 + ph * 10) > -0.3 ? 'rgba(255,220,140,0.6)' : 'rgba(120,200,255,0.4)';
    ctx.fillRect(lx * VIEW_W, ly, 3, 4);
  }
  vignette();
}
