// ============================================================================
// Step1Info — first step of the CreateSocialEvent wizard.
// ----------------------------------------------------------------------------
// Pure presentation. Form state + per-field errors come from the parent.
// `touched` keeps validation errors hidden until the user has interacted
// with each field (onBlur). The wizard container computes errors on every
// keystroke; this component decides whether to display them.
// ============================================================================

import { useState } from "react";
import { X as XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/i18n";
import type { FormState, FormErrors } from "./types";
import { SlotManager } from "./SlotManager";

interface Props {
  form: FormState;
  errors: FormErrors;
  touched: Partial<Record<keyof FormState, boolean>>;
  onChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  onBlur: (key: keyof FormState) => void;
}

function ErrorText({ msg }: { msg: string | null | undefined }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-destructive">{msg}</p>;
}

export function Step1Info({ form, errors, touched, onChange, onBlur }: Props) {
  const { t } = useI18n();
  const create = t.socialEvents.create;
  const showError = (k: keyof FormState) => (touched[k] ? errors[k] : null);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">{create.step1Heading}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{create.step1Subheading}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ev-name">{create.eventName} *</Label>
        <Input
          id="ev-name"
          value={form.title}
          onChange={(e) => onChange("title", e.target.value)}
          onBlur={() => onBlur("title")}
          placeholder={create.eventNamePlaceholder}
          maxLength={200}
          required
        />
        <ErrorText msg={showError("title")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ev-desc">{create.description}</Label>
        <Textarea
          id="ev-desc"
          value={form.description}
          onChange={(e) => onChange("description", e.target.value)}
          onBlur={() => onBlur("description")}
          rows={4}
          maxLength={2000}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ev-date">{create.startDate} *</Label>
          <Input
            id="ev-date"
            type="date"
            value={form.start_date}
            onChange={(e) => onChange("start_date", e.target.value)}
            onBlur={() => onBlur("start_date")}
            required
          />
          <ErrorText msg={showError("start_date")} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label htmlFor="ev-start-time">{create.startTime} *</Label>
            <Input
              id="ev-start-time"
              type="time"
              value={form.start_time}
              onChange={(e) => onChange("start_time", e.target.value)}
              onBlur={() => onBlur("start_time")}
              required
            />
            <ErrorText msg={showError("start_time")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ev-end-time">{create.endTime} *</Label>
            <Input
              id="ev-end-time"
              type="time"
              value={form.end_time}
              onChange={(e) => onChange("end_time", e.target.value)}
              onBlur={() => onBlur("end_time")}
              required
            />
            <ErrorText msg={showError("end_time")} />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ev-location">{create.location} *</Label>
        <Input
          id="ev-location"
          value={form.location_text}
          onChange={(e) => onChange("location_text", e.target.value)}
          onBlur={() => onBlur("location_text")}
          placeholder={create.locationPlaceholder}
          maxLength={200}
          required
        />
        <ErrorText msg={showError("location_text")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ev-courts">{create.courtCount}</Label>
          <Input
            id="ev-courts"
            type="number"
            inputMode="numeric"
            min={1}
            max={50}
            value={form.court_count}
            onChange={(e) => onChange("court_count", Number(e.target.value))}
            onBlur={() => onBlur("court_count")}
          />
          <ErrorText msg={showError("court_count")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ev-max">{create.maxPlayers} *</Label>
          <Input
            id="ev-max"
            type="number"
            inputMode="numeric"
            min={4}
            max={200}
            value={form.max_players}
            onChange={(e) => onChange("max_players", Number(e.target.value))}
            onBlur={() => onBlur("max_players")}
            required
          />
          <ErrorText msg={showError("max_players")} />
        </div>
      </div>

      {/* PR68 — Ball type + free perks (optional). Both surface as
          badges on the public event detail card next to date/price. */}
      <BallTypeAndPerksFields form={form} onChange={onChange} />

      <div className="space-y-2">
        <Label htmlFor="ev-zalo">{create.zaloGroupUrl}</Label>
        <Input
          id="ev-zalo"
          type="url"
          value={form.zalo_group_url}
          onChange={(e) => onChange("zalo_group_url", e.target.value)}
          onBlur={() => onBlur("zalo_group_url")}
          placeholder="https://zalo.me/g/..."
        />
        <ErrorText msg={showError("zalo_group_url")} />
      </div>

      <div className="space-y-2">
        <Label>{create.visibility}</Label>
        <div className="space-y-1">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="visibility"
              checked={form.visibility === "public"}
              onChange={() => onChange("visibility", "public")}
            />
            <span>{create.visibilityPublic}</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="visibility"
              checked={form.visibility === "club_only"}
              onChange={() => onChange("visibility", "club_only")}
            />
            <span>{create.visibilityClubOnly}</span>
          </label>
        </div>
      </div>

      {/* Optional slot config — chia event thành các nhóm theo trình độ /
          thời gian chơi. Mặc định không bật; organizer click "+ Thêm
          slot" để bắt đầu. */}
      <SlotManager
        slots={form.slots}
        maxPlayers={form.max_players}
        onChange={(next) => onChange("slots", next)}
      />

      {/* Weekly-repeat — tạo nhiều event giống hệt cách nhau 7 ngày. */}
      <div className="space-y-2 rounded-md border bg-muted/20 px-4 py-3">
        <Label htmlFor="ev-repeat">{create.repeatWeeksLabel}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="ev-repeat"
            type="number"
            inputMode="numeric"
            min={0}
            max={12}
            value={form.repeat_weeks}
            onChange={(e) => onChange("repeat_weeks", Math.max(0, Math.min(12, Number(e.target.value) || 0)))}
            onBlur={() => onBlur("repeat_weeks")}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">{create.repeatWeeksUnit}</span>
        </div>
        <p className="text-xs text-muted-foreground">{create.repeatWeeksHint}</p>
        {form.repeat_weeks > 0 && form.start_date && (
          <p className="text-xs text-foreground">
            {create.repeatWeeksPreview
              .replace("{count}", String(form.repeat_weeks + 1))
              .replace("{last}", (() => {
                const base = new Date(form.start_date + "T00:00:00");
                if (Number.isNaN(base.getTime())) return "";
                base.setDate(base.getDate() + 7 * form.repeat_weeks);
                return base.toLocaleDateString("vi-VN", {
                  weekday: "short",
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                });
              })())}
          </p>
        )}
        <ErrorText msg={showError("repeat_weeks")} />
      </div>
    </div>
  );
}


// ============================================================================
// BallTypeAndPerksFields — small helper UI (PR68)
// ----------------------------------------------------------------------------
// Renders the optional "Loại bóng thi đấu" select-with-custom plus the
// "Bao gồm miễn phí" toggle-chip multi-select. Kept inside Step1Info.tsx
// (vs. its own file) so the new feature lands as a single drop-in chunk;
// can be promoted to its own module later if it grows.
// ============================================================================

const BALL_PRESETS = ["Franklin X-40", "Dura Fast 40", "Onix Fuse G2", "Selkirk"];
const PERK_PRESETS = ["Nước", "Hoa quả", "Khăn", "Ăn nhẹ"];
const CUSTOM_BALL_VALUE = "__custom__";

interface BallPerksProps {
  form: FormState;
  onChange: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}

function BallTypeAndPerksFields({ form, onChange }: BallPerksProps) {
  const { t } = useI18n();
  const labels = t.socialEvents.create;

  // Detect whether the persisted ball_type matches one of our presets;
  // if not we treat it as a custom entry and show the text input. The
  // select value stays in sync via this derived boolean.
  const isCustomBall =
    form.ball_type.length > 0 && !BALL_PRESETS.includes(form.ball_type);
  const [showCustomBall, setShowCustomBall] = useState<boolean>(isCustomBall);

  // Local state for the "add custom perk" input. We append to form.free_perks
  // on commit, then clear.
  const [customPerk, setCustomPerk] = useState("");

  const togglePerk = (perk: string) => {
    const next = form.free_perks.includes(perk)
      ? form.free_perks.filter((p) => p !== perk)
      : [...form.free_perks, perk];
    onChange("free_perks", next);
  };

  const removePerk = (perk: string) => {
    onChange(
      "free_perks",
      form.free_perks.filter((p) => p !== perk),
    );
  };

  const addCustomPerk = () => {
    const v = customPerk.trim();
    if (!v) return;
    if (form.free_perks.includes(v)) {
      setCustomPerk("");
      return;
    }
    onChange("free_perks", [...form.free_perks, v]);
    setCustomPerk("");
  };

  // Custom perks = anything in form.free_perks that's not a preset. We show
  // these as removable chips so the organizer can drop their typos.
  const customPerks = form.free_perks.filter((p) => !PERK_PRESETS.includes(p));

  const ballSelectValue = showCustomBall
    ? CUSTOM_BALL_VALUE
    : form.ball_type === ""
      ? undefined
      : form.ball_type;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Ball type — Select + optional custom input */}
      <div className="space-y-2">
        <Label htmlFor="ev-ball">{labels.ballType}</Label>
        <Select
          value={ballSelectValue}
          onValueChange={(v) => {
            if (v === CUSTOM_BALL_VALUE) {
              setShowCustomBall(true);
              // Clear preset value but keep prior custom text if any
              if (BALL_PRESETS.includes(form.ball_type)) {
                onChange("ball_type", "");
              }
            } else {
              setShowCustomBall(false);
              onChange("ball_type", v);
            }
          }}
        >
          <SelectTrigger id="ev-ball">
            <SelectValue placeholder={labels.ballTypePlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {BALL_PRESETS.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM_BALL_VALUE}>
              {labels.ballTypeOther}
            </SelectItem>
          </SelectContent>
        </Select>
        {showCustomBall && (
          <Input
            id="ev-ball-custom"
            value={form.ball_type}
            onChange={(e) => onChange("ball_type", e.target.value)}
            placeholder={labels.ballTypeCustomPlaceholder}
            maxLength={80}
          />
        )}
      </div>

      {/* Free perks — preset toggle chips + custom add */}
      <div className="space-y-2">
        <Label>{labels.freePerks}</Label>
        <div className="flex flex-wrap gap-2">
          {PERK_PRESETS.map((p) => {
            const selected = form.free_perks.includes(p);
            return (
              <button
                type="button"
                key={p}
                onClick={() => togglePerk(p)}
                className={
                  "inline-flex items-center rounded-full border px-3 py-1 text-xs transition " +
                  (selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent")
                }
              >
                {p}
              </button>
            );
          })}
          {customPerks.map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary px-3 py-1 text-xs text-primary-foreground"
            >
              {p}
              <button
                type="button"
                aria-label={labels.freePerksRemove}
                onClick={() => removePerk(p)}
                className="rounded-full hover:bg-primary-foreground/20"
              >
                <XIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            id="ev-perk-custom"
            value={customPerk}
            onChange={(e) => setCustomPerk(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomPerk();
              }
            }}
            placeholder={labels.freePerksCustomPlaceholder}
            maxLength={40}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCustomPerk}
            disabled={!customPerk.trim()}
          >
            {labels.freePerksAdd}
          </Button>
        </div>
      </div>
    </div>
  );
}
