import { useState } from "react";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import {
  DuprSsoModal,
  type DuprSsoResult,
} from "./DuprSsoModal";
import { useInvalidateDuprConnection } from "@/hooks/useDuprConnection";

interface Props {
  /** Custom label override. */
  label?: string;
  /** Called after a successful SSO link — caller can chain side effects
   *  (e.g. onboarding advanceStep). */
  onConnected?: (result: DuprSsoResult) => void;
  /** Disable the trigger button. */
  disabled?: boolean;
  /** Visual variant — primary by default. */
  variant?: "primary" | "secondary";
  /** Optional inline style override. */
  style?: React.CSSProperties;
}

export function DuprConnectButton({
  label,
  onConnected,
  disabled = false,
  variant = "primary",
  style,
}: Props) {
  const { language } = useI18n();
  const { toast } = useToast();
  const invalidate = useInvalidateDuprConnection();
  const [open, setOpen] = useState(false);

  const defaultLabel =
    language === "vi" ? "Kết nối với DUPR" : "Connect with DUPR";

  const handleSuccess = (result: DuprSsoResult) => {
    setOpen(false);
    invalidate();
    toast({
      title:
        language === "vi" ? "Đã kết nối DUPR" : "DUPR connected",
      description: result.dupr_id ? `DUPR ID: ${result.dupr_id}` : undefined,
    });
    onConnected?.(result);
  };

  const handleError = (msg: string) => {
    toast({
      variant: "destructive",
      title:
        language === "vi" ? "Không kết nối được DUPR" : "DUPR connect failed",
      description: msg,
    });
  };

  return (
    <>
      <button
        type="button"
        className={`tl-btn ${variant === "primary" ? "primary" : ""}`}
        onClick={() => setOpen(true)}
        disabled={disabled}
        style={style}
      >
        {label ?? defaultLabel}
      </button>

      <DuprSsoModal
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={handleSuccess}
        onError={handleError}
      />
    </>
  );
}
