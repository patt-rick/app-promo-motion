import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { color } from "../tokens";

/** Touch marker drawn in native screen pixels (place inside <Screen>). */
export const Tap: React.FC<{ x: number; y: number; at: number }> = ({ x, y, at }) => {
    const frame = useCurrentFrame();
    const t = frame - at;
    if (t < -4 || t > 18) return null;
    const press = interpolate(t, [-4, 0, 6], [0, 1, 0.85], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const ring = interpolate(t, [0, 18], [0, 1], { easing: Easing.out(Easing.cubic), extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const fade = interpolate(t, [8, 18], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
        <>
            <div
                style={{
                    position: "absolute",
                    left: x - 60,
                    top: y - 60,
                    width: 120,
                    height: 120,
                    borderRadius: 60,
                    background: color.ink,
                    opacity: 0.28 * press * fade,
                    transform: `scale(${0.6 + press * 0.4})`,
                }}
            />
            <div
                style={{
                    position: "absolute",
                    left: x - 60,
                    top: y - 60,
                    width: 120,
                    height: 120,
                    borderRadius: 60,
                    border: `6px solid ${color.accent}`,
                    opacity: (1 - ring) * (t >= 0 ? 1 : 0),
                    transform: `scale(${1 + ring * 1.4})`,
                }}
            />
        </>
    );
};
