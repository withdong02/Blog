/* Scenario E (clipboard ink) — see docs/design/fluid-ink.md.
 *
 * Same shape as the other check scripts: a fake DOM, a hand-driven clock, and
 * only what this scenario promises is checked. The gate, that the theme's own
 * button is observed rather than replaced, that the first paint after the word
 * changed already shows ink, that a hidden button is skipped (the ordinary
 * case, not an edge case), that the melt is cleaned off afterwards, and that
 * losing the gate puts the theme's behaviour back exactly as it was.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const js = name => readFileSync(join(here, "..", "..", "assets", "js", name), "utf8");
const inkSource = js("fluid-ink.js");
const source = js("fluid-copy.js");

const VISIBLE = { left: 0, top: 0, width: 52, height: 20 };

function harness({ wide = true, fine = true, reduced = false, buttons = ["copy"] } = {}) {
    const media = [];
    const frames = new Map();
    const handlers = {};
    const observers = [];
    const melts = [];          /* every melt handed out, in order */
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
            tagName: tag, nodeType: 1, style: {}, attrs: {}, children: [], parentNode: null,
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
    const buttonsOf = [];

    function addButton(text) {
        const btn = body.appendChild(node("button", { rect: { ...VISIBLE } }));
        btn.textContent = text;
        btn.classList.add("copy-code");
        buttonsOf.push(btn);
        /* Anything watching the body for late arrivals gets told, exactly as a
           MutationObserver would. */
        observers.filter(o => o.watches(body)).forEach(o => o.fire([{ addedNodes: [btn] }]));
        return btn;
    }
    buttons.forEach(addButton);

    const documentElement = { clientWidth: 1440, scrollHeight: 9000, classList: classList() };

    class MutationObserver {
        constructor(fn) { this.fn = fn; this.watched = []; this.disconnected = false; observers.push(this); }
        observe(target, options) { this.watched.push({ target, options: options || {} }); }
        disconnect() { this.disconnected = true; this.watched.length = 0; }
        watches(node) { return this.watched.some(w => w.target === node); }
        fires(target) { return this.watched.some(w => w.target === target); }
        fire(records) { if (!this.disconnected) this.fn(records, this); }
    }

    const document = {
        documentElement,
        body,
        querySelector: s => body.children.filter(c => c.classList.contains(String(s).replace(".", "")))[0] || null,
        querySelectorAll: s => s === ".copy-code" ? body.children.filter(c => c.classList.contains("copy-code")) : [],
        createElementNS: (_ns, tag) => node(tag),
        addEventListener(type, fn) { handlers[type] = fn; }
    };
    const window = {
        pageYOffset: 0,
        innerHeight: 900,
        getComputedStyle() { return { fontSize: "14px" }; },
        matchMedia(query) {
            const matches = query.includes("min-width") ? wide : query.includes("reduce") ? reduced : fine;
            const m = { media: query, matches, listeners: [], addEventListener(_t, fn) { this.listeners.push(fn); } };
            media.push(m);
            return m;
        },
        requestAnimationFrame(fn) { frames.set(++frameId, fn); return frameId; },
        cancelAnimationFrame(id) { frames.delete(id); },
        addEventListener(type, fn) { handlers[type] = fn; },
        removeEventListener(type) { delete handlers[type]; },
        MutationObserver
    };
    const context = vm.createContext({ document, window, Math, Date, console, MutationObserver });
    vm.runInContext(inkSource, context);
    /* Record every melt and every value written through it: the promise is
       about what gets written to the element, and when. */
    const realMelt = context.window.FluidInk.melt;
    context.window.FluidInk.melt = function (el, options) {
        const out = realMelt(el, options);
        const set = out.set;
        const drop = out.remove;
        const record = { el, values: [], removed: false };
        out.set = m => { set(m); record.values.push(m); };
        out.remove = () => { drop(); record.removed = true; };
        melts.push(record);
        return out;
    };
    vm.runInContext(source, context);

    /* Change the word the way the theme does, then let the observers run in the
       microtask position they really occupy. */
    function say(btn, text) {
        btn.textContent = text;
        observers.filter(o => o.fires(btn)).forEach(o => o.fire([{ target: btn, addedNodes: [], removedNodes: [] }]));
    }
    function hide(btn) { btn.rect = { left: 0, top: 0, width: 0, height: 0 }; }
    function show(btn) { btn.rect = { ...VISIBLE }; }

    function tick(now) {
        const due = [...frames.values()];
        frames.clear();
        due.forEach(fn => fn(now));
    }
    function run(startAt = 0, limit = 400) {
        let i = 0;
        for (; i < limit; i++) {
            if (!frames.size) break;
            tick(startAt + i * 16.7);
        }
        return i;
    }
    function flip() {
        media.forEach(m => { m.matches = !m.matches; });
        media.forEach(m => m.listeners.forEach(fn => fn(m)));
    }

    return { body, documentElement, window, frames, handlers, media, observers, melts,
        tick, run, say, hide, show, flip, addButton, buttons: buttonsOf,
        lastMelt: () => melts[melts.length - 1] || null };
}

