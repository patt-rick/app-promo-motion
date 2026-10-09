import { Easing } from "remotion";

// Named curves. Pick by job, never by habit: one signature curve carries ~80% of the moves.
// Entrances decelerate, exits accelerate, on-screen moves ease both ends; linear only for timers/rotation.
// Named by JOB (arrive/leave), not shape: `arrive` is an ease-OUT curve, `leave` an ease-IN curve.
export const EASE = {
    /** Entrances (expo-out): the house default for anything arriving. */
    arrive: Easing.bezier(0.16, 1, 0.3, 1),
    /** Exits only: leaves fast, never lingers. Exits run 65-75% of the entrance's length. */
    leave: Easing.bezier(0.7, 0, 0.84, 0),
    /** Moves between two on-screen poses. */
    move: Easing.bezier(0.65, 0, 0.35, 1),
    /** Gentle travel near text being read, and the editorial direction's signature curve. */
    glide: Easing.bezier(0.4, 0, 0.2, 1),
    /** A value that lands just past its target and settles (a bar filling to a level), ~3% overshoot. */
    land: Easing.bezier(0.55, 0, 0.2, 1.25),
    /** The two halves of power4.inOut: the seam pair. Exit with seamOut, enter with seamIn (Camera scales the entry's
     *  travel by its longer length so the speed at the cut matches). */
    seamOut: Easing.in(Easing.poly(4)),
    seamIn: Easing.out(Easing.poly(4)),
} as const;

/** Element duration bands at 30 fps (frames). Heavier/larger -> longer and less overshoot. */
export const DUR = { micro: 5, small: 12, card: 20, scene: 30, camera: 72 } as const;

/**
 * Scale a base duration by travel distance (sqrt law): a 100 px move takes `base`, 200 px ~1.4x,
 * 400 px and beyond 2x (capped), 25 px 0.5x (floor). Long moves don't look rushed, short ones not sluggish.
 */
export const byDistance = (base: number, distPx: number, refPx = 100) =>
    Math.round(base * Math.min(2, Math.max(0.5, Math.sqrt(Math.abs(distPx) / refPx))));

/** Stagger offsets: parts of one object 1 f, chips in a row 1-2 f, list rows 2 f, countable items 3-5 f. Total <= 15 f. */
export const stagger = (i: number, each: number, total = 15) => Math.min(i * each, total);

/**
 * Minimum on-screen hold (frames, fully settled) for a line of copy:
 * max(0.7 s, 0.25 s + chars / 17) - a short phrase ~1 s, the final hook >= 2 s (pass final=true).
 */
export const readFrames = (text: string, fps = 30, final = false) =>
    Math.ceil(fps * Math.max(final ? 2 : 0.7, 0.25 + text.length / 17));
