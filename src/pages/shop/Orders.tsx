// ============================================================================
// /shop/orders — B11, "Đơn của tôi".
// ----------------------------------------------------------------------------
// A list of orders is a list of QUESTIONS: do I have to do anything about this
// one. So every row says that in a sentence and there is no status pill —
// a pill is `white-space: nowrap`, and five of them at 375px is a page that
// scrolls sideways.
//
// The whole set arrives in one request (my_shop_orders, capped) and the tabs,
// the counts, the search and the "xem thêm" all work over it in memory. Four
// count queries plus a page query is five round trips for numbers that must
// agree with each other.
//
// Never indexed: this page is somebody's purchase history.
// ============================================================================

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, PackageOpen, Search, SearchX } from "lucide-react";
import { DynamicMeta } from "@/components/seo/DynamicMeta";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { ShopCartLink } from "@/components/shop/CartLink";
import { ShopErrorNotice } from "@/components/shop/ShopNotice";
import { ShopMonogram } from "@/components/shop/ShopMonogram";
import { useMyOrders, type OrderListRow } from "@/hooks/shop/useOrders";
import { formatVnd } from "@/lib/shop/publicCatalog";
import type { OrderStatus } from "@/integrations/supabase/shop-schema";
import "@/styles/shop.css";

const PAGE = 10;

// EN: My orders · Search by order code, shop or item · Show more
const COPY = {
  title: "Đơn của tôi",
  searchLabel: "Tìm trong đơn của tôi",
  searchPlaceholder: "Tìm theo mã đơn, tên shop hoặc tên món",
  loading: "Đang tải danh sách đơn…",
  // EN: We couldn't load your list. Your orders are all still there.
  loadError: "Chưa tải được danh sách đơn. Đơn của anh/chị vẫn còn nguyên.",
  retry: "Thử lại",
  emptyTitle: "Anh/chị chưa có đơn hàng nào",
  emptyBody: "Đặt đơn đầu tiên từ chợ nhé.",
  emptyCta: "Xem sản phẩm đang bán",
  noMatch: (q: string) => `Không có đơn nào khớp “${q}”`,
  clearSearch: "Xoá tìm kiếm",
  more: (n: number) => `Xem thêm (${n} đơn)`,
  received: "Tôi đã nhận hàng",
  otherItems: (n: number) => `+${n} món khác`,
};

/** What the buyer has to do about this order, as a sentence. The `shipped`
 *  row also gets a link, because that is the one state with an action — and
 *  the link goes to the order page, not to an RPC: confirming receipt asks
 *  for confirmation, and a list is the wrong place to ask. */
const BUYER_TODO: Record<OrderStatus, string> = {
  pending: "Shop chưa xác nhận — chưa cần làm gì. Huỷ được nếu đổi ý.",
  confirmed: "Người bán đang chuẩn bị hàng — chưa cần làm gì.",
  shipped: "Đang trên đường tới anh/chị.",
  delivered: "Đã giao xong.",
  cancelled: "Đã huỷ",
};

const CANCELLED_BY: Record<string, string> = {
  buyer: "do anh/chị",
  seller: "do shop",
  admin: "do quản trị viên",
};

type Tab = "all" | "active" | "done" | "cancelled";

const TABS: { key: Tab; label: string; statuses: OrderStatus[] | null }[] = [
  { key: "all", label: "Tất cả", statuses: null },
  { key: "active", label: "Đang tới", statuses: ["pending", "confirmed", "shipped"] },
  { key: "done", label: "Đã xong", statuses: ["delivered"] },
  { key: "cancelled", label: "Đã huỷ", statuses: ["cancelled"] },
];

const inTab = (status: OrderStatus, tab: Tab) => {
  const spec = TABS.find((t) => t.key === tab);
  return !spec?.statuses || spec.statuses.includes(status);
};

