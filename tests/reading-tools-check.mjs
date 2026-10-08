/* Contract check: real controls, reversible ink, finite frames, and sheet gestures.
   node tests/reading-tools-check.mjs — layout and colour still need a browser. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../assets/js/reading-tools.js", import.meta.url), "utf8");
const inkSource = readFileSync(new URL("../assets/js/fluid-ink.js", import.meta.url), "utf8");

function harness({ ink = true, toc = true, wide = false, animate = true } = {}) {
    let clock = 0, serial = 0;
    const frames = new Map();
    const handlers = () => ({
        events: {},
        addEventListener(type, fn) { (this.events[type] ||= []).push(fn); },
        fire(type, event = {}) {
            event = { target: this, button: 0, isPrimary: true, pointerId: 1, clientY: 0, timeStamp: clock, detail: 1, ...event };
            (this.events[type] || []).forEach(fn => fn(event));
            if ((type === "click" || type === "focusin") && this.parentNode) this.parentNode.fire(type, event);
        }
    });
    class Element {
        constructor(tag) {
            Object.assign(this, handlers());
            this.tagName = tag.toUpperCase(); this.attrs = {}; this.children = [];
            this.style = { transform: "", opacity: "", filter: "", setProperty(k, v) { this[k] = v; } };
            this.hidden = false; this.inert = false; this.isConnected = true; this.scrollTop = 0;
            this.classList = {
                names: new Set(),
                add: name => this.classList.names.add(name),
                remove: name => this.classList.names.delete(name),
                contains: name => this.classList.names.has(name),
                toggle: (name, on) => on ? this.classList.names.add(name) : this.classList.names.delete(name)
            };
            if (!animate) this.animate = undefined;
        }
        set className(value) { this.classList.names = new Set(value.split(/\s+/)); }
        get className() { return [...this.classList.names].join(" "); }
        set id(value) { this.attrs.id = value; }
        get id() { return this.attrs.id; }
        setAttribute(k, v) { if (k === "class") this.className = v; else this.attrs[k] = String(v); }
        getAttribute(k) { return this.attrs[k] ?? null; }
        removeAttribute(k) { delete this.attrs[k]; }
        appendChild(child) { child.remove(); this.children.push(child); child.parentNode = this; return child; }
        insertBefore(child, before) { child.remove(); this.children.splice(this.children.indexOf(before), 0, child); child.parentNode = this; }
        remove() { if (this.parentNode?.children) this.parentNode.children = this.parentNode.children.filter(n => n !== this); this.parentNode = null; }
        get firstChild() { return this.children[0]; }
        get firstElementChild() { return this.children[0]; }
        contains(node) { return this === node || this.children.some(child => child.contains(node)); }
        matches(selector) {
            if (selector === "[id]") return !!this.id;
            if (selector === "a[href^='#']") return this.tagName === "A" && this.attrs.href?.startsWith("#");
            if (selector[0] === ".") return this.classList.contains(selector.slice(1));
            return this.tagName.toLowerCase() === selector;
        }
        querySelectorAll(selector) {
            return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
        }
        querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
        closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest?.(selector); }
        set innerHTML(html) {
            this.children = [];
            const stack = [this];
            for (const token of html.match(/<[^>]+>|[^<]+/g) || []) {
                if (token.startsWith("</")) { stack.pop(); continue; }
                if (!token.startsWith("<")) { stack.at(-1)._text = (stack.at(-1)._text || "") + token; continue; }
                const node = new Element(token.match(/^<([\w-]+)/)[1]);
                for (const [, key, value] of token.matchAll(/([\w-]+)="([^"]*)"/g)) node.setAttribute(key, value);
                stack.at(-1).appendChild(node);
                if (!token.endsWith("/>")) stack.push(node);
            }
        }
        set textContent(value) { this._text = value; }
        get textContent() { return (this._text || "") + this.children.map(c => c.textContent).join(""); }
        get href() { return this.attrs.href || ""; }
        set href(value) { this.attrs.href = value; }
        get hash() { return new URL(this.href, "http://localhost/").hash; }
        cloneNode() { const copy = new Element(this.tagName); copy.attrs = { ...this.attrs }; copy.className = this.className; copy._text = this._text; this.children.forEach(c => copy.appendChild(c.cloneNode())); return copy; }
        getBoundingClientRect() {
            const shift = Number(this.style.transform.match(/translateY\(([-.\d]+)px\)/)?.[1] || 0);
            const top = this.tagName === "DIALOG" ? 400 + shift : 0;
            return { left: 0, right: 44, top, bottom: top + 400, width: 44, height: this.tagName === "DIALOG" ? 400 : 44 };
        }
        focus() { document.activeElement = this; this.fire("focusin"); }
        showModal() { this.open = true; }
        close() { this.open = false; this.fire("close"); }
        setPointerCapture(id) { this.capture = id; }
        hasPointerCapture(id) { return this.capture === id; }
        releasePointerCapture() { this.capture = null; this.fire("lostpointercapture"); }
        animate(keys, options) {
            const animation = { keys, options, cancelled: false, cancel() { this.cancelled = true; }, finish() { if (!this.cancelled) this.onfinish?.(); } };
            this.animation = animation;
            return animation;
        }
    }
    const root = new Element("html"), body = new Element("body");
    const theme = new Element("button"), top = new Element("a"), sourceToc = new Element("div"), heading = new Element("h2");
    theme.id = "theme-toggle"; top.id = "top-link"; heading.id = "first";
    body.appendChild(theme); body.appendChild(top);
    sourceToc.innerHTML = '<ul><li><a href="#first">First chapter</a></li></ul>';
    const document = Object.assign(handlers(), {
        body, documentElement: root, hidden: false, activeElement: null,
        createElement: tag => new Element(tag), createElementNS: (_, tag) => new Element(tag),
        getElementById: id => id === "theme-toggle" ? theme : id === "top-link" ? top : id === "first" ? heading : null,
        querySelector: selector => selector === ".toc .inner" && toc ? sourceToc : null
    });
    body.parentNode = document;
    const media = Object.assign(handlers(), { matches: wide });
    const window = Object.assign(handlers(), {
        innerHeight: 800, matchMedia: () => media,
        getComputedStyle: () => ({ fontSize: "16px" }),
        requestAnimationFrame: fn => { frames.set(++serial, fn); return serial; },
        cancelAnimationFrame: id => frames.delete(id)
    });
    const context = vm.createContext({ window, document, setTimeout: () => 0, clearTimeout() {} });
    if (ink) vm.runInContext(inkSource, context);
    vm.runInContext(source, context);
    const tools = body.querySelector(".reading-tools"), toggle = tools.querySelector(".tools-toggle"), actions = tools.querySelector(".tools-actions");
    const dialog = body.querySelector("dialog"), handle = dialog?.querySelector(".outline-handle");
    function step(ms = 16) {
        clock += ms;
        const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn(clock));
    }
    function finish() { for (let i = 0; frames.size && i < 100; i++) step(); assert.equal(frames.size, 0, "frame chain must stop"); }
    function clean() {
        assert.equal(frames.size, 0);
        assert.equal(tools.classList.contains("tools-animating"), false);
        assert.equal(body.querySelectorAll("filter").filter(n => n.id?.startsWith("fluid-melt-")).length, 0);
        tools.querySelector(".tools-ink")?.querySelectorAll("path").forEach(n => assert.equal(n.getAttribute("d") || "", ""));
        actions.children.forEach(n => { assert.equal(n.style.transform, ""); assert.equal(n.firstElementChild.style.filter, ""); assert.equal(n.firstElementChild.style.opacity, ""); });
    }
    return { body, document, window, media, tools, toggle, actions, theme, dialog, handle, step, finish, clean, frames, openSheet() { toggle.fire("click"); actions.children.at(-1).firstElementChild.fire("click"); } };
}

{
    const h = harness();
    assert.equal(h.actions.children[0].firstElementChild, h.theme, "reuse the original theme control");
    h.toggle.fire("click");
    assert.equal(h.actions.inert, false, "opening must not wait for ink");
    h.step(); h.step(120);
    assert.equal(h.frames.size, 1);
    assert.ok(h.tools.querySelector(".tools-ink").querySelectorAll("path").some(n => n.getAttribute("d")), "departing ink is visible");
    h.toggle.fire("click"); h.step(16);
    assert.equal(h.actions.inert, true, "closing disables actions immediately");
    h.toggle.fire("click");
    assert.equal(h.frames.size, 1, "reversal must reuse one timeline");
    h.finish(); h.clean();
    assert.equal(h.toggle.getAttribute("aria-expanded"), "true");
    h.toggle.fire("click"); h.finish(); h.clean();
}
for (const event of ["resize", "pagehide", "pageshow", "fluid-portal-change"]) {
    const h = harness(); h.toggle.fire("click"); h.step(); h.step(100);
    h.window.fire(event); h.clean();
    assert.equal(h.toggle.getAttribute("aria-expanded"), "false");
}
{
    const h = harness(); h.toggle.fire("click"); h.step();
    h.theme.focus(); h.clean();
    assert.equal(h.toggle.getAttribute("aria-expanded"), "true", "keyboard focus settles the open menu");
    h.toggle.fire("click"); h.document.hidden = true; h.document.fire("visibilitychange"); h.clean();
}
{
    const h = harness({ ink: false, toc: false });
    h.toggle.fire("click"); assert.equal(h.actions.inert, false); assert.equal(h.frames.size, 0);
    h.document.fire("keydown", { key: "Escape" }); assert.equal(h.actions.inert, true);
}
{
    const h = harness(); h.openSheet();
    assert.equal(h.dialog.open, true);
    h.dialog.animation.finish();
    h.handle.fire("pointerdown", { clientY: 100, timeStamp: 0 });
    h.handle.fire("pointermove", { clientY: 130, timeStamp: 100 });
    h.handle.fire("pointerup", { clientY: 130, timeStamp: 200 });
    h.handle.fire("click");
    assert.equal(h.dialog.open, true, "a short drag must not close through its synthetic click");
    h.dialog.animation.finish(); assert.equal(h.dialog.style.transform, "");
    h.handle.fire("pointerdown", { clientY: 100, timeStamp: 300 });
    h.handle.fire("pointermove", { clientY: 260, timeStamp: 500 });
    h.handle.fire("pointerup", { clientY: 260, timeStamp: 600 });
    h.dialog.animation.finish();
    assert.equal(h.dialog.open, false); assert.equal(h.document.activeElement, h.toggle);
    assert.equal(h.dialog.style.transform, "");
}
{
    const h = harness(); h.openSheet(); h.dialog.animation.finish();
    h.handle.fire("pointerdown", { clientY: 100, timeStamp: 0 });
    h.handle.fire("pointermove", { clientY: 150, timeStamp: 20 });
    h.handle.fire("pointerup", { clientY: 150, timeStamp: 25 });
    h.dialog.animation.finish(); assert.equal(h.dialog.open, false, "a short flick can dismiss");
}
for (const event of ["pointercancel", "lostpointercapture"]) {
    const h = harness(); h.openSheet(); h.dialog.animation.finish();
    h.handle.fire("pointerdown", { clientY: 100 }); h.handle.fire("pointermove", { clientY: 50 });
    assert.equal(h.dialog.style.transform, "translateY(-9px)", "upward movement has resistance");
    h.handle.fire(event); assert.equal(h.dialog.style.transform, ""); assert.equal(h.dialog.open, true);
}
for (const offset of [-9, 24]) {
    const h = harness(); h.openSheet(); h.dialog.animation.finish();
    h.dialog.style.transform = `translateY(${offset}px)`;
    h.handle.fire("pointerdown", { clientY: 100, timeStamp: 100 });
    h.handle.fire("pointermove", { clientY: 100, timeStamp: 110 });
    assert.equal(h.dialog.style.transform, `translateY(${offset}px)`, "taking over a displaced sheet must not jump");
    h.handle.fire("pointercancel");
}
{
    const h = harness({ wide: true }); h.openSheet(); h.handle.fire("pointerdown", { clientY: 100 });
    h.handle.fire("pointermove", { clientY: 300 }); assert.equal(h.dialog.style.transform, "", "desktop outline is not draggable");
}
for (const event of ["resize", "pagehide", "hidden", "native-close"]) {
    const h = harness(); h.openSheet(); h.finish(); h.dialog.animation.finish();
    h.handle.fire("pointerdown", { clientY: 100 }); h.handle.fire("pointermove", { clientY: 150 });
    if (event === "hidden") { h.document.hidden = true; h.document.fire("visibilitychange"); }
    else if (event === "native-close") h.dialog.close();
    else h.window.fire(event);
    assert.equal(h.dialog.style.transform, "");
    assert.equal(h.handle.hasPointerCapture(1), false);
    assert.equal(h.dialog.classList.contains("is-dragging"), false);
    assert.equal(h.dialog.open, event === "resize");
    h.clean();
}
{
    const h = harness({ animate: false }); h.openSheet();
    h.handle.fire("pointerdown", { clientY: 100 }); h.handle.fire("pointermove", { clientY: 300 }); h.handle.fire("pointerup");
    assert.equal(h.dialog.open, false, "missing animation capability still closes");
}
console.log("ok reading tools: ink reversal, cleanup, keyboard, fallback, sheet gestures and focus");
