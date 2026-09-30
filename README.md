# Chamada BOX

Central da diretoria do Box (ministério de jovens) pra dividir e acompanhar quem chama quem para cultos e eventos.

- Abre por link no celular, sem conta: só um **código de acesso da diretoria**.
- Cada pessoa da diretoria escolhe quem é e vê **a própria lista**, com botão de WhatsApp (mensagem pronta) e Ligar.
- Status por chamada: **Pendente → Chamei → Confirmou / Não vai**, com nota. Todo mundo vê em tempo quase real (atualiza a cada ~12 s).
- **Box (17+) × Sprint**: calculado pela data de nascimento. Cada evento define o público.
- **Distribuição automática** por equipe (feminina/masculina), equilibrando a quantidade entre as pessoas.
- "Copiar lista pro grupo" gera o texto de quem chama quem para colar no WhatsApp.

## Estrutura

| Arquivo | O quê |
|---|---|
| `index.html`, `styles.css`, `app.js` | O site (estático, sem build) |
| `config.js` | URL e chave pública do Supabase. Vazio = modo demonstração |
| `supabase/schema.sql` | Tabelas + funções. As tabelas ficam fechadas; o acesso é só pelas funções `box_*`, que exigem o código |
| `supabase/*.local.sql` | Dados reais (nomes). **Não vão pro Git.** |

## Configurar o banco

1. Supabase > SQL Editor: rode `supabase/schema.sql`.
2. Defina o código de acesso (última linha comentada do schema, com o código de vocês).
3. (Opcional) rode o seed local com os nomes iniciais.
4. Project Settings > API: copie a **Project URL** e a **publishable/anon key** para o `config.js`.

## Privacidade

O repositório é público, mas os dados não estão nele: nomes, telefones e datas de nascimento ficam no Supabase, acessíveis só com o código. Não commite nomes reais nem o código de acesso. Para trocar o código, rode de novo a linha do `insert into config ...` com o novo valor.
