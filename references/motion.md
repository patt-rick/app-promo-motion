# Motion design: system, components, recipes

## Contents
1. Visual system · 1b. Directions (pick one per product)
2. Timing (incl. a 15 s plan)
3. Components
4. Camera (general safe-area formula, 16:9)
5. Scene recipes
6. Copy
7. Variety checklist

## 1. Visual system
- **Canvas = the product's own background colour.** The video should feel like the product opened up.
  All colours come from the product's theme: background, text, one `accent`, a `surface`, and
  semantic good/bad colours for rings.
- **One typeface, the product's own** (`@remotion/google-fonts` or a local file). Its available
  weights and subsets go into `loadFont` (non-Latin products need `latin-ext`, `cyrillic` and so on;
  for CJK or Thai set `units="chars"` on `Headline`; for RTL put `direction: "rtl"` on a wrapper).
  Headlines are two lines max, sentence case, left-aligned (right-aligned for variety). Captions are
  500 weight at 36–40 px in the secondary text colour, under 75 characters.
- **Avoid:** centred text on gradients, ALL-CAPS eyebrow labels, one highlighted word, slow fades,
  stock device mockups with glossy bezels, decorative blobs.
- **The proof device:** an accent outline (`Marker` / `ring`) around the real UI element proving the
  claim. Use it once per scene, on the one thing that matters.
- Real UI floats as a sheet (rounded, warm shadow, status bar cropped), shown large: 70–90% of frame
  height, or cropped close-ups. Never small in the middle of empty space.

## 1b. Directions: pick one at storyboard time from the brand
Same components, different feel, so two products never come out looking alike. Set `look` in
`tokens.ts`, plus the easing, radii and camera amplitude below.
| Direction | For | Type | Motion | Camera | Radii |
|---|---|---|---|---|---|
| **Springy** | Consumer, fintech, social | 800, −0.045em, 112 px | springs (damping 12), quick 10–12 f entrances, playful tilts (4–8°) | push 1.0→1.15, whips | large (48–64) |
| **Editorial** | Premium, wellness, finance-trust | 600–700, −0.02em, 96 px, airy line-height | slow eases (`bezier(0.45,0,0.2,1)`), 18–24 f entrances, no tilts above 3° | slow pushes 1.0→1.06, cross-whips only between acts | medium (24–36) |
| **Technical** | Dev tools, B2B, dashboards | 700, −0.03em, 88–100 px, monospace numerals | crisp linear-ish wipes, grid-snapped layouts, data counts | pans along rows and columns, small scale changes | small (8–16) |
| **Bold** | Gaming, creator, youth | 900, −0.05em, 130 px, oversized type bleeding off the edges | hard cuts on every beat, scale pops, shakes | big pushes 1.0→1.25, fast whips | mixed |
Pair the music style with it: springy→groove, editorial→calm, technical→minimal, bold→groove or the user's track.

## 2. Timing
- 30 fps. Scenes are defined in beats in `timeline.json`; at 120 BPM a beat is 15 frames. With a custom
  track, size scenes in **seconds** (2.5–4.5 s each) and convert with the track's BPM; don't copy beat counts.
- **25–30 s plan:** hook 4–5 beats, 4–6 features of 5–9 beats each, end card 6–7 beats.
- **15 s plan:** hook 4 beats, 2 features of 8 beats each, end card 6 beats (30 beats at 120 BPM).
  One promise, two proofs.
- Within a scene the motion has three moments: **arrive** (0–12 f: headline words rise, whip in),
  **prove** (the real interaction or the lifted component, plus marker), **settle** (slow drift, then
  the headline exits about 8 f before the cut). The last pose sits on the scene's final frame, with no frozen tail.
- Frame 0 is the thumbnail, because autoplay is muted. It must be bright, with the headline already set
  (`at < 0`) and the real UI visible. No whip-in on the hook.
- Easing per direction (above); never linear camera moves, never fades longer than 10 f.

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
- **`Camera`** wraps each scene in `Promo.tsx` (§4).

## 4. Camera
Every scene moves, nothing sits dead centre, and every cut is a whip (or a cross-cut for the
editorial direction).
- Moves are `{f, s, x, y, r}` about the frame centre (cx = W/2, cy = H/2): push-ins, pull-backs,
  diagonal pans, and a 0.5–1° roll at the end. Whips: `whipOut` on every scene except the end, `whipIn`
  on every scene except the hook, alternating direction.
- **General safe-area check.** A point (px, py) of the scene lands at
  `X = cx + (px − cx)·s + x` and `Y = cy + (py − cy)·s + y`. For every camera key while it's on screen, require:
  - headline/caption box `[left, top, right, bottom]` → `X(left) ≥ 24`, `X(right) ≤ W − 24`,
    `Y(top) ≥ 30`, `Y(bottom) ≤ H − 30`;
  - every sprite's corners (centre ± w/2, ± h/2, plus about 5% for rotation) in the same bounds;
  - for 1080×1920 with a headline at left 72 / top 150 this reduces to
    `540 − 468·s + x ≥ 24` and `960 − 810·s + y ≥ 30`.
  Most clipped-text defects came from skipping this. Check it with numbers, not by eye.
- Off-centre composition: lifted components sit 40–80 px off the centre line, tilted (per direction),
  with stacks fanned at alternating rolls.

### 16:9 (and 1:1) layouts
- Set `W = 1920, H = 1080` (1:1: 1080×1080). Don't letterbox a 9:16 layout.
- Split the frame: **UI in the left 60%, type in the right 35%** (alternate sides between scenes for
  variety). Headline about 88–96 px at x ≈ 1150, y ≈ 300; caption below it.
- Desktop/web capture: `Screen chrome="browser"` with `baseWidth` 1100–1250 (the window fills about 60%
  of the width); phone captures: `baseWidth` 420–520 standing in the UI zone, and two phones side by side work well.
- Push-ins are smaller (s ≤ 1.1), pans are mostly horizontal, and whips are left/right.

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

## 6. Copy
- **Hook formulas** (frame 0 must work as a thumbnail):
  - outcome: "Know where every dollar goes."
  - pain flipped: "Stop typing in receipts."
  - promise plus proof: "Your inbox, sorted in seconds."
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
- [ ] Every scene has a camera move; whips alternate direction.
- [ ] Every feature scene animates at least one real component; it isn't just a recording.
- [ ] Every scene has one proof moment (marker, ring, swap, or a tap with its result).
- [ ] Nothing important sits dead-centre and static for more than about 1 s.
- [ ] The safe-area check passes for every camera key while text is on screen.
