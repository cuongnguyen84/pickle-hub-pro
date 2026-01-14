import { useEffect } from "react";

interface DynamicMetaProps {
  title: string;
  description?: string;
  image?: string;
  type?: "website" | "video.other" | "article";
  url?: string;
  noindex?: boolean;
  creator?: string;
  publishedTime?: string;
}

export const DynamicMeta = ({
  title,
  description = "ThePickleHub là nền tảng pickleball hàng đầu với livestream trực tiếp, giải đấu, bracket và cộng đồng pickleball sôi động.",
  image = "https://thepicklehub.net/og-image.png",
  type = "website",
  url,
  noindex = false,
  creator,
  publishedTime,
}: DynamicMetaProps) => {
  const currentUrl = url || window.location.href;
  const fullTitle = `${title} | ThePickleHub`;

  useEffect(() => {
    // Update document title
    document.title = fullTitle;

    // Update or create meta tags
    const updateMeta = (property: string, content: string, isName = false) => {
      const attr = isName ? "name" : "property";
      let meta = document.querySelector(`meta[${attr}="${property}"]`) as HTMLMetaElement;
      
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute(attr, property);
        document.head.appendChild(meta);
      }
      
      meta.content = content;
    };

    // Robots meta for noindex pages
    if (noindex) {
      updateMeta("robots", "noindex, nofollow", true);
    } else {
      // Remove noindex if it was previously set
      const robotsMeta = document.querySelector('meta[name="robots"]');
      if (robotsMeta) {
        robotsMeta.remove();
      }
    }

    // Open Graph tags
    updateMeta("og:title", fullTitle);
    updateMeta("og:description", description);
    updateMeta("og:image", image);
    updateMeta("og:type", type);
    updateMeta("og:url", currentUrl);
    updateMeta("og:site_name", "ThePickleHub");
    updateMeta("og:locale", "vi_VN");

    // Twitter tags
    updateMeta("twitter:title", fullTitle, true);
    updateMeta("twitter:description", description, true);
    updateMeta("twitter:image", image, true);
    updateMeta("twitter:card", "summary_large_image", true);

    // General meta
    updateMeta("description", description, true);

    // Article specific meta (for livestreams/videos)
    if (type === "video.other" || type === "article") {
      if (creator) {
        updateMeta("article:author", creator);
      }
      if (publishedTime) {
        updateMeta("article:published_time", publishedTime);
      }
    }

    // Canonical URL
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = currentUrl;

    // Cleanup: Reset to default on unmount
    return () => {
      document.title = "ThePickleHub – Pickleball Tournaments, Livestream & Community";
    };
  }, [fullTitle, description, image, type, currentUrl, noindex, creator, publishedTime]);

  return null;
};
