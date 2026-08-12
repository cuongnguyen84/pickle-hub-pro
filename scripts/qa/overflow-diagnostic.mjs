// ============================================================================
// Which element is sticking out, and why.
// ----------------------------------------------------------------------------
// "43px past the scroller" sends whoever reads it hunting through devtools.
// This returns the offending elements with the geometry AND the computed
// properties that usually explain it, so the next person fixes the cause
// instead of trying CSS at the whole page.
//
// It deliberately does NOT use documentElement.scrollWidth: that reports one
// number for the document and cannot name a culprit, and it misses an element
// clipped by an ancestor's overflow:hidden — which is a real bug wearing a
// clean scrollWidth.
// ============================================================================

/** A short, readable path: tag + the classes that are ours, + nth-of-type. */
const PATH_FN = `(el) => {
  const part = (e) => {
    const cls = (typeof e.className === "string" ? e.className : "")
      .split(/\\s+/).filter((c) => c.startsWith("tl-")).slice(0, 2).join(".");
    const idx = e.parentElement
      ? [...e.parentElement.children].filter((s) => s.tagName === e.tagName).indexOf(e) + 1
      : 1;
    return e.tagName.toLowerCase() + (cls ? "." + cls : "") + (idx > 1 ? ":nth(" + idx + ")" : "");
  };
  const out = [];
  for (let e = el; e && e !== document.body && out.length < 4; e = e.parentElement) out.unshift(part(e));
  return out.join(" > ");
}`;

/**
 * Elements whose box escapes the app's scroll container, each with the
 * properties that most often cause it.
 *
 * `tolerance` is for genuine subpixel rounding only. It is not a knob for
 * making a real overflow go away — 1px of overflow on three routes is a
 * layout bug, and a tolerance of 1 would have hidden it.
 */
export const overflowReport = (page, tolerance = 0.5) =>
  page.evaluate(
    ({ pathSrc, tol }) => {
      const path = eval(pathSrc);
      const scroller = document.querySelector(".tl-shop-scroll") ?? document.scrollingElement;
      const box = scroller.getBoundingClientRect();
      const out = [];

      for (const el of document.querySelectorAll("body *")) {
        const s = getComputedStyle(el);
        if (s.display === "none" || s.visibility === "hidden") continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        // Visually-hidden text (skip links, <label class="sr-only">) is parked
        // off-canvas at 1x1 on purpose. It is not overflow; flagging it buries
        // the real finding.
        if (r.width <= 1 && r.height <= 1) continue;

        // BOTH edges. A fix that pulled a breadcrumb's 44px hit area to
        // x = -9 was invisible to a right-edge-only check, and the target was
        // unreachable by a thumb.
        const overRight = r.right - box.right;
        const overLeft = box.left - r.left;
        if (overRight <= tol && overLeft <= tol) continue;

        // An ancestor that scrolls horizontally on purpose (the chip row) owns
        // its children's overflow; those are not page overflow.
        let scrollableAncestor = null;
        for (let p = el.parentElement; p && p !== scroller; p = p.parentElement) {
          const ps = getComputedStyle(p);
          if (ps.overflowX === "auto" || ps.overflowX === "scroll") { scrollableAncestor = path(p); break; }
        }
        if (scrollableAncestor) continue;

        out.push({
          path: path(el),
          rect: { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) },
          over: { right: Math.round(overRight), left: Math.round(overLeft) },
          css: {
            display: s.display,
            width: s.width, minWidth: s.minWidth, maxWidth: s.maxWidth,
            boxSizing: s.boxSizing,
            padding: `${s.paddingLeft}/${s.paddingRight}`,
            margin: `${s.marginLeft}/${s.marginRight}`,
            gap: s.gap, flex: s.flex, gridTemplateColumns: s.gridTemplateColumns,
            whiteSpace: s.whiteSpace, overflowX: s.overflowX, position: s.position,
          },
          text: (el.textContent ?? "").trim().slice(0, 30),
        });
      }

      // Deepest first: an outer box is usually pushed by an inner one, and the
      // innermost offender is the thing to fix.
      return out.sort((a, b) => b.path.split(">").length - a.path.split(">").length).slice(0, 8);
    },
    { pathSrc: PATH_FN, tol: tolerance },
  );

/** Undersized targets, with the path and role so the fix lands on a component. */
export const targetReport = (page, min = 44) =>
  page.evaluate(
    ({ pathSrc, min }) => {
      const path = eval(pathSrc);
      const out = [];
      for (const el of document.querySelectorAll(
        'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])',
      )) {
        const s = getComputedStyle(el);
        if (s.display === "none" || s.visibility === "hidden" || el.hasAttribute("disabled")) continue;
        // A visually-hidden skip link is 1x1 until focused; that is correct.
        if (el.className && String(el.className).includes("sr-only")) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.width >= min && r.height >= min) continue;
        out.push({
          path: path(el),
          size: `${Math.round(r.width)}x${Math.round(r.height)}`,
          name: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 24),
          css: { minHeight: s.minHeight, minWidth: s.minWidth, padding: `${s.paddingTop}/${s.paddingLeft}` },
        });
      }
      return out;
    },
    { pathSrc: PATH_FN, min },
  );
