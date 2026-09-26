/* ===========================================================
   world.js — a planta do escritório
   Grade 48 x 34.  Quatro salas fechadas + circulação.
   =========================================================== */
const WORLD = (() => {

  const W = 48, H = 34;

  const VOID = 0, FLOOR = 1, WALL = 2, DOOR = 3;

  /* ---------- paleta ---------- */
  const C = {
    fire1: '#7c6cff', fire2: '#9d8cff', fire3: '#f59e0b',
    volt1: '#38bdf8', volt2: '#2563eb',
    dark:  '#0b0d15', wall: '#1b2033', wallTop: '#2a3149'
  };

  /* ---------- salas ---------- */
  const ROOMS = {
    diretoria: {
      id: 'diretoria', name: 'DIRETORIA', short: 'Diretoria',
      bx: 0, by: 0, bw: 15, bh: 19,
      x1: 1, y1: 1, x2: 13, y2: 17,
      accent: C.fire1,
      floorA: '#241a24', floorB: '#2c2030',
      desc: 'Sua sala. Vidro fumê, troféu, quadro de ideias e duas estações premium.'
    },
    servico: {
      id: 'servico', name: 'SALA DE SERVIÇO', short: 'Serviço',
      bx: 18, by: 0, bw: 30, bh: 19,
      x1: 19, y1: 1, x2: 46, y2: 17,
      accent: C.volt1,
      floorA: '#111725', floorB: '#151c2e',
      desc: 'Área ampla de operação. 18 estações gamer com RGB — é aqui que o trabalho acontece.'
    },
    lounge: {
      id: 'lounge', name: 'JOGOS & DESCANSO', short: 'Lounge',
      bx: 0, by: 22, bw: 30, bh: 12,
      x1: 1, y1: 23, x2: 28, y2: 32,
      accent: C.fire3,
      floorA: '#1d1630', floorB: '#241b3a',
      desc: 'Sala fechada, separada da operação. Arcade, pebolim, sofás, TV e bar.'
    },
    reuniao: {
      id: 'reuniao', name: 'SALA DE REUNIÃO', short: 'Reunião',
      bx: 32, by: 22, bw: 16, bh: 12,
      x1: 33, y1: 23, x2: 46, y2: 32,
      accent: '#a855f7',
      floorA: '#14182a', floorB: '#191e34',
      desc: 'Mesa de oito lugares e painel de LED. É aqui que os agentes se reúnem.'
    },
    corredor: {
      id: 'corredor', name: 'RECEPÇÃO & CIRCULAÇÃO', short: 'Corredor',
      accent: '#64748b',
      floorA: '#10131f', floorB: '#141827',
      desc: 'Recepção, elevador e a circulação entre as salas.'
    }
  };

  /* ---------- portas (x, y, orientação) ---------- */
  const DOORS = [
    { x: 14, y: 8,  o: 'v' }, { x: 14, y: 9,  o: 'v' },   // diretoria -> hall vertical
    { x: 5,  y: 18, o: 'h' }, { x: 6,  y: 18, o: 'h' },   // diretoria -> corredor
    { x: 18, y: 8,  o: 'v' }, { x: 18, y: 9,  o: 'v' },   // serviço  -> hall vertical
    { x: 30, y: 18, o: 'h' }, { x: 31, y: 18, o: 'h' },   // serviço  -> corredor
    { x: 13, y: 22, o: 'h' }, { x: 14, y: 22, o: 'h' },   // lounge   -> corredor
    { x: 24, y: 22, o: 'h' }, { x: 25, y: 22, o: 'h' },   // lounge   -> corredor (2ª porta)
    { x: 38, y: 22, o: 'h' }, { x: 39, y: 22, o: 'h' }    // reunião  -> corredor
  ];

  /* ---------- grade ---------- */
  const kind   = new Uint8Array(W * H);
  const roomOf = new Array(W * H).fill(null);
  const blocked = new Uint8Array(W * H);   // móveis ocupando o tile

  const idx = (x, y) => y * W + x;
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

  function buildGrid() {
    kind.fill(FLOOR);
    for (let i = 0; i < W * H; i++) roomOf[i] = 'corredor';

    // anel externo
    for (let x = 0; x < W; x++) { kind[idx(x, 0)] = WALL; kind[idx(x, H - 1)] = WALL; }
    for (let y = 0; y < H; y++) { kind[idx(0, y)] = WALL; kind[idx(W - 1, y)] = WALL; }

    // faixa morta entre as salas de baixo e as de cima já é corredor (y 19..21)

    for (const r of Object.values(ROOMS)) {
      if (r.bw === undefined) continue;
      const x0 = r.bx, y0 = r.by, x1 = r.bx + r.bw - 1, y1 = r.by + r.bh - 1;
      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
          if (!inside(x, y)) continue;
          const borda = (x === x0 || x === x1 || y === y0 || y === y1);
          if (borda) { kind[idx(x, y)] = WALL; roomOf[idx(x, y)] = r.id; }
          else       { kind[idx(x, y)] = FLOOR; roomOf[idx(x, y)] = r.id; }
        }
      }
    }

    for (const d of DOORS) if (inside(d.x, d.y)) kind[idx(d.x, d.y)] = DOOR;

    // elevador / entrada na parede leste do corredor
    kind[idx(W - 1, 20)] = WALL;
  }
  buildGrid();

  const kindAt  = (x, y) => inside(x, y) ? kind[idx(x, y)] : VOID;
  const roomAt  = (x, y) => inside(x, y) ? roomOf[idx(x, y)] : null;
  const isWall  = (x, y) => kindAt(x, y) === WALL;

  /** o tile dá para pisar? (usado pelo A*) */
  function walkable(x, y) {
    if (!inside(x, y)) return false;
    const k = kind[idx(x, y)];
    return (k === FLOOR || k === DOOR) && !blocked[idx(x, y)];
  }
  function setBlocked(x, y, v = 1) {
    if (inside(x, y)) blocked[idx(x, y)] = v;
  }

  /* ---------- alturas de parede ----------
     Uma parede que tem chão ATRÁS dela (em x-1 ou y-1) taparia
     a visão: ela vira parapeito sólido + vidro fumê por cima.
     As demais sobem inteiras e viram painel de LED / logo.        */
  const WALL_H = 108, PARAPET = 40;

  function wallOccludes(x, y) {
    const a = kindAt(x - 1, y), b = kindAt(x, y - 1);
    return a === FLOOR || a === DOOR || b === FLOOR || b === DOOR;
  }

  /* ---------- painéis nas paredes altas ---------- */
  const SIGNS = [
    { o: 'n', x: 20, y: 0,  len: 9,  kind: 'equipe'   },  // serviço: a equipe agora
    { o: 'n', x: 30, y: 0,  len: 10, kind: 'nome'     },  // nome do escritório (config)
    { o: 'n', x: 1,  y: 0,  len: 7,  kind: 'eventos'  },  // diretoria: próximos eventos
    { o: 'w', x: 0,  y: 3,  len: 8,  kind: 'quadro'   },  // diretoria: quadro branco
    { o: 'w', x: 0,  y: 24, len: 7,  kind: 'nome'     }   // lounge
  ];

  /* ===========================================================
     DESENHO
     =========================================================== */

  /** superfície de parede em espaço "u (px ao longo) × v (px para baixo)" */
  function wallFace(ctx, orient, x, y, lenTiles, topZ, fn) {
    const T = ISO.TW;
    let o, a, b;
    if (orient === 'n') {                       // face virada para +y
      o = ISO.toScreen(x, y + 1, topZ);
      a =  ISO.HW / T; b =  ISO.HH / T;
    } else {                                    // 'w' — face virada para +x
      // começa na ponta de baixo e cresce subindo à direita;
      // pelo outro lado o texto sairia espelhado
      o = ISO.toScreen(x + 1, y + lenTiles, topZ);
      a =  ISO.HW / T; b = -ISO.HH / T;
    }
    ctx.save();
    ctx.transform(a, b, 0, 1, o.x, o.y);
    fn(ctx, lenTiles * T);
    ctx.restore();
  }

  /* ---- chão ----
     O piso é fixo: 1632 losangos por quadro era desperdício puro. Ele é
     pintado uma vez num canvas próprio e depois só copiado; só o brilho
     RGB refletido continua sendo calculado a cada quadro.                */
  let pisoCache = null;
  function montaPiso() {
    const x0 = ISO.toScreen(0, H - 1).x - ISO.TW;
    const x1 = ISO.toScreen(W - 1, 0).x + ISO.TW;
    const y0 = ISO.toScreen(0, 0).y - 4;
    const y1 = ISO.toScreen(W - 1, H - 1).y + ISO.TH + 4;
    const cv = document.createElement('canvas');
    cv.width  = Math.ceil(x1 - x0);
    cv.height = Math.ceil(y1 - y0);
    const c = cv.getContext('2d');
    c.translate(-x0, -y0);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const k = kind[idx(x, y)];
        if (k !== FLOOR && k !== DOOR) continue;
        const r = ROOMS[roomOf[idx(x, y)]] || ROOMS.corredor;
        let col = ((x + y) & 1) ? r.floorA : r.floorB;
        if (k === DOOR) col = ISO.shade(r.accent, -0.62);
        ISO.tile(c, x, y, col, 'rgba(255,255,255,.028)');
      }
    }
    // faixa pintada no corredor (guia da recepção até as salas)
    c.save();
    c.globalAlpha = .5;
    for (let x = 2; x <= 45; x++) {
      if (walkable(x, 20) && roomAt(x, 20) === 'corredor')
        ISO.tile(c, x, 20, ISO.rgba(C.fire2, .1));
    }
    c.restore();
    pisoCache = { cv, x: x0, y: y0 };
  }

  function drawFloor(ctx, t) {
    if (!pisoCache) montaPiso();
    ctx.drawImage(pisoCache.cv, pisoCache.x, pisoCache.y);

    // brilho RGB refletido no piso da sala de serviço
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let x = ROOMS.servico.x1; x <= ROOMS.servico.x2; x += 7) {
      const p = ISO.toScreen(x, 1.5);
      const hue = (t * 28 + x * 14) % 360;
      ISO.glow(ctx, p.x, p.y, 120, ISO.hsl(hue, 90, 55), .07);
    }
    for (let x = ROOMS.lounge.x1; x <= ROOMS.lounge.x2; x += 8) {
      const p = ISO.toScreen(x, 28);
      const hue = (t * 44 + x * 26) % 360;
      ISO.glow(ctx, p.x, p.y, 150, ISO.hsl(hue, 95, 58), .07);
    }
    ctx.restore();
  }

  /* ---- rótulo flutuante de cada sala ---- */
  function drawRoomLabels(ctx) {
    const put = (r, cx, cy) => {
      const p = ISO.toScreen(cx, cy, 0);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '600 13px Barlow Semi Condensed, sans-serif';
      ctx.fillStyle = ISO.rgba(r.accent, .34);
      ctx.letterSpacing = '4px';
      ctx.fillText(r.name, p.x, p.y);
      ctx.restore();
    };
    put(ROOMS.diretoria, 7, 15.4);
    put(ROOMS.servico, 33, 16.2);
    put(ROOMS.lounge, 14.5, 31.6);
    put(ROOMS.reuniao, 40, 31.4);
  }

  const cacheGrad = new Map();

  /* ---- uma parede ---- */
  function drawWallTile(ctx, x, y, t, rgbOn, zoom) {
    // afastado, o vidro fumê da divisória some em menos de um pixel
    const detalhe = (zoom === undefined || zoom > 0.7);
    const occ  = wallOccludes(x, y);
    const room = ROOMS[roomOf[idx(x, y)]] || ROOMS.corredor;
    const h    = occ ? PARAPET : WALL_H;

    const showLeft  = !isWall(x, y + 1);   // face virada para +y
    const showRight = !isWall(x + 1, y);   // face virada para +x
    if (!showLeft && !showRight) {
      ISO.plane(ctx, x, y, 1, 1, WALL_H, C.wallTop);
      return;
    }

    const P = ISO.toScreen;
    const base = C.wall;

    const faces = [];
    if (showLeft)  faces.push({ o: 'n', pts: [P(x, y+1, h), P(x+1, y+1, h), P(x+1, y+1, 0), P(x, y+1, 0)], sh: -0.05 });
    if (showRight) faces.push({ o: 'w', pts: [P(x+1, y, h), P(x+1, y+1, h), P(x+1, y+1, 0), P(x+1, y, 0)], sh: -0.3  });

    for (const f of faces) {
      // corpo
      // as coordenadas da face são fixas em espaço de mundo, então o
      // gradiente pode ser criado uma vez só por tile
      const ck = x + ',' + y + ',' + f.o;
      let g = cacheGrad.get(ck);
      if (!g) {
        g = ctx.createLinearGradient(0, f.pts[0].y, 0, f.pts[2].y);
        g.addColorStop(0, ISO.shade(base, f.sh + 0.06));
        g.addColorStop(1, ISO.shade(base, f.sh - 0.28));
        cacheGrad.set(ck, g);
      }
      ISO.quad(ctx, f.pts, g);

      // rodapé com fita de LED
      if (rgbOn) {
        const hue = (t * 34 + (x + y) * 11) % 360;
        const neon = ISO.hsl(hue, 92, 58);
        const y0 = f.pts[3].y, y1 = f.pts[0].y;
        const strip = [
          f.pts[3], f.pts[2],
          { x: f.pts[2].x, y: f.pts[2].y - 5 },
          { x: f.pts[3].x, y: f.pts[3].y - 5 }
        ];
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ISO.quad(ctx, strip, ISO.rgba(neon, .55));
        ctx.restore();
        void y0; void y1;
      }
    }

    // topo
    ISO.plane(ctx, x, y, 1, 1, h, occ ? ISO.rgba('#8fa4d8', .28) : C.wallTop);

    if (occ && detalhe) {
      // vidro fumê acima do parapeito
      for (const f of faces) {
        const top = [
          P(f.o === 'n' ? x : x + 1, f.o === 'n' ? y + 1 : y,     WALL_H),
          P(x + 1, y + 1, WALL_H),
          P(x + 1, y + 1, h),
          P(f.o === 'n' ? x : x + 1, f.o === 'n' ? y + 1 : y,     h)
        ];
        ISO.quad(ctx, top, ISO.rgba('#9fc4ff', .085));
        ISO.quad(ctx, top, null, ISO.rgba('#bcd8ff', .12));
      }
      ISO.plane(ctx, x, y, 1, 1, WALL_H, ISO.rgba(room.accent, rgbOn ? .30 : .12));
    }

    // trilho de LED no topo da parede — é a cara do lugar, nunca some
    if (rgbOn) {
      const hue = (t * 34 + (x + y) * 11) % 360;
      const neon = ISO.hsl(hue, 95, 60);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // a fita já brilha sozinha; um glow radial por tile custava mais
      // área pintada que a tela inteira, várias vezes por quadro
      ISO.plane(ctx, x + .02, y + .02, .96, .96, WALL_H + 2, ISO.rgba(neon, .6));
      ctx.restore();
    }

    drawSignTile(ctx, x, y, t, rgbOn);
  }

  /**
   * Fatia da placa que pertence a este tile de parede.
   * Uma placa larga tem uma profundidade só; se ela fosse um item solto na
   * ordenação, os tiles de parede depois dela pintariam por cima e a placa
   * parecia enfiada dentro da parede. Recortando por tile, cada pedaço é
   * pintado junto com a sua própria parede.
   */
  function drawSignTile(ctx, x, y, t, rgbOn) {
    for (const s of SIGNS) {
      const cobre = s.o === 'n'
        ? (s.y === y && x >= s.x && x < s.x + s.len)
        : (s.x === x && y >= s.y && y < s.y + s.len);
      if (!cobre) continue;

      // recorte por clip custava caro; agora copia só a fatia da placa que
      // é deste tile, direto do canvas em cache
      const T = ISO.TW;
      const off = s.o === 'n' ? (x - s.x) * T
                              : (s.y + s.len - 1 - y) * T;
      const cv = placaCanvas(s, t, rgbOn);
      wallFace(ctx, s.o, x, y, 1, WALL_H, (c) =>
        c.drawImage(cv, off, 0, T, WALL_H, 0, 0, T, WALL_H));
    }
  }

  /* ---- porta ---- */
  function drawDoorTile(ctx, x, y, t) {
    const d = DOORS.find(d => d.x === x && d.y === y);
    if (!d) return;
    const hue = (t * 34 + (x + y) * 11) % 360;
    const neon = ISO.hsl(hue, 95, 60);
    const P = ISO.toScreen;
    const h = 96;

    // batentes laterais
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (d.o === 'h') {
      ISO.quad(ctx, [P(x, y+1, h), P(x+1, y+1, h), P(x+1, y+1, h-4), P(x, y+1, h-4)], ISO.rgba(neon, .65));
    } else {
      ISO.quad(ctx, [P(x+1, y, h), P(x+1, y+1, h), P(x+1, y+1, h-4), P(x+1, y, h-4)], ISO.rgba(neon, .65));
    }
    const c = ISO.toScreen(x + .5, y + .5, 30);
    ISO.glow(ctx, c.x, c.y, 62, neon, .18);
    ctx.restore();
  }

  /** profundidade do painel, para ele entrar na ordenação junto com
      móveis e bonecos — senão ele seria pintado por cima de todo mundo */
  function signDepth(s) {
    return s.o === 'n' ? (s.x + s.len / 2) + (s.y + 1)
                       : (s.x + 1) + (s.y + s.len / 2);
  }

  /* ---- conteúdo de uma placa, em espaço plano de parede ---- */
  function pintaPlaca(c, s, len, t, rgbOn) {
    if (s.kind === 'nome') {
      const padY = 16, hgt = 62;
      c.fillStyle = 'rgba(4,5,10,.62)';
      ISO.rrect(c, 6, padY, len - 12, hgt, 8); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 1; c.stroke();
      signNome(c, len, padY, hgt, rgbOn);
    }
    else if (s.kind === 'equipe')  signEquipe(c, len, t, rgbOn);
    else if (s.kind === 'eventos') signEventos(c, len, rgbOn);
    else if (s.kind === 'quadro')  signQuadro(c, len);
  }

  /* Cada placa é pintada uma vez num canvas próprio e depois só é COPIADA
     para cada tile de parede. Antes ela era redesenhada inteira por tile —
     50 desenhos completos por quadro, vários com shadowBlur, e era daí que
     vinha quase toda a lentidão.                                          */
  const cachePlaca = new Map();
  function placaCanvas(s, t, rgbOn) {
    let c = cachePlaca.get(s);
    if (!c) {
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(s.len * ISO.TW); cv.height = WALL_H;
      c = { cv, ctx: cv.getContext('2d'), t: -1e9, rgb: null };
      cachePlaca.set(s, c);
    }
    // repinta no máximo ~6x por segundo; o olho não vê diferença
    if (t - c.t > 0.16 || c.t > t || c.rgb !== rgbOn) {
      c.t = t; c.rgb = rgbOn;
      c.ctx.clearRect(0, 0, c.cv.width, c.cv.height);
      pintaPlaca(c.ctx, s, c.cv.width, t, rgbOn);
    }
    return c.cv;
  }

  /* ---- logos e painéis nas paredes altas ---- */
  function drawSigns(ctx, t, rgbOn, lista) {
    for (const s of (lista || SIGNS)) {
      const cv = placaCanvas(s, t, rgbOn);
      wallFace(ctx, s.o, s.x, s.y, s.len, WALL_H, (c) => c.drawImage(cv, 0, 0));
    }
  }

  /* ---- painel da equipe: quem está trabalhando agora ---- */
  function signEquipe(c, len, t, rgbOn) {
    const x0 = 8, y0 = 12, w = len - 16, h = 84;
    c.fillStyle = 'rgba(5,7,13,.88)';
    ISO.rrect(c, x0, y0, w, h, 8); c.fill();
    c.strokeStyle = 'rgba(56,189,248,.35)'; c.lineWidth = 1.4; c.stroke();

    c.textBaseline = 'middle'; c.textAlign = 'left';
    c.font = "700 11px 'Barlow Semi Condensed', sans-serif";
    c.fillStyle = '#38bdf8'; c.letterSpacing = '2px';
    c.fillText('EQUIPE AGORA', x0 + 12, y0 + 12);
    c.letterSpacing = '0px';
    c.strokeStyle = 'rgba(255,255,255,.09)';
    c.beginPath(); c.moveTo(x0 + 10, y0 + 22); c.lineTo(x0 + w - 10, y0 + 22); c.stroke();

    const RO = (typeof ROSTER !== 'undefined') ? ROSTER : null;
    const SI = (typeof SISTEMAS !== 'undefined') ? SISTEMAS : null;
    const n = st => RO ? RO.count(st) : 0;
    const noAr = SI ? SI.todos().filter(s => s.estado === 'no ar' || s.estado === 'web').length : 0;
    const cels = [
      { r: 'TRABALHANDO', v: String(n('trabalhando') + n('reuniao')), cor: '#23e08a' },
      { r: 'DESCANSO',    v: String(n('descanso')),                   cor: '#c4b8ff' },
      { r: 'OFFLINE',     v: String(n('offline')),                    cor: '#8b93ad' },
      { r: 'SISTEMAS',    v: String(noAr),                            cor: '#38bdf8' }
    ];
    const cw = (w - 20) / cels.length;
    cels.forEach((cel, i) => {
      const cx = x0 + 10 + i * cw;
      if (i) {
        c.strokeStyle = 'rgba(255,255,255,.07)';
        c.beginPath(); c.moveTo(cx - 2, y0 + 28); c.lineTo(cx - 2, y0 + h - 8); c.stroke();
      }
      c.textAlign = 'left';
      c.font = "600 8.5px 'Barlow Semi Condensed', sans-serif";
      c.fillStyle = 'rgba(180,190,215,.75)';
      c.fillText(cel.r, cx + 8, y0 + 36);
      c.font = "700 20px 'Barlow', sans-serif";
      c.fillStyle = cel.cor;
      if (rgbOn) { c.shadowColor = ISO.rgba(cel.cor, .8); c.shadowBlur = 12; }
      c.fillText(cel.v, cx + 8, y0 + 56);
      c.shadowBlur = 0;
      const amp = rgbOn ? (.45 + .55 * Math.abs(Math.sin(t * 1.1 + i))) : .7;
      c.fillStyle = ISO.rgba(cel.cor, .5);
      c.fillRect(cx + 8, y0 + 66, (cw - 24) * amp, 2.5);
    });
  }

  /* ---- agenda de eventos da diretoria ---- */
  function signEventos(c, len, rgbOn) {
    const evs = (typeof QUADRO !== 'undefined') ? QUADRO.eventos() : [];
    const x0 = 8, y0 = 12, w = len - 16, h = 84;

    c.fillStyle = 'rgba(5,7,13,.9)';
    ISO.rrect(c, x0, y0, w, h, 8); c.fill();
    c.strokeStyle = 'rgba(56,189,248,.32)'; c.lineWidth = 1.4; c.stroke();

    c.textBaseline = 'middle'; c.textAlign = 'left';
    c.font = "700 11px 'Barlow Semi Condensed', sans-serif";
    c.fillStyle = '#38bdf8'; c.letterSpacing = '2px';
    if (rgbOn) { c.shadowColor = 'rgba(56,189,248,.7)'; c.shadowBlur = 10; }
    c.fillText('PRÓXIMOS EVENTOS', x0 + 12, y0 + 13);
    c.shadowBlur = 0; c.letterSpacing = '0px';
    c.strokeStyle = 'rgba(255,255,255,.09)';
    c.beginPath(); c.moveTo(x0 + 10, y0 + 23); c.lineTo(x0 + w - 10, y0 + 23); c.stroke();

    if (!evs.length) {
      c.font = "600 10px 'Barlow Semi Condensed', sans-serif";
      c.fillStyle = 'rgba(150,160,190,.6)';
      c.fillText('nenhum evento marcado', x0 + 14, y0 + 42);
      return;
    }
    evs.slice(0, 4).forEach((e, i) => {
      const ry = y0 + 36 + i * 15;
      c.font = "700 10px 'Barlow', sans-serif";
      c.fillStyle = '#c4b8ff';
      c.fillText(e.data, x0 + 14, ry);
      c.font = "600 10px 'Barlow Semi Condensed', sans-serif";
      c.fillStyle = '#e4e9f6';
      c.fillText(e.nome, x0 + 58, ry);
      c.textAlign = 'right';
      c.font = "600 8.5px 'Barlow Semi Condensed', sans-serif";
      c.fillStyle = 'rgba(56,189,248,.8)';
      c.fillText(e.tipo, x0 + w - 14, ry);
      c.textAlign = 'left';
    });
  }

  /* ---- quadro branco de ideias ---- */
  function signQuadro(c, len) {
    const ideias = (typeof QUADRO !== 'undefined') ? QUADRO.ideias() : [];
    const x0 = 10, y0 = 10, w = len - 20, h = 88;

    // moldura de alumínio
    c.fillStyle = '#5b6377';
    ISO.rrect(c, x0 - 3, y0 - 3, w + 6, h + 6, 5); c.fill();
    // superfície branca
    const g = c.createLinearGradient(0, y0, 0, y0 + h);
    g.addColorStop(0, '#f6f8fb'); g.addColorStop(1, '#dde3ec');
    c.fillStyle = g;
    ISO.rrect(c, x0, y0, w, h, 3); c.fill();
    // reflexo
    c.fillStyle = 'rgba(255,255,255,.55)';
    c.beginPath();
    c.moveTo(x0 + w * .55, y0); c.lineTo(x0 + w, y0);
    c.lineTo(x0 + w, y0 + h * .5); c.closePath(); c.fill();

    c.textBaseline = 'middle'; c.textAlign = 'left';
    c.font = "700 11px 'Barlow Semi Condensed', sans-serif";
    c.fillStyle = '#d8342a'; c.letterSpacing = '1.5px';
    c.fillText('IDEIAS', x0 + 12, y0 + 14);
    c.letterSpacing = '0px';
    c.font = "600 8px 'Barlow Semi Condensed', sans-serif";
    c.fillStyle = 'rgba(70,80,100,.7)';
    c.fillText('botão 📌 Quadro', x0 + 58, y0 + 14);
    c.strokeStyle = 'rgba(216,52,42,.5)'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(x0 + 12, y0 + 22); c.lineTo(x0 + w - 14, y0 + 22); c.stroke();

    const cores = ['#1f5fd0', '#1f8a4c', '#d8342a', '#7b3fc4', '#0f7f92', '#b8620a'];
    ideias.slice(0, 5).forEach((txt, i) => {
      const ry = y0 + 36 + i * 12.5;
      c.fillStyle = cores[i % cores.length];
      c.beginPath(); c.arc(x0 + 17, ry - 1, 2, 0, 7); c.fill();
      c.font = "600 10.5px 'Barlow Semi Condensed', sans-serif";
      c.fillText(txt, x0 + 25, ry);
    });
    if (!ideias.length) {
      c.font = "italic 600 10px 'Barlow Semi Condensed', sans-serif";
      c.fillStyle = 'rgba(70,80,100,.55)';
      c.fillText('quadro vazio', x0 + 25, y0 + 38);
    }
    // canetinhas na bandeja
    ['#d8342a', '#1f5fd0', '#1f8a4c'].forEach((cor, i) => {
      c.fillStyle = cor;
      ISO.rrect(c, x0 + w - 60 + i * 15, y0 + h - 8, 12, 4, 2); c.fill();
    });
  }

  /* ---- placa com o nome do escritório (data/config.json) ---- */
  function signNome(c, len, y0, h, rgbOn) {
    const E = window.ESCRITORIO || {};
    const nome = String(E.nome || 'Escritório de Agentes').toUpperCase();
    const cx = len / 2, cy = y0 + h / 2;
    c.save();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    let tam = 26;
    c.font = `700 ${tam}px 'Barlow', sans-serif`;
    while (tam > 10 && c.measureText(nome).width > len - 36) { tam--; c.font = `700 ${tam}px 'Barlow', sans-serif`; }
    c.fillStyle = '#ffffff';
    if (rgbOn) { c.shadowColor = 'rgba(124,108,255,.8)'; c.shadowBlur = 14; }
    c.fillText(nome, cx, cy - 6);
    c.shadowBlur = 0;
    if (E.subtitulo) {
      c.font = `500 ${Math.min(10, len / 22)}px 'Barlow Semi Condensed', sans-serif`;
      c.fillStyle = 'rgba(200,210,235,.6)'; c.letterSpacing = '2px';
      c.fillText(String(E.subtitulo).toUpperCase().slice(0, 48), cx, cy + 16);
    }
    c.restore();
  }


  /* ---- luminárias e detalhes de teto no chão (decalques) ---- */
  function drawDecals(ctx, t) { /* piso liso: sem logo pintado */ }

  /* ---------- pontos de interesse ---------- */
  const SPAWN = { x: 45, y: 20 };          // elevador / recepção

  return {
    W, H, VOID, FLOOR, WALL, DOOR, C,
    ROOMS, DOORS, SPAWN, WALL_H, PARAPET,
    SIGNS, signDepth,
    kindAt, roomAt, isWall, walkable, setBlocked, wallOccludes,
    drawFloor, drawWallTile, drawDoorTile, drawSigns, drawDecals, drawRoomLabels,
    wallFace
  };
})();
