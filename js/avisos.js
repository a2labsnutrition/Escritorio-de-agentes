/* ===========================================================
   avisos.js (navegador) — o sino no topo do escritório

   Configura para onde o escritório te chama: notificação no celular (app
   ntfy) e/ou mensagem no seu próprio WhatsApp (CallMeBot). Usa o modal
   que já existe na página.
   =========================================================== */
const AVISOS_UI = (() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const api = async (r, m = 'GET', c) => (await fetch(r, { method: m,
    headers: { 'Content-Type': 'application/json' }, body: c ? JSON.stringify(c) : undefined })).json();

  async function abrir() {
    const a = await api('/api/avisos');
    const hist = (a.historico || []).slice(0, 6).map(h =>
      `<div style="padding:6px 0;border-bottom:1px solid var(--line,#262b3d);font-size:12px">
         <b>${esc(h.titulo)}</b> <span class="hint">· ${new Date(h.quando).toLocaleString('pt-BR')}</span><br>
         <span class="hint">${esc(h.texto)}</span>
         <span class="hint" style="float:right">${esc(Object.entries(h.res || {}).map(([k, v]) => k + ': ' + v).join(' · '))}</span></div>`).join('');

    $('#modal-body').innerHTML = `
      <h3 style="font-family:var(--f-display);margin:0 0 6px">🔔 Avisos no celular</h3>
      <p class="hint" style="margin-bottom:14px;line-height:1.6">O escritório te chama quando precisa de você: um sistema que caiu e não voltou, a reunião que terminou,
        uma ação da agenda. Seus sistemas também podem pedir um aviso com um POST em <code>/api/avisar</code>.
        Mande só contagem e resumo: o texto passa por servidor de terceiro.</p>

      <div class="frow"><label>Notificação no celular (ntfy)</label>
        <div class="hint" style="line-height:1.7">
          1. Instale o app <b>ntfy</b> (Play Store ou App Store, é gratuito).<br>
          2. No app, toque em <b>+</b> e assine o tópico: <code style="user-select:all">${esc(a.ntfy.topico)}</code><br>
          3. Marque abaixo e clique em <b>Testar</b>.<br>
          O tópico é um nome aleatório de propósito: no ntfy, quem souber o nome consegue ler.
        </div>
        <label style="display:flex;gap:8px;align-items:center;margin-top:8px">
          <input type="checkbox" id="av-ntfy" ${a.ntfy.ativo ? 'checked' : ''}> Mandar para o celular</label>
      </div>

      <div class="frow"><label>No seu WhatsApp (opcional)</label>
        <div class="hint" style="line-height:1.7">
          Pelo CallMeBot, gratuito. Do seu celular, mande a mensagem
          <code>I allow callmebot to send me messages</code> para o número que aparece em
          <code>callmebot.com/blog/free-api-whatsapp-messages</code>. Ele responde com uma
          <b>apikey</b> — cole aqui. A mensagem chega do número deles, só para você.
        </div>
        <div class="row" style="display:flex;gap:8px;margin-top:8px">
          <input id="av-fone" placeholder="seu número com DDD, ex. 65999999999" value="${esc(a.whatsapp.fone)}" style="flex:2">
          <input id="av-key" placeholder="${a.whatsapp.temChave ? 'apikey já guardada' : 'apikey'}" style="flex:1">
        </div>
        <label style="display:flex;gap:8px;align-items:center;margin-top:8px">
          <input type="checkbox" id="av-wa" ${a.whatsapp.ativo ? 'checked' : ''}> Mandar para o meu WhatsApp</label>
      </div>

      <div class="frow"><label>Resumo da manhã</label>
        <label style="display:flex;gap:8px;align-items:center">
          <input type="checkbox" id="av-res" ${a.resumo.ativo ? 'checked' : ''}> Todo dia às
          <input type="number" id="av-hora" value="${a.resumo.hora}" min="0" max="23" style="width:64px"> h</label>
      </div>

      <div class="mactions">
        <button class="btn primary" id="av-ok">Salvar</button>
        <button class="btn" id="av-teste">Testar agora</button>
        <button class="btn ghost" id="av-previa">Ver o resumo de hoje</button>
      </div>
      <div id="av-msg" class="hint" style="margin-top:10px"></div>
      ${hist ? '<div class="frow" style="margin-top:14px"><label>Últimos avisos</label>' + hist + '</div>' : ''}`;
    $('#modal').classList.remove('hidden');

    const salvar = () => api('/api/avisos', 'PUT', {
      ntfy: { ativo: $('#av-ntfy').checked },
      whatsapp: { ativo: $('#av-wa').checked, fone: $('#av-fone').value,
                  ...($('#av-key').value ? { apikey: $('#av-key').value } : {}) },
      resumo: { ativo: $('#av-res').checked, hora: $('#av-hora').value }
    });
    $('#av-ok').onclick = async () => { await salvar(); $('#av-msg').textContent = 'Salvo.'; };
    $('#av-teste').onclick = async () => {
      await salvar();
      $('#av-msg').textContent = 'Mandando…';
      const r = await api('/api/avisos/testar', 'POST', {});
      const partes = Object.entries(r.res || {}).map(([k, v]) => (k === 'ntfy' ? 'celular' : 'WhatsApp') + ': ' + (v === 'ok' ? 'enviado' : v));
      $('#av-msg').textContent = partes.length ? partes.join(' · ') + '. Confira o celular.' : 'Nada ligado para testar.';
    };
    $('#av-previa').onclick = async () => {
      const r = await api('/api/avisos/resumo');
      $('#av-msg').textContent = r.linhas.length ? r.linhas.join(' ') : 'Hoje não há ninguém na vez — o resumo não seria enviado.';
    };
  }

  return { abrir };
})();
