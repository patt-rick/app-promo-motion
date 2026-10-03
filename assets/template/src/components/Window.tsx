import React from "react";
import { H, W } from "../tokens";

/** Clips its children to a horizontal band of the frame, feathering the cut edges into the paper. */
export const Window: React.FC<{ top?: number; bottom?: number; children: React.ReactNode }> = ({
    top = 0,
    bottom = H,
    children,
}) => {
    const feather = 90;
    const fadeTop = top > 0 ? `transparent 0px, black ${feather}px` : "black 0px";
    const fadeBottom = bottom < H ? `black calc(100% - ${feather}px), transparent 100%` : "black 100%";
    const mask = `linear-gradient(to bottom, ${fadeTop}, ${fadeBottom})`;
    return (
        <div
            style={{
                position: "absolute",
                left: 0,
                top,
                width: W,
                height: bottom - top,
                overflow: "hidden",
                maskImage: mask,
                WebkitMaskImage: mask,
            }}
        >
            <div style={{ position: "absolute", left: 0, top: -top, width: W, height: H }}>{children}</div>
        </div>
    );
};
