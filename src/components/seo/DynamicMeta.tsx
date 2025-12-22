import { useEffect } from "react";

interface DynamicMetaProps {
  title: string;
  description?: string;
  image?: string;
  type?: "website" | "video.other";
  url?: string;
}

export const DynamicMeta = ({
  title,
  description = "Live streaming and on-demand videos from top pickleball tournaments",
  image = "https://lovable.dev/opengraph-image-p98pqg.png",
  type = "website",
  url,
}: DynamicMetaProps) => {
  const currentUrl = url || window.location.href;
  const fullTitle = `${title} | The Pickle Hub`;

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

    // Open Graph tags
    updateMeta("og:title", fullTitle);
    updateMeta("og:description", description);
    updateMeta("og:image", image);
    updateMeta("og:type", type);
    updateMeta("og:url", currentUrl);

    // Twitter tags
    updateMeta("twitter:title", fullTitle, true);
    updateMeta("twitter:description", description, true);
    updateMeta("twitter:image", image, true);
    updateMeta("twitter:card", "summary_large_image", true);

    // General meta
    updateMeta("description", description, true);

    // Cleanup: Reset to default on unmount
    return () => {
      document.title = "The Pickle Hub - Professional Pickleball Media Platform";
    };
  }, [fullTitle, description, image, type, currentUrl]);

  return null;
};
