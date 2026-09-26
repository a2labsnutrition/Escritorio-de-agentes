/* ===========================================================
   app.js — motor do escritório
   =========================================================== */
(() => {

const cv  = document.getElementById('scene');
const ctx = cv.getContext('2d');
const $   = s => document.querySelector(s);
const $$  = s => Array.from(document.querySelectorAll(s));

const opts = { rgb: true, names: true, status: true, paths: false };

/* ===========================================================
   CÂMERA
   =========================================================== */
const cam = { x: 0, y: 0, z: 0.62, tz: 0.62 };
let cw = 0, ch = 0, dpr = 1;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const r = cv.getBoundingClientRect();
  cw = r.width; ch = r.height;
  cv.width = Math.round(cw * dpr);
  cv.height = Math.round(ch * dpr);
}
window.addEventListener('resize', () => { resize(); });

const BOUNDS = (() => {
  const minX = ISO.toScreen(0, WORLD.H - 1).x;
  const maxX = ISO.toScreen(WORLD.W - 1, 0).x + ISO.TW;
  const minY = ISO.toScreen(0, 0).y - WORLD.WALL_H;
  const maxY = ISO.toScreen(WORLD.W - 1, WORLD.H - 1).y + ISO.TH;
  return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY,
           cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
})();

function fit() {
  const z = Math.min(cw / BOUNDS.w, ch / BOUNDS.h) * 0.95;
  cam.tz = cam.z = Math.max(0.2, Math.min(1.6, z));
  cam.x = -BOUNDS.cx; cam.y = -BOUNDS.cy;
}

function focusTile(x, y, zoom) {
  const p = ISO.toScreen(x, y, 30);
  cam.x = -p.x; cam.y = -p.y;
  if (zoom) cam.tz = Math.max(cam.tz, zoom);
}

const worldToScreen = (wx, wy) => ({
  x: (wx + cam.x) * cam.z + cw / 2,
  y: (wy + cam.y) * cam.z + ch / 2
});
const screenToWorld = (sx, sy) => ({
  x: (sx - cw / 2) / cam.z - cam.x,
  y: (sy - ch / 2) / cam.z - cam.y
});

/* ===========================================================
   ATOR — o boneco que caminha
   =========================================================== */
const SPEED = 2.5;                 // tiles por segundo
const reserved = new Map();        // slotId -> actorId

class Actor {
  constructor(agent) {
    this.a = agent;
    this.x = WORLD.SPAWN.x;
    this.y = WORLD.SPAWN.y;
    this.path = [];
    this.fine = null;              // último passo fracionário até a cadeira
    this.facing = 's';
    this.phase = 0;
    this.moving = false;
    this.seated = false;
    this.slot = null;
    this.hidden = false;
    this.wait = 1 + Math.random() * 3;
    this.blinkT = 2 + Math.random() * 4;
    this.blink = false;
    this.act = '';
    this.sx = 0; this.sy = 0;
    this.microBreak = 0;
  }

  get id() { return this.a.id; }

  /* ---------- escolha de destino ---------- */
  releaseSlot() {
    if (this.slot && reserved.get(this.slot.id) === this.id) reserved.delete(this.slot.id);
    this.slot = null;
  }

  takeSlot(slot) {
    if (!slot) return false;
    const owner = reserved.get(slot.id);
    if (owner && owner !== this.id) return false;
    this.releaseSlot();
    reserved.set(slot.id, this.id);
    this.slot = slot;
    return true;
  }

  freeFrom(list) {
    const free = list.filter(s => !reserved.has(s.id) || reserved.get(s.id) === this.id);
    if (!free.length) return null;
    return free[Math.floor(Math.random() * free.length)];
  }

  desiredSlot() {
    const st = this.a.status;
    if (st === 'trabalhando') {
      // a estação é dele e só dele. Antes, quem levantasse voltava para a
      // primeira mesa livre e acabava sentando no computador de outro.
      return FURN.workSlots.find(s => s.id === this.a.slotId) || null;
    }
    if (st === 'reuniao') {
      if (this.slot && FURN.meetSlots.includes(this.slot)) return this.slot;
      return this.freeFrom(FURN.meetSlots);
    }
    if (st === 'descanso') {
      if (this.slot && FURN.restSlots.includes(this.slot) && this.wait > 0) return this.slot;
      return this.freeFrom(FURN.restSlots);
    }
    return null;   // offline -> elevador
  }

  /* ---------- ciclo ---------- */
  update(dt) {
    // piscada
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = !this.blink; this.blinkT = this.blink ? 0.12 : 2.5 + Math.random() * 4; }

    if (this.a.status === 'offline') {
      this.act = 'fora do expediente';
      if (!this.hidden) {
        if (!this.path.length && !this.fine) {
          const d = Math.hypot(this.x - WORLD.SPAWN.x, this.y - WORLD.SPAWN.y);
          if (d < 0.9) { this.hidden = true; this.releaseSlot(); }
          else this.goTo(WORLD.SPAWN.x, WORLD.SPAWN.y);
        }
      }
    } else if (this.hidden) {
      // volta pelo elevador, a pé
      this.hidden = false;
      this.x = WORLD.SPAWN.x; this.y = WORLD.SPAWN.y;
      this.path = []; this.fine = null; this.seated = false;
    }

    if (this.hidden) return;

    // quem está trabalhando fica na estação dele, ponto. Existia aqui uma
    // micro-pausa que levava ao bar de tempos em tempos: soltava a mesa e
    // na volta ele pegava outra. Descanso agora só na mão ou por agenda.

    // rodízio de atividade no lounge
    if (this.a.status === 'descanso') {
      this.wait -= dt;
      if (this.wait <= 0 && this.seated) {
        this.wait = 11 + Math.random() * 16;
        this.releaseSlot(); this.path = []; this.fine = null; this.seated = false;
      }
    }

    // destino
    if (!this.path.length && !this.fine) {
      const want = this.desiredSlot();
      if (want && want !== this.slot) {
        if (this.takeSlot(want)) this.goTo(want.x, want.y);
      } else if (want && want === this.slot && !this.seated) {
        this.goTo(want.x, want.y);
      } else if (!want && !this.seated &&
                 (this.a.status === 'descanso' || this.a.status === 'reuniao')) {
        // só perambula no lounge e na sala de reunião; trabalhando, fica parado
        this.wander();
      }
    }

    this.step(dt);
    this.describe();
  }

  /** caminho até uma posição fracionária: A* até o tile + deslize final */
  goTo(fx, fy) {
    let from = { x: Math.round(this.x), y: Math.round(this.y) };
    // se ele parou em cima de um móvel, sai para o tile livre mais perto
    if (!WORLD.walkable(from.x, from.y))
      from = PATH.nearestWalkable(WORLD.walkable, WORLD.W, WORLD.H, from) || from;
    const to = { x: Math.floor(fx), y: Math.floor(fy) };
    const p = PATH.find(WORLD.walkable, WORLD.W, WORLD.H, from, to);
    if (!p) { this.fine = null; return false; }
    this.path = p;
    this.fine = { x: fx, y: fy };
    this.seated = false;
    return true;
  }

  wander() {
    const room = this.a.status === 'descanso' ? WORLD.ROOMS.lounge
               : this.a.status === 'reuniao'  ? WORLD.ROOMS.reuniao
               : WORLD.ROOMS.servico;
    for (let i = 0; i < 14; i++) {
      const x = room.x1 + Math.floor(Math.random() * (room.x2 - room.x1));
      const y = room.y1 + Math.floor(Math.random() * (room.y2 - room.y1));
      if (WORLD.walkable(x, y)) { this.goTo(x + 0.5, y + 0.5); return; }
    }
  }

  step(dt) {
    let budget = SPEED * dt;
    this.moving = false;

    while (budget > 0) {
      let tx, ty, last = false;
      if (this.path.length) {
        tx = this.path[0].x; ty = this.path[0].y;
      } else if (this.fine) {
        tx = this.fine.x; ty = this.fine.y; last = true;
      } else break;

      const dx = tx - this.x, dy = ty - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 1e-4) {
        if (last) { this.arrive(); this.fine = null; }
        else this.path.shift();
        continue;
      }

      // direção que o boneco encara enquanto anda
      if (Math.abs(dx) > Math.abs(dy) * 1.05) this.facing = dx > 0 ? 'e' : 'w';
      else                                    this.facing = dy > 0 ? 's' : 'n';

      this.moving = true;
      if (dist <= budget) {
        this.x = tx; this.y = ty; budget -= dist;
        if (last) { this.arrive(); this.fine = null; }
        else this.path.shift();
      } else {
        this.x += dx / dist * budget;
        this.y += dy / dist * budget;
        budget = 0;
      }
    }

    this.phase += dt * (this.moving ? 3.1 : 1);
  }

  arrive() {
    this.seated = true;
    this.moving = false;
    if (this.slot && this.slot.facing) this.facing = this.slot.facing;
    if (this.a.status === 'descanso') this.wait = 11 + Math.random() * 16;
  }

  describe() {
    const st = this.a.status;
    if (st === 'offline')      { this.act = 'fora do expediente'; return; }
    if (this.microBreak > 0)   { this.act = 'pegando um café'; return; }
    if (this.moving)           { this.act = 'indo para ' + (this.slot ? (this.slot.label || 'a estação') : 'algum lugar'); return; }
    if (st === 'trabalhando')  { this.act = this.slot ? ('produzindo na ' + this.slot.label) : 'procurando mesa livre'; return; }
    if (st === 'reuniao')      { this.act = 'em reunião'; return; }
    if (st === 'descanso')     { this.act = this.slot ? this.slot.act : 'circulando no lounge'; return; }
    this.act = '';
  }

  /* ---------- desenho ---------- */
  draw(ctx, t) {
    if (this.hidden) return;
    const p = ISO.toScreen(this.x, this.y, 0);
    const sp = worldToScreen(p.x, p.y);
    this.sx = sp.x; this.sy = sp.y;

    const working = this.a.status === 'trabalhando' && this.seated && this.microBreak <= 0;
    const sitting = this.seated && !!(this.slot && (this.slot.sit || working || this.a.status === 'reuniao'));

    // luz de recorte: destaca o boneco do piso escuro
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ISO.glow(ctx, p.x, p.y - 26, 34, STATUS_COLOR[this.a.status] || '#8b93ad', .12);
    ctx.restore();

    AVATAR.draw(ctx, this.a.look, p.x, p.y, this.facing, {
      moving: this.moving,
      phase: this.phase,
      sitting,
      working,
      headset: working,
      blink: this.blink,
      scale: SCALE
    });

    if (opts.paths && this.path.length) {
      ctx.save();
      ctx.strokeStyle = 'rgba(56,189,248,.35)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
      ctx.beginPath();
      const s0 = ISO.toScreen(this.x, this.y, 2); ctx.moveTo(s0.x, s0.y);
      for (const n of this.path) { const s = ISO.toScreen(n.x, n.y, 2); ctx.lineTo(s.x, s.y); }
      if (this.fine) { const s = ISO.toScreen(this.fine.x, this.fine.y, 2); ctx.lineTo(s.x, s.y); }
      ctx.stroke(); ctx.restore();
    }

    // etiquetas empilhadas ACIMA da cabeça, nunca sobre o rosto
    const col = STATUS_COLOR[this.a.status] || '#8b93ad';
    let stack = p.y - AVATAR.headTop(sitting) * SCALE - 8;

    if (opts.names) {
      stack -= AVATAR.nameTag(ctx, p.x, stack, this.a.name,
                              this.a.boss ? '#c4b8ff' : col,
                              this.a.boss ? 'DONO' : null) + 4;
    }
    if (opts.status && !this.moving) {
      const ic = this.a.status === 'trabalhando' ? '💻'
               : this.a.status === 'descanso' ? '🎮'
               : this.a.status === 'reuniao' ? '🗣️' : '💤';
      AVATAR.bubble(ctx, p.x, stack, ic,
                    this.microBreak > 0 ? 'pausa' : SHORT_ACT[this.a.status], col);
    }
    void t;
  }
}

