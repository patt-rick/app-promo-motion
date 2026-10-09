import React from "react";
import { Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import { color, CROP_BOTTOM, CROP_TOP, fontFamily, SCREEN_W } from "../tokens";

/**
 * A camera keyframe. (fx, fy) is a point on the captured screen in NATIVE capture pixels; it is
 * placed at (x, y) in the output frame. zoom 1 = the screen drawn `baseWidth` px wide.
 */
export type CamKey = { f: number; fx: number; fy: number; x: number; y: number; zoom: number; rot?: number };
export type Clip = { src: string; from: number; at: number; rate?: number };

const ease = Easing.bezier(0.65, 0, 0.2, 1);
const track = (frame: number, keys: CamKey[], pick: (k: CamKey) => number) =>
    keys.length === 1
        ? pick(keys[0])
        : interpolate(frame, keys.map((k) => k.f), keys.map(pick), { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });

const BAR = 96; // browser chrome height in native px at 1920 wide (scaled by nativeW / 1920)

/**
 * The product's real UI (app screen recording / website capture) as a floating sheet.
 * - `clips` play back-to-back: each starts at scene frame `at`, from clip frame `from` (jump cuts in one shot).
 * - `chrome="browser"` adds a minimal window bar with the site's URL (desktop web captures);
 *   "none" is a bare rounded sheet (phones, mobile web). Status bars are cropped via CROP_TOP/BOTTOM in tokens.
 * - children are drawn in native screen px (Marker, Tap, Notification overlays).
 * - nativeW / cropTop / cropBottom default to the tokens; override per instance when a video mixes
 *   capture sizes (phone 1080 + desktop 1920, or a tall full-page still). Pass the same baseWidth and
 *   nativeW to dock() for sprites lifted out of this screen.
 */
export const Screen: React.FC<{
    still?: string;
    clips?: Clip[];
    cam: CamKey[];
    baseWidth?: number;
    chrome?: "none" | "browser";
    url?: string;
    nativeW?: number;
    cropTop?: number;
    cropBottom?: number;
    children?: React.ReactNode;
}> = ({ still, clips = [], cam, baseWidth = 820, chrome = "none", url = "", nativeW = SCREEN_W, cropTop = CROP_TOP, cropBottom = CROP_BOTTOM, children }) => {
    const frame = useCurrentFrame();
    const zoom = track(frame, cam, (k) => k.zoom);
    const fx = track(frame, cam, (k) => k.fx);
    const fy = track(frame, cam, (k) => k.fy);
    const x = track(frame, cam, (k) => k.x);
    const y = track(frame, cam, (k) => k.y);
    const rot = track(frame, cam, (k) => k.rot ?? 0);
    const s = (baseWidth / nativeW) * zoom;
    const browser = chrome === "browser";
    const k = nativeW / 1920;
    const radius = (browser ? 28 : 64) * k;
    const shadow = `0 50px 110px rgba(${color.shadow}, 0.22), 0 10px 26px rgba(${color.shadow}, 0.16), 0 0 0 2px rgba(${color.shadow}, 0.08)`;

    return (
        <div
            style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: nativeW,
                height: cropBottom - cropTop,
                transformOrigin: "0 0",
                transform: `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${s}) translate(${-fx}px, ${-(fy - cropTop)}px)`,
            }}
        >
            {browser && (
                <div
                    style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: -BAR * k,
                        height: BAR * k,
                        borderRadius: `${radius}px ${radius}px 0 0`,
                        background: color.paperDeep,
                        boxShadow: shadow,
                        display: "flex",
                        alignItems: "center",
                        gap: 14 * k,
                        padding: `0 ${32 * k}px`,
                        fontFamily,
                    }}
                >
                    {[0, 1, 2].map((i) => (
                        <div key={i} style={{ width: 22 * k, height: 22 * k, borderRadius: 11 * k, background: ["#FF5F57", "#FEBC2E", "#28C840"][i], opacity: 0.9 }} />
                    ))}
                    <div style={{ marginLeft: 28 * k, flex: 1, height: 52 * k, borderRadius: 26 * k, background: color.surface, color: color.inkSoft, fontSize: 28 * k, display: "flex", alignItems: "center", padding: `0 ${28 * k}px` }}>
                        {url}
                    </div>
                </div>
            )}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: browser ? `0 0 ${radius}px ${radius}px` : radius,
                    overflow: "hidden",
                    background: color.paper,
                    boxShadow: shadow,
                }}
            >
                <div style={{ position: "absolute", left: 0, top: -cropTop, width: nativeW }}>
                    {still ? (
                        <Img src={staticFile(still)} style={{ width: nativeW, display: "block" }} />
                    ) : (
                        clips.map((c, i) => (
                            <Sequence key={i} from={c.at} durationInFrames={i < clips.length - 1 ? clips[i + 1].at - c.at : undefined} layout="none">
                                <OffthreadVideo src={staticFile(c.src)} startFrom={c.from} playbackRate={c.rate ?? 1} muted style={{ width: nativeW, display: "block" }} />
                            </Sequence>
                        ))
                    )}
                </div>
                <div style={{ position: "absolute", left: 0, top: -cropTop, width: nativeW, height: cropBottom }}>{children}</div>
            </div>
        </div>
    );
};
