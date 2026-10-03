import React from "react";
import { Composition } from "remotion";
import { Promo } from "./Promo";
import { TOTAL_FRAMES } from "./timeline";
import { FPS, H, W } from "./tokens";

export const Root: React.FC = () => (
    <Composition id="Promo" component={Promo} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} />
);