/** escala dos bonecos na cena — a mobília sentável usa a mesma */
const SCALE = AVATAR.SCALE;

/** móveis em que o boneco senta EM CIMA — aí ele é desenhado por cima do móvel.
    Mesa e cadeira ficam de fora: a cadeira já tem profundidade própria e o
    monitor deve mesmo tapar o peito de quem está atrás dele. */
const SIT_OVER = new Set(['sofa', 'beanbag']);

const STATUS_COLOR = {
  trabalhando: '#23e08a', descanso: '#ffb020', reuniao: '#38bdf8', offline: '#5a6280'
};
const SHORT_ACT = {
  trabalhando: 'trabalhando', descanso: 'descanso', reuniao: 'reunião', offline: 'offline'
};

/* ===========================================================
   MUNDO VIVO
   =========================================================== */
const actors = new Map();

/** Cada agente recebe uma estação fixa e guarda esse número. Sem isso ele
    volta para a primeira mesa livre depois de qualquer saída e acaba no
    computador de outro. Mesa que sumiu do mapa ou que já é de alguém é
    trocada por outra livre. */
function garanteEstacao() {
  const mesas = FURN.workSlots.filter(s => !s.vip).sort((a, b) => a.id < b.id ? -1 : 1);
  const tomadas = new Set();
  let mudou = false;
  for (const ag of ROSTER.all()) {
    if (ag.boss) { if (ag.slotId) tomadas.add(ag.slotId); continue; }
    const valida = ag.slotId && mesas.some(m => m.id === ag.slotId) && !tomadas.has(ag.slotId);
    if (valida) { tomadas.add(ag.slotId); continue; }
    const livre = mesas.find(m => !tomadas.has(m.id));
    ag.slotId = livre ? livre.id : null;
    if (livre) tomadas.add(livre.id);
    mudou = true;
  }
  if (mudou) ROSTER.save();
}

function syncActors() {
  garanteEstacao();
  const ids = new Set();
  for (const ag of ROSTER.all()) {
    ids.add(ag.id);
    if (!actors.has(ag.id)) actors.set(ag.id, new Actor(ag));
    else actors.get(ag.id).a = ag;
  }
  for (const [id, ac] of actors) {
    if (!ids.has(id)) { ac.releaseSlot(); actors.delete(id); }
  }
  // o dono fica na mesa da diretoria
  for (const ac of actors.values()) {
    if (ac.a.boss) {
      const s = FURN.workSlots.find(s => s.id === ac.a.slotId);
      if (s) ac.takeSlot(s);
    }
  }
}

/* ---------- lista estática de desenho (paredes + móveis) ---------- */
const staticDraw = [];
/** caixa que a peça ocupa na tela, em coordenadas de mundo (sem câmera).
    Como tudo isso é fixo, dá para calcular uma vez e usar para descartar
    o que está fora do enquadramento — é o que mais economiza no zoom.  */
function caixaTile(x, y, topo) {
  const p = ISO.toScreen(x, y);
  return { x0: p.x - 36, y0: p.y - topo, x1: p.x + 36, y1: p.y + 38 };
}
function caixaMovel(o) {
  const w = o.w || 1, d = o.d || 1;
  return {
    x0: ISO.toScreen(o.x, o.y + d).x - 34,
    x1: ISO.toScreen(o.x + w, o.y).x + 34,
    y0: ISO.toScreen(o.x, o.y).y - 175,
    y1: ISO.toScreen(o.x + w, o.y + d).y + 44
  };
}

for (let y = 0; y < WORLD.H; y++) {
  for (let x = 0; x < WORLD.W; x++) {
    const k = WORLD.kindAt(x, y);
    if (k === WORLD.WALL) staticDraw.push({ k: x + y + 1, t: 'wall', x, y, bb: caixaTile(x, y, WORLD.WALL_H + 14) });
    else if (k === WORLD.DOOR) staticDraw.push({ k: x + y + 0.4, t: 'door', x, y, bb: caixaTile(x, y, 110) });
  }
}
for (const o of FURN.items) staticDraw.push({ k: FURN.depth(o), t: 'furn', o, bb: caixaMovel(o) });
staticDraw.sort((a, b) => a.k - b.k);

/* ===========================================================
   RENDER
   =========================================================== */
