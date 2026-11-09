#!/bin/bash
# Mata Adentro — codifica só as falas novas da campanha (fases 2–5) em enc/voz_<id>.mp3.
# Cadeia idêntica ao bloco "Falas" do process.sh; as falas da v1 não são reprocessadas.
# As falas foram geradas no VoiceStudio com a voz do André (perfil "Andre Cardia 01"),
# steps 32, português.
set -euo pipefail
cd "$(dirname "$0")"
E=enc; mkdir -p $E
FF="ffmpeg -y -hide_banner -loglevel error"

NOVAS="transicao reliquia final
f2_abertura mare caranguejo lama
f3_abertura pedra correnteza afunda cachoeira
f4_abertura ponte galho macaco tirolesa
f5_abertura estalactite morcego fragil vagonete"

for n in $NOVAS; do
  f=falas/$n.wav
  [ -f $f ] || { echo "falta $f" >&2; exit 1; }
  $FF -i $f -af "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,highpass=f=80,acompressor=threshold=-20dB:ratio=3:attack=5:release=80,loudnorm=I=-16:TP=-1.5:LRA=9,apad=pad_dur=0.15" -ar 24000 -ac 1 -c:a libmp3lame -b:a 48k $E/voz_$n.mp3
  echo "voz_$n.mp3 $(ffprobe -v error -show_entries format=duration -of csv=p=0 $E/voz_$n.mp3) s"
done
