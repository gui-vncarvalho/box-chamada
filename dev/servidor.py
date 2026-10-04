"""Servidor local do Chamada BOX, com recarga automática.

Uso:  python dev/servidor.py [porta]      (padrão: 8080)
Abre em http://localhost:8080 (dados reais) ou http://localhost:8080/?demo
(dados fictícios). Serve os arquivos sem cache e recarrega a página sozinho
quando qualquer .html/.css/.js do projeto muda.
"""
import http.server, os, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORTA = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
EXTS = ('.html', '.css', '.js')
RECARGA = b"""<script>
(() => { let v = null;
  setInterval(async () => {
    try { const n = await (await fetch('/__versao', { cache: 'no-store' })).text();
      if (v && n !== v) location.reload(); v = n; } catch {}
  }, 800);
})();
</script>"""


def versao():
    m = 0
    for base, dirs, arquivos in os.walk(RAIZ):
        dirs[:] = [d for d in dirs if not d.startswith('.') and d != '__pycache__']
        for f in arquivos:
            if f.endswith(EXTS):
                m = max(m, os.stat(os.path.join(base, f)).st_mtime_ns)
    return str(m).encode()


class Servidor(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=RAIZ, **k)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *a):
        pass

    def do_GET(self):
        caminho = self.path.split('?')[0]
        if caminho == '/__versao':
            return self._enviar(versao(), 'text/plain')
        if caminho in ('/', '/index.html'):
            with open(os.path.join(RAIZ, 'index.html'), 'rb') as f:
                return self._enviar(f.read().replace(b'</body>', RECARGA + b'</body>'), 'text/html; charset=utf-8')
        return super().do_GET()

    def _enviar(self, corpo, tipo):
        self.send_response(200)
        self.send_header('Content-Type', tipo)
        self.send_header('Content-Length', str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)


if __name__ == '__main__':
    print(f'Chamada BOX local: http://localhost:{PORTA}  (demo: http://localhost:{PORTA}/?demo)', flush=True)
    http.server.ThreadingHTTPServer(('127.0.0.1', PORTA), Servidor).serve_forever()
