/**
 * /tools/quick-tables/chat — tạo giải chia bảng bằng hội thoại.
 *
 * Chip bấm được xử lý tại chỗ (không gọi AI, tức thì, không tốn credit). Chỉ
 * tin nhắn gõ tự do mới đi qua edge function quick-table-chat, và nó chỉ trả
 * về bản vá nháp. Câu hỏi tiếp theo do nextSlot() quyết, giải được tạo bằng
 * đúng createTable + setupRosterAtomic của wizard cũ.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, ChevronDown, Copy, Loader2, MessageSquareText, Paperclip, Pencil, RotateCcw, Send, Shuffle, Sparkles, Trash2, TriangleAlert, Trophy, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { TheLineLayout } from "@/components/layout";
import { SetupLoginGate } from "@/components/tournament/SetupShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n";
import { useConfirm } from "@/hooks/useConfirm";
import { useQuickTable, type QuickTable } from "@/hooks/useQuickTable";
import { supabase } from "@/integrations/supabase/client";
import { getSiteUrl } from "@/lib/auth-config";
import { cn } from "@/lib/utils";
import { seriesLine, seriesName, seriesPlan, type SeriesStyle } from "@/lib/quick-table-series";
import {
  applyPatch, buildRoster, defaultName, duplicateIndexes, entryCount, entryLabel, groupOptions,
  groupSizes, localSlotPatch, MAX_CHAT_ENTRIES, nextSlot, pairEntries, parseSheet, previewAssignments, seriesCap, trustPatch,
  type Draft, type Entry, type GroupOption, type PairingMode, type Slot,
} from "@/lib/quick-table-chat";

type Lang = "vi" | "en";
/** label: thứ hiện trên bong bóng khi khác nội dung gửi AI (vd tên file thay cho cả bảng CSV). */
interface Msg { id: string; role: "user" | "bot"; text: string; label?: string }
/** Ảnh/PDF gửi kèm cho Gemini đọc — chỉ nằm trong request, không lưu localStorage. */
interface Attachment { mime_type: string; data: string }
/** entries: bảng tính đọc được tại chỗ → vào nháp luôn, không gọi AI. */
interface Outgoing { text: string; label?: string; attachment?: Attachment; entries?: Entry[] }
interface Chip { label: string; sub?: string; recommended?: boolean; onClick: () => void }
type SubMenu = null | "sets";

const GROUP_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const STORAGE_PREFIX = "qt-chat:v1:";
const PASTE_COLLAPSE_LINES = 4;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_SIDE = 1600; // đủ nét để đọc tên, base64 ~300 KB
const SHEET_EXT = /\.(xlsx|xls|csv|tsv|txt)$/i;

