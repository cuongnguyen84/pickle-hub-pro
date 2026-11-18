// ============================================================================
// Luật thuần cho trợ lý AI nổi quanh giải (brief 27/10/2026).
//
// Không import Deno/esm — vitest chạy được (supabase/functions/_shared/__tests__).
// Gemini chỉ ĐỀ XUẤT một hành động; mọi kiểm tra quyền, kiểu, trạng thái giải
// và câu tóm tắt "trước → sau" trên thẻ xác nhận nằm ở đây và đọc từ DB, không
// tin client hay model. Ghi thật do client làm qua đúng các hàm UI đang dùng
// (RLS + RPC kiểm chủ giải lần nữa ở server).
// ============================================================================

export type Lang = "vi" | "en";
export type ActorRole = "owner" | "participant" | "viewer";
export type Phase = "draft" | "registration_open" | "drawn" | "in_play" | "finished";

export const ACTION_TYPES = [
  "rename_tournament",
  "set_description",
  "update_schedule",
  "set_sets",
  "rename_team",
  "add_team",
  "remove_team",
  "draw_groups",
  "rebuild_groups",
  "set_group_courts",
] as const;
export type ActionType = typeof ACTION_TYPES[number];

export interface TableState {
  id: string;
  share_id: string;
  name: string;
  status: "setup" | "group_stage" | "playoff" | "completed";
  requires_registration: boolean;
  is_doubles: boolean;
  group_count: number | null;
  courts: string[] | null;
  start_time: string | null;
  default_sets: number | null;
  registration_message: string | null;
  group_courts: (number | null)[] | null;
  groups: { id: string; name: string }[]; // theo display_order
  players: {
    id: string; name: string; p1: string | null; p2: string | null; group_id: string | null;
    played?: number; won?: number; diff?: number;
  }[];
  matches: { group_id: string | null; status: string; is_playoff: boolean }[];
  /** đăng ký đã duyệt (giải tự đăng ký), dùng cho "chia bảng cho giải này" */
  approved_count: number;
}

export interface Alternative { label: string; prompt: string; fill?: boolean; href?: string }

export interface ActionCard {
  type: ActionType;
  /** tham số đã chuẩn hoá — client thực thi đúng các giá trị này */
  args: Record<string, unknown>;
  lines: string[];
  warnings: string[];
  /** true = có mất dữ liệu (kết quả trận); nút xác nhận đỏ + gửi allow_results */
  danger: boolean;
  /** hành động ngược để hoàn tác trong phiên (chỉ các sửa thông tin) */
  undo?: { type: ActionType; args: Record<string, unknown> } | null;
  blocked?: { reason: string; alternatives: Alternative[] };
}

