#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export function previewFromChecks(checks,sha) {
 const candidates=checks.filter(c=>c.head_sha===sha&&c.name==='Cloudflare Pages: pickle-hub-pro'&&c.app?.slug==='cloudflare-workers-and-pages').sort((a,b)=>b.id-a.id);
 const c=candidates[0];if(!c||c.status!=='completed')return null;
 if(c.conclusion!=='success')throw Error('Exact-commit Cloudflare deployment failed');
 const urls=[...(c.output?.summary??'').matchAll(/href=['"](https:\/\/[^'"\s<>]+)['"]/g)].map(m=>m[1]);
 const url=urls.find(u=>/^https:\/\/[a-f0-9]{8}\.pickle-hub-pro\.pages\.dev\/?$/.test(u));
 if(!url)throw Error('Successful deployment has no trusted immutable preview URL');
 return url.replace(/\/$/,'');
}
export async function resolvePreview({sha,repo,token,fork=false,fetcher=fetch,now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms)),timeoutMs=900000}) {
 if(fork)throw Error('Fork preview execution is not authorized');
 if(!/^[a-f0-9]{40}$/.test(sha??'')||!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo??'')||!token)throw Error('Exact SHA, repository and read-only token required');
 const deadline=now()+timeoutMs;
 while(now()<deadline) {
  const checks=[];
  for(let page=1;page<=10;page++) {
   const r=await fetcher(`https://api.github.com/repos/${repo}/commits/${sha}/check-runs?per_page=100&page=${page}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},redirect:'error',signal:AbortSignal.timeout(20000)});
   if(!r.ok)throw Error('GitHub check metadata unavailable');
   const d=await r.json();if(!Array.isArray(d.check_runs))throw Error('Malformed check metadata');
   checks.push(...d.check_runs);if(d.check_runs.length<100)break;
   if(page===10)throw Error('Check pagination limit exceeded');
  }
  const url=previewFromChecks(checks,sha);
  if(url) {
   try {const r=await fetcher(url,{method:'HEAD',redirect:'error',signal:AbortSignal.timeout(20000)});if(r.status===200)return url;}catch { /* deployment propagation/network: bounded retry, never fallback */ }
  }
  await sleep(Math.min(30000,Math.max(0,deadline-now())));
 }
 throw Error('Exact-commit immutable preview was not ready before deadline');
}
async function main() {
 const url=await resolvePreview({sha:process.env.PREVIEW_COMMIT_SHA,repo:process.env.GITHUB_REPOSITORY,token:process.env.GITHUB_TOKEN,fork:process.env.PREVIEW_IS_FORK==='true'});
 if(!process.env.GITHUB_ENV)throw Error('GITHUB_ENV required');
 appendFileSync(process.env.GITHUB_ENV,`PLAYWRIGHT_BASE_URL=${url}\n`);console.log(`Verified exact-commit immutable preview: ${url}`);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Exact-commit preview resolution failed; no alias or production fallback.');process.exitCode=1;});
