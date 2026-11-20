// ============================================================================
// Shared contract: dupr-match-submit edge function response shapes.
// ----------------------------------------------------------------------------
// SINGLE SOURCE OF TRUTH for the response envelope of the dupr-match-submit
// edge function. Both the frontend (SubmitDuprDialog / hooks) AND the
// Playwright contract tests import these Zod schemas, so a shape drift
// (the classic `data.match_code` vs `data.matchCode` bug) fails CI instead
// of silently breaking the UI badge.
//
// IMPORTANT: edge functions return FLAT snake_case. There is NO nested
// `data.result.matchCode`. Keep this file in lockstep with
// supabase/functions/dupr-match-submit/index.ts.
// ============================================================================

import * as z from "zod/v4/mini";

/** Error envelope returned by err() in the edge function. */
export const DuprErrorSchema = z.object({
  error: z.string(),
  code: z.optional(z.string()),
  details: z.optional(z.unknown()),
});
export type DuprError = z.infer<typeof DuprErrorSchema>;

/** Success envelope for action="create" (new match submitted to DUPR). */
export const DuprCreateSuccessSchema = z.object({
  created: z.literal(true),
  match_code: z.string().check(z.minLength(1)),
  hashed_match_code: z.optional(z.nullable(z.string())),
  identifier: z.string(),
  club_id: z.optional(z.nullable(z.string())),
  match_source: z.enum(["CLUB", "PARTNER"]),
  // Present only when the DUPR side succeeded but the local persist failed.
  persist_warning: z.optional(z.string()),
});
export type DuprCreateSuccess = z.infer<typeof DuprCreateSuccessSchema>;

/** Success envelope for action="update". */
export const DuprUpdateSuccessSchema = z.object({
  updated: z.literal(true),
  match_code: z.string().check(z.minLength(1)),
});
export type DuprUpdateSuccess = z.infer<typeof DuprUpdateSuccessSchema>;

/** Success envelope for action="delete". */
export const DuprDeleteSuccessSchema = z.object({
  deleted: z.literal(true),
  match_code: z.optional(z.string()),
});
export type DuprDeleteSuccess = z.infer<typeof DuprDeleteSuccessSchema>;

/** Any non-error response from the function. */
export const DuprSubmitSuccessSchema = z.union([
  DuprCreateSuccessSchema,
  DuprUpdateSuccessSchema,
  DuprDeleteSuccessSchema,
]);
export type DuprSubmitSuccess = z.infer<typeof DuprSubmitSuccessSchema>;

/** Full response: success OR error. Use to parse any HTTP body from the fn. */
export const DuprSubmitResponseSchema = z.union([
  DuprSubmitSuccessSchema,
  DuprErrorSchema,
]);
export type DuprSubmitResponse = z.infer<typeof DuprSubmitResponseSchema>;

/** Type guard helpers for call sites. */
export function isDuprError(r: DuprSubmitResponse): r is DuprError {
  return typeof (r as DuprError).error === "string";
}
