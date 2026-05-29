// ============================================================================
// /admin/errors — runtime error inspector (admin only)
// ----------------------------------------------------------------------------
// Reads from public.client_errors which is RLS-gated to user_roles.admin.
// Live updates via Supabase Realtime channel so the page is useful as a
// "leave it open during deploys" dashboard.
//
// Groups rows by fingerprint (message + first stack line) — cuts down on
// the "50 identical errors" view. Click any row to see the full stack +
// payload details.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { Loader2, Filter, AlertTriangle, X, ExternalLink } from "lucide-react";
import { TheLineLayout } from "@/components/layout";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface ErrorRow {
  id: string;
  type: "js_error" | "unhandled_rejection" | "csp_violation";
  message: string | null;
  stack: string | null;
  url: string | null;
  user_agent: string | null;
  user_id: string | null;
  details: Record<string, unknown> | null;
  recorded_at: string;
}

interface GroupedError {
  fingerprint: string;
  sample: ErrorRow;
  count: number;
  lastSeen: string;
  firstSeen: string;
  types: Set<string>;
  uniqueUrls: number;
}

type TypeFilter = "all" | "js_error" | "unhandled_rejection" | "csp_violation";
type WindowFilter = "1h" | "24h" | "7d" | "30d";

function fingerprint(message: string | null, stack: string | null): string {
  const msg = (message ?? "").slice(0, 200);
  const stackLine = (stack ?? "").split("\n")[0]?.slice(0, 200) ?? "";
  return `${msg}|${stackLine}`;
}

function windowMs(w: WindowFilter): number {
  switch (w) {
    case "1h": return 60 * 60_000;
    case "24h": return 24 * 60 * 60_000;
    case "7d": return 7 * 24 * 60 * 60_000;
    case "30d": return 30 * 24 * 60 * 60_000;
  }
}

