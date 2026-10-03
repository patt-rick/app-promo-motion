// Real UI components cut from full-res capture frames (native px): [x1, y1, x2, y2].
// Get bounds from `uiautomator dump` (scripts/android.sh `ui`) or by measuring a frame at a known scale.
// Crop tightly: a carousel neighbour or scrim edge inside the rect shows up as a sliver when the sprite flies.
export type Rect = [number, number, number, number];
// srcW = pixel width of the source image (defaults to SCREEN_W). Set it whenever sources differ in size
// (phone 1080, mobile web 1170, desktop 1920, widget crops...). web_capture.mjs rects.json already includes it.
export type Part = { src: string; rect: Rect; radius?: number; srcW?: number };

const p = (src: string, rect: Rect, radius = 36, srcW?: number): Part => ({ src: `stills/ui/${src}.png`, rect, radius, srcW });

export const ui = {
    // balanceCard: p("dashboard", [60, 307, 946, 864], 56),
    // rows: [p("list", [60, 575, 1015, 765]), p("list", [60, 799, 1015, 989])],
    example: p("dashboard", [60, 300, 1020, 860], 56),
};

export const aspect = (r: Rect) => (r[3] - r[1]) / (r[2] - r[0]);
