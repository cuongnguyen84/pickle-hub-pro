import { useEffect } from "react";

interface HowToStep {
  name: string;
  text: string;
}

interface HowToSchemaProps {
  name: string;
  description: string;
  steps: HowToStep[];
}

export const HowToSchema = ({ name, description, steps }: HowToSchemaProps) => {
  useEffect(() => {
    const id = "howto-schema-jsonld";
    document.getElementById(id)?.remove();

    const schema = {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name,
      description,
      step: steps.map((step, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: step.name,
        text: step.text,
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
  }, [name, description, steps]);

  return null;
};
