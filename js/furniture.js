/* ===========================================================
   furniture.js — móveis, estações de trabalho e pontos de lazer

   Convenção de altura (px acima do piso):
     0 .. 25   estrutura da mesa
     28        tampo  (tudo que fica "em cima da mesa" nasce aqui)
     28 .. 62  monitor
     9 .. 15   assento da cadeira  (bate com AVATAR.SEAT = 15)
   =========================================================== */
const FURN = (() => {

  const items = [];
  const workSlots = [];
  const restSlots = [];
  const meetSlots = [];

  const TOP  = 28;          // tampo da mesa
  const S    = ISO.toScreen;
  const add  = (o) => { items.push(o); return o; };

  function block(x, y, w, d) {
    for (let i = Math.floor(x); i < Math.ceil(x + w); i++)
      for (let j = Math.floor(y); j < Math.ceil(y + d); j++)
        WORLD.setBlocked(i, j, 1);
  }

  /** cadeira no lugar do boneco, em duas camadas para ele sentar DENTRO dela.
      A pegada acompanha a escala do boneco: se a cadeira ficasse menor que
      ele, o corpo sobraria para fora do encosto.                          */
  function cadeira(seat, tipo, hue) {
    const L = 1.05 * AVATAR.SCALE;                   // lado da pegada, em tiles
    const comum = { x: seat.x - L / 2, y: seat.y - L / 2, w: L, d: L,
                    face: seat.facing, hue: hue || 200 };
    // o boneco é desenhado em (seat.x + seat.y + 0.5)
    add(Object.assign({ t: tipo, camada: 'tras',   dk: seat.x + seat.y - 0.25 }, comum));
    return add(Object.assign({ t: tipo, camada: 'frente', dk: seat.x + seat.y + 0.75 }, comum));
  }

  /* ===========================================================
     LAYOUT
     =========================================================== */

  /* ---------- SALA DE SERVIÇO: 12 estações ----------
     Duas fileiras. A que ficava colada na parede do fundo saiu: tapava o
     painel de números e deixava a sala apertada.                        */
  const COLS = [21, 25, 29, 33, 37, 41];
  const ROWS = [
    { y: 7,  face: 's' },      // de frente: vemos o rosto, monitor de costas
    { y: 12, face: 'n' }       // de costas: a tela aparece para nós
  ];
  let n = 0;
  for (const r of ROWS) {
    for (const x of COLS) {
      n++;
      const id = 'D' + String(n).padStart(2, '0');
      const hue = (n * 41) % 360;
      let deskY, seat;
      if (r.face === 'n') { deskY = r.y;       seat = { x: x + 1.5, y: r.y + 2.0,  facing: 'n' }; }
      else                { deskY = r.y + 1.9; seat = { x: x + 1.5, y: r.y + 1.20, facing: 's' }; }

      const mesa = add({ t: 'deskGamer', id, x, y: deskY, w: 3, d: 1.3,
                         face: r.face, busy: false, hue, sabor: n % 3 });
      block(x, deskY, 3, 1.3);
      cadeira(seat, 'chairGamer', hue);
      workSlots.push({ id, room: 'servico', label: 'Estação ' + id,
                       x: seat.x, y: seat.y, facing: seat.facing, obj: mesa });
    }
  }


  /* ---------- DIRETORIA ---------- */
  const seatA = { x: 4.5, y: 4.0,  facing: 's' };
  const mesaA = add({ t: 'deskBoss', id: 'DIR-1', x: 2.4, y: 4.7, w: 4.2, d: 1.6,
                      face: 's', busy: false, hue: 8, controle: true });
  block(2.4, 4.7, 4.2, 1.6);
  cadeira(seatA, 'chairBoss');
  workSlots.push({ id: 'DIR-1', room: 'diretoria', label: 'Mesa da diretoria 1',
                   x: seatA.x, y: seatA.y, facing: 's', obj: mesaA, vip: true });

  const seatB = { x: 4.5, y: 11.0, facing: 's' };
  const mesaB = add({ t: 'deskBoss', id: 'DIR-2', x: 2.4, y: 11.7, w: 4.2, d: 1.6,
                      face: 's', busy: false, hue: 196, controle: true });
  block(2.4, 11.7, 4.2, 1.6);
  cadeira(seatB, 'chairBoss');
  workSlots.push({ id: 'DIR-2', room: 'diretoria', label: 'Mesa da diretoria 2',
                   x: seatB.x, y: seatB.y, facing: 's', obj: mesaB, vip: true });

  add({ t: 'rug',      x: 1.6, y: 7.0, w: 6, d: 3.4, c: '#3a1620' });
  add({ t: 'sofa',     x: 9.0, y: 6.4, w: 1.6, d: 3.2, dir: 'w', c: '#2b1a2e' });  block(9.0, 6.4, 1.6, 3.2);
  add({ t: 'lowTable', x: 6.8, y: 7.6, w: 1.6, d: 1.6 });                          block(6.8, 7.6, 1.6, 1.6);
  add({ t: 'trophy',   x: 11.2, y: 2.4 });                                         block(11.2, 2.4, 1.2, 1.2);
  add({ t: 'plant',    x: 11.6, y: 15.4, k: 1 });                                  block(11.6, 15.4, 1, 1);
  add({ t: 'plant',    x: 1.4,  y: 15.8, k: 0 });                                  block(1.4, 15.8, 1, 1);
  add({ t: 'cooler',   x: 11.6, y: 8.6 });                                         block(11.6, 8.6, 1, 1);

  /* ---------- LOUNGE ---------- */
  [2.2, 4.2, 6.2].forEach((x, i) => {
    const o = add({ t: 'arcade', x, y: 23.2, w: 1.5, d: 1.2, hue: [12, 190, 300][i] });
    block(x, 23.2, 1.5, 1.2);
    restSlots.push({ id: 'ARC' + i, label: 'arcade', x: x + 0.75, y: 25.0, facing: 'n',
                     act: 'jogando fliperama', obj: o });
  });

  const pool = add({ t: 'poolTable', x: 9.6, y: 25, w: 4.6, d: 2.6 });
  block(9.6, 25, 4.6, 2.6);
  restSlots.push({ id: 'POOL0', label: 'sinuca', x: 8.6,  y: 26.3, facing: 'e', act: 'na sinuca', obj: pool });
  restSlots.push({ id: 'POOL1', label: 'sinuca', x: 15.0, y: 26.3, facing: 'w', act: 'na sinuca', obj: pool });
  restSlots.push({ id: 'POOL2', label: 'sinuca', x: 11.9, y: 24.3, facing: 's', act: 'na sinuca', obj: pool });

  const peb = add({ t: 'foosball', x: 9.8, y: 29.4, w: 4.2, d: 2 });
  block(9.8, 29.4, 4.2, 2);
  restSlots.push({ id: 'PEB0', label: 'pebolim', x: 8.6,  y: 30.4, facing: 'e', act: 'no pebolim', obj: peb });
  restSlots.push({ id: 'PEB1', label: 'pebolim', x: 14.7, y: 30.4, facing: 'w', act: 'no pebolim', obj: peb });

  add({ t: 'tvWall', x: 18.4, y: 23.15, w: 5, d: 0.5 });
  const sofaL = add({ t: 'sofa', x: 18.6, y: 26.4, w: 4.6, d: 1.6, dir: 'n', c: '#241c3c' });
  block(18.6, 26.4, 4.6, 1.6);
  ['SOF0', 'SOF1', 'SOF2'].forEach((id, i) =>
    restSlots.push({ id, label: 'sofá', x: 19.7 + i * 1.4, y: 27.3, facing: 'n',
                     sit: true, act: 'vendo TV', obj: sofaL }));
  add({ t: 'rug', x: 18.2, y: 24.4, w: 5.4, d: 2, c: '#1b2440' });

  [[25.2, 27.6, 24], [26.8, 29.4, 300], [24.4, 30.2, 160]].forEach((b, i) => {
    const o = add({ t: 'beanbag', x: b[0], y: b[1], hue: b[2] });
    block(b[0], b[1], 1.2, 1.2);
    restSlots.push({ id: 'BAG' + i, label: 'puff', x: b[0] + 0.6, y: b[1] + 0.55,
                     facing: 's', sit: true, act: 'jogando no celular', obj: o });
  });

  const bar = add({ t: 'bar', x: 2, y: 30.4, w: 5.4, d: 1.4 });
  block(2, 30.4, 5.4, 1.4);
  restSlots.push({ id: 'BAR0', label: 'bar', x: 3.0, y: 29.4, facing: 's', act: 'tomando um café', obj: bar });
  restSlots.push({ id: 'BAR1', label: 'bar', x: 5.4, y: 29.4, facing: 's', act: 'tomando um café', obj: bar });

  add({ t: 'vending',     x: 26.6, y: 23.2 });                block(26.6, 23.2, 1.2, 1.2);
  add({ t: 'plant', x: 16.6, y: 23.4, k: 1 });                 block(16.6, 23.4, 1, 1);
  add({ t: 'plant', x: 27.0, y: 31.2, k: 0 });                 block(27.0, 31.2, 1, 1);
  add({ t: 'neonSign', x: 15.4, y: 23.2, txt: 'GAME ZONE', hue: 300 });

  /* ---------- SALA DE REUNIÃO ---------- */
  const mtable = add({ t: 'meetTable', x: 36, y: 26, w: 7, d: 3.2 });
  block(36, 26, 7, 3.2);
  [36.8, 38.8, 40.8].forEach((x, i) => {
    const s = { id: 'MT' + i, x, y: 25.2, facing: 's', sit: true, obj: mtable };
    meetSlots.push(s); cadeira(s, 'chairSimple');
  });
  [36.8, 38.8, 40.8].forEach((x, i) => {
    const s = { id: 'MB' + i, x, y: 29.9, facing: 'n', sit: true, obj: mtable };
    meetSlots.push(s); cadeira(s, 'chairSimple');
  });
  [{ id: 'ML', x: 35.2, y: 27.6, facing: 'e' }, { id: 'MR', x: 43.7, y: 27.6, facing: 'w' }]
    .forEach(p => {
      const s = Object.assign({ sit: true, obj: mtable }, p);
      meetSlots.push(s); cadeira(s, 'chairSimple');
    });

  add({ t: 'tvWall', x: 37.5, y: 23.15, w: 4.6, d: 0.5, meeting: true });
  add({ t: 'plant', x: 33.4, y: 31.2, k: 0 });               block(33.4, 31.2, 1, 1);

  /* ---------- CORREDOR / RECEPÇÃO ---------- */
  add({ t: 'elevator',  x: 46, y: 19.2, w: 1, d: 2 });
  add({ t: 'reception', x: 42.6, y: 19, w: 2.6, d: 1 }); block(42.6, 19, 2.6, 1);
  add({ t: 'plant', x: 37.2, y: 19, k: 0 }); block(37.2, 19, 1, 1);
  add({ t: 'plant', x: 34.0, y: 19, k: 1 }); block(34.0, 19, 1, 1);

  add({ t: 'rack', x: 8.4,  y: 19, label: 'DADOS',     hue: 190 }); block(8.4, 19, 1.2, 1);
  add({ t: 'rack', x: 10.0, y: 19, label: 'AGENTES',   hue: 20  }); block(10.0, 19, 1.2, 1);
  add({ t: 'rack', x: 11.6, y: 19, label: 'CORE',      hue: 280 }); block(11.6, 19, 1.2, 1);

  [2.2, 17.4, 27.4].forEach((x, i) => { add({ t: 'plant', x, y: 19, k: i % 2 }); block(x, 19, 1, 1); });
  add({ t: 'neonSign', x: 20.4, y: 19, txt: String((window.ESCRITORIO && ESCRITORIO.nome) || 'ESCRITÓRIO').toUpperCase().slice(0, 16), hue: 190 });

  /* ===========================================================
     DESENHO
     =========================================================== */
  /** pinta sub-peças de um móvel do fundo para a frente (menor y primeiro) */
  function emOrdem(pecas) {
    pecas.sort((a, b) => a[0] - b[0]).forEach(p => p[1]());
  }

  /* Peças que nunca mudam (cadeira, sinuca, pebolim, sofá, expositor…) são
     pintadas uma vez num canvas próprio e depois só copiadas. O cache é
     feito em 2x para continuar nítido no zoom. O que tem RGB ou animação
     — mesa, arcade, rack, TV, planta — continua sendo desenhado ao vivo. */
  const ALTURA_CACHE = {
    chairGamer: 78, chairBoss: 84, chairSimple: 58, expositor: 96,
    pilhaCaixas: 118, poolTable: 56, foosball: 52, sofa: 60,
    rug: 12, lowTable: 40, cooler: 64
  };
  const ESC_CACHE = 2;
  const cacheMovel = new Map();

  function montaCacheMovel(o, f) {
    const w = o.w || 1, d = o.d || 1;
    const alto = ALTURA_CACHE[o.t] || 120;
    const x0 = ISO.toScreen(o.x, o.y + d).x - 22;
    const x1 = ISO.toScreen(o.x + w, o.y).x + 22;
    const y0 = ISO.toScreen(o.x, o.y).y - alto;
    const y1 = ISO.toScreen(o.x + w, o.y + d).y + 26;
    const W = Math.ceil((x1 - x0) * ESC_CACHE), H = Math.ceil((y1 - y0) * ESC_CACHE);
    if (W <= 0 || H <= 0 || W * H > 1.2e6) return null;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    c.scale(ESC_CACHE, ESC_CACHE);
    c.translate(-x0, -y0);
    f(c, o, 0);
    return { cv, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  function drawItem(ctx, o, t) {
    const f = DRAW[o.t];
    if (!f) return;
    if (!(o.t in ALTURA_CACHE)) { f(ctx, o, t); return; }
    let c = cacheMovel.get(o);
    if (c === undefined) { c = montaCacheMovel(o, f); cacheMovel.set(o, c); }
    if (!c) { f(ctx, o, t); return; }
    ctx.drawImage(c.cv, c.x, c.y, c.w, c.h);
  }
  function depth(o) {
    if (o.dk !== undefined) return o.dk;
    return (o.x + (o.w || 1) / 2) + (o.y + (o.d || 1) / 2);
  }

  /** superfície virada para +y (a que a câmera enxerga), em px */
  function faceY(ctx, x, yPlane, lenTiles, topZ, fn) {
    const T = ISO.TW;
    const o = ISO.toScreen(x, yPlane, topZ);
    ctx.save();
    ctx.transform(ISO.HW / T, ISO.HH / T, 0, 1, o.x, o.y);
    fn(ctx, lenTiles * T);
    ctx.restore();
  }

  /** caneca de café em cima da mesa (cor muda por mesa) */
  const CANECAS = ['#e9edf8', '#7c6cff', '#38bdf8', '#f472b6', '#22c55e'];
  function caneca(ctx, cx, cy, z, cor, s = 1) {
    const c = CANECAS[((cor | 0) % CANECAS.length + CANECAS.length) % CANECAS.length];
    const r = 0.11 * s;
    ISO.cyl(ctx, cx, cy, r, 13 * s, z, c);
    ISO.cyl(ctx, cx, cy, r * .82, 1.5, z + 13 * s - 1.5, '#3b2418');
    const p = ISO.toScreen(cx + r * 1.2, cy, z + 7 * s);
    ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = 1.6 * s;
    ctx.beginPath(); ctx.arc(p.x + 1.5 * s, p.y, 2.6 * s, -1.3, 1.3); ctx.stroke(); ctx.restore();
  }

  const DRAW = {

    /* ================= MESA GAMER =================
       Suporta mesa no eixo Y (face 'n'/'s') e no eixo X (face 'e'/'w').
       No eixo X o boneco senta de perfil e a mesa fica ao lado dele.     */
    deskGamer(ctx, o, t) {
      const { x, y, w, d } = o;
      const neon = ISO.hsl((o.hue + t * 26) % 360, 92, 58);
      const eixoX = (o.face === 'e' || o.face === 'w');
      // a tela só aponta para a câmera quando o boneco está de costas
      const telaVisivel = (o.face === 'n' || o.face === 'w');

      ISO.shadow(ctx, x + w / 2, y + d / 2, Math.max(w, d) * .55, .28);

      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gp = S(x + w / 2, y + d / 2, 6);
      ISO.glow(ctx, gp.x, gp.y, 74, neon, o.busy ? .3 : .13);
      ctx.restore();

      /* estrutura: dois painéis nas pontas + travessa */
      if (eixoX) {
        ISO.box(ctx, x + .12, y + .05,      w - .24, .17, 25, 0, '#1c202b');
        ISO.box(ctx, x + .12, y + d - .22,  w - .24, .17, 25, 0, '#1c202b');
        ISO.box(ctx, x + .16, y + .22,      .1, d - .44, 14, 6, '#181c26');
      } else {
        ISO.box(ctx, x + .05,     y + .12, .17, d - .24, 25, 0, '#1c202b');
        ISO.box(ctx, x + w - .22, y + .12, .17, d - .24, 25, 0, '#1c202b');
        ISO.box(ctx, x + .22,     y + .16, w - .44, .1,  14, 6, '#181c26');
      }
      ISO.plane(ctx, x - .05, y - .05, w + .1, d + .1, TOP, '#39414f');
      ISO.plane(ctx, x + .1,  y + .06, w - .2, d - .22, TOP + .1, 'rgba(255,255,255,.028)');

      // fita de LED na borda do tampo virada para a câmera
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ISO.quad(ctx, [S(x - .05, y + d + .05, 25), S(x + w + .05, y + d + .05, 25),
                     S(x + w + .05, y + d + .05, 21), S(x - .05, y + d + .05, 21)],
               ISO.rgba(neon, .68));
      ctx.restore();

      if (eixoX) {
        // mesa de lado: monitor no fundo, teclado na beira de quem senta
        const cy  = y + d / 2;
        const monX = o.face === 'e' ? x + .55 : x + .2;
        const tecX = o.face === 'e' ? x + .06 : x + .62;
        emOrdem([
          [monX, () => monitorY(ctx, monX, cy - .85, 1.7, telaVisivel, o.busy, neon, t)],
          [tecX, () => tecladoY(ctx, tecX, cy - .78, neon)],
          [x + .1,  () => gabinete(ctx, x + .1, y + d - .92, neon, t)],
          [x + w - .45, () => caneca(ctx, x + w - .35, y + .38, TOP, o.sabor, .85)]
        ]);
      } else {
        const monY = o.face === 'n' ? y + .12 : y + .62;
        const tecY = o.face === 'n' ? y + .78 : y + .06;
        const mw = 1.7, mx = x + w / 2 - mw / 2 - .3;
        emOrdem([
          [monY,      () => monitor(ctx, mx, monY, mw, telaVisivel, o.busy, neon, t, o)],
          [tecY,      () => teclado(ctx, x + w / 2 - .95, tecY, neon)],
          [y + .14,   () => gabinete(ctx, x + w - .68, y + .14, neon, t)],
          [y + d / 2, () => caneca(ctx, x + .42, y + d / 2, TOP, o.sabor, .85)]
        ]);
      }
    },

    /* ================= MESA DA DIRETORIA ================= */
    deskBoss(ctx, o, t) {
      const { x, y, w, d } = o;
      const neon = ISO.hsl((o.hue + t * 16) % 360, 88, 56);
      ISO.shadow(ctx, x + w / 2, y + d / 2, 2.1, .3);

      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gp = S(x + w / 2, y + d / 2, 6);
      ISO.glow(ctx, gp.x, gp.y, 94, neon, o.busy ? .3 : .13);
      ctx.restore();

      ISO.box(ctx, x + .06,     y + .12, .2, d - .24, 25, 0, '#191419');
      ISO.box(ctx, x + w - .26, y + .12, .2, d - .24, 25, 0, '#191419');
      ISO.box(ctx, x + .26,     y + .16, w - .52, .12, 16, 6, '#151115');
      ISO.plane(ctx, x - .06, y - .06, w + .12, d + .12, TOP, '#3d2d35');
      for (let i = 0; i < 6; i++)
        ISO.plane(ctx, x, y + .12 + i * .24, w, .035, TOP + .1, 'rgba(255,255,255,.04)');

      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ISO.quad(ctx, [S(x - .06, y + d + .06, 25), S(x + w + .06, y + d + .06, 25),
                     S(x + w + .06, y + d + .06, 21), S(x - .06, y + d + .06, 21)],
               ISO.rgba(neon, .7));
      ctx.restore();

      // dois monitores, de costas (quem senta está de frente para nós)
      const monY = y + .66;
      emOrdem([
        [monY,      () => { monitor(ctx, x + .42,  monY, 1.5, false, o.busy, neon, t, o);
                            monitor(ctx, x + 2.24, monY, 1.5, false, o.busy, neon, t, o); }],
        [y + .06,   () => teclado(ctx, x + w / 2 - 1.0, y + .06, neon)],
        [y + .18,   () => gabinete(ctx, x + w - .72, y + .18, neon, t)],
        [y + d - .3,() => caneca(ctx, x + .2, y + d - .3, TOP, 0, .9)]
      ]);
    },

    /* ================= CADEIRAS ================= */
    chairGamer(ctx, o) { const a = ISO.hsl(o.hue, 85, 52);
      cadeiraBase(ctx, o, '#14171f', a, 30, true); },
    chairBoss(ctx, o)  {
      cadeiraBase(ctx, o, '#1a1419', '#7c6cff', 33, true); },
    chairSimple(ctx, o){
      cadeiraBase(ctx, o, '#1c2234', '#4a5a86', 22, false); },

    /* ---------- o resto do mobiliário ---------- */
    arcade(ctx, o, t) {
      const { x, y } = o;
      const neon = ISO.hsl((o.hue + t * 40) % 360, 95, 60);
      ISO.shadow(ctx, x + .75, y + .6, .9, .3);
      ISO.box(ctx, x, y, 1.5, 1.2, 84, 0, '#161a2c');
      ISO.box(ctx, x - .04, y - .04, 1.58, 1.28, 14, 84, '#0e1120', { top: ISO.rgba(neon, .8) });
      const p1 = S(x, y + 1.2, 74), p2 = S(x + 1.5, y + 1.2, 74);
      const p3 = S(x + 1.5, y + 1.2, 44), p4 = S(x, y + 1.2, 44);
      ISO.quad(ctx, [p1, p2, p3, p4], '#04060e');
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) {
        const f = i / 9, hh = .15 + .5 * Math.abs(Math.sin(t * 3 + i));
        ISO.quad(ctx, [
          { x: p1.x + (p2.x - p1.x) * f,        y: p1.y + (p2.y - p1.y) * f + (p4.y - p1.y) * hh },
          { x: p1.x + (p2.x - p1.x) * (f + .07), y: p1.y + (p2.y - p1.y) * (f + .07) + (p4.y - p1.y) * hh },
          { x: p1.x + (p2.x - p1.x) * (f + .07), y: p4.y + (p3.y - p4.y) * (f + .07) },
          { x: p1.x + (p2.x - p1.x) * f,         y: p4.y + (p3.y - p4.y) * f }
        ], ISO.rgba(ISO.hsl((o.hue + i * 30) % 360, 95, 60), .55));
      }
      ctx.restore();
      ISO.box(ctx, x + .05, y + 1.14, 1.4, .5, 8, 34, '#1b2136', { top: '#262d47' });
      ISO.cyl(ctx, x + .45, y + 1.4, .1, 9, 42, '#7c6cff');
      ISO.cyl(ctx, x + .75, y + 1.4, .09, 7, 42, '#38bdf8');
      ISO.cyl(ctx, x + 1.05, y + 1.4, .09, 7, 42, '#c4b8ff');
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = S(x + .75, y + .6, 70); ISO.glow(ctx, g.x, g.y, 74, neon, .3);
      ctx.restore();
    },

    poolTable(ctx, o) {
      const { x, y, w, d } = o;
      ISO.shadow(ctx, x + w / 2, y + d / 2, 2.4, .32);
      [[.2, .2], [w - .6, .2], [.2, d - .6], [w - .6, d - .6]]
        .forEach(p => ISO.box(ctx, x + p[0], y + p[1], .4, .4, 26, 0, '#231208'));
      ISO.box(ctx, x, y, w, d, 12, 26, '#3a1d0c', { top: '#4a2610' });
      ISO.plane(ctx, x + .28, y + .28, w - .56, d - .56, 38.4, '#0f5c3a');
      ISO.plane(ctx, x + .28, y + .28, w - .56, d - .56, 38.4, null, 'rgba(0,0,0,.35)');
      [['#f2f2f2', .5, .5], ['#c4b8ff', 2.6, 1.0], ['#7c6cff', 3.0, 1.35],
       ['#18a2ff', 3.3, .9], ['#8b5cf6', 2.8, 1.7], ['#22c55e', 3.5, 1.6]]
      .forEach(([c, bx, by]) => {
        const p = S(x + bx, y + by, 38.4);
        ctx.fillStyle = 'rgba(0,0,0,.3)';
        ctx.beginPath(); ctx.ellipse(p.x, p.y + 2, 6, 3.4, 0, 0, 7); ctx.fill();
        const g = ctx.createRadialGradient(p.x - 2, p.y - 4, 1, p.x, p.y - 2, 7);
        g.addColorStop(0, ISO.shade(c, .5)); g.addColorStop(1, ISO.shade(c, -.25));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y - 2, 5.4, 0, 7); ctx.fill();
      });
    },

    foosball(ctx, o) {
      const { x, y, w, d } = o;
      ISO.shadow(ctx, x + w / 2, y + d / 2, 2.1, .3);
      [[.15, .15], [w - .5, .15], [.15, d - .5], [w - .5, d - .5]]
        .forEach(p => ISO.box(ctx, x + p[0], y + p[1], .35, .35, 24, 0, '#16203a'));
      ISO.box(ctx, x, y, w, d, 10, 24, '#1d2742', { top: '#14361f' });
      ISO.plane(ctx, x + .2, y + .2, w - .4, d - .4, 34.4, '#166534');
      ISO.plane(ctx, x + w / 2 - .03, y + .2, .06, d - .4, 34.5, 'rgba(255,255,255,.45)');
      for (let i = 0; i < 5; i++) {
        const bx = x + .6 + i * ((w - 1.2) / 4);
        ISO.box(ctx, bx, y - .18, .07, d + .36, 4, 44, '#9aa6c4');
        for (let j = 0; j < 3; j++)
          ISO.box(ctx, bx - .07, y + .5 + j * ((d - 1) / 2) - .1, .22, .22, 11, 34,
                  i % 2 ? '#7c6cff' : '#18a2ff');
      }
    },

    sofa(ctx, o) {
      const { x, y, w, d } = o;
      const c = o.c || '#2b2340';
      ISO.shadow(ctx, x + w / 2, y + d / 2, Math.max(w, d) * .55, .28);
      ISO.box(ctx, x, y, w, d, 16, 0, ISO.shade(c, -.2));
      if (o.dir === 'n') {
        ISO.box(ctx, x, y, w, .42, 34, 16, c);
        ISO.box(ctx, x, y + .42, .38, d - .42, 16, 16, ISO.shade(c, .06));
        ISO.box(ctx, x + w - .38, y + .42, .38, d - .42, 16, 16, ISO.shade(c, .06));
        ISO.plane(ctx, x + .4, y + .46, w - .8, d - .5, 32, ISO.shade(c, .16));
      } else {
        ISO.box(ctx, x, y, .42, d, 34, 16, c);
        ISO.box(ctx, x + .42, y, w - .42, .38, 16, 16, ISO.shade(c, .06));
        ISO.box(ctx, x + .42, y + d - .38, w - .42, .38, 16, 16, ISO.shade(c, .06));
        ISO.plane(ctx, x + .46, y + .4, w - .5, d - .8, 32, ISO.shade(c, .16));
      }
    },

    beanbag(ctx, o) {
      const { x, y } = o;
      const c = ISO.hsl(o.hue, 62, 46);
      ISO.shadow(ctx, x + .6, y + .6, .82, .28);
      const p = S(x + .6, y + .6, 0);
      const g = ctx.createRadialGradient(p.x - 6, p.y - 22, 3, p.x, p.y - 12, 30);
      g.addColorStop(0, ISO.shade(c, .3)); g.addColorStop(1, ISO.shade(c, -.28));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(p.x, p.y - 11, 30, 19, 0, 0, 7); ctx.fill();
      ctx.fillStyle = ISO.shade(c, .12);
      ctx.beginPath(); ctx.ellipse(p.x, p.y - 20, 22, 11, 0, 0, 7); ctx.fill();
    },

    lowTable(ctx, o) {
      const { x, y, w, d } = o;
      ISO.shadow(ctx, x + w / 2, y + d / 2, .9, .26);
      ISO.box(ctx, x + .12, y + .12, .12, .12, 18, 0, '#24202c');
      ISO.box(ctx, x + w - .24, y + d - .24, .12, .12, 18, 0, '#24202c');
      ISO.box(ctx, x, y, w, d, 5, 18, '#2e2836', { top: 'rgba(160,190,255,.2)' });
      caneca(ctx, x + w / 2, y + d / 2, 23, 1, .8);
    },

    rug(ctx, o) {
      const { x, y, w, d } = o;
      ISO.plane(ctx, x, y, w, d, 0.6, ISO.rgba(o.c || '#2a2240', .78));
      ISO.plane(ctx, x + .3, y + .3, w - .6, d - .6, 0.7, null, 'rgba(255,255,255,.07)');
    },

    tvWall(ctx, o, t) {
      const { x, y, w } = o;
      const h = 62, z = 46;
      ISO.box(ctx, x, y, w, .22, h, z, '#0a0c14');
      faceY(ctx, x + .02, y + .22, w - .04, z + h - 4, (c, len) => {
        c.fillStyle = '#05070f'; c.fillRect(0, 0, len, h - 8);
        if (o.meeting) {
          c.textAlign = 'left'; c.textBaseline = 'middle';
          c.font = "700 9px 'Barlow Semi Condensed', sans-serif";
          c.fillStyle = '#38bdf8'; c.fillText('SALA DE REUNIÃO', 10, 11);
          c.font = "600 8px 'Barlow Semi Condensed', sans-serif";
          c.fillStyle = 'rgba(170,182,210,.8)';
          c.fillText(new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }).toUpperCase(), 12, 27);
          for (let i = 0; i < 3; i++) {
            c.fillStyle = ISO.rgba('#38bdf8', .18 + .1 * i);
            c.fillRect(12, 38 + i * 9, (len - 24) * (.35 + .25 * ((Math.sin(t * .6 + i) + 1) / 2)), 4);
          }
        } else {
          for (let i = 0; i < 5; i++) {
            c.fillStyle = ISO.rgba(ISO.hsl((t * 30 + i * 60) % 360, 80, 55), .22);
            c.fillRect(i * len / 5, 0, len / 5, h - 8);
          }
        }
      });
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gc = S(x + w / 2, y + .3, z + h / 2);
      ISO.glow(ctx, gc.x, gc.y, 110, o.meeting ? '#38bdf8' : '#7aa2ff', .18);
      ctx.restore();
    },

    bar(ctx, o, t) {
      const { x, y, w, d } = o;
      ISO.shadow(ctx, x + w / 2, y + d / 2, 2.3, .3);
      ISO.box(ctx, x, y, w, d, 46, 0, '#14182a', { top: '#232a44' });
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ISO.quad(ctx, [S(x, y + d, 46), S(x + w, y + d, 46), S(x + w, y + d, 41), S(x, y + d, 41)],
               ISO.rgba(ISO.hsl((t * 46) % 360, 95, 58), .7));
      ctx.restore();
      dispenser(ctx, x + 1.1, y + .55, '#7c6cff', t);
      dispenser(ctx, x + 2.6, y + .55, '#c4b8ff', t + 1.4);
      for (let i = 0; i < 4; i++) ISO.cyl(ctx, x + .35, y + .3 + i * .22, .08, 9, 46, '#e9edf8');
    },

    vending(ctx, o, t) {
      const { x, y } = o;
      ISO.shadow(ctx, x + .6, y + .6, .8, .3);
      ISO.box(ctx, x, y, 1.2, 1.1, 92, 0, '#141a2e');
      faceY(ctx, x + .08, y + 1.1, 1.04, 86, (c, len) => {
        c.fillStyle = 'rgba(10,14,26,.92)'; c.fillRect(0, 0, len, 62);
        for (let r = 0; r < 4; r++) for (let i = 0; i < 3; i++) {
          c.fillStyle = ISO.rgba(['#38bdf8', '#a78bfa', '#f472b6'][i], .82);
          ISO.rrect(c, 5 + i * (len - 10) / 3, 6 + r * 14, (len - 10) / 3 - 4, 10, 2); c.fill();
        }
      });
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = S(x + .6, y + .6, 60);
      ISO.glow(ctx, g.x, g.y, 62, ISO.hsl((t * 50) % 360, 90, 60), .2);
      ctx.restore();
    },

    rack(ctx, o, t) {
      const { x, y } = o;
      const neon = ISO.hsl((o.hue + t * 12) % 360, 90, 55);
      ISO.shadow(ctx, x + .6, y + .5, .78, .3);
      ISO.box(ctx, x, y, 1.2, 1, 86, 0, '#0e1220', { top: '#1a2136' });
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 9; i++) {
        const z = 8 + i * 8.6, on = Math.sin(t * 4 + i * 2.1) > -.2;
        ISO.quad(ctx, [S(x + .1, y + 1, z + 3), S(x + 1.1, y + 1, z + 3),
                       S(x + 1.1, y + 1, z), S(x + .1, y + 1, z)],
                 ISO.rgba(on ? neon : '#1b2540', on ? .62 : .3));
      }
      const g = S(x + .6, y + .5, 50); ISO.glow(ctx, g.x, g.y, 58, neon, .2);
      ctx.restore();
      faceY(ctx, x, y + 1, 1.2, 100, (c, len) => {
        c.textAlign = 'center'; c.font = "700 8px 'Barlow Semi Condensed', sans-serif";
        c.fillStyle = ISO.rgba(neon, .95); c.fillText(o.label, len / 2, 6);
      });
    },

    elevator(ctx, o, t) {
      const { x, y, d } = o;
      const neon = ISO.hsl((t * 34) % 360, 92, 58);
      WORLD.wallFace(ctx, 'w', x, y, d, 96, (c, len) => {
        c.fillStyle = '#0a0d18'; ISO.rrect(c, 4, 6, len - 8, 78, 4); c.fill();
        c.strokeStyle = ISO.rgba(neon, .8); c.lineWidth = 2; c.stroke();
        c.fillStyle = ISO.rgba(neon, .35); c.fillRect(len / 2 - 1, 8, 2, 74);
        c.textAlign = 'center'; c.font = "700 9px 'Barlow Semi Condensed', sans-serif";
        c.fillStyle = ISO.rgba(neon, .9);
        c.fillText('▲ ENTRADA', len / 2, 0);
      });
    },

    reception(ctx, o, t) {
      const { x, y, w, d } = o;
      ISO.shadow(ctx, x + w / 2, y + d / 2, 1.6, .28);
      ISO.box(ctx, x, y, w, d, 40, 0, '#161b2e', { top: '#242c46' });
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ISO.quad(ctx, [S(x, y + d, 40), S(x + w, y + d, 40), S(x + w, y + d, 35), S(x, y + d, 35)],
               ISO.rgba(ISO.hsl((t * 40) % 360, 92, 58), .66));
      ctx.restore();
      faceY(ctx, x, y + d, w, 56, (c, len) => {
        c.textAlign = 'center'; c.font = "700 10px 'Barlow', sans-serif";
        c.fillStyle = 'rgba(233,237,248,.85)'; c.letterSpacing = '2px';
        c.fillText('RECEPÇÃO', len / 2, 9);
      });
      caneca(ctx, x + w - .35, y + .5, 40, 0, .8);
    },

    plant(ctx, o, t) {
      const { x, y } = o;
      ISO.shadow(ctx, x + .5, y + .5, .5, .26);
      ISO.cyl(ctx, x + .5, y + .5, .3, 20, 0, o.k ? '#3a2b22' : '#242b3e');
      const base = S(x + .5, y + .5, 20);
      const nn = o.k ? 7 : 9;
      for (let i = 0; i < nn; i++) {
        const a = (i / nn) * Math.PI * 2 + Math.sin(t * .5 + i) * .07;
        const len = 20 + (i % 3) * 9;
        ctx.strokeStyle = i % 2 ? '#1f7a44' : '#2a9c56';
        ctx.lineWidth = o.k ? 5 : 3.4; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.quadraticCurveTo(base.x + Math.cos(a) * len * .5, base.y - len * .75,
                             base.x + Math.cos(a) * len, base.y - len * .5 - 8);
        ctx.stroke();
      }
    },

    cooler(ctx, o) {
      const { x, y } = o;
      ISO.shadow(ctx, x + .5, y + .5, .5, .26);
      ISO.box(ctx, x + .1, y + .1, .8, .8, 40, 0, '#1a2136', { top: '#252d47' });
      ISO.cyl(ctx, x + .5, y + .5, .3, 32, 40, 'rgba(120,200,255,.42)');
      ISO.cyl(ctx, x + .5, y + .5, .3, 12, 40, 'rgba(60,160,255,.62)');
    },

    trophy(ctx, o, t) {
      const { x, y } = o;
      ISO.shadow(ctx, x + .6, y + .6, .6, .3);
      ISO.box(ctx, x + .15, y + .15, .9, .9, 34, 0, '#1a1622', { top: '#2a2333' });
      ISO.cyl(ctx, x + .6, y + .6, .1, 12, 34, '#c9a227');
      ISO.cyl(ctx, x + .6, y + .6, .26, 20, 46, ISO.rgba('#c4b8ff', .9));
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const p = S(x + .6, y + .6, 68);
      ISO.glow(ctx, p.x, p.y, 40, '#c4b8ff', .3 + .12 * Math.sin(t * 2));
      ctx.restore();
      ISO.cyl(ctx, x + .6, y + .6, .16, 8, 66, '#ffe98a');
    },

    neonSign(ctx, o, t) {
      const { x, y } = o;
      const neon = ISO.hsl((o.hue + t * 30) % 360, 95, 62);
      WORLD.wallFace(ctx, 'n', x, y, 3, 92, (c, len) => {
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = "700 17px 'Barlow', sans-serif";
        c.shadowColor = ISO.rgba(neon, .95); c.shadowBlur = 16;
        c.fillStyle = ISO.rgba(neon, .95); c.letterSpacing = '2px';
        c.fillText(o.txt, len / 2, 16);
        c.shadowBlur = 0; c.letterSpacing = '0px';
        c.strokeStyle = ISO.rgba(neon, .35); c.lineWidth = 1;
        c.beginPath(); c.moveTo(14, 32); c.lineTo(len - 14, 32); c.stroke();
      });
    },

    meetTable(ctx, o, t) {
      const { x, y, w, d } = o;
      ISO.shadow(ctx, x + w / 2, y + d / 2, 3.2, .3);
      ISO.box(ctx, x + w / 2 - .5, y + d / 2 - .4, 1, .8, 24, 0, '#171b2c');
      ISO.box(ctx, x, y, w, d, 4, 24, '#1b2036', { top: '#2b3350' });
      ISO.plane(ctx, x + .25, y + .25, w - .5, d - .5, TOP + .2, 'rgba(120,160,255,.08)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ISO.plane(ctx, x + w / 2 - 1.2, y + d / 2 - .5, 2.4, 1, TOP + .3,
                ISO.rgba(ISO.hsl((t * 26) % 360, 90, 58), .16));
      ctx.restore();
      caneca(ctx, x + 1.2, y + d / 2, TOP, 0, .8);
      caneca(ctx, x + w - 1.2, y + d / 2, TOP, 1, .8);
    }
  };

  /* ===========================================================
     PEÇAS REUTILIZADAS
     =========================================================== */

  /** monitor montado em cima da mesa, com pé e braço */
  function monitor(ctx, x, y, w, telaVisivel, busy, neon, t, o) {
    const baseZ = TOP;
    // pé
    ISO.box(ctx, x + w / 2 - .28, y + .02, .56, .3, 3, baseZ, '#12161f', { top: '#1b2130' });
    // haste
    ISO.box(ctx, x + w / 2 - .07, y + .1, .14, .14, 9, baseZ + 3, '#171c28');
    // painel
    const pz = baseZ + 8, ph = 26;
    ISO.box(ctx, x, y, w, .13, ph, pz, '#0b0e17', { top: '#1a2030' });

    faceY(ctx, x + .03, y + .13, w - .06, pz + ph - 2, (c, len) => {
      if (telaVisivel) {
        c.fillStyle = '#04060d'; c.fillRect(0, 0, len, ph - 4);
        if (busy) {
          // linhas de código rolando
          for (let i = 0; i < 6; i++) {
            const ly = 3 + ((i * 3.6 + (t * 9) % 3.6));
            if (ly > ph - 6) continue;
            const lw = (len - 16) * (.25 + .6 * Math.abs(Math.sin(i * 3.7 + Math.floor(t * 2))));
            c.fillStyle = ISO.rgba(i % 3 ? '#8ef0c0' : neon, .62);
            c.fillRect(8, ly, lw, 1.6);
          }
          c.fillStyle = ISO.rgba(neon, .9);
          c.fillRect(8, ph - 8, 3, 1.8);
        } else {
          c.fillStyle = ISO.rgba(neon, .1); c.fillRect(0, 0, len, ph - 4);
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.font = "700 8px 'Barlow', sans-serif";
          c.fillStyle = ISO.rgba(neon, .5);
          c.fillText('●', len / 2, (ph - 4) / 2);
        }
      } else {
        // costas do monitor: nada de tela acesa
        const g = c.createLinearGradient(0, 0, 0, ph - 4);
        g.addColorStop(0, '#242a38'); g.addColorStop(1, '#161b26');
        c.fillStyle = g; c.fillRect(0, 0, len, ph - 4);
        c.strokeStyle = 'rgba(255,255,255,.05)'; c.lineWidth = 1;
        for (let i = 1; i < 6; i++) {
          c.beginPath(); c.moveTo(i * len / 6, 4); c.lineTo(i * len / 6, ph - 8); c.stroke();
        }
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = "700 7px 'Barlow', sans-serif";
        c.fillStyle = 'rgba(190,200,225,.35)';
        c.fillText('●', len / 2, (ph - 4) / 2);
      }
    });

    // brilho fino na moldura de cima
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ISO.quad(ctx, [S(x, y + .13, pz + ph), S(x + w, y + .13, pz + ph),
                   S(x + w, y + .13, pz + ph - 2), S(x, y + .13, pz + ph - 2)],
             ISO.rgba(neon, telaVisivel ? .6 : .3));
    if (telaVisivel && busy) {
      const gc = S(x + w / 2, y + .3, pz + ph / 2);
      ISO.glow(ctx, gc.x, gc.y, 58, neon, .26);
    }
    ctx.restore();
    void o;
  }

  /** monitor com o painel correndo no eixo Y (mesa de lado) */
  function monitorY(ctx, x, y, alt, telaVisivel, busy, neon, t) {
    const cy = y + alt / 2;
    ISO.box(ctx, x + .02, cy - .28, .3, .56, 3, TOP, '#12161f', { top: '#1b2130' });
    ISO.box(ctx, x + .1,  cy - .07, .14, .14, 9, TOP + 3, '#171c28');

    const pz = TOP + 8, ph = 26;
    // painel fino em X, largo em Y: a tela aponta para -x quando face 'e'
    ISO.box(ctx, x, y, .13, alt, ph, pz, '#0b0e17', { top: '#1a2030' });

    // a face que a câmera enxerga é a +x
    const T = ISO.TW;
    const o = ISO.toScreen(x + .13, y, pz + ph - 2);
    ctx.save();
    ctx.transform(-ISO.HW / T, ISO.HH / T, 0, 1, o.x, o.y);
    const len = alt * T;
    if (telaVisivel) {
      ctx.fillStyle = '#04060d'; ctx.fillRect(-len, 0, len, ph - 4);
      if (busy) {
        for (let i = 0; i < 6; i++) {
          const ly = 3 + ((i * 3.6 + (t * 9) % 3.6));
          if (ly > ph - 6) continue;
          const lw = (len - 16) * (.25 + .6 * Math.abs(Math.sin(i * 3.7 + Math.floor(t * 2))));
          ctx.fillStyle = ISO.rgba(i % 3 ? '#8ef0c0' : neon, .62);
          ctx.fillRect(-len + 8, ly, lw, 1.6);
        }
      } else {
        ctx.fillStyle = ISO.rgba(neon, .1); ctx.fillRect(-len, 0, len, ph - 4);
      }
    } else {
      // costas do monitor: chapa escura com respiros, nada de tela acesa
      const g = ctx.createLinearGradient(0, 0, 0, ph - 4);
      g.addColorStop(0, '#242a38'); g.addColorStop(1, '#161b26');
      ctx.fillStyle = g; ctx.fillRect(-len, 0, len, ph - 4);
      ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1;
      for (let i = 1; i < 6; i++) {
        ctx.beginPath(); ctx.moveTo(-i * len / 6, 4); ctx.lineTo(-i * len / 6, ph - 8); ctx.stroke();
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = "700 7px 'Barlow', sans-serif";
      ctx.fillStyle = 'rgba(190,200,225,.35)';
      ctx.fillText('●', -len / 2, (ph - 4) / 2);
    }
    ctx.restore();

    // luz da tela vazando pelas bordas — dá para ver que está ligado
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ISO.quad(ctx, [S(x + .13, y, pz + ph), S(x + .13, y + alt, pz + ph),
                   S(x + .13, y + alt, pz + ph - 2), S(x + .13, y, pz + ph - 2)],
             ISO.rgba(neon, busy ? .6 : .3));
    if (busy) {
      const gc = S(x - .1, cy, pz + ph / 2);
      ISO.glow(ctx, gc.x, gc.y, 60, neon, .26);
    }
    ctx.restore();
  }

  /** teclado deitado no eixo Y */
  function tecladoY(ctx, x, y, neon) {
    ISO.plane(ctx, x - .06, y - .08, .56, 2.05, TOP + .05, ISO.rgba(neon, .2));
    ISO.box(ctx, x, y, .36, 1.45, 3, TOP, '#141822', { top: '#232a38' });
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ISO.plane(ctx, x + .04, y + .04, .28, 1.37, TOP + 3.2, ISO.rgba(neon, .33));
    ctx.restore();
    ISO.box(ctx, x + .06, y + 1.62, .26, .2, 3.5, TOP, '#1b2130');
  }

  function teclado(ctx, x, y, neon) {
    ISO.plane(ctx, x - .08, y - .06, 2.05, .56, TOP + .05, ISO.rgba(neon, .2));
    ISO.box(ctx, x, y, 1.45, .36, 3, TOP, '#141822', { top: '#232a38' });
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ISO.plane(ctx, x + .04, y + .04, 1.37, .28, TOP + 3.2, ISO.rgba(neon, .33));
    ctx.restore();
    ISO.box(ctx, x + 1.62, y + .06, .2, .26, 3.5, TOP, '#1b2130');
  }

  /** gabinete em cima da mesa, com painel de vidro e RGB */
  function gabinete(ctx, x, y, neon, t) {
    ISO.box(ctx, x, y, .42, .78, 30, TOP, '#11141d', { top: '#1d2431' });
    faceY(ctx, x, y + .78, .42, TOP + 30, (c, len) => {
      c.fillStyle = 'rgba(8,11,20,.9)'; c.fillRect(2, 3, len - 4, 24);
      for (let i = 0; i < 3; i++) {
        c.fillStyle = ISO.rgba(ISO.hsl((t * 60 + i * 60) % 360, 92, 58), .55);
        c.fillRect(4, 6 + i * 7, len - 8, 3.4);
      }
    });
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = S(x + .21, y + .39, TOP + 15);
    ISO.glow(ctx, g.x, g.y, 30, neon, .22);
    ctx.restore();
  }

  /**
   * Cadeira gamer no estilo da Hawker (Westwing) que o usuário mandou:
   * concha com bolsters laterais, encosto alto com "asas", almofadas de
   * cabeça e lombar, braços acolchoados e base estrela de 5 pontas.
   * Centrada no lugar do boneco; encosto do lado oposto ao que ele encara.
   * Assento com topo em z=15, casando com AVATAR.SEAT.
   */
  /**
   * Cadeira gamer, em DUAS camadas.
   *
   * Quando o boneco está de costas para a câmera ('n' e 'w'), a cadeira fica
   * entre ele e nós: aí tudo do assento para cima é pintado DEPOIS dele, e a
   * cadeira tapa de verdade as pernas e as costas. Antes ela era pintada toda
   * antes do boneco e parecia translúcida.
   * Quando ele está de frente ('s' e 'e'), a cadeira inteira vai atrás.
   */
  function cadeiraBase(ctx, o, cor, accent, altEncosto, gamer) {
    // o boneco é desenhado em AVATAR.SCALE, então o assento precisa subir junto
    const ESC     = AVATAR.SCALE;
    const ASSENTO = AVATAR.SEAT * ESC;  // topo do assento = quadril sentado
    const { x, y, w, d } = o;
    const f      = o.face || 'n';
    const camada = o.camada || 'tras';
    const costasNaFrente = (f === 'n' || f === 'w');

    const corD = ISO.shade(cor, -.24);
    const corL = ISO.shade(cor, .14);
    const trim = gamer ? ISO.shade(cor, .19) : ISO.shade(cor, .14);
    const cx = x + w / 2, cy = y + d / 2;
    const eixoX = (f === 'e' || f === 'w');
    const H = altEncosto * ESC;

    /* fatia paralela ao encosto: a0..a1 ao longo da largura,
       esp = espessura, rec = recuo a partir da borda de trás */
    const seg = (a0, a1, esp, rec) =>
      f === 'n' ? [x + w * a0, y + d - rec - esp, w * (a1 - a0), esp]
    : f === 's' ? [x + w * a0, y + rec,           w * (a1 - a0), esp]
    : f === 'e' ? [x + rec,          y + d * a0,  esp, d * (a1 - a0)]
    :             [x + w - rec - esp, y + d * a0, esp, d * (a1 - a0)];
    const bx = (s, h, z, c, opt) => ISO.box(ctx, s[0], s[1], s[2], s[3], h, z, c, opt);

    /* De costas, a cadeira INTEIRA (inclusive a base) vai na frente dele:
       é ela que esconde as pernas e os pés, como aconteceria de verdade.
       Só a sombra fica atrás. De frente, a cadeira inteira fica atrás.    */
    if (camada === 'tras') {
      ISO.shadow(ctx, cx, cy, .68, .28);
      if (costasNaFrente) return;
    } else if (!costasNaFrente) {
      return;
    }

    /* ---------- base estrela de 5 pontas + rodízios ---------- */
    {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + .35;
        const ex = cx + Math.cos(a) * w * .36, ey = cy + Math.sin(a) * d * .36;
        ISO.box(ctx, (cx + ex) / 2 - .075, (cy + ey) / 2 - .075, .15, .15, 3, 1, '#1b1f29');
        ISO.cyl(ctx, ex, ey, .07, 4, 0, '#39415a');
      }
      ISO.cyl(ctx, cx, cy, .14, 4, 3, '#272d3b');
      ISO.cyl(ctx, cx, cy, .075, ASSENTO - 7, 6, '#8e97ab');   // pistão cromado
    }

    /* ---------- assento tipo concha ---------- */
    ISO.box(ctx, x + .1, y + .1, w - .2, d - .2, 5, ASSENTO - 6, cor, { top: corL });
    if (eixoX) {
      ISO.box(ctx, x + .08, y + .04, w - .16, .15, 4, ASSENTO - 2, corD);
      ISO.box(ctx, x + .08, y + d - .19, w - .16, .15, 4, ASSENTO - 2, corD);
    } else {
      ISO.box(ctx, x + .04, y + .08, .15, d - .16, 4, ASSENTO - 2, corD);
      ISO.box(ctx, x + w - .19, y + .08, .15, d - .16, 4, ASSENTO - 2, corD);
    }
    ISO.plane(ctx, x + .24, y + .24, w - .48, d - .48, ASSENTO + .1, ISO.rgba(accent, .16));

    /* ---------- encosto ---------- */
    const estofado = () => {
      const est = seg(.24, .76, .05, .53);
      ISO.box(ctx, est[0], est[1], est[2], est[3], H * .8, ASSENTO + 3, trim);
    };
    const painel = () => {
      bx(seg(.03, .97, .18, .34), H, ASSENTO, cor, { top: corL });
      bx(seg(-.02, .20, .32, .30), H * .74, ASSENTO, corD);
      bx(seg(.80, 1.02, .32, .30), H * .74, ASSENTO, corD);
      if (costasNaFrente) {
        // costas viradas para a câmera: casca preta, com costura e placa
        bx(seg(.03, .97, .185, .325), H, ASSENTO, '#0a0c12', { top: '#161a24' });
        const cst = seg(.46, .54, .2, .32);
        ISO.box(ctx, cst[0], cst[1], cst[2], cst[3], H * .92, ASSENTO, '#05070b');
        const plc = seg(.34, .66, .205, .318);
        ISO.box(ctx, plc[0], plc[1], plc[2], plc[3], H * .1, ASSENTO + H * .56, '#20252f');
      }
    };
    if (costasNaFrente) { estofado(); painel(); }
    else                { painel();  estofado(); }

    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const tp = seg(.03, .97, .18, .34);
    ISO.plane(ctx, tp[0], tp[1], tp[2], tp[3], ASSENTO + H, ISO.rgba(accent, .34));
    ctx.restore();

    /* ---------- braços ---------- */
    if (gamer) {
      const br = eixoX
        ? [[x + .1, y + .0, w - .2, .14], [x + .1, y + d - .14, w - .2, .14]]
        : [[x + .0, y + .1, .14, d - .2], [x + w - .14, y + .1, .14, d - .2]];
      for (const a of br) {
        ISO.box(ctx, a[0], a[1], a[2], a[3], 6, ASSENTO, '#1d2230');
        ISO.box(ctx, a[0] - .02, a[1] - .02, a[2] + .04, a[3] + .04, 3, ASSENTO + 6, corD, { top: corL });
      }
    }
  }

  function dispenser(ctx, cx, cy, color, t) {
    ISO.cyl(ctx, cx, cy, .22, 8, 46, '#cfd6e8');
    ISO.cyl(ctx, cx, cy, .26, 34, 54, 'rgba(190,215,255,.22)');
    ISO.cyl(ctx, cx, cy, .23, 22 + Math.sin(t * 1.5) * 1.6, 54, ISO.rgba(color, .82));
    ISO.cyl(ctx, cx, cy, .2, 8, 88, '#e5ebf7');
    ISO.cyl(ctx, cx, cy, .1, 9, 96, '#e5ebf7');
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const p = S(cx, cy, 70); ISO.glow(ctx, p.x, p.y, 40, color, .22);
    ctx.restore();
  }

  return { items, workSlots, restSlots, meetSlots, drawItem, depth, caneca, TOP };
})();
