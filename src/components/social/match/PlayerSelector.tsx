// ============================================================================
// PlayerSelector — Sprint 2 Phase 3A.3 wizard step 3
// ----------------------------------------------------------------------------
// Slot-based team builder. Singles=2 slots (A1/B1), doubles/mixed=4 slots
// (A1/A2/B1/B2). Tap a player from search/recent → fills first empty slot.
// Tap a filled slot → popover to change position or remove.
//
// "+ Mời SĐT" → CreateGhostProfileModal for inviting non-account players.
// Creator (current user) auto-assigned to A1 on first render.
// ============================================================================

import { useEffect, useState, useMemo } from "react";
import { Search, Plus, X, UserPlus, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  useRecentPartners,
  useSearchPlayers,
  type PlayerProfile,
} from "@/hooks/social";
import { useAuth } from "@/hooks/useAuth";
import CreateGhostProfileModal from "./CreateGhostProfileModal";

export type Team = "a" | "b";
export type Position = 1 | 2;

export interface ParticipantSlot {
  player_id: string;
  team: Team;
  position: Position;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  is_ghost: boolean;
}

interface PlayerSelectorProps {
  format: "singles" | "doubles" | "mixed";
  participants: ParticipantSlot[];
  onChange: (next: ParticipantSlot[]) => void;
}

type SlotMap = Record<
  PlayerSelectorProps["format"],
  Array<{ team: Team; position: Position; label: string }>
>;
const slotsForFormat = (language: "vi" | "en"): SlotMap => ({
  singles: [
    { team: "a", position: 1, label: language === "vi" ? "Đội A" : "Team A" },
    { team: "b", position: 1, label: language === "vi" ? "Đội B" : "Team B" },
  ],
  doubles: [
    { team: "a", position: 1, label: "A1" },
    { team: "a", position: 2, label: "A2" },
    { team: "b", position: 1, label: "B1" },
    { team: "b", position: 2, label: "B2" },
  ],
  mixed: [
    { team: "a", position: 1, label: "A1" },
    { team: "a", position: 2, label: "A2" },
    { team: "b", position: 1, label: "B1" },
    { team: "b", position: 2, label: "B2" },
  ],
});

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

