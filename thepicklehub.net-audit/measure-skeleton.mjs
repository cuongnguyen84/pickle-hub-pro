import { chromium } from 'playwright';
const b = await chromium.launch();
const page = await b.newPage({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, deviceScaleFactor:3 });
// stall the livestream queries so the skeleton stays rendered
await page.route('**/rest/v1/public_livestreams*', async r => { await new Promise(x=>setTimeout(x,25000)); await r.abort(); });
await page.addInitScript(() => { try { localStorage.setItem('tph.home-live-lead', JSON.stringify({leads:true, at:Date.now()})); } catch {} });
await page.goto(process.argv[2], { waitUntil:'domcontentloaded', timeout:90000 });
await page.waitForSelector('.tl-live-sec', { timeout:25000 }).catch(()=>{});
await page.evaluate(()=>document.fonts.ready);
await page.waitForTimeout(1500);
const r = await page.evaluate(() => {
  const s = document.querySelector('.tl-live-sec');
  if (!s) return null;
  const kid = (sel) => { const e = s.querySelector(sel); return e ? Math.round(e.getBoundingClientRect().height) : null; };
  return { total: Math.round(s.getBoundingClientRect().height),
           head: kid('.tl-live-head'), main: kid('.tl-live-main'),
           thumb: kid('.tl-live-main-thumb'), body: kid('.tl-live-main-body'),
           list: kid('.tl-live-list') };
});
console.log('SKELETON', JSON.stringify(r));
console.log('RESOLVED (measured on production /vi): {"total":598,"head":44,"main":354,"thumb":223,"body":130,"list":85}');
if (r) console.log(`DELTA total = ${r.total - 598}px`);
await b.close();