const COPY = {
  vi: {
    layoutTitle: "Tạo giải bằng chat AI",
    title: "Tạo giải bằng chat",
    classicForm: "Dùng form thường",
    loginTitle: "Đăng nhập để tạo giải bằng chat",
    loginDesc: "Kể cho trợ lý nghe về giải hoặc dán danh sách từ Zalo — vài giây là có bảng đấu.",
    toolLabel: "Chia bảng",
    welcome: "Chào bạn 👋 Kể mình nghe về giải nhé, ví dụ: “Giải CLB tối thứ 7, 16 đôi, chia 4 bảng”. Hoặc dán danh sách VĐV, tải ảnh chụp hay file Excel lên đây.",
    unit: (d: Draft): string => (d.is_doubles === false ? "VĐV" : "đội"),
    format: "Giải đánh đôi hay đánh đơn?",
    doubles: "Đôi", singles: "Đơn",
    count: (u: string) => `Có bao nhiêu ${u}? Hoặc dán luôn danh sách vào đây.`,
    pasteList: "Dán danh sách",
    upload: "Tải ảnh / file",
    uploadAria: "Tải ảnh hoặc file danh sách",
    fileUnreadable: "Không đọc được file này. Thử ảnh chụp, Excel, CSV hoặc PDF nhé.",
    fileTooBig: "File lớn quá, tối đa 4 MB.",
    tooMany: (n: number, u: string) => `Chat hiện tạo được tối đa ${MAX_CHAT_ENTRIES} ${u}. Giải ${n} ${u} nên dùng thể thức playoff lớn trong form thường.`,
    changeCount: "Sửa số lượng",
    pairing: (n: number) => `Mình thấy ${n} tên lẻ. Ghép thành đôi thế nào?`,
    pairingOdd: (n: number) => `Mình thấy ${n} tên lẻ — ghép đôi cần số chẵn nên đang thừa 1 người. Gõ thêm 1 tên, hoặc:`,
    pairSeq: "Ghép theo thứ tự", pairSeqSub: "1+2, 3+4…",
    pairRandom: "Ghép ngẫu nhiên",
    pairLine: "Mỗi dòng là 1 đội",
    dropLast: (name: string) => `Bỏ “${name}”`,
    mismatch: (m: number, n: number, u: string) => `Danh sách có ${m} ${u}, nhưng bạn nói ${n}. Lấy theo danh sách hay dán thêm?`,
    useList: (m: number, u: string) => `Lấy ${m} ${u}`,
    pasteMore: "Dán thêm",
    groups: (n: number, u: string) => `${n} ${u} chia thế nào?`,
    groupsInvalid: (k: number, u: string) => `Không chia được ${k} bảng đều 3–6 ${u}/bảng. Chọn một cách dưới đây nhé:`,
    groupsBig: " Giải đông, nhiều bảng sẽ xong nhanh hơn.",
    groupLabel: (o: GroupOption) => (o.groupCount === 1 ? "1 bảng vòng tròn" : `${o.groupCount} bảng × ${o.sizes[0] === o.sizes[o.sizes.length - 1] ? o.sizes[0] : `${o.sizes[o.sizes.length - 1]}–${o.sizes[0]}`}`),
    groupSub: (o: GroupOption) =>
      o.groupCount === 1
        ? "Ai cũng gặp nhau, xếp hạng theo thắng–thua"
        : o.wildcards === 0
          ? `Top 2 mỗi bảng vào thẳng ${ROUND_VI[o.playoffSize] ?? "playoff"}`
          : `Vào ${ROUND_VI[o.playoffSize] ?? "playoff"}, cần thêm ${o.wildcards} suất vé vớt`,
    recommended: "Khuyên dùng",
    series: "Hết vòng bảng thì đánh mấy nhánh? Series A là nhất, nhì mỗi bảng; nhánh sau nhận tất cả đội còn lại, đội xếp cao được miễn vòng 1 nếu lẻ.",
    seriesOne: "1 nhánh", seriesOneSub: "Chỉ top 2 mỗi bảng vào playoff",
    seriesMany: (names: string[]) => `${names.length} nhánh: ${names.join(" + ")}`,
    optStyle: (s: SeriesStyle): string => (s === "medal" ? "Đổi tên: Series A, B" : "Đổi tên: Nhánh Vàng, Bạc"),
    roster: (u: string) => `Có danh sách ${u} chưa? Dán vào là mình xếp bảng luôn.`,
    pasteNow: "Dán ngay",
    openRegistration: "Mở cho người chơi tự đăng ký",
    later: "Để sau, tự nhập",
    paste: (d: Draft) => `Dán danh sách vào ô bên dưới nhé — mỗi dòng 1 ${d.is_doubles === false ? "VĐV" : "đội, kiểu “Nam - Hùng”"}. Có ảnh chụp hay file Excel thì tải lên cũng được.`,
    name: "Đặt tên giải là gì?",
    courtsQ: "Có bao nhiêu sân thi đấu? Mình sẽ tự xếp sân và giờ cho từng trận.",
    courtN: (k: number) => `${k} sân`,
    courtsSkip: "Chưa biết, bỏ qua",
    timeQ: "Mấy giờ bắt đầu? Gõ kiểu “7h tối” cũng được.",
    timeSkip: "Chưa biết",
    fCourts: "Sân & giờ",
    undo: "Quay lại bước trước",
    reset: "Làm lại từ đầu",
    resetTitle: "Xoá hết và làm lại?",
    resetDesc: "Toàn bộ hội thoại và bản nháp sẽ bị xoá. Giải đã tạo không bị ảnh hưởng.",
    resetOk: "Làm lại",
    customName: "Gõ tên khác ở ô bên dưới",
    options: "Gần xong rồi! Muốn thêm gì nữa không?",
    optSeed: "Hạt giống", optSets: (s: number) => `Số set: ${s === 1 ? "1 set" : `BO${s}`}`, optTeam: "Tránh cùng CLB",
    optDone: "Xong, xem lại",
    hintSeed: (u: string) => `Gõ tên các ${u} hạt giống theo thứ tự, ví dụ: “hạt giống: Nam - Hùng, Tú - Long”. Hạt giống sẽ được tách ra các bảng khác nhau.`,
    hintTeam: "Gõ những đội cùng CLB, ví dụ: “Nam - Hùng, Tú - Long cùng CLB Hà Đông”. Mình sẽ xếp họ vào các bảng khác nhau.",
    setsQ: "Mỗi trận đánh mấy set?",
    set1: "1 set", set3: "Best of 3", set5: "Best of 5",
    confirm: "Mọi thứ đã sẵn sàng. Kiểm tra lại rồi bấm Tạo giải nhé.",
    received: (n: number, u: string) => `Đã nhận ${n} ${u}.`,
    dupWarn: (n: number) => ` ⚠️ Có ${n} dòng trùng — xem lại trong Bản nháp.`,
    aiError: "Mình chưa nghe rõ, mạng hoặc trợ lý đang chậm. Thử lại nhé?",
    retry: "Thử lại",
    quotaFull: (q: number) => `Bạn đang có đủ ${q} giải chia bảng. Kết thúc hoặc xoá bớt giải cũ để tạo giải mới nhé.`,
    myTables: "Xem giải của tôi",
    placeholder: "Nhắn hoặc dán danh sách…",
    send: "Gửi",
    pasted: (n: number) => `📋 Đã dán ${n} dòng`,
    showAll: "Xem hết", collapse: "Thu gọn",
    draft: "Bản nháp",
    fFormat: "Thể thức", fCount: "Số lượng", fGroups: "Chia bảng", fRoster: "Danh sách", fName: "Tên giải", fExtra: "Tuỳ chọn",
    rosterReg: "Người chơi tự đăng ký", rosterLater: "Nhập sau",
    empty: "—",
    edit: "Sửa",
    removeDup: (n: number) => `Xoá ${n} dòng trùng`,
    addRow: "+ Thêm dòng",
    p1: "VĐV 1", p2: "VĐV 2",
    group: (i: number) => `Bảng ${GROUP_LETTERS[i]}`,
    reshuffle: "Xáo lại bảng",
    create: "Tạo giải",
    creating: "Đang tạo…",
    confirmReg: "Người chơi tự đăng ký qua link giải — bạn duyệt rồi xếp bảng sau.",
    confirmLater: "Bước tiếp theo bạn nhập danh sách, mình mở sẵn trang nhập.",
    created: (name: string) => `🎉 Đã tạo “${name}”!`,
    openTable: "Mở giải",
    enterRoster: "Nhập danh sách",
    copyLink: "Copy link",
    copyZalo: "Copy tin nhắn Zalo",
    copied: "Đã copy",
    another: "Tạo giải khác",
    rosterFailed: "Giải đã tạo nhưng chưa xếp được bảng. Mở trang nhập danh sách để thử lại.",
    zaloLink: "Xem lịch & kết quả",
    courts: (c: number[]) => `Sân ${c.join(", ")}`,
    reload: "Hội thoại được lưu trên máy này, tải lại trang không mất.",
  },
  en: {
    layoutTitle: "Create a tournament by chat",
    title: "Create by chat",
    classicForm: "Use the classic form",
    loginTitle: "Sign in to create a tournament by chat",
    loginDesc: "Describe your event or paste a player list from your group chat — groups are ready in seconds.",
    toolLabel: "Round robin",
    welcome: "Hi 👋 Tell me about your event, e.g. “Club night Saturday, 16 doubles teams, 4 groups”. Or paste your player list, or upload a photo or spreadsheet of it.",
    unit: (d: Draft): string => (d.is_doubles === false ? "players" : "teams"),
    format: "Doubles or singles?",
    doubles: "Doubles", singles: "Singles",
    count: (u: string) => `How many ${u}? Or paste the list right here.`,
    pasteList: "Paste a list",
    upload: "Upload photo / file",
    uploadAria: "Upload a photo or file of the list",
    fileUnreadable: "Couldn't read that file. Try a photo, Excel, CSV or PDF.",
    fileTooBig: "That file is too big — 4 MB max.",
    tooMany: (n: number, u: string) => `Chat can create up to ${MAX_CHAT_ENTRIES} ${u}. For ${n} ${u}, use the large playoff format in the classic form.`,
    changeCount: "Change the number",
    pairing: (n: number) => `I see ${n} single names. How should I pair them?`,
    pairingOdd: (n: number) => `I see ${n} single names — pairs need an even number, so one is left over. Type one more name, or:`,
    pairSeq: "Pair in order", pairSeqSub: "1+2, 3+4…",
    pairRandom: "Pair randomly",
    pairLine: "Each line is a team",
    dropLast: (name: string) => `Drop “${name}”`,
    mismatch: (m: number, n: number, u: string) => `The list has ${m} ${u}, but you said ${n}. Go with the list, or paste more?`,
    useList: (m: number, u: string) => `Use ${m} ${u}`,
    pasteMore: "Paste more",
    groups: (n: number, u: string) => `How should ${n} ${u} be split?`,
    groupsInvalid: (k: number, u: string) => `${k} groups won't split evenly into 3–6 ${u} each. Pick one of these:`,
    groupsBig: " Big field — more groups finish faster.",
    groupLabel: (o: GroupOption) => (o.groupCount === 1 ? "1 round-robin group" : `${o.groupCount} groups × ${o.sizes[0] === o.sizes[o.sizes.length - 1] ? o.sizes[0] : `${o.sizes[o.sizes.length - 1]}–${o.sizes[0]}`}`),
    groupSub: (o: GroupOption) =>
      o.groupCount === 1
        ? "Everyone plays everyone, ranked by wins"
        : o.wildcards === 0
          ? `Top 2 per group go straight to the ${ROUND_EN[o.playoffSize] ?? "playoff"}`
          : `${ROUND_EN[o.playoffSize] ?? "Playoff"} needs ${o.wildcards} wildcard spots`,
    recommended: "Recommended",
    series: "After the groups, how many brackets? Series A takes each group's top 2; the next bracket takes everyone else, with byes for the best seeds when the count is uneven.",
    seriesOne: "1 bracket", seriesOneSub: "Only the top 2 of each group go to the playoff",
    seriesMany: (names: string[]) => `${names.length} brackets: ${names.join(" + ")}`,
    optStyle: (s: SeriesStyle): string => (s === "medal" ? "Rename: Series A, B" : "Rename: Gold, Silver"),
    roster: (u: string) => `Do you have the list of ${u}? Paste it and I'll draw the groups now.`,
    pasteNow: "Paste now",
    openRegistration: "Let players sign up",
    later: "Later, I'll type it",
    paste: (d: Draft) => `Paste the list below — one ${d.is_doubles === false ? "player" : "team, like “Nam - Hung”"} per line. A photo or spreadsheet works too.`,
    name: "What's the tournament called?",
    courtsQ: "How many courts do you have? I'll assign courts and times to every match.",
    courtN: (k: number) => `${k} ${k === 1 ? "court" : "courts"}`,
    courtsSkip: "Not sure, skip",
    timeQ: "What time do you start? You can type “7pm” too.",
    timeSkip: "Not sure",
    fCourts: "Courts & time",
    undo: "Undo last step",
    reset: "Start over",
    resetTitle: "Clear everything and start over?",
    resetDesc: "The whole chat and draft will be cleared. Tournaments already created are not affected.",
    resetOk: "Start over",
    customName: "Type another name below",
    options: "Almost done! Anything else?",
    optSeed: "Seeds", optSets: (s: number) => `Sets: ${s === 1 ? "1 game" : `BO${s}`}`, optTeam: "Keep clubs apart",
    optDone: "Done, review",
    hintSeed: (u: string) => `Type the seeded ${u} in order, e.g. “seeds: Nam - Hung, Tu - Long”. Seeds are placed in different groups.`,
    hintTeam: "Tell me which teams share a club, e.g. “Nam - Hung, Tu - Long are Ha Dong club”. I'll keep them in different groups.",
    setsQ: "How many games per match?",
    set1: "1 game", set3: "Best of 3", set5: "Best of 5",
    confirm: "All set. Check it over, then tap Create.",
    received: (n: number, u: string) => `Got ${n} ${u}.`,
    dupWarn: (n: number) => ` ⚠️ ${n} duplicate lines — check the Draft.`,
    aiError: "I didn't catch that — the network or assistant is slow. Try again?",
    retry: "Try again",
    quotaFull: (q: number) => `You already have ${q} round-robin tournaments. Finish or delete one to create another.`,
    myTables: "My tournaments",
    placeholder: "Message or paste a list…",
    send: "Send",
    pasted: (n: number) => `📋 Pasted ${n} lines`,
    showAll: "Show all", collapse: "Collapse",
    draft: "Draft",
    fFormat: "Format", fCount: "Entries", fGroups: "Groups", fRoster: "List", fName: "Name", fExtra: "Options",
    rosterReg: "Players sign up", rosterLater: "Add later",
    empty: "—",
    edit: "Edit",
    removeDup: (n: number) => `Remove ${n} duplicates`,
    addRow: "+ Add a line",
    p1: "Player 1", p2: "Player 2",
    group: (i: number) => `Group ${GROUP_LETTERS[i]}`,
    reshuffle: "Reshuffle groups",
    create: "Create tournament",
    creating: "Creating…",
    confirmReg: "Players sign up through the tournament link — you approve them and draw groups later.",
    confirmLater: "Next you'll enter the list — I'll open the entry page for you.",
    created: (name: string) => `🎉 “${name}” is live!`,
    openTable: "Open tournament",
    enterRoster: "Enter the list",
    copyLink: "Copy link",
    copyZalo: "Copy group-chat message",
    copied: "Copied",
    another: "Create another",
    rosterFailed: "The tournament was created but the groups weren't drawn. Open the entry page to try again.",
    zaloLink: "Schedule & results",
    courts: (c: number[]) => `Courts ${c.join(", ")}`,
    reload: "This chat is saved on this device — reloading won't lose it.",
  },
};
const ROUND_VI: Record<number, string> = { 4: "bán kết", 8: "tứ kết", 16: "vòng 1/8", 32: "vòng 1/16" };
const ROUND_EN: Record<number, string> = { 4: "semifinals", 8: "quarterfinals", 16: "round of 16", 32: "round of 32" };

