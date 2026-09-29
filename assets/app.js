/* ==========================================================================
   vardius.github.io
   Vanilla JS, no dependencies.

   Data comes from one of three places, in order:
     1. data/repos.json + data/profile.json — a snapshot written by the deploy
        workflow (scripts/fetch-data.sh), refreshed daily. No rate limits.
     2. A short-lived sessionStorage cache of a previous live fetch.
     3. The public GitHub API (60 requests/hour per visitor IP), used when the
        snapshot is missing, e.g. local development.
   ========================================================================== */
(() => {
  'use strict';

  const SITE = Object.assign(
    { owner: 'vardius', showName: true, ignoreDomains: [] },
    window.SITE || {}
  );
  const OWNER = SITE.owner;
  const SELF_REPO = `${OWNER}.github.io`.toLowerCase();
  const API = 'https://api.github.com';
  const CACHE_KEY = `gh:${OWNER}:v1`;
  const CACHE_TTL = 15 * 60 * 1000;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- small helpers ---------- */

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const numFmt = new Intl.NumberFormat('en');
  const compactFmt = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
  const fmt = (n) => (n >= 10000 ? compactFmt.format(n) : numFmt.format(n));
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const UNITS = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  function timeAgo(iso) {
    const secs = (Date.now() - new Date(iso).getTime()) / 1000;
    for (const [unit, s] of UNITS) if (Math.abs(secs) >= s) return rtf.format(-Math.round(secs / s), unit);
    return 'just now';
  }
  const dateFmt = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });

  const ICON = {
    star: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/></svg>',
    fork: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z"/></svg>',
    link: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2Zm6.854-1h4.146a.25.25 0 0 1 .25.25v4.146a.25.25 0 0 1-.427.177L13.03 4.03 9.28 7.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.75-3.75-1.543-1.543A.25.25 0 0 1 10.604 1Z"/></svg>',
    arrow: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 2.75A.75.75 0 0 1 6.75 2h6.5a.75.75 0 0 1 .75.75v6.5a.75.75 0 0 1-1.5 0V4.56l-8.22 8.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L11.44 3.5H6.75A.75.75 0 0 1 6 2.75Z"/></svg>',
    lock: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4a4 4 0 0 1 8 0v2h.25c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 12.25 15h-8.5A1.75 1.75 0 0 1 2 13.25v-5.5C2 6.784 2.784 6 3.75 6H4Zm8.25 3.5h-8.5a.25.25 0 0 0-.25.25v5.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-5.5a.25.25 0 0 0-.25-.25ZM10.5 6V4a2.5 2.5 0 1 0-5 0v2Z"/></svg>',
  };

  /* GitHub's linguist colours for the languages most likely to show up. */
  const LANG_COLORS = {
    Go: '#00ADD8', JavaScript: '#f1e05a', TypeScript: '#3178c6', PHP: '#4F5D95', Python: '#3572A5',
    Rust: '#dea584', Shell: '#89e051', HTML: '#e34c26', CSS: '#663399', SCSS: '#c6538c', Less: '#1d365d',
    Ruby: '#701516', Java: '#b07219', C: '#555555', 'C++': '#f34b7d', 'C#': '#178600', Swift: '#F05138',
    Kotlin: '#A97BFF', Dart: '#00B4AB', Vue: '#41b883', Svelte: '#ff3e00', Astro: '#ff5a03',
    Dockerfile: '#384d54', Makefile: '#427819', Lua: '#000080', Elixir: '#6e4a7e', Erlang: '#B83998',
    Haskell: '#5e5086', Scala: '#c22d40', Clojure: '#db5855', 'Objective-C': '#438eff', Perl: '#0298c3',
    R: '#198CE7', 'Jupyter Notebook': '#DA5B0B', 'Vim Script': '#199f4b', TeX: '#3D6117', Twig: '#c1d026',
    Smarty: '#f0c040', Blade: '#f7523f', Zig: '#ec915c', Nix: '#7e7eff', HCL: '#844FBA', Solidity: '#AA6746',
    PowerShell: '#012456', Batchfile: '#C1F12E', OCaml: '#ef7a08', Julia: '#a270ba', Elm: '#60B5CC',
    Crystal: '#000100', Nim: '#ffc200', 'F#': '#b845fc', CoffeeScript: '#244776', Handlebars: '#f7931e',
    EJS: '#a91e50', Mustache: '#724b3b', Markdown: '#083fa1', MDX: '#fcb32c', Groovy: '#4298b8',
    Assembly: '#6E4C13', 'Emacs Lisp': '#c065db', Fortran: '#4d41b1', Roff: '#ecdebe', Pug: '#a86454',
    Stylus: '#ff6347', Vala: '#a56de2', WebAssembly: '#04133b', GLSL: '#5686a5', Liquid: '#67b8de',
    Jinja: '#a52a22', CMake: '#DA3434', Puppet: '#302B6D', Gherkin: '#5B2063', Scheme: '#1e4aec',
    Racket: '#3c5caa', 'Common Lisp': '#3fb68b', Prolog: '#74283c', D: '#ba595e', Tcl: '#e4cc98',
    Nunjucks: '#3d8137', Processing: '#0096D8', Arduino: '#bd79d1', Cuda: '#3A4E3A', Verilog: '#b2b7f8',
  };
  const OTHER = 'Other';
  const langOf = (r) => r.language || OTHER;
  const langColor = (l) => LANG_COLORS[l] || '#8b949e';

  /* ---------- deterministic artwork ---------- */

  // FNV-1a → mulberry32. Same repo name, same picture, on every machine.
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function prng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // A small mesh gradient whose hues are derived from the repository name.
  function fingerprint(name) {
    const rnd = prng(hash(name.toLowerCase()));
    const h = Math.floor(rnd() * 360);
    const h2 = (h + 40 + Math.floor(rnd() * 50)) % 360;
    const h3 = (h + 320 - Math.floor(rnd() * 50)) % 360;
    const at = () => `${Math.round(10 + rnd() * 80)}% ${Math.round(10 + rnd() * 80)}%`;
    const css = [
      `radial-gradient(at ${at()}, hsl(${h} 90% 68% / .95) 0, transparent 55%)`,
      `radial-gradient(at ${at()}, hsl(${h2} 85% 62% / .9) 0, transparent 55%)`,
      `radial-gradient(at ${at()}, hsl(${h3} 80% 60% / .85) 0, transparent 60%)`,
      `linear-gradient(135deg, hsl(${h} 50% 24%), hsl(${h2} 55% 14%))`,
    ].join(',');
    return { h, h2, h3, css };
  }

  // A procedural "screenshot": a wireframe of a landing page, a docs page or a
  // dashboard, laid out from the same seed, on top of the fingerprint gradient.
  function thumbnail(name) {
    const fp = fingerprint(name);
    const rnd = prng(hash(name) ^ 0x9e3779b9);
    const W = 320, H = 200;
    const rect = (x, y, w, h, o = 0.22, rx = 3) =>
      `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${rx}" fill="#fff" fill-opacity="${o}"/>`;
    let s = rect(0, 0, W, 22, 0.14, 0) + '<circle cx="16" cy="11" r="5" fill="#fff" fill-opacity=".55"/>';
    for (let i = 0; i < 3; i++) s += rect(W - 92 + i * 28, 8, 20, 6, 0.45);
    const variant = Math.floor(rnd() * 3);
    if (variant === 0) {
      // landing page: headline, sub-copy, two buttons, three cards
      const w1 = 120 + rnd() * 100;
      s += rect(24, 46, w1, 14, 0.85) + rect(24, 66, w1 * (0.5 + rnd() * 0.35), 14, 0.85);
      s += rect(24, 92, 150 + rnd() * 40, 6, 0.35) + rect(24, 104, 110 + rnd() * 40, 6, 0.35);
      s += rect(24, 122, 64, 18, 0.9, 9) + rect(96, 122, 64, 18, 0.3, 9);
      for (let i = 0; i < 3; i++) s += rect(24 + i * 94, 156, 82, 60, 0.18, 6);
    } else if (variant === 1) {
      // docs: sidebar with a nav, a title and paragraphs
      s += rect(0, 22, 84, H - 22, 0.1, 0);
      for (let i = 0; i < 7; i++) s += rect(14, 40 + i * 20, 30 + rnd() * 36, 6, i === 1 ? 0.85 : 0.35);
      s += rect(108, 44, 130 + rnd() * 50, 14, 0.85);
      for (let i = 0; i < 6; i++) s += rect(108, 74 + i * 16, 120 + rnd() * 80, 6, 0.3);
      s += rect(108, 176, 190, 40, 0.15, 6);
    } else {
      // dashboard: stat tiles and a bar chart
      for (let i = 0; i < 4; i++) s += rect(24 + i * 70, 40, 60, 38, 0.2, 6) + rect(32 + i * 70, 48, 24, 5, 0.5) + rect(32 + i * 70, 60, 36, 10, 0.85);
      s += rect(24, 92, 272, 100, 0.12, 6);
      for (let i = 0; i < 12; i++) { const bh = 20 + rnd() * 60; s += rect(34 + i * 21.5, 182 - bh, 13, bh, 0.7, 2); }
    }
    return `<div class="shot" style="background:${fp.css}"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${s}</svg></div>`;
  }

  function monogram(name) {
    const parts = name.split(/[-_.\s]+/).filter(Boolean);
    return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
  }

  /* ---------- data ---------- */

  function slim(r) {
    const license = r.license && typeof r.license === 'object' ? (r.license.spdx_id || r.license.name) : r.license;
    return {
      name: r.name,
      description: r.description || '',
      html_url: r.html_url,
      homepage: r.homepage || '',
      stargazers_count: r.stargazers_count || 0,
      forks_count: r.forks_count || 0,
      open_issues_count: r.open_issues_count || 0,
      language: r.language || null,
      topics: Array.isArray(r.topics) ? r.topics : [],
      fork: !!r.fork,
      archived: !!r.archived,
      is_template: !!r.is_template,
      has_pages: !!r.has_pages,
      created_at: r.created_at,
      pushed_at: r.pushed_at,
      license: license && license !== 'NOASSERTION' ? license : null,
      private: !!r.private,   // opted-in private repository: only its Pages site is shown
      pages_url: r.pages_url || null,   // resolved at snapshot time (custom domains)
    };
  }
  function slimProfile(p) {
    // Only what the page shows. Location, company, e-mail etc. stay on GitHub.
    return p ? { login: p.login, name: p.name, bio: p.bio, html_url: p.html_url } : null;
  }

  async function fetchJSON(url, init) {
    const res = await fetch(url, init);
    if (!res.ok) { const e = new Error(`${res.status} for ${url}`); e.status = res.status; throw e; }
    return res.json();
  }
  async function fetchAllPages(url) {
    const out = [];
    const headers = { Accept: 'application/vnd.github+json' };
    let next = url;
    for (let i = 0; next && i < 10; i++) {
      const res = await fetch(next, { headers });
      if (!res.ok) { const e = new Error(`GitHub API responded ${res.status}`); e.status = res.status; throw e; }
      out.push(...(await res.json()));
      const m = (res.headers.get('Link') || '').match(/<([^>]+)>;\s*rel="next"/);
      next = m ? m[1] : null;
    }
    return out;
  }

  async function loadData() {
    // 1. snapshot written at deploy time
    try {
      const [snap, profile] = await Promise.all([
        fetchJSON('data/repos.json', { cache: 'no-cache' }),
        fetchJSON('data/profile.json', { cache: 'no-cache' }).catch(() => null),
      ]);
      const repos = Array.isArray(snap) ? snap : snap && snap.repos;
      if (Array.isArray(repos)) {
        return { repos: repos.map(slim), profile: slimProfile(profile), generatedAt: snap.generated_at || null, source: 'snapshot' };
      }
    } catch (e) { /* no snapshot here: fall through to the live API */ }

    // 2. recent live fetch from this browser session
    try {
      const c = JSON.parse(sessionStorage.getItem(CACHE_KEY));
      if (c && Date.now() - c.t < CACHE_TTL) return { ...c.data, source: 'cache' };
    } catch (e) { /* storage unavailable */ }

    // 3. live GitHub API
    const [repos, profile] = await Promise.all([
      fetchAllPages(`${API}/users/${OWNER}/repos?per_page=100&type=owner`),
      fetchJSON(`${API}/users/${OWNER}`, { headers: { Accept: 'application/vnd.github+json' } }).catch(() => null),
    ]);
    const data = { repos: repos.map(slim), profile: slimProfile(profile), generatedAt: new Date().toISOString() };
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data })); } catch (e) { /* ignore */ }
    return { ...data, source: 'api' };
  }

  /* ---------- derived values ---------- */

  const trimSlash = (u) => u.replace(/\/+$/, '');
  const ignoredHost = (host) => SITE.ignoreDomains.some((d) => host === d || host.endsWith(`.${d}`));

  // The live URL of a repository's Pages site: the real one resolved at snapshot
  // time (custom domains included) or the default github.io address. Sites on a
  // retired domain are dropped altogether.
  function pagesURL(r) {
    const fallback = r.name.toLowerCase() === SELF_REPO ? `https://${OWNER}.github.io/` : `https://${OWNER}.github.io/${r.name}/`;
    const url = r.pages_url || fallback;
    try { return ignoredHost(new URL(url).hostname.toLowerCase()) ? null : url; } catch (e) { return null; }
  }
  const isSite = (r) => r.has_pages && r.name.toLowerCase() !== SELF_REPO && !!pagesURL(r);

  // A homepage link is shown only when it is a real http(s) URL, not the Pages
  // URL we already link to, and not on a domain listed as retired in SITE config.
  function safeHomepage(r) {
    if (!r.homepage) return null;
    let u;
    try { u = new URL(/^https?:\/\//i.test(r.homepage) ? r.homepage : `https://${r.homepage}`); } catch (e) { return null; }
    if (!/^https?:$/.test(u.protocol)) return null;
    const host = u.hostname.toLowerCase();
    // dev-only hosts (foo.local, localhost, 10.0.0.1) never make it to the page
    if (!host.includes('.') || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || /\.(local|localhost|test|internal|example|invalid|localdomain)$/.test(host)) return null;
    if (ignoredHost(host)) return null;
    const live = r.has_pages ? pagesURL(r) : null;
    if (live && trimSlash(u.href) === trimSlash(live)) return null;
    return u.href;
  }

  /* ---------- state, kept in the URL so filters are shareable ---------- */

  const SORTS = {
    stars: (a, b) => b.stargazers_count - a.stargazers_count || a.name.localeCompare(b.name),
    forks: (a, b) => b.forks_count - a.forks_count || a.name.localeCompare(b.name),
    updated: (a, b) => new Date(b.pushed_at) - new Date(a.pushed_at),
    name: (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }),
  };
  const state = { q: '', lang: '', sort: 'stars', forks: false, archived: false };

  function readURL() {
    const p = new URLSearchParams(location.search);
    state.q = p.get('q') || '';
    state.lang = p.get('lang') || '';
    state.sort = SORTS[p.get('sort')] ? p.get('sort') : 'stars';
    state.forks = p.get('forks') === '1';
    state.archived = p.get('archived') === '1';
  }
  function writeURL() {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.lang) p.set('lang', state.lang);
    if (state.sort !== 'stars') p.set('sort', state.sort);
    if (state.forks) p.set('forks', '1');
    if (state.archived) p.set('archived', '1');
    const qs = p.toString();
    history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : '') + location.hash);
  }

  /* ---------- rendering ---------- */

  const el = {
    eyebrow: $('#eyebrow'), lede: $('#lede'), topList: $('#top-list'),
    sitesGrid: $('#sites-grid'), sitesCount: $('#sites-count'),
    reposGrid: $('#repos-grid'), reposCount: $('#repos-count'),
    langbar: $('#langbar'), chips: $('#chips'), search: $('#search'), sort: $('#sort'),
    forks: $('#forks'), archived: $('#archived'), empty: $('#empty'), reset: $('#reset'),
    dataNote: $('#data-note'),
  };

  const io = ('IntersectionObserver' in window) && !reduceMotion
    ? new IntersectionObserver((entries) => {
        for (const en of entries) if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      }, { rootMargin: '0px 0px -6% 0px' })
    : null;
  function reveal(root) {
    const nodes = $$('.reveal:not(.in)', root);
    if (!io) { nodes.forEach((n) => n.classList.add('in')); return; }
    nodes.forEach((n) => io.observe(n));
  }

  function countUp(node, to) {
    // No animation for reduced motion, or when the tab is hidden (rAF is paused there).
    if (reduceMotion || document.hidden) { node.textContent = fmt(to); return; }
    const dur = 900, t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(2, -10 * p);
      node.textContent = fmt(Math.round(to * eased));
      if (p < 1) requestAnimationFrame(step); else node.textContent = fmt(to);
    };
    requestAnimationFrame(step);
  }

  function renderHero(data) {
    const { repos, profile } = data;
    const pub = repos.filter((r) => !r.private);
    const stats = {
      repos: pub.length,
      stars: pub.reduce((s, r) => s + r.stargazers_count, 0),
      forks: pub.reduce((s, r) => s + r.forks_count, 0),
      sites: repos.filter(isSite).length,
    };
    $$('[data-stat]').forEach((node) => countUp(node, stats[node.dataset.stat] || 0));
    if (profile) {
      const name = SITE.showName && profile.name ? profile.name : '';
      el.eyebrow.textContent = name ? `${name} · @${profile.login}` : `@${profile.login}`;
      if (profile.bio) el.lede.textContent = profile.bio;
    }
    if (el.dataNote) {
      el.dataNote.textContent = data.source === 'snapshot' && data.generatedAt
        ? `Snapshot of the GitHub API, refreshed ${timeAgo(data.generatedAt)}.`
        : 'Live from the GitHub API.';
    }
  }

  function topItem(r, i) {
    return `<li class="reveal" style="--i:${i}">
      <a class="top-item" href="${esc(r.html_url)}" target="_blank" rel="noopener">
        <span class="mark" style="background:${fingerprint(r.name).css}" aria-hidden="true">${esc(monogram(r.name))}</span>
        <span class="top-text">
          <span class="top-name">${esc(r.name)}</span>
          <span class="top-desc">${esc(r.description || 'No description yet.')}</span>
        </span>
        <span class="top-stars">${ICON.star} ${fmt(r.stargazers_count)}<span class="sr-only"> stars</span></span>
      </a>
    </li>`;
  }

  // The hero's shortlist: most-starred original work, independent of the repo filters.
  function renderTop(repos) {
    const top = repos.filter((r) => !r.private && !r.fork && !r.archived && r.stargazers_count > 0)
      .sort(SORTS.stars).slice(0, 5);
    el.topList.removeAttribute('aria-busy');
    el.topList.innerHTML = top.length ? top.map(topItem).join('') : '<li class="top-note">No starred repositories yet.</li>';
    reveal(el.topList);
  }

  function siteCard(r, i) {
    const url = pagesURL(r);
    const shown = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const lang = r.language ? `<span><i class="lang-dot" style="background:${langColor(r.language)}"></i>${esc(r.language)}</span>` : '';
    return `<article class="card site-card reveal" style="--i:${Math.min(i, 8)}">
      <div class="chrome" aria-hidden="true"><span class="dots"><i></i><i></i><i></i></span><span class="url">${esc(shown)}</span></div>
      <a class="shot-link" href="${esc(url)}" target="_blank" rel="noopener" aria-label="Open ${esc(r.name)}">${thumbnail(r.name)}</a>
      <div class="body">
        <h3><a href="${esc(url)}" target="_blank" rel="noopener">${esc(r.name)}</a></h3>
        <p>${esc(r.description || 'No description yet.')}</p>
        <div class="site-foot">
          <span class="repo-meta">${lang}${r.private
            ? `<span class="badge badge-lock" title="The source repository is private">${ICON.lock} Private source</span>`
            : `<span title="Stars">${ICON.star} ${fmt(r.stargazers_count)}</span>${r.fork ? '<span class="badge">Fork</span>' : ''}`}</span>
          <span class="actions">
            <a class="btn btn-sm btn-primary" href="${esc(url)}" target="_blank" rel="noopener">Open ${ICON.arrow}</a>
            ${r.private ? '' : `<a class="btn btn-sm" href="${esc(r.html_url)}" target="_blank" rel="noopener">Source</a>`}
          </span>
        </div>
      </div>
    </article>`;
  }

  function repoCard(r, i, animate) {
    const fp = fingerprint(r.name);
    const badges = [
      r.has_pages && pagesURL(r) && `<a class="badge badge-live" href="${esc(pagesURL(r))}" target="_blank" rel="noopener" title="Open the GitHub Pages site">Live</a>`,
      r.fork && '<span class="badge">Fork</span>',
      r.archived && '<span class="badge">Archived</span>',
      r.is_template && '<span class="badge">Template</span>',
    ].filter(Boolean).join('');
    const topics = r.topics.slice(0, 3).map((t) => `<span class="topic">${esc(t)}</span>`).join('');
    const home = safeHomepage(r);
    const pushed = new Date(r.pushed_at);
    return `<article class="card repo-card${animate ? ' reveal' : ''}" style="--i:${Math.min(i, 12)}">
      <div class="repo-head">
        <span class="mark" style="background:${fp.css}" aria-hidden="true">${esc(monogram(r.name))}</span>
        <div class="repo-title">
          <a class="repo-name" href="${esc(r.html_url)}" target="_blank" rel="noopener">${esc(r.name)}</a>
          ${badges ? `<div class="badges">${badges}</div>` : ''}
        </div>
      </div>
      <p class="repo-desc">${esc(r.description || 'No description yet.')}</p>
      ${topics ? `<div class="topics">${topics}</div>` : ''}
      <div class="repo-meta">
        ${r.language ? `<span><i class="lang-dot" style="background:${langColor(r.language)}"></i>${esc(r.language)}</span>` : ''}
        <span title="Stars">${ICON.star} ${fmt(r.stargazers_count)}</span>
        <span title="Forks">${ICON.fork} ${fmt(r.forks_count)}</span>
        ${home ? `<a class="meta-link" href="${esc(home)}" target="_blank" rel="noopener">${ICON.link} website</a>` : ''}
        <time datetime="${esc(r.pushed_at)}" title="Last push: ${dateFmt.format(pushed)}">${timeAgo(r.pushed_at)}</time>
      </div>
    </article>`;
  }

  function renderSites(repos) {
    const sites = repos.filter(isSite).sort(SORTS.stars);
    el.sitesGrid.removeAttribute('aria-busy');
    el.sitesCount.textContent = `${sites.length} live`;
    if (!sites.length) {
      el.sitesGrid.innerHTML = '<div class="notice"><p>No GitHub Pages sites yet.</p></div>';
      return;
    }
    el.sitesGrid.innerHTML = sites.map(siteCard).join('');
    reveal(el.sitesGrid);
  }

  function baseList(repos) {
    return repos.filter((r) => !r.private && (state.forks || !r.fork) && (state.archived || !r.archived));
  }

  function renderLanguages(repos) {
    const base = baseList(repos);
    const counts = new Map();
    for (const r of base) counts.set(langOf(r), (counts.get(langOf(r)) || 0) + 1);
    const langs = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (state.lang && !counts.has(state.lang)) state.lang = '';

    el.langbar.classList.toggle('has-filter', !!state.lang);
    el.langbar.innerHTML = langs.map(([l, n]) => {
      const pct = Math.round((n / base.length) * 100);
      return `<button type="button" data-lang="${esc(l)}" aria-pressed="${state.lang === l}" style="--w:${n};background:${langColor(l)}" title="${esc(l)}: ${n} ${n === 1 ? 'repository' : 'repositories'} (${pct}%)"><span class="sr-only">${esc(l)}</span></button>`;
    }).join('');

    el.chips.innerHTML = [`<button type="button" class="chip" data-lang="" aria-pressed="${!state.lang}">All <small>${base.length}</small></button>`]
      .concat(langs.map(([l, n]) => `<button type="button" class="chip" data-lang="${esc(l)}" aria-pressed="${state.lang === l}"><i class="lang-dot" style="background:${langColor(l)}"></i>${esc(l)} <small>${n}</small></button>`))
      .join('');
    el.chips.classList.toggle('is-scrollable', el.chips.scrollWidth > el.chips.clientWidth + 4);
  }

  function renderRepos(repos, animate) {
    const base = baseList(repos);
    const q = state.q.trim().toLowerCase();
    let list = base;
    if (state.lang) list = list.filter((r) => langOf(r) === state.lang);
    if (q) list = list.filter((r) => [r.name, r.description, r.language, ...r.topics].filter(Boolean).join(' ').toLowerCase().includes(q));
    list = list.slice().sort(SORTS[state.sort]);

    el.reposCount.textContent = list.length === base.length ? `${base.length} public` : `${list.length} of ${base.length}`;
    el.empty.hidden = list.length > 0;
    el.reposGrid.removeAttribute('aria-busy');
    el.reposGrid.innerHTML = list.map((r, i) => repoCard(r, i, animate)).join('');
    if (animate) reveal(el.reposGrid);
  }

  function renderError(err) {
    const limited = err && (err.status === 403 || err.status === 429);
    const msg = limited
      ? 'The GitHub API rate limit for your network was reached. Try again in a bit, or browse straight on GitHub.'
      : 'Could not load repositories from GitHub right now.';
    const html = `<div class="notice"><p>${esc(msg)}</p><a class="btn btn-sm" href="https://github.com/${esc(OWNER)}?tab=repositories" target="_blank" rel="noopener">Open github.com/${esc(OWNER)} ${ICON.arrow}</a></div>`;
    el.topList.innerHTML = '<li class="top-note">Could not load repositories right now.</li>';
    el.sitesGrid.innerHTML = html;
    el.reposGrid.innerHTML = html;
    $$('[aria-busy]').forEach((n) => n.removeAttribute('aria-busy'));
    el.sitesCount.textContent = '';
    el.reposCount.textContent = '';
    console.error(err);
  }

  /* ---------- wiring ---------- */

  let DATA = null;

  function refresh() {
    if (!DATA) return;
    writeURL();
    renderLanguages(DATA.repos);
    renderRepos(DATA.repos, false);
  }

  function syncControls() {
    el.search.value = state.q;
    el.sort.value = state.sort;
    el.forks.setAttribute('aria-checked', String(state.forks));
    el.archived.setAttribute('aria-checked', String(state.archived));
  }

  function bind() {
    el.search.addEventListener('input', () => { state.q = el.search.value; refresh(); });
    el.sort.addEventListener('change', () => { state.sort = el.sort.value; refresh(); });
    for (const key of ['forks', 'archived']) {
      el[key].addEventListener('click', () => { state[key] = !state[key]; el[key].setAttribute('aria-checked', String(state[key])); refresh(); });
    }
    const pickLang = (e) => {
      const b = e.target.closest('[data-lang]');
      if (!b) return;
      state.lang = state.lang === b.dataset.lang ? '' : b.dataset.lang;
      refresh();
    };
    el.chips.addEventListener('click', pickLang);
    el.langbar.addEventListener('click', pickLang);
    el.reset.addEventListener('click', () => {
      Object.assign(state, { q: '', lang: '', sort: 'stars' });
      syncControls();
      refresh();
      el.search.focus();
    });

    document.addEventListener('keydown', (e) => {
      const typing = /^(input|textarea|select)$/i.test(document.activeElement?.tagName || '');
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); el.search.focus(); el.search.select(); }
      if (e.key === 'Escape' && document.activeElement === el.search) {
        if (el.search.value) { state.q = ''; el.search.value = ''; refresh(); } else el.search.blur();
      }
    });

    // pointer spotlight on cards
    if (matchMedia('(hover: hover)').matches) {
      document.addEventListener('pointermove', (e) => {
        const card = e.target.closest && e.target.closest('.card');
        if (!card) return;
        const b = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - b.left}px`);
        card.style.setProperty('--my', `${e.clientY - b.top}px`);
      }, { passive: true });
    }

    // sticky nav border once the page scrolls
    const nav = $('.nav');
    const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > 8);
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // theme
    const themeBtn = $('#theme');
    const themeMeta = $('meta[name="theme-color"]');
    const applyTheme = (t, persist) => {
      document.documentElement.dataset.theme = t;
      if (themeMeta) themeMeta.content = t === 'dark' ? '#0b0d12' : '#f6f7f9';
      themeBtn.setAttribute('aria-label', `Switch to ${t === 'dark' ? 'light' : 'dark'} theme`);
      if (persist) try { localStorage.setItem('theme', t); } catch (e) { /* ignore */ }
    };
    applyTheme(document.documentElement.dataset.theme || 'dark', false);
    themeBtn.addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true));
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
      let chosen = null;
      try { chosen = localStorage.getItem('theme'); } catch (err) { /* ignore */ }
      if (!chosen) applyTheme(e.matches ? 'light' : 'dark', false);
    });

    addEventListener('resize', () => el.chips.classList.toggle('is-scrollable', el.chips.scrollWidth > el.chips.clientWidth + 4), { passive: true });
  }

  async function main() {
    readURL();
    syncControls();
    bind();
    try {
      DATA = await loadData();
    } catch (err) {
      renderError(err);
      return;
    }
    el.archived.hidden = !DATA.repos.some((r) => !r.private && r.archived);
    el.forks.hidden = !DATA.repos.some((r) => !r.private && r.fork);
    renderHero(DATA);
    renderTop(DATA.repos);
    renderSites(DATA.repos);
    renderLanguages(DATA.repos);
    renderRepos(DATA.repos, true);
    writeURL();
  }

  main();
})();
