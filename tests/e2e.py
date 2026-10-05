"""Testes de ponta a ponta do Chamada BOX (modo demonstração, sem tocar no banco).

Uso:
    python tests/e2e.py                 # roda os testes (desktop e celular)
    python tests/e2e.py --prints DIR    # também salva prints de todas as telas em DIR
    python tests/e2e.py --comparar A B  # compara pixel a pixel duas pastas de prints

Precisa de: pip install playwright pillow && playwright install chromium
Os dados do demo são gerados de forma determinística (aleatoriedade e
relógio fixos), então os prints de duas versões podem ser comparados.
"""
import functools, http.server, os, re, sys, threading, urllib.parse

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Aleatoriedade e ids previsíveis: mesmos dados em toda execução.
DETERMINISTICO = """
(() => {
  let s = 20261003;
  Math.random = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let n = 0;
  crypto.randomUUID = () => '00000000-0000-4000-8000-' + String(++n).padStart(12, '0');
})();
"""

ANTES = '2026-09-30T15:00:00-03:00'   # 3 dias antes do sábado
NO_DIA = '2026-10-03T19:00:00-03:00'  # sábado, dia do evento do demo seguinte


class Falha(Exception):
    pass


def checar(cond, msg):
    if not cond:
        raise Falha(msg)


