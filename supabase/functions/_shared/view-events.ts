export type ViewTargetType = "video" | "livestream";
export type ViewSource = "direct" | "embed";

export interface ClientViewEvent {
  target_type: ViewTargetType;
  target_id: string;
  source: ViewSource;
}

export interface ViewTarget {
  target_type: ViewTargetType;
  target_id: string;
  organization_id: string;
  is_replay: boolean;
}

export interface InsertViewEvent extends ClientViewEvent {
  organization_id: string;
  viewer_user_id: string | null;
  viewer_ip: string;
  is_replay: boolean;
}

export const MAX_VIEW_EVENT_BATCH = 20;
export const MAX_VIEW_EVENT_BODY_BYTES = 32 * 1024;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseClientViewEvent(input: unknown): ClientViewEvent | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  if (value.target_type !== "video" && value.target_type !== "livestream") return null;
  if (typeof value.target_id !== "string" || !UUID_RE.test(value.target_id)) return null;

  return {
    target_type: value.target_type,
    target_id: value.target_id.toLowerCase(),
    source: value.source === "embed" ? "embed" : "direct",
  };
}

export function extractClientViewEvents(body: unknown): {
  rawCount: number;
  events: ClientViewEvent[];
  rejected: number;
  tooLarge: boolean;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { rawCount: 0, events: [], rejected: 0, tooLarge: false };
  }
  const value = body as Record<string, unknown>;
  const rawEvents = Array.isArray(value.events)
    ? value.events
    : value.target_type && value.target_id
      ? [value]
      : [];
  if (rawEvents.length > MAX_VIEW_EVENT_BATCH) {
    return {
      rawCount: rawEvents.length,
      events: [],
      rejected: rawEvents.length,
      tooLarge: true,
    };
  }

  const events = rawEvents
    .map(parseClientViewEvent)
    .filter((event): event is ClientViewEvent => event !== null);
  return {
    rawCount: rawEvents.length,
    events,
    rejected: rawEvents.length - events.length,
    tooLarge: false,
  };
}

export function viewTargetKey(targetType: ViewTargetType, targetId: string): string {
  return `${targetType}:${targetId.toLowerCase()}`;
}

export function deduplicateClientViewEvents(events: ClientViewEvent[]): ClientViewEvent[] {
  const unique = new Map<string, ClientViewEvent>();
  for (const event of events) {
    unique.set(viewTargetKey(event.target_type, event.target_id), event);
  }
  return [...unique.values()];
}

export function buildInsertViewEvents(
  events: ClientViewEvent[],
  targets: Map<string, ViewTarget>,
  viewerUserId: string | null,
  viewerIp: string,
): { events: InsertViewEvent[]; missingTargets: number } {
  const output: InsertViewEvent[] = [];
  let missingTargets = 0;

  for (const event of events) {
    const target = targets.get(viewTargetKey(event.target_type, event.target_id));
    if (!target) {
      missingTargets += 1;
      continue;
    }
    output.push({
      ...event,
      organization_id: target.organization_id,
      viewer_user_id: viewerUserId,
      viewer_ip: viewerIp,
      is_replay: target.is_replay,
    });
  }

  return { events: output, missingTargets };
}

export function getViewEventClientIp(req: Request): string | null {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const raw =
    req.headers.get("cf-connecting-ip") ??
    forwardedFor?.split(",").at(-1)?.trim() ??
    req.headers.get("x-real-ip")?.trim() ??
    "";
  if (!raw || raw.length > 64 || !/^[0-9a-f:.]+$/i.test(raw)) return null;
  return raw;
}

export async function hashViewEventIdentity(identity: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`batch-view-events:${identity}`),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