const uid = () => Math.random().toString(36).slice(2, 10);

const QuickTableChat = () => {
  const { language } = useI18n();
  const lang: Lang = language === "en" ? "en" : "vi";
  const c = COPY[lang];
  const { user, loading: authLoading } = useAuth();

  if (authLoading) return <TheLineLayout title={c.layoutTitle} noindex><div style={{ minHeight: "60vh" }} /></TheLineLayout>;
  if (!user) {
    return (
      <SetupLoginGate
        layoutTitle={c.layoutTitle}
        noindex
        toolLabel={c.toolLabel}
        toolPath="/tools/quick-tables"
        icon={MessageSquareText}
        title={c.loginTitle}
        desc={c.loginDesc}
        loginRedirect="/tools/quick-tables/chat"
      />
    );
  }
  // key theo ngôn ngữ: đổi VI/EN là dựng lại hội thoại bằng ngôn ngữ mới, không lẫn câu.
  return <ChatScreen key={`${user.id}:${lang}`} userId={user.id} lang={lang} />;
};

function ChatScreen({ userId, lang }: { userId: string; lang: Lang }) {
  const c = COPY[lang];
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { createTable, setupRosterAtomic, getUserQuotaInfo } = useQuickTable();
  const storageKey = STORAGE_PREFIX + userId;

  const restored = useMemo(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as { lang?: Lang; draft: Draft; messages: Msg[] }) : null;
    } catch {
      return null;
    }
  }, [storageKey]);

  const [draft, setDraft] = useState<Draft>(restored?.draft ?? {});
  // Hội thoại lưu bằng ngôn ngữ khác → chỉ giữ nháp, hỏi lại bằng ngôn ngữ hiện tại.
  const [messages, setMessages] = useState<Msg[]>(() =>
    restored?.lang === lang && restored.messages?.length ? restored.messages : freshMessages(c, restored?.draft ?? {}));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<Outgoing | null>(null);
  const [subMenu, setSubMenu] = useState<SubMenu>(null);
  const [assignments, setAssignments] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ table: QuickTable; rosterOk: boolean } | null>(null);
  const [quotaFull, setQuotaFull] = useState<number | null>(null);
  const [draftOpen, setDraftOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const slot = nextSlot(draft);
  const unit = c.unit(draft);

  useEffect(() => {
    try {
      if (created) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, JSON.stringify({ lang, draft, messages: messages.slice(-60) }));
    } catch { /* private mode — chat still works, just not restorable */ }
  }, [lang, draft, messages, created, storageKey]);

  useEffect(() => {
    getUserQuotaInfo().then((q) => { if (q && q.current_count >= q.quota) setQuotaFull(q.quota); });
  }, [getUserQuotaInfo]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy, slot, subMenu, created]);

  // Bảng xem trước: tính lại khi danh sách / số bảng đổi, giữ nguyên khi chỉ đổi tên.
  const rosterKey = JSON.stringify([draft.entries, draft.group_count]);
  useEffect(() => {
    setAssignments(draft.entries?.length && draft.group_count ? previewAssignments(draft) : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosterKey]);

  const pushBot = (text: string) => setMessages((m) => [...m, { id: uid(), role: "bot", text }]);

  /** Áp nháp mới rồi hỏi câu tiếp theo (kèm câu xác nhận ngắn nếu có). */
  const advance = useCallback((next: Draft, ack?: string) => {
    setDraft(next);
    setSubMenu(null);
    const q = questionFor(c, next, nextSlot(next));
    setMessages((m) => [...m, { id: uid(), role: "bot", text: [ack?.trim(), q].filter(Boolean).join(" ") }]);
  }, [c]);

  // Quay lại: ảnh chụp nháp + hội thoại trước mỗi lượt người dùng (chỉ trong phiên).
  const history = useRef<Array<{ draft: Draft; messages: Msg[] }>>([]);
  const [canUndo, setCanUndo] = useState(false);
  const snap = () => {
    history.current = [...history.current.slice(-29), { draft, messages }];
    setCanUndo(true);
  };
  const undo = () => {
    const prev = history.current.pop();
    setCanUndo(history.current.length > 0);
    if (!prev) return;
    setDraft(prev.draft);
    setMessages(prev.messages);
    setSubMenu(null);
    setFailed(null);
  };

  const pushUser = (text: string) => {
    snap();
    setMessages((m) => [...m, { id: uid(), role: "user", text }]);
  };

  const choose = (label: string, patch: Partial<Draft>) => {
    pushUser(label);
    advance({ ...draft, ...patch });
  };

  const send = async (out?: Outgoing, isRetry = false) => {
    const msg = out ?? { text: input.trim() };
    if (!msg.text || busy) return;
    // Lệnh gõ tay, xử lý tại chỗ không gọi AI.
    if (!out && !isRetry) {
      const cmd = msg.text.toLocaleLowerCase("vi").replace(/[.!]+$/, "").trim();
      if (/^(làm lại|lam lai|xoá hết|xóa hết|xoa het|reset|start over|restart)$/.test(cmd)) { setInput(""); void resetAll(); return; }
      if (/^(quay lại|quay lai|undo|back)$/.test(cmd)) { setInput(""); undo(); return; }
      const local = localSlotPatch(msg.text, slot);
      if (local) { setInput(""); choose(msg.text, local); return; }
    }
    if (msg.entries?.length) {
      snap();
      setMessages((m) => [...m, { id: uid(), role: "user", text: msg.text, label: msg.label }]);
      // File có cột VĐV 1 + VĐV 2 ở mọi dòng → chắc chắn là giải đôi, khỏi hỏi.
      const doubles = draft.is_doubles === undefined && msg.entries.every((e) => e.p2);
      const next = applyPatch(draft, { entries: msg.entries, ...(doubles ? { is_doubles: true } : {}) });
      const dups = duplicateIndexes(next.entries!).size;
      advance(next, c.received(next.entries!.length, c.unit(next)) + (dups ? c.dupWarn(dups) : ""));
      return;
    }
    if (!isRetry) {
      snap();
      setMessages((m) => [...m, { id: uid(), role: "user", text: msg.text, label: msg.label }]);
      if (!out) setInput("");
    }
    setFailed(null);
    setBusy(true);
    // Thử lại: bỏ tin lỗi + chính tin người dùng đó khỏi lịch sử rồi gửi lại.
    const prior = isRetry ? messages.slice(0, messages.map((m) => m.role).lastIndexOf("user")) : messages;
    const history = [...prior, { role: "user" as const, text: msg.text }]
      .slice(-8)
      .map((m) => ({ role: m.role, text: m.text.slice(0, 4000) }));
    const { data, error } = await supabase.functions.invoke("quick-table-chat", {
      body: { messages: history, draft, pending: slot, lang, attachment: msg.attachment },
      timeout: msg.attachment ? 45_000 : 25_000,
    });
    setBusy(false);
    if (error || !data || typeof data !== "object" || "error" in data) {
      setFailed(msg);
      pushBot(c.aiError);
      return;
    }
    const res = data as { reply: string; intent: string; patch: unknown };
    if (res.intent !== "fill") {
      advance(draft, res.reply);
      return;
    }
    const next = applyPatch(draft, trustPatch(res.patch, msg.text, slot));
    let ack = res.reply;
    const gotList = !draft.entries?.length && !!next.entries?.length;
    if (gotList) {
      ack = c.received(next.entries!.length, c.unit(next));
      const dups = duplicateIndexes(next.entries!).size;
      if (dups) ack += c.dupWarn(dups);
    }
    // Đang ở bước tuỳ chọn mà người dùng gõ hạt giống/sân/CLB → ở lại bước tuỳ chọn.
    advance(next, ack);
  };

  // ---------- chip theo bước ----------
  const chips: Chip[] = (() => {
    if (created || quotaFull != null || busy) return [];
    if (failed) return [{ label: c.retry, onClick: () => send(failed, true) }];
    const n = entryCount(draft);
    switch (slot) {
      case "format":
        return [
          { label: c.doubles, onClick: () => choose(c.doubles, { is_doubles: true }) },
          { label: c.singles, onClick: () => choose(c.singles, { is_doubles: false }) },
        ];
      case "count":
        return [
          ...[8, 12, 16, 24, 32].map((k) => ({ label: String(k), onClick: () => choose(`${k} ${unit}`, { player_count: k }) })),
          { label: c.pasteList, onClick: () => inputRef.current?.focus() },
          { label: c.upload, onClick: () => fileRef.current?.click() },
        ];
      case "too_many":
        return [
          { label: c.classicForm, onClick: () => navigate("/tools/quick-tables") },
          { label: c.changeCount, onClick: () => choose(c.changeCount, { player_count: undefined, entries: undefined, roster_mode: undefined }) },
        ];
      case "pairing": {
        const list = draft.entries!;
        const pair = (mode: PairingMode, label: string) => () =>
          choose(label, { entries: pairEntries(list, mode), pairing_done: true, player_count: mode === "each_line" ? list.length : Math.floor(list.length / 2) });
        if (list.length % 2) {
          const last = list[list.length - 1].p1;
          return [
            { label: c.dropLast(last), onClick: () => choose(c.dropLast(last), { entries: list.slice(0, -1), player_count: list.length - 1 }) },
            { label: c.pairLine, onClick: pair("each_line", c.pairLine) },
          ];
        }
        return [
          { label: c.pairSeq, sub: c.pairSeqSub, onClick: pair("sequential", c.pairSeq) },
          { label: c.pairRandom, onClick: pair("random", c.pairRandom) },
          { label: c.pairLine, onClick: pair("each_line", c.pairLine) },
        ];
      }
      case "mismatch":
        return [
          { label: c.useList(draft.entries!.length, unit), onClick: () => choose(c.useList(draft.entries!.length, unit), { player_count: draft.entries!.length }) },
          { label: c.pasteMore, onClick: () => inputRef.current?.focus() },
          { label: c.upload, onClick: () => fileRef.current?.click() },
        ];
      case "groups":
        return groupOptions(n).map((o) => ({
          label: c.groupLabel(o),
          sub: c.groupSub(o),
          recommended: o.recommended,
          onClick: () => choose(c.groupLabel(o), { group_count: o.groupCount }),
        }));
      case "series": {
        const style = draft.series_style ?? "series";
        return Array.from({ length: seriesCap(draft) }, (_, i) => i + 1).map((k) => {
          const names = Array.from({ length: k }, (_, d) => seriesName(style, d, lang));
          const label = k === 1 ? c.seriesOne : c.seriesMany(names);
          return {
            label,
            sub: k === 1 ? c.seriesOneSub : (seriesPlan(groupSizes(draft), k) ?? []).map((sl, d) => seriesLine(names[d], sl, lang, unit)).join(" · "),
            recommended: k === seriesCap(draft),
            onClick: () => choose(label, { series: k }),
          };
        });
      }
      case "roster":
        return [
          { label: c.pasteNow, onClick: () => choose(c.pasteNow, { roster_mode: "now" }) },
          { label: c.openRegistration, onClick: () => choose(c.openRegistration, { roster_mode: "registration" }) },
          { label: c.later, onClick: () => choose(c.later, { roster_mode: "later" }) },
        ];
      case "paste":
        return [
          { label: c.upload, onClick: () => fileRef.current?.click() },
          { label: c.later, onClick: () => choose(c.later, { roster_mode: "later" }) },
        ];
      case "courts":
        return [
          ...[1, 2, 3, 4, 5, 6, 8].map((k) => ({
            label: c.courtN(k),
            onClick: () => choose(c.courtN(k), { courts: Array.from({ length: k }, (_, i) => i + 1), courts_done: true }),
          })),
          { label: c.courtsSkip, onClick: () => choose(c.courtsSkip, { courts_done: true }) },
        ];
      case "start_time":
        return [
          ...["07:00", "08:00", "09:00", "17:00", "18:00", "19:00"].map((t) => ({ label: t, onClick: () => choose(t, { start_time: t, time_done: true }) })),
          { label: c.timeSkip, onClick: () => choose(c.timeSkip, { time_done: true }) },
        ];
      case "name": {
        const name = defaultName(draft, lang);
        return [{ label: name, onClick: () => choose(name, { name }) }];
      }
      case "options": {
        if (subMenu === "sets") {
          return ([1, 3, 5] as const).map((s) => ({
            label: s === 1 ? c.set1 : s === 3 ? c.set3 : c.set5,
            onClick: () => { pushUser(s === 1 ? c.set1 : s === 3 ? c.set3 : c.set5); setDraft((d) => ({ ...d, default_sets: s })); setSubMenu(null); pushBot(c.options); },
          }));
        }
        const hint = (label: string, text: string) => () => { pushUser(label); pushBot(text); inputRef.current?.focus(); };
        return [
          { label: c.optDone, recommended: true, onClick: () => choose(c.optDone, { options_done: true }) },
          { label: c.optSeed, onClick: hint(c.optSeed, c.hintSeed(unit)) },
          { label: c.optSets(draft.default_sets ?? 1), onClick: () => { pushUser(c.optSets(draft.default_sets ?? 1)); pushBot(c.setsQ); setSubMenu("sets"); } },
          { label: c.optTeam, onClick: hint(c.optTeam, c.hintTeam) },
          ...((draft.series ?? 1) > 1
            ? [{
                label: c.optStyle(draft.series_style ?? "series"),
                onClick: () => {
                  const next: SeriesStyle = draft.series_style === "medal" ? "series" : "medal";
                  pushUser(c.optStyle(draft.series_style ?? "series"));
                  setDraft((d) => ({ ...d, series_style: next }));
                  pushBot(c.options);
                },
              }]
            : []),
        ];
      }
      default:
        return [];
    }
  })();

  // ---------- sửa từ Bản nháp ----------
  const editField = (field: EditField) => {
    setDraftOpen(false);
    snap();
    const d = { ...draft };
    if (field === "format") { d.is_doubles = undefined; d.pairing_done = false; }
    if (field === "count") { d.player_count = undefined; d.entries = undefined; d.roster_mode = undefined; d.group_count = undefined; d.series = undefined; }
    if (field === "groups") { d.group_count = undefined; d.series = undefined; }
    if (field === "roster") { d.entries = undefined; d.roster_mode = undefined; d.options_done = false; }
    if (field === "name") d.name = undefined;
    if (field === "extra") d.options_done = false;
    if (field === "courts") { d.courts = undefined; d.start_time = undefined; d.courts_done = false; d.time_done = false; }
    advance(d);
  };

  const setEntries = (entries: Entry[]) => setDraft((d) => ({ ...d, entries, player_count: entries.length }));

  // ---------- tạo giải ----------
  const create = async () => {
    if (creating || slot !== "confirm") return;
    setCreating(true);
    const n = entryCount(draft);
    const table = await createTable(draft.name!, n, "round_robin", draft.group_count, {
      is_doubles: draft.is_doubles !== false,
      requires_registration: draft.roster_mode === "registration",
    });
    if (!table) { setCreating(false); return; } // createTable đã toast lỗi (quota/auth)
    const series = Math.min(draft.series ?? 1, seriesCap(draft));
    // Có danh sách → setupRosterAtomic lưu sân + xếp lịch; chưa có → lưu sẵn lên giải cho bước nhập sau.
    const courtsOnTable = !draft.entries?.length && !!draft.courts?.length;
    if ((draft.default_sets ?? 1) > 1 || series > 1 || courtsOnTable) {
      await supabase.from("quick_tables").update({
        ...((draft.default_sets ?? 1) > 1 ? { default_sets: draft.default_sets } : {}),
        ...(courtsOnTable ? { courts: draft.courts!.map(String), start_time: draft.start_time ?? null } : {}),
        ...(series > 1 ? { playoff_series: series, playoff_series_style: draft.series_style ?? "series" } : {}),
      } as never).eq("id", table.id);
    }
    let rosterOk = true;
    if (draft.entries?.length) {
      rosterOk = await setupRosterAtomic(
        table.id,
        buildRoster(draft),
        draft.group_count ?? 1,
        assignments.length === draft.entries.length ? assignments : undefined,
        draft.courts ?? [],
        draft.start_time ?? null,
      );
    }
    setCreating(false);
    setCreated({ table, rosterOk });
  };

  const tableUrl = created ? `${getSiteUrl()}/tools/quick-tables/${created.table.share_id}` : "";
  const groupsList = useMemo(() => {
    const k = draft.group_count ?? 1;
    const out: Entry[][] = Array.from({ length: k }, () => []);
    (draft.entries ?? []).forEach((e, i) => out[assignments[i] ?? 0]?.push(e));
    return out;
  }, [draft.entries, draft.group_count, assignments]);

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(c.copied); } catch { /* clipboard bị chặn */ }
  };
  const zaloText = () => [
    `🏓 ${draft.name}`,
    ...(draft.entries?.length ? groupsList.map((g, i) => `${c.group(i)}: ${g.map(entryLabel).join(", ")}`) : []),
    `${c.zaloLink}: ${tableUrl}`,
  ].join("\n");

  const onFile = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = "";
    if (!file || busy) return;
    if (file.size > MAX_UPLOAD_BYTES) { toast.error(c.fileTooBig); return; }
    let out: Outgoing;
    try { out = await readUpload(file); } catch { toast.error(c.fileUnreadable); return; }
    send(out);
  };

  const startOver = () => {
    setCreated(null);
    setDraft({});
    setMessages(freshMessages(c, {}));
    setSubMenu(null);
    setFailed(null);
    setInput("");
    history.current = [];
    setCanUndo(false);
  };

  const resetAll = async () => {
    if (await confirm({ title: c.resetTitle, description: c.resetDesc, confirmText: c.resetOk, destructive: true })) startOver();
  };

  const quotaMsg = quotaFull != null ? c.quotaFull(quotaFull) : null;
  const filled = [draft.is_doubles !== undefined, entryCount(draft) > 0, !!draft.group_count && slot !== "groups", !!draft.name].filter(Boolean).length;

  return (
    <TheLineLayout title={c.layoutTitle} noindex active="lab">
      <div className="tl-shell" style={{ maxWidth: 680, minHeight: "calc(100dvh - 64px)", display: "flex", flexDirection: "column" }}>
        {/* header */}
        <header style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0" }}>
          <Button asChild variant="ghost" size="icon" aria-label={lang === "vi" ? "Quay lại" : "Back"}>
            <Link to="/tools/quick-tables"><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <h1 style={{ flex: 1, margin: 0, fontSize: 17, fontWeight: 600, color: "var(--tl-fg)", display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles className="w-4 h-4" style={{ color: "var(--tl-green)" }} /> {c.title}
          </h1>
          {!created && (
            <>
              <Button variant="ghost" size="icon" onClick={undo} disabled={!canUndo || busy || creating} aria-label={c.undo} title={c.undo}>
                <Undo2 className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => void resetAll()} disabled={busy || creating} aria-label={c.reset} title={c.reset}>
                <RotateCcw className="w-5 h-5" />
              </Button>
            </>
          )}
        </header>

        {/* bản nháp dính trên cùng */}
        {!created && (
          <section
            style={{ position: "sticky", top: "calc(env(safe-area-inset-top) + 61px + 8px)", zIndex: 5, background: "var(--tl-bg-elev)", border: "1px solid var(--tl-border)", borderRadius: "var(--tl-radius-lg)" }}
          >
            <button
              type="button"
              onClick={() => setDraftOpen((o) => !o)}
              aria-expanded={draftOpen}
              style={{ width: "100%", minHeight: 44, display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", background: "transparent", border: 0, color: "var(--tl-fg)", cursor: "pointer" }}
            >
              <span style={{ fontWeight: 600, fontSize: 14 }}>{c.draft}</span>
              <span aria-hidden style={{ display: "flex", gap: 4 }}>
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} style={{ width: 8, height: 8, borderRadius: 4, background: i < filled ? "var(--tl-green)" : "var(--tl-border)" }} />
                ))}
              </span>
              <span style={{ fontSize: 13, color: "var(--tl-fg-3)" }}>{filled}/4</span>
              <span style={{ flex: 1, textAlign: "left", fontSize: 13, color: "var(--tl-fg-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {draft.name ?? ""}
              </span>
              <ChevronDown className={cn("w-4 h-4 transition-transform", draftOpen && "rotate-180")} />
            </button>
            {draftOpen && (
              <DraftPanel draft={draft} c={c} lang={lang} onEdit={editField} onEntries={setEntries} />
            )}
          </section>
        )}

        {/* hội thoại */}
        <div role="log" aria-live="polite" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, padding: "16px 0" }}>
          {messages.map((m) => <Bubble key={m.id} msg={m} c={c} />)}
          {quotaMsg && <Bubble msg={{ id: "quota", role: "bot", text: quotaMsg }} c={c} />}
          {busy && (
            <div aria-label="…" style={{ alignSelf: "flex-start", padding: "10px 14px", borderRadius: 16, background: "var(--tl-bg-elev)", border: "1px solid var(--tl-border)" }}>
              <span className="inline-flex gap-1">
                {[0, 1, 2].map((i) => <span key={i} className="animate-pulse" style={{ width: 6, height: 6, borderRadius: 3, background: "var(--tl-fg-3)", animationDelay: `${i * 150}ms` }} />)}
              </span>
            </div>
          )}

          {slot === "confirm" && !created && !busy && (
            <ConfirmCard
              draft={draft} c={c} lang={lang} groups={groupsList} creating={creating}
              onCreate={create}
              onEdit={() => setDraftOpen(true)}
              onReshuffle={() => setAssignments(previewAssignments(draft))}
            />
          )}

          {created && (
            <SuccessCard
              c={c} name={draft.name ?? created.table.name} rosterOk={created.rosterOk}
              needsRoster={!draft.entries?.length && draft.roster_mode !== "registration"}
              onOpen={() => navigate(`/tools/quick-tables/${created.table.share_id}`)}
              onRoster={() => navigate(`/tools/quick-tables/${created.table.share_id}/setup`)}
              onCopyLink={() => copy(tableUrl)}
              onCopyZalo={() => copy(zaloText())}
              onAnother={startOver}
            />
          )}
          {quotaMsg && (
            <div><Button variant="outline" onClick={() => navigate("/tools/quick-tables")}>{c.myTables}</Button></div>
          )}
          <div ref={endRef} />
        </div>

        {/* chip + ô nhập */}
        {!created && quotaFull == null && (
          <div style={{ position: "sticky", bottom: 0, background: "var(--tl-bg)", paddingBottom: "max(12px, env(safe-area-inset-bottom))", paddingTop: 8 }}>
            {chips.length > 0 && <ChipRow chips={chips} />}
            <form
              onSubmit={(e) => { e.preventDefault(); send(); }}
              style={{ display: "flex", gap: 8, alignItems: "flex-end" }}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf,.pdf,.xlsx,.xls,.csv,.tsv,.txt"
                hidden
                onChange={(e) => onFile(e.target.files?.[0])}
              />
              <Button type="button" variant="ghost" size="icon" disabled={busy} onClick={() => fileRef.current?.click()} aria-label={c.uploadAria} title={c.uploadAria} style={{ width: 44, height: 44, flexShrink: 0 }}>
                <Paperclip className="w-4 h-4" />
              </Button>
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={c.placeholder}
                aria-label={c.placeholder}
                rows={1}
                maxLength={4000}
                className="resize-none"
                style={{ minHeight: 44, maxHeight: 160, fontSize: 16, fieldSizing: "content" } as React.CSSProperties}
              />
              <Button type="submit" size="icon" disabled={!input.trim() || busy} aria-label={c.send} style={{ width: 44, height: 44, flexShrink: 0 }}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </form>
            <p style={{ fontSize: 11, color: "var(--tl-fg-3)", margin: "6px 2px 0", display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
              <span>{c.reload}</span>
              <Link to="/tools/quick-tables" style={{ color: "var(--tl-fg-2)", textDecoration: "underline" }}>{c.classicForm}</Link>
            </p>
          </div>
        )}
      </div>
    </TheLineLayout>
  );
}

