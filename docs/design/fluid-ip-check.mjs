/*
 * Minimal runnable check for the home-page fluid avatar behaviour
 * (assets/js/fluid-ip.js — see docs/design/fluid-ip.md, section 4).
 *
 *   node docs/design/fluid-ip-check.mjs
 *
 * It is not a test framework and does not try to be one: the script is loaded
 * into a fake DOM with a hand-driven clock, and only the four things the
 * animation contract promises are checked — the gate, the form beat, cleanup
 * after an ending or interruption, and no second loop from repeated clicks.
 *
 * Colours, layout and the SVG outline are not covered here: those are CSS and
 * markup, checked in a browser, not by a script.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "..", "..", "assets", "js", "fluid-ip.js"), "utf8");

const TOTAL = 9000 + 2 * 320; /* DURATION + (echoes - 1) * STAGGER */

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

    const echoes = [];
    const forms = [];
    const attrs = { "aria-label": "static", "data-label-action": "action" };
    const orbHandlers = {};
    const docHandlers = {};
    const queued = new Map();
    let nextHandle = 1;
    let clock = 1000;
    let framesRun = 0;

    const orb = {
        disabled: true,
        isConnected: true,
        querySelector: (selector) => (selector === ".fluid-ip-echoes" ? echoLayer
            : selector === ".fluid-ip-forms" ? formLayer : selector === "defs" ? { appendChild() {} } : null),
        addEventListener(type, fn) { (orbHandlers[type] || (orbHandlers[type] = [])).push(fn); },
        getAttribute: (name) => (name in attrs ? attrs[name] : null),
        setAttribute(name, value) { attrs[name] = value; }
    };
    const echoLayer = { appendChild: (node) => echoes.push(node) };
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
                setAttribute(name, value) { this.attrs[name] = value; if (name === "d") this.d = value; }
            };
        },
        addEventListener(type, fn) { (docHandlers[type] || (docHandlers[type] = [])).push(fn); }
    };

    const window = {
        matchMedia: mediaQuery,
        addEventListener() {},
        requestAnimationFrame(fn) { const handle = nextHandle++; queued.set(handle, fn); return handle; },
        cancelAnimationFrame(handle) { queued.delete(handle); }
    };

    /* One queued frame, in scheduling order, at a 16ms step. */
    function step() {
        const first = queued.entries().next();
        if (first.done) return false;
        queued.delete(first.value[0]);
        clock += 16;
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
        const handlers = target === "document" ? docHandlers[type] : orbHandlers[type];
        (handlers || []).forEach((fn) => fn({ type }));
    }

    vm.runInContext(source, vm.createContext({ window, document }), { filename: "fluid-ip.js" });

    return {
        orb, attrs, echoes, forms, media: mediaQuery, document,
        click: () => fire("click", "orb"),
        hide: () => { document.hidden = true; fire("visibilitychange", "document"); },
        step, runFor,
        pending: () => queued.size,
        framesRun: () => framesRun,
        echoGeometry: () => echoes.map((node) => node.d),
        allCleared: () => echoes.every((node) => node.d === "")
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
    ["coarse pointer", { fine: false }],
    ["reduced motion", { reduced: true }]
]) {
    const h = makeHarness(options);
    h.click();
    check(`gate off (${name}): disabled, static label, click does nothing`,
        h.orb.disabled === true && h.attrs["aria-label"] === "static" && h.pending() === 0,
        `disabled=${h.orb.disabled} label=${h.attrs["aria-label"]} pending=${h.pending()}`);
}

/* 2. A normal run ends clean: echoes cleared, no frame left scheduled. */
{
    const h = makeHarness();
    h.click();
    h.runFor(5000);
    check("middle beat: forms visibly replace detached echoes",
        h.forms.some((node) => Number(node.attrs.opacity) > 0.5)
            && h.echoes.some((node) => node.d === ""));
    h.runFor(TOTAL);
    check("ends clean: every echo path cleared",
        h.allCleared(), JSON.stringify(h.echoGeometry()));
    check("ends clean: nothing left scheduled", h.pending() === 0, `pending=${h.pending()}`);
    check("ends clean: echoes did animate on the way",
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
        `animating=${animating} geometry=${JSON.stringify(h.echoGeometry())} pending=${h.pending()}`);
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
        `geometry=${JSON.stringify(h.echoGeometry())} pending=${h.pending()}`);
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

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
