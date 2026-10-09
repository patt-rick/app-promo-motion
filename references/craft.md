# Craft: the finer techniques

Read `motion.md` first; this file holds the techniques that sit on top of it. All numbers are at 30 fps on a
1080-wide canvas unless stated otherwise. These rules come from a survey of 20 motion-design agent skills and
engines (Remotion's own skills, HyperFrames, LottieFiles, GSAP, klik, product-launch-motion, claude-motion and
others), keeping only what they agree on or what was measured on real renders.

## Contents
1. Curves and springs, by job
2. Kinetic type
3. More seams
4. Choreography
5. Music to motion
6. Look and grade
7. Motion blur
8. Logo reveals when there is no Lottie
9. Direction before code

## 1. Curves and springs, by job
| Job | Curve / spring | Notes |
|---|---|---|
| Arrive | `EASE.arrive` (0.16, 1, 0.3, 1) | The house default; never an in-out curve on an entrance |
| Leave | `EASE.leave` (0.7, 0, 0.84, 0) | 65–75% of the entrance's length |
| Move on screen | `EASE.move` (0.65, 0, 0.35, 1) | |
| Travel near text being read | `EASE.glide` (0.4, 0, 0.2, 1) | Editorial signature |
| A value landing on a level | `EASE.land` (0.55, 0, 0.2, 1.25) | ~3% past, then settles |
| Hits: arrivals, presses, snaps | `SOFT`, `SNAP`, `HEAVY` | ζ ≥ 0.7 |
| Camera | `CAM` (ζ = 1) or the Camera's bezier | A bouncing camera reads as shake |
| One hero moment | `POP` (ζ ≈ 0.55, ~12%) | Once per video, and only if `look.pop` (never editorial) |
- **Material:** rigid things (panels, phones) take 1.2× the time and 0% overshoot (`HEAVY`); paper-like cards
  1.0× and ~2–3% (`SOFT`); light chips 0.8× and up to 5% (`SNAP`). Heavy type faces get heavy springs: weight is mass.
- **Group repositioning (the nudge curve):** when a whole layout shifts to make room, chain three phases:
  a slow start (20% of the time, 10% of the distance), a fast middle (18%, 65%) and a long tail (62%, 25%).
  Reveal the new content during the fast middle. A plain power4.inOut "smacks to a stop".
- **Fixed-length spring:** `interpolate(f, [a, b], [0, 1], { easing: Easing.spring({ damping: 200 }) })` gives an
  overdamped (no overshoot) spring-shaped push of exactly `b − a` frames, handy when a move must end on a beat.
- **Arrive, hold, leave in one call:** `interpolate(f, [0, 30, 270, 300], [0, 1, 1, 0], { easing: [EASE.arrive, Easing.linear, EASE.leave] })`.
- **Stepped motion as a style:** `posterize: 2` or `3` on an interpolate gives a deliberate shot-on-twos feel
  (technical or bold directions only, one element type, never the camera).
- Snap tween end times to whole frames; very steep curves (power4 tails) alias between frames.

## 2. Kinetic type
- **Mask rise** (the `Headline` default): travel 110% of the line height over `look.enter` frames on `look.curve`,
  word stagger 2–3 f.
  Pad the mask about 0.08 em so descenders aren't clipped.
- **Waterfall entry:** opacity snaps on (no fade), each word rises and lands: anchor words 60–80 px over
  5–6 f, normal words 40–50 px over 4–5 f, light words 30–45 px over 3–4 f; each word starts within ±2 f of
  the previous one settling.
- **Line-by-line build:** for a list of three short lines, each new line arrives and the spent lines dim to
  30% while the stack nudges up 10 px. Good for "what it replaces" beats.
- **Word swap in a shared mask:** the old word exits up over ~5 f, the new one rises 4 f later; never overlap them.
- **Emphasis slam** (bold direction, once per scene): from scale 1.5 and 16 px blur to rest over ~15 f on
  power4-out, landing on a kick.
- **Focus pull title:** from scale 0.06 and 28 px blur to 1.0 over ~33 f power4-out, then 1.04 (5 f) and back
  to 1.00 (12 f). One per video, for the hook or the end title.
- **Highlight pill:** a pill of the accent's soft tint scales in behind one word ~5 f after it lands. At most
  once per video, instead of colouring the word, and only for the word that carries the claim.
