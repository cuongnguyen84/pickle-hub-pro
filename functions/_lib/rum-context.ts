export type RumMarketSegment = "vn" | "international" | "unknown";

export function marketSegmentForCountry(
  country: string | null | undefined,
): RumMarketSegment {
  if (!country) return "unknown";
  return country.toUpperCase() === "VN" ? "vn" : "international";
}
