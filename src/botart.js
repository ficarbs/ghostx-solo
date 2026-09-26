// Procedural nanobot art, shared by the in-world companion, the held weapon forms, and UI portraits.
const PI = Math.PI;

function glow(x, color, r) {
  const g = x.createRadialGradient(0, 0, 1, 0, 0, r);
  g.addColorStop(0, color + 'aa');
  g.addColorStop(1, color + '00');
  x.fillStyle = g;
  x.beginPath(); x.arc(0, 0, r, 0, PI * 2); x.fill();
}

// Shell color by rarity: common white, rare pale steel, epic gunmetal.
const SHELL = ['#e8eef8', '#e8eef8', '#b8cce8', '#3a3e52'];

// Companion form, centered at (0,0), roughly 26px across at stage 1.
export function drawBot(x, type, stage, color, t = 0, rarity = 1) {
  const s = 1 + (stage - 1) * 0.18;
  x.save();
  x.scale(s, s);
  if (stage >= 3) glow(x, color, 26 + Math.sin(t * 4) * 2);
  else glow(x, color, 18);
  x.lineJoin = 'round';
  x.strokeStyle = 'rgba(0,0,0,0.55)';
  x.lineWidth = 1.5;
  const body = SHELL[rarity] || SHELL[1];
  if (rarity >= 3) {
    x.strokeStyle = color;
    x.lineWidth = 1.5;
  }

  if (stage >= 2) {
    // side panels / wings
    x.fillStyle = color;
    const flap = Math.sin(t * 10) * 2;
    x.beginPath(); x.moveTo(-9, -2); x.lineTo(-19, -8 + flap); x.lineTo(-15, 4); x.closePath(); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(9, -2); x.lineTo(19, -8 + flap); x.lineTo(15, 4); x.closePath(); x.fill(); x.stroke();
  }

  if (type === 'blade') {
    x.fillStyle = color;
    x.beginPath(); x.moveTo(0, -18); x.lineTo(4, -8); x.lineTo(-4, -8); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = body;
    x.beginPath(); x.moveTo(0, -10); x.lineTo(11, 0); x.lineTo(0, 11); x.lineTo(-11, 0); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#10141c';
    x.fillRect(-6, -2.5, 12, 5);
    x.fillStyle = color;
    x.fillRect(-4, -1.5, 8, 3);
  } else if (type === 'blaster') {
    x.fillStyle = '#5a606c';
    x.fillRect(6, 1, 11, 6); x.strokeRect(6, 1, 11, 6);
    x.fillStyle = body;
    x.beginPath(); x.arc(0, 0, 10, 0, PI * 2); x.fill(); x.stroke();
    x.fillStyle = color;
    x.beginPath(); x.arc(0, 0, 10, PI * 1.1, PI * 1.9); x.lineTo(0, 0); x.fill();
    x.fillStyle = '#10141c';
    x.beginPath(); x.arc(-3.5, 1, 2.2, 0, PI * 2); x.arc(3.5, 1, 2.2, 0, PI * 2); x.fill();
  } else if (type === 'sniper') {
    x.strokeStyle = color; x.lineWidth = 1.5;
    x.beginPath(); x.moveTo(-4, -7); x.lineTo(-7, -15); x.stroke();
    x.fillStyle = color; x.beginPath(); x.arc(-7, -15, 2, 0, PI * 2); x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.55)';
    x.fillStyle = body;
    x.beginPath(); x.ellipse(0, 0, 14, 7, 0, 0, PI * 2); x.fill(); x.stroke();
    x.fillStyle = '#10141c';
    x.beginPath(); x.arc(6, 0, 4.5, 0, PI * 2); x.fill();
    x.fillStyle = color;
    x.beginPath(); x.arc(6, 0, 2.6, 0, PI * 2); x.fill();
  } else if (type === 'medic') {
    x.strokeStyle = color; x.lineWidth = 2;
    x.beginPath(); x.ellipse(0, -13, 8, 2.5, 0, 0, PI * 2); x.stroke();
    x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 1.5;
    x.fillStyle = body;
    x.beginPath(); x.arc(0, 0, 10, 0, PI * 2); x.fill(); x.stroke();
    x.fillStyle = color;
    x.fillRect(-2, -6, 4, 12);
    x.fillRect(-6, -2, 12, 4);
  }

  if (stage >= 3) {
    x.fillStyle = '#ffe27a';
    for (const dx of [-5, 0, 5]) {
      x.beginPath(); x.moveTo(dx - 2, -12); x.lineTo(dx, -17 - (dx ? 0 : 3)); x.lineTo(dx + 2, -12); x.fill();
    }
  }
  x.restore();
}

// Weapon form held by the player. Drawn pointing along +x from the hand.
export function drawWeapon(x, type, stage, color) {
  x.save();
  x.lineJoin = 'round';
  x.shadowColor = color;
  x.shadowBlur = 6 + stage * 3;
  if (type === 'blade') {
    const len = 36 + stage * 5;
    x.fillStyle = color;
    x.beginPath(); x.moveTo(6, -3); x.lineTo(len, -2); x.lineTo(len + 8, 0); x.lineTo(len, 2.5); x.lineTo(6, 3); x.closePath(); x.fill();
    x.shadowBlur = 0;
    x.fillStyle = 'rgba(255,255,255,0.8)';
    x.fillRect(8, -1, len - 6, 1.5);
    x.fillStyle = '#2a2e38'; x.fillRect(-6, -2.5, 12, 5);
    x.fillStyle = '#e8eef8'; x.fillRect(3, -6, 3, 12);
  } else if (type === 'blaster') {
    x.shadowBlur = 0;
    x.fillStyle = '#2a2e38'; x.fillRect(-4, 0, 7, 10);
    x.fillStyle = '#e8eef8'; x.fillRect(-4, -6, 22 + stage * 2, 9);
    x.fillStyle = color; x.fillRect(18 + stage * 2, -5, 6, 7);
    x.fillStyle = '#5a606c'; x.fillRect(2, -9, 10, 4);
  } else if (type === 'sniper') {
    x.shadowBlur = 0;
    x.fillStyle = '#2a2e38'; x.fillRect(-10, -3, 10, 7); x.fillRect(-2, 2, 5, 8);
    x.fillStyle = '#e8eef8'; x.fillRect(0, -4, 34 + stage * 4, 6);
    x.fillStyle = color; x.fillRect(34 + stage * 4, -3, 6, 4);
    x.fillStyle = '#10141c'; x.fillRect(8, -9, 14, 5);
    x.fillStyle = color; x.fillRect(20, -8, 2, 3);
  } else if (type === 'medic') {
    x.fillStyle = '#e8eef8';
    x.beginPath(); x.arc(4, 0, 7, 0, PI * 2); x.fill();
    x.fillStyle = color;
    x.beginPath(); x.arc(12, 0, 5 + stage, 0, PI * 2); x.fill();
    x.shadowBlur = 0;
    x.fillStyle = '#fff';
    x.fillRect(11, -3, 2, 6); x.fillRect(9, -1, 6, 2);
  }
  x.restore();
}
