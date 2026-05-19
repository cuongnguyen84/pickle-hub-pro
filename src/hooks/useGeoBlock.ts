import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const CACHE_KEY = "geo_block_result";

interface GeoBlockResult {
  isBlocked: boolean;
  isLoading: boolean;
  country: string | null;
}

export function useGeoBlock(): GeoBlockResult {
  const [isBlocked, setIsBlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [country, setCountry] = useState<string | null>(null);

  useEffect(() => {
    // Check sessionStorage cache first
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setIsBlocked(parsed.blocked);
        setCountry(parsed.country);
        setIsLoading(false);
        return;
      } catch {
        sessionStorage.removeItem(CACHE_KEY);
      }
    }

    const checkGeo = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("geo-check");
        if (error) {
          console.error("[useGeoBlock] Error:", error);
          setIsLoading(false);
          return;
        }
        const result = data as { country: string | null; blocked: boolean };
        setIsBlocked(result.blocked);
        setCountry(result.country);
        // Cache in sessionStorage
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(result));
      } catch (err) {
        console.error("[useGeoBlock] Unexpected error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    checkGeo();
  }, []);

  return { isBlocked, isLoading, country };
}
