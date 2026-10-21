import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  buildShadowRequest,
  recordPromoShadow,
  shadowRowsFrom,
  type ShadowCandidate,
} from './promo-shadow';

const candidate = (id: string, title: string, summary = ''): ShadowCandidate => ({
  id,
  title,
  summary,
  category: null,
});

describe('buildShadowRequest', () => {
  it('asks one question per candidate, keyed by news item id', () => {
    const body = buildShadowRequest([
      candidate('aaa', 'Ben Johns wins Austin'),
      candidate('bbb', 'Six Zero expands Gemstone paddle line'),
    ]);
    expect(Object.keys(body.questions)).toEqual(['aaa', 'bbb']);
    expect(body.state.map((s) => s.id)).toEqual(['aaa', 'bbb']);
    // The key is not sent to the model, so the question text has to name the id
    // itself — otherwise every question is asked against the whole state and the
    // answers are indistinguishable.
    const q = body.questions.bbb as { instructions: string };
    expect(q.instructions).toContain('"bbb"');
  });

  it('caps the batch so a large Facebook scan cannot become a large bill', () => {
    const rows = Array.from({ length: 50 }, (_, i) => candidate(`id-${i}`, `Title ${i}`));
    const body = buildShadowRequest(rows);
    expect(Object.keys(body.questions)).toHaveLength(20);
    expect(body.state).toHaveLength(20);
  });
});

describe('shadowRowsFrom', () => {
  // The whole point of the log is comparing two verdicts on the SAME item. If
  // the pairing slips by one, two weeks of rows quietly say nothing.
  it('pairs each answer with its own candidate, not with position', () => {
    const rows = shadowRowsFrom(
      [candidate('aaa', 'Ben Johns wins Austin'), candidate('bbb', 'Six Zero paddle line drop')],
      { bbb: { type: 'noul', noul: 0.91 }, aaa: { type: 'noul', noul: 0.04 } },
      'x',
      'jev-1.13.0',
    );
    expect(rows.map((r) => [r.news_item_id, r.jev_noul])).toEqual([
      ['aaa', 0.04],
      ['bbb', 0.91],
    ]);
  });

  it('records the regex verdict that was actually acted on', () => {
    const rows = shadowRowsFrom(
      [
        // Matches PROMO_PATTERNS_EN (`paddle ... line`): the regex blocks it.
        candidate('blocked', 'Six Zero expands Gemstone paddle line with Boulder Opal'),
        // Matches nothing: the regex lets it through, which is the Six Zero shape.
        candidate('missed', 'Joola and Ben Johns reveal what comes after the Perseus'),
      ],
      { blocked: { noul: 0.88 }, missed: { noul: 0.64 } },
      'x',
      'jev-1.13.0',
    );
    expect(rows.find((r) => r.news_item_id === 'blocked')?.regex_blocked).toBe(true);
    expect(rows.find((r) => r.news_item_id === 'missed')?.regex_blocked).toBe(false);
  });

  it('drops answers with no number instead of logging them as agreement', () => {
    const rows = shadowRowsFrom(
      [candidate('aaa', 'A'), candidate('bbb', 'B')],
      { aaa: { noul: 0.5 } },
      'facebook',
      'jev-1.13.0',
    );
    expect(rows.map((r) => r.news_item_id)).toEqual(['aaa']);
  });
});

describe('recordPromoShadow', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('does nothing at all without an API key', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const logged = await recordPromoShadow(
      { SUPABASE_URL: 'https://x.test', SUPABASE_SERVICE_ROLE_KEY: 'k' },
      'x',
      [candidate('aaa', 'A')],
    );
    expect(logged).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('never throws when TypeSafe is down — a post that was fine must still go out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));
    await expect(
      recordPromoShadow(
        {
          SUPABASE_URL: 'https://x.test',
          SUPABASE_SERVICE_ROLE_KEY: 'k',
          TYPESAFE_API_KEY: 'ts-key',
        },
        'x',
        [candidate('aaa', 'A')],
      ),
    ).resolves.toBe(0);
  });

  it('logs the model that answered, not the alias we asked for', async () => {
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ model: 'jev-1.13.0', answers: { aaa: { noul: 0.7 } } }),
      })
      .mockResolvedValueOnce({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', fetchSpy);

    const logged = await recordPromoShadow(
      {
        SUPABASE_URL: 'https://x.test',
        SUPABASE_SERVICE_ROLE_KEY: 'k',
        TYPESAFE_API_KEY: 'ts-key',
      },
      'x',
      [candidate('aaa', 'A')],
    );
    expect(logged).toBe(1);
    const inserted = JSON.parse(fetchSpy.mock.calls[1][1].body);
    expect(inserted[0].model).toBe('jev-1.13.0');
    expect(fetchSpy.mock.calls[1][1].headers.Prefer).toContain('ignore-duplicates');
  });
});
