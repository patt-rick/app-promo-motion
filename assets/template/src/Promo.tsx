import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile } from "remotion";
import { Camera, Move, Whip } from "./components/Camera";
import { End, FeatureA, FeatureB, Hook } from "./scenes/Examples";
import { scenes, SceneId, TOTAL_FRAMES } from "./timeline";
import { color } from "./tokens";

const SCENES: Record<SceneId, React.FC> = { hook: Hook, featureA: FeatureA, featureB: FeatureB, end: End };

// Per-scene camera. Every scene moves (push-in, pull-back or diagonal pan, 0.5-1 deg roll) and
// whips alternate direction (left, up, right...). The hook has no whipIn (frame 0 is the thumbnail),
// the end card no whipOut. Check headline-safe bounds for every key (see references/motion.md).
const CAMERA: Record<SceneId, { moves: Move[]; whipIn?: Whip; whipOut?: Whip }> = {
    hook: { moves: [{ f: 0, s: 1 }, { f: 75, s: 1.12, x: 30, y: -20, r: -1 }], whipOut: "left" },
    featureA: { moves: [{ f: 0, s: 1.16, x: 90, y: 140 }, { f: 72, s: 1.06, x: 10, y: -50 }, { f: 135, s: 1.1, x: 20, y: -30, r: 1 }], whipIn: "left", whipOut: "up" },
    featureB: { moves: [{ f: 0, s: 1.16, x: 50, y: 110 }, { f: 40, s: 1.04, x: 30 }, { f: 105, s: 1.1, x: 10, r: -1 }], whipIn: "up", whipOut: "left" },
    end: { moves: [{ f: 0, s: 1.16, x: 60 }, { f: 105, s: 1 }], whipIn: "left" },
};

// UI sounds at the exact frames of real taps/results in the captures. Keep SFX volume <= 0.4 under a -14 LUFS track.
const SFX: { at: number; src: string; volume: number }[] = [
    { at: scenes.featureA.from + 42, src: "audio/tap.wav", volume: 0.38 },
    { at: scenes.featureA.from + 56, src: "audio/coin.wav", volume: 0.3 },
    { at: scenes.featureB.from, src: "audio/whoosh.wav", volume: 0.22 },
];

export const Promo: React.FC = () => (
    <AbsoluteFill style={{ background: color.paper }}>
        {(Object.keys(SCENES) as SceneId[]).map((id) => {
            const Scene = SCENES[id];
            return (
                <Sequence key={id} from={scenes[id].from} durationInFrames={scenes[id].duration} name={id}>
                    <Camera {...CAMERA[id]}>
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
