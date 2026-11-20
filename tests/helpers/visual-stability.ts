import type { Page, Request } from '@playwright/test';

const pendingReads = new WeakMap<Page, Set<Request>>();

export const VISUAL_MASK_SELECTORS = ['img', '[data-testid="live-score"]', 'time'];
export async function assertNavigationUnmasked(page: Page) {
  const collisions = await page.locator('nav svg, nav a, nav button, a.tl-btn, button.tl-btn, h1, h2, h3').evaluateAll((elements, selectors) =>
    elements.filter(element => selectors.some(selector => element.matches(selector) || element.closest(selector))).length,
    VISUAL_MASK_SELECTORS,
  );
  if (collisions) throw Error('A visual mask covers navigation, primary controls or headings');
}

// Synthetic public data only. No captured user records or private credentials.
export const VISUAL_CLUBS = [
  { id: '00000000-0000-4000-8000-000000000101', slug: 'visual-riverside', name: 'Riverside Pickleball Club', description: 'Weekly friendly doubles and coached sessions.', logo_url: null, location_text: 'Hà Nội', created_by: null, created_at: '2026-11-18T12:00:00Z', upcoming_events: 2, creator_profile_slug: null, creator_display_name: 'Visual Organizer', creator_username: null },
  { id: '00000000-0000-4000-8000-000000000102', slug: 'visual-city', name: 'Câu lạc bộ Pickleball Thành Phố', description: 'Chào đón người chơi mới và các trận giao hữu.', logo_url: null, location_text: 'Thành phố Hồ Chí Minh', created_by: null, created_at: '2026-11-17T12:00:00Z', upcoming_events: 0, creator_profile_slug: null, creator_display_name: 'Visual Host', creator_username: null },
];
export function isClubFixtureRequest(url: string, method: string) {
  const u = new URL(url);
  return method === 'GET' && /^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(u.origin) && u.pathname === '/rest/v1/club_listing';
}
export const VISUAL_STREAMS = ['live', 'scheduled', 'ended'].map((status, index) => ({
  id: `00000000-0000-4000-8000-00000000020${index}`,
  title: `Visual ${status} doubles match`, status, organization_id: null,
  organization: null, thumbnail_url: null,
  scheduled_start_at: '2026-11-20T14:00:00Z', started_at: '2026-11-20T11:00:00Z',
  ended_at: status === 'ended' ? '2026-11-19T12:00:00Z' : null,
}));
export async function prepareVisualPage(page: Page, liveState: 'populated' | 'empty' = 'populated') {
  const pending = new Set<Request>();
  pendingReads.set(page, pending);
  page.on('request', request => {
    const url = new URL(request.url());
    if (/^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname) && url.pathname.startsWith('/rest/v1/')) pending.add(request);
  });
  page.on('requestfinished', request => pending.delete(request));
  page.on('requestfailed', request => pending.delete(request));
  // Explicit URL locale keeps geo-IP from switching dictionary mid-capture.
  await page.addInitScript(() => {
    localStorage.setItem('pickleball-hub-language', /^\/vi(?:\/|$)/.test(location.pathname) ? 'vi' : 'en');
  });
  // Fix dates, not timers: loading/animation/layout behavior remains real.
  await page.clock.setFixedTime(new Date('2026-11-20T12:00:00Z'));
  await page.route('**/rest/v1/**', async route => {
    const request = route.request(), url = new URL(request.url());
    if (isClubFixtureRequest(request.url(), request.method())) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(VISUAL_CLUBS) });
    }
    if (request.method() === 'GET' && /^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(url.origin) && url.pathname === '/rest/v1/public_livestreams') {
      const status = url.searchParams.get('status')?.replace(/^eq\./, '');
      const rows = liveState === 'empty' ? [] : VISUAL_STREAMS.filter(row => !status || row.status === status);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    }
    return route.continue();
  });
}
export async function waitForVisualContent(page: Page, path: string) {
  await page.getByRole('heading').first().waitFor({ state: 'visible' });
  await page.locator('[role="status"].min-h-screen').waitFor({ state: 'hidden' });
  // Finish outstanding content reads and React paint, not a fixed sleep.
  for (let pass = 0; pass < 8; pass++) {
    const reads = [...(pendingReads.get(page) ?? [])];
    await Promise.all(reads.map(async request => { const response = await request.response(); if (response) await response.finished(); }));
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    if (!pendingReads.get(page)?.size) break;
    if (pass === 7) throw Error('Content reads did not settle before visual capture');
  }
  if (path === '/blog' || path === '/vi/blog') {
    await page.locator('.tl-blog-hero, .tl-blog-card').first().waitFor({ state: 'visible' });
  }
  if (path === '/clubs') await page.getByText('Riverside Pickleball Club', { exact: true }).waitFor({ state: 'visible' });
  if (path === '/live') await page.getByText('Visual live doubles match', { exact: true }).waitFor({ state: 'visible' });
}
export async function settleVisualFonts(page: Page) {
  // Load the real self-hosted font bytes as test-only block faces. Merely
  // awaiting fonts.ready cannot prove optional fonts rendered on a cold page.
  const result = await page.evaluate(async () => {
    const faces: FontFace[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try { rules = sheet.cssRules; } catch { continue; }
      for (const rule of Array.from(rules)) {
        if (rule.type !== CSSRule.FONT_FACE_RULE) continue;
        const style = (rule as CSSFontFaceRule).style;
        const match = /url\(["']?([^"')]+)["']?\)/.exec(style.getPropertyValue('src'));
        if (!match) continue;
        const url = new URL(match[1], location.href);
        if (url.origin !== location.origin || !/^\/fonts\/[a-z0-9-]+\.woff2$/.test(url.pathname) || url.search || url.hash) continue;
        const family = style.getPropertyValue('font-family').replace(/["']/g, '');
        const face = new FontFace(family, `url("${url.href}")`, {
          style: style.getPropertyValue('font-style') || 'normal',
          weight: style.getPropertyValue('font-weight') || '400',
          unicodeRange: style.getPropertyValue('unicode-range') || 'U+0-10FFFF',
          display: 'block',
        });
        faces.push(face);
      }
    }
    if (!faces.length) throw Error('No self-hosted fonts discovered');
    await Promise.all(faces.map(async face => { await face.load(); document.fonts.add(face); }));
    await document.fonts.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    return { loaded: faces.length, families: [...new Set(faces.map(face => face.family.replace(/["']/g, '')))] };
  });
  if (!result.families.includes('Instrument Serif')) throw Error('Display font not stabilized');
  return result;
}
