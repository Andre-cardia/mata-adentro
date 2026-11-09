#!/usr/bin/env python3
"""Mata Adentro — monta o jogo num único HTML (código + áudio embutido em base64).

Uso: python3 build.py            -> dist/mata-adentro.html (e docs/index.html, para o GitHub Pages)
                                    + PWA ao lado de cada HTML: manifest.webmanifest, sw.js e icons/
     python3 build.py --no-audio -> versão leve para testes rápidos
     python3 build.py --test     -> também gera dist/teste.html com o robô de testes (tests/bot.js)
"""
import base64, glob, hashlib, json, os, shutil, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
ENC = os.path.join(ROOT, "audio", "enc")
OUT = os.path.join(ROOT, "dist", "mata-adentro.html")
PAGES = os.path.join(ROOT, "docs", "index.html")  # cópia servida pelo GitHub Pages (branch main, pasta /docs)
ICONS = os.path.join(ROOT, "src", "icons")          # gerados por src/icons/make.py

# ---------------------------------------------------------------- PWA: manifesto, service worker e ícones ao lado do HTML
ICON_FILES = ["icon-192.png", "icon-512.png", "icon-maskable-192.png", "icon-maskable-512.png", "apple-touch-icon.png", "favicon-32.png"]

def manifest(start):
    icons = [{"src": f"icons/icon-{n}.png", "sizes": f"{n}x{n}", "type": "image/png", "purpose": "any"} for n in (192, 512)]
    icons += [{"src": f"icons/icon-maskable-{n}.png", "sizes": f"{n}x{n}", "type": "image/png", "purpose": "maskable"} for n in (192, 512)]
    return {
        "name": "Mata Adentro", "short_name": "Mata Adentro", "lang": "pt-BR", "dir": "ltr",
        "description": "Jogo de plataforma 2D pela Mata Atlântica: cinco fases atrás das relíquias de ouro.",
        "id": "./", "start_url": start, "scope": "./",
        "display": "fullscreen", "display_override": ["fullscreen", "standalone"], "orientation": "landscape",
        "background_color": "#000000", "theme_color": "#0d1410", "categories": ["games", "entertainment"], "icons": icons,
    }

SW = """// Mata Adentro — service worker (gerado pelo build.py). Rede primeiro, cache como reserva: abre sem internet
// depois da primeira visita e pega a versão nova assim que houver conexão.
const PREFIX = 'mata-adentro:' + self.registration.scope + ':'; // um cache por escopo: dist/ e docs/ não se apagam
const CACHE = PREFIX + '%(version)s';
const START = %(start)s;
const FILES = %(files)s;
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const nav = req.mode === 'navigate', key = nav ? url.origin + url.pathname : req; // ?fase=N usa a mesma cópia
  const fromCache = () => caches.match(key).then(r => r || (nav ? caches.match(START) : undefined));
  const fromNet = fetch(req).then(res => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
    return res;
  });
  // rede lenta: depois de 4 s a cópia guardada assume (o HTML tem uns 8 MB com o áudio)
  const slow = new Promise(res => setTimeout(res, 4000)).then(fromCache).then(r => r || fromNet);
  e.respondWith(Promise.race([fromNet.catch(() => fromCache()), slow]).then(r => r || fromNet));
});
"""

def write_pwa(folder, html_name, html):
    start = "./" if html_name == "index.html" else "./" + html_name
    os.makedirs(os.path.join(folder, "icons"), exist_ok=True)
    for f in ICON_FILES:
        shutil.copyfile(os.path.join(ICONS, f), os.path.join(folder, "icons", f))
    man = json.dumps(manifest(start), ensure_ascii=False, indent=2)
    open(os.path.join(folder, "manifest.webmanifest"), "w", encoding="utf-8").write(man + "\n")
    version = hashlib.sha1((html + man + SW).encode()).hexdigest()[:10]
    files = [start, "manifest.webmanifest"] + ["icons/" + f for f in ICON_FILES]
    open(os.path.join(folder, "sw.js"), "w", encoding="utf-8").write(SW % {"version": version, "start": json.dumps(start), "files": json.dumps(files)})

def main():
    js = "\n".join(open(p, encoding="utf-8").read() for p in sorted(glob.glob(os.path.join(SRC, "*.js"))))
    audio = {}
    if "--no-audio" not in sys.argv:
        for p in sorted(glob.glob(os.path.join(ENC, "*.mp3"))):
            audio[os.path.splitext(os.path.basename(p))[0]] = base64.b64encode(open(p, "rb").read()).decode()
    audio_js = "const AUDIO_DATA = " + json.dumps(audio, separators=(",", ":")) + ";"
    html = open(os.path.join(SRC, "index.html"), encoding="utf-8").read()
    html = html.replace("/*AUDIO*/", audio_js).replace("/*GAME*/", js.replace("</script", "<\\/script"))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, "w", encoding="utf-8").write(html)
    write_pwa(os.path.dirname(OUT), os.path.basename(OUT), html)
    if "--no-audio" not in sys.argv:  # a versão leve nunca vai para o Pages
        os.makedirs(os.path.dirname(PAGES), exist_ok=True)
        open(PAGES, "w", encoding="utf-8").write(html)
        write_pwa(os.path.dirname(PAGES), os.path.basename(PAGES), html)
    if "--test" in sys.argv:
        bot = open(os.path.join(ROOT, "tests", "bot.js"), encoding="utf-8").read()
        light = open(os.path.join(SRC, "index.html"), encoding="utf-8").read().replace("/*AUDIO*/", "const AUDIO_DATA = {};").replace("/*GAME*/", js + "\n" + bot)
        open(os.path.join(ROOT, "dist", "teste.html"), "w", encoding="utf-8").write(light)
    print(f"{OUT}: {len(html.encode()) / 1e6:.2f} MB, {len(audio)} faixas de áudio, {len(js.splitlines())} linhas de código")

if __name__ == "__main__":
    main()
