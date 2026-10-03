"""Prepare a user's own music for a promo: beat grid, drop, trimmed + loudness-normalised WAV.

    python <skill>/scripts/beats.py path/to/track.mp3 [--start 12.0] [--seconds 30] [--fps 30]

Run from the promo project root. It
  1. analyses the track from --start (default 0) with numpy/scipy (onset flux -> tempo by
     autocorrelation -> beats by dynamic programming -> downbeat phase from low-end onsets),
  2. shifts the start onto the first beat so beat 0 == frame 0,
  3. writes public/audio/music.wav (trimmed, two-pass loudnorm to -14 LUFS / -1.5 dBTP),
  4. overwrites src/beats.ts with the detected BEAT_FRAMES so every cut lands on a real beat, and sets
     "bpm" + "music": "custom" in timeline.json (so compose.py is not used),
  5. prints tempo, confidence, downbeats, the strongest energy rise ("drop"), and suggested cuts.
Pick a --start that skips a slow intro; put the hook on beat 0 and the hero moment on the drop.
The user is responsible for having the rights to the track.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path

import numpy as np
from scipy.ndimage import uniform_filter1d
from scipy.signal import butter, sosfilt

SR = 22050
HOP = 256
NFFT = 2048


def decode(path: str, start: float, seconds: float) -> np.ndarray:
    cmd = ["ffmpeg", "-v", "error", "-ss", f"{start}", "-t", f"{seconds}", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"]
    res = subprocess.run(cmd, capture_output=True)
    if res.returncode != 0:
        raise SystemExit(f"ffmpeg could not read {path}: {res.stderr.decode(errors='ignore').strip()[:300]}")
    raw = res.stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def onset_envelope(x: np.ndarray, lowpass: float | None = None) -> np.ndarray:
    if lowpass:
        x = sosfilt(butter(4, lowpass, "low", fs=SR, output="sos"), x)
    n = 1 + (len(x) - NFFT) // HOP
    frames = np.lib.stride_tricks.as_strided(x, (n, NFFT), (x.strides[0] * HOP, x.strides[0]))
    mag = np.abs(np.fft.rfft(frames * np.hanning(NFFT), axis=1))
    mag = np.log1p(1000 * mag[:, : int(8000 / SR * NFFT)])
    flux = np.maximum(0, np.diff(mag, axis=0)).sum(axis=1)
    flux = np.concatenate([[0], flux])
    flux -= uniform_filter1d(flux, 16)  # remove slow trend
    flux = np.maximum(flux, 0)
    return flux / (flux.std() + 1e-9)


def tempo(env: np.ndarray, fps: float) -> tuple[float, float]:
    ac = np.correlate(env, env, "full")[len(env) - 1 :]
    lags = np.arange(len(ac))
    bpm = 60 * fps / np.maximum(lags, 1)
    valid = (bpm >= 70) & (bpm <= 180)
    weight = np.exp(-0.5 * (np.log2(np.maximum(bpm, 1) / 120) / 0.9) ** 2)  # mild preference for ~120
    score = np.where(valid, ac * weight, 0)
    lag = int(np.argmax(score))
    # parabolic refinement
    if 1 <= lag < len(score) - 1:
        a, b, c = score[lag - 1], score[lag], score[lag + 1]
        lag = lag + 0.5 * (a - c) / (a - 2 * b + c + 1e-12)
    conf = float(score.max() / (ac[0] + 1e-9))
    return 60 * fps / lag, conf


def track_beats(env: np.ndarray, period: float, tightness: float = 100.0) -> np.ndarray:
    n = len(env)
    score = env.copy()
    back = np.full(n, -1)
    lo, hi = int(round(period / 2)), int(round(period * 2))
    for t in range(n):
        prev = np.arange(max(0, t - hi), max(0, t - lo + 1))
        if len(prev) == 0:
            continue
        cost = -tightness * np.log((t - prev) / period) ** 2
        cand = score[prev] + cost
        k = int(np.argmax(cand))
        if cand[k] > 0:
            score[t] += cand[k]
            back[t] = prev[k]
    # start from the best-scoring frame in the last period, then backtrack
    t = int(n - hi + np.argmax(score[n - hi :])) if n > hi else int(np.argmax(score))
    beats = [t]
    while back[beats[-1]] >= 0:
        beats.append(back[beats[-1]])
    return np.array(beats[::-1])


def loudnorm(src: str, start: float, seconds: float, out: Path) -> dict:
    base = ["ffmpeg", "-hide_banner", "-ss", f"{start}", "-t", f"{seconds}", "-i", src]
    first = subprocess.run(base + ["-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True)
    found = re.findall(r"\{[^{}]*\}", first.stderr)
    if not found:
        raise SystemExit("loudnorm analysis failed: " + first.stderr.strip()[-300:])
    m = json.loads(found[-1])
    af = (
        f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
        f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true"
    )
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(base + ["-af", af, "-ar", "44100", "-ac", "2", "-c:a", "pcm_s16le", "-y", str(out)], check=True, capture_output=True)
    return m


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("track")
    ap.add_argument("--start", type=float, default=0.0)
    ap.add_argument("--seconds", type=float, default=30.0, help="video length; the WAV gets +2 s of tail")
    ap.add_argument("--fps", type=int, default=30)
    args = ap.parse_args()

    x = decode(args.track, args.start, args.seconds + 4)
    if len(x) < SR * 4:
        raise SystemExit("track too short after --start")
    fps_env = SR / HOP
    env = onset_envelope(x)
    bpm, conf = tempo(env, fps_env)
    period = fps_env * 60 / bpm
    # Spectral flux peaks ~3/4 of a window after the frame start (Hann lead); measured bias with this
    # offset is ~0-5 ms on known 120/126 BPM grids, jitter 6-12 ms (under half a 30 fps frame).
    beats = (track_beats(env, period) * HOP + 0.75 * NFFT) / SR  # seconds from --start
    beats = beats[beats < args.seconds + 2]

    # downbeat phase: the beat position (mod 4) with the most low-end attack
    low = onset_envelope(x, lowpass=150)
    idx = np.clip((beats * fps_env).astype(int), 0, len(low) - 1)
    phase = int(np.argmax([low[idx[p::4]].mean() if len(idx[p::4]) else 0 for p in range(4)]))

    # align: beat 0 = first downbeat at/after --start
    t0 = beats[phase]
    beats = beats[phase:] - t0
    start = args.start + t0
    beats = beats[beats <= args.seconds]

    # drop = biggest rise in 2 s RMS energy (bass-weighted), snapped to a downbeat
    xs = decode(args.track, start, args.seconds)
    lowx = sosfilt(butter(4, 200, "low", fs=SR, output="sos"), xs)
    win = SR
    rms = np.sqrt(uniform_filter1d(lowx**2 + 0.3 * xs**2, win))[::HOP]
    tt = np.arange(len(rms)) * HOP / SR
    rise = np.array([rms[(tt >= t) & (tt < t + 2)].mean() - rms[(tt >= t - 2) & (tt < t)].mean() if t >= 2 else -1 for t in tt])
    downbeats = beats[::4]
    drop_t = downbeats[np.argmin(np.abs(downbeats - tt[int(np.argmax(rise))]))] if len(downbeats) else 0.0
    drop_beat = int(np.argmin(np.abs(beats - drop_t)))

    root = Path.cwd()
    m = loudnorm(args.track, start, args.seconds + 2, root / "public" / "audio" / "music.wav")
    frames = [int(round(b * args.fps)) for b in beats]
    (root / "src").mkdir(exist_ok=True)
    (root / "src" / "beats.ts").write_text(
        "// GENERATED by scripts/beats.py from " + Path(args.track).name + f" (start {start:.3f} s). Re-run instead of editing.\n"
        f"export const BEAT_FRAMES: number[] = [{', '.join(map(str, frames))}];\n"
    )

    plan_path = root / "timeline.json"
    need = None
    if plan_path.exists():
        plan = json.loads(plan_path.read_text())
        plan["bpm"] = round(float(bpm), 2)
        plan["music"] = "custom"
        text = json.dumps(plan, indent=2)
        plan_path.write_text(re.sub(r"\[\s*(\d+),\s*(\d+)\s*\]", r"[\1, \2]", text) + "\n")  # keep [start, end] on one line
        need = max(end for _, end in plan["scenes"].values())

    ibi = np.diff(beats)
    print(f"tempo {bpm:.1f} BPM (confidence {conf:.2f}; <0.3 = weak pulse, check by eye/ear), beat jitter {ibi.std() * 1000:.0f} ms")
    print(f"  if it feels twice too busy/slow, the true tempo may be {bpm / 2:.1f} or {bpm * 2:.1f} BPM: scene lengths are in beats, so")
    print(f"  at {bpm:.0f} BPM one beat = {60 / bpm:.2f} s; size scenes to 2.5-4.5 s, not to a fixed beat count")
    print(f"trimmed start {start:.3f} s (beat 0 = frame 0); {len(beats)} beats in {args.seconds:.0f} s")
    print(f"input loudness {m['input_i']} LUFS -> -14 LUFS; wrote public/audio/music.wav and src/beats.ts")
    print(f"downbeats (bar starts) at beats: {list(range(0, len(beats), 4))}")
    print(f"drop: beat {drop_beat} ({beats[drop_beat]:.2f} s, frame {frames[drop_beat]}) - put the hero moment / first big reveal here")
    print("suggested cuts (every 4 or 8 beats from a bar start): " + ", ".join(str(b) for b in range(0, len(beats), 4)))
    if need is not None and need > len(beats) - 1:
        print(f"WARNING: timeline.json needs beat {need} but only {len(beats)} beats were detected in --seconds {args.seconds:.0f}; "
              "raise --seconds or shorten the scenes (frames past the last detected beat fall back to a fixed grid)")
    if conf < 0.3 or ibi.std() > 0.04:
        print("WARNING: unsteady or weak beat (rubato, ambient, or heavy swing). Prefer cutting on phrase changes you choose by ear, or use the generated soundtrack.")


if __name__ == "__main__":
    main()
