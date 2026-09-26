/* ===========================================================
   roster.js — quem trabalha aqui.
   BOSSES  : você (sempre em serviço, na Diretoria)
   CATALOG : o agente de exemplo + vagas sugeridas para começar
   =========================================================== */
const ROSTER = (() => {

  const KEY = 'escritorio-agentes-v1';

  /* ===========================================================
     O DONO — o nome vem de data/config.json ("dono")
     =========================================================== */
  const BOSSES = [
    {
      id: 'boss-1', name: (window.ESCRITORIO && ESCRITORIO.dono) || 'Você', role: 'Dono · Diretoria',
      emoji: '⭐', boss: true, dept: 'diretoria', slotId: 'DIR-1',
      status: 'trabalhando', locked: true,
      source: 'Diretoria', sistema: null,
      brief: 'Quem manda aqui. Sempre em serviço.',
      look: {
        skin: '#d9a17a', hair: '#2a1d14', style: 'curto',
        shirt: '#334155', pants: '#1e293b', shoes: '#15181f',
        glasses: null, beard: null, tattoo: false, cap: false,
        uniforme: false
      }
    }
  ];

  /* ===========================================================
     BANCO DE TALENTOS
     'detectado' = tem sistema no registro (data/sistemas.json)
     'sugerido'  = vaga de ideia; contrate e depois ligue um sistema a ela
     =========================================================== */
  const CATALOG = [
    {
      key: 'exemplo', name: 'EXEMPLO', role: 'Agente de demonstração', emoji: '🤖',
      cat: 'detectado', system: 'Agente de exemplo', sistema: 'exemplo',
      desc: 'Um sistema mínimo que vem junto, na pasta exemplo-agente: sobe na porta 4401 e mostra uma página.',
      why: 'Serve de molde. Clique no computador dele para ver o escritório ligar, embutir e conversar com um sistema. Depois cadastre os seus.',
      look: { skin: '#c9854f', hair: '#140f0c', style: 'cacheado', shirt: '#38bdf8', pants: '#26304a', glasses: null, beard: null }
    },
    {
      key: 'sdr', name: 'Léo', role: 'Prospecção & SDR', emoji: '🎯', cat: 'sugerido',
      desc: 'Encontra clientes em potencial, qualifica e prepara a primeira abordagem.',
      why: 'É o topo do funil: sem entrada de oportunidade nova, o resto da equipe fica sem trabalho.',
      look: { skin: '#f0c29b', hair: '#241a13', style: 'fade', shirt: '#6366f1', pants: '#1b2030', glasses: null, beard: 'cavanhaque' }
    },
    {
      key: 'atendimento', name: 'Bia', role: 'Atendimento & Suporte', emoji: '🎧', cat: 'sugerido',
      desc: 'Responde dúvidas, resolve problemas e encaminha o que precisa de gente.',
      why: 'Resposta rápida segura cliente. Um agente de primeira linha tira o volume repetitivo de você.',
      look: { skin: '#7a4a2c', hair: '#140f0c', style: 'coque', shirt: '#14b8a6', pants: '#1b2030', glasses: 'redondo', beard: null }
    },
    {
      key: 'conteudo', name: 'Nico', role: 'Conteúdo & Redes Sociais', emoji: '📱', cat: 'sugerido',
      desc: 'Planeja o calendário, escreve legendas e acompanha o que funcionou.',
      why: 'Constância nas redes custa tempo. Com pauta e rascunho prontos, você só aprova.',
      look: { skin: '#e0a878', hair: '#5a3a22', style: 'longo', shirt: '#f472b6', pants: '#26304a', glasses: null, beard: null }
    },
    {
      key: 'copy', name: 'Duda', role: 'Copywriter', emoji: '✍️', cat: 'sugerido',
      desc: 'Escreve anúncios, páginas e e-mails e testa variações.',
      why: 'Texto é o que converte. Ter variações prontas acelera qualquer teste.',
      look: { skin: '#f7d7bd', hair: '#8b5a2b', style: 'curto', shirt: '#f59e0b', pants: '#1b2030', glasses: 'retangular', beard: null }
    },
    {
      key: 'financeiro', name: 'Rafa', role: 'Financeiro', emoji: '🧾', cat: 'sugerido',
      desc: 'Acompanha entradas, saídas e o caixa, e avisa quando algo foge do previsto.',
      why: 'Número do caixa em dia evita surpresa e mostra o que dá para investir.',
      look: { skin: '#c9854f', hair: '#1a120d', style: 'curto', shirt: '#22c55e', pants: '#26304a', glasses: 'retangular', beard: 'cheia' }
    },
    {
      key: 'dados', name: 'Cami', role: 'Dados & Relatórios', emoji: '🧮', cat: 'sugerido',
      desc: 'Junta os números dos outros sistemas num painel e explica o que mudou.',
      why: 'Com vários agentes trabalhando, alguém precisa olhar o todo e dizer o que está funcionando.',
      look: { skin: '#f0c29b', hair: '#140f0c', style: 'longo', shirt: '#8b5cf6', pants: '#1b2030', glasses: 'redondo', beard: null }
    },
    {
      key: 'qa', name: 'Dan', role: 'QA de Sistemas', emoji: '🧪', cat: 'sugerido',
      desc: 'Roda build, typecheck e teste antes de qualquer deploy dos outros agentes.',
      why: 'Com vários agentes mexendo em código, alguém precisa ser o freio antes de subir para produção.',
      look: { skin: '#f7d7bd', hair: '#8e8e93', style: 'curto', shirt: '#0ea5e9', pants: '#26304a', glasses: 'redondo', beard: null }
    }
  ];

  /* ===========================================================
     ESTADO
     =========================================================== */
  let team = [];

  function defaults() {
    const base = BOSSES.map(b => Object.assign({}, b, { look: Object.assign({}, b.look) }));
    // começa só com o agente de exemplo, para mostrar como funciona
    for (const k of ['exemplo']) {
      const c = CATALOG.find(c => c.key === k);
      base.push(fromCatalog(c));
    }
    return base;
  }

  function fromCatalog(c) {
    return {
      id: 'ag-' + c.key,
      key: c.key,
      name: c.name,
      role: c.role,
      emoji: c.emoji,
      system: c.system || null,
      sistema: c.sistema || null,
      path: c.path || null,
      brief: c.desc,
      dept: 'servico',
      slotId: null,
      status: 'trabalhando',
      boss: false,
      locked: false,
      look: AVATAR.makeLook(c.key, c.look)
    };
  }

  /* ===========================================================
     PERSISTÊNCIA

     O disco manda. A equipe já morava só no localStorage do navegador
     e um dia voltou inteira ao padrão: nome que você deu, contratação,
     estação, horário — tudo perdido de uma vez, sem aviso. O navegador
     limpa storage quando quer. Agora o arquivo é data/equipe.json, no
     servidor, e o localStorage é só um espelho para quando ele estiver
     fora do ar.
     =========================================================== */
  const doLocal = () => {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      return d && Array.isArray(d.team) && d.team.length ? d.team : null;
    } catch (e) { return null; }
  };

  async function load() {
    let vindoDoDisco = null;
    try {
      const d = await (await fetch('/api/equipe')).json();
      if (d && Array.isArray(d.team) && d.team.length) vindoDoDisco = d.team;
    } catch (e) { /* servidor fora: vale o que o navegador tiver */ }

    team = vindoDoDisco || doLocal() || defaults();
    recompor();              // equipe salva antes pode não ter os campos novos
    if (!vindoDoDisco) save();   // primeira vez ou migração: carimba no disco
  }

  /** reencaixa campos que chegaram depois de a equipe já ter sido salva,
      como o id do sistema que o agente opera */
  function recompor() {
    for (const a of team) {
      const c = CATALOG.find(c => c.key === a.key);
      if (c) {
        if (!a.sistema && c.sistema) a.sistema = c.sistema;
        if (c.path && a.path !== c.path) a.path = c.path;
      }
      const b = BOSSES.find(b => b.id === a.id);
      if (b && !a.sistema && b.sistema) a.sistema = b.sistema;
      // sem look o boneco não é desenhado: fica um funcionário invisível na
      // mesa. Reconstrói a partir da key, que é determinística — o mesmo
      // agente volta com a mesma cara de sempre.
      if (!a.look || !a.look.skin) {
        const base = (c && c.look) || (b && b.look) || {};
        a.look = AVATAR.makeLook(a.key || a.id, Object.assign({}, base));
      }
    }
  }

  let gravando = null;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ team, v: 1 })); }
    catch (e) { /* storage bloqueado: o disco ainda pega */ }
    // junta as chamadas seguidas num POST só — arrastar um agente dispara
    // save() várias vezes por segundo
    clearTimeout(gravando);
    gravando = setTimeout(() => {
      fetch('/api/equipe', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team, v: 1 })
      }).catch(() => { /* offline: fica o espelho do navegador */ });
    }, 300);
  }

  function reset() { team = defaults(); save(); }

  /* ---------- operações ---------- */
  function hire(key) {
    const c = CATALOG.find(c => c.key === key);
    if (!c || team.some(a => a.key === key)) return null;
    const a = fromCatalog(c);
    team.push(a); save();
    return a;
  }

  function hireCustom(data) {
    const key = 'custom-' + Date.now().toString(36);
    const a = {
      id: 'ag-' + key, key,
      name: data.name || 'Novo agente',
      role: data.role || 'Função a definir',
      emoji: data.emoji || '🤖',
      system: data.system || null, path: data.path || null,
      sistema: data.sistema || null, reuniao: data.reuniao !== false,
      brief: data.brief || '',
      dept: 'servico', slotId: null, status: 'trabalhando',
      boss: false, locked: false, custom: true,
      look: AVATAR.makeLook(key, data.look || {})
    };
    team.push(a); save();
    return a;
  }

  function fire(id) {
    const i = team.findIndex(a => a.id === id);
    if (i < 0 || team[i].locked) return false;
    team.splice(i, 1); save();
    return true;
  }

  const get = (id) => team.find(a => a.id === id);
  const all = () => team;
  const isHired = (key) => team.some(a => a.key === key);
  const count = (st) => team.filter(a => a.status === st).length;

  return { BOSSES, CATALOG, load, save, reset, hire, hireCustom, fire,
           get, all, isHired, count, fromCatalog };
})();
