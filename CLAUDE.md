# D:\Blog Project Rules

## Project Type

This repository is a Hugo static blog using a vendored copy of the PaperMod theme.

- Hugo config: `hugo.yml`
- Theme: `themes/PaperMod`
- Content root: `content`
- Generated output: `public`

## Directory Rules

- `content/posts/`: blog posts.
- `content/categories/_index.md` and `content/tags/_index.md`: localized taxonomy landing-page metadata.
- `content/taxonomies.md`: combined categories and tags overview page.
- `content/about.md`: about page.
- `content/archives.md`: archives page.
- `content/search.md`: search page.
- `archetypes/`: Hugo content templates.
- `assets/`: Hugo pipeline assets, such as custom CSS and fonts.
- `static/`: files copied directly to the site root, such as images, verification files, and static font files.
- `static/games/`: self-contained browser games and their relative assets, published under `/games/`.
- `layouts/`: local layout overrides for PaperMod.
- `layouts/_default/baseof.html`: project override of the theme's baseof. It carries the skip link and `id="main"` on `<main>`; keep it in sync with `themes/PaperMod/layouts/_default/baseof.html`.
- `layouts/_markup/`: project-level Hugo Markdown render hooks.
- `layouts/_markup/render-image.html`: adds intrinsic `width`/`height`, `loading="lazy"` and `decoding="async"`. Covers Markdown images only — raw `<img>` tags in the Markdown are invisible to render hooks; see the note under Typography Rules.
- `layouts/page.taxonomies.html`: combined taxonomy overview page layout.
- `themes/PaperMod/`: vendored PaperMod theme source tracked by this repository.
- `public/`: generated build output. Do not edit by hand.

## Naming Rules

- New posts go under `content/posts/`.
- Use lowercase kebab-case file names for new content, for example `my-new-post.md`.
- Prefer one topic per post.
- Keep front matter fields consistent with the existing Hugo/PaperMod style.
- Store reusable images and static files under `static/`; use `assets/` only when the file should be processed by Hugo.

## Editing Rules

- Update this file first when changing project structure, naming rules, or workflows.
- Keep `hugo.yml` as the single site-level configuration file unless there is a clear reason to split config.
- Do not commit secrets, tokens, passwords, or private keys.
- Do not edit generated files in `public/`; regenerate them with Hugo.
- Do not delete files or directories in bulk. Delete only one explicit file path at a time, and ask before deleting anything.
- Do not change `.env`, credentials, CI/CD config, database schemas, or migration files without explicit approval.

## Theme Rules

- The vendored PaperMod theme is permanently frozen at the version tracked in this repository. Do not upgrade, replace, or resync it with upstream.
- Before changing Hugo or PaperMod behavior, check the current official documentation for a supported configuration, parameter, i18n key, hook, or override.
- Use this order: `hugo.yml`/front matter/i18n first; project-level overrides in `layouts/`, `assets/`, or `static/` second; vendored code under `themes/PaperMod/` only as a last resort.
- Edit Hugo or PaperMod source directly when the official options cannot satisfy the requirement. Record why and keep the diff minimal.
- Local PaperMod adjustment: the email icon uses Feather's original `24 x 24` viewBox for alignment.

## Typography Rules

- No webfonts. Running text uses the system UI stack PaperMod declares in `themes/PaperMod/assets/css/core/reset.css`; the repository ships zero font files.
- `assets/css/extended/custom.css` must not declare a site-wide `font-family` rule. PaperMod declares `font-family` exactly once (on `body`), so any global re-declaration also strips the browser default `monospace` off `pre`/`code`/`kbd`/`samp` and silently renders every code block in a proportional face.
- Code uses the explicit platform monospace stack in `custom.css`: Latin monospace first, then a full-width CJK face. Keep Latin first — it also supplies the box-drawing characters the ASCII trees in posts depend on.
- This replaced the former LXGW WenKai Mono GB + Anthropic Sans webfonts, where the CJK face alone was 9.1 MB (95.9% of a page load, 47.9 s at 1.6 Mbps). Do not reintroduce a CJK webfont without subsetting it.
- Reading size and measure are coupled: `--reading-size` and `--main-width` (both set in `assets/css/extended/custom.css`) must keep one line at 30-45 CJK characters, currently **16px / 640px = 40**. Three values move together — the measure, the code size (`--code-size`, currently `0.9rem` = 14.4px) and the inline-code size (`0.85rem`, pinned rather than `em` so it stops drifting with the body). Block code's widest line is 75 characters, which is ~633px at `0.9rem`: it fits the 640px column with ~7px to spare, so raising the code size or the column is safe and *lowering* the column is not.
- Heading scale: h1 40 / h2 32 / h3 24 / h4 18 / h5 17 / h6 16 px against the 16px body, so every heading is at or above body size. Do not let one drop below it — PaperMod shipped h4 16 / h5 14 / h6 12 against an 18px body, which inverted the hierarchy from h4 down and put h6 at 12px, unreadable in CJK. `custom.css` overrides it.
- Light-mode syntax colours are contrast-corrected: `assets/css/extended/chroma-light.css` is generated from Catppuccin Latte, but 55 of Latte's tokens fell below 4.5:1 on the `#eff1f5` code ground, so each failing colour was darkened along the HSL lightness axis. Every token now measures ≥ 4.50:1. Re-apply that correction if the file is regenerated; dark mode was already compliant and is untouched.
- Content images get their intrinsic size from `layouts/_markup/render-image.html`: local files via `images.Config` (guarded by `os.FileExists`, because it errors rather than returning empty) and remote URLs via `resources.GetRemote` wrapped in `try`. All 16 Markdown images are now reserved. The build therefore depends on the image host; a failed fetch logs a warning and emits the image without dimensions instead of failing the build. Cold-cache cost is about 2s per build — Hugo caches the fetches in its own OS-level cache, not in the repo, so CI pays it every run. Never format those numbers with `printf "%q"`: on an int that yields a rune literal, so 951 came out as `η`.
- 10 images are still unreserved because they are raw `<img>` tags in the Markdown, which no render hook can reach: 4 in `content/about.md` (local `/assets/*`), 1 in `content/posts/MySQL索引八股整理.md` (it carries `style="zoom:25%"`, so converting it to Markdown syntax would change its rendered size), and 4 in `content/posts/RecordShit 关键记录.md`. Images inside `static/games/*.html` are outside Hugo's pipeline entirely. Converting these would remove the last source of late layout growth — see Anchor Scrolling.
- `custom.css` sets `height: auto` on `.md-content img` so the emitted attributes cannot fight `max-width` when an image is scaled down.

