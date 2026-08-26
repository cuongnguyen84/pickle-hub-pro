import { chromium } from 'playwright';

const URL = process.argv[2] || 'https://www.thepicklehub.net/vi';
const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const page = await ctx.newPage();

const fontReqs = [];
page.on('response', r => { if (/\.woff2?(\?|$)/.test(r.url())) fontReqs.push({url: r.url().split('/').pop(), status: r.status()}); });

await page.goto(URL, { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForTimeout(2500);

const out = await page.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { sel, fontFamily: cs.fontFamily, fontSize: cs.fontSize, h: Math.round(r.height) };
  };
  const secs = [...document.querySelectorAll('.tl-scroll > section.tl-section')].map((el, i) => {
    const h2 = el.querySelector('h2');
    return {
      i,
      h: Math.round(el.getBoundingClientRect().height),
      cls: el.className,
      heading: (h2?.textContent || '').trim().slice(0, 45),
    };
  });
  return {
    body: pick('body'),
    h1: pick('h1'),
    p: pick('.tl-story-summary') || pick('p'),
    h2: pick('.tl-sec-head h2'),
    sections: secs,
    storiesGridChildren: document.querySelectorAll('.tl-stories-grid > *').length,
    hasCta: !!document.querySelector('.tl-stories-grid')?.parentElement?.querySelector('.tl-btn'),
  };
});

console.log(JSON.stringify({ url: URL, fonts: fontReqs, ...out }, null, 1));
await b.close();
