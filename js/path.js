/* ===========================================================
   path.js — A* em grade com 8 direções.
   Ninguém se teleporta: todo deslocamento vira uma lista de
   tiles vizinhos que o boneco percorre a pé.
   =========================================================== */
const PATH = (() => {

  const DIRS = [
    [ 1, 0], [-1, 0], [0,  1], [0, -1],
    [ 1, 1], [ 1,-1], [-1, 1], [-1,-1]
  ];

  /**
   * @param grid   função (x,y) -> true se dá pra pisar
   * @param w,h    limites da grade
   */
  function find(grid, w, h, start, goal) {
    if (!grid(goal.x, goal.y)) {
      const alt = nearestWalkable(grid, w, h, goal);
      if (!alt) return null;
      goal = alt;
    }
    if (start.x === goal.x && start.y === goal.y) return [];

    const key  = (x, y) => y * w + x;
    const open = new MinHeap();
    const gS   = new Map();
    const came = new Map();
    const sK   = key(start.x, start.y);
    const gK   = key(goal.x, goal.y);

    gS.set(sK, 0);
    open.push(sK, heur(start, goal));

    let guard = 0;
    while (open.size() && guard++ < 24000) {
      const cur = open.pop();
      if (cur === gK) return rebuild(came, cur, w);

      const cx = cur % w, cy = (cur / w) | 0;
      const cg = gS.get(cur);

      for (const [dx, dy] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (!grid(nx, ny)) continue;
        // sem cortar quina: na diagonal os dois ortogonais precisam estar livres
        if (dx && dy && (!grid(cx + dx, cy) || !grid(cx, cy + dy))) continue;

        const step = (dx && dy) ? 1.414 : 1;
        const nK   = key(nx, ny);
        const ng   = cg + step;
        if (gS.has(nK) && gS.get(nK) <= ng) continue;

        gS.set(nK, ng);
        came.set(nK, cur);
        open.push(nK, ng + heur({ x: nx, y: ny }, goal));
      }
    }
    return null;
  }

  function heur(a, b) {
    const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
    return (dx + dy) + (1.414 - 2) * Math.min(dx, dy);
  }

  function rebuild(came, cur, w) {
    const out = [];
    while (came.has(cur)) {
      out.push({ x: cur % w, y: (cur / w) | 0 });
      cur = came.get(cur);
    }
    return out.reverse();
  }

  /** se o alvo estiver bloqueado, procura o tile livre mais próximo em espiral */
  function nearestWalkable(grid, w, h, p) {
    for (let r = 1; r <= 7; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = p.x + dx, y = p.y + dy;
          if (x >= 0 && y >= 0 && x < w && y < h && grid(x, y)) return { x, y };
        }
      }
    }
    return null;
  }

  /* fila de prioridade mínima */
  class MinHeap {
    constructor() { this.a = []; }
    size() { return this.a.length; }
    push(v, p) {
      this.a.push({ v, p });
      let i = this.a.length - 1;
      while (i > 0) {
        const par = (i - 1) >> 1;
        if (this.a[par].p <= this.a[i].p) break;
        [this.a[par], this.a[i]] = [this.a[i], this.a[par]];
        i = par;
      }
    }
    pop() {
      const top = this.a[0];
      const last = this.a.pop();
      if (this.a.length) {
        this.a[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let s = i;
          if (l < this.a.length && this.a[l].p < this.a[s].p) s = l;
          if (r < this.a.length && this.a[r].p < this.a[s].p) s = r;
          if (s === i) break;
          [this.a[s], this.a[i]] = [this.a[i], this.a[s]];
          i = s;
        }
      }
      return top.v;
    }
  }

  return { find, nearestWalkable };
})();