const SlotCard = ({
  slot,
  participant,
  onRemove,
  onMoveTo,
  availableSlots,
}: {
  slot: { team: Team; position: Position; label: string };
  participant?: ParticipantSlot;
  onRemove: () => void;
  onMoveTo: (team: Team, position: Position) => void;
  availableSlots: Array<{ team: Team; position: Position; label: string }>;
}) => {
  const { language } = useI18n();
  const isTeamA = slot.team === "a";
  if (!participant) {
    return (
      <div
        className={cn(
          "flex h-16 items-center justify-center rounded-xl border-2 border-dashed text-xs",
          isTeamA ? "border-social-primary/40 text-social-primary" : "border-border text-muted-foreground",
        )}
      >
        {slot.label}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex h-16 items-center gap-2 rounded-xl border-2 p-2",
        isTeamA ? "border-social-primary bg-social-primary/5" : "border-border bg-card",
      )}
    >
      <Avatar className="h-10 w-10">
        <AvatarImage src={participant.avatar_url ?? undefined} alt={participant.display_name} />
        <AvatarFallback>{initials(participant.display_name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <Badge
            variant={isTeamA ? "default" : "secondary"}
            className={cn(
              "shrink-0 px-1.5 py-0 text-[10px]",
              isTeamA && "bg-social-primary text-white",
            )}
          >
            {slot.label}
          </Badge>
          {participant.is_ghost && (
            <Badge variant="outline" className="shrink-0 px-1 py-0 text-[10px]">
              ghost
            </Badge>
          )}
        </div>
        <div className="truncate text-sm font-medium">{participant.display_name}</div>
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={language === "vi" ? "Tùy chọn" : "Options"}
          >
            <X className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-44 p-1">
          <div className="space-y-1">
            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
              {language === "vi" ? "Chuyển đến" : "Move to"}
            </div>
            {availableSlots
              .filter((s) => !(s.team === slot.team && s.position === slot.position))
              .map((s) => (
                <button
                  key={`${s.team}${s.position}`}
                  type="button"
                  onClick={() => onMoveTo(s.team, s.position)}
                  className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  {s.label}
                </button>
              ))}
            <button
              type="button"
              onClick={onRemove}
              className="w-full rounded-md px-2 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10"
            >
              {language === "vi" ? "Bỏ chọn" : "Remove"}
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

const PlayerRow = ({
  player,
  onPick,
  alreadyChosen,
}: {
  player: PlayerProfile;
  onPick: () => void;
  alreadyChosen: boolean;
}) => {
  const { language } = useI18n();
  return (
  <button
    type="button"
    onClick={onPick}
    disabled={alreadyChosen}
    className={cn(
      "flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors",
      "min-h-[56px]",
      alreadyChosen
        ? "border-border bg-muted/40 opacity-50"
        : "border-border bg-card hover:bg-accent",
    )}
  >
    <Avatar className="h-9 w-9">
      <AvatarImage src={player.avatar_url ?? undefined} alt={player.display_name ?? player.username ?? ""} />
      <AvatarFallback>
        {initials(player.display_name ?? player.username ?? "??")}
      </AvatarFallback>
    </Avatar>
    <div className="min-w-0 flex-1">
      <div className="truncate text-sm font-medium">
        {player.display_name ?? player.username ?? "?"}
      </div>
      <div className="truncate text-xs text-muted-foreground">
        @{player.username ?? "—"}
        {player.dupr_doubles && ` · DUPR ${player.dupr_doubles}`}
      </div>
    </div>
    {alreadyChosen && (
      <Badge variant="outline" className="shrink-0 text-[10px]">
        {language === "vi" ? "Đã chọn" : "Selected"}
      </Badge>
    )}
  </button>
  );
};

export const PlayerSelector = ({ format, participants, onChange }: PlayerSelectorProps) => {
  const { language } = useI18n();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [ghostCount, setGhostCount] = useState(0);

  const slots = slotsForFormat(language)[format];
  const { partners, isLoading: partnersLoading } = useRecentPartners();
  const { players: searchResults, isLoading: searchLoading } = useSearchPlayers(search);

  // Auto-assign current user → A1 on first mount if no participants
  useEffect(() => {
    if (participants.length === 0 && user) {
      const meta = (user.user_metadata ?? {}) as { display_name?: string; username?: string; avatar_url?: string };
      onChange([{
        player_id: user.id,
        team: "a",
        position: 1,
        display_name: meta.display_name ?? user.email?.split("@")[0] ?? "Bạn",
        username: meta.username ?? null,
        avatar_url: meta.avatar_url ?? null,
        is_ghost: false,
      }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const slotMap = useMemo(() => {
    const m = new Map<string, ParticipantSlot>();
    for (const p of participants) m.set(`${p.team}${p.position}`, p);
    return m;
  }, [participants]);

  const chosenIds = useMemo(() => new Set(participants.map((p) => p.player_id)), [participants]);

  const firstEmptySlot = () =>
    slots.find((s) => !slotMap.has(`${s.team}${s.position}`));

  const addPlayer = (player: PlayerProfile) => {
    if (chosenIds.has(player.id)) return;
    const slot = firstEmptySlot();
    if (!slot) return; // all full
    onChange([
      ...participants,
      {
        player_id: player.id,
        team: slot.team,
        position: slot.position,
        display_name: player.display_name ?? player.username ?? "?",
        username: player.username,
        avatar_url: player.avatar_url,
        is_ghost: !!player.is_ghost,
      },
    ]);
  };

  const removeAt = (team: Team, position: Position) => {
    onChange(participants.filter((p) => !(p.team === team && p.position === position)));
  };

  const moveTo = (fromTeam: Team, fromPos: Position, toTeam: Team, toPos: Position) => {
    const fromKey = `${fromTeam}${fromPos}`;
    const toKey = `${toTeam}${toPos}`;
    const fromP = slotMap.get(fromKey);
    if (!fromP) return;
    const toP = slotMap.get(toKey);
    const next = participants.filter((p) =>
      !(p.team === fromTeam && p.position === fromPos) &&
      !(p.team === toTeam && p.position === toPos),
    );
    next.push({ ...fromP, team: toTeam, position: toPos });
    if (toP) next.push({ ...toP, team: fromTeam, position: fromPos });
    onChange(next);
  };

  return (
    <div className="space-y-5">
      {/* ─── Team slots ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="rounded-2xl border-2 border-social-primary/30 bg-social-primary/5 p-3">
          <div className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase text-social-primary">
            <Users className="h-3.5 w-3.5" /> {language === "vi" ? "Đội A" : "Team A"}
          </div>
          <div className="space-y-2">
            {slots.filter((s) => s.team === "a").map((s) => (
              <SlotCard
                key={`a${s.position}`}
                slot={s}
                participant={slotMap.get(`a${s.position}`)}
                onRemove={() => removeAt(s.team, s.position)}
                onMoveTo={(t, p) => moveTo(s.team, s.position, t, p)}
                availableSlots={slots}
              />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border bg-muted/30 p-3">
          <div className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> {language === "vi" ? "Đội B" : "Team B"}
          </div>
          <div className="space-y-2">
            {slots.filter((s) => s.team === "b").map((s) => (
              <SlotCard
                key={`b${s.position}`}
                slot={s}
                participant={slotMap.get(`b${s.position}`)}
                onRemove={() => removeAt(s.team, s.position)}
                onMoveTo={(t, p) => moveTo(s.team, s.position, t, p)}
                availableSlots={slots}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ─── Search ───────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            language === "vi"
              ? "Tìm theo tên, username hoặc SĐT..."
              : "Search by name, username or phone..."
          }
          className="h-12 pl-10"
        />
      </div>

      {/* ─── Search results ───────────────────────────────────────────── */}
      {search.trim().length >= 2 && (
        <div>
          <div className="mb-2 px-1 text-xs font-semibold uppercase text-muted-foreground">
            {language === "vi" ? "Kết quả" : "Results"}
          </div>
          {searchLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          ) : searchResults && searchResults.length > 0 ? (
            <div className="space-y-2">
              {searchResults.map((p) => (
                <PlayerRow
                  key={p.id}
                  player={p}
                  onPick={() => addPlayer(p)}
                  alreadyChosen={chosenIds.has(p.id)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-3 text-center text-sm text-muted-foreground">
              {language === "vi"
                ? "Không tìm thấy. Mời người chơi mới bằng SĐT."
                : "No matches. Invite a new player by phone number."}
            </div>
          )}
        </div>
      )}

      {/* ─── Recent partners (when not searching) ─────────────────────── */}
      {search.trim().length < 2 && (
        <div>
          <div className="mb-2 px-1 text-xs font-semibold uppercase text-muted-foreground">
            {language === "vi" ? "Người chơi gần đây" : "Recent players"}
          </div>
          {partnersLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          ) : partners && partners.length > 0 ? (
            <div className="space-y-2">
              {partners.slice(0, 8).map((p) => (
                <PlayerRow
                  key={p.id}
                  player={p}
                  onPick={() => addPlayer(p)}
                  alreadyChosen={chosenIds.has(p.id)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-3 text-center text-sm text-muted-foreground">
              {language === "vi"
                ? "Bạn chưa có lịch sử trận. Search hoặc mời người mới."
                : "No match history yet. Search or invite a new player."}
            </div>
          )}
        </div>
      )}

      {/* ─── Invite ghost ─────────────────────────────────────────────── */}
      <Button
        type="button"
        variant="outline"
        onClick={() => setCreateOpen(true)}
        className="w-full justify-start gap-2"
      >
        <UserPlus className="h-4 w-4" />
        {language === "vi"
          ? "Mời SĐT (người chơi chưa có tài khoản)"
          : "Invite by phone (players without an account)"}
      </Button>

      <CreateGhostProfileModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        ghostCount={ghostCount}
        onCreated={(p) => {
          setGhostCount((c) => c + 1);
          addPlayer(p);
        }}
      />

      {/* ─── Validation hint ─────────────────────────────────────────── */}
      <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
        {language === "vi"
          ? `Cần đủ ${format === "singles" ? 2 : 4} người chơi.`
          : `Need ${format === "singles" ? 2 : 4} players.`}{" "}
        {language === "vi" ? "Hiện tại" : "Current"}: {participants.length}/
        {format === "singles" ? 2 : 4}
      </div>
    </div>
  );
};

export default PlayerSelector;
