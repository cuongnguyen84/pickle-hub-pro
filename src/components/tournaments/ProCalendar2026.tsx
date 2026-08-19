/**
 * Pro tournament calendar 2026 — Vietnam & Asia (curated, bilingual).
 *
 * SEO section on /tournaments (+ /vi/tournaments): renders the curated
 * PRO_CALENDAR_2026 season table with live/upcoming/past status and deep-links
 * to our event previews/recaps. Data + helpers live in
 * src/content/tournaments/pro-calendar-2026.ts (shared with the SSR bot path).
 */

import { Link } from "react-router-dom";
import {
  PRO_CALENDAR_2026,
  proCalendarDateRange,
  proCalendarStatus,
  vnTodayIso,
  type ProCalendarStatus,
} from "@/content/tournaments/pro-calendar-2026";

const STATUS_COPY: Record<ProCalendarStatus, { en: string; vi: string; cls: string }> = {
  live: { en: "Live", vi: "Đang diễn ra", cls: "active" },
  upcoming: { en: "Upcoming", vi: "Sắp diễn ra", cls: "registration" },
  past: { en: "Finished", vi: "Đã xong", cls: "completed" },
};

export default function ProCalendar2026({ vi }: { vi: boolean }) {
  // VN-local "today" — the calendar dates are VN calendar dates, and a UTC
  // "today" ran a day behind every morning before 07:00 ICT.
  const todayIso = vnTodayIso();

  return (
    <section aria-labelledby="pro-calendar-2026" style={{ margin: "32px 0" }}>
      <h2 id="pro-calendar-2026" style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>
        {vi ? "Lịch giải Pickleball 2026 — Việt Nam & châu Á" : "2026 Tournament Calendar — Vietnam & Asia"}
      </h2>
      <p style={{ margin: "0 0 16px", color: "var(--tl-muted, #6b7280)", fontSize: 14 }}>
        {vi
          ? "Mùa giải PPA Tour Asia 2026 và Heineken Pickleball World Cup Đà Nẵng — cập nhật khi có lịch chính thức."
          : "The 2026 PPA Tour Asia season plus the Heineken Pickleball World Cup in Da Nang — updated as official schedules land."}
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--tl-border, #e5e7eb)" }}>
              <th style={{ padding: "8px 12px" }}>{vi ? "Thời gian" : "Dates"}</th>
              <th style={{ padding: "8px 12px" }}>{vi ? "Giải đấu" : "Tournament"}</th>
              <th style={{ padding: "8px 12px" }}>{vi ? "Địa điểm" : "Location"}</th>
              <th style={{ padding: "8px 12px" }}>{vi ? "Cấp / thưởng" : "Tier / prize"}</th>
              <th style={{ padding: "8px 12px" }}>{vi ? "Trạng thái" : "Status"}</th>
            </tr>
          </thead>
          <tbody>
            {PRO_CALENDAR_2026.map((ev) => {
              const status = proCalendarStatus(ev, todayIso);
              const sc = STATUS_COPY[status];
              const blog = vi ? ev.blogVi : ev.blogEn;
              const prize = vi ? ev.prizeVi : ev.prizeEn;
              return (
                <tr key={ev.id} style={{ borderBottom: "1px solid var(--tl-border, #e5e7eb)" }}>
                  <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{proCalendarDateRange(ev)}</td>
                  <td style={{ padding: "8px 12px", fontWeight: 600 }}>
                    {blog ? <Link to={blog}>{vi ? ev.nameVi : ev.nameEn}</Link> : (vi ? ev.nameVi : ev.nameEn)}
                  </td>
                  <td style={{ padding: "8px 12px" }}>{vi ? ev.placeVi : ev.placeEn}</td>
                  <td style={{ padding: "8px 12px" }}>
                    {ev.tier}
                    {prize ? ` · ${prize}` : ""}
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <span className={`tl-br-status ${sc.cls}`}>{vi ? sc.vi : sc.en}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ margin: "12px 0 0", fontSize: 13 }}>
        {vi ? (
          <>
            Chi tiết từng chặng: <Link to="/vi/blog/ppa-tour-asia-2026-lich-thi-dau-tien-thuong">lịch PPA Tour Asia & tiền thưởng</Link>
            {" · "}
            <Link to="/vi/blog/cam-nang-xem-pickleball-world-cup-2026-da-nang">cẩm nang xem World Cup Đà Nẵng</Link>
          </>
        ) : (
          <>
            Deep dives: <Link to="/blog/ppa-tour-asia-2026-complete-guide">PPA Tour Asia 2026 guide</Link>
            {" · "}
            <Link to="/blog/pickleball-world-cup-2026-da-nang-how-to-watch">how to watch the World Cup in Da Nang</Link>
          </>
        )}
      </p>
    </section>
  );
}
