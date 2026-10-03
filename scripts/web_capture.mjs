// Capture a website for a promo: crisp stills, frame-perfect scroll videos, recorded interaction
// flows, and exact element rects (native px) for sprites. Uses the system Google Chrome through
// playwright-core (no browser download). new_project.sh copies this file into <project>/scripts/ and the
// template lists playwright-core, so run it FROM THE PROJECT (Node resolves imports next to the script):
//
//   node scripts/web_capture.mjs run   --plan capture.json
//   node scripts/web_capture.mjs login --url https://app.example.com [--profile .chrome-profile]
//
// `login` opens a visible Chrome window with a persistent profile; the USER signs in, then closes the
// window. `run` reuses that profile when capture.json has "profile". Never ask for or type the user's password.
//
// capture.json:
// {
//   "url": "https://example.com",
//   "device": "mobile" | "desktop",          // mobile 390x844 @3x (1170 px wide), desktop 1280x720 @1.5x (1920x1080)
//   "profile": ".chrome-profile",            // optional, from `login` (gitignored; holds session cookies)
//   "out": "captures/web",                    // frames, videos, stills, rects.json land here
//   "steps": [
//     { "hide": ["#cookie-banner", ".chat-widget"] },          // display:none (banners, chat bubbles, popups)
//     { "css": "::-webkit-scrollbar{display:none}" },          // extra CSS
//     { "wait": 800 },
//     { "shot": "home" },                                     // viewport still -> home.png
//     { "shot": "home-full", "fullPage": true },               // full-page still
//     { "rects": { "hero": "section.hero", "pricing": "#pricing .card:nth-child(2)" }, "for": "home-full" },  // "for" = an earlier shot; output is ui.ts-ready {src, srcW, rect}
//     { "scroll": { "name": "scroll-features", "to": "#features", "seconds": 2.5 } },   // or "to": 1800 (px)
//     { "flow": { "name": "signup", "steps": [ { "click": "text=Get started" }, { "type": ["#email", "demo@example.com"] }, { "wait": 1200 } ] } },
//     { "goto": "https://example.com/pricing" }
//   ]
// }
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";

const FPS = 30;
const DEVICES = {
    mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    desktop: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 },
};
const arg = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : fallback;
};
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

// The session lives in a persistent Chrome profile folder: it survives the user closing the window
// (a plain context's storageState can't be read after the browser has exited).
async function login() {
    const url = arg("url");
    const profile = resolve(arg("profile", ".chrome-profile"));
    const context = await chromium.launchPersistentContext(profile, { channel: "chrome", headless: false, viewport: null });
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(url);
    console.log("Sign in in the Chrome window, then close the window. The session is kept in " + profile);
    await new Promise((done) => context.on("close", done));
    console.log(`profile saved: ${profile}  (set "profile" in capture.json)`);
}

