/* ===========================================================
   server.js — serve o escritório e comanda os sistemas dos agentes.

   Além dos arquivos estáticos, expõe uma API pequena para ligar,
   desligar e acompanhar cada sistema cadastrado em data/sistemas.json.

   Duas travas importantes:
   - escuta só em 127.0.0.1, não fica exposto na rede;
   - só executa o que está no registro. A requisição manda um id, nunca
     um comando, então não dá para pedir ao servidor que rode outra coisa.
   =========================================================== */
const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const net   = require('net');
const { spawn } = require('child_process');

const ROOT = __dirname;

/* ---------------- configuração ----------------
   data/config.json é seu e fica fora do git. O que faltar nele vem do
   padrão abaixo; o modelo comentado está em data/config.exemplo.json. */
const CONFIG_ARQ = path.join(ROOT, 'data', 'config.json');
const CONFIG_PADRAO = {
  nome: 'Escritório de Agentes', subtitulo: 'painel dos seus agentes de IA',
  dono: 'Você', empresa: '', porta: 4321,
  reuniao: { automatica: false, dias: [1, 5], hora: 11, minuto: 0, duracaoMin: 30, modelo: 'sonnet',
             foco: '', meta: { descricao: '', alvo: 0, feito: 0, unidade: 'resultados', ate: '' } }
};
function lerConfig() {
  let c = {};
  try { c = JSON.parse(fs.readFileSync(CONFIG_ARQ, 'utf8')); } catch (e) { /* sem config: vale o padrão */ }
  const r = Object.assign({}, CONFIG_PADRAO, c);
  r.reuniao = Object.assign({}, CONFIG_PADRAO.reuniao, c.reuniao || {});
  r.reuniao.meta = Object.assign({}, CONFIG_PADRAO.reuniao.meta, (c.reuniao || {}).meta || {});
  return r;
}
const PORT = Number(process.env.PORT) || Number(lerConfig().porta) || 4321;

const REGISTRO = path.join(ROOT, 'data', 'sistemas.json');
// primeira vez: o registro nasce do exemplo, que já traz o agente de demonstração
if (!fs.existsSync(REGISTRO)) {
  try { fs.copyFileSync(path.join(ROOT, 'data', 'sistemas.exemplo.json'), REGISTRO); } catch (e) { /* segue vazio */ }
}
const EQUIPE     = path.join(ROOT, 'data', 'equipe.json');
const EQUIPE_BAK = path.join(ROOT, 'data', 'equipe.bak.json');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon'
};

/* ---------------- registro ---------------- */
function lerRegistro() {
  try {
    const bruto = JSON.parse(fs.readFileSync(REGISTRO, 'utf8'));
    const out = {};
    for (const [id, s] of Object.entries(bruto)) {
      if (id.startsWith('_')) continue;          // chaves de comentário
      // pasta relativa vale a partir da pasta do escritório (ex.: o agente de exemplo)
      if (s && s.pasta && !path.isAbsolute(s.pasta)) s.pasta = path.join(ROOT, s.pasta);
      out[id] = s;
    }
    return out;
  } catch (e) {
    console.error('  Não consegui ler data/sistemas.json:', e.message);
    return {};
  }
}

/* ---------------- cadastrar e tirar sistema pela tela ---------------- */
const slug = t => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'agente';

function lerRegistroBruto() {
  try { return JSON.parse(fs.readFileSync(REGISTRO, 'utf8')); } catch (e) { return {}; }
}
function gravarRegistro(bruto) {
  fs.mkdirSync(path.dirname(REGISTRO), { recursive: true });
  fs.writeFileSync(REGISTRO, JSON.stringify(bruto, null, 2) + '\n');
}

