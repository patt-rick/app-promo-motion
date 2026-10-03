import React from "react";
import { Img, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Caption, Headline } from "../components/Headline";
import { Marker } from "../components/Marker";
import { CamKey, Screen } from "../components/Screen";
import { dock, Sprite, Veil } from "../components/Sprite";
import { Tap } from "../components/Tap";
import { Window } from "../components/Window";
import { brand, color, fontFamily } from "../tokens";
import { ui } from "../ui";

// One example per pattern, timed to timeline.json (hook 5 beats = 75 f, featureA 9 = 135 f, featureB 7 = 105 f,
// end 7 = 105 f at 120 BPM). Every pose/exit is relative to the scene; retime them when scene lengths change:
// headlines exit ~8 f before the cut and the last pose sits at the scene's final frame (no frozen tail).
// Copy, rename, and replace the stills/clips/rects with the real ones.

// HOOK: frame 0 is the thumbnail. Headline already set (at < 0), bright paper, real UI below.
const HOOK_CAM: CamKey = { f: 0, fx: 540, fy: 112, x: 540, y: 500, zoom: 1 };
export const Hook: React.FC = () => (
    <>
        <Headline lines={["Short promise", "in two lines."]} at={-30} exitAt={66} size={108} />
        <Window top={420}>
            <Screen still="stills/ui/dashboard.png" cam={[HOOK_CAM]} />
            <Veil at={14} amount={0.6} />
        </Window>
        {/* lift the hero component out of the phone: start exactly docked, then float + tilt */}
        <Sprite
            part={ui.example}
            poses={[
                { ...dock(HOOK_CAM, ui.example.rect, 11), o: 0 }, // hidden until it lifts: no shadow halo on the thumbnail
                { ...dock(HOOK_CAM, ui.example.rect, 12), o: 1 },
                { f: 32, x: 540, y: 830, w: 830, tiltX: 16, tiltY: -8, rot: -5 },
                { f: 75, x: 545, y: 810, w: 840, tiltX: 10, tiltY: -6, rot: -4 },
            ]}
        />
    </>
);

// REAL INTERACTION: a screen recording with jump cuts, a tap marker, then the key element lifts out.
const LIST_CAM: CamKey = { f: 0, fx: 540, fy: 112, x: 540, y: 500, zoom: 1 };
export const FeatureA: React.FC = () => (
    <>
        <Headline lines={["What the feature", "does for you."]} at={0} exitAt={126} />
        <Window top={420}>
            <Screen
                clips={[
                    { src: "clips/feature.mp4", from: 40, at: 0, rate: 1.6 }, // speed through navigation
                    { src: "clips/feature.mp4", from: 186, at: 36 }, // jump cut to the moment that matters
                ]}
                cam={[LIST_CAM]}
            >
                <Tap x={540} y={2172} at={42} />
                <Marker x1={60} y1={932} x2={1020} y2={1105} at={50} draw={14} />
            </Screen>
            <Veil at={56} amount={0.93} />
        </Window>
        <Sprite
            part={ui.example}
            poses={[
                { ...dock(LIST_CAM, ui.example.rect, 55), o: 0 },
                { ...dock(LIST_CAM, ui.example.rect, 56), o: 1 },
                { f: 74, x: 540, y: 1000, w: 960, rot: -3 },
                { f: 135, x: 545, y: 985, w: 970, rot: -2.5 },
            ]}
            ring={{ at: 72 }}
        />
        <Caption text="One plain sentence of proof." at={80} exitAt={126} y={1180} width={900} />
    </>
);

// PURE COMPONENTS: no phone; real parts on paper. Bars "fill" via reveal, before->after via swap.
export const FeatureB: React.FC = () => (
    <>
        <Headline lines={["A second", "benefit."]} at={0} exitAt={96} />
        <Sprite part={ui.example} poses={[{ f: 0, x: 520, y: 760, w: 880, rot: -3 }, { f: 105, x: 527, y: 746, w: 896, rot: -3 }]} reveal={{ from: "left", at: 4, dur: 16 }} />
        <Sprite
            part={ui.example}
            poses={[{ f: 10, x: 560, y: 1300, w: 900, o: 0 }, { f: 20, x: 560, y: 1280, w: 920, o: 1, rot: 2 }, { f: 105, x: 560, y: 1270, w: 935, rot: 2 }]}
            swap={{ part: ui.example, at: 30, dur: 12 }} // point `swap` at the AFTER capture of the same component
            ring={{ at: 44, tone: color.income }}
        />
    </>
);

// END CARD: real components fly in from off-screen around the app name.
export const End: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const icon = spring({ frame: frame - 8, fps, config: { damping: 12, stiffness: 140 } });
    return (
        <>
            <Sprite part={ui.example} poses={[{ f: 0, x: -500, y: -300, w: 560, rot: -18 }, { f: 18, x: 330, y: 300, w: 560, rot: -6 }, { f: 105, x: 342, y: 290, w: 571, rot: -6 }]} shadow={0.8} />
            {brand.icon ? (
                <Img src={staticFile(brand.icon)} style={{ position: "absolute", left: 72, top: 640, width: 190, height: 190, borderRadius: 48, transform: `scale(${Math.max(0, icon)})`, transformOrigin: "left bottom" }} />
            ) : (
                // no app icon (typical for websites): a wordmark tile in the accent colour
                <div style={{ position: "absolute", left: 72, top: 640, width: 190, height: 190, borderRadius: 48, background: color.accent, color: color.surface, fontFamily, fontWeight: 800, fontSize: 110, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${Math.max(0, icon)})`, transformOrigin: "left bottom" }}>
                    {brand.name.join(" ").charAt(0)}
                </div>
            )}
            <Headline lines={brand.name} at={12} y={870} size={150} />
            <Caption text={brand.cta} at={22} y={1190} />
        </>
    );
};
