# Capturing an Android app

Load the helpers first: `PKG=<package> source <skill>/scripts/android.sh`. That gives you `shot`,
`ui`, `tap`, `swipe`, `typeit`, `back`, `home`, `launch`, `rec`, `cfr`, `frame`, `timing`,
`awake_on`/`awake_off`, `notify`, `rk_pull`/`rk_push`. In Git Bash it sets `MSYS_NO_PATHCONV=1`;
without that, `/sdcard/...` silently becomes `C:/Program Files/Git/sdcard/...`.

## 1. Keep real data off screen, starting with the cheapest option
1. **Demo account inside their installed app.** Many apps support it (log out, then sign up as a demo
   user), or a profile/workspace switch does the job. No build needed: use it if the data looks rich enough.
2. **An existing build** the user already has (EAS/CI preview APK, internal track) installed alongside,
   then populated through the UI or a seed.
3. **A demo build from source** (below). It costs 20–25 min the first time, plus SDK setup on a fresh
   machine (`pitfalls.md`); later builds take about 6 min. Worth it when you need rich seeded data.
   Expo managed apps (no `android/` folder): run `pnpm exec expo prebuild -p android` in a scratch copy first,
   or use an EAS `preview` profile with a `.demo` package id.

**Demo build, React Native / Expo with a committed `android/` folder:** install a second copy next to
the real one using a Gradle init script, so no tracked file changes:
```groovy
// demo-variant.gradle
allprojects { if (name == "app") { afterEvaluate {
    android.buildTypes.release.applicationIdSuffix = ".demo"   // installs side by side
    android.buildTypes.release.debuggable = true               // enables run-as for seeding
} } }
```
```bash
cd android && ./gradlew --no-daemon --max-workers=2 --init-script /abs/demo-variant.gradle assembleRelease \
  -PreactNativeArchitectures=arm64-v8a -Pkotlin.compiler.execution.strategy=in-process "-Dorg.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=512m"
adb install -r app/build/outputs/apk/release/app-release.apk
```
- Build the **release** variant (JS bundled, no dev-client launcher, smooth) and make it debuggable.
- `arm64-v8a` only: most modern phones, and much faster to build.
- First check what hardcodes the package name: manifest services, widget providers, intent
  actions, deep-link schemes.
- Native apps (Kotlin/Java) work the same way: `applicationIdSuffix` + `debuggable`.
- If there's no source, use a demo account inside the user's own install instead.
- Windows build gotchas (SDK path with spaces, MAX_PATH, ninja, JDK) are in `pitfalls.md`.

**Seeding data**
- **React Native AsyncStorage** (`@react-native-async-storage/async-storage`): it's SQLite at
  `databases/RKStorage`, table `catalystLocalStorage(key, value)`.
  1. `launch` the app once so the database exists, then `adb shell am force-stop $PKG`.
  2. Write a generator (Node or Python) that outputs `{storageKey: JSON-string}` using the app's
     own types and helpers: read `types.ts` and the storage-key files.
  3. `python <skill>/scripts/seed_asyncstorage.py RKStorage seed.json`, then `rk_push RKStorage`.
  4. If `android/build.gradle` sets `AsyncStorage_useNextStorage`, the storage backend differs; check before seeding.
- **SharedPreferences:** push `shared_prefs/<name>.xml` the same way via `run-as`.
- **Room/SQLite:** pull it, edit it with Python's `sqlite3`, push it back.
- **Otherwise:** script the UI to create data, or use the app's own import/debug seed path.

**What the seed must cover**
- Realistic names, amounts and dates **relative to today**, so "this month" views are full.
  Seed enough current-period activity that budgets and charts look alive.
- Every state a scene needs: one item over its limit, partial progress, a success toast.
- First-run noise suppressed: tour/onboarding flags, rating prompts, promo cards, update prompts.
  Grep the code for the storage keys behind each one.
- Recurring or scheduled jobs with future due dates, so no surprise items appear on launch.

## 2. Find the UI and drive it
- `ui` prints every labelled node with its bounds. Use them for taps and later for sprite crops.
- `shot name` saves a screenshot. Read it to check state before you record.
- Keep the screen awake with `awake_on` before takes, and **always** `awake_off` afterwards. A dimmed
  or locked screen mid-take leaks the lock screen and the user's notifications.
- Samsung ignores the clean-status-bar demo mode. Crop the status bar in Remotion instead
  (`CROP_TOP`/`CROP_BOTTOM` in tokens); that also hides the real clock and notification icons.

## 3. Record takes
- Do the recording and the interaction **in one command**, so the result lands inside the take:
  `( rec transfer 16 & ); sleep 1.2; tap 906 2202; sleep 1.4; ...; tap 540 2172; sleep 4`
  Splitting it across tool calls ran past the time limit twice and missed the payoff.
- Type with `typeit`. The keyboard shows up dark in the clip; cut past it with a jump cut.
- Real notifications (for apps that react to them): `notify TAG Title "Body text"` posts one from the
  shell. Without the helper's quoting, only the first word arrives. If the app parses notifications,
  run its parser on the exact text in a unit test before recording. Shell notifications may not show as
  heads-up (Samsung); redraw them with `Notification` using the identical text, and say so.
- Re-seed (`rk_push`) between takes that change data, so every take starts from the same state.
- **Home-screen widgets:** put them on an empty home page. Check with `dumpsys activity activities`
  that the config activity belongs to the demo package before confirming. Screenshot, crop tightly
  to the widget's bounds, then remove the demo widget. Leave the user's own widgets alone.

## 4. Prepare clips
- `cfr captures/x.mp4 public/clips/x.mp4 [trim_start_s]` converts to constant 30 fps;
  screenrecord output is variable frame rate.
- `timing public/clips/x.mp4 sheet.png` makes a frame-numbered sheet (label k means frame k×6).
  Read it and note the exact frames of each tap, result and toast. Scenes, SFX and markers key off these.
- `frame public/clips/x.mp4 N public/stills/ui/name.png` grabs full-res frames as sprite sources.
- **Privacy pass:** look at the first and last frames of every clip. Lock screens, notification
  shades and other apps must be trimmed off before they're in `public/`; delete the raw capture too.

## iOS / user-supplied recordings
Convert them with `cfr` and build timing sheets the same way. Ask for stills of each key state
for sprites. Can't seed data? Ask them to use a demo account. Status bars: crop them, or ask them
to record with a clean bar (9:41, full battery) where possible.
