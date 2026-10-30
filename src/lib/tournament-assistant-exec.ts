/**
 * Thực thi thẻ hành động của trợ lý nổi SAU khi người dùng bấm Xác nhận.
 *
 * Mỗi hành động đi đúng đường UI trang giải đang dùng (useQuickTable +
 * useQuickTableMutations, RPC setup_quick_table_roster_atomic) — RLS/RPC kiểm
 * chủ giải lần nữa ở server. Hành động nhiều bước báo rõ bước nào xong, bước
 * nào chưa (luật 5 của brief), không báo "xong" khi mới xong một nửa.
 */
import { supabase } from "@/integrations/supabase/client";
import { distributePlayersToGroups } from "@/lib/quick-table-utils";
import type { useQuickTable } from "@/hooks/useQuickTable";

export type ExecDeps = Pick<
  ReturnType<typeof useQuickTable>,
  | "getTableByShareId"
  | "updateTableName"
  | "updateTableCourtSettings"
  | "reassignCourtsAndTimes"
  | "updatePlayerName"
  | "addPlayerToGroup"
  | "regenerateGroupMatches"
  | "setupRosterAtomic"
>;

export interface CardAction { type: string; args: Record<string, unknown>; danger?: boolean }
export interface ExecResult { outcome: "applied" | "partial" | "failed"; done: string[]; failed: string | null }

type Lang = "vi" | "en";
const STEP = {
  vi: {
    load: "đọc giải", name: "đổi tên giải", desc: "lưu mô tả", courts: "lưu sân & giờ", schedule: "xếp lại lịch",
    sets: "lưu số set", team: "đổi tên đội", add: "thêm đội", group: "tạo lại trận của bảng", list: "đọc danh sách đã duyệt",
    groupCount: "lưu số bảng", draw: "chia bảng & xếp lịch", rebuild: "bốc thăm lại", pins: "lưu gán sân",
  },
  en: {
    load: "load the tournament", name: "rename", desc: "save the description", courts: "save courts & time", schedule: "reschedule",
    sets: "save games per match", team: "rename the team", add: "add the team", group: "rebuild the group's matches", list: "read approved entries",
    groupCount: "save the group count", draw: "draw groups & schedule", rebuild: "re-draw", pins: "save court pins",
  },
};

const REBUILD_ERRORS: Record<string, { vi: string; en: string }> = {
  HAS_RESULTS: { vi: "đã có trận có kết quả", en: "some matches already have results" },
  INVALID_STATUS: { vi: "giải đã sang playoff hoặc chưa chia bảng", en: "the playoff has started or groups aren't drawn" },
  NOT_AUTHORIZED: { vi: "bạn không phải chủ giải", en: "you're not the organizer" },
};

