interface EdgeGeoResponse {
  country?: unknown;
}

export const detectCountryFromEdge = async (
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> => {
  const response = await fetchImpl("/api/rum-context", {
    method: "GET",
    credentials: "omit",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) return null;

  const data = (await response.json()) as EdgeGeoResponse;
  return typeof data.country === "string"
    ? data.country.trim().toUpperCase() || null
    : null;
};