/** separa "run dev --port 3000" em argumentos, respeitando aspas */
const partirArgs = t => (String(t || '').match(/"[^"]*"|\S+/g) || []).map(a => a.replace(/^"|"$/g, ''));

function novoSistema(b) {
  const nome = String(b.nome || '').trim().slice(0, 60);
  if (!nome) return { ok: false, motivo: 'dê um nome ao sistema' };
  const bruto = lerRegistroBruto();
  let id = slug(b.id || nome), n = 2;
  while (bruto[id]) id = slug(b.id || nome) + '-' + n++;

  let item;
  if (b.tipo === 'web') {
    const url = String(b.url || '').trim();
    if (!/^https?:\/\/\S+$/i.test(url)) return { ok: false, motivo: 'o endereço precisa começar com http:// ou https://' };
    item = { nome, tipo: 'web', url, embutir: b.embutir === 'espelho' ? 'espelho' : true };
  } else {
    const pasta = String(b.pasta || '').trim();
    if (!pasta || !fs.existsSync(pasta) || !fs.statSync(pasta).isDirectory())
      return { ok: false, motivo: 'pasta não encontrada: ' + (pasta || '(vazia)') };
    const comando = String(b.comando || '').trim();
    const args = partirArgs(b.args);
    if (!comando) return { ok: false, motivo: 'diga o comando que sobe o sistema (ex.: npm)' };
    const suspeito = [comando, ...args].find(a => /[&|;<>`$]/.test(a));
    if (suspeito) return { ok: false, motivo: 'caractere não permitido no comando: ' + suspeito };
    const porta = Number(b.porta);
    if (!Number.isInteger(porta) || porta < 1024 || porta > 65535) return { ok: false, motivo: 'porta inválida (use de 1024 a 65535)' };
    if (porta === PORT) return { ok: false, motivo: 'essa é a porta do próprio escritório' };
    const dona = Object.entries(lerRegistro()).find(([, x]) => x.porta === porta);
    if (dona) return { ok: false, motivo: 'a porta ' + porta + ' já é de ' + (dona[1].nome || dona[0]) };
    item = { nome, tipo: 'local', pasta, comando, args, env: { PORT: String(porta) }, porta,
             abre: String(b.abre || '/').startsWith('/') ? String(b.abre || '/') : '/' };
  }
  if (b.sobre) item.sobre = String(b.sobre).slice(0, 400);
  bruto[id] = item;
  gravarRegistro(bruto);
  return { ok: true, id, sistema: item };
}

function tirarSistema(id) {
  const bruto = lerRegistroBruto();
  if (!bruto[id] || id.startsWith('_')) return { ok: false, motivo: 'sistema não está no registro' };
  desligar(id);
  delete bruto[id];
  gravarRegistro(bruto);
  return { ok: true };
}

/* ===========================================================
   ESPELHO — para sistema que recusa ser embutido

   Alguns painéis mandam `X-Frame-Options: SAMEORIGIN`. É uma defesa
   contra clickjacking: impede que um site estranho ponha o painel num
   iframe e engane o usuário. O navegador obedece e o escritório fica
   com um quadro branco, sem explicação nenhuma.

   O espelho é um proxy de mão única em 127.0.0.1 que repassa tudo para
   o sistema e tira só esse cabeçalho. Quem enquadra aqui é o próprio
   escritório, na mesma máquina, aberto pelo dono — o cenário que o
   cabeçalho existe para barrar não é este. Fora isso nada muda: o
   caminho, os cookies e o corpo passam intactos.

   Porta do espelho = porta do sistema + 100 (4408 -> 4508), ou
   "portaEspelho" no registro. Vale só para quem tem "embutir":"espelho".
   =========================================================== */
const espelhos = new Map();       // id -> { porta, servidor }

const portaEspelhoDe = (s) =>
  s.portaEspelho || (s.tipo !== 'web' && s.porta ? s.porta + 100 : null);

/** para onde o espelho repassa: o servidor local, ou o site publicado */
function alvoDoEspelho(s) {
  if (s.tipo !== 'web') {
    return s.porta
      ? { mod: http, host: '127.0.0.1', port: s.porta, origem: null }
      : null;
  }
  try {
    const u = new URL(s.url);
    const seguro = u.protocol === 'https:';
    return {
      mod: seguro ? https : http,
      host: u.hostname,
      port: u.port || (seguro ? 443 : 80),
      origem: u.origin              // para reescrever redirecionamento
    };
  } catch (e) { return null; }
}

function ligaEspelho(id, s) {
  const alvo = alvoDoEspelho(s), porta = portaEspelhoDe(s);
  if (!alvo || !porta || espelhos.has(id)) return;
  const hostAcima = alvo.origem ? alvo.host : alvo.host + ':' + alvo.port;

  const srv = http.createServer((req, res) => {
    const cabecalhos = Object.assign({}, req.headers, { host: hostAcima });
    // o site publicado desconfia de origem estranha; o espelho não é um site
    if (alvo.origem) { delete cabecalhos.origin; delete cabecalhos.referer; }

    const acima = alvo.mod.request({
      host: alvo.host, port: alvo.port, method: req.method, path: req.url,
      headers: cabecalhos
    }, r => {
      const h = Object.assign({}, r.headers);
      delete h['x-frame-options'];                 // é só para isto que o espelho existe
      if (h['content-security-policy']) {          // mesma trava por outros nomes
        const restante = String(h['content-security-policy']).split(';')
          .filter(d => !/^\s*(frame-ancestors|upgrade-insecure-requests)/i.test(d))
          .join(';').trim();
        if (restante) h['content-security-policy'] = restante;
        else delete h['content-security-policy'];
      }
      // o espelho é http em 127.0.0.1: cookie marcado como Secure não colaria,
      // e a sessão aqui é separada da do site de verdade de qualquer jeito
      if (h['set-cookie']) h['set-cookie'] = [].concat(h['set-cookie'])
        .map(c => c.replace(/;\s*Secure/gi, ''));
      // redirecionamento absoluto sairia do quadro e voltaria para a origem
      const saida = alvo.origem || 'http://(localhost|127\\.0\\.0\\.1):' + alvo.port;
      if (h.location) h.location = String(h.location).replace(
        alvo.origem ? new RegExp('^' + saida.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                    : new RegExp('^' + saida), '');
      res.writeHead(r.statusCode, h);
      r.pipe(res);
    });
    acima.on('error', e => {
      res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('espelho: ' + e.message);
    });
    req.pipe(acima);
  });

  srv.on('error', e => {
    console.error(`  espelho de ${id} não subiu na porta ${porta}: ${e.message}`);
    espelhos.delete(id);
  });
  srv.listen(porta, '127.0.0.1', () => espelhos.set(id, { porta, servidor: srv }));
}

/* ---------------- processos ---------------- */
const vivos = new Map();          // id -> { child, log, desde, erro }
/* O Next recusa um segundo dev server para a mesma pasta, mesmo em outra
   porta — ele avisa qual já está no ar e sai. Guardamos essa porta para
   reaproveitar o servidor existente em vez de insistir em subir outro. */
const PORTAS_ARQ = path.join(ROOT, 'data', 'portas.json');
const reaproveita = new Map();    // id -> porta onde o projeto já responde

/* Sem isso, reiniciar o escritório esquecia em que porta um projeto Next
   já estava de pé, e ele aparecia como desligado até alguém clicar em Ligar. */
function lerPortas() {
  try {
    const d = JSON.parse(fs.readFileSync(PORTAS_ARQ, 'utf8'));
    for (const [id, porta] of Object.entries(d)) reaproveita.set(id, Number(porta));
  } catch (e) { /* primeira execução: ainda não existe */ }
}
function gravarPortas() {
  try {
    fs.writeFileSync(PORTAS_ARQ,
      JSON.stringify(Object.fromEntries(reaproveita), null, 2) + '\n');
  } catch (e) { console.error('  não consegui gravar data/portas.json:', e.message); }
}
lerPortas();
const LOG_MAX = 400;
const LOGS = path.join(ROOT, 'data', 'logs');
const VIVOS_ARQ = path.join(ROOT, 'data', 'vivos.json');

/* ---------------- quem continua de pé entre reinícios ----------------
   O escritório pode cair ou ser reiniciado; os sistemas não. Este arquivo
   é a memória de quem ele subiu, para reencontrar cada um quando voltar
   em vez de tratar tudo como processo de estranho. */
function gravarVivos() {
  try {
    const d = {};
    for (const [id, p] of vivos)
      if (!p.encerrado) d[id] = { pid: p.pid, desde: p.desde, arquivo: p.arquivo };
    fs.mkdirSync(path.dirname(VIVOS_ARQ), { recursive: true });
    fs.writeFileSync(VIVOS_ARQ, JSON.stringify(d, null, 2) + '\n');
  } catch (e) { /* perder isso só custa o rótulo "fora daqui" */ }
}

/** o processo ainda existe? sinal 0 não mata, só pergunta */
const pidDePe = (pid) => {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
};

function readotarVivos() {
  let d = {};
  try { d = JSON.parse(fs.readFileSync(VIVOS_ARQ, 'utf8')); } catch (e) { return; }
  let n = 0;
  for (const [id, p] of Object.entries(d)) {
    if (!p || !p.pid || !pidDePe(p.pid)) continue;
    vivos.set(id, { pid: p.pid, desde: p.desde || Date.now(),
                    arquivo: p.arquivo || path.join(LOGS, id + '.log'), erro: null });
    n++;
  }
  if (n) console.log('  reencontrei ' + n + ' sistema(s) que continuaram de pé');
  gravarVivos();
}

/** últimas linhas do log em disco, sem os códigos de cor do terminal */
function tail(arquivo, n = LOG_MAX) {
  try {
    const bruto = fs.readFileSync(arquivo, 'utf8').replace(/\x1b\[[0-9;]*m/g, '');
    return bruto.split(/\r?\n/).filter(l => l.trim()).slice(-n);
  } catch (e) { return []; }
}

/* O Next avisa no log em qual porta o servidor antigo já responde. Como a
   saída agora vai para arquivo, isso é lido aqui em vez de linha a linha
   na chegada. */
function varrePortaReaproveitada(id, linhas) {
  let achou = false;
  for (const l of linhas) {
    if (/Another next dev server is already running/i.test(l)) { achou = true; continue; }
    const mp = achou && l.match(/Local:\s*https?:\/\/localhost:(\d+)/i);
    if (mp) {
      const porta = Number(mp[1]);
      if (reaproveita.get(id) !== porta) { reaproveita.set(id, porta); gravarPortas(); }
      achou = false;
    }
  }
}

/** ligar por ordem (botão, agenda): além de subir, passa a ser vigiado */
async function ligar(id) {
  const r = await ligarDeFato(id);
  if (r && r.ok) quero(id, true);
  return r;
}

async function ligarDeFato(id) {
  const s = lerRegistro()[id];
  if (!s) return { ok: false, motivo: 'sistema não está no registro' };
  if (s.tipo !== 'local') return { ok: false, motivo: 'esse é um sistema web, não sobe aqui' };
  if (vivos.has(id)) return { ok: true, jaEstava: true };
  // já está no ar (na porta dele ou na que o Next avisou): não sobe outro
  for (const porta of portasDe(id, s)) {
    if (await portaViva(porta)) return { ok: true, jaEstava: true, porta };
  }
  if (!fs.existsSync(s.pasta)) return { ok: false, motivo: 'pasta não encontrada: ' + s.pasta };
  // npm no Windows é um .cmd e exige shell; como aí os argumentos não são
  // escapados, o registro não pode conter metacaractere de shell
  const suspeito = [s.comando, ...(s.args || [])].find(a => /[&|;<>`$]/.test(String(a)));
  if (suspeito) return { ok: false, motivo: 'comando com caractere perigoso no registro: ' + suspeito };

  /* O sistema nasce SOLTO do escritório: processo destacado e a saída indo
     direto para um arquivo, não para um cano ligado a este processo.

     Antes era o contrário, e o preço apareceu no meio do trabalho: bastava
     reiniciar o escritório para todos os sistemas caírem junto. Agora o
     escritório pode ir e voltar que os sistemas continuam de pé — quando
     ele volta, reencontra cada um pelo pid guardado em data/vivos.json. */
  fs.mkdirSync(LOGS, { recursive: true });
  const arquivo = path.join(LOGS, id + '.log');
  const fd = fs.openSync(arquivo, 'a');
  fs.writeSync(fd, `\n=== ${new Date().toLocaleString('pt-BR')} — subindo: ` +
                   `${s.comando} ${(s.args || []).join(' ')} ===\n`);

  /* O sistema nasce solto do escritório: processo destacado, com a saída
     indo para um arquivo em vez de um cano preso a este processo. Assim o
     escritório pode reiniciar que ninguém cai junto.

     Duas tentativas ficaram pelo caminho e vale registrar por quê:

     - entregar a linha ao cmd.exe com redirecionamento próprio
       (\`... >> log 2>&1\`) SOBE o sistema, mas não grava nada no log;
     - o npm.cmd se perde quando o próprio nome vai entre aspas, e passa a
       procurar os arquivos dele dentro da pasta do projeto.

     O que de fato derrubava tudo com código 3221225786 (CONTROL_C_EXIT) era
     o console do supervisor morrendo junto com a sessão de quem o abriu —
     isso se resolve subindo o escritório solto (atalho na Inicialização do
     Windows ou Win32_Process.Create), não aqui dentro. */
  /* No Windows, processo destacado NÃO escreve no arquivo que passamos, nem
     pelos descritores nem com redirecionamento na linha do shell — testei os
     dois. Então o log guarda o que o escritório sabe (quando subiu, quando
     morreu e com que código), não a saída do processo. Ficar de pé valeu mais
     que o log: para ver a saída de um sistema, rode o comando dele no
     terminal, que aí ela aparece normalmente. */
  const win = process.platform === 'win32';
  const child = spawn(s.comando, s.args || [], {
    cwd: s.pasta,
    shell: win,
    env: Object.assign({}, process.env, s.env || {}),
    detached: true,
    windowsHide: true,
    stdio: win ? 'ignore' : ['ignore', fd, fd]
  });
  child.unref();
  try { fs.closeSync(fd); } catch (e) { /* o filho já tem a cópia dele */ }

  const reg = { pid: child.pid, desde: Date.now(), arquivo, erro: null };
  vivos.set(id, reg);
  gravarVivos();

  child.on('error', e => {
    reg.erro = e.message;
    try { fs.appendFileSync(arquivo, 'ERRO: ' + e.message + '\n'); } catch (_) {}
  });
  child.on('exit', code => {
    try { fs.appendFileSync(arquivo, `— processo encerrou (código ${code}) —\n`); } catch (_) {}
    reg.encerrado = { code, quando: Date.now() };
    gravarVivos();
    // guarda por um tempo para o usuário conseguir ler o que houve
    setTimeout(() => { if (vivos.get(id) === reg) { vivos.delete(id); gravarVivos(); } }, 60000);
  });

  console.log(`  ▶ ${id}: ${s.comando} ${(s.args || []).join(' ')}  (${s.pasta})`);
  return { ok: true };
}

function desligar(id) {
  quero(id, false);           // desligar é ordem: o vigia não religa
  const p = vivos.get(id);
  if (!p) return { ok: true, jaEstava: true };
  try {
    if (process.platform === 'win32') {
      // o dev.mjs desses projetos abre filhos; taskkill derruba a árvore toda
      spawn('taskkill', ['/pid', String(p.pid), '/t', '/f'], { stdio: 'ignore' });
    } else {
      process.kill(-p.pid, 'SIGTERM');
    }
  } catch (e) { /* já morreu */ }
  vivos.delete(id);
  gravarVivos();
  console.log(`  ■ ${id}: desligado`);
  return { ok: true };
}

/** a porta já está respondendo? é assim que sabemos que subiu de verdade.
    Testa IPv4 e IPv6: no Windows o Vite costuma escutar só em ::1.        */
function tentaPorta(porta, host, prazo) {
  return new Promise(res => {
    const sock = new net.Socket();
    let feito = false;
    const fim = ok => { if (feito) return; feito = true; sock.destroy(); res(ok); };
    sock.setTimeout(prazo);
    sock.once('connect', () => fim(true));
    sock.once('timeout', () => fim(false));
    sock.once('error', () => fim(false));
    sock.connect(porta, host);
  });
}
async function portaViva(porta, prazo = 350) {
  if (await tentaPorta(porta, '127.0.0.1', prazo)) return true;
  return tentaPorta(porta, '::1', prazo);
}

/** portas onde esse sistema pode estar: a configurada e a que o Next avisou */
function portasDe(id, s) {
  const p = [];
  if (s.porta) p.push(s.porta);
  const r = reaproveita.get(id);
  if (r && !p.includes(r)) p.push(r);
  return p;
}

async function estado() {
  const reg = lerRegistro();
  const out = [];
  for (const [id, s] of Object.entries(reg)) {
    const p = vivos.get(id);
    const item = {
      id, nome: s.nome, tipo: s.tipo, sobre: s.sobre || '', dicas: s.dicas || [],
      aviso: s.aviso || null,
      // true = abre direto no quadro; "espelho" = passa pelo proxy local;
      // false = o navegador recusa mesmo, então o monitor manda abrir fora
      embutir: s.embutir === undefined ? true : s.embutir,
      pasta: s.pasta || null, porta: s.porta || null
    };
    if (s.tipo === 'web') {
      item.url = s.url;
      item.estado = 'web';
      // site que recusa iframe também passa pelo espelho
      if (s.embutir === 'espelho') {
        ligaEspelho(id, s);
        const e = espelhos.get(id);
        if (e) item.urlEmbutida = 'http://localhost:' + e.porta + (s.abre || '/');
      }
    } else {
      let viva = null;
      for (const porta of portasDe(id, s)) {
        if (await portaViva(porta)) { viva = porta; break; }
      }
      item.portaViva = viva;
      item.url = 'http://localhost:' + (viva || s.porta) + (s.abre || '/');
      item.estado = viva ? 'no ar'
                  : p ? (p.encerrado ? 'caiu' : 'subindo')
                  : 'desligado';
      item.desde = p ? p.desde : null;
      item.erro = p ? p.erro : null;
      // porta ocupada sem ter sido ligada por aqui = já estava rodando
      item.externo = !!viva && (!p || viva !== s.porta);
      // quem recusa iframe aparece pelo espelho; a nova aba continua indo
      // no endereço de verdade, que é o que o dono quer ver na barra
      if (s.embutir === 'espelho' && viva) {
        ligaEspelho(id, s);
        const e = espelhos.get(id);
        if (e) item.urlEmbutida = 'http://localhost:' + e.porta + (s.abre || '/');
      }
      // últimas linhas ajudam a explicar um 'caiu' sem abrir o log
      const linhas = p ? tail(p.arquivo) : tail(path.join(LOGS, id + '.log'));
      if (!viva && linhas.length) varrePortaReaproveitada(id, linhas);
      item.ultimoLog = linhas.slice(-6);
    }
    out.push(item);
  }
  return out;
}


/* ===========================================================
   CONVERSA COM O AGENTE

   Cada agente é uma sessão do Claude Code rodando DENTRO da pasta
   do sistema dele. Ele lê o código, roda os scripts de diagnóstico
   do próprio projeto e responde sobre o que encontrou.

   Dois modos, e a diferença importa:
   - investigar: somente leitura. Ele olha e explica, não altera nada.
   - resolver:   pode editar arquivo e rodar comando do projeto.
   =========================================================== */
const conversas = new Map();   // id -> { sessionId, historico, rodando, proc, erro }

/* O claude é um .exe de verdade, então roda SEM shell — e é isso que faz o
   Node escapar os argumentos. Com shell:true no Windows eles são só
   concatenados: a pergunta quebrava no primeiro espaço e qualquer & ou |
   digitado na caixa de texto viraria comando na máquina. */
const CLAUDE_BIN = (() => {
  const tentativas = [
    path.join(process.env.USERPROFILE || process.env.HOME || '', '.local', 'bin', 'claude.exe'),
    path.join(process.env.USERPROFILE || process.env.HOME || '', '.local', 'bin', 'claude')
  ];
  for (const t of tentativas) { if (t && fs.existsSync(t)) return t; }
  return process.platform === 'win32' ? 'claude.exe' : 'claude';   // deixa o PATH resolver
})();
const LIMITE_CONVERSA = 6 * 60 * 1000;

/* a reunião diária dos agentes — ver reuniao.js */
const equipeDoDisco = () => {
  try { return (JSON.parse(fs.readFileSync(EQUIPE, 'utf8')).team) || []; }
  catch (e) { return []; }
};
/* o resumo diário do celular: quem caiu e não voltou */
const AVISOS = require('./avisos').init(ROOT, {
  nome: () => lerConfig().nome,
  resumo: async () => (await estado()).filter(x => x.estado === 'caiu')
    .map(x => (x.nome || x.id) + ' está fora do ar.')
});
const REUNIAO = require('./reuniao').init({ ROOT, lerRegistro, CLAUDE_BIN, config: lerConfig,
  avisar: (t, x, p) => AVISOS.avisar(t, x, p).catch(() => {}) });
REUNIAO.agendar(equipeDoDisco);

const PAPEL =
  'Você é o agente responsável por este sistema dentro do escritório de agentes, ' +
  'o painel que o dono usa para acompanhar os agentes dele. Responda em português do ' +
  'Brasil, direto ao ponto, sem enrolação. Quando investigar um problema, diga a causa ' +
  'provável, a evidência que te levou até ela, e o que fazer — nessa ordem. Prefira rodar ' +
  'os scripts de diagnóstico do próprio projeto a adivinhar. Se não tiver certeza, diga.';

function conversaDe(id) {
  let c = conversas.get(id);
  if (!c) { c = { sessionId: null, historico: [], rodando: false, proc: null, erro: null }; conversas.set(id, c); }
  return c;
}

function perguntar(id, texto, modo) {
  const s = lerRegistro()[id];
  if (!s) return { ok: false, motivo: 'sistema não está no registro' };
  if (!s.pasta) return { ok: false, motivo: 'esse sistema não tem pasta local para investigar' };
  if (!fs.existsSync(s.pasta)) return { ok: false, motivo: 'pasta não encontrada: ' + s.pasta };

  const c = conversaDe(id);
  if (c.rodando) return { ok: false, motivo: 'ele ainda está respondendo a anterior' };

  // -p sem valor lê o prompt da entrada padrão: a pergunta nunca passa
  // pela linha de comando, então não precisa de escape nenhum
  const args = ['-p', '--output-format', 'json',
                '--permission-mode', modo === 'resolver' ? 'acceptEdits' : 'plan',
                '--append-system-prompt', PAPEL];
  if (c.sessionId) args.push('--resume', c.sessionId);

  c.rodando = true; c.erro = null;
  c.historico.push({ quem: 'voce', texto, quando: Date.now() });

  let saida = '', erroSaida = '';
  const proc = spawn(CLAUDE_BIN, args, {
    cwd: s.pasta,
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  c.proc = proc;
  proc.stdin.on('error', () => { /* processo caiu antes de ler */ });
  proc.stdin.end(texto, 'utf8');

  const prazo = setTimeout(() => {
    try { proc.kill(); } catch (e) { /* já morreu */ }
    c.erro = 'demorou demais e foi interrompido';
  }, LIMITE_CONVERSA);

  proc.stdout.on('data', d => { saida += d; });
  proc.stderr.on('data', d => { erroSaida += d; });
  proc.on('error', e => { c.erro = 'não consegui executar o claude: ' + e.message; });
  proc.on('exit', () => {
    clearTimeout(prazo);
    c.rodando = false; c.proc = null;
    let j = null;
    try { j = JSON.parse(saida); } catch (e) { /* saída não era JSON */ }

    if (j && j.session_id) c.sessionId = j.session_id;
    const resposta = j ? String(j.result || '') : (saida || erroSaida || '(sem resposta)');

    if (/not logged in|please run \/login/i.test(resposta)) {
      c.precisaLogin = true;
      loginCache = { quando: 0, dados: null };
      c.erro = 'O Claude Code não está autenticado nesta máquina.';
      c.sessionId = null;
      return;
    }
    c.precisaLogin = false;
    c.historico.push({
      quem: 'agente', texto: resposta, quando: Date.now(),
      modo, custo: j ? j.total_cost_usd : null, erro: j ? !!j.is_error : false
    });
    if (c.historico.length > 40) c.historico.splice(0, c.historico.length - 40);
  });

  console.log(`  💬 ${id}: "${texto.slice(0, 60)}" (${modo})`);
  return { ok: true };
}

function estadoConversa(id) {
  const c = conversaDe(id);
  return {
    rodando: c.rodando, erro: c.erro, precisaLogin: !!c.precisaLogin,
    temSessao: !!c.sessionId, historico: c.historico
  };
}

function esquecerConversa(id) {
  const c = conversaDe(id);
  if (c.proc) { try { c.proc.kill(); } catch (e) { /* já morreu */ } }
  conversas.set(id, { sessionId: null, historico: [], rodando: false, proc: null, erro: null });
  return { ok: true };
}

/* ---------------- login do Claude Code ---------------- */
let loginCache = { quando: 0, dados: null };
function estadoClaude() {
  // a checagem custa um processo; 30s de cache já evita repetir à toa
  if (Date.now() - loginCache.quando < 30000 && loginCache.dados) {
    return Promise.resolve(loginCache.dados);
  }
  return new Promise(res => {
    let saida = '';
    let p;
    try {
      p = spawn(CLAUDE_BIN, ['auth', 'status'], { stdio: ['ignore', 'pipe', 'ignore'] });
    } catch (e) {
      return res({ instalado: false, conectado: false });
    }
    const prazo = setTimeout(() => { try { p.kill(); } catch (e) {} }, 8000);
    p.stdout.on('data', d => { saida += d; });
    p.on('error', () => { clearTimeout(prazo); res({ instalado: false, conectado: false }); });
    p.on('exit', () => {
      clearTimeout(prazo);
      let j = null;
      try { j = JSON.parse(saida); } catch (e) { /* saída inesperada */ }
      const dados = {
        instalado: !!j,
        conectado: !!(j && j.loggedIn),
        metodo: j ? j.authMethod : null
      };
      loginCache = { quando: Date.now(), dados };
      res(dados);
    });
  });
}

/* ---------------- HTTP ---------------- */
function json(res, code, dados) {
  const corpo = JSON.stringify(dados);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(corpo);
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const rota = decodeURIComponent(url.pathname);

  /* Só o próprio escritório, aberto nesta máquina, fala com ele.
     O Host barra DNS rebinding (um site cujo domínio aponta para 127.0.0.1);
     o Origin barra outro site aberto no navegador mandando POST para cá, o
     que bastaria para ligar ou cadastrar um sistema sem você saber. */
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(req.headers.host || '')) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }).end('host não permitido');
    return;
  }
  if (req.method !== 'GET' && req.headers.origin &&
      !new RegExp('^http://(localhost|127\\.0\\.0\\.1|\\[::1\\]):' + PORT + '$', 'i').test(req.headers.origin)) {
    return json(res, 403, { ok: false, motivo: 'origem não permitida' });
  }

  /* configuração pública para a tela: nome, dono, reunião (sem segredo) */
  if (rota === '/config.js') {
    const c = lerConfig();
    const pub = { nome: c.nome, subtitulo: c.subtitulo, dono: c.dono, empresa: c.empresa };
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end('window.ESCRITORIO = ' + JSON.stringify(pub) + ';\n');
    return;
  }

  /* ---- API ---- */
  if (rota === '/api/avisos' && req.method === 'GET') return json(res, 200, AVISOS.publico());
  if (rota === '/api/avisos/resumo' && req.method === 'GET')
    return AVISOS.montarResumo().then(l => json(res, 200, { linhas: l }));
  if ((rota === '/api/avisos' && req.method === 'PUT') ||
      (rota === '/api/avisos/testar' && req.method === 'POST') ||
      (rota === '/api/avisar' && req.method === 'POST')) {
    let bruto = '';
    req.on('data', c => { bruto += c; if (bruto.length > 1e5) req.destroy(); });
    req.on('end', async () => {
      let corpo = {};
      try { corpo = bruto ? JSON.parse(bruto) : {}; } catch (e) { return json(res, 400, { ok: false, motivo: 'json inválido' }); }
      if (rota === '/api/avisos') { AVISOS.configurar(corpo); return json(res, 200, AVISOS.publico()); }
      if (rota === '/api/avisos/testar')
        return json(res, 200, { ok: true, res: await AVISOS.avisar(lerConfig().nome, 'Teste de aviso. Se isto chegou no seu celular, está funcionando.', 'normal', true) });
      // /api/avisar: seus sistemas pedem para te chamar (POST do servidor deles)
      const r = await AVISOS.avisar(String(corpo.titulo || lerConfig().nome).slice(0, 80), String(corpo.texto || '').slice(0, 600),
                                    corpo.prioridade === 'alta' ? 'alta' : 'normal');
      return json(res, 200, { ok: true, res: r });
    });
    return;
  }
  if (rota === '/api/agenda' && req.method === 'GET') {
    return json(res, 200, { itens: lerAgenda() });
  }
  if (rota === '/api/reuniao' && req.method === 'GET') {
    return json(res, 200, REUNIAO.estadoAtual(equipeDoDisco()));
  }
  if (rota === '/api/reuniao/historico' && req.method === 'GET') {
    return json(res, 200, { dias: REUNIAO.historico() });
  }
  if (rota === '/api/reuniao/ata' && req.method === 'GET') {
    const dia = url.searchParams.get('dia');
    return json(res, 200, REUNIAO.lerAta(dia) || { erro: 'sem ata nesse dia' });
  }
  if (rota === '/api/reuniao/placar' && req.method === 'GET') {
    return REUNIAO.placar().then(p => json(res, 200, p));
  }
  if (rota === '/api/reuniao/iniciar' && req.method === 'POST') {
    const equipe = equipeDoDisco();
    // dispara e responde na hora: a reunião leva minutos, o navegador
    // acompanha pelo GET /api/reuniao
    /* rodar() recusa (sem participante, já rodando) ANTES do primeiro await,
       então a promessa resolve na hora nesse caso. Se em 1,5s ela não voltou,
       é porque a reunião começou de verdade. Antes eu respondia ok sempre e a
       recusa sumia sem deixar rastro na tela. */
    const p = REUNIAO.rodar(equipe);
    p.catch(e => console.error('  reunião falhou:', e && e.message));
    const marca = { __comecou: true };
    return Promise.race([p, new Promise(r => setTimeout(() => r(marca), 1500))])
      .then(r => json(res, 200, r === marca ? { ok: true, iniciada: true } : r))
      .catch(e => json(res, 500, { ok: false, motivo: String(e && e.message || e) }));
  }
  if (rota === '/api/reuniao/parar' && req.method === 'POST') {
    return json(res, 200, REUNIAO.parar());
  }

  if (rota === '/api/claude' && req.method === 'GET') {
    return json(res, 200, await estadoClaude());
  }
  /* A equipe mora aqui, não no navegador. Ver o comentário em roster.js:
     o localStorage já apagou o quadro inteiro uma vez. */
  if (rota === '/api/equipe' && req.method === 'GET') {
    try { return json(res, 200, JSON.parse(fs.readFileSync(EQUIPE, 'utf8'))); }
    catch (e) { return json(res, 200, { team: [] }); }
  }
  if (rota === '/api/equipe' && req.method === 'PUT') {
    let bruto = '';
    req.on('data', c => { bruto += c; if (bruto.length > 4e6) req.destroy(); });
    req.on('end', () => {
      let d;
      try { d = JSON.parse(bruto); } catch (e) { return json(res, 400, { ok: false, motivo: 'json inválido' }); }
      if (!d || !Array.isArray(d.team)) return json(res, 400, { ok: false, motivo: 'sem equipe no corpo' });
      // nunca sobrescreve um quadro cheio com um vazio: se o navegador
      // perder o storage e mandar lista vazia, o disco é o que salva
      if (!d.team.length) {
        try {
          const atual = JSON.parse(fs.readFileSync(EQUIPE, 'utf8'));
          if (atual && atual.team && atual.team.length)
            return json(res, 409, { ok: false, motivo: 'recusei apagar a equipe do disco com uma lista vazia' });
        } catch (e) { /* não havia nada mesmo */ }
      }
      try {
        fs.mkdirSync(path.dirname(EQUIPE), { recursive: true });
        if (fs.existsSync(EQUIPE)) fs.copyFileSync(EQUIPE, EQUIPE_BAK);
        fs.writeFileSync(EQUIPE, JSON.stringify({ team: d.team, v: 1 }, null, 2));
      } catch (e) { return json(res, 500, { ok: false, motivo: e.message }); }
      json(res, 200, { ok: true, n: d.team.length });
    });
    return;
  }

  if (rota === '/api/sistemas' && req.method === 'GET') {
    return json(res, 200, await estado());
  }
  if (rota === '/api/sistemas' && req.method === 'POST') {
    let bruto = '';
    req.on('data', c => { bruto += c; if (bruto.length > 2e4) req.destroy(); });
    req.on('end', () => {
      let b;
      try { b = JSON.parse(bruto || '{}'); } catch (e) { return json(res, 400, { ok: false, motivo: 'json inválido' }); }
      try { json(res, 200, novoSistema(b)); } catch (e) { json(res, 500, { ok: false, motivo: e.message }); }
    });
    return;
  }
  const md = rota.match(/^\/api\/sistemas\/([a-z0-9_-]+)$/i);
  if (md && req.method === 'DELETE') return json(res, 200, tirarSistema(md[1]));
  const m = rota.match(/^\/api\/sistemas\/([a-z0-9_-]+)\/(ligar|desligar|log)$/i);
  if (m) {
    const [, id, acao] = m;
    if (acao === 'log') {
      const p = vivos.get(id);
      const arq = (p && p.arquivo) || path.join(LOGS, id + '.log');
      return json(res, 200, { linhas: tail(arq, Number(url.searchParams.get('n') || 120)) });
    }
    if (req.method !== 'POST') return json(res, 405, { ok: false, motivo: 'use POST' });
    return json(res, 200, acao === 'ligar' ? await ligar(id) : desligar(id));
  }
  const mc = rota.match(/^\/api\/agentes\/([a-z0-9_-]+)\/(chat|limpar)$/i);
  if (mc) {
    const [, id, acao] = mc;
    if (acao === 'limpar') return json(res, 200, esquecerConversa(id));
    if (req.method === 'GET') return json(res, 200, estadoConversa(id));
    let corpo = '';
    req.on('data', d => { corpo += d; if (corpo.length > 20000) req.destroy(); });
    req.on('end', () => {
      let b = {};
      try { b = JSON.parse(corpo || '{}'); } catch (e) { /* corpo inválido */ }
      const texto = String(b.texto || '').trim();
      if (!texto) return json(res, 400, { ok: false, motivo: 'pergunta vazia' });
      json(res, 200, perguntar(id, texto, b.modo === 'resolver' ? 'resolver' : 'investigar'));
    });
    return;
  }
  if (rota.startsWith('/api/')) return json(res, 404, { ok: false, motivo: 'rota não existe' });

  /* ---- estáticos ---- */
  const rel = rota === '/' ? '/index.html' : rota;
  if (!/^\/(index\.html|favicon\.svg|css\/|js\/)/.test(rel)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404'); return;
  }
  const arquivo = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!arquivo.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }

  fs.readFile(arquivo, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404'); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(arquivo).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(buf);
  });
});

