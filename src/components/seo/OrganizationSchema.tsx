import { useEffect } from "react";

export const OrganizationSchema = () => {
  useEffect(() => {
    const id = "org-schema-jsonld";
    if (document.getElementById(id)) return;

    const schema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "ThePickleHub",
      url: "https://www.thepicklehub.net",
      logo: "https://www.thepicklehub.net/og-image.png",
      description:
        "ThePickleHub là nền tảng pickleball hàng đầu Việt Nam với livestream, giải đấu, và cộng đồng pickleball sôi động.",
      contactPoint: {
        "@type": "ContactPoint",
        email: "tapickleballvn@gmail.com",
        contactType: "customer support",
      },
    };

    const script = document.createElement("script");
    script.id = id;
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      document.getElementById(id)?.remove();
    };
  }, []);

  return null;
};