let T0 = performance.now(), t = 0;
let bgCache = null;
const elFps = document.getElementById("fps");
let fpsN = 0, fpsT = 0, msDesenho = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - T0) / 1000);
  T0 = now; t += dt;

  cam.z += (cam.tz - cam.z) * Math.min(1, dt * 9);
  const tDesenho = performance.now();

  // ocupação das mesas para o brilho dos monitores
  for (const o of FURN.items) if (o.busy !== undefined) o.busy = false;
  for (const ac of actors.values()) {
    ac.update(dt);
    if (ac.slot && ac.slot.obj && ac.seated && ac.a.status === 'trabalhando' && ac.microBreak <= 0)
      ac.slot.obj.busy = true;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // fundo
  if (!bgCache || bgCache.w !== cw || bgCache.h !== ch) {
    const g = ctx.createRadialGradient(cw / 2, ch * .42, 40, cw / 2, ch * .42, Math.max(cw, ch) * .8);
    g.addColorStop(0, '#141a2e'); g.addColorStop(.6, '#090b13'); g.addColorStop(1, '#05060a');
    bgCache = { g, w: cw, h: ch };
  }
  ctx.fillStyle = bgCache.g; ctx.fillRect(0, 0, cw, ch);

  ctx.save();
  ctx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z,
                   dpr * (cw / 2 + cam.x * cam.z), dpr * (ch / 2 + cam.y * cam.z));

  WORLD.drawFloor(ctx, opts.rgb ? t : 0);
  WORLD.drawDecals(ctx, t);
  WORLD.drawRoomLabels(ctx);

  // retângulo visível, em coordenadas de mundo
  const meiaL = cw / (2 * cam.z), meiaA = ch / (2 * cam.z);
  const vis = { x0: -cam.x - meiaL, x1: -cam.x + meiaL,
                y0: -cam.y - meiaA, y1: -cam.y + meiaA };
  const aparece = b => b.x1 > vis.x0 && b.x0 < vis.x1 && b.y1 > vis.y0 && b.y0 < vis.y1;

  // mescla estáticos + atores por profundidade
  const dyn = [];
  for (const ac of actors.values()) {
    if (ac.hidden) continue;
    let k = ac.x + ac.y + 0.5;
    // sentado: desenha por cima do próprio móvel, senão a cadeira e o
    // monitor tapam o boneco (é o mesmo truque do Habbo)
    if (ac.seated && ac.slot && ac.slot.obj && SIT_OVER.has(ac.slot.obj.t))
      k = Math.max(k, FURN.depth(ac.slot.obj) + 0.02);
    const pa = ISO.toScreen(ac.x, ac.y);
    dyn.push({ k, t: 'actor', ac,
               bb: { x0: pa.x - 40, x1: pa.x + 40, y0: pa.y - 165, y1: pa.y + 20 } });
  }
  dyn.sort((a, b) => a.k - b.k);

  let i = 0, j = 0;
  while (i < staticDraw.length || j < dyn.length) {
    const useStatic = j >= dyn.length || (i < staticDraw.length && staticDraw[i].k <= dyn[j].k);
    const it = useStatic ? staticDraw[i++] : dyn[j++];
    if (it.bb && !aparece(it.bb)) continue;          // fora da tela: pula
    if (it.t === 'wall')       WORLD.drawWallTile(ctx, it.x, it.y, opts.rgb ? t : 0, opts.rgb, cam.z);
    else if (it.t === 'door')  WORLD.drawDoorTile(ctx, it.x, it.y, opts.rgb ? t : 0);
    else if (it.t === 'furn')  FURN.drawItem(ctx, it.o, t);
    else                       it.ac.draw(ctx, t);
  }

  ctx.restore();

  // contador: separa o quadro inteiro do tempo que o desenho realmente leva
  msDesenho += performance.now() - tDesenho;
  fpsN++; fpsT += dt;
  if (fpsT >= 0.5) {
    const fps = fpsN / fpsT, ms = msDesenho / fpsN;
    elFps.innerHTML = '<b>' + fps.toFixed(0) + '</b> fps · desenho ' + ms.toFixed(1) + ' ms';
    elFps.classList.toggle('ruim', fps < 50);
    fpsN = 0; fpsT = 0; msDesenho = 0;
  }

  requestAnimationFrame(frame);
}

/* ===========================================================
   INTERAÇÃO NO PALCO
   =========================================================== */
let drag = null;
cv.addEventListener('pointerdown', e => {
  drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false };
  cv.setPointerCapture(e.pointerId); cv.classList.add('dragging');
});
cv.addEventListener('pointermove', e => {
  if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    cam.x = drag.cx + dx / cam.z;
    cam.y = drag.cy + dy / cam.z;
  }
  hover(e);
});
cv.addEventListener('pointerup', e => {
  if (drag && !drag.moved) {
    const a = pick(e);
    if (a) openAgent(a.a.id);
    else {
      if (naMesaDeReuniao(e)) { REUNIAO.abrir(); }
      else {
        const m = pegaMesa(e);
        if (m && m.ator) abrirMonitor(m.ator.a);
        else if (m) toast('Estação ' + m.slot.id + ' está vazia.');
      }
    }
  }
  drag = null; cv.classList.remove('dragging');
});
cv.addEventListener('pointerleave', () => { $('#tooltip').classList.add('hidden'); });
cv.addEventListener('wheel', e => {
  e.preventDefault();
  cam.tz = Math.max(0.22, Math.min(2.8, cam.tz * (e.deltaY < 0 ? 1.13 : 0.885)));
}, { passive: false });

function pick(e) {
  const r = cv.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  let best = null, bestK = -1e9;
  for (const ac of actors.values()) {
    if (ac.hidden) continue;
    const dx = mx - ac.sx, dy = my - ac.sy;
    const hw = 22 * cam.z, hh = 74 * cam.z;
    if (dx > -hw && dx < hw && dy > -hh && dy < 8 * cam.z) {
      const k = ac.x + ac.y;
      if (k > bestK) { bestK = k; best = ac; }
    }
  }
  return best;
}

const tip = $('#tooltip');
function hover(e) {
  const a = pick(e);
  if (!a) {
    const m = pegaMesa(e);
    if (m && m.ator) {
      const sis = m.ator.a.sistema ? SISTEMAS.porId(m.ator.a.sistema) : null;
      tip.innerHTML = '<b>🖥️ ' + esc(m.slot.label) + '</b>' +
        '<div class="tt-role">' + esc(m.ator.a.name) + '</div>' +
        '<div class="tt-act">' + (sis ? 'abrir ' + esc(sis.nome) : 'sem sistema ligado') + '</div>';
      const r = cv.getBoundingClientRect();
      tip.style.left = (e.clientX - r.left) + 'px';
      tip.style.top  = (e.clientY - r.top - 12) + 'px';
      tip.classList.remove('hidden');
      cv.style.cursor = 'pointer';
      return;
    }
    cv.style.cursor = '';
    tip.classList.add('hidden');
    return;
  }
  cv.style.cursor = 'pointer';
  const r = cv.getBoundingClientRect();
  tip.innerHTML = `<b>${esc(a.a.name)}${a.a.boss ? ' ⚡' : ''}</b>
    <div class="tt-role">${esc(a.a.role)}</div>
    <div class="tt-act">${a.a.emoji || '•'} ${esc(a.act || '—')}</div>`;
  tip.style.left = (a.sx) + 'px';
  tip.style.top  = (a.sy - 60 * cam.z) + 'px';
  tip.classList.remove('hidden');
  void r;
}

/* ===========================================================
   PAINEL
   =========================================================== */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function renderTeam() {
  const q = ($('#team-search').value || '').toLowerCase().trim();
  const box = $('#team-list');
  const list = ROSTER.all().filter(a =>
    !q || a.name.toLowerCase().includes(q) || a.role.toLowerCase().includes(q));
  $('#team-count').textContent = ROSTER.all().length;
  box.innerHTML = '';

  for (const a of list) {
    const ac = actors.get(a.id);
    const el = document.createElement('div');
    el.className = 'card s-' + a.status;
    el.innerHTML = `
      <canvas class="av"></canvas>
      <div class="info">
        <div class="nm">${esc(a.name)}</div>
        <div class="rl">${a.emoji || ''} ${esc(a.role)}</div>
        <div class="ac">${esc(ac ? ac.act : '')}</div>
      </div>
      <div class="side"><span class="pill ${a.status}">${SHORT_ACT[a.status]}</span></div>
      ${a.boss ? '<span class="boss">⚡</span>' : ''}`;
    AVATAR.portrait(el.querySelector('.av'), a.look);
    el.addEventListener('click', () => openAgent(a.id));
    box.appendChild(el);
  }
}

let hireCat = 'todos';
function renderHire() {
  const box = $('#hire-list');
  box.innerHTML = '';
  const list = ROSTER.CATALOG.filter(c => hireCat === 'todos' || c.cat === hireCat);

  for (const c of list) {
    const hired = ROSTER.isHired(c.key);
    const el = document.createElement('div');
    el.className = 'hcard' + (hired ? ' hired' : '');
    el.innerHTML = `
      <div class="top">
        <div class="emo">${c.emoji}</div>
        <div class="nm">${esc(c.name)} <span style="color:var(--txt-dim);font-weight:600">· ${esc(c.role)}</span></div>
        <span class="tag ${c.cat}">${c.cat === 'detectado' ? 'na máquina' : 'sugestão'}</span>
      </div>
      <p class="desc">${esc(c.desc)}</p>
      <p class="why"><b>Por que vale:</b> ${esc(c.why)}</p>
      ${c.path ? `<p class="desc" style="font-family:monospace;font-size:10.5px;opacity:.6">${esc(c.path)}</p>` : ''}
      <div class="acts">
        <button class="mini act">${hired ? '✓ já contratado' : '＋ contratar'}</button>
      </div>`;
    const btn = el.querySelector('.act');
    btn.disabled = hired;
    btn.addEventListener('click', () => {
      const a = ROSTER.hire(c.key);
      if (!a) return;
      syncActors(); renderAll();
      toast(`${a.name} foi contratado(a) — entrando pela recepção.`);
      const ac = actors.get(a.id);
      if (ac) focusTile(ac.x, ac.y, 0.6);
    });
    box.appendChild(el);
  }

  // criar agente do zero
  const add = document.createElement('div');
  add.className = 'hcard';
  add.innerHTML = `
    <div class="top">
      <div class="emo">🤖</div>
      <div class="nm">Cadastrar um agente meu</div>
    </div>
    <p class="desc">Tem um agente que não está na lista? Cadastre aqui com nome, função e visual próprio.</p>
    <div class="acts"><button class="mini act">＋ cadastrar agente</button></div>`;
  add.querySelector('.act').addEventListener('click', openNew);
  box.appendChild(add);
}