export async function executeCard(shareId: string, card: CardAction, deps: ExecDeps, lang: Lang): Promise<ExecResult> {
  const s = STEP[lang];
  const done: string[] = [];
  const step = async (label: string, run: () => Promise<boolean>): Promise<boolean> => {
    let ok = false;
    try { ok = await run(); } catch { ok = false; }
    if (ok) done.push(label);
    else throw new StepFailed(label);
    return ok;
  };

  try {
    const fresh = await deps.getTableByShareId(shareId);
    if (!fresh) throw new StepFailed(s.load);
    const { table } = fresh;
    const a = card.args;
    const update = (patch: Record<string, unknown>) => async () =>
      !(await supabase.from("quick_tables").update(patch as never).eq("id", table.id)).error;
    const reschedule = async () => {
      const f = await deps.getTableByShareId(shareId);
      if (!f) return false;
      const courts = (f.table.courts ?? []).map((c) => parseInt(c, 10)).filter((n) => !isNaN(n));
      return deps.reassignCourtsAndTimes(f.table.id, courts, f.table.start_time, f.groups, f.matches);
    };
    const rebuild = (extra: Record<string, unknown>) => async () => {
      const { data, error } = await supabase.rpc("rebuild_quick_table_groups" as never, {
        p_table_id: table.id,
        p_allow_results: card.danger === true,
        ...extra,
      } as never);
      const res = (data ?? {}) as { success?: boolean; error?: string };
      if (error || res.success !== true) {
        const why = res.error && REBUILD_ERRORS[res.error]?.[lang];
        throw new StepFailed(why ? `${s.rebuild} (${why})` : s.rebuild);
      }
      return true;
    };

    switch (card.type) {
      case "rename_tournament":
        await step(s.name, () => deps.updateTableName(table.id, String(a.name)));
        break;
      case "set_description":
        await step(s.desc, update({ registration_message: String(a.text ?? "") || null }));
        break;
      case "set_sets":
        await step(s.sets, update({ default_sets: Number(a.default_sets) }));
        break;
      case "update_schedule": {
        const courts = (a.courts as number[]).map(String);
        const start = (a.start_time as string | null) ?? null;
        await step(s.courts, () => deps.updateTableCourtSettings(table.id, courts, start));
        if (table.status === "group_stage") await step(s.schedule, reschedule);
        break;
      }
      case "rename_team":
        await step(s.team, () => deps.updatePlayerName(String(a.team_id), String(a.p1), a.p2 ? String(a.p2) : null));
        break;
      case "add_team": {
        const p1 = String(a.p1);
        const p2 = a.p2 ? String(a.p2) : null;
        const groupId = String(a.group_id);
        let newId = "";
        await step(s.add, async () => {
          const p = await deps.addPlayerToGroup(table.id, groupId, { name: p2 ? `${p1} & ${p2}` : p1 });
          newId = p?.id ?? "";
          return !!p;
        });
        // addPlayerToGroup chỉ ghi name; tên từng VĐV cho màn trọng tài đi qua updatePlayerName như hộp sửa tên.
        await step(s.team, () => deps.updatePlayerName(newId, p1, p2));
        await step(s.group, async () => {
          const f = await deps.getTableByShareId(shareId);
          const ids = (f?.players ?? []).filter((p) => p.group_id === groupId).map((p) => p.id);
          return !!f && deps.regenerateGroupMatches(table.id, groupId, ids);
        });
        await step(s.schedule, reschedule);
        break;
      }
      case "draw_groups": {
        const g = Number(a.group_count);
        let roster: Array<{ name: string; player1_name?: string; player2_name?: string; team?: string }> = [];
        await step(s.list, async () => {
          if (table.is_doubles) {
            const { data, error } = await supabase.from("quick_table_teams")
              .select("player1_display_name,player2_display_name,player1_team,player2_team,btc_approved,team_status")
              .eq("table_id", table.id).order("created_at");
            roster = (data ?? []).filter((x) => x.btc_approved && x.team_status !== "removed").map((x) => ({
              name: `${x.player1_display_name}${x.player2_display_name ? ` / ${x.player2_display_name}` : ""}`,
              player1_name: x.player1_display_name,
              player2_name: x.player2_display_name || undefined,
              team: x.player1_team || x.player2_team || undefined,
            }));
            return !error && roster.length >= 2;
          }
          const { data, error } = await supabase.from("quick_table_registrations")
            .select("display_name,team,status").eq("table_id", table.id).eq("status", "approved").order("created_at");
          roster = (data ?? []).map((r) => ({ name: r.display_name, player1_name: r.display_name, team: r.team || undefined }));
          return !error && roster.length >= 2;
        });
        if (g !== table.group_count) await step(s.groupCount, update({ group_count: g }));
        const courts = (table.courts ?? []).map((c) => parseInt(c, 10)).filter((n) => !isNaN(n));
        await step(s.draw, () => deps.setupRosterAtomic(table.id, roster, g, undefined, courts, table.start_time, table.group_courts ?? undefined));
        break;
      }
      case "rebuild_groups": {
        const drop = new Set((a.drop_team_ids as string[] | undefined) ?? []);
        const g = Number(a.group_count);
        let assignments: number[] | null = null;
        if (a.reshuffle !== false) {
          // Cùng thứ tự với RPC (display_order, created_at, id) để chỉ số khớp.
          const keep = fresh.players
            .filter((p) => !drop.has(p.id))
            .sort((x, y) => x.display_order - y.display_order || x.created_at.localeCompare(y.created_at) || x.id.localeCompare(y.id));
          const buckets = distributePlayersToGroups(
            keep.map((p, i) => ({ id: String(i), name: p.name, team: p.team ?? undefined, seed: p.seed ?? undefined })),
            g,
          );
          assignments = Array(keep.length).fill(0);
          buckets.forEach((b, gi) => b.forEach((p) => { assignments![Number(p.id)] = gi; }));
        }
        await step(s.rebuild, rebuild({
          p_group_count: g,
          ...(assignments ? { p_group_assignments: assignments } : {}),
          ...(drop.size ? { p_drop_player_ids: [...drop] } : {}),
        }));
        break;
      }
      case "set_group_courts":
        if (table.status === "setup") await step(s.pins, update({ group_courts: a.group_courts }));
        else await step(s.rebuild, rebuild({ p_group_courts: a.group_courts }));
        break;
      default:
        throw new StepFailed(card.type);
    }
    return { outcome: "applied", done, failed: null };
  } catch (err) {
    const failed = err instanceof StepFailed ? err.step : String(err);
    return { outcome: done.length ? "partial" : "failed", done, failed };
  }
}

class StepFailed extends Error {
  constructor(public step: string) { super(step); }
}
