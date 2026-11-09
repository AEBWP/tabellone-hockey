#!/usr/bin/env bash
# Genera i suoni predefiniti del tabellone in public/sounds/ (vedi src/console/sound-presets.ts).
# Suoni originali, sintetizzati da zero con ffmpeg: niente audio di terzi.
# Formato: OGG Vorbis, mono, 44,1 kHz, picco ~ -1 dBFS. Idempotente: si può rilanciare quando si vuole.
#
# Uso: scripts/make-sounds.sh   (richiede ffmpeg con libvorbis)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/sounds"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"

RATE=44100
PEAK=-1.0   # picco desiderato in dBFS

# Riverbero "da palazzetto": riflessioni precoci + coda, filtrate (pareti e ghiaccio assorbono gli acuti).
ARENA="aecho=0.85:0.6:37|61|89|127|173|229:0.32|0.27|0.22|0.17|0.12|0.08,lowpass=f=9000"

# make NOME DURATA_SUONO CODA ESPRESSIONE
#   DURATA_SUONO: durata del suono diretto (s); CODA: secondi di riverbero dopo la fine.
#   ESPRESSIONE: forma d'onda per aevalsrc (variabile t), già con il suo inviluppo.
make() {
  local name="$1" dur="$2" tail="$3" expr="$4"
  local total raw norm max gain
  total=$(awk -v a="$dur" -v b="$tail" 'BEGIN{printf "%.3f", a+b}')
  raw="$TMP/$name.raw.wav"
  norm="$TMP/$name.wav"

  # 1) sintesi + fade anti-click (inizio 5 ms, fine 20 ms) + riverbero + fade finale della coda
  ffmpeg -nostdin -hide_banner -loglevel error -y \
    -f lavfi -i "aevalsrc=exprs='$expr':s=$RATE:c=mono:d=$dur" \
    -af "afade=t=in:d=0.005,afade=t=out:st=$(awk -v d="$dur" 'BEGIN{printf "%.3f", d-0.02}'):d=0.02,apad=pad_dur=$tail,$ARENA,afade=t=out:st=$(awk -v t="$total" 'BEGIN{printf "%.3f", t-0.25}'):d=0.25,atrim=0:$total,volume=-12dB" \
    -ac 1 -ar $RATE -c:a pcm_f32le "$raw"

  # 2) normalizzazione del picco a $PEAK dBFS (al passo 1 si attenua di 12 dB perché
  #    volumedetect misura a 16 bit e non vedrebbe i picchi sopra 0 dBFS)
  max=$(ffmpeg -nostdin -hide_banner -i "$raw" -af volumedetect -f null - 2>&1 \
        | sed -n 's/.*max_volume: \(-\?[0-9.]*\) dB.*/\1/p')
  gain=$(awk -v m="$max" -v p="$PEAK" 'BEGIN{printf "%.2f", p-m}')
  ffmpeg -nostdin -hide_banner -loglevel error -y -i "$raw" \
    -af "volume=${gain}dB" -c:a pcm_f32le "$norm"

  # 3) codifica OGG Vorbis mono 44,1 kHz (metadati tolti per uscita stabile)
  ffmpeg -nostdin -hide_banner -loglevel error -y -i "$norm" \
    -map_metadata -1 -fflags +bitexact -flags:a +bitexact \
    -ac 1 -ar $RATE -c:a libvorbis -q:a 4 "$OUT/$name.ogg"
  echo "creato public/sounds/$name.ogg (guadagno ${gain} dB)"
}

# --- Tromba ad aria: accordo d'ottone saturato che "sboccia" salendo un po' di intonazione ---
# Fase con frequenza f0*(1 - 0.05*e^(-6t)): 2*PI*f0*(t - 0.05/6*(1-e^(-6t)))
horn_voice() {  # f0 peso
  local ph="(2*PI*$1*(t-0.0083*(1-exp(-6*t))))"
  echo "$2*tanh(2.6*(sin($ph)+0.5*sin(2*$ph)+0.3*sin(3*$ph)))"
}
horn() {  # f1 f2 f3: inviluppo con attacco morbido e leggero tremolio dell'aria
  echo "(1-exp(-t*30))*(1+0.04*sin(2*PI*5.5*t))*0.3*($(horn_voice "$1" 1)+$(horn_voice "$2" 0.85)+$(horn_voice "$3" 0.7)+0.04*(random(0)-0.5))"
}
make air-horn-classic 2.5 0.9 "$(horn 155.6 196.0 233.1)"
make air-horn-deep    3.0 1.1 "$(horn 98.0 123.5 146.8)"

# --- Sirena rotante: tono che sale e scende due volte (periodo 1,5 s), timbro tra quadra e sinusoide ---
# f(t) = 700 - 300*cos(2*PI*t/1.5) → fase 2*PI*(700t - 300*1.5/(2*PI)*sin(2*PI*t/1.5))
SIREN_PH="(2*PI*700*t-450*sin(2*PI*t/1.5))"
make goal-siren 3.0 0.8 \
  "(1-exp(-t*40))*(0.55*tanh(3*sin($SIREN_PH))+0.25*sin(2*$SIREN_PH)+0.12*sin(3*$SIREN_PH))"

# --- Cicalino elettrico: due onde quadre stonate tra loro + ronzio di rete a 50 Hz, molto aspro ---
BUZZ="(0.45*tanh(9*sin(2*PI*110*t))+0.35*tanh(9*sin(2*PI*166*t))+0.2*tanh(9*sin(2*PI*331*t)))*(0.75+0.25*abs(sin(2*PI*50*t)))"
make buzzer-long  2.0 0.7 "(1-exp(-t*200))*$BUZZ"
make buzzer-short 0.6 0.5 "(1-exp(-t*200))*$BUZZ"

# --- Campanella: parziali inarmonici con decadimenti diversi (i più acuti si spengono prima) ---
make bell 1.5 0.6 \
  "(1-exp(-t*600))*(0.5*sin(2*PI*880*t)*exp(-t*2.2)+0.35*sin(2*PI*1760*t)*exp(-t*3)+0.3*sin(2*PI*2112*t)*exp(-t*4)+0.22*sin(2*PI*2640*t)*exp(-t*5.5)+0.15*sin(2*PI*3696*t)*exp(-t*8)+0.1*sin(2*PI*4752*t)*exp(-t*11)+0.25*sin(2*PI*440*t)*exp(-t*1.6))"
