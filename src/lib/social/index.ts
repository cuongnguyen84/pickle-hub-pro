/**
 * Barrel export for the Bet #1 social utility libraries.
 * Import from "@/lib/social" — never from sibling files directly.
 */
export * from "./username-generator";
export * from "./score-validation";
export * from "./slug";
export * from "./device-meta";

export { formatVietnameseTimeAgo } from "./time-ago";

// Re-export the shared scoring type so consumers can import it from the
// social barrel alongside the score-validation helpers that use it.
export type { ScoringFormat } from "@/types/social";