type C = (typeof COPY)["vi"];
type EditField = "format" | "count" | "groups" | "roster" | "name" | "courts" | "extra";

function seriesLabel(d: Draft, lang: Lang): string | null {
  const k = Math.min(d.series ?? 1, seriesCap(d));
  return k > 1 ? Array.from({ length: k }, (_, i) => seriesName(d.series_style ?? "series", i, lang)).join(" + ") : null;
}

function questionFor(c: C, d: Draft, s: Slot): string {
  const u = c.unit(d);
  const n = entryCount(d);
  switch (s) {
    case "format": return c.format;
    case "count": return c.count(u);
    case "too_many": return c.tooMany(n, u);
    case "pairing": return (d.entries!.length % 2 ? c.pairingOdd : c.pairing)(d.entries!.length);
    case "mismatch": return c.mismatch(d.entries!.length, d.player_count!, u);
    case "groups":
      return (d.group_count ? c.groupsInvalid(d.group_count, u) : c.groups(n, u)) + (n > 32 ? c.groupsBig : "");
    case "series": return c.series;
    case "roster": return c.roster(u);
    case "paste": return c.paste(d);
    case "name": return c.name;
    case "courts": return c.courtsQ;
    case "start_time": return c.timeQ;
    case "options": return c.options;
    case "confirm": return c.confirm;
  }
}

