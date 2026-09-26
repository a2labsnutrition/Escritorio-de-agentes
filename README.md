# Escritório de Agentes

Um escritório isométrico no navegador, estilo Habbo, para acompanhar e operar
os seus agentes de IA. Cada agente é um boneco com mesa e computador próprios;
clicar no computador dele abre o **sistema daquele agente** ali dentro, com
botões para ligar, desligar, ver o log e conversar com ele pelo Claude Code.

- Diretoria, sala de serviço com 18 estações, lounge, sala de reunião e recepção.
- Os bonecos trabalham na própria mesa, descansam no lounge no horário que você
  definir e se juntam na sala de reunião quando há reunião.
- O escritório sobe os sistemas locais, vigia quem caiu e religa sozinho.
- Nenhuma dependência: só Node.js.

## Começar

Precisa do [Node.js](https://nodejs.org) 18 ou mais novo.

```bash
git clone <url-deste-repositório> escritorio-de-agentes
cd escritorio-de-agentes
npm start
```

Abra **http://localhost:4321**. Vem um agente de exemplo (pasta
`exemplo-agente`): clique no computador dele e em **Ligar** para ver o fluxo
completo.

No Windows:
- **`INICIAR ESCRITORIO.cmd`** sobe o escritório e o religa se ele cair.
- **`CRIAR ATALHO.ps1`** cria um atalho na área de trabalho. Para rodar: botão
  direito no arquivo e depois **Executar com o PowerShell**. O atalho liga o
  escritório, se estiver desligado, e abre o navegador.

## Colocar os seus agentes

Na aba **Contratar**, clique em **+ Cadastrar agente** e escolha:

| Sistema do agente | O que preencher |
| --- | --- |
| **Roda nesta máquina** | pasta do projeto, comando (`npm`, `node`, `python`…), argumentos (`run dev`) e uma porta livre |
| **Site / URL** | o endereço. Se o site recusar abrir em iframe, marque "usar o espelho" |
| **Nenhum** | só o boneco, sem sistema |

O escritório sobe o sistema local com a variável `PORT` igual à porta
informada. Se o seu projeto escolhe a porta de outro jeito, passe nos
argumentos (ex.: `run dev -- --port 4402`).

Tudo fica em `data/sistemas.json`, que também pode ser editado à mão. Os campos
estão explicados no topo de `data/sistemas.exemplo.json`.

Por segurança, o escritório escuta só em `127.0.0.1`, executa só o que está no
registro e recusa comando com `& | ; < > $` e crase. Ele também ignora pedido
vindo de outro site aberto no navegador.

## Conversar com um agente

No monitor, **💬 Conversar** abre uma sessão do [Claude Code](https://claude.com/claude-code)
dentro da pasta do sistema:

- **Investigar** só lê e explica.
- **Resolver** pode editar o projeto.

Precisa do Claude Code instalado e logado nesta máquina.

## Reunião dos agentes

Na sala de reunião, **▶ Reunir agora** junta os agentes que têm sistema local.
Cada um lê o próprio projeto e diz três coisas:

1. um número real;
2. uma melhoria;
3. o que precisa de outro agente.

No fim, um briefing junta tudo.

Cada fala é uma chamada ao Claude e consome a cota do seu plano. Por isso o
horário automático vem **desligado**. Para ligar, e para dar uma meta à
reunião, use `data/config.json` (veja abaixo).

## Configuração

Copie `data/config.exemplo.json` para `data/config.json` e ajuste:

- `nome`, `subtitulo`: o topo da tela e o letreiro das paredes.
- `dono`: o seu nome no boneco da Diretoria.
- `empresa`: uma frase sobre o negócio, que vira contexto na reunião.
- `porta`: a porta do escritório (padrão 4321).
- `reuniao.automatica`, `dias`, `hora`: a reunião em horário fixo.
- `reuniao.meta`: `descricao`, `alvo`, `feito`, `unidade` e `ate` aparecem no
  placar e orientam a conversa.

Para mudar as cores, edite as variáveis no topo de `css/style.css`.

## Avisos no celular

**🔔 Avisos** manda notificação pelo app gratuito [ntfy](https://ntfy.sh) ou
pelo WhatsApp via CallMeBot. O escritório avisa quando:

- um sistema caiu e não voltou;
- a reunião terminou;
- uma ação da agenda rodou.

Seus sistemas também podem pedir um aviso:

```http
POST http://localhost:4321/api/avisar
{ "titulo": "Meu agente", "texto": "3 pedidos esperando", "prioridade": "normal" }
```

## Agenda

`data/agenda.json` liga ou desliga um sistema numa data marcada. O exemplo está
no comentário da seção AGENDA em `server.js`.

## O que fica fora do git

Configuração, equipe, avisos (com a chave do CallMeBot), atas e estado ficam em
`data/` e são ignorados pelo git. Só os dois arquivos `*.exemplo.json` são
versionados.

## Estrutura

```
server.js          servidor: arquivos da tela, API, sobe/vigia sistemas, espelho
reuniao.js         reunião dos agentes (Claude Code em cada pasta)
avisos.js          ntfy e CallMeBot
index.html         a tela
js/                motor isométrico, salas, móveis, bonecos, painéis
css/style.css      tema
exemplo-agente/    o menor sistema que o escritório sabe operar
data/              seus dados (fora do git, menos os exemplos)
```

## Licença

MIT. Veja [LICENSE](LICENSE).
