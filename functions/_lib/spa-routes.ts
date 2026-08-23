/** Server-side contract for paths owned by the React SPA. */

const STATIC_PATHS = new Set([
  "", "/", "/live", "/videos", "/tournaments", "/login", "/account",
  "/account/my-tournaments", "/social", "/clubs", "/san", "/san/them",
  "/tim-ban-choi", "/tin-nhan", "/khoi-phuc-dang-ky", "/notifications",
  "/thong-bao", "/search", "/news", "/rankings", "/rankings/ppa-tour",
  "/feed", "/blog", "/forum", "/forum/new", "/tools",
  "/tools/quick-tables", "/tools/team-match", "/tools/team-match/new",
  "/tools/doubles-elimination", "/tools/doubles-elimination/new",
  "/tools/flex-tournament", "/tools/flex-tournament/new", "/tools/dashboard",
  "/privacy", "/terms", "/about", "/contact", "/advertise",
  "/affiliate-disclosure", "/livestream", "/auth/callback",
  "/auth/reset-password", "/dupr", "/match", "/match/new", "/match/confirm",
  "/tran-dau/moi", "/onboarding", "/su-kien", "/clubs/new",
  "/quick-tables", "/shop", "/shop/search", "/shop/cart", "/shop/orders",
  "/shop/sell", "/seller", "/seller/application",
  "/seller/application/status",
]);

const DYNAMIC_PATHS: RegExp[] = [
  /^\/live\/[^/]+$/, /^\/watch\/[^/]+$/, /^\/tournament\/[^/]+$/,
  /^\/org\/[^/]+$/, /^\/social\/[^/]+(?:\/(?:danh-sach|xep-cap|live))?$/,
  /^\/san\/khu-vuc\/[^/]+$/, /^\/san\/[^/]+$/, /^\/dang-ky\/[^/]+$/,
  /^\/news\/[^/]+$/, /^\/blog\/[^/]+$/, /^\/forum\/post\/[^/]+$/,
  /^\/forum\/[^/]+$/,
  /^\/tools\/quick-tables\/(?:parent\/|referee\/)?[^/]+(?:\/setup)?$/,
  /^\/tools\/team-match\/(?:match\/[^/]+\/score|[^/]+)$/,
  /^\/tools\/doubles-elimination\/(?:match\/[^/]+\/score|[^/]+)$/,
  /^\/tools\/flex-tournament\/[^/]+$/, /^\/tools\/dashboard\/[^/]+\/[^/]+$/,
  /^\/livestream\/[^/]+$/, /^\/match\/confirm\/[^/]+$/,
  /^\/tran-dau\/[^/]+$/, /^\/nguoi-choi\/[^/]+$/,
  /^\/su-kien\/[^/]+(?:\/(?:danh-sach|xep-cap|live))?$/,
  /^\/clb\/[^/]+(?:\/(?:quan-ly(?:\/cai-dat|\/(?:social|su-kien)\/[^/]+\/sua)?|(?:social|su-kien)\/moi))?$/,
  /^\/u\/[^/]+$/, /^\/share\/(?:live|video)\/[^/]+$/,
  /^\/quick-tables\/[^/]+(?:\/setup)?$/, /^\/matches\/[^/]+\/score$/,
  /^\/join\/[^/]+$/, /^\/embed\/(?:live|video)\/[^/]+$/,
  /^\/shop\/(?:category|product|store)\/[^/]+$/,
  /^\/shop\/(?:checkout|order)\/[^/]+$/,
  /^\/(?:admin|creator)(?:\/.*)?$/, /^\/seller(?:\/.*)?$/,
  /^\/proto\/shop(?:\/.*)?$/,
];

export function isKnownSpaPath(pathname: string): boolean {
  let path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === "/vi") return true;
  if (path.startsWith("/vi/")) path = path.slice(3) || "/";
  return STATIC_PATHS.has(path) || DYNAMIC_PATHS.some((pattern) => pattern.test(path));
}
