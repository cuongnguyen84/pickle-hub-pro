import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Venue } from "./types";

interface GeoState {
  lat: number | null;
  lng: number | null;
  status: "idle" | "loading" | "ok" | "denied" | "unavailable" | "timeout";
  error?: string;
}

/**
 * Geolocation + nearby venues.
 * Uses a rough bounding-box (~5km @ VN latitude) since prod doesn't have
 * earthdistance/PostGIS enabled. Caller should still allow distance-based
 * sort once that ships.
 */
export function useNearbyVenues(): {
  geo: GeoState;
  venues: Venue[] | undefined;
  isLoading: boolean;
  retry: () => void;
} {
  const [geo, setGeo] = useState<GeoState>({ lat: null, lng: null, status: "idle" });
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeo((g) => ({ ...g, status: "unavailable" }));
      return;
    }
    setGeo({ lat: null, lng: null, status: "loading" });
    const id = navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        status: "ok",
      }),
      (err) => {
        const status: GeoState["status"] =
          err.code === err.PERMISSION_DENIED ? "denied" :
          err.code === err.TIMEOUT ? "timeout" :
          "unavailable";
        setGeo({ lat: null, lng: null, status, error: err.message });
      },
      { timeout: 8000, maximumAge: 5 * 60 * 1000, enableHighAccuracy: false },
    );
    return () => { /* getCurrentPosition has no cancel id */ void id; };
  }, [retryToken]);

  const query = useQuery<Venue[]>({
    queryKey: ["nearby-venues", geo.lat, geo.lng],
    enabled: geo.status === "ok" && geo.lat !== null && geo.lng !== null,
    queryFn: async () => {
      if (!geo.lat || !geo.lng) return [];
      const dLat = 0.05; // ~5.5 km
      const dLng = 0.05; // ~5.5 km @ VN latitude
      const { data, error } = await supabase
        .from("venues")
        .select(
          "id,slug,name,name_vi,city,district,address,latitude,longitude,num_courts,surface_type,is_indoor,is_verified",
        )
        .gte("latitude", geo.lat - dLat)
        .lte("latitude", geo.lat + dLat)
        .gte("longitude", geo.lng - dLng)
        .lte("longitude", geo.lng + dLng)
        .limit(10);
      if (error) throw error;
      return (data ?? []) as Venue[];
    },
  });

  return {
    geo,
    venues: query.data,
    isLoading: geo.status === "loading" || query.isLoading,
    retry: () => setRetryToken((t) => t + 1),
  };
}
