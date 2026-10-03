import React from "react";
import { Easing, interpolate, staticFile, useCurrentFrame } from "remotion";
import { color, SCREEN_W } from "../tokens";
import { aspect, Part, Rect } from "../ui";
import { CamKey } from "./Screen";

/** Pose of a sprite: centre (x, y) and width w in frame px, plus optional tilt. */
export type Pose = { f: number; x: number; y: number; w: number; rot?: number; tiltX?: number; tiltY?: number; o?: number };

const ease = Easing.bezier(0.2, 0.9, 0.25, 1);

const track = (frame: number, keys: Pose[], pick: (k: Pose) => number) =>
    keys.length === 1
        ? pick(keys[0])
        : interpolate(frame, keys.map((k) => k.f), keys.map(pick), { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });

/** Where a native-screen rect sits in the frame for a static camera key (rotation ignored). */
export const dock = (key: CamKey, rect: Rect, f: number, baseWidth = 820, nativeW = SCREEN_W): Pose => {
    const s = (baseWidth / nativeW) * key.zoom; // pass the same baseWidth/nativeW the <Screen> uses
    const cx = (rect[0] + rect[2]) / 2;
    const cy = (rect[1] + rect[3]) / 2;
    return { f, x: key.x + (cx - key.fx) * s, y: key.y + (cy - key.fy) * s, w: (rect[2] - rect[0]) * s };
};

/**
 * A real UI component lifted out of a capture frame and animated on its own.
 * `reveal` wipes it in from the left (bars filling) or from the bottom (chart growing).
 * `swap` cross-wipes to a second capture of the same component (before -> after).
 */
export const Sprite: React.FC<{
    part: Part;
    poses: Pose[];
    reveal?: { from: "left" | "bottom"; at: number; dur: number };
    swap?: { part: Part; at: number; dur?: number };
    shadow?: number;
    ring?: { at: number; tone?: string };
}> = ({ part, poses, reveal, swap, shadow = 1, ring }) => {
    const frame = useCurrentFrame();
    if (frame < poses[0].f && (poses[0].o ?? 1) === 0) return null;
    const x = track(frame, poses, (k) => k.x);
    const y = track(frame, poses, (k) => k.y);
    const w = track(frame, poses, (k) => k.w);
    const rot = track(frame, poses, (k) => k.rot ?? 0);
    const tiltX = track(frame, poses, (k) => k.tiltX ?? 0);
    const tiltY = track(frame, poses, (k) => k.tiltY ?? 0);
    const o = track(frame, poses, (k) => k.o ?? 1);
    if (o <= 0.001) return null;

    const s = w / (part.rect[2] - part.rect[0]);
    const h = w * aspect(part.rect);

    let clip = "none";
    if (reveal) {
        const r = interpolate(frame, [reveal.at, reveal.at + reveal.dur], [0, 1], {
            easing: Easing.bezier(0.6, 0, 0.2, 1),
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
        });
        clip = reveal.from === "left" ? `inset(0 ${(1 - r) * 100}% 0 0)` : `inset(${(1 - r) * 100}% 0 0 0)`;
    }
    const swapP = swap
        ? interpolate(frame, [swap.at, swap.at + (swap.dur ?? 10)], [0, 1], { easing: Easing.bezier(0.6, 0, 0.2, 1), extrapolateLeft: "clamp", extrapolateRight: "clamp" })
        : 0;
    const ringP = ring ? interpolate(frame, [ring.at, ring.at + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;

    // each layer scales its own source so a swap capture with a slightly different crop still fills the sprite
    const layer = (pt: Part, style: React.CSSProperties) => {
        const ls = w / (pt.rect[2] - pt.rect[0]);
        return (
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: `url(${staticFile(pt.src)})`,
                    backgroundSize: `${(pt.srcW ?? SCREEN_W) * ls}px auto`,
                    backgroundPosition: `${-pt.rect[0] * ls}px ${-pt.rect[1] * ls}px`,
                    ...style,
                }}
            />
        );
    };

    return (
        <div
            style={{
                position: "absolute",
                left: x - w / 2,
                top: y - h / 2,
                width: w,
                height: h,
                opacity: o,
                transform: `perspective(1600px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) rotate(${rot}deg)`,
                clipPath: clip,
            }}
        >
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: (part.radius ?? 36) * s,
                    overflow: "hidden",
                    background: color.paper,
                    boxShadow: shadow
                        ? `0 ${40 * shadow}px ${90 * shadow}px rgba(${color.shadow}, ${0.24 * shadow}), 0 ${8 * shadow}px ${22 * shadow}px rgba(${color.shadow}, ${0.14 * shadow})`
                        : undefined,
                    outline: ring ? `${6 * ringP}px solid ${ring.tone ?? color.accent}` : undefined,
                    outlineOffset: 6,
                }}
            >
                {layer(part, {})}
                {swap && layer(swap.part, { clipPath: `inset(0 ${(1 - swapP) * 100}% 0 0)` })}
            </div>
        </div>
    );
};

/** Paper wash over the phone so lifted components read as the focus. */
export const Veil: React.FC<{ at: number; out?: number; amount?: number }> = ({ at, out, amount = 0.7 }) => {
    const frame = useCurrentFrame();
    const a = interpolate(frame, [at, at + 10], [0, amount], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const b = out === undefined ? 1 : interpolate(frame, [out, out + 10], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return <div style={{ position: "absolute", inset: 0, background: color.paper, opacity: a * b }} />;
};
