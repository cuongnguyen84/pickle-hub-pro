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

/**
 * Gear layer, owner rule 2026-10-21: "Anh ko muốn đăng những bài quảng cáo dạng
 * như thế này. Cả vợt nữa." It followed a Selkirk S2 Pro ball / crack-warranty
 * post on TA Pickleball. None of the launch patterns above caught it, and the
 * paddle reviews and buying guides before it never looked like adverts to them.
 *
 * So the rule is no longer "no press releases" but "no posts ABOUT products":
 * paddle, ball, shoe and bag reviews, launches, buying guides, best-of lists,
 * warranties, paddle tech and brand-named product pieces. Coaching that mentions
 * a paddle ("paddle angle", "watch the paddle, not the ball") must stay, which is
 * why these run against the TITLE only and pair the product noun with a
 * commercial word. `equipment` stays unblocked as a category for the reason
 * given above BLOCKED_CATEGORIES: half of it is technique and injury pieces.
 */
const GEAR_TITLE_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(?:paddles?|balls?|shoes?|apparel|bags?)\b[^.]{0,40}\b(?:review|buying|launch(?:es|ed)?|debuts?|warranty|technology|tech|testing|popularity|performance)\b/i,
  /\b(?:reviews?|best|top|buying|buy|choose|choosing|new)\b[^.]{0,30}\b(?:paddles?|shoes?)\b/i,
  /\bpaddle (?:review|buying|guide|line|lineup|series|release|launch|drop|tech(?:nology)?)\b/i,
  /\b(?:dead|worn[- ]out) paddle|\bpaddle is dead\b/i,
  /\bwarrant(?:y|ies)\b/i,
  /\b(?:fake|counterfeit|knock-?off)\b[^.]{0,25}\b(?:balls?|paddles?|shoes?)\b/i,
  /(?:đánh giá|review)[^.]{0,30}(?:vợt|bóng|giày|balo|túi)/i,
  /(?:vợt|giày|balo|túi|bóng pickleball)[^.]{0,40}đánh giá/i,
  /(?:chọn|mua)[^.]{0,15}vợt/i,
  /(?:vợt|bóng|giày)[^.]{0,30}(?:tốt nhất|hàng đầu|cao cấp)/i,
  /top (?:\d+ )?(?:vợt|giày|bóng)/i,
  /bảo hành/i,
  /công nghệ vợt/i,
  /(?:dòng|mẫu) vợt/i,
  /vợt[^.]{0,25}(?:hỏng|chết)/i,
  /(?:giả mạo|hàng giả|hàng nhái)/i,
  /(?:xuất hiện trên|in lên) (?:mẫu )?vợt/i,
  /(?:ra mắt|trình làng)[^.]{0,40}(?:dụng cụ|bóng pickleball|mẫu bóng)/i,
];

/** Names that only ever mean a gear company in this feed. */
const GEAR_BRANDS = [
  'selkirk', 'joola', 'gearbox', 'six zero', 'crbn', 'paddletek', 'onix', 'vatic',
  'volair', '11six24', 'sqairz', 'diadem', 'prokennex', 'babolat', 'ronbus',
  'bread & butter', 'pb5star', 'currex', 'holbrook', 'skechers', 'k-swiss', 'body helix',
];
/** Brands that are also ordinary words or surnames: only with a product noun. */
const AMBIGUOUS_GEAR_BRANDS = [
  'franklin', 'wilson', 'head', 'engage', 'gamma', 'proton', 'honolulu', 'electrum',
  'legacy', 'vulcan', 'adidas', 'asics',
];
const PRODUCT_NOUN = /\b(?:paddles?|balls?|shoes?|bags?|apparel|gear)\b|vợt|bóng pickleball|giày|balo/i;
// A brand in a sponsored event name ("Selkirk Red Rock Open") is tournament news.
const EVENT_MARKER = /\b(?:open|cup|championships?|slam|tour|wins?|won|playoffs?|finals?|league|mlp|ppa|app)\b|vô địch|giải|chung kết/i;

function hasWord(title: string, word: string): boolean {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${esc}(?:$|[^a-z0-9])`, 'i').test(title);
}

/** Title-only check for product/gear pieces. Exported for tests. */
export function isGearPromoTitle(title: string): boolean {
  if (GEAR_TITLE_PATTERNS.some((p) => p.test(title))) return true;
  const event = EVENT_MARKER.test(title);
  if (!event && GEAR_BRANDS.some((b) => hasWord(title, b))) return true;
  return PRODUCT_NOUN.test(title) && AMBIGUOUS_GEAR_BRANDS.some((b) => hasWord(title, b));
}

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
  if (isGearPromoTitle(title)) return true;
  const text = `${title} ${summary ?? ''}`;
  return (
    PROMO_PATTERNS_EN.some((p) => p.test(text)) ||
    PROMO_PATTERNS_VI.some((p) => p.test(text))
  );
}
