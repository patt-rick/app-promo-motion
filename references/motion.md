# Motion design: system, components, recipes

## Contents
1. Visual system · 1b. Directions (pick one per product)
2. Timing (incl. a 15 s plan, durations, staggers, reading holds) · 2b. Springs and principles
3. Components
4. Camera (seams and the vector law, safe-area formula, platform overlays, 16:9)
5. Scene recipes
6. Copy
7. Variety checklist

Deeper craft (kinetic type patterns, seam variants, look and grade, motion blur, logo reveals, music
to motion) is in `craft.md`.

## 1. Visual system
- **Canvas = the product's own background colour.** The video should feel like the product opened up.
  All colours come from the product's theme: background, text, one `accent`, a `surface`, and
  semantic good/bad colours for rings.
- **One typeface, the product's own** (`@remotion/google-fonts` or a local file). Its available
  weights and subsets go into `loadFont` (non-Latin products need `latin-ext`, `cyrillic` and so on;
  for CJK or Thai set `units="chars"` on `Headline`; for RTL put `direction: "rtl"` on a wrapper).
  Headlines are two lines max, sentence case, left-aligned (right-aligned for variety). Captions are
  500 weight at 36–40 px in the secondary text colour, under 75 characters.
- **Avoid:** centred text on gradients, ALL-CAPS eyebrow labels, a single word set in a different colour
  (at most one tinted highlight pill per video, behind the claim word: `craft.md` §2), slow fades,
  stock device mockups with glossy bezels, decorative blobs, invented scene numbers or status dots,
  typewriter reveals on headlines (typing belongs only inside a real product input), particles, glow on text,
  gratuitous 3D flips, anything entering from `scale(0)` (start at 0.9–0.97 with opacity 0; the only exceptions
  are the named techniques in `craft.md` §2 and §8, such as the focus-pull title and the line-to-logo reveal).
- **One focal point per frame.** Colour weight 60/30/10 (canvas / surfaces and text / accent); the accent
  (or any glow) sits on at most one element per frame. Non-hero elements can dim to 40–60% while the hero acts.
- **Optional look layer** (grain, vignette, a soft grade over mixed sources): `craft.md` §6. Rule: if a viewer
  can name the effect, it is too strong.
- **The proof device:** an accent outline (`Marker` / `ring`) around the real UI element proving the
  claim. Use it once per scene, on the one thing that matters.
- Real UI floats as a sheet (rounded, warm shadow, status bar cropped), shown large: 70–90% of frame
  height, or cropped close-ups. Never small in the middle of empty space.

## 1b. Directions: pick one at storyboard time from the brand
Same components, different feel, so two products never come out looking alike. Set `look` in
`tokens.ts` (type, plus `enter`, `curve`, `spring` and `pop`, which `Headline`, `Caption`, `Sprite`, `Morph`
and the end card read), then the radii and camera amplitude in the second table.
| Direction | `look.enter` | `look.curve` | `look.spring` | `look.pop` |
|---|---|---|---|---|
| Springy | 12 | `EASE.arrive` | `SOFT` | true |
| Editorial | 20 | `EASE.glide` | `HEAVY` | false (no overshoot anywhere; `Morph` edges keep their small `LEAD`/`TRAIL` stretch) |
| Technical | 12 | `EASE.arrive` | `SOFT` | true |
| Bold | 9 | `EASE.arrive` | `SOFT` | true |

