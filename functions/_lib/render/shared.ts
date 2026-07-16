/**
 * Shared helpers used by multiple render domains.
 * SEO-04 — split from index.ts (pure move, buildListJsonLd now exported
 * so the domain files can share it).
 */

// SEO-2.2 (2026-05-28) — small helper to build the ItemList JSON-LD
// embedded by every list page. Items keep DESC order semantics (newest
// first matches our query order) — Schema.org: ItemListOrderDescending.
export function buildListJsonLd(name: string, items: Array<{ url: string; name: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: items.map((it, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      url: it.url,
      name: it.name,
    })),
  };
}
