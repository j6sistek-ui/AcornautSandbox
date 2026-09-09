#!/usr/bin/env node
// Actual menu UI in an isolated browser profile; never reads a player's save.
// --serve provides docs at :8782 and the pinned pre-change baseline at /baseline/.
// ACORNAUT_BASELINE can select another explicit baseline commit for a later review.
// ACORNAUT_PLAYWRIGHT / ACORNAUT_BROWSER can use existing bundled tooling.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = process.env.ACORNAUT_QA_OUTPUT || root + 'illustrated-src/design/loadout-neon/';
const baseline = process.argv.includes('--baseline');
const base = process.env.ACORNAUT_QA_URL || 'http://127.0.0.1:8782/';
const baselineCommit = execFileSync('git', ['rev-parse', process.env.ACORNAUT_BASELINE || 'd296e6bc404aaec14221a8b79186132fb4426dea'], { cwd: root, encoding: 'utf8' }).trim();
mkdirSync(out, { recursive: true });
if (process.argv.includes('--serve')) {
  const cached = new Map();
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm' };
  createServer((req, res) => {
    try {
      let name = decodeURIComponent(new URL(req.url, base).pathname);
      const old = name.startsWith('/baseline/');
      if (old) name = name.slice('/baseline'.length);
      if (name.endsWith('/')) name += 'index.html';
      const file = resolve(root, 'docs', '.' + name);
      if (!file.startsWith(resolve(root, 'docs') + '/')) {
        const normalized = file.replaceAll('\\', '/');
        if (!normalized.startsWith(resolve(root, 'docs').replaceAll('\\', '/') + '/')) throw Error('outside docs');
      }
      let bytes;
      if (old && (name.endsWith('.html') || name.endsWith('.js'))) {
        if (!cached.has(name)) cached.set(name, execFileSync('git', ['show', `${baselineCommit}:docs${name}`], { cwd: root, maxBuffer: 16 * 1024 * 1024 }));
        bytes = cached.get(name);
      } else bytes = readFileSync(file);
      res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(bytes);
    } catch { res.writeHead(404); res.end('not found'); }
  }).listen(8782, '127.0.0.1', () => console.log(`Loadout QA server: ${base}; baseline ${baselineCommit}`));
} else {
  const spec = process.env.ACORNAUT_PLAYWRIGHT || 'playwright';
  const { chromium } = await import(spec.includes(':') && !spec.startsWith('file:') ? pathToFileURL(spec).href : spec);
  const browser = await chromium.launch({ headless: true, ...(process.env.ACORNAUT_BROWSER ? { executablePath: process.env.ACORNAUT_BROWSER } : {}) });
  const errors = [], failedArt = [], receipts = [], interactions = [], builds = [];
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('response', r => { if (/\/art\//.test(r.url()) && r.status() >= 400) failedArt.push([r.status(), r.url()]); });

  async function open(channel = '') {
    const address = new URL(baseline ? 'baseline/' : channel, base).href;
    await page.goto(address, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__sandbox, { timeout: 60000 });
    await page.evaluate(async () => { await window.__sandbox.artReady; window.__sandbox.stop(); });
    const catalogUrl = await page.evaluate(() => {
      const module = [...document.querySelectorAll('script[type="module"]')].find(s => /standalone/.test(s.src || s.textContent));
      const src = module.src || module.textContent.match(/import\("([^"]+standalone\.js)"\)/)[1];
      return new URL(src, location.href).href.replace(/standalone\.js/, 'catalog.js');
    });
    builds.push({ address, catalogUrl });
    await page.evaluate(async url => {
      const C = await import(url), e = window.__sandbox;
      Object.assign(e.save, { tutorialDone: true, guide: 'done', introOff: true, musicOff: true, sfxOff: true,
        motionOff: false, allStars: true, heroExpanded: true, shelfGrid: true, favorites: [], noPalFx: false,
        acorns: 77, equippedSuit: 'eclipse', equipped: 'clear', equippedTrail: 'sparks', equippedPal: 'none', equippedPal2: 'none',
        unlocked: C.HELMETS.map(x => x.id), unlockedSuits: C.SUITS.map(x => x.id),
        unlockedTrails: C.TRAILS.map(x => x.id), unlockedPals: C.PALS.map(x => x.id),
        purchased: [...C.HELMETS, ...C.SUITS, ...C.TRAILS, ...C.PALS].map(x => x.id) });
      // Opening settles the synthetic star reward ledger once. Then fix
      // balances for a simple reference fixture and verify equips are free.
      e.open('hangar'); e.save.acorns = 77; e.save.starDust = 0; e.setShopTab('suits');
    }, catalogUrl);
    await page.waitForSelector('.ac-hangarcase canvas');
    await page.waitForTimeout(600);
    return catalogUrl;
  }
  async function measure(label) {
    const result = await page.evaluate(() => {
      const menu = document.querySelector('.ac-loadout') || document.querySelector('.ac-hangarcase').parentElement;
      const stage = document.querySelector('.ac-hangarcase'), canvas = stage.querySelector('canvas'), scroll = menu.querySelector('.ac-sheet-scroll');
      const dims = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right }; };
      const cs = getComputedStyle(stage), bg = getComputedStyle(menu, '::before'), rgba = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      return { viewport: { width: innerWidth, height: innerHeight }, menu: dims(menu), stage: dims(stage), canvas: dims(canvas), scroll: { ...dims(scroll), scrollHeight: scroll.scrollHeight, clientHeight: scroll.clientHeight },
        tabs: [...menu.querySelectorAll('.ac-cat')].map(x => x.textContent), stageBorder: cs.borderTopWidth, stageShadow: cs.boxShadow, stageBackground: cs.backgroundImage,
        background: bg.backgroundImage, backgroundFilter: bg.filter, glow: getComputedStyle(menu).getPropertyValue('--loadout-glow'),
        documentWidth: document.documentElement.scrollWidth, canvasPaintedPixels: rgba.filter((v, i) => i % 4 === 3 && v > 0).length,
        images: [...menu.querySelectorAll('img')].filter(x => x.complete && x.naturalWidth === 0).map(x => x.src),
        activeTabs: [...menu.querySelectorAll('.ac-cat[aria-pressed="true"]')].map(x => x.textContent) };
    });
    const file = label + '.png'; await page.screenshot({ path: out + file });
    assert.deepEqual(result.tabs, ['SUITS', 'HELMETS', 'TRAILS', 'PALS', 'SHIP']);
    assert.equal(result.activeTabs.length, 1);
    assert(result.canvasPaintedPixels > 1000, `${label}: live canvas blank`);
    assert(result.documentWidth <= result.viewport.width + 1, `${label}: page overflow`);
    assert(result.menu.right <= result.viewport.width + 1, `${label}: menu overflow`);
    assert(result.scroll.clientHeight >= 100, `${label}: shelf has no usable height (${JSON.stringify(result.scroll)})`);
    if (!baseline) assert(Math.abs(result.scroll.bottom - result.viewport.height) <= 1, `${label}: shelf leaves unused viewport height`);
    assert.deepEqual(result.images, [], `${label}: failed visible images`);
    if (!baseline) {
      assert.equal(result.stageBorder, '0px');
      assert.equal(result.stageShadow, 'none');
      assert.equal(result.stageBackground, 'none');
    }
    receipts.push({ label, file, ...result });
    return result;
  }
  async function semanticInventory(catalogUrl) {
    const catalog = await page.evaluate(async url => {
      const C = await import(url);
      return JSON.parse(JSON.stringify({ suits: C.SUITS, helmets: C.HELMETS, trails: C.TRAILS, pals: C.PALS }));
    }, catalogUrl);
    const tabs = {};
    for (const tab of ['suits', 'helmets', 'trails', 'pals', 'ship']) {
      await page.locator(`[data-focus="tab:${tab}"]`).click();
      tabs[tab] = await page.evaluate(() => {
        const menu = document.querySelector('.ac-hangarcase').parentElement;
        const clean = value => (value || '').replace(/\s+/g, ' ').trim();
        return [...menu.querySelectorAll('button,[role="button"],[role="switch"]')].map(el => ({
          focus: el.dataset.focus || '', text: clean(el.textContent), ariaLabel: el.getAttribute('aria-label'),
          title: el.getAttribute('title'), disabled: !!el.disabled, role: el.getAttribute('role'),
          pressed: el.getAttribute('aria-pressed'), checked: el.getAttribute('aria-checked'),
          clickHandler: el.onclick ? clean(el.onclick.toString()) : null,
        }));
      });
    }
    await page.locator('[data-focus="tab:suits"]').click();
    return { catalog, tabs };
  }
  async function scrollToEnd(label) {
    await page.locator('.ac-shopbanner').scrollIntoViewIfNeeded();
    const result = await page.locator('.ac-shopbanner').evaluate(el => { const r = el.getBoundingClientRect(); return { text: el.textContent, top: r.top, bottom: r.bottom, viewport: innerHeight }; });
    assert(result.top >= 0 && result.bottom <= result.viewport + 1, `${label}: final content unreachable`);
    interactions.push({ label: label + '-last-content', ...result });
  }
  async function equip(id) {
    await page.locator('[data-focus="tab:suits"]').click();
    await page.locator(`[data-focus="suit:${id}"]`).first().click();
    await page.waitForFunction(id => window.__sandbox.save.equippedSuit === id, id);
    await page.evaluate(() => { document.querySelector('.ac-sheet-scroll').scrollTop = 0; });
    await page.waitForTimeout(450);
  }
  try {
    const catalogUrl = await open();
    const inventory = await semanticInventory(catalogUrl);
    if (baseline) {
      await measure('baseline-mobile390-expanded');
      await page.locator('.ac-casefold').click();
      await measure('baseline-mobile390-compact');
    } else {
      const before = JSON.parse(readFileSync(out + 'baseline-verification.json', 'utf8'));
      assert.equal(before.baselineCommit, baselineCommit, 'baseline receipt belongs to a different commit');
      assert.deepEqual(inventory, before.inventory, 'current main catalog or existing menu control semantics changed');
      interactions.push({ label: 'current-main-content-preserved', baselineCommit, catalogCounts: Object.fromEntries(Object.entries(inventory.catalog).map(([kind, items]) => [kind, items.length])), buttonCounts: Object.fromEntries(Object.entries(inventory.tabs).map(([tab, buttons]) => [tab, buttons.length])) });
      for (const [label, width, height] of [['mobile390', 390, 844], ['landscape844', 844, 390], ['desktop1440', 1440, 900], ['mobile320', 320, 568]]) {
        await page.setViewportSize({ width, height });
        await page.evaluate(() => { const e = window.__sandbox; e.setHeroExpanded(true); e.setShopTab('suits'); e.setShelfGrid(true); });
        await equip('eclipse');
        await measure(label + '-expanded');
        await scrollToEnd(label + '-expanded');
        await page.locator('.ac-casefold').click();
        await page.evaluate(() => { document.querySelector('.ac-sheet-scroll').scrollTop = 0; });
        await measure(label + '-compact');
        for (const tab of ['helmets', 'trails', 'pals', 'ship']) {
          await page.locator(`[data-focus="tab:${tab}"]`).click();
          await page.waitForTimeout(100);
          await scrollToEnd(label + '-' + tab);
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(() => { window.__sandbox.setHeroExpanded(true); window.__sandbox.setShopTab('suits'); });
      for (const id of ['verdant', 'cryostar', 'copper']) { await equip(id); await measure('mobile390-' + id); }
      const colors = receipts.filter(x => /^mobile390-(verdant|cryostar|copper)$/.test(x.label)).map(x => x.glow);
      assert.equal(new Set(colors).size, 3, 'suit background variables did not change');
      const frame1 = await page.locator('.ac-hangarcase canvas').evaluate(c => c.toDataURL());
      await page.waitForTimeout(160);
      const frame2 = await page.locator('.ac-hangarcase canvas').evaluate(c => c.toDataURL());
      assert.notEqual(frame1, frame2, 'preview animation stopped'); interactions.push({ label: 'pilot-animation', differentFrames: true });
      for (const [id, headTag, trailName] of [
        ['porcelain', 'SOVEREIGN SHELL · ALWAYS ON', 'Cobalt Filigree'],
        ['nacre', 'HELMETLESS BY DESIGN', 'Pearl Tide'],
        ['origamist', 'FACET SHELL · ALWAYS ON', 'Foldspace Ribbon'],
      ]) {
        await equip(id);
        const image = await measure('mobile390-' + id);
        assert.equal(await page.locator('.ac-casetag').textContent(), headTag);
        const firstFrame = await page.locator('.ac-hangarcase canvas').evaluate(c => c.toDataURL());
        await page.waitForTimeout(180);
        const secondFrame = await page.locator('.ac-hangarcase canvas').evaluate(c => c.toDataURL());
        assert.notEqual(firstFrame, secondFrame, `${id}: preview animation stopped`);
        const beforeHelmet = await page.evaluate(() => window.__sandbox.save.equipped);
        await page.locator('[data-focus="tab:helmets"]').click();
        const helmetNote = await page.locator('.ac-lockednote').textContent();
        assert(helmetNote.includes(id === 'nacre' ? 'Helmetless by design' : id === 'porcelain' ? 'Sovereign Shell' : 'Facet Shell'));
        await page.locator('[data-focus="helm:ion"]').first().click();
        assert.equal(await page.evaluate(() => window.__sandbox.save.equipped), beforeHelmet);
        assert.equal(await page.locator('.ac-casetag').textContent(), headTag);
        await page.locator('[data-focus="tab:trails"]').click();
        const trail = page.locator('.ac-builtintrail');
        assert.equal(await trail.count(), 1); assert(await trail.isDisabled());
        assert((await trail.textContent()).includes(trailName));
        assert(await page.locator('[data-focus="trail:ion"]').first().isDisabled());
        const worn = await page.evaluate(async url => { const C = await import(url), s = window.__sandbox.save; return C.trailWornBy(s.equippedTrail, s.equippedSuit); }, catalogUrl);
        assert.equal(worn, id + 'wake');
        assert.equal(await page.evaluate(() => window.__sandbox.save.equippedTrail), 'sparks');
        interactions.push({ label: 'merged-suit-' + id, glow: image.glow, paintedPixels: image.canvasPaintedPixels, animated: true, headTag, helmetNote, attemptedHelmetChangeIgnored: true, builtInTrail: worn, trailName, normalTrailDisabled: true, rememberedTrail: 'sparks' });
      }
      assert.equal(new Set(receipts.filter(x => /^mobile390-(porcelain|nacre|origamist)$/.test(x.label)).map(x => x.glow)).size, 3);
      await equip('copper');
      await page.locator('.ac-casefold').click();
      await page.locator('[title="Side-scrolling rows"]').click();
      assert.equal(await page.locator('.ac-grid.ac-asgrid').count(), 0);
      await measure('mobile390-shelf-rows');
      await page.locator('[title="Grid"]').click();
      assert.equal(await page.locator('.ac-grid.ac-asgrid').count(), 1);
      await page.locator('[data-focus="tab:helmets"]').click();
      await page.locator('[data-focus="helm:ion"]').first().click();
      assert.equal(await page.evaluate(() => window.__sandbox.save.equipped), 'ion');
      await page.locator('[data-focus="tab:trails"]').click();
      await page.locator('[data-focus="trail:ion"]').first().click();
      assert.equal(await page.evaluate(() => window.__sandbox.save.equippedTrail), 'ion');
      await page.locator('[data-focus="tab:pals"]').click();
      await page.locator('[data-focus="pal:wisp"]').click();
      assert.equal(await page.evaluate(() => window.__sandbox.save.equippedPal), 'wisp');
      await page.locator('[data-focus="mod:noPalFx"]').click();
      assert.equal(await page.locator('[data-focus="mod:noPalFx"]').getAttribute('aria-checked'), 'true');
      await page.locator('[data-focus="mod:noPalFx"]').click();
      assert.equal(await page.locator('[data-focus="mod:noPalFx"]').getAttribute('aria-checked'), 'false');
      await page.locator('[data-focus="tab:ship"]').click();
      await page.locator('[data-ship-tier="plating-2"]').click();
      assert.equal(await page.locator('[data-ship-tier="plating-2"]').getAttribute('aria-pressed'), 'true');
      await page.getByRole('button', { name: 'SHOW LAUNCH SHIP', exact: true }).click();
      assert.equal(await page.locator('[data-ship-tier="plating-0"]').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.evaluate(() => window.__sandbox.save.acorns), 77);
      interactions.push({ label: 'existing-equip-controls', helmet: 'ion', trail: 'ion', pal: 'wisp', palEffectsSwitch: 'toggle and restore', shipPreview: 'plating II and reset', acorns: 77 });
      await page.evaluate(() => { const e = window.__sandbox; e.save.equippedPal = 'none'; e.save.equipped = 'clear'; e.save.equippedTrail = 'sparks'; e.setHeroExpanded(true); e.setShopTab('suits'); });
      for (const id of ['eclipse', 'verdant', 'cryostar', 'gemmie', 'seraph', 'copper']) {
        await page.locator(`[data-focus="suit:${id}"] .ac-favbtn`).first().click();
      }
      await equip('eclipse');
      await measure('mobile390-existing-favorites');
      await page.setViewportSize({ width: 320, height: 568 });
      await page.evaluate(() => { const e = window.__sandbox; e.save.acorns = 20017; e.save.starDust = 545; e.setShopTab('suits'); });
      await measure('mobile320-high-balances');
      const header = await page.evaluate(() => {
        const a = document.querySelector('.ac-menuheadtext').getBoundingClientRect(), b = document.querySelector('.ac-headaside').getBoundingClientRect();
        return { titleBottom: a.bottom, balancesTop: b.top, titleRight: a.right, balancesRight: b.right, width: innerWidth };
      });
      assert(header.titleBottom <= header.balancesTop && header.titleRight <= header.width && header.balancesRight <= header.width, 'narrow title or balances overlap');
      interactions.push({ label: 'narrow-high-balances', ...header });
      await page.locator('.ac-casefold').focus(); await page.keyboard.press('Tab');
      const focus = await page.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e); return { focusedControl: e.textContent, visible: e.matches(':focus-visible'), outline: s.outlineStyle, width: s.outlineWidth }; });
      assert(focus.visible && focus.outline === 'solid' && focus.width === '2px', 'keyboard focus not visible');
      await page.screenshot({ path: out + 'mobile320-keyboard-focus.png' });
      interactions.push({ label: 'keyboard-focus', ...focus, file: 'mobile320-keyboard-focus.png' });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(() => window.__sandbox.open('shop'));
      await page.waitForSelector('.ac-shopcase');
      const shop = await page.locator('.ac-shopcase').evaluate(el => { const s = getComputedStyle(el); return { border: s.borderTopWidth, shadow: s.boxShadow, background: s.backgroundImage, loadoutClass: !!el.closest('.ac-loadout') }; });
      assert(shop.border !== '0px' && shop.shadow !== 'none' && shop.background !== 'none' && !shop.loadoutClass, 'Shop display case styling changed');
      await page.screenshot({ path: out + 'shop-existing-case.png' });
      interactions.push({ label: 'shop-keeps-existing-case', ...shop, file: 'shop-existing-case.png' });
      await open('beta/');
      await measure('beta-mobile390-expanded');
      await page.locator('.ac-casefold').click(); await measure('beta-mobile390-compact');
      for (const tab of ['helmets', 'trails', 'pals', 'ship']) { await page.locator(`[data-focus="tab:${tab}"]`).click(); await scrollToEnd('beta-' + tab); }
    }
    assert.deepEqual(errors, []); assert.deepEqual(failedArt, []);
    writeFileSync(out + (baseline ? 'baseline-verification.json' : 'browser-verification.json'), JSON.stringify({ profile: 'isolated Playwright browser, synthetic owned wardrobe; no installed save accessed', baseline, baselineCommit, builds, inventory, receipts, interactions, errors, failedArt }, null, 2) + '\n');
    console.log(`${baseline ? 'Baseline' : 'Loadout'}: ${receipts.length} screenshots; ${interactions.length} interaction checks passed; no page errors or failed art`);
  } finally { await browser.close(); }
}
