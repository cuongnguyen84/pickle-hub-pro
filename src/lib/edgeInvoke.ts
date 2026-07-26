// ============================================================================
// edgeInvoke — supabase.functions.invoke with automatic retry on the Supabase
// "blob-loss" fault: the platform intermittently drops an edge function's code
// blob and the gateway answers 404 { code: "NOT_FOUND_FUNCTION_BLOB" } until a
// redeploy (or the CF edge-blob-watchdog) heals it. The blob usually flickers
// back within seconds, so a couple of retries turn a user-visible "Connection
// error" into a transparent success — exactly the "click a few times" workaround
// users hit during the 2026-07-26 incident, automated.
//
// Only blob-loss 404s are retried. Every other error (captcha_failed,
// otp_mismatch, real network failures, …) returns immediately so callers keep
// their existing error-code handling. The returned shape is identical to
// supabase.functions.invoke, so this is a drop-in replacement.
// ============================================================================

import { supabase } from "@/integrations/supabase/client";

type InvokeOptions = Parameters<typeof supabase.functions.invoke>[1];
type InvokeResult<T> = Awaited<ReturnType<typeof supabase.functions.invoke<T>>>;

/** True when the error is a Supabase blob-loss 404 (retryable), false otherwise.
 *  Reads a CLONE of the response so the caller's own body read still works. */
async function isBlobLoss(error: unknown): Promise<boolean> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && ctx.status === 404 && typeof ctx.clone === "function") {
    try {
      const txt = await ctx.clone().text();
      return txt.includes("NOT_FOUND_FUNCTION_BLOB");
    } catch {
      return false;
    }
  }
  const msg = (error as { message?: unknown })?.message;
  return typeof msg === "string" && msg.includes("NOT_FOUND_FUNCTION_BLOB");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Invoke an edge function, retrying only on blob-loss 404s.
 * @param retries max extra attempts after the first (default 3 → up to 4 calls)
 * @param delayMs base backoff; grows linearly per attempt (800, 1600, 2400ms)
 */
export async function invokeWithBlobRetry<T>(
  fn: string,
  options?: InvokeOptions,
  { retries = 3, delayMs = 800 }: { retries?: number; delayMs?: number } = {},
): Promise<InvokeResult<T>> {
  let result = (await supabase.functions.invoke<T>(fn, options)) as InvokeResult<T>;
  for (let attempt = 0; result.error && attempt < retries; attempt++) {
    if (!(await isBlobLoss(result.error))) break;
    await sleep(delayMs * (attempt + 1));
    result = (await supabase.functions.invoke<T>(fn, options)) as InvokeResult<T>;
  }
  return result;
}
