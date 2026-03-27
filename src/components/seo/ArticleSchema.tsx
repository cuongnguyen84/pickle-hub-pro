import { useEffect } from "react";

interface ArticleSchemaProps {
  headline: string;
  datePublished: string;
  dateModified: string;
  author: string;
  description: string;
  url: string;
  inLanguage: string;
}

export const ArticleSchema = ({
  headline,
  datePublished,
  dateModified,
  author,
  description,
  url,
  inLanguage,
}: ArticleSchemaProps) => {
  useEffect(() => {
    const id = "article-schema-jsonld";
    document.getElementById(id)?.remove();

    const schema = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline,
      datePublished,
      dateModified,
      author: {
        "@type": "Organization",
        name: author,
        url: "https://thepicklehub.net",
      },
      publisher: {
        "@type": "Organization",
        name: "The PickleHub",
        url: "https://thepicklehub.net",
      },
      description,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": url,
      },
      inLanguage,
    };

    const script = document.createElement("script");
    script.id = id;
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      document.getElementById(id)?.remove();
    };
  }, [headline, datePublished, dateModified, author, description, url, inLanguage]);

  return null;
};
