import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

/** The server refuses a shop owner with this, before deleting anything (B12). */
export const SHOP_OWNER_BLOCK = "shop_owner_offboarding_required";

export interface DeleteAccountError extends Error {
  code?: string;
}

/** The error body, when the function sent one. Never throws: a failure to read
 *  the reason must not replace the failure itself. */
async function readErrorBody(
  error: unknown,
): Promise<{ code?: string; message?: string } | null> {
  const res = (error as { context?: Response })?.context;
  if (!res || typeof res.json !== "function") return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export function useDeleteAccount() {
  const { signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke("delete-account", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        // invoke() gives back the raw Response on `context`. The body carries a
        // stable `code`, and reading it is the difference between "something
        // went wrong" and "you own a shop, here is what to do" — the second is
        // the only one a seller can act on.
        const body = await readErrorBody(response.error);
        const err = new Error(body?.message || response.error.message || "Failed to delete account");
        (err as DeleteAccountError).code = body?.code;
        throw err;
      }

      return response.data;
    },
    onSuccess: async () => {
      toast({
        title: "Account deleted",
        description: "Your account has been permanently deleted.",
      });
      await signOut();
      navigate("/", { replace: true });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete account",
        variant: "destructive",
      });
    },
  });
}
