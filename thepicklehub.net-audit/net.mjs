import { chromium } from 'playwright';
const b = await chromium.launch();
const page = await b.newPage({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
const urls=[];
page.on('request', r => { const u=r.url(); if (/supabase|rest\/v1|rpc/.test(u)) urls.push(u.replace(/^https:\/\/[^/]+/,'')); });
await page.goto(process.argv[2], { waitUntil:'load', timeout:120000 });
await page.waitForTimeout(8000);
console.log(urls.slice(0,25).join('\n'));
await b.close();
