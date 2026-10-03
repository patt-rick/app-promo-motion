import React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

/** Scene-level camera move: scale s about the frame centre, then offset by (x, y) px and roll r degrees. */
export type Move = { f: number; s: number; x?: number; y?: number; r?: number };
export type Whip = "left" | "right" | "up" | "down";

const ease = Easing.bezier(0.45, 0, 0.25, 1);
const WHIP = 6;

const track = (frame: number, keys: Move[], pick: (k: Move) => number) =>
    keys.length === 1
        ? pick(keys[0])
        : interpolate(frame, keys.map((k) => k.f), keys.map(pick), { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });

const offset = (dir: Whip, amount: number): [number, number] => {
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

const opposite: Record<Whip, Whip> = { left: "right", right: "left", up: "down", down: "up" };

/**
 * Wraps a scene. `whip` is the direction the camera travels at the cut: the scene
 * leaves toward `whip` in its last frames and the next scene arrives from the opposite side.
 */
export const Camera: React.FC<{ moves: Move[]; whipIn?: Whip; whipOut?: Whip; children: React.ReactNode }> = ({
    moves,
    whipIn,
    whipOut,
    children,
}) => {
    const frame = useCurrentFrame();
    const { durationInFrames, width } = useVideoConfig();
    const s = track(frame, moves, (k) => k.s);
    const x = track(frame, moves, (k) => k.x ?? 0);
    const y = track(frame, moves, (k) => k.y ?? 0);
    const r = track(frame, moves, (k) => k.r ?? 0);

    let wx = 0;
    let wy = 0;
    let blur = 0;
    if (whipIn) {
        const p = interpolate(frame, [0, WHIP], [1, 0], { easing: Easing.out(Easing.cubic), extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const [dx, dy] = offset(opposite[whipIn], width * 0.45 * p);
        wx += dx;
        wy += dy;
        blur += p * 26;
    }
    if (whipOut) {
        const p = interpolate(frame, [durationInFrames - WHIP, durationInFrames], [0, 1], { easing: Easing.in(Easing.cubic), extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const [dx, dy] = offset(whipOut, width * 0.45 * p);
        wx += dx;
        wy += dy;
        blur += p * 26;
    }
    const horizontal = (whipIn && frame < WHIP && (whipIn === "left" || whipIn === "right")) || (whipOut && frame > durationInFrames - WHIP && (whipOut === "left" || whipOut === "right"));

    return (
        <div
            style={{
                position: "absolute",
                inset: 0,
                transformOrigin: "50% 50%",
                transform: `translate(${x + wx}px, ${y + wy}px) scale(${s}) rotate(${r}deg)`,
                filter: blur > 0.5 ? `blur(${blur * (horizontal ? 0.6 : 0.5)}px)` : undefined,
            }}
        >
            {children}
        </div>
    );
};
