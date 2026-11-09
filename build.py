#!/usr/bin/env python3
"""Mata Adentro — monta o jogo num único HTML (código + áudio embutido em base64).

Uso: python3 build.py            -> dist/mata-adentro.html (e docs/index.html, para o GitHub Pages)
     python3 build.py --no-audio -> versão leve para testes rápidos
     python3 build.py --test     -> também gera dist/teste.html com o robô de testes (tests/bot.js)
"""
import base64, glob, json, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")
ENC = os.path.join(ROOT, "audio", "enc")
OUT = os.path.join(ROOT, "dist", "mata-adentro.html")
PAGES = os.path.join(ROOT, "docs", "index.html")  # cópia servida pelo GitHub Pages (branch main, pasta /docs)

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
    if "--no-audio" not in sys.argv:  # a versão leve nunca vai para o Pages
        os.makedirs(os.path.dirname(PAGES), exist_ok=True)
        open(PAGES, "w", encoding="utf-8").write(html)
    if "--test" in sys.argv:
        bot = open(os.path.join(ROOT, "tests", "bot.js"), encoding="utf-8").read()
        light = open(os.path.join(SRC, "index.html"), encoding="utf-8").read().replace("/*AUDIO*/", "const AUDIO_DATA = {};").replace("/*GAME*/", js + "\n" + bot)
        open(os.path.join(ROOT, "dist", "teste.html"), "w", encoding="utf-8").write(light)
    print(f"{OUT}: {len(html.encode()) / 1e6:.2f} MB, {len(audio)} faixas de áudio, {len(js.splitlines())} linhas de código")

if __name__ == "__main__":
    main()