const T = {
  vi: {
    phase: { draft: "nháp (chưa có danh sách)", registration_open: "đang mở đăng ký", drawn: "đã bốc thăm, chưa có kết quả", in_play: "đang đấu", finished: "đã kết thúc" },
    none: "(trống)",
    rename: (a: string, b: string) => `Đổi tên giải: ${a} → ${b}`,
    desc: (a: string, b: string) => `Mô tả giải: ${a} → ${b}`,
    courts: (a: string, b: string) => `Sân: ${a} → ${b}`,
    start: (a: string, b: string) => `Giờ bắt đầu: ${a} → ${b}`,
    sets: (a: number, b: number) => `Số set mỗi trận: ${a} → ${b}`,
    team: (a: string, b: string) => `Đổi tên đội: ${a} → ${b}`,
    add: (n: string, g: string) => `Thêm đội ${n} vào ${g}`,
    draw: (n: number, g: number) => `Chia ${n} đội đã duyệt vào ${g} bảng và xếp lịch`,
    rebuild: (n: number, g: number) => `Bốc thăm lại ${n} đội vào ${g} bảng`,
    keep: (n: number, g: number) => `Giữ nguyên ${n} đội trong ${g} bảng, xếp lại lịch`,
    drop: (n: string) => `Bỏ đội ${n} khỏi giải`,
    pin: (g: string, c: number | null) => (c ? `${g} → sân ${c}` : `${g} → không gán sân`),
    group: (i: number) => `Bảng ${String.fromCharCode(65 + i)}`,
    lostGroup: (g: string, k: number) => `${g} có ${k} trận đã có kết quả — các kết quả này sẽ bị xoá khi xếp lại lịch bảng.`,
    lostAll: (k: number) => `${k} trận đã có kết quả sẽ bị XOÁ. Không hoàn tác được.`,
    reschedule: "Toàn bộ lịch vòng bảng sẽ được xếp lại.",
    rescheduleGroup: (g: string) => `Lịch ${g} sẽ được xếp lại.`,
    pinsLost: "Lịch xếp lại theo sân mới sẽ không giữ gán sân theo bảng hiện tại.",
    noUndo: "Bước này không hoàn tác được.",
    playoffLock: "Giải đã vào playoff hoặc đã kết thúc — không đổi bảng/đội được nữa.",
    finishedLock: "Giải đã kết thúc — chỉ còn sửa tên và mô tả.",
    notDrawn: "Giải chưa chia bảng nên chưa có đội nào trong bảng.",
    notDrawnAdd: "Giải chưa chia bảng. Thêm đội ở trang nhập danh sách hoặc duyệt đăng ký.",
    notSaved: "Danh sách đội của giải này chưa được lưu (còn nằm trong ô nhập) — xoá hoặc sửa dòng đó ngay trên trang nhập danh sách, chưa có gì để mình xoá.",
    afterDraw: (n: string) => `Giải đã bốc thăm — xoá đội ${n} sẽ làm lệch lịch và kết quả của bảng. Mình không tự xoá.`,
    alreadyDrawn: "Giải đã chia bảng rồi. Muốn chia lại thì dùng bốc thăm lại.",
    needApproved: (k: number) => `Mới có ${k} đội được duyệt — cần ít nhất 2 để chia bảng.`,
    noRegistration: "Giải này không mở đăng ký — danh sách đội được nhập ở trang nhập danh sách.",
    badGroups: (n: number) => `Số bảng không hợp lệ với ${n} đội.`,
    altReplace: "Thay bằng đội khác",
    altReplacePrompt: (n: string) => `Đổi tên đội ${n} thành `,
    altRedraw: "Bốc thăm lại không có đội này",
    altRedrawPrompt: (n: string) => `Bốc thăm lại các bảng, bỏ đội ${n}`,
    altSetup: "Mở trang nhập danh sách",
    altRegistration: "Mở tab đăng ký",
    altRebuild: "Bốc thăm lại",
    altRebuildPrompt: "Bốc thăm lại các bảng",
  },
  en: {
    phase: { draft: "draft (no list yet)", registration_open: "registration open", drawn: "groups drawn, no results yet", in_play: "in play", finished: "finished" },
    none: "(empty)",
    rename: (a: string, b: string) => `Rename tournament: ${a} → ${b}`,
    desc: (a: string, b: string) => `Description: ${a} → ${b}`,
    courts: (a: string, b: string) => `Courts: ${a} → ${b}`,
    start: (a: string, b: string) => `Start time: ${a} → ${b}`,
    sets: (a: number, b: number) => `Games per match: ${a} → ${b}`,
    team: (a: string, b: string) => `Rename team: ${a} → ${b}`,
    add: (n: string, g: string) => `Add team ${n} to ${g}`,
    draw: (n: number, g: number) => `Draw ${n} approved teams into ${g} groups and schedule`,
    rebuild: (n: number, g: number) => `Re-draw ${n} teams into ${g} groups`,
    keep: (n: number, g: number) => `Keep ${n} teams in ${g} groups, rebuild the schedule`,
    drop: (n: string) => `Drop team ${n}`,
    pin: (g: string, c: number | null) => (c ? `${g} → court ${c}` : `${g} → no fixed court`),
    group: (i: number) => `Group ${String.fromCharCode(65 + i)}`,
    lostGroup: (g: string, k: number) => `${g} has ${k} scored matches — those results are deleted when its schedule is rebuilt.`,
    lostAll: (k: number) => `${k} scored matches will be DELETED. This can't be undone.`,
    reschedule: "The whole group-stage schedule is rebuilt.",
    rescheduleGroup: (g: string) => `${g}'s schedule is rebuilt.`,
    pinsLost: "Rescheduling on the new courts won't keep the current group-to-court pins.",
    noUndo: "This step can't be undone.",
    playoffLock: "The playoff has started or the tournament is over — groups and teams are locked.",
    finishedLock: "The tournament is over — only the name and description can change.",
    notDrawn: "Groups aren't drawn yet, so no team is in a group.",
    notDrawnAdd: "Groups aren't drawn yet. Add teams on the entry page or approve registrations.",
    notSaved: "This tournament's list isn't saved yet (it's still in the entry form) — remove or edit that line on the entry page; there's nothing for me to delete.",
    afterDraw: (n: string) => `Groups are already drawn — removing ${n} would break that group's schedule and results. I won't remove it on my own.`,
    alreadyDrawn: "Groups are already drawn. Use a re-draw to change them.",
    needApproved: (k: number) => `Only ${k} approved teams — at least 2 are needed to draw groups.`,
    noRegistration: "This tournament has no sign-up — its list is entered on the entry page.",
    badGroups: (n: number) => `That group count doesn't work for ${n} teams.`,
    altReplace: "Replace with another team",
    altReplacePrompt: (n: string) => `Rename team ${n} to `,
    altRedraw: "Re-draw without this team",
    altRedrawPrompt: (n: string) => `Re-draw the groups without team ${n}`,
    altSetup: "Open the entry page",
    altRegistration: "Open the registration tab",
    altRebuild: "Re-draw",
    altRebuildPrompt: "Re-draw the groups",
  },
};

