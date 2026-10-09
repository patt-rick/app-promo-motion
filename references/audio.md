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
- A long one-shot scene (a morph chain) has no cuts for the music to mark: add its state changes to
  `crash_beats` (and optionally `fill_beats`) in `timeline.json` so the track still moves with the picture.
- Align each effect by its **peak**, not its file start: tap/coin peaks are within the first frame, a ding's
  attack about 1 f in; schedule the effect 0–2 f before the visual hit.
- Place them at the **exact frames** of real events from the timing sheets: tap, notification ding,
  result/confirm coin, whoosh on whips, zoom seams and fly-ins (not on every `curve` seam). At most one every 0.5 s.
- Volumes under a −14 LUFS track: taps 0.3–0.4, results 0.3–0.35, whooshes 0.2–0.25, everything ≤ 0.4.
- **Accent, don't narrate.** One cue per visible event. A sound that repeats (taps) changes on every repeat:
  pitch steps (`toneFrequency` 1.0, 1.06, 1.12…) and ±0.05 volume; any other identical sound at most twice in 30 s
  (the same ding on every click is a template tell). Continuous motion (drifts, camera pushes, morphs settling) stays silent.
  At most **one riser and one impact** per video, the riser ending exactly on the impact (the hero reveal or the drop).
- **Musical SFX:** tonal cues (dings, pops) stay in the track's key (A minor for the generated track). In a
  sequence of pops (a stack dealing in, chips appearing) raise each one's pitch a step
  (`<Audio toneFrequency>` 1.0, 1.06, 1.12…; it works only in the final render, not the Studio preview), and the
  payoff resolves it.
- **Pan follows position:** a sound for an element on the left of the frame sits slightly left. Remotion has no
  pan control, so pre-render a panned copy with ffmpeg (`-af "pan=stereo|c0=0.8*c0|c1=0.5*c1"`) if it matters.
- A quiet SFX file can't be fixed with volume. If its first 100 ms sits more than ~12 dB under its peak, trim
  it to the first transient or replace it.
- **Leave a breath** before the biggest moment: ~0.3–0.5 s of thinned-out music makes the hit land. With the
  generated track, put that gap in `kick_gap_beats` (drums drop out) right before the hero beat; with a custom
  track, keyframe the `<Audio>` `volume` down 6–10 dB over it (`interpolate`, 4 f ramps). The busiest moment
  isn't the loudest.
- `Promo.tsx` fades the music over the last 15 frames. That's harmless on the generated track, which
  rings out past the end, and needed on custom tracks.
- After rendering, `qc.sh` prints loudness and peak: target about −14 LUFS and at most −1 dB. Peaks at
  0.0 dB mean stacked effects; lower them.
- **Mastering the final mix:** a sparse mix can't reach −14 LUFS without crushing, so add sustained sound
  instead of gain. When re-mastering the whole mix yourself, use two-pass
  `loudnorm=I=-14:TP=-1.5:LRA=7:linear=true` (measure, then apply), and if a limiter follows it, use
  `alimiter=limit=0.89:level=disabled` (otherwise it re-normalises and you land near −13). Measure on the
  delivered MP4: AAC encoding adds ~0.5 dB of true peak.
- Grid precision: with the generated track, `frameOf` rounds beats to frames. That's exact when
  1800/BPM is a whole number (120 BPM: 15 frames) and within half a frame otherwise. Fine for
  cuts; keep effects on clip-event frames.

## Optional: voice-over (only when the user asks for one)
Most promos are watched muted, so on-screen copy still carries the message on its own; a VO is extra.
- **Voice first.** Get the final VO (the user's recording, or a voice they have rights to) before timing any
  scene; an OS text-to-speech take is fine for timing drafts, never for shipping. Transcribe it with word
  timestamps (e.g. Whisper) and size each scene to its line: line length + 0.2–0.5 s tail.
- **Write for the ear:** one clause per scene, short words, the claim inside the first 10 s, numbers written as
  spoken, at most ~3 words per second, each line starting ~0.3 s after the previous one ends.
- **Lock visuals to words:** text and reveals lead their word by 1–2 f; a tap starts 6–9 f early so its press
  lands on the verb. Put the payoff sound in the pause before the line that names it: SFX under speech get lost.
- **Ducking:** music sits 12–14 dB under the voice. Either keyframe the music's `volume` down around each line
  (`interpolate` with 6 f ramps), or mix in ffmpeg with
  `sidechaincompress=threshold=0.02:ratio=4:attack=30:release=400`, then master to −14 LUFS.
- The on-screen headline and the spoken line say the same thing in different words, never two different claims.
