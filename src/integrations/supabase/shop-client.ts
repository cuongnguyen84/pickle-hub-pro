// ============================================================================
// Typed handle for the shop tables.
// ----------------------------------------------------------------------------
// The generated `Database` type does not carry these tables yet (migration
// 20260811090000 is deliberately unapplied), so `supabase.from("shops")`
// resolves to a union of every OTHER table and every call is a type error.
//
// Rather than sprinkling `as unknown as` at ~25 call sites, this module casts
// once and hands back a small builder whose row type the caller declares. Call
// sites stay type-checked against the shapes in shop-schema.ts.
//
// The surface here mirrors the PostgREST methods this feature actually uses and
// nothing else. It is a passthrough — no query is built here, no filter is
// invented — so when the migration lands, deleting this file and swapping in
// the generated client changes no call site's meaning.
//
// Delete this file with shop-schema.ts once the migration lands and
// `npx supabase gen types` can describe the tables.
// ============================================================================

import { supabase } from "@/integrations/supabase/client";

export interface ShopResult<T> {
  data: T;
  error: { message: string; code?: string } | null;
  /** Present when the select asked for a count. PostgREST returns it in the
   *  Content-Range header, so it is the TOTAL, not the length of `data`. */
  count?: number | null;
}

export interface ShopQuery<T> extends PromiseLike<ShopResult<T[] | null>> {
  select(columns: string, options?: { count?: "exact" | "planned" | "estimated"; head?: boolean }): ShopQuery<T>;
  eq(column: string, value: unknown): ShopQuery<T>;
  neq(column: string, value: unknown): ShopQuery<T>;
  in(column: string, values: readonly unknown[]): ShopQuery<T>;
  /** Case-insensitive LIKE. Callers must escape the seller's input themselves —
   *  see escapeLike() below, and the test that proves a `%` is a literal. */
  ilike(column: string, pattern: string): ShopQuery<T>;
  order(column: string, opts?: { ascending?: boolean; nullsFirst?: boolean }): ShopQuery<T>;
  limit(count: number): ShopQuery<T>;
  /** Inclusive on both ends, like PostgREST. */
  range(from: number, to: number): ShopQuery<T>;
  single(): PromiseLike<ShopResult<T>>;
  maybeSingle(): PromiseLike<ShopResult<T | null>>;
}

export interface ShopTable<T> {
  select(columns: string, options?: { count?: "exact" | "planned" | "estimated"; head?: boolean }): ShopQuery<T>;
  insert(row: Record<string, unknown>): ShopQuery<T>;
  update(row: Record<string, unknown>): ShopQuery<T>;
  /** Only the cart uses it: a cart line is removed, not archived, and qty 0 is
   *  not a value the CHECK allows. Every other shop table is append-only or
   *  RPC-guarded. */
  delete(): ShopQuery<T>;
}

type RawClient = {
  from: (table: string) => unknown;
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<ShopResult<unknown>>;
};

const raw = supabase as unknown as RawClient;

export const shopFrom = <T>(table: string): ShopTable<T> => raw.from(table) as ShopTable<T>;

export const shopRpc = async <T>(fn: string, args?: Record<string, unknown>): Promise<T> => {
  const { data, error } = await raw.rpc(fn, args);
  if (error) throw error;
  return data as T;
};

/**
 * Make a seller's search text safe to drop inside an ilike pattern.
 *
 * `%` and `_` are wildcards to Postgres and ordinary characters to the person
 * typing them. Unescaped, a search for "50%" matches every product whose title
 * starts with "50", which reads as a broken search rather than a clever one.
 * The backslash goes first or it escapes the escapes.
 */
export const escapeLike = (input: string) =>
  input.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
