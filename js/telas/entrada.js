// Tela de entrada: código de acesso e "quem é você".
import { demo } from '../demo.js';
import { DEMO, S } from '../estado.js';
import { $, esc } from '../util.js';

export function renderGate() {
  $('#app').innerHTML = `
    <div class="gate">
      <div class="marca"><div><div class="marca-nome">Chamada</div><div class="marca-sub">Diretoria · Juventude Box</div></div></div>
      <p class="dim">Central da diretoria do Box pra chamar a galera pros cultos e eventos.</p>
      ${DEMO ? '<div class="demo-banner">Modo demonstração: qualquer código entra e os dados são fictícios.</div>' : ''}
      <form id="form-login">
        <label class="field">Código de acesso da diretoria
          <input name="codigo" type="password" autocomplete="current-password" required autofocus
                 placeholder="O código que a liderança passou">
        </label>
        <div class="erro">${esc(S.erroLogin)}</div>
        <button class="btn primary" type="submit">Entrar</button>
      </form>
    </div>`;
}

export function renderQuem() {
  const ds = S.data.diretores.filter(d => d.ativo);
  const grupo = eq => ds.filter(d => d.equipe === eq)
    .map(d => `<button class="btn" data-act="sou" data-id="${d.id}">${esc(d.nome)}</button>`).join('');
  $('#app').innerHTML = `
    <div class="gate">
      <h1>Quem é <span>você?</span></h1>
      <p class="dim">Assim o site mostra a sua lista e registra quem marcou cada chamada. Fica salvo neste aparelho.</p>
      ${ds.length ? '' : '<p class="aviso">Ninguém da diretoria cadastrado ainda. Entre como visitante e cadastre em Gerenciar.</p>'}
      ${grupo('F') ? `<h3>Equipe feminina</h3><div class="pick-grid">${grupo('F')}</div>` : ''}
      ${grupo('M') ? `<h3>Equipe masculina</h3><div class="pick-grid">${grupo('M')}</div>` : ''}
      <button class="btn ghost" data-act="sou" data-id="visitante">Não estou na lista (só visualizar)</button>
    </div>`;
}
