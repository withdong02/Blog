/*
 * Minimal runnable check for the home-page fluid avatar behaviour
 * (assets/js/fluid-ip.js — see DESIGN.md, section 4).
 *
 *   node tests/fluid-ip-check.mjs
 *
 * It is not a test framework and does not try to be one: the script is loaded
 * into a fake DOM with a hand-driven clock, and only what the animation
 * contract promises is checked — the gate, the form beat, cleanup after an
 * ending or interruption, no second loop from repeated clicks, and the pull's
 * mechanical promises (one filter region per pull, deformation axis following
 * the pointer, and a reversal along one line relaxing through a circle
 * instead of turning the blob around).
 *
 * Colours, layout and the SVG outline are not covered here: those are CSS and
 * markup, checked in a browser, not by a script.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "..", "assets", "js", "fluid-ip.js"), "utf8");

const TOTAL = 9000 + 2 * 320; /* DURATION + (blots - 1) * STAGGER */

function makeHarness(options = {}) {
    const opts = Object.assign({ wide: true, fine: true, reduced: false, withOrb: true }, options);

    const media = new Map();
    function mediaQuery(query) {
        if (!media.has(query)) {
            const mq = {
                matches: query === "(min-width: 900px)" ? opts.wide
                    : query === "(hover: hover) and (pointer: fine)" ? opts.fine
                        : opts.reduced,
                handlers: [],
                addEventListener(_type, fn) { this.handlers.push(fn); },
                set(matches) {
                    this.matches = matches;
                    this.handlers.forEach((fn) => fn());
                }
            };
            media.set(query, mq);
        }
        return media.get(query);
    }

    const blots = [];
    const forms = [];
    const attrs = { "aria-label": "static", "data-label-action": "action" };
    const orbHandlers = {};
    const winHandlers = {};
    const docHandlers = {};
    const queued = new Map();
    let nextHandle = 1;
    let clock = 1000;
    let framesRun = 0;
    let lastPointer = [0, 0];

    const gooAttrs = { x: "-165", y: "-140", width: "900", height: "760" };
    const gooFilter = {
        getAttribute: (k) => gooAttrs[k] ?? null,
        setAttribute(k, v) { gooAttrs[k] = String(v); }
    };
    const svgEl = {
        getScreenCTM: () => ({ a: 0.6, b: 0, c: 0, d: 0.6, e: 100, f: 100 }),
        querySelector: (s) => (s === "#fluid-ip-goo" ? gooFilter : null)
    };
    const orb = {
        disabled: true,
        isConnected: true,
        querySelector: (selector) => (selector === ".fluid-ip-blots" ? blotLayer
            : selector === ".fluid-ip-forms" ? formLayer : selector === "defs" ? { appendChild() {} }
            : selector === "svg" ? svgEl : null),
        addEventListener(type, fn) { (orbHandlers[type] || (orbHandlers[type] = [])).push(fn); },
        getAttribute: (name) => (name in attrs ? attrs[name] : null),
        setAttribute(name, value) { attrs[name] = value; }
    };
    const blotLayer = { appendChild: (node) => blots.push(node) };
    const formLayer = { appendChild: (node) => forms.push(node), replaceChildren: () => { forms.length = 0; } };

    const document = {
        hidden: false,
        documentElement: { classList: { contains: () => false } },
        getElementById: (id) => (opts.withOrb && id === "fluid-ip-orb" ? orb : null),
        createElementNS(_ns, tag) {
            return {
                tag,
                d: undefined,
                attrs: {},
                appendChild() {},
                remove() {},
                setAttribute(name, value) { this.attrs[name] = value; if (name === "d") this.d = value; }
            };
        },
        addEventListener(type, fn) { (docHandlers[type] || (docHandlers[type] = [])).push(fn); }
    };

    const window = {
        innerWidth: 1440,
        innerHeight: 900,
        matchMedia: mediaQuery,
        addEventListener(type, fn) { (winHandlers[type] || (winHandlers[type] = [])).push(fn); },
        requestAnimationFrame(fn) { const handle = nextHandle++; queued.set(handle, fn); return handle; },
        cancelAnimationFrame(handle) { queued.delete(handle); }
    };

    /* The script reads the frame rate to stay the same speed on a 120Hz
       display, so the fake clock has to advance like a real one. */
    let fakeNow = 0;
    const clock_ = {
        now: () => fakeNow,
        advance(ms) { fakeNow += ms; return fakeNow; }
    };

    /* One queued frame, in scheduling order, at a 16.7ms step. */
    function step() {
        const first = queued.entries().next();
        if (first.done) return false;
        queued.delete(first.value[0]);
        clock += 16.7;
        clock_.advance(16.7);
        framesRun++;
        first.value[1](clock);
        return true;
    }

    function runFor(ms) {
        const until = clock + ms;
        while (clock < until && step()) { /* keep stepping */ }
        return clock;
    }

    function fire(type, target) {
        const handlers = target === "document" ? docHandlers[type]
            : target === "window" ? winHandlers[type] : orbHandlers[type];
        (handlers || []).forEach((fn) => fn({ type }));
    }

    /* The screen-to-SVG transform is a 0.6 scale at (100, 100), so a screen
       position is also a usable SVG position at 5/3 its size: 60px right of
       the pointer is +100 user units, which is a comfortable pull. */
    function pointer(type, x, y, target) {
        const handlers = target === "orb" ? orbHandlers[type] : winHandlers[type];
        (handlers || []).forEach((fn) => fn({ type, clientX: x, clientY: y, button: 0 }));
    }

    /* A drag in equal steps, so velocity and direction are steady. The pointer
       moves and then a frame runs, which is the order a browser produces. */
    function drag(fromX, fromY, toX, toY, steps = 10, holdFrames = 3) {
        lastPointer = [fromX, fromY];
        pointer("pointerdown", fromX, fromY, "orb");
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            lastPointer = [fromX + (toX - fromX) * t, fromY + (toY - fromY) * t];
            pointer("pointermove", lastPointer[0], lastPointer[1], "window");
            step();
        }
        runFor(holdFrames * 16);
    }

    /* One pointer move per frame along a fixed direction, so the axis has
       frames to converge in. */
    function steer(dx, dy, frames = 10) {
        let x = lastPointer[0], y = lastPointer[1];
        for (let i = 0; i < frames; i++) {
            x += dx; y += dy;
            pointer("pointermove", x, y, "window");
            step();
        }
    }

    vm.runInContext(source, vm.createContext({ window, document, performance: clock_ }),
        { filename: "fluid-ip.js" });

    return {
        orb, attrs, blots, forms, media: mediaQuery, document, gooAttrs, window,
        click: () => fire("click", "orb"),
        hide: () => { document.hidden = true; fire("visibilitychange", "document"); },
        step, runFor, pointer, drag, steer,
        release: () => pointer("pointerup", 0, 0, "window"),
        state: () => window.FluidIpPull.state(),
        pending: () => queued.size,
        framesRun: () => framesRun,
        blotGeometry: () => blots.map((node) => node.d),
        allCleared: () => blots.every((node) => node.d === "")
            && forms.every((node) => node.attrs.opacity === "0")
    };
}

