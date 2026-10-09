#!/usr/bin/env python3
"""Measure the motion of a rendered promo frame by frame (you can't watch it, so measure it).

    python motion_check.py out/promo.mp4 [--timeline timeline.json] [--expect 412,530] [--png out/qc/energy.png]

Downscales every frame to grey and computes the mean absolute difference to the previous frame
(the "energy"). Reports:
  - POPs:     a single frame that changes > 3x its neighbours and isn't a cut (a jump, a layer
              appearing a frame early, a spring discontinuity).
  - FLASHes:  frame n differs from both neighbours while n-1 and n+1 match (a one-frame glitch,
              a blank premount frame, a text double-print).
  - FROZEN:   stretches fully still for > 3 s (dead air), and whether the final frame is held.
  - CUTS:     where the timeline says each cut is; a cut with almost no change is a seam that didn't land.
  - REST:     share of frames below a relative energy threshold. This is NOT the hold share in motion.md;
              approved promos measured 68-75% on this meter; under ~35% is restless, over ~80% a slideshow.
  - END:      whether the final frame is held still (expected: the end card's CTA holds).
--expect lists frames with designed one-frame changes (Screen clip jump cuts, flips) so they aren't flagged.
With --png it writes an energy curve with the cuts drawn as lines (read it like a waveform).
Needs ffmpeg and numpy. Cuts come from timeline.json (and src/beats.ts if it has detected beats).
"""
import argparse, json, os, re, subprocess, sys

import numpy as np

W = 96  # analysis width; plenty for motion, fast to decode


def probe(video):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                          "stream=width,height,r_frame_rate", "-of", "json", video],
                         capture_output=True, text=True, check=True).stdout
    s = json.loads(out)["streams"][0]
    num, den = s["r_frame_rate"].split("/")
    return int(s["width"]), int(s["height"]), float(num) / float(den)


def frames(video, w, h):
    hh = int(round(h * W / w / 2)) * 2
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", video, "-vf", f"scale={W}:{hh},format=gray",
                          "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, hh, W).astype(np.float32)


