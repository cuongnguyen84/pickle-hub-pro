/** Progressive HTML for public editorial/marketing routes. React still owns the app. */
export function isPublicContentPath(pathname: string): boolean {
  const path = pathname.replace(/^\/vi(?=\/|$)/, '') || '/';
  return ['/', '/blog', '/tools', '/about', '/contact', '/authors/cuong-nguyen'].includes(path)
    || /^\/blog\/[^/]+$/.test(path)
    || /^\/tools\/(quick-tables|team-match|doubles-elimination|flex-tournament)$/.test(path);
}

/** Extract only SEO nodes; never copy the renderer's global CSS or analytics. */
export function publicPageParts(html: string): { head: string; body: string; lang: string } {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? '';
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  if (!body || !/<link\b[^>]*rel=["']canonical["']/i.test(head)) {
    throw new Error('public-page-missing-content-or-canonical');
  }
  const nodes = head.match(/<title\b[^>]*>[\s\S]*?<\/title>|<meta\b[^>]*>|<link\b[^>]*>|<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? [];
  const seo = nodes.filter((node) => /^<title|^<script/i.test(node)
    || /^<meta\b/i.test(node) && /(?:name|property)=["'](?:description|robots|og:[^"']+|twitter:[^"']+|article:[^"']+)["']/i.test(node)
    || /^<link\b/i.test(node) && /rel=["'](?:canonical|alternate)["']/i.test(node));
  return {
    head: seo.map((node) => node.replace(/^<(\w+)/, '<$1 data-public-seo')).join('\n'),
    body,
    lang: html.match(/<html\b[^>]*lang=["']([^"']+)["']/i)?.[1] ?? 'en',
  };
}

export async function servePublicPage(
  shell: Response,
  render: () => Promise<Response>,
  budgetMs = 2500,
): Promise<Response> {
  if (shell.status !== 200 || !shell.headers.get('content-type')?.includes('text/html')) return shell;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const page = await Promise.race([
      render(),
      new Promise<Response>((_, reject) => { timer = setTimeout(() => reject(new Error('public-page-timeout')), budgetMs); }),
    ]);
    // Preserve real missing-article statuses and alternate-slug redirects.
    if (page.status !== 200) return page;
    const parts = publicPageParts(await page.text());
    const headers = new Headers(shell.headers);
    headers.set('Cache-Control', 'no-store');
    headers.set('Vary', 'User-Agent');
    headers.set('X-Public-Render', 'content');
    headers.delete('Content-Length');
    headers.delete('ETag');
    const response = new Response(shell.body, { status: shell.status, headers });
    const remove = { element(el: Element) { el.remove(); } };
    return new HTMLRewriter()
      .on('html', { element(el) { el.setAttribute('lang', parts.lang); } })
      .on('title, meta[name="description"], meta[name="robots"], meta[property^="og:"], meta[property^="article:"], meta[name^="twitter:"], link[rel="canonical"], link[hreflang], script[type="application/ld+json"]', remove)
      .on('head', { element(el) { el.append(parts.head, { html: true }); } })
      .on('#root', { element(el) { el.setInnerContent(`<div data-public-content>${parts.body}</div>`, { html: true }); } })
      .transform(response);
  } catch (error) {
    // A data outage must not prevent the interactive application from booting.
    console.warn('Public HTML fallback:', error instanceof Error ? error.message : 'render-error');
    const headers = new Headers(shell.headers);
    headers.set('X-Public-Render', 'fallback');
    headers.set('Cache-Control', 'no-store');
    return new Response(shell.body, { status: shell.status, headers });
  } finally {
    if (timer) clearTimeout(timer);
  }
}