export function phaseOf(s: Pick<TableState, "status" | "requires_registration" | "matches" | "players">): Phase {
  if (s.status === "completed") return "finished";
  if (s.status === "playoff") return "in_play";
  if (s.status === "group_stage") return s.matches.some((m) => m.status === "completed") ? "in_play" : "drawn";
  return s.requires_registration ? "registration_open" : "draft";
}

export function phaseLabel(p: Phase, lang: Lang): string {
  return T[lang].phase[p];
}

export function roleFor(userId: string, creatorId: string | null, participant: boolean): ActorRole {
  if (creatorId && creatorId === userId) return "owner";
  return participant ? "participant" : "viewer";
}

const clean = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

const courtList = (raw: unknown): number[] | null => {
  if (!Array.isArray(raw)) return null;
  const out = [...new Set(raw.map(Number).filter((c) => Number.isInteger(c) && c >= 1 && c < 100))].slice(0, 50);
  return out.length ? out.sort((a, b) => a - b) : null;
};

const scoredIn = (s: TableState, groupId: string | null) =>
  s.matches.filter((m) => !m.is_playoff && m.status === "completed" && (groupId == null || m.group_id === groupId)).length;

const teamLabel = (p1: string, p2?: string | null) => (p2 ? `${p1} & ${p2}` : p1);

const fold = (v: string) =>
  v.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/đ/g, "d").replace(/\s+/g, " ").trim();

/**
 * Đội model nhắc tới. Model hay chép id kèm tiền tố ("id:…", "[id=…]") hoặc
 * chỉ đưa tên — test tay 27/10: mọi lệnh xoá đội rơi vào "chưa hiểu" vì id
 * không khớp nguyên văn. Thử id (bỏ tiền tố), rồi tên đội / tên VĐV.
 */
export function resolveTeam(s: TableState, raw: Record<string, unknown>): TableState["players"][number] | null {
  const idRaw = typeof raw.team_id === "string" ? raw.team_id : "";
  const id = idRaw.replace(/^[\s[(]*(?:team_)?id\s*[:=]\s*/i, "").replace(/[\])\s]+$/, "");
  const byId = s.players.find((p) => p.id === id);
  if (byId) return byId;
  for (const q of [raw.team_name, idRaw].filter((v): v is string => typeof v === "string").map(fold)) {
    if (!q) continue;
    const exact = s.players.filter((p) => [p.name, p.p1, p.p2].some((n) => n && fold(n) === q));
    if (exact.length === 1) return exact[0];
    const part = s.players.filter((p) => fold(p.name).includes(q) || q.includes(fold(p.name)));
    if (part.length === 1) return part[0];
  }
  return null;
}

/** Đội được nhắc tên trong câu người dùng (tên đội, không có thì tên VĐV ≥ 3 ký tự). */
export function teamsInText(s: TableState, text: string): TableState["players"] {
  const q = fold(text);
  const hit = (n: string | null) => !!n && fold(n).length >= 3 && q.includes(fold(n));
  const byName = s.players.filter((p) => hit(p.name));
  const pool = byName.length ? byName : s.players.filter((p) => hit(p.p1) || hit(p.p2));
  // "QR Delta" lẫn "QR Delta 2" cùng khớp → bỏ tên ngắn nằm trong tên dài.
  return pool.filter((p) => !pool.some((o) => o !== p && fold(o.name).includes(fold(p.name))));
}

