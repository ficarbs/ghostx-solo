// Procedurally drawn 32x32 icons for items, skills and nanobots, cached as canvases + data URLs.
import { ITEMS, BOTS, BOT_TYPES } from './data.js';
import { drawBot } from './botart.js';
import { pixelizeIcon } from './pixel.js';

const cache = new Map();

function make(key, draw, size = 32) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  x.lineCap = 'round';
  x.lineJoin = 'round';
  draw(x);
  const px = pixelizeIcon(c, 2);
  const rec = { canvas: px, url: px.toDataURL() };
  cache.set(key, rec);
  return rec;
}

export function itemIcon(id) {
  const [kind, col] = ITEMS[id].icon;
  return make('i:' + id, (x) => drawItem(x, kind, col));
}

export function skillIcon(id, color = '#5ad8ff') {
  return make('s:' + id, (x) => drawSkill(x, id, color));
}

// Portrait for a nanobot species at an evolution stage. `silhouette` hides unseen species in the Nanodex.
export function botIcon(sp, stage = 1, silhouette = false) {
  return make(`b:${sp}:${stage}:${silhouette ? 1 : 0}`, (x) => {
    const type = BOTS[sp].type;
    const color = BOT_TYPES[type].color;
    const g = x.createLinearGradient(0, 0, 0, 48);
    g.addColorStop(0, '#1e2438');
    g.addColorStop(1, '#0a0c16');
    x.fillStyle = g;
    x.fillRect(0, 0, 48, 48);
    x.translate(24, 25);
    x.scale(1.15, 1.15);
    if (silhouette) x.filter = 'brightness(0) opacity(0.6)';
    drawBot(x, type, stage, color, 0.8, BOTS[sp].rarity);
  }, 48);
}

