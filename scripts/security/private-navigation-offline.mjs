// Build first with a synthetic Supabase origin. Serve actual generated SW and
// assets locally; no application module/provider runs and external fetch aborts.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from '@playwright/test';
const root=resolve('dist');
const sw=await readFile(resolve(root,'sw-v3.js'),'utf8');
const readableWorker=await readFile('public/sw-private-navigation.js','utf8');
const shippedWorker=await readFile(resolve(root,'sw-private-navigation.js'),'utf8');
if(shippedWorker.length>=readableWorker.length*0.8)throw Error('private worker production minification missing');
if(!sw.includes('sw-private-navigation.js'))throw Error('private boundary missing from generated SW');
if(sw.includes('createHandlerBoundToURL("/index.html")'))throw Error('unprecached fallback would abort generated SW startup');
if(/url:\s*["']\/?index\.html["']/.test(sw))throw Error('index shell unexpectedly precached');
const shell=(await readFile(resolve(root,'index.html'),'utf8')).replace(/<script type="module"[^>]*><\/script>/g,'');
const server=createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,'http://local.test').pathname;
  if(!extname(path)) {res.setHeader('content-type','text/html');res.end(shell.replace('</body>','<p id="public-offline-marker">Public warm offline content</p></body>'));return;}
  const file=resolve(root,'.'+path);if(!file.startsWith(root+'/'))throw Error('bad path');
  const bytes=await readFile(file);res.setHeader('content-type',path.endsWith('.js')?'application/javascript':path.endsWith('.css')?'text/css':'application/octet-stream');res.end(bytes);
 }catch{res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext();const exceptions=[];
 context.on('weberror',error=>exceptions.push(error.error().message));
 await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
 const page=await context.newPage();await page.goto(origin+'/');
 await page.evaluate(async origin=>{
  const old=await caches.open('legacy-html-cache');
  await old.put(origin+'/dang-ky/credential',new Response('<script>window.staleCredentialSdk=true</script>',{headers:{'Content-Type':'text/html'}}));
  await old.put(origin+'/public-retained',new Response('public preserved'));
  await old.put(origin+'/login?next=%252Fdang-ky%252Fencoded',new Response('old private encoded'));
  const draft=await caches.open('user-draft-fixtures');await draft.put(origin+'/drafts/local',new Response('draft preserved'));
  await navigator.serviceWorker.register('/sw-v3.js');await navigator.serviceWorker.ready;
 },origin);
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 const preserved=await page.evaluate(async origin=>({
  oldPrivate:!!await caches.match(origin+'/dang-ky/credential'),
  oldEncoded:!!await caches.match(origin+'/login?next=%252Fdang-ky%252Fencoded'),
  publicEntry:await(await caches.match(origin+'/public-retained'))?.text(),
  draft:await(await caches.match(origin+'/drafts/local'))?.text(),
 }),origin);
 if(preserved.oldPrivate||preserved.oldEncoded||preserved.publicEntry!=='public preserved'||preserved.draft!=='draft preserved')throw Error('activation cache cleanup exceeded scope or missed private keys');
 await page.goto(origin+'/warm-public');
 await page.waitForFunction(async url=>!!await caches.match(url),origin+'/warm-public');
 // Even a late/stale private html-shell entry must never be consulted.
 await page.evaluate(async origin=>{const cache=await caches.open('html-shell');await cache.put(origin+'/dang-ky/credential',new Response('<script>window.staleCredentialSdk=true</script>',{headers:{'Content-Type':'text/html'}}));},origin);
 if(!await page.evaluate(async url=>!!await caches.match(url),origin+'/dang-ky/credential'))throw Error('stale private bypass fixture missing');
 await context.setOffline(true);
 for(const path of ['/dang-ky/credential','/login?next=%252Fdang-ky%252Fencoded','/blog/test?magic_token=credential']){
  const response=await page.goto(origin+path);if(response.status()!==503)throw Error('private offline navigation served a cached shell');
  if(!await page.getByText('Private pages require an online connection. Reconnect and reload.').count())throw Error('private offline boundary missing');
  if(await page.evaluate(()=>!!window.staleCredentialSdk))throw Error('old private SDK shell executed');
 }
 await page.goto(origin+'/warm-public');if(!await page.locator('#public-offline-marker').count())throw Error('public warm offline content lost');
 const cold=await page.goto(origin+'/never-cached-public');if(cold.status()!==503)throw Error('cold public offline was not controlled');
 if(!await page.getByText('This page is not available offline. Reconnect and reload.').count())throw Error('cold offline message missing');
 if(exceptions.length)throw Error('generated SW/page startup exception: '+exceptions.join(';'));
 console.log('PASS actual generated SW: startup, scoped old-private cleanup, 3 private offline denials, public warm cache and controlled cold miss');
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
