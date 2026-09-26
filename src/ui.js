// DOM overlay UI: HUD, combo meter, minimap, chat log, windows (inventory, character, nanobots, quests, shop, help), dialogs.
import { G } from './state.js';
import { ITEMS, NPCS, QUESTS, CURRENCY, VIEW_W, VIEW_H, BOTS, BOT_TYPES, BOT_TYPE_ORDER, BOT_ORDER, BOT_SKILLS, BOT_BASIC, BOT_CAP, BOT_MAX_LV, RARITY, RANKS, COMBO_TIME, expNeed, botExpNeed, sellPrice } from './data.js';
import * as input from './input.js';
import { itemIcon, skillIcon, botIcon } from './icons.js';
import { useSlot, unequip, addItem, canAdd, countItem, quickPotion } from './items.js';
import { recalc, revive } from './player.js';
import { activeBot, botByUid, botName, botType, botColor, botPower, stageOf, botSkills, equipBot, unslot, swapTo, fuse, fuseCost, release, STAGE_LV } from './bots.js';
import { currentQuest, questState, questReady, goalRows, acceptQuest, completeQuest } from './quests.js';
import { log as fxLog } from './fx.js';
import { MISSIONS, GRADES } from './data.js';
import { startMission, missionLocked, remaining, fmtTime } from './missions.js';
import { settings, updateSetting } from './settings.js';
import { deleteSave } from './save.js';
import { sfx, playMusic } from './audio.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let scale = 1;
let els;
const WINDOWS = {
  inv: { title: 'Inventory', x: 700, y: 60, w: 244 },
  char: { title: 'Character', x: 12, y: 112, w: 250 },
  bots: { title: 'Nanobots', x: 230, y: 40, w: 460 },
  quests: { title: 'Story Log', x: 290, y: 90, w: 330 },
  shop: { title: 'Shop', x: 150, y: 50, w: 300 },
  help: { title: 'How to Play', x: 250, y: 40, w: 460 },
  missions: { title: 'Mission Terminal', x: 220, y: 40, w: 480 },
  settings: { title: 'Settings', x: 330, y: 80, w: 300 },
};
const openWins = new Set();
let shopNpc = null;
let shopTab = 'buy';
let botTab = 'owned';
let labMode = false;
let dialogKind = null; // null | 'npc' | 'death'
let hudThrottle = 0;
let slotSig = '';

export function initUI({ onNew, onContinue, hasSave }) {
  els = {
    game: $('#game'),
    ui: $('#ui'),
    log: $('#log'),
    banner: $('#banner'),
    boss: $('#bossbar'),
    mini: $('#mini-map'),
    miniName: $('#mini-name'),
    dialog: $('#dialog'),
    tip: $('#tooltip'),
    title: $('#title'),
    slots: $('#hud-slots'),
    bots: $('#hud-bots'),
    combo: $('#combo'),
    windows: $('#windows'),
  };
  fitStage();
  window.addEventListener('resize', fitStage);

  G.hooks.log = log;
  G.hooks.banner = showBanner;
  G.hooks.talk = talkTo;
  G.hooks.death = showDeath;
  G.hooks.rankUp = (r) => {
    els.combo.querySelector('.c-rank').classList.remove('pop');
    void els.combo.offsetWidth;
    els.combo.querySelector('.c-rank').classList.add('pop');
  };
  G.hooks.missionResult = showResult;
  G.hooks.bossDown = (m) => {
    const p = G.player;
    if (m.ex || p.storyDone) return;
    p.storyDone = true;
    setTimeout(showEnding, 3500);
  };
  G.hooks.mapChanged = () => {
    closeWin('shop');
    els.miniName.textContent = G.map.def.name;
  };

  buildWindows();

  $('#hud-menu').addEventListener('click', (e) => {
    const b = e.target.closest('[data-win]');
    if (b) {
      if (b.dataset.win === 'bots') labMode = false;
      toggleWin(b.dataset.win);
    }
  });
  els.slots.addEventListener('click', (e) => {
    const s = e.target.closest('.slot');
    if (s?.dataset.kind === 'pot') quickPotion(s.dataset.key);
  });
  els.bots.addEventListener('click', (e) => {
    const s = e.target.closest('[data-swap]');
    if (s) swapTo(+s.dataset.swap);
  });

  // Title screen
  const nameInput = $('#title-name');
  $('#btn-new').addEventListener('click', () => {
    const name = nameInput.value.trim().slice(0, 12) || 'Hunter';
    if (hasSave() && !confirm('Start a new game? Your current save will be overwritten.')) return;
    els.title.classList.add('hidden');
    onNew(name);
    showWin('help');
  });
  const cont = $('#btn-continue');
  if (hasSave()) {
    cont.disabled = false;
    cont.addEventListener('click', () => {
      els.title.classList.add('hidden');
      onContinue();
    });
  }
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#btn-new').click();
  });

  // Tooltips for anything with data-item / data-skill / data-bot
  els.ui.addEventListener('mouseover', (e) => {
    const t = e.target.closest('[data-item],[data-skill],[data-bot]');
    if (!t) return;
    els.tip.innerHTML = t.dataset.item ? itemTip(t.dataset.item) : t.dataset.skill ? skillTip(t.dataset.skill) : botTip(+t.dataset.bot);
    if (!els.tip.innerHTML) return;
    els.tip.classList.remove('hidden');
  });
  els.ui.addEventListener('mouseout', (e) => {
    if (e.target.closest('[data-item],[data-skill],[data-bot]')) els.tip.classList.add('hidden');
  });
  els.ui.addEventListener('mousemove', (e) => {
    if (els.tip.classList.contains('hidden')) return;
    const r = els.game.getBoundingClientRect();
    let x = (e.clientX - r.left) / scale + 14;
    let y = (e.clientY - r.top) / scale + 14;
    const tw = els.tip.offsetWidth, th = els.tip.offsetHeight;
    if (x + tw > VIEW_W - 4) x -= tw + 28;
    if (y + th > VIEW_H - 4) y = VIEW_H - th - 4;
    els.tip.style.left = x + 'px';
    els.tip.style.top = y + 'px';
  });
  els.ui.addEventListener('contextmenu', (e) => e.preventDefault());
}

