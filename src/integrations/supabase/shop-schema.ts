// ============================================================================
// Shop marketplace — hand-written row/RPC shapes.
// ----------------------------------------------------------------------------
// TEMPORARY BY DESIGN. `npx supabase gen types` reads the REMOTE schema, and
// migration 20260811090000 has deliberately not been applied to production, so
// the generated `Database` type cannot know these tables yet.
//
// When the migration lands:
//   1. run the canonical command from CLAUDE.md
//   2. delete this file
//   3. drop the `shopDb` cast in src/hooks/shop/*
//
// `src/lib/__tests__/shop-schema-parity.test.ts` asserts the table and RPC
// names here match the migration, so the two cannot drift while both exist.
// ============================================================================

import type { ApplicationStatus } from "@/lib/shop/applicationState";

export type ShopState =
  | "pending_activation"
  | "active"
  | "restricted"
  | "suspended"
  | "closed";

export type ShopMemberRole = "owner" | "manager" | "fulfillment" | "support";

/** Columns of `public.my_shop_application` — the applicant-facing view.
 *  `internal_note` is absent from the view, not merely unselected. */
export interface MyShopApplicationRow {
  id: string;
  applicant_user_id: string;
  status: ApplicationStatus;
  seller_type: string | null;
  full_name: string | null;
  phone: string | null;
  shop_name: string | null;
  shop_intro: string | null;
  pickup_address: string | null;
  city: string | null;
  applicant_note: string | null;
  requested_fields: string[];
  submitted_at: string | null;
  decided_at: string | null;
  shop_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Admin view of the same row — adds the moderator-only column. */
export interface ShopApplicationRow extends MyShopApplicationRow {
  internal_note: string | null;
  decided_by: string | null;
}

export interface ShopApplicationEventRow {
  id: string;
  application_id: string;
  actor_user_id: string | null;
  actor_kind: "applicant" | "admin" | "system";
  event:
    | "created"
    | "submitted"
    | "withdrawn"
    | "requested_changes"
    | "approved"
    | "rejected"
    | "resubmitted";
  note: string | null;
  created_at: string;
}

export interface ShopRow {
  id: string;
  slug: string;
  name: string;
  state: ShopState;
  owner_user_id: string;
  city: string | null;
  intro: string | null;
  verified_method: "giay-phep-kinh-doanh" | "gap-truc-tiep" | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Table + RPC names, exported so the parity test can compare them to the SQL. */
export const SHOP_TABLES = [
  "shop_pilot_members",
  "shops",
  "shop_members",
  "shop_applications",
  "shop_application_events",
] as const;

export const SHOP_VIEWS = ["my_shop_application"] as const;

export const SHOP_RPCS = [
  "shop_pilot_has_access",
  "is_shop_member",
  "shop_application_submit",
  "shop_application_withdraw",
  "shop_application_decide",
] as const;
