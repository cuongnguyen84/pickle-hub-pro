// ============================================================================
// ClubPaymentSettings (`/clb/:slug/quan-ly/thanh-toan`) — PR49 admin surface
// ----------------------------------------------------------------------------
// Club owner / admin form for entering the bank account that PR49 VietQR
// payments deposit into. Single-row upsert on `club_payment_config`.
// Toggle controls `enabled` — when off, create-payment-order returns
// `payment_not_enabled` and the RegistrationModal falls back to the
// "pay at the venue" path.
//
// Below the form, after the row is saved, a preview QR (50 000 ₫ +
// PHUB-DEMO00 memo) renders so the admin can scan it in their own
// banking app and verify the account info round-trips correctly. The
// preview uses the live `club_payment_config` row, NOT the form state,
// so the admin must save before they can scan.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Loader2, Save } from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/i18n";
import { useClub } from "@/hooks/useClub";
import { useClubOwnership } from "@/hooks/useClubOwnership";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { VN_BANKS, findBankByCode } from "@/lib/payment/banks";
import { generateVietQRUrl } from "@/lib/payment/vietqr";

interface ConfigRow {
  bank_code: string;
  bank_account_number: string;
  bank_account_name: string;
  enabled: boolean;
}

export default function ClubPaymentSettings() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useI18n();
  const settings = t.socialEvents.paymentSettings;
  const manage = t.socialEvents.manage;
  const queryClient = useQueryClient();
  const permission = useClubOwnership(slug);
  const { data: clubData } = useClub(slug);

  const { data: config, isLoading } = useQuery<ConfigRow | null>({
    queryKey: ["club-payment-config", clubData?.club.id],
    queryFn: async () => {
      if (!clubData?.club.id) return null;
      const { data } = await supabase
        .from("club_payment_config")
        .select("bank_code, bank_account_number, bank_account_name, enabled")
        .eq("club_id", clubData.club.id)
        .maybeSingle();
      return (data as ConfigRow | null) ?? null;
    },
    enabled: Boolean(clubData?.club.id),
    staleTime: 30_000,
  });

  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  // Hydrate form state from the saved row once on first load.
  useEffect(() => {
    if (config) {
      setBankCode(config.bank_code);
      setAccountNumber(config.bank_account_number);
      setAccountName(config.bank_account_name);
      setEnabled(config.enabled);
    }
  }, [config]);

  const trimmedAccountName = accountName.trim();
  const accountNumberValid = /^[0-9]{3,30}$/.test(accountNumber.trim());
  const canSave =
    bankCode.length > 0 &&
    accountNumberValid &&
    trimmedAccountName.length > 0 &&
    !saving;

  async function handleSave() {
    if (!clubData?.club.id) return;
    if (!canSave) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("club_payment_config")
        .upsert(
          {
            club_id: clubData.club.id,
            bank_code: bankCode,
            bank_account_number: accountNumber.trim(),
            bank_account_name: trimmedAccountName,
            enabled,
          },
          { onConflict: "club_id" },
        );
      if (error) {
        console.error("ClubPaymentSettings: upsert failed", error);
        toast({ title: t.common.error, description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: settings.savedToast });
      queryClient.invalidateQueries({
        queryKey: ["club-payment-config", clubData.club.id],
      });
    } finally {
      setSaving(false);
    }
  }

  const previewUrl = useMemo(() => {
    if (!config) return null;
    if (!config.enabled) return null;
    return generateVietQRUrl({
      bankCode: config.bank_code,
      accountNumber: config.bank_account_number,
      accountName: config.bank_account_name,
      amount: 50_000,
      memo: "PHUB-DEMO00",
    });
  }, [config]);

  if (permission.state === "loading") {
    return (
      <TheLineLayout title="Loading…" active="events" noindex>
        <div className="tl-shell" style={{ padding: "60px 16px" }}>
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </TheLineLayout>
    );
  }
  if (permission.state === "anonymous") return <Navigate to="/login" replace />;
  if (permission.state === "denied") {
    return (
      <TheLineLayout title={manage.noPermissionTitle} active="events" noindex>
        <div className="tl-shell" style={{ padding: "60px 16px", textAlign: "center" }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>{manage.noPermissionTitle}</h1>
          <p style={{ color: "var(--tl-fg-3)", maxWidth: 480, margin: "0 auto" }}>{manage.noPermissionBody}</p>
        </div>
      </TheLineLayout>
    );
  }
  if (!clubData) {
    return (
      <TheLineLayout title={t.socialEvents.club.notFound} active="events" noindex>
        <div className="tl-shell" style={{ padding: "60px 16px", textAlign: "center" }}>
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </TheLineLayout>
    );
  }

  return (
    <TheLineLayout title={`${settings.pageTitle} — ${clubData.club.name}`} active="events" noindex>
      <div className="tl-shell" style={{ paddingBottom: 60, maxWidth: 720, margin: "0 auto" }}>
        <header className="tl-page-head">
          <div className="kicker">
            ◆{" "}
            <Link to={`/clb/${clubData.club.slug}/quan-ly`} style={{ color: "inherit", textDecoration: "none" }}>
              {clubData.club.name}
            </Link>
          </div>
          <h1>{settings.pageTitle}</h1>
          <p>{settings.pageSubtitle}</p>
        </header>

        <Card>
          <CardContent className="space-y-5 pt-6">
            {isLoading ? (
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="bank-code">{settings.bankLabel} *</Label>
                  <Select value={bankCode} onValueChange={setBankCode}>
                    <SelectTrigger id="bank-code">
                      <SelectValue placeholder={settings.bankPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {VN_BANKS.map((b) => (
                        <SelectItem key={b.code} value={b.code}>
                          {b.shortName} — {b.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="account-number">{settings.accountNumberLabel} *</Label>
                  <Input
                    id="account-number"
                    inputMode="numeric"
                    autoComplete="off"
                    value={accountNumber}
                    onChange={(e) =>
                      setAccountNumber(e.target.value.replace(/\D+/g, "").slice(0, 30))
                    }
                    placeholder="0123456789"
                  />
                  {accountNumber.length > 0 && !accountNumberValid && (
                    <p className="text-xs text-destructive">{settings.accountNumberInvalid}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="account-name">{settings.accountNameLabel} *</Label>
                  <Input
                    id="account-name"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value.slice(0, 100))}
                    placeholder="NGUYEN VAN A"
                  />
                  <p className="text-xs text-muted-foreground">{settings.accountNameHint}</p>
                </div>

                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <Label htmlFor="enabled">{settings.enabledLabel}</Label>
                    <p className="text-xs text-muted-foreground">{settings.enabledHint}</p>
                  </div>
                  <Switch
                    id="enabled"
                    checked={enabled}
                    onCheckedChange={setEnabled}
                  />
                </div>

                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={!canSave}
                  className="w-full sm:w-auto"
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {saving ? settings.saving : settings.saveButton}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {previewUrl && (
          <Card className="mt-4">
            <CardContent className="space-y-3 pt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {settings.previewTitle}
              </h3>
              <p className="text-sm text-muted-foreground">{settings.previewHint}</p>
              <div className="flex justify-center">
                <img
                  src={previewUrl}
                  alt={settings.previewAlt}
                  width={260}
                  height={340}
                  className="rounded-md border border-border bg-white"
                  loading="lazy"
                />
              </div>
              <p className="text-center text-xs text-muted-foreground">
                {config ? (
                  <>
                    {findBankByCode(config.bank_code)?.shortName ?? config.bank_code} ·{" "}
                    <span className="font-mono">{config.bank_account_number}</span>
                  </>
                ) : null}
              </p>
            </CardContent>
          </Card>
        )}

        {config && !config.enabled && (
          <p className="mt-4 rounded-md border border-amber-400/40 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {settings.disabledNotice}
          </p>
        )}
      </div>
    </TheLineLayout>
  );
}
