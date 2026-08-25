import { chromium } from 'playwright';
const URL = process.argv[2] || 'https://www.thepicklehub.net/vi';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, deviceScaleFactor:3,
  userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36' });
const page = await ctx.newPage();

// throttle like a mid-tier VN mobile connection
const cdp = await ctx.newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', { offline:false, downloadThroughput: 1.6*1024*1024/8, uploadThroughput: 750*1024/8, latency: 150 });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

await page.addInitScript(() => {
  window.__shifts = [];
  new PerformanceObserver(list => {
    for (const e of list.getEntries()) {
      if (e.hadRecentInput) continue;
      window.__shifts.push({
        value: e.value, t: Math.round(e.startTime),
        sources: (e.sources||[]).map(s => ({
          node: s.node ? (s.node.nodeName + (s.node.className ? '.'+String(s.node.className).split(' ').slice(0,3).join('.') : '')) : null,
          text: s.node?.textContent ? s.node.textContent.trim().slice(0,50) : '',
          prev: s.previousRect ? {y:Math.round(s.previousRect.y), h:Math.round(s.previousRect.height)} : null,
          cur:  s.currentRect  ? {y:Math.round(s.currentRect.y),  h:Math.round(s.currentRect.height)}  : null,
        })),
      });
    }
  }).observe({type:'layout-shift', buffered:true});
});

await page.goto(URL, { waitUntil:'load', timeout:120000 });
await page.waitForTimeout(9000);
const shifts = await page.evaluate(() => window.__shifts);
const total = shifts.reduce((a,s)=>a+s.value,0);
console.log(`URL: ${URL}`);
console.log(`TOTAL CLS: ${total.toFixed(4)}  (${shifts.length} entries)\n`);
for (const s of shifts.sort((a,b)=>b.value-a.value).slice(0,10)) {
  console.log(`  ${s.value.toFixed(4)} @${s.t}ms`);
  for (const src of s.sources) console.log(`      ${src.node}  y:${src.prev?.y}->${src.cur?.y} h:${src.prev?.h}->${src.cur?.h}  ${JSON.stringify(src.text)}`);
}
await b.close();