function drawItem(x, kind, col) {
  x.fillStyle = col;
  x.strokeStyle = 'rgba(0,0,0,0.6)';
  x.lineWidth = 1.5;
  switch (kind) {
    case 'board':
      x.fillStyle = '#1a2030';
      x.beginPath(); x.ellipse(16, 18, 14, 5, -0.3, 0, Math.PI * 2); x.fill(); x.stroke();
      x.fillStyle = col; x.fillRect(8, 16, 16, 2);
      x.fillStyle = '#ff3a8a'; x.fillRect(3, 20, 4, 3);
      break;
    case 'medkit':
      x.fillStyle = '#eef0f4';
      x.fillRect(5, 9, 22, 17); x.strokeRect(5, 9, 22, 17);
      x.fillStyle = '#5a606c'; x.fillRect(12, 5, 8, 4);
      x.fillStyle = col; x.fillRect(14, 11, 4, 13); x.fillRect(9, 15.5, 14, 4);
      break;
    case 'cell':
      x.fillRect(10, 5, 12, 23); x.strokeRect(10, 5, 12, 23);
      x.fillStyle = '#d8dde8'; x.fillRect(13, 2, 6, 3);
      x.fillStyle = 'rgba(255,255,255,0.7)'; x.fillRect(12, 8, 2, 16);
      x.fillStyle = '#fff'; x.beginPath(); x.moveTo(17, 9); x.lineTo(13, 17); x.lineTo(16, 17); x.lineTo(15, 24); x.lineTo(19, 15); x.lineTo(16, 15); x.closePath(); x.fill();
      break;
    case 'beacon':
      x.fillStyle = '#5a606c'; x.fillRect(11, 18, 10, 10);
      x.fillStyle = col; x.beginPath(); x.arc(16, 14, 6, 0, Math.PI * 2); x.fill();
      x.strokeStyle = col; x.lineWidth = 1.5;
      for (const r of [9, 12]) { x.beginPath(); x.arc(16, 14, r, -2.4, -0.7); x.stroke(); }
      break;
    case 'capsule':
      x.fillStyle = '#e8eef8'; x.beginPath(); x.arc(16, 16, 11, Math.PI, 0); x.fill();
      x.fillStyle = col; x.beginPath(); x.arc(16, 16, 11, 0, Math.PI); x.fill();
      x.strokeStyle = 'rgba(0,0,0,0.6)'; x.beginPath(); x.arc(16, 16, 11, 0, Math.PI * 2); x.stroke();
      x.fillStyle = '#10141c'; x.fillRect(5, 15, 22, 2);
      x.fillStyle = '#fff'; x.beginPath(); x.arc(16, 16, 3, 0, Math.PI * 2); x.fill();
      break;
    case 'horn':
      x.beginPath(); x.moveTo(8, 26); x.quadraticCurveTo(10, 8, 24, 5); x.quadraticCurveTo(18, 14, 18, 26); x.closePath(); x.fill(); x.stroke();
      break;
    case 'shard':
      x.beginPath(); x.moveTo(16, 3); x.lineTo(24, 14); x.lineTo(18, 29); x.lineTo(8, 17); x.closePath(); x.fill(); x.stroke();
      x.fillStyle = '#5affff'; x.fillRect(12, 12, 3, 3); x.fillRect(18, 18, 3, 3);
      break;
    case 'fang':
      x.beginPath(); x.moveTo(10, 4); x.quadraticCurveTo(24, 10, 20, 28); x.quadraticCurveTo(14, 18, 10, 4); x.fill(); x.stroke();
      break;
    case 'orb': {
      const g = x.createRadialGradient(16, 16, 1, 16, 16, 12);
      g.addColorStop(0, '#fff'); g.addColorStop(0.4, col); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, 32, 32);
      break;
    }
    case 'plate':
      x.beginPath(); x.moveTo(5, 24); x.lineTo(9, 9); x.lineTo(20, 5); x.lineTo(28, 15); x.lineTo(24, 27); x.closePath(); x.fill(); x.stroke();
      x.fillStyle = '#c04030'; x.fillRect(12, 12, 3, 3); x.fillRect(19, 18, 3, 3);
      break;
    case 'core': {
      const g = x.createRadialGradient(16, 16, 1, 16, 16, 13);
      g.addColorStop(0, '#fff'); g.addColorStop(0.35, col); g.addColorStop(1, 'rgba(60,0,20,0)');
      x.fillStyle = g; x.fillRect(0, 0, 32, 32);
      x.strokeStyle = '#2a0010'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(16, 6); x.lineTo(13, 16); x.lineTo(19, 16); x.lineTo(16, 26); x.stroke();
      break;
    }
    case 'cap':
      x.beginPath(); x.arc(15, 18, 10, Math.PI, 0); x.closePath(); x.fill(); x.stroke();
      x.fillRect(15, 16, 13, 4);
      break;
    case 'visor':
      x.fillStyle = '#2a2e38'; x.fillRect(4, 12, 24, 10);
      x.fillStyle = col; x.fillRect(6, 14, 20, 6);
      x.fillStyle = 'rgba(255,255,255,0.6)'; x.fillRect(8, 15, 6, 2);
      break;
    case 'helm':
      x.beginPath(); x.arc(16, 18, 11, Math.PI, 0); x.lineTo(27, 24); x.lineTo(5, 24); x.closePath(); x.fill(); x.stroke();
      x.fillStyle = '#40e0ff'; x.fillRect(12, 17, 12, 3);
      break;
    case 'horns':
      x.beginPath(); x.moveTo(6, 26); x.quadraticCurveTo(2, 8, 10, 4); x.quadraticCurveTo(8, 14, 12, 24); x.closePath(); x.fill(); x.stroke();
      x.beginPath(); x.moveTo(26, 26); x.quadraticCurveTo(30, 8, 22, 4); x.quadraticCurveTo(24, 14, 20, 24); x.closePath(); x.fill(); x.stroke();
      break;
    case 'jacket':
      x.beginPath(); x.moveTo(8, 6); x.lineTo(24, 6); x.lineTo(28, 12); x.lineTo(24, 14); x.lineTo(24, 28); x.lineTo(8, 28); x.lineTo(8, 14); x.lineTo(4, 12); x.closePath(); x.fill(); x.stroke();
      x.strokeStyle = 'rgba(255,255,255,0.5)'; x.beginPath(); x.moveTo(16, 7); x.lineTo(16, 28); x.stroke();
      x.fillStyle = '#40e0ff'; x.fillRect(9, 18, 4, 2);
      break;
    case 'chip':
      x.fillStyle = '#1a2a22'; x.fillRect(7, 7, 18, 18); x.strokeRect(7, 7, 18, 18);
      x.fillStyle = '#c8b060';
      for (let i = 0; i < 4; i++) { x.fillRect(9 + i * 4, 3, 2, 4); x.fillRect(9 + i * 4, 25, 2, 4); x.fillRect(3, 9 + i * 4, 4, 2); x.fillRect(25, 9 + i * 4, 4, 2); }
      x.fillStyle = col; x.fillRect(11, 11, 10, 10);
      break;
    default:
      x.fillRect(8, 8, 16, 16);
  }
}

