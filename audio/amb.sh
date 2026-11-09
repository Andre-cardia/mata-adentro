#!/bin/bash
# Mata Adentro — ambientes sintetizados das fases 2–5 (só ffmpeg: anoisesrc, aevalsrc e filtros).
# Gera audio/enc/amb_{mangue,serra,copa,caverna}.mp3 pelo mesmo método da função amb do process.sh:
# laço L por crossfade de 3 s → sinal periódico P; arquivo final = [1 s antes] + L + [1 s depois].
# No jogo: loopStart=1, loopEnd=1+L.
# Todas as modulações e eventos (ondas, estalos, chilreios, gotas) têm período que divide L,
# então o crossfade só mistura ruído contínuo; os eventos caem alinhados e não dobram.
# Nível: cada laço é ajustado a -23 LUFS (amb_mata.mp3 mede -23,3; amb_sub, -21,7).
set -euo pipefail
cd "$(dirname "$0")"
E=enc; TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT; mkdir -p $E
FF="ffmpeg -y -hide_banner -loglevel error"
SR=48000
ALVO=-23   # LUFS

# --- Mangue (L=30): marolas que respiram a cada 6 s + estalos de caranguejo em rajadas ---
mangue () { local T=$1
  local ONDA="sin(2*PI*t/6+0.9*sin(2*PI*t/30))"
  $FF -filter_complex "
    anoisesrc=d=$T:r=$SR:c=brown:a=0.9:s=11,highpass=f=60,lowpass=f=700[b];
    aevalsrc='0.25+0.75*pow(0.5+0.5*$ONDA,3)':d=$T:s=$SR[eb];
    [b][eb]amultiply[w1];
    anoisesrc=d=$T:r=$SR:c=pink:a=0.5:s=12,bandpass=f=1800:width_type=o:w=2[p];
    aevalsrc='pow(0.5+0.5*sin(2*PI*t/6+0.9*sin(2*PI*t/30)-1.2),6)':d=$T:s=$SR[ep];
    [p][ep]amultiply[w2];
    aevalsrc='0.7*gt(sin(2*PI*t*7/30+2.5*sin(2*PI*t/10)),0.94)*exp(-mod(t,0.0375)*300)*(2*random(0)-1)+0.5*gt(sin(2*PI*t*11/30+1.7),0.97)*exp(-mod(t,0.03)*350)*(2*random(1)-1)':d=$T:s=$SR,highpass=f=2500,lowpass=f=9000[c];
    [w1][w2][c]amix=inputs=3:normalize=0:weights='1 0.6 0.35'[o]" -map "[o]" -ac 1 $TMP/amb_mangue.wav
}

# --- Serra (L=30): rugido grave e contínuo de queda d'água, com leve pulsação ---
serra () { local T=$1
  $FF -filter_complex "
    anoisesrc=d=$T:r=$SR:c=brown:a=1:s=21,highpass=f=35,lowpass=f=900,equalizer=f=110:t=q:w=1:g=5[r1];
    anoisesrc=d=$T:r=$SR:c=pink:a=0.6:s=22,highpass=f=200,lowpass=f=3500[r2];
    anoisesrc=d=$T:r=$SR:c=white:a=0.15:s=23,bandpass=f=4500:width_type=o:w=1.5[r3];
    [r1][r2][r3]amix=inputs=3:normalize=0:weights='1 0.55 0.35'[m];
    aevalsrc='0.88+0.07*sin(2*PI*t/5)+0.05*sin(2*PI*t/7.5+1)':d=$T:s=$SR[e];
    [m][e]amultiply[o]" -map "[o]" -ac 1 $TMP/amb_serra.wav
}

