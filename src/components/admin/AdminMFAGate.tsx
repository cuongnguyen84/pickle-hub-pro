import { ReactNode, useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, ShieldCheck } from "lucide-react";

// ADMIN-MFA: chặn toàn bộ khu /admin sau lớp 2FA (TOTP).
// - Chưa enroll: hiện QR để đăng ký với app authenticator, verify xong mới vào.
// - Đã enroll: mỗi phiên đăng nhập (aal1) phải nhập mã 6 số để nâng lên aal2.
// Chốt chặn thật nằm ở DB: is_admin()/has_role() yêu cầu aal2 một khi user đã
// có factor verified (migration 20260730090000) — gate này là phần UI của nó.

type GateState =
  | { step: "loading" }
  | { step: "ok" }
  | { step: "challenge"; factorId: string }
  | { step: "enroll"; factorId: string; qrCode: string; secret: string }
  | { step: "error"; message: string };

export function AdminMFAGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>({ step: "loading" });
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const init = useCallback(async () => {
    setState({ step: "loading" });
    const { data: aal, error: aalError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) {
      setState({ step: "error", message: aalError.message });
      return;
    }
    if (aal.currentLevel === "aal2") {
      setState({ step: "ok" });
      return;
    }

    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      setState({ step: "error", message: listError.message });
      return;
    }

    // data.totp chỉ chứa factor ĐÃ verified (supabase-js lọc sẵn)
    const verified = factors.totp[0];
    if (verified) {
      setState({ step: "challenge", factorId: verified.id });
      return;
    }

    // Dọn factor dở dang (enroll lần trước bỏ ngang) rồi enroll mới
    for (const f of factors.all) {
      if (f.status === "unverified") {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
    }
    const { data: enroll, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Admin 2FA",
    });
    if (enrollError) {
      setState({ step: "error", message: enrollError.message });
      return;
    }
    setState({
      step: "enroll",
      factorId: enroll.id,
      qrCode: enroll.totp.qr_code,
      secret: enroll.totp.secret,
    });
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  const handleVerify = async () => {
    if (state.step !== "challenge" && state.step !== "enroll") return;
    setVerifying(true);
    setVerifyError(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: state.factorId,
      code: code.trim(),
    });
    setVerifying(false);
    if (error) {
      setVerifyError("Mã không đúng hoặc đã hết hạn. Thử lại.");
      return;
    }
    setState({ step: "ok" });
  };

  if (state.step === "ok") return <>{children}</>;

  if (state.step === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-8 h-8 text-primary" />
        </div>

        {state.step === "error" ? (
          <>
            <h1 className="text-2xl font-semibold mb-2">Lỗi xác thực 2 yếu tố</h1>
            <p className="text-foreground-muted mb-6 break-words">{state.message}</p>
            <Button onClick={init} variant="outline">
              Thử lại
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold mb-2">
              {state.step === "enroll" ? "Bật xác thực 2 yếu tố" : "Xác thực 2 yếu tố"}
            </h1>
            {state.step === "enroll" ? (
              <>
                <p className="text-foreground-muted mb-4">
                  Quét mã QR bằng app authenticator (Google Authenticator, 1Password…)
                  rồi nhập mã 6 số để hoàn tất.
                </p>
                <img
                  src={state.qrCode}
                  alt="QR code TOTP"
                  className="w-48 h-48 mx-auto mb-3 bg-white rounded-lg p-2"
                />
                <p className="text-xs text-foreground-muted mb-4 break-all">
                  Không quét được? Nhập secret: <code>{state.secret}</code>
                </p>
              </>
            ) : (
              <p className="text-foreground-muted mb-6">
                Nhập mã 6 số từ app authenticator để vào trang quản trị.
              </p>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleVerify();
              }}
              className="space-y-3"
            >
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                className="text-center text-2xl tracking-[0.5em] font-mono"
                autoFocus
              />
              {verifyError && <p className="text-sm text-destructive">{verifyError}</p>}
              <Button type="submit" className="w-full" disabled={verifying || code.length !== 6}>
                {verifying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Xác nhận
              </Button>
            </form>

            <Button
              variant="ghost"
              className="mt-4 text-foreground-muted"
              onClick={() => supabase.auth.signOut()}
            >
              Đăng xuất
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
