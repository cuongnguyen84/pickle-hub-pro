import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";

interface CreatorAuthState {
  isCreator: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  organizationId: string | null;
  hasOrganization: boolean;
}

export function useCreatorAuth(): CreatorAuthState {
  const { user, loading: authLoading } = useAuth();
  const [isCreator, setIsCreator] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [isCheckingRole, setIsCheckingRole] = useState(true);

  useEffect(() => {
    async function checkCreatorRole() {
      if (!user) {
        setIsCreator(false);
        setOrganizationId(null);
        setIsCheckingRole(false);
        return;
      }

      try {
        // Check if user has creator or admin role
        const { data: roleData, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .in("role", ["creator", "admin"]);

        if (roleError) {
          console.error("Error checking creator role:", roleError);
          setIsCreator(false);
        } else {
          setIsCreator(roleData && roleData.length > 0);
        }

        // Get organization_id from profile
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          console.error("Error fetching profile:", profileError);
          setOrganizationId(null);
        } else {
          setOrganizationId(profileData?.organization_id ?? null);
        }
      } catch (err) {
        console.error("Error checking creator role:", err);
        setIsCreator(false);
        setOrganizationId(null);
      } finally {
        setIsCheckingRole(false);
      }
    }

    if (!authLoading) {
      checkCreatorRole();
    }
  }, [user, authLoading]);

  return {
    isCreator,
    isLoading: authLoading || isCheckingRole,
    isAuthenticated: !!user,
    organizationId,
    hasOrganization: !!organizationId,
  };
}
