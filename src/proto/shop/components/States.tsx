// ============================================================================
// Shared loading / empty / error / offline / denied states
// ----------------------------------------------------------------------------
// Every error state follows the F08 pattern: what happened → why (only when we
// actually know) → what you can do now. The recovery line is never optional.
// ============================================================================

import type { ReactNode } from "react";
import { WifiOff, AlertTriangle, Lock, RotateCw, PackageOpen } from "lucide-react";

export const LoadingGrid = ({ count = 6, label = "Đang tải sản phẩm" }: { count?: number; label?: string }) => (
  <div className="tl-shop-grid" aria-busy="true" aria-label={label}>
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="tl-shop-pcard">
        <div className="tl-shop-sk" style={{ aspectRatio: "1 / 1", borderRadius: "var(--tl-radius)" }} />
        <div className="tl-shop-sk" style={{ height: 13, width: "92%" }} />
        <div className="tl-shop-sk" style={{ height: 13, width: "58%" }} />
        <div className="tl-shop-sk" style={{ height: 17, width: "45%" }} />
      </div>
    ))}
  </div>
);

export const LoadingLines = ({ rows = 4 }: { rows?: number }) => (
  <div aria-busy="true" style={{ display: "grid", gap: 12 }}>
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="tl-shop-sk" style={{ height: 68 }} />
    ))}
  </div>
);

export const ErrorState = ({
  what,
  cause,
  recovery,
  onRetry,
}: {
  what: string;
  cause?: string;
  recovery: string;
  onRetry?: () => void;
}) => (
  <div className="tl-shop-empty" role="alert">
    <AlertTriangle size={26} aria-hidden="true" style={{ color: "var(--shop-danger)", marginBottom: 10 }} />
    <p className="tl-shop-empty-title">{what}</p>
    <p>
      {cause ? `${cause} ` : ""}
      {recovery}
    </p>
    <button type="button" className="tl-shop-btn" onClick={onRetry ?? (() => window.location.reload())}>
      <RotateCw size={15} aria-hidden="true" />
      Thử lại
    </button>
  </div>
);

export const OfflineState = ({ what = "Không có kết nối mạng." }: { what?: string }) => (
  <div className="tl-shop-empty" role="alert">
    <WifiOff size={26} aria-hidden="true" style={{ color: "var(--shop-warning)", marginBottom: 10 }} />
    <p className="tl-shop-empty-title">{what}</p>
    <p>
      Những gì anh/chị đã xem vẫn còn ở đây. Sản phẩm mới và giá mới sẽ hiện lại khi có mạng.
    </p>
  </div>
);

export const DeniedState = ({
  what = "Anh/chị không còn quyền vào trang này.",
  cause,
  recovery = "Liên hệ chủ shop, hoặc quay lại trang mua hàng.",
}: {
  what?: string;
  cause?: string;
  recovery?: string;
}) => (
  <div className="tl-shop-empty" role="alert">
    <Lock size={26} aria-hidden="true" style={{ color: "var(--tl-fg-3)", marginBottom: 10 }} />
    <p className="tl-shop-empty-title">{what}</p>
    <p>
      {cause ? `${cause} ` : ""}
      {recovery}
    </p>
  </div>
);

export const EmptyState = ({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) => (
  <div className="tl-shop-empty">
    <PackageOpen size={26} aria-hidden="true" style={{ color: "var(--tl-fg-3)", marginBottom: 10 }} />
    <p className="tl-shop-empty-title">{title}</p>
    {children && <p>{children}</p>}
    {action}
  </div>
);
