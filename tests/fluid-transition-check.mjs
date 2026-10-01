import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const js = name => readFileSync(join(here, "..", "assets", "js", name), "utf8");
const source = js("fluid-transition.js");
const inkSource = js("fluid-ink.js");
const ENTER = +source.match(/ENTER = (\d+)/)[1];
const RECALL = +source.match(/RECALL = (\d+)/)[1];

/* A tiny DOM: a real parent/child tree, so "left nothing behind" means every
   node the scene created is detached again. rAF is a manual clock. */
function harness({ path = "/", hash = "", reduced = true, wide = true, fine = true, ink = true } = {}) {
    const classes = new Set();
    const handlers = {};
    const created = [];
    const frames = new Map();
    const shapes = [];
    let writes = 0;
    let frameId = 0;
    let docRoot = null;

    function node(tag, extra = {}) {
        const n = {
            tagName: tag, style: {}, attrs: {}, children: [], parentNode: null, hidden: false,
            computed: {}, rect: { left: 0, top: 0, width: 0, height: 0 }, handlers: {}, select: {},
            setAttribute(k, v) { writes++; this.attrs[k] = String(v); },
            getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
            appendChild(c) { return this.insertBefore(c, null); },
            insertBefore(c, ref) {
                if (c.parentNode) c.remove();
                const i = ref ? this.children.indexOf(ref) : -1;
                if (i < 0) this.children.push(c);
                else this.children.splice(i, 0, c);
                c.parentNode = this;
                return c;
            },
            remove() {
                if (!this.parentNode) return;
                const siblings = this.parentNode.children;
                siblings.splice(siblings.indexOf(this), 1);
                this.parentNode = null;
            },
            get firstChild() { return this.children[0] || null; },
            get nextSibling() {
                const siblings = this.parentNode ? this.parentNode.children : [];
                return siblings[siblings.indexOf(this) + 1] || null;
            },
            get isConnected() {
                let p = this;
                while (p.parentNode) p = p.parentNode;
                return p === docRoot;
            },
            cloneNode() {
                const c = node(tag);
                c.attrs = { ...this.attrs };
                created.push(c);
                return c;
            },
            getBoundingClientRect() {
                const r = this.rect;
                return { ...r, right: r.left + r.width, bottom: r.top + r.height };
            },
            addEventListener(type, fn) { this.handlers[type] = fn; },
            focus() { this.focused = true; },
            querySelector(s) { return (this.select[s] || [])[0] || null; },
            querySelectorAll(s) { return this.select[s] || []; }
        };
        return Object.assign(n, extra);
    }

    docRoot = node("#document");
    const body = docRoot.appendChild(node("body"));
    const main = body.appendChild(node("main"));
    const home = main.appendChild(node("div"));
    const orb = home.appendChild(node("div", { rect: { left: 100, top: 100, width: 300, height: 250 } }));
    const svg = orb.appendChild(node("svg", { getScreenCTM: () => ({ a: 0.6, b: 0, c: 0, d: 0.6, e: 100, f: 100 }) }));
    const defs = svg.appendChild(node("defs"));
    const goo = defs.appendChild(node("filter"));
    const budLayer = svg.appendChild(node("g"));
    const formLayer = svg.appendChild(node("g"));
    const eyes = [node("g"), node("g")];
    svg.select = { "#fluid-ip-goo": [goo] };
    orb.select = { svg: [svg], ".fluid-ip-echoes": [budLayer], ".fluid-ip-forms": [formLayer], ".fluid-ip-eye": eyes };
    const portal = node("div", { computed: { backgroundColor: "rgb(245, 245, 245)" } });
    const text = (left, top, width, height, fontSize) =>
        main.appendChild(node("div", { rect: { left, top, width, height }, computed: { fontSize } }));
    const control = (left, top) =>
        body.appendChild(node("button", { rect: { left, top, width: 40, height: 40 }, computed: { backgroundColor: "rgb(214, 214, 214)" } }));
    const title = text(80, 120, 360, 40, "32px");
    const intro = text(80, 170, 380, 22, "16px");
    const social = text(80, 205, 120, 30, "16px");
    const homeLink = text(20, 10, 90, 30, "24px");
    const toggle = control(1300, 620);
    const top = control(1300, 670);
    const menu = main.appendChild(node("ul"));
    const targets = [title, intro, social, homeLink, toggle, top];
    const select = {
        ".logo > a": [homeLink],
        ".fluid-ip-home-info > .entry-header": [title],
        ".fluid-ip-home-info > .entry-content": [intro],
        ".fluid-ip-home-info .social-icons": [social],
        "#theme-toggle, #top-link": [toggle, top],
        "#menu, .main > :not(.home-info), .footer": [menu]
    };
    const root = {
        classList: {
            add(name) { classes.add(name); },
            remove(name) { classes.delete(name); },
            contains(name) { return classes.has(name); }
        }
    };
    const document = {
        currentScript: { getAttribute: () => "/" },
        documentElement: root,
        body,
        hidden: false,
        getElementById(id) {
            return { "fluid-portal": portal, "fluid-ip-orb": orb, main, "theme-toggle": toggle, "top-link": top }[id];
        },
        querySelector: s => (select[s] || [])[0] || null,
        querySelectorAll: s => select[s] || [],
        createElement: tag => node(tag, { rect: { left: 500, top: 200, width: 150, height: 125 } }),
        createElementNS(_ns, tag) {
            const n = node(tag);
            created.push(n);
            return n;
        },
        createRange: () => ({}),
        createTreeWalker: () => ({ nextNode: () => null }),
        addEventListener(type, fn) { handlers[type] = fn; }
    };
    const window = {
        location: { pathname: path, hash },
        matchMedia: query => ({ matches: query.includes("reduce") ? reduced : query.includes("min-width") ? wide : fine }),
        innerHeight: 720,
        getComputedStyle: el => ({ color: "rgb(30, 30, 30)", backgroundColor: "rgba(0, 0, 0, 0)", fontSize: "16px", ...el.computed }),
        scrollTo() {},
        dispatchEvent() {},
        addEventListener(type, fn) { handlers[type] = fn; },
        requestAnimationFrame(fn) { frames.set(++frameId, fn); return frameId; },
        cancelAnimationFrame(id) { frames.delete(id); },
        history: { pushState(_state, _unused, value) { window.location.hash = value.startsWith("#") ? value : ""; } }
    };
    const context = vm.createContext({ document, window, requestAnimationFrame: fn => window.requestAnimationFrame(fn), Event: class Event {}, NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4 } });
    if (ink) vm.runInContext(inkSource, context);
    if (ink) {
        const blob = window.FluidInk.blob;
        window.FluidInk.blob = (...args) => { shapes.push(args.slice(0, 5)); return blob(...args); };
    }
    vm.runInContext(source, context);
    function tick(now) {
        shapes.length = 0;
        const due = [...frames.values()];
        frames.clear();
        due.forEach(fn => fn(now));
    }
    return { root, orb, portal, home, main, menu, budLayer, window, document, handlers, eyes, targets, homeLink, created, frames, tick, shapes, writes: () => writes };
}

