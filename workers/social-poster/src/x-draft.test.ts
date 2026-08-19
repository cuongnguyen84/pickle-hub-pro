import { describe, it, expect } from 'vitest';
import {
  checkXDraft,

  rankNewsCandidates,
  unsourcedNumbers,
  xDraftLimit,
  type NewsRow,
} from './x-draft';
import { isPromotionalSource } from './promo-filter';

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

describe('unsourcedNumbers', () => {
  // The failure this exists for, verbatim: the model wrote "No. 4 Columbus"
  // for a source that never mentioned a 4th seed. Under full automation that
  // sentence is the brand asserting something false, with nobody to catch it.
  it('flags a number the source never contained', () => {
    expect(unsourcedNumbers('No. 4 Columbus fell 21-10', 'Columbus fell 21-10'))
      .toEqual(['4']);
  });

  it('passes numbers that are present in the source', () => {
    expect(unsourcedNumbers('Johns won 11-6, 11-9', 'He won 11-6 and 11-9')).toEqual([]);
  });

  // The prompt demands digits, so a correct word→digit conversion must not be
  // mistaken for an invention or the guard fights its own instructions.
  it('accepts digits converted from a spelled-out source number', () => {
    expect(unsourcedNumbers('a 13-match streak', 'a thirteen-match winning streak'))
      .toEqual([]);
    expect(unsourcedNumbers('won 21-10', 'won twenty-one to ten')).toEqual([]);
  });

  it('is inert when no source text is supplied', () => {
    expect(checkXDraft('Johns won 11-6 in Dallas.').ok).toBe(true);
  });

  it('rejects through checkXDraft with the offending number in the detail', () => {
    const r = checkXDraft('No. 4 Columbus fell to Brooklyn', 'Columbus fell to Brooklyn');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe('unsourced_number');
    expect(r.detail).toBe('4');
  });
});

describe('isPromotionalSource', () => {
  it.each([
    ['Sponsored: the new Joola paddle', null],
    ['PPA announces partnership with Hyundai', null],
    ['Hong Kong Slam tickets on sale Friday', null],
    ['Ben Johns paddle now available', null],
    ['Win a paddle in our giveaway', null],
    ['Selkirk drops 20% off summer sale', null],
  ])('skips the press release: %s', (title, summary) => {
    expect(isPromotionalSource(title, summary as string | null)).toBe(true);
  });

  // The one that actually reached the queue on 2026-08-17 and had to be
  // deleted by hand. It matched none of the original sponsorship patterns.
  it('blocks the paddle release that got through the first version', () => {
    expect(
      isPromotionalSource(
        'Six Zero Expands Gemstone Paddle Line With Boulder Opal Release',
        null,
        'The Dink Pickleball',
        'equipment',
      ),
    ).toBe(true);
    // ...and still blocks it with the category stripped, via the gear patterns,
    // because 256 of 392 rows in the feed carry no category at all.
    expect(
      isPromotionalSource(
        'Six Zero Expands Gemstone Paddle Line With Boulder Opal Release',
        null,
      ),
    ).toBe(true);
  });

  it('blocks the business-category brand tour', () => {
    expect(
      isPromotionalSource(
        'PB5star Launches Cross-Country Road Trip to Promote Pickleball Brand',
        null,
        null,
        'business',
      ),
    ).toBe(true);
  });

  it('keeps the categories that are instructional rather than commercial', () => {
    expect(isPromotionalSource('Mastering Connected Shot Sequences', null, null, 'community'))
      .toBe(false);
    expect(isPromotionalSource('Elevating Pickleball IQ', null, null, 'player')).toBe(false);
    expect(
      isPromotionalSource('Thrilling DreamBreakers Highlight MLP Playoffs', null, null, 'tournament'),
    ).toBe(false);
  });

  // Facebook posts the Vietnamese child of the same story, so the filter has to
  // work in both languages or the advert just moves audience. That is not
  // theoretical: the Six Zero paddle release was blocked from X in the morning
  // and went out to both Facebook pages at 03:00 the same day.
  it('blocks the Vietnamese paddle release by category, as X does the English one', () => {
    expect(
      isPromotionalSource('Six Zero Ra Mắt Vợt Pickleball Boulder Opal Mới', null, null, 'equipment'),
    ).toBe(true);
    // ...and by keyword too, since 547 of 685 Vietnamese rows have no category.
    expect(isPromotionalSource('Six Zero Ra Mắt Vợt Pickleball Boulder Opal Mới', null)).toBe(true);
  });

  it.each([
    'Joola trình làng bộ sưu tập giày mới',
    'Selkirk mở bán vợt Luxx tại Việt Nam',
    'Giảm giá 30% toàn bộ vợt Six Zero',
    'PPA công bố nhà tài trợ chính thức mùa 2026',
    'Nhận quà tặng khi đặt trước vợt mới',
  ])('blocks Vietnamese commercial copy: %s', (title) => {
    expect(isPromotionalSource(title, null)).toBe(true);
  });

  it.each([
    'Ben Johns thắng Staksrud 11-6, 11-9 ở chung kết Hong Kong',
    'PPA ra mắt thể thức thi đấu mới cho mùa 2026',
    'MLP ra mắt đội hình Newport Beach',
    'Waters ngược dòng từ 0-6 để thắng 15-13',
  ])('keeps real Vietnamese reporting: %s', (title) => {
    expect(isPromotionalSource(title, null)).toBe(false);
  });

  it('lets real reporting through, including the word "announced"', () => {
    expect(isPromotionalSource('Johns beats Staksrud in Hong Kong final', null)).toBe(false);
    expect(isPromotionalSource('MLP announced the playoff schedule', null)).toBe(false);
  });

  it('drops promotional items before they reach the model', () => {
    const rows = [
      news({ id: 'ad', title: 'Sponsored: new paddle drop' }),
      news({ id: 'real', title: 'Waters wins Orlando' }),
    ];
    expect(rankNewsCandidates(rows, new Set()).map((r) => r.id)).toEqual(['real']);
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
  it('defaults to 8, respects the env, and caps runaway overrides', () => {
    expect(xDraftLimit({} as never)).toBe(8);
    expect(xDraftLimit({ X_DRAFT_LIMIT: '3' } as never)).toBe(3);
    expect(xDraftLimit({} as never, 4)).toBe(4);
    expect(xDraftLimit({} as never, 999)).toBe(10);
    expect(xDraftLimit({ X_DRAFT_LIMIT: 'nonsense' } as never)).toBe(8);
  });
});
