import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Response shape from newsletter-subscribe edge function.
 * On failure, `code` distinguishes client-side (invalid_email) vs server
 * (server_error) so the form can render a targeted message.
 */
export interface NewsletterSubscribeResult {
  ok: boolean;
  message: string;
  code?: "invalid_email" | "invalid_json" | "method_not_allowed" | "server_error";
}

export interface NewsletterSubscribeInput {
  email: string;
  language: "en" | "vi";
  source?: string;
}

export function useNewsletterSubscribe() {
  return useMutation<NewsletterSubscribeResult, Error, NewsletterSubscribeInput>({
    mutationFn: async (input) => {
      const { data, error } = await supabase.functions.invoke<NewsletterSubscribeResult>(
        "newsletter-subscribe",
        { body: input },
      );
      if (error) {
        // Try to surface the edge function's structured error when present
        const fallback = (data as NewsletterSubscribeResult | null)?.message ?? error.message;
        throw new Error(fallback);
      }
      if (!data?.ok) {
        throw new Error(data?.message ?? "Subscribe failed");
      }
      return data;
    },
  });
}