| Direction | For | Type | Motion | Camera | Radii |
|---|---|---|---|---|---|
| **Springy** | Consumer, fintech, social | 800, −0.045em, 112 px | `SOFT`/`SNAP` springs, one `POP`, quick 10–12 f entrances, playful tilts (4–8°) | push 1.0→1.15; `curve` seams, ≤2 whips | large (48–64) |
| **Editorial** | Premium, wellness, finance-trust | 600–700, −0.02em, 96 px, airy line-height | `EASE.glide`, `HEAVY` springs, no overshoot, 18–24 f entrances, no tilts above 3° | slow pushes 1.0→1.06; `curve` and hard `cut` seams, one `zoom` | medium (24–36) |
| **Technical** | Dev tools, B2B, dashboards | 700, −0.03em, 88–100 px, monospace numerals | `SNAP` springs for small UI, `EASE.move`, grid-snapped layouts, odometer counts, optional `posterize: 2` stepped motion | pans along rows and columns, small scale changes; `curve` seams | small (8–16) |
| **Morph** (one shape) | Any brand, as a 10–20 s centrepiece inside another direction, or a whole UI-motion piece | the product's font, 600–700 | springs with slight overshoot only, one container changes size/radius/colour, content swaps with a quick blur, an action on every beat | gentle continuous push (`CAM` spring); zoom so each state fills the frame (cards 1.2–1.6×, pills 1.8–2.2×) | follow each state's real radius |
| **Bold** | Gaming, creator, youth | 900, −0.05em, 130 px, oversized type bleeding off the edges | hard cuts on beats, emphasis slams (once per scene), `POP` | big pushes 1.0→1.25; hard cuts plus ≤2 whips | mixed |
Pair the music style and tempo with it: springy→groove (118–124 BPM), editorial→calm (90–100 BPM; at 96 BPM a
beat is 18.75 f, so cuts round to within half a frame), technical→minimal (110–120 BPM), bold→groove (120–128) or
the user's track. 120 BPM (15 f per beat) is the safe default.
Easing curves (`EASE`) live in `lib/ease.ts`, springs (`SOFT`, `SNAP`, `HEAVY`, `CAM`, `POP`) in `lib/springs.ts`.
Pick **one signature curve** per direction for ~80% of moves; the rest are exits and the odd hero hit.
Give the piece one **signature move** that expresses the product's core verb (a card that docks, a tap that
fills a ring) and use it 2–3 times: early, middle, end.

## 2. Timing
- 30 fps. Scenes are defined in beats in `timeline.json`; at 120 BPM a beat is 15 frames. With a custom
  track, size scenes in **seconds** (2.5–4.5 s each) and convert with the track's BPM; don't copy beat counts.
- **25–30 s plan:** hook 4–5 beats, 4–6 features of 5–9 beats each, end card 6–7 beats.
- **20 s plan:** hook 4 beats, 3 features of 8–9 beats each, end card 7 beats (40 beats at 120 BPM; at 96 BPM
  use 32 beats: hook 4, features 7 each, end 7).
- **15 s plan:** hook 4 beats, 2 features of 8 beats each, end card 6 beats (30 beats at 120 BPM).
  One promise, two proofs.
- Within a scene the motion has three moments: **arrive** (0–12 f: the seam lands, headline words rise),
  **prove** (the real interaction or the lifted component, plus marker), **settle** (the camera finishes its move
  and the reading hold runs; nothing loops), then the headline starts its exit about 11 f before the cut
  (+1.5 f per extra line) so it is gone before the seam. Feature scenes end on a moving last pose (no frozen
  tail); only the end card holds still.
- Frame 0 is the thumbnail, because autoplay is muted. It must be bright, with the headline already set
  (`at < 0`) and the real UI visible. No entry seam on the hook.