/* derruba tudo que subimos quando o servidor morre */
/* O escritório sai; os sistemas ficam.

   Aqui antes havia um encerrarTudo() que derrubava todos os sistemas junto
   com o servidor. Quem estava no meio de um trabalho dentro de um painel
   perdia tudo só porque o escritório reiniciou. Agora a saída é limpa: os
   filhos são destacados e continuam de pé; ao voltar, o escritório lê
   data/vivos.json e reencontra cada um. Para derrubar um sistema, existe
   o botão Desligar — que é uma ordem, não um efeito colateral. */
function sairSemDerrubar() {
  gravarVivos();
  console.log('\n  escritório saindo — os sistemas continuam de pé\n');
  process.exit(0);
}
process.on('SIGINT', sairSemDerrubar);
process.on('SIGTERM', sairSemDerrubar);
// uma falha não prevista não pode virar apagão: registra e segue
process.on('uncaughtException', e => console.error('  erro não tratado:', e && e.stack || e));
process.on('unhandledRejection', e => console.error('  promessa rejeitada:', e && e.stack || e));

/* ===========================================================
   VIGIA — quem caiu sem ordem, levanta

   Os sistemas que sobem por npm (arquivo em lote do Windows) ainda levam um
   Ctrl+C de vez em quando — o log mostra "Deseja finalizar o arquivo em
   lotes (S/N)?" — e caem. De onde vem o sinal não ficou provado. O que está
   provado é o efeito, e é o efeito que importa para quem está trabalhando.

   Então: todo sistema LIGADO pelo escritório entra em data/desejados.json;
   DESLIGAR tira de lá. De minuto em minuto, quem é desejado e não responde
   na porta é religado. Três tentativas a cada 15 minutos por sistema, para
   um sistema quebrado de verdade não ficar em laço.
   =========================================================== */