function renderRooms() {
  const box = $('#rooms-list');
  box.innerHTML = '';
  const order = ['diretoria', 'servico', 'lounge', 'reuniao', 'corredor'];
  for (const id of order) {
    const r = WORLD.ROOMS[id];
    const inside = Array.from(actors.values()).filter(ac =>
      !ac.hidden && WORLD.roomAt(Math.round(ac.x), Math.round(ac.y)) === id);
    const cap = id === 'servico' ? 18 : id === 'diretoria' ? 2 : id === 'reuniao' ? 8 : id === 'lounge' ? FURN.restSlots.length : 0;
    const pct = cap ? Math.min(100, inside.length / cap * 100) : 0;
    const el = document.createElement('div');
    el.className = 'roomcard';
    el.innerHTML = `
      <div class="rname"><span style="width:9px;height:9px;border-radius:3px;background:${r.accent};box-shadow:0 0 9px ${r.accent}"></span>${esc(r.name)}</div>
      <div class="rmeta">${esc(r.desc)}</div>
      <div class="rmeta" style="color:${r.accent}">${inside.length} pessoa(s) agora${cap ? ` · ${cap} lugares` : ''}</div>
      ${cap ? `<div class="bar"><i style="width:${pct}%;background:${r.accent}"></i></div>` : ''}`;
    el.addEventListener('click', () => {
      if (id === 'corredor') focusTile(24, 20, 0.7);
      else focusTile((r.x1 + r.x2) / 2, (r.y1 + r.y2) / 2, 0.7);
    });
    box.appendChild(el);
  }
}

function renderStats() {
  $('#st-work').textContent = ROSTER.count('trabalhando') + ROSTER.count('reuniao');
  $('#st-idle').textContent = ROSTER.count('descanso');
  $('#st-off').textContent  = ROSTER.count('offline');
  const leg = $('#roomlegend');
  leg.innerHTML = ['diretoria', 'servico', 'lounge', 'reuniao'].map(id => {
    const r = WORLD.ROOMS[id];
    const n = Array.from(actors.values()).filter(ac =>
      !ac.hidden && WORLD.roomAt(Math.round(ac.x), Math.round(ac.y)) === id).length;
    return `<div class="rl"><span class="dot" style="background:${r.accent};color:${r.accent}"></span>${esc(r.short)} · ${n}</div>`;
  }).join('');
}

function renderAll() { renderTeam(); renderHire(); renderRooms(); renderStats(); }

/* ===========================================================
   FICHA DO FUNCIONÁRIO
   =========================================================== */
const modal = $('#modal'), mbody = $('#modal-body');
const closeModal = () => modal.classList.add('hidden');
$('#modal-x').addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });


/* O confirm() nativo é bloqueado em alguns navegadores embutidos: ele devolve
   false sem mostrar nada, e a ação simplesmente não acontecia — sem erro, sem
   aviso. Esta confirmação é desenhada na própria página, então sempre aparece. */
function confirmar(titulo, texto, rotuloOk = 'Confirmar') {
  return new Promise(resolve => {
    mbody.innerHTML =
      '<h3 style="font-family:var(--f-display);margin:0 0 8px">' + esc(titulo) + '</h3>' +
      '<p class="hint" style="margin-bottom:18px;line-height:1.6">' + esc(texto) + '</p>' +
      '<div class="mactions">' +
      '  <button class="btn primary" id="cf-ok">' + esc(rotuloOk) + '</button>' +
      '  <button class="btn" id="cf-no">Cancelar</button>' +
      '</div>';
    modal.classList.remove('hidden');
    const fim = v => { modal.classList.add('hidden'); resolve(v); };
    $('#cf-ok').addEventListener('click', () => fim(true));
    $('#cf-no').addEventListener('click', () => fim(false));
  });
}

