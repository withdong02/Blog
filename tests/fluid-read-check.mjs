/* Scenario D (reading-progress ink) — see DESIGN.md.
 *
 * A fake DOM with a hand-driven clock, in the same spirit as the other two
 * check scripts: only what the scenario promises is checked. The gate, the
 * hand-over of the progress bar and its return, that the mark sits on the tip
 * of the line, that the frame chain stops when the reader stops, that the
 * signoff comes up once, and that a teardown leaves nothing behind.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const js = name => readFileSync(join(here, "..", "assets", "js", name), "utf8");
const inkSource = js("fluid-ink.js");
const source = js("fluid-read.js");

function harness({ wide = true, fine = true, reduced = false, rail = true } = {}) {
    const media = [];
    const frames = new Map();
    const handlers = {};
    let frameId = 0;
    let docRoot = null;

    function classList(el) {
        const set = new Set();
        return {
            add(n) { set.add(n); },
            remove(n) { set.delete(n); },
            contains(n) { return set.has(n); },
            toggle(n, on) { if (on === undefined) on = !set.has(n); on ? set.add(n) : set.delete(n); return on; },
            get size() { return set.size; }
        };
    }

    function node(tag, extra = {}) {
        const n = {
            tagName: tag, style: {}, attrs: {}, children: [], parentNode: null, hidden: false,
            rect: { left: 0, top: 0, width: 0, height: 0 }, select: {}, handlers: {},
            setAttribute(k, v) { this.attrs[k] = String(v); },
            getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
            appendChild(c) { return this.insertBefore(c, null); },
            insertBefore(c, ref) {
                if (c.parentNode) c.remove();
                const i = ref ? this.children.indexOf(ref) : -1;
                if (i < 0) this.children.push(c); else this.children.splice(i, 0, c);
                c.parentNode = this;
                return c;
            },
            remove() {
                if (!this.parentNode) return;
                const s = this.parentNode.children;
                s.splice(s.indexOf(this), 1);
                this.parentNode = null;
            },
            get isConnected() { let p = this; while (p.parentNode) p = p.parentNode; return p === docRoot; },
            cloneNode() {
                const c = node(tag);
                c.attrs = { ...this.attrs };
                c.select = this.select;
                c.classList = classList(c);
                return c;
            },
            getBoundingClientRect() {
                const r = this.rect;
                return { ...r, right: r.left + r.width, bottom: r.top + r.height };
            },
            addEventListener(type, fn) { this.handlers[type] = fn; },
            querySelector(s) { return (this.select[s] || [])[0] || null; },
            querySelectorAll(s) { return this.select[s] || []; },
            classList: null
        };
        n.classList = classList(n);
        return Object.assign(n, extra);
    }

    docRoot = node("#document");
    const body = docRoot.appendChild(node("body"));
    const header = node("header", { rect: { left: 0, top: 0, width: 1440, height: 110 } });
    const mark = node("svg", { rect: { left: 0, top: 0, width: 28, height: 28 } });
    const markBody = node("path");
    const markEyes = node("g");
    mark.select = { ".fluid-mark-body": [markBody], ".fluid-mark-eyes": [markEyes] };
    const signoff = body.appendChild(node("a"));
    const bar = node("div");
    const select = {
        ".logo .fluid-mark": [mark],
        ".fluid-signoff": [signoff],
        "header.nav": [],
        "header": [header]
    };
    const documentElement = { clientWidth: 1440, scrollHeight: 9000, classList: classList() };

    let driver = false;
    let progressValue = 0;
    const progressListeners = [];
    const railApi = {
        bar: bar,
        value: () => progressValue,
        onProgress(fn) { progressListeners.push(fn); fn(progressValue); },
        drive(on) { driver = !!on; if (!on) bar.style.transform = "scaleX(" + progressValue.toFixed(4) + ")"; }
    };

    const observers = [];
    class IntersectionObserver {
        constructor(fn) { this.fn = fn; this.targets = []; observers.push(this); }
        observe(el) { this.targets.push(el); }
        disconnect() { this.targets.length = 0; }
    }

    const document = {
        documentElement,
        body,
        querySelector: s => (select[s] || [])[0] || null,
        querySelectorAll: s => select[s] || [],
        createElementNS: (_ns, tag) => node(tag),
        addEventListener(type, fn) { handlers[type] = fn; }
    };
    const window = {
        pageYOffset: 0,
        innerHeight: 900,
        matchMedia(query) {
            const matches = query.includes("min-width") ? wide : query.includes("reduce") ? reduced : fine;
            const m = {
                media: query, matches, listeners: [],
                addEventListener(_type, fn) { this.listeners.push(fn); }
            };
            media.push(m);
            return m;
        },
        requestAnimationFrame(fn) { frames.set(++frameId, fn); return frameId; },
        cancelAnimationFrame(id) { frames.delete(id); },
        addEventListener(type, fn) { handlers[type] = fn; },
        removeEventListener(type) { delete handlers[type]; },
        IntersectionObserver
    };
    /* matchMedia objects carry addListener in older browsers; the script uses
       addEventListener when it exists, so give it one that records the query. */
    const context = vm.createContext({ document, window, Math, Date, console });
    vm.runInContext(inkSource, context);
    if (rail) window.TocRail = railApi;
    vm.runInContext(source, context);

    function tick(now) {
        const due = [...frames.values()];
        frames.clear();
        due.forEach(fn => fn(now));
    }
    /* Run at a fixed 16.7ms step until the chain stops; returns how many frames
       it took, which is also the assertion that it does stop. */
    function run(startAt = 0, limit = 400) {
        let i = 0;
        for (; i < limit; i++) {
            if (!frames.size) break;
            tick(startAt + i * 16.7);
        }
        return i;
    }
    function scroll(y, p) {
        window.pageYOffset = y;
        progressValue = p;
        progressListeners.forEach(fn => fn(p));
    }
    /* Run at a fixed 16.7ms step until the chain stops, recording the swing
       angle of every frame: that series is what the "it swings" promise is
       actually about. */
    function runAngles(startAt = 0, limit = 600) {
        const out = [];
        for (let i = 0; i < limit; i++) {
            if (!frames.size) break;
            tick(startAt + i * 16.7);
            const b = body.children.find(c => c.attrs && c.classList.contains("fluid-read-blob"));
            const m = /rotate\(([\d.-]+)deg\)/.exec(b.style.transform || "");
            out.push(m ? Number(m[1]) : 0);
        }
        return out;
    }
    return {
        body, bar, signoff, mark, markBody, markEyes, documentElement, window, frames, handlers,
        media, observers, tick, run, runAngles, scroll,
        driving: () => driver,
        blob: () => body.children.find(c => c.attrs && c.classList.contains("fluid-read-blob")) || null
    };
}

