# app-promo-motion

A Claude skill that makes **motion-graphics promo videos for apps and websites from their real UI**:
lifted UI components animated as sprites, kinetic type, camera pushes, pans and matched-seam cuts, and
music that's either generated or your own track synced to the beat. Built on [Remotion](https://www.remotion.dev/).

Ask Claude something like *"make a 30-second promo video for my app"* or *"animate our landing page
into a launch video"*. The skill takes Claude through:

1. **Access:** asks for your site's URL, or walks you through connecting your Android phone over adb
   (iOS: you supply screen recordings). It never invents UI.
2. **Capture with demo data:** keeps real personal data off screen; for websites it produces smooth
   scrolls, real click-throughs and the exact positions of page elements.
3. **Storyboard, then stills:** you approve both before anything is animated.
4. **Build:** real components lifted out of the screens and animated (deal-ins, splits, flips,
   before→after wipes, value chips travelling between cards), plus one of five visual directions (springy, editorial,
   technical, morph, bold) so different products don't look alike. Timing, easing, springs and cuts follow
   measured rules: reading holds sized to the copy, cuts whose motion matches across both sides, and one
   signature move per video. Works in 9:16, 16:9 and 1:1.
5. **Music:**
   - **Your own track:** any mp3/wav/m4a. Beat detection makes every cut land on a beat, the drop
     lands on the hero moment, and it's normalised to −14 LUFS.
   - **Generated:** a bespoke track in one of three styles (groove, minimal, calm), timed to the cuts,
     with nothing to license.
6. **QC loop:** Claude scores rendered frames, measures the motion frame by frame (one-frame pops, glitches,
   frozen stretches), has a fresh-eyes agent restate the message from the frames alone, fixes the worst
   problems, and checks loudness before handing over.

## Install

**Claude Code:** clone it into your skills folder:
```bash
git clone https://github.com/patt-rick/app-promo-motion ~/.claude/skills/app-promo-motion
```

**Claude.ai (web or desktop):** download `app-promo-motion.skill` from the
[latest release](https://github.com/patt-rick/app-promo-motion/releases/latest) and upload it in
Settings → Capabilities → Skills.

## Requirements (on the machine that builds the video)

- Node.js 18+ and [pnpm](https://pnpm.io)
- [ffmpeg](https://ffmpeg.org) on PATH
- Python 3.10+ with `numpy` and `scipy` (for music)
- Google Chrome (for website capture)
- Android apps: Android platform-tools (`adb`); the skill walks you through it

## What's inside

```
SKILL.md                 workflow + non-negotiables
references/              intake, Android & web capture, motion design system, craft (type, seams, grade, blur,
                         logo reveals, music to motion), audio, QC rubric, pitfalls
scripts/                 new_project.sh, android.sh, web_capture.mjs, beats.py, compose.py, qc.sh, motion_check.py,
                         seed_asyncstorage.py
assets/template/         the Remotion project (Screen, Sprite, Camera, Headline, Marker, Window, Tap, Notification,
                         Morph, Cursor, LottieLogo; lib/ease.ts and lib/springs.ts)
```

## Notes

- Renders are memory-heavy. The skill renders stills for iteration and the full video only once
  they're approved, at `--concurrency=2`.
- Use only music you have the rights to.
- Windows works (it was built there); see `references/pitfalls.md` for path-length and Android build gotchas.

## License

[MIT](LICENSE)
