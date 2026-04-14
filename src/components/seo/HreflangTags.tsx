import { useEffect } from "react";

const BASE_URL = "https://www.thepicklehub.net";

interface HreflangTagsProps {
  /** Absolute path for the English version, e.g. "/blog/some-slug".
   *  Omit when no EN version exists (VI-only post). */
  enPath?: string;
  /** Absolute path for the Vietnamese version, e.g. "/vi/blog/some-slug".
   *  Omit when no VI version exists. */
  viPath?: string;
}

/**
 * Injects <link rel="alternate" hreflang="..."> tags into <head>.
 *
 * - Both enPath + viPath: outputs en + vi + x-default (x-default → enPath)
 * - enPath only: outputs en + x-default (x-default → enPath)
 * - viPath only: outputs vi + x-default (x-default → viPath, for VI-only posts)
 *
 * Cleans up all hreflang links on unmount.
 */
export const HreflangTags = ({ enPath, viPath }: HreflangTagsProps) => {
  useEffect(() => {
    if (!enPath && !viPath) return;

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

    const xDefault = enPath ?? viPath!;

    if (enPath) {
      setHreflang("en", `${BASE_URL}${enPath}`);
    }
    if (viPath) {
      setHreflang("vi", `${BASE_URL}${viPath}`);
    }
    setHreflang("x-default", `${BASE_URL}${xDefault}`);

    return () => {
      document
        .querySelectorAll('link[rel="alternate"][hreflang]')
        .forEach((link) => link.remove());
    };
  }, [enPath, viPath]);

  return null;
};
