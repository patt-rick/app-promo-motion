"""Composes a promo soundtrack + UI sound effects into public/audio as 16-bit stereo WAVs.

Fully synthesised (nothing to license), mastered to -14 LUFS / -1.3 dBTP, deterministic (fixed seed).
Reads the project's timeline.json (run from the project root) - the same file the video's timeline uses:

    {
      "bpm": 120,
      "style": "groove",            # groove | minimal | calm  (see below)
      "scenes": { "hook": [0, 5], "featureA": [5, 14], "featureB": [14, 21], "end": [21, 28] }
    }

cuts = scene starts; the groove DROPS at the 2nd scene's start; the final chord HITS at the last scene's
start (the end card). (hit - drop) must be a whole number of bars (multiple of 4 beats).
Optional overrides (omit or leave empty for the derived defaults): groove_start, groove_end,
crash_beats, fill_beats, open_hat_beats, swell_beats, kick_gap_beats.

Styles (same harmony/melody/mastering, different energy):
  groove  - Afro-house/amapiano-flavoured: four-on-the-floor kick, syncopated log-drum bass, shakers,
            rim/claps, fills into cuts. Upbeat consumer apps.
  minimal - clean modern tech: steady kick, plain bass on beats 1 and 3, light 8th shakers, rim backbeat,
            sparse stabs, one fill. SaaS, productivity, B2B.
  calm    - no groove drums: soft kick on bar downbeats only, sustained bass, warm pads, marimba.
            Wellness, premium, finance-trust, meditation.

Prints integrated LUFS, true peak, onset error per cut, per-scene loudness and spectrum checks.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.ndimage import minimum_filter1d, uniform_filter1d
from scipy.signal import butter, fftconvolve, resample_poly, sosfilt

PROJECT = Path.cwd()
_cfg_path = PROJECT / "timeline.json"
if not _cfg_path.exists():
    raise SystemExit("timeline.json not found - run from the promo project root (it defines bpm, style and scenes)")
CFG = json.loads(_cfg_path.read_text())
_SCENES = sorted((CFG.get("scenes") or {"intro": [0, 4]}).values())  # tolerate an empty/partial file for --sfx-only
STYLE = CFG.get("style") or "groove"

SR = 44100
BPM = CFG.get("bpm", 120)
BEAT = 60 / BPM
TOTAL_BEATS = max(end for _, end in _SCENES)
TAIL = 1.5
SONG_LEN = TOTAL_BEATS * BEAT + TAIL
N = int(round(SONG_LEN * SR))

OUT_DIR = PROJECT / "public" / "audio"
rng = np.random.default_rng(20261003)


# ----------------------------------------------------------------------------- helpers
def db(x: float) -> float:
    return 10 ** (x / 20)


def to_db(x: float) -> float:
    return 20 * math.log10(abs(x) + 1e-12)


def midi_hz(m: float) -> float:
    return 440 * 2 ** ((m - 69) / 12)


def tt(n: int) -> np.ndarray:
    return np.arange(n) / SR


def samples(sec: float) -> int:
    return int(round(sec * SR))


def beat_time(b: float) -> float:
    return b * BEAT


def pan_gains(pan: float) -> tuple[float, float]:
    th = (pan + 1) / 2 * math.pi / 2
    return math.cos(th), math.sin(th)


def humanize(t: float, vel: float, ms: float = 2.0, spread: float = 0.1) -> tuple[float, float]:
    return max(0.0, t + rng.uniform(-ms, ms) / 1000), vel * rng.uniform(1 - spread, 1 + spread)


def ramp_in(n: int, sec: float) -> np.ndarray:
    k = min(n, max(1, samples(sec)))
    env = np.ones(n)
    env[:k] = 0.5 - 0.5 * np.cos(np.pi * np.arange(k) / k)
    return env


def fade_out(x: np.ndarray, sec: float) -> np.ndarray:
    k = min(x.shape[-1], max(1, samples(sec)))
    x[..., -k:] *= 0.5 + 0.5 * np.cos(np.pi * np.arange(k) / k)
    return x


def ar_env(n: int, attack: float, r_tau: float, gate: float) -> np.ndarray:
    """Smooth attack, full level while gated, exponential release. gate=0 gives a percussive hit that rings out."""
    t = tt(n)
    attack = max(attack, 1 / SR)
    env = np.where(t < attack, 0.5 - 0.5 * np.cos(np.pi * np.minimum(t, attack) / attack), 1.0)
    return env * np.where(t > gate, np.exp(-(t - gate) / r_tau), 1.0)


def sos_filter(order: int, fc, kind: str) -> np.ndarray:
    return butter(order, fc, btype=kind, fs=SR, output="sos")


def noise(n: int) -> np.ndarray:
    return rng.standard_normal(n)


def peak_eq_sos(fc: float, gain_db: float, q: float) -> np.ndarray:
    a = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * fc / SR
    al, c = np.sin(w0) / (2 * q), np.cos(w0)
    return np.array([1 + al * a, -2 * c, 1 - al * a, 1 + al / a, -2 * c, 1 - al / a]) / (1 + al / a)


def high_shelf_sos(fc: float, gain_db: float, q: float) -> np.ndarray:
    a = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * fc / SR
    al, c = np.sin(w0) / (2 * q), np.cos(w0)
    b = [a * ((a + 1) + (a - 1) * c + 2 * np.sqrt(a) * al), -2 * a * ((a - 1) + (a + 1) * c), a * ((a + 1) + (a - 1) * c - 2 * np.sqrt(a) * al)]
    aa = [(a + 1) - (a - 1) * c + 2 * np.sqrt(a) * al, 2 * ((a - 1) - (a + 1) * c), (a + 1) - (a - 1) * c - 2 * np.sqrt(a) * al]
    return np.concatenate([np.array(b) / aa[0], np.array(aa) / aa[0]])


def saw_blep(freq: np.ndarray | float, n: int, phase0: float) -> np.ndarray:
    """Band-limited sawtooth (polyBLEP) for a per-sample frequency array."""
    dt = np.broadcast_to(np.asarray(freq, dtype=float) / SR, (n,))
    ph = (phase0 + np.cumsum(dt)) % 1.0
    out = 2 * ph - 1
    m = ph < dt
    t = ph[m] / dt[m]
    out[m] -= t + t - t * t - 1
    m = ph > 1 - dt
    t = (ph[m] - 1) / dt[m]
    out[m] -= t * t + t + t + 1
    return out


def lp_sweep(x: np.ndarray, fc: np.ndarray, q: float, block: int = 64) -> np.ndarray:
    """Resonant 2-pole low-pass whose cutoff follows `fc` (Hz, per sample); coefficients step per block."""
    n = len(x)
    nb = -(-n // block)
    f = np.clip(fc[::block][:nb], 20, 18000)
    w0 = 2 * np.pi * f / SR
    cosw, alpha = np.cos(w0), np.sin(w0) / (2 * q)
    a0 = 1 + alpha
    b0, b1, a1, a2 = (1 - cosw) / 2 / a0, (1 - cosw) / a0, -2 * cosw / a0, (1 - alpha) / a0
    y = np.empty(n)
    zi = np.zeros((1, 2))
    for i in range(nb):
        s, e = i * block, min(n, (i + 1) * block)
        y[s:e], zi = sosfilt([[b0[i], b1[i], b0[i], 1.0, a1[i], a2[i]]], x[s:e], zi=zi)
    return y


def make_ir(seconds: float, rt60: tuple[float, float, float], predelay: float) -> np.ndarray:
    """Synthesised stereo reverb impulse response: decorrelated noise with band-dependent RT60."""
    n = samples(seconds)
    t = tt(n)
    bands = (sos_filter(2, 300, "low"), sos_filter(2, [300, 3000], "band"), sos_filter(2, 3000, "high"))
    ir = np.zeros((2, n + samples(predelay)))
    for ch in range(2):
        src = noise(n)
        tail = sum(sosfilt(f, src) * np.exp(-6.91 * t / rt) for f, rt in zip(bands, rt60))
        tail *= ramp_in(n, 0.004)
        early = np.zeros(n)
        for k in range(8):
            early[samples(0.006 + 0.034 * (k + rng.random()) / 8)] += rng.choice([-1, 1]) * 0.5 * (1 - k / 10)
        early = sosfilt(sos_filter(1, 6000, "low"), early)
        ir[ch, samples(predelay):] = fade_out(tail + early, 0.05)
        ir[ch] /= np.sqrt(np.sum(ir[ch] ** 2))
    return ir


def reverb(x: np.ndarray, ir: np.ndarray) -> np.ndarray:
    wet = np.stack([fftconvolve(x[ch], ir[ch])[: x.shape[1]] for ch in range(2)])
    return sosfilt(sos_filter(2, 250, "high"), sosfilt(sos_filter(2, 11000, "low"), wet, axis=1), axis=1)


def pingpong(x: np.ndarray, delay: float, fb: float, lp_hz: float) -> np.ndarray:
    """Ping-pong delay (mono in, stereo out) with a dark, high-passed feedback loop."""
    d = samples(delay)
    n = len(x)
    lp, hp = sos_filter(1, lp_hz, "low"), sos_filter(1, 400, "high")
    loop = np.zeros(n)
    zl, zh = np.zeros((1, 2)), np.zeros((1, 2))
    for s in range(0, n, d):
        e = min(n, s + d)
        blk = x[s:e].copy()
        if s >= 2 * d:
            blk += fb * loop[s - 2 * d : s - 2 * d + (e - s)]
        f, zl = sosfilt(lp, blk, zi=zl)
        f, zh = sosfilt(hp, f, zi=zh)
        loop[s:e] = f
    out = np.zeros((2, n))
    out[0, d:] = loop[: n - d]
    out[1, 2 * d :] = loop[: n - 2 * d]
    return out


def duck_curve(times: list[float], depth: float, rel_tau: float, pre: float = 0.003, attack: float = 0.004) -> np.ndarray:
    g = np.ones(N)
    w = samples(0.6)
    t = tt(w)
    dip = 1 - depth * np.where(t < attack, t / attack, 1.0) * np.exp(-np.maximum(t - attack, 0) / rel_tau)
    for tk in times:
        i = samples(tk - pre)
        g[i : i + w] = np.minimum(g[i : i + w], dip[: len(g[i : i + w])])
    return g


class Bus:
    def __init__(self, n: int = N):
        self.x = np.zeros((2, n))

    def add(self, t0: float, sig: np.ndarray, gain: float = 1.0, pan: float = 0.0) -> None:
        sig = np.atleast_2d(sig)
        if sig.shape[0] == 1:
            gl, gr = pan_gains(pan)
            sig = np.vstack([sig[0] * gl, sig[0] * gr])
        i = samples(t0)
        n = min(sig.shape[1], self.x.shape[1] - i)
        if n > 0:
            self.x[:, i : i + n] += gain * sig[:, :n]


# ----------------------------------------------------------------------------- drums & percussion
def kick() -> np.ndarray:
    n = samples(0.45)
    t = tt(n)
    f = 55 + 115 * np.exp(-t / 0.022)  # pitch sweep settling on A1
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.1) * ramp_in(n, 0.0008)
    click = sosfilt(sos_filter(2, [500, 5000], "band"), noise(n)) * np.exp(-t / 0.0015) * 0.45
    x = np.tanh(1.6 * (body + click)) / math.tanh(1.6)
    return fade_out(sosfilt(sos_filter(2, 9000, "low"), x), 0.06)


def log_drum(freq: float, dur: float, vel: float) -> np.ndarray:
    n = samples(dur)
    t = tt(n)
    glide = 1 + 0.4 * np.exp(-t / 0.018)
    ph = 2 * np.pi * np.cumsum(freq * glide) / SR
    x = np.sin(ph) + 0.4 * np.sin(2 * ph) + 0.15 * np.sin(3 * ph)
    x = np.tanh(1.3 * x * ramp_in(n, 0.003) * np.exp(-t / 0.28) * vel) / math.tanh(1.3)
    body = sosfilt(sos_filter(2, 500, "low"), x)
    presence = sosfilt(sos_filter(2, [150, 900], "band"), np.tanh(3 * x)) * 0.3  # keeps the bass audible on phone speakers
    return fade_out(body + presence, 0.03)


def shaker(vel: float) -> np.ndarray:
    n = samples(0.14)
    t = tt(n)
    x = sosfilt(sos_filter(2, [5000, 11000], "band"), noise(n))
    return fade_out(x * (1 - np.exp(-t / 0.004)) * np.exp(-t / 0.06) * vel * 0.9, 0.01)


def rimshot(vel: float) -> np.ndarray:
    n = samples(0.12)
    t = tt(n)
    x = np.sin(2 * np.pi * 1600 * t) * np.exp(-t / 0.012) * 0.6
    x += np.sin(2 * np.pi * 420 * t) * np.exp(-t / 0.03) * 0.5
    x += sosfilt(sos_filter(2, [2000, 5000], "band"), noise(n)) * np.exp(-t / 0.003) * 0.4
    return fade_out(x * vel, 0.02)


def clap(vel: float) -> np.ndarray:
    n = samples(0.25)
    t = tt(n)
    env = np.exp(-t / 0.08) * 0.5
    for k in range(4):
        env += np.where(t >= k * 0.009, (1 - np.exp(-(t - k * 0.009) / 0.001)) * np.exp(-(t - k * 0.009) / 0.008), 0.0)
    x = sosfilt(sos_filter(2, [900, 3500], "band"), noise(n)) * env
    return fade_out(sosfilt(sos_filter(2, 5000, "low"), x) * vel * 0.8, 0.03)


def cymbal(vel: float, decay: float) -> np.ndarray:
    """Soft crash: band-limited noise with a slow attack and two-stage decay plus inharmonic partials, decorrelated L/R."""
    n = samples(decay * 2.5)
    t = tt(n)
    out = np.zeros((2, n))
    for ch in range(2):
        x = sosfilt(sos_filter(4, 16000, "low"), sosfilt(sos_filter(2, [3000, 9000], "band"), noise(n)))
        x *= (1 - np.exp(-t / 0.008)) * (0.6 * np.exp(-t / (decay / 4)) + 0.4 * np.exp(-t / decay))
        for f, a in ((3100, 1.0), (4700, 0.7), (6900, 0.5), (8300, 0.35)):
            x += 0.12 * a * np.sin(2 * np.pi * f * (1 + 0.004 * (rng.random() - 0.5)) * t) * np.exp(-t / (decay * 0.8)) * ramp_in(n, 0.01)
        out[ch] = x
    return fade_out(out * vel, 0.05)


def open_hat(vel: float) -> np.ndarray:
    n = samples(0.4)
    t = tt(n)
    x = sosfilt(sos_filter(4, 16000, "low"), sosfilt(sos_filter(2, [6000, 11000], "band"), noise(n)))
    return fade_out(x * (1 - np.exp(-t / 0.005)) * np.exp(-t / 0.09) * vel, 0.03)


def riser(length: float) -> np.ndarray:
    n = samples(length)
    p = tt(n) / length
    x = sosfilt(sos_filter(2, 400, "high"), noise(n))
    x = lp_sweep(x, 600 * (5000 / 600) ** p, 0.8)
    return fade_out(x * p**2.2, 0.004)


# ----------------------------------------------------------------------------- tonal instruments
def saw_stack(notes: list[int], n: int, detunes: tuple[float, ...], pans: tuple[float, ...], vib: float) -> np.ndarray:
    t = tt(n)
    out = np.zeros((2, n))
    for m in notes:
        for cents, pan in zip(detunes, pans):
            f = midi_hz(m + cents / 100) * (1 + vib * np.sin(2 * np.pi * 0.1 * t + rng.random() * 2 * math.pi))
            v = saw_blep(f, n, rng.random())
            gl, gr = pan_gains(pan)
            out[0] += v * gl
            out[1] += v * gr
    return out / (len(notes) * len(detunes))


def pad_note(notes: list[int], gate: float, attack: float, r_tau: float = 0.2, tail: float = 0.9) -> np.ndarray:
    n = samples(gate + tail)
    x = saw_stack(notes, n, (-7, 0, 7), (-0.7, 0, 0.7), 0.0015)
    return fade_out(x * ar_env(n, attack, r_tau, gate), 0.01)


def stab(notes: list[int], vel: float, decay: float = 0.11, length: float = 0.5) -> np.ndarray:
    n = samples(length)
    t = tt(n)
    x = saw_stack(notes, n, (-6, 6), (-0.5, 0.5), 0.0)
    x *= ramp_in(n, 0.003) * np.exp(-t / decay)
    fc = 3000 + 4000 * np.exp(-t / 0.07)
    x = np.stack([lp_sweep(x[ch], fc, 0.8, block=32) for ch in range(2)])
    return fade_out(x * vel, 0.02)


def marimba(f: float, dur: float, vel: float, sustain: float = 1.0) -> np.ndarray:
    n = samples(max(dur, 5 * 0.45 * sustain))  # long enough for the slowest partial to ring out
    t = tt(n)
    x = np.zeros(n)
    for ratio, amp, tau in ((1.0, 1.0, 0.45), (3.93, 0.3 * min(1.0, 880 / f), 0.14), (9.2, 0.05 * min(1.0, 880 / f), 0.06)):
        if f * ratio < 16000:
            x += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t / (tau * sustain))
    x += sosfilt(sos_filter(2, 2000, "low"), noise(n)) * np.exp(-t / 0.002) * 0.15
    return fade_out(x * ramp_in(n, 0.0015) * vel, 0.15)


# ----------------------------------------------------------------------------- arrangement
AM9, FMAJ9, CMAJ9, GADD9 = [57, 60, 64, 67, 71], [53, 57, 60, 64, 67], [55, 60, 64, 71, 74], [55, 59, 62, 67, 69]
PROGRESSION = [AM9, FMAJ9, CMAJ9, GADD9, FMAJ9, GADD9]  # two bars each over the 12 groove bars
ROOTS = [33, 29, 36, 31, 29, 31]
CUTS = [start for start, _ in _SCENES]
GROOVE_START = CFG.get("groove_start") or (CUTS[1] if len(CUTS) > 1 else 4)  # absolute beats: the drop
GROOVE_END = CFG.get("groove_end") or CUTS[-1]  # absolute beats: the end-card hit
BARS = max(0, (GROOVE_END - GROOVE_START) // 4)
TIMELINE_PROBLEMS = [
    msg
    for ok, msg in (
        (STYLE in ("groove", "minimal", "calm"), f'style must be groove | minimal | calm (got "{STYLE}")'),
        (len(CUTS) >= 3, "need at least a hook, one feature scene and an end card"),
        ((GROOVE_END - GROOVE_START) % 4 == 0, f"drop (beat {GROOVE_START}) to end card (beat {GROOVE_END}) must be whole bars - adjust scene lengths in timeline.json"),
        (BARS >= 2, "the groove needs at least 2 bars (8 beats) between the drop and the end card"),
        (GROOVE_START >= 2 and GROOVE_END <= TOTAL_BEATS, "need >= 2 intro beats for the pickup, and the end-card hit inside the video"),
    )
    if not ok
]
T_DROP, T_HIT = GROOVE_START * BEAT, GROOVE_END * BEAT
_inner = [c for c in CUTS if GROOVE_START < c < GROOVE_END]
_mid = min(_inner, key=lambda c: abs(c - (GROOVE_START + GROOVE_END) / 2)) if _inner else GROOVE_START
CRASHES = CFG.get("crash_beats") or sorted({GROOVE_START, _mid, GROOVE_END})
FILLS = CFG.get("fill_beats") or _inner[1::2]
OPEN_HATS = CFG.get("open_hat_beats") or [c for c in _inner if c not in FILLS]
SWELLS = CFG.get("swell_beats") or _inner[::3]
KICK_GAPS = CFG.get("kick_gap_beats") or []
if STYLE == "minimal":
    FILLS, OPEN_HATS = FILLS[-1:], []
elif STYLE == "calm":
    FILLS, OPEN_HATS, CRASHES = [], [], [GROOVE_END]
CHORD_SLOTS = (BARS + 1) // 2  # two bars per chord; an odd final bar still gets a chord
E5, G5, A5, C6, D5, C5, A4, E6 = 76, 79, 81, 84, 74, 72, 69, 88
MELODY = {  # groove bar -> (beat offset, midi, beats)
    1: [(2.5, E5, 0.5), (3.0, G5, 1.0)],
    3: [(2.5, G5, 0.5), (3.0, E5, 1.0)],
    5: [(0.5, E5, 0.5), (1.0, G5, 0.5), (1.5, A5, 1.5), (3.5, G5, 0.5)],
    6: [(0.0, E5, 0.5), (1.0, D5, 1.0), (2.5, C5, 0.5), (3.0, E5, 1.0)],
    7: [(0.5, D5, 0.5), (1.0, C5, 0.5), (1.5, A4, 2.0)],
    8: [(0.5, E5, 0.5), (1.0, G5, 0.5), (1.5, A5, 1.5), (3.5, C6, 0.5)],
    9: [(0.0, A5, 0.5), (0.5, G5, 0.5), (1.0, E5, 1.0), (2.5, D5, 0.5), (3.0, E5, 1.0)],
    10: [(0.5, G5, 0.5), (1.0, A5, 0.5), (1.5, C6, 1.5), (3.0, A5, 1.0)],
    11: [(2.0, E5, 0.5), (2.5, G5, 0.5), (3.0, A5, 0.5), (3.5, C6, 0.5)],
}
# The rising run (bar 11) always leads into the end hit; other motifs only play if the groove is long enough.
MELODY = {**{b: n for b, n in MELODY.items() if b < 11 and b < BARS - 1}, max(BARS - 1, 0): MELODY[11]}


def pad_cutoff() -> np.ndarray:
    t = tt(N)
    fc = np.where(t < T_DROP, 350 * (1100 / 350) ** (t / T_DROP), 1500.0)  # opens through the intro, then steps up at the drop
    for slot in range(CHORD_SLOTS):
        t0 = beat_time(GROOVE_START + slot * 8)
        m = (t >= t0) & (t < min(t0 + 8 * BEAT, T_HIT))
        fc[m] = (2600 if slot < CHORD_SLOTS * 2 // 3 else 3600) * 0.85 * (1.15 / 0.85) ** ((t[m] - t0) / (8 * BEAT))
    fc = np.where(t >= T_HIT, 900 + 2600 * np.exp(-(t - T_HIT) / 3.0), fc)
    for cut in (beat_time(b) for b in SWELLS):  # short filter swell leading into the cut
        m = (t >= cut - 0.5) & (t < cut)
        fc[m] *= 1 + 0.8 * ((t[m] - (cut - 0.5)) / 0.5) ** 2
    return fc


def compose_music() -> np.ndarray:
    kick_bus, perc, bass, pad, stabs, lead, lead_dly = (Bus() for _ in range(7))
    kick_beats = [b for b in range(GROOVE_START, GROOVE_END) if b not in KICK_GAPS]
    if STYLE == "calm":
        kick_beats = [b for b in kick_beats if (b - GROOVE_START) % 4 == 0]
    groove_kicks = [beat_time(b) for b in kick_beats]
    kick_sample = kick()
    kick_gain = {"groove": 0.9, "minimal": 0.8, "calm": 0.55}[STYLE]
    for t0 in groove_kicks + [beat_time(GROOVE_END)]:
        kick_bus.add(t0, kick_sample, kick_gain)

    # log-drum bass: syncopated 16th pattern per bar, root + fifth
    pattern = {
        "groove": [(0, 0), (3, 0), (6, 7), (8, 0), (11, 0), (14, 7)],
        "minimal": [(0, 0), (8, 0)],
        "calm": [(0, 0)],
    }[STYLE]
    max_len = {"groove": 0.6, "minimal": 1.0, "calm": 1.9}[STYLE]
    for bar in range(BARS):
        root = ROOTS[(bar // 2) % len(ROOTS)]
        for k, (slot, off) in enumerate(pattern):
            nxt = pattern[k + 1][0] if k + 1 < len(pattern) else 16
            t0 = beat_time(GROOVE_START + bar * 4 + slot / 4)
            dur = min((nxt - slot) / 4 * BEAT + 0.05, max_len, beat_time(GROOVE_END) - t0)  # nothing rings into the final hit
            bass.add(t0, log_drum(midi_hz(root + off), dur, 0.9 if slot in (0, 8) else 0.75), 0.55)
    bass.add(beat_time(GROOVE_END), log_drum(midi_hz(33), 1.6, 1.0), 0.55)

    # shakers: quiet 8ths in the intro (from beat 1, so 2.5 s reads as a downbeat), accented 16ths in the groove
    accents = [0.55, 0.3, 0.8, 0.35]
    for b in range(1, GROOVE_END if STYLE != "calm" else 1):
        for s in range(4):
            if (b < GROOVE_START or STYLE == "minimal") and s % 2:
                continue
            t0, vel = humanize(beat_time(b + s / 4), accents[s] * (0.7 if b < GROOVE_START else 1.0))
            perc.add(t0, shaker(vel), 0.13, pan=0.3)

    # rimshot backbeat, ghosts, claps from bar 4, 16th fills into cuts, final roll
    if STYLE != "calm":
        for b in (2, 4):
            if b < GROOVE_START:
                perc.add(beat_time(b), rimshot(0.8), 0.16, pan=-0.25)
    for bar in range(BARS if STYLE != "calm" else 0):
        base = GROOVE_START + bar * 4
        for off in (1, 3):
            t0, vel = humanize(beat_time(base + off), 0.85)
            perc.add(t0, rimshot(vel), 0.18, pan=-0.25)
            if bar >= 4 and STYLE == "groove":
                perc.add(t0, clap(vel), 0.15, pan=0.15)
        if bar % 2 == 1 and STYLE == "groove":
            t0, vel = humanize(beat_time(base + 3.75), 0.4)
            perc.add(t0, rimshot(vel), 0.16, pan=-0.25)
    for cut in FILLS:
        for s in range(4):
            t0, vel = humanize(beat_time(cut - 1 + s / 4), 0.35 + 0.15 * s)
            perc.add(t0, rimshot(vel), 0.16, pan=-0.25 + 0.15 * s)
    if STYLE == "groove":
        for i, b in enumerate(np.arange(GROOVE_END - 4, GROOVE_END - 2, 0.5)):
            t0, vel = humanize(beat_time(b), 0.4 + 0.08 * i)
            perc.add(t0, rimshot(vel), 0.16, pan=-0.25)
    if STYLE != "calm":
        for i, b in enumerate(np.arange(GROOVE_END - 2, GROOVE_END, 0.25)):
            t0, vel = humanize(beat_time(b), 0.55 + 0.06 * i)
            perc.add(t0, rimshot(vel), 0.16, pan=-0.25 + 0.5 * (i / 7))
            if STYLE == "groove":
                perc.add(t0, clap(vel * 0.6), 0.12, pan=0.15)

    for b in CRASHES:
        vel = (1.0 if b == GROOVE_END else 0.8) * (0.5 if STYLE == "calm" else 1.0)
        perc.add(beat_time(b), cymbal(vel, 1.4 if b == GROOVE_END else 0.9), 0.08)
    for b in OPEN_HATS:
        perc.add(beat_time(b), open_hat(0.8), 0.09, pan=0.2)
    perc.add(beat_time(GROOVE_START - 2), riser(2 * BEAT), 0.07, pan=-0.1)
    perc.add(beat_time(GROOVE_END - 4), riser(4 * BEAT), 0.08, pan=-0.1)

    # chords: intro pad, two bars per chord in the groove, final Am9 on the end card
    pad.add(0.0, pad_note(AM9, GROOVE_START * BEAT, 0.35), 0.34)
    pad_gain = {"groove": 0.2, "minimal": 0.24, "calm": 0.32}[STYLE]
    for slot in range(CHORD_SLOTS):
        chord = PROGRESSION[slot % len(PROGRESSION)]
        r_tau = 0.06 if slot == CHORD_SLOTS - 1 else 0.2
        start = GROOVE_START + slot * 8
        gate = min(8, GROOVE_END - start) * BEAT
        pad.add(beat_time(start), pad_note(chord, gate, 0.15 if STYLE != "calm" else 0.6, r_tau), pad_gain)
    pad.add(beat_time(GROOVE_END), pad_note(AM9, 0.0, 0.012, r_tau=1.8, tail=SONG_LEN - beat_time(GROOVE_END)), 0.5)  # gate 0: hit, then ring out to the end of file
    for bar in range(BARS):
        chord = PROGRESSION[(bar // 2) % len(PROGRESSION)][1:]
        hits = {"groove": ((2, 0.9), (6, 0.7), (10, 0.85), (14, 0.6)), "minimal": ((2, 0.8), (10, 0.7)), "calm": ()}[STYLE]
        for slot, vel in hits:
            t0, vel = humanize(beat_time(GROOVE_START + bar * 4 + slot / 4), vel)
            stabs.add(t0, stab(chord, vel), 0.38)
    stabs.add(beat_time(GROOVE_END), stab(AM9[1:], 1.0, decay=0.5, length=1.8), 0.38)

    # lead: pickup into the drop, answers in bars 1 & 3, motifs from the transfer scene, resolution on the end card
    phrases = [(GROOVE_START - 1.0, E5, 0.5), (GROOVE_START - 0.5, G5, 0.5), (float(GROOVE_START), A5, 1.5)]
    for bar, notes in MELODY.items():
        phrases += [(GROOVE_START + bar * 4 + off, m, ln) for off, m, ln in notes]
    phrases += [(float(GROOVE_END), A5, 2.0), (GROOVE_END + 0.5, E6, 2.0)]
    for b, m, ln in phrases:
        final = b >= GROOVE_END
        note = marimba(midi_hz(m), ln * BEAT, 0.5 if m == E6 else 0.9, sustain=2.5 if final else 1.0)
        lead.add(beat_time(b), note, 0.32)
        if b < GROOVE_END - 2:  # the final run and end-card notes stay dry so the last chord is clean
            lead_dly.add(beat_time(b), note, 0.32)

    hp = sos_filter(2, 150, "high")
    fc = pad_cutoff()
    pad.x = np.stack([lp_sweep(sosfilt(hp, pad.x[ch]), fc, 1.0) for ch in range(2)])
    stabs.x = sosfilt(hp, stabs.x, axis=1)
    lead.x = sosfilt(sos_filter(2, 12000, "low"), sosfilt(sos_filter(2, 300, "high"), lead.x, axis=1), axis=1)
    perc.x = sosfilt(sos_filter(2, 200, "high"), perc.x, axis=1)

    duck_depth = {"groove": 1.0, "minimal": 0.8, "calm": 0.3}[STYLE]
    duck_pad = duck_curve(groove_kicks, 0.3 * duck_depth, 0.12)
    duck_bass = duck_curve(groove_kicks, 0.5 * duck_depth, 0.08)
    chords = (pad.x + stabs.x) * duck_pad
    bass.x *= duck_bass
    echo = pingpong(lead_dly.x.mean(axis=0), 1.5 * BEAT / 2, 0.35, 4000)

    send = 0.18 * pad.x * duck_pad + 0.3 * stabs.x * duck_pad + 0.45 * lead.x + 0.4 * perc.x
    wet = reverb(send, make_ir(1.6, (1.5, 1.3, 0.7), 0.012))
    end_send = send.copy()
    end_send[:, : samples(T_HIT)] = 0.0
    wet_end = reverb(end_send, make_ir(2.8, (2.6, 2.2, 1.1), 0.015))

    mix = kick_bus.x + perc.x + bass.x + chords + lead.x + 0.4 * echo + 0.35 * wet + 0.5 * wet_end
    mix = sosfilt(sos_filter(2, 30, "high"), mix, axis=1)
    return fade_out(mix, 0.4)


# ----------------------------------------------------------------------------- mastering
def bus_compressor(x: np.ndarray, thr_db: float, ratio: float, knee: float, att: float, rel: float, block: int = 32) -> tuple[np.ndarray, float]:
    n = x.shape[1]
    nb = -(-n // block)
    det = sosfilt(sos_filter(2, 120, "high"), x, axis=1)  # the kick must not drive the detector
    rms = np.sqrt(np.maximum(uniform_filter1d(np.mean(det**2, axis=0), samples(0.01), mode="nearest"), 0))
    centers = np.minimum((np.arange(nb) * block + block // 2), n - 1)
    over = 20 * np.log10(rms[centers] + 1e-9) - thr_db
    slope = 1 - 1 / ratio
    gr = np.where(over <= -knee / 2, 0.0, np.where(over >= knee / 2, over * slope, slope * (over + knee / 2) ** 2 / (2 * knee)))
    ca, cr = 1 - math.exp(-block / (att * SR)), 1 - math.exp(-block / (rel * SR))
    state, out = 0.0, np.empty(nb)
    for i in range(nb):
        state += (gr[i] - state) * (ca if gr[i] > state else cr)
        out[i] = state
    gain = 10 ** (-np.interp(np.arange(n), centers, out) / 20)
    return x * gain, out.max()


def k_weighting() -> np.ndarray:
    """ITU-R BS.1770 K-weighting (high shelf + RLB high-pass) as second-order sections."""

    def highpass(fc, q):
        w0 = 2 * np.pi * fc / SR
        al, c = np.sin(w0) / (2 * q), np.cos(w0)
        return np.concatenate([np.array([(1 + c) / 2, -(1 + c), (1 + c) / 2]) / (1 + al), np.array([1 + al, -2 * c, 1 - al]) / (1 + al)])

    return np.array([high_shelf_sos(1500.0, 4.0, 1 / math.sqrt(2)), highpass(38.0, 0.5)])


def block_loudness(x: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Mean-square per 400 ms block (100 ms hop) of the K-weighted signal, summed over channels, and block start times."""
    y = sosfilt(k_weighting(), x, axis=1)
    bl, hop = samples(0.4), samples(0.1)
    nblk = (x.shape[1] - bl) // hop + 1
    cs = np.concatenate([np.zeros((2, 1)), np.cumsum(y**2, axis=1)], axis=1)
    idx = np.arange(nblk) * hop
    return ((cs[:, idx + bl] - cs[:, idx]) / bl).sum(axis=0), idx / SR


