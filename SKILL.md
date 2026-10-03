---
name: app-promo-motion
description: Produce a high-quality motion-graphics promo video (ad, launch video, app trailer, sizzle reel, product demo reel, social video for Reels/TikTok/Shorts/X/YouTube) for an app or website from its REAL UI - captured from the user's phone (Android via adb), user recordings, or the live site - with lifted UI components animated as sprites, kinetic type, camera pushes/pans and whip transitions, and music (generated, or the user's own track beat-synced). Built with Remotion. Use whenever someone wants a promo/commercial/"motion graphics" video for their app, SaaS, landing page or website, even if they only say "make a video for my app" or "animate my product", or share an X/Twitter post about AI-made motion design and want one like it. Not for static App/Play Store screenshots or listing images, README GIFs, bug-report screen recordings, or narrated tutorials.
---

# App & website promo motion graphics

This skill turns a real product into a 15–45 s motion-graphics promo using Remotion (React → MP4).
It encodes a workflow that was iterated with a demanding user. Three earlier attempts were rejected,
and every rule below exists because of a specific failure:

| Rejected | Why | So we now |
|---|---|---|
| Hand-drawn "mock" UI | Looked like wireframes, not the product | Use only real captures of the real product with demo data |
| Same layout every scene, phone dead-centre, 38 s | "Too boring", slideshow feel | Vary layouts, lift components out, move the camera every scene, keep 20–30 s |
| Screenshots with text on top | "Components can be animated in" | Cut UI components out of real frames and animate them individually |
| Crude synth audio | "The sound was the terrible part" | Use the mastered, beat-synced `compose.py` (3 styles) or the user's own track via `beats.py` |
| Everything centred | "Add zooms and pans, it's too centred" | Use the per-scene `Camera` (push, pan, roll, whip) and off-centre compositions |

The bar is a polished launch video someone would post without editing. A tech demo is not the bar.
Length: default 20–30 s. Use 15 s for a single-feature ad (see `motion.md` §2), and go up to 45 s only if the user asks.

## Workflow

Work through these phases in order. The user approves at **two checkpoints**: the storyboard, and the
stills. Everything else, do end to end without check-ins. Don't ask questions you can answer by
reading the product's code or site.

### 1. Intake: get access and the brief
Read `references/intake.md`. Ask for the URL for a website. For an app, walk the user through
connecting their phone, or get recordings another way. Do whatever it takes to see the real product,
and never invent UI.
Settle these in one message: audience and promise, 3–6 features, format (9:16 / 16:9 / 1:1), length,
music (generated, and which style, or their own track), and brand assets.

### 2. Capture the real UI with demo data
- **Android app:** `references/capture-android.md`. Start with the cheapest option that keeps real
  data off screen: a demo account in their install, then an existing build, and only then a demo build.
- **Website / web app:** `references/capture-web.md` (`scripts/web_capture.mjs`: stills, frame-perfect
  scrolls, slowed-animation flows, exact element rects ready for `ui.ts`).
- **iOS, or anything you can't drive:** the user's recordings and stills (see the end of `capture-android.md`).

Capture more than you need: every key screen in its best state, every interaction, and
**before/after** stills of anything that changes. The after states feed the `swap` animations.

### 3. Storyboard (checkpoint 1)
First pick a **direction**, one of the looks in `motion.md` §1b, derived from the brand, so different
products don't all come out looking the same. Then write one row per scene: beats, the **headline
copy**, the real capture it uses, the **recipe** (`motion.md` §5, no two adjacent scenes the same),
and **one sentence of what the viewer should understand**.
Show the direction and the table, adjust them with the user, then build.

### 4. Build
```bash
bash <skill>/scripts/new_project.sh /c/work/acme-promo   # short path, outside the app repo (Git Bash path syntax)
```
- `timeline.json` is the **single source of timing**: bpm, music style and scene beats. The video and
  `compose.py` both read it, and `beats.py` updates it.