## Table of Contents

- The collapsed `<details class="toc">` block is the outline and the only one that exists without JavaScript. `tocopen` stays `false`.
- The right-edge rail (`layouts/partials/toc_ticks.html` + `assets/js/toc-sidebar.js` + `assets/css/extended/toc-sidebar.css`) is a pure enhancement gated on `.toc-rail-ready`; with fewer than two headings it does not appear at all.
- It is a port of the DSH turn navigator (`@deepseek-ai/dsh-client-ui-chat`, TurnNavigator). Keep it aligned with that source: fixed 10px pitch, 6px rail inset, frame height `min((n-1)*10 + 12, band - 64px, 420px)`, 12px default / 18px preview / 20px active bars, 24px mask fade at a scrollable end. Overflow scrolls inside the frame instead of compressing the pitch.
- **The whole rail is the pointer target, not the marks.** `.toc-tick` is `pointer-events: none` and `toc-sidebar.js` maps pointer Y to the nearest index (`itemAtPointer`). Never "fix" the small marks by widening hit boxes — that reintroduces overlapping targets.
- It is hidden on `(hover: none), (pointer: coarse)` and below 900px, mirroring DSH's `@container (width<=900px)`. Measured: the rail's box crosses the text column below 840px.
- `--toc-rail-band` is `100dvh - 156px`, where 156px is the floating theme-toggle + scroll-to-top cluster that the rail must not overlap.
- Do not use `calc(var(--x) * 1px)` for a length the script already writes with units — the value becomes `px * px`, the whole declaration is dropped, and the element silently falls back to its static position.

## Anchor Scrolling

- `layouts/partials/footer.html` owns the hash-click behaviour. Each click scrolls smoothly, then watches for a bounded window (60ms poll, 6s deadline, at most 4 corrections, aborted by any wheel / touch / key input) and re-aligns with an instant jump whenever the page is still but the heading has moved. The instant jump is the point: a smooth re-issue can go stale again, an instant one cannot.
- The watch exists for content that grows *after* the scroll finishes. Measured before the image fix: the document grew 959px mid-scroll on the longest post and its heading settled 971px low. With Markdown images reserved that case is gone; the remaining source is the raw `<img>` tags listed under Typography Rules.
- **A heading near the end of a document can never reach the top** — the page runs out of scroll first. Measured: the last heading of `content/posts/MySQL索引八股整理.md` settles 161px down because `maxScroll` is already reached at 4991 of a 5891px document. That is physics, not a failure, and the correction deliberately does not fight it (the `pinned` check).
- For the same reason `currentIndex()` in `toc-sidebar.js` treats "at the bottom of the page" as the last heading; otherwise a document's final section could never become the active mark, and clicking its rail mark would look like it did nothing.
- Do not reintroduce a fixed-timer correction: an earlier version corrected on a 1200ms `setTimeout` behind a latch, which for a long scroll fired mid-flight and then refused to correct again.

## Validation

After content, layout, asset, or config changes, run:

```powershell
hugo --gc --minify
```

For local preview, run:

```powershell
hugo server --buildDrafts --buildFuture --renderToMemory
```

`--renderToMemory` is required, not a preference. Without it `hugo server` renders
into `public/` — the same destination `hugo` writes to — so the production build and
the dev server overwrite each other. A long-running dev server does not re-render
until a *source* file changes, so a later `hugo --gc --minify` silently swaps the
files it is serving, and every absolute URL in the served HTML (pagination `下一页`,
`rel=canonical`, `og:url`, and the `/page/1/` meta-refresh aliases) starts pointing at
`https://withdong02.top/`. Clicking any of them leaves localhost. With
`--renderToMemory` the dev server never writes to `public/` and always serves
`http://localhost:1313/`. After changing this flag, restart the running server —
it keeps serving whatever is on disk until it re-renders.

If Hugo is unavailable, install Hugo Extended for Windows as a global command before validating.

## Deployment

- Deployment is handled by GitHub Actions in `.github/workflows/deploy.yml`.
- Pushes to `master` build the Hugo site and mirror `public/` to `ubuntu@124.221.38.221:/`. The deploy key is forced through `rrsync` with `/var/www/blog` as its restricted root, so `/` here means that directory rather than the server filesystem root.
- The workflow uses `rsync --delete`, so files that no longer exist in `public/` are removed from the remote deploy directory.
- Store the SSH private key in the GitHub repository secret `DEPLOY_SSH_KEY`; do not commit private keys or server passwords.
- The deploy key may only run write-only `rrsync` inside `/var/www/blog`; it cannot open a shell or SSH tunnel.

## Git Rules

- Check `git status --short --branch` before and after changes.
- Do not run `git push`, `git rebase`, `git reset --hard`, force push, or history rewrite without explicit approval.
- Do not revert user changes unless explicitly asked.
