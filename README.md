# Mata Adentro

Jogo de plataforma 2D de navegador: Zé Trilha atravessa a Mata Atlântica numa campanha de 5 fases, cada uma com 5 minutos e uma relíquia de ouro no fim. A especificação (PRD) é mantida fora deste repositório.

| Fase | Cenário | Relíquia | Perigos novos |
|---|---|---|---|
| 1 | Mata Adentro (10 áreas) | Ídolo de ouro | troncos, cipós, jacarés, areia movediça, escorpiões no subterrâneo |
| 2 | Mangue na maré (8 áreas) | Concha dourada | maré que alaga o chão, raízes aéreas, caranguejo-uçá, lama |
| 3 | Serra e cachoeira (8 áreas) | Máscara de pedra-verde | pedras rolando, rio com pedras que afundam, cortina da cachoeira |
| 4 | Copa das árvores (8 áreas) | Pena do gavião-real | sem chão, pontes de cipó, galhos secos, macaco-prego, tirolesa |
| 5 | Caverna do ouro (8 áreas) | Coração de ouro | estalactites, morcegos, lajes que desmoronam, vagonete |

Os pontos se acumulam entre as fases, e cada fase concluída dá uma vida extra (até 5). Na derrota, "Tentar a fase de novo" recomeça a fase com 3 vidas e os pontos que o jogador tinha ao entrar nela. A tela inicial guarda a fase mais avançada em "Continuar".

## Jogar

Online: https://andre-cardia.github.io/mata-adentro/

Ou localmente: abra `dist/mata-adentro.html` em qualquer navegador atual. O arquivo é único e já traz código, arte e áudio embutidos (cerca de 8 MB).

### No celular

O jogo é um web app instalável (PWA) e se joga com o celular deitado. Controles na tela: direcional à esquerda (andar, subir e descer escadas; dá para deslizar o polegar entre as setas), PULAR à direita e pausa no canto. Eles só aparecem em aparelhos de toque e somem nos menus, onde se toca direto nas opções. Em retrato aparece o aviso "gire o celular" e a partida pausa.

- **Android (Chrome):** ao deitar o celular (ou ao sair da tela cheia) aparece "TOQUE PARA JOGAR EM TELA CHEIA". O navegador só deixa entrar em tela cheia com um toque, e esse toque não vira pulo nem escolha de menu. A tela trava em paisagem e, se houver partida, ela fica pausada até o jogador continuar. Para abrir sempre em tela cheia, use "Instalar app" ou "Adicionar à tela inicial" no menu do Chrome.
- **iPhone (Safari):** o Safari não tem tela cheia para páginas. Ao deitar o celular, uma dica (uma vez por sessão; fechada no ✕, não volta mais) ensina a tocar em Compartilhar e depois em "Adicionar à Tela de Início". Aberto pelo ícone, o jogo ocupa a tela inteira.

Depois da primeira visita o jogo abre sem internet: um service worker guarda a página e os ícones.

Parâmetros de URL:
- `?seed=12345` abre uma trilha específica (a mesma semente gera as 5 fases).
- `?fase=3` faz o "Jogar" começar direto na fase 3.
- `?toque` mostra os controles de toque também no computador (teste); `?ios` simula o Safari do iPhone para ver a dica da Tela de Início.
- `?debug` mostra o FPS e libera atalhos de teste: teclas 1–0 levam à área, G deixa o Zé imortal, H mostra as caixas de colisão e U leva ao subterrâneo (fase 1).

## Montar

```bash
python3 build.py
```

O comando também copia o jogo para `docs/index.html`, que é o que o GitHub Pages serve (branch `main`, pasta `/docs`). Depois de montar, faça commit de `dist/` e `docs/`.

O comando junta os arquivos de `src/*.js` (em ordem numérica) com as faixas de `audio/enc/*.mp3`, convertidas em base64, e gera `dist/mata-adentro.html`. Ao lado de cada HTML (em `dist/` e em `docs/`) ele escreve também o PWA: `manifest.webmanifest`, `sw.js` (rede primeiro, cache como reserva; o nome do cache muda a cada build) e `icons/`. Os ícones são feitos a partir do ídolo de ouro do jogo por `src/icons/make.py` (precisa do Pillow) e ficam versionados; o build só os copia.

| Arquivo | Conteúdo |
|---|---|
| `src/01-util.js` | Mulberry32, paleta e fonte em pixel com acentos |
| `src/02-input.js` | teclado, Gamepad API e os códigos virtuais dos botões de toque |
| `src/03-audio.js` | Web Audio: trilha em laço, efeitos sintetizados, falas com legenda e música abaixando sob a voz |
| `src/04-world.js` | gerador da fase 1 (10 áreas e 2 subterrâneos, catálogo de modelos feitos à mão) e a tabela das 5 fases |
| `src/04b-fases.js` | geradores das fases 2 a 5 (8 áreas cada) |
| `src/05-art.js` | Zé Trilha, cenário em parallax e sprites, tudo desenhado em código |
| `src/05b-art-fases.js` | cenários do mangue, da serra, da copa e da caverna, sprites dos perigos novos e as relíquias |
| `src/06-game.js` | física, perigos, pontuação e desenho do mundo |
| `src/06b-mecanicas.js` | plataformas (fixas, que balançam, afundam, quebram ou andam), maré, lama, tirolesa e perigos das fases novas |
| `src/07-main.js` | telas, menus, HUD e laço de passo fixo (1/60 s) |
| `src/08-mobile.js` | celular: controles de toque com multitoque, tela cheia, trava em paisagem, áudio liberado no primeiro toque (iOS) e registro do service worker |
| `src/index.html` | molde da página: metas do PWA e do iOS, área segura, CSS dos controles e o aviso de retrato |

A trilha vem de `audio/compose.py`, que escreve as partituras. O `audio/process.sh` fecha os laços e comprime as faixas.

## Testar

```bash
python3 build.py --test
```

Use `python3 build.py --test --no-audio` durante o desenvolvimento: ele não toca em `docs/index.html`.

O comando gera `dist/teste.html` sem áudio e com os robôs de `tests/bot.js`. No console do navegador:

```js
botMany([20261107, 4242, 55])          // fase 1, rota pela superfície
botMany([20261107], { route: 'under' }) // fase 1, rota pelos atalhos subterrâneos
planMany([20261107, 4242, 55], 3)      // fases 2 a 5: robô planejador na fase indicada
```

O robô da fase 1 lê o ritmo de cada perigo. O planejador das fases novas copia a partida, simula jogadas curtas (correr, esperar, pular, pulo curto, recuar) e executa a que sobrevive e avança mais. Como os perigos seguem o relógio do jogo, a simulação prevê exatamente o que vai acontecer. Os dois servem para provar que toda trilha gerada é vencível.