/** Hội thoại mới bằng đúng ngôn ngữ đang chọn; nháp dở thì hỏi tiếp câu còn thiếu. */
function freshMessages(c: C, d: Draft): Msg[] {
  const first: Msg = { id: uid(), role: "bot", text: c.welcome };
  const s = nextSlot(d);
  return s === "format" ? [first] : [first, { id: uid(), role: "bot", text: questionFor(c, d, s) }];
}

async function readAsBase64(blob: Blob): Promise<string> {
  const url = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
  return url.slice(url.indexOf(",") + 1);
}

async function imageToJpeg(file: File): Promise<Attachment> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  if (!blob) throw new Error("encode_failed");
  return { mime_type: "image/jpeg", data: await readAsBase64(blob) };
}

/** Ảnh/PDF → Gemini đọc; bảng tính/văn bản → đọc tại chỗ thành chữ (tab giữa các cột). */
async function readUpload(file: File): Promise<Outgoing> {
  if (file.type.startsWith("image/")) return { text: `🖼️ ${file.name}`, attachment: await imageToJpeg(file) };
  if (file.type === "application/pdf") return { text: `📎 ${file.name}`, attachment: { mime_type: "application/pdf", data: await readAsBase64(file) } };
  if (!SHEET_EXT.test(file.name)) throw new Error("unsupported");
  let text: string;
  let entries: Entry[] = [];
  if (/\.(xlsx|xls|csv|tsv)$/i.test(file.name)) {
    const XLSX = await import("xlsx/dist/xlsx.mini.min.js");
    const wb = /\.(xlsx|xls)$/i.test(file.name) ? XLSX.read(await file.arrayBuffer()) : XLSX.read(await file.text(), { type: "string" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    entries = parseSheet(XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, blankrows: false, defval: "" }));
    text = XLSX.utils.sheet_to_csv(sheet, { FS: "\t", blankrows: false });
  } else {
    text = await file.text();
  }
  text = text.trim().slice(0, 4000);
  if (!text) throw new Error("empty");
  // Nhận ra ≥ 2 dòng thì dùng luôn; không thì để AI đọc chữ.
  return { text, label: `📎 ${file.name}`, ...(entries.length >= 2 ? { entries: entries.slice(0, 200) } : {}) };
}


