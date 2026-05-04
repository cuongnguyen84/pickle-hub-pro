// ============================================================================
// VenuePicker — Sprint 2 Phase 3A.2 wizard step 1
// ----------------------------------------------------------------------------
// Sections:
//   1. Sân gần bạn  (geolocation-based, ~5km bbox)
//   2. Sân hay chơi (user's last 3 venues)
//   3. Search results (debounced typeahead)
//   "+ Thêm sân mới" → CreateVenueModal
// ============================================================================

import { useState } from "react";
import { Search, MapPin, Plus, Check, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useNearbyVenues,
  useRecentVenues,
  useSearchVenues,
  type Venue,
} from "@/hooks/social";
import CreateVenueModal from "./CreateVenueModal";

interface VenuePickerProps {
  selectedId: string | null;
  selectedVenue: Venue | null;
  onSelect: (venue: Venue | null) => void;
  /** Free-text override when user can't find their venue. */
  venueNameOverride: string;
  onOverrideChange: (next: string) => void;
}

const VenueRow = ({
  venue,
  active,
  onClick,
}: {
  venue: Venue;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors min-h-[60px]",
      active
        ? "border-social-primary bg-social-primary/5"
        : "border-border bg-card hover:bg-accent",
    )}
    aria-pressed={active}
  >
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
        active ? "bg-social-primary text-white" : "bg-muted text-muted-foreground",
      )}
    >
      <MapPin className="h-4 w-4" />
    </div>
    <div className="min-w-0 flex-1">
      <div className="truncate font-medium">{venue.name_vi || venue.name}</div>
      <div className="truncate text-xs text-muted-foreground">
        {[venue.district, venue.city].filter(Boolean).join(" · ")}
      </div>
    </div>
    {active && <Check className="h-4 w-4 shrink-0 text-social-primary" />}
  </button>
);

const Section = ({
  title,
  children,
  emptyText,
  loading,
}: {
  title: string;
  children: React.ReactNode;
  emptyText?: string;
  loading?: boolean;
}) => (
  <div>
    <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {title}
    </div>
    {loading ? (
      <div className="space-y-2">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    ) : children ? (
      <div className="space-y-2">{children}</div>
    ) : (
      <div className="rounded-xl border border-dashed p-3 text-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    )}
  </div>
);

export const VenuePicker = ({
  selectedId,
  selectedVenue,
  onSelect,
  venueNameOverride,
  onOverrideChange,
}: VenuePickerProps) => {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const { geo, venues: nearby, isLoading: nearbyLoading } = useNearbyVenues();
  const { venues: recent, isLoading: recentLoading } = useRecentVenues();
  const { venues: searchResults, isLoading: searchLoading } = useSearchVenues(search);

  const showSearch = search.trim().length >= 2;

  return (
    <div className="space-y-5">
      {/* ─── Search bar ────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm sân theo tên hoặc thành phố..."
          className="h-12 pl-10"
          aria-label="Tìm sân"
        />
      </div>

      {/* ─── Geo permission notice ─────────────────────────────────────── */}
      {geo.status === "denied" && !showSearch && (
        <div className="flex items-start gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-900 dark:text-yellow-200">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Đã từ chối quyền vị trí. Bạn vẫn có thể tìm sân thủ công hoặc thêm sân mới.
          </span>
        </div>
      )}

      {/* ─── Search results (when typing) ──────────────────────────────── */}
      {showSearch && (
        <Section
          title="Kết quả tìm kiếm"
          loading={searchLoading}
          emptyText="Không tìm thấy. Thử thêm sân mới bên dưới."
        >
          {searchResults && searchResults.length > 0
            ? searchResults.map((v) => (
                <VenueRow
                  key={v.id}
                  venue={v}
                  active={selectedId === v.id}
                  onClick={() => onSelect(v)}
                />
              ))
            : null}
        </Section>
      )}

      {/* ─── Nearby + recent (when not searching) ─────────────────────── */}
      {!showSearch && (
        <>
          <Section
            title="Sân gần bạn"
            loading={nearbyLoading && geo.status !== "denied"}
            emptyText={
              geo.status === "denied"
                ? "Cần quyền vị trí để gợi ý sân gần"
                : "Chưa có sân trong bán kính 5km"
            }
          >
            {nearby && nearby.length > 0
              ? nearby.map((v) => (
                  <VenueRow
                    key={v.id}
                    venue={v}
                    active={selectedId === v.id}
                    onClick={() => onSelect(v)}
                  />
                ))
              : null}
          </Section>

          <Section
            title="Sân hay chơi"
            loading={recentLoading}
            emptyText="Bạn chưa log trận nào. Sân sẽ xuất hiện ở đây sau."
          >
            {recent && recent.length > 0
              ? recent.map((v) => (
                  <VenueRow
                    key={v.id}
                    venue={v}
                    active={selectedId === v.id}
                    onClick={() => onSelect(v)}
                  />
                ))
              : null}
          </Section>
        </>
      )}

      {/* ─── Add new venue ─────────────────────────────────────────────── */}
      <Button
        type="button"
        variant="outline"
        onClick={() => setCreateOpen(true)}
        className="w-full justify-start gap-2"
      >
        <Plus className="h-4 w-4" />
        Thêm sân mới
      </Button>

      {/* ─── Override fallback ─────────────────────────────────────────── */}
      <div>
        <div className="mb-1 px-1 text-xs font-medium text-muted-foreground">
          Hoặc nhập tên sân tự do (nếu sân không có trong danh sách)
        </div>
        <Input
          value={venueNameOverride}
          onChange={(e) => onOverrideChange(e.target.value)}
          placeholder="VD: Sân khu nhà mình"
          className="h-11"
          maxLength={100}
        />
      </div>

      {/* ─── Selected indicator ────────────────────────────────────────── */}
      {selectedVenue && (
        <div className="rounded-xl border-2 border-social-primary bg-social-primary/5 p-3 text-sm">
          <div className="text-xs font-medium uppercase text-social-primary">Đã chọn</div>
          <div className="font-semibold">{selectedVenue.name_vi || selectedVenue.name}</div>
          <div className="text-xs text-muted-foreground">
            {[selectedVenue.district, selectedVenue.city].filter(Boolean).join(" · ")}
          </div>
        </div>
      )}

      <CreateVenueModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(v) => onSelect(v)}
      />
    </div>
  );
};

export default VenuePicker;
