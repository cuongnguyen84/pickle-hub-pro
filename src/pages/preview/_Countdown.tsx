import { useEffect, useState } from "react";

interface CountdownProps {
  to: string | null | undefined;
  /** Rendered when the target is already in the past */
  pastLabel?: string;
  /** Show a bullet prefix like "●" */
  prefix?: string;
  className?: string;
  /** Locale for "in X" / "trong X" prefix and unit labels */
  language?: "en" | "vi";
}

/**
 * Real-time countdown to an ISO timestamp. Updates every second.
 * Falls back to "—" if `to` is missing or invalid.
 */
export const Countdown = ({ to, pastLabel = "Starting now", prefix, className, language = "en" }: CountdownProps) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!to) return;
    const target = new Date(to).getTime();
    if (Number.isNaN(target)) return;

    // If target is more than 1 hour away, update every 30s; otherwise every 1s
    const diff = target - Date.now();
    const intervalMs = Math.abs(diff) > 3600_000 ? 30_000 : 1_000;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [to]);

  if (!to) return <span className={className}>—</span>;
  const target = new Date(to).getTime();
  if (Number.isNaN(target)) return <span className={className}>—</span>;

  const diff = target - now;
  if (diff <= 0) {
    return <span className={className}>{prefix ? `${prefix} ` : ""}{pastLabel}</span>;
  }

  const days = Math.floor(diff / 86400_000);
  const hours = Math.floor((diff % 86400_000) / 3600_000);
  const mins = Math.floor((diff % 3600_000) / 60_000);
  const secs = Math.floor((diff % 60_000) / 1000);

  const isVi = language === "vi";
  let label: string;
  if (days > 0) label = isVi ? `${days} ngày ${hours} giờ` : `${days}d ${hours}h`;
  else if (hours > 0) label = isVi ? `${hours} giờ ${mins.toString().padStart(2, "0")} phút` : `${hours}h ${mins.toString().padStart(2, "0")}m`;
  else if (mins > 0) label = isVi ? `${mins} phút ${secs.toString().padStart(2, "0")} giây` : `${mins}m ${secs.toString().padStart(2, "0")}s`;
  else label = isVi ? `${secs} giây` : `${secs}s`;

  const prefixWord = isVi ? "trong" : "in";
  return <span className={className}>{prefix ? `${prefix} ` : ""}{prefixWord} {label}</span>;
};

export default Countdown;
