# Chamada BOX — desenvolvimento

Detalhes técnicos pra quem for mexer no código. O que o app faz está no [README](README.md).

## Estrutura

Site estático, sem build: módulos ES nativos do navegador, publicado direto no GitHub Pages.

| Caminho | O quê |
|---|---|
| `index.html` | Página única; carrega os CSS e `js/main.js` |
| `config.js` | URL e chave pública do Supabase. Vazio (ou `?demo` na URL) = modo demonstração |
| `js/main.js` | Ponto de entrada: liga os eventos, atualização automática e carga inicial |
| `js/estado.js`, `js/util.js`, `js/icones.js` | Estado da tela, utilidades (datas, telefone, mensagens) e ícones |
| `js/api.js`, `js/dados.js`, `js/demo.js` | Acesso ao banco, consultas aos dados e modo demonstração |
| `js/render.js` | Esqueleto: topo, card do evento e abas |
| `js/telas/*.js` | Uma tela por arquivo: entrada, minha, equipe, jovens, presença, histórico, gerenciar |
| `js/dialogos.js`, `js/formulario.js`, `js/cadastros.js` | Modais, formulário genérico, cadastros e importação |
| `js/aniversarios.js`, `js/vinculos.js`, `js/busca.js`, `js/distribuir.js`, `js/pwa.js` | Funcionalidades transversais |
| `js/acoes.js` | O que cada botão e campo faz |
| `css/*.css`, `css/telas/*.css` | Estilos por componente e por tela (a ordem dos `<link>` importa) |
| `manifest.webmanifest`, `sw.js`, `icons/` | App instalável (PWA) e recebimento das notificações |
| `supabase/functions/notificar/` | Edge Function que envia as notificações (Web Push) |
| `tests/e2e.py` | Testes de ponta a ponta (modo demonstração) |
| `dev/servidor.py` | Servidor local com recarga automática |
| `supabase/schema.sql` | Tabelas + funções. As tabelas ficam fechadas; o acesso é só pelas funções `box_*`, que exigem o código |
| `supabase/0NN_*.sql` | Migrações, rodadas em ordem depois do schema (ex.: `002_presenca.sql`) |
| `supabase/*.local.sql` | Dados reais (nomes). **Não vão pro Git.** |

Ao criar um arquivo novo em `js/` ou `css/`, inclua também na lista `ARQUIVOS` do `sw.js` (pra abrir sem internet).

## Rodar localmente

```sh
python dev/servidor.py          # http://localhost:8080 (dados reais) ou /?demo (fictícios)
```

Serve sem cache e recarrega a página sozinho quando um `.html`, `.css` ou `.js` muda.

## Testes

```sh
python -m venv .venv && .venv/bin/pip install playwright pillow && .venv/bin/playwright install chromium
.venv/bin/python tests/e2e.py                    # roda tudo, no desktop e no celular
.venv/bin/python tests/e2e.py --prints antes     # salva prints de todas as telas
.venv/bin/python tests/e2e.py --comparar antes depois   # compara duas pastas de prints
```

Rodam no modo demonstração (sem tocar no banco), com dados e relógio fixos.

## Configurar o banco

1. Supabase > SQL Editor: rode `supabase/schema.sql` e depois as migrações numeradas, em ordem.
2. Defina o código de acesso (última linha comentada do schema, com o código de vocês).
3. (Opcional) rode o seed local com os nomes iniciais.
4. Project Settings > API: copie a **Project URL** e a **publishable/anon key** para o `config.js`.

## Notificações

- `010_notificacoes.sql` cria as inscrições, as regras (`box_push_mensagens`) e o agendamento diário das 9h (pg_cron).
- `010_config.local.sql` (fora do Git) grava a URL da função e o segredo em `push_config`.
- A função `notificar` (Supabase › Edge Functions, sem verificação de JWT) precisa dos segredos `BOX_SEGREDO`, `VAPID_PUBLICA` e `VAPID_PRIVADA`. A pública também fica em `config.js`; a privada nunca vai pro Git.

## Código de acesso

Fica guardado como hash na tabela `config`. Pra trocar, rode no SQL Editor:

```sql
insert into config (id, codigo_hash) values (1, crypt('novo-codigo', gen_salt('bf')))
  on conflict (id) do update set codigo_hash = excluded.codigo_hash;
```

## Privacidade no repositório

O repositório é público. Nunca commite nomes reais, telefones, o código de acesso, a chave privada VAPID ou chaves secretas do Supabase. Dados reais ficam em `supabase/*.local.sql` e segredos em `.segredos/`, os dois ignorados pelo Git.
