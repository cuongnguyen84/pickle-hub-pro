// ============================================================================
// WorldCupResultsBoard — the live results table inside the World Cup 2026
// results article, on both language twins.
//
// The article's prose is static; this is the part that has to be current. Bots
// get the same tables server-rendered by functions/_lib/render/wc-results.ts —
// keep the two in step.
//
// The dateline is generated from the feed rather than written into the prose. A
// "cập nhật liên tục" claim carrying a hand-typed date is a promise nobody can
// check, and it is the first line an AI answer quotes back when it cites this
// page.
// ============================================================================

import { useWcResults } from "@/hooks/useWcResults";
import type { WcProMatchRow } from "@/hooks/useWcProLive";
import { scoreLine } from "@/components/live/wc-score";

type Lang = "en" | "vi";

const EVENT_LABEL: Record<string, { en: string; vi: string }> = {
  pro_singles_mens: { en: "Men's Pro Singles", vi: "Đơn Pro nam" },
  pro_singles_womens: { en: "Women's Pro Singles", vi: "Đơn Pro nữ" },
  pro_doubles_mens: { en: "Men's Pro Doubles", vi: "Đôi Pro nam" },
  pro_doubles_womens: { en: "Women's Pro Doubles", vi: "Đôi Pro nữ" },
  pro_mixed: { en: "Mixed Pro Doubles", vi: "Đôi Pro nam nữ" },
};

function dayHeading(day: string, lang: Lang): string {
  const [y, m, d] = day.split("-");
  if (!y) return lang === "vi" ? "Chưa xác định ngày" : "Date unknown";
  return lang === "vi" ? `Ngày ${Number(d)}/${Number(m)}/${y}` : `${y}-${m}-${d}`;
}

/** "17:42 · 31/8/2026" in Vietnam time, from a UTC instant. */
export function vnStamp(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const d = new Date(t + 7 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())} · ${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`;
}

/** The winner the bracket declares. Never inferred from the score: a stopgap
 *  row's last observed game can read behind for the side that went on to win. */
function winnerName(m: WcProMatchRow): string {
  if (m.leader_side === "A") return m.entry_a_name ?? "";
  if (m.leader_side === "B") return m.entry_b_name ?? "";
  return "";
}

function MatchTable({ rows, lang }: { rows: WcProMatchRow[]; lang: Lang }) {
  const vi = lang === "vi";
  const dash = vi ? "chưa có" : "not recorded";
  return (
    <div style={{ overflowX: "auto" }}>
      <table>
        <thead>
          <tr>
            <th>{vi ? "Nội dung" : "Event"}</th>
            <th>{vi ? "Vòng" : "Round"}</th>
            <th>{vi ? "Cặp đấu" : "Match"}</th>
            <th>{vi ? "Tỉ số" : "Score"}</th>
            <th>{vi ? "Thắng" : "Winner"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.match_id}>
              <td>{EVENT_LABEL[m.category_id]?.[lang] ?? m.category_id}</td>
              <td>{m.round_name ?? ""}</td>
              <td>
                {m.entry_a_name ?? ""} — {m.entry_b_name ?? ""}
                {m.is_vietnam && <span aria-hidden="true"> 🇻🇳</span>}
              </td>
              <td>{scoreLine(m) || dash}</td>
              <td>{winnerName(m) || dash}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WorldCupResultsBoard({ language }: { language: Lang }) {
  const { data, isLoading, isError } = useWcResults();
  const vi = language === "vi";

  // An outage renders an honest line, never an empty table: "no results" and
  // "we could not ask" are different statements and the reader is owed the
  // difference (the same DS-04 rule the /live page follows).
  if (isError) {
    return (
      <p>
        {vi
          ? "Không tải được bảng kết quả trực tiếp lúc này. Phần lịch và bối cảnh phía dưới vẫn đúng."
          : "The live results table could not be loaded right now. The schedule and context below are unaffected."}
      </p>
    );
  }
  if (isLoading) {
    return <p>{vi ? "Đang tải kết quả…" : "Loading results…"}</p>;
  }
  if (!data || (data.live.length === 0 && data.days.length === 0)) {
    return (
      <p>
        {vi
          ? "Chưa có trận Pro nào được ghi nhận. Bảng này tự cập nhật khi các nội dung Pro vào cuộc."
          : "No Pro match has been recorded yet. This table fills in as the Pro events get under way."}
      </p>
    );
  }

  const stamp = vnStamp(data.dataUpdatedAt);

  return (
    <div className="wc-results-block">
      {stamp && (
        <p>
          {vi
            ? `Cập nhật lần cuối: ${stamp} (giờ Việt Nam). ${data.completedCount} trận đã có kết quả, ${data.live.length} trận đang thi đấu.`
            : `Last updated ${stamp} Vietnam time. ${data.completedCount} matches have a result, ${data.live.length} on court now.`}
        </p>
      )}

      {data.live.length > 0 && (
        <>
          <h3>{vi ? "Đang thi đấu" : "On court now"}</h3>
          <MatchTable rows={data.live} lang={language} />
        </>
      )}

      {data.days.map((d) => (
        <div key={d.day || "unknown"}>
          <h3>{dayHeading(d.day, language)}</h3>
          <MatchTable rows={d.matches} lang={language} />
        </div>
      ))}

      <p>
        {vi
          ? "Bảng này gồm mọi trận Pro đang thi đấu và mọi trận Pro có vận động viên Việt Nam, không phải toàn bộ 33 nội dung cá nhân. Tỉ số các trận đã kết thúc lấy từ trang nhánh đấu chính thức của giải, kèm người thắng do nhánh đấu công bố. Một trận Việt Nam vừa rời bảng trực tiếp mà nhánh đấu chưa cập nhật sẽ tạm hiển thị tỉ số ThePickleHub ghi nhận cuối cùng, và được thay bằng kết quả chính thức ở lượt quét sau."
          : "This table covers every Pro match on court now plus every Pro match involving a Vietnamese player — not all 33 individual events. Completed scores come from the tournament's own bracket pages, with the winner the bracket declares. A Vietnamese match that has just left the live feed before its bracket syncs shows the last score ThePickleHub observed, replaced by the official result on the next pass."}
      </p>
    </div>
  );
}

export default WorldCupResultsBoard;
