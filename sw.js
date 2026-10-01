// Service worker do Chamada BOX.
// Rede primeiro: sempre tenta a versão mais nova do site e só usa a cópia
// guardada quando está sem internet. Dados do Supabase (outro domínio)
// nunca passam por aqui nem ficam guardados no aparelho.
const CACHE = 'chamada-box-v3';
const ARQUIVOS = [
  './', './index.html', './config.js', './manifest.webmanifest', './icons/icon-192.png',
  './css/base.css',
  './css/componentes.css',
  './css/entrada.css',
  './css/topo.css',
  './css/abas.css',
  './css/telas/minha.css',
  './css/telas/jovens.css',
  './css/aniversarios.css',
  './css/pwa.css',
  './css/vinculos.css',
  './css/telas/presenca.css',
  './css/telas/equipe.css',
  './css/telas/historico.css',
  './css/dialogos.css',
  './css/telas/gerenciar.css',
  './js/acoes.js',
  './js/aniversarios.js',
  './js/api.js',
  './js/busca.js',
  './js/cadastros.js',
  './js/dados.js',
  './js/demo.js',
  './js/dialogos.js',
  './js/distribuir.js',
  './js/estado.js',
  './js/formulario.js',
  './js/icones.js',
  './js/main.js',
  './js/pwa.js',
  './js/render.js',
  './js/telas/entrada.js',
  './js/telas/equipe.js',
  './js/telas/gerenciar.js',
  './js/telas/historico.js',
  './js/telas/jovens.js',
  './js/telas/minha.js',
  './js/telas/presenca.js',
  './js/util.js',
  './js/vinculos.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(nomes.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.endsWith('/__versao')) return;
  e.respondWith(
    fetch(req)
      .then(resp => {
        if (resp.ok) {
          const copia = resp.clone();
          caches.open(CACHE).then(c => c.put(req, copia));
        }
        return resp;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))),
  );
});
