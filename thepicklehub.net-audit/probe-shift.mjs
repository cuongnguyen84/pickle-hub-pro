import { chromium } from 'playwright';
const URL = process.argv[2];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, deviceScaleFactor:3,
  userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36' });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions',{offline:false,downloadThroughput:1.6*1024*1024/8,uploadThroughput:750*1024/8,latency:150});
await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});

await page.addInitScript(() => {
  window.__snaps = []; window.__shifts = [];
  new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__shifts.push({v:e.value,t:Math.round(e.startTime)}); })
    .observe({type:'layout-snapshot'in window?'layout-shift':'layout-shift', buffered:true});
  const snap = () => {
    const root = document.querySelector('.tl-scroll');
    if (!root) return;
    window.__snaps.push({
      t: Math.round(performance.now()),
      kids: [...root.children].map(el => ({
        tag: el.tagName,
        cls: (el.className||'').toString().split(' ').filter(c=>c.startsWith('tl-')).join('.'),
        y: Math.round(el.getBoundingClientRect().top + window.scrollY),
        h: Math.round(el.getBoundingClientRect().height),
      })),
    });
  };
  const iv = setInterval(snap, 120);
  setTimeout(() => clearInterval(iv), 14000);
});

await page.goto(URL, { waitUntil:'load', timeout:120000 });
await page.waitForTimeout(12000);
const { snaps, shifts } = await page.evaluate(() => ({ snaps: window.__snaps, shifts: window.__shifts }));
const big = shifts.filter(s => s.v > 0.05);
console.log(`URL ${URL}`);
console.log('big shifts:', JSON.stringify(big));
// print the two snapshots bracketing the biggest shift
const t = big[0]?.t;
if (t) {
  const before = [...snaps].reverse().find(s => s.t < t);
  const after  = snaps.find(s => s.t > t + 200);
  const fmt = (s) => s ? s.kids.map(k=>`      ${String(k.y).padStart(5)}  h=${String(k.h).padStart(5)}  ${k.tag}.${k.cls}`).join('\n') : '   (none)';
  console.log(`\n--- BEFORE t=${before?.t} ---\n${fmt(before)}`);
  console.log(`\n--- AFTER  t=${after?.t} ---\n${fmt(after)}`);
}
await b.close();