// Everything a scene touched is back as it was, and no frame is pending.
function assertClean(h) {
    assert.equal(h.frames.size, 0);
    assert.equal(h.root.classList.contains("fluid-composing"), false);
    assert.equal(h.orb.style.transform, "");
    assert.equal(h.portal.style.backgroundColor, "");
    for (const n of [...h.targets, h.menu]) {
        assert.ok(!n.style.opacity && !n.style.filter);
    }
    assert.deepEqual(h.created.filter(n => n.isConnected).map(n => n.tagName), []);
    assert.equal(h.eyes[0].style.transform, "translate(0px,0px)");
}

// What the reader sees at this instant; melt ids differ per run, so only
// whether a melt is applied and its parameters count.
function snap(h) {
    const live = tag => h.created.filter(n => n.tagName === tag && n.isConnected);
    return JSON.stringify([
        h.orb.style.transform, h.portal.style.backgroundColor, h.menu.style.opacity, h.eyes[0].style.transform,
        h.targets.map(t => [t.style.opacity, !!t.style.filter]),
        live("feGaussianBlur").map(n => n.attrs.stdDeviation), live("feMorphology").map(n => n.attrs.radius),
        live("path").map(p => [p.parentNode === h.budLayer, p.attrs.d, p.attrs["fill-opacity"], p.style.fill])
    ]);
}

{
    const h = harness();
    assert.equal(h.root.classList.contains("fluid-portal-active"), true);
    h.handlers.DOMContentLoaded();
    assert.equal(h.orb.parentNode, h.portal);
    assert.equal(h.main.inert, true);
    h.orb.handlers.click();
    assert.equal(h.window.location.hash, "#articles");
    assert.equal(h.orb.parentNode, h.home);
    assert.equal(h.main.inert, false);
    assert.equal(h.main.focused, true);
    h.window.location.hash = "";
    h.handlers.popstate();
    assert.equal(h.orb.parentNode, h.portal);
}

for (const hash of ["#articles", "#main"]) {
    const h = harness({ hash });
    h.handlers.DOMContentLoaded();
    assert.equal(h.orb.parentNode, h.home);
    assert.equal(h.main.inert, false);
}

{
    const h = harness({ reduced: false });
    h.handlers.DOMContentLoaded();
    h.handlers.pointermove({ clientX: 700, clientY: 300 });
    h.tick(0);
    assert.equal(h.eyes[0].style.transform, h.eyes[1].style.transform);
    assert.match(h.eyes[0].style.transform, /translate\(10\.0px,2\.4px\)/);
}

