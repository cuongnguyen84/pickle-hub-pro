/**
 * Is this source article an advert rather than news?
 *
 * Shared by both pipelines. X posts the English original, Facebook posts the
 * Vietnamese translation of the same story, so a paddle release that is not
 * worth an English post is not worth a Vietnamese one either — filtering it in
 * one place and not the other just moves the advert to the other audience.
 * That is exactly what happened on 2026-08-17: the Six Zero paddle release was
 * blocked from X in the morning and went out to both Facebook pages at 03:00.
 *
 * Two layers, because neither covers the feed on its own.
 */

/**
 * Categories that are commercial by definition. Measured over 60 days of the
 * feed rather than guessed:
 *
 *   (null) 256 · player 57 · tournament 44 · community 18 · business 12 · equipment 5
 *
 * The two blocked here are the two whose sample titles are adverts —
 *   equipment: "Six Zero Expands Gemstone Paddle Line With Boulder Opal Release"
 *   business:  "PB5star Launches Cross-Country Road Trip to Promote Brand"
 * `community` and `player` sample as instructional, so they stay.
 *
 * The Vietnamese child rows carry the same category as their English parent,
 * verified on production, so this layer works for both pipelines unchanged.
 */
const BLOCKED_CATEGORIES: ReadonlyArray<string> = ['equipment', 'business'];

/** Publishers whose feed is mostly marketing. Add names as they show up. */
const BLOCKED_SOURCES: ReadonlyArray<string> = [];

/**
 * Second layer, for rows with no category — 256 of 392 in English, 547 of 685
 * in Vietnamese, so the majority of the feed on both sides.
 *
 * The first version of this list aimed at sponsorship language. Wrong guess:
 * this feed sells gear, and the paddle release that reached the queue matched
 * none of it. Patterns describe product launches, and each is paired with a
 * product noun so ordinary reporting survives — "PPA announces the playoff
 * schedule" and "PPA ra mắt thể thức mới" both have to stay postable.
 */
const PROMO_PATTERNS_EN: ReadonlyArray<RegExp> = [
  /\bpaddle (?:line|lineup|series|release|launch|drop)\b/i,
  /\b(?:unveils?|releases?|launches?|expands?|introduces?|debuts?) [^.]{0,30}\b(?:paddle|shoe|apparel|bag|gear|collection)\b/i,
  /\bgear (?:review|guide|drop|roundup)\b/i,
  /\bbest \d+ [a-z ]*(?:paddles?|shoes?)\b/i,
  /\b(?:hands[- ]on|first look) (?:review|with)\b/i,
  /\bsponsored\b/i,
  /\bpresented by\b/i,
  /\bpartners? with\b/i,
  /\bannounces? (?:a )?(?:partnership|sponsorship|collaboration)\b/i,
  /\bnow available\b/i,
  /\btickets? (?:are )?on sale\b/i,
  /\b(?:use )?(?:promo|discount) code\b/i,
  /\b\d+% off\b/i,
  /\bgiveaway\b/i,
  /\bpre-?order\b/i,
];

/**
 * Vietnamese. No \b anywhere: the boundary class is ASCII-only, so it behaves
 * unpredictably against "tài trợ" and friends. These are multi-word phrases,
 * so a substring match is specific enough without one.
 *
 * "ra mắt" alone is not promotional — a tour launches a format, a team launches
 * a roster — so the launch verbs are paired with a product noun, matching how
 * the English list is built.
 */
const PROMO_PATTERNS_VI: ReadonlyArray<RegExp> = [
  /(?:ra mắt|trình làng|giới thiệu|lấn sân)[^.]{0,40}(?:vợt|giày|balo|túi|bộ sưu tập|sản phẩm|dòng sản phẩm|thời trang)/i,
  /bộ sưu tập/i,
  /tài trợ/i,
  /khuyến mãi/i,
  /giảm giá/i,
  /mã giảm/i,
  /mở bán/i,
  /đặt (?:trước|hàng)/i,
  /quà tặng/i,
  /trúng thưởng/i,
  /ưu đãi/i,
];

export function isPromotionalSource(
  title: string,
  summary: string | null,
  source?: string | null,
  category?: string | null,
): boolean {
  if (category && BLOCKED_CATEGORIES.includes(category.toLowerCase())) return true;
  if (source && BLOCKED_SOURCES.some((s) => s.toLowerCase() === source.toLowerCase())) {
    return true;
  }
  const text = `${title} ${summary ?? ''}`;
  return (
    PROMO_PATTERNS_EN.some((p) => p.test(text)) ||
    PROMO_PATTERNS_VI.some((p) => p.test(text))
  );
}