function fitStage() {
  scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  $('#game').style.transform = `scale(${scale})`;
}

// ---------- Per-frame ----------

export function frameUI(dt) {
  const p = G.player;
  if (input.wasPressed('esc')) handleEsc();
  if (!G.started || !p) return;
  els.ui.classList.add('playing');
  if (!dialogKind) {
    if (input.wasPressed('inv')) toggleWin('inv');
    if (input.wasPressed('char')) toggleWin('char');
    if (input.wasPressed('bots')) {
      labMode = false;
      toggleWin('bots');
    }
    if (input.wasPressed('quests')) toggleWin('quests');
    if (input.wasPressed('help')) toggleWin('help');
    if (input.wasPressed('settings')) toggleWin('settings');
    if (input.wasPressed('pause')) togglePause();
  }
  G.ui.blocking = !!dialogKind || openWins.has('shop');

  setBar('.bar.hp', p.hp, p.maxHp);
  setBar('.bar.mp', p.mp, p.maxMp);
  const need = expNeed(p.lv);
  setBar('.bar.exp', p.exp, need, `${p.exp} / ${need}  (${((p.exp / need) * 100).toFixed(1)}%)`);

  const ab = activeBot(p);
  const sig = p.slots.join(',') + '|' + p.active + '|' + (ab ? `${ab.sp}:${stageOf(ab)}` : '-');
  if (sig !== slotSig) {
    slotSig = sig;
    buildSlots();
  }

  hudThrottle -= dt;
  if (hudThrottle <= 0 || G.dirty) {
    hudThrottle = 0.15;
    $('#hud-lv').textContent = p.lv;
    $('#hud-name').textContent = p.name;
    $('#hud-gold').textContent = `${p.gold.toLocaleString()} ${CURRENCY}`;
    updateSlots();
    $('#hud-menu [data-win="char"]').classList.toggle('alert', p.statPts > 0);
    $('#hud-menu [data-win="quests"]').classList.toggle('alert', !!currentQuest() && questReady(currentQuest()));
  }
  updateCooldowns();
  updateCombo();
  drawMinimap();
  updateBoss();
  updateTracker();

  if (G.dirty) {
    G.dirty = false;
    for (const w of openWins) renderWin(w);
  }
}

function setBar(sel, v, max, text) {
  const b = els.ui.querySelector(sel);
  b.firstElementChild.style.width = `${Math.max(0, Math.min(1, v / max)) * 100}%`;
  b.querySelector('span').textContent = text ?? `${Math.max(0, Math.round(v))} / ${max}`;
}

function buildSlots() {
  const p = G.player;
  const bot = activeBot(p);
  const color = bot ? botColor(bot) : '#5ad8ff';
  const skills = botSkills(bot);
  els.slots.innerHTML = skills.map((sk) => `
    <div class="slot" data-kind="skill" data-key="${sk.id}" data-skill="${sk.id}">
      <img src="${skillIcon(sk.id, color).url}" alt=""><div class="cd"></div><b>${sk.key}</b><i></i>
    </div>`).join('') + `
    <div class="slot sync" data-kind="sync" data-skill="sync"><img src="${skillIcon('sync', '#ffe27a').url}" alt=""><div class="fillup"></div><b>F</b><i></i></div>
    <div class="slot" data-kind="pot" data-key="hp"><img src="${itemIcon('med_s').url}" alt=""><b>Q</b><i></i></div>
    <div class="slot" data-kind="pot" data-key="mp"><img src="${itemIcon('cell_s').url}" alt=""><b>W</b><i></i></div>`;
  els.bots.innerHTML = p.slots.map((uid, i) => {
    const b = uid != null ? botByUid(uid) : null;
    if (!b) return `<div class="bslot empty"><b>${i + 1}</b></div>`;
    return `<div class="bslot ${i === p.active ? 'on' : ''}" data-swap="${i}" data-bot="${b.uid}" style="--c:${botColor(b)}">
      <img src="${botIcon(b.sp, stageOf(b)).url}" alt=""><b>${i + 1}</b></div>`;
  }).join('');
}

function updateSlots() {
  const p = G.player;
  const bot = activeBot(p);
  for (const s of els.slots.children) {
    if (s.dataset.kind === 'skill') {
      const sk = botSkills(bot).find((k) => k.id === s.dataset.key);
      if (!sk) continue;
      const locked = !bot || bot.lv < sk.unlock;
      s.classList.toggle('locked', locked);
      s.querySelector('i').textContent = locked ? `L${sk.unlock}` : '';
    } else if (s.dataset.kind === 'pot') {
      const [a, b] = s.dataset.key === 'hp' ? ['med_s', 'med_m'] : ['cell_s', 'cell_m'];
      s.querySelector('i').textContent = countItem(a) + countItem(b);
    }
  }
}

function updateCooldowns() {
  const p = G.player;
  const bot = activeBot(p);
  for (const s of els.slots.children) {
    if (s.dataset.kind === 'skill') {
      const sk = botSkills(bot).find((k) => k.id === s.dataset.key);
      if (!sk) continue;
      s.querySelector('.cd').style.height = `${((p.cd[sk.id] || 0) / sk.cd) * 100}%`;
      s.classList.toggle('nomp', p.mp < sk.mp);
    } else if (s.dataset.kind === 'sync') {
      s.querySelector('.fillup').style.height = `${p.sync}%`;
      s.classList.toggle('ready', p.sync >= 100);
      s.querySelector('i').textContent = `${Math.floor(p.sync)}%`;
    }
  }
}

function updateCombo() {
  const p = G.player;
  const show = p.hits >= 3;
  els.combo.classList.toggle('hidden', !show);
  if (!show) return;
  const r = RANKS[p.rank];
  els.combo.querySelector('.c-num').textContent = p.hits;
  const rk = els.combo.querySelector('.c-rank');
  rk.textContent = r.name;
  rk.style.color = r.color;
  els.combo.querySelector('.c-bonus').textContent = r.exp ? `+${Math.round(r.exp * 100)}% EXP · +${Math.round(r.dmg * 100)}% DMG` : '';
  els.combo.querySelector('.c-timer').style.width = `${(p.hitT / COMBO_TIME) * 100}%`;
}

