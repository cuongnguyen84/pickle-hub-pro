// ============================================================================
// Typed handle for the Phase 1 shop tables.
// ----------------------------------------------------------------------------
// The generated `Database` type does not carry these tables yet (migration
// 20260811090000 is deliberately unapplied), so `supabase.from("shops")`
// resolves to a union of every OTHER table and every call is a type error.
//
// Rather than sprinkling `as unknown as` at ~15 call sites, this module casts
// once and hands back a small builder whose row type the caller declares. Call
// sites stay type-checked against the shapes in shop-schema.ts.
//
// Delete this file with shop-schema.ts once the migration lands and
// `npx supabase gen types` can describe the tables.
// ============================================================================

import { supabase } from "@/integrations/supabase/client";

export interface ShopResult<T> {
  data: T;
  error: { message: string; code?: string } | null;
}

export interface ShopQuery<T> extends PromiseLike<ShopResult<T[] | null>> {
  select(columns: string): ShopQuery<T>;
  eq(column: string, value: unknown): ShopQuery<T>;
  order(column: string, opts?: { ascending?: boolean; nullsFirst?: boolean }): ShopQuery<T>;
  limit(count: number): ShopQuery<T>;
  single(): PromiseLike<ShopResult<T>>;
  maybeSingle(): PromiseLike<ShopResult<T | null>>;
}

export interface ShopTable<T> {
  select(columns: string): ShopQuery<T>;
  insert(row: Record<string, unknown> | Record<string, unknown>[]): ShopQuery<T>;
  update(row: Record<string, unknown>): ShopQuery<T>;
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
