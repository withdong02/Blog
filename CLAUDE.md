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

## Validation

After content, layout, asset, or config changes, run:

```powershell
hugo --gc --minify
```

For local preview, run:

```powershell
hugo server --buildDrafts --buildFuture
```

If Hugo is unavailable, install Hugo Extended for Windows as a global command before validating.

## Deployment

- Deployment is handled by GitHub Actions in `.github/workflows/deploy.yml`.
- Pushes to `master` build the Hugo site and mirror `public/` to `ubuntu@124.221.38.221:/var/www/blog/`.
- The workflow uses `rsync --delete`, so files that no longer exist in `public/` are removed from the remote deploy directory.
- Store the SSH private key in the GitHub repository secret `DEPLOY_SSH_KEY`; do not commit private keys or server passwords.
- The deploy user must be able to write to `/var/www/blog` without an interactive password prompt.

## Git Rules

- Check `git status --short --branch` before and after changes.
- Do not run `git push`, `git rebase`, `git reset --hard`, force push, or history rewrite without explicit approval.
- Do not revert user changes unless explicitly asked.
