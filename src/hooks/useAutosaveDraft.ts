// ============================================================================
// useAutosaveDraft — local-first wizard draft autosave (UX-04, proposal
// ux-01-05-organizer-wizard).
// ----------------------------------------------------------------------------
// Persists the caller's form state to localStorage (NEVER the DB — the whole
// point of the design is that abandoning a wizard writes nothing remote and
// restoring reads nothing remote; see proposal §4). Key scheme is shared with
// the native @AppStorage port: `draft:<flow>:<scopeId>`.
//
//   const draft = useAutosaveDraft<FormState>({
//     key: slug ? `draft:social:${slug}` : null,   // null = disabled
//     value: form,
//     enabled: dirty && !readOnly,
//   });
//   // draft.initial   — payload found at mount (apply once + show banner)
//   // draft.lastSavedAt / draft.saveFailed — feed DraftSaveStatus
//   // draft.clear()   — call after successful publish AND on "Bắt đầu lại"
//
// Fail-loud contract (risk-auditor condition): a setItem throw (quota,
// Safari private mode) must surface as saveFailed=true — the UI must never
// show a green "đã lưu" chip for a write that did not happen.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";

const SCHEMA_VERSION = 1;
const DEBOUNCE_MS = 750;

interface Envelope<T> {
  v: number;
  savedAt: number;
  data: T;
}

export interface AutosaveDraft<T> {
  /** Draft payload found at mount (schema-matched), else null. */
  initial: T | null;
  /** Epoch ms of the last successful write this session. */
  lastSavedAt: number | null;
  /** True when the last write threw (quota / private mode). */
  saveFailed: boolean;
  /** Remove the draft (after publish, or "start over"). */
  clear: () => void;
}

export function readDraft<T>(key: string): { data: T; savedAt: number } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const env = JSON.parse(raw) as Envelope<T>;
    if (env?.v !== SCHEMA_VERSION || env.data == null) return null;
    return { data: env.data, savedAt: env.savedAt };
  } catch {
    return null;
  }
}

export function useAutosaveDraft<T>({
  key,
  value,
  enabled = true,
}: {
  key: string | null;
  value: T;
  enabled?: boolean;
}): AutosaveDraft<T> {
  // Read once, synchronously, for the key's first non-null appearance —
  // callers apply it in an effect and show the restore banner.
  const [initial] = useState<T | null>(() => (key ? readDraft<T>(key)?.data ?? null : null));
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  const latest = useRef({ key, value, enabled });
  latest.current = { key, value, enabled };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleared = useRef(false);
  // Snapshot of the value at clear() time: saving resumes only when the value
  // actually changes afterwards — a mere re-render with a non-memoized value
  // object must not resurrect a cleared draft (publish → clear → stray render).
  const clearedSnapshot = useRef<string | null>(null);

  const flush = useCallback(() => {
    const { key: k, value: v, enabled: en } = latest.current;
    if (!k || !en || cleared.current) return;
    try {
      const env: Envelope<T> = { v: SCHEMA_VERSION, savedAt: Date.now(), data: v };
      localStorage.setItem(k, JSON.stringify(env));
      setLastSavedAt(env.savedAt);
      setSaveFailed(false);
    } catch {
      // ponytail: no retry queue — the banner tells the user saving is broken,
      // which beats silently pretending. Retry happens on the next keystroke.
      setSaveFailed(true);
    }
  }, []);

  // Debounced save on every value change.
  useEffect(() => {
    if (!key || !enabled) return;
    if (cleared.current) {
      if (JSON.stringify(value) === clearedSnapshot.current) return;
      cleared.current = false;
      clearedSnapshot.current = null;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [key, value, enabled, flush]);

  // Flush immediately when the tab goes to background — the "organizer gets
  // called onto the court and locks the phone" case this feature exists for.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, [flush]);

  const clear = useCallback(() => {
    cleared.current = true;
    try {
      clearedSnapshot.current = JSON.stringify(latest.current.value);
    } catch {
      clearedSnapshot.current = null;
    }
    if (timer.current) clearTimeout(timer.current);
    const k = latest.current.key;
    if (!k) return;
    try {
      localStorage.removeItem(k);
    } catch {
      // Removal failing is harmless — the envelope version gate still applies.
    }
    setLastSavedAt(null);
  }, []);

  return { initial, lastSavedAt, saveFailed, clear };
}