def cut_frames(timeline, fps):
    if not timeline or not os.path.exists(timeline):
        return []
    plan = json.load(open(timeline, encoding="utf-8"))
    beats = []
    bt = os.path.join(os.path.dirname(os.path.abspath(timeline)), "src", "beats.ts")
    if os.path.exists(bt):
        m = re.search(r"BEAT_FRAMES[^=]*=\s*\[([^\]]*)\]", open(bt, encoding="utf-8").read())
        if m and m.group(1).strip():
            beats = [int(float(x)) for x in m.group(1).split(",") if x.strip()]
    frame_of = lambda b: beats[b] if b < len(beats) else round(b * 60 * fps / plan["bpm"])
    starts = sorted(a for a, _ in plan["scenes"].values())
    return [frame_of(a) for a in starts if a > 0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--timeline", help="default: timeline.json next to the video's out/ folder, or in the cwd")
    ap.add_argument("--expect", default="", help="comma-separated frames with designed jumps (clip jump cuts)")
    ap.add_argument("--png")
    a = ap.parse_args()

    if not a.timeline:
        guess = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(a.video))), "timeline.json")
        a.timeline = guess if os.path.exists(guess) else "timeline.json"
    if not os.path.exists(a.timeline):
        print(f"WARNING: no {a.timeline}: cuts unknown, so every seam may be reported as a POP. Pass --timeline.")
    expect = [int(x) for x in a.expect.split(",") if x.strip()]
    w, h, fps = probe(a.video)
    f = frames(a.video, w, h)
    n = len(f)
    d1 = np.zeros(n)
    d1[1:] = np.abs(f[1:] - f[:-1]).mean(axis=(1, 2))  # change from n-1 to n
    d2 = np.full(n, np.inf)
    d2[1:-1] = np.abs(f[2:] - f[:-2]).mean(axis=(1, 2))  # n-1 vs n+1
    cuts = cut_frames(a.timeline, fps)
    # a seam's exit and entry are fast by design: treat 10 f before to 15 f after each cut as the seam zone
    near_cut = lambda i: any(c - 10 <= i <= c + 15 for c in cuts) or any(abs(i - e) <= 1 for e in expect)
    t = lambda i: f"{i / fps:6.2f}s (f{i})"

    print(f"{a.video}: {n} frames @ {fps:g} fps, {n / fps:.2f} s; cuts from timeline: {cuts or 'none'}")
    problems = 0

    # pops: one frame of change far above its neighbourhood, not at a cut
    for i in range(2, n - 2):
        nb = np.concatenate([d1[max(1, i - 4):i], d1[i + 1:i + 5]])
        isolated = d1[i - 1] < d1[i] / 3 and d1[i + 1] < d1[i] / 3  # seams and fast moves are runs, a pop is a spike
        if d1[i] > 5 and d1[i] > 3 * max(np.median(nb), 0.5) and isolated and not near_cut(i):
            what = "a jump, or a hard cut missing from timeline.json" if not cuts else "a jump: a layer appearing a frame early, a spring discontinuity"
            print(f"POP    {t(i)}  change {d1[i]:.1f} vs neighbours ~{np.median(nb):.1f} ({what})")
            problems += 1
    # flashes: n differs from both sides while the sides match
    for i in range(1, n - 1):
        if d1[i] > 3 and d1[i + 1] > 3 and d2[i] < 0.3 * min(d1[i], d1[i + 1]):
            print(f"FLASH  {t(i)}  one-frame glitch (sides match: {d2[i]:.1f} vs {min(d1[i], d1[i + 1]):.1f})")
            problems += 1
    # frozen stretches
    still = d1 < 0.15
    i = 1
    while i < n:
        if still[i]:
            j = i
            while j < n and still[j]:
                j += 1
            if (j - i) / fps > 3 and j < n:
                print(f"FROZEN {t(i)} -> {t(j)}  {(j - i) / fps:.1f} s fully still (dead air unless it's a reading hold)")
                problems += 1
            i = j
        else:
            i += 1
    # cuts that barely change the picture
    for c in cuts:
        if 0 < c < n:
            peak = d1[max(1, c - 1):c + 2].max()
            if peak < 2:
                print(f"CUT    {t(c)}  only {peak:.1f} change at the cut: the seam didn't land (or the timeline is off)")
    # rest ratio: Tblend-style energy threshold
    p10, p90 = np.percentile(d1[1:], [10, 90])
    thr = p10 + 0.35 * (p90 - p10)
    rest = float((d1[1:] < thr).mean())
    verdict = "restless" if rest < 0.35 else "slideshow-ish: check the holds are reading holds" if rest > 0.8 else "ok"
    print(f"REST   {rest:.0%} of frames near rest (threshold {thr:.2f}) -> {verdict}")
    print(f"END    last-frame change {d1[-1]:.2f} ({'held: ok' if d1[-1] < 0.15 else 'STILL MOVING on the final frame: the CTA should hold'})")
    print(f"{problems} problem(s). Check each flagged frame: ffmpeg -ss <sec> -i {a.video} -frames:v 3 f%d.png")

    if a.png:
        sec = max(1, int(fps))
        H, Wd = 200, max(600, n)
        img = np.full((H, Wd, 3), 255, np.uint8)
        top = max(d1.max(), 1)
        xs = (np.arange(n) * (Wd - 1) / max(n - 1, 1)).astype(int)
        for c in cuts:
            if c < n:
                img[:, xs[c]] = (90, 140, 255)
        for s in range(0, n, sec):
            img[H - 6:, xs[s]] = (150, 150, 150)
        img[H - 1 - int((H - 10) * thr / top), :] = (200, 200, 200)
        for k in range(1, n):
            y = H - 1 - int((H - 10) * d1[k] / top)
            img[y:H - 1, xs[k]] = (30, 30, 30)
        os.makedirs(os.path.dirname(os.path.abspath(a.png)), exist_ok=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{Wd}x{H}",
                        "-i", "-", a.png], input=img.tobytes(), check=True)
        print(f"energy curve: {a.png}  (blue = timeline cuts, grey line = rest threshold, ticks = seconds)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