function drawMinimap() {
  const c = els.mini, x = c.getContext('2d'), m = G.map;
  const s = Math.min(c.width / m.w, c.height / m.h);
  const ox = (c.width - m.w * s) / 2, oy = (c.height - m.h * s) / 2;
  x.clearRect(0, 0, c.width, c.height);
  x.fillStyle = 'rgba(255,255,255,0.35)';
  for (const pl of m.plats) x.fillRect(ox + pl.x * s, oy + pl.y * s, Math.max(1, pl.w * s), pl.floor ? 2 : 1.5);
  x.fillStyle = 'rgba(160,170,190,0.6)';
  for (const r of m.ropes) x.fillRect(ox + r.x * s, oy + r.top * s, 1, (r.bottom - r.top) * s);
  x.fillStyle = '#7ad0ff';
  for (const pt of m.portals) x.fillRect(ox + pt.x * s - 2, oy + m.def.floor * s - 6, 4, 6);
  x.fillStyle = '#8affb0';
  for (const n of m.npcs) x.fillRect(ox + n.x * s - 1.5, oy + m.def.floor * s - 5, 3, 5);
  x.fillStyle = '#ff5a6a';
  for (const mb of G.mobs) if (mb.alive) x.fillRect(ox + mb.x * s - 1.5, oy + (mb.y - 6) * s - 1.5, mb.d.kind === 'boss' ? 5 : 3, 3);
  const p = G.player;
  x.fillStyle = '#ffe14a';
  x.beginPath(); x.arc(ox + p.x * s, oy + (p.y - 8) * s, 3, 0, Math.PI * 2); x.fill();
}

function updateBoss() {
  const b = G.boss;
  els.boss.classList.toggle('hidden', !b);
  if (!b) return;
  els.boss.querySelector('.bb-name').textContent = `${b.name}  ·  Lv ${b.lv}`;
  els.boss.querySelector('.bb-fill').style.width = `${(b.hp / b.maxHp) * 100}%`;
}

// ---------- Log & banner ----------

export function log(msg, cls = '') {
  const d = document.createElement('div');
  d.className = 'ln ' + cls;
  d.textContent = msg;
  els.log.appendChild(d);
  while (els.log.children.length > 40) els.log.firstChild.remove();
  els.log.scrollTop = els.log.scrollHeight;
}

let bannerTimer;
function showBanner(title, sub) {
  els.banner.querySelector('.b-title').textContent = title;
  els.banner.querySelector('.b-sub').textContent = sub;
  els.banner.classList.remove('hidden', 'show');
  void els.banner.offsetWidth;
  els.banner.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => els.banner.classList.add('hidden'), 2600);
}

// ---------- Windows ----------

function buildWindows() {
  for (const [id, w] of Object.entries(WINDOWS)) {
    const el = document.createElement('div');
    el.className = 'win hidden';
    el.id = 'win-' + id;
    el.style.left = w.x + 'px';
    el.style.top = w.y + 'px';
    el.style.width = w.w + 'px';
    el.innerHTML = `<div class="win-head"><span>${w.title}</span><button class="x" title="Close">×</button></div><div class="win-body"></div>`;
    el.querySelector('.x').addEventListener('click', () => closeWin(id));
    el.addEventListener('mousedown', () => focusWin(el));
    makeDraggable(el, el.querySelector('.win-head'));
    els.windows.appendChild(el);
    const body = el.querySelector('.win-body');
    body.addEventListener('click', (e) => onWinClick(id, e));
    body.addEventListener('dblclick', (e) => onWinDbl(id, e));
    body.addEventListener('contextmenu', (e) => onWinDbl(id, e));
    body.addEventListener('input', onSettingInput);
    body.addEventListener('change', onSettingInput);
  }
}

let zTop = 10;
function focusWin(el) {
  el.style.zIndex = ++zTop;
}

function makeDraggable(el, handle) {
  handle.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    const sx = e.clientX, sy = e.clientY;
    const ox = parseFloat(el.style.left), oy = parseFloat(el.style.top);
    const move = (ev) => {
      el.style.left = Math.max(-el.offsetWidth + 60, Math.min(VIEW_W - 60, ox + (ev.clientX - sx) / scale)) + 'px';
      el.style.top = Math.max(0, Math.min(VIEW_H - 30, oy + (ev.clientY - sy) / scale)) + 'px';
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  });
}

function showWin(id) {
  openWins.add(id);
  const el = $('#win-' + id);
  el.classList.remove('hidden');
  focusWin(el);
  renderWin(id);
}

function closeWin(id) {
  openWins.delete(id);
  $('#win-' + id).classList.add('hidden');
  els.tip.classList.add('hidden');
  if (id === 'shop') shopNpc = null;
  if (id === 'bots') labMode = false;
}

function toggleWin(id) {
  if (!G.started) return;
  openWins.has(id) ? closeWin(id) : showWin(id);
}

function handleEsc() {
  if (dialogKind === 'npc') return closeDialog();
  if (dialogKind === 'death') return;
  if (openWins.size) {
    for (const w of [...openWins]) closeWin(w);
    return;
  }
  if (G.started) showWin('help');
}

function renderWin(id) {
  const body = $('#win-' + id + ' .win-body');
  body.innerHTML = { inv: invHTML, char: charHTML, bots: botsHTML, quests: questsHTML, shop: shopHTML, help: helpHTML, missions: missionsHTML, settings: settingsHTML }[id]();
  if (id === 'shop') $('#win-shop .win-head span').textContent = shopNpc ? NPCS[shopNpc].name : 'Shop';
  if (id === 'bots') $('#win-bots .win-head span').textContent = labMode ? 'Nano Lab · Tech Jin' : 'Nanobots';
}