def integrated_lufs(x: np.ndarray) -> float:
    ms, _ = block_loudness(x)
    lk = -0.691 + 10 * np.log10(ms + 1e-12)
    gate = lk > -70
    if not gate.any():
        return -math.inf
    gate &= lk > -0.691 + 10 * np.log10(ms[gate].mean()) - 10
    return -0.691 + 10 * np.log10(ms[gate].mean())


def true_peak_env(x: np.ndarray) -> np.ndarray:
    return np.abs(resample_poly(x, 4, 1, axis=1)).reshape(2, x.shape[1], 4).max(axis=(0, 2))


def limiter(x: np.ndarray, ceiling_db: float, lookahead: float = 0.005, release: float = 0.08) -> tuple[np.ndarray, float]:
    n = x.shape[1]
    g_req = np.minimum(1.0, db(ceiling_db) / np.maximum(true_peak_env(x), 1e-9))
    win = samples(lookahead) | 1
    g_sm = uniform_filter1d(minimum_filter1d(g_req, win, mode="nearest"), win, mode="nearest")
    block = 8
    nb = -(-n // block)
    bm = np.ones(nb * block)
    bm[:n] = g_sm
    bm = bm.reshape(nb, block).min(axis=1)
    k = 1 - math.exp(-block / (release * SR))
    state, out = 1.0, np.empty(nb)
    for i in range(nb):
        state = bm[i] if bm[i] < state else state + (1 - state) * k
        out[i] = state
    g = np.minimum(np.interp(np.arange(n), (np.arange(nb) + 0.5) * block, out), g_sm)
    return x * g, -to_db(g.min())


def master(mix: np.ndarray, target_lufs: float = -14.0, ceiling_db: float = -1.3) -> np.ndarray:
    x = sosfilt([peak_eq_sos(1600.0, 3.0, 0.8), high_shelf_sos(6000.0, 4.0, 0.6)], mix, axis=1)  # the synth sources are dark; body + air
    x *= db(-16 - integrated_lufs(x))
    x, comp_gr = bus_compressor(x, thr_db=-16, ratio=2.0, knee=6, att=0.03, rel=0.3)
    print(f"  bus compressor max gain reduction: {comp_gr:.2f} dB")
    gain = db(target_lufs - integrated_lufs(x))
    for _ in range(4):
        y, lim_gr = limiter(x * gain, ceiling_db)
        err = target_lufs - integrated_lufs(y)
        if abs(err) < 0.05:
            break
        gain *= db(err)
    print(f"  limiter max gain reduction: {lim_gr:.2f} dB")
    return y


def write_wav(name: str, x: np.ndarray) -> None:
    dither = (rng.random(x.shape) + rng.random(x.shape) - 1) / 32768
    pcm = np.clip(np.round((x + dither) * 32767), -32768, 32767).astype(np.int16)
    wavfile.write(OUT_DIR / name, SR, pcm.T.copy())
    print(f"wrote {name}: {x.shape[1] / SR:.3f} s, peak {to_db(np.abs(x).max()):.2f} dBFS, last sample {to_db(np.abs(x[:, -1]).max()):.0f} dBFS")


# ----------------------------------------------------------------------------- SFX
def bell(f: float, n: int, partials: tuple[tuple[float, float, float], ...]) -> np.ndarray:
    t = tt(n)
    x = np.zeros(n)
    for ratio, amp, tau in partials:
        if f * ratio < 16000:
            x += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t / tau)
    return fade_out(x * ramp_in(n, 0.002), 0.03)