- In `src/tokens.ts`, set colours from the product's real theme (read its theme or CSS files; don't
  guess), the font, `look` and `brand`, and the output size (`W`/`H`).
- Put captures in `public/clips` and `public/stills/ui`, and component crops in `src/ui.ts` (`srcW`
  when source images differ in width).
- Write scenes with the patterns in `motion.md`; `src/scenes/Examples.tsx` shows each one working.
  Retime every example's frame numbers to your scene lengths.

### 5. Stills (checkpoint 2)
Render a still per scene, plus the tricky frames (just after cuts, mid-flip, camera extremes):
`pnpm exec remotion still Promo out/s.png --frame=N`. QC them yourself first (`references/qc.md`).
Then show the user one combined storyboard image (ffmpeg `hstack`/`vstack`). Iterating on stills
takes seconds; re-rendering video takes minutes.

### 6. Audio
`references/audio.md`. Either generate a bespoke track (`python <skill>/scripts/compose.py` with the
style from `timeline.json`), or take the user's own (`python <skill>/scripts/beats.py track.mp3
--seconds N`, which detects beats, writes `src/beats.ts`, updates `timeline.json` and normalises to
−14 LUFS). Add UI sound effects at the frames of real taps and results.

### 7. Render and QC loop
Render only once the stills are approved: `pnpm exec remotion render Promo out/promo.mp4 --concurrency=2`.
Renders are heavy, so never render "just to test", and write each render to a new filename.
Run `bash <skill>/scripts/qc.sh out/promo.mp4`: read the sheet plus 2–3 full-res frames per scene,
score them against `references/qc.md`, fix the worst three, and repeat until every frame scores 8 or
more and audio passes (about −14 LUFS, peak ≤ −1 dB).

### 8. Deliver and clean up
Give the path, length, format, what each scene shows, and anything honestly reconstructed.
Restore everything you changed on the user's device (`awake_off`, `demo_bar_off`, widgets you added).
Mention what's left installed (the demo build, the Chrome profile) so they can remove it.

## Non-negotiables
- **Real UI only.** Every pixel of product UI comes from a capture of the real product. Never show
  features the product doesn't have.
- **Honesty.** Anything you can't capture live gets recreated faithfully and called out in the
  handoff. Example: a notification the OS showed silently, redrawn with the exact posted text.
- **Privacy.** No real personal or customer data on screen; use a demo account or seeded build.
  Check every clip's first and last frames for lock screens, notifications and other apps, and trim
  them before anything reaches `public/`.
- **No impersonation.** No other company's logos, colours or trade dress; integrations get a neutral
  icon and their name in text.
- **The user's device is borrowed.** Restore every setting. Never tap destructive controls (Remove,
  Delete, Uninstall) without confirming that the target belongs to the demo. Never ask for, or type,
  the user's passwords.
- **Resources.** Use `--concurrency=2`, close nothing of the user's without asking, and if a job is
  killed for memory, report it and ask before restarting.

## Reference map
- `references/intake.md`: questions, access paths, shot list
- `references/capture-android.md`: adb, triage, demo build, seeding, recording, privacy, iOS
- `references/capture-web.md`: capture plans, login profiles, rects → `ui.ts`, desktop vs mobile
- `references/motion.md`: visual system, directions, timing (incl. 15 s), components, camera
  (general safe-area formula, 16:9), recipes, copy
- `references/audio.md`: `timeline.json`, generated styles, custom tracks, SFX, mixing
- `references/qc.md`: frame rubric, known defects and their fixes, audio checks
- `references/pitfalls.md`: Windows paths, Android/NDK builds, render locks and memory, device etiquette
- `scripts/`: `new_project.sh`, `android.sh` (source it), `seed_asyncstorage.py`, `web_capture.mjs`
  (copied into the project), `beats.py`, `compose.py`, `qc.sh`
- `assets/template/`: the Remotion project (`Screen`, `Sprite`, `Camera`, `Headline`, `Marker`,
  `Window`, `Tap`, `Notification`; `timeline.json`, `beats.ts`, `tokens.ts`, `ui.ts`)
