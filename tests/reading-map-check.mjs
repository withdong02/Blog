import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../assets/js/reading-map.js', import.meta.url), 'utf8');
function setup({ capable = true, narrow = false, portal = false } = {}) {
  const handlers = {}, frames = new Map(), flights = [];
  let nextFrame = 0, computedDistance = '0px';
  function node() {
    const classes = new Set();
    return {
      style: {}, hidden: false, handlers: {}, attributes: {},
      classList: { add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value) },
      addEventListener(name, fn) { this.handlers[name] = fn; },
      setAttribute(name, value) { this.attributes[name] = value; },
      getTotalLength() { return Number(this.attributes.d.split(' ').at(-1)); }
    };
  }
  const root = node(), landscape = node(), route = node(), trail = node(), guide = node();
  if (portal) root.classList.add('fluid-portal-active');
  landscape.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800 });
  const cards = [0, 1, 2].map(i => {
    const card = node();
    card.getBoundingClientRect = () => ({ left: i % 2 ? 556 : 0, right: i % 2 ? 1000 : 444, top: i * 160 });
    return card;
  });
  const elements = { '.echo-atlas-landscape': landscape,
    '.echo-atlas-route': route, '.echo-atlas-trail': trail, '.echo-atlas-guide': guide };
  const atlas = { querySelector: s => elements[s], querySelectorAll: () => cards };
  guide.animate = (keyframes, options) => {
    let resolve, reject;
    const flight = { keyframes, options, finished: new Promise((yes, no) => { resolve = yes; reject = no; }),
      resolve: () => resolve(), cancel() { this.canceled = true; reject(new Error('canceled')); } };
    flights.push(flight); return flight;
  };
  const document = { documentElement: root, hidden: false, querySelector: () => atlas,
    createElementNS: () => node(), addEventListener: (name, fn) => { handlers[name] = fn; } };
  const window = { CSS: { supports: () => capable },
    matchMedia: q => ({ matches: q.includes('max-width') ? narrow : true }),
    getComputedStyle: () => ({ offsetDistance: computedDistance }),
    addEventListener: (name, fn) => { handlers[name] = fn; },
    requestAnimationFrame: fn => { frames.set(++nextFrame, fn); return nextFrame; },
    cancelAnimationFrame: id => frames.delete(id) };
  vm.runInNewContext(source, { window, document });
  return { cards, guide, route, trail, root, document, handlers, frames, flights,
    computed: value => { computedDistance = value; },
    flush() { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); } };
}

vm.runInNewContext(source, { document: { querySelector: () => null } });
const map = setup();
assert.match(map.trail.attributes.d, /^M 500 0 C/);
assert.equal(map.guide.hidden, false);
map.cards[0].handlers.focusin();
map.computed('20px');
map.cards[1].handlers.pointerenter();
assert.equal(map.flights[0].canceled, true);
assert.equal(map.flights[1].keyframes[0].offsetDistance, '20px', 'rapid retarget starts at the visible position');
assert.equal(map.cards[0].classList.contains('echo-atlas-current'), false);
assert.equal(map.cards[1].classList.contains('echo-atlas-current'), true);
map.flights[0].resolve();
await Promise.resolve();
map.cards[2].handlers.focusin();
assert.equal(map.flights[1].canceled, true, 'an older completion must not clear the current flight owner');
map.handlers.resize(); map.handlers.resize();
assert.equal(map.frames.size, 1);
map.flush();
assert.equal(map.flights[2].canceled, true);
assert.equal(map.frames.size, 0, 'measurement does not create an idle frame loop');
map.cards[0].handlers.pointerenter();
map.handlers.resize();
map.document.hidden = true; map.handlers.visibilitychange();
assert.equal(map.flights.at(-1).canceled, true);
assert.equal(map.frames.size, 0);
map.document.hidden = false; map.handlers.visibilitychange(); map.flush();
map.cards[1].handlers.focusin();
map.root.classList.add('fluid-portal-active'); map.handlers['fluid-portal-change']();
assert.equal(map.guide.hidden, true);
assert.equal(map.flights.at(-1).canceled, true);
const before = map.flights.length;
map.cards[0].handlers.focusin();
assert.equal(map.flights.length, before, 'portal cannot start a map flight');
map.root.classList.remove('fluid-portal-active'); map.handlers['fluid-portal-change'](); map.flush();
assert.equal(map.guide.hidden, false);
map.cards[2].handlers.focusin(); map.handlers.pagehide();
assert.equal(map.flights.at(-1).canceled, true);
const fallback = setup({ capable: false, narrow: true });
fallback.cards[0].handlers.focusin();
assert.equal(fallback.flights.length, 0);
assert.match(fallback.guide.style.transform, /translate\(18px,42px\)/);
assert.equal(setup({ portal: true }).guide.hidden, true);
await Promise.resolve();
console.log('reading-map contracts passed: native links, focus, rapid retarget, cleanup, idle stop, narrow fallback');

// Check the built pages as well: aliases are redirects, not extra article lists.
const built = new URL('../public/', import.meta.url);
const pages = ['index.html', ...readdirSync(new URL('page/', built), { withFileTypes: true })
  .filter(entry => entry.isDirectory()).map(entry => `page/${entry.name}/index.html`)];
const links = html => [...html.matchAll(/<a class=entry-link\b[^>]*href=(?:"([^"]+)"|([^\s>]+))/g)].map(match => match[1] || match[2]);
const mapLinks = pages.flatMap(file => {
  const html = readFileSync(new URL(file, built), 'utf8');
  if (html.includes('http-equiv=refresh')) return [];
  assert.ok(html.includes('echo-atlas-islands'), `${file} retains the map`);
  assert.equal(html.includes('echo-atlas-discover'), false, 'home and pagination have no discovery button');
  return links(html);
});
assert.equal(new Set(mapLinks).size, mapLinks.length, 'pagination does not duplicate articles');
for (const sectionLink of links(readFileSync(new URL('posts/index.html', built), 'utf8'))) {
  assert.ok(mapLinks.includes(sectionLink), 'section articles remain reachable from the map');
}
assert.equal(readFileSync(new URL('taxonomies/index.html', built), 'utf8').includes('echo-atlas-islands'), false);
console.log(`built map passed: ${mapLinks.length} unique native article links, no discovery button and home-only scope`);