function invHTML() {
  const p = G.player;
  const cells = p.inv.map((s, i) => {
    if (!s) return `<div class="cell"></div>`;
    const it = ITEMS[s.id];
    return `<div class="cell ${it.rare ? 'rare' : ''}" data-slot="${i}" data-item="${s.id}"><img src="${itemIcon(s.id).url}" alt="">${s.qty > 1 ? `<b>${s.qty}</b>` : ''}</div>`;
  }).join('');
  return `<div class="grid">${cells}</div>
    <div class="inv-foot"><span class="coin"></span>${p.gold.toLocaleString()} ${CURRENCY}</div>
    <div class="hint">Double-click or right-click to use / equip.${openWins.has('shop') ? ' Shift-click to sell.' : ''}</div>`;
}

function charHTML() {
  const p = G.player;
  const bot = activeBot(p);
  const slot = (k, label) => {
    const id = p.equip[k];
    return `<div class="eq" data-unequip="${k}" ${id ? `data-item="${id}"` : ''}>
      <div class="cell ${id && ITEMS[id].rare ? 'rare' : ''}">${id ? `<img src="${itemIcon(id).url}" alt="">` : ''}</div>
      <div><small>${label}</small><div>${id ? esc(ITEMS[id].name) : '<span class="dim">—</span>'}</div></div></div>`;
  };
  const stat = (k, label) => `<div class="stat"><span>${label}</span><b>${p[k]}</b>${p.base[k] !== p[k] ? `<small>(${p.base[k]}+${p[k] - p.base[k]})</small>` : ''}${p.statPts > 0 ? `<button data-stat="${k}">+</button>` : ''}</div>`;
  const need = expNeed(p.lv);
  return `
    <div class="char-top"><div class="big">${esc(p.name)}</div><div>GhostX Hunter · Lv ${p.lv}</div><div class="dim">EXP ${p.exp} / ${need}</div></div>
    <div class="eqs three">${slot('head', 'Head')}${slot('body', 'Body')}${slot('chip', 'Chip')}</div>
    ${bot ? `<div class="eq-bot" style="--c:${botColor(bot)}"><img src="${botIcon(bot.sp, stageOf(bot)).url}" alt=""><div><small>Active nanobot</small><div>${esc(botName(bot))} ${stars(bot)}</div><small class="dim">${BOT_TYPES[botType(bot)].name} · Lv ${bot.lv} · Power +${Math.round(botPower(bot))}</small></div></div>` : ''}
    <div class="stats">
      <div class="stat"><span>HP</span><b>${Math.round(p.hp)} / ${p.maxHp}</b></div>
      <div class="stat"><span>EN</span><b>${Math.round(p.mp)} / ${p.maxMp}</b></div>
      <div class="stat"><span>Attack</span><b>${Math.floor(p.atk * 0.88)} – ${Math.ceil(p.atk * 1.12)}</b></div>
      <div class="stat"><span>Defense</span><b>${Math.floor(p.def)}</b></div>
      <div class="stat"><span>Critical</span><b>${Math.round(p.crit * 100)}%</b></div>
      <div class="stat"><span>Best combo</span><b>${p.bestCombo}</b></div>
      <hr>
      ${stat('str', 'STR')}${stat('dex', 'DEX')}${stat('vit', 'VIT')}
      <div class="pts ${p.statPts ? 'on' : ''}">Stat points: ${p.statPts}</div>
      <div class="hint">STR: attack · DEX: critical chance · VIT: HP & defense</div>
    </div>`;
}

const stars = (b) => (b.stars ? `<span class="stars">${'★'.repeat(b.stars)}</span>` : '');

function botsHTML() {
  const p = G.player;
  const tabs = `<div class="tabs"><button class="${botTab === 'owned' ? 'on' : ''}" data-btab="owned">Collection (${p.bots.length}/${BOT_CAP})</button><button class="${botTab === 'dex' ? 'on' : ''}" data-btab="dex">Nanodex (${p.seen.length}/${BOT_ORDER.length})</button>${labMode ? `<span class="gold">${p.gold.toLocaleString()} ${CURRENCY}</span>` : ''}</div>`;
  const equipped = `<div class="bot-slots">${p.slots.map((uid, i) => {
    const b = uid != null ? botByUid(uid) : null;
    return `<div class="bot-slot ${i === p.active ? 'on' : ''}" ${b ? `data-bot="${b.uid}" style="--c:${botColor(b)}"` : ''}>
      <small>Slot ${i + 1}</small>${b ? `<img src="${botIcon(b.sp, stageOf(b)).url}" alt=""><div>${esc(botName(b))}</div>${p.slots.filter((s) => s != null).length > 1 ? `<button data-unslot="${i}">Remove</button>` : ''}` : '<div class="dim">Empty</div>'}
    </div>`;
  }).join('')}</div>`;

  if (botTab === 'dex') {
    return tabs + `<div class="dex">${BOT_ORDER.map((sp) => {
      const seen = p.seen.includes(sp);
      const s = BOTS[sp];
      return `<div class="dex-card ${seen ? '' : 'unseen'}" style="--c:${BOT_TYPES[s.type].color}">
        <img src="${botIcon(sp, seen ? 3 : 1, !seen).url}" alt="">
        <div><b>${seen ? esc(s.evo.join(' → ')) : '???'}</b><br><small class="dim">${RARITY[s.rarity]} ${BOT_TYPES[s.type].name}${seen ? ` · ${s.persona}` : ''}</small></div></div>`;
    }).join('')}</div><div class="hint">Nanobot cores drop from demons. Rarer cores come from tougher demons. Capsules are sold by Dr. Mina.</div>`;
  }

  const sorted = [...p.bots].sort((a, b) => BOT_TYPE_ORDER.indexOf(botType(a)) - BOT_TYPE_ORDER.indexOf(botType(b)) || b.lv - a.lv);
  const cards = sorted.map((b) => {
    const s = BOTS[b.sp];
    const slotted = p.slots.indexOf(b.uid);
    const dupes = p.bots.filter((o) => o !== b && o.sp === b.sp && !p.slots.includes(o.uid));
    const expPct = b.lv >= BOT_MAX_LV ? 100 : (b.exp / botExpNeed(b.lv)) * 100;
    const nextEvo = STAGE_LV.find((l) => l > b.lv);
    return `<div class="bot-card" style="--c:${botColor(b)}" data-bot="${b.uid}">
      <img src="${botIcon(b.sp, stageOf(b)).url}" alt="">
      <div class="grow">
        <div><b>${esc(botName(b))}</b> ${stars(b)} <span class="rar r${s.rarity}">${RARITY[s.rarity]}</span></div>
        <small class="dim">${BOT_TYPES[s.type].name} · Lv ${b.lv}${nextEvo && stageOf(b) < 3 ? ` · evolves at ${nextEvo}` : ''} · Power +${Math.round(botPower(b))}</small>
        <div class="bexp"><div style="width:${expPct}%"></div></div>
      </div>
      <div class="bot-actions">
        ${slotted >= 0 ? `<span class="tag">Slot ${slotted + 1}</span>` : [0, 1, 2].map((i) => `<button data-equipbot="${b.uid}" data-to="${i}">${i + 1}</button>`).join('')}
        ${labMode && dupes.length && b.stars < 5 ? `<button class="primary" data-fuse="${b.uid}" data-with="${dupes[0].uid}" ${p.gold < fuseCost(b) ? 'disabled' : ''}>Fuse ${fuseCost(b)}</button>` : ''}
        ${labMode && slotted < 0 ? `<button data-release="${b.uid}">Scrap</button>` : ''}
      </div>
    </div>`;
  }).join('');
  return tabs + equipped + `<div class="bot-list">${cards}</div>
    <div class="hint">${labMode ? 'Fuse a duplicate of the same species into a bot for +1★ (+10% power, max 5★).' : 'Click 1/2/3 on a bot to put it in that slot. Fuse duplicates at Tech Jin\'s Nano Lab.'}</div>`;
}