# --- Copa (L=30): vento em rajadas nas folhas + três pássaros sintetizados ---
copa () { local T=$1
  local RAJ="(0.5+0.5*sin(2*PI*t/15+0.7*sin(2*PI*t/10)))"
  # (as durações de nota — 0,15, 0,5 e 0,05 s — dividem os 30 s do laço)
  # pássaro 1: frases de notas curtas subindo (3,4→5,3 kHz); pássaro 2: assobio descendente;
  # pássaro 3: trinado agudo. u = tempo dentro da nota, fase reiniciada a cada nota (envelope zera nas bordas).
  local P1="gt(sin(2*PI*t*3/30+1.1*sin(2*PI*t/15)),0.75)*lt(mod(t,0.15),0.08)*pow(sin(PI*mod(t,0.15)/0.08),2)*sin(2*PI*(3400*mod(t,0.15)+12000*pow(mod(t,0.15),2)))"
  local P2="gt(sin(2*PI*t*2/30+2.2),0.9)*lt(mod(t,0.5),0.3)*pow(sin(PI*mod(t,0.5)/0.3),2)*sin(2*PI*(4200*mod(t,0.5)-2500*pow(mod(t,0.5),2)))"
  local P3="gt(sin(2*PI*t*5/30+0.4+0.8*sin(2*PI*t/6)),0.96)*lt(mod(t,0.05),0.03)*sin(PI*mod(t,0.05)/0.03)*sin(2*PI*6000*mod(t,0.05))"
  $FF -filter_complex "
    anoisesrc=d=$T:r=$SR:c=pink:a=0.7:s=31,highpass=f=300,lowpass=f=6000[w];
    aevalsrc='0.25+0.75*pow($RAJ,2)':d=$T:s=$SR[ew];
    [w][ew]amultiply[v1];
    anoisesrc=d=$T:r=$SR:c=white:a=0.3:s=32,highpass=f=3000,lowpass=f=9000[f];
    aevalsrc='pow($RAJ,3)*(0.6+0.4*sin(2*PI*t*13))':d=$T:s=$SR[ef];
    [f][ef]amultiply[v2];
    aevalsrc='0.5*$P1+0.4*$P2+0.25*$P3':d=$T:s=$SR,aecho=0.8:0.5:60|140:0.25|0.12[aves];
    [v1][v2][aves]amix=inputs=3:normalize=0:weights='1 0.5 0.22'[o]" -map "[o]" -ac 1 $TMP/amb_copa.wav
}

# --- Caverna (L=20): gotas esparsas com eco + ronco grave ---
caverna () { local T=$1
  # gota: tom curto que sobe (f → f+3000*u) e decai rápido, em tempos fixos dentro do laço de 20 s
  local G=""
  for of in 0.7:1300 3.4:1700 5.1:1100 8.8:1500 11.2:1900 14.6:1250 16.3:1600 18.9:1400; do
    local o=${of%:*} f=${of#*:} u="mod(t+20-${of%:*},20)"
    G="$G+lt($u,0.3)*sin(2*PI*($f*$u+1500*pow($u,2)))*exp(-$u*35)"
  done
  $FF -filter_complex "
    aevalsrc='0.6*(0$G)':d=$T:s=$SR,aecho=0.8:0.6:90|170|290|430:0.45|0.35|0.25|0.15[g];
    anoisesrc=d=$T:r=$SR:c=brown:a=1:s=41,lowpass=f=180,highpass=f=30[r];
    aevalsrc='0.55+0.45*pow(sin(2*PI*t/10),2)':d=$T:s=$SR[er];
    [r][er]amultiply[ronco];
    aevalsrc='0.12*(sin(2*PI*55*t)+0.4*sin(2*PI*110*t))*(0.7+0.3*sin(2*PI*t/20))':d=$T:s=$SR[hum];
    [g][ronco][hum]amix=inputs=3:normalize=0:weights='1 0.8 0.6'[o]" -map "[o]" -ac 1 $TMP/amb_caverna.wav
}

# laço sem emenda (mesmo método do process.sh) + nível + codificação.
# Única diferença: curva qsin (potência constante) no lugar de tri. Estes ambientes são quase
# só ruído, que não se correlaciona entre as duas pontas, e a curva tri afundava ~3 dB no meio
# do crossfade (audível como um "respiro" a cada volta na cachoeira contínua).
CURVA=${CURVA:-qsin}
amb () { # nome L
  local n=$1 L=$2 T=$(( $2 + 3 ))
  $FF -i $TMP/$n.wav -filter_complex "[0:a]atrim=0:$T,asetpts=PTS-STARTPTS,asplit[x][y];[x]atrim=3:$T,asetpts=PTS-STARTPTS[body];[y]atrim=0:3,asetpts=PTS-STARTPTS[head];[body][head]acrossfade=d=3:c1=$CURVA:c2=$CURVA[p]" -map "[p]" $TMP/$n.p.wav
  local I; I=$(ffmpeg -hide_banner -i $TMP/$n.p.wav -af ebur128 -f null - 2>&1 | awk '/Summary/{s=1} s&&/ I:/{print $2; exit}')
  local G; G=$(echo "$ALVO - ($I)" | bc -l)
  $FF -i $TMP/$n.p.wav -i $TMP/$n.p.wav -i $TMP/$n.p.wav -filter_complex "[0][1][2]concat=n=3:v=0:a=1,atrim=$((L-1)):$((2*L+1)),asetpts=PTS-STARTPTS,volume=${G}dB[o]" -map "[o]" -ac 1 -ar 32000 -c:a libmp3lame -b:a 48k $E/$n.mp3
  echo "$n: laço ${L}s, bruto ${I} LUFS, ganho ${G} dB"
}

mangue 33;  amb amb_mangue 30
serra 33;   amb amb_serra 30
copa 33;    amb amb_copa 30
caverna 23; amb amb_caverna 20
