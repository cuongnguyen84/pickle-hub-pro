import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DuprLinkInput {
  dupr_id: string | null;
  dupr_singles: number | null;
  dupr_doubles: number | null;
  dupr_profile_url: string | null;
}

interface DuprLinkSuccess {
  dupr_id: string | null;
  dupr_singles: number | null;
  dupr_doubles: number | null;
  dupr_profile_url: string | null;
  synced_at: string;
  source: "manual";
}

interface DuprLinkError {
  code?: string;
  message: string;
  details?: string[];
  status?: number;
}

interface MutateOptions {
  onSuccess?: (data: DuprLinkSuccess) => void;
  onError?: (err: DuprLinkError) => void;
}

/**
 * Hook wrapping the dupr-link Supabase edge function.
 *
 * The edge function expects an Authorization: Bearer <user-jwt> header
 * because of the ES256/HS256 workaround — it verify_jwt = false at the
 * gateway and validates internally via supabase.auth.getUser(token).
 * supabase.functions.invoke takes care of attaching the current session
 * JWT for us.
 */
export function useDuprLink() {
  const [loading, setLoading] = useState(false);

  const mutate = async (input: DuprLinkInput, opts: MutateOptions = {}) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<
        DuprLinkSuccess | { error: string; code?: string; details?: { errors?: string[] } }
      >("dupr-link", {
        body: input,
      });

      if (error) {
        // supabase-js bundles non-2xx responses into error.context.response
        // — try to extract the validation details when available.
        const ctx = (error as { context?: { response?: Response } }).context;
        let parsedDetails: string[] | undefined;
        let parsedCode: string | undefined;
        try {
          const body = await ctx?.response?.clone().json();
          parsedCode = body?.code;
          parsedDetails = body?.details?.errors;
        } catch {
          // body wasn't JSON — fall through with raw error message.
        }
        opts.onError?.({
          code: parsedCode,
          message: error.message,
          details: parsedDetails,
          status: ctx?.response?.status,
        });
        return;
      }

      if (data && "error" in data) {
        opts.onError?.({
          code: (data as { code?: string }).code,
          message: (data as { error: string }).error,
        });
        return;
      }

      opts.onSuccess?.(data as DuprLinkSuccess);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      opts.onError?.({ message: msg });
    } finally {
      setLoading(false);
    }
  };

  return { mutate, loading };
}
