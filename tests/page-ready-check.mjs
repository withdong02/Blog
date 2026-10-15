import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../assets/js/page-ready.js', import.meta.url), 'utf8');
const pending = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function setup({ fonts = true, frames = true, portal = false, images = [] } = {}) {
    const classes = new Set(portal ? ['fluid-portal-active'] : []), events = {}, timers = new Map(), queue = new Map();
    const font = pending();
    const loader = { hidden: false };
    let serial = 0;
    const nodes = [{ id: 'main', inert: false }, { id: 'fluid-portal', inert: false }, { id: 'existing-lock', inert: true }];
    const document = {
        hidden: false,
        documentElement: { classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) } },
        fonts: fonts ? { ready: font.promise } : null,
        getElementById: () => loader,
        querySelectorAll: selector => selector === 'img' ? images : nodes,
        addEventListener: (name, fn) => { events[name] = fn; }
    };
    const window = {
        innerHeight: 800,
        setTimeout: (fn, delay) => { assert.equal(delay, 3500); timers.set(++serial, fn); return serial; },
        clearTimeout: id => timers.delete(id),
        cancelAnimationFrame: id => queue.delete(id),
        addEventListener: (name, fn) => { events[name] = fn; }
    };
    if (frames) window.requestAnimationFrame = fn => { queue.set(++serial, fn); return serial; };
    vm.runInNewContext(source, { document, window, Promise });
    const tick = async () => { const due = [...queue.values()]; queue.clear(); due.forEach(fn => fn()); await flush(); };
    return { document, window, classes, events, timers, queue, nodes, loader, font, tick };
}
function released(h, portal = false) {
    assert.equal(h.classes.has('echo-loading'), false);
    assert.equal(h.window.EchoReady.done, true);
    assert.equal(h.loader.hidden, true);
    assert.equal(h.nodes[0].inert, portal);
    assert.equal(h.nodes[1].inert, false, 'the portal becomes operable when loading ends');
    assert.equal(h.nodes[2].inert, true, 'existing interaction locks remain');
    assert.equal(h.timers.size + h.queue.size, 0, 'no pending gate clock');
}
for (const portal of [false, true]) {
    const h = setup({ portal });
    let prepared = 0;
    h.window.EchoReady.prepare = () => { prepared++; };
    h.events.DOMContentLoaded();
    assert.equal(h.nodes[0].inert, true);
    await flush();
    assert.equal(h.queue.size, 0, 'fonts have not settled');
    h.font.resolve(); await flush();
    await h.tick(); assert.equal(h.window.EchoReady.done, false);
    await h.tick(); released(h, portal);
    assert.equal(prepared, 1, 'prepare once after layout and two paints');
}
{
    const image = pending(), calls = [];
    const h = setup({ fonts: false, images: [
        { getBoundingClientRect: () => ({ width: 100, top: 100, bottom: 200 }), decode: () => { calls.push('visible'); return image.promise; } },
        { getBoundingClientRect: () => ({ width: 100, top: 1000, bottom: 1100 }), decode: () => { throw Error('offscreen image must not be awaited'); } }
    ] });
    h.events.DOMContentLoaded(); await flush();
    assert.equal(h.queue.size, 0, 'visible image must decode before revealing');
    image.reject(Error('broken image')); await flush(); await h.tick(); await h.tick();
    released(h); assert.deepEqual(calls, ['visible']);
}
for (const event of ['timeout', 'pagehide', 'visibilitychange', 'pageshow', 'pagereveal']) {
    const h = setup(); h.events.DOMContentLoaded();
    let canceled = 0;
    h.window.EchoReady.cancelPrepare = () => { canceled++; };
    if (event === 'timeout') [...h.timers.values()][0]();
    else {
        if (event === 'visibilitychange') h.document.hidden = true;
        h.events[event]({ persisted: true, viewTransition: {} });
    }
    released(h);
    assert.equal(canceled, 1, 'an interrupted gate clears the prepared scene');
    h.font.resolve(); await flush();
    assert.equal(h.queue.size, 0, 'late resources cannot relock the page');
}
{
    const h = setup({ fonts: false, frames: false }); h.events.DOMContentLoaded(); await flush(); released(h);
}
{
    const h = setup({ fonts: false }); h.events.DOMContentLoaded(); await flush();
    assert.equal(h.queue.size, 1); h.events.pagehide(); released(h);
}
{
    const h = setup({ fonts: false, frames: false });
    h.window.EchoReady.prepare = () => Promise.reject(Error('unavailable animation'));
    h.events.DOMContentLoaded(); await flush(); released(h);
}
for (const file of ['index.html', 'posts/juc-1/index.html', 'taxonomies/index.html']) {
    const html = readFileSync(new URL('../public/' + file, import.meta.url), 'utf8');
    assert.match(html, /\/js\/page-ready\./, `${file}: shared early gate`);
    assert.match(html, /id=echo-loader class=echo-loader role=status/, `${file}: accessible shared loader`);
    const loaderMarkup = html.match(/<div id=echo-loader\b[^>]*>([\s\S]*?)<\/div>/)[1];
    assert.match(loaderMarkup, /class=loading-27 aria-hidden=true/, 'shared CSS rings replace the SVG morph');
    assert.doesNotMatch(loaderMarkup, /<svg|<animate|正在铺好/, 'loader has no SVG clock or visible text');
    assert.match(html, /class=logo[\s\S]*?class="?fluid-mark\b/, `${file}: navigation uses the shared Echo`);
}
const css = readFileSync(new URL('../assets/css/extended/page-ready.css', import.meta.url), 'utf8');
assert.match(css, /\.echo-loader\s*\{\s*display:\s*none/, 'no JS leaves the document readable');
assert.match(css, /animation:\s*loading-27 2s infinite linear/, 'outer ring uses the supplied rotation');
assert.match(css, /animation-duration:\s*3s/, 'inner rings retain their supplied duration');
assert.match(css, /--s:\s*-1/, 'the last ring rotates in reverse');
assert.match(css, /color:\s*#000/, 'light theme uses black');
assert.match(css, /data-theme="dark"[^\n]*color:\s*#fff/, 'dark theme uses white');
assert.doesNotMatch(source, /beginElement|pauseAnimations/, 'readiness no longer manages a separate SVG clock');
console.log('Page ready checks passed: readiness, decoding, failures, deadlines, locks, BFCache, View Transition and no-JS fallback');
