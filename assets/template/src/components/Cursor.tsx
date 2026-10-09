import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { chain, LEAD } from "../lib/springs";

/**
 * A pointer that moves between keyed points on springs and clicks on given frames.
 * WEBSITES ONLY (marketing sites, landing pages). App promos, web apps included, use <Tap> for triggers.
 * Arrive before the click: put a path key about 8 f before it, and the click on the action frame.
 */
export const Cursor: React.FC<{ path: { f: number; x: number; y: number }[]; clicks?: number[]; size?: number; from?: number; until?: number }> = ({
    path,
    clicks = [],
    size = 46,
    from = path[0].f,
    until = 1e9,
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    if (frame < from || frame > until) return null;
    const x = chain(frame, fps, path.map((p) => ({ f: p.f, v: p.x })), LEAD);
    const y = chain(frame, fps, path.map((p) => ({ f: p.f, v: p.y })), LEAD);
    let s = 1;
    for (const c of clicks) {
        const d = frame - c;
        if (d >= -3 && d <= 6) s = Math.min(s, interpolate(d, [-3, 0, 6], [1, 0.82, 1]));
    }
    const mid = (from + until) / 2;
    const fade = interpolate(frame, [from, Math.min(from + 5, mid), Math.max(until - 5, mid + 0.01), until + 0.02], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
        <svg
            width={size}
            height={size * 1.4}
            viewBox="0 0 20 28"
            style={{
                position: "absolute",
                left: x - size * 0.1,
                top: y - size * 0.07,
                transform: `scale(${s})`,
                transformOrigin: "10% 5%",
                opacity: fade,
                filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.25))",
            }}
        >
            <path d="M2 1.5 L2 22 L7.2 17.3 L10.6 25.5 L14.2 24 L10.9 16 L18 16 Z" fill="#111" stroke="#fff" strokeWidth={1.6} strokeLinejoin="round" />
        </svg>
    );
};
