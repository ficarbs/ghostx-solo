// Particles, floating combat text, timed visual effects, and message hooks.
import { G } from './state.js';
import { settings } from './settings.js';

export const rand = (a, b) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function addText(x, y, text, kind = 'dmg') {
  G.texts.push({ x, y, text: String(text), kind, t: 0, vx: rand(-12, 12) });
}

export function burst(x, y, color, n = 10, speed = 200, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = o.angle !== undefined ? o.angle + rand(-(o.spread ?? 0.5), o.spread ?? 0.5) : Math.random() * Math.PI * 2;
    const s = rand(speed * 0.3, speed);
    G.parts.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s + (o.up || 0),
      life: rand(0.3, 0.7) * (o.life || 1),
      t: 0,
      color,
      size: rand(2, 4) * (o.size || 1),
      grav: o.grav ?? 400,
      glow: !!o.glow,
    });
  }
}

export function shake(amount) {
  if (!settings.shake) return;
  G.cam.shake = Math.max(G.cam.shake, amount);
}

export function effect(e) {
  G.effects.push({ t: 0, ...e });
}

export function log(msg, cls = '') {
  G.hooks.log?.(msg, cls);
}

export function banner(title, sub = '') {
  G.hooks.banner?.(title, sub);
}

export function updateFx(dt) {
  for (const p of G.parts) {
    p.t += dt;
    p.vy += p.grav * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  G.parts = G.parts.filter((p) => p.t < p.life);
  if (G.parts.length > 900) G.parts.splice(0, G.parts.length - 900);

  for (const t of G.texts) {
    t.t += dt;
    t.y -= 50 * dt;
    t.x += t.vx * dt;
  }
  G.texts = G.texts.filter((t) => t.t < 1.1);

  for (const e of G.effects) e.t += dt;
  G.effects = G.effects.filter((e) => e.t < e.dur);

  G.cam.shake = Math.max(0, G.cam.shake - dt * 30);
}
