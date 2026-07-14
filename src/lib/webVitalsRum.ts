import type { Metric } from "web-vitals";
import { getPlatform } from "@/lib/capacitor-utils";
import { trackEvent } from "@/utils/ga";

export type DeviceClass = "mobile" | "tablet" | "desktop";
export type MarketSegment = "vn" | "international" | "unknown";

type RumMetric = Pick<
  Metric,
  "delta" | "id" | "name" | "navigationType" | "rating" | "value"
>;

interface RumPageContext {
  appSurface: "web" | "capacitor_ios" | "capacitor_android";
  deviceClass: DeviceClass;
  locale: "vi" | "en";
  route: string;
}

const MARKET_CACHE_KEY = "rum_market_segment_v1";

// Route literals are safe, low-cardinality dimensions. Every other path
// segment is replaced so slugs, invite codes, UUIDs, and magic tokens never
// reach analytics.
const STATIC_ROUTE_SEGMENTS = new Set([
  "account",
  "admin",
  "advertise",
  "affiliate-disclosure",
  "analytics",
  "api-keys",
  "audit-log",
  "auth",
  "blog",
  "cai-dat",
  "callback",
  "clb",
  "clubs",
  "confirm",
  "creator",
  "dang-ky",
  "danh-sach",
  "dashboard",
  "disputes",
  "doubles-elimination",
  "dupr",
  "edit",
  "embed",
  "embeds",
  "errors",
  "feed",
  "flex-tournament",
  "forum",
  "join",
  "khoi-phuc-dang-ky",
  "khu-vuc",
  "live",
  "livestream",
  "livestreams",
  "login",
  "match",
  "matches",
  "moderation",
  "moi",
  "my-tournaments",
  "new",
  "news",
  "nguoi-choi",
  "notifications",
  "onboarding",
  "org",
  "organizations",
  "parent",
  "post",
  "preview",
  "privacy",
  "pro-tour",
  "push",
  "quan-ly",
  "quick-tables",
  "rankings",
  "referee",
  "reports",
  "reset-password",
  "san",
  "score",
  "search",
  "settings",
  "setup",
  "share",
  "social",
  "su-kien",
  "sua",
  "team-match",
  "terms",
  "the-line",
  "them",
  "thong-bao",
  "tim-ban-choi",
  "tin-nhan",
  "tools",
  "tournament",
  "tournaments",
  "tran-dau",
  "u",
  "users",
  "vi-blog",
  "video",
  "videos",
  "viewers",
  "watch",
  "xep-cap",
]);

export function normalizeRumRoute(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0] || "/";
  const segments = path.split("/").filter(Boolean);
  if (segments[0] === "vi") segments.shift();
  if (segments.length === 0) return "/";
  return `/${segments
    .map((segment) => (STATIC_ROUTE_SEGMENTS.has(segment) ? segment : ":id"))
    .join("/")}`;
}

export function getDeviceClass(viewportWidth: number): DeviceClass {
  if (viewportWidth < 768) return "mobile";
  if (viewportWidth < 1024) return "tablet";
  return "desktop";
}

export function isMarketSegment(value: unknown): value is MarketSegment {
  return value === "vn" || value === "international" || value === "unknown";
}

export function buildWebVitalEvent(
  metric: RumMetric,
  context: RumPageContext,
  marketSegment: MarketSegment,
): Record<string, unknown> {
  const isCls = metric.name === "CLS";
  return {
    value: Math.round(isCls ? metric.value * 1000 : metric.value),
    metric_value: isCls
      ? Number(metric.value.toFixed(4))
      : Number(metric.value.toFixed(2)),
    metric_delta: isCls
      ? Number(metric.delta.toFixed(4))
      : Number(metric.delta.toFixed(2)),
    metric_id: metric.id,
    metric_name: metric.name,
    metric_rating: metric.rating,
    navigation_type: metric.navigationType,
    route: context.route,
    locale: context.locale,
    app_surface: context.appSurface,
    device_class: context.deviceClass,
    market_segment: marketSegment,
    navigation_scope: "document",
    sample_rate: 1,
    non_interaction: true,
  };
}

function getLocale(pathname: string): "vi" | "en" {
  if (pathname === "/vi" || pathname.startsWith("/vi/")) return "vi";
  try {
    const stored = localStorage.getItem("pickleball-hub-language");
    if (stored === "vi" || stored === "en") return stored;
    const detected = sessionStorage.getItem("geo_detected_language");
    if (detected === "vi" || detected === "en") return detected;
  } catch {
    // Storage can be unavailable in strict privacy modes.
  }
  return "en";
}

function getAppSurface(): RumPageContext["appSurface"] {
  const platform = getPlatform();
  if (platform === "ios") return "capacitor_ios";
  if (platform === "android") return "capacitor_android";
  return "web";
}

async function resolveMarketSegment(): Promise<MarketSegment> {
  try {
    const cached = sessionStorage.getItem(MARKET_CACHE_KEY);
    if (isMarketSegment(cached)) return cached;
  } catch {
    // Continue with the same-origin lookup.
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetch("/api/rum-context", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    });
    if (!response.ok) return "unknown";
    const body = (await response.json()) as { market_segment?: unknown };
    const segment = isMarketSegment(body.market_segment)
      ? body.market_segment
      : "unknown";
    try {
      sessionStorage.setItem(MARKET_CACHE_KEY, segment);
    } catch {
      // RUM still works when storage is unavailable.
    }
    return segment;
  } catch {
    return "unknown";
  } finally {
    window.clearTimeout(timeout);
  }
}

let initialized = false;

export function initWebVitalsRum(): void {
  if (
    initialized ||
    import.meta.env.DEV ||
    typeof window === "undefined" ||
    navigator.webdriver ||
    typeof window.gtag !== "function"
  ) {
    return;
  }
  initialized = true;

  const pageContext: RumPageContext = {
    appSurface: getAppSurface(),
    deviceClass: getDeviceClass(window.innerWidth),
    locale: getLocale(window.location.pathname),
    route: normalizeRumRoute(window.location.pathname),
  };
  const marketSegment = resolveMarketSegment();

  const startObservers = () => {
    void import("web-vitals")
      .then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
        const report = (metric: Metric) => {
          void marketSegment.then((segment) => {
            trackEvent(
              "web_vital",
              buildWebVitalEvent(metric, pageContext, segment),
            );
          });
        };
        onCLS(report);
        onFCP(report);
        onINP(report);
        onLCP(report);
        onTTFB(report);
      })
      .catch((error: unknown) => {
        console.warn("[RUM] web-vitals failed to initialize", error);
      });
  };

  const requestIdle = (
    window as unknown as {
      requestIdleCallback?: typeof window.requestIdleCallback;
    }
  ).requestIdleCallback;
  if (typeof requestIdle === "function") {
    requestIdle(startObservers, { timeout: 3000 });
  } else {
    globalThis.setTimeout(startObservers, 0);
  }
}
