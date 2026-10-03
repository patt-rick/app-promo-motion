# Intake: access and brief

The video can only be as good as your access to the real product. Get access before
anything else, and ask only what you can't find out yourself.

## Access, by product type

**Website / web app**
- Ask for the URL. If the good parts sit behind a login, ask for a **demo account** first.
  If they have none, run `node scripts/web_capture.mjs login --url <url>` from the promo project. That
  opens a visible Chrome window where the user signs in themselves (the session is kept in
  `.chrome-profile/`); never ask for their password or type it.
- Ask whether a staging or demo environment has realistic sample data. Production accounts
  show real customers.

**Android app** (best results: you can drive it and seed data)
Walk the user through this. They'll type commands with `!` in Claude Code, or tap on the phone:
1. Install platform-tools: `winget install Google.PlatformTools` (Windows),
   `brew install android-platform-tools` (Mac) or the distro package. Restart the terminal.
2. Phone: Settings → About phone → tap **Build number** 7 times → Developer options → **USB debugging** on.
3. Plug in, then accept **Allow USB debugging?** on the phone. Tick "Always allow".
   Wireless alternative (Android 11+): Developer options → Wireless debugging → Pair with code, then
   `adb pair ip:port code` and `adb connect ip:port`.
4. Check that `adb devices` shows `device`. If it shows `unauthorized`, the prompt is waiting on the phone.
   Optional: `winget install Genymobile.scrcpy` lets the user watch the phone screen live.
- If the app's source is available, plan a **demo build** (`capture-android.md`) so real data never
  appears. If it isn't, ask the user to create a demo account or demo data inside the app.

**iOS app**
You can't drive iOS from Windows. Options, in order of preference:
- The user records with Control Centre → Screen Recording (turn notifications off with a Focus mode
  first) and sends you the files plus screenshots of each key screen.
- On a Mac with the source, use the Xcode simulator: `xcrun simctl io booted recordVideo out.mov`
  and `xcrun simctl io booted screenshot`; seed data through the app's own debug paths.
Give them an exact shot list (see "What to capture" below) so the footage cuts together.

**Desktop app / anything else**
Ask for screen recordings at native resolution and 30–60 fps, plus stills of each state.

## The brief (ask together, offer defaults)
1. **Who is it for, and what's the one-line promise?** This becomes the hook headline.
2. **Which 3–6 features matter most?** Push back on more than 6 in 30 s.
3. **Where will it be posted?** That decides the format: 9:16 (Reels/TikTok/Shorts/Stories, the
   default for mobile apps), 16:9 (YouTube, website hero, desktop/web products), 1:1 (feeds).
   One format per layout. Never crop one format into another.
4. **Length?** Default 20–30 s; 15 s for a single-feature ad. Social favours 15–30 s.
5. **Music?** (a) a bespoke generated track timed to the cuts (no licensing), in one of three styles:
   `groove` (upbeat Afro-house feel, consumer), `minimal` (clean tech, SaaS), or `calm` (premium,
   wellness). (b) Their own track, recommended for brands that need a very different sound; they must
   have the rights. Ask for the file plus any section to start from.
6. **Brand:** colours and font (read them from the code or CSS if you can), app icon/logo file,
   store link / CTA text, anything off-limits.
7. **Reference style** (optional): a video or frame they like. If they have none, pick the
   direction yourself and show stills first.

## What to capture (shot list)
- A clean still of every screen in the storyboard, in its best state (scrolled to the good part).
- A recording of every interaction you'll show (tap, form, toggle, transfer). Record from a
  second before the first tap until a second after the result settles.
- **Before and after** stills of anything that changes, so the animation can wipe from one to the other.
- The real empty, loading and success states if they're delightful (toasts, confetti, check marks).
- The app icon at high resolution, and any widgets or home-screen presence.
