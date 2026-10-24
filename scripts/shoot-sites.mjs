#!/usr/bin/env node
// Screenshots every GitHub Pages site in data/repos.json so the "Live on GitHub
// Pages" cards show the real page instead of a drawn placeholder:
//
//   data/shots/<repo>.webp – the top of the page at 1280×800, saved at 800×500
//
// and records each one as `preview` on its repository in data/repos.json, with
// a content hash so browsers fetch it again only when the page has changed.
// Best effort: a site that fails to load keeps its placeholder.
//
// Needs Google Chrome and the playwright-core package
// (npm install --no-save playwright-core).
//
// Usage: node scripts/shoot-sites.mjs   (after scripts/fetch-data.sh)
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const OUT = process.env.OUT || 'data';
const SHOTS = `${OUT}/shots`;
const VIEWPORT = { width: 1280, height: 800 };
const SCALE = 0.625;   // 1280×800 → 800×500, about twice a card's width
const PARALLEL = 4;

const snap = JSON.parse(await readFile(`${OUT}/repos.json`, 'utf8'));
const self = `${snap.owner}.github.io`.toLowerCase();
// Same rule as pagesURL() in assets/app.js.
const sites = snap.repos
  .filter((r) => r.has_pages && r.name.toLowerCase() !== self)
  .map((r) => ({ repo: r, url: r.pages_url || `https://${snap.owner}.github.io/${r.name}/` }));

await rm(SHOTS, { recursive: true, force: true });
await mkdir(SHOTS, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });
// Entrance animations settle at once, so the shot shows the finished page.
const context = await browser.newContext({ viewport: VIEWPORT, colorScheme: 'light', reducedMotion: 'reduce' });

async function shoot({ repo, url }) {
  const page = await context.newPage();
  try {
    const res = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    if (!res || !res.ok()) throw new Error(`HTTP ${res ? res.status() : 'error'}`);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    // A <meta http-equiv="refresh"> redirect lands on its target, often at an
    // #anchor: wait for that page and shoot it from the top.
    await page.waitForLoadState('load');
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(800);
    const cdp = await context.newCDPSession(page);
    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'webp', quality: 80,
      clip: { x: 0, y: 0, ...VIEWPORT, scale: SCALE },
    });
    const file = `${repo.name}.webp`;
    const img = Buffer.from(data, 'base64');
    await writeFile(`${SHOTS}/${file}`, img);
    const v = createHash('sha256').update(img).digest('hex').slice(0, 10);
    repo.preview = `${SHOTS}/${encodeURIComponent(file)}?v=${v}`;
    console.log(`  ${repo.name}: ${Math.round(img.length / 1024)} KB`);
  } catch (e) {
    console.log(`::warning title=No preview for ${repo.name}::${url}: ${e.message.split('\n')[0]}`);
  } finally {
    await page.close();
  }
}

console.log(`Screenshotting ${sites.length} GitHub Pages sites…`);
const queue = sites.slice();
await Promise.all(Array.from({ length: PARALLEL }, async () => {
  while (queue.length) await shoot(queue.shift());
}));
await browser.close();

await writeFile(`${OUT}/repos.json`, JSON.stringify(snap, null, 2) + '\n');
console.log(`  ${sites.filter((s) => s.repo.preview).length} of ${sites.length} previews written to ${SHOTS}/`);