def normalize_peak(x: np.ndarray, peak_db: float) -> np.ndarray:
    return x * (db(peak_db) / (np.abs(x).max() + 1e-12))


def sfx_tap() -> np.ndarray:
    n = samples(0.09)
    t = tt(n)
    f = 1000 + 400 * np.exp(-t / 0.004)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.015)
    x += 0.4 * np.sin(2 * np.pi * 2300 * t) * np.exp(-t / 0.006)
    x += 0.3 * sosfilt(sos_filter(2, 4000, "low"), noise(n)) * np.exp(-t / 0.0015)
    x = fade_out(x * ramp_in(n, 0.0005), 0.01)
    return np.vstack([x, x])


def sfx_ding(ir: np.ndarray) -> np.ndarray:
    partials = ((1.0, 1.0, 0.45), (2.0, 0.35, 0.3), (3.0, 0.12, 0.15), (4.2, 0.05, 0.08))
    bus = Bus(samples(1.1))
    bus.add(0.0, bell(midi_hz(A5), samples(1.05), partials), 1.0, pan=-0.15)
    bus.add(0.13, bell(midi_hz(E6), samples(0.95), partials), 0.9, pan=0.15)
    return fade_out(bus.x + 0.15 * reverb(bus.x, ir), 0.08)


def sfx_whoosh() -> np.ndarray:
    n = samples(0.42)
    p = tt(n) / 0.42
    x = sosfilt(sos_filter(2, 300, "high"), noise(n))
    x = lp_sweep(x, 600 * (2500 / 600) ** np.sin(np.pi * p), 1.0)
    x = sosfilt(sos_filter(4, 7000, "low"), x) * np.sin(np.pi * p**0.7) ** 1.5
    th = (0.3 + 0.4 * p) * np.pi / 2
    return fade_out(np.vstack([x * np.cos(th), x * np.sin(th)]), 0.02)