const DESEJADOS = path.join(ROOT, 'data', 'desejados.json');
const lerDesejados = () => { try { return new Set(JSON.parse(fs.readFileSync(DESEJADOS, 'utf8'))); } catch (e) { return new Set(); } };
const gravarDesejados = (d) => { try { fs.writeFileSync(DESEJADOS, JSON.stringify([...d], null, 2) + '\n'); } catch (e) {} };
function quero(id, sim) { const d = lerDesejados(); if (sim) d.add(id); else d.delete(id); gravarDesejados(d); }

const tentativas = new Map();     // id -> [instantes das últimas tentativas]
let vigiando = false;
async function vigiar() {
  if (vigiando) return;
  vigiando = true;
  try {
    const reg = lerRegistro();
    for (const id of lerDesejados()) {
      const s = reg[id];
      if (!s || s.tipo !== 'local') continue;
      const p = vivos.get(id);
      if (p && !p.encerrado && Date.now() - p.desde < 120000) continue;   // ainda subindo
      let vivo = false;
      for (const porta of portasDe(id, s)) { if (await portaViva(porta)) { vivo = true; break; } }
      if (vivo) continue;
      const t = (tentativas.get(id) || []).filter(x => Date.now() - x < 15 * 60000);
      if (t.length >= 3) {
        if (!t.avisado) {
          t.avisado = true;
          AVISOS.avisar('Sistema fora do ar', (s.nome || id) + ' caiu três vezes em 15 minutos e o vigia parou de tentar. Veja o log dele no escritório.', 'alta').catch(() => {});
        }
        continue;
      }
      t.push(Date.now()); tentativas.set(id, t);
      vivos.delete(id);
      console.log('  vigia: ' + id + ' caiu sem ordem — religando (' + t.length + '/3)');
      try { fs.appendFileSync(path.join(LOGS, id + '.log'), '— vigia: caiu sem ordem, religando (' + t.length + '/3) —\n'); } catch (e) {}
      await ligarDeFato(id);
    }
  } catch (e) { /* o vigia nunca derruba o escritório */ }
  vigiando = false;
}
setInterval(vigiar, 60000);

