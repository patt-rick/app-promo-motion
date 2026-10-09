import React from "react";
import { Lottie, LottieAnimationData } from "@remotion/lottie";

/**
 * The brand's own logo animation, played start to finish: frame 0 of its <Sequence> is frame 0 of
 * the animation. Needs `pnpm add @remotion/lottie@<the project's remotion version> lottie-web`.
 * Sites often inline the JSON in a JS chunk as JSON.parse('{"v":"5..","fr":30,...,"layers":[...]}');
 * see references/motion.md, "End on the full logo animation". Size the end scene to at least the
 * animation's (op - ip) frames at the comp fps, plus the CTA hold.
 */
export const LottieLogo: React.FC<{ data: LottieAnimationData; width?: number; x?: number; y?: number }> = ({ data, width = 1920, x = 0, y = 0 }) => {
    const d = data as unknown as { w: number; h: number };
    return (
        <div style={{ position: "absolute", left: x, top: y, width, height: (width * d.h) / d.w }}>
            <Lottie animationData={data} loop={false} style={{ width: "100%", height: "100%" }} />
        </div>
    );
};
