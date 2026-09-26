/* ===========================================================
   iso.js — matemática e primitivas de desenho isométrico
   Projeção 2:1 (estilo Habbo).  +x desce para a direita,
   +y desce para a esquerda, +z sobe na tela.
   =========================================================== */
const ISO = (() => {

  const TW = 64;          // largura de um tile em pixels
  const TH = 32;          // altura   de um tile em pixels
  const HW = TW / 2;
  const HH = TH / 2;

  /** tile (x,y) + altura z -> coordenada de tela */
  function toScreen(x, y, z = 0) {
    return { x: (x - y) * HW, y: (x + y) * HH - z };
  }

  /** coordenada de tela -> tile fracionário (para cliques no chão) */
  function toTile(sx, sy) {
    return { x: (sy / HH + sx / HW) / 2, y: (sy / HH - sx / HW) / 2 };
  }

  /* ---------------- cores ---------------- */

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amt >= 0) {
      r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt;
    } else {
      r *= 1 + amt; g *= 1 + amt; b *= 1 + amt;
    }
    const h = v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
    return '#' + h(r) + h(g) + h(b);
  }

  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  /** hsl -> hex, usado pelo RGB das paredes */
  function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r, g, b;
    if (h < 60)       [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else              [r, g, b] = [c, 0, x];
    const hx = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return '#' + hx(r) + hx(g) + hx(b);
  }

  /* ---------------- primitivas ---------------- */

  /** losango do chão de 1 tile */
  function tile(ctx, x, y, fill, stroke) {
    const p = toScreen(x, y);
    ctx.beginPath();
    ctx.moveTo(p.x,      p.y);
    ctx.lineTo(p.x + HW, p.y + HH);
    ctx.lineTo(p.x,      p.y + TH);
    ctx.lineTo(p.x - HW, p.y + HH);
    ctx.closePath();
    if (fill)   { ctx.fillStyle = fill;   ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }

  /** quadrilátero arbitrário a partir de pontos de tela */
  function quad(ctx, pts, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    if (fill)   { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }

  /**
   * Caixa isométrica.
   * (gx,gy) canto de trás, w×d em tiles, h em pixels, z = base.
   * cor base: topo clareado, face esquerda média, face direita escurecida.
   */
  function box(ctx, gx, gy, w, d, h, z, color, opt = {}) {
    const top   = opt.top   || shade(color,  0.22);
    const left  = opt.left  || shade(color, -0.10);
    const right = opt.right || shade(color, -0.34);
    const line  = opt.line  || rgba('#000000', 0.22);

    const P = (x, y, zz) => toScreen(x, y, zz);

    // face esquerda  (plano y = gy+d)
    quad(ctx, [
      P(gx,     gy + d, z + h), P(gx + w, gy + d, z + h),
      P(gx + w, gy + d, z),     P(gx,     gy + d, z)
    ], left, line);

    // face direita   (plano x = gx+w)
    quad(ctx, [
      P(gx + w, gy,     z + h), P(gx + w, gy + d, z + h),
      P(gx + w, gy + d, z),     P(gx + w, gy,     z)
    ], right, line);

    // topo
    quad(ctx, [
      P(gx,     gy,     z + h), P(gx + w, gy,     z + h),
      P(gx + w, gy + d, z + h), P(gx,     gy + d, z + h)
    ], top, line);

    return { top, left, right };
  }

  /** só o topo de uma caixa (tampo de mesa, tapete elevado…) */
  function plane(ctx, gx, gy, w, d, z, fill, stroke) {
    const P = (x, y) => toScreen(x, y, z);
    quad(ctx, [P(gx, gy), P(gx + w, gy), P(gx + w, gy + d), P(gx, gy + d)], fill, stroke);
  }

  const gradCyl = new Map();

  /** cilindro isométrico (caneca, lixeira, copo) */
  function cyl(ctx, cx, cy, r, h, z, color) {
    const b = toScreen(cx, cy, z);
    const t = toScreen(cx, cy, z + h);
    const rx = r * HW, ry = r * HH;

    ctx.fillStyle = shade(color, -0.3);
    ctx.beginPath();
    ctx.moveTo(b.x - rx, b.y);
    ctx.lineTo(t.x - rx, t.y);
    ctx.ellipse(t.x, t.y, rx, ry, 0, Math.PI, 0, true);
    ctx.lineTo(b.x + rx, b.y);
    ctx.ellipse(b.x, b.y, rx, ry, 0, 0, Math.PI, false);
    ctx.closePath(); ctx.fill();

    // o gradiente do corpo é fixo em espaço de mundo: guarda por posição+cor
    const ck = (b.x | 0) + '|' + (rx | 0) + '|' + color;
    let g = gradCyl.get(ck);
    if (!g) {
      g = ctx.createLinearGradient(b.x - rx, 0, b.x + rx, 0);
      g.addColorStop(0, shade(color, -0.22));
      g.addColorStop(.42, shade(color, 0.1));
      g.addColorStop(1, shade(color, -0.36));
      if (gradCyl.size > 600) gradCyl.clear();
      gradCyl.set(ck, g);
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(b.x - rx, b.y);
    ctx.lineTo(t.x - rx, t.y);
    ctx.ellipse(t.x, t.y, rx, ry, 0, Math.PI, 0, true);
    ctx.lineTo(b.x + rx, b.y);
    ctx.ellipse(b.x, b.y, rx, ry, 0, 0, Math.PI, false);
    ctx.closePath(); ctx.fill();

    ctx.fillStyle = shade(color, 0.26);
    ctx.beginPath(); ctx.ellipse(t.x, t.y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  }

  /** sombra elíptica no chão */
  function shadow(ctx, cx, cy, r, alpha = 0.34) {
    const p = toScreen(cx, cy, 0);
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r * HW, r * HH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* O brilho radial era um gradiente novo por chamada, dezenas por quadro.
     Agora é um sprite pronto por cor (com a cor arredondada, senão o RGB
     animado geraria um sprite por quadro) e cada brilho é só um drawImage. */
  const spritesGlow = new Map();
  const arredondaCor = hex => {
    const n = parseInt(hex.slice(1), 16);
    const q = v => Math.min(255, Math.round(v / 24) * 24);
    return '#' + [q((n >> 16) & 255), q((n >> 8) & 255), q(n & 255)]
      .map(v => v.toString(16).padStart(2, '0')).join('');
  };
  function spriteGlow(color) {
    let sp = spritesGlow.get(color);
    if (sp) return sp;
    if (spritesGlow.size > 96) spritesGlow.clear();
    const R = 64;
    const cv = document.createElement('canvas');
    cv.width = cv.height = R * 2;
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(R, R, 0, R, R, R);
    g.addColorStop(0, rgba(color, 1));
    g.addColorStop(.55, rgba(color, .28));
    g.addColorStop(1, rgba(color, 0));
    c.fillStyle = g;
    c.fillRect(0, 0, R * 2, R * 2);
    spritesGlow.set(color, cv);
    return cv;
  }

  /** brilho radial (neon, monitor, luz de teto) */
  function glow(ctx, sx, sy, r, color, alpha = 0.5) {
    const sp = spriteGlow(arredondaCor(color));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(sp, sx - r, sy - r, r * 2, r * 2);
    ctx.restore();
  }

  /** retângulo arredondado em coordenadas de tela */
  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }

  return { TW, TH, HW, HH, toScreen, toTile, shade, rgba, hsl,
           tile, quad, box, plane, cyl, shadow, glow, rrect };
})();
