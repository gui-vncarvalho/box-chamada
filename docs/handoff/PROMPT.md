# Prompt para o Claude Code

Cole o texto abaixo na raiz do repositório `gui-vncarvalho/box-chamada`, com esta pasta copiada para dentro dele (por exemplo em `docs/handoff/`).

---

Vou te passar o redesign visual do Chamada BOX (PWA da diretoria do Box). Leia `docs/handoff/HANDOFF.md` inteiro antes de mexer em qualquer arquivo. Ele descreve cada tela com medidas, cores e arquivos do repositório a alterar.

Referência visual: abra os arquivos de `docs/handoff/referencia/` no navegador (`Chamada BOX - Melhorias.dc.html`, `Componentes`, `Estados` e `Telas`). `Telas` é o app atual, para comparar. O CSS dos mocks é inline, mas os valores finais estão no HANDOFF.md. Ícones novos em `docs/handoff/icons/`.

Regras:
1. Não mude textos, rótulos, lógica, dados nem a estrutura do código. Só a apresentação (CSS e, quando necessário, marcação).
2. Antes de começar, confira se os arquivos e classes citados no HANDOFF.md existem. Liste o que não bater e me pergunte, em vez de inventar.
3. Siga a ordem sugerida no final do HANDOFF.md. Faça um commit por etapa e rode o app para verificar a tela em 375, 834 e 1440 de largura.
4. Mantenha os tokens existentes. A única cor nova é o vermelho de botão `#d6342a` (texto branco sobre ele). O vermelho `#e5392e` fica para detalhes, anéis, barras e ícones.
5. Respeite os critérios de aceite do HANDOFF.md: alvos de toque ≥ 44px, contraste mínimo de 4,5:1, nada sobreposto a 320px, sidebar a partir de 1024px, `prefers-reduced-motion` e texto ampliado.
6. Troque os ícones do PWA pelos de `docs/handoff/icons/` (exporte PNG 192, 512, 512 maskable, 180 e favicon) e atualize o manifest.
7. A logo oficial do Box ainda não existe. Não use nenhuma imagem de logo do Box por enquanto.

Comece pela etapa 1 (tokens, ícones e manifest) e me mostre o resultado antes de seguir.
