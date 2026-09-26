/* ===========================================================
   reuniao.js — a reunião dos agentes

   Nos dias e na hora de data/config.json (reuniao.automatica: true), ou
   quando você clica em "Reunir agora", os agentes que têm um sistema LOCAL
   (com pasta) se juntam na mesa de reunião e conversam de verdade: cada um
   é uma sessão do Claude Code rodando dentro da pasta do sistema dele,
   lendo os dados reais do próprio projeto.

     1. RODADA 1 — cada um olha o que controla e traz um número, uma ação
        para os próximos dias e o que precisa de outro agente.
     2. RODADA 2 (opcional) — cada um lê os outros e reage.
     3. BRIEFING — uma última passada junta tudo num plano.

   Cada fala é uma chamada ao Claude, então a reunião consome a cota do seu
   plano (ou crédito da API). Por isso ela vem DESLIGADA no automático.

   O foco e a meta vêm de data/config.json (reuniao.foco e reuniao.meta).
   =========================================================== */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const NOMES_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
/* tudo da reunião vem da configuração, lida na hora: mudou o arquivo, vale na próxima */
const CFG = () => dep.config().reuniao;

let dep = null;           // { ROOT, lerRegistro, CLAUDE_BIN }
let estado = criarVazio();
let timer = null;

function criarVazio() {
  return {
    rodando: false, fase: 'parada', desde: null, ate: null,
    dia: null, participantes: [], falas: [], briefing: null,
    custo: 0, erro: null, cancelar: false
  };
}

/* ---------------- onde a ata fica ---------------- */
const pastaAtas = () => path.join(dep.ROOT, 'data', 'reunioes');
const arquivoDoDia = (dia) => path.join(pastaAtas(), dia + '.json');
const hojeISO = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
         '-' + String(d.getDate()).padStart(2, '0');
};

function gravarAta() {
  if (!estado.dia) return;
  try {
    fs.mkdirSync(pastaAtas(), { recursive: true });
    const { cancelar, ...limpo } = estado;
    fs.writeFileSync(arquivoDoDia(estado.dia), JSON.stringify(limpo, null, 2));
  } catch (e) { /* a ata é registro, não pode derrubar a reunião */ }
}

function lerAta(dia) {
  try { return JSON.parse(fs.readFileSync(arquivoDoDia(dia), 'utf8')); }
  catch (e) { return null; }
}

function historico(n = 30) {
  try {
    return fs.readdirSync(pastaAtas())
      .filter(f => f.endsWith('.json')).sort().reverse().slice(0, n)
      .map(f => {
        const a = lerAta(f.replace('.json', ''));
        return a && { dia: a.dia, custo: a.custo,
                      participantes: (a.participantes || []).length,
                      temBriefing: !!a.briefing };
      }).filter(Boolean);
  } catch (e) { return []; }
}

/* ---------------- a meta, de data/config.json ---------------- */
async function placar() {
  const m = CFG().meta || {};
  const alvo = +m.alvo || 0, feito = +m.feito || 0;
  const diasRestantes = m.ate ? Math.max(0, Math.ceil((new Date(m.ate + 'T23:59:59') - new Date()) / 86400000)) : null;
  const faltam = Math.max(0, alvo - feito);
  return { descricao: m.descricao || '', unidade: m.unidade || 'resultados', alvo, feito, faltam,
           ate: m.ate || null, diasRestantes, semMeta: !alvo,
           porSemana: diasRestantes ? faltam / diasRestantes * 7 : null };
}

/* ---------------- quem senta à mesa ---------------- */
/** entra quem tem sistema local (uma pasta para investigar) e não foi tirado da reunião */
function participantesDe(equipe) {
  const reg = dep.lerRegistro();
  const fora = [];
  const dentro = [];
  for (const a of equipe || []) {
    if (a.boss) continue;
    const s = a.sistema && reg[a.sistema];
    const motivo = a.reuniao === false ? 'tirado da reunião na ficha dele'
                 : !s ? 'sem sistema no registro'
                 : !s.pasta ? 'sem pasta para investigar'
                 : !fs.existsSync(s.pasta) ? 'pasta não existe' : null;
    if (motivo) { fora.push({ nome: a.name, motivo }); continue; }
    dentro.push({ id: a.sistema, nome: a.name, papel: a.role, pasta: s.pasta });
  }
  return { dentro, fora };
}

