#!/bin/bash
# Mata Adentro — pós-processamento de áudio.
# Laços: arquivo final = [1 s antes] + laço L + [1 s depois]; no jogo loopStart=1, loopEnd=1+L.
# Como o sinal é periódico, o atraso do codificador MP3 não causa emenda audível.
set -euo pipefail
cd "$(dirname "$0")"
R=render; E=enc; mkdir -p $E tmp
FF="ffmpeg -y -hide_banner -loglevel error"

loop_music () { # nome L
  local n=$1 L=$2
  $FF -i $R/$n.wav -ss $(echo "$L-1" | bc) -t $(echo "$L+2" | bc) -af "volume=0dB" -ar 44100 -ac 2 -c:a libmp3lame -b:a 96k $E/mus_$n.mp3
}
loop_music tema 40
loop_music mata 60
loop_music sub 30

# Ambientes: laço por crossfade de 3 s → P (periódico), depois margem de 1 s
amb () { # nome L
  local n=$1 L=$2 T=$(( $2 + 3 ))
  $FF -i $R/$n.wav -filter_complex "[0:a]atrim=0:$T,asetpts=PTS-STARTPTS,asplit[x][y];[x]atrim=3:$T,asetpts=PTS-STARTPTS[body];[y]atrim=0:3,asetpts=PTS-STARTPTS[head];[body][head]acrossfade=d=3:c1=tri:c2=tri[p]" -map "[p]" tmp/$n.p.wav
  $FF -i tmp/$n.p.wav -i tmp/$n.p.wav -i tmp/$n.p.wav -filter_complex "[0][1][2]concat=n=3:v=0:a=1,atrim=$((L-1)):$((2*L+1)),asetpts=PTS-STARTPTS[o]" -map "[o]" -ac 1 -ar 32000 -c:a libmp3lame -b:a 48k $E/$n.mp3
}
amb amb_mata 30
amb amb_sub 20

for n in vitoria derrota; do
  $FF -i $R/$n.wav -af "afade=t=out:st=$( [ $n = vitoria ] && echo 5 || echo 3.2 ):d=0.8" -ar 44100 -ac 2 -c:a libmp3lame -b:a 96k $E/mus_$n.mp3
done
for n in fogueira mordida afundar idolo; do
  $FF -i $R/sfx_$n.wav -ac 1 -ar 32000 -c:a libmp3lame -b:a 64k $E/sfx_$n.mp3
done

# Falas: corta silêncio das pontas, normaliza a -16 LUFS, leve compressão de voz
for f in falas/*.wav; do
  n=$(basename $f .wav)
  $FF -i $f -af "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,highpass=f=80,acompressor=threshold=-20dB:ratio=3:attack=5:release=80,loudnorm=I=-16:TP=-1.5:LRA=9,apad=pad_dur=0.15" -ar 24000 -ac 1 -c:a libmp3lame -b:a 48k $E/voz_$n.mp3
done
rm -rf tmp
ls -la $E; du -ch $E/* | tail -1
