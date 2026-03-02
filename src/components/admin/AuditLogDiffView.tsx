import { AuditLogEntry } from "@/hooks/useAuditLog";

interface AuditLogDiffViewProps {
  entry: AuditLogEntry;
}

export function AuditLogDiffView({ entry }: AuditLogDiffViewProps) {
  const { before_data, after_data, metadata } = entry;
  const hasDiff = before_data || after_data;

  // Get all keys from both objects
  const allKeys = hasDiff
    ? [...new Set([
        ...Object.keys(before_data || {}),
        ...Object.keys(after_data || {}),
      ])]
    : [];

  return (
    <div className="space-y-3">
      {/* Diff View */}
      {hasDiff && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Before</h4>
            <div className="bg-background border rounded p-3 space-y-1">
              {before_data ? allKeys.map((key) => {
                const oldVal = (before_data as Record<string, unknown>)[key];
                const newVal = (after_data as Record<string, unknown>)?.[key];
                const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);
                return (
                  <div key={key} className={`text-xs font-mono flex gap-2 ${changed ? "bg-destructive/10 text-destructive rounded px-1 -mx-1" : ""}`}>
                    <span className="text-muted-foreground min-w-[80px]">{key}:</span>
                    <span>{oldVal === null || oldVal === undefined ? "—" : String(oldVal)}</span>
                  </div>
                );
              }) : (
                <span className="text-xs text-muted-foreground italic">Không có dữ liệu</span>
              )}
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">After</h4>
            <div className="bg-background border rounded p-3 space-y-1">
              {after_data ? allKeys.map((key) => {
                const oldVal = (before_data as Record<string, unknown>)?.[key];
                const newVal = (after_data as Record<string, unknown>)[key];
                const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);
                return (
                  <div key={key} className={`text-xs font-mono flex gap-2 ${changed ? "bg-emerald-500/10 text-emerald-600 rounded px-1 -mx-1" : ""}`}>
                    <span className="text-muted-foreground min-w-[80px]">{key}:</span>
                    <span>{newVal === null || newVal === undefined ? "—" : String(newVal)}</span>
                  </div>
                );
              }) : (
                <span className="text-xs text-muted-foreground italic">Không có dữ liệu</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Metadata */}
      {metadata && Object.keys(metadata).length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Metadata</h4>
          <pre className="text-xs font-mono bg-background p-3 rounded border overflow-x-auto max-h-32">
            {JSON.stringify(metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
