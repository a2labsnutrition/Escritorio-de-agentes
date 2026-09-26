/* ===========================================================
   reuniao.js (navegador) — a mesa de reunião

   Mostra a reunião diária acontecendo: quem está falando, o que cada
   um trouxe, e o briefing no fim. Enquanto ela roda, os bonecos dos
   participantes vão para a sala de reunião — quem manda eles para lá
   é o app.js, olhando este estado.
   =========================================================== */
const REUNIAO = (() => {

  let est = null, timer = null, aberto = false;

  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** **negrito** e listas simples sem puxar biblioteca */
  const fmt = t => esc(t).replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');

  const dinheiro = v => 'US$ ' + (+v || 0).toFixed(2);
  const hora = ms => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  async function buscar() {
    try { est = await (await fetch('/api/reuniao')).json(); }
    catch (e) { est = null; return est; }
    // fora da reunião o placar não vem junto: busca para o topo não ficar vazio
    if (est && !est.placar) {
      try { est.placar = await (await fetch('/api/reuniao/placar')).json(); }
      catch (e) { /* segue sem os números */ }
    }
    return est;
  }

  /* quem deve estar sentado na mesa agora */
  const emAndamento = () => !!(est && est.rodando);
  const naMesa = () => (est && est.rodando ? (est.participantes || []).map(p => p.nome) : []);

  function abrir() {
    aberto = true;
    $('#reuniao').classList.remove('hidden');
    atualizar();
    clearInterval(timer);
    timer = setInterval(atualizar, 3000);
  }

  function fechar() {
    aberto = false;
    $('#reuniao').classList.add('hidden');
    clearInterval(timer);
    timer = setInterval(atualizar, 15000);   // segue de olho para os bonecos
  }

  async function atualizar() {
    await buscar();
    if (!est) return;
    if (aberto) pintar();
  }

  function pintar() {
    const p = est.placar || {};

    $('#rn-quando').textContent = est.rodando
      ? `acontecendo agora · começou ${hora(est.desde)} · termina ${hora(est.ate)}`
      : !est.proxima ? 'automática desligada · clique em Reunir agora (data/config.json liga o horário fixo)'
      : `${(est.dias||['todo dia']).join(' e ')} às ${est.hora}, ${est.duracao} min · próxima ${new Date(est.proxima).toLocaleString('pt-BR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`;

    const nMesa = ((est.participantes && est.participantes.length) ? est.participantes : (est.convocados || [])).length;
    $('#rn-titulo').textContent = 'REUNIÃO DOS AGENTES' +
      (p.alvo ? ' · ' + p.alvo + ' ' + String(p.unidade || '').toUpperCase() : '');
    $('#rn-meta').innerHTML = (p.alvo
      ? `<div><b>${p.feito}</b><span>${esc(p.unidade)} feitos</span></div>
         <div><b>${p.faltam}</b><span>faltam para ${p.alvo}</span></div>
         ${p.diasRestantes != null ? `<div><b>${p.diasRestantes}</b><span>dias até ${p.ate.split('-').reverse().join('/')}</span></div>
         <div><b>${p.porSemana.toFixed(1)}</b><span>por semana</span></div>` : ''}`
      : `<div><b>—</b><span>sem meta (data/config.json)</span></div>`) +
      `<div><b>${nMesa}</b><span>na mesa</span></div>
       <div><b class="rn-custo">${dinheiro(est.custo)}</b><span>custo de hoje</span></div>`;

    let html = '';

    if (est.rodando)
      html += `<div class="rn-fase"><i></i>${esc(est.fase)} — os agentes estão lendo os próprios dados</div>`;

    if (est.briefing)
      html += `<div class="rn-brief"><h3>BRIEFING DO DIA</h3><p>${fmt(est.briefing)}</p></div>`;

    const falas = est.falas || [];
    for (const f of falas) {
      if (f.erro && !f.texto) {
        html += `<div class="rn-fala erro"><span class="qm">${esc(f.quem)}<small>não conseguiu participar</small></span>
                 <p>${esc(f.erro)}</p></div>`;
        continue;
      }
      html += `<div class="rn-fala ${f.rodada === 2 ? 'r2' : ''}">
                 <span class="qm">${esc(f.quem)}<small>${esc(f.papel || '')} · rodada ${f.rodada}</small></span>
                 <p>${fmt(f.texto)}</p></div>`;
    }

    if (!falas.length && !est.rodando) {
      const conv = est.convocados || [];
      html += `<p class="hint">Ninguém se reuniu ainda hoje. A reunião começa sozinha ${(est.dias||[]).length ? 'às ' + est.dias.join('s e ') + 's' : ''}, ${est.hora}
        e dura ${est.duracao} minutos — ou clique em <b>Reunir agora</b>.</p>
        <p class="hint" style="margin-top:10px"><b>Quem senta à mesa:</b><br>` +
        (conv.length ? conv.map(c => '• ' + esc(c.nome) + ' — ' + esc(c.papel)).join('<br>')
                     : 'ninguém com pasta para investigar') + '</p>';
    }

    const fora = est.foraDaMesa || [];
    if (fora.length)
      html += `<div class="rn-fora"><b>Fora da mesa:</b><br>` +
        fora.map(f => '• ' + esc(f.nome) + ' — ' + esc(f.motivo)).join('<br>') + '</div>';

    html += `<div class="rn-fora">Cada agente é uma chamada do Claude Code dentro da pasta do sistema dele,
      com modelo leve e no máximo 4 consultas. Não é cobrança no cartão: consome a cota do seu plano
      Claude Pro. O valor lá em cima é o equivalente em preço de API, para você dimensionar o uso.</div>`;

    $('#rn-corpo').innerHTML = html;
  }

  function ligarEventos() {
    $('#rn-x').addEventListener('click', fechar);
    $('#reuniao').addEventListener('click', e => { if (e.target.id === 'reuniao') fechar(); });
    $('#rn-rodar').addEventListener('click', async () => {
      const b = $('#rn-rodar');
      b.disabled = true; b.textContent = 'convocando…';
      let r = null, falha = null;
      try { r = await (await fetch('/api/reuniao/iniciar', { method: 'POST' })).json(); }
      catch (e) { falha = 'o escritório não respondeu — ele está no ar?'; }
      b.disabled = false; b.textContent = '▶ Reunir agora';
      // erro em silêncio era o pior: clicava e não acontecia nada na tela
      if (falha || (r && !r.ok)) {
        $('#rn-corpo').insertAdjacentHTML('afterbegin',
          '<div class="rn-fala erro"><span class="qm">A reunião não começou</span><p>' +
          esc(falha || r.motivo || 'motivo não informado') + '</p></div>');
      }
      atualizar();
    });
    $('#rn-parar').addEventListener('click', async () => {
      try { await fetch('/api/reuniao/parar', { method: 'POST' }); } catch (e) {}
      atualizar();
    });
    // de olho mesmo com o painel fechado: é assim que os bonecos sabem ir
    clearInterval(timer);
    timer = setInterval(atualizar, 15000);
    atualizar();
  }

  return { abrir, fechar, ligarEventos, atualizar, emAndamento, naMesa,
           get estado() { return est; } };
})();