function openAgent(id) {
  const a = ROSTER.get(id);
  if (!a) return;
  const ac = actors.get(id);

  mbody.innerHTML = `
    <div class="mhead">
      <canvas id="m-av"></canvas>
      <div>
        <h3>${esc(a.name)} ${a.boss ? '⚡' : ''}</h3>
        <p>${a.emoji || ''} ${esc(a.role)}</p>
        <p style="margin-top:6px;color:var(--alt-1);font-size:12px">${esc(ac ? ac.act : '')}</p>
      </div>
    </div>
    ${a.brief ? `<p class="hint" style="margin-bottom:14px">${esc(a.brief)}</p>` : ''}
    ${a.path ? `<p class="hint" style="font-family:monospace;font-size:11px;margin-bottom:14px">${esc(a.path)}</p>` : ''}

    <div class="frow"><label>Nome exibido</label><input id="f-name" value="${esc(a.name)}"></div>
    <div class="frow"><label>Função</label><input id="f-role" value="${esc(a.role)}"></div>

    <div class="frow"><label>Situação</label>
      <div class="seg" id="f-status">
        <button data-s="trabalhando" class="${a.status === 'trabalhando' ? 'on' : ''}">💻 Trabalhando</button>
        <button data-s="descanso"    class="${a.status === 'descanso' ? 'on' : ''}">🎮 Descanso</button>
        <button data-s="reuniao"     class="${a.status === 'reuniao' ? 'on' : ''}">🗣️ Reunião</button>
        <button data-s="offline"     class="${a.status === 'offline' ? 'on' : ''}">💤 Offline</button>
      </div>
    </div>

    ${a.boss ? '' : `
    <div class="frow"><label>Estação</label>
      <div class="hint" style="padding:6px 0">${a.slotId ? 'Estação ' + esc(a.slotId) + ' — é dela e de mais ninguém' : 'sem estação livre no momento'}</div>
    </div>

    <div class="frow"><label>Horário de trabalho</label>
      <div class="seg" style="gap:6px">
        <input type="time" id="f-h1" value="${esc((a.horario && a.horario.inicio) || '')}" style="flex:1">
        <input type="time" id="f-h2" value="${esc((a.horario && a.horario.fim) || '')}" style="flex:1">
        <button id="f-hoff" title="Sem horário: trabalha sempre">✕</button>
      </div>
    </div>
    <div class="frow"><label>Dias</label>
      <div class="seg" id="f-dias">
        ${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((n, i) => {
          const dias = (a.horario && a.horario.dias) || [1, 2, 3, 4, 5];
          return `<button data-d="${i}" class="${dias.includes(i) ? 'on' : ''}">${n}</button>`;
        }).join('')}
      </div>
    </div>
    <p class="hint" style="margin:-6px 0 14px">${esc(textoHorario(a))}. Fora do horário ele vai para o lounge sozinho; dentro, volta para a estação.</p>
    `}

    <div class="frow"><label>Visual</label>
      <div class="seg">
        <button id="f-shuffle">🎲 Sortear aparência</button>
      </div>
    </div>

    <button class="btn wide primary" id="f-sis" style="margin-top:6px">🖥️ Abrir o sistema de ${esc(a.name)}</button>

    <div class="mactions">
      <button class="btn primary" id="f-save">Salvar</button>
      <button class="btn" id="f-find">📍 Localizar</button>
      ${a.locked ? '' : '<button class="btn danger" id="f-fire">Desligar</button>'}
    </div>`;

  const cvp = $('#m-av');
  const paint = () => AVATAR.portrait(cvp, a.look, 1.6);
  paint();

  $$('#f-status button').forEach(b => b.addEventListener('click', () => {
    $$('#f-status button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
  }));

  $$('#f-dias button').forEach(b => b.addEventListener('click', () => b.classList.toggle('on')));
  const hoff = $('#f-hoff');
  if (hoff) hoff.addEventListener('click', () => { $('#f-h1').value = ''; $('#f-h2').value = ''; });

  $('#f-shuffle').addEventListener('click', () => {
    const keep = a.look.uniforme;
    a.look = AVATAR.makeLook(a.id + Math.random(), { uniforme: keep });
    paint();
  });
  $('#f-sis').addEventListener('click', () => { closeModal(); abrirMonitor(a); });
  $('#f-find').addEventListener('click', () => {
    const c = actors.get(a.id);
    if (c) { focusTile(c.x, c.y, 0.95); closeModal(); toast(`${a.name}: ${c.act}`); }
  });
  $('#f-save').addEventListener('click', () => {
    a.name = ($('#f-name').value || a.name).slice(0, 22);
    a.role = ($('#f-role').value || a.role).slice(0, 48);
    const ns = $('#f-status button.on').dataset.s;
    const trocouStatus = ns !== a.status;
    if (trocouStatus) setStatus(a, ns);
    if (!a.boss) {
      const i = $('#f-h1').value, f = $('#f-h2').value;
      const dias = $$('#f-dias button.on').map(b => +b.dataset.d);
      // horário só vale com as duas pontas e pelo menos um dia
      a.horario = (i && f && dias.length) ? { inicio: i, fim: f, dias } : null;
      const dentro = dentroDoHorario(a.horario);
      // se ele acabou de escolher a situação na mão, essa ordem vale até a
      // próxima virada; se não mexeu, a agenda já entra em vigor agora
      a._fase = (dentro !== null && trocouStatus)
        ? (dentro ? 'trabalhando' : 'descanso') : null;
    }
    ROSTER.save(); aplicarAgenda(); renderAll(); closeModal();
  });
  const fb = $('#f-fire');
  if (fb) fb.addEventListener('click', async () => {
    if (!await confirmar('Desligar ' + a.name + '?',
        'Ele sai do quadro e a estação fica livre. Dá para contratar de novo depois.',
        'Desligar')) return;
    ROSTER.fire(a.id); syncActors(); renderAll(); closeModal();
    toast(`${a.name} saiu do quadro.`);
  });

  modal.classList.remove('hidden');
}

function openNew() {
  mbody.innerHTML = `
    <h3 style="font-family:var(--f-display);margin:0 0 4px">Cadastrar agente</h3>
    <p class="hint" style="margin-bottom:16px">Ele entra pela recepção e vai até uma estação livre. Se ele tem um sistema,
      cadastre junto: o computador dele passa a abrir esse sistema aqui dentro.</p>
    <div class="frow"><label>Nome</label><input id="n-name" placeholder="ex.: Tati" maxlength="22"></div>
    <div class="frow"><label>Função</label><input id="n-role" placeholder="ex.: Analista de Conteúdo" maxlength="48"></div>
    <div class="frow"><label>Emoji</label><input id="n-emo" placeholder="🤖" maxlength="4" value="🤖"></div>
    <div class="frow"><label>O que ele faz</label><textarea id="n-brief" rows="2" placeholder="Uma frase sobre a função dele."></textarea></div>
    <div class="frow"><label>Sistema do agente</label>
      <div class="seg" id="n-tipo">
        <button data-t="nenhum" class="on">Nenhum</button>
        <button data-t="local">Roda nesta máquina</button>
        <button data-t="web">Site / URL</button>
      </div></div>
    <div id="n-local" class="hidden">
      <div class="frow"><label>Pasta do projeto</label><input id="n-pasta" placeholder="C:\\projetos\\meu-agente"></div>
      <div class="two">
        <div class="frow"><label>Comando</label><input id="n-cmd" value="npm"></div>
        <div class="frow"><label>Argumentos</label><input id="n-args" value="run dev"></div>
      </div>
      <div class="two">
        <div class="frow"><label>Porta</label><input id="n-porta" type="number" min="1024" max="65535"></div>
        <div class="frow"><label>Página inicial</label><input id="n-abre" value="/"></div>
      </div>
      <p class="hint">O escritório sobe o sistema com PORT igual à porta acima. Se o seu projeto escolhe a porta de outro jeito,
        ponha nos argumentos (ex.: <code>run dev -- --port 4402</code>).</p>
    </div>
    <div id="n-web" class="hidden">
      <div class="frow"><label>Endereço</label><input id="n-url" placeholder="https://meu-sistema.com"></div>
      <label class="opt"><input type="checkbox" id="n-esp"> O site recusa abrir dentro do escritório (usar o espelho)</label>
    </div>
    <label class="opt" style="margin-top:8px"><input type="checkbox" id="n-reun" checked> Participa da reunião dos agentes</label>
    <div id="n-msg" class="hint" style="color:#ff7a6b;margin-top:6px"></div>
    <div class="mactions">
      <button class="btn primary" id="n-ok">Contratar</button>
      <button class="btn" id="n-cancel">Cancelar</button>
    </div>`;

  let tipo = 'nenhum';
  $$('#n-tipo button').forEach(b => b.addEventListener('click', () => {
    tipo = b.dataset.t;
    $$('#n-tipo button').forEach(x => x.classList.toggle('on', x === b));
    $('#n-local').classList.toggle('hidden', tipo !== 'local');
    $('#n-web').classList.toggle('hidden', tipo !== 'web');
  }));
  // sugere a primeira porta livre a partir de 4401
  const usadas = SISTEMAS.todos().map(s => s.porta).filter(Boolean);
  let livre = 4401; while (usadas.includes(livre)) livre++;
  $('#n-porta').value = livre;

  $('#n-cancel').addEventListener('click', closeModal);
  $('#n-ok').addEventListener('click', async () => {
    const name = $('#n-name').value.trim();
    if (!name) { $('#n-name').focus(); return; }
    const brief = $('#n-brief').value.trim();
    let sistema = null;
    if (tipo !== 'nenhum') {
      const corpo = tipo === 'web'
        ? { tipo: 'web', nome: name, url: $('#n-url').value.trim(), embutir: $('#n-esp').checked ? 'espelho' : true, sobre: brief }
        : { tipo: 'local', nome: name, pasta: $('#n-pasta').value.trim(), comando: $('#n-cmd').value.trim(),
            args: $('#n-args').value.trim(), porta: Number($('#n-porta').value), abre: $('#n-abre').value.trim() || '/', sobre: brief };
      $('#n-ok').disabled = true;
      const r = await fetch('/api/sistemas', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                                               body: JSON.stringify(corpo) })
        .then(x => x.json()).catch(() => ({ ok: false, motivo: 'o escritório não respondeu' }));
      $('#n-ok').disabled = false;
      if (!r.ok) { $('#n-msg').textContent = r.motivo; return; }
      sistema = r.id;
      await SISTEMAS.atualizar();
    }
    const a = ROSTER.hireCustom({
      name, role: $('#n-role').value.trim() || 'Função a definir',
      emoji: $('#n-emo').value.trim() || '🤖',
      path: tipo === 'local' ? $('#n-pasta').value.trim() : null,
      sistema, reuniao: $('#n-reun').checked, brief
    });
    syncActors(); renderAll(); closeModal();
    toast(`${a.name} entrou no quadro.` + (sistema ? ' Clique no computador dele para abrir o sistema.' : ''));
  });
  modal.classList.remove('hidden');
}

/* ===========================================================
   AÇÕES
   =========================================================== */
function setStatus(a, s) {
  a.status = s;
  const ac = actors.get(a.id);
  if (ac) { ac.releaseSlot(); ac.path = []; ac.fine = null; ac.seated = false; ac.microBreak = 0; ac._break = null; }
  ROSTER.save();
}

function setAll(s) {
  for (const a of ROSTER.all()) { if (!a.boss) setStatus(a, s); }
  renderAll();
}

/* ===========================================================
   AGENDA — horário de trabalho de cada um

   Quem tem horário entra em serviço no começo do expediente e vai para o
   lounge no fim. Só nas viradas: se você mandar alguém descansar no meio
   do turno, ele fica descansando — a agenda não desfaz a sua ordem, ela
   só age quando o horário muda de fase.
   =========================================================== */
const emMinutos = hhmm => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  return m ? (+m[1]) * 60 + (+m[2]) : null;
};

/** dentro do expediente dele agora? null = sem horário, trabalha sempre */
function dentroDoHorario(h, d = new Date()) {
  if (!h || !h.inicio || !h.fim) return null;
  const dias = Array.isArray(h.dias) && h.dias.length ? h.dias : [0, 1, 2, 3, 4, 5, 6];
  if (!dias.includes(d.getDay())) return false;
  const i = emMinutos(h.inicio), f = emMinutos(h.fim);
  if (i == null || f == null) return null;
  const agora = d.getHours() * 60 + d.getMinutes();
  // turno que atravessa a meia-noite (22:00 -> 06:00)
  return i <= f ? (agora >= i && agora < f) : (agora >= i || agora < f);
}

function aplicarAgenda() {
  let mudou = false;
  for (const a of ROSTER.all()) {
    if (a.boss) continue;
    const dentro = dentroDoHorario(a.horario);
    if (dentro === null) { a._fase = null; continue; }
    const fase = dentro ? 'trabalhando' : 'descanso';
    if (a._fase === fase) continue;          // já virou, não insiste
    a._fase = fase;
    if (a.status !== fase && a.status !== 'offline') { setStatus(a, fase); mudou = true; }
  }
  if (mudou) renderAll();
}

/** resumo curto do horário para a lista e a ficha */
function textoHorario(a) {
  const h = a.horario;
  if (!h || !h.inicio || !h.fim) return 'sem horário · sempre em serviço';
  const nomes = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const dias = Array.isArray(h.dias) && h.dias.length ? h.dias : [0, 1, 2, 3, 4, 5, 6];
  const todos = dias.length === 7;
  const util = dias.length === 5 && [1, 2, 3, 4, 5].every(d => dias.includes(d));
  const quais = todos ? 'todo dia' : util ? 'seg a sex' : dias.map(d => nomes[d]).join(', ');
  return `${h.inicio}–${h.fim} · ${quais}`;
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), 3400);
}

/* ===========================================================
   RELATÓRIO DO GERENTE
   =========================================================== */
