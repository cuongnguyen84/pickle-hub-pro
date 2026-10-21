// ============================================================================
// "Liên hệ shop" — D2.
// ============================================================================
// P2b has no cart, so this is the only thing a buyer can DO on a product page.
// It is also the only place ThePickleHub hands somebody off to an outside app,
// which is why every part of it is constrained:
//
//   · the destination is server-derived (shop_public_contacts returns the
//     NORMALISED value); nothing here builds a link out of seller text;
//   · a scheme allowlist, checked again on the way out, because a value that
//     was safe at approval time is not automatically the value in the row now;
//   · no buyer PII in the URL — not a name, not a phone, not the product;
//   · it is not called chat. Messaging is not built, so it is not implied.
// ============================================================================

export type ContactType = "phone" | "zalo" | "messenger";

export interface PublicContact {
  id: string;
  type: ContactType;
  /** Server-derived. The ONLY value any link may be built from. */
  href: string;
  label: string | null;
}

export const CONTACT_LABEL: Record<ContactType, string> = {
  phone: "Gọi điện",
  zalo: "Nhắn Zalo",
  messenger: "Nhắn Messenger",
};

/** Where each channel actually takes the buyer, said plainly before they go. */
export const CONTACT_DESTINATION: Record<ContactType, string> = {
  phone: "Mở ứng dụng gọi điện trên máy anh/chị",
  zalo: "Mở Zalo — anh/chị sẽ rời ThePickleHub",
  messenger: "Mở Messenger — anh/chị sẽ rời ThePickleHub",
};

/**
 * The scheme allowlist, applied to the value the server handed over.
 *
 * A phone channel is normalised to E.164 and becomes `tel:`; Zalo and
 * Messenger are normalised to their own https origins. Anything else — a
 * `javascript:` that slipped past, an http link, a different host — is refused
 * here as well as at approval, because these are two different moments and the
 * row can change between them.
 */
export function contactHref(c: PublicContact): string | null {
  const v = (c.href ?? "").trim();
  if (!v) return null;

  if (c.type === "phone") {
    // E.164 only. Anything with a scheme, a space or a letter is not a number
    // this app normalised.
    return /^\+\d{8,15}$/.test(v) ? `tel:${v}` : null;
  }

  let url: URL;
  try {
    url = new URL(v);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  const HOSTS: Record<Exclude<ContactType, "phone">, string[]> = {
    zalo: ["zalo.me"],
    messenger: ["m.me"],
  };
  if (!HOSTS[c.type].includes(url.hostname)) return null;

  // No query, no fragment, ever — that is where a buyer's identity or the
  // product they were looking at would end up.
  return `${url.origin}${url.pathname}`;
}

/** Channels safe to render, in a stable order. Anything refused is dropped. */
export function usableContacts(contacts: PublicContact[] | undefined): PublicContact[] {
  const ORDER: ContactType[] = ["zalo", "messenger", "phone"];
  return (contacts ?? [])
    .filter((c) => contactHref(c) !== null)
    .sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
}

/**
 * What analytics may record.
 *
 * The channel TYPE and the ids of things that are already public. Never the
 * number, never the URL, never the handle — a funnel is not worth a seller's
 * phone number sitting in an analytics warehouse.
 */
export const contactAnalyticsPayload = (
  c: PublicContact,
  productId: string | null,
  shopSlug: string,
) => ({ channel_type: c.type, product_id: productId, shop_slug: shopSlug });

/** Said when there is no approved channel. Honest, and not a disabled button. */
export const NO_CONTACT_COPY =
  "Shop chưa cung cấp kênh liên hệ nào đã được duyệt. Khi có, nút liên hệ sẽ hiện ở đây.";
