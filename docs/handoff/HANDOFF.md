# Chamada BOX · Handoff v2 (melhorias visuais)

Três arquivos de referência: `Chamada BOX - Melhorias.dc.html` (telas 2a–2l), `Chamada BOX - Componentes.dc.html` (4a entrada, 4b ícone/logo, 4c loaders, 4d toasts) e `Chamada BOX - Telas.dc.html` (recriação fiel do app atual, para comparar). Código dos mocks: `Chamada App v2.dc.html`, `Chamada App v2 Extras.dc.html`. Os valores de design estão neste documento; os mocks usam estilos inline.

Repo: gui-vncarvalho/box-chamada · Referência visual: `Chamada BOX - Melhorias.dc.html` (2a–2l, mais `Chamada BOX - Estados.dc.html` 5a–5f: Minha lista, Presença, Equipe, Jovens, Histórico x2, Gerenciar, Carregamento, Entrada, Quem é você, 2 modais; celular/tablet/desktop). Arquivos: Chamada App v2.dc.html e Chamada App v2 Extras.dc.html. Base fiel: `Chamada BOX - Telas.dc.html`. Código da referência: `Chamada App v2.dc.html` (estilos inline, valores abaixo).

Tokens: sem mudança, com uma adição: **vermelho de botão #d6342a** (branco sobre ele dá 4,8:1; sobre #e5392e dá só 4,2:1). Usar #d6342a em todo botão/selo com texto branco; #e5392e fica para detalhes, barras, anéis e ícones. (fundo #12161c, superfícies #1a2029/#212934, borda #2c343f, texto #eef1f4/#8d97a3, vermelho #e5392e, azul #2f5fd0, creme #f3e9d2, verde #38b787, dourado #e8a53d). Texto secundário em cards: #b4bdc8 (novo, contraste). Fontes: Alfa Slab One (marca/evento), Oswald (nomes, números, títulos de seção), Inter.