function questsHTML() {
  const p = G.player;
  const active = QUESTS.filter((q) => p.quests[q.id]?.status === 'active');
  const done = QUESTS.filter((q) => p.quests[q.id]?.status === 'done');
  const cur = currentQuest();
  let html = '';
  if (!active.length) {
    html += `<div class="dim q-empty">${cur ? (p.lv >= cur.lv ? 'Captain Yoon at GhostX HQ has a mission for you.' : `Reach level ${cur.lv} for your next mission from Captain Yoon.`) : 'All missions complete. The city is safe.'}</div>`;
  }
  for (const q of active) {
    const ready = questReady(q);
    html += `<div class="quest"><div class="q-name">${esc(q.name)} ${ready ? '<span class="ready">Ready to turn in</span>' : ''}</div>
      ${goalRows(q).map((r) => `<div class="q-row ${r.have >= r.need ? 'ok' : ''}"><span>${esc(r.label)}</span><b>${r.have} / ${r.need}</b></div>`).join('')}
      <div class="dim">${esc(ready ? 'Return to Captain Yoon.' : q.progress)}</div></div>`;
  }
  if (done.length) html += `<div class="q-done">Completed: ${done.map((q) => esc(q.name)).join(' · ')}</div>`;
  return html;
}

function shopHTML() {
  if (!shopNpc) return '';
  const p = G.player;
  const tabs = `<div class="tabs"><button class="${shopTab === 'buy' ? 'on' : ''}" data-tab="buy">Buy</button><button class="${shopTab === 'sell' ? 'on' : ''}" data-tab="sell">Sell</button><span class="gold">${p.gold.toLocaleString()} ${CURRENCY}</span></div>`;
  if (shopTab === 'buy') {
    return tabs + `<div class="shop-list">` + NPCS[shopNpc].shop.map((id) => {
      const it = ITEMS[id];
      const stack = it.type !== 'equip';
      const tooLow = it.lv && p.lv < it.lv;
      return `<div class="row" data-item="${id}"><div class="cell"><img src="${itemIcon(id).url}" alt=""></div>
        <div class="grow"><div>${esc(it.name)}</div><small class="${tooLow ? 'bad' : 'dim'}">${it.lv ? `Lv ${it.lv} · ` : ''}${it.price} ${CURRENCY}</small></div>
        <button data-buy="${id}" data-n="1" ${p.gold < it.price ? 'disabled' : ''}>Buy</button>
        ${stack && !it.capsule ? `<button data-buy="${id}" data-n="10" ${p.gold < it.price * 10 ? 'disabled' : ''}>×10</button>` : ''}</div>`;
    }).join('') + `</div>`;
  }
  const rows = p.inv.map((s, i) => (s ? { s, i } : null)).filter(Boolean);
  if (!rows.length) return tabs + `<div class="dim q-empty">Nothing to sell.</div>`;
  return tabs + `<div class="shop-list">` + rows.map(({ s, i }) => {
    const it = ITEMS[s.id];
    const v = sellPrice(s.id);
    return `<div class="row" data-item="${s.id}"><div class="cell ${it.rare ? 'rare' : ''}"><img src="${itemIcon(s.id).url}" alt="">${s.qty > 1 ? `<b>${s.qty}</b>` : ''}</div>
      <div class="grow"><div>${esc(it.name)}</div><small class="dim">${v} ${CURRENCY} each</small></div>
      <button data-sell="${i}" data-n="1">Sell</button>${s.qty > 1 ? `<button data-sell="${i}" data-n="all">All</button>` : ''}</div>`;
  }).join('') + `</div><button class="wide" data-sellall="etc">Sell all loot (etc items)</button>`;
}

