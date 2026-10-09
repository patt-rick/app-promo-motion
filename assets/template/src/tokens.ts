import { loadFont } from "@remotion/google-fonts/Manrope";
import { EASE } from "./lib/ease";
import { HEAVY, SOFT } from "./lib/springs";

// Replace the font with the app's own typeface (any @remotion/google-fonts family, or a local font via staticFile).
export const { fontFamily } = loadFont("normal", { weights: ["500", "700", "800"], subsets: ["latin"] });

// Mirror the app's light theme tokens exactly (read them from the app's theme file, never guess).
export const color = {
    paper: "#F7F4EF", // app background: the video's canvas
    paperDeep: "#EDE8DD",
    ink: "#26231D", // primary text
    inkSoft: "#6E6A61", // secondary text
    surface: "#FFFFFF", // cards / sheets / notification background
    accent: "#0066FF", // brand primary: markers, rings, chips - the one accent
    accentSoft: "#DCE6FB",
    income: "#3E7049", // semantic colours for "good" / "bad" outlines
    expense: "#A8392E",
    shadow: "74, 63, 40", // rgb triple used inside rgba() for warm shadows
};

// The look: derive from the brand (see references/motion.md "Direction"). Weight must exist in the font
// (many brand fonts stop at 700); load it in loadFont() above. Add subsets (e.g. "latin-ext", "cyrillic").
export const look = {
    headline: 112, // px at 1080 wide; ~96 in 16:9
    weight: "800",
    tracking: "-0.045em",
    // Motion feel, read by Headline, Caption, Sprite and Morph (references/motion.md section 1b):
    //   springy / technical: enter 12, EASE.arrive, SOFT, pop true
    //   editorial:           enter 20, EASE.glide,  HEAVY, pop false (no overshoot anywhere)
    //   bold:                enter 9,  EASE.arrive, SOFT, pop true
    enter: 12, // headline word entrance, frames; exits take ~70% of it
    curve: EASE.arrive,
    spring: SOFT as typeof SOFT | typeof HEAVY, // container / radius / colour springs
    pop: true, // may the video use its one POP? (editorial: false -> use HEAVY instead)
};

// Brand for the end card. icon = null -> a wordmark is used (websites often have no app icon).
export const brand = {
    name: ["App", "Name"], // two lines on the end card
    cta: "Free on Google Play.", // e.g. "Download on the App Store.", "Try it free at acme.com."
    icon: "stills/icon.png" as string | null,
};

export const FPS = 30; // beat timing lives in beats.ts / timeline.ts

export const W = 1080;
export const H = 1920;
// Output frame: 1080x1920 (9:16) for Reels/Shorts/TikTok/stories; 1920x1080 (16:9) for YouTube,
// websites and desktop products; 1080x1080 for feeds. Re-layout per format - never crop one into another.

// Native size of the captures (Android: adb shell wm size; web: viewport x deviceScaleFactor).
export const SCREEN_W = 1080;
export const SCREEN_H = 2340;
// Rows of the capture to hide: Android status bar (real clock + the owner's notification icons) and
// gesture bar. Web captures have neither: use CROP_TOP = 0, CROP_BOTTOM = SCREEN_H.
export const CROP_TOP = 112;
export const CROP_BOTTOM = 2288;
