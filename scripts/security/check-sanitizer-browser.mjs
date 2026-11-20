// Run: node scripts/security/check-sanitizer-browser.mjs (Playwright Chromium installed).
// No network or production requests; scripts/resource fetching disabled during DOM inspection.
import { chromium } from '@playwright/test';
import ts from 'typescript';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const temp = await mkdtemp(new URL('../../.sanitizer-check-', import.meta.url).pathname);
let browser;
try {
  for (const [name, source] of [['sanitizer', 'functions/_lib/sanitize-blog-html.ts'], ['fixtures', 'functions/_lib/__tests__/sanitizer-fixtures.ts']]) {
    await writeFile(`${temp}/${name}.mjs`, ts.transpileModule(await readFile(source, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  }
  const { sanitizeBlogHtml } = await import(pathToFileURL(`${temp}/sanitizer.mjs`));
  const { attacks } = await import(pathToFileURL(`${temp}/fixtures.mjs`));
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ javaScriptEnabled: false });
  await page.route('**/*', route => route.abort());
  for (const input of attacks) {
    await page.setContent('<main id="sink"></main>');
    const safe = sanitizeBlogHtml(input);
    const bad = await page.evaluate(html => {
      const sink = document.getElementById('sink'); sink.innerHTML = html;
      return !!sink.querySelector('script,style,svg,math,iframe,form,template') || [...sink.querySelectorAll('*')].some(e => [...e.attributes].some(a => /^on|^(style|srcdoc|id|name)$/i.test(a.name) || (['href', 'src'].includes(a.name) && /^(javascript|vbscript|data|file):|^\/\//i.test(a.value))));
    }, safe);
    if (bad) throw new Error('Unsafe DOM after Chromium reparse');
  }
  console.log(`PASS ${attacks.length} Chromium DOM sink cases`);
} finally {
  if (browser) await browser.close();
  await rm(temp, { recursive: true, force: true });
}
