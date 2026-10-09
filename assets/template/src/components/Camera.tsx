import React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { EASE } from "../lib/ease";

/** Scene-level camera move: scale s about the frame centre, then offset by (x, y) px and roll r degrees. */
export type Move = { f: number; s: number; x?: number; y?: number; r?: number };
export type Whip = "left" | "right" | "up" | "down";
/**
 * How a cut looks. Both sides of one cut use the SAME seam (Promo.tsx derives them from one entry per cut),
 * so axis, direction and speed match across it (the vector law, references/motion.md section 4):
 * - "curve": the default. Partial travel (12% of the width out, 16.5% in, so the speed matches at the cut),
 *   power4 halves meeting at the cut; the exit fades to 0.3 and the entry starts at 0.35 opacity, so the
 *   frame never empties. Only one side is ever visible: quick, invisible, never a dissolve.
 * - "whip":  full 45%-width blurred travel in 6 f. An act break; at most twice per video.
 * - "zoom":  zoom-through. Exit grows 1 -> 1.2 with blur, entry grows 0.75 -> 1 (same Z sign on both sides).
 * - "pullback": the mirror (exit 1 -> 0.8, entry 1.25 -> 1). Reserved for an arrival/payoff beat.
 * - "cut": a hard cut, no motion. Underused; good on a hard musical hit between two finished frames.
 */
export type SeamStyle = "curve" | "whip" | "zoom" | "pullback" | "cut";
export type Seam = { style: SeamStyle; dir?: Whip };

const ease = Easing.bezier(0.45, 0, 0.25, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
// Frames per side. Entries run longer than exits (~1.3x) so the arrival reads.
const LEN: Record<SeamStyle, { out: number; in: number }> = {
    curve: { out: 9, in: 11 },
    whip: { out: 6, in: 6 },
    zoom: { out: 6, in: 15 },
    pullback: { out: 6, in: 15 },
    cut: { out: 0, in: 0 },
};

const track = (frame: number, keys: Move[], pick: (k: Move) => number, scale = false) =>
    keys.length === 1
        ? pick(keys[0])
        : interpolate(frame, keys.map((k) => k.f), keys.map(pick), { easing: ease, ...clamp, ...(scale ? { output: "perceptual-scale" as const } : {}) });

const vec = (dir: Whip, amount: number): [number, number] => {
    switch (dir) {
        case "left":
            return [-amount, 0];
        case "right":
            return [amount, 0];
        case "up":
            return [0, -amount];
        default:
            return [0, amount];
    }
};

type Fx = { dx: number; dy: number; scale: number; blur: number; opacity: number };
const NONE: Fx = { dx: 0, dy: 0, scale: 1, blur: 0, opacity: 1 };

/** Exit side: p runs 0 -> 1 over the last LEN.out frames. Travel is TOWARD `dir`. */
const exitFx = (seam: Seam, p: number, width: number): Fx => {
    const dir = seam.dir ?? "left";
    switch (seam.style) {
        case "curve": {
            const e = EASE.seamOut(p);
            const [dx, dy] = vec(dir, width * 0.12 * e);
            return { dx, dy, scale: 1, blur: 8 * e, opacity: interpolate(p, [0.2, 1], [1, 0.3], clamp) };
        }
        case "whip": {
            const e = Easing.in(Easing.cubic)(p);
            const [dx, dy] = vec(dir, width * 0.45 * e);
            return { dx, dy, scale: 1, blur: 26 * e * (dir === "left" || dir === "right" ? 0.6 : 0.5), opacity: 1 };
        }
        case "zoom":
        case "pullback": {
            const e = Easing.in(Easing.poly(3))(p);
            return { dx: 0, dy: 0, scale: seam.style === "zoom" ? 1 + 0.2 * e : 1 - 0.2 * e, blur: 10 * e, opacity: 1 - 0.85 * p };
        }
        default:
            return NONE;
    }
};

/** Entry side: p runs 1 -> 0 over the first LEN.in frames. The scene arrives MOVING toward `dir`. */
const entryFx = (seam: Seam, p: number, width: number): Fx => {
    const dir = seam.dir ?? "left";
    const back = { left: "right", right: "left", up: "down", down: "up" }[dir] as Whip;
    switch (seam.style) {
        case "curve": {
            const e = EASE.seamIn(1 - p); // 0 -> 1 progress, fast first
            // power4 speed at the cut = 4 x distance / length: 0.165W over 11 f matches 0.12W over 8 f
            const [dx, dy] = vec(back, width * 0.165 * (1 - e));
            return { dx, dy, scale: 1, blur: 8 * (1 - e), opacity: interpolate(1 - p, [0, 0.45], [0.35, 1], clamp) };
        }
        case "whip": {
            const e = Easing.out(Easing.cubic)(1 - p);
            const [dx, dy] = vec(back, width * 0.45 * (1 - e));
            return { dx, dy, scale: 1, blur: 26 * (1 - e) * (dir === "left" || dir === "right" ? 0.6 : 0.5), opacity: 1 };
        }
        case "zoom":
        case "pullback": {
            const e = EASE.arrive(1 - p);
            const from = seam.style === "zoom" ? 0.75 : 1.25;
            return { dx: 0, dy: 0, scale: from + (1 - from) * e, blur: 10 * (1 - e), opacity: 0.15 + 0.85 * e };
        }
        default:
            return NONE;
    }
};

/**
 * Wraps a scene. `seamIn` is the cut this scene enters on, `seamOut` the cut it leaves on.
 * Seam frames are exempt from the 10 f fade limit. A scene shorter than its two seams (e.g. 21 f between a zoom
 * in and out) gets both shortened proportionally, so neither side is skipped; keep scenes >= 30 f anyway.
 */
export const Camera: React.FC<{ moves: Move[]; seamIn?: Seam; seamOut?: Seam; children: React.ReactNode }> = ({
    moves,
    seamIn,
    seamOut,
    children,
}) => {
    const frame = useCurrentFrame();
    const { durationInFrames, width } = useVideoConfig();
    const s = track(frame, moves, (k) => k.s, true);
    const x = track(frame, moves, (k) => k.x ?? 0);
    const y = track(frame, moves, (k) => k.y ?? 0);
    const r = track(frame, moves, (k) => k.r ?? 0);

    const want = (seamIn ? LEN[seamIn.style].in : 0) + (seamOut ? LEN[seamOut.style].out : 0);
    const k = want > durationInFrames ? durationInFrames / want : 1;
    const inLen = seamIn ? Math.floor(LEN[seamIn.style].in * k) : 0;
    const outLen = seamOut ? Math.floor(LEN[seamOut.style].out * k) : 0;
    let fx = NONE;
    if (seamIn && inLen > 0 && frame < inLen) {
        fx = entryFx(seamIn, interpolate(frame, [0, inLen], [1, 0], clamp), width);
    } else if (seamOut && outLen > 1 && frame >= durationInFrames - outLen) {
        fx = exitFx(seamOut, interpolate(frame, [durationInFrames - outLen, durationInFrames - 1], [0, 1], clamp), width);
    }

    return (
        <div
            style={{
                position: "absolute",
                inset: 0,
                transformOrigin: "50% 50%",
                transform: `translate(${x + fx.dx}px, ${y + fx.dy}px) scale(${s * fx.scale}) rotate(${r}deg)`,
                filter: fx.blur > 0.5 ? `blur(${fx.blur}px)` : undefined,
                opacity: fx.opacity < 1 ? fx.opacity : undefined,
            }}
        >
            {children}
        </div>
    );
};
