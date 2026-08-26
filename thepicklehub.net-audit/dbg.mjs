import { chromium } from 'playwright';
const b = await chromium.launch();
const page = await b.newPage({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
await page.addInitScript(() => { try { localStorage.setItem('tph.home-live-lead', JSON.stringify({leads:true, at:Date.now()})); } catch {} });
let n=0;
await page.route('**/rest/v1/livestreams*', async r => { n++; await new Promise(x=>setTimeout(x,30000)); await r.abort(); });
page.on('console', m => { if (m.type()==='error') console.log('CONSOLE ERR:', m.text().slice(0,140)); });
await page.goto(process.argv[2], { waitUntil:'domcontentloaded', timeout:90000 });
await page.waitForTimeout(6000);
const info = await page.evaluate(() => {
  const root = document.querySelector('.tl-scroll');
  return { hasRoot: !!root,
    kids: root ? [...root.children].map(e=>`${e.tagName}.${(e.className||'').toString().split(' ').filter(c=>c.startsWith('tl-')).join('.')} h=${Math.round(e.getBoundingClientRect().height)}`) : [],
    bodyLen: document.body.innerText.length };
});
console.log('livestream requests intercepted:', n);
console.log(JSON.stringify(info, null, 1));
await b.close();