function Bubble({ msg, c }: { msg: Msg; c: C }) {
  const lines = msg.text.split("\n");
  const long = msg.role === "user" && (lines.length > PASTE_COLLAPSE_LINES || !!msg.label);
  const head = msg.label ?? c.pasted(lines.filter((l) => l.trim()).length);
  const [open, setOpen] = useState(false);
  const mine = msg.role === "user";
  return (
    <div
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "85%",
        padding: "10px 14px",
        borderRadius: 16,
        borderBottomRightRadius: mine ? 4 : 16,
        borderBottomLeftRadius: mine ? 16 : 4,
        background: mine ? "var(--tl-green)" : "var(--tl-bg-elev)",
        color: mine ? "var(--tl-bg)" : "var(--tl-fg)",
        border: mine ? 0 : "1px solid var(--tl-border)",
        fontSize: 15,
        lineHeight: 1.45,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {long && !open ? head : msg.text}
      {long && (
        <button type="button" onClick={() => setOpen((o) => !o)} style={{ display: "block", marginTop: 4, background: "none", border: 0, padding: 0, color: "inherit", textDecoration: "underline", fontSize: 13, cursor: "pointer", opacity: 0.85 }}>
          {open ? c.collapse : c.showAll}
        </button>
      )}
    </div>
  );
}

