// Run after `hugo --gc --minify`: check the rendered links, including theme translations.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const output = new URL('../public/', import.meta.url);
const files = readdirSync(output, { recursive: true }).filter(file => file.endsWith('.html'));
let articles = 0;
for (const file of files) {
  const html = readFileSync(new URL(file.replaceAll('\\', '/'), output), 'utf8');
  const crumbs = html.match(/<nav\b[^>]*class=["']?breadcrumbs\b[^>]*>(.*?)<\/nav>/s)?.[1];
  if (crumbs) {
    assert.match(crumbs, /<a\b[^>]*>首页<\/a>/, `${file}: home label`);
    assert.doesNotMatch(crumbs, /主页/, `${file}: inconsistent home label`);
  }
  if (!file.startsWith(`posts/`) && !file.startsWith(`posts\\`)) {
    if (crumbs) assert.doesNotMatch(crumbs, /#articles/, `${file}: unrelated section changed`);
    continue;
  }
  if (!/<article\b[^>]*class=["']?post-single(?:["' >])/.test(html)) continue;
  articles++;
  assert.ok(crumbs, `${file}: missing breadcrumbs`);
  assert.match(crumbs, /<a href=["']?\/#articles["']?>文章列表<\/a>/, `${file}: list return`);
  const signoff = html.match(/<a\b[^>]*class=["']?fluid-signoff\b[^>]*>.*?<\/a>/s)?.[0];
  assert.ok(signoff, `${file}: missing footer return`);
  assert.match(signoff, /href=["']?\/#articles["']?[ >]/, `${file}: footer destination`);
  assert.match(signoff, /返回文章列表/, `${file}: footer label`);
  assert.match(html, /rel=["']?expect["']? blocking=["']?render["']? href=["']?#echo-article-ready/, `${file}: first-render participant gate`);
  assert.match(html, /id=["']?echo-article-ready["']? hidden/, `${file}: title is parsed before first reveal`);
}
assert.ok(articles > 0, 'Build the site before checking navigation');
const list = readFileSync(new URL('index.html', output), 'utf8');
assert.match(list, /href=["']?#echo-list-ready/, 'list first-render participant gate');
assert.ok(list.search(/id=["']?echo-list-ready/) > list.indexOf('</main>'), 'list gate is after its cards');
console.log(`Navigation checks passed (${articles} articles)`);
