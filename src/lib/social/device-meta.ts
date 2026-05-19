/**
 * Device meta collector for the fraud-detection `created_meta` JSONB column
 * on matches (spec §9). Lightweight, no third-party fingerprint deps.
 *
 * Captured client-side and POSTed alongside match-create body. Server then
 * augments with the request IP (which the client cannot fake reliably).
 *
 * Usage:
 *   import { collectDeviceMeta } from "@/lib/social";
 *   const meta = collectDeviceMeta();
 *   await fetch("/functions/v1/match-create", {
 *     body: JSON.stringify({ ...payload, device_meta: meta }),
 *   });
 */

import { isIOS, isAndroid, isNativeApp } from "@/lib/capacitor-utils";

export interface DeviceMeta {
  ua: string;
  capacitor_platform: "ios" | "android" | "web";
  device_fp: string;
  screen: { w: number; h: number; dpr: number } | null;
  tz: string | null;
  lang: string | null;
}

/**
 * Tiny non-cryptographic fingerprint based on stable browser hints +
 * a per-install random salt persisted in localStorage. Designed to flag
 * obvious sock-puppet clusters (one device → 50 fake matches), not to
 * resist a determined attacker.
 */
function browserFingerprint(): string {
  if (typeof window === "undefined") return "ssr";
  const hints = [
    navigator.userAgent,
    navigator.language,
    String(screen.width),
    String(screen.height),
    String(screen.colorDepth ?? ""),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    String((navigator as { hardwareConcurrency?: number }).hardwareConcurrency ?? ""),
  ].join("|");

  // FNV-1a 32-bit hash → base36
  let h = 2166136261;
  for (let i = 0; i < hints.length; i++) {
    h ^= hints.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }

  // Add per-install salt so two users on the same device get distinct ids
  const SALT_KEY = "tph_dfp_salt";
  let salt = localStorage.getItem(SALT_KEY);
  if (!salt) {
    salt = Math.random().toString(36).slice(2, 10);
    try { localStorage.setItem(SALT_KEY, salt); } catch { /* private mode */ }
  }
  return `${h.toString(36)}-${salt}`;
}

function platform(): DeviceMeta["capacitor_platform"] {
  if (isNativeApp()) {
    if (isIOS()) return "ios";
    if (isAndroid()) return "android";
  }
  return "web";
}

export function collectDeviceMeta(): DeviceMeta {
  if (typeof window === "undefined") {
    return {
      ua: "ssr", capacitor_platform: "web", device_fp: "ssr",
      screen: null, tz: null, lang: null,
    };
  }
  return {
    ua: navigator.userAgent.slice(0, 240),
    capacitor_platform: platform(),
    device_fp: browserFingerprint(),
    screen: {
      w: window.screen.width,
      h: window.screen.height,
      dpr: window.devicePixelRatio || 1,
    },
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    lang: navigator.language || null,
  };
}
