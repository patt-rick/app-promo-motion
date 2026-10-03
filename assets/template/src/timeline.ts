import plan from "../timeline.json";
import { BEAT_FRAMES } from "./beats";
import { FPS } from "./tokens";

// timeline.json (project root) is the ONE source of timing, shared with the music scripts:
//   { "bpm", "music": "generated" | "custom", "style", "scenes": { id: [startBeat, endBeat] } }
// Scenes are listed in order; each starts where the previous ends. compose.py reads the same file
// (cuts = scene starts, drop = 2nd scene start, final hit = last scene start; that span must be whole bars).
// beats.py (custom track) writes BEAT_FRAMES so every cut lands on a real beat of that track.

/** Frame of beat `b`: the detected beat from a custom track if present, else a perfect grid at bpm. */
export const frameOf = (b: number) => (b < BEAT_FRAMES.length ? BEAT_FRAMES[b] : Math.round((b * 60 * FPS) / plan.bpm));

const beats: Record<string, number[]> = plan.scenes;
export type SceneId = keyof typeof plan.scenes;

export const scenes = Object.fromEntries(
    Object.entries(beats).map(([k, [a, b]]) => [k, { from: frameOf(a), duration: frameOf(b) - frameOf(a) }]),
) as Record<SceneId, { from: number; duration: number }>;

export const TOTAL_BEATS = Math.max(...Object.values(beats).map(([, b]) => b));
export const TOTAL_FRAMES = frameOf(TOTAL_BEATS);
