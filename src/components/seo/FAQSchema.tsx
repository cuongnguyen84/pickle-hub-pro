import { useEffect } from "react";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSchemaProps {
  items: FAQItem[];
}

export const FAQSchema = ({ items }: FAQSchemaProps) => {
  useEffect(() => {
    const id = "faq-schema-jsonld";
    document.getElementById(id)?.remove();

    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: items.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    };

    const script = document.createElement("script");
    script.id = id;
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      document.getElementById(id)?.remove();
    };
  }, [items]);

  return null;
};