const VI_CHARS = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
const EN_WORDS = /\b(the|to|from|for|team|group|court|please|remove|rename|draw|assign|change|add|what|how|is|are|can)\b/i;

/**
 * Ngôn ngữ trả lời = ngôn ngữ người dùng gõ, không theo giao diện. Lượt chỉ có
 * tên riêng ("QR Replacement") không đoán được → lấy theo lượt trước.
 */
export function detectLang(userTexts: string[], fallback: Lang): Lang {
  for (const t of userTexts.slice(-3).reverse()) {
    if (VI_CHARS.test(t)) return "vi";
    if (EN_WORDS.test(t)) return "en";
  }
  return fallback;
}

const RENAME_SPLIT = /^(.*?)\s+(?:thành|to|into)\s+(.+)$/i;
const DROP_WORDS = /\b(bo|loai|khong co|xoa|without|drop|remove|exclude)\b/;

/**
 * Model hay trả action chỉ có "type", bỏ trống tham số (log 27/10 23:25–23:28:
 * rename_team / remove_team rỗng, rebuild_groups drop_team_ids = []). Bù từ
 * chính câu người dùng: chỉ nhận đội có trong DB, nên không bịa được gì mới.
 */
export function fillFromText(s: TableState, raw: unknown, text: string): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const a = { ...(raw as Record<string, unknown>) };
  const one = (t: string) => {
    const ps = teamsInText(s, t);
    return ps.length === 1 ? ps[0] : null;
  };
  const split = text.trim().match(RENAME_SPLIT);
  switch (a.type) {
    case "rename_tournament":
      // log 81 (28/10): rename_tournament args rỗng.
      if (!clean(a.name, 100) && split) a.name = split[2].replace(/^["'“]+|["'”.!]+$/g, "");
      break;
    case "rename_team":
      if (!resolveTeam(s, a)) {
        const p = one(split ? split[1] : text);
        if (p) a.team_id = p.id;
      }
      if (!clean(a.p1, 100) && !clean(a.name, 201) && split) a.name = split[2].replace(/^["'“]+|["'”.!]+$/g, "");
      break;
    case "remove_team":
      if (!resolveTeam(s, a)) {
        const p = one(text);
        if (p) a.team_id = p.id;
      }
      break;
    case "rebuild_groups":
      if ((!Array.isArray(a.drop_team_ids) || !a.drop_team_ids.length) && DROP_WORDS.test(fold(text))) {
        a.drop_team_ids = teamsInText(s, text).map((p) => p.id);
      }
      break;
    case "set_group_courts": {
      if (Array.isArray(a.group_courts) && a.group_courts.length) break;
      if (Array.isArray(a.courts) && a.courts.length) break;
      const f = fold(text);
      const court = f.match(/(?:san|court)\s*(\d{1,2})\b/);
      if (court) a.courts = [Number(court[1])];
      const g = f.match(/(?:bang|group)\s+([a-z])(?![a-z])/);
      if (g && typeof a.group !== "string") a.group = g[1];
      break;
    }
  }
  return a;
}

/** Chỉ số bảng → số đội đang có. */
function groupSizes(s: TableState): number[] {
  return s.groups.map((g) => s.players.filter((p) => p.group_id === g.id).length);
}

/** Bảng mỗi bảng 2–8 đội với n đội — cùng khung chat tạo giải (MIN 3 lý tưởng, RPC cho phép thấp hơn). */
function validGroupCount(n: number, g: number): boolean {
  return Number.isInteger(g) && g >= 1 && g <= 16 && n >= 2 && Math.floor(n / g) >= 2 && Math.ceil(n / g) <= 8;
}

/**
 * Hành động đề xuất (từ model) → thẻ xác nhận đã kiểm. Trả null khi tham số
 * không dùng được (model bịa id, thiếu tên…), để server nói "chưa hiểu".
 * Quyền đã kiểm trước (proposeAction).
 */
export function buildCard(
  s: TableState, raw: Record<string, unknown>, lang: Lang, viewingGroupId: string | null = null,
): ActionCard | null {
  const t = T[lang];
  const type = raw.type as ActionType;
  if (!ACTION_TYPES.includes(type)) return null;
  const phase = phaseOf(s);
  const locked = s.status === "playoff" || s.status === "completed";
  const card = (c: Omit<ActionCard, "type" | "warnings" | "danger"> & Partial<ActionCard>): ActionCard =>
    ({ type, warnings: [], danger: false, ...c });
  const blocked = (reason: string, alternatives: Alternative[] = []): ActionCard =>
    card({ args: {}, lines: [], blocked: { reason, alternatives } });
  const setupHref = `/tools/quick-tables/${s.share_id}/setup`;
  const regHref = `/tools/quick-tables/${s.share_id}?tab=registration`;

  switch (type) {
    case "rename_tournament": {
      const name = clean(raw.name, 100);
      if (!name || name === s.name) return null;
      return card({ args: { name }, lines: [t.rename(s.name, name)], undo: { type, args: { name: s.name } } });
    }
    case "set_description": {
      const text = clean(raw.text, 500);
      if (!text || text === s.registration_message) return null;
      return card({
        args: { text },
        lines: [t.desc(s.registration_message || t.none, text)],
        undo: { type, args: { text: s.registration_message ?? "" } },
      });
    }
    case "update_schedule": {
      if (locked) return blocked(phase === "finished" ? t.finishedLock : t.playoffLock);
      const courts = courtList(raw.courts);
      const start = typeof raw.start_time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(raw.start_time) ? raw.start_time : null;
      if (!courts && !start) return null;
      const oldCourts = (s.courts ?? []).map(Number).filter((n) => Number.isInteger(n));
      const nextCourts = courts ?? oldCourts;
      const nextStart = start ?? s.start_time;
      const lines: string[] = [];
      if (courts) lines.push(t.courts(oldCourts.join(", ") || t.none, courts.join(", ")));
      if (start) lines.push(t.start(s.start_time || t.none, start));
      const warnings = s.status === "group_stage" ? [t.reschedule] : [];
      if (s.status === "group_stage" && s.group_courts?.some((c) => c != null)) warnings.push(t.pinsLost);
      return card({
        args: { courts: nextCourts, start_time: nextStart },
        lines,
        warnings,
        undo: { type, args: { courts: oldCourts, start_time: s.start_time } },
      });
    }
    case "set_sets": {
      if (s.status === "completed") return blocked(t.finishedLock);
      const sets = Number(raw.default_sets);
      if (![1, 3, 5].includes(sets) || sets === (s.default_sets ?? 1)) return null;
      return card({ args: { default_sets: sets }, lines: [t.sets(s.default_sets ?? 1, sets)], undo: { type, args: { default_sets: s.default_sets ?? 1 } } });
    }
    case "rename_team": {
      const p = resolveTeam(s, raw);
      if (!p) return s.players.length ? null : blocked(t.notDrawn, s.requires_registration ? [{ label: t.altRegistration, prompt: "", href: regHref }] : []);
      // p1 + p2 = từng VĐV; chỉ có tên mới (name, hoặc p1 một mình) = cả tên
      // đội: "A & B" / "A / B" tách 2 VĐV, không thì một tên đội như "QR Replacement".
      let p1 = clean(raw.p1, 100);
      let p2 = clean(raw.p2, 100);
      if (!p2) [p1 = "", p2 = ""] = (p1 || clean(raw.name, 201)).split(/\s*[&/]\s*/).map((v) => v.slice(0, 100));
      if (!s.is_doubles) p2 = "";
      if (!p1) return null;
      const after = teamLabel(p1, p2 || null);
      if (after === p.name) return null;
      return card({
        args: { team_id: p.id, p1, p2: p2 || null },
        lines: [t.team(p.name, after)],
        undo: { type, args: { team_id: p.id, p1: p.p1 ?? p.name, p2: p.p2 } },
      });
    }
    case "add_team": {
      if (locked) return blocked(t.playoffLock);
      if (s.status === "setup") {
        return blocked(t.notDrawnAdd, [
          s.requires_registration ? { label: t.altRegistration, prompt: "", href: regHref } : { label: t.altSetup, prompt: "", href: setupHref },
        ]);
      }
      const p1 = clean(raw.p1, 100);
      const p2 = s.is_doubles ? clean(raw.p2, 100) : "";
      if (!p1 || (s.is_doubles && !p2) || !s.groups.length) return null;
      const letter = typeof raw.group === "string" ? raw.group.trim().toUpperCase().charCodeAt(0) - 65 : -1;
      const sizes = groupSizes(s);
      const gi = letter >= 0 && letter < s.groups.length ? letter : sizes.indexOf(Math.min(...sizes));
      const g = s.groups[gi];
      const lost = scoredIn(s, g.id);
      return card({
        args: { group_id: g.id, p1, p2: p2 || null },
        lines: [t.add(teamLabel(p1, p2 || null), t.group(gi))],
        warnings: [lost ? t.lostGroup(t.group(gi), lost) : t.rescheduleGroup(t.group(gi)), t.noUndo],
        danger: lost > 0,
      });
    }
    case "remove_team": {
      const p = resolveTeam(s, raw);
      if (!p) {
        if (s.players.length) return null;
        return s.requires_registration
          ? blocked(t.notDrawn, [{ label: t.altRegistration, prompt: "", href: regHref }])
          : blocked(t.notSaved, [{ label: t.altSetup, prompt: "", href: setupHref }]);
      }
      if (locked) return blocked(t.playoffLock);
      // Luật 3 của brief: đã bốc thăm thì không tự xoá — cảnh báo + phương án.
      return blocked(t.afterDraw(p.name), [
        { label: t.altReplace, prompt: t.altReplacePrompt(p.name), fill: true },
        { label: t.altRedraw, prompt: t.altRedrawPrompt(p.name) },
      ]);
    }
    case "draw_groups": {
      if (s.status !== "setup" || s.players.length) return blocked(t.alreadyDrawn, [{ label: t.altRebuild, prompt: t.altRebuildPrompt }]);
      if (!s.requires_registration) return blocked(t.noRegistration, [{ label: t.altSetup, prompt: "", href: setupHref }]);
      const n = s.approved_count;
      if (n < 2) return blocked(t.needApproved(n), [{ label: t.altRegistration, prompt: "", href: regHref }]);
      const asked = Number(raw.group_count);
      const g = Number.isInteger(asked) && asked > 0 ? asked : s.group_count ?? 1;
      if (!validGroupCount(n, g)) return blocked(t.badGroups(n));
      return card({ args: { group_count: g }, lines: [t.draw(n, g)], warnings: [t.noUndo] });
    }
    case "rebuild_groups": {
      if (s.status !== "group_stage") {
        return locked ? blocked(t.playoffLock) : blocked(t.notDrawn, [{ label: lang === "vi" ? "Chia bảng" : "Draw groups", prompt: lang === "vi" ? "Chia bảng cho giải này" : "Draw groups for this tournament" }]);
      }
      const ids = Array.isArray(raw.drop_team_ids)
        ? [...new Set(raw.drop_team_ids.map((v) => resolveTeam(s, { team_id: v })?.id).filter((id): id is string => !!id))]
        : [];
      if (Array.isArray(raw.drop_team_ids) && raw.drop_team_ids.length && !ids.length) return null;
      const n = s.players.length - ids.length;
      const asked = Number(raw.group_count);
      const g = Number.isInteger(asked) && asked > 0 ? asked : s.groups.length || (s.group_count ?? 1);
      if (!validGroupCount(n, g)) return blocked(t.badGroups(n));
      const reshuffle = raw.reshuffle !== false || g !== s.groups.length;
      const lost = scoredIn(s, null);
      const lines = [reshuffle ? t.rebuild(n, g) : t.keep(n, g), ...ids.map((id) => t.drop(s.players.find((p) => p.id === id)!.name))];
      return card({
        args: { group_count: g, drop_team_ids: ids, reshuffle },
        lines,
        warnings: [...(lost ? [t.lostAll(lost)] : []), t.reschedule, t.noUndo],
        danger: lost > 0,
      });
    }
    case "set_group_courts": {
      if (locked) return blocked(t.playoffLock);
      const groupCount = s.groups.length || s.group_count || 0;
      if (!groupCount) return null;
      // Model hay trả "bảng này sân 2" thành group + courts thay vì mảng theo
      // thứ tự bảng (test tay 27/10) → dựng lại mảng từ bảng nói tên / bảng đang xem.
      let list: unknown[] | null = Array.isArray(raw.group_courts) ? raw.group_courts : null;
      const letter = typeof raw.group === "string" ? raw.group.trim().toUpperCase().charCodeAt(0) - 65 : -1;
      const viewing = s.groups.findIndex((g) => g.id === viewingGroupId);
      const single = Array.isArray(raw.courts) && raw.courts.length === 1 ? raw.courts[0] : list?.length === 1 ? list[0] : null;
      const target = letter >= 0 && letter < groupCount ? letter : viewing;
      if (single != null && target >= 0 && (!list || list.length === 1)) {
        list = Array.from({ length: groupCount }, (_, i) => (i === target ? single : (s.group_courts?.[i] ?? 0)));
      }
      if (!list) return null;
      const pins = list.slice(0, groupCount).map((v) => {
        const n = Number(v);
        return Number.isInteger(n) && n >= 1 && n < 100 ? n : null;
      });
      if (!pins.some((c) => c != null)) return null;
      while (pins.length < groupCount) pins.push(s.group_courts?.[pins.length] ?? null);
      const lines = pins.map((c, i) => t.pin(t.group(i), c));
      if (s.status === "setup") {
        return card({ args: { group_courts: pins }, lines, undo: { type, args: { group_courts: s.group_courts ?? [] } } });
      }
      const lost = scoredIn(s, null);
      return card({
        args: { group_courts: pins },
        lines,
        warnings: [...(lost ? [t.lostAll(lost)] : []), t.reschedule, t.noUndo],
        danger: lost > 0,
      });
    }
  }
  return null;
}

/** Cổng quyền: chỉ chủ giải mới nhận thẻ hành động. */
export function proposeAction(
  s: TableState | null, role: ActorRole, raw: unknown, lang: Lang, viewingGroupId: string | null = null,
): { card: ActionCard | null; refused: boolean } {
  if (!raw || typeof raw !== "object" || !s) return { card: null, refused: false };
  if (role !== "owner") return { card: null, refused: true };
  return { card: buildCard(s, raw as Record<string, unknown>, lang, viewingGroupId), refused: false };
}

export function refusalText(role: ActorRole, lang: Lang): string {
  const vi = lang === "vi";
  if (role === "participant") {
    return vi
      ? "Chỉ chủ giải mới sửa được thông tin giải. Bạn là người tham gia — mình vẫn trả lời được về lịch, bảng và kết quả nhé."
      : "Only the organizer can change this tournament. You're a participant — I can still answer questions about the schedule, groups and results.";
  }
  return vi
    ? "Chỉ chủ giải mới sửa được thông tin giải. Mình vẫn trả lời được về lịch, bảng và kết quả nhé."
    : "Only the organizer can change this tournament. I can still answer questions about the schedule, groups and results.";
}

/** Tóm tắt giải cho model: gọn, có id đội để model tham chiếu, không dump trang. */
export function describeState(s: TableState, role: ActorRole, lang: Lang, viewingGroup: string | null): string {
  const phase = phaseOf(s);
  const lines = [
    `Giải: "${s.name}" (${s.is_doubles ? "đánh đôi" : "đánh đơn"}), trạng thái: ${phaseLabel(phase, "vi")}.`,
    `Vai trò người dùng với giải: ${role === "owner" ? "CHỦ GIẢI (được sửa)" : role === "participant" ? "người tham gia (chỉ đọc)" : "khách xem (chỉ đọc)"}.`,
    `Sân: ${(s.courts ?? []).join(", ") || "chưa đặt"}; giờ bắt đầu: ${s.start_time ?? "chưa đặt"}; số set: ${s.default_sets ?? 1}.`,
    s.registration_message ? `Mô tả: ${s.registration_message.slice(0, 300)}` : "",
    s.requires_registration && s.status === "setup" ? `Đăng ký đã duyệt: ${s.approved_count}. Số bảng dự kiến: ${s.group_count ?? 1}.` : "",
  ];
  if (s.groups.length) {
    s.groups.forEach((g, i) => {
      const pin = s.group_courts?.[i];
      const members = s.players
        .filter((p) => p.group_id === g.id)
        .map((p) => `${p.name} (team_id=${p.id})${p.played ? ` (${p.won ?? 0}/${p.played} thắng, hiệu số ${p.diff ?? 0})` : ""}`);
      const done = s.matches.filter((m) => m.group_id === g.id && !m.is_playoff);
      lines.push(`Bảng ${String.fromCharCode(65 + i)}${g.id === viewingGroup ? " (ĐANG XEM)" : ""}${pin ? ` — sân ${pin}` : ""}: ${members.join("; ")} — ${done.filter((m) => m.status === "completed").length}/${done.length} trận có kết quả.`);
    });
  } else if (s.players.length) {
    lines.push(`Đội: ${s.players.map((p) => `${p.name} (team_id=${p.id})`).join("; ")}`);
  }
  void lang;
  return lines.filter(Boolean).join("\n").slice(0, 9000);
}