function drawSkill(x, id, color) {
  const g = x.createLinearGradient(0, 0, 0, 32);
  g.addColorStop(0, '#1e2a44');
  g.addColorStop(1, '#070a14');
  x.fillStyle = g;
  x.fillRect(0, 0, 32, 32);
  x.strokeStyle = color;
  x.fillStyle = color;
  x.lineWidth = 2.5;
  const line = (...pts) => { x.beginPath(); x.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.stroke(); };
  switch (id) {
    case 'dash':
      for (let i = 0; i < 3; i++) { x.globalAlpha = 0.4 + i * 0.25; line(4 + i * 3, 10 + i * 6, 18 + i * 3, 10 + i * 6); }
      x.globalAlpha = 1; line(20, 8, 29, 16, 20, 24);
      break;
    case 'slam':
      line(16, 3, 16, 18); line(3, 26, 10, 22, 16, 27, 22, 21, 29, 26); line(11, 14, 16, 20, 21, 14);
      break;
    case 'whirl':
      for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(16, 16, 5 + i * 4, i * 2, i * 2 + 3.6); x.stroke(); }
      break;
    case 'scatter':
      for (let i = -2; i <= 2; i++) line(6, 16, 27, 16 + i * 5);
      break;
    case 'grenade':
      x.beginPath(); x.arc(14, 19, 8, 0, Math.PI * 2); x.fill();
      line(18, 12, 23, 7); line(23, 7, 27, 9);
      break;
    case 'overdrive':
      for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(8 + i * 6, 10 + (i % 2) * 10, 2.5, 0, Math.PI * 2); x.fill(); }
      line(4, 27, 28, 27);
      break;
    case 'pierce':
      line(3, 16, 29, 16); x.lineWidth = 1.5; line(10, 10, 10, 22); line(18, 10, 18, 22);
      break;
    case 'backstep':
      line(24, 8, 12, 16, 24, 24); line(12, 16, 29, 16);
      break;
    case 'orbital':
      x.beginPath(); x.arc(16, 20, 8, 0, Math.PI * 2); x.stroke();
      line(16, 3, 16, 20); line(10, 20, 22, 20);
      break;
    case 'repair':
      x.fillRect(13, 6, 6, 20); x.fillRect(6, 13, 20, 6);
      break;
    case 'barrier':
      x.beginPath(); x.moveTo(16, 4); x.lineTo(26, 8); x.lineTo(24, 20); x.lineTo(16, 28); x.lineTo(8, 20); x.lineTo(6, 8); x.closePath(); x.stroke();
      break;
    case 'swarm':
      for (const [a, b] of [[10, 10], [22, 12], [15, 22]]) { x.beginPath(); x.arc(a, b, 3.5, 0, Math.PI * 2); x.fill(); }
      break;
    case 'sync':
      x.beginPath(); x.arc(16, 16, 11, 0, Math.PI * 2); x.stroke();
      line(17, 5, 11, 17, 17, 17, 14, 27);
      break;
  }
  x.strokeStyle = 'rgba(0,0,0,0.5)';
  x.lineWidth = 2;
  x.strokeRect(1, 1, 30, 30);
}
