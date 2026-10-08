import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../assets/js/article-ink.js', import.meta.url), 'utf8');
function node(select = {}, top = 100) {
  const classes = new Set();
  return {
    select, classes, children: [],
    style: { removeProperty() { this.viewTransitionName = ''; } },
    classList: { add(...names) { names.forEach(n => classes.add(n)); }, remove(...names) { names.forEach(n => classes.delete(n)); } },
    querySelector(selector) { return this.select[selector] || null; },
    getBoundingClientRect() { return { width: 300, height: 50, top, bottom: top + 50 }; },
    cloneNode() { return node({ '.fluid-mark-body': node() }); },
    insertAdjacentHTML(position, html) { this.poolMarkup = html; this.select['.echo-card-goo'] = node(); },
    setAttribute() {},
    appendChild(child) {
      this.children.push(child);
      child.parentNode = this;
      if (child.classes.has('echo-card-mark')) this.select['.echo-card-mark'] = child;
    }
  };
}
function setup({ article = false, capable = true, hiddenTitle = false, hash = '', path = '/' } = {}) {
  const handlers = {};
  const root = node();
  const title = node({}, hiddenTitle ? 950 : 100);
  const mark = node();
  const sheet = node(article ? { '.post-title': title, '.echo-article-mark': mark } : {
    '.entry-header h2': title, '.entry-link': { href: 'https://blog.test/posts/echo/' }
  });
  const articleNode = article ? node({ '.post-header': sheet }) : null;
  const document = {
    documentElement: root, currentScript: { getAttribute: () => '/posts/' }, hidden: false,
    querySelector(selector) { return selector === '.logo .fluid-mark' ? mark : selector === '.post-single.echo-article' ? articleNode : null; },
    querySelectorAll() { return article ? [] : [sheet]; },
    addEventListener(name, callback) { handlers[name] = callback; }
  };
  const window = {
    location: { origin: 'https://blog.test', pathname: path, hash }, innerHeight: 900,
    addEventListener(name, callback) { handlers[name] = callback; }
  };
  if (capable) Object.assign(window, { onpageswap: null, onpagereveal: null, navigation: { activation: null } });
  vm.runInNewContext(source, { document, window, URL });
  handlers.DOMContentLoaded();
  function transition(other, outgoing) {
    let readyResolve, readyReject, finishResolve;
    const vt = {
      skipped: false,
      ready: new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; }),
      finished: new Promise(resolve => { finishResolve = resolve; }),
      skipTransition() { this.skipped = true; }
    };
    if (outgoing) handlers.pageswap({ viewTransition: vt, activation: { entry: { url: other } } });
    else {
      window.navigation.activation = { from: { url: other } };
      handlers.pagereveal({ viewTransition: vt });
    }
    return { vt, readyResolve, readyReject, finishResolve };
  }
  return { handlers, root, sheet, title, document, transition };
}

for (const article of [false, true]) {
  for (const outgoing of [false, true]) {
    const h = setup({ article, path: article ? '/posts/echo/' : '/' });
    const t = h.transition(article ? 'https://blog.test/#articles' : 'https://blog.test/posts/echo/', outgoing);
    assert.equal(t.vt.skipped, false);
    assert.equal(h.sheet.style.viewTransitionName, 'echo-paper');
    assert.equal(h.title.style.viewTransitionName, 'echo-title');
    assert.ok(h.root.classes.has((outgoing ? !article : article) ? 'echo-article-opening' : 'echo-article-returning'));
    if (outgoing) t.readyReject(new Error('old document hidden'));
    else t.readyResolve();
    await Promise.resolve();
    if (!outgoing) {
      assert.equal(h.title.style.viewTransitionName, '');
      h.handlers.pageshow({ persisted: false });
      assert.ok(h.root.classes.size > 0, 'first-load pageshow must not end the active transition');
      h.handlers.pageshow({ persisted: true });
      assert.ok(h.root.classes.size > 0, 'BFCache pageshow must preserve an inbound transition too');
    }
    t.finishResolve();
    await Promise.resolve();
    assert.equal(h.sheet.style.viewTransitionName, '');
    assert.equal(h.root.classes.size, 0);
    assert.equal(h.sheet.classes.size, 0);
  }
}
for (const options of [
  { other: 'https://blog.test/about/' },
  { other: 'https://other.test/posts/echo/' },
  { other: 'https://blog.test/posts/missing/' },
  { other: 'https://blog.test/posts/echo/#heading' },
  { hiddenTitle: true },
  { article: true, hash: '#heading', other: 'https://blog.test/#articles' },
  { article: true, other: 'https://blog.test/posts/next/' }
]) {
  const h = setup(options);
  const t = h.transition(options.other || 'https://blog.test/posts/echo/', true);
  assert.equal(t.vt.skipped, true, JSON.stringify(options));
  assert.equal(h.root.classes.size, 0);
}
const fallback = setup({ capable: false });
assert.equal(fallback.handlers.pageswap, undefined);
assert.ok(fallback.sheet.querySelector('.echo-card-mark'), 'static decoration still works');
fallback.handlers.pageshow();
assert.equal(Object.keys(fallback.sheet.select).filter(k => k === '.echo-card-mark').length, 1);

for (const stop of ['pagehide', 'visibilitychange']) {
  const h = setup();
  h.transition('https://blog.test/posts/echo/', true);
  h.document.hidden = true;
  h.handlers[stop]();
  assert.equal(h.sheet.style.viewTransitionName, '');
  assert.equal(h.root.classes.size, 0);
  h.handlers.pageshow({ persisted: true });
  assert.equal(h.root.classes.size, 0, 'a restored page keeps the previous departure cleaned');
}
const pool = fallback.sheet.querySelector('.echo-card-mark');
assert.equal(pool.querySelector('.fluid-mark-body').parentNode, pool.querySelector('.echo-card-goo'));
assert.match(pool.poolMarkup, /<ellipse/);
assert.equal(fallback.sheet.children.length, 1, 'pageshow must not duplicate the pool');
const h = setup();
const first = h.transition('https://blog.test/posts/echo/', false);
const second = h.transition('https://blog.test/posts/echo/', true);
first.readyResolve();
first.finishResolve();
await Promise.resolve();
assert.equal(h.title.style.viewTransitionName, 'echo-title', 'previous transition cannot clear the next capture');
second.finishResolve();
await Promise.resolve();
assert.equal(h.root.classes.size, 0);
console.log('Article ink checks passed: native navigation, matching snapshots, fallback and interruption cleanup');
