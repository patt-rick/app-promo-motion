# Audio

The user's harshest note was "the sound was the terrible part". Sound is half the perceived quality.
Never ship the first thing that makes noise, and measure, because you can't listen.

All timing comes from the project's `timeline.json`:
```json
{ "bpm": 120, "music": "generated", "style": "groove",
  "scenes": { "hook": [0, 5], "featureA": [5, 14], "featureB": [14, 21], "end": [21, 28] } }
```

## Option A: generated soundtrack (nothing to license)
`python <skill>/scripts/compose.py`, run from the project root, writes `public/audio/music.wav`
(−14 LUFS, −1.3 dBTP) plus `tap/ding/whoosh/coin.wav`.
- Arrangement follows the scenes: cuts are the scene starts, the groove **drops** at the second scene's
  start (after the hook), and the final chord **hits** at the last scene's start (the end card).
  (End-card start − second scene's start) must be a multiple of 4 beats and at least 8. The script
  says exactly what to change if not.
- `style` sets the energy, all with the same harmony, melody and mastering:
  - `groove`: Afro-house/amapiano feel (four-on-the-floor, syncopated log-drum bass, shakers, claps,
    fills). Upbeat consumer apps.
  - `minimal`: a steady kick, plain bass, light shakers, rim backbeat, sparse stabs. SaaS, B2B, productivity.
  - `calm`: no groove drums, a soft kick on bar downbeats, sustained bass, warm pads and marimba.
    Premium, wellness, finance-trust. Its cuts are deliberately soft, so the onset report flags them; that's expected.
- Optional overrides in `timeline.json`: `groove_start`, `groove_end`, `crash_beats`, `fill_beats`,
  `open_hat_beats`, `swell_beats`, `kick_gap_beats` (omit them or leave them empty for the defaults).
- Check the printed report: integrated LUFS, true peak, and **onset error per cut** (under 5 ms on groove
  and minimal cuts). Render a spectrogram (`ffmpeg -lavfi showspectrumpic=s=1200x400:scale=sqrt`) and read
  it: band-limited percussion, no noise walls, no aliasing lines.
- The harmony is fixed (A minor, Am9 → Fmaj9 → Cmaj9 → G). If the brand needs a very different
  sound (orchestral, rock, lo-fi), recommend the user's own track over rewriting the synth.

## Option B: the user's own track (the default for non-consumer brands, if they have one)
They must have the rights to use it; ask once, briefly.
```bash
python <skill>/scripts/beats.py path/to/track.mp3 --seconds 30 [--start 12.5]
```
- Detects tempo (70–180 BPM) and each beat, estimates the downbeat, finds the **drop** (the biggest
  rise in bass-weighted energy), trims so beat 0 is frame 0, and loudness-normalises to −14 LUFS /
  −1.5 dBTP into `public/audio/music.wav`.
- Writes `src/beats.ts` (`BEAT_FRAMES`, so every cut lands on a real beat even if the tempo drifts) and
  sets `"bpm"` and `"music": "custom"` in `timeline.json`. For the UI sound effects, run
  `python <skill>/scripts/compose.py --sfx-only`, which leaves the music untouched.
- Then size the scenes in seconds (2.5–4.5 s) at the reported BPM, and put the hero reveal on the
  reported drop. Use `--start` to skip a slow intro.
- If it says the timeline needs more beats than were detected, raise `--seconds` or shorten the scenes.
- If it prints a WARNING (weak or unsteady pulse), choose cuts by phrase from the loudness curve, or
  recommend the generated track. Tempo can lock at half or double: the report prints both alternatives.
- Measured on test tracks: tempo within 0.1 BPM, average beat offset 0–5 ms, worst beats about 1 frame.

## UI sound effects and mixing
- Place them at the **exact frames** of real events from the timing sheets: tap, notification ding,
  result/confirm coin, whoosh on whips and fly-ins. At most one every 0.5 s.
- Volumes under a −14 LUFS track: taps 0.3–0.4, results 0.3–0.35, whooshes 0.2–0.25, everything ≤ 0.4.
- `Promo.tsx` fades the music over the last 15 frames. That's harmless on the generated track, which
  rings out past the end, and needed on custom tracks.
- After rendering, `qc.sh` prints loudness and peak: target about −14 LUFS and at most −1 dB. Peaks at
  0.0 dB mean stacked effects; lower them.
- Grid precision: with the generated track, `frameOf` rounds beats to frames. That's exact when
  1800/BPM is a whole number (120 BPM: 15 frames) and within half a frame otherwise. Fine for
  cuts; keep effects on clip-event frames.