def servidor():
    class Silencioso(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    h = functools.partial(Silencioso, directory=RAIZ)
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return f'http://127.0.0.1:{srv.server_address[1]}'


class Sessao:
    def __init__(self, browser, base, tela, quando=ANTES, prints=None, ua=None):
        self.nome = tela
        vp = {'width': 1440, 'height': 950} if tela == 'desktop' else {'width': 390, 'height': 844}
        toque = {} if tela == 'desktop' else {'has_touch': True, 'is_mobile': True}
        self.ctx = browser.new_context(viewport=vp, device_scale_factor=1 if tela == 'desktop' else 2, **toque,
                                       timezone_id='America/Sao_Paulo', locale='pt-BR', service_workers='block',
                                       **({'user_agent': ua} if ua else {}))
        self.ctx.add_init_script(DETERMINISTICO)
        self.pg = self.ctx.new_page()
        self.erros = []
        self.pg.on('pageerror', lambda e: self.erros.append(str(e)))
        # erros dentro de funções assíncronas (ex.: cliques) só aparecem no console
        self.pg.on('console', lambda m: m.type == 'error' and 'Failed to load resource' not in m.text and self.erros.append(m.text))
        self.pg.clock.install(time=quando)
        self.base, self.prints = base, prints

    def entrar(self, quem='Rafa'):
        pg = self.pg
        pg.goto(self.base + '/?demo')
        pg.fill('input[name=codigo]', 'x')
        pg.click('text=Entrar')
        pg.click(f'.pick-grid >> text={quem}')
        pg.wait_for_selector('.hero')
        return pg

    def js(self, expr):
        return self.pg.evaluate(f'(() => {{ const B = window.__box; return {expr}; }})()')

    def aba(self, id):
        self.pg.click(f'.tab[data-id={id}]')
        self.pg.wait_for_timeout(120)

    def print(self, nome, full=True):
        if self.prints:
            self.pg.wait_for_timeout(450)  # deixa as animações terminarem
            self.pg.screenshot(path=os.path.join(self.prints, f'{self.nome}-{nome}.png'), full_page=full, animations='disabled')

    def fechar(self):
        checar(not self.erros, f'erros de JavaScript: {self.erros[:2]}')
        self.ctx.close()


# ---------------------------------------------------------------- testes
def t_minha_lista(s):
    pg = s.entrar()
    s.print('minha')
    n = pg.locator('.pcard').count()
    checar(n > 0, 'Minha lista vazia')
    pg.locator('.pcard').first.locator('button:has-text("Confirmou")').click()
    pg.wait_for_timeout(150)
    checar(pg.locator('.grupo-titulo:has-text("Resolvidos")').count() == 1, 'card não foi pra "Resolvidos"')
    # nota com modal próprio
    pg.locator('.pcard .link-btn').first.click()
    pg.wait_for_selector('#dlg2[open]')
    pg.click('#dlg2 textarea')
    pg.keyboard.type('Vai levar a irmã')
    pg.keyboard.press('Enter')
    pg.wait_for_timeout(400)
    checar(pg.locator('.pcard .nota:has-text("Vai levar a irmã")').count() == 1, 'nota não salvou')
    # WhatsApp marca "Chamei" e a mensagem tem emoji inteiro
    with s.ctx.expect_page() as pop:
        pg.locator('.pcard.st-pendente .btn.wa').first.click()
    url = pop.value.url
    pop.value.close()
    checar('api.whatsapp.com/send' in url and '%F0%9F%98%8A' in url, f'link do WhatsApp errado: {url[:80]}')
    pg.wait_for_timeout(600)
    checar(pg.locator('.pcard.st-chamado').count() >= 1, 'WhatsApp não marcou "Chamei"')
    s.print('minha-marcada')


def t_equipe_historico(s):
    pg = s.entrar()
    pg.locator('.pcard').first.locator('button:has-text("Chamei")').click()
    pg.wait_for_timeout(150)
    s.aba('equipe')
    s.print('equipe')
    checar(pg.locator('.card-eu').count() == 1, 'card "você" ausente')
    checar('Equipe masculina' in pg.locator('.section-title h2').first.inner_text(), 'equipe do usuário não vem primeiro')
    s.aba('historico')
    s.print('historico')
    checar(pg.locator('.tl.st-chamado').count() >= 1, 'histórico sem a marcação')


def t_jovens_e_busca(s):
    pg = s.entrar()
    s.aba('jovens')
    s.print('jovens')
    casos = {
        '18': 'j => B.idade(j.nascimento) === 18',
        '15-17': 'j => { const i = B.idade(j.nascimento); return i != null && i >= 15 && i <= 17; }',
        '17+': 'j => (B.idade(j.nascimento) ?? -1) >= 17',
        'box': "j => B.faixa(j) === 'box'",
        'casado': "j => j.estado_civil === 'casado'",
        'meninas box': "j => j.genero === 'F' && B.faixa(j) === 'box'",
        'outubro': "j => !!j.nascimento && j.nascimento.slice(5, 7) === '10'",
        'semana': 'j => { const a = B.proximoAniver(j.nascimento); return !!a && a.dias <= 6; }',
        'esposa': "j => B.vinculosDe(j.id).some(v => (B.textoVinculo(v, j.id)?.texto || '').startsWith('Esposa'))",
    }
    s.aba('gerenciar')
    pg.click('.mg-abas >> text=Jovens')
    for termo, esperado in casos.items():
        pg.fill('#busca-mg', termo)
        pg.wait_for_timeout(60)
        achou = pg.locator('#mglista .jcard').count()
        esp = s.js(f'B.S.data.jovens.filter({esperado}).length')
        checar(achou == esp, f'busca "{termo}": achou {achou}, esperado {esp}')
    pg.fill('#busca-mg', '')
    pg.click('[data-act=mgf-painel]')
    pg.click('#mgpainel [data-k=faixa][data-v=box]')
    pg.click('#mgpainel [data-k=equipe][data-v=F]')
    pg.fill('[data-mgf-idade=idadeMin]', '18')
    pg.wait_for_timeout(80)
    esp = s.js("B.S.data.jovens.filter(j => B.faixa(j) === 'box' && j.genero === 'F' && B.idade(j.nascimento) >= 18).length")
    checar(pg.locator('#mglista .jcard').count() == esp, 'painel de filtros com resultado errado')
    checar(pg.locator('.chip-filtro').count() == 3, 'chips de filtros ativos')
    s.print('gerenciar-jovens-filtros')
    pg.click('[data-act=mgf-limpar][data-id=tudo]')
    checar(pg.locator('.chip-filtro').count() == 0, '"Limpar tudo" não limpou')


def t_presenca(s):
    pg = s.entrar()
    s.aba('presenca')
    pg.fill('#busca-p', 'Bruna')
    pg.locator('.pcheck').first.click()
    pg.wait_for_timeout(250)
    checar(pg.locator('.pres-junto').count() == 1, '"Veio junto?" não apareceu')
    s.print('presenca-junto', full=False)
    pg.click('[data-act=presenca-junto]')
    pg.wait_for_timeout(200)
    checar(s.js("!!B.presenca(B.S.data.jovens.find(j => j.nome === 'Caio').id)"), 'presença de quem veio junto não marcou')
    pg.fill('#busca-p', 'Zezinho')
    pg.click('#plista >> text=como visitante')
    pg.wait_for_selector('#form-dlg')
    checar(pg.input_value('#form-dlg input[name=nome]') == 'Zezinho', 'nome do visitante não veio da busca')
    pg.click('#form-dlg button[type=submit]')
    pg.wait_for_timeout(900)
    checar(s.js("!!B.presenca(B.S.data.jovens.find(j => j.nome === 'Zezinho')?.id)"), 'visitante não ficou presente')
    checar(pg.inner_text('.pres-num strong') == '3', 'contador de presentes')
    s.print('presenca')
    # no site real, antes do dia, a aba some
    s.js('(B.S.simularReal = true, B.render(), 0)')
    checar(pg.locator('.tab[data-id=presenca]').count() == 0, 'aba Presença visível antes do dia no modo real')


def t_presenca_no_dia(s):
    pg = s.entrar()
    s.js('(B.S.simularReal = true, B.render(), 0)')
    s.aba('gerenciar')
    pg.click('.mg-head .btn.primary')
    pg.fill('#form-dlg input[name=nome]', 'Box Day')
    pg.fill('#form-dlg input[name=data]', '2026-10-03')
    pg.click('#form-dlg button[type=submit]')
    pg.wait_for_timeout(1500)
    checar(pg.locator('.countdown').inner_text().upper().startswith('É HOJE'), 'contagem do dia errada')
    checar(pg.locator('.presenca-cta').count() == 1, 'botão "Marcar presença" ausente no dia')
    pg.reload()
    pg.wait_for_selector('.hero')
    checar(pg.locator('.ev-nome').inner_text().upper() == 'BOX DAY', 'recarregar pulou do evento de hoje')


def t_modais_e_cadastros(s):
    pg = s.entrar()
    s.aba('gerenciar')
    s.print('gerenciar-eventos')
    pg.click('.mg-head .btn.primary')
    pg.wait_for_selector('#form-dlg')
    if s.nome == 'celular':  # no toque, não abre o teclado sozinho
        checar(s.js('document.activeElement.matches("input, textarea")') is False, 'abriu o teclado sozinho no celular')
        checar(s.js("document.querySelector('#dlg').scrollTop") == 0, 'modal não abriu no topo')
    else:
        checar(s.js('document.activeElement.name') == 'nome', 'foco não foi pro nome')
    pg.click('#form-dlg button[type=submit]')
    checar(pg.locator('.field.invalido').count() == 1, 'obrigatório não marcou')
    pg.fill('#form-dlg input[name=nome]', 'Box Day')
    pg.fill('#form-dlg input[name=data]', '2026-10-03')
    pg.click('#form-dlg .seg-form >> text=Box + Sprint')
    pg.fill('#form-dlg input[name=hora_sprint]', '17h')
    pg.fill('#form-dlg input[name=hora_box]', '20h')
    previas = [re.search(r'às [^.]*\.', t).group(0) for t in pg.locator('[data-previa] .bolha').all_inner_texts()]
    checar(previas == ['às 20h.', 'às 17h.'], f'prévias por faixa: {previas}')
    s.print('modal-evento', full=False)
    pg.click('#form-dlg button[type=submit]')
    pg.wait_for_timeout(1500)
    msg = s.js("['Bruna', 'Alice', 'Helena'].map(n => { const j = B.S.data.jovens.find(x => x.nome === n); return B.mensagem(B.evento(), j).match(/às [^.]*\\./)[0]; })")
    checar(msg == ['às 20h.', 'às 17h.', 'às 17h (Sprint) e 20h (Box).'], f'horário por faixa: {msg}')
    # cadastro de jovem: máscara, idade e vínculos
    pg.click('.mg-abas >> text=Jovens')
    pg.fill('#busca-mg', 'Bruna')
    pg.locator('#mglista .jcard').first.click()
    pg.wait_for_selector('#form-dlg')
    pg.fill('#form-dlg input[name=telefone]', '11987654321')
    checar(pg.input_value('#form-dlg input[name=telefone]') == '(11) 98765-4321', 'máscara de telefone')
    pg.fill('#form-dlg input[name=nascimento]', '2008-05-10')
    checar(pg.inner_text('[data-hint-idade]') == '18 anos · Box', 'idade calculada')
    checar('Esposa de Caio' in ' '.join(pg.locator('#form-dlg .vinc-chip').all_inner_texts()), 'vínculo existente')
    pg.click('#form-dlg [data-act=vinc-novo]')
    pg.wait_for_selector('#dlg2[open]')
    pg.click('#dlg2 [data-op="primo:a"]')
    pg.fill('#dlg2 [data-busca]', 'duda')
    pg.click('#dlg2 [data-alvo]')
    checar(pg.inner_text('#dlg2 [data-frase]') == 'Bruna é prima de Duda', 'frase do vínculo')
    pg.click('#dlg2 [data-salvar]')
    pg.wait_for_timeout(700)
    checar('Prima de Duda' in ' '.join(pg.locator('#form-dlg .vinc-chip').all_inner_texts()), 'vínculo novo não apareceu')
    s.print('modal-jovem', full=False)
    pg.click('#btn-excluir')
    pg.wait_for_selector('#dlg2[open]')
    s.print('modal-confirmar', full=False)
    pg.click('#dlg2 [data-r="0"]')
    pg.wait_for_timeout(400)
    pg.keyboard.press('Escape')
    pg.wait_for_timeout(450)
    checar(not s.js("document.querySelector('#dlg').open"), 'ESC não fechou o modal')
    # importar
    pg.click('text=Importar lista')
    pg.fill('textarea[name=texto]', 'Maria Teste; 11 91234-5678; 14/03/2007\nAlice; 11 90000-1111')
    checar(pg.inner_text('#form-imp [type=submit]') == 'Importar 2', 'prévia da importação')
    pg.click('#form-imp button[type=submit]')
    pg.wait_for_timeout(800)
    # diretoria com nascimento
    pg.click('.mg-abas >> text=Diretoria')
    s.print('gerenciar-diretoria')
    pg.locator('.dir-card').first.click()
    pg.wait_for_selector('#form-dlg')
    pg.fill('#form-dlg input[name=nascimento]', '1999-10-02')
    checar(pg.inner_text('[data-hint-idade]') == '26 anos', 'idade da diretoria sem faixa')
    pg.keyboard.press('Escape')


def t_aniversarios(s):
    pg = s.entrar()
    checar('Tem aniversário hoje' in pg.inner_text('.aniver-faixa'), 'faixa de aniversário')
    pg.click('.aniver-faixa')
    pg.wait_for_selector('dialog[open] .aniver-lista')
    href = pg.get_attribute('dialog .aniver-row.hoje a', 'href')
    texto = urllib.parse.parse_qs(urllib.parse.urlparse(href).query)['text'][0]
    checar(texto.startswith('Feliz aniversário, '), 'mensagem de parabéns')
    checar(pg.locator('dialog .aniver-row:has-text("Diretoria")').count() > 0, 'diretoria fora dos aniversários')
    s.print('aniversarios', full=False)


def t_abas_e_pwa(s):
    pg = s.entrar()
    fit = s.js("(n => n.scrollWidth <= n.clientWidth + 1)(document.querySelector('.tabs'))")
    checar(fit, 'abas não cabem')
    if s.nome == 'celular':
        checar(s.js("getComputedStyle(document.querySelector('.tabs')).position") == 'fixed', 'barra de abas não está fixa')
        cortados = s.js("[...document.querySelectorAll('.tab-lbl')].filter(e => e.scrollWidth > e.clientWidth).length")
        checar(cortados == 0, 'nome de aba cortado')
    man = s.pg.evaluate("fetch('manifest.webmanifest').then(r => r.json())")
    checar(man['display'] == 'standalone' and len(man['icons']) == 3, 'manifesto')


def t_campos_sem_zoom_e_sem_estouro(s):
    """No celular, campo com letra < 16px faz o iOS dar zoom; nenhum modal pode ter rolagem lateral."""
    pg = s.entrar()
    minimo = 16 if s.nome == 'celular' else 15
    MEDIR = """min => [...document.querySelectorAll('input:not([type=radio]):not([type=checkbox]), textarea, select')]
      .filter(e => e.offsetParent && parseFloat(getComputedStyle(e).fontSize) < min).map(e => e.name || e.id || e.type)"""
    pequenos = []
    s.aba('jovens'); pequenos += pg.evaluate(MEDIR, minimo)
    s.aba('gerenciar')
    for abrir in [lambda: pg.click('.mg-head .btn.primary'),
                  lambda: (pg.click('.mg-abas >> text=Jovens'), pg.click('[data-act=mgf-painel]'), pg.locator('#mglista .jcard').first.click()),
                  lambda: (pg.click('.mg-abas >> text=Diretoria'), pg.locator('.dir-card').first.click())]:
        abrir()
        pg.wait_for_selector('#form-dlg')
        pg.wait_for_timeout(350)
        pequenos += pg.evaluate(MEDIR, minimo)
        checar(not s.js("(d => d.scrollWidth > d.clientWidth + 1)(document.querySelector('#dlg'))"), 'modal com rolagem lateral')
        pg.keyboard.press('Escape')
        pg.wait_for_timeout(450)
    checar(not pequenos, f'campos com letra menor que {minimo}px: {sorted(set(pequenos))}')


def t_presenca_cultos_e_encerrar(s):
    pg = s.entrar()
    s.aba('gerenciar')
    pg.click('.mg-head .btn.primary')
    pg.fill('#form-dlg input[name=nome]', 'Box Day')
    pg.fill('#form-dlg input[name=data]', '2026-10-03')
    pg.click('#form-dlg .seg-form >> text=Box + Sprint')
    pg.fill('#form-dlg input[name=hora_sprint]', '17h')
    pg.fill('#form-dlg input[name=hora_box]', '20h')
    pg.click('#form-dlg button[type=submit]')
    pg.wait_for_timeout(1500)
    s.aba('presenca')
    checar(pg.locator('.pres-cultos button').all_inner_texts()[0].startswith('Sprint 17h'), 'abas de culto')
    # Bruna no Sprint
    pg.fill('#busca-p', 'Bruna')
    pg.locator('.pcheck').first.click()
    pg.wait_for_timeout(200)
    pg.click('[data-act=junto-fechar]')
    # no Box ela ainda não está, mas aparece "também no Sprint"
    pg.click('.pres-cultos [data-id=box]')
    pg.fill('#busca-p', 'Bruna')
    card = pg.locator('.pcheck').first
    checar('presente' not in (card.get_attribute('class') or ''), 'presença vazou pro outro culto')
    checar('também no Sprint' in card.inner_text(), 'aviso de presença no outro culto')
    card.click()
    pg.wait_for_timeout(200)
    cultos = s.js("B.S.data.presencas.filter(p => p.evento_id === B.S.eventoId && p.jovem_id === B.S.data.jovens.find(j => j.nome === 'Bruna').id).map(p => p.culto).sort().join(',')")
    checar(cultos == 'box,sprint', f'presença nos dois cultos: {cultos}')
    # diretoria
    pg.fill('#busca-p', '')
    pg.click('.chip[data-id=diretoria]')
    pg.locator('.pcheck.dir').first.click()
    pg.wait_for_timeout(200)
    checar(pg.inner_text('.pres-tile.st-diretoria strong') == '1', 'contador da diretoria')
    s.print('presenca-cultos')
    # encerrar trava e mostra o resumo
    pg.click('[data-act=encerrar-presenca]')
    pg.wait_for_selector('#dlg2[open]')
    pg.click('#dlg2 [data-r="1"]')
    pg.wait_for_selector('#dlg[open] .resumo-nums')
    nums = pg.locator('.resumo-nums strong').all_inner_texts()
    checar(nums[0] == '1' and nums[1] == '1', f'resumo: {nums}')
    s.print('resumo-culto', full=False)
    pg.keyboard.press('Escape')
    pg.wait_for_timeout(450)
    checar(pg.locator('.pres-encerrada').count() == 1, 'faixa de lista encerrada')
    antes = s.js('B.S.data.presencas.length')
    pg.locator('.pcheck').nth(2).click(force=True)
    pg.wait_for_timeout(200)
    checar(s.js('B.S.data.presencas.length') == antes, 'lista encerrada aceitou marcação')
    pg.click('[data-act=reabrir-presenca]')
    pg.wait_for_selector('#dlg2[open]')
    pg.click('#dlg2 [data-r="1"]')
    pg.wait_for_timeout(600)
    checar(pg.locator('.pres-encerrada').count() == 0 and pg.locator('[data-act=encerrar-presenca]').count() == 1, 'reabrir')


def t_historico_presencas_e_justificativas(s):
    pg = s.entrar()
    s.aba('historico')
    pg.click('[data-act=hist-modo][data-id=presencas]')
    sumiu = sorted(t.split('\n')[0] for t in pg.locator('.jcard.sumiu .jcard-nome').all_inner_texts())
    checar(sumiu == ['Heitor', 'Isa'], f'quem sumiu: {sumiu}')
    checar(pg.locator('[data-act=resumo-culto]').count() == 3, 'cultos passados')
    s.print('historico-presencas')
    pg.locator('[data-act=resumo-culto]').first.click()
    pg.wait_for_selector('#dlg[open] .resumo-nums')
    checar(pg.locator('#dlg .resumo-filtro .chip').count() == 3, 'filtro Todos/Sprint/Box no resumo')
    pg.click('#dlg [data-act=resumo-culto-filtro][data-id=sprint]')
    culto_sprint = pg.locator('#dlg .rp').count()
    pg.click('#dlg [data-act=resumo-culto-filtro][data-id=todos]')
    checar(0 < culto_sprint < pg.locator('#dlg .rp').count(), 'filtro por culto no resumo')
    s.print('resumo-presentes', full=False)
    # chamadas do culto encerrado: quem não chamou aparece primeiro
    pg.click('#dlg [data-act=resumo-aba][data-id=chamadas]')
    pg.wait_for_selector('#dlg .ch-card')
    primeiro = pg.locator('#dlg .ch-card').first.inner_text()
    checar(primeiro.startswith('Téo') and 'Não chamou' in primeiro, f'aba Chamadas: {primeiro[:60]!r}')
    s.print('resumo-chamadas', full=False)
    # resumo curto pro grupo (no computador, copia)
    s.js("(navigator.clipboard.writeText = t => (window.__copiado = t, Promise.resolve()), 0)")
    pg.click('#dlg [data-act=compartilhar-resumo]')
    pg.wait_for_timeout(400)
    texto = s.js('window.__copiado || ""')
    checar(texto.startswith('*Box Day*') and 'Chamadas: 39 de 44 feitas' in texto and 'Sprint 17h' in texto, f'texto pro grupo: {texto!r}')
    pg.click('#dlg [data-act=resumo-aba][data-id=faltas]')
    alvo = pg.locator('#dlg .just-lista li:has(.link-btn)').first
    nome = alvo.locator('.jf-nome').inner_text()
    alvo.locator('.link-btn').click()
    pg.wait_for_selector('#dlg2[open]')
    pg.click('#dlg2 [data-motivo=viagem]')
    pg.fill('#dlg2 textarea', 'Voltou no domingo')
    pg.click('#dlg2 [data-salvar]')
    pg.wait_for_timeout(700)
    checar('Viagem · Voltou no domingo' in pg.locator(f'#dlg .just-lista li:has-text("{nome}")').inner_text(), 'justificativa no resumo')
    pg.keyboard.press('Escape')
    pg.wait_for_timeout(450)
    # frequência nos detalhes do jovem
    s.aba('jovens')
    pg.fill('#busca', 'Isa')
    pg.locator('#jlista .jcard', has=pg.locator('strong', has_text=re.compile(r'^Isa$'))).click()
    pg.wait_for_selector('#dlg[open] .freq-resumo')
    checar('Veio em 1 de 3' in pg.inner_text('#dlg .freq-resumo'), 'frequência por pessoa')
    pg.keyboard.press('Escape')
    pg.wait_for_timeout(450)
    # Minha lista: "não vai" pede o motivo
    s.aba('minha')
    pg.locator('.pcard').first.locator('button:has-text("Não vai")').click()
    pg.wait_for_timeout(200)
    pg.locator('.pcard-just .link-btn').first.click()
    pg.wait_for_selector('#dlg2[open]')
    pg.click('#dlg2 [data-motivo=trabalho]')
    pg.click('#dlg2 [data-salvar]')
    pg.wait_for_timeout(700)
    checar('Trabalho' in pg.inner_text('.pcard-just'), 'motivo na Minha lista')


def t_encerrar_evento(s):
    pg = s.entrar()
    s.aba('gerenciar')
    pg.click('.mg-head .btn.primary')
    pg.fill('#form-dlg input[name=nome]', 'Culto de Ontem')
    pg.fill('#form-dlg input[name=data]', '2026-09-29')
    pg.click('#form-dlg button[type=submit]')
    pg.wait_for_timeout(1500)
    checar(pg.locator('.hero-acao [data-act=encerrar-evento]').count() == 1, 'botão de encerrar no evento que já aconteceu')
    s.print('evento-passado', full=False)
    pg.click('.hero-acao [data-act=encerrar-evento]')
    pg.wait_for_selector('#dlg2[open]')
    pg.click('#dlg2 [data-r="1"]')
    pg.wait_for_timeout(900)
    ev = s.js("B.S.data.eventos.find(e => e.nome === 'Culto de Ontem')")
    checar(ev['arquivado'] and ev['presenca_encerrada_em'], 'evento arquivado com a presença encerrada')
    checar(pg.locator('.ev-nome').inner_text().upper() != 'CULTO DE ONTEM', 'continuou no evento encerrado')
    s.aba('historico')
    pg.click('[data-act=hist-modo][data-id=presencas]')
    checar(pg.locator('[data-act=resumo-culto]:has-text("Culto de Ontem")').count() == 1, 'evento encerrado no histórico')
    # sem nenhum evento aberto: histórico continua funcionando e as outras abas orientam
    s.js("(B.S.data.eventos.forEach(e => e.arquivado = true), B.S.eventoId = null, B.render(), 0)")
    checar(pg.locator('[data-act=resumo-culto]').count() >= 3, 'histórico sem evento aberto')
    s.aba('jovens')
    checar(pg.locator('.sem-evento [data-act=tab][data-id=historico]').count() == 1, 'tela sem evento sem o atalho pro histórico')


def t_apelido(s):
    pg = s.entrar()
    s.aba('gerenciar')
    pg.click('.mg-abas >> text=Jovens')
    for termo in ['Enzinho', 'enzo gabriel']:
        pg.fill('#busca-mg', termo)
        pg.wait_for_timeout(80)
        card = pg.locator('#mglista .jcard').first
        checar(card.locator('strong').first.inner_text() == 'Enzinho' and 'Enzo Gabriel' in card.inner_text(), f'apelido na busca "{termo}"')
    msg = s.js("B.mensagem(B.evento(), B.S.data.jovens.find(j => j.apelido === 'Enzinho'))")
    checar(msg.startswith('Oi, Enzinho!'), f'mensagem com apelido: {msg[:30]!r}')
    pg.fill('#busca-mg', '')
    checar('Lalá' in pg.inner_text('.sug-apelidos'), 'sugestão de apelido')
    s.print('sugestoes-apelido', full=False)
    pg.click('[data-act=apelido-usar]')
    pg.wait_for_timeout(600)
    j = s.js("B.S.data.jovens.find(j => j.apelido === 'Lalá')")
    checar(j and j['nome'] == 'Laís Fernandes', f'confirmar apelido: {j}')
    checar(pg.locator('.sug-apelidos').count() == 0, 'sugestão continuou na lista')


TESTES = [t_minha_lista, t_equipe_historico, t_jovens_e_busca, t_presenca, t_presenca_no_dia,
          t_modais_e_cadastros, t_aniversarios, t_abas_e_pwa, t_campos_sem_zoom_e_sem_estouro,
          t_presenca_cultos_e_encerrar, t_historico_presencas_e_justificativas, t_encerrar_evento, t_apelido]


def rodar(prints=None):
    from playwright.sync_api import sync_playwright
    base = servidor()
    if prints:
        os.makedirs(prints, exist_ok=True)
    falhas = 0
    with sync_playwright() as p:
        b = p.chromium.launch()
        for tela in ['desktop', 'celular']:
            for t in TESTES:
                quando = NO_DIA if t is t_presenca_no_dia else ANTES
                s = Sessao(b, base, tela, quando, prints)
                try:
                    t(s)
                    s.fechar()
                    print(f'  ok    {tela:8} {t.__name__[2:]}')
                except Exception as e:  # noqa: BLE001
                    falhas += 1
                    print(f'  FALHA {tela:8} {t.__name__[2:]}: {e}')
                    s.ctx.close()
        b.close()
    print(f'\n{len(TESTES) * 2 - falhas} ok, {falhas} falha(s)')
    return falhas


def comparar(a, b):
    from PIL import Image, ImageChops
    nomes = sorted(set(os.listdir(a)) | set(os.listdir(b)))
    difs = 0
    for n in nomes:
        pa, pb = os.path.join(a, n), os.path.join(b, n)
        if not (os.path.exists(pa) and os.path.exists(pb)):
            print(f'  falta {n}'); difs += 1; continue
        ia, ib = Image.open(pa).convert('RGB'), Image.open(pb).convert('RGB')
        if ia.size != ib.size:
            print(f'  DIFERENTE {n}: tamanho {ia.size} × {ib.size}'); difs += 1; continue
        # ignora ruído de até 2 tons (o desfoque atrás dos modais varia um pouquinho)
        caixa = ImageChops.difference(ia, ib).convert('L').point(lambda v: 255 if v > 2 else 0).getbbox()
        if caixa:
            print(f'  DIFERENTE {n}: região {caixa}'); difs += 1
        else:
            print(f'  igual {n}')
    print(f'\n{len(nomes) - difs} iguais, {difs} diferente(s)')
    return difs


if __name__ == '__main__':
    if '--comparar' in sys.argv:
        i = sys.argv.index('--comparar')
        sys.exit(1 if comparar(sys.argv[i + 1], sys.argv[i + 2]) else 0)
    pasta = sys.argv[sys.argv.index('--prints') + 1] if '--prints' in sys.argv else None
    sys.exit(1 if rodar(pasta) else 0)
