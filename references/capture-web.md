# Capturing a website or web app

`new_project.sh` copies `web_capture.mjs` into `<project>/scripts/`, and the template lists
`playwright-core`. **Run it from the project**, because Node resolves imports next to the script:
`node scripts/web_capture.mjs run --plan capture.json` (or `pnpm capture:web`). It drives the user's
installed Google Chrome, so there's no browser download. Every step is listed in the header comment of
`scripts/web_capture.mjs`.

## Logged-in products
`node scripts/web_capture.mjs login --url https://app.acme.com` opens a visible Chrome with a
persistent profile (`.chrome-profile/`, gitignored). The **user** signs in, ideally to a demo account,
and closes the window. Then add `"profile": ".chrome-profile"` to `capture.json`. Never ask for or type
their password. Avoid or blur real customer data you see, and tell the user.

## Device and sizes
- **9:16 promo:** `"device": "mobile"` (390×844 CSS px at 3×, so 1170 px wide). Most landing pages look
  best in their mobile layout inside a vertical video.
- **16:9 promo, or a desktop-first app:** `"device": "desktop"` (1280×720 at 1.5×, so 1920×1080). Use
  `<Screen chrome="browser" url="acme.com" nativeW={1920} cropTop={0} cropBottom={1080}>`.
- Web captures have no status bar: `cropTop = 0`, `cropBottom` = the image height.
- **Mixing sizes in one video** (a mobile still, a desktop still, a tall full-page still): don't change
  the global tokens. Pass `nativeW` / `cropTop` / `cropBottom` per `<Screen>`, the same `baseWidth` and
  `nativeW` to `dock()`, and `srcW` on each `Part`.

## The plan file, pattern by pattern
1. `hide` cookie banners, chat bubbles and pop-ups (find their selectors from a first `shot`).
   Hiding them beats clicking "accept", which can change the layout.
2. `shot` each key state; `fullPage: true` for long pages the camera will travel down.
3. `rects` (with `"for": "<an earlier shot>"`) gives exact native-px bounds measured from the DOM,
   compensated for any scrolling since that shot. `rects.json` entries are `{src, srcW, rect}`:
   copy the shot PNG into `public/stills/ui/`, then use `{ ...rects.hero, radius: 32 }` as a `Part` in `ui.ts`.
4. `scroll` renders a frame-perfect eased scroll (one screenshot per frame) to a selector or y.
5. `flow` records clicks, typing and hovers with CSS/Web Animations slowed 4× during capture and sped
   back up, so transitions come out smooth at full resolution (waits and typing are scaled
   automatically). Motion driven by JS/requestAnimationFrame isn't slowed: if the log warns "low", use
   before/after stills plus `Sprite swap`.
6. `goto` the next page; hidden selectors and CSS are re-applied.

## Web-specific craft
- The camera can travel a full-page still instead of a recorded scroll:
  `<Screen still="home-full.png" cropBottom={pageHeight}>` with keyframes moving `fy`.
- Lift the parts that carry the pitch, such as the hero block, a pricing card, a feature tile or a
  testimonial, and animate them like app components.
- Zoom until body text reads at about 40 px or more in the output frame. If it can't be read at that
  size, it shouldn't be on screen.
- Scroll-triggered reveals: capture them with `scroll`; once fired, they stay visible in later stills.

## Product widgets on the marketing site
Marketing pages often render real product UI as HTML (notification cards, balances, bus trackers). They are
crisper than any screenshot: find the element by its text, climb to the card container, force
`animation: none`, an opaque background, `transform: none`, `box-shadow: none`, then
`locator.screenshot({ omitBackground: true })` at `deviceScaleFactor: 4`. Inset the crop 8 px and rely on the
sprite's radius mask so photo or neighbour slivers at the corners disappear. Skip rotated or overlapping widgets.