let failures = 0;
function check(name, ok, detail) {
    if (!ok) failures++;
    console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok || detail === undefined ? "" : "  -> " + detail}`);
}

/* 1. The gate: wide viewport, fine hovering pointer, motion allowed. */
{
    const h = makeHarness();
    check("gate on: button enabled with the action label",
        h.orb.disabled === false && h.attrs["aria-label"] === "action",
        `disabled=${h.orb.disabled} label=${h.attrs["aria-label"]}`);
    check("gate on: no animation before a click", h.pending() === 0);
}

for (const [name, options] of [
    ["narrow viewport", { wide: false }],
    ["coarse pointer", { fine: false }]
]) {
    const h = makeHarness(options);
    h.click();
    check(`gate off (${name}): disabled, static label, click does nothing`,
        h.orb.disabled === true && h.attrs["aria-label"] === "static" && h.pending() === 0,
        `disabled=${h.orb.disabled} label=${h.attrs["aria-label"]} pending=${h.pending()}`);
}

/* 2. A normal run ends clean: blots cleared, no frame left scheduled. */
{
    const h = makeHarness();
    h.click();
    h.runFor(5000);
    check("middle beat: forms visibly replace detached blots",
        h.forms.some((node) => Number(node.attrs.opacity) > 0.5)
            && h.blots.some((node) => node.d === ""));
    h.runFor(TOTAL);
    check("ends clean: every blot path cleared",
        h.allCleared(), JSON.stringify(h.blotGeometry()));
    check("ends clean: nothing left scheduled", h.pending() === 0, `pending=${h.pending()}`);
    check("ends clean: blots did animate on the way",
        h.framesRun() > 100, `frames=${h.framesRun()}`);
    check("forms support a path and text",
        h.forms.length === 3 && h.forms[0].tag === "path"
            && h.forms[1].tag === "text" && h.forms[1].textContent === "文"
            && h.forms[2].tag === "text" && h.forms[2].textContent === "</>");
}

/* The settled forms can return early without snapping or a second loop. */
{
    const h = makeHarness();
    h.click();
    h.runFor(5100);
    const before = h.forms.map(node => node.attrs.transform);
    h.click();
    h.step();
    check("recall begins from the settled geometry", h.forms.every((node, i) => node.attrs.transform === before[i]));
    check("recall keeps one animation loop", h.pending() === 1);
    h.runFor(3800);
    check("recall completes before the ordinary hold ends", h.allCleared() && h.pending() === 0);
    h.click();
    check("next story uses reading writing imagination", h.forms.map(node => node.textContent).join("") === "读写想");
    h.runFor(TOTAL + 100);
    h.click();
    check("third story uses book pencil moon outlines", h.forms.length === 3 && h.forms.every(node => node.tag === "path"));
    h.hide();
    check("new story also cancels cleanly", h.allCleared() && h.pending() === 0);
}

/* 3. Interruption (tab hidden mid-flight) clears immediately. */
{
    const h = makeHarness();
    h.click();
    h.runFor(700);
    const animating = !h.allCleared();
    h.hide();
    check("hidden tab: an animation was in flight and was cleared",
        animating && h.allCleared() && h.pending() === 0,
        `animating=${animating} geometry=${JSON.stringify(h.blotGeometry())} pending=${h.pending()}`);
    h.document.hidden = false;
}

/* 4. Repeated clicks do not start a second loop. */
{
    const single = makeHarness();
    single.click();
    single.runFor(TOTAL + 200);

    const hammered = makeHarness();
    hammered.click();
    hammered.runFor(200);
    for (let i = 0; i < 5; i++) {
        hammered.click();
        check(`repeat click ${i + 1}: still exactly one loop in flight`, hammered.pending() === 1,
            `pending=${hammered.pending()}`);
        hammered.runFor(150);
    }
    hammered.runFor(TOTAL + 200);
    check("repeat clicks: same single run, then clean",
        hammered.framesRun() === single.framesRun() && hammered.allCleared(),
        `hammered=${hammered.framesRun()} single=${single.framesRun()}`);
}

/* 5. The gate can turn off while playing: the loop is torn down. */
{
    const h = makeHarness();
    h.click();
    h.runFor(400);
    h.media("(min-width: 900px)").set(false);
    check("gate turning off mid-flight: stopped, cleared, disabled",
        h.orb.disabled === true && h.allCleared() && h.pending() === 0,
        `disabled=${h.orb.disabled} pending=${h.pending()}`);
}

/* 6. The figure going away mid-flight also has to end the loop. */
{
    const h = makeHarness();
    h.click();
    h.runFor(300);
    h.orb.isConnected = false;
    h.step();
    check("figure removed mid-flight: stopped and cleared",
        h.allCleared() && h.pending() === 0,
        `geometry=${JSON.stringify(h.blotGeometry())} pending=${h.pending()}`);
}

/* 7. Pages without the figure (paginated home, articles) stay inert. */
{
    let threw = null;
    try {
        makeHarness({ withOrb: false });
    } catch (error) {
        threw = error;
    }
    check("no figure on the page: script returns without touching anything", threw === null,
        threw && threw.message);
}

/* 8. Scene C — the pull. Two properties are mechanical and worth a script:
   the goo region may only change once per pull (it was being re-sized every
   frame, which re-rasterised the whole body), and the deformation axis has to
   follow the pointer, not the blob's offset from the body centre. */
{
    const h = makeHarness();

    /* Down-right, until the axis has settled on that direction. Only the
       blob's diagonal motion means offset and pointer agree here. */
    h.drag(400, 400, 640, 640, 10, 20);
    const diagonal = h.state();
    check("pull: the deformation axis follows the pointer down a diagonal drag",
        Math.abs(Math.abs(diagonal.angle) - Math.PI / 4) < 0.08,
        `angle=${diagonal.angle.toFixed(3)}`);
    /* A drag has to produce a shape you can see, not a rounding error. */
    check("pull: a normal drag leaves the blob visibly stretched",
        diagonal.stretch > 1.25, `stretch=${diagonal.stretch.toFixed(3)}`);
    /* A break is a different animation; every check below is about the pull. */
    check("pull: a held drag does not break off", diagonal.breaking === false);
    /* The region is measured from the viewport, so take its numbers from the
       script once and then require them never to change again. */
    const heldRegion = { x: h.gooAttrs.x, w: h.gooAttrs.width };

    /* Now the hand reverses to straight up-right while the blob is still far
       below and to the right. Its offset from the body says "down"; the hand
       says "right". The axis has to say "right". */
    h.steer(12, -12, 16);
    const reversed = h.state();
    const offsetAngle = Math.atan2(reversed.y - 250, reversed.x - 256);
    /* Tolerance is loose because the fake clock has to satisfy both timers at
       once; the point is that the axis went from pointing down-right to
       pointing up-right, which the offset never does. */
    check("pull: reversing the hand turns the axis, it does not keep pointing at the offset",
        reversed.angle < -0.3 && offsetAngle > 0.3
            && Math.abs(reversed.angle - offsetAngle) > 0.8,
        `angle=${reversed.angle.toFixed(3)} offset=${offsetAngle.toFixed(3)}`);
    check("pull: the filter region never changes again while the pull lasts",
        h.gooAttrs.x === heldRegion.x && h.gooAttrs.width === heldRegion.w,
        JSON.stringify(h.gooAttrs));
}

/* 8b. Releasing inside the break distance springs back and restores the
   region; the stretch has to ease out, never oscillate — a stretch that
   bounced is what made the blob look like it was twitching. */
{
    const h = makeHarness();
    /* ~350ms of hand at roughly 6.7 user units a frame — about 16 screen px a
       frame — released about 20 units inside the break distance. Faster or
       further and the pull is meant to break off instead. */
    h.drag(400, 400, 436, 436, 22, 0);
    h.release();

    const atRelease = h.state();
    check("release: staying inside the break distance springs back instead of breaking off",
        atRelease.breaking === false,
        `x=${atRelease.x.toFixed(1)} y=${atRelease.y.toFixed(1)}`);

    const first = atRelease.stretch;
    check("release: a quick pull leaves a deformation to relax",
        first > 1.03, `stretch=${first.toFixed(3)}`);
    const framesAtRelease = h.framesRun();
    let previous = first;
    let rises = 0;
    let falling = false;
    for (let i = 0; i < 40; i++) {
        h.step();
        const stretch = h.state().stretch;
        /* What "bouncing" means: a rise after the relaxation has begun. The
           first frames are not part of it — the deformation is still catching
           up with the speed reading, which only then starts to decay. */
        if (stretch < previous - 0.0005) falling = true;
        else if (falling && stretch > previous + 0.0005) rises++;
        previous = stretch;
    }
    check("release: the stored stretch eases back without bouncing",
        rises === 0 && previous > 1 && previous < first,
        `rises=${rises} stretch=${previous.toFixed(3)}`);
    check("release: the blob lingers for a few frames instead of dropping back at once",
        h.framesRun() - framesAtRelease > 3,
        `frames=${h.framesRun() - framesAtRelease}`);

    h.runFor(2200);
    const settled = h.state();
    check("release: the blob returns to the body and the filter region is restored",
        Math.abs(settled.x - 256) < 1 && h.gooAttrs.width === "900" && h.gooAttrs.y === "-140",
        `x=${settled.x.toFixed(1)} goo=${JSON.stringify(h.gooAttrs)}`);
}

/* 8c. A hand that is barely moving must not shake the blob: the axis and the
   stretch are both read from per-frame displacement, so slow pointermove
   jitter has to be filtered rather than amplified. */
{
    const h = makeHarness();
    h.drag(400, 400, 470, 470, 8, 4);

    const angles = [];
    const stretches = [];
    let x = 470, y = 470;
    for (let i = 0; i < 60; i++) {
        /* ~1px per event, 1.5 events per frame, with a tremor that reverses
           direction: the worst case a slow hand produces. */
        const tremor = i % 3 === 0 ? 1.4 : 0.6;
        x += tremor * 0.7; y += tremor * 0.7;
        h.pointer("pointermove", x, y, "window");
        if (i % 2 === 1) {
            x += 0.9; y -= 0.3;
            h.pointer("pointermove", x, y, "window");
        }
        h.step();
        const s = h.state();
        angles.push(s.angle);
        stretches.push(s.stretch);
    }

    let maxAngleStep = 0;
    let maxStretchStep = 0;
    for (let i = 1; i < angles.length; i++) {
        maxAngleStep = Math.max(maxAngleStep, Math.abs(angles[i] - angles[i - 1]));
        maxStretchStep = Math.max(maxStretchStep, Math.abs(stretches[i] - stretches[i - 1]));
    }
    check("slow drag: the axis does not swing between frames",
        maxAngleStep < 0.06, `maxStep=${maxAngleStep.toFixed(4)} rad/frame`);
    check("slow drag: the stretch does not pulse between frames",
        maxStretchStep < 0.05, `maxStep=${maxStretchStep.toFixed(4)}`);
}

/* 8f. Back-and-forth along one line: the blob must not turn around. The
   deformation lives in double-angle space, so reversing the hand relaxes the
   blob through a circle and stretches it again along the same axis. An axis
   that rotates through a quarter turn on every reversal is the head-and-tail
   bug this guards against: the blob looked like it had to turn to face the
   new direction, which a shapeless ball of ink never does. */
{
    const h = makeHarness();
    /* Rightward along y = 400, until the stretch has settled. */
    h.drag(400, 400, 640, 400, 12, 6);
    const rightward = h.state();
    check("back-and-forth: a rightward drag stretches along the horizontal",
        Math.abs(rightward.angle) < 0.12 && rightward.stretch > 1.15,
        `angle=${rightward.angle && rightward.angle.toFixed(3)} stretch=${rightward.stretch.toFixed(3)}`);

    /* Straight back left along the same line, watching every frame. */
    let x = 640;
    let maxTilt = 0;
    let minStretch = rightward.stretch;
    for (let i = 0; i < 30; i++) {
        x -= 15;
        h.pointer("pointermove", x, 400, "window");
        h.step();
        const s = h.state();
        /* Tilt of the axis away from the drag line, measured on the half-turn
           circle: an axis pointing along the line is 0, one pointing a quarter
           turn away is PI. */
        const tilt = Math.abs(Math.atan2(Math.sin(2 * s.angle), Math.cos(2 * s.angle)));
        maxTilt = Math.max(maxTilt, tilt);
        minStretch = Math.min(minStretch, s.stretch);
    }
    const leftward = h.state();
    check("back-and-forth: reversing never rotates the axis off the drag line",
        maxTilt < 0.6, `maxTilt=${maxTilt.toFixed(3)} rad`);
    check("back-and-forth: the reversal passes through a rounder blob",
        minStretch < rightward.stretch - 0.04,
        `minStretch=${minStretch.toFixed(3)} from ${rightward.stretch.toFixed(3)}`);
    check("back-and-forth: the stretch returns along the same horizontal axis",
        Math.abs(leftward.angle) < 0.12 && leftward.stretch > 1.1,
        `angle=${leftward.angle.toFixed(3)} stretch=${leftward.stretch.toFixed(3)}`);
}

/* 8g. A hand that stops dead stops sending pointermove events, and the
   smoothed velocity used to be settled only by those events — so it froze at
   its last value and the blob held its stretch along the travel direction for
   as long as the button stayed down. It has to decay while the hand is idle,
   so a motionless hold rounds the blob back out. */
{
    const h = makeHarness();
    /* A fast rightward pull, then silence: frames only, no more events. */
    h.drag(400, 400, 700, 400, 8, 0);
    const moving = h.state();
    check("dead stop: a fast drag stretches the blob along the travel",
        moving.stretch > 1.3 && Math.abs(moving.angle) < 0.12,
        `stretch=${moving.stretch.toFixed(3)} angle=${moving.angle.toFixed(3)}`);

    for (let i = 0; i < 70; i++) h.step();
    const held = h.state();
    check("dead stop: the deformation relaxes while the hand is still on it",
        held.stretch < 1.08, `stretch=${held.stretch.toFixed(3)}`);
    check("dead stop: the blob itself stays out with the pointer",
        Math.abs(held.x - 256) > 60, `x=${held.x.toFixed(1)}`);
}

/* 8h. A pull that starts while a previous break is still running must keep the
   pinned region. The break's cleanup owns the region and hands it back when it
   ends — mid-gesture, that used to leave the second drag clipped to the small
   region around the body: the blob could be dragged out of sight and only
   reappeared inside that box. */
{
    const h = makeHarness();
    /* Far enough to break off, then released: the blot animation now owns the
       next 3600ms of screen time. */
    h.drag(400, 400, 900, 900, 16, 0);
    h.release();
    check("second pull: the first one handed off to the blot animation",
        h.state().breaking === true, `breaking=${h.state().breaking}`);

    /* Immediately another pull — well inside one break's lifetime — and this
       one is dragged the whole time, past the moment the break cleans up. */
    h.pointer("pointerdown", 300, 300, "orb");
    let x = 300;
    let clipped = 0;
    let regionLost = 0;
    for (let i = 0; i < 240; i++) {
        x += 4;
        h.pointer("pointermove", x, 300, "window");
        h.step();
        const s = h.state();
        if (!s.bounds) { regionLost++; continue; }
        const i2 = 55 * 1.7;
        if (s.x - i2 < s.bounds.x || s.x + i2 > s.bounds.x + s.bounds.width) clipped++;
    }
    check("second pull: the region survives the break that ends underneath it",
        regionLost === 0, `frames without a pinned region=${regionLost}`);
    check("second pull: the blob stays inside the region it is drawn in",
        clipped === 0, `frames outside=${clipped}`);
    /* The opposite failure: a region that is never handed back keeps the whole
       viewport as a filter surface for the rest of the page's life. */
    h.release();
    h.runFor(4000);
    check("second pull: once everything has settled the region does go back",
        h.gooAttrs.width === "900" && h.gooAttrs.y === "-140",
        `goo=${JSON.stringify(h.gooAttrs)}`);
}

/* 8e. The broken-off pattern comes home as ink: it has to be a whole blob
   again before it starts to move, not melt while it flies. And while the
   pattern is fully on show, no ink may sit under it — the forms layer is
   hollow (glyph counters, the star's gaps), so a residual blob reads as a
   black dot covering the centre. */
{
    const h = makeHarness();
    h.drag(400, 400, 900, 900, 16, 2);
    h.release();
    check("break: pulling far enough hands off to the blot animation",
        h.state().breaking === true, `breaking=${h.state().breaking}`);

    let firstFly = null;
    let firstFlyInk = false;
    let formGone = null;
    let movedWhileForm = 0;
    let holdWithInk = 0;
    let previous = null;
    /* The break now runs 3600ms; sampling has to cover all of it. */
    for (let i = 0; i < 260; i++) {
        h.step();
        const blot = h.blots[h.blots.length - 1];
        const form = h.forms[h.forms.length - 1];
        if (!blot || !form) break;
        /* The form's own transform is the symbol's centre. The ink's path is
           not usable for this: its start point is a midpoint of a ring that
           wobbles as the surface ripples, so it moves even when the blob does
           not. */
        const m = /translate\(([\d.-]+) ([\d.-]+)\)/.exec(form.attrs.transform || "");
        const centre = m ? [Number(m[1]), Number(m[2])] : null;
        const opacity = Number(form.attrs.opacity || 0);

        /* The hold: the form is fully opaque, so the ink under it must be
           gone entirely — not merely small. */
        if (form.attrs.opacity === "1.000" && blot.d !== "") holdWithInk++;

        if (previous && centre) {
            const moved = Math.abs(centre[0] - previous[0]) > 1 || Math.abs(centre[1] - previous[1]) > 1;
            if (moved) {
                if (firstFly === null) {
                    firstFly = i;
                    firstFlyInk = blot.d !== "";
                }
                if (opacity > 0.02) movedWhileForm++;
            }
        }
        previous = centre;
        if (formGone === null && opacity <= 0.02 && i > 4) formGone = i;
        if (blot.d === "" && form.attrs.opacity === "0") break;
    }

    check("break: the pattern is gone before the ink starts to move",
        firstFly !== null && formGone !== null && formGone <= firstFly,
        `formGone=${formGone} firstFly=${firstFly}`);
    check("break: the ink never travels while a pattern is still showing",
        movedWhileForm === 0, `frames=${movedWhileForm}`);
    check("break: while the form is fully shown, no ink blob sits under it",
        holdWithInk === 0, `frames=${holdWithInk}`);
    check("break: the ink is already there when the flight begins",
        firstFly !== null && firstFlyInk,
        `firstFly=${firstFly} ink=${firstFlyInk}`);
}

/* 8d. The blob is ink on screen: pulled past the edge of the window it has to
   stay drawn and stop at the edge, not vanish. The filter region used to be a
   fixed rectangle whose left edge sat only 500 units from the body, so any
   pull to the left of about a quarter of the screen clipped it away. */
{
    const h = makeHarness();
    const probe = () => h.state();
    h.drag(400, 400, 420, 420, 4, 0);

    const held = h.gooAttrs;
    const pinned = { x: Number(held.x), y: Number(held.y), width: Number(held.width), height: Number(held.height) };
    const view = probe().view;
    /* The blob is clamped by one radius plus the stretch, and the region adds
       its own padding on top of that. */
    const inset = 55 * 1.7 * 1.15;
    check("edge: the filter region is pinned over the whole view, not a fixed box",
        pinned.x <= view.left - 40 && pinned.x + pinned.width >= view.right + 40,
        `region=${JSON.stringify(pinned)} view=${JSON.stringify(view)}`);

    let outside = 0;
    let moving = 0;
    let previousX = probe().x;
    /* Held at the far left, then dragged well past the window edge. */
    for (let i = 0; i < 60; i++) {
        const px = i < 20 ? 420 : 420 - (i - 20) * 18;
        h.pointer("pointermove", px, 420 - (i - 20) * 6, "window");
        h.step();
        const s = probe();
        if (s.x - inset < pinned.x || s.x + inset > pinned.x + pinned.width
            || s.y - inset < pinned.y || s.y + inset > pinned.y + pinned.height) outside++;
        if (Math.abs(s.x - previousX) > 0.05) moving++;
        previousX = s.x;
    }
    check("edge: the blob stays inside the region that is drawn, all the way out",
        outside === 0, `framesOutside=${outside}`);
    check("edge: it is still moving when the pointer leaves the window",
        moving > 8, `movingFrames=${moving}`);
}


{
    const h = makeHarness({ reduced: true });
    h.click();
    check("system reduced motion still allows the animation", !h.orb.disabled && h.pending() > 0);
    h.runFor(12000);
    check("system reduced motion animation stops cleanly", h.pending() === 0);
}

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
