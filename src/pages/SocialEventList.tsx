// ============================================================================
// SocialEventList (`/social`) — public collection of upcoming social events.
// ----------------------------------------------------------------------------
// Mobile-first card grid. Public RLS surfaces only published+public events.
// Page lives under the TheLine "events" nav slot so the top-of-page header
// matches Tournaments / Feed / Rankings in shape.
// ============================================================================

import { Link } from "react-router-dom";
import { Loader2, MapPin, Calendar, Users, Banknote, LayoutGrid } from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { useUpcomingSocialEvents, type UpcomingEventRow } from "@/hooks/useUpcomingSocialEvents";
import { formatEventDateRange, interp } from "@/lib/social-events/format";

function EventCard({ event, lang }: { event: UpcomingEventRow; lang: "vi" | "en" }) {
  const title =
    lang === "vi"
      ? event.title_vi
      : (event.title_en && event.title_en.trim().length > 0 ? event.title_en : event.title_vi);
  const remaining = Math.max(0, event.max_players - event.registered_count);
  const priceLabel =
    event.price_vnd > 0
      ? `${event.price_vnd.toLocaleString(lang === "vi" ? "vi-VN" : "en-US")}₫`
      : (lang === "vi" ? "Miễn phí" : "Free");

  return (
    <Link
      to={`/social/${event.slug}`}
      className="tl-card-link"
      style={{
        display: "block",
        padding: 20,
        background: "var(--tl-surface)",
        border: "1px solid var(--tl-border)",
        borderRadius: 14,
        textDecoration: "none",
        color: "inherit",
        transition: "border-color 120ms ease, transform 120ms ease",
      }}
    >
      {event.club && (
        <div
          style={{
            fontSize: 11,
            letterSpacing: 1.1,
            textTransform: "uppercase",
            color: "var(--tl-fg-3)",
            marginBottom: 8,
            fontFamily: "var(--tl-mono, monospace)",
          }}
        >
          ◆ {event.club.name}
        </div>
      )}
      <h3 style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.25, marginBottom: 12 }}>{title}</h3>
      <div style={{ display: "grid", gap: 6, fontSize: 13.5, color: "var(--tl-fg-2)" }}>
        <span><Calendar className="inline h-3.5 w-3.5" style={{ marginRight: 4 }} />{formatEventDateRange(event.start_at, event.end_at, lang)}</span>
        {event.location_text && (
          <span><MapPin className="inline h-3.5 w-3.5" style={{ marginRight: 4 }} />{event.location_text}</span>
        )}
        <span><Users className="inline h-3.5 w-3.5" style={{ marginRight: 4 }} />{event.registered_count}/{event.max_players}{remaining > 0 && remaining <= 4 ? ` · ${lang === "vi" ? "còn ít chỗ" : "few spots"}` : ""}</span>
        <span><LayoutGrid className="inline h-3.5 w-3.5" style={{ marginRight: 4 }} />{event.court_count} {lang === "vi" ? `sân${event.court_count > 1 ? "" : ""}` : `court${event.court_count > 1 ? "s" : ""}`}</span>
        <span><Banknote className="inline h-3.5 w-3.5" style={{ marginRight: 4 }} />{priceLabel}</span>
      </div>
    </Link>
  );
}

export default function SocialEventList() {
  const { t, language } = useI18n();
  const { data, isLoading } = useUpcomingSocialEvents(30);

  const events = data ?? [];

  return (
    <TheLineLayout
      title={language === "vi" ? "Sự kiện CLB pickleball" : "Pickleball club events"}
      description={
        language === "vi"
          ? "Lịch sự kiện pickleball cộng đồng tại Việt Nam — open play, giao lưu, giải mini. Đăng ký bằng số điện thoại trong 30 giây."
          : "Upcoming community pickleball events across Vietnam — open play, casual meetups, mini-tournaments. Phone-OTP registration in 30 seconds."
      }
      active="events"
    >
      <div className="tl-shell" style={{ paddingBottom: 60 }}>
        <header className="tl-page-head">
          <div className="kicker">
            ◆ {language === "vi" ? "Cộng đồng pickleball Việt Nam" : "VN pickleball community"}
          </div>
          <h1>
            {language === "vi" ? (
              <>
                Sự kiện <em className="tl-serif">CLB</em>{" "}
                <span className="dim">— mở đăng ký</span>
              </>
            ) : (
              <>
                Club events <em className="tl-serif">open</em>{" "}
                <span className="dim">for sign-up</span>
              </>
            )}
          </h1>
          <p>
            {language === "vi"
              ? "Open play, giao lưu, giải mini do CLB tổ chức. Đăng ký bằng số điện thoại, không cần tạo tài khoản."
              : "Open play, casual meetups, and mini-tournaments hosted by VN clubs. Phone-OTP registration, no account required."}
          </p>
        </header>

        {isLoading ? (
          <div style={{ padding: 60, textAlign: "center" }}>
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : events.length === 0 ? (
          <div
            style={{
              padding: 60,
              textAlign: "center",
              border: "1px dashed var(--tl-border)",
              borderRadius: 14,
              color: "var(--tl-fg-3)",
            }}
          >
            <p style={{ fontSize: 16, marginBottom: 8 }}>
              {language === "vi"
                ? "Chưa có sự kiện công khai nào sắp diễn ra."
                : "No upcoming public events yet."}
            </p>
            <p style={{ fontSize: 13.5 }}>
              {language === "vi"
                ? "CLB của bạn muốn đăng sự kiện? Đăng nhập và tạo CLB từ trang quản lý."
                : "Want to host an event? Log in and set up your club."}
            </p>
            <div style={{ marginTop: 16 }}>
              <Button asChild variant="outline">
                <Link to={language === "vi" ? "/vi" : "/"}>
                  {language === "vi" ? "Về trang chủ" : "Back to home"}
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
              padding: "16px 0 32px",
            }}
          >
            {events.map((ev) => (
              <EventCard key={ev.id} event={ev} lang={language} />
            ))}
          </div>
        )}

        <p
          style={{
            marginTop: 12,
            fontSize: 13,
            color: "var(--tl-fg-3)",
            textAlign: "center",
          }}
        >
          {interp(
            language === "vi"
              ? "{n} sự kiện sắp diễn ra"
              : "{n} upcoming events",
            { n: events.length },
          )}
        </p>
      </div>
    </TheLineLayout>
  );
}