function ChipRow({ chips }: { chips: Chip[] }) {
  const big = chips.some((ch) => ch.sub);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: big ? "column" : "row",
        gap: 8,
        overflowX: big ? undefined : "auto",
        paddingBottom: 8,
        scrollbarWidth: "none",
      }}
    >
      {chips.map((ch) => (
        <button
          key={ch.label}
          type="button"
          onClick={ch.onClick}
          style={{
            flexShrink: 0,
            minHeight: 44,
            padding: big ? "10px 14px" : "0 16px",
            borderRadius: big ? "var(--tl-radius)" : 22,
            border: `1px solid ${ch.recommended ? "var(--tl-green)" : "var(--tl-border)"}`,
            background: ch.recommended ? "var(--tl-green-glow)" : "var(--tl-bg-elev)",
            color: "var(--tl-fg)",
            fontSize: 14.5,
            fontWeight: 500,
            textAlign: "left",
            cursor: "pointer",
            whiteSpace: big ? "normal" : "nowrap",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {ch.recommended && big && <span aria-hidden>⭐</span>}
            {ch.label}
          </span>
          {ch.sub && <span style={{ display: "block", fontSize: 12.5, color: "var(--tl-fg-3)", fontWeight: 400, marginTop: 2 }}>{ch.sub}</span>}
        </button>
      ))}
    </div>
  );
}

