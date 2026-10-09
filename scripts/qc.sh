#!/usr/bin/env bash
# QC a rendered promo:  bash qc.sh out/promo-9x16.mp4 [EVERY_N_FRAMES=75]
# Writes out/qc/sheet.png (one frame every N, tiled) and prints duration, streams, loudness and true peak.
# Then READ the sheet image and score every frame 1-10 against references/qc.md; fix the 3 worst; repeat.
set -euo pipefail
# ffmpeg drawtext needs an explicit font on Windows (no fontconfig)
FONT=""; [ -f /c/Windows/Fonts/arial.ttf ] && FONT="fontfile='C\:/Windows/Fonts/arial.ttf':"
VID="$1"; EVERY="${2:-75}"
DIR="$(dirname "$VID")/qc"; mkdir -p "$DIR"
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate:format=duration -of compact "$VID"
N=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$VID")
N="${N//[^0-9]/}"  # csv output can carry a trailing comma when the file also has audio
ROWS=$(( ( (N + EVERY - 1) / EVERY + 5 ) / 6 ))
ffmpeg -v error -i "$VID" -vf "select='not(mod(n\,$EVERY))',scale=360:-1,drawtext=${FONT}text='%{n}':x=6:y=6:fontsize=22:fontcolor=red:box=1:boxcolor=white,tile=6x${ROWS}" -vsync 0 -frames:v 1 -y "$DIR/sheet.png"
echo "sheet: $DIR/sheet.png  (6 per row; label k = frame k*$EVERY)"
echo "the sheet judges composition; for TEXT READABILITY also extract 2-3 full-res frames per scene:"
echo "  ffmpeg -v error -ss <sec> -i $VID -frames:v 1 $DIR/f<sec>.png   (then read them)"
ffmpeg -hide_banner -nostats -i "$VID" -af ebur128=peak=true:framelog=quiet -f null - 2>&1 | grep -E "^\s+(I|LRA|Peak):" || true
echo "targets: I about -14 LUFS (social), Peak <= -1.0 dBFS"
