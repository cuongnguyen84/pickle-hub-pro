// ============================================================================
// renderShop* — what a crawler actually receives once the gate is open.
// ----------------------------------------------------------------------------
// shop-pilot-seo-edge.test.ts proves the bot is NOT served the catalogue while
// the flag is off. That test cannot say anything about the page it gets when
// the flag is on, and "the flag flipped, the bot got renderDefault" is the
// exact failure this module exists to prevent (2026-08-05: perfect tags, empty
// article, 71 words served instead of 1518).
//
// So these call the renderers directly with a fake Supabase whose rpc() returns
// the shapes production returned when this was written — captured from
// /rest/v1/rpc/shop_public_product against the live project, not invented.
//
// The assertions that matter are the ones about honesty, not markup:
//   * a price in the body AND the same price in the Offer
//   * availability stated only when the shop can actually take the order
//   * a missing or suspended product answers 404, not a 200 shell
// ============================================================================

import { describe, expect, it, vi } from "vitest";
import {
  renderShopCatalog,
  renderShopCategory,
  renderShopProduct,
  renderShopStore,
} from "../render/shop";
import type { SupabaseClient } from "../supabase";

const SITE = "https://www.thepicklehub.net";
const MEDIA = "https://ajvlcamxemgbxduhiqrl.supabase.co";

/** Live shape, 2026-08-18. */
const CARD = {
  id: "547511b0-6064-43e9-9044-5a30f32355c4",
  slug: "kaiwin-diamond",
  title: "Kaiwin Diamond",
  price_min: 2900000,
  price_max: 2900000,
  availability: "in_stock",
  condition: "new",
  created_at: "2026-08-16T13:30:48.600939+00:00",
  category: { slug: "vot", name: "Vợt pickleball" },
  shop: { slug: "thepicklehub", name: "ThePickleHub", verified: true },
  cover: { public_path: "dab96b89/547511b0/e7f2aeae-v1.webp", alt_text: null },
};

const PRODUCT = {
  slug: "kaiwin-diamond",
  title: "Kaiwin Diamond",
  description: "Hàng mới về",
  condition: "new",
  in_stock: true,
  category: { slug: "vot", name: "Vợt pickleball" },
  shop: {
    slug: "thepicklehub",
    name: "ThePickleHub",
    verified: true,
    region: null,
    shipping_note: "Giao hàng miễn phí toàn quốc",
    return_note: "Đổi trả theo chính sách của từng hãng",
    shipping_fee_vnd: 30000,
    ordering_enabled: true,
  },
  media: [{ public_path: "dab96b89/547511b0/e7f2aeae-v1.webp", alt_text: null }],
  variants: [{ price_vnd: 2900000, availability: "in_stock", sku: null }],
};