- Easing per direction (above); never linear camera moves (except the held end card's barely visible push),
  never fades longer than 10 f (seams are exempt: their opacity ramps are part of the move).
- **Duration bands (30 fps):** press feedback 4–6 f, chips and icons 6–10 f, cards 10–20 f, panels and
  screens 18–26 f, scene-scale moves 24–36 f, camera phrases 48–108 f. Scale by travel with `byDistance()`
  (sqrt law: 200 px ≈ 1.4× the 100 px time, capped at 2× from 400 px). Heavier and bigger = longer and less overshoot.
- **Exits are 65–75% of their entrance** and use `EASE.leave`. Entrances use `EASE.arrive` (or `look.curve`);
  on-screen moves `EASE.move`. (Names are jobs: `arrive` is an ease-out shape, `leave` an ease-in shape.)
- **Stagger:** parts of one object 1 f, chips in a row 1–2 f, list rows 2 f, items the viewer should count
  3–5 f; editorial doubles these (words 3 f, rows 4 f). The whole group finishes within ~15 f (editorial ~24 f),
  all items share one curve and only their start differs.
  Order: reading order for lists, centre-out for heroes, nearest-first when one trigger makes several things react.
- **Reading holds:** once copy has settled it stays still for `readFrames(text)` = max(0.7 s, 0.25 s + chars/17);
  the final line ≥ 2 s. Sum the holds at storyboard time: if they don't fit the length, cut copy, not holds.
  Text never moves while it is being read (a slow camera drift is fine).
- **Rhythm:** hit, then stillness, then build, then hit. Roughly 40–60% of the running time is settled holds; a new
  element still appears every 2–4 s. "Slideshow" (everything lands at once, then freezes) and "screensaver"
  (everything drifts forever) are both failures. Put a 0.3–0.7 s still beat (the dramatic comma) between an
  action and its payoff.

## 2b. Spring motion (from the one-shape UI-motion technique)
- Everything is a pure function of the frame: no CSS transitions, timers, or state carried between frames.
  Remotion's `spring()` is closed-form; when a value retargets several times use `chain()` from
  `lib/springs.ts`, which sums one spring per change: v(t) = v0 + Σ (vᵢ − vᵢ₋₁)·spring(t − fᵢ).
- Slight overshoot only. Judge a spring by its **damping ratio** ζ = damping / (2·√(stiffness·mass)) (`zeta()`):
  UI and type ζ ≥ 0.7 (≤ 5% overshoot; `SOFT` is 0.77), the camera ζ = 1 (`CAM`, never overshoots), and one
  hero `POP` per video at ζ ≈ 0.55 when `look.pop` allows it (editorial: none). Banned: ζ < 0.5 (cartoon bounce), particle bursts, glows, gradients on UI
  chrome, inconsistent icon strokes, dead time, anything template-like. Springs drive hits; curves drive travel.
- **Principles, with numbers:**
  - *Anticipation:* before a big move, 3–6 f the opposite way at 10–20% of its size (a 3% dip, 5–10 px back);
    a press dips 3–4% before the change. Skip it on moves under 5 f.
  - *Follow-through and overlap:* children trail their parent by 2–5 f (a card lands, its shadow ~2 f later,
    its content ~3 f later). Secondary motion is 30–50% of the primary's amplitude, a few frames late, on a different curve.
  - *Arcs:* long moves bow 10–20 px perpendicular to their path (5 px technical, 20+ px springy); easing x and
    y with different curves does it for free.
  - *1/3 rules:* nothing travels more than a third of the frame without a change of speed, direction or arc;
    with three or more animated elements, at most a third move at once (element 1 settles as element 3 starts).
  - *Continuity:* where a travel hands off to a settle spring, position and velocity must match on both sides,
    or the frame jitters.
- **No idle loops.** Breathing, floating, bobbing and glow pulses read as "the video is waiting". Between
  entry and exit every stretch has a purpose: a staged reveal, a camera move with intent, real UI life
  (progress, counters, highlights), or a tap with its result. Test: pause on any second and something
  meaningful is mid-flight, or the frame is a deliberate reading hold. A held end card may have one barely
  visible linear push.
- **Liquid stretch:** give a moving shape's edges separate springs. The edge that travels further leads
  (`LEAD`), the opposite edge trails (`TRAIL`), so it stretches toward the target, then settles. Same for
  tab indicators and toggle knobs. `Morph` does this per edge automatically. A chain whose states all share one
  centre only gets width-then-height; offset the states' x/y a little (40–120 px) to get the full stretch.
- **Content swaps inside a morphing container** need separate exit and enter timing (out over 5 f with blur,
  in from 4 f later) so two texts never overlap.
- **Triggers are visible:** for **apps** (phone, tablet, PWA, web apps like a dashboard), a `Tap` ripple at the
  real touch point; for **websites** only (marketing sites, landing pages, desktop browsing), a `Cursor` click;
  a contactless pulse for card taps. Never a mouse cursor in an app promo. Drags are direct: while the finger
  (or cursor) is held, the value comes from its position; on release, spring back from there.
- **An action on every beat** inside a morph chain: tap, morph, headline swap, caption, camera settle,
  next trigger. If a beat has nothing happening, the chain is too slow; 6 beats per state at 120 BPM is plenty.
- Don't put `will-change` on anything the camera scales (text goes blurry).
- Optional motion blur: only on the 1–3 snapping moves, see `craft.md` §7. Don't switch the comp to 60 fps:
  every hand-keyed frame assumes 30 fps.
- **Preview one still per beat** of a morph chain before the full render, and fix anything off-grid,
  cramped or hard to read.

## 3. Components (in `assets/template/src/components`)
- **`Screen`**: the real capture as a floating sheet, driven by `cam` keyframes
  `{f, fx, fy, x, y, zoom, rot}`, where native point (fx, fy) is placed at frame point (x, y).
  `clips=[{src, from, at, rate}]` makes jump cuts in one shot: speed through navigation with
  `rate 1.5–1.6`, then cut to the payoff. `chrome="browser"` is for desktop web. `nativeW`/`cropTop`/`cropBottom`
  are per instance (mix capture sizes freely).
- **`Window`**: clips the screen to a band (`top`/`bottom`) with feathered edges, so the camera can push
  in without UI text colliding with the headline. Vary the band per scene.
- **`Sprite`**: a real component cut from a full-res frame (a `Part` in `ui.ts`, with `srcW` when the
  source isn't `SCREEN_W` wide), animated with `poses` `{f, x, y, w, rot, tiltX, tiltY, o}`.
  - `dock(camKey, rect, f, baseWidth, nativeW)` gives the pose where the component sits inside the
    `Screen`. Start docked, then fly out; that's what sells "this came from the app".
  - `reveal {from: "left"|"bottom"}`: progress bars fill and charts grow.
  - `swap {part: after}`: a wipe to the after-state capture (balances change, progress advances).
  - `ring {at, tone}` draws the outline; `shadow` sets depth.
- **`Veil`**: a background wash over the screen when components lift (0.6–0.93).
- **`Headline` / `Caption`**: mask-rise kinetic type; `exitAt` flicks it up; `units="chars"` for CJK.
- **`Marker`**: a stroke drawn around a screen region (native px); **`Tap`**: a ripple at real tap coordinates.
- **`Notification`**: a redrawn heads-up, only for notifications really posted, with the exact text.
- **`Morph`**: one container through a list of `MorphState`s `{at, x, y, w, h, radius, bg, content}`; per-edge
  springs, blur swaps, a press dip before each `at`. Content is real UI: `<Crop part={...} w={w} />` (a static
  crop of a capture) sized to the state's w×h. Build states with a helper that derives h and radius from the part.
- **`Cursor`**: an arrow pointer on spring paths with click dips (`clicks` frames). **Websites only**, wherever
  a change needs a cause (a nav link, button, tab). Apps, including web apps, use `Tap` instead.
- **`LottieLogo`**: plays the brand's Lottie logo from frame 0 of its Sequence (`@remotion/lottie` + `lottie-web`).
- **`Camera`** wraps each scene in `Promo.tsx` (§4): camera moves plus the seam on each side.
- Every `<Sequence>` gets `premountFor={30}` (not allowed with `layout="none"`) so fonts, images and video
  load a second before their first frame. Remotion renders frames independently: never use CSS
  `transition`/`animation` or animation classes, which won't render. Prefer the separate CSS `scale`/`translate`/
  `rotate` properties over long `transform` strings when nothing order-sensitive is needed.

## 4. Camera
Every scene moves, nothing sits dead centre, and every cut is a designed seam.
- Moves are `{f, s, x, y, r}` about the frame centre (cx = W/2, cy = H/2): push-ins, pull-backs,
  diagonal pans, and a 0.5–1° roll at the end. Scale interpolates with `output: "perceptual-scale"` (built
  into `Camera`) so a push feels even. Never zoom in then straight back out. Pair a scale change with a small
  lateral move or roll rather than a pure zoom.
- **Motivated camera:** the cause (a tap, a new element) is on screen 10–14 f before the camera reacts. The
  camera doesn't move on the same axis at the same moment as the element it's showing; let the element act,
  then settle the camera onto it. A camera push that frames a tap settles before the tap, holds through it,
  and releases after the result.

### Seams (cuts): the vector law
How scene A exits decides how scene B enters: **same axis, same direction, matched speed, cut mid-motion**.
`Promo.tsx` keeps one `cut: Seam` per cut and hands both sides to `Camera` (`seamOut` / `seamIn`), so they
can't disagree. Styles (`Camera.tsx`):
| Seam | What it does | Use |
|---|---|---|
| `curve` (default) | Partial travel on the two halves of power4.inOut (exit 9 f / 12% of the width, entry 11 f / 16.5%, so speed matches at the cut); the exit fades to 0.3, the entry starts at 0.35, so the frame never empties; ≤ 8 px blur | Every ordinary cut |
| `cut` | Hard cut between two finished frames | Underused; on a strong musical hit |
| `zoom` | Exit grows 1→1.2 with blur, entry grows 0.75→1 (same Z sign on both sides) | Going deeper into the same feature |
| `pullback` | Mirror: exit 1→0.8, entry 1.25→1 | The payoff or arrival beat |
| `whip` | 45%-width blurred travel in 6 f | An act break; **at most twice per video** |
- **One house direction** for every ordinary `curve` seam: **up** in 9:16 (headlines rise, so the incoming
  scene's mask-rise already travels the seam's way), **left** in 16:9 (start the first headline after the 11 f entry
  seam). Don't alternate directions; a change of direction needs a visible cause (a tap, an impact).
- Use only 2–3 seam styles per video and repeat them. A shared-element hand-off (the same real component
  carried across the cut at the same position and velocity) is the strongest seam and doesn't count toward that.
- The incoming scene's own entrances in its first ~15 f keep moving in the seam's direction (a left seam
  followed straight away by a rise from below breaks it).
- **The end card never gets seam motion:** `Promo.tsx` forces a hard cut into the last scene, so the logo animation
  plays from its first frame. Seams shorten automatically in scenes shorter than both of them, but keep scenes ≥ 30 f.
- Blur caps: 8–10 px while text is legible, 18–20 px only on full-frame surfaces. The root is painted with the
  canvas colour, so the half-faded frames mid-seam never flash white.
- `@remotion/transitions` (`TransitionSeries` with `fade`, `slide`, `wipe`, `clockWipe`, `lightLeak` overlays)
  is an alternative for editorial pieces, but transitions overlap scenes and shorten the timeline
  (60 f + 60 f with a 15 f transition = 105 f); it breaks `timeline.json`'s beat math, so prefer `Camera` seams.
- **General safe-area check.** A point (px, py) of the scene lands at
  `X = cx + (px − cx)·s + x` and `Y = cy + (py − cy)·s + y`. For every camera key while it's on screen, require:
  - headline/caption box `[left, top, right, bottom]` → `X(left) ≥ 24`, `X(right) ≤ W − 24`,
    `Y(top) ≥ 30`, `Y(bottom) ≤ H − 30`;
  - every sprite's corners (centre ± w/2, ± h/2, plus about 5% for rotation) in the same bounds;
  - for 1080×1920 with a headline at left 72 / top 260 (the `Headline` default in portrait) this reduces to
    `540 − 468·s + x ≥ 60` and `960 − 700·s + y ≥ 250` (the platform-overlay box below; 16:9 keeps the 24/30 margins).
  Most clipped-text defects came from skipping this. Check it with numbers, not by eye.
- **Platform overlays (9:16 for Reels/TikTok/Shorts):** the app's own buttons and caption cover the bottom
  ~20%, the right ~12% and the top ~10%. Keep headlines, captions and the proof element inside x 60–940,
  y 250–1500 at 1080×1920; UI can bleed under the overlays, copy can't.
- Off-centre composition: lifted components sit 40–80 px off the centre line, tilted (per direction),
  with stacks fanned at alternating rolls.

### 16:9 (and 1:1) layouts
- Set `W = 1920, H = 1080` (1:1: 1080×1080). Don't letterbox a 9:16 layout.
- Split the frame: **UI in the left 60%, type in the right 35%** (alternate sides between scenes for
  variety). Headline about 88–96 px at x ≈ 1150, y ≈ 300; caption below it.
- Desktop/web capture: `Screen chrome="browser"` with `baseWidth` 1100–1250 (the window fills about 60%
  of the width); phone captures: `baseWidth` 420–520 standing in the UI zone, and two phones side by side work well.
- Push-ins are smaller (s ≤ 1.1), pans are mostly horizontal, and seams travel left/right.

## 5. Scene recipes (pick a different one for adjacent scenes)
1. **Lift-out:** `Screen` → `Veil` → the hero component flies from `dock()` to a large tilted pose;
   secondary chips pop out and fan below it.
2. **Live proof:** a clip with jump cuts and a `Tap` → the result appears in the real UI → that element lifts
   out with a `ring` → one caption. Use it for automation ("it filed itself").
3. **Split:** pure sprites on the background. A header component, then two rows splitting apart (total
   versus fee, before versus after), with a big accent number as the headline.
4. **Deal / stack:** 4–6 real list rows fly in from below into a fanned stack; the last one gets the ring.
5. **Flip:** two captures of one component (plan A → plan B, light → dark mode) flip on Y in about 10 f,
   with the next elements arriving during the flip so the frame is never empty.
6. **Travel:** a value or item moves between two components as a chip (accent pill with the real
   value) along an arc, and the source `swap`s to its after state.
7. **Fill:** a chart or ring spins or grows in, then rows `reveal` one by one; the alert row gets a bad-colour ring plus a small shake.
8. **Before → after:** a card's `swap` wipes left to right (the progress bar visibly advances) while the
   real flow plays in a low `Window`.
9. **Duo:** two screens side by side, tilted ±3–4°, sliding in from opposite sides (great for 16:9).
10. **Scroll story (web):** the camera travels down a full-page still while sections lift out as sprites in turn.
11. **Collage end card:** 3–5 real components fly in around the icon or wordmark, name and CTA, with a slow pull-back.
    Use it only when the brand has no animated logo; otherwise end on recipe 13.
12. **Morph chain (one shape, no cuts):** one real component turns into the next: the size, radius and
    colour spring, the content blur-swaps, and a visible trigger (click, card tap) fires each change. Good for
    "one X does many things": a smart card → check-in alert → canteen balance → bus tracking → back to the card
    (ending on the first state closes the loop). 4–5 states, 5–6 beats each, headline + caption swapping on
    one side with separate enter/exit, a small progress indicator, and a slow continuous camera push. Every
    state's content must be a real capture; mixed sources are fine if numbers and currencies agree.
13. **Full logo animation end card:** the brand's own logo animation (Lottie from its site, an SVG animation,
    or a video) plays in full, then the CTA rises under it and holds 1–1.5 s. No seam motion over the logo's
    first frames: cut to it on the final hit. Scene length ≥ animation length + CTA hold.
14. **Ghost and guide:** before a real component lifts or morphs, a faint dashed outline stays at its start
    position (and, for a big move, thin dashed guides join origin and destination corners), so the eye can follow
    where it came from. Corner brackets can snap around the chosen element first ("this one") before it moves.
15. **Counter / odometer:** a real number from the capture counts to its value: `tabular-nums`, integers only,
    each digit a masked 0–9 strip, rightmost column landing first (3 f stagger right-to-left, ~1.6 s `EASE.arrive`);
    the number scales 0.82→1 just before the digits move. Use for balances, totals, attendance.
16. **Control → target:** a real control (slider, toggle, typed filter) and the thing it changes move on the same
    frames, curve and duration, so cause and effect read as one gesture.
17. **Same data, two forms:** a chart morphs between forms (bars slim to hairlines, then a line draws through the
    same points) to show the same data two ways. Trust comes from the numbers staying put.

### End on the full logo animation
- Sites often ship the logo as Lottie inlined in a Next.js chunk: download the page's `/_next/static/chunks/*.js`,
  find `JSON.parse('{"v":"5.`, unescape the string literal, and save the JSON into `src/assets/` (not `captures/`,
  which isn't bundled). Also check network responses for `.json`/`.lottie` files and `window.lottie.getRegisteredAnimations()`.
- Check `fr` (should equal the comp fps, or set `playbackRate`), `op − ip` (its length), `w × h` (scale to fit),
  and render stills at 0 / 25 / 50 / 75 / 100% to confirm it matches the live site.

## 6. Copy
- **Explain, don't sloganize.** Headline = concrete action or result; caption = how it works or the proof
  on screen. Take the wording from the product's code (labels, helper text) and its site's feature text.
  Weak: "Cashless, to the cent.", "Just type what you need.", "Every period in its place."
  Better: "Tap at the canteen. / Lunch is paid.", "Type “add”. / Enroll a student.",
  "One timetable / for every class."
- Every claim is visible on screen in that scene, or stated by the product's own site (then it goes in the caption).
- **Hook formulas** (frame 0 must work as a thumbnail):
  - outcome: "Know where every dollar goes."
  - pain flipped: "Stop typing in receipts."
  - promise plus proof: "Your inbox, sorted in seconds."
  - ticker takeover: a cycling word ("A spreadsheet? A notebook? A group chat?") that the real answer replaces.
  - single-stat cold open: one real number counting up, then what it means.
- **Feature headlines** are what the user gets, in their words. Use "It files your receipts", not
  "Automated document ingestion". Banned: *seamless, powerful, effortless, unlock, revolutionize,
  leverage, all-in-one, next-level*, and lists of features joined by commas.
- Two lines, at most 5 words per line. Plain verbs, no exclamation marks.
- One caption at most per scene, adding proof, never over live UI (on a `Veil` of 0.9 or more, or bare background).
- Use the product's real numbers in the copy, consistent with what's on screen in that scene.
- End card: icon or wordmark, name, a CTA that names the real action and place ("Free on Google Play.",
  "Try it at acme.com."), and an optional tagline.

## 7. Variety checklist (run before rendering stills)
- [ ] The direction is chosen, and `look`, easing, radii and camera amplitude match it.
- [ ] No two adjacent scenes share a recipe or a layout (headline position, screen versus pure sprites, band).
- [ ] Every scene has a camera move. Every cut has one `Seam` in `Promo.tsx`; ordinary seams share one direction,
      2–3 seam styles in total, at most 2 whips, and the incoming scene's first entrances follow the seam's direction.
- [ ] Every line of copy is still for at least `readFrames(text)`; text never moves while being read.
- [ ] Springs: ζ ≥ 0.7 everywhere except the one hero `POP` (none in editorial); nothing enters from scale 0;
      no idle loops.
- [ ] Exits are shorter than entrances; staggers finish within ~15 f; one focal event at a time.
- [ ] Every feature scene animates at least one real component; it isn't just a recording.
- [ ] Every scene has one proof moment (marker, ring, swap, or a tap with its result).
- [ ] Nothing important sits dead-centre and static for more than about 1 s.
- [ ] The safe-area check passes for every camera key while text is on screen, and in 9:16 all copy sits inside
      the platform-overlay box (x 60–940, y 250–1500).
- [ ] Each headline at its size fits its zone: estimate width ≈ chars × 0.58 × size px for a bold sans, and confirm on a still.
- [ ] Morph chains: an action on every beat, one still per beat reviewed, no two texts overlapping mid-swap.
- [ ] The video ends on the brand's full logo animation (if it has one).
