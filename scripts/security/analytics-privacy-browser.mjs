// Offline boot/history/click regression. All network responses are intercepted;
// no Google/Ahrefs/ads or production endpoint is contacted.
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const token='f6200000-0000-4000-8000-000000000004';
const html=(await readFile('index.html','utf8')).replace(/<script type="module"[^>]*><\/script>/g,'');
const browser=await chromium.launch({headless:true});
try {
 const context=await browser.newContext({userAgent:'Mozilla/5.0 Chrome/130 Safari/537.36'});
 await context.addInitScript(()=>Object.defineProperty(navigator,'webdriver',{get:()=>false}));
 const external=[];
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='app.test')return route.fulfill({contentType:route.request().resourceType()==='document'?'text/html':'application/javascript',body:route.request().resourceType()==='document'?html:''});
  external.push({url:url.href,referer:route.request().headers().referer??''});
  return route.fulfill({contentType:'application/javascript',body:'/* intercepted SDK */'});
 });
 const page=await context.newPage();
 for(const path of [`/dang-ky/${token}`,`/auth/callback?code=${token}`,`/blog/test?magic_token=${token}`]){
  external.length=0;await page.goto(`https://app.test${path}`);await page.mouse.click(2,2);
  await page.waitForTimeout(50);
  if(external.length)throw Error('third-party boot on credential URL');
 }
 for(const method of ['history','click']){
  await page.goto('https://app.test/blog/test');
  if(method==='history')await page.evaluate(t=>history.pushState({},'',`/dang-ky/${t}`),token);
  else {await page.evaluate(t=>{const a=document.createElement('a');a.href=`/dang-ky/${t}`;a.textContent='Open registration';a.id='private-test-link';document.body.appendChild(a);},token);await page.locator('#private-test-link').click();}
  await page.waitForURL(`**/dang-ky/${token}`);await page.waitForLoadState('domcontentloaded');
  if(await page.evaluate(()=>window.__tphAnalyticsAllowed()))throw Error('private navigation did not load guarded document');
 }
 if(external.some(request=>request.url.includes(token)||request.referer.includes(token)))throw Error('credential crossed analytics request boundary');
 console.log('PASS 3 private boot cases + history/click document boundaries; no external network used');
} finally {await browser.close();}