function helpHTML() {
  return `<div class="help">
    <div class="keys">
      <div><kbd>←</kbd><kbd>→</kbd> Move</div>
      <div><kbd>↑</kbd> Climb · enter gate · talk</div>
      <div><kbd>↓</kbd> Climb down · <kbd>↓</kbd>+jump to drop</div>
      <div><kbd>X</kbd> / <kbd>Alt</kbd> / <kbd>Space</kbd> Jump</div>
      <div><kbd>Z</kbd> / <kbd>Ctrl</kbd> Attack (hold)</div>
      <div><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> Swap nanobot</div>
      <div><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Nanobot skills</div>
      <div><kbd>F</kbd> Nano Sync (full gauge)</div>
      <div><kbd>Q</kbd> Med pack · <kbd>W</kbd> Energy cell</div>
      <div><kbd>N</kbd> Nanobots · <kbd>I</kbd> Bag · <kbd>C</kbd> Char</div>
      <div><kbd>J</kbd> Story · <kbd>O</kbd> Settings</div>
      <div><kbd>R</kbd> Hoverboard · <kbd>Tab</kbd> Next bot</div>
      <div><kbd>P</kbd> Pause · <kbd>H</kbd> Help</div>
      <div><kbd>Esc</kbd> Close</div>
    </div>
    <p><b>No classes, just nanobots.</b> Your active nanobot is your weapon: <span style="color:${BOT_TYPES.blade.color}">Blade</span> for melee, <span style="color:${BOT_TYPES.blaster.color}">Blaster</span> for short range, <span style="color:${BOT_TYPES.sniper.color}">Sniper</span> for long range, <span style="color:${BOT_TYPES.medic.color}">Medic</span> for support. Swap mid-fight to chain combos. Bots level up and <b>evolve</b> at levels 6 and 12.</p>
    <p><b>Combos:</b> keep hitting to climb the ranks from D to SSS for bonus EXP and damage. Getting hit breaks the combo. Hits fill the <b>Sync</b> gauge. At 100%, press F.</p>
    <p><b>Mission Terminal</b> (east side of Metro Central): repeatable wave operations graded S–C, with elite demons and better nanobot drops.</p>
    <p class="dim">Route: Metro Central → Neon Alley → Line 9 Depot → Skyline Rooftops → Rift Core. Autosaves. On macOS, use Z instead of Ctrl to attack.</p>
  </div>`;
}

function onWinClick(id, e) {
  const p = G.player;
  const t = e.target.closest('button, [data-slot], [data-unequip]');
  if (!t) return;
  const d = t.dataset;
  if (d.stat && p.statPts > 0) {
    p.base[d.stat]++;
    p.statPts--;
    recalc(p);
    G.dirty = true;
  } else if (d.tab) {
    shopTab = d.tab;
    G.dirty = true;
  } else if (d.btab) {
    botTab = d.btab;
    G.dirty = true;
  } else if (d.equipbot) {
    equipBot(+d.equipbot, +d.to);
  } else if (d.unslot !== undefined) {
    unslot(+d.unslot);
  } else if (d.fuse) {
    fuse(+d.fuse, +d.with);
  } else if (d.release) {
    if (confirm('Scrap this nanobot for credits? This cannot be undone.')) release(+d.release);
  } else if (d.launch) {
    closeWin('missions');
    startMission(d.launch);
  } else if (d.open) {
    showWin(d.open);
  } else if (d.reset) {
    if (confirm('Delete your save and return to the title screen? This cannot be undone.')) {
      G.started = false;
      deleteSave();
      location.reload();
    }
  } else if (d.buy) {
    buy(d.buy, +d.n);
  } else if (d.sell !== undefined) {
    sellSlot(+d.sell, d.n === 'all');
  } else if (d.sellall) {
    p.inv.forEach((s, i) => s && ITEMS[s.id].type === 'etc' && sellSlot(i, true, true));
  } else if (d.slot !== undefined && e.shiftKey && openWins.has('shop')) {
    sellSlot(+d.slot, true);
  }
}

function onWinDbl(id, e) {
  e.preventDefault();
  const t = e.target.closest('[data-slot], [data-unequip]');
  if (!t) return;
  if (t.dataset.slot !== undefined) useSlot(+t.dataset.slot);
  else if (t.dataset.unequip) unequip(t.dataset.unequip);
  els.tip.classList.add('hidden');
}

function buy(id, n) {
  const p = G.player;
  const it = ITEMS[id];
  const cost = it.price * n;
  if (p.gold < cost) return fxLog(`Not enough ${CURRENCY}.`, 'warn');
  if (!canAdd(id, n)) return fxLog('Your bag is full.', 'warn');
  p.gold -= cost;
  addItem(id, n);
  sfx('buy');
  fxLog(`Bought ${n > 1 ? n + '× ' : ''}${it.name} for ${cost} ${CURRENCY}.`, 'loot');
  G.dirty = true;
}

function sellSlot(i, all, quiet) {
  const p = G.player;
  const s = p.inv[i];
  if (!s) return;
  const n = all ? s.qty : 1;
  const v = sellPrice(s.id) * n;
  const name = ITEMS[s.id].name;
  s.qty -= n;
  if (s.qty <= 0) p.inv[i] = null;
  p.gold += v;
  G.dirty = true;
  if (!quiet || v) fxLog(`Sold ${n > 1 ? n + '× ' : ''}${name} for ${v} ${CURRENCY}.`, 'loot');
}

// ---------- Tooltips ----------

function itemTip(id) {
  const it = ITEMS[id];
  const p = G.player;
  const stats = [['def', 'Defense'], ['str', 'STR'], ['dex', 'DEX'], ['vit', 'VIT'], ['hp', it.type === 'use' ? 'Restores HP' : 'Max HP'], ['mp', 'Restores EN']]
    .filter(([k]) => it[k]).map(([k, l]) => `<div>${l} <b>+${it[k]}</b></div>`).join('');
  const kind = it.type === 'equip' ? { head: 'Head', body: 'Body', chip: 'Chip' }[it.slot] : it.type === 'use' ? 'Consumable' : it.type === 'key' ? 'Key item' : 'Loot';
  return `<div class="t-name ${it.rare ? 'rare' : ''}">${esc(it.name)}</div><div class="dim">${kind}</div>
    ${it.lv ? `<div class="${p && p.lv < it.lv ? 'bad' : 'dim'}">Requires level ${it.lv}</div>` : ''}
    ${stats}<div class="t-desc">${esc(it.desc)}</div><div class="dim">Sells for ${sellPrice(id)} ${CURRENCY}</div>`;
}