async function run() {
    const plan = JSON.parse(readFileSync(arg("plan", "capture.json"), "utf8"));
    const out = resolve(plan.out ?? "captures/web");
    mkdirSync(out, { recursive: true });
    const dev = DEVICES[plan.device ?? "mobile"];
    const opts = { ...dev, reducedMotion: "no-preference" };
    const browser = plan.profile ? null : await chromium.launch({ channel: "chrome", headless: true });
    const context = browser
        ? await browser.newContext(opts)
        : await chromium.launchPersistentContext(resolve(plan.profile), { channel: "chrome", headless: true, ...opts });
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(plan.url, { waitUntil: "networkidle" });
    const rects = {};
    const shots = {}; // shot name -> { fullPage, scrollY at capture time }
    const css = [];
    const dsf = dev.deviceScaleFactor;
    const srcW = dev.viewport.width * dsf;

    const apply = async () => {
        if (css.length) await page.addStyleTag({ content: css.join("\n") });
    };

    // `slow` > 1 only inside a flow, where page animations run at 1/slow speed.
    const doStep = async (s, slow = 1) => {
        if (s.goto) {
            await page.goto(s.goto, { waitUntil: "networkidle" });
            await apply();
        }
        if (s.hide) {
            css.push(`${[].concat(s.hide).join(",")}{display:none!important}`);
            await apply();
        }
        if (s.css) {
            css.push(s.css);
            await apply();
        }
        if (s.wait) await page.waitForTimeout(s.wait * slow);
        if (s.click) await page.click(s.click);
        if (s.hover) await page.hover(s.hover);
        if (s.type) {
            await page.fill(s.type[0], "");
            await page.type(s.type[0], s.type[1], { delay: 70 * slow });
        }
        if (s.shot) {
            await page.screenshot({ path: join(out, `${s.shot}.png`), fullPage: !!s.fullPage });
            shots[s.shot] = { fullPage: !!s.fullPage, scrollY: await page.evaluate(() => window.scrollY) };
            console.log(`still ${s.shot}.png`);
        }
        if (s.rects) {
            const shot = shots[s.for];
            if (!shot) throw new Error(`rects: "for" must name an earlier shot (got "${s.for}")`);
            for (const [name, sel] of Object.entries(s.rects)) {
                const r = await page
                    .$eval(sel, (el) => {
                        const b = el.getBoundingClientRect();
                        return { x: b.left, y: b.top, w: b.width, h: b.height, sy: window.scrollY };
                    })
                    .catch(() => null);
                if (!r) {
                    console.warn(`rects: no element for "${sel}" (${name}) - check the selector against the live page`);
                    continue;
                }
                // page y, then relative to the shot (full page starts at 0; a viewport shot at its scrollY)
                const y0 = r.y + r.sy - (shot.fullPage ? 0 : shot.scrollY);
                // ready for src/ui.ts: copy the still to public/stills/ui/<shot>.png and spread this object into p()/Part
                rects[name] = { src: `stills/ui/${s.for}.png`, srcW, rect: [r.x, y0, r.x + r.w, y0 + r.h].map((v) => Math.round(v * dsf)) };
            }
        }
        if (s.scroll) await scrollShot(s.scroll);
        if (s.flow) await flow(s.flow);
    };

    // Smooth, deterministic scroll: set scrollY per frame and screenshot each frame (no dropped frames).
    const scrollShot = async ({ name, to, seconds = 2.5 }) => {
        const dir = join(out, `_${name}`);
        rmSync(dir, { recursive: true, force: true });
        mkdirSync(dir, { recursive: true });
        const from = await page.evaluate(() => window.scrollY);
        const target = typeof to === "number" ? to : await page.$eval(to, (el) => el.getBoundingClientRect().top + window.scrollY - 40);
        const n = Math.round(seconds * FPS);
        await page.addStyleTag({ content: "html{scroll-behavior:auto!important}" });
        for (let i = 0; i <= n; i++) {
            await page.evaluate((y) => window.scrollTo(0, y), from + (target - from) * ease(i / n));
            await page.waitForTimeout(16);
            await page.screenshot({ path: join(dir, `${String(i).padStart(4, "0")}.png`) });
        }
        execFileSync("ffmpeg", ["-v", "error", "-framerate", String(FPS), "-i", join(dir, "%04d.png"), "-c:v", "libx264", "-crf", "14", "-pix_fmt", "yuv420p", "-y", join(out, `${name}.mp4`)]);
        rmSync(dir, { recursive: true, force: true });
        console.log(`scroll ${name}.mp4 (${n + 1} frames)`);
    };

    // Real interactions: slow every CSS/Web animation to 1/SLOW via DevTools, screenshot continuously at
    // full resolution while the steps run, then play back SLOW x faster -> smooth, crisp 30 fps.
    // (JS/requestAnimationFrame-driven motion is not slowed; capture those as stills + Sprite swaps.)
    const SLOW = 4;
    const flow = async ({ name, steps }) => {
        const dir = join(out, `_${name}`);
        rmSync(dir, { recursive: true, force: true });
        mkdirSync(dir, { recursive: true });
        const cdp = await context.newCDPSession(page);
        await cdp.send("Animation.enable");
        await cdp.send("Animation.setPlaybackRate", { playbackRate: 1 / SLOW });
        const frames = [];
        let recording = true;
        const t0 = performance.now();
        const grab = (async () => {
            while (recording) {
                const file = join(dir, `${String(frames.length).padStart(5, "0")}.png`);
                const t = (performance.now() - t0) / 1000;
                const ok = await page.screenshot({ path: file }).then(() => true, () => false);
                if (ok) frames.push({ file, t });
            }
        })();
        await page.waitForTimeout(300 * SLOW);
        for (const st of steps) await doStep(st, SLOW);
        await page.waitForTimeout(500 * SLOW);
        recording = false;
        await grab;
        await cdp.send("Animation.setPlaybackRate", { playbackRate: 1 });
        await cdp.detach();
        if (!frames.length) throw new Error(`flow ${name}: no frames captured (every screenshot failed)`);
        const posix = (f) => f.replace(/\\/g, "/");
        const list = frames
            .map((f, i) => `file '${posix(f.file)}'\nduration ${((i < frames.length - 1 ? frames[i + 1].t - f.t : 0.1) / SLOW).toFixed(4)}`)
            .join("\n");
        writeFileSync(join(dir, "list.txt"), `${list}\nfile '${posix(frames.at(-1).file)}'\n`);
        execFileSync("ffmpeg", ["-v", "error", "-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"), "-vf", `fps=${FPS},scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p`, "-c:v", "libx264", "-crf", "14", "-y", join(out, `${name}.mp4`)]);
        rmSync(dir, { recursive: true, force: true });
        const eff = (frames.length / (frames.at(-1).t - frames[0].t)) * SLOW;
        console.log(`flow ${name}.mp4 (${frames.length} frames, ~${eff.toFixed(0)} fps effective${eff < 24 ? " - low: raise SLOW or simplify the page" : ""})`);
    };

    await apply();
    for (const s of plan.steps ?? []) await doStep(s);
    writeFileSync(join(out, "rects.json"), JSON.stringify(rects, null, 2));
    console.log(`native capture width ${dev.viewport.width * dsf}px; rects -> ${join(out, "rects.json")}`);
    await context.close();
    await browser?.close(); // a plain context's browser keeps the process alive otherwise
}

const mode = process.argv[2];
if (mode === "login") await login();
else if (mode === "run") await run();
else console.log("usage: web_capture.mjs run --plan capture.json | login --url URL [--profile .chrome-profile]");
