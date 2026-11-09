# Mata Adentro

Jogo de plataforma 2D de navegador: Zé Trilha atravessa a Mata Atlântica atrás do ídolo de ouro em partidas de até 5 minutos. A especificação (PRD) é mantida fora deste repositório.

## Jogar

Abra `dist/mata-adentro.html` em qualquer navegador desktop atual. O arquivo é único e já traz código, arte e áudio embutidos (3,4 MB).

Parâmetros de URL:
- `?seed=12345` abre uma trilha específica.
- `?debug` mostra o FPS e libera atalhos de teste: teclas 1–0 levam à área, G deixa o Zé imortal, H mostra as caixas de colisão e U leva ao subterrâneo.

## Montar

```bash
python3 build.py
```

O comando junta os arquivos de `src/*.js` (em ordem numérica) com as faixas de `audio/enc/*.mp3`, convertidas em base64, e gera `dist/mata-adentro.html`.

| Arquivo | Conteúdo |
|---|---|
| `src/01-util.js` | Mulberry32, paleta e fonte em pixel com acentos |
| `src/02-input.js` | teclado e Gamepad API |
| `src/03-audio.js` | Web Audio: trilha em laço, efeitos sintetizados, falas com legenda e música abaixando sob a voz |
| `src/04-world.js` | gerador das 10 áreas e dos 2 subterrâneos (catálogo de modelos feitos à mão) |
| `src/05-art.js` | Zé Trilha, cenário em parallax e sprites, tudo desenhado em código |
| `src/06-game.js` | física, perigos, pontuação e desenho do mundo |
| `src/07-main.js` | telas, menus, HUD e laço de passo fixo (1/60 s) |

A trilha vem de `audio/compose.py`, que escreve as partituras. O `audio/process.sh` fecha os laços e comprime as faixas.

## Testar

```bash
python3 build.py --test
```

O comando gera `dist/teste.html` sem áudio e com o robô de `tests/bot.js`. No console do navegador:

```js
botMany([20261107, 4242, 55])          // rota pela superfície
botMany([20261107], { route: 'under' }) // rota pelos atalhos subterrâneos
```

O robô lê o ritmo de cada perigo e atravessa a partida. Ele serve para provar que toda trilha gerada é vencível.
