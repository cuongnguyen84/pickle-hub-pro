import { describe, it, expect } from 'vitest';
import {
  checkXDraft,
  rankNewsCandidates,
  xDraftLimit,
  type NewsRow,
} from './x-draft';

const news = (over: Partial<NewsRow> = {}): NewsRow => ({
  id: 'a',
  title: 't',
  summary: null,
  content_html: null,
  category: null,
  importance: 1,
  published_at: '2026-08-16T00:00:00Z',
  ...over,
});

describe('checkXDraft', () => {
  it('accepts a post that reports a fact', () => {
    const r = checkXDraft(
      'Ben Johns beat Federico Staksrud 11-6, 11-9 in the Hong Kong final.',
    );
    expect(r.ok).toBe(true);
  });

  // Every case below is a post the model produced happily and that would have
  // gone out under Cuong's brand as an ad.
  it.each([
    ['Great final today. Read the full recap on our site.', 'read_more'],
    ['Johns won 11-6. Full breakdown of every point.', 'full_story'],
    ['Johns took the title. Check it out.', 'check_out'],
    ['Johns won his 3rd title. Link in bio.', 'link_in_bio'],
    ['Johns won 11-6. Follow us for more results.', 'follow_us'],
    ['Johns won 11-6. Like this if you saw it live.', 'engagement_bait'],
    ['Johns won 11-6. Comment your pick for the next one.', 'engagement_bait'],
    ['Johns won 11-6. More at thepicklehub dot net', 'spelled_domain'],
    ['Johns won 11-6. Our take 👇', 'pointer_emoji'],
  ])('rejects ad copy: %s', (body, detail) => {
    const r = checkXDraft(body);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('ad_copy');
    expect(r.detail).toBe(detail);
  });

  it('rejects a URL or bare domain via the shared publisher check', () => {
    const withUrl = checkXDraft('Recap: https://www.thepicklehub.net/news/x');
    expect(withUrl.ok).toBe(false);
    if (!withUrl.ok) expect(withUrl.reason).toBe('invalid_body');

    const bare = checkXDraft('Johns won 11-6. More at thepicklehub.net today.');
    expect(bare.ok).toBe(false);
    if (!bare.ok) expect(bare.reason).toBe('invalid_body');
  });

  it('rejects a post with no concrete detail', () => {
    const r = checkXDraft('What a great match today. Really exciting stuff.');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_specific');
  });

  it('accepts a proper noun as the concrete detail when there is no number', () => {
    expect(checkXDraft('The comeback belonged to Anna Leigh Waters, start to finish.').ok)
      .toBe(true);
  });

  it('allows one hashtag but not two', () => {
    expect(checkXDraft('Johns wins 11-6 in Hong Kong. #PPATour').ok).toBe(true);
    const two = checkXDraft('Johns wins 11-6. #PPATour #pickleball');
    expect(two.ok).toBe(false);
    if (!two.ok) expect(two.detail).toBe('hashtags:2');
  });

  // handleXDraft keys its one length-retry off exactly this reason/detail pair.
  // If either string changes, the retry silently stops firing and long drafts
  // go back to being thrown away — so this test pins the contract, not a label.
  it('rejects a body over 280 weighted characters as invalid_body/too_long', () => {
    const r = checkXDraft(`Johns won 11-6. ${'a'.repeat(280)}`);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('invalid_body');
    expect(r.detail).toBe('too_long');
  });

  it('rejects a body one character over, which is what the first live run hit', () => {
    // The real draft came back at 281. Nothing about being barely over makes it
    // publishable, but it is the case the retry exists to rescue.
    const r = checkXDraft('J'.repeat(281));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.detail).toBe('too_long');
    expect(checkXDraft(`Johns won 11-6 in Dallas. ${'a'.repeat(254)}`).ok).toBe(true);
  });

  it('does not mistake ordinary reporting for a call to action', () => {
    // These contain words the naive version of this filter would have eaten.
    expect(checkXDraft('Waters read the drop perfectly at 9-9.').ok).toBe(true);
    expect(checkXDraft('A complete performance from Johns, 11-2, 11-4.').ok).toBe(true);
    expect(checkXDraft('Staksrud follows Johns at No. 2 in the rankings.').ok).toBe(true);
  });
});

describe('rankNewsCandidates', () => {
  it('puts importance first, then newest', () => {
    const rows = [
      news({ id: 'low-new', importance: 1, published_at: '2026-08-16T10:00:00Z' }),
      news({ id: 'high-old', importance: 9, published_at: '2026-08-15T10:00:00Z' }),
      news({ id: 'high-new', importance: 9, published_at: '2026-08-16T09:00:00Z' }),
    ];
    expect(rankNewsCandidates(rows, new Set()).map((r) => r.id)).toEqual([
      'high-new',
      'high-old',
      'low-new',
    ]);
  });

  it('drops items already turned into a row, so X never sees the story twice', () => {
    const rows = [news({ id: 'a' }), news({ id: 'b' })];
    expect(rankNewsCandidates(rows, new Set(['a'])).map((r) => r.id)).toEqual(['b']);
  });
});

describe('xDraftLimit', () => {
  it('defaults to 2, respects the env, and caps runaway overrides', () => {
    expect(xDraftLimit({} as never)).toBe(2);
    expect(xDraftLimit({ X_DRAFT_LIMIT: '3' } as never)).toBe(3);
    expect(xDraftLimit({} as never, 4)).toBe(4);
    expect(xDraftLimit({} as never, 999)).toBe(10);
    expect(xDraftLimit({ X_DRAFT_LIMIT: 'nonsense' } as never)).toBe(2);
  });
});
