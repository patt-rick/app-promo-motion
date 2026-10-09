# Environment pitfalls (each one cost real time)

## Windows paths
- **Keep the promo project at a short path** (e.g. `C:\work\acme-promo`). Remotion's
  chrome-headless-shell inside `node_modules\.remotion` breaks past MAX_PATH ("spawn ... ENOENT").
- **Git Bash mangles device paths:** `/sdcard/x` becomes `C:/Program Files/Git/sdcard/x`. Export
  `MSYS_NO_PATHCONV=1` (android.sh does), and pass Windows paths to adb or Python via `cygpath -w`.
- Batch files (`gradlew.bat`) under a path with spaces: call them from PowerShell (`& .\gradlew.bat ...`
  or `Start-Process -FilePath ... -WorkingDirectory ...`); `cmd /c` and bash invocation both failed.
- ffmpeg `drawtext` on Windows needs `fontfile='C\:/Windows/Fonts/arial.ttf'`.
- Avoid shell heredocs for files with quotes or backticks; write files with the editor tool.

## Android native builds (React Native / Expo)
- No SDK installed? Use portable installs, no admin needed: a JDK 17 zip
  (`https://aka.ms/download-jdk/microsoft-jdk-17-windows-x64.zip`) and the Android commandline-tools
  zip into `%LOCALAPPDATA%\Android\Sdk`, then `sdkmanager --licenses` and install the platform,
  build-tools and NDK versions from `node_modules/react-native/gradle/libs.versions.toml`.
  `winget` MSI installs can hang on a hidden UAC prompt.
- JDK 25 is too new for Gradle 8.x; use 17.
- **SDK path containing a space** (e.g. `C:\Users\First Last\...`): CMake calls clang by its 8.3
  short name (`CLANG_~1.EXE`), clang links in C mode, and you get `undefined symbol: __cxa_*` / `operator new`.
  Fix: a junction `mklink /J C:\asdk "%LOCALAPPDATA%\Android\Sdk"` and `ANDROID_HOME=C:\asdk`, then delete the `.cxx` folders.
- **Filename longer than 260 characters** from ninja on codegen objects: Windows `LongPathsEnabled=1`
  plus a long-path-aware ninja. Replace `Sdk\cmake\3.22.1\bin\ninja.exe` with ninja 1.12+ (keep a
  backup). `subst` drive tricks and `CMAKE_OBJECT_PATH_MAX` did not help, and Expo autolinking
  fails at a drive root.
- Memory: build with `--no-daemon --max-workers=2`, `-Xmx1536m`, Kotlin in-process. A full first
  build takes about 20–25 min; later builds take about 6 min.
- Docker Desktop/WSL can hold gigabytes of RAM. Ask before closing it.

## Rendering
- `--concurrency=2`. Higher settings got the render killed under memory pressure.
- **Never open the output file in a player while re-rendering it.** Windows locks it, and Remotion's
  final rename fails (EPERM). The finished render is left as `*.remotion-in-progress`; rename it,
  then remux with `ffmpeg -c copy -movflags +faststart`. Better: write each render to a new filename.
- `--log=error` hides progress; when a render "succeeds" with no output, check the file's timestamp.
- `useVideoConfig().durationInFrames` inside a `<Sequence>` is the sequence's duration;
  `Camera` relies on that for its exit seams.

## Device etiquette
- Long-press on a home screen can hit the user's widgets or open search. Read the screenshot after
  every launcher interaction before tapping.
- Note and restore the screen timeout (`awake_on`/`awake_off`), demo status-bar mode and any widgets you added.
- Never ask for, or type, the user's passwords or PINs into their real accounts. Demo data only.
