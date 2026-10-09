import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile } from "remotion";
import { Camera, Move, Seam } from "./components/Camera";
import { End, FeatureA, FeatureB, Hook } from "./scenes/Examples";
import { scenes, SceneId, TOTAL_FRAMES } from "./timeline";
import { color } from "./tokens";

const SCENES: Record<SceneId, React.FC> = { hook: Hook, featureA: FeatureA, featureB: FeatureB, end: End };

// Per-scene camera. Every scene moves (push-in, pull-back or diagonal pan, 0.5-1 deg roll); never zoom in
// then straight back out. `cut` is the seam at the END of that scene; both sides of the cut are derived from it,
// so axis, direction and speed always match (references/motion.md section 4, the vector law).
// Keep ONE house direction for ordinary "curve" seams; another direction or style needs a reason (a "zoom" when
// going deeper into one feature, "pullback" for the payoff, "whip" at most twice per video). In 9:16 use "up":
// headlines rise, so the incoming scene's first entrances already travel the seam's way (16:9: "left" works if
// the first headline starts after the 11 f entry seam). The hook has no entry seam (frame 0 is the thumbnail).
// The END CARD never gets seam motion (its logo animation plays from its first frame): the cut into it is
// forced to a hard cut below, whatever the scene before it says.
// Check headline-safe bounds for every key (see references/motion.md).
const CAMERA: Record<SceneId, { moves: Move[]; cut?: Seam }> = {
    hook: { moves: [{ f: 0, s: 1 }, { f: 75, s: 1.12, x: 30, y: -20, r: -1 }], cut: { style: "curve", dir: "up" } },
    featureA: { moves: [{ f: 0, s: 1.16, x: 90, y: 140 }, { f: 72, s: 1.06, x: 10, y: -50 }, { f: 135, s: 1.1, x: 20, y: -30, r: 1 }], cut: { style: "zoom" } },
    featureB: { moves: [{ f: 0, s: 1.04, x: 50, y: 60 }, { f: 40, s: 1.08, x: 30 }, { f: 105, s: 1.12, x: 10, r: -1 }] },
    end: { moves: [{ f: 0, s: 1.16, x: 60 }, { f: 105, s: 1 }] },
};
const ORDER = Object.keys(SCENES) as SceneId[];

// UI sounds at the exact frames of real taps/results in the captures. Keep SFX volume <= 0.4 under a -14 LUFS track.
const SFX: { at: number; src: string; volume: number }[] = [
    { at: scenes.featureA.from + 42, src: "audio/tap.wav", volume: 0.38 },
    { at: scenes.featureA.from + 56, src: "audio/coin.wav", volume: 0.3 },
    // a whoosh peaks mid-file: start it ~3 f before the cut so its peak lands on the zoom seam
    { at: scenes.featureB.from - 3, src: "audio/whoosh.wav", volume: 0.22 },
];

export const Promo: React.FC = () => (
    <AbsoluteFill style={{ background: color.paper }}>
        {ORDER.map((id, i) => {
            const Scene = SCENES[id];
            const last = i === ORDER.length - 1;
            const seamIn = i > 0 && !last ? CAMERA[ORDER[i - 1]].cut : undefined;
            const seamOut = last || i === ORDER.length - 2 ? undefined : CAMERA[id].cut;
            return (
                // premountFor: mount (load fonts, images, video) a second early so the first frame never paints blank
                <Sequence key={id} from={scenes[id].from} durationInFrames={scenes[id].duration} name={id} premountFor={30}>
                    <Camera moves={CAMERA[id].moves} seamIn={seamIn} seamOut={seamOut}>
                        <Scene />
                    </Camera>
                </Sequence>
            );
        })}
        {/* last-15-frame fade: harmless on the generated track (it rings out past the end), needed on custom tracks */}
        <Audio
            src={staticFile("audio/music.wav")}
            volume={(f) => interpolate(f, [TOTAL_FRAMES - 15, TOTAL_FRAMES], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
        />
        {SFX.map((s, i) => (
            <Sequence key={i} from={s.at} durationInFrames={45} layout="none">
                <Audio src={staticFile(s.src)} volume={s.volume} />
            </Sequence>
        ))}
    </AbsoluteFill>
);
