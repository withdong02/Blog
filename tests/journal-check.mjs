import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../assets/js/journal.js', import.meta.url), 'utf8');
function setup({ present = true, capable = true, reduced = false, hidden = false, returning = false } = {}) {
  const events = {}, motions = [];
  const elements = Object.fromEntries(['.home-info', '.echo-atlas'].map(selector => [selector, {
    getBoundingClientRect: () => ({ top: 100 }),
    animate(keyframes, options) {
      let resolve, reject;
      const motion = { keyframes, options, finished: new Promise((yes, no) => { resolve = yes; reject = no; }),
        finish() { resolve(); }, cancel() { this.canceled = true; reject(new Error('canceled')); } };
      motions.push(motion); return motion;
    }
  }]));
  const media = { matches: reduced, addEventListener: (name, fn) => { events.media = fn; } };
  const home = { animate: capable, querySelector: selector => elements[selector] };
  const document = { hidden, querySelector: () => present ? home : null,
    documentElement: { classList: { contains: () => returning } }, addEventListener: (name, fn) => { events[name] = fn; } };
  const window = { innerHeight: 900, matchMedia: () => media, addEventListener: (name, fn) => { events[name] = fn; } };
  vm.runInNewContext(source, { document, window, Set });
  return { events, motions, document, media };
}
assert.equal(setup({ present: false }).motions.length, 0);
assert.equal(setup({ capable: false }).motions.length, 0);
assert.equal(setup({ reduced: true }).motions.length, 0);
assert.equal(setup({ hidden: true }).motions.length, 0);
assert.equal(setup({ returning: true }).motions.length, 0, 'cross-document return owns its own transition');
for (const event of ['pagehide', 'resize', 'visibilitychange', 'pageshow', 'media']) {
  const run = setup();
  assert.equal(run.motions.length, 2);
  if (event === 'visibilitychange') run.document.hidden = true;
  run.events[event]({ persisted: true });
  assert.ok(run.motions.every(motion => motion.canceled), `${event} cancels all finite motions`);
}
const completed = setup();
completed.motions.forEach(motion => motion.finish());
await Promise.resolve();
completed.events.pagehide();
assert.ok(completed.motions.every(motion => !motion.canceled), 'completed motions release their ownership');
await Promise.resolve();

const output = new URL('../public/', import.meta.url);
const files = ['index.html', ...readdirSync(new URL('page/', output), { withFileTypes: true })
  .filter(entry => entry.isDirectory()).map(entry => `page/${entry.name}/index.html`)];
const links = html => [...html.matchAll(/<a class=entry-link\b[^>]*href=(?:"([^"]+)"|([^\s>]+))/g)].map(match => match[1] || match[2]);
const all = [];
for (const file of files) {
  const html = readFileSync(new URL(file, output), 'utf8');
  if (html.includes('http-equiv=refresh')) continue;
  assert.match(html, /class=journal-home id=articles/);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.doesNotMatch(html, /fluid-portal|\/js\/fluid-transition\./, 'direct entry does not recreate the portal');
  assert.match(html, /echo-atlas-islands/, 'familiar staggered cards remain');
  assert.match(html, /echo-atlas-guide/, 'one guide accompanies the article map');
  assert.match(html, /\/js\/reading-map\./, 'guide runtime is loaded');
  assert.doesNotMatch(html, /\/js\/fluid-read\./, 'no reading companion');
  assert.equal((html.match(/echo-atlas-guide/g) || []).length, 1, 'the guide is shared, not repeated on every card');
  assert.doesNotMatch(html, /journal-featured|journal-feature-date|journal-directory-title/, 'no oversized feature panel or extra index headline');
  assert.match(html, /\/js\/journal\./);
  assert.ok(links(html).length > 0);
  all.push(...links(html));
}
assert.equal(new Set(all).size, all.length, 'article cards are not duplicated across pagination');
const sectionPages = ['posts/index.html', ...readdirSync(new URL('posts/page/', output), { withFileTypes: true })
  .filter(entry => entry.isDirectory()).map(entry => `posts/page/${entry.name}/index.html`)];
const expected = sectionPages.flatMap(file => {
  const html = readFileSync(new URL(file, output), 'utf8');
  return html.includes('http-equiv=refresh') ? [] : links(html);
});
assert.deepEqual(new Set(all), new Set(expected), 'every published article remains reachable');
for (const file of ['taxonomies/index.html', 'posts/echo/index.html']) {
  const html = readFileSync(new URL(file, output), 'utf8');
  assert.doesNotMatch(html, /class=journal-home/);
  assert.doesNotMatch(html, /\/js\/journal\./, 'home motion is not requested by other routes');
  assert.doesNotMatch(html, /echo-article-mark|fluid-signoff-figure|\/js\/fluid-read\./, 'reading has no repeated character');
}
const styles = readFileSync(new URL('../assets/css/extended/journal.css', import.meta.url), 'utf8');
assert.doesNotMatch(styles, /#[\da-f]{3,8}\b|\b(?:rgb|hsl)a?\(/i, 'interface styling uses the existing neutral theme colors');
assert.match(styles, /\.logo \.fluid-mark\s*\{\s*display:\s*none/, 'home navigation displays text without the character');
console.log(`journal checks passed: ${all.length} unique articles, neutral cards, direct entry, pagination, fallback and finite motion cleanup`);
