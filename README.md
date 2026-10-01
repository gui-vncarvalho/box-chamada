# Chamada BOX

Central da diretoria do Box (ministério de jovens) pra dividir e acompanhar quem chama quem para cultos e eventos.

- Abre por link no celular, sem conta: só um **código de acesso da diretoria**.
- Cada pessoa da diretoria escolhe quem é e vê **a própria lista**, com botão de WhatsApp (mensagem pronta) e Ligar.
- Status por chamada: **Pendente → Chamei → Confirmou / Não vai**, com nota. Todo mundo vê em tempo quase real (atualiza a cada ~12 s).
- **Box (17+) × Sprint**: calculado pela data de nascimento. Cada evento define o público.
- **Distribuição automática** por equipe (feminina/masculina), equilibrando a quantidade entre as pessoas.
- **Presença** no dia do evento: marcar quem chegou, cadastrar visitante na hora e ver quantos confirmados vieram.
- "Copiar lista pro grupo" gera o texto de quem chama quem para colar no WhatsApp.

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
| `manifest.webmanifest`, `sw.js`, `icons/` | App instalável (PWA) |
| `tests/e2e.py` | Testes de ponta a ponta (modo demonstração) |
| `supabase/schema.sql` | Tabelas + funções. As tabelas ficam fechadas; o acesso é só pelas funções `box_*`, que exigem o código |
| `supabase/0NN_*.sql` | Migrações, rodadas em ordem depois do schema (ex.: `002_presenca.sql`) |
| `supabase/*.local.sql` | Dados reais (nomes). **Não vão pro Git.** |

Ao criar um arquivo novo em `js/` ou `css/`, inclua também na lista `ARQUIVOS` do `sw.js` (pra abrir sem internet).

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

## Privacidade

O repositório é público, mas os dados não estão nele: nomes, telefones e datas de nascimento ficam no Supabase, acessíveis só com o código. Não commite nomes reais nem o código de acesso. Para trocar o código, rode de novo a linha do `insert into config ...` com o novo valor.