// 1. All conditions met: every copy button is watched, none is replaced.
{
    const h = harness({ buttons: ["copy", "copy"] });
    const [a, b] = h.buttons;
    assert.equal(h.body.children.filter(c => c.tagName === "button").length, 2,
        "the theme's buttons are still the theme's buttons");
    assert.ok(h.observers.some(o => o.fires(a)), "the first button is observed");
    assert.ok(h.observers.some(o => o.fires(b)), "the second button is observed");
    assert.equal(h.melts.length, 0, "nothing melts before anything happens");
}

// 2. The word changes: ink is written before anyone could paint the new word.
{
    const h = harness();
    const btn = h.buttons[0];
    h.say(btn, "copied!");
    const inked = h.lastMelt();
    assert.ok(inked, "changing the word melts it");
    assert.equal(h.frames.size > 0, true, "the melt animates on its own clock");
    /* The point of doing it in the observer callback rather than on the next
       frame: the element is already molten now, with no frame having run. */
    assert.ok(/^url\(#/.test(btn.style.filter || ""),
        `ink is on the element before the first frame was drawn: ${btn.style.filter}`);
    assert.ok(inked.values[0] < 0.2, `it starts molten: ${inked.values[0]}`);
}

// 3. It resolves, clears itself off and stops — nothing left running or applied.
{
    const h = harness();
    const btn = h.buttons[0];
    h.say(btn, "copied!");
    const frames = h.run();
    assert.ok(frames > 10, `the melt ran over several frames: ${frames}`);
    assert.ok(frames < 45, `it is over in about 400ms: ${frames} frames`);
    assert.equal(btn.style.filter, "", "no filter is left on the button");
    assert.equal(h.lastMelt().removed, true, "the temporary filter node is removed");
    assert.equal(h.frames.size, 0, "the frame chain stopped");
    const values = h.lastMelt().values;
    assert.equal(values[values.length - 1], 1, `it ends legible: ${values[values.length - 1]}`);
    let rose = 0;
    for (let i = 1; i < values.length; i++) if (values[i] < values[i - 1]) rose++;
    assert.equal(rose, 0, "it only ever resolves towards legible: " + values.join(","));
}

// 4. The ordinary case: the second change arrives with the button hidden.
{
    const h = harness();
    const btn = h.buttons[0];
    h.hide(btn);
    h.say(btn, "copy");
    assert.equal(h.melts.length, 0, "a hidden button is left alone");
    assert.equal(btn.style.filter, undefined, "nothing was applied to it");
    assert.equal(h.frames.size, 0, "and nothing started running");

    h.show(btn);
    h.say(btn, "copied!");
    assert.equal(h.melts.length, 1, "the same button melts once it is visible again");
    h.run();
    assert.equal(btn.style.filter, "", "and clears itself afterwards");
}

// 5. Clicking twice writes the same word twice: no second melt, no overlap.
{
    const h = harness();
    const btn = h.buttons[0];
    h.say(btn, "copied!");
    const first = h.lastMelt();
    h.run();
    h.say(btn, "copied!");
    assert.equal(h.melts.length, 1, "the same word is not melted again");

    /* Interrupted mid-melt: only one instance survives, and it is the new one. */
    h.say(btn, "copy");
    h.say(btn, "copied!");
    const second = h.lastMelt();
    assert.equal(h.melts.length, 3, "a real change while molten melts again");
    assert.equal(first.removed, true, "the interrupted melt is cleaned up first");
    assert.notEqual(second, first, "and a fresh instance takes over");
    assert.equal(h.frames.size > 0, true, "the new one animates");
}

// 6. A button created after the script ran is still picked up.
{
    const h = harness({ buttons: [] });
    h.say && null;
    const late = h.addButton("copy");
    assert.ok(h.observers.some(o => o.fires(late)), "the late button is observed from the body watcher");
    h.say(late, "copied!");
    assert.equal(h.melts.length, 1, "and melts like any other");
}

// 7. Losing the gate puts the theme's behaviour back exactly as it was.
{
    const h = harness();
    const btn = h.buttons[0];
    h.say(btn, "copied!");
    h.run();
    assert.equal(btn.style.filter, "", "clean before losing the gate");

    h.say(btn, "copy");
    h.flip();                       /* width, pointer and motion all invert */
    const running = h.lastMelt();
    assert.equal(running.removed, true, "a melt in flight is cleaned off");
    assert.equal(btn.style.filter, "", "the button is left bare");
    assert.equal(h.frames.size, 0, "nothing is still running");

    /* And it genuinely stopped listening: further word changes do nothing. */
    const before = h.melts.length;
    h.say(btn, "copied!");
    h.say(btn, "copy");
    assert.equal(h.melts.length, before, "word changes no longer melt anything");
    assert.equal(h.frames.size, 0, "and no frame chain starts");
}

// 8. Not allowed in the first place: narrow screen, coarse pointer, reduced motion.
for (const denied of [{ fine: false }, { wide: false }, { reduced: true }]) {
    const h = harness(denied);
    const btn = h.buttons[0];
    h.say(btn, "copied!");
    assert.equal(h.melts.length, 0, `nothing melts with ${JSON.stringify(denied)}`);
    assert.equal(h.frames.size, 0, "and nothing runs");
    assert.equal(btn.style.filter, undefined, "the button is untouched");
    assert.equal(h.observers.filter(o => o.fires(btn)).length, 0, "it was never observed");
}

console.log("clipboard ink: gate, observed-not-replaced, same-frame ink, hidden skip, cleanup and hand-back checks passed");