function skillTip(id) {
  if (id === 'sync') {
    return `<div class="t-name">Nano Sync <span class="dim">[F]</span></div><div class="t-desc">Needs a full Sync gauge, which fills as you land hits. Your nanobot overloads and strikes every demon on screen 6 times. You're invulnerable while it lasts.</div>`;
  }
  const bot = activeBot();
  const sk = botSkills(bot).find((k) => k.id === id);
  if (!sk) return '';
  return `<div class="t-name">${sk.name} <span class="dim">[${sk.key}]</span></div>
    <div class="dim">${sk.mp} EN · ${sk.cd}s cooldown${sk.mult ? ` · ${Math.round(sk.mult * 100)}% damage` : ''}</div>
    <div class="t-desc">${sk.desc}</div>${bot.lv < sk.unlock ? `<div class="bad">Unlocks at nanobot level ${sk.unlock}</div>` : ''}`;
}

function botTip(uid) {
  const b = botByUid(uid);
  if (!b) return '';
  const s = BOTS[b.sp];
  const type = botType(b);
  const skills = BOT_SKILLS[type].map((k) => `<div class="${b.lv >= k.unlock ? '' : 'dim'}">${k.key} · ${k.name}${b.lv >= k.unlock ? '' : ` (Lv ${k.unlock})`}</div>`).join('');
  return `<div class="t-name" style="color:${botColor(b)}">${esc(botName(b))} ${'★'.repeat(b.stars)}</div>
    <div class="dim">${RARITY[s.rarity]} ${BOT_TYPES[type].name} · Lv ${b.lv} · ${s.persona}</div>
    <div>Power <b>+${Math.round(botPower(b))}</b></div>
    <div class="t-desc">Z · ${BOT_BASIC[type].desc}</div>${skills}`;
}

// ---------- Dialogs ----------

function showDialog(kind, name, html, buttons) {
  dialogKind = kind;
  els.dialog.innerHTML = `<div class="d-name">${esc(name)}</div><div class="d-text">${html}</div><div class="d-btns"></div>`;
  const bar = els.dialog.querySelector('.d-btns');
  for (const b of buttons) {
    const el = document.createElement('button');
    el.textContent = b.label;
    if (b.primary) el.className = 'primary';
    el.addEventListener('click', b.fn);
    bar.appendChild(el);
  }
  els.dialog.classList.remove('hidden');
  G.ui.blocking = true;
}

function closeDialog() {
  dialogKind = null;
  els.dialog.classList.add('hidden');
  els.dialog.innerHTML = '';
}

function talkTo(id) {
  const npc = NPCS[id];
  if (npc.role === 'quest') return talkCaptain();
  if (npc.role === 'missions') {
    sfx('ui');
    return showWin('missions');
  }
  const buttons = [{ label: 'Shop', primary: true, fn: () => { closeDialog(); openShop(id); } }];
  if (npc.lab) buttons.push({ label: 'Nano Lab', primary: true, fn: () => { closeDialog(); openLab(); } });
  buttons.push({ label: 'Goodbye', fn: closeDialog });
  showDialog('npc', npc.name, esc(npc.greet), buttons);
}

function openShop(id) {
  shopNpc = id;
  shopTab = 'buy';
  showWin('shop');
  if (!openWins.has('inv')) showWin('inv');
}

function openLab() {
  labMode = true;
  botTab = 'owned';
  showWin('bots');
}

function rewardLine(q) {
  const items = (q.reward.items || []).map(([id, n]) => `${n > 1 ? n + '× ' : ''}${ITEMS[id].name}`);
  const bots = (q.reward.bots || []).map((sp) => `nanobot ${BOTS[sp].evo[0]}`);
  const all = [...items, ...bots];
  return `<div class="reward">Reward: ${q.reward.exp} EXP · ${q.reward.gold} ${CURRENCY}${all.length ? ' · ' + esc(all.join(', ')) : ''}</div>`;
}

function talkCaptain() {
  const name = NPCS.captain.name;
  const q = currentQuest();
  const p = G.player;
  if (!q) {
    return showDialog('npc', name, 'The rift is sealed. Take some leave, hunter. You\'ve earned it.', [{ label: 'Dismissed', fn: closeDialog }]);
  }
  const st = questState(q.id);
  if (!st) {
    if (p.lv < q.lv) {
      return showDialog('npc', name, `${esc(NPCS.captain.greet)}<br><br><span class="dim">Report back when you've reached level ${q.lv}.</span>`, [{ label: 'Roger', fn: closeDialog }]);
    }
    return showDialog('npc', name, `<b class="q-title">${esc(q.name)}</b><br>${esc(q.offer)}${rewardLine(q)}`, [
      { label: 'Accept', primary: true, fn: () => { acceptQuest(q); closeDialog(); } },
      { label: 'Not now', fn: closeDialog },
    ]);
  }
  if (questReady(q)) {
    return showDialog('npc', name, `<b class="q-title">${esc(q.name)}</b><br>${esc(q.done)}${rewardLine(q)}`, [
      { label: 'Complete', primary: true, fn: () => { if (completeQuest(q)) talkCaptain(); } },
    ]);
  }
  const rows = goalRows(q).map((r) => `<div class="q-row ${r.have >= r.need ? 'ok' : ''}"><span>${esc(r.label)}</span><b>${r.have} / ${r.need}</b></div>`).join('');
  showDialog('npc', name, `<b class="q-title">${esc(q.name)}</b><br>${esc(q.progress)}${rows}`, [{ label: 'On it', fn: closeDialog }]);
}

function showDeath(loss) {
  setTimeout(() => {
    showDialog('death', 'Knocked out', `Your nanobots drag you out of the fight...<br><span class="dim">Lost ${loss} EXP.</span>`, [
      { label: 'Return to Metro Central', primary: true, fn: () => { closeDialog(); revive(); } },
    ]);
  }, 900);
}

// ---------- Missions ----------