function DraftPanel({ draft, c, lang, onEdit, onEntries }: {
  draft: Draft; c: C; lang: Lang;
  onEdit: (f: EditField) => void;
  onEntries: (e: Entry[]) => void;
}) {
  const n = entryCount(draft);
  const extras = [
    (draft.default_sets ?? 1) > 1 ? `BO${draft.default_sets}` : null,
    draft.entries?.some((e) => e.seed) ? c.optSeed : null,
  ].filter(Boolean).join(" · ");
  const rows: Array<[string, string, Parameters<typeof onEdit>[0]]> = [
    [c.fFormat, draft.is_doubles === undefined ? c.empty : draft.is_doubles ? c.doubles : c.singles, "format"],
    [c.fCount, n ? `${n} ${c.unit(draft)}` : c.empty, "count"],
    [c.fGroups, draft.group_count && n ? (groupOptions(n).find((o) => o.groupCount === draft.group_count) ? [c.groupLabel(groupOptions(n).find((o) => o.groupCount === draft.group_count)!), seriesLabel(draft, lang)].filter(Boolean).join(" · ") : c.empty) : c.empty, "groups"],
    [c.fRoster, draft.entries?.length ? `${draft.entries.length} ${c.unit(draft)}` : draft.roster_mode === "registration" ? c.rosterReg : draft.roster_mode === "later" ? c.rosterLater : c.empty, "roster"],
    [c.fName, draft.name ?? c.empty, "name"],
    [c.fCourts, draft.courts?.length ? [c.courts(draft.courts), draft.start_time].filter(Boolean).join(" · ") : c.empty, "courts"],
    [c.fExtra, extras || c.empty, "extra"],
  ];
  return (
    <div style={{ borderTop: "1px solid var(--tl-border)", padding: "6px 14px 12px", maxHeight: "60dvh", overflowY: "auto" }}>
      {rows.map(([label, value, field]) => (
        <div key={field} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 40, fontSize: 14 }}>
          <span style={{ width: 92, color: "var(--tl-fg-3)", flexShrink: 0 }}>{label}</span>
          <span style={{ flex: 1, color: "var(--tl-fg)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{value}</span>
          {value !== c.empty && (
            <Button variant="ghost" size="sm" onClick={() => onEdit(field)} aria-label={`${c.edit} ${label}`}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      ))}
      {!!draft.entries?.length && <EntriesEditor entries={draft.entries} doubles={draft.is_doubles !== false} c={c} onChange={onEntries} />}
    </div>
  );
}

function EntriesEditor({ entries, doubles, c, onChange }: { entries: Entry[]; doubles: boolean; c: C; onChange: (e: Entry[]) => void }) {
  const dups = duplicateIndexes(entries);
  const update = (i: number, patch: Partial<Entry>) => onChange(entries.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  return (
    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
      {dups.size > 0 && (
        <Button variant="outline" size="sm" onClick={() => onChange(entries.filter((_, i) => !dups.has(i)))}>
          <TriangleAlert className="w-3.5 h-3.5" /> {c.removeDup(dups.size)}
        </Button>
      )}
      {entries.map((e, i) => (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ width: 22, fontSize: 12, color: dups.has(i) ? "hsl(var(--destructive))" : "var(--tl-fg-3)", textAlign: "right" }}>
            {dups.has(i) ? "⚠️" : i + 1}
          </span>
          <Input value={e.p1} onChange={(ev) => update(i, { p1: ev.target.value })} aria-label={`${c.p1} ${i + 1}`} className="h-9" style={{ fontSize: 16 }} />
          {doubles && (
            <Input value={e.p2 ?? ""} onChange={(ev) => update(i, { p2: ev.target.value || undefined })} aria-label={`${c.p2} ${i + 1}`} className="h-9" style={{ fontSize: 16 }} />
          )}
          <Button variant="ghost" size="icon" onClick={() => onChange(entries.filter((_, j) => j !== i))} aria-label={`${c.edit} ${i + 1}`} style={{ width: 36, height: 36, flexShrink: 0 }}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}
      {entries.length < MAX_CHAT_ENTRIES && (
        <Button variant="ghost" size="sm" onClick={() => onChange([...entries, { p1: "" }])}>{c.addRow}</Button>
      )}
    </div>
  );
}

function ConfirmCard({ draft, c, lang, groups, creating, onCreate, onEdit, onReshuffle }: {
  draft: Draft; c: C; lang: Lang; groups: Entry[][]; creating: boolean;
  onCreate: () => void; onEdit: () => void; onReshuffle: () => void;
}) {
  const n = entryCount(draft);
  const invalidRows = draft.entries?.some((e) => !e.p1.trim()) ?? false;
  const meta = [
    draft.is_doubles === false ? c.singles : c.doubles,
    `${n} ${c.unit(draft)}`,
    groupOptions(n).find((o) => o.groupCount === draft.group_count) ? c.groupLabel(groupOptions(n).find((o) => o.groupCount === draft.group_count)!) : null,
    seriesLabel(draft, lang),
    draft.default_sets && draft.default_sets > 1 ? `BO${draft.default_sets}` : null,
    draft.courts?.length ? c.courts(draft.courts) : null,
    draft.start_time ?? null,
  ].filter(Boolean).join(" · ");
  return (
    <div style={{ background: "var(--tl-bg-elev)", border: "1px solid var(--tl-green)", borderRadius: "var(--tl-radius-lg)", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Trophy className="w-4 h-4" style={{ color: "var(--tl-green)" }} />
          <strong style={{ fontSize: 17, color: "var(--tl-fg)" }}>{draft.name}</strong>
        </div>
        <div style={{ fontSize: 13, color: "var(--tl-fg-3)", marginTop: 4 }}>{meta}</div>
      </div>
      {draft.entries?.length ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
            {groups.map((g, i) => (
              <div key={i} style={{ border: "1px solid var(--tl-border)", borderRadius: "var(--tl-radius)", padding: "8px 10px" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--tl-green)", marginBottom: 4 }}>{c.group(i)}</div>
                {g.map((e, j) => (
                  <div key={j} style={{ fontSize: 13, color: "var(--tl-fg-2)", lineHeight: 1.5 }}>
                    {e.seed ? <span title={c.optSeed}>★ </span> : null}{entryLabel(e)}
                  </div>
                ))}
              </div>
            ))}
          </div>
          {(draft.group_count ?? 1) > 1 && (
            <Button variant="ghost" size="sm" onClick={onReshuffle} style={{ alignSelf: "flex-start" }}>
              <Shuffle className="w-3.5 h-3.5" /> {c.reshuffle}
            </Button>
          )}
        </>
      ) : (
        <p style={{ fontSize: 14, color: "var(--tl-fg-2)", margin: 0 }}>
          {draft.roster_mode === "registration" ? c.confirmReg : c.confirmLater}
        </p>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="default" onClick={onCreate} disabled={creating || invalidRows} style={{ flex: 1, minHeight: 44 }}>
          {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> {c.creating}</> : <><Check className="w-4 h-4" /> {c.create}</>}
        </Button>
        <Button variant="outline" onClick={onEdit} style={{ minHeight: 44 }}>
          <Pencil className="w-4 h-4" /> {c.edit}
        </Button>
      </div>
    </div>
  );
}

function SuccessCard({ c, name, rosterOk, needsRoster, onOpen, onRoster, onCopyLink, onCopyZalo, onAnother }: {
  c: C; name: string; rosterOk: boolean; needsRoster: boolean;
  onOpen: () => void; onRoster: () => void; onCopyLink: () => void; onCopyZalo: () => void; onAnother: () => void;
}) {
  const goRoster = needsRoster || !rosterOk;
  return (
    <div style={{ background: "var(--tl-green-glow)", border: "1px solid var(--tl-green)", borderRadius: "var(--tl-radius-lg)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <strong style={{ fontSize: 17, color: "var(--tl-fg)" }}>{c.created(name)}</strong>
      {!rosterOk && <p style={{ margin: 0, fontSize: 14, color: "var(--tl-fg-2)" }}>{c.rosterFailed}</p>}
      <Button variant="default" onClick={goRoster ? onRoster : onOpen} style={{ minHeight: 44 }}>
        {goRoster ? c.enterRoster : c.openTable}
      </Button>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button variant="outline" onClick={onCopyLink} style={{ flex: 1, minHeight: 44 }}><Copy className="w-4 h-4" /> {c.copyLink}</Button>
        {rosterOk && !needsRoster && (
          <Button variant="outline" onClick={onCopyZalo} style={{ flex: 1, minHeight: 44 }}><Copy className="w-4 h-4" /> {c.copyZalo}</Button>
        )}
      </div>
      <Button variant="ghost" onClick={onAnother}>{c.another}</Button>
    </div>
  );
}

export default QuickTableChat;