function relativeTime(iso: string, vi: boolean): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return vi ? `${sec}s trước` : `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return vi ? `${min}p trước` : `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return vi ? `${hr}h trước` : `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return vi ? `${d}d trước` : `${d}d ago`;
}

export default function AdminErrors() {
  const { language } = useI18n();
  const vi = language === "vi";

  const [rows, setRows] = useState<ErrorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [windowFilter, setWindowFilter] = useState<WindowFilter>("24h");
  const [selected, setSelected] = useState<ErrorRow | null>(null);

  // Initial fetch.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const since = new Date(Date.now() - windowMs(windowFilter)).toISOString();
      let q = supabase
        .from("client_errors")
        .select("*")
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: false })
        .limit(500);
      if (typeFilter !== "all") q = q.eq("type", typeFilter);
      const { data } = await q;
      if (cancelled) return;
      setRows((data ?? []) as ErrorRow[]);
      setLoading(false);
    }

    void load();
    return () => { cancelled = true; };
  }, [typeFilter, windowFilter]);

  // Realtime subscription — new rows flow in live.
  useEffect(() => {
    const channel = supabase
      .channel("client-errors-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "client_errors" },
        (payload) => {
          const row = payload.new as ErrorRow;
          // Apply type filter to the streamed row.
          if (typeFilter !== "all" && row.type !== typeFilter) return;
          setRows((prev) => [row, ...prev].slice(0, 500));
        },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [typeFilter]);

  const groups = useMemo<GroupedError[]>(() => {
    const m = new Map<string, GroupedError>();
    for (const r of rows) {
      const fp = fingerprint(r.message, r.stack);
      const existing = m.get(fp);
      if (existing) {
        existing.count++;
        existing.types.add(r.type);
        if (r.recorded_at > existing.lastSeen) existing.lastSeen = r.recorded_at;
        if (r.recorded_at < existing.firstSeen) existing.firstSeen = r.recorded_at;
        if (r.url && r.url !== existing.sample.url) existing.uniqueUrls++;
      } else {
        m.set(fp, {
          fingerprint: fp,
          sample: r,
          count: 1,
          lastSeen: r.recorded_at,
          firstSeen: r.recorded_at,
          types: new Set([r.type]),
          uniqueUrls: 1,
        });
      }
    }
    return Array.from(m.values()).sort((a, b) =>
      b.lastSeen.localeCompare(a.lastSeen),
    );
  }, [rows]);

  const totalCount = rows.length;
  const uniqueCount = groups.length;

  return (
    <TheLineLayout
      title="Admin Errors — ThePickleHub"
      description="Runtime error inspector"
      noindex
    >
      <div className="mx-auto max-w-5xl px-4 py-6">
        <header className="mb-6">
          <h1
            className="text-2xl font-semibold mb-1"
            style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic" }}
          >
            Runtime Errors
          </h1>
          <p className="text-sm" style={{ color: "var(--tl-fg-3)" }}>
            {vi
              ? "Lỗi JS + CSP report từ frontend. Realtime update khi có lỗi mới."
              : "Frontend JS + CSP reports. Live-updating via Supabase realtime."}
          </p>
        </header>

        {/* Toolbar */}
        <div
          className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-md border"
          style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)" }}
        >
          <Filter style={{ width: 14, height: 14, color: "var(--tl-fg-3)" }} />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            className="text-sm px-2 py-1 rounded border bg-transparent"
            style={{ borderColor: "var(--tl-border)", color: "var(--tl-fg)" }}
          >
            <option value="all">{vi ? "Tất cả loại" : "All types"}</option>
            <option value="js_error">JS error</option>
            <option value="unhandled_rejection">Unhandled rejection</option>
            <option value="csp_violation">CSP violation</option>
          </select>
          <select
            value={windowFilter}
            onChange={(e) => setWindowFilter(e.target.value as WindowFilter)}
            className="text-sm px-2 py-1 rounded border bg-transparent"
            style={{ borderColor: "var(--tl-border)", color: "var(--tl-fg)" }}
          >
            <option value="1h">{vi ? "1 giờ qua" : "Last 1h"}</option>
            <option value="24h">{vi ? "24 giờ qua" : "Last 24h"}</option>
            <option value="7d">{vi ? "7 ngày" : "Last 7d"}</option>
            <option value="30d">{vi ? "30 ngày" : "Last 30d"}</option>
          </select>
          <div className="ml-auto text-sm" style={{ color: "var(--tl-fg-3)" }}>
            {totalCount} {vi ? "lỗi" : "events"} · {uniqueCount}{" "}
            {vi ? "duy nhất" : "unique"}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="rounded-md border p-12 text-center"
               style={{ borderColor: "var(--tl-border)" }}>
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-md border p-10 text-center"
               style={{ borderColor: "var(--tl-border)" }}>
            <AlertTriangle
              className="mx-auto mb-3"
              style={{ width: 24, height: 24, color: "var(--tl-fg-3)" }}
            />
            <p style={{ color: "var(--tl-fg-3)" }}>
              {vi
                ? "Không có lỗi trong khoảng thời gian này. 🎉"
                : "No errors in this window. 🎉"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {groups.map((g) => (
              <GroupRow
                key={g.fingerprint}
                group={g}
                onOpen={() => setSelected(g.sample)}
                vi={vi}
              />
            ))}
          </div>
        )}

        {/* Detail modal */}
        {selected && (
          <Dialog open onOpenChange={() => setSelected(null)}>
            <DialogContent
              className="max-w-3xl p-0 border-0 max-h-[90vh] overflow-y-auto"
              style={{ background: "var(--tl-bg)", borderRadius: 12 }}
            >
              <VisuallyHidden>
                <DialogTitle>Error detail</DialogTitle>
                <DialogDescription>Full stack and payload</DialogDescription>
              </VisuallyHidden>
              <div className="p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-wider mb-1"
                         style={{ color: "var(--tl-fg-3)",
                                  fontFamily: "'Geist Mono', monospace" }}>
                      {selected.type} · {new Date(selected.recorded_at).toLocaleString()}
                    </div>
                    <div className="font-semibold text-base mb-2 break-words"
                         style={{ color: "var(--tl-live, #ef4444)" }}>
                      {selected.message ?? "—"}
                    </div>
                    {selected.url && (
                      <a
                        href={selected.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs inline-flex items-center gap-1 underline"
                        style={{ color: "var(--tl-fg-2)" }}
                      >
                        {selected.url} <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    aria-label="Close"
                    className="p-1 rounded hover:opacity-70"
                  >
                    <X style={{ width: 18, height: 18 }} />
                  </button>
                </div>

                {selected.stack && (
                  <div className="mb-4">
                    <div className="text-xs uppercase mb-2"
                         style={{ color: "var(--tl-fg-3)",
                                  fontFamily: "'Geist Mono', monospace" }}>
                      Stack
                    </div>
                    <pre
                      className="text-xs overflow-x-auto rounded p-3 border whitespace-pre-wrap"
                      style={{
                        borderColor: "var(--tl-border)",
                        background: "var(--tl-surface)",
                        fontFamily: "'Geist Mono', monospace",
                        color: "var(--tl-fg-2)",
                        lineHeight: 1.6,
                      }}
                    >
                      {selected.stack}
                    </pre>
                  </div>
                )}

                {selected.details && (
                  <div className="mb-4">
                    <div className="text-xs uppercase mb-2"
                         style={{ color: "var(--tl-fg-3)",
                                  fontFamily: "'Geist Mono', monospace" }}>
                      Details
                    </div>
                    <pre
                      className="text-xs overflow-x-auto rounded p-3 border whitespace-pre-wrap"
                      style={{
                        borderColor: "var(--tl-border)",
                        background: "var(--tl-surface)",
                        fontFamily: "'Geist Mono', monospace",
                        color: "var(--tl-fg-2)",
                        lineHeight: 1.6,
                      }}
                    >
                      {JSON.stringify(selected.details, null, 2)}
                    </pre>
                  </div>
                )}

                {selected.user_agent && (
                  <div className="text-xs"
                       style={{ color: "var(--tl-fg-3)", lineHeight: 1.5 }}>
                    <span style={{ fontFamily: "'Geist Mono', monospace" }}>
                      UA:
                    </span>{" "}
                    {selected.user_agent}
                  </div>
                )}
                {selected.user_id && (
                  <div className="text-xs mt-1"
                       style={{ color: "var(--tl-fg-3)",
                                fontFamily: "'Geist Mono', monospace" }}>
                    user_id: {selected.user_id}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </TheLineLayout>
  );
}

function GroupRow({
  group,
  onOpen,
  vi,
}: {
  group: GroupedError;
  onOpen: () => void;
  vi: boolean;
}) {
  const isCsp = group.sample.type === "csp_violation";
  const accent = isCsp ? "var(--tl-amber, #f59e0b)" : "var(--tl-live, #ef4444)";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left rounded-md border p-4 hover:opacity-90 transition-opacity"
      style={{
        borderColor: "var(--tl-border)",
        background: "var(--tl-bg)",
        cursor: "pointer",
      }}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          style={{ width: 16, height: 16, color: accent, marginTop: 2, flexShrink: 0 }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 text-xs"
               style={{ fontFamily: "'Geist Mono', monospace",
                        color: "var(--tl-fg-3)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em" }}>
            <span style={{ color: accent }}>{group.sample.type}</span>
            <span>·</span>
            <span>{relativeTime(group.lastSeen, vi)}</span>
            {group.count > 1 && (
              <>
                <span>·</span>
                <span style={{ color: "var(--tl-fg-2)", fontWeight: 600 }}>
                  ×{group.count}
                </span>
              </>
            )}
          </div>
          <div className="text-sm font-medium mb-1 break-words"
               style={{ color: "var(--tl-fg)" }}>
            {group.sample.message ?? "—"}
          </div>
          {group.sample.url && (
            <div className="text-xs truncate"
                 style={{ color: "var(--tl-fg-3)" }}>
              {group.sample.url}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
