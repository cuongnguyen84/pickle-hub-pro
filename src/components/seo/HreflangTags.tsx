import { useEffect } from "react";

const BASE_URL = "https://www.thepicklehub.net";

interface HreflangTagsProps {
  /** Absolute path for the English version, e.g. "/blog/some-slug" */
  enPath: string;
  /** Absolute path for the Vietnamese version, e.g. "/vi/blog/some-slug".
   *  Omit when no VI version exists — only en + x-default will be output. */
  viPath?: string;
}

/**
 * Injects <link rel="alternate" hreflang="..."> tags into <head>.
 * Always outputs en + x-default pointing to enPath.
 * Optionally outputs vi when viPath is provided.
 * Cleans up on unmount.
 */
export const HreflangTags = ({ enPath, viPath }: HreflangTagsProps) => {
  useEffect(() => {
    const setHreflang = (hreflang: string, href: string) => {
      let link = document.querySelector(
        `link[rel="alternate"][hreflang="${hreflang}"]`
      ) as HTMLLinkElement | null;

      if (!link) {
        link = document.createElement("link");
        link.rel = "alternate";
        link.hreflang = hreflang;
        document.head.appendChild(link);
      }
      link.href = href;
    };

    setHreflang("en", `${BASE_URL}${enPath}`);
    setHreflang("x-default", `${BASE_URL}${enPath}`);

    if (viPath) {
      setHreflang("vi", `${BASE_URL}${viPath}`);
    }

    return () => {
      document
        .querySelectorAll('link[rel="alternate"][hreflang]')
        .forEach((link) => link.remove());
    };
  }, [enPath, viPath]);

  return null;
};