/* ---------------- falar com um agente ---------------- */
function perguntaAoAgente(pasta, prompt, papel, limiteMs) {
  return new Promise(resolve => {
    const args = ['-p', '--output-format', 'json',
                  '--permission-mode', 'plan',       // reunião é conversa, não obra
                  '--model', CFG().modelo || 'sonnet',                 // leve: reunião não pede o modelo mais caro
                  '--max-turns', String(4), // no máximo N consultas ao projeto
                  '--append-system-prompt', papel];
    const proc = spawn(dep.CLAUDE_BIN, args,
      { cwd: pasta, env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });

    let saida = '', erro = '';
    const corta = setTimeout(() => { try { proc.kill(); } catch (e) {} }, limiteMs);

    proc.stdin.on('error', () => {});
    proc.stdin.end(prompt, 'utf8');
    proc.stdout.on('data', d => saida += d);
    proc.stderr.on('data', d => erro += d);
    proc.on('error', e => { clearTimeout(corta); resolve({ texto: null, erro: e.message, custo: 0 }); });
    proc.on('exit', () => {
      clearTimeout(corta);
      let j = null;
      try { j = JSON.parse(saida); } catch (e) {}
      if (!j) return resolve({ texto: null, erro: (erro || saida || 'sem resposta').slice(0, 300), custo: 0 });
      resolve({ texto: String(j.result || '').trim(),
                custo: +j.total_cost_usd || 0,
                erro: j.is_error ? String(j.result || 'erro') : null });
    });
  });
}

const PAPEL_REUNIAO = () => {
  const c = dep.config();
  return 'Você participa da reunião dos agentes' + (c.empresa ? ' de ' + c.empresa : '') + '. ' +
    'Responda em português do Brasil, curto e concreto. Nada de introdução, nada de "como IA". ' +
    'Baseie o que disser nos dados REAIS do projeto em que você está: rode os scripts de diagnóstico, ' +
    'leia os logs e o banco antes de afirmar número. Se não tiver o dado, diga "não tenho esse número" ' +
    'em vez de estimar. Não altere nenhum arquivo: esta é uma reunião, não uma tarefa.';
};

function contexto(p) {
  const foco = CFG().foco || 'o que cada um pode melhorar no próprio sistema nos próximos dias';
  if (p.semMeta) return 'FOCO: ' + foco + '.';
  const ate = p.ate ? ' até ' + p.ate.split('-').reverse().join('/') : '';
  return `META: ${p.descricao ? p.descricao + ' — ' : ''}${p.alvo} ${p.unidade}${ate}.\n` +
         `HOJE: ${p.feito} feitos, faltam ${p.faltam}.\n` +
         (p.diasRestantes != null ? `PRAZO: ${p.diasRestantes} dias — ${p.porSemana.toFixed(1)} ${p.unidade} por semana.\n` : '') +
         'FOCO: ' + foco + '.';
}

/* ---------------- a reunião ---------------- */
function fala(quem, papel, texto, rodada, erro) {
  estado.falas.push({ quem, papel, texto: texto || null, erro: erro || null,
                      rodada, quando: Date.now() });
  gravarAta();
}

async function rodar(equipe, opcoes = {}) {
  if (estado.rodando) return { ok: false, motivo: 'a reunião já está acontecendo' };

  const { dentro, fora } = participantesDe(equipe);
  if (!dentro.length)
    return { ok: false, motivo: 'nenhum agente com sistema local (pasta) para investigar', fora };

  const fim = Date.now() + CFG().duracaoMin * 60000;
  const sobra = () => Math.max(0, fim - Date.now());

  estado = criarVazio();
  estado.rodando = true;
  estado.fase = 'rodada 1';
  estado.desde = Date.now();
  estado.ate = fim;
  estado.dia = hojeISO();
  estado.participantes = dentro.map(p => ({ id: p.id, nome: p.nome, papel: p.papel }));
  estado.foraDaMesa = fora;
  gravarAta();

  const p = await placar();
  estado.placar = p;
  const ctx = contexto(p);
  gravarAta();

  // ---- rodada 1: cada um traz o que sabe -------------------------------
  for (const ag of dentro) {
    if (estado.cancelar || sobra() < 45000) break;
    const prompt =
      `${ctx}\n\n` +
      `Você é ${ag.nome} (${ag.papel}), responsável por este projeto.\n\n` +
      `Consulte o projeto no máximo duas vezes. Responda em até 6 linhas, nesta ordem:\n` +
      `1. O número que você controla hoje (dado real do projeto; se não houver, diga).\n` +
      `2. A MELHORIA no seu próprio sistema que mais ajudaria na meta — uma só.\n` +
      `3. O que você precisa de outro agente ou do dono para isso (diga de quem).`;
    const r = await perguntaAoAgente(ag.pasta, prompt, PAPEL_REUNIAO(), Math.min(sobra(), 5 * 60000));
    estado.custo += r.custo;
    fala(ag.nome, ag.papel, r.texto, 1, r.erro);
  }

  // ---- rodada 2: cada um responde aos outros ---------------------------
  const resumo1 = estado.falas.filter(f => f.rodada === 1 && f.texto)
    .map(f => `### ${f.quem} (${f.papel})\n${f.texto}`).join('\n\n');

  // rodada 2 desligada por decisão do dono (economia de cota); liga só se pedirem
  if (opcoes.rodada2 === true && resumo1 && !estado.cancelar && sobra() > 60000) {
    estado.fase = 'rodada 2'; gravarAta();
    for (const ag of dentro) {
      if (estado.cancelar || sobra() < 45000) break;
      const outros = estado.falas.filter(f => f.rodada === 1 && f.texto && f.quem !== ag.nome)
        .map(f => `### ${f.quem}\n${f.texto}`).join('\n\n');
      if (!outros) continue;
      const prompt =
        `${ctx}\n\nNa primeira rodada, os outros times disseram:\n\n${outros}\n\n` +
        `Você é ${ag.nome}. Em no máximo 8 linhas:\n` +
        `1. O que muda no SEU plano depois de ler isso.\n` +
        `2. Onde você se encaixa com outro time (diga o nome de quem).\n` +
        `3. Com o que você se compromete ESTA SEMANA, com número.`;
      const r = await perguntaAoAgente(ag.pasta, prompt, PAPEL_REUNIAO(), Math.min(sobra(), 4 * 60000));
      estado.custo += r.custo;
      fala(ag.nome, ag.papel, r.texto, 2, r.erro);
    }
  }

  // ---- briefing: junta tudo em um plano do dia -------------------------
  estado.fase = 'briefing'; gravarAta();
  const tudo = estado.falas.filter(f => f.texto)
    .map(f => `### ${f.quem} — rodada ${f.rodada}\n${f.texto}`).join('\n\n');

  if (tudo && !estado.cancelar) {
    const prompt =
      `${ctx}\n\nEsta foi a reunião de hoje da equipe:\n\n${tudo}\n\n` +
      `Escreva o BRIEFING DO DIA para o dono da empresa ler em 1 minuto. Formato:\n\n` +
      `**ONDE ESTAMOS** — uma linha com o número e o ritmo necessário.\n` +
      `**AS 3 AÇÕES DE HOJE** — três itens, cada um começando pelo nome do responsável, ` +
      `com o que fazer e o número esperado. Escolha as três de maior impacto na meta, não as mais fáceis.\n` +
      `**TRAVA** — a única coisa que, se não for resolvida, derruba a semana.\n` +
      `**O DONO PRECISA DECIDIR** — o que depende dele e não dos agentes. Se não houver nada, escreva "nada hoje".\n\n` +
      `Sem enrolação, sem repetir o que já está escrito acima. Se os times se contradisseram, aponte.`;
    const r = await perguntaAoAgente(dep.ROOT, prompt, PAPEL_REUNIAO(), Math.min(sobra(), 5 * 60000));
    estado.custo += r.custo;
    estado.briefing = r.texto;
    if (r.erro) estado.erro = r.erro;
  }

  estado.rodando = false;
  estado.fase = estado.cancelar ? 'interrompida' : 'encerrada';
  estado.fim = Date.now();
  gravarAta();
  if (dep.avisar && estado.briefing)
    dep.avisar('Reunião encerrada', 'O briefing de hoje está pronto na mesa de reunião do escritório.');
  return { ok: true };
}

