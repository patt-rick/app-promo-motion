import React from "react";
import { Easing, interpolate, interpolateColors, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { chain, LEAD, TRAIL } from "../lib/springs";
import { color, look } from "../tokens";

/**
 * One state of a morph chain. At frame `at` the container springs to this centre, size, radius and
 * colour. The previous content exits (blur + fade), and this content enters a few frames later.
 * Content is real UI (a <Crop> of a capture, or an <Img> of a real asset) sized to w x h.
 */
export type MorphState = { at: number; x: number; y: number; w: number; h: number; radius: number; bg?: string; content: React.ReactNode };

const EXIT = 5; // the outgoing content blurs out over [at, at + EXIT]
const ENTER_DELAY = 4; // the incoming content starts once the outgoing is mostly gone, so texts never overlap
const ENTER = 8;

/**
 * "One shape, no cuts": a single container that turns into each UI state in turn.
 * Each edge has its own spring chain. Per transition, the edge that travels further leads (fast LEAD
 * spring) and the opposite edge trails (TRAIL), so the shape stretches toward the new state, then
 * settles: the liquid feel. A small press dip just before `at` sells the trigger (click, tap, scan).
 */
export const Morph: React.FC<{ states: MorphState[]; shadow?: number; press?: boolean }> = ({ states, shadow = 1, press = true }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    if (frame < states[0].at) return null;

    type E = "l" | "r" | "t" | "b";
    const edges = states.map((s) => ({ l: s.x - s.w / 2, r: s.x + s.w / 2, t: s.y - s.h / 2, b: s.y + s.h / 2 }));
    const edge = (pick: E, partner: E) =>
        chain(
            frame,
            fps,
            states.map((s, i) => {
                if (i === 0) return { f: s.at, v: edges[0][pick] };
                const dv = edges[i][pick] - edges[i - 1][pick];
                const dpv = edges[i][partner] - edges[i - 1][partner];
                const d = Math.abs(dv);
                const dp = Math.abs(dpv);
                const travel = (dv + dpv) / 2; // centre movement along this axis
                const front = pick === "r" || pick === "b" ? travel > 0 : travel < 0;
                // the edge that moves further leads; on a tie, the edge on the side of travel leads;
                // a centred resize (no travel) goes width first, then height
                const leading = Math.abs(d - dp) > 1 ? d > dp : Math.abs(travel) > 1 ? front : pick === "l" || pick === "r";
                return { f: s.at, v: edges[i][pick], config: leading ? LEAD : TRAIL };
            }),
        );
    const l = edge("l", "r");
    const r = edge("r", "l");
    const t = edge("t", "b");
    const b = edge("b", "t");
    const radius = chain(frame, fps, states.map((s) => ({ f: s.at, v: s.radius })), look.spring);

    // background colour follows each transition's spring progress
    let bg = states[0].bg ?? color.surface;
    for (let i = 1; i < states.length; i++) {
        const p = spring({ frame: frame - states[i].at, fps, config: look.spring });
        bg = interpolateColors(Math.min(1, p), [0, 1], [bg, states[i].bg ?? color.surface]);
    }

    // press: a 3% dip in the 4 frames before each trigger, released by the morph itself
    let dip = 1;
    if (press) {
        for (let i = 1; i < states.length; i++) {
            const d = frame - states[i].at;
            if (d >= -4 && d < 6) dip = Math.min(dip, interpolate(d, [-4, 0, 6], [1, 0.97, 1], { easing: Easing.inOut(Easing.quad) }));
        }
    }

    const cx = (l + r) / 2;
    const cy = (t + b) / 2;
    return (
        <div
            style={{
                position: "absolute",
                left: l,
                top: t,
                width: Math.max(1, r - l),
                height: Math.max(1, b - t),
                borderRadius: radius,
                background: bg,
                overflow: "hidden",
                transform: `scale(${dip})`,
                boxShadow: shadow
                    ? `0 ${30 * shadow}px ${70 * shadow}px rgba(${color.shadow}, ${0.16 * shadow}), 0 ${6 * shadow}px ${16 * shadow}px rgba(${color.shadow}, ${0.1 * shadow})`
                    : undefined,
            }}
        >
            {states.map((s, i) => {
                const next = states[i + 1];
                const enter =
                    i === 0
                        ? 1
                        : interpolate(frame, [s.at + ENTER_DELAY, s.at + ENTER_DELAY + ENTER], [0, 1], { easing: Easing.out(Easing.cubic), extrapolateLeft: "clamp", extrapolateRight: "clamp" });
                const exit = next ? interpolate(frame, [next.at, next.at + EXIT], [0, 1], { easing: Easing.in(Easing.quad), extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
                const o = enter * (1 - exit);
                if (o <= 0.001) return null;
                const blur = (1 - enter) * 14 + exit * 14;
                const sc = 1 + (1 - enter) * 0.04 - exit * 0.04;
                // content keeps its own size, centred on the container's moving centre
                return (
                    <div
                        key={i}
                        style={{
                            position: "absolute",
                            left: cx - l - s.w / 2,
                            top: cy - t - s.h / 2,
                            width: s.w,
                            height: s.h,
                            opacity: o,
                            filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
                            transform: `scale(${sc})`,
                        }}
                    >
                        {s.content}
                    </div>
                );
            })}
        </div>
    );
};
