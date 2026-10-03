import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { color, fontFamily, look } from "../tokens";

const out = Easing.bezier(0.16, 1, 0.3, 1);

/** Lines rise out of a mask word by word; `exitAt` sends them up and out. */
export const Headline: React.FC<{
    lines: string[];
    at?: number;
    exitAt?: number;
    x?: number;
    y?: number;
    size?: number;
    tone?: string;
    stagger?: number;
    align?: "left" | "right";
    /** "chars" for scripts without spaces (CJK, Thai); put direction: "rtl" on a parent for Arabic/Hebrew. */
    units?: "words" | "chars";
}> = ({ lines, at = 0, exitAt, x = 72, y = 150, size = look.headline, tone = color.ink, stagger = 2, align = "left", units = "words" }) => {
    const frame = useCurrentFrame();
    let wordIndex = 0;
    return (
        <div style={{ position: "absolute", top: y, fontFamily, color: tone, ...(align === "right" ? { right: 72 + x } : { left: x }) }}>
            {lines.map((line, li) => (
                <div key={li} style={{ overflow: "hidden", paddingBottom: size * 0.08, marginBottom: -size * 0.08 }}>
                    <div style={{ display: "flex", justifyContent: align === "right" ? "flex-end" : "flex-start", gap: units === "chars" ? 0 : size * 0.26, fontSize: size, fontWeight: look.weight, letterSpacing: look.tracking, lineHeight: 1.0 }}>
                        {(units === "chars" ? Array.from(line) : line.split(" ")).map((word, wi) => {
                            const start = at + wordIndex++ * stagger;
                            const inP = interpolate(frame, [start, start + 12], [1, 0], { easing: out, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
                            const outP = exitAt === undefined ? 0 : interpolate(frame, [exitAt + li * 1.5, exitAt + li * 1.5 + 9], [0, -1], { easing: Easing.in(Easing.cubic), extrapolateLeft: "clamp", extrapolateRight: "clamp" });
                            return (
                                <span key={wi} style={{ display: "inline-block", transform: `translateY(${(inP + outP) * 110}%)` }}>
                                    {word}
                                </span>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

export const Caption: React.FC<{ text: string; at?: number; exitAt?: number; x?: number; y?: number; width?: number }> = ({
    text,
    at = 0,
    exitAt,
    x = 76,
    y = 420,
    width = 760,
}) => {
    const frame = useCurrentFrame();
    const p = interpolate(frame, [at, at + 10], [0, 1], { easing: out, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const e = exitAt === undefined ? 0 : interpolate(frame, [exitAt, exitAt + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
        <div
            style={{
                position: "absolute",
                left: x,
                top: y,
                width,
                fontFamily,
                fontWeight: 500,
                fontSize: 40,
                lineHeight: 1.3,
                color: color.inkSoft,
                opacity: p * (1 - e),
                transform: `translateY(${(1 - p) * 24}px)`,
            }}
        >
            {text}
        </div>
    );
};
