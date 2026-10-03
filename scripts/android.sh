# Source me from Git Bash (or any bash):  PKG=com.example.app.demo source <skill>/scripts/android.sh
# Helpers for driving an Android device over adb while capturing a promo. Works with the screen
# the user can see; nothing here installs or deletes apps.
export MSYS_NO_PATHCONV=1   # Git Bash on Windows: stop /sdcard paths becoming C:/Program Files/Git/sdcard

ADB="${ADB:-$(command -v adb || true)}"
if [ -z "$ADB" ]; then
    for c in "$LOCALAPPDATA/Microsoft/WinGet/Packages"/Google.PlatformTools*/platform-tools/adb.exe "$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe" "$HOME/Library/Android/sdk/platform-tools/adb" "$HOME/Android/Sdk/platform-tools/adb"; do
        [ -x "$c" ] && ADB="$c" && break
    done
fi
[ -z "$ADB" ] && echo "adb not found: install Android platform-tools (winget install Google.PlatformTools / brew install android-platform-tools)" >&2

# ffmpeg drawtext needs an explicit font on Windows (no fontconfig)
FONT=""; [ -f /c/Windows/Fonts/arial.ttf ] && FONT="fontfile='C\:/Windows/Fonts/arial.ttf':"
PKG="${PKG:-}"
CAP="${CAP:-$PWD/captures}"
mkdir -p "$CAP"
winpath() { if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else echo "$1"; fi; }

adb() { "$ADB" "$@"; }
shot() { adb exec-out screencap -p > "$CAP/${1:-now}.png"; echo "$CAP/${1:-now}.png"; }
tap() { adb shell input tap "$1" "$2"; }
swipe() { adb shell input swipe "$1" "$2" "$3" "$4" "${5:-300}"; }
back() { adb shell input keyevent 4; }
home() { adb shell input keyevent KEYCODE_HOME; }
typeit() { adb shell input text "${1// /%s}"; }   # spaces must be sent as %s
# ui: on-screen nodes as "label  [x1,y1][x2,y2]" - use these bounds for taps AND for sprite rects.
ui() {
    adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
    adb exec-out cat /sdcard/ui.xml | tr '>' '\n' | grep -oE '(text|content-desc)="[^"]+"[^/]*bounds="[^"]+"' \
        | sed -E 's/.*(text|content-desc)="([^"]*)".*bounds="([^"]*)".*/\2  \3/' | grep -v '^  '
}
launch() { adb shell am force-stop "$PKG"; adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; }
# rec NAME SECONDS - native-res recording pulled to captures/NAME.mp4. screenrecord only writes frames
# when the screen changes (VFR): convert to CFR before editing (see cfr below). Run it in the background
# ( rec x 12 & ) and drive the UI in the SAME command, so taps and the result land inside the take.
rec() {
    adb shell screenrecord --bit-rate 24000000 --time-limit "${2:-10}" "/sdcard/$1.mp4"
    adb pull "/sdcard/$1.mp4" "$(winpath "$CAP/$1.mp4")" >/dev/null && adb shell rm "/sdcard/$1.mp4"
    echo "$CAP/$1.mp4"
}
# cfr IN OUT [START_SEC] - constant 30 fps H.264 for Remotion; START_SEC trims a bad head (e.g. lock screen)
cfr() { ffmpeg -v error ${3:+-ss "$3"} -i "$1" -vf "fps=30,format=yuv420p" -c:v libx264 -crf 14 -preset fast -an -y "$2"; }
# frame CLIP N OUT - one full-res frame (for sprite sources and bound measuring)
frame() { ffmpeg -v error -i "$1" -vf "select='eq(n\,$2)'" -frames:v 1 -y "$3"; }
# timing CLIP OUT - frame-numbered contact sheet (every 6th frame; label k means frame k*6); rows fit the clip
timing() {
    local n rows
    n=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$1")
    rows=$(( (n / 6 + 14) / 14 ))
    ffmpeg -v error -i "$1" -vf "select='not(mod(n\,6))',scale=150:-1,drawtext=${FONT}text='%{n}':x=4:y=4:fontsize=22:fontcolor=red:box=1:boxcolor=white,tile=14x${rows}" -vsync 0 -frames:v 1 -y "$2"
}

# Keep the screen awake during takes; ALWAYS restore afterwards (it's the user's personal phone).
# The original value is saved once, so a second awake_on never overwrites it with the 30-min value.
awake_on() { [ -f "$CAP/.orig_timeout" ] || adb shell settings get system screen_off_timeout | tr -d '\r' > "$CAP/.orig_timeout"; adb shell settings put system screen_off_timeout 1800000; }
awake_off() { [ -f "$CAP/.orig_timeout" ] && adb shell settings put system screen_off_timeout "$(cat "$CAP/.orig_timeout")" && rm "$CAP/.orig_timeout"; }

# Pixel/AOSP clean status bar. Samsung One UI ignores it - crop the status bar in Remotion instead.
demo_bar() {
    [ -f "$CAP/.orig_demo_allowed" ] || adb shell settings get global sysui_demo_allowed | tr -d '\r' > "$CAP/.orig_demo_allowed"
    adb shell settings put global sysui_demo_allowed 1
    adb shell am broadcast -a com.android.systemui.demo -e command enter >/dev/null
    adb shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 0941 >/dev/null
    adb shell am broadcast -a com.android.systemui.demo -e command notifications -e visible false >/dev/null
}
demo_bar_off() {
    adb shell am broadcast -a com.android.systemui.demo -e command exit >/dev/null
    if [ -f "$CAP/.orig_demo_allowed" ]; then
        local v; v=$(cat "$CAP/.orig_demo_allowed")
        if [ "$v" = "null" ]; then adb shell settings delete global sysui_demo_allowed >/dev/null; else adb shell settings put global sysui_demo_allowed "$v"; fi
        rm "$CAP/.orig_demo_allowed"
    fi
}

# notify TAG TITLE BODY - post a real notification (from com.android.shell). Quote for the DEVICE shell:
# without the inner quotes adb flattens the args and only the first word arrives.
notify() {
    local q="'" esc="'\\''"   # apostrophes -> '\'' for the device's single-quoted strings
    adb shell "cmd notification post -S bigtext -t '${2//$q/$esc}' '${1//$q/$esc}' '${3//$q/$esc}'" >/dev/null
}

# AsyncStorage (React Native, Android) lives in databases/RKStorage (SQLite, table catalystLocalStorage(key,value)).
# rk_pull OUT / rk_push IN - needs a debuggable build (run-as). Force-stop the app before pushing.
rk_pull() { adb exec-out run-as "$PKG" cat databases/RKStorage > "$1"; }
rk_push() {
    adb shell am force-stop "$PKG"
    adb push "$(winpath "$1")" /data/local/tmp/RKStorage >/dev/null && adb shell chmod 644 /data/local/tmp/RKStorage
    adb shell "run-as $PKG sh -c 'rm -f databases/RKStorage-journal databases/RKStorage-wal databases/RKStorage-shm; cat /data/local/tmp/RKStorage > databases/RKStorage'"
    adb shell rm /data/local/tmp/RKStorage
}
