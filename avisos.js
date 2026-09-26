/* ===========================================================
   avisos.js — o escritório te chama no celular

   Dois canais, os dois sem a API da Meta:

     ntfy      — notificação push no celular pelo app gratuito "ntfy".
                 Sem conta e sem senha: o celular assina um TÓPICO e tudo que
                 chega nele vira notificação. O tópico é gerado aleatório,
                 porque no ntfy.sh quem souber o nome consegue ler.
     WhatsApp  — mensagem no SEU WhatsApp pelo CallMeBot, serviço gratuito:
                 você manda uma mensagem para o número deles e recebe uma
                 chave. É mensagem para você mesmo, não para cliente.

   O texto do aviso passa por servidor de terceiro: mande contagem e resumo,
   nunca dado pessoal de cliente. Seus sistemas podem pedir um aviso com
   POST http://localhost:4321/api/avisar {titulo, texto, prioridade}.

   Config em data/avisos.json.
   =========================================================== */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

let ARQ = null;

const PADRAO = () => ({
  ntfy: { ativo: false, topico: 'escritorio-' + crypto.randomBytes(6).toString('hex'), servidor: 'https://ntfy.sh' },
  whatsapp: { ativo: false, fone: '', apikey: '' },
  resumo: { ativo: true, hora: 9, minuto: 0 },
  historico: []
});

function ler() {
  try {
    const d = JSON.parse(fs.readFileSync(ARQ, 'utf8'));
    const p = PADRAO();
    return { ...p, ...d, ntfy: { ...p.ntfy, ...(d.ntfy || {}) },
             whatsapp: { ...p.whatsapp, ...(d.whatsapp || {}) }, resumo: { ...p.resumo, ...(d.resumo || {}) } };
  } catch (e) {
    const p = PADRAO();
    gravar(p);            // o tópico aleatório nasce uma vez e fica
    return p;
  }
}
function gravar(c) { try { fs.writeFileSync(ARQ, JSON.stringify(c, null, 2) + '\n'); } catch (e) {} }

function pede(url, opcoes = {}) {
  return new Promise(resolve => {
    let u; try { u = new URL(url); } catch (e) { return resolve({ erro: 'endereço inválido' }); }
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.request(u, { method: opcoes.metodo || 'GET', headers: opcoes.headers || {}, timeout: 15000 }, r => {
      let s = ''; r.on('data', c => s += c);
      r.on('end', () => resolve({ status: r.statusCode, corpo: s }));
    });
    req.on('error', e => resolve({ erro: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ erro: 'tempo esgotado' }); });
    if (opcoes.corpo) req.write(opcoes.corpo);
    req.end();
  });
}

/* cabeçalho HTTP só aceita ASCII: o título com acento vai codificado */
const cabecalho = (t) => /^[\x20-\x7e]*$/.test(t) ? t : '=?UTF-8?B?' + Buffer.from(t, 'utf8').toString('base64') + '?=';

/**
 * Manda um aviso para os canais ligados.
 * prioridade: 'baixa' | 'normal' | 'alta'
 */
async function avisar(titulo, texto, prioridade = 'normal', forcar = false) {
  const c = ler();
  const res = {};
  if (c.ntfy.ativo || forcar) {
    const r = await pede(c.ntfy.servidor.replace(/\/+$/, '') + '/' + encodeURIComponent(c.ntfy.topico), {
      metodo: 'POST', corpo: Buffer.from(texto, 'utf8'),
      headers: { 'Title': cabecalho(titulo), 'Priority': prioridade === 'alta' ? '4' : prioridade === 'baixa' ? '2' : '3',
                 'Tags': prioridade === 'alta' ? 'warning' : 'bell', 'Content-Type': 'text/plain; charset=utf-8' }
    });
    res.ntfy = r.erro ? r.erro : (r.status < 300 ? 'ok' : 'HTTP ' + r.status);
  }
  if ((c.whatsapp.ativo || forcar) && c.whatsapp.fone && c.whatsapp.apikey) {
    const q = 'phone=' + encodeURIComponent(c.whatsapp.fone.replace(/\D/g, '')) +
              '&text=' + encodeURIComponent('*' + titulo + '*\n' + texto) +
              '&apikey=' + encodeURIComponent(c.whatsapp.apikey);
    const r = await pede('https://api.callmebot.com/whatsapp.php?' + q);
    res.whatsapp = r.erro ? r.erro : (r.status < 300 && !/error|invalid/i.test(r.corpo) ? 'ok' : (r.corpo || '').replace(/<[^>]+>/g, ' ').trim().slice(0, 160));
  }
  c.historico.unshift({ quando: new Date().toISOString(), titulo, texto, res });
  c.historico = c.historico.slice(0, 50);
  gravar(c);
  return res;
}

/* ---------------- o resumo do dia ----------------
   Uma vez por dia, na hora marcada. Quem monta as linhas é o servidor
   (hoje: sistemas que caíram e não voltaram). Só manda se houver o que dizer. */
let fonte = { nome: () => 'Escritório', resumo: async () => [] };
async function montarResumo() {
  try { return await fonte.resumo(); } catch (e) { return []; }
}

let ultimoResumo = null;
function agendarResumo() {
  setInterval(async () => {
    const c = ler();
    if (!c.resumo.ativo || (!c.ntfy.ativo && !c.whatsapp.ativo)) return;
    const d = new Date();
    const dia = d.toDateString();
    if (ultimoResumo === dia) return;
    if (d.getHours() !== c.resumo.hora || d.getMinutes() < c.resumo.minuto) return;
    ultimoResumo = dia;
    const linhas = await montarResumo();
    if (linhas.length) await avisar(fonte.nome() + ' · resumo do dia', linhas.join('\n') + '\nAbra o escritório para ver.');
  }, 60000);
}

module.exports = {
  init(dir, f) { ARQ = path.join(dir, 'data', 'avisos.json'); if (f) fonte = Object.assign(fonte, f); ler(); agendarResumo(); return module.exports; },
  ler, avisar, montarResumo,
  configurar(corpo) {
    const c = ler();
    if (corpo.ntfy) {
      if (corpo.ntfy.ativo !== undefined) c.ntfy.ativo = !!corpo.ntfy.ativo;
      if (corpo.ntfy.topico) c.ntfy.topico = String(corpo.ntfy.topico).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || c.ntfy.topico;
    }
    if (corpo.whatsapp) {
      if (corpo.whatsapp.ativo !== undefined) c.whatsapp.ativo = !!corpo.whatsapp.ativo;
      if (corpo.whatsapp.fone !== undefined) c.whatsapp.fone = String(corpo.whatsapp.fone).replace(/\D/g, '').slice(0, 15);
      if (corpo.whatsapp.apikey) c.whatsapp.apikey = String(corpo.whatsapp.apikey).trim().slice(0, 40);
    }
    if (corpo.resumo) {
      if (corpo.resumo.ativo !== undefined) c.resumo.ativo = !!corpo.resumo.ativo;
      if (corpo.resumo.hora !== undefined) c.resumo.hora = Math.min(23, Math.max(0, +corpo.resumo.hora || 0));
    }
    gravar(c);
    return c;
  },
  /* o que a tela pode ver: a chave do CallMeBot não volta para o navegador */
  publico() {
    const c = ler();
    return { ntfy: c.ntfy, whatsapp: { ativo: c.whatsapp.ativo, fone: c.whatsapp.fone, temChave: !!c.whatsapp.apikey },
             resumo: c.resumo, historico: c.historico.slice(0, 15) };
  }
};
