# QC: score frames, fix the worst, repeat

You can read images, so you can watch your own output. QC catches most defects before the user does.

## Loop
1. While iterating, render stills at scene midpoints and at the tricky frames: just after each cut
   (whip-in), mid-flip, a sprite at full lift, and the camera's extreme keys.
   Combine them: `ffmpeg -i a.png -i b.png ... -filter_complex "[0]scale=360:-1[a];...;[a][b]...hstack=N" sheet.png`.
2. After rendering, run `bash <skill>/scripts/qc.sh out/promo.mp4`: a 6-wide sheet of one frame every
   2.5 s, plus loudness. Use `qc.sh out/promo.mp4 30` for one per second. The sheet judges composition;
   to judge **text readability**, also extract and read 2–3 full-res frames per scene
   (`ffmpeg -ss <sec> -i out/promo.mp4 -frames:v 1 f.png`).
3. Read the sheet. Score each frame 1–10 using the rubric. Write down the three worst frames, find
   the cause in code, fix it, re-render only the affected stills to confirm, then re-render the video.
4. Done when every frame scores 8 or more (frames mid-whip are judged as motion blur and are fine) and audio passes.

## Rubric (any of these caps the score)
| Cap | Defect |
|---|---|
| 3 | Real personal data, a lock screen or other apps visible; fake or invented UI |
| 4 | Text overlapping UI text (captions on live screens); a headline clipped at the frame edge |
| 5 | Frame nearly empty (mid-flip or mid-transition with nothing else on screen) |
| 6 | Important numbers or labels cut off at the edge by a camera push; a sprite crop showing a neighbour sliver |
| 6 | Same layout as the previous scene; the subject dead-centre and static |
| 7 | Text too small to read on a phone (under about 30 px at 1080 wide); clutter, too many elements |
| 8 | Clean, readable, one clear focal point, brand-consistent |
| 9–10 | Also has a striking moment: a lift-out, a split, a travel, or a deliberate composition |

## Known defects and their fixes
- **Headline clipped by a camera push:** apply the headline-safe inequality in `motion.md` to every key.
- **Sliver of an adjacent card on a sprite:** the crop rect includes a carousel neighbour.
  Re-measure on a full-res frame and tighten x1/x2.
- **Captions unreadable:** they sit over live UI. Move them onto a `Veil` (0.9 or more) or bare
  background, or cut them; the marker can carry the point.
- **Empty frame during a flip:** shorten the flip to about 10 f, and bring the next elements in during it.
- **Notification banner clipped by the window feather:** place it lower (`top` 250 or more).
- **Duplicate or inconsistent numbers between scenes:** seed and re-seed, so the state chains
  logically from one scene to the next.
- **Recording ended before the payoff:** run `rec` and the taps in one command; extend the time limit.
- **Off-centre layout pushed off the edge:** after adding camera scale, recheck `x ± w/2`.

## Audio checks
- Integrated loudness about −14 LUFS (−13.5 to −14.5), true peak at most −1 dB, no clicks at
  cuts or at the end (a fade or a final hit).
- With the generated track, `compose.py` prints the onset error per cut: under 5 ms on groove cuts.
- Spectrogram of the music: band-limited percussion, no broadband noise wall, no aliasing.
