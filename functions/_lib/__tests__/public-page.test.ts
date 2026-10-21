import { describe, expect, it, vi } from 'vitest';
import { isPublicContentPath, publicPageParts, servePublicPage } from '../public-page';
import { renderTools } from '../render/tools';
import { renderAuthor } from '../render/author';
import { renderEnBlogBody } from '../render/blog-body';
import { getRelatedPosts } from '../../../src/content/blog/related';
import { authorIdentity } from '../../../src/content/authors';

const site = 'https://www.thepicklehub.net';
describe('public editorial HTML', () => {
  it('extracts actual route metadata and content without copying scripts or global CSS', async () => {
    const parts = publicPageParts(await renderTools(site, '/tools', 'en').text());
    expect(parts.head).toContain(`${site}/tools`);
    expect(parts.head).toContain('application/ld+json');
    expect(parts.body).toContain('Sign in to create');
    expect(parts.head).not.toMatch(/<style|<script src=|name="viewport"/);
  });
  it('keeps credentials, private sessions and mutation routes outside the public path', () => {
    for (const path of ['/login', '/vi/tools/team-match/new', '/tools/quick-tables/private-id', '/dang-ky/token', '/seller', '/account', '/api/foo']) expect(isPublicContentPath(path)).toBe(false);
    expect(isPublicContentPath('/vi/blog/lich-giai')).toBe(true);
  });
  it('preserves the working app shell when data loading fails', async () => {
    const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await servePublicPage(new Response('app shell', { headers: { 'content-type': 'text/html' } }), async () => { throw new Error('data unavailable'); });
    expect(await result.text()).toBe('app shell');
    expect(result.headers.get('X-Public-Render')).toBe('fallback');
    log.mockRestore();
  });
  it('bounds slow data loading without losing the app shell', async () => {
    const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await servePublicPage(new Response('app shell', { headers: { 'content-type': 'text/html' } }), () => new Promise(() => {}), 5);
    expect(await result.text()).toBe('app shell');
    log.mockRestore();
  });
  it('preserves a real missing article and a translated-slug redirect', async () => {
    for (const status of [404, 301]) {
      const page = new Response(null, { status, headers: status === 301 ? { location: `${site}/vi/blog/translated` } : {} });
      expect(await servePublicPage(new Response('shell', { headers: { 'content-type': 'text/html' } }), async () => page)).toBe(page);
    }
  });
  it('links the author profile to actual articles and preserves team attribution', async () => {
    expect(authorIdentity('ThePickleHub Team')['@type']).toBe('Organization');
    expect(authorIdentity('Guest Writer').name).toBe('Guest Writer');
    const html = await renderAuthor(site, 'en').text();
    expect(html).toContain('ProfilePage');
    expect(html).toContain('/blog/pickleball-world-cup-2026-da-nang-from-the-stands');
    const body = await renderEnBlogBody('vietnam-pickleball-tournament-calendar-2026', site);
    expect(body).toContain('/authors/cuong-nguyen');
    expect(body).toContain('2026-09-14');
  });
  it('suggests World Cup coverage for a World Cup article, not generic tournament tools', () => {
    const related = getRelatedPosts('pickleball-world-cup-2026-da-nang-from-the-stands');
    expect(related).toHaveLength(3);
    expect(related.every((p) => p.slug.includes('world-cup'))).toBe(true);
    expect(getRelatedPosts('missing-post')).toEqual([]);
  });
});
