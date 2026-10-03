import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { color } from "../tokens";

/**
 * Traces a rounded outline around a region of the real UI (native screen px),
 * drawn clockwise from the top-left over `draw` frames. Place inside <Screen>.
 */
export const Marker: React.FC<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    at: number;
    out?: number;
    draw?: number;
    radius?: number;
    tone?: string;
}> = ({ x1, y1, x2, y2, at, out, draw = 12, radius = 36, tone = color.accent }) => {
    const frame = useCurrentFrame();
    const pad = 14;
    const w = x2 - x1 + pad * 2;
    const h = y2 - y1 + pad * 2;
    const r = Math.min(radius, h / 2);
    const perimeter = 2 * (w + h - 4 * r) + 2 * Math.PI * r;
    const p = interpolate(frame, [at, at + draw], [0, 1], {
        easing: Easing.bezier(0.6, 0, 0.2, 1),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });
    const fade = out === undefined ? 1 : interpolate(frame, [out, out + 6], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    if (frame < at) return null;
    return (
        <svg
            style={{ position: "absolute", left: x1 - pad - 6, top: y1 - pad - 6, overflow: "visible" }}
            width={w + 12}
            height={h + 12}
        >
            <rect
                x={6}
                y={6}
                width={w}
                height={h}
                rx={r}
                fill={tone}
                fillOpacity={0.06 * p * fade}
                stroke={tone}
                strokeWidth={8}
                strokeLinecap="round"
                strokeDasharray={perimeter}
                strokeDashoffset={perimeter * (1 - p)}
                opacity={fade}
            />
        </svg>
    );
};