/* ===========================================================
   AGENDA — ações com data marcada

   Coisas que você decidiu fazer num dia certo e que não podem depender de
   alguém lembrar, como ligar um sistema na segunda às 8h. Exemplo:
     [{ "id": "liga-crm", "quando": "2026-10-01T08:00", "acao": "ligar",
        "sistema": "exemplo", "descricao": "Liga o exemplo" }]
   Fica em data/agenda.json; o escritório confere de minuto em minuto e
   registra o resultado de cada ação lá mesmo.

   Se o escritório estiver fora do ar na hora, a ação roda quando ele voltar
   — atrasada, mas roda. O que não acontece é rodar duas vezes.
   =========================================================== */
const AGENDA = path.join(ROOT, 'data', 'agenda.json');
const lerAgenda = () => { try { return JSON.parse(fs.readFileSync(AGENDA, 'utf8')); } catch (e) { return []; } };
const gravarAgenda = (a) => { try { fs.writeFileSync(AGENDA, JSON.stringify(a, null, 2) + '\n'); } catch (e) {} };
const esperar = (ms) => new Promise(r => setTimeout(r, ms));

const ACOES = {
  async 'ligar'(item) {
    const r = await ligar(item.sistema);
    if (!r.ok) throw new Error(r.motivo || 'não ligou');
    return item.sistema + ' ligado';
  },
  async 'desligar'(item) {
    desligar(item.sistema);
    return item.sistema + ' desligado';
  }
};

