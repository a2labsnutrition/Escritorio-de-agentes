/* ===========================================================
   quadro.js — ideias e agenda que aparecem nas paredes da Diretoria.
   Ficam no navegador (localStorage): são lembretes, não registro.
   =========================================================== */
const QUADRO = (() => {
  const K = 'escritorio-quadro-v1';
  let q = null;
  try { q = JSON.parse(localStorage.getItem(K) || 'null'); } catch (e) { /* storage bloqueado */ }
  if (!q || !Array.isArray(q.ideias) || !Array.isArray(q.eventos)) q = { ideias: [], eventos: [] };
  const salvar = () => { try { localStorage.setItem(K, JSON.stringify(q)); } catch (e) {} };

  return {
    ideias:  () => q.ideias.slice(),
    eventos: () => q.eventos.slice(),
    addIdeia(t) {
      q.ideias.unshift(String(t).slice(0, 52));
      q.ideias = q.ideias.slice(0, 6); salvar();
    },
    delIdeia(i) { q.ideias.splice(i, 1); salvar(); },
    addEvento(e) {
      q.eventos.push({ data: String(e.data).slice(0, 8), nome: String(e.nome).slice(0, 34), tipo: String(e.tipo || 'Evento').slice(0, 16) });
      q.eventos = q.eventos.slice(0, 6); salvar();
    },
    delEvento(i) { q.eventos.splice(i, 1); salvar(); }
  };
})();