{
    const h = harness({ path: "/posts/juc-3/" });
    assert.equal(h.handlers.DOMContentLoaded, undefined);
    assert.equal(h.root.classList.contains("fluid-portal-active"), false);
}
console.log("fluid entrance checks passed");

{
    const h = harness({ reduced: false });
    h.handlers.DOMContentLoaded();
    h.orb.handlers.click();
    assert.equal(h.root.classList.contains("fluid-composing"), true);
    assert.equal(h.frames.size, 1);
    const enter = {};
    for (const ms of [0, ENTER / 4, ENTER / 2, ENTER * 3 / 4]) {
        h.tick(ms);
        enter[ms / ENTER] = snap(h);
        if (ms === ENTER / 2) {
            assert.ok(h.targets.every(t => t.style.filter), "every target waits as melted ink");
            assert.ok(h.created.some(n => n.tagName === "path" && n.isConnected && n.attrs.d), "echoes are in flight");
            assert.ok(+h.menu.style.opacity > 0 && +h.menu.style.opacity < 1, "reading content fades in");
        }
    }
    h.orb.handlers.click();
    assert.equal(h.frames.size, 1, "a second click does not start another scene");
    h.tick(ENTER);
    assertClean(h);
    assert.equal(h.window.location.hash, "#articles");
    assert.equal(h.orb.parentNode, h.home);
    assert.equal(h.main.inert, false);
    assert.equal(h.main.focused, true);

    let prevented = false;
    h.homeLink.handlers.click({ button: 0, ctrlKey: true, preventDefault() { prevented = true; } });
    assert.equal(prevented, false);
    assert.equal(h.frames.size, 0);
    h.homeLink.handlers.click({ button: 0, preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(h.orb.parentNode, h.portal);
    const recall = {};
    for (const ms of [0, RECALL / 4, RECALL / 2, RECALL * 3 / 4]) {
        h.tick(10000 + ms);
        recall[1 - ms / RECALL] = snap(h);
    }
    for (const k of [0.25, 0.5, 0.75]) assert.equal(recall[k], enter[k], "recall is the entrance run backwards at t=" + k);
    h.document.hidden = true;
    h.handlers.visibilitychange();
    assertClean(h);
    assert.equal(h.window.location.hash, "");
    assert.equal(h.orb.parentNode, h.portal);
    assert.equal(h.orb.focused, true);
}

{
    const h = harness({ reduced: false });
    h.handlers.DOMContentLoaded();
    h.orb.handlers.click();
    h.tick(0);
    h.tick(ENTER * 0.4);
    h.handlers.resize();
    assertClean(h);
    assert.equal(h.window.location.hash, "#articles");
    assert.equal(h.main.inert, false);
}

{
    const h = harness({ reduced: false });
    h.handlers.DOMContentLoaded();
    h.orb.handlers.click();
    h.tick(0);
    h.tick(ENTER * 0.3);
    h.window.location.hash = "#articles";
    h.handlers.popstate();
    assertClean(h);
    assert.equal(h.main.inert, false);
    assert.equal(h.orb.parentNode, h.home);
}
console.log("one-clock entrance, reversed recall, modifiers and interruption checks passed");

for (const options of [{ wide: false }, { fine: false }, { reduced: true }, { ink: false }]) {
    const h = harness({ reduced: false, ...options });
    h.handlers.DOMContentLoaded();
    h.orb.handlers.click();
    assert.equal(h.frames.size, 0);
    assert.equal(h.created.length, 0);
    assert.equal(h.window.location.hash, "#articles");
    assert.equal(h.main.inert, false);
}
console.log("narrow, touch, reduced-motion and no-ink entrances remain operable without animation");

// Motion continuity: a release must not halt; a landed band starts spreading
// at zero speed instead of jumping to its full expansion velocity.
{
    const h = harness({ reduced: false });
    h.handlers.DOMContentLoaded();
    h.orb.handlers.click();
    h.tick(0);
    function sample(t) { h.tick(t * ENTER); return h.shapes[0].slice(); }
    const before = sample(0.1399);
    const release = sample(0.14);
    const after = sample(0.1401);
    const incoming = [release[0] - before[0], release[1] - before[1]];
    const outgoing = [after[0] - release[0], after[1] - release[1]];
    const change = Math.hypot(outgoing[0] - incoming[0], outgoing[1] - incoming[1]);
    assert.ok(change < Math.hypot(...incoming) * 0.15, "release retains body velocity");
    const landed = sample(0.52);
    const spreading = sample(0.5201);
    assert.ok(Math.abs(spreading[2] - landed[2]) < 0.01, "band starts spreading gently");
    const writes = h.writes();
    sample(0.5201);
    assert.equal(h.writes(), writes, "unchanged geometry does not invalidate SVG attributes again");
    h.handlers.resize();
    assertClean(h);
}
console.log("release velocity, soft landing and unchanged-attribute checks passed");
