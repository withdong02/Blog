import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../assets/js/reading-map.js', import.meta.url), 'utf8');
function setup({ capable = true, narrow = false, portal = false, gap = 64, tops = [0, 36, 300, 336, 670, 706] } = {}) {
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
  const cards = tops.map((top, i) => {
    const card = node();
    card.getBoundingClientRect = () => ({ left: i % 2 ? (1000 + gap) / 2 : 0, right: i % 2 ? 1000 : (1000 - gap) / 2, top });
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
    getComputedStyle: () => ({ offsetDistance: computedDistance, width: narrow ? '24px' : '28px' }),
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
assert.match(map.trail.attributes.d, /^M 492 0 C/);
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
assert.match(fallback.guide.style.transform, /translate\(14\.\d+px,42px\)/);
function segments(path) {
  const [start, ...curves] = path.split(' C ');
  let origin = start.slice(2).split(' ').map(Number);
  return curves.map(curve => {
    const coordinates = curve.split(' ').map(Number);
    const points = [origin, coordinates.slice(0, 2), coordinates.slice(2, 4), coordinates.slice(4, 6)];
    origin = points[3];
    return points;
  });
}
for (const gap of [48, 64, 112]) {
  const compact = setup({ gap });
  const curves = segments(compact.trail.attributes.d);
  for (const [i, points] of curves.entries()) {
    for (const [x] of points) {
      // A cubic stays in the convex hull of its controls, including between stops.
      assert.ok(x - 14 >= (1000 - gap) / 2 + 8 - 1e-9, 'entire guide path clears the left card and focus outline');
      assert.ok(x + 14 <= (1000 + gap) / 2 - 8 + 1e-9, 'entire guide path clears the right card and focus outline');
    }
    assert.ok(points[3][1] > points[0][1], 'route always advances down the page');
    if (i) {
      const previous = curves[i - 1];
      const incoming = (previous[3][0] - previous[2][0]) / (previous[3][1] - previous[2][1]);
      const outgoing = (points[1][0] - points[0][0]) / (points[1][1] - points[0][1]);
      assert.ok(Math.abs(incoming - outgoing) < 1e-9, 'route tangent remains continuous through stops');
    }
  }
  assert.ok(curves[0][3][0] < curves[1][3][0], 'two staggered cards share a sweep rather than forcing a left-right reversal');
  assert.equal(curves.at(-1)[3][1], 786, 'route continues below the last title to the end of the list');
}
const single = setup({ tops: [0] });
assert.equal(segments(single.trail.attributes.d).at(-1)[3][1], 786, 'a one-article page retains a complete finite route');
const aligned = setup({ tops: [0, 0, 300, 336] });
assert.ok(segments(aligned.trail.attributes.d).every(points => points[3][1] > points[0][1]), 'aligned first-row titles do not introduce a zero-length curve');
aligned.cards[0].handlers.focusin();
aligned.cards[1].handlers.focusin();
assert.equal(aligned.flights[0].keyframes[1].offsetDistance, aligned.flights[1].keyframes[1].offsetDistance, 'aligned cards share one route stop');
const oneColumn = setup({ narrow: true, tops: [0, 210, 520] });
for (const points of segments(oneColumn.trail.attributes.d)) {
  for (const [x] of points) assert.ok(x >= 14 && x <= 18, 'narrow path stays in its reserved rail');
}
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
  assert.ok(html.includes('journal-home'), `${file} retains the current article index`);
  assert.equal(html.includes('echo-atlas-discover'), false, 'home and pagination have no discovery button');
  return links(html);
});
assert.equal(new Set(mapLinks).size, mapLinks.length, 'pagination does not duplicate articles');
for (const sectionLink of links(readFileSync(new URL('posts/index.html', built), 'utf8'))) {
  assert.ok(mapLinks.includes(sectionLink), 'section articles remain reachable from the map');
}
assert.equal(readFileSync(new URL('taxonomies/index.html', built), 'utf8').includes('echo-atlas-islands'), false);
console.log(`built index passed: ${mapLinks.length} unique native article links; map runtime checked above`);