def sfx_coin(ir: np.ndarray) -> np.ndarray:
    partials = ((1.0, 1.0, 0.3), (2.0, 0.3, 0.12), (3.0, 0.1, 0.08), (4.95, 0.04, 0.05))
    bus = Bus(samples(0.5))
    bus.add(0.0, bell(midi_hz(83), samples(0.3), partials) * np.exp(-tt(samples(0.3)) / 0.08), 0.8)
    bus.add(0.06, bell(midi_hz(88), samples(0.44), partials), 1.0)
    n = samples(0.1)
    bus.add(0.06, sosfilt(sos_filter(2, [6000, 10000], "band"), noise(n)) * np.exp(-tt(n) / 0.03), 0.08)
    x = sosfilt(sos_filter(2, 9000, "low"), bus.x, axis=1)
    return fade_out(x + 0.12 * reverb(x, ir), 0.05)


# ----------------------------------------------------------------------------- verification
def report(x: np.ndarray) -> None:
    mono = x.mean(axis=0)
    rms = np.sqrt(np.maximum(uniform_filter1d(mono**2, samples(0.001), mode="nearest"), 0))
    print("  onsets (first 1 ms RMS crossing of half the local peak, within +-100 ms of each cut):")
    for b in CUTS:
        target = beat_time(b)
        a = max(0, samples(target - 0.1))
        seg = rms[a : samples(target + 0.1)]
        onset = (a + np.argmax(seg > 0.5 * seg.max())) / SR
        flag = "" if abs(onset - target) < 0.006 else "   <-- no sharp transient here (soft cut)"
        print(f"    cut {target:5.1f} s: {onset:.4f} s ({(onset - target) * 1000:+.1f} ms){flag}")
    low = np.abs(sosfilt(sos_filter(4, 150, "low"), mono))
    print(f"  max sub-150 Hz level before the drop: {to_db(low[: samples(T_DROP - 0.01)].max()):.1f} dBFS")
    rms100 = np.sqrt(np.maximum(uniform_filter1d(mono**2, samples(0.1), mode="nearest"), 0))
    tail = rms100[samples(T_HIT) :: samples(0.5)]
    print("  100 ms RMS from the final hit (dBFS, every 0.5 s to the end of file):", " ".join(f"{to_db(v):.0f}" for v in tail))
    ms, starts = block_loudness(x)
    print("  K-weighted loudness per scene (LUFS, ungated):")
    for b0, b1 in zip(CUTS, CUTS[1:] + [TOTAL_BEATS]):
        m = (starts >= beat_time(b0)) & (starts + 0.4 <= beat_time(b1))
        print(f"    {beat_time(b0):5.1f}-{beat_time(b1):5.1f} s: {-0.691 + 10 * math.log10(ms[m].mean() + 1e-12):6.1f}")
    mono_lufs = integrated_lufs(np.vstack([mono, mono]))
    print(f"  mono-sum loudness {mono_lufs:.2f} LUFS ({mono_lufs - integrated_lufs(x):+.2f} LU vs stereo), DC offset {to_db(np.abs(x.mean(axis=1)).max()):.0f} dBFS")
    seg = mono[samples(T_DROP) : samples(T_HIT)]
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2
    freqs = np.fft.rfftfreq(len(seg), 1 / SR)

    def band(lo, hi):
        return spec[(freqs >= lo) & (freqs < hi)].sum()

    ref = band(200, 2000)

    def band_db(lo, hi):  # energy relative to 200 Hz-2 kHz, and the same number relative to a pink-noise slope
        rel = 10 * math.log10(band(lo, hi) / ref)
        pink = 10 * math.log10(math.log2(hi / lo) / math.log2(10))
        return f"{lo / 1000:g}-{hi / 1000:g}k {rel:+.1f} dB ({rel - pink:+.1f} vs pink)"

    print("  groove spectrum vs 200 Hz-2 kHz:", ", ".join(band_db(lo, hi) for lo, hi in ((30, 200), (2000, 6000), (6000, 12000), (12000, 20000))))
    centers = 125 * 2 ** (np.arange(22) / 3)
    third = np.array([10 * math.log10(band(c / 2 ** (1 / 6), c * 2 ** (1 / 6)) + 1e-18) for c in centers])
    third -= third.max()
    print("  groove 1/3-octave bands 125 Hz-16 kHz (dB re loudest band):", " ".join(f"{v:.0f}" for v in third))
    swings = np.abs(np.diff(third[centers >= 500]))
    print(f"  largest adjacent-band swing above 500 Hz: {swings.max():.1f} dB at {centers[centers >= 500][swings.argmax()]:.0f}-{centers[centers >= 500][swings.argmax() + 1]:.0f} Hz")
    d = np.abs(np.diff(mono))
    top = np.argsort(d)[-3:][::-1]
    print("  largest sample-to-sample jumps:", ", ".join(f"{to_db(d[i]):.0f} dB at {i / SR:.3f} s" for i in top))


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if "--sfx-only" in sys.argv:  # custom music: keep the user's track, just make the UI sounds
        write_sfx()
        return
    if TIMELINE_PROBLEMS:
        raise SystemExit("timeline.json can't drive the generated track:\n  - " + "\n  - ".join(TIMELINE_PROBLEMS))
    print("composing music...")
    mix = compose_music()
    print("mastering...")
    music = master(mix)
    print(f"  integrated loudness {integrated_lufs(music):.2f} LUFS, true peak {to_db(true_peak_env(music).max()):.2f} dBTP")
    report(music)
    write_wav("music.wav", music)

    write_sfx()


def write_sfx() -> None:
    sfx_ir = make_ir(0.5, (0.45, 0.4, 0.25), 0.005)
    for name, x in (("tap.wav", sfx_tap()), ("ding.wav", sfx_ding(sfx_ir)), ("whoosh.wav", sfx_whoosh()), ("coin.wav", sfx_coin(sfx_ir))):
        write_wav(name, normalize_peak(x, -6.0))


if __name__ == "__main__":
    main()