function buildReport() {
  const team = ROSTER.all();
  const work = team.filter(a => a.status === 'trabalhando');
  const meet = team.filter(a => a.status === 'reuniao');
  const rest = team.filter(a => a.status === 'descanso');
  const off  = team.filter(a => a.status === 'offline');
  const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const linha = a => {
    const ac = actors.get(a.id);
    return `<li><b>${esc(a.name)}</b> — ${esc(a.role)}<br><span style="color:var(--txt-dim);font-size:12px">${esc(ac ? ac.act : '')}</span></li>`;
  };

  const naoContratados = ROSTER.CATALOG.filter(c => c.cat === 'sugerido' && !ROSTER.isHired(c.key)).slice(0, 3);

  const fala = `Relatório das ${hora}. Temos ${work.length + meet.length} em serviço, ` +
    `${rest.length} no lounge e ${off.length} fora do expediente. ` +
    (work.length ? `Trabalhando agora: ${work.map(a => a.name).join(', ')}. ` : 'Ninguém produzindo no momento. ') +
    (rest.length ? `No descanso: ${rest.map(a => a.name).join(', ')}. ` : '') +
    (naoContratados.length ? `Sugiro contratar ${naoContratados.map(c => c.name + ', ' + c.role).join('; ')}.` : '');

  const html = `
    <h3 style="font-family:var(--f-display);margin:0 0 4px">Relatório do gerente</h3>
    <p class="hint" style="margin-bottom:14px">${hora} · ${team.length} no quadro</p>
    <div class="report">
      <div class="big">
        <span style="color:var(--ok)">${work.length + meet.length} em serviço</span> ·
        <span style="color:var(--warn)">${rest.length} no lounge</span> ·
        <span style="color:var(--off)">${off.length} offline</span>
      </div>

      ${work.length ? `<h4>💻 Produzindo</h4><ul>${work.map(linha).join('')}</ul>` : ''}
      ${meet.length ? `<h4>🗣️ Em reunião</h4><ul>${meet.map(linha).join('')}</ul>` : ''}
      ${rest.length ? `<h4>🎮 Lounge</h4><ul>${rest.map(linha).join('')}</ul>` : ''}
      ${off.length  ? `<h4>💤 Fora do expediente</h4><ul>${off.map(a => `<li>${esc(a.name)} — ${esc(a.role)}</li>`).join('')}</ul>` : ''}

      ${naoContratados.length ? `<h4>📌 Quem eu contrataria agora</h4><ul>${naoContratados.map(c =>
        `<li><b>${esc(c.name)}</b> — ${esc(c.role)}<br><span style="color:var(--txt-dim);font-size:12px">${esc(c.why)}</span></li>`).join('')}</ul>` : ''}
    </div>
    <div class="mactions">
      <button class="btn primary" id="r-speak">🔊 Ler em voz alta</button>
      <button class="btn" id="r-close">Fechar</button>
    </div>`;

  return { html, fala };
}

function openReport() {
  const r = buildReport();
  mbody.innerHTML = r.html;
  $('#r-close').addEventListener('click', closeModal);
  $('#r-speak').addEventListener('click', () => speak(r.fala));
  modal.classList.remove('hidden');
}

/* ===========================================================
   MONITOR — clicar no computador do agente abre o sistema dele
   =========================================================== */
const mon = {
  el: $('#monitor'), frame: $('#mon-frame'), vazio: $('#mon-vazio'),
  saida: $('#mon-saida'), id: null, agente: null, timer: null, vendoLog: false
};

/** caixa clicável da mesa, mais justa que a usada no descarte de desenho */
function caixaMesa(o) {
  const w = o.w || 1, d = o.d || 1;
  return {
    x0: ISO.toScreen(o.x, o.y + d).x - 8,
    x1: ISO.toScreen(o.x + w, o.y).x + 8,
    y0: ISO.toScreen(o.x, o.y).y - 68,
    y1: ISO.toScreen(o.x + w, o.y + d).y + 16
  };
}

/** qual estação está sob o cursor, e quem está sentado nela */
function pegaMesa(e) {
  const r = cv.getBoundingClientRect();
  const p = screenToWorld(e.clientX - r.left, e.clientY - r.top);
  for (const slot of FURN.workSlots) {
    const o = slot.obj;
    if (!o) continue;
    const b = caixaMesa(o);
    if (p.x > b.x0 && p.x < b.x1 && p.y > b.y0 && p.y < b.y1) {
      const ac = Array.from(actors.values())
        .find(a => a.slot === slot && a.seated && !a.hidden);
      return { slot, ator: ac || null };
    }
  }
  return null;
}

/** o clique caiu em cima da mesa de reunião? */
function naMesaDeReuniao(e) {
  const mesa = FURN.items.find(o => o.t === 'meetTable');
  if (!mesa) return false;
  const r = cv.getBoundingClientRect();
  const p = screenToWorld(e.clientX - r.left, e.clientY - r.top);
  const b = caixaMesa(mesa);
  return p.x > b.x0 && p.x < b.x1 && p.y > b.y0 && p.y < b.y1;
}

/* ===========================================================
   A REUNIÃO PUXA OS BONECOS

   Enquanto a reunião roda, quem está nela larga a estação e vai para
   a sala de reunião a pé, como todo mundo aqui. Quando acaba, cada um
   volta para o que estava fazendo antes — por isso guardamos o estado
   anterior em vez de assumir "trabalhando".
   =========================================================== */
let reuniaoAtiva = false;

function sincronizaReuniao() {
  if (typeof REUNIAO === 'undefined') return;
  const rolando = REUNIAO.emAndamento();
  const nomes = new Set(REUNIAO.naMesa());
  let mexeu = false;

  if (rolando) {
    for (const a of ROSTER.all()) {
      if (a.boss || !nomes.has(a.name)) continue;
      if (a.status === 'reuniao') continue;
      a._antesDaReuniao = a.status;
      setStatus(a, 'reuniao');
      mexeu = true;
    }
    if (!reuniaoAtiva) toast('Reunião das ' + (REUNIAO.estado ? REUNIAO.estado.hora : '11:00') + ' começou — equipe indo para a mesa.');
  } else if (reuniaoAtiva) {
    for (const a of ROSTER.all()) {
      if (a.status !== 'reuniao') continue;
      setStatus(a, a._antesDaReuniao || 'trabalhando');
      delete a._antesDaReuniao;
      mexeu = true;
    }
    toast('Reunião encerrada. Briefing pronto na mesa.');
  }

  reuniaoAtiva = rolando;
  if (mexeu) { ROSTER.save(); renderAll(); }
}

async function abrirMonitor(agente) {
  if (!agente) return;
  mon.agente = agente;
  mon.id = agente.sistema || null;
  mon.vendoLog = false;

  $('#mon-nome').textContent = agente.name;
  AVATAR.portrait($('#mon-av'), agente.look, 0.85);
  mon.el.classList.remove('hidden');
  mon.saida.classList.add('hidden');
  CONVERSA.fechar();

  await SISTEMAS.atualizar();
  pintarMonitor();
  clearInterval(mon.timer);
  mon.timer = setInterval(async () => {
    if (mon.el.classList.contains('hidden')) return;
    await SISTEMAS.atualizar();
    pintarMonitor(true);
    if (mon.vendoLog) mon.saida.textContent = (await SISTEMAS.log(mon.id)).join(String.fromCharCode(10));
  }, 3000);
}

function fecharMonitor() {
  CONVERSA.fechar();
  mon.el.classList.add('hidden');
  clearInterval(mon.timer);
  mon.frame.src = 'about:blank';
}