- **Hand-drawn emphasis:** `@remotion/rough-notation` (`<Underline>`, `<Circle>`, `<Box>`, `<Highlight>`)
  with `progress` driven by `interpolate`. It's an alternative to `Marker` for an editorial or playful brand.
- **Fitting:** `fitText()` / `fillTextBox()` from `@remotion/layout-utils` measure real widths (after the font
  loads) instead of the chars × 0.58 estimate. Use px gaps in flex rows next to big type (an `em` gap resolves
  against the parent's 16 px).
- **Moving text has a speed limit:** text the viewer must read moves below about one line height × 20 px
  per second (a 48 px line: under ~960 px/s), and rotates no more than ±15°.

## 3. More seams (beyond `Camera`'s five)
- **Waterfall cut:** the words of the outgoing headline leave one by one in reading order (stagger ~1 f,
  power4-in, ±230 px), and the incoming words arrive the same way with the gaps shrinking (×0.84 each).
  It's a typographic seam between two copy-led scenes.
- **Rack-focus cut:** the outgoing scene blurs to 8–12 px with a ~1.06 lens-breathing scale and swaps at peak
  blur. It's the one seam meant to be seen, so use it at most once per ~8 s.
- **Light-streak:** a 40%-wide, 8 px white bar with 6 px blur sweeps across over ~12 f, and the cut hides in
  its brightest frame. It suits dark products.
- **Shared-element carry:** the strongest seam. A real component (a card, a chip with the real value) stays
  on screen across the cut at the same position and velocity, and docks into the next scene's layout.
- **Light leak overlay:** `@remotion/transitions` `lightLeak` over a hard cut, for editorial or warm brands. It
  needs WebGL (`--gl=angle`).
- Write each seam as a pair: the exit's comment names the entry that answers it. If you can't name it, the
  seam isn't designed.

## 4. Choreography
- **Four-part beat:** anticipation (10–20% of the beat), action (30–50%), reaction (10–20%, the thing
  that responds: a ring draws, a counter ticks, a toast drops), resolution (20–30%), then 3–6 f of stillness.
  This is `motion.md`'s arrive → prove → settle with the reaction made explicit.
- **Cause and effect:** a chain of reactions starts 2–6 f apart, radiating from the trigger (nearest first).
  All elements reacting to one trigger start within ~2 f, even if they land at different times.
- **Counter-motion and depth:** when the hero rises, its shadow grows softer and wider. When the hero enters
  from the left, the canvas behind can drift right at 20–30% of its speed. Parallax rates: foreground 1.0×,
  mid 0.5×, background 0.2×. Never parallax text.
- **Staging:** while the hero acts, everything else is quieter in every dimension (smaller moves, lower
  contrast, dimmed to 40–60%, optionally blurred 2–4 px).
- **Density alternates:** one element, then many, then one. Average shot length shortens toward the climax,
  then a long hold follows.
- **Story as a chain:** each scene produces the object the next one uses (the filed receipt becomes the chart
  bar). It turns a list of features into one continuous story.

## 5. Music to motion
- Cues land on the **downbeat**; a reveal may slide up to ~5 f to meet a strong cue, a small entrance ~3 f.
- **Beat punches** (bold and springy only, after the drop): +1.2% scale per beat, +3% on bar lines, decaying
  exponentially within ~8 f. Only on background layers (a colour field, a decorative shape), never on the camera
  (it scales the text being read) and never on the product UI.
- **Kick vs snare:** a kick-driven pulse `scale(1 + 0.05p, 1 + 0.10p)`; a snare lagged ~3 f at ≤ 60% of the kick.
  Hats move nothing.
- **Attack matching:** a sharp transient (< 30 ms) gets a snap; a swell (> 90 ms) gets a ramp with no overshoot.
- **Speed that follows the music accumulates** (position = Σ rate per frame), never `frame × rate`, or it jumps.
- **Audio-reactive alternative:** `visualizeAudio()` from `@remotion/media-utils` (average the lowest 32 of
  128 bins) can drive an end-card pulse directly from the track: scale `1 + bass·0.5`, capped.
- **Silence before the turn:** a short breath before the biggest reveal; the spec and how to do it are in
  `audio.md` ("Leave a breath").

## 6. Look and grade (optional, subtle)
Use these only when captures from several sources need unifying or the brand is cinematic. Product UI must
stay true to its real colours, so keep grades light and run the contrast check with the grade off.
- **Order of layers:** canvas → UI and sprites → type → grade → grain and vignette.
- **Grade:** the accent at `mix-blend-mode: soft-light`, opacity 0.10–0.15 on light themes and 0.18–0.25 on
  dark, plus a vertical gradient darkening the top ~10% and the bottom ~20%.
- **Grain:** SVG `feTurbulence` (baseFrequency ~0.8, one octave), a colour matrix that moves luminance into alpha,
  opacity ~0.05–0.10, reseeded every 2–3 frames (every frame bloats the file ~10×).
- **Vignette:** `radial-gradient(ellipse 78% 74% at 50% 48%, transparent 44%, rgba(0,0,0,.06) 78%, rgba(0,0,0,.15) 100%)`.
- **Specular sweep:** a 0.11-white band, `skewX(-14deg)`, sweeping across a hero card over ~27 f. Use three per
  video at most: on the claim, the proof and the CTA.
- **Dark canvases:** lift the blacks (e.g. #100E19), never pure #000.
- **Built-in effects** (separate packages, installed at the same version as `remotion`): `@remotion/effects` (`vignette`, `noise`, `glow`, `shine`, `chromaticAberration`,
  `zoomBlur`) attach via `effects` on `<Img>`, `<Video>`, `<Solid>`. They need WebGL (`--gl=angle`).
  Chromatic aberration ≤ 2 px, and only at the peak of a fast seam.
- **Colour transitions** between distant hues: interpolate in OKLCH (convert both ends, interpolate L, C and H,
  convert back) rather than straight RGB, which passes through grey. Hold one brand colour back until the climax
  so its arrival feels like the drop.

## 7. Motion blur
- Blur only the 1–3 snapping moves (a slam, a whip, a fast lift-out), never text being read, never drifts,
  never across a hard cut.
- `@remotion/motion-blur`'s `<CameraMotionBlur shutterAngle={180} samples={4–8}>` around that one scene
  (`samples` 6–8 for fast moves, since 4 can ghost). Remotion ≥ 4.0.529 also has `<HtmlInCanvasMotionBlur>`
  (better quality; check it exists in the installed `@remotion/motion-blur`).
- Speed-based fallback: a directional blur of `clamp((pxPerFrame − 3) × 0.35, 0, 4.5)` px on the moving
  element alone.
- Anything moving over ~30 px/frame without blur strobes; either blur it or slow it down.

## 8. Logo reveals when there is no Lottie
`motion.md` recipe 13 (the brand's own animation) always wins. Without one:
- **Clear and bloom:** the last feature scene clears to an empty canvas. The mark springs in (`HEAVY`, from
  0.9 with opacity 0) at the centre with a slight rotation, then slides aside as the wordmark reveals beside it.
  The lockup holds with a barely visible push.
- **Crystallize:** the hero component from the video flies to the logo's position while shrinking (1 → 0.3)
  as the mark fades in; both end at the same x/y. It ties the product to the brand.
- **Line to logo:** a thin accent line opens vertically into the mark (scaleY 0.014 → 1, "eye opening").
  Never cross-fade a drawn version into the PNG, which leaves a grey ghost.
- Numbers: the reveal takes 0.8–2.5 s, the final settle 1.04 → 1.00 over 4–6 f lands on the music's
  final hit, and the settled mark holds ≥ 0.4 s before the CTA rises. The symbol leads, the wordmark follows,
  and the clear space around them is at least the cap height.

## 9. Direction before code
- Name the direction by a reference ("a Linear launch film", "Apple keynote product reveal"), never by
  adjectives ("premium, modern").
- For a high-stakes video, write three directions, kill two, and render one proof scene (with its seam) in
  the chosen one before building the rest.
- Structure options beyond the default hook → features → end: Problem → Agitate → Solve; Before → After →
  Bridge; a single demo loop on one surface (3+ consecutive beats in the same UI). Put the turn (the moment
  the product appears or the problem flips) somewhere deliberate: 15%, 40% or 75% of the runtime.
- Close a loop: the first object or framing comes back changed at the end.
