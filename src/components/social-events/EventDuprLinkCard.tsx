// ============================================================================
// EventDuprLinkCard — registered-player UI to link DUPR id vào registration.
// ----------------------------------------------------------------------------
// Visible khi viewer là registered player của social event:
//   - Guest path: có `magicToken` (đọc từ localStorage qua readMyRegistration).
//   - Authenticated path: có `authedProfileId` từ useAuth().
//
// Card hiển thị:
//   - Trạng thái "Chưa liên kết" → input nhập DUPR id + nút "Liên kết".
//   - Trạng thái "Đã liên kết: <dupr_id>" → button "Bỏ liên kết" / "Sửa".
//
// DUPR id chấp nhận chữ + số + dash + underscore (format constraint trùng
// với CHECK trên DB). Gọi RPC link_event_dupr_id_by_token (guest) hoặc
// link_event_dupr_id_authed (authed) qua useLinkEventDuprId.
// ============================================================================

import { useEffect, useState } from "react";
import { Loader2, Trophy, Check, X, Pencil } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import {
  useLinkEventDuprId,
  useMyEventDuprId,
} from "@/hooks/useSocialEventMatches";

const DUPR_ID_PATTERN = /^[A-Za-z0-9_-]{2,32}$/;

interface Props {
  eventId: string;
  /** Magic token from localStorage (guest path). When provided, takes priority. */
  magicToken?: string | null;
  /** auth.uid() — used when magicToken is absent (authenticated user path). */
  authedProfileId?: string | null;
}

export function EventDuprLinkCard({ eventId, magicToken, authedProfileId }: Props) {
  const { t } = useI18n();
  const copy = t.socialEvents.eventDupr;

  const { data, isLoading, refetch } = useMyEventDuprId({
    eventId,
    magicToken,
    authedProfileId,
  });

  const linkMutation = useLinkEventDuprId(eventId);

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!editing) {
      setValue(data?.dupr_id ?? "");
    }
  }, [data?.dupr_id, editing]);

  const currentDuprId = data?.dupr_id ?? null;
  const hasLink = currentDuprId != null && currentDuprId.length > 0;

  async function handleSubmit(nextValue: string | null) {
    const clean = nextValue?.trim() ?? null;
    if (clean !== null && clean.length > 0 && !DUPR_ID_PATTERN.test(clean)) {
      toast({ title: copy.formatError, variant: "destructive" });
      return;
    }
    try {
      await linkMutation.mutateAsync({
        duprId: clean && clean.length > 0 ? clean : null,
        magicToken: magicToken ?? null,
      });
      toast({
        title: clean ? copy.linkSuccess : copy.unlinkSuccess,
      });
      setEditing(false);
      refetch();
    } catch (error) {
      const errCode = (error as { code?: string })?.code ?? "";
      const msg =
        errCode === "registration_not_found"
          ? copy.notRegistered
          : errCode.includes("dupr_id_invalid")
            ? copy.formatError
            : copy.linkError;
      toast({ title: msg, variant: "destructive" });
    }
  }

  return (
    <Card className="p-5 mb-6">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <Trophy className="h-4 w-4" style={{ color: "var(--tl-green, #16a34a)" }} />
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
          {copy.linkHeading}
        </h3>
      </div>
      <p style={{ fontSize: 14, color: "var(--tl-fg-3)", marginBottom: 14 }}>
        {copy.linkBody}
      </p>

      {isLoading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--tl-fg-3)" }}>
          <Loader2 className="h-4 w-4 animate-spin" />
          {t.common.loading}
        </div>
      ) : hasLink && !editing ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "10px 12px",
            borderRadius: 8,
            background: "rgba(22, 163, 74, 0.08)",
            border: "1px solid rgba(22, 163, 74, 0.3)",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <Check className="h-4 w-4" style={{ color: "rgb(22, 163, 74)" }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, color: "var(--tl-fg-3)" }}>
                {copy.linkedAsLabel}
              </div>
              <code style={{ fontSize: 14, fontFamily: "'Geist Mono', monospace", wordBreak: "break-all" }}>
                {currentDuprId}
              </code>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
              disabled={linkMutation.isPending}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" /> {copy.editCta}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => handleSubmit(null)}
              disabled={linkMutation.isPending}
            >
              <X className="mr-1 h-3.5 w-3.5" /> {copy.unlinkCta}
            </Button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!linkMutation.isPending) handleSubmit(value);
          }}
          style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}
        >
          <div style={{ flex: 1, minWidth: 200 }}>
            <Label htmlFor="event-dupr-id" style={{ fontSize: 12 }}>
              {copy.duprIdLabel}
            </Label>
            <Input
              id="event-dupr-id"
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={copy.duprIdPlaceholder}
              autoComplete="off"
              maxLength={32}
              disabled={linkMutation.isPending}
            />
          </div>
          <Button
            type="submit"
            disabled={linkMutation.isPending || value.trim().length < 2}
          >
            {linkMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {hasLink ? copy.saveEditCta : copy.linkCta}
          </Button>
          {editing && hasLink && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setValue(currentDuprId ?? "");
              }}
              disabled={linkMutation.isPending}
            >
              {t.common.cancel}
            </Button>
          )}
        </form>
      )}

      <p
        style={{
          marginTop: 12,
          fontSize: 12,
          color: "var(--tl-fg-3)",
          lineHeight: 1.5,
        }}
      >
        {copy.privacyHint}
      </p>
    </Card>
  );
}
