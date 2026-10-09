# QC: score frames, fix the worst, repeat

You can read images, so you can watch your own output. QC catches most defects before the user does.

## Loop
1. While iterating, render stills at scene midpoints and at the tricky frames: just after each cut
   (the entry seam), mid-flip, a sprite at full lift, and the camera's extreme keys.
   Combine them: `ffmpeg -i a.png -i b.png ... -filter_complex "[0]scale=360:-1[a];...;[a][b]...hstack=N" sheet.png`.
2. After rendering, run `bash <skill>/scripts/qc.sh out/promo.mp4`: a 6-wide sheet of one frame every
   2.5 s, plus loudness. Use `qc.sh out/promo.mp4 30` for one per second. The sheet judges composition;
   to judge **text readability**, also extract and read 2–3 full-res frames per scene
   (`ffmpeg -ss <sec> -i out/promo.mp4 -frames:v 1 f.png`).
   To get many stills in one call: `pnpm exec remotion render Promo out/f --frames=0,30,90,... --image-format=png`.
   Take sheet frames ~10 f **after** each beat or cut, so motion has settled; a frame mid-hold that still
   shows text animating means the hold is too short.
3. Measure the motion, because a contact sheet can't show it:
   `python <skill>/scripts/motion_check.py out/promo.mp4 --timeline timeline.json --png out/qc/energy.png`.
   It flags **pops** (one frame jumping: a layer a frame early, a spring discontinuity, a clip ending
   on a black frame), **flashes** (a one-frame glitch or blank premount), **frozen** stretches > 3 s,
   cuts where nothing changed, the rest ratio, and whether the last frame is held. Extract the frames
   around every flag and look at them. Designed one-frame changes (`Screen` clip jump cuts, flips, blur
   content-swaps) also show up: list their frames with `--expect f1,f2` once checked. On one already-shipped
   promo it found a phone screen that dropped to solid black for a moment.
   Its REST % uses a relative energy threshold and is **not** the hold share in `motion.md` §2: approved
   promos measured 68–75%; under ~35% is restless, over ~80% a slideshow. END should say "held" (the CTA holds).
4. Read the sheet. Score each frame 1–10 using the rubric. Write down the three worst frames, find
   the cause in code, fix it, re-render only the affected stills to confirm, then re-render the video.
   Fix only frames at 7 or below; don't touch frames at 9+.
5. **Fresh eyes:** give a read-only subagent the sheet and full-res frames only (no code, no storyboard)
   and ask it to (a) say in one sentence what the product does and what each scene shows, and (b) list the
   three worst problems with timestamps. If it can't restate the message from the frames, the copy or the
   proof moments fail, whatever the scores say.
6. Done when every frame scores 8 or more (frames mid-seam are judged as motion blur and are fine),
   `motion_check.py` shows no unexplained flags, and audio passes.

## Rubric (any of these caps the score)
| Cap | Defect |
|---|---|
| 3 | Real personal data, a lock screen or other apps visible; fake or invented UI |
| 4 | Text overlapping UI text (captions on live screens); a headline clipped at the frame edge |
| 5 | Frame nearly empty (mid-flip or mid-transition with nothing else on screen) |
| 6 | Important numbers or labels cut off at the edge by a camera push; a sprite crop showing a neighbour sliver |
| 6 | Same layout as the previous scene; the subject dead-centre and static |
| 7 | Text too small to read on a phone (under about 30 px at 1080 wide); clutter, too many elements |
| 7 | Copy is a slogan that doesn't say what the feature does, or claims something not shown |
| 7 | Text moving or animating while it should be read; two focal points competing; a seam whose two sides move in different directions |
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

- **Two texts visible at once inside a morph:** the exit and enter overlap; keep exit ≤ 5 f and start the enter ≥ 4 f after the trigger.
- **Morph state touching the frame edge:** the widest state + camera push exceeds the safe area; shrink that state's w.
- **Mouse cursor in an app promo:** cursors are for websites only; replace it with a `Tap` ripple at the touch point.
- **Tap ripple covering UI text:** use a ring-only pulse at a corner, never a filled blob over content.
- **Headline running off the frame:** a long first line at a big size; shrink it or move x left (estimate chars × 0.58 × size).
- **Contradicting numbers or currencies across sources** (USD ledger next to a GHS widget): drop one.
- **A pop from `motion_check.py` inside a scene:** usually a `Sequence` without `premountFor`, a clip that
  ends before its `Screen` window (the last decoded frame is black), or a spring that retargets without
  `chain()`. Extract frames n−1…n+1 and compare.
- **The next scene's entrance fights the seam** (a left `curve` seam, then content rising from below): turn the
  first entrances in the incoming scene to move the same way, or change the seam.
- **Blank first frame of a scene:** add `premountFor={30}` to its `Sequence`; preload fonts before frame 0.
- **Logo animation blurred or skipped at its start:** no seam motion into the end scene (use a hard `cut`); start the Sequence on the logo's frame 0.

## Audio checks
- Integrated loudness about −14 LUFS (−13.5 to −14.5), true peak at most −1 dB, no clicks at
  cuts or at the end (a fade or a final hit).
- With the generated track, `compose.py` prints the onset error per cut: under 5 ms on groove cuts.
- Spectrogram of the music: band-limited percussion, no broadband noise wall, no aliasing.

## Delivery checks
- `ffprobe` shows H.264, yuv420p, bt709, 30 fps, and `+faststart` (remux with `ffmpeg -c copy -movflags +faststart`).
  Add a silent AAC track if there is no audio; some platforms reject video-only files.
- X, Slack and Discord ignore cover images and show frame 0, so frame 0 must be the thumbnail (`motion.md` §2).
- Watch out for players with their own gamma (QuickTime looks washed out); judge colour from extracted PNGs.
