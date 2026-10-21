import { chromium } from 'playwright';
const b = await chromium.launch();

// ---------- 1) empirical font metrics: Inter vs the real fallback ----------
{
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('https://www.thepicklehub.net/vi', { waitUntil: 'load', timeout: 90000 });
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(3000);
  const m = await page.evaluate(async () => {
    const SAMPLES = {
      latin: 'The quick brown fox jumps over the lazy dog 0123456789',
      vi: 'Giải đấu pickleball Việt Nam — sân bãi, lịch thi đấu và bảng xếp hạng DUPR',
    };
    const measure = (text, family, size = 16) => {
      const c = document.createElement('canvas').getContext('2d');
      c.font = `${size}px ${family}`;
      return c.measureText(text).width;
    };
    const out = {};
    for (const [k, text] of Object.entries(SAMPLES)) {
      const inter = measure(text, 'Inter');
      const fallbacks = {};
      for (const fb of ['-apple-system', 'system-ui', 'Helvetica', 'Arial', 'sans-serif'])
        fallbacks[fb] = measure(text, `"${fb}"`);
      out[k] = { inter, fallbacks,
        ratio: Object.fromEntries(Object.entries(fallbacks).map(([f, w]) => [f, +(inter / w).toFixed(4)])) };
    }
    // line box height of Inter vs fallback at the real body size
    const probe = (family) => {
      const d = document.createElement('div');
      d.style.cssText = `position:absolute;visibility:hidden;font:13.5px ${family};line-height:normal;width:300px`;
      d.textContent = SAMPLES.vi;
      document.body.appendChild(d);
      const h = d.getBoundingClientRect().height;
      d.remove(); return h;
    };
    out.lineBox = { inter: probe('Inter'), appleSystem: probe('-apple-system'), systemUi: probe('system-ui') };
    return out;
  });
  console.log('=== EMPIRICAL FONT METRICS ===');
  console.log(JSON.stringify(m, null, 1));
  await page.close();
}

// ---------- 2) skeleton height vs resolved height ----------
{
  const page = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  // stall the VI blog posts query so the skeleton stays on screen
  await page.route('**/rest/v1/vi_blog_posts*', async route => {
    await new Promise(r => setTimeout(r, 12000));
    await route.continue();
  });
  await page.goto('https://www.thepicklehub.net/vi', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('.tl-editorial-skeleton', { timeout: 20000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(3000);
  await page.waitForTimeout(1200);
  const skel = await page.evaluate(() => {
    const el = document.querySelector('.tl-editorial-skeleton');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { h: Math.round(r.height), stories: el.querySelectorAll('.tl-stories-grid > *').length,
             hasCta: !!el.querySelector('.tl-btn') };
  });
  console.log('\n=== SKELETON (VI editorial) ===');
  console.log(JSON.stringify(skel));
  await page.close();
}
await b.close();
