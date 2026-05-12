// ============================================================================
// useClubPaymentConfig — read club_payment_config for a single club
// ----------------------------------------------------------------------------
// Public SELECT is enabled on club_payment_config (PR49 migration) so this
// hook works for anyone, including anon users. Used by the create-event
// wizard to decide which banner to show on the price step, and by future
// surfaces that need to know whether a club has VietQR enabled before
// rendering payment UI.
// ============================================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClubPaymentConfigRow {
  club_id: string;
  bank_code: string;
  bank_account_number: string;
  bank_account_name: string;
  enabled: boolean;
}

export function useClubPaymentConfig(clubId: string | undefined) {
  return useQuery<ClubPaymentConfigRow | null>({
    queryKey: ["club-payment-config", clubId],
    queryFn: async () => {
      if (!clubId) return null;
      const { data, error } = await supabase
        .from("club_payment_config")
        .select("club_id, bank_code, bank_account_number, bank_account_name, enabled")
        .eq("club_id", clubId)
        .maybeSingle();
      if (error) {
        console.error("useClubPaymentConfig: lookup error", { clubId, error });
        return null;
      }
      return (data as ClubPaymentConfigRow | null) ?? null;
    },
    enabled: Boolean(clubId),
    staleTime: 30_000,
  });
}
