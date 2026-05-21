// ============================================================================
// SlotManager — optional registration-slot config for CreateSocialEvent.
// ----------------------------------------------------------------------------
// Organizer có thể thêm 0..N slot. Mỗi slot là 1 phân nhóm trong event,
// ví dụ "2 sân Newbie", "3 sân trình độ 2.5", hoặc "Sân dành cho người
// chơi tối thiểu 6 tháng".
//
// Pure presentation — state lives in the wizard parent (FormState.slots).
// Cha pass slots + onChange("slots", next). Validation errors đến từ
// validateSlots() trong types.ts.
// ============================================================================

import { Trash2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import {
  makeEmptySlot,
  validateSlots,
  type SlotConfig,
  type SlotKind,
} from "./types";

interface Props {
  slots: SlotConfig[];
  maxPlayers: number;
  onChange: (next: SlotConfig[]) => void;
}

/**
 * Render 1 slot card với các field tuỳ thuộc kind.
 */
function SlotCard({
  slot,
  errors,
  onPatch,
  onRemove,
}: {
  slot: SlotConfig;
  errors: ReturnType<typeof validateSlots>["errors"][string] | undefined;
  onPatch: (patch: Partial<SlotConfig>) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const create = t.socialEvents.create;
  const kindLabels: Record<SlotKind, string> = {
    skill: create.slotKindSkill,
    duration: create.slotKindDuration,
    general: create.slotKindGeneral,
  };

  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-background px-2 py-0.5 font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {kindLabels[slot.kind]}
          </span>
        </div>
        <button
          type="button"
          aria-label={create.slotRemoveAria}
          className="rounded-md p-1 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`slot-label-${slot.id}`}>{create.slotLabel} *</Label>
          <Input
            id={`slot-label-${slot.id}`}
            value={slot.label}
            onChange={(e) => onPatch({ label: e.target.value })}
            placeholder={
              slot.kind === "skill"
                ? create.slotLabelPlaceholderSkill
                : slot.kind === "duration"
                  ? create.slotLabelPlaceholderDuration
                  : create.slotLabelPlaceholderGeneral
            }
            maxLength={80}
          />
          {errors?.label && (
            <p className="text-xs text-destructive">{errors.label}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor={`slot-capacity-${slot.id}`}>
            {create.slotCapacity} *
          </Label>
          <Input
            id={`slot-capacity-${slot.id}`}
            type="number"
            inputMode="numeric"
            min={1}
            max={200}
            value={slot.capacity}
            onChange={(e) => onPatch({ capacity: Number(e.target.value) })}
          />
          {errors?.capacity && (
            <p className="text-xs text-destructive">{errors.capacity}</p>
          )}
        </div>
      </div>

      {slot.kind === "skill" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`slot-skill-${slot.id}`}>{create.slotSkillLevel} *</Label>
            <select
              id={`slot-skill-${slot.id}`}
              value={slot.skill_level ?? ""}
              onChange={(e) => onPatch({ skill_level: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">{create.slotSkillChoose}</option>
              <option value="newbie">{create.slotSkillNewbie}</option>
              <option value="2.0">2.0</option>
              <option value="2.5">2.5</option>
              <option value="3.0">3.0</option>
              <option value="3.5">3.5</option>
              <option value="4.0">4.0</option>
              <option value="4.5">4.5</option>
              <option value="5.0+">5.0+</option>
            </select>
            {errors?.skill_level && (
              <p className="text-xs text-destructive">{errors.skill_level}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor={`slot-court-${slot.id}`}>{create.slotCourtCount}</Label>
            <Input
              id={`slot-court-${slot.id}`}
              type="number"
              inputMode="numeric"
              min={0}
              max={50}
              value={slot.court_count ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                onPatch({ court_count: v === "" ? null : Number(v) });
              }}
              placeholder="2"
            />
          </div>
        </div>
      )}

      {slot.kind === "duration" && (
        <div className="space-y-1">
          <Label htmlFor={`slot-duration-${slot.id}`}>
            {create.slotMinPlayMonths} *
          </Label>
          <select
            id={`slot-duration-${slot.id}`}
            value={slot.min_play_months ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onPatch({ min_play_months: v === "" ? null : Number(v) });
            }}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">{create.slotDurationChoose}</option>
            <option value="0">{create.slotDurationLT3}</option>
            <option value="3">{create.slotDuration3}</option>
            <option value="6">{create.slotDuration6}</option>
            <option value="12">{create.slotDuration12}</option>
            <option value="24">{create.slotDuration24}</option>
            <option value="36">{create.slotDuration36}</option>
          </select>
          {errors?.min_play_months && (
            <p className="text-xs text-destructive">{errors.min_play_months}</p>
          )}
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor={`slot-notes-${slot.id}`}>{create.slotNotes}</Label>
        <Textarea
          id={`slot-notes-${slot.id}`}
          rows={2}
          value={slot.notes ?? ""}
          maxLength={200}
          onChange={(e) => onPatch({ notes: e.target.value })}
          placeholder={create.slotNotesPlaceholder}
        />
      </div>
    </div>
  );
}

export function SlotManager({ slots, maxPlayers, onChange }: Props) {
  const { t } = useI18n();
  const create = t.socialEvents.create;
  const { errors, totalError } = validateSlots(slots, maxPlayers, t);

  function addSlot(kind: SlotKind) {
    onChange([...slots, makeEmptySlot(kind)]);
  }

  function patchSlot(id: string, patch: Partial<SlotConfig>) {
    onChange(slots.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeSlot(id: string) {
    onChange(slots.filter((s) => s.id !== id));
  }

  const totalCap = slots.reduce((acc, s) => acc + (Number(s.capacity) || 0), 0);

  return (
    <div className="space-y-3 rounded-md border border-dashed border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{create.slotsHeading}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {create.slotsSubheading}
          </p>
        </div>
        {slots.length > 0 && (
          <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
            {create.slotsTotalCapacity
              .replace("{total}", String(totalCap))
              .replace("{max}", String(maxPlayers))}
          </span>
        )}
      </div>

      {slots.length === 0 && (
        <p className="text-xs text-muted-foreground">{create.slotsEmptyHint}</p>
      )}

      {slots.map((slot) => (
        <SlotCard
          key={slot.id}
          slot={slot}
          errors={errors[slot.id]}
          onPatch={(patch) => patchSlot(slot.id, patch)}
          onRemove={() => removeSlot(slot.id)}
        />
      ))}

      {totalError && (
        <p className="text-xs text-destructive">{totalError}</p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => addSlot("skill")}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          <Plus className="h-3.5 w-3.5" /> {create.slotAddSkill}
        </button>
        <button
          type="button"
          onClick={() => addSlot("duration")}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          <Plus className="h-3.5 w-3.5" /> {create.slotAddDuration}
        </button>
        <button
          type="button"
          onClick={() => addSlot("general")}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          <Plus className="h-3.5 w-3.5" /> {create.slotAddGeneral}
        </button>
      </div>
    </div>
  );
}
