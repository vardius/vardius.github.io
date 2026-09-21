# vardius.github.io

Personal hub for [@vardius](https://github.com/vardius): the GitHub Pages sites
and every public repository, rendered from the GitHub API.

Live at **https://vardius.github.io/**

## How it works

- `index.html`, `assets/style.css`, `assets/app.js`: a static page with no
  framework, no build step and no third-party scripts (no analytics, no ads).
- `.github/workflows/deploy.yml` runs on every push, daily and on demand. It calls
  `scripts/fetch-data.sh` to snapshot the public repositories into `data/`, then
  deploys the site with GitHub Pages' Actions deployment.
- If the snapshot is missing (local development, or Pages still deploying from
  the branch) the page falls back to the public GitHub API from the browser.
- Repositories with GitHub Pages enabled are shown as "live sites". The
  snapshot asks the Pages API for each site's real address (custom domains
  included) and falls back to `https://vardius.github.io/<repo>/`. A
  repository's `homepage` field is only ever used as an extra "website" link.
  Domains listed in `window.SITE.ignoreDomains` are never linked to.

Every card's artwork is generated from the repository name, so nothing needs to
be uploaded when a project is added.

## Listing a site from a private repository

A private repository's GitHub Pages site can be shown without exposing the
repository itself. Two things switch it on:

1. Add the `showcase` topic to that repository
   (`gh repo edit OWNER/REPO --add-topic showcase`, or the "About" gear on
   GitHub). Remove the topic to unlist it.
2. Once: create a fine-grained personal access token with **Metadata:
   Read-only** and **Pages: Read-only** on all repositories, and save it as
   the `SHOWCASE_TOKEN` secret of this repository (Settings → Secrets and
   variables → Actions). Pages access is what lets the snapshot show custom
   domains instead of the github.io address.

The next snapshot lists the site with a "Private source" badge, showing only its
name, description and language, with no link into the repository. Private
repositories never appear in the repository grid or the public-repo counters.

## Run locally

```bash
python3 -m http.server 4173
```

Then open http://127.0.0.1:4173/. To use a data snapshot instead of the live API:

```bash
OWNER=vardius ./scripts/fetch-data.sh
```

## Configure

The only site-specific settings are in `window.SITE` in `index.html`
(`owner`, `showName`, `ignoreDomains`). Name and bio are read from the
GitHub profile, so the page shows exactly what GitHub shows.
