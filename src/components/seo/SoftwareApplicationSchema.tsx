import { useEffect } from "react";

interface SoftwareApplicationSchemaProps {
  name: string;
  description: string;
  applicationCategory?: string;
  operatingSystem?: string;
  offers?: {
    price: string;
    priceCurrency: string;
  };
  aggregateRating?: {
    ratingValue: number;
    ratingCount: number;
  };
}

/**
 * SoftwareApplication structured data for Google Rich Results
 * Used for tool/app listing pages like tournament bracket generators
 * @see https://developers.google.com/search/docs/appearance/structured-data/software-app
 */
export const SoftwareApplicationSchema = ({
  name,
  description,
  applicationCategory = "SportsApplication",
  operatingSystem = "Web",
  offers = { price: "0", priceCurrency: "USD" },
  aggregateRating,
}: SoftwareApplicationSchemaProps) => {
  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "software-app-schema";

    const schema: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name,
      description,
      applicationCategory,
      operatingSystem,
      offers: {
        "@type": "Offer",
        price: offers.price,
        priceCurrency: offers.priceCurrency,
      },
    };

    if (aggregateRating) {
      schema.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: aggregateRating.ratingValue,
        ratingCount: aggregateRating.ratingCount,
      };
    }

    script.textContent = JSON.stringify(schema);

    // Remove existing schema if present
    const existingScript = document.getElementById("software-app-schema");
    if (existingScript) {
      existingScript.remove();
    }

    document.head.appendChild(script);

    // Cleanup on unmount
    return () => {
      const scriptToRemove = document.getElementById("software-app-schema");
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, [name, description, applicationCategory, operatingSystem, offers, aggregateRating]);

  return null;
};
