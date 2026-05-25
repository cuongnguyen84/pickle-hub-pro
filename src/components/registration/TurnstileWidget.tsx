// ============================================================================
// TurnstileWidget — thin wrapper over Cloudflare Turnstile (PR59).
// ----------------------------------------------------------------------------
// Loads the Turnstile script once, mounts a widget, forwards the token
// via onVerify. No npm dependency — Turnstile ships as a standalone
// <script> + global render callback.
//
// PR60 bug fix: callbacks are routed through refs so the mount effect
// can depend ONLY on siteKey. The previous version listed onVerify +
// onError in the deps array; when the parent recreated those inline
// each render the cleanup tore the widget down + the effect re-rendered
// it, in a tight loop. Cloudflare dashboard showed 14 challenges issued
// for one user session. The widget now mounts exactly once per parent
// instance and refresh-resets via the public `key` prop if a caller
// ever needs to remount intentionally.
//
// Site key is read from VITE_TURNSTILE_SITE_KEY. When unset (local dev
// without the env) the widget renders a "captcha unavailable" note and
// never fires onVerify — recovery flow gracefully degrades.
// ============================================================================

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        opts: {
          sitekey: string;
          callback?: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
let scriptPromise: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("turnstile_script_failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile_script_failed"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

interface Props {
  onVerify: (token: string) => void;
  onError?: () => void;
}

export function TurnstileWidget({ onVerify, onError }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  // Callback refs — let us read the latest parent callbacks from the
  // render effect without listing them as deps (which would re-mount
  // the widget every render the parent recreates the closures inline).
  const onVerifyRef = useRef(onVerify);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onVerifyRef.current = onVerify;
  }, [onVerify]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const siteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? "";

  useEffect(() => {
    if (!siteKey || !ref.current) return;
    // Guard against StrictMode double-mount + any unexpected re-run:
    // if a widget already exists in this container we don't render
    // again.
    if (widgetIdRef.current) return;

    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        if (widgetIdRef.current) return;
        widgetIdRef.current = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          callback: (token) => onVerifyRef.current(token),
          "error-callback": () => onErrorRef.current?.(),
          "expired-callback": () => onErrorRef.current?.(),
          theme: "auto",
        });
      })
      .catch(() => onErrorRef.current?.());

    return () => {
      cancelled = true;
      const id = widgetIdRef.current;
      widgetIdRef.current = null;
      if (id && window.turnstile?.remove) {
        try {
          window.turnstile.remove(id);
        } catch {
          // ignore — happens if Cloudflare already swept it
        }
      }
    };
    // Intentionally siteKey-only. Callbacks are routed via refs above.
  }, [siteKey]);

  if (!siteKey) {
    return (
      <p className="text-xs text-muted-foreground">
        CAPTCHA chưa được cấu hình (thiếu VITE_TURNSTILE_SITE_KEY).
      </p>
    );
  }
  return <div ref={ref} />;
}
