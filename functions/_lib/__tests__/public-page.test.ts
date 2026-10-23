import { describe, expect, it, vi } from 'vitest';
import { isPublicContentPath, lcpPreloadTag, publicPageParts, servePublicPage } from '../public-page';
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
  it('preloads the homepage and English blog heroes, and skips pages with no known hero', () => {
    const home = lcpPreloadTag('/');
    expect(home).toContain('rel="preload"');
    expect(home).toContain('as="image"');
    expect(home).toContain('fetchpriority="high"');
    expect(home).toContain('mlp-asia-draft-2026-viet-panthers-hero-768.webp');
    const post = lcpPreloadTag('/blog/what-is-dupr-pickleball-rating-system');
    expect(post).toContain('dupr-pickleball-rating-hero-768.webp');
    expect(post).toContain('imagesrcset=');
    expect(lcpPreloadTag('/vi')).toBe('');
    expect(lcpPreloadTag('/vi/blog/top-san-pickleball-ha-noi-2026')).toBe('');
    expect(lcpPreloadTag('/tools/flex-tournament')).toBe('');
  });
  it('suggests World Cup coverage for a World Cup article, not generic tournament tools', () => {
    const related = getRelatedPosts('pickleball-world-cup-2026-da-nang-from-the-stands');
    expect(related).toHaveLength(3);
    expect(related.every((p) => p.slug.includes('world-cup'))).toBe(true);
    expect(getRelatedPosts('missing-post')).toEqual([]);
  });


  // Minimal HTMLRewriter stand-in for the Node test env: records the
  // handlers servePublicPage registers and applies head-append + #root
  // inner-content to the shell text, which is all these tests assert on.
  class FakeHTMLRewriter {
    handlers = new Map<string, { element(el: unknown): void }>();
    on(selector: string, handler: { element(el: unknown): void }) { this.handlers.set(selector, handler); return this; }
    transform(response: Response) {
      return (async () => {
        let text = await response.text();
        const appended: string[] = [];
        this.handlers.get('head')?.element({ append: (html: string) => { appended.push(html); } });
        let root = '';
        this.handlers.get('#root')?.element({ setInnerContent: (html: string) => { root = html; } });
        text = text.replace('</head>', `${appended.join('')}
</head>`).replace('<div id="root"></div>', `<div id="root">${root}</div>`);
        return new Response(text, { status: response.status, headers: response.headers });
      })();
    }
  }
  it('serves extracted parts from the parts cache without re-rendering', async () => {
    vi.stubGlobal('HTMLRewriter', FakeHTMLRewriter);
    const shell = () => new Response('<html><head><title>shell</title></head><body><div id="root"></div></body></html>', { headers: { 'content-type': 'text/html' } });
    let stored: string | null = null;
    let renders = 0;
    const cache = { get: async () => stored, put: async (v: string) => { stored = v; } };
    const render = async () => { renders++; return renderTools(site, '/tools', 'en'); };
    const first = await servePublicPage(shell(), render, 2500, '/tools', cache);
    expect(first.headers.get('X-Public-Render')).toBe('content');
    expect(renders).toBe(1);
    expect(stored).toContain('Sign in to create');
    const second = await servePublicPage(shell(), render, 2500, '/tools', cache);
    expect(second.headers.get('X-Public-Render')).toBe('content-cache');
    expect(renders).toBe(1);
    expect(await second.text()).toContain('Sign in to create');
  });
  it('falls back to a fresh render when the parts cache is corrupt', async () => {
    const shell = new Response('<html><head><title>shell</title></head><body><div id="root"></div></body></html>', { headers: { 'content-type': 'text/html' } });
    const cache = { get: async () => '{not json', put: async () => {} };
    const result = await servePublicPage(shell, async () => renderTools(site, '/tools', 'en'), 2500, '/tools', cache);
    expect(result.headers.get('X-Public-Render')).toBe('content');
    expect(await result.text()).toContain('Sign in to create');
  });
  it('does not cache non-200 renders', async () => {
    const shell = new Response('<html><head><title>shell</title></head><body><div id="root"></div></body></html>', { headers: { 'content-type': 'text/html' } });
    let puts = 0;
    const cache = { get: async () => null, put: async () => { puts++; } };
    const result = await servePublicPage(shell, async () => new Response('gone', { status: 410 }), 2500, '/tools', cache);
    expect(result.status).toBe(410);
    expect(puts).toBe(0);
  });
});