## 1. Topo (todas as telas) · js/render.js, css/topo.css
- Celular: header só com wordmark "CHAMADA" 20px + pílula do usuário (avatar 26px inicial com anel vermelho). Remover subtítulo "Diretoria · Juventude Box" no celular.
- Hero "Largada" (raio 22, padding 22/20/20, fundo #1a2029 + brilho azul): faixas de corrida inclinadas (skewX -20°: vermelho 22px, azul 10px, creme 4px) só no canto superior direito (110px de largura, 72% da altura, com máscara que esmaece pra baixo, para nunca ficarem atrás dos chips). Selo creme "FALTAM N DIAS" (ponto vermelho), título Alfa Slab 38–60px em 2 linhas com sombra 3px vermelha, meta #b4bdc8.
- Pista de 22px com linha central tracejada, preenchimento azul→vermelho, capacete 64×44 na ponta, bandeira quadriculada 30px no fim (margin-right 70px no celular pra não encostar nas faixas). Chips com fundo sólido (sem transparência): Você #1d2b4f/#9db9ff, Equipe #212934/#b4bdc8, Faltam #3b2022/#ff9a93; números Oswald 15px #eef1f4.
- Aniversariantes: faixa de 1 linha (rótulo dourado "ANIVERSÁRIOS" + nomes com elipse), sem emoji de bolo, sem título de duas linhas. Padding 8/12, raio 12.
- Banner "Instale o app": mostrar uma vez, dispensável, fora do fluxo da lista (css/pwa.css).
- Resultado: lista visível sem rolar em 375×812 (antes ~1,5 telas de topo).

## 2. Navegação · css/abas.css
- Celular: barra inferior, ícones 22px, pílula ativa 54×30 com fundo vermelho 16%, ícone vermelho; item min-height 54, padding-bottom 10 (safe-area). Rótulos inativos #b4bdc8.
- Desktop (≥1024): trocar abas horizontais por sidebar fixa 248px (#0f1318, borda direita): wordmark, itens 44px com ícone 20px, ativo #212934 + barra interna esquerda 3px vermelha, usuário no rodapé. Conteúdo max-width 1100, padding 28/32.
- Tablet: mesma barra inferior do celular, grades em 2 colunas.

## 3. Minha lista · js/telas/minha.js, css/telas/minha.css
- Filtro por status no topo da lista (chips: Pendentes, Chamei, Confirmou, Não vai, com ponto colorido + contagem Oswald). Chip ativo: fundo #eef1f4, texto #12161c.
- Duas seções: "Pra chamar" (Pendente + Chamei; título Oswald 15px caixa alta + contador vermelho) e "Já respondeu" (Confirmou/Não vai).
- Card "Pra chamar" (raio 18, barra lateral 5px na cor do status): avatar 46px; apelido Oswald 21px + selo Box/Sprint; sub 13px (nome completo · telefone · com Fulano) em uma linha com elipse. WhatsApp e Ligar viram botões circulares 48px à direita (WhatsApp #25d366, Ligar #212934 borda). Segmentado de status logo abaixo: 4 colunas, min-height 44, estado ativo com fundo e anel 1,5px na cor do status (cinza/dourado/verde/vermelho). Remover linha inferior "Com X · Pendente" e botões largos; "+ Nota" vira ação no menu ⋯ ou ícone no sub.
- Linha "Já respondeu": 1 linha, avatar 38px com anel na cor do status, nome Oswald 17px, pílula de status à direita; toque expande para o card completo.
- Grade: `repeat(auto-fill, minmax(min(100%, 340px), 1fr))`, gap 12.
- Altura do card cai de ~250px para ~140px.

## 4. Presença · js/telas/presenca.js, css/telas/presenca.css
- Resumo: número verde Oswald 52px "Presentes agora" + 3 métricas em linha de texto (confirmados vieram, sem confirmar, 1ª vez). Substitui os 4 mini-cards.
- Busca e "Visitante" 50px de altura, sticky no topo ao rolar (fundo degradê #12161c). Chips de filtro 13,5px.
- Linha de pessoa: min-height 68, linha inteira é o alvo de toque; caixa de marcação 40px (raio 12, borda 2px). Presente: linha com fundo verde 10%, borda verde 50%, anel verde no avatar, caixa preenchida #38b787 com check #06241a. Selo de tipo (Box/Sprint/Diretoria) ao lado do apelido (Oswald 19px). Alerta "não veio ainda" no sub para confirmados ausentes.
- Grade: mesma da Minha lista.

## 5. Equipe · js/telas/equipe.js
Cartão por diretor (raio 18): avatar 42px (anel vermelho + selo "você" no próprio), contagem Oswald "feitas/total", barra de 8px segmentada pelas cores de status (flex proporcional) e chips de jovens com ponto de status (substituem a lista de linhas). Grade minmax(320px).

## 6. Jovens · js/telas/jovens.js
Busca 50px + chips (Todos, Sem resposta, Confirmados, Não vão). Linha 68px: avatar com anel na cor do status, apelido Oswald 19 + selo, sub com nome completo e quem chama, pílula de status à direita.

## 7. Histórico · js/telas/historico.js
Segmentado Marcações/Presenças (ativo: #212934 + sublinhado vermelho). Marcações: feed por dia (avatar de quem marcou, "X marcou Y", pílula de status, hora). Presenças: card de resumo do último culto (número verde 52px + 3 métricas), "Quem sumiu" (chips vermelhos com nº de cultos), "Cultos passados" (data, barra de presença, total).

## 8. Gerenciar · js/telas/gerenciar.js
Seções em chips de 44px (Eventos, Jovens, Diretoria, Notificações, Backup). Eventos: botão "Novo evento" 44px, 4 ações em tiles (ícone 40px colorido + título + descrição), lista de eventos, e Notificações com interruptores 48×28 (verde ligado).

## 9. Carregamento, Entrada, Quem é você, Modais · js/telas/entrada.js, index.html, css/entrada.css, css/dialogos.css
- Carregamento: wordmark Alfa Slab até 72px com sombra vermelha 3px; pista 18px, capacete 84×58 com 2 rastros de velocidade, bandeira 36px; quadriculados em cima e embaixo; "60%" Oswald + "Ligando os motores…".
- Entrada: painel de marca com o ícone do app (H) em 64px celular / 96 tablet / 120 desktop, título Alfa Slab 46px celular / 76px desktop, faixas inclinadas e faixa quadriculada no topo; tablet e desktop mostram 3 linhas de recursos. Celular: marca em cima (30% da altura); tablet 44%; desktop duas colunas. Formulário: etapas (1 Código ativo vermelho, 2 Quem é você), título "Bora entrar?" com semáforo de largada à direita (pílula #0b0f14 com 5 luzes de 12px: 3 vermelhas acesas com brilho 8px, 2 apagadas #2c343f; ao digitar o código as luzes ficam verdes uma a uma, todas verdes ao validar), campo de código 58px com ícone de chave e botão olho 44px, ajuda "Não tem o código? Peça pra liderança do Box.", botão Entrar 56px com seta, nota com cadeado e faixa quadriculada no rodapé.
- Quem é você: topo com ícone 40px + wordmark e um semáforo de 3 luzes (2 verdes = código aceito, etapa 2); título Oswald até 44px; grupos por equipe com divisor de linha; cartões 66px (avatar 42px, apelido Oswald 20px, linha "N pendentes" em dourado #e8a53d, "Último acesso · N pendentes" em #ff9a93 no cartão lembrado); cartão selecionado com borda 1,5px e fundo vermelho 12%, anel vermelho no avatar e selo de check vermelho 24px no canto. Barra fixa embaixo com degradê e botão "Continuar como Rafa" 56px (o último usuário vem pré-selecionado). "Não estou na lista · só visualizar" tracejado 50px.
- Modais: gaveta no celular (raio 24 24 0 0, alça 44×5, rodapé fixo com Cancelar + ação principal 1,6x), diálogo central 580px no tablet/desktop. Campos 50px, fundo #12161c, borda 1,5px; foco com anel 4px. Opções segmentadas em cartões 54px; interruptor 52×30; stepper 48px; prévia do WhatsApp mantida.

## 10. Carregamento pequeno (4c) · css/componentes.css (novo bloco .carregando-*)
- Capacete na pista (bloco): pista 200×10 com linha tracejada, capacete 52×36 correndo de ponta a ponta (1,4s ease-in-out alternate), texto 13,5px #b4bdc8. Usar em listas vazias carregando.
- Roda (inline): 20px (textos), 44px (telas vazias); anel com conic-gradient vermelho/creme/azul/creme, máscara radial, giro 0,8–1s linear. Botão em carregamento: spinner 18px (borda branca 35% + topo branco) e rótulo no gerúndio ("Entrando…", "Salvando…"); botão fica com opacidade .9 e sem clique.
- Esqueleto: mesma geometria do card de Minha lista (avatar 46, 2 linhas, 2 círculos 48, segmentado 52) com brilho 1,4s linear (gradiente #212934 → #2a3441).
- Barra no topo (troca de aba): 4px, trecho de 40% azul→vermelho correndo 1,1s; some quando o conteúdo chega. Puxar pra atualizar: ícone de seta circular girando + "Atualizando…".
- Keyframes: run, spin, shimmer, bar. Respeitar prefers-reduced-motion (sem animação, só o texto).

## 11. Toasts (4d) · js/toast.js, css/componentes.css
- Cartão raio 16, fundo #212934, borda 1px, sombra 0 12px 32px rgba(0,0,0,.5); padding 12/12/14; ícone circular 36px tintado, título 14,5px/600, texto 13px #b4bdc8, ação em texto 13,5px/700 na cor do estado; barra de tempo 3px na base (5s, esvazia da direita para a esquerda).
- Estados: sucesso (verde #38b787, borda 45%), informação (azul #5a86ee, borda neutra), aviso (dourado #e8a53d, borda 40%), erro (vermelho #e5392e, borda 45%, ação "Tentar").
- Posição: celular, 12px das laterais e 84px acima da base (acima da barra de abas), empilhados com gap 8, máx. 3; desktop, canto inferior direito, 380px, 20px de margem. Sucesso de marcação traz "Desfazer"; pausar a barra no toque/hover.
- Usos: marcação de status ("Arthur: Confirmou" + Desfazer), lista copiada, sem conexão (aviso persistente até voltar), falha ao salvar (erro, com Tentar).

## 12. Identidade · manifest.webmanifest, icons/
- Ícone do app (escolhido: variação H, escura): cartão #12161c (canto 40 em 180), moldura vermelha #e5392e de 5px a 5px da borda, bandeira quadriculada preto e branco (grade 4×4, canto 18, contorno creme #f3e9d2 de 6px), check vermelho de traço 22 com contorno #12161c de 40. Vetor: `icons/icon-chamada.svg`; maskable (conteúdo a 80%, sem moldura vermelha, fundo #12161c sem cantos): `icons/icon-chamada-maskable.svg`.
- Exportar PNG: 192, 512 (any), 512 (maskable), 180 (apple-touch-icon), 32 e 16 (favicon). theme-color #12161c, background_color #12161c.
- Lockup horizontal: ícone 56px + "CHAMADA" Alfa Slab 28px caixa alta creme + "Diretoria · Juventude Box" 12px #8d97a3.

## 13. Estados e fluxos extras (referência: `Chamada BOX - Estados.dc.html`, 5a–5f)
- **Visitante (5a):** gaveta no celular / diálogo 540px no desktop. Campos 52px: Nome (foco com anel 4px, cursor vermelho), WhatsApp opcional, Quem convidou (seleção com seta), Box 17+ / Sprint em dois cartões de 50px. Ação "Adicionar e marcar presente" (vermelho); a pessoa já entra com a caixa marcada.
- **Confirmações (5a):** ícone circular 60px tintado, título Oswald 26px, texto #b4bdc8 14,5px (máx. 34ch), chips com os números afetados. "Zerar marcações" é destrutiva: exige marcar "Entendi que não dá pra desfazer" para habilitar o botão (vermelho 16% com borda 60%, opacidade .45 enquanto desabilitado). "Encerrar a lista" é neutra: botão creme #f3e9d2 com texto #12161c, chips 28 presentes / 3 visitantes / 4 sem confirmar.
- **Estados vazios (5b):** cartão 300px, ilustração de 96px, título Oswald 22px, texto 14px, ação opcional 46px. Quatro casos: sem chamadas (capacete parado na largada, pista apagada, ação "Distribuir quem falta"); tudo chamado (capacete na bandeira, pista verde, confete de quadrados, ação "Ver a equipe"); busca sem resultado ("Ninguém com “termo”", ação "Limpar busca"); histórico vazio (relógio pontilhado, sem ação).
- **Sem internet e erro (5c):** faixa fixa no topo (#3a2c10, borda dourada 50%, ícone de wifi cortado) "Sem conexão · N marcações aguardando envio". Itens não enviados mostram "Aguardando envio" em dourado no sub; enviados, "Enviado" em verde. Marcações ficam na fila local e sobem sozinhas; ao reconectar, toast de sucesso "Conexão de volta · N marcações enviadas" e a faixa some. Erro de carregamento: ícone de alerta vermelho, "Não deu pra carregar a lista", botão "Tentar de novo" (50px) e link "Usar dados salvos · há N min".
- **Gerenciar (5d):** a linha de seções rola na horizontal e, ao abrir uma seção, rola até deixar a aba ativa visível (com degradê de 28px na borda esquerda como dica de rolagem). Diretoria: cartão "Código de acesso" (mascarado ••••••, botões olho e copiar 44px, "Gerar novo código" em #ff9a93 com aviso de que quem está logado precisa entrar de novo), lista 64px com selo Líder (dourado) ou Diretor, botão Convidar. Notificações: interruptores 52×30, "Lembrete antes do culto" com chips 1 dia antes / 2 horas antes / No dia (multi-seleção), horário do lembrete 18:00. Backup: cartão "Último backup há N dias" (Oswald 38px verde, contagem de jovens/eventos/marcações), Exportar (vermelho) e Importar (neutro) lado a lado, interruptor de backup automático semanal, aviso dourado de que importar substitui os dados do aparelho.
- **Interação da Presença (5e):** repouso → pressionado (80 ms: escala .98, fundo verde 16%, anel 4px verde 12%, caixa 44px) → marcado (vibração `navigator.vibrate(30)`, caixa preenchida, toast "Arthur presente · Desfazer" por 5s). Toque longo de 500 ms desmarca. A gravação local é imediata; a rede vem depois.

## 14. Acessibilidade (5f)
- **Contraste:** tabela calculada em 5f (mínimo 4,5:1 texto, 3:1 componentes). Regras: botões vermelhos com texto branco usam #d6342a (4,8:1); vermelho de marca #e5392e só como texto ≥ 24px, em barras e ícones; para texto vermelho pequeno (ex.: selo "você") usar #ff9a93; azul como texto pequeno usar #9db9ff; cinza #8d97a3 só em #12161c/#1a2029 e nunca para informação essencial (usar #b4bdc8). Conferir os itens marcados "só 3:1" ou "falha" na tabela antes de implementar.
- **Movimento reduzido:** `@media (prefers-reduced-motion: reduce)`: capacete parado a 60%; roda vira anel estático de 3/4; esqueleto liso sem brilho; semáforo muda de uma vez; barra de tempo do toast fixa com fade. Os textos de estado ("Carregando…") permanecem.
- **Texto ampliado:** fontes em rem. Acima de 120%: segmentado de status vira 2×2, botões de contato mantêm o rótulo, linhas quebram em vez de truncar com reticências, alvos de toque continuam ≥ 44px (passam a ~56px).
- **Geral:** estados nunca só por cor (sempre texto ou ícone junto); foco visível com anel 4px rgba(255,255,255,.06) + borda #8d97a3; `aria-live="polite"` nos toasts e na faixa offline; `role="dialog"` com foco preso nas gavetas.

## 15. Preservar (não mudar)
Textos, rótulos e lógica de todas as telas permanecem; só muda a apresentação. Rótulos e textos em português permanecem.

## Ordem sugerida
1) tokens + ícones/manifest 2) topo + hero + abas 3) componentes (loaders, toasts, estados vazios) 4) Minha lista 5) Presença + interação + fila offline 6) Equipe, Jovens, Histórico, Gerenciar (incl. Diretoria, Notificações, Backup) 7) Entrada, Quem é você, Carregamento e modais (incl. Visitante e confirmações) 8) passe de acessibilidade (contraste, movimento reduzido, texto ampliado).

Critérios de aceite: 375×812 mostra o hero e o primeiro card sem rolar; alvos de toque ≥ 44px; texto ≥ 4,5:1 de contraste; nada se sobrepõe a 320px de largura; desktop ≥ 1024 usa a sidebar.