function pintarMonitor(soEstado) {
  const s = mon.id ? SISTEMAS.porId(mon.id) : null;
  const luz = $('#mon-luz'), txt = $('#mon-txt');

  if (!s) {
    $('#mon-sis').textContent = mon.agente ? mon.agente.role : '';
    luz.style.background = 'var(--off)'; txt.textContent = 'sem sistema';
    $('#mon-ligar').disabled = $('#mon-desligar').disabled = $('#mon-log').disabled = true;
    $('#mon-aba').disabled = $('#mon-chat').disabled = true;
    mon.frame.style.display = 'none';
    mon.vazio.classList.add('on');
    mon.vazio.innerHTML = '<div><b>Esse agente ainda não tem sistema ligado a ele</b>' +
      'Cadastre em <code>data/sistemas.json</code> e aponte o agente para o id dele.<br>' +
      '<span class="dica">É assim que um agente novo ganha um computador que abre de verdade.</span></div>';
    return;
  }

  $('#mon-sis').textContent = s.nome;
  luz.style.background = SISTEMAS.COR[s.estado] || 'var(--off)';
  luz.style.color = SISTEMAS.COR[s.estado] || 'var(--off)';
  txt.textContent = s.tipo === 'web' ? 'site publicado'
                  : s.externo ? 'no ar · fora daqui' : s.estado;

  const local = s.tipo === 'local';
  $('#mon-ligar').disabled = !local || s.estado === 'no ar' || s.estado === 'subindo';
  // não derruba processo que você subiu por fora; só o que nasceu aqui
  $('#mon-desligar').disabled = !local || s.estado === 'desligado' || s.externo;
  $('#mon-desligar').title = s.externo
    ? 'Esse servidor foi iniciado fora do escritório — feche no terminal dele'
    : 'Desligar';
  $('#mon-log').disabled = !local;
  $('#mon-aba').disabled = false;
  // dá para conversar mesmo desligado, e mesmo com sistema publicado:
  // o que o agente precisa é da pasta do projeto, não do servidor no ar
  $('#mon-chat').disabled = !s.pasta;

  // sistema que recusa iframe entra pelo espelho (urlEmbutida); se nem o
  // espelho subiu, não adianta insistir — o quadro ficaria branco
  const noAr = s.tipo === 'web' || s.estado === 'no ar';
  const urlQuadro = s.urlEmbutida || s.url;
  const bloqueado = s.embutir === false || (s.embutir === 'espelho' && !s.urlEmbutida);
  const podeMostrar = noAr && !bloqueado;
  if (soEstado && podeMostrar && mon.frame.dataset.url === urlQuadro) return;

  if (podeMostrar) {
    mon.vazio.classList.remove('on');
    mon.frame.style.display = '';
    if (mon.frame.dataset.url !== urlQuadro) {
      mon.frame.dataset.url = urlQuadro;
      mon.frame.src = urlQuadro;
    }
  } else {
    mon.frame.style.display = 'none';
    mon.frame.dataset.url = '';
    mon.vazio.classList.add('on');
    const dicas = (s.dicas || []).map(d => '• ' + esc(d)).join('<br>');
    const cauda = (s.ultimoLog || []).length
      ? '<pre class="mon-cauda">' + esc(s.ultimoLog.join(String.fromCharCode(10))) + '</pre>'
      : '';
    // no ar mas sem poder embutir: o sistema recusa iframe (X-Frame-Options)
    const foraDoQuadro = bloqueado && noAr;
    const titulo = foraDoQuadro
      ? esc(s.nome) + ' está no ar, mas só abre fora'
      : s.estado === 'caiu'
      ? esc(s.nome) + ' subiu e caiu'
      : esc(s.nome) + ' está desligado';
    const rodape = foraDoQuadro
      ? '<br><span class="dica">Esse sistema recusa ser exibido dentro de outra página — ' +
        'é uma proteção dele, não um defeito. Clique em <b>↗ Nova aba</b> para usá-lo.</span>'
      : '<br><span class="dica">Clique em <b>Ligar</b> — eu subo o servidor e mostro o painel aqui.</span>';
    mon.vazio.innerHTML = '<div><b>' + titulo + '</b>' + (foraDoQuadro ? '' : cauda) +
      esc(s.sobre || '') +
      '<div class="dica">Pasta: <code>' + esc(s.pasta || '—') + '</code><br>' +
      'Porta: ' + (s.porta || '—') + (dicas ? '<br><br>' + dicas : '') +
      (s.aviso ? '<br><br><b style="color:var(--warn)">Atenção:</b> ' + esc(s.aviso) : '') + '</div>' +
      rodape + '</div>';
  }
}

CONVERSA.ligarEventos();
$('#mon-chat').addEventListener('click', () => {
  if (CONVERSA.aberto()) { CONVERSA.fechar(); return; }
  if (!mon.id) { toast('Esse agente não tem sistema para investigar.'); return; }
  mon.saida.classList.add('hidden'); mon.vendoLog = false;
  CONVERSA.abrir(mon.id);
});
$('#mon-x').addEventListener('click', fecharMonitor);
$('#mon-aba').addEventListener('click', () => {
  const s = SISTEMAS.porId(mon.id);
  if (s && s.url) window.open(s.url, '_blank', 'noopener');
});
$('#mon-log').addEventListener('click', async () => {
  mon.vendoLog = !mon.vendoLog;
  if (mon.vendoLog) CONVERSA.fechar();
  mon.saida.classList.toggle('hidden', !mon.vendoLog);
  if (mon.vendoLog) mon.saida.textContent = (await SISTEMAS.log(mon.id)).join(String.fromCharCode(10)) || "(sem saída ainda)";
});
$('#mon-ligar').addEventListener('click', async () => {
  const s = SISTEMAS.porId(mon.id);
  if (!s) return;
  // sistema que age sozinho só sobe depois de você confirmar
  if (s.aviso && !(await confirmar(s.nome, s.aviso, '▶ Ligar mesmo assim'))) return;
  $('#mon-ligar').disabled = true;
  $('#mon-txt').textContent = 'subindo…';
  mon.vazio.innerHTML = '<div><b>Subindo ' + esc(s.nome) + '</b>' +
    'Instalando nada, só rodando <code>' + esc(s.pasta) + '</code>.<br>' +
    '<span class="dica">A primeira vez costuma demorar mais. O log mostra o que está acontecendo.</span></div>';
  const r = await SISTEMAS.ligar(mon.id);
  if (!r.ok) { toast(r.motivo || 'não consegui ligar'); pintarMonitor(); return; }
  const subiu = await SISTEMAS.esperarSubir(mon.id, 90);
  pintarMonitor();
  toast(subiu ? s.nome + ' no ar.' : 'Não subiu no tempo esperado — veja o log.');
});
$('#mon-desligar').addEventListener('click', async () => {
  await SISTEMAS.desligar(mon.id);
  await SISTEMAS.atualizar();
  pintarMonitor();
});

/* ===========================================================
   QUADRO — ideias e agenda que aparecem nas paredes da Diretoria
   =========================================================== */
function openQuadro() {
  const ideias = QUADRO.ideias(), eventos = QUADRO.eventos();
  mbody.innerHTML = `
    <h3 style="font-family:var(--f-display);margin:0 0 3px">📌 Quadro</h3>
    <p class="hint" style="margin-bottom:14px">O que você anotar aqui aparece no quadro branco e no painel de eventos da Diretoria.</p>
    <div class="frow"><label>Nova ideia para o quadro branco</label>
      <div class="inline"><input id="q-txt" placeholder="ex.: testar um canal de vendas novo" maxlength="52">
      <button class="mini" id="q-add">anotar</button></div></div>
    <div class="chiplist" id="q-list">${ideias.map((t, i) =>
      `<span class="tagline"><i>${esc(t)}</i><button data-i="${i}" class="x">✕</button></span>`).join('') ||
      '<span class="hint">quadro vazio</span>'}</div>

    <div class="frow" style="margin-top:16px"><label>Novo evento na agenda</label>
      <div class="inline">
        <input id="e-data" placeholder="20/09" maxlength="8" style="max-width:74px">
        <input id="e-nome" placeholder="Reunião com cliente X" maxlength="34">
        <input id="e-tipo" placeholder="Reunião" maxlength="16" style="max-width:110px">
        <button class="mini" id="e-add">marcar</button>
      </div></div>
    <div class="chiplist" id="e-list">${eventos.map((v, i) =>
      `<span class="tagline"><b>${esc(v.data)}</b><i>${esc(v.nome)}</i><em>${esc(v.tipo)}</em><button data-i="${i}" class="x">✕</button></span>`).join('') ||
      '<span class="hint">nenhum evento</span>'}</div>`;

  const addIdeia = () => {
    const v = $('#q-txt').value.trim();
    if (!v) return;
    QUADRO.addIdeia(v); openQuadro(); toast('Anotado no quadro.');
  };
  $('#q-add').addEventListener('click', addIdeia);
  $('#q-txt').addEventListener('keydown', ev => { if (ev.key === 'Enter') addIdeia(); });
  $$('#q-list .x').forEach(b => b.addEventListener('click', () => { QUADRO.delIdeia(+b.dataset.i); openQuadro(); }));
  $('#e-add').addEventListener('click', () => {
    const d = $('#e-data').value.trim(), nm = $('#e-nome').value.trim();
    if (!d || !nm) return;
    QUADRO.addEvento({ data: d, nome: nm, tipo: $('#e-tipo').value.trim() || 'Evento' });
    openQuadro(); toast('Evento marcado.');
  });
  $$('#e-list .x').forEach(b => b.addEventListener('click', () => { QUADRO.delEvento(+b.dataset.i); openQuadro(); }));
  modal.classList.remove('hidden');
}

/* ===========================================================
   VOZ
   =========================================================== */
