import { chromium } from 'playwright';
const b = await chromium.launch();
const page = await b.newPage({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, deviceScaleFactor:3 });
await page.goto('https://www.thepicklehub.net/vi', { waitUntil:'load', timeout:120000 });
await page.waitForTimeout(9000);
const out = await page.evaluate(() => {
  const sec = document.querySelector('.tl-live-sec');
  if (!sec) return null;
  const walk = (el, d=0) => {
    const r = el.getBoundingClientRect();
    const cls = (el.className||'').toString().split(' ').filter(c=>c.startsWith('tl-')).join('.');
    const rows = [`${'  '.repeat(d)}${el.tagName}.${cls}  h=${Math.round(r.height)}`];
    if (d < 3) for (const c of el.children) rows.push(...walk(c, d+1));
    return rows;
  };
  return { total: Math.round(sec.getBoundingClientRect().height), tree: walk(sec).join('\n') };
});
console.log('RESOLVED .tl-live-sec total h =', out.total);
console.log(out.tree);
await b.close();