let agendaOcupada = false;
async function conferirAgenda() {
  if (agendaOcupada) return;
  const itens = lerAgenda();
  const agora = Date.now();
  const vez = itens.find(i => !i.feito && !i.executando && new Date(i.quando).getTime() <= agora);
  if (!vez) return;
  agendaOcupada = true;
  vez.executando = true; gravarAgenda(itens);
  console.log('  agenda: ' + vez.id + ' (' + vez.acao + ')');
  try {
    const f = ACOES[vez.acao];
    if (!f) throw new Error('ação desconhecida: ' + vez.acao);
    vez.resultado = await f(vez);
    vez.ok = true;
  } catch (e) {
    vez.ok = false;
    vez.resultado = String(e && e.message || e);
    console.error('  agenda falhou: ' + vez.resultado);
  }
  vez.feito = new Date().toISOString();
  delete vez.executando;
  gravarAgenda(itens);
  AVISOS.avisar(vez.ok ? 'Agenda cumprida' : 'Agenda falhou',
    (vez.descricao || vez.acao) + (vez.ok ? '' : '\nMotivo: ' + String(vez.resultado).slice(0, 300)),
    vez.ok ? 'normal' : 'alta').catch(() => {});
  agendaOcupada = false;
}
setInterval(() => { conferirAgenda().catch(() => { agendaOcupada = false; }); }, 60000);

readotarVivos();   // reencontra o que ficou de pé do reinício anterior
servidor.listen(PORT, '127.0.0.1', () => {
  const n = Object.keys(lerRegistro()).length;
  console.log(`\n  ${lerConfig().nome.toUpperCase()} -> http://localhost:${PORT}`);
  console.log(`  ${n} sistemas no registro (data/sistemas.json)\n`);
});
