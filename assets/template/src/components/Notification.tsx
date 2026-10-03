import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { color, fontFamily } from "../tokens";

/**
 * Heads-up notification drawn over the phone (native screen px; place inside <Screen>).
 * Use it to show a notification that was REALLY posted during capture but that the OS displayed
 * silently (e.g. `cmd notification post` from adb doesn't heads-up on Samsung). Keep the text
 * identical to what was posted. Use a neutral icon: never another company's logo or colours.
 * Drops in at `at`, then sinks toward the list row it created at `land`.
 */
export const Notification: React.FC<{ at: number; land: number; app: string; text: string; top?: number; sinkBy?: number }> = ({
    at,
    land,
    app,
    text,
    top = 250,
    sinkBy = 640,
}) => {
    const frame = useCurrentFrame();
    const drop = interpolate(frame, [at, at + 10], [-1, 0], { easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const sink = interpolate(frame, [land, land + 9], [0, 1], { easing: Easing.in(Easing.cubic), extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    if (frame < at || sink >= 1) return null;
    return (
        <div
            style={{
                position: "absolute",
                left: 60,
                right: 60,
                top,
                transform: `translateY(${drop * 420 + sink * sinkBy}px) scale(${1 - sink * 0.12})`,
                opacity: 1 - sink,
                background: color.surface,
                borderRadius: 48,
                padding: "34px 40px",
                boxShadow: `0 24px 60px rgba(${color.shadow}, 0.28)`,
                fontFamily,
                display: "flex",
                gap: 28,
                alignItems: "flex-start",
            }}
        >
            <div style={{ width: 88, height: 88, borderRadius: 24, background: color.accentSoft, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 34, color: color.inkSoft, fontWeight: 500 }}>
                    <span style={{ color: color.ink, fontWeight: 700 }}>{app}</span>
                    <span>now</span>
                </div>
                <div style={{ fontSize: 38, lineHeight: 1.3, color: color.ink, marginTop: 8, fontWeight: 500 }}>{text}</div>
            </div>
        </div>
    );
};
