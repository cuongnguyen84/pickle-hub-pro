import { marketSegmentForCountry } from "../_lib/rum-context";

export const onRequest: PagesFunction = async ({ request }) => {
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const country = request.cf?.country;
  return new Response(
    JSON.stringify({
      country: typeof country === "string" ? country.toUpperCase() : null,
      market_segment: marketSegmentForCountry(country),
    }),
    {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "application/json",
      },
    },
  );
};
