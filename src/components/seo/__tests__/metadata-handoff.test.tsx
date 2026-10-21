// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import { fireEvent } from '@testing-library/react';
import { DynamicMeta } from '../DynamicMeta';
import { PublicSeoHandoff } from '../PublicSeoHandoff';
vi.mock('@/i18n', () => ({ useI18n: () => ({ language: 'en' }) }));
afterEach(() => { cleanup(); document.head.innerHTML = ''; });
describe('metadata after the public HTML boots', () => {
  it('does not canonicalize a campaign URL or repeat the brand suffix', () => {
    render(<DynamicMeta title="Pickleball tools | ThePickleHub" url="https://www.thepicklehub.net/tools/?utm_source=test#formats" />);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://www.thepicklehub.net/tools');
    expect(document.title).toBe('Pickleball tools | ThePickleHub');
  });
  it('preserves editorial meta titles composed by the server', () => {
    render(<DynamicMeta title="Vietnam Pickleball Tournament Calendar 2026 | Dates & Venues" exactTitle />);
    expect(document.title).toBe('Vietnam Pickleball Tournament Calendar 2026 | Dates & Venues');
  });
  it('keeps public structured data on load but removes it when navigating', () => {
    document.head.innerHTML = '<meta data-public-seo property="article:published_time" content="2026-09-14"><script type="application/ld+json" data-public-seo>{"@type":"WebApplication"}</script>';
    const view = render(<MemoryRouter initialEntries={['/tools']}><PublicSeoHandoff /><Routes><Route path="/tools" element={<Link to="/about">About</Link>} /><Route path="/about" element={<p>About page</p>} /></Routes></MemoryRouter>);
    expect(document.querySelector('script[data-public-seo]')).not.toBeNull();
    fireEvent.click(view.getByText('About'));
    expect(document.querySelector('script[data-public-seo]')).toBeNull();
    expect(document.querySelector('meta[property="article:published_time"]')).toBeNull();
  });
});
