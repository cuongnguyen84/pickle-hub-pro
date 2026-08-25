// ============================================================================
// useNoindex — inject <meta name="robots" content="noindex, nofollow"> for
// the lifetime of the component.
// ----------------------------------------------------------------------------
// Defense-in-depth Layer 1 for SEO audit PR71 issue I-7. Layer 2 is the
// X-Robots-Tag HTTP header set by functions/_middleware.ts. We want both:
// the header covers headless crawlers that don't execute JS, the meta tag
// covers JS-rendering bots (Googlebot Smartphone, AppleBot) that see the
// SPA shell before the static HTML noindex would normally apply.
//
// The hook removes the tag on unmount so navigating away from a private
// route restores the default index policy without a hard reload.
// ============================================================================

import { useEffect } from "react";

/**
 * @param options.enabled  false leaves the page indexable. Lets a component
 *   decide per-render without breaking the rules of hooks — the news article
 *   page noindexes its EN half and leaves the VI half alone (C3, 2026-08-25).
 * @param options.content  the directive to emit. Defaults to the private-route
 *   policy, "noindex, nofollow". Content that should still pass equity through
 *   its outbound links wants "noindex, follow" instead.
 */
export function useNoindex(options?: {
  enabled?: boolean;
  content?: string;
}): void {
  const enabled = options?.enabled ?? true;
  const content = options?.content ?? "noindex, nofollow";
  useEffect(() => {
    if (!enabled) return;
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = content;
    meta.setAttribute("data-noindex-hook", "1");
    document.head.appendChild(meta);
    return () => {
      meta.remove();
    };
  }, [enabled, content]);
}