/** dd/MM — the year is noise on a list somebody scans. */
const dm = (iso: string) => {
  const d = new Date(iso);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}`;
};

const cancelledSentence = (row: OrderListRow) => {
  const kind = [...row.events].reverse().find((e) => e.action === "cancel")?.metadata?.actor_kind;
  const who = typeof kind === "string" ? CANCELLED_BY[kind] : undefined;
  return who ? `Đã huỷ, ${who}.` : "Đã huỷ.";
};

const haystack = (row: OrderListRow) =>
  [row.code, row.shop?.name ?? "", ...row.items.map((i) => i.product_title)]
    .join(" ")
    .toLowerCase();

export default function Orders() {
  const q = useMyOrders();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(PAGE);

  // Memoised for its IDENTITY, not its cost: `q.data ?? []` is a fresh array
  // every render, which would re-run every useMemo below on every keystroke.
  const rows = useMemo(() => q.data ?? [], [q.data]);
  const needle = search.trim().toLowerCase();

  // Search narrows the SET the counts are taken from, so the numbers on the
  // tabs always describe what pressing them would show.
  const searched = useMemo(
    () => (needle ? rows.filter((r) => haystack(r).includes(needle)) : rows),
    [rows, needle],
  );
  const counts = useMemo(() => {
    const out = {} as Record<Tab, number>;
    for (const t of TABS) out[t.key] = searched.filter((r) => inTab(r.status, t.key)).length;
    return out;
  }, [searched]);

  const filtered = useMemo(
    () => searched.filter((r) => inTab(r.status, tab)),
    [searched, tab],
  );
  const page = filtered.slice(0, shown);
  const rest = filtered.length - page.length;

  const pick = (next: Tab) => {
    setTab(next);
    setShown(PAGE);
  };

  const shell = (children: React.ReactNode) => (
    <TheLineLayout title={COPY.title}>
      <DynamicMeta title={COPY.title} noindex />
      <main className="tl-shop">
        <div className="tl-shop-page tl-shop-page--narrow">
          <div className="tl-shop-topline">
            {/* R5 #14 — the crumb repeated the <h1> right below it. */}
            <nav aria-label="Đường dẫn" className="tl-shop-crumbs">
              <Link to="/shop" className="tl-crumb">Chợ</Link>
            </nav>
            <ShopCartLink />
          </div>
          <h1 className="tl-shop-h1">{COPY.title}</h1>
          {children}
        </div>
      </main>
    </TheLineLayout>
  );

  if (q.isPending) {
    // R5 #6 — the shape of an order card: monogram + three text rows.
    return shell(
      <div aria-busy="true" aria-label={COPY.loading}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="tl-shop-card" style={{ display: "flex", gap: 12, marginBottom: 10 }}>
            <span className="tl-shop-sk" style={{ display: "block", width: 56, height: 56, borderRadius: 12, flex: "none" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span className="tl-shop-sk tl-shop-sk--line" style={{ width: "35%" }} />
              <span className="tl-shop-sk tl-shop-sk--line" style={{ width: "75%", height: 16 }} />
              <span className="tl-shop-sk tl-shop-sk--line" style={{ width: "55%", marginBottom: 0 }} />
            </div>
          </div>
        ))}
      </div>,
    );
  }

  if (q.isError) {
    return shell(
      <ShopErrorNotice title={COPY.loadError} body={null} onRetry={() => void q.refetch()} />,
    );
  }

  // Never ordered at all, and "nothing matched what you typed", are different
  // problems with different ways out.
  if (rows.length === 0) {
    return shell(
      <div className="tl-shop-empty">
        <PackageOpen size={28} aria-hidden="true" />
        <p className="tl-shop-empty-title">{COPY.emptyTitle}</p>
        <p>{COPY.emptyBody}</p>
        <Link to="/shop" className="tl-shop-btn tl-shop-btn--primary">{COPY.emptyCta}</Link>
      </div>,
    );
  }

  return shell(
    <>
      <section aria-labelledby="orders-find">
        <h2 id="orders-find" className="tl-shop-sr">Tìm và lọc đơn</h2>

        <div className="tl-shop-searchfield" style={{ marginBottom: 14 }}>
          <label htmlFor="orders-q" className="tl-shop-sr">{COPY.searchLabel}</label>
          <Search size={17} aria-hidden="true" />
          <input
            id="orders-q"
            type="search"
            value={search}
            placeholder={COPY.searchPlaceholder}
            onChange={(e) => {
              setSearch(e.target.value);
              setShown(PAGE);
            }}
          />
        </div>

        <div className="tl-shop-cats" role="tablist" aria-label="Lọc theo trạng thái đơn">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`orders-tab-${t.key}`}
              // R5 #2 — BOTH attributes, on purpose. `aria-selected` is what a
              // role="tab" is required to carry (dropping it is an ARIA
              // violation), and `aria-current="page"` is the only selector
              // shop.css styles a chip on. With just the first one, the four
              // chips were identical grey and the screen was broken, not ugly.
              aria-selected={tab === t.key}
              aria-current={tab === t.key ? "page" : undefined}
              aria-controls="orders-list"
              className="tl-shop-cat"
              onClick={() => pick(t.key)}
            >
              {t.label} <span className="count">{counts[t.key]}</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="orders-list-h" id="orders-list" className="tl-shop-section">
        <h2 id="orders-list-h" className="tl-shop-sr">Danh sách đơn</h2>

        {filtered.length === 0 ? (
          <div className="tl-shop-empty">
            <SearchX size={28} aria-hidden="true" />
            <p className="tl-shop-empty-title">
              {needle ? COPY.noMatch(search.trim()) : "Không có đơn nào ở mục này"}
            </p>
            {needle ? (
              <button
                type="button"
                className="tl-shop-btn"
                onClick={() => {
                  setSearch("");
                  setShown(PAGE);
                }}
              >
                {COPY.clearSearch}
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {page.map((row) => (
                <OrderRow key={row.id} row={row} />
              ))}
            </ul>
            {rest > 0 && (
              <button
                type="button"
                className="tl-shop-btn tl-shop-btn--block"
                style={{ marginTop: 12 }}
                onClick={() => setShown((n) => n + PAGE)}
              >
                {COPY.more(rest)}
              </button>
            )}
          </>
        )}
      </section>
    </>,
  );
}

function OrderRow({ row }: { row: OrderListRow }) {
  const shopName = row.shop?.name ?? "Người bán";
  const first = row.items[0]?.product_title ?? "Sản phẩm";
  const others = Math.max(0, row.items.length - 1);
  const todo = row.status === "cancelled" ? cancelledSentence(row) : BUYER_TODO[row.status];

  return (
    <li className="tl-shop-card" style={{ display: "flex", gap: 12, marginBottom: 10 }}>
      {/* The order has no photo of its own: shop_order_items snapshot the title
          and the price, not the image, so that an order stays readable after
          the product is taken down. The shop's monogram is the honest stand-in
          and costs no second query. */}
      <ShopMonogram name={shopName} size={56} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <p className="tl-shop-hint" style={{ margin: 0 }}>{shopName}</p>
        {/* One main link per card, and it is what was bought. R5 #15: with
            `color: inherit` and no underline it read as plain text, so it
            carries a chevron and answers a tap. */}
        <Link to={`/shop/order/${row.code}`} className="tl-shop-rowlink">
          <span>
            {first}
            {others > 0 ? ` ${COPY.otherItems(others)}` : ""}
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
        <div className="tl-shop-hint" style={{ margin: 0, fontVariantNumeric: "tabular-nums" }}>
          {row.code} · {dm(row.created_at)} · {formatVnd(row.total_vnd)}
        </div>
        <p className="tl-shop-hint" style={{ margin: 0 }}>{todo}</p>
        {row.status === "shipped" && (
          <div>
            {/* A link, not a button: confirming receipt asks first, and the
                question belongs on the order page with the order in front of
                them — not fired from a row they may have mis-tapped. */}
            <Link
              to={`/shop/order/${row.code}`}
              className="tl-shop-btn tl-shop-btn--sm"
              aria-label={`${COPY.received} — đơn ${row.code}`}
            >
              {COPY.received}
            </Link>
          </div>
        )}
      </div>
    </li>
  );
}
