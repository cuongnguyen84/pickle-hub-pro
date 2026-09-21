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
 * Categories are no longer a filter layer. Kept as an empty list rather than
 * deleted, because the reason it is empty is the point.
 *
 * The original list blocked `equipment` and `business` on a 60-day sample that
 * read:
 *
 *   (null) 256 · player 57 · tournament 44 · community 18 · business 12 · equipment 5
 *
 * The same count over the 30 days to 2026-09-21:
 *
 *   equipment 128 · tournament 93 · player 76 · community 34 · business 27 · (null) 0
 *
 * `equipment` went from the smallest category to the largest, and the nulls are
 * gone: news-rewrite now assigns a category to every article, and its
 * classifier files coaching and injury pieces under `equipment`. The blocklist
 * was built on five paddle releases and ended up blocking a third of the feed.
 *
 * Measured, not guessed. The first 21 rows of promo_filter_shadow (see
 * supabase/migrations/20260921090000_promo_filter_shadow.sql) are 20 blocked
 * items, of which two are genuinely adverts:
 *
 *   CURREX ra mắt lót giày SUPPORTSTP ............ noul 0.82  advert
 *   Tùy chỉnh vợt: tay cầm và trọng lượng ........ noul 0.67  borderline
 *   Kỹ thuật dink / stacking / cú lob / scorpion .. noul 0.03-0.08  coaching
 *   Khuỷu tay, khớp vai, phục hồi gân cơ ......... noul 0.05-0.06  coaching
 *   Samin Odhwani rời ghế ủy viên MLP ............ noul 0.03  league news
 *
 * The last one is why `business` went too: a league executive stepping down is
 * not marketing.
 *
 * ponytail: an empty array, not a deleted parameter. `isPromotionalSource`
 * still takes a category so the call sites and the shadow log keep their
 * shape, and putting a category back is a one-word change if the data ever
 * argues for one.
 */
const BLOCKED_CATEGORIES: ReadonlyArray<string> = [];

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
  // Brand marketing written as an event. This was covered by the `business`
  // category until that category turned out to carry real league news too;
  // the shape is specific enough to name directly.
  /\bto promote [^.]{0,30}\bbrand\b/i,
  /\bbrand (?:tour|activation|ambassador program)\b/i,
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