// 1. Everything present: it attaches, takes the pen, and puts the mark on the line.
{
    const h = harness();
    const blob = h.blob();
    assert.ok(blob, "the mark is cloned onto the page");
    assert.equal(h.driving(), true, "the bar's writing is handed over");
    assert.equal(blob.style.display, "none", "it starts tucked away");

    h.scroll(700, 0.08);
    h.run();
    assert.notEqual(blob.style.display, "none", "scrolling past the header brings it out");
    const x = Number(/translate\(([\d.-]+)px/.exec(blob.style.transform)[1]);
    const scale = Number(/scaleX\(([\d.]+)\)/.exec(h.bar.style.transform)[1]);
    const tip = scale * 1440 - 14;
    assert.ok(Math.abs(x - tip) < 2, `the mark sits on the tip: x=${x} tip=${tip}`);
    assert.equal(h.frames.size, 0, "the chain stops once it has caught up");
}

// 2. The gate: any one of the three missing and nothing is added at all.
for (const off of [{ wide: false }, { fine: false }, { reduced: true }]) {
    const h = harness(off);
    assert.equal(h.blob(), null, "nothing attaches without the full gate: " + JSON.stringify(off));
    assert.equal(h.driving(), false, "and the bar is left to itself: " + JSON.stringify(off));
}
{
    const h = harness({ rail: false });
    assert.equal(h.blob(), null, "no rail, no progress bar: nothing attaches");
}

// 3. Losing the gate later (a window dragged narrow, a theme-level motion
//    preference) has to give the bar back, remove the mark and stop the chain.
{
    const h = harness();
    const blob = h.blob();
    h.scroll(700, 0.08);
    h.run();
    assert.notEqual(blob.style.display, "none", "it is out before the gate goes");

    const width = h.media.find(m => m.media.includes("min-width"));
    assert.ok(width && width.listeners.length, "the width query is watched for changes");
    width.matches = false;
    width.listeners.forEach(fn => fn());

    assert.equal(h.body.children.includes(blob), false, "the mark is taken off the page");
    assert.equal(h.driving(), false, "the bar is handed back");
    assert.equal(h.frames.size, 0, "and no frame is left pending");
    assert.ok(/scaleX/.test(h.bar.style.transform), "the bar is painted again by its owner");

    /* And it comes back if the window goes wide again. */
    width.matches = true;
    width.listeners.forEach(fn => fn());
    assert.ok(h.blob(), "it comes back with the width");
}

// 4. The end of the article: back into the line, and the signoff comes up once.
{
    const h = harness();
    const blob = h.blob();
    h.scroll(4000, 0.6);
    h.run();
    assert.notEqual(blob.style.display, "none", "it is out while reading");
    h.scroll(8300, 1);
    h.observers[0].fn([{ isIntersecting: true }]);
    h.run();
    assert.equal(h.signoff.classList.contains("fluid-signoff-risen"), true, "the signoff comes up");
    assert.equal(blob.style.display, "none", "the mark goes back into the line");
    assert.equal(h.frames.size, 0, "and the chain stops");
    h.observers[0].fn([{ isIntersecting: true }]);
    h.observers[0].fn([{ isIntersecting: false }]);
    h.observers[0].fn([{ isIntersecting: true }]);
    assert.equal(h.signoff.classList.contains("fluid-signoff-risen"), true, "still only once");
}

// 5. A hidden page stops the chain rather than leaving it running.
{
    const h = harness();
    h.scroll(700, 0.08);
    assert.ok(h.frames.size > 0, "a scroll wakes a frame");
    h.handlers.pagehide && h.handlers.pagehide();
    assert.equal(h.frames.size, 0, "pagehide stops the frame chain");
}

// 6. It hangs from the line like a basket, and a swing dies out. A long scroll
//    throws it aside; when the line stops it must not simply creep back to
//    upright (a spring would), it has to cross to the other side, come back,
//    and do so with a smaller reach every time until it hangs still.
{
    const h = harness();
    h.scroll(700, 0.08);
    h.run();
    /* A glide rather than a jump: a wheel or a trackpad arrives over a dozen
       frames, and the swing is driven by the line's acceleration, which a
       single jump has none of — it would only be a step to a new place. */
    for (let i = 1; i <= 24; i++) {
        h.scroll(700 + i * 46, 0.08 + i * 0.0018);
        h.tick(1000 + i * 16.7);
    }
    const angles = h.runAngles(1000 + 25 * 16.7);

    /* One entry per half swing: the largest reach before it crosses the middle
       again. Crossing is what separates a pendulum from a spring. */
    const peaks = [];
    let cur = 0;
    for (const a of angles) {
        if (a === 0) continue;
        if (cur === 0 || Math.sign(a) === Math.sign(cur)) {
            if (Math.abs(a) > Math.abs(cur)) cur = a;
        } else {
            peaks.push(Math.abs(cur));
            cur = a;
        }
    }
    if (cur !== 0) peaks.push(Math.abs(cur));

    assert.ok(peaks.length >= 3,
        "it swings back and forth instead of easing back: " + peaks.map(p => p.toFixed(1)).join(", "));
    assert.ok(peaks[0] > 3 && peaks[0] < 30,
        "a long scroll throws it a visible but not silly distance: " + peaks[0].toFixed(1) + "deg");

    /* The first two reaches can be nearly equal, and should be: the line is
       still decelerating while the basket passes the bottom for the first time,
       so it is still being pushed. What has to shrink is everything after the
       line has let go. */
    let grew = 0;
    for (let i = 2; i < peaks.length; i++) {
        if (peaks[i] > peaks[i - 1] * 0.92) grew++;
    }
    assert.equal(grew, 0, "once the line has let go, every swing is smaller: "
        + peaks.map(p => p.toFixed(1)).join(", "));
    assert.ok(peaks[peaks.length - 1] < peaks[0] * 0.35,
        "and it is all but gone by the last one: " + peaks[peaks.length - 1].toFixed(1) + "deg");

    assert.equal(angles[angles.length - 1], 0, "it ends up hanging straight down");
    assert.equal(h.frames.size, 0, "and the chain stops once it has");
}

console.log("reading-progress ink: gate, hand-over, tip, swing, idle stop and signoff checks passed");
