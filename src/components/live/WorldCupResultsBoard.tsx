// ============================================================================
// WorldCupResultsBoard — the live results table embedded in the World Cup 2026
// results article, on both language twins.
//
// The article's prose is static; this is the part that has to be current. Bots
// get the same tables server-rendered by functions/_lib/render/wc-results.ts —
// keep the two in step: a fact visible here and absent there is a page that
// tells Google less than it tells a reader.
//
// Scores are the last value the scraper observed before the match left the
// organizers' live feed, not an official final (see the wc_pro_matches
// migration header). The column is labelled "ghi nhận" / "as recorded" and the
// footnote says so, because a wrong champion name is the one error on a results
// page that gets screenshotted.
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

/** The side the source last had in front. Never inferred from the score: a
 *  frozen last-observed game can read behind for the eventual winner. */
function recordedWinner(m: WcProMatchRow): string {
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
            <th>{vi ? "Tỉ số ghi nhận" : "Score as recorded"}</th>
            <th>{vi ? "Dẫn/thắng" : "Ahead / won"}</th>
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
              <td>{recordedWinner(m) || dash}</td>
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
          ? "Không tải được bảng kết quả trực tiếp lúc này. Phần lịch và bối cảnh phía trên vẫn đúng."
          : "The live results table could not be loaded right now. The schedule and context above are unaffected."}
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

  return (
    <div className="wc-results-block">
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
          ? `Tổng cộng ${data.completedCount} trận Pro đã ghi nhận kết quả, trong đó ${data.vietnamCount} trận có vận động viên Việt Nam. Tỉ số là giá trị cuối cùng ThePickleHub ghi nhận được từ hệ thống của ban tổ chức trước khi trận rời khỏi bảng trực tiếp — không phải kết quả chính thức, và cột cuối là bên đang dẫn ở thời điểm đó.`
          : `${data.completedCount} Pro matches have a recorded result, ${data.vietnamCount} of them involving a Vietnamese player. Scores are the last value ThePickleHub observed in the organisers' live feed before the match left it — not an official final — and the last column is the side ahead at that moment.`}
      </p>
    </div>
  );
}

export default WorldCupResultsBoard;