/** rpc(name, args) → whatever `routes` says, keyed by RPC name. */
function fakeSupabase(routes: Record<string, unknown>): SupabaseClient {
  return {
    rpc: vi.fn(async (name: string) => {
      if (!(name in routes)) return { data: null, error: { message: `no route for ${name}` } };
      return { data: routes[name], error: null };
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const jsonLdOf = (html: string) => {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  return m ? JSON.parse(m[1]) : null;
};

const nodeOfType = (html: string, type: string) => {
  const ld = jsonLdOf(html);
  if (!ld) return null;
  const graph = Array.isArray(ld["@graph"]) ? ld["@graph"] : [ld];
  return graph.find((n: { "@type"?: string }) => n["@type"] === type) ?? null;
};

// ─── PDP ────────────────────────────────────────────────────────────────────

describe("renderShopProduct", () => {
  const call = (overrides: Record<string, unknown> = {}, lang: "en" | "vi" = "vi") =>
    renderShopProduct(
      fakeSupabase({ shop_public_product: { found: true, product: { ...PRODUCT, ...overrides } } }),
      "kaiwin-diamond",
      SITE,
      lang,
      MEDIA,
    );

  it("serves the product, the price and the seller in the BODY", async () => {
    const html = await (await call()).text();
    // Not the tags — the body. A page with a perfect <title> and no content is
    // the failure mode this whole module was written for.
    expect(html).toContain("Kaiwin Diamond");
    expect(html).toContain("2.900.000₫");
    expect(html).toContain("ThePickleHub");
    expect(html).toContain("Hàng mới về");
    // …and a real anchor back into the catalogue, so the page is not an orphan.
    expect(html).toContain(`${SITE}/vi/shop/category/vot`);
    expect(html).toContain(`${SITE}/vi/shop/store/thepicklehub`);
  });

  it("puts the same price in the Offer as in the body", async () => {
    const offer = nodeOfType(await (await call()).text(), "Product")?.offers;
    expect(offer).toMatchObject({
      "@type": "Offer",
      price: 2900000,
      priceCurrency: "VND",
      availability: "https://schema.org/InStock",
    });
  });

  it("says OutOfStock when the product is out of stock", async () => {
    const offer = nodeOfType(await (await call({ in_stock: false })).text(), "Product")?.offers;
    expect(offer.availability).toBe("https://schema.org/OutOfStock");
  });

  it("states NO availability when the shop is not taking orders", async () => {
    // The variant rows still say in_stock. Emitting InStock here would promise
    // a purchase the page cannot complete — the one schema lie Google demotes
    // for. The price stays; only the promise goes.
    const html = await (
      await call({ shop: { ...PRODUCT.shop, ordering_enabled: false } })
    ).text();
    const offer = nodeOfType(html, "Product")?.offers;
    expect(offer.price).toBe(2900000);
    expect(offer.availability).toBeUndefined();
    expect(html).toContain("tạm chưa nhận đơn");
  });

  it("uses AggregateOffer when variants disagree on price", async () => {
    const offer = nodeOfType(
      await (
        await call({
          variants: [
            { price_vnd: 2900000, availability: "in_stock", sku: null },
            { price_vnd: 3400000, availability: "in_stock", sku: null },
          ],
        })
      ).text(),
      "Product",
    )?.offers;
    expect(offer).toMatchObject({
      "@type": "AggregateOffer",
      lowPrice: 2900000,
      highPrice: 3400000,
      offerCount: 2,
    });
  });

  it("emits the real photo as og:image, from the public bucket", async () => {
    const html = await (await call()).text();
    expect(html).toContain(
      `${MEDIA}/storage/v1/object/public/shop-product-media/dab96b89/547511b0/e7f2aeae-v1.webp`,
    );
  });

  it("drops a signed or absolute media path rather than publishing it", async () => {
    // A signed URL in og:image expires and becomes a broken card weeks later,
    // silently. Better no image than one with a countdown on it.
    const html = await (
      await call({ media: [{ public_path: "https://evil.example/x.png?token=abc", alt_text: null }] })
    ).text();
    expect(html).not.toContain("evil.example");
    expect(nodeOfType(html, "Product")?.image).toBeUndefined();
  });

  it("answers 404 for a product that is missing, suspended or unpublished", async () => {
    // The RPC answers {found:false} for all three on purpose — a 200 would
    // confirm the slug is real and merely hidden.
    const res = await renderShopProduct(
      fakeSupabase({ shop_public_product: { found: false } }),
      "nope",
      SITE,
      "vi",
      MEDIA,
    );
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("noindex");
  });

  it("self-references its own locale and links the other one", async () => {
    const vi = await (await call({}, "vi")).text();
    expect(vi).toContain(`<link rel="canonical" href="${SITE}/vi/shop/product/kaiwin-diamond"`);
    expect(vi).toContain(`hreflang="en" href="${SITE}/shop/product/kaiwin-diamond"`);
    const en = await (await call({}, "en")).text();
    expect(en).toContain(`<link rel="canonical" href="${SITE}/shop/product/kaiwin-diamond"`);
  });

  it("escapes a seller-supplied title in BOTH the body and the JSON-LD", async () => {
    // Two different escapes, two different breakout risks, one product title.
    // The first version of this test used /<script[^>]*>[^<]*alert/ and went
    // red on the ld+json block itself — because the serializer had escaped
    // every `<` to <, so "no < between the tag and alert" was true of
    // correctly-escaped output. It was measuring the wrong thing.
    const html = await (await call({ title: "<script>alert(1)</script>" })).text();

    // Body: entity-escaped, so the browser sees text.
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");

    // JSON-LD: the only sequence that can end the block early is a literal
    // `</script`. It must not appear anywhere between the ld+json opening tag
    // and its close.
    const ld = html.slice(html.indexOf('<script type="application/ld+json">'));
    const inner = ld.slice(0, ld.indexOf("</script>"));
    expect(inner).not.toMatch(/<\/script/i);
    expect(inner).toContain("\\u003cscript\\u003e");

    // Deliberately NOT a third "no executable script anywhere" regex: every
    // version of it spanned [\s\S]*? from an unrelated <script> tag to the
    // escaped payload and went red on correct output. The two assertions
    // above are the actual breakout surfaces, and they are exact.
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});

// ─── Catalogue, category, storefront ────────────────────────────────────────

describe("renderShopCatalog", () => {
  it("lists real products with real prices and links each one", async () => {
    const html = await (
      await renderShopCatalog(
        fakeSupabase({
          shop_public_search: { rows: [CARD], total: 1, has_more: false },
          shop_public_categories: [{ slug: "vot", name: "Vợt pickleball", product_count: 1 }],
        }),
        SITE,
        "vi",
      )
    ).text();
    expect(html).toContain("Kaiwin Diamond");
    expect(html).toContain("2.900.000₫");
    expect(html).toContain(`${SITE}/vi/shop/product/kaiwin-diamond`);
    expect(html).toContain(`${SITE}/vi/shop/category/vot`);
    // GEO rule: the count is front-loaded and ThePickleHub is named once.
    expect(html).toMatch(/ThePickleHub Shop đang mở bán 1 sản phẩm/);
  });

  it("survives an empty catalogue without claiming products exist", async () => {
    const html = await (
      await renderShopCatalog(
        fakeSupabase({ shop_public_search: { rows: [], total: 0 }, shop_public_categories: [] }),
        SITE,
        "vi",
      )
    ).text();
    expect(html).toContain("Chưa có sản phẩm nào");
    expect(html).not.toMatch(/đang mở bán 0 sản phẩm/);
    expect(jsonLdOf(html)).toBeNull();
  });

  it("still renders when the RPC fails", async () => {
    // A database blip must not hand the crawler a 500 for the shop hub.
    const res = await renderShopCatalog(fakeSupabase({}), SITE, "en");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("ThePickleHub Shop");
  });
});

describe("renderShopCategory", () => {
  it("titles itself with the category NAME, never the slug", async () => {
    const html = await (
      await renderShopCategory(
        fakeSupabase({
          shop_public_search: { rows: [CARD], total: 1 },
          shop_public_categories: [{ slug: "vot", name: "Vợt pickleball" }],
        }),
        "vot",
        SITE,
        "vi",
      )
    ).text();
    expect(html).toContain("<h1>Vợt pickleball</h1>");
    expect(html).not.toMatch(/<h1>vot<\/h1>/);
  });

  it("does not say 'pickleball' twice when the category name already has it", async () => {
    // Caught on the live preview, not by a reviewer: the taxonomy is
    // Vietnamese and some names carry the word already. The EN title read
    // "Pickleball Vợt pickleball — prices and sellers" and the VI one read
    // "Vợt pickleball pickleball — giá và nơi mua".
    const call = (lang: "en" | "vi", name: string) =>
      renderShopCategory(
        fakeSupabase({
          shop_public_search: { rows: [CARD], total: 1 },
          shop_public_categories: [{ slug: "c", name }],
        }),
        "c",
        SITE,
        lang,
      ).then((r) => r.text());

    const viHas = await call("vi", "Vợt pickleball");
    expect(viHas).not.toMatch(/pickleball pickleball/i);
    const enHas = await call("en", "Vợt pickleball");
    expect(enHas).not.toMatch(/Pickleball Vợt pickleball/i);

    // …and it is still added when the name does NOT carry it, because that is
    // the keyword the page is for.
    const viNo = await call("vi", "Giày");
    expect(viNo).toContain("Giày pickleball");
    const enNo = await call("en", "Giày");
    expect(enNo).toContain("Pickleball Giày");
  });

  it("does not advertise a price floor it cannot back with a number", async () => {
    const html = await (
      await renderShopCategory(
        fakeSupabase({
          shop_public_search: { rows: [{ ...CARD, price_min: null, price_max: null }], total: 1 },
          shop_public_categories: [{ slug: "vot", name: "Vợt pickleball" }],
        }),
        "vot",
        SITE,
        "vi",
      )
    ).text();
    expect(html).not.toContain("Infinity");
    expect(html).not.toContain("giá từ");
  });
});

describe("renderShopStore", () => {
  const SHOP = {
    name: "ThePickleHub",
    intro: "All about Pickleball",
    region: null,
    verified: true,
    shipping_note: "Giao hàng miễn phí toàn quốc",
    return_note: "Đổi trả theo chính sách của từng hãng",
  };

  it("emits one @graph with the Store and its ItemList, not two @contexts", async () => {
    const html = await (
      await renderShopStore(
        fakeSupabase({
          shop_public_shop: { found: true, shop: SHOP },
          shop_public_search: { rows: [CARD], total: 1 },
        }),
        "thepicklehub",
        SITE,
        "vi",
      )
    ).text();
    const ld = jsonLdOf(html);
    expect(ld["@graph"]).toHaveLength(2);
    expect(ld["@graph"][1]["@context"]).toBeUndefined();
    expect(nodeOfType(html, "Store")).toMatchObject({ name: "ThePickleHub" });
    expect(html).toContain("Giao hàng miễn phí toàn quốc");
  });

  it("answers 404 for a suspended shop, exactly like one that never existed", async () => {
    const res = await renderShopStore(
      fakeSupabase({ shop_public_shop: { found: false } }),
      "suspended-shop",
      SITE,
      "vi",
    );
    expect(res.status).toBe(404);
  });
});
