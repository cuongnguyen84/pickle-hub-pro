// ============================================================================
// Step1Info — first step of the CreateSocialEvent wizard.
// ----------------------------------------------------------------------------
// Pure presentation. Form state + per-field errors come from the parent.
// `touched` keeps validation errors hidden until the user has interacted
// with each field (onBlur). The wizard container computes errors on every
// keystroke; this component decides whether to display them.
// ============================================================================

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
    </div>
  );
}