function speak(txt) {
  if (!('speechSynthesis' in window)) { toast('Este navegador não fala.'); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(txt);
  u.lang = 'pt-BR'; u.rate = 1.05; u.pitch = 1;
  const v = speechSynthesis.getVoices().find(v => /pt[-_]BR/i.test(v.lang));
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

let rec = null, recOn = false;
function toggleVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Reconhecimento de voz não disponível neste navegador — use o Chrome.'); return; }
  if (recOn) { rec && rec.stop(); return; }

  rec = new SR();
  rec.lang = 'pt-BR'; rec.interimResults = false; rec.continuous = false;
  rec.onstart = () => { recOn = true; $('#btn-voice').classList.add('rec'); toast('Ouvindo… fale com o gerente.'); };
  rec.onend   = () => { recOn = false; $('#btn-voice').classList.remove('rec'); };
  rec.onerror = () => { recOn = false; $('#btn-voice').classList.remove('rec'); toast('Não consegui ouvir.'); };
  rec.onresult = e => command(e.results[0][0].transcript.toLowerCase());
  rec.start();
}

function command(txt) {
  toast('🎤 ' + txt);

  if (/relat[óo]rio|resumo|situa[çc][ãa]o/.test(txt)) { openReport(); speak(buildReport().fala); return; }

  if (/(quadro|ideia|evento|agenda)/.test(txt)) { openQuadro(); return; }

  if (/(todos|geral).*(trabalh|servi[çc]o)|volta.*trabalh/.test(txt)) {
    setAll('trabalhando'); speak('Todo mundo de volta às estações.'); return;
  }
  if (/(pausa|descanso|lounge|intervalo)/.test(txt) && /(todos|geral)/.test(txt)) {
    setAll('descanso'); speak('Liberei a equipe para o lounge.'); return;
  }
  if (/reuni[ãa]o/.test(txt) && /(todos|chama|convoca)/.test(txt)) {
    setAll('reuniao'); speak('Convocando todo mundo para a sala de reunião.'); return;
  }
  if (/quem.*(trabalh|produz)/.test(txt)) {
    const w = ROSTER.all().filter(a => a.status === 'trabalhando');
    speak(w.length ? `Trabalhando agora: ${w.map(a => a.name).join(', ')}.` : 'Ninguém trabalhando.');
    return;
  }
  if (/quem.*(descans|lounge|parad)/.test(txt)) {
    const w = ROSTER.all().filter(a => a.status === 'descanso');
    speak(w.length ? `No lounge: ${w.map(a => a.name).join(', ')}.` : 'Lounge vazio.');
    return;
  }
  if (/contrat/.test(txt)) {
    const c = ROSTER.CATALOG.find(c => !ROSTER.isHired(c.key) &&
      (txt.includes(c.name.toLowerCase()) || txt.includes(c.role.toLowerCase().split(' ')[0])));
    if (c) { ROSTER.hire(c.key); syncActors(); renderAll(); speak(`${c.name} contratado como ${c.role}.`); }
    else speak('Não achei esse perfil no banco de talentos.');
    return;
  }
  // "onde está fulano" / "põe fulano pra trabalhar"
  const alvo = ROSTER.all().find(a => txt.includes(a.name.toLowerCase()));
  if (alvo) {
    const ac = actors.get(alvo.id);
    if (/descans|pausa|lounge/.test(txt))      { setStatus(alvo, 'descanso');    speak(`${alvo.name} liberado para o lounge.`); }
    else if (/reuni[ãa]o/.test(txt))           { setStatus(alvo, 'reuniao');     speak(`${alvo.name} indo para a reunião.`); }
    else if (/offline|desliga|encerra/.test(txt)) { setStatus(alvo, 'offline');  speak(`${alvo.name} encerrou o expediente.`); }
    else if (/trabalh|servi[çc]o|volta/.test(txt)) { setStatus(alvo, 'trabalhando'); speak(`${alvo.name} voltou para a estação.`); }
    else if (ac) { focusTile(ac.x, ac.y, 0.95); speak(`${alvo.name} está ${ac.act}.`); }
    renderAll();
    return;
  }
  speak('Não entendi. Tente: relatório, quem está trabalhando, ou todos ao trabalho.');
}

/* ===========================================================
   RELÓGIO
   =========================================================== */
function tickClock() {
  const d = new Date();
  $('#clock').textContent = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const h = d.getHours();
  $('#shift').textContent = (h >= 8 && h < 18) ? 'expediente' : (h >= 18 && h < 23) ? 'turno da noite' : 'madrugada';
  aplicarAgenda();
}

/* ===========================================================
   LIGAÇÃO DA UI
   =========================================================== */
$$('.tab').forEach(b => b.addEventListener('click', () => {
  $$('.tab').forEach(x => x.classList.remove('active'));
  $$('.tabpane').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  $('#pane-' + b.dataset.tab).classList.add('active');
}));

$$('.chip').forEach(b => b.addEventListener('click', () => {
  $$('.chip').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  hireCat = b.dataset.cat;
  renderHire();
}));

$('#team-search').addEventListener('input', renderTeam);
$('#btn-allwork').addEventListener('click', () => { setAll('trabalhando'); toast('Equipe convocada para as estações.'); });
$('#btn-allrest').addEventListener('click', () => { setAll('descanso'); toast('Equipe liberada para o lounge.'); });
$('#btn-report').addEventListener('click', openReport);
$('#btn-avisos').addEventListener('click', () => AVISOS_UI.abrir());
$('#btn-quadro').addEventListener('click', openQuadro);
$('#btn-voice').addEventListener('click', toggleVoice);
$('#btn-speak').addEventListener('click', () => speak(buildReport().fala));
$('#btn-panel').addEventListener('click', () => $('#panel').classList.toggle('open'));

$('#z-in').addEventListener('click',  () => cam.tz = Math.min(2.8, cam.tz * 1.2));
$('#z-out').addEventListener('click', () => cam.tz = Math.max(0.22, cam.tz / 1.2));
$('#z-fit').addEventListener('click', fit);

$('#opt-rgb').addEventListener('change',    e => opts.rgb = e.target.checked);
$('#opt-names').addEventListener('change',  e => opts.names = e.target.checked);
$('#opt-status').addEventListener('change', e => opts.status = e.target.checked);
$('#opt-paths').addEventListener('change',  e => opts.paths = e.target.checked);

$('#btn-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ team: ROSTER.all(), v: 1 }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'equipe.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('#btn-import').addEventListener('click', () => $('#file-import').click());
$('#file-import').addEventListener('change', e => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!Array.isArray(d.team)) throw 0;
      localStorage.setItem('escritorio-agentes-v1', JSON.stringify({ team: d.team, v: 1 }));
      // grava o importado no disco antes de recarregar, senão o load()
      // vai buscar no servidor e trazer de volta a equipe antiga
      fetch('/api/equipe', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
                             body: JSON.stringify({ team: d.team, v: 1 }) })
        .catch(() => {})
        .then(() => ROSTER.load())
        .then(() => { syncActors(); renderAll(); toast('Equipe importada.'); });
    } catch (_) { toast('Arquivo inválido.'); }
  };
  r.readAsText(f);
});
$('#btn-reset').addEventListener('click', async () => {
  if (!await confirmar('Restaurar o quadro padrão?',
      'Os agentes que você cadastrou à mão serão perdidos. Exporte antes se quiser guardar.',
      'Restaurar')) return;
  ROSTER.reset(); syncActors(); renderAll(); toast('Quadro restaurado.');
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!mon.el.classList.contains('hidden')) fecharMonitor(); else closeModal();
  }
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'r' || e.key === 'R') openReport();
  if (e.key === 'f' || e.key === 'F') fit();
  if (e.key === 'q' || e.key === 'Q') openQuadro();
});

/* ===========================================================
   BOOT
   =========================================================== */
/* nome e subtítulo do topo vêm de data/config.json */
(function marca() {
  const E = window.ESCRITORIO || {};
  if (E.nome) { document.title = E.nome; $('#brand-nome').textContent = E.nome.toUpperCase(); }
  if (E.subtitulo !== undefined) $('#brand-sub').textContent = E.subtitulo;
})();
SISTEMAS.atualizar();
setInterval(() => SISTEMAS.atualizar(), 15000);
// a equipe vem do disco, então o boot espera por ela antes de montar o andar
ROSTER.load().then(() => { syncActors(); renderAll(); fit(); });
syncActors();
resize();
fit();
renderAll();
tickClock();
setInterval(tickClock, 15000);
REUNIAO.ligarEventos();
setInterval(sincronizaReuniao, 4000);
setInterval(() => { renderStats(); if ($('#pane-equipe').classList.contains('active')) renderTeam(); }, 2500);
setInterval(renderRooms, 4000);
requestAnimationFrame(frame);

// atalho de depuração: __escritorio.olhar('Tati', 2.4) leva a câmera até alguém
window.__escritorio = {
  cam, actors, fit, focusTile, abrirMonitor, fecharMonitor,
  /** __escritorio.sistema("Tati") abre o monitor do sistema daquele agente */
  sistema(nome) {
    const a = ROSTER.all().find(a => a.name.toLowerCase().includes(String(nome).toLowerCase()));
    if (a) abrirMonitor(a);
    return a ? { nome: a.name, sistema: a.sistema } : null;
  },
  olhar(nome, z) {
    const ac = Array.from(actors.values())
      .find(a => a.a.name.toLowerCase().includes(String(nome).toLowerCase()));
    if (ac) { focusTile(ac.x, ac.y); cam.tz = z || 2.2; }
    return ac ? { nome: ac.a.name, x: ac.x, y: ac.y, sentado: ac.seated, act: ac.act } : null;
  }
};

// primeira visita: um empurrãozinho
setTimeout(() => toast('Clique num boneco para abrir a ficha. Arraste para andar pelo andar.'), 900);

})();