/* ---------------- agenda ---------------- */
function proximaReuniao() {
  const d = new Date();
  const alvo = new Date(d);
  alvo.setHours(CFG().hora, CFG().minuto, 0, 0);
  if (alvo <= d) alvo.setDate(alvo.getDate() + 1);
  for (let i = 0; i < 8 && !CFG().dias.includes(alvo.getDay()); i++) alvo.setDate(alvo.getDate() + 1);
  return alvo.getTime();
}

/** true quando estamos dentro da janela e o dia ainda não teve reunião */
function deveRodarAgora() {
  const d = new Date();
  if (!CFG().automatica || !CFG().dias.includes(d.getDay())) return false;
  const dentroDaJanela = d.getHours() === CFG().hora && d.getMinutes() >= CFG().minuto && d.getMinutes() < CFG().minuto + 5;
  if (!dentroDaJanela) return false;
  const ata = lerAta(hojeISO());
  return !ata;   // já rodou hoje? não repete
}

function agendar(pegarEquipe) {
  clearInterval(timer);
  // confere de minuto em minuto: mais simples e mais robusto que um
  // setTimeout longo, que se perde se a máquina dormir
  timer = setInterval(() => {
    if (estado.rodando) return;
    if (!deveRodarAgora()) return;
    const equipe = pegarEquipe();
    if (!equipe || !equipe.length) return;
    console.log('  reunião das ' + CFG().hora + 'h começando');
    rodar(equipe).catch(e => { estado.rodando = false; estado.erro = e.message; });
  }, 60000);
}

module.exports = {
  init(d) { dep = d; return module.exports; },
  agendar,
  rodar,
  parar() { estado.cancelar = true; return { ok: true }; },
  estadoAtual(equipe) {
    const prev = participantesDe(equipe || []);
    return {
      ...estado, cancelar: undefined,
      proxima: CFG().automatica ? proximaReuniao() : null,
      hora: String(CFG().hora).padStart(2, '0') + ':' + String(CFG().minuto).padStart(2, '0'),
      dias: CFG().dias.map(d => NOMES_DIA[d]),
      duracao: CFG().duracaoMin,
      meta: CFG().meta,
      convocados: prev.dentro.map(p => ({ id: p.id, nome: p.nome, papel: p.papel })),
      foraDaMesa: prev.fora,
      ataDeHoje: estado.dia === hojeISO() ? null : lerAta(hojeISO())
    };
  },
  historico, lerAta, placar
};
