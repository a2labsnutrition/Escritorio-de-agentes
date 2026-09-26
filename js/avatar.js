/* ===========================================================
   avatar.js — bonecos estilo Habbo, desenhados por código.
   Cabelo, pele, óculos, barba e tatuagem são parâmetros, então
   dá pra criar quantos funcionários quiser sem sprite nenhum.
   =========================================================== */
const AVATAR = (() => {

  /* ---------- bibliotecas de aparência ---------- */
  const SKIN = ['#f7d7bd', '#f0c29b', '#e0a878', '#c9854f', '#a2643b', '#7a4a2c', '#5a3620'];
  const HAIR_C = ['#140f0c', '#241a13', '#3d2a1a', '#6b4423', '#a8702f', '#d9b56a',
                  '#8e8e93', '#e63946', '#8b5cf6', '#38bdf8', '#f472b6', '#22c55e'];
  const HAIR_S = ['curto', 'fade', 'ondulado', 'cacheado', 'longo', 'rabo',
                  'coque', 'raspado', 'moicano', 'chanel', 'afro', 'franja'];
  const SHIRT = ['#7c6cff', '#18bfff', '#c4b8ff', '#23e08a', '#a855f7', '#f472b6',
                 '#9d8cff', '#2563eb', '#e9edf8', '#1f2937', '#14b8a6', '#fb7185'];
  const PANTS = ['#26304a', '#1b2030', '#3b3f52', '#4b5563', '#2f3e2f', '#312244',
                 '#8b94a6', '#1e293b'];

  /* alturas de referência, em pixels acima do chão */
  const SCALE = 1.1;               // escala com que o boneco é desenhado na cena
  const SEAT = 19;                 // quadril sentado (= assento da Hawker no sprite)
  const HEAD_STAND = 70, HEAD_SIT = 67;

  const rnd = (a, s) => a[Math.abs(hash(s)) % a.length];
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h | 0;
  }

  /** gera uma aparência a partir de uma semente (o id do agente) */
  function makeLook(seed, hints = {}) {
    const h = Math.abs(hash(seed));
    return Object.assign({
      skin:    rnd(SKIN, seed + 'sk'),
      hair:    rnd(HAIR_C, seed + 'hc'),
      style:   rnd(HAIR_S, seed + 'hs'),
      shirt:   rnd(SHIRT, seed + 'sh'),
      pants:   rnd(PANTS, seed + 'pt'),
      shoes:   (h % 3) ? '#15181f' : '#e9edf8',
      glasses: (h % 5 === 0) ? 'retangular' : (h % 11 === 0 ? 'redondo' : null),
      beard:   (h % 4 === 0) ? 'cavanhaque' : (h % 9 === 0 ? 'cheia' : null),
      tattoo:  (h % 7 === 0),
      cap:     (h % 13 === 0),
      uniforme: false
    }, hints);
  }

  /** altura da cabeça, para pendurar etiqueta e balão sem tapar o rosto */
  const headTop = (sitting) => (sitting ? HEAD_SIT : HEAD_STAND);

  /* ---------- utilitários ---------- */
  function rr(ctx, x, y, w, h, r, fill, stroke, lw = 1.4) {
    ISO.rrect(ctx, x, y, w, h, r);
    if (fill)   { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }
  const OUT = 'rgba(6,8,14,.55)';

  /**
   * @param sx,sy   ponto dos pés na tela
   * @param facing  'n' | 's' | 'e' | 'w'   (n/w = de costas)
   * @param st      { moving, phase, sitting, working, relaxed, headset, blink, scale }
   */
  function draw(ctx, look, sx, sy, facing, st = {}) {
    const sc      = st.scale || 1;
    const moving  = !!st.moving;
    const sitting = !!st.sitting;
    const working = !!st.working;
    const phase   = st.phase || 0;
    const back    = (facing === 'n' || facing === 'w');
    const mirror  = (facing === 'e' || facing === 'n') ? 1 : -1;

    // respiração e balanço — o boneco nunca fica totalmente parado
    const breath = Math.sin(phase * 1.5) * 0.7;
    const bob    = moving ? -Math.abs(Math.sin(phase * Math.PI)) * 2.4 : 0;
    const swing  = moving ? Math.sin(phase * Math.PI * 2) * 3.4 : 0;
    const typeL  = working ? Math.sin(phase * 9) * 1.7 : 0;
    const typeR  = working ? Math.sin(phase * 9 + 2.1) * 1.7 : 0;
    const sway   = (sitting && !working) ? Math.sin(phase * 0.8) * 1.1 : 0;

    ctx.save();
    ctx.translate(sx, sy + bob);
    ctx.scale(sc, sc);

    /* sombra — os pés continuam no chão mesmo sentado */
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.34)';
    ctx.beginPath();
    ctx.ellipse(0, 0, sitting ? 11 : 13, sitting ? 5 : 6, 0, 0, 7);
    ctx.fill();
    ctx.restore();

    const skinD  = ISO.shade(look.skin, -0.16);
    const shirtC = look.shirt;
    const shirtD = ISO.shade(shirtC, -0.24);
    const pantsD = ISO.shade(look.pants, -0.14);

    /* ================= pernas ================= */
    if (sitting) {
      // coxa na horizontal apontando para onde ele encara + canela descendo
      const hip = -SEAT;
      const d   = mirror;
      const cox = d > 0 ? -7.5 : -7.5;
      // de costas as pernas apontam para longe da câmera: recolhe o desvio
      // lateral, senão elas aparecem saindo do lado do boneco
      const joe = back ? (d > 0 ? 1.5 : -8.5) : (d > 0 ? 6.5 : -13.5);
      const bal = st.relaxed ? Math.sin(phase * 1.3) * 1.2 : 0;   // perna balançando

      // perna de trás
      rr(ctx, cox + d * 1.6, hip - 11, 15, 8, 3.5, pantsD, OUT);
      rr(ctx, joe + d * 1.6, hip - 11, 6.8, SEAT + 7, 3, pantsD, OUT);
      rr(ctx, joe + d * 1.6 - 1.2, -5, 9.4, 5.4, 2.6, ISO.shade(look.shoes, -.1), OUT);
      // perna da frente
      rr(ctx, cox, hip - 7, 15, 8, 3.5, look.pants, OUT);
      rr(ctx, joe, hip - 7 + bal, 6.8, SEAT + 3, 3, look.pants, OUT);
      rr(ctx, joe - 1.2, -5 + bal, 9.4, 5.4, 2.6, look.shoes, OUT);
    } else {
      const l1 = swing, l2 = -swing;
      rr(ctx, -8 + l1, -22, 7.6, 20, 3.4, pantsD, OUT);
      rr(ctx,  0.4 + l2, -22, 7.6, 20, 3.4, look.pants, OUT);
      rr(ctx, -9 + l1, -4.5, 9.4, 5.4, 2.6, ISO.shade(look.shoes, -.08), OUT);
      rr(ctx, -0.4 + l2, -4.5, 9.4, 5.4, 2.6, look.shoes, OUT);
    }

    /* ================= tronco ================= */
    const hipY = sitting ? -SEAT : -22;
    const tH   = 23;
    const tTop = hipY - tH + breath * .4;
    const lean = sway + (working ? mirror * 1.2 : 0);   // sentado inclina de leve

    ctx.save();
    ctx.translate(lean, 0);

    rr(ctx, -11, tTop, 22, tH, 6, shirtC, OUT, 1.5);
    ctx.save(); ISO.rrect(ctx, -11, tTop, 22, tH, 6); ctx.clip();
    ctx.fillStyle = ISO.rgba(shirtD, .55);
    ctx.fillRect(mirror > 0 ? 2 : -11, tTop, 9, tH);
    ctx.restore();

    /* ================= braços ================= */
    const armY  = tTop + 3;
    const armSw = moving ? -swing * 0.85 : 0;
    // sentado trabalhando: antebraço vai para a frente, sobre a mesa
    const reach = working ? mirror * 3.5 : 0;

    // braço de trás
    rr(ctx, -14.5 - reach * .25, armY - armSw + typeR * .3, 6, 19, 3, ISO.shade(shirtC, -.3), OUT);
    rr(ctx, -14.5 - reach * .25, armY + 17 - armSw + typeR, 6, 5.5, 2.6, skinD, OUT);

    // braço da frente
    const axF = 8.5 + reach * .25;
    rr(ctx, axF, armY + armSw + typeL * .3, 6, 19, 3, shirtC, OUT);
    if (look.tattoo) {
      ctx.save(); ISO.rrect(ctx, axF, armY + armSw + 8, 6, 11, 3); ctx.clip();
      ctx.fillStyle = 'rgba(28,34,52,.62)';
      for (let i = 0; i < 4; i++) ctx.fillRect(axF, armY + armSw + 8 + i * 3, 6, 1.6);
      ctx.restore();
    }
    rr(ctx, axF, armY + 17 + armSw + typeL, 6, 5.5, 2.6, look.skin, OUT);

    /* crachá */
    if (!back) {
      ctx.strokeStyle = 'rgba(15,18,28,.6)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(-4, tTop + 1); ctx.lineTo(1, tTop + 11);
      ctx.moveTo(5, tTop + 1); ctx.lineTo(1, tTop + 11); ctx.stroke();
      rr(ctx, -2.5, tTop + 10, 7, 5, 1.4, '#e9edf8', OUT, 1);
    }

    /* ================= cabeça ================= */
    const nod = working ? Math.sin(phase * 4.5) * 0.5 : 0;
    const hy  = tTop - 20 + nod;
    const cx  = mirror * 1.2;

    rr(ctx, cx - 4, tTop - 4, 8, 5, 2, skinD, OUT);
    rr(ctx, cx - 10.5, hy, 21, 21, 8, look.skin, OUT, 1.6);
    ctx.save(); ISO.rrect(ctx, cx - 10.5, hy, 21, 21, 8); ctx.clip();
    ctx.fillStyle = ISO.rgba(skinD, .5);
    ctx.fillRect(mirror > 0 ? cx + 3 : cx - 10.5, hy, 8, 21);
    ctx.restore();
    rr(ctx, mirror > 0 ? cx - 12 : cx + 9.2, hy + 8, 3, 5.5, 1.6, skinD, OUT, 1);

    if (!back) {
      drawFace(ctx, look, cx, hy, mirror, st);
      if (working) {
        // o monitor está à frente dele: a tela ilumina esse lado do rosto
        ctx.save();
        ISO.rrect(ctx, cx - 10.5, hy, 21, 21, 8); ctx.clip();
        ctx.globalCompositeOperation = "lighter";
        const g = ctx.createLinearGradient(cx + mirror * 11, hy + 21, cx - mirror * 11, hy - 2);
        g.addColorStop(0, "rgba(120,190,255,.26)");
        g.addColorStop(1, "rgba(120,190,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(cx - 12, hy - 2, 24, 24);
        ctx.restore();
      }
    }
    drawHair(ctx, look, cx, hy, mirror, back);
    if (look.glasses && !back) drawGlasses(ctx, look, cx, hy, mirror);
    if (st.headset) drawHeadset(ctx, cx, hy, mirror);
    if (look.cap) drawCap(ctx, look, cx, hy, mirror);

    ctx.restore();   // lean
    ctx.restore();   // translate/scale
  }

  /* ---------- rosto ---------- */
  function drawFace(ctx, look, cx, hy, mirror, st) {
    // trabalhando, ele baixa o olhar para a tela em vez de encarar a câmera
    const ey = hy + 9.5 + (st.working ? 1.8 : 0);
    const vira = st.working ? mirror * 1.3 : 0;   // cabeça virada para o monitor
    const e1 = cx + mirror * 0.5 + vira - 4.2, e2 = cx + mirror * 0.5 + vira + 3.2;
    ctx.fillStyle = '#161a26';
    if (st.blink) {
      ctx.fillRect(e1 - .4, ey + 1.2, 3.4, 1.3);
      ctx.fillRect(e2 - .4, ey + 1.2, 3.4, 1.3);
    } else {
      rr(ctx, e1, ey, 2.7, 3.4, 1.2, '#161a26');
      rr(ctx, e2, ey, 2.7, 3.4, 1.2, '#161a26');
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      ctx.fillRect(e1 + .5, ey + .5, 1, 1);
      ctx.fillRect(e2 + .5, ey + .5, 1, 1);
    }
    ctx.strokeStyle = ISO.shade(look.hair, -.15);
    ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(e1 - .4, ey - 2.4); ctx.lineTo(e1 + 3, ey - 3);
    ctx.moveTo(e2 - .4, ey - 3);   ctx.lineTo(e2 + 3, ey - 2.4);
    ctx.stroke();
    ctx.strokeStyle = ISO.shade(look.skin, -.3); ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(cx + mirror * .4, ey + 3.4); ctx.lineTo(cx + mirror * .4 + mirror * .8, ey + 5.8);
    ctx.stroke();
    ctx.strokeStyle = '#5e2a20'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx + mirror * .4, ey + 5.4, 3.4, 0.28 * Math.PI, 0.72 * Math.PI);
    ctx.stroke();

    if (look.beard) {
      ctx.save();
      ISO.rrect(ctx, cx - 10.5, hy, 21, 21, 8); ctx.clip();
      ctx.fillStyle = ISO.rgba(look.hair, look.beard === 'cheia' ? .82 : .7);
      if (look.beard === 'cheia') {
        ctx.beginPath();
        ctx.ellipse(cx + mirror * .4, hy + 16.5, 9.4, 7.6, 0, 0, Math.PI);
        ctx.fill();
        ctx.fillRect(cx - 9.6, hy + 12, 19, 5);
        ctx.strokeStyle = '#5e2a20'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx + mirror * .4, hy + 14.9, 3.4, 0.28 * Math.PI, 0.72 * Math.PI);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.ellipse(cx + mirror * .4, hy + 17.4, 4.6, 4.2, 0, 0, 7);
        ctx.fill();
        ctx.fillRect(cx + mirror * .4 - 4, hy + 12.2, 8, 1.8);
      }
      ctx.restore();
    }
  }

  /* ---------- cabelo ---------- */
  function drawHair(ctx, look, cx, hy, mirror, back) {
    const c = look.hair, cD = ISO.shade(c, -.22), cL = ISO.shade(c, .16);
    const L = cx - 10.5, W = 21;

    switch (look.style) {
      case 'raspado':
        rr(ctx, L + .6, hy - .4, W - 1.2, 7, 5, ISO.rgba(c, .78), OUT, 1.2); break;

      case 'fade':
        rr(ctx, L, hy - 2.4, W, 10.5, 5, c, OUT, 1.4);
        rr(ctx, L + 1, hy + 6, W - 2, 3.4, 1.6, ISO.rgba(cD, .5)); break;

      case 'curto':
        rr(ctx, L - .6, hy - 3, W + 1.2, 11.5, 5.5, c, OUT, 1.5);
        if (!back) {
          ctx.save(); ISO.rrect(ctx, L - .6, hy - 3, W + 1.2, 11.5, 5.5); ctx.clip();
          ctx.fillStyle = cL;
          ctx.beginPath();
          ctx.moveTo(L + (mirror > 0 ? 2 : W - 2), hy + 7);
          ctx.quadraticCurveTo(L + W / 2, hy - 1, L + (mirror > 0 ? W : 0), hy + 2);
          ctx.lineTo(L + (mirror > 0 ? W : 0), hy - 3); ctx.lineTo(L, hy - 3);
          ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        break;

      case 'franja':
        rr(ctx, L - 1, hy - 3.4, W + 2, 12.5, 6, c, OUT, 1.5);
        ctx.save(); ISO.rrect(ctx, L - 1, hy - 3.4, W + 2, 12.5, 6); ctx.clip();
        ctx.fillStyle = cD; ctx.fillRect(L - 1, hy + 4, W + 2, 5);
        ctx.restore(); break;

      case 'ondulado':
        rr(ctx, L - 1.4, hy - 4, W + 2.8, 12, 6, c, OUT, 1.5);
        ctx.fillStyle = c;
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(L + 2 + i * 4.4, hy - 2.6, 3.2, 0, 7); ctx.fill(); }
        break;

      case 'cacheado':
      case 'afro': {
        const R = look.style === 'afro' ? 13.6 : 11.8;
        ctx.fillStyle = c;
        for (let i = 0; i < 11; i++) {
          const a = Math.PI + (i / 10) * Math.PI;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * R * .82, hy + 4 + Math.sin(a) * R * .74, R * .33, 0, 7);
          ctx.fill();
        }
        rr(ctx, L, hy - 1, W, 8, 4, c);
        break;
      }

      case 'moicano':
        rr(ctx, L + 1, hy + 1, W - 2, 6, 3, ISO.rgba(cD, .7));
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(cx - 3, hy + 3);
        ctx.quadraticCurveTo(cx, hy - 11, cx + 3, hy + 3);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.stroke(); break;

      case 'longo':
        rr(ctx, L - 2, hy + 2, W + 4, 24, 7, cD, OUT, 1.4);
        rr(ctx, L - 1.4, hy - 4, W + 2.8, 13, 6.5, c, OUT, 1.5); break;

      case 'chanel':
        rr(ctx, L - 2, hy + 1, W + 4, 15, 7, cD, OUT, 1.4);
        rr(ctx, L - 1.6, hy - 3.6, W + 3.2, 12, 6, c, OUT, 1.5); break;

      case 'rabo':
        rr(ctx, L - 1, hy - 3.6, W + 2, 12, 6, c, OUT, 1.5);
        ctx.fillStyle = cD;
        ctx.beginPath();
        ctx.ellipse(cx - mirror * 12.5, hy + 12, 4.4, 9, mirror * .3, 0, 7);
        ctx.fill();
        ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.stroke(); break;

      case 'coque':
        rr(ctx, L - 1, hy - 3, W + 2, 11.5, 6, c, OUT, 1.5);
        ctx.fillStyle = cL;
        ctx.beginPath(); ctx.arc(cx - mirror * 2, hy - 5.4, 5.2, 0, 7); ctx.fill();
        ctx.strokeStyle = OUT; ctx.lineWidth = 1.3; ctx.stroke(); break;

      default:
        rr(ctx, L - .6, hy - 3, W + 1.2, 11, 5.5, c, OUT, 1.5);
    }
  }

  function drawGlasses(ctx, look, cx, hy, mirror) {
    const ey = hy + 10.6;
    ctx.strokeStyle = look.glasses === 'redondo' ? '#c6a15a' : '#171b26';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = 'rgba(180,215,255,.2)';
    if (look.glasses === 'redondo') {
      ctx.beginPath(); ctx.arc(cx - 3.4, ey, 3.5, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + 4.4, ey, 3.5, 0, 7); ctx.fill(); ctx.stroke();
    } else {
      ISO.rrect(ctx, cx - 7.4, ey - 3.2, 7, 6.2, 1.8); ctx.fill(); ctx.stroke();
      ISO.rrect(ctx, cx + 1.0, ey - 3.2, 7, 6.2, 1.8); ctx.fill(); ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - 0.4, ey - .6); ctx.lineTo(cx + 1, ey - .6);
    ctx.moveTo(cx - 7.4, ey - 1.4); ctx.lineTo(cx - 10.4, ey - .4);
    ctx.stroke();
    void mirror;
  }

  function drawHeadset(ctx, cx, hy, mirror) {
    ctx.strokeStyle = '#20263a'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, hy + 4.5, 11.4, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    rr(ctx, cx - 13.6, hy + 5.4, 4.4, 7.4, 2, '#252c42', OUT, 1.2);
    rr(ctx, cx + 9.2, hy + 5.4, 4.4, 7.4, 2, '#252c42', OUT, 1.2);
    ctx.fillStyle = 'rgba(56,189,248,.9)';
    ctx.fillRect(mirror > 0 ? cx + 10 : cx - 12.8, hy + 7, 2.6, 1.6);
    ctx.strokeStyle = '#2a3148'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx + mirror * 11.4, hy + 11);
    ctx.quadraticCurveTo(cx + mirror * 10, hy + 16.6, cx + mirror * 4.4, hy + 16.2);
    ctx.stroke();
  }

  function drawCap(ctx, look, cx, hy, mirror) {
    const c = ISO.shade(look.shirt, -.3);
    rr(ctx, cx - 11, hy - 4.5, 22, 9.5, 5, c, OUT, 1.4);
    ctx.fillStyle = ISO.shade(c, -.15);
    ctx.beginPath(); ctx.ellipse(cx + mirror * 6, hy + 4.4, 11, 3.4, 0, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#7c6cff'; ctx.fillRect(cx - 2, hy - 2.4, 4, 4);
  }

  /* ===========================================================
     ETIQUETAS — ancoradas pela BASE, devolvem a altura ocupada
     para poderem ser empilhadas acima da cabeça
     =========================================================== */
  function nameTag(ctx, sx, bottomY, name, color, sub) {
    ctx.save();
    ctx.letterSpacing = '0px';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = "700 11px Barlow Semi Condensed, sans-serif";

    const nameH = 16, subH = sub ? 10 : 0;
    const w   = Math.max(ctx.measureText(name).width + 20, 46);
    const h   = nameH + subH;
    const top = bottomY - h;

    ctx.fillStyle = 'rgba(6,8,15,.88)';
    ISO.rrect(ctx, sx - w / 2, top, w, h, 7); ctx.fill();
    ctx.strokeStyle = ISO.rgba(color, .6); ctx.lineWidth = 1.2; ctx.stroke();

    ctx.fillStyle = '#eef1fa';
    ctx.fillText(name, sx, top + nameH / 2 + .5);

    if (sub) {
      ctx.fillStyle = ISO.rgba(color, .18);
      ISO.rrect(ctx, sx - w / 2 + 1, top + nameH - 1, w - 2, subH, 5); ctx.fill();
      ctx.font = "700 8px Barlow Semi Condensed, sans-serif";
      ctx.fillStyle = ISO.rgba(color, .98);
      ctx.fillText(sub, sx, top + nameH + subH / 2 - .5);
    }
    ctx.restore();
    return h;
  }

  function bubble(ctx, sx, bottomY, emoji, txt, color) {
    ctx.save();
    ctx.letterSpacing = '0px';
    ctx.font = "600 10px Barlow Semi Condensed, sans-serif";
    const tw = ctx.measureText(txt).width;
    const w = tw + 32, h = 19, x = sx - w / 2, y = bottomY - h;

    ctx.fillStyle = 'rgba(8,10,18,.92)';
    ISO.rrect(ctx, x, y, w, h, 9); ctx.fill();
    ctx.strokeStyle = ISO.rgba(color, .55); ctx.lineWidth = 1.1; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx - 3.4, y + h - 1); ctx.lineTo(sx, y + h + 4); ctx.lineTo(sx + 3.4, y + h - 1);
    ctx.fillStyle = 'rgba(8,10,18,.92)'; ctx.fill();

    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = "11px sans-serif"; ctx.fillText(emoji, x + 8, y + h / 2);
    ctx.font = "600 10px Barlow Semi Condensed, sans-serif";
    ctx.fillStyle = ISO.rgba(color, .95);
    ctx.fillText(txt, x + 23, y + h / 2 + .5);
    ctx.restore();
    return h + 4;
  }

  /** retrato pequeno para os cartões do painel */
  function portrait(canvas, look, size = 1) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 40 * size * dpr; canvas.height = 52 * size * dpr;
    canvas.style.width = (40 * size) + 'px'; canvas.style.height = (52 * size) + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, 40 * size, 52 * size);
    ctx.save();
    ctx.translate(20 * size, 50 * size);
    ctx.scale(0.62 * size, 0.62 * size);
    draw(ctx, look, 0, 0, 's', { phase: 0 });
    ctx.restore();
  }

  return { SKIN, HAIR_C, HAIR_S, SHIRT, PANTS, SEAT, SCALE, makeLook, headTop,
           draw, nameTag, bubble, portrait, hash };
})();
