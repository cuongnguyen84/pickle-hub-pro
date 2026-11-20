import { parseFragment, serialize, type DefaultTreeAdapterTypes as Tree } from "parse5";

// Parse as HTML5 before inspecting attributes: entities, malformed markup and
// namespace transitions must have browser semantics, never regex semantics.
const TAGS = new Set("a abbr article aside b blockquote br caption code col colgroup dd del details div dl dt em figcaption figure h1 h2 h3 h4 h5 h6 hr i img ins kbd li main mark nav ol p pre s section small span strong sub summary sup table tbody td th thead time tr u ul".split(" "));
const DROP_CONTENT = new Set("script style iframe object embed template noscript textarea xmp plaintext noembed noframes svg math form input button select option".split(" "));
const COMMON = new Set(["class", "title", "lang", "dir", "aria-label"]);
const ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "target"]), img: new Set(["src", "alt", "width", "height", "loading", "decoding"]),
  td: new Set(["colspan", "rowspan"]), th: new Set(["colspan", "rowspan", "scope"]),
  ol: new Set(["start", "reversed"]), li: new Set(["value"]), time: new Set(["datetime"]),
  details: new Set(["open"]), col: new Set(["span"]), colgroup: new Set(["span"]),
};
function safeUrl(value: string, image: boolean): boolean {
  // The parser has already decoded character references. Reject control chars,
  // backslashes and protocol-relative URLs rather than normalizing ambiguities.
  if ([...value].some((char) => char.charCodeAt(0) <= 32 || (char.charCodeAt(0) >= 127 && char.charCodeAt(0) <= 159) || char === "\\") || value.startsWith("//")) return false;
  if (value.startsWith("/") || value.startsWith("#")) return true;
  try {
    const url = new URL(value);
    return !url.username && !url.password &&
      (url.protocol === "https:" || url.protocol === "http:" ||
        (!image && (url.protocol === "mailto:" || url.protocol === "tel:")));
  } catch { return false; }
}
function clean(parent: Tree.ParentNode, anchors: Map<string, string>, depth = 0): void {
  if (depth >= 64) { parent.childNodes = []; return; }
  const children: Tree.ChildNode[] = [];
  for (const child of parent.childNodes) {
    if (child.nodeName === "#text") { children.push(child); continue; }
    if (!("tagName" in child)) continue;
    if (child.namespaceURI !== "http://www.w3.org/1999/xhtml" || DROP_CONTENT.has(child.tagName)) continue;
    clean(child, anchors, depth + 1);
    if (!TAGS.has(child.tagName)) {
      for (const nested of child.childNodes) { nested.parentNode = parent; children.push(nested); }
      continue;
    }
    child.attrs = child.attrs.filter((attr) => {
      if (attr.namespace || attr.prefix) return false;
      if (attr.name === "id" && /^h[1-6]$/.test(child.tagName)) {
        const safe = anchors.get(attr.value);
        if (!safe) return false;
        attr.value = safe;
        return true;
      }
      if (child.tagName === "a" && attr.name === "href" && attr.value.startsWith("#")) {
        let id: string;
        try { id = decodeURIComponent(attr.value.slice(1)); } catch { return false; }
        const safe = anchors.get(id);
        if (!safe) return false;
        attr.value = `#${safe}`;
        return true;
      }
      if (!(COMMON.has(attr.name) || ATTRS[child.tagName]?.has(attr.name))) return false;
      if (attr.name === "href" || attr.name === "src") return safeUrl(attr.value, child.tagName === "img");
      if (attr.name === "target") return attr.value === "_blank" || attr.value === "_self";
      if (["width", "height", "rowspan", "colspan", "span"].includes(attr.name)) return /^\d{1,4}$/.test(attr.value);
      if (attr.name === "dir") return /^(ltr|rtl|auto)$/.test(attr.value);
      return true;
    });
    if (child.tagName === "a" && child.attrs.some((attr) => attr.name === "target" && attr.value === "_blank")) {
      child.attrs.push({ name: "rel", value: "noopener noreferrer" });
    }
    children.push(child);
  }
  parent.childNodes = children;
}
export function sanitizeBlogHtml(html: string): string {
  // Bound parser work for corrupted/hostile stored documents; fail closed.
  if (html.length > 1_000_000) return "";
  const fragment = parseFragment(html);
  // Only heading anchors survive, inside a dedicated namespace. Collect first
  // so TOC links before their headings are rewritten consistently. Generic IDs
  // and every name attribute remain forbidden (DOM clobbering boundary).
  const anchors = new Map<string, string>();
  const pending: Tree.ChildNode[] = [...fragment.childNodes];
  while (pending.length) {
    const node = pending.pop()!;
    if (!("tagName" in node) || node.namespaceURI !== "http://www.w3.org/1999/xhtml" || DROP_CONTENT.has(node.tagName)) continue;
    const id = node.attrs.find((attr) => attr.name === "id" && !attr.namespace)?.value;
    if (/^h[1-6]$/.test(node.tagName) && id && /^[a-z][a-z0-9_-]{0,127}$/i.test(id)) {
      anchors.set(id, id.startsWith("tph-blog-") ? id : `tph-blog-${id}`);
    }
    pending.push(...node.childNodes);
  }
  clean(fragment, anchors);
  return serialize(fragment);
}
