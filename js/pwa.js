// Instalar como app (PWA).
import { LS, S } from './estado.js';
import { ICON } from './icones.js';
import { render } from './render.js';
import { $, toast } from './util.js';

export let pedidoInstalar = null;

export const comoApp = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Cartão de instalar: Android/Chrome instala com um toque; iPhone mostra o passo a passo.
export function cartaoInstalar({ dispensavel = false } = {}) {
  if (comoApp()) return '';
  if (dispensavel && LS.get('pwa-dispensado')) return '';
  const ios = ehIOS();
  if (!pedidoInstalar && !ios) return '';
  return `
    <div class="instalar ${dispensavel ? 'dispensavel' : ''}">
      <img src="icons/icon-192.png" alt="" width="44" height="44">
      <div class="instalar-txt">
        <strong>Instale o Chamada BOX</strong>
        <small>${ios
          ? `No Safari, toque em ${ICON.compartilhar} <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.`
          : 'Abre em tela cheia, direto da tela inicial, como um app.'}</small>
      </div>
      ${ios ? '' : '<button class="btn primary small" data-act="instalar">Instalar</button>'}
      ${dispensavel ? `<button class="x" data-act="instalar-dispensar" aria-label="Agora não">${ICON.xis}</button>` : ''}
    </div>`;
}

export function iniciarPWA() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    pedidoInstalar = e;
    if (S.data && S.me) render();
  });

  window.addEventListener('appinstalled', () => {
    pedidoInstalar = null;
    toast('App instalado! Procure o ícone “Chamada BOX” na tela inicial.');
    if (S.data && S.me) render();
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
}

export async function instalarApp() {
  if (!pedidoInstalar) return;
  pedidoInstalar.prompt();
  const { outcome } = await pedidoInstalar.userChoice;
  if (outcome === 'accepted') pedidoInstalar = null;
  render();
}
