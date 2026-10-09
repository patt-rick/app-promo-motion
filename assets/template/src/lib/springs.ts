import { spring, SpringConfig } from "remotion";

// Springs as pure functions of time (frame in, value out: no state carried between frames).
// Judge a spring by its damping ratio zeta = damping / (2 * sqrt(stiffness * mass)), not damping alone:
//   zeta 0.77 -> ~2.5% overshoot, 0.7 -> ~5%, 0.6 -> ~10%, 0.5 -> ~16%, >= 1 -> none.
// UI and type: zeta >= 0.7. One hero POP per video may go to ~0.55. Never below 0.5 (cartoon bounce).
// Springs drive HITS (arrivals, presses, snaps); bezier curves in lib/ease.ts drive TRAVEL.
export const zeta = (c: Partial<SpringConfig>) => (c.damping ?? 10) / (2 * Math.sqrt((c.stiffness ?? 100) * (c.mass ?? 1)));

/** Default: slight overshoot (~2.5%, zeta 0.77). Containers, sprites, morph radius. */
export const SOFT: Partial<SpringConfig> = { damping: 20, stiffness: 170, mass: 1 };
/** Faster, for the leading edge of a stretch and for cursor moves (zeta 0.72). */
export const LEAD: Partial<SpringConfig> = { damping: 22, stiffness: 260, mass: 0.9 };
/** Slower, for the trailing edge: it lags the leading edge, so the shape stretches then settles (zeta 0.87). */
export const TRAIL: Partial<SpringConfig> = { damping: 20, stiffness: 120, mass: 1.1 };
/** Small UI: toggles, chips, press feedback. Settles in ~10 f (zeta 0.77). */
export const SNAP: Partial<SpringConfig> = { damping: 26, stiffness: 320, mass: 0.9 };
/** Heavy type, logos, big panels: weightier, no visible overshoot (zeta 0.94). */
export const HEAVY: Partial<SpringConfig> = { damping: 26, stiffness: 120, mass: 1.6 };
/** The camera: critically damped, never overshoots (a bouncing camera reads as shake). */
export const CAM: Partial<SpringConfig> = { damping: 15, stiffness: 56, mass: 1 };
/** ONE hero moment per video (the icon on the end card, the payoff badge): ~12% overshoot (zeta 0.56). */
export const POP: Partial<SpringConfig> = { damping: 14, stiffness: 200, mass: 0.8 };

export type Key = { f: number; v: number; config?: Partial<SpringConfig> };

/**
 * A value that retargets several times, still a pure function of time:
 * v(t) = v0 + sum_i (v_i - v_{i-1}) * spring(t - f_i). One closed-form spring per change.
 */
export const chain = (frame: number, fps: number, keys: Key[], config: Partial<SpringConfig> = SOFT) => {
    let v = keys[0].v;
    for (let i = 1; i < keys.length; i++) {
        v += (keys[i].v - keys[i - 1].v) * spring({ frame: frame - keys[i].f, fps, config: keys[i].config ?? config });
    }
    return v;
};