function missionsHTML() {
  const p = G.player;
  return `<div class="dim" style="margin-bottom:6px">GHOSTX TACTICAL NETWORK · Instanced operations. Clear every wave. Grade depends on time, damage taken and best combo.</div>` +
    MISSIONS.map((m) => {
      const lock = missionLocked(m);
      const rec = p.missions[m.id];
      const g = rec?.best ? GRADES.find((x) => x.name === rec.best) : null;
      return `<div class="mission ${lock ? 'locked' : ''}">
        <div class="m-grade" style="color:${g ? g.color : '#3a4460'}">${g ? g.name : '–'}</div>
        <div class="grow">
          <div><b>${esc(m.name)}</b> <span class="dim">· Lv ${m.lv} · ${m.waves.length} wave${m.waves.length > 1 ? 's' : ''} · par ${fmtTime(m.par)}</span>${m.post ? ' <span class="rar r3">Post-game</span>' : ''}</div>
          <small class="dim">${esc(m.desc)}</small>
          <small>${m.reward.exp} EXP · ${m.reward.gold} ${CURRENCY} · core drops${rec ? ` · cleared ${rec.clears}× · best ${fmtTime(rec.bestTime)}` : ''}</small>
        </div>
        ${lock ? `<small class="bad">${lock}</small>` : `<button class="primary" data-launch="${m.id}">Launch</button>`}
      </div>`;
    }).join('') + `<div class="hint">Grade multiplies rewards: S ×1.5 · A ×1.2 · B ×1.0 · C ×0.8. A Recall Beacon or getting knocked out aborts the mission.</div>`;
}

function updateTracker() {
  const el = $('#mtrack');
  const M = G.mission;
  el.classList.toggle('hidden', !M || M.state === 'done');
  if (!M || M.state === 'done') return;
  const wave = Math.max(1, M.wave + 1);
  el.innerHTML = `<b>${esc(M.def.name)}</b> · Wave ${wave}/${M.def.waves.length} · ${fmtTime(M.t)} <span class="dim">/ par ${fmtTime(M.def.par)}</span>${M.state === 'fight' ? ` · ${remaining()} left` : ''}`;
}

function showResult(r) {
  const got = r.got.length ? `<div class="reward">Bonus: ${esc(r.got.join(', '))}</div>` : '';
  setTimeout(() => {
    showDialog('npc', 'Mission Complete', `
      <div class="result">
        <div class="r-grade" style="color:${r.grade.color}">${r.grade.name}</div>
        <div class="r-stats">
          <div><b>${esc(r.def.name)}</b></div>
          <div>Time <b>${fmtTime(r.time)}</b> <span class="dim">(par ${fmtTime(r.def.par)})</span></div>
          <div>Damage taken <b>${r.dmg}</b></div>
          <div>Best combo <b>${r.best}</b></div>
          <div class="reward">+${r.exp} EXP · +${r.gold} ${CURRENCY} (×${r.grade.mult})</div>${got}
        </div>
      </div>`, [
      { label: 'Return to HQ', primary: true, fn: () => { closeDialog(); G.hooks.travel('plaza', 'spawn'); } },
      { label: 'Stay (collect loot)', fn: closeDialog },
    ]);
  }, 1200);
}

// ---------- Settings, pause, ending ----------

function settingsHTML() {
  const slider = (k, label) => `<div class="set"><label>${label}</label><input type="range" min="0" max="1" step="0.05" value="${settings[k]}" data-set="${k}"><span>${Math.round(settings[k] * 100)}%</span></div>`;
  return `${slider('master', 'Master')}${slider('music', 'Music')}${slider('sfx', 'Effects')}
    <label class="set check"><input type="checkbox" data-set="shake" ${settings.shake ? 'checked' : ''}> Screen shake</label>
    <div class="set-btns"><button data-open="help">Controls</button><button data-reset="1" class="danger">Delete save</button></div>
    <div class="hint">P pauses. Gamepads are supported (A jump · X attack · B/Y/RB skills · RT sync · LB swap).</div>`;
}

function onSettingInput(e) {
  const k = e.target.dataset.set;
  if (!k) return;
  const v = e.target.type === 'checkbox' ? e.target.checked : +e.target.value;
  updateSetting(k, v);
  const span = e.target.parentElement.querySelector('span');
  if (span) span.textContent = `${Math.round(v * 100)}%`;
  if (e.type === 'change') e.target.blur();
}

function togglePause() {
  G.paused = !G.paused;
  $('#pause').classList.toggle('hidden', !G.paused);
}

function showEnding() {
  const p = G.player;
  const el = $('#ending');
  const cleared = Object.values(p.missions).reduce((a, r) => a + r.clears, 0);
  el.innerHTML = `<div class="e-card">
    <div class="e-title">THE RIFT IS SEALED</div>
    <p>The Sovereign's core goes dark, and the tear over the city folds in on itself. For the first time in months, Metro Central's neon hums without an echo from the other side.</p>
    <p>Captain Yoon's report is three words long: <i>"Hunter did it."</i> Your nanobots are already arguing about who deserves the credit.</p>
    <div class="e-stats">
      <div><small>Hunter</small><b>${esc(p.name)} · Lv ${p.lv}</b></div>
      <div><small>Time</small><b>${fmtTime(p.playTime / 60).replace(':', 'h ')}m</b></div>
      <div><small>Best combo</small><b>${p.bestCombo}</b></div>
      <div><small>Nanodex</small><b>${p.seen.length} / ${BOT_ORDER.length}</b></div>
      <div><small>Missions cleared</small><b>${cleared}</b></div>
    </div>
    <p>Report to Captain Yoon to close out the operation.</p>
    <p class="gold">Post-game unlocked: <b>Rift Breach</b> and <b>Sovereign EX</b> at the Mission Terminal. The level cap is 30, and there are still nanobots to find.</p>
    <div class="e-credits">GhostX Solo · a fan-made tribute to GhostX Ultimate (GameKiss, 2011) · all art and audio procedurally generated</div>
    <button class="primary" id="ending-close">Continue hunting</button>
  </div>`;
  el.classList.remove('hidden');
  G.paused = true;
  playMusic('ending');
  $('#ending-close').addEventListener('click', () => {
    el.classList.add('hidden');
    G.paused = false;
    playMusic(G.map.def.music || G.map.def.theme);
    G.hooks.save?.();
  });
}
