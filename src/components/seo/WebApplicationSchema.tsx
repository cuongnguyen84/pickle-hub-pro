import { useEffect } from "react";

interface WebApplicationSchemaProps {
  name: string;
  description: string;
  url: string;
  applicationCategory?: string;
  browserRequirements?: string;
  offers?: {
    price: string;
    priceCurrency: string;
  };
  featureList?: string[];
}

/**
 * WebApplication structured data for tournament management tools
 * @see https://schema.org/WebApplication
 */
export const WebApplicationSchema = ({
  name,
  description,
  url,
  applicationCategory = "SportsApplication",
  browserRequirements = "Requires JavaScript. Works in all modern browsers.",
  offers = { price: "0", priceCurrency: "USD" },
  featureList,
}: WebApplicationSchemaProps) => {
  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "web-app-schema";

    const schema: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name,
      description,
      url,
      applicationCategory,
      browserRequirements,
      offers: {
        "@type": "Offer",
        price: offers.price,
        priceCurrency: offers.priceCurrency,
      },
      provider: {
        "@type": "Organization",
        name: "ThePickleHub",
        url: "https://www.thepicklehub.net",
      },
    };

    if (featureList && featureList.length > 0) {
      schema.featureList = featureList.join(", ");
    }

    script.textContent = JSON.stringify(schema);

    // Remove existing schema if present
    const existingScript = document.getElementById("web-app-schema");
    if (existingScript) {
      existingScript.remove();
    }

    document.head.appendChild(script);

    // Cleanup on unmount
    return () => {
      const scriptToRemove = document.getElementById("web-app-schema");
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, [name, description, url, applicationCategory, browserRequirements, offers, featureList]);

  return null;
};
