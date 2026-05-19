import { useEffect } from "react";

interface SportsEventSchemaProps {
  name: string;
  description: string;
  url: string;
  startDate?: string;
  endDate?: string;
  location?: {
    name: string;
    address?: string;
  };
  organizer?: {
    name: string;
    url?: string;
  };
  eventStatus?: "EventScheduled" | "EventPostponed" | "EventCancelled" | "EventRescheduled";
  eventAttendanceMode?: "OfflineEventAttendanceMode" | "OnlineEventAttendanceMode" | "MixedEventAttendanceMode";
}

/**
 * SportsEvent structured data for tournament/competition pages
 * @see https://schema.org/SportsEvent
 */
export const SportsEventSchema = ({
  name,
  description,
  url,
  startDate,
  endDate,
  location,
  organizer,
  eventStatus = "EventScheduled",
  eventAttendanceMode = "OfflineEventAttendanceMode",
}: SportsEventSchemaProps) => {
  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "sports-event-schema";

    const schema: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "SportsEvent",
      name,
      description,
      url,
      sport: "Pickleball",
      eventStatus: `https://schema.org/${eventStatus}`,
      eventAttendanceMode: `https://schema.org/${eventAttendanceMode}`,
    };

    if (startDate) {
      schema.startDate = startDate;
    }

    if (endDate) {
      schema.endDate = endDate;
    }

    if (location) {
      schema.location = {
        "@type": "Place",
        name: location.name,
        ...(location.address && { address: location.address }),
      };
    }

    if (organizer) {
      schema.organizer = {
        "@type": "Organization",
        name: organizer.name,
        ...(organizer.url && { url: organizer.url }),
      };
    }

    script.textContent = JSON.stringify(schema);

    // Remove existing schema if present
    const existingScript = document.getElementById("sports-event-schema");
    if (existingScript) {
      existingScript.remove();
    }

    document.head.appendChild(script);

    // Cleanup on unmount
    return () => {
      const scriptToRemove = document.getElementById("sports-event-schema");
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, [name, description, url, startDate, endDate, location, organizer, eventStatus, eventAttendanceMode]);

  return null;
};
