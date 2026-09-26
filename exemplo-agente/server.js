/* ===========================================================
   Agente de exemplo — o menor sistema que o escritório sabe operar.

   O escritório sobe este arquivo com PORT=4401 (veja data/sistemas.json),
   embute a página no monitor do agente e, em "Conversar", abre o Claude
   Code dentro desta pasta. Troque por qualquer coisa que responda HTTP
   numa porta: Next, Vite, Express, Flask, um painel qualquer.
   =========================================================== */
const http = require('http');

const PORT = Number(process.env.PORT) || 4401;
const inicio = Date.now();
let visitas = 0;

const pagina = () => `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Agente de exemplo</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0c0e16;color:#e8ecf7;
       font:15px/1.6 system-ui,sans-serif}
  .card{max-width:520px;padding:28px 32px;border:1px solid #222941;border-radius:14px;background:#0f1220}
  h1{margin:0 0 6px;font-size:22px} .dim{color:#8b93ad}
  code{background:#151a2c;padding:2px 6px;border-radius:6px}
  .kpis{display:flex;gap:12px;margin:18px 0}
  .kpis div{flex:1;background:#151a2c;border-radius:10px;padding:10px 12px}
  .kpis b{display:block;font-size:22px;color:#38bdf8}
</style></head><body><div class="card">
  <h1>🤖 Agente de exemplo</h1>
  <p class="dim">Este é o sistema do agente. Ele está rodando na porta <code>${PORT}</code> e o escritório o mostra aqui dentro.</p>
  <div class="kpis">
    <div><b>${Math.floor((Date.now() - inicio) / 60000)} min</b>no ar</div>
    <div><b>${visitas}</b>visitas</div>
  </div>
  <p>Para colocar o <b>seu</b> agente:</p>
  <ol>
    <li>Na aba <b>Contratar</b>, clique em <b>+ Cadastrar agente</b>.</li>
    <li>Escolha <b>Roda nesta máquina</b>, aponte a pasta do projeto, o comando (<code>npm</code>, <code>run dev</code>) e a porta.</li>
    <li>Clique no computador dele: o escritório liga o sistema e abre aqui.</li>
  </ol>
</div></body></html>`;

http.createServer((req, res) => {
  if (req.url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, noArDesde: new Date(inicio).toISOString(), visitas }));
  }
  visitas++;
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(pagina());
}).listen(PORT, '127.0.0.1', () => console.log(`Agente de exemplo -> http://localhost:${PORT}`));
