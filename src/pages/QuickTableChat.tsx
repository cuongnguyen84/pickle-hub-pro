/**
 * /tools/quick-tables/chat — tạo giải chia bảng bằng hội thoại.
 *
 * Chip bấm được xử lý tại chỗ (không gọi AI, tức thì, không tốn credit). Chỉ
 * tin nhắn gõ tự do mới đi qua edge function quick-table-chat, và nó chỉ trả
 * về bản vá nháp. Câu hỏi tiếp theo do nextSlot() quyết, giải được tạo bằng
 * đúng createTable + setupRosterAtomic của wizard cũ.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, ChevronDown, Loader2, MessageSquareText, Paperclip, Pencil, RotateCcw, Send, Shuffle, Sparkles, Trash2, TriangleAlert, Trophy, Undo2 } from "lucide-react";
import { QuickTableShareActions } from "@/components/quicktable/QuickTableShareActions";
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
import { localePath } from "@/lib/locale-path";
import { cn } from "@/lib/utils";
import { rankSeriesSizes, seriesLine, seriesName, seriesPlan, slot as seriesSlot, type SeriesStyle } from "@/lib/quick-table-series";
import {
  applyPatch, applySpokenEdit, buildRoster, chatFacts, customSeries, defaultName, draftSeriesPlan, dropInventedRoster, duplicateIndexes, entryCount, entryLabel, factualAck, findGroupOption, googleSheetRef, groupChoices, groupSuggestion,
  fallbackReply, groupCourtsLine, mergeTm, nextTmSlot, tmAnswer, tmDefaultName, tmKnockoutOk, tmPlayoffCount, wantsTeamMatch, divisionsAsked, divisionBase, nextDivisionDraft, teamLists, pairTeamLists, type TeamList, groupSizes, keepOrAssign, localSlotPatch, lockAdvance, looksLikeNameList, MAX_CHAT_ENTRIES, mergeRoster, messageNeedsModel, needsPairing, nextSlot, pairEntries, parseSheet, playoffSummary, previewAssignments, replyFromDraft, seriesCap, trustPatch,
  type Draft, type Entry, type GroupOption, type PairingMode, type Slot, type TmDraft, type TmFormat,
} from "@/lib/quick-table-chat";
import { createTeamMatchTournament } from "@/hooks/useTeamMatch";
import { getDefaultTemplates } from "@/lib/team-match-templates";
import { toast } from "@/hooks/use-toast";

type Lang = "vi" | "en";
/** label: thứ hiện trên bong bóng khi khác nội dung gửi AI (vd tên file thay cho cả bảng CSV). */
interface Msg { id: string; role: "user" | "bot"; text: string; label?: string }
interface Divisions { labels: string[]; done: number }
/** Ảnh/PDF gửi kèm cho Gemini đọc — chỉ nằm trong request, không lưu localStorage. */
interface Attachment { mime_type: string; data: string }
/** entries: bảng tính đọc được tại chỗ → vào nháp luôn, không gọi AI. append: gộp vào danh sách đang có. */
interface Outgoing { text: string; label?: string; attachment?: Attachment; attachments?: Attachment[]; entries?: Entry[]; append?: boolean; echoed?: boolean }
interface Chip { label: string; sub?: string; recommended?: boolean; onClick: () => void }
type SubMenu = null | "sets";

const GROUP_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const STORAGE_PREFIX = "qt-chat:v1:";
const PASTE_COLLAPSE_LINES = 4;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_SIDE = 1600; // đủ nét để đọc tên, base64 ~300 KB
const MAX_IMAGES = 4;
const SHEET_EXT = /\.(xlsx|xls|csv|tsv|txt)$/i;

const COPY = {
  vi: {
    layoutTitle: "Tạo giải bằng chat AI",
    title: "Tạo giải bằng chat",
    classicForm: "Dùng form thường",
    loginTitle: "Đăng nhập để tạo giải bằng chat",
    loginDesc: "Kể về giải hoặc dán danh sách Zalo — vài giây có bảng đấu.",
    toolLabel: "Chia bảng",
    welcome: "Chào bạn 👋 Kể về giải nhé, ví dụ “CLB tối thứ 7, 16 đôi, 4 bảng”, hoặc dán danh sách, ảnh, Excel, link Sheet.",
    unit: (d: Draft): string => (d.is_doubles === false || needsPairing(d) ? "người" : "đội"),
    format: "Đánh đôi hay đơn?",
    doubles: "Đôi", singles: "Đơn",
    count: (u: string) => `Bao nhiêu ${u}? Hoặc dán luôn danh sách.`,
    pasteList: "Dán danh sách",
    upload: "Tải ảnh / file",
    uploadAria: "Tải ảnh hoặc file danh sách",
    fileUnreadable: "Không đọc được file. Thử ảnh, Excel, CSV, PDF hoặc link Google Sheet.",
    fileTooBig: "File quá 4 MB.",
    fileTooMany: "Tối đa 4 ảnh mỗi lần — mình lấy 4 ảnh đầu.",
    oneFile: "Mỗi lần một file bảng tính.",
    fileNotList: "Chưa thấy cặp tên. Đánh đôi: mỗi dòng hai người (Nam - Hùng) hoặc hai cột tên.",
    sheetPrivate: "Không mở được Sheet. Đặt quyền “Bất kỳ ai có đường liên kết” rồi gửi lại.",
    sheetUnreadable: "Link không mở được hoặc sheet trống.",
    sheetLabel: "📊 Google Sheet",
    added: (n: number, total: number, u: string) => `Đã thêm ${n} ${u}, tổng ${total}. Sửa tên ở Bản nháp.`,
    alreadyThere: "Các tên này đã có trong Bản nháp.",
    capped: ` Danh sách dừng ở ${MAX_CHAT_ENTRIES}.`,
    tooMany: (n: number, u: string) => `Chat tạo tối đa ${MAX_CHAT_ENTRIES} ${u}. Giải ${n} ${u} dùng form thường.`,
    changeCount: "Sửa số lượng",
    pairing: (n: number) => `Mình thấy ${n} tên lẻ. Ghép thành đôi thế nào?`,
    pairingOdd: (n: number) => `Mình thấy ${n} tên lẻ — thừa 1 người. Gõ thêm 1 tên, hoặc:`,
    pairSeq: "Ghép theo thứ tự", pairSeqSub: "1+2, 3+4…",
    pairRandom: "Ghép ngẫu nhiên",
    pairLine: "Mỗi dòng là 1 đội",
    dropLast: (name: string) => `Bỏ “${name}”`,
    mismatch: (m: number, n: number, u: string) => `Danh sách có ${m} ${u}, bạn nói ${n}. Lấy theo danh sách hay dán thêm?`,
    useList: (m: number, u: string) => `Lấy ${m} ${u}`,
    pasteMore: "Dán thêm",
    groups: (n: number, u: string) => `${n} ${u} chia thế nào?`,
    suggestGroups: (d: Draft) => groupSuggestion(d, "vi"),
    groupsInvalid: (k: number, u: string) => `Không chia được ${k} bảng (3–8 ${u}/bảng, tối đa 16 bảng). Chọn:`,
    groupsBig: " Giải đông, nhiều bảng xong nhanh hơn.",
    groupLabel: (o: GroupOption) => (o.groupCount === 1 ? "1 bảng vòng tròn" : `${o.groupCount} bảng × ${o.sizes[0] === o.sizes[o.sizes.length - 1] ? o.sizes[0] : `${o.sizes[o.sizes.length - 1]}–${o.sizes[0]}`}`),
    groupSub: (o: GroupOption, u: string) =>
      o.groupCount === 1
        ? "Ai cũng gặp nhau, xếp theo thắng thua"
        : `2 ${u} đứng đầu mỗi bảng đi tiếp`,
    recommended: "Khuyên dùng",
    series: (u: string) => `Sau vòng bảng? Một vòng: 2 ${u} đầu mỗi bảng. Nhiều vòng: mạnh vào vòng đầu, còn lại vòng sau.`,
    seriesOne: "Một vòng loại", seriesOneSub: (u: string) => `2 ${u} đứng đầu mỗi bảng đi tiếp`,
    seriesMany: (names: string[]) => `${names.length} vòng: ${names.join(" + ")}`,
    seriesByRank: "Mỗi hạng một vòng",
    optStyle: (s: SeriesStyle): string => (s === "medal" ? "Đổi tên: Vòng loại 1, 2" : "Đổi tên: Vàng, Bạc"),
    roster: (u: string) => `Đã có danh sách ${u} chưa?`,
    pasteNow: "Dán danh sách tên",
    openRegistration: "Để người chơi tự đăng ký",
    later: "Tạo giải, nhập tên sau",
    paste: (d: Draft) => `Dán danh sách bên dưới — mỗi dòng 1 ${d.is_doubles === false ? "người" : "đội, kiểu “Nam - Hùng”"}.`,
    name: "Đặt tên giải là gì?",
    courtsQ: "Có mấy sân? Mình tự xếp sân, giờ.",
    courtN: (k: number) => `${k} sân`,
    courtsSkip: "Chưa biết, bỏ qua",
    timeQ: "Mấy giờ bắt đầu? Bấm nút hoặc gõ “7h tối”.",
    timeNow: "Bây giờ",
    timeLater: "Để sau",
    timeSkip: "Chưa biết",
    fCourts: "Sân & giờ",
    undo: "Quay lại bước trước",
    reset: "Làm lại từ đầu",
    resetTitle: "Xoá hết và làm lại?",
    resetDesc: "Xoá hội thoại và bản nháp. Giải đã tạo vẫn giữ.",
    resetOk: "Làm lại",
    customName: "Gõ tên khác ở ô bên dưới",
    options: "Gần xong! Thêm gì nữa không?",
    optSeed: "Người giỏi khác bảng", optSets: (s: number) => (s === 1 ? "Mỗi trận 1 set" : `Thắng ${Math.ceil(s / 2)} trong ${s} set`), optTeam: "Cùng CLB khác bảng",
    optDone: "Xong, xem lại",
    hintSeed: (u: string) => `Gõ ${u} giỏi theo thứ tự, ví dụ “người giỏi: Nam, Hùng” — mình xếp khác bảng.`,
    hintTeam: "Gõ người cùng CLB, ví dụ “Nam, Hùng cùng CLB Hà Đông” — mình xếp khác bảng.",
    setsQ: "Mỗi trận đánh mấy set?",
    set1: "1 set", set3: "Thắng 2 trong 3 set", set5: "Thắng 3 trong 5 set",
    confirm: "Sẵn sàng. Kiểm tra rồi bấm Tạo giải nhé.",
    received: (n: number, u: string) => `Đã nhận ${n} ${u}.`,
    dupWarn: (n: number) => ` ⚠️ Có ${n} dòng trùng — xem lại trong Bản nháp.`,
    aiError: "Mạng hoặc trợ lý đang chậm. Thử lại nhé?",
    thinking: "Đang đọc tin nhắn…",
    thinkingSchedule: "Đang xếp lịch…",
    thinkingAlmost: "Sắp xong rồi…",
    thinkingRetry: "Hơi chậm, thử lại lần nữa…",
    rephrase: "Chưa đổi được. Bấm nút bên dưới hoặc nói cách khác nhé.",
    attachmentNoList: "Chưa thấy tên trong file. Ảnh cần rõ từng dòng, hoặc dán chữ.",
    photoMissed: (n: number) => (n === 1 ? " Một ảnh chưa thấy tên." : ` ${n} ảnh chưa thấy tên.`),
    retry: "Thử lại",
    quotaFull: (q: number) => `Bạn đã có đủ ${q} giải chia bảng. Kết thúc hoặc xoá giải cũ nhé.`,
    myTables: "Xem giải của tôi",
    placeholder: "Nhắn hoặc dán danh sách…",
    send: "Gửi",
    pasted: (n: number) => `📋 Đã dán ${n} dòng`,
    showAll: "Xem hết", collapse: "Thu gọn",
    draft: "Bản nháp",
    draftReady: "Đã đủ",
    draftMissing: (n: number) => `Còn thiếu ${n}`,
    fFormat: "Thể thức", fCount: "Số lượng", fGroups: "Chia bảng", fRoster: "Danh sách", fName: "Tên giải", fExtra: "Tuỳ chọn",
    rosterReg: "Người chơi tự đăng ký", rosterLater: "Nhập sau",
    empty: "—",
    edit: "Sửa",
    removeDup: (n: number) => `Xoá ${n} dòng trùng`,
    addRow: "+ Thêm dòng",
    p1: "Người 1", p2: "Người 2",
    group: (i: number) => `Bảng ${GROUP_LETTERS[i]}`,
    reshuffle: "Trộn lại bảng",
    create: "Tạo giải",
    creating: "Đang xếp bảng và lịch…",
    confirmReg: "Người chơi tự đăng ký qua link — bạn duyệt rồi xếp bảng sau.",
    confirmLater: "Bước tiếp: nhập danh sách.",
    created: (name: string) => `🎉 Đã tạo “${name}”!`,
    openTable: "Mở giải",
    enterRoster: "Nhập danh sách",
    copyLink: "Sao chép link",
    copyZalo: "Sao chép tin nhắn Zalo",
    sendZalo: "Gửi qua Zalo",
    copied: "Đã copy",
    endTable: "Kết thúc giải",
    deleteTable: "Xoá giải",
    another: "Tạo giải khác",
    divOffer: (label: string, name: string) => `Tạo luôn giải hạng ${label} — “${name}”? Mình giữ thể thức, sân, giờ; danh sách dùng chung hay nhập riêng?`,
    divSame: (label: string) => `Tạo ${label} — cùng danh sách`,
    divNew: (label: string) => `Tạo ${label} — danh sách khác`,
    divStop: "Thôi, đủ rồi",
    tmIntro: "Kiểu MLP / đổi partner → giải Đồng đội MLP: các đội đấu nhau, mỗi trận vài game đôi.",
    tmTeams: "Có bao nhiêu đội?",
    tmRoster: "Mỗi đội mấy người?",
    tmFormat: "Các đội đấu theo thể thức nào?",
    tmFmt: { round_robin: "Vòng tròn", rr_playoff: "Vòng tròn + playoff", single_elimination: "Loại trực tiếp" } as Record<TmFormat, string>,
    tmPeople: (n: number) => `${n} người/đội`,
    tmConfirm: (d: Required<TmDraft>, fmt: string) => `Đồng đội MLP “${d.name}”: ${d.team_count} đội × ${d.roster} người, ${fmt}. Bấm Tạo giải — ngày, sân, lệ phí chỉnh sau ở trang giải.`,
    tmAuto: "Bạn chọn giúp",
    tmForm: "Dùng form đầy đủ",
    tmBack: "Về giải chia bảng",
    tmCreated: (n: string) => `Đã tạo “${n}”`,
    tmLimit: "Tối đa 3 giải đồng đội. Kết thúc hoặc xoá giải cũ nhé.",
    tmFailed: "Chưa tạo được giải. Thử lại nhé?",
    teamPasteAsk: (l: TeamList[]) => `Mình thấy ${l.length} danh sách: ${l.map((x) => `${x.label} (${x.names.length} người)`).join(", ")}. Làm Đồng đội MLP, hay ghép đôi chia bảng (trong đội hay chéo đội)? Chưa ghép cặp nào; tự ghép thì gõ “Nam - Hùng”.`,
    teamPasteMlp: (n: number) => `Đồng đội MLP: ${n} đội đấu nhau`,
    teamPasteWithin: "Ghép đôi trong cùng đội (theo thứ tự)",
    teamPasteAcross: (a: string, b: string) => `Ghép chéo: 1 người ${a} + 1 người ${b}`,
    rosterFailed: "Đã tạo giải nhưng chưa xếp bảng. Mở trang nhập để thử lại.",
    zaloLink: "Xem lịch & kết quả",
    courts: (c: number[]) => `Sân ${c.join(", ")}`,
    reload: "Hội thoại lưu trên máy này, tải lại không mất.",
  },
  en: {
    layoutTitle: "Create a tournament by chat",
    title: "Create by chat",
    classicForm: "Use the classic form",
    loginTitle: "Sign in to create a tournament by chat",
    loginDesc: "Describe your event or paste a player list — groups in seconds.",
    toolLabel: "Round robin",
    welcome: "Hi 👋 Tell me about your event, e.g. “Saturday club night, 16 doubles teams, 4 groups”, or paste a list, photos, Excel, a Sheet link.",
    unit: (d: Draft): string => (d.is_doubles === false || needsPairing(d) ? "players" : "teams"),
    format: "Doubles or singles?",
    doubles: "Doubles", singles: "Singles",
    count: (u: string) => `How many ${u}? Or paste the list.`,
    pasteList: "Paste a list",
    upload: "Upload photo / file",
    uploadAria: "Upload photos or a list file",
    fileUnreadable: "Couldn't read that file. Try a photo, Excel, CSV, PDF or Google Sheet link.",
    fileTooBig: "File is over 4 MB.",
    fileTooMany: "4 photos at a time — I took the first 4.",
    oneFile: "One spreadsheet at a time.",
    fileNotList: "No name pairs. Doubles: two players per row (Nam - Hung) or two name columns.",
    sheetPrivate: "Can't open this Sheet. Set sharing to “Anyone with the link” and resend.",
    sheetUnreadable: "Link didn't open or sheet is empty.",
    sheetLabel: "📊 Google Sheet",
    added: (n: number, total: number, u: string) => `Added ${n} ${u}, ${total} in total. Fix names in Draft.`,
    alreadyThere: "Those names are already in the draft.",
    capped: ` The list stops at ${MAX_CHAT_ENTRIES}.`,
    tooMany: (n: number, u: string) => `Chat handles up to ${MAX_CHAT_ENTRIES} ${u}. Use the classic form for ${n}.`,
    changeCount: "Change the number",
    pairing: (n: number) => `I see ${n} single names. How should I pair them?`,
    pairingOdd: (n: number) => `I see ${n} single names — one is left over. Type one more name, or:`,
    pairSeq: "Pair in order", pairSeqSub: "1+2, 3+4…",
    pairRandom: "Pair randomly",
    pairLine: "Each line is a team",
    dropLast: (name: string) => `Drop “${name}”`,
    mismatch: (m: number, n: number, u: string) => `The list has ${m} ${u}, but you said ${n}. Go with the list, or paste more?`,
    useList: (m: number, u: string) => `Use ${m} ${u}`,
    pasteMore: "Paste more",
    groups: (n: number, u: string) => `How should ${n} ${u} be split?`,
    suggestGroups: (d: Draft) => groupSuggestion(d, "en"),
    groupsInvalid: (k: number, u: string) => `${k} groups won't work (3–8 ${u} per group, max 16 groups). Pick one:`,
    groupsBig: " Big field — more groups finish faster.",
    groupLabel: (o: GroupOption) => (o.groupCount === 1 ? "1 round-robin group" : `${o.groupCount} groups × ${o.sizes[0] === o.sizes[o.sizes.length - 1] ? o.sizes[0] : `${o.sizes[o.sizes.length - 1]}–${o.sizes[0]}`}`),
    groupSub: (o: GroupOption, u: string) =>
      o.groupCount === 1
        ? "Everyone plays everyone, ranked by wins"
        : `Top 2 ${u} from each group go on`,
    recommended: "Recommended",
    series: (u: string) => `After the groups? One playoff: top 2 ${u} per group. Several: stronger to the first, rest to the next.`,
    seriesOne: "One playoff", seriesOneSub: (u: string) => `Top 2 ${u} from each group go on`,
    seriesMany: (names: string[]) => `${names.length} brackets: ${names.join(" + ")}`,
    seriesByRank: "One bracket per place",
    optStyle: (s: SeriesStyle): string => (s === "medal" ? "Rename: Series A, B" : "Rename: Gold, Silver"),
    roster: (u: string) => `Got the list of ${u}?`,
    pasteNow: "Paste now",
    openRegistration: "Let players sign up",
    later: "Later, I'll type it",
    paste: (d: Draft) => `Paste the list below — one ${d.is_doubles === false ? "player" : "team, like “Nam - Hung”"} per line.`,
    name: "What's the tournament called?",
    courtsQ: "How many courts? I'll assign courts and times.",
    courtN: (k: number) => `${k} ${k === 1 ? "court" : "courts"}`,
    courtsSkip: "Not sure, skip",
    timeQ: "Start time? Tap a button or type “7pm”.",
    timeNow: "Start now",
    timeLater: "Decide later",
    timeSkip: "Not sure",
    fCourts: "Courts & time",
    undo: "Undo last step",
    reset: "Start over",
    resetTitle: "Clear everything and start over?",
    resetDesc: "Clears the chat and draft. Created tournaments stay.",
    resetOk: "Start over",
    customName: "Type another name below",
    options: "Almost done! Anything else?",
    optSeed: "Seeds", optSets: (s: number) => `Sets: ${s === 1 ? "1 game" : `BO${s}`}`, optTeam: "Keep clubs apart",
    optDone: "Done, review",
    hintSeed: (u: string) => `Type seeded ${u} in order, e.g. “seeds: Nam - Hung, Tu - Long” — I'll split them.`,
    hintTeam: "Name same-club teams, e.g. “Nam - Hung, Tu - Long are Ha Dong club” — I'll split them.",
    setsQ: "How many games per match?",
    set1: "1 game", set3: "Best of 3", set5: "Best of 5",
    confirm: "All set. Check it over, then tap Create.",
    received: (n: number, u: string) => `Got ${n} ${u}.`,
    dupWarn: (n: number) => ` ⚠️ ${n} duplicate lines — check the Draft.`,
    aiError: "The network or assistant is slow. Try again?",
    thinking: "Reading your message…",
    thinkingSchedule: "Building the schedule…",
    thinkingAlmost: "Almost done…",
    thinkingRetry: "That was slow, trying once more…",
    rephrase: "Nothing changed. Tap a button or say it another way.",
    attachmentNoList: "No names found. Photos need readable lines, or paste text.",
    photoMissed: (n: number) => (n === 1 ? " One photo had no names." : ` ${n} photos had no names.`),
    retry: "Try again",
    quotaFull: (q: number) => `You have ${q} round-robin tournaments. Finish or delete one first.`,
    myTables: "My tournaments",
    placeholder: "Message or paste a list…",
    send: "Send",
    pasted: (n: number) => `📋 Pasted ${n} lines`,
    showAll: "Show all", collapse: "Collapse",
    draft: "Draft",
    draftReady: "Ready",
    draftMissing: (n: number) => `${n} still missing`,
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
    creating: "Drawing groups and the schedule…",
    confirmReg: "Players sign up via the link — you approve and draw groups later.",
    confirmLater: "Next: enter the list.",
    created: (name: string) => `🎉 “${name}” is live!`,
    openTable: "Open tournament",
    enterRoster: "Enter the list",
    copyLink: "Copy link",
    copyZalo: "Copy Zalo message",
    sendZalo: "Send via Zalo",
    copied: "Copied",
    endTable: "End tournament",
    deleteTable: "Delete tournament",
    another: "Create another",
    divOffer: (label: string, name: string) => `Create the ${label} tournament now — “${name}”? I'll keep the format, courts and time; same player list or a different one?`,
    divSame: (label: string) => `Create ${label} — same list`,
    divNew: (label: string) => `Create ${label} — different list`,
    divStop: "No, that's all",
    tmIntro: "MLP-style / rotating partners → MLP Team Match: teams face off over several doubles games.",
    tmTeams: "How many teams?",
    tmRoster: "How many players per team?",
    tmFormat: "Which format between teams?",
    tmFmt: { round_robin: "Round robin", rr_playoff: "Round robin + playoff", single_elimination: "Single elimination" } as Record<TmFormat, string>,
    tmPeople: (n: number) => `${n} per team`,
    tmConfirm: (d: Required<TmDraft>, fmt: string) => `MLP team match “${d.name}”: ${d.team_count} teams × ${d.roster} players, ${fmt}. Tap Create — date, venue, fees go on the tournament page.`,
    tmAuto: "You choose",
    tmForm: "Use the full form",
    tmBack: "Back to group stage",
    tmCreated: (n: string) => `Created “${n}”`,
    tmLimit: "Max 3 team matches. Finish or delete one first.",
    tmFailed: "Couldn't create the tournament. Try again?",
    teamPasteAsk: (l: TeamList[]) => `I see ${l.length} lists: ${l.map((x) => `${x.label} (${x.names.length} players)`).join(", ")}. MLP Team Match, or doubles pairs for groups (within a team or across)? Nobody is paired yet; to pair yourself, type “Nam - Hung”.`,
    teamPasteMlp: (n: number) => `MLP Team Match: ${n} teams play each other`,
    teamPasteWithin: "Pair within each team (in order)",
    teamPasteAcross: (a: string, b: string) => `Pair across: 1 from ${a} + 1 from ${b}`,
    rosterFailed: "Created, but groups weren't drawn. Open the entry page to retry.",
    zaloLink: "Schedule & results",
    courts: (c: number[]) => `Courts ${c.join(", ")}`,
    reload: "Chat is saved on this device — reload is safe.",
  },
};
const uid = () => Math.random().toString(36).slice(2, 10);

const QT_CHAT_CSS = `
.qt-chat-shell { max-width: 720px; min-height: calc(100dvh - 64px); display: flex; flex-direction: column; }
.qt-chat-draft { position: sticky; top: calc(env(safe-area-inset-top) + 69px); z-index: 5; }
@media (min-width: 960px) {
  .qt-chat-shell { max-width: 1080px; display: grid; grid-template-columns: minmax(0, 1fr) 340px; grid-template-rows: auto minmax(0, 1fr) auto; column-gap: 16px; align-items: start; }
  .qt-chat-header { grid-column: 1 / -1; }
  .qt-chat-log { grid-column: 1; grid-row: 2; min-width: 0; }
  .qt-chat-composer { grid-column: 1; grid-row: 3; position: sticky; }
  .qt-chat-draft { grid-column: 2; grid-row: 2 / span 2; position: sticky; top: 16px; max-height: calc(100dvh - 96px); overflow: auto; z-index: 1; }
}
`;

function isTransient(error: unknown): boolean {
  const msg = error instanceof Error
    ? `${error.name} ${error.message}`
    : String((error as { message?: string } | null)?.message ?? "");
  return /abort|timeout|timed out|network|failed to send|fetch|load failed/i.test(msg);
}

/** One automatic retry when the assistant times out. The user message is already on screen. */
async function invokeChat(
  body: Record<string, unknown>,
  timeout: number,
  onRetry: () => void,
): Promise<{ data: unknown; error: unknown }> {
  let last: { data: unknown; error: unknown } = { data: null, error: null };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      last = await supabase.functions.invoke("quick-table-chat", { body, timeout });
    } catch (error) {
      last = { data: null, error };
    }
    if (!last.error || attempt === 1 || !isTransient(last.error)) return last;
    onRetry();
  }
  return last;
}

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
        toolPath={localePath("/tools/quick-tables", lang)}
        icon={MessageSquareText}
        title={c.loginTitle}
        desc={c.loginDesc}
        loginRedirect={localePath("/tools/quick-tables/chat", lang)}
      />
    );
  }
  // key theo ngôn ngữ: đổi VI/EN là dựng lại hội thoại bằng ngôn ngữ mới, không lẫn câu.
  return <ChatScreen key={`${user.id}:${lang}`} userId={user.id} lang={lang} />;
};

function ChatScreen({ userId, lang }: { userId: string; lang: Lang }) {
  const c = COPY[lang];
  const navigate = useNavigate();
  const to = (path: string) => localePath(path, lang);
  const confirm = useConfirm();
  const { createTable, setupRosterAtomic, getUserQuotaInfo, getUserTables, deleteTable, updateTableStatus } = useQuickTable();
  const storageKey = STORAGE_PREFIX + userId;

  const restored = useMemo(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as { lang?: Lang; draft: Draft; messages: Msg[]; tm?: TmDraft | null; div?: Divisions | null }) : null;
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
  const [busyNote, setBusyNote] = useState("");
  const [failed, setFailed] = useState<Outgoing | null>(null);
  const [subMenu, setSubMenu] = useState<SubMenu>(null);
  const [assignments, setAssignments] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ table: QuickTable; rosterOk: boolean } | null>(null);
  const [quotaFull, setQuotaFull] = useState<number | null>(null);
  const [quotaTables, setQuotaTables] = useState<QuickTable[]>([]);
  const [draftOpen, setDraftOpen] = useState(false);
  // Nháp giải đồng đội MLP (Team Match). null = đang tạo giải chia bảng như thường.
  const [tm, setTm] = useState<TmDraft | null>(restored?.lang === lang && restored.tm ? mergeTm({}, restored.tm) : null);
  // Dán Team A / Team B: chờ người dùng chọn MLP hay cách ghép đôi (không lưu, không tự ghép).
  const [teamPaste, setTeamPaste] = useState<TeamList[] | null>(null);
  // Nhiều hạng: mỗi hạng một giải. done = số giải đã tạo; tạo xong thì đề nghị hạng labels[done].
  const [div, setDiv] = useState<Divisions | null>(restored?.div ?? null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const slot = nextSlot(draft);
  const unit = c.unit(draft);

  useEffect(() => {
    try {
      if (created) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, JSON.stringify({ lang, draft, messages: messages.slice(-60), tm, div }));
    } catch { /* private mode — chat still works, just not restorable */ }
  }, [lang, draft, messages, created, storageKey, tm, div]);

  useEffect(() => {
    getUserQuotaInfo().then((q) => { if (q && q.current_count >= q.quota) setQuotaFull(q.quota); });
  }, [getUserQuotaInfo]);

  useEffect(() => {
    if (quotaFull == null) return;
    void getUserTables().then(setQuotaTables);
  }, [quotaFull, getUserTables]);

  useEffect(() => {
    if (!busy) return;
    const schedule = window.setTimeout(() => {
      setBusyNote((note) => (note === c.thinkingRetry ? note : c.thinkingSchedule));
    }, 4000);
    const almost = window.setTimeout(() => {
      setBusyNote((note) => (note === c.thinkingRetry ? note : c.thinkingAlmost));
    }, 8000);
    return () => {
      window.clearTimeout(schedule);
      window.clearTimeout(almost);
    };
  }, [busy, c]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy, slot, subMenu, created]);
  // Trang giải là chunk riêng. Tải trước lúc người dùng sắp bấm "Mở giải",
  // để không ngồi chờ spinner của lazy import.
  useEffect(() => {
    if (slot === "confirm" || created) void import("@/pages/QuickTableView");
  }, [slot, created]);

  // Đổi chỗ / đổi tên giữ nguyên bảng. Đổi số bảng thì chia lại theo thứ tự hiện tại, không xáo.
  const rosterKey = JSON.stringify([draft.entries, draft.group_count]);
  const groupsRef = useRef(draft.group_count ?? 0);
  useEffect(() => {
    const count = draft.entries?.length ?? 0;
    const g = draft.group_count ?? 0;
    if (!count || !g) {
      setAssignments([]);
      groupsRef.current = g;
      return;
    }
    setAssignments((prev) => keepOrAssign(prev, count, groupsRef.current, g) ?? previewAssignments(draft));
    groupsRef.current = g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosterKey]);

  const pushBot = (text: string) => setMessages((m) => [...m, { id: uid(), role: "bot", text }]);

  /** Áp nháp mới rồi hỏi câu tiếp theo (kèm câu xác nhận ngắn nếu có). */
  const advance = useCallback((next: Draft, ack?: string) => {
    const locked = lockAdvance(next);
    setDraft(locked);
    setSubMenu(null);
    const q = questionFor(c, locked, nextSlot(locked));
    const unchanged = !ack || ack === (lang === "vi" ? "Bản nháp chưa đổi." : "The draft did not change.");
    setMessages((m) => {
      const last = [...m].reverse().find((x) => x.role === "bot")?.text ?? "";
      let text = [ack?.trim(), q].filter(Boolean).join(" ").replace(/\.\s+\./g, ".").replace(/[ \t]{2,}/g, " ");
      if (q && last.includes(q) && unchanged) text = c.rephrase;
      return [...m, { id: uid(), role: "bot", text }];
    });
  }, [c, lang]);

  // Quay lại: ảnh chụp nháp + hội thoại trước mỗi lượt người dùng (chỉ trong phiên).
  const history = useRef<Array<{ draft: Draft; messages: Msg[]; tm: TmDraft | null }>>([]);
  const [canUndo, setCanUndo] = useState(false);
  const snap = () => {
    history.current = [...history.current.slice(-29), { draft, messages, tm }];
    setCanUndo(true);
  };
  const undo = () => {
    const prev = history.current.pop();
    setCanUndo(history.current.length > 0);
    if (!prev) return;
    setDraft(prev.draft);
    setMessages(prev.messages);
    setTm(prev.tm);
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

  // ---------- giải đồng đội MLP (Team Match): hỏi tại chỗ, không gọi AI ----------
  const tmQuestion = (d: TmDraft): string => {
    switch (nextTmSlot(d)) {
      case "teams": return c.tmTeams;
      case "roster": return c.tmRoster;
      case "format": return c.tmFormat;
      case "name": return c.name;
      case "confirm": return c.tmConfirm(d as Required<TmDraft>, c.tmFmt[d.format!]);
    }
  };
  const tmStep = (next: TmDraft, intro = false) => {
    setTm(next);
    pushBot([intro && c.tmIntro, tmQuestion(next)].filter(Boolean).join(" "));
  };
  const tmPick = (label: string, p: TmDraft) => () => { pushUser(label); tmStep(mergeTm(tm ?? {}, p)); };
  const createTm = async () => {
    const d = tm as Required<TmDraft>;
    setBusy(true);
    setBusyNote(`${c.create}…`);
    try {
      const t = await createTeamMatchTournament({
        name: d.name,
        team_roster_size: d.roster,
        team_count: d.team_count,
        format: d.format,
        playoff_team_count: d.format === "rr_playoff" ? tmPlayoffCount(d.team_count) : undefined,
        require_registration: false,
        has_dreambreaker: false,
        require_min_games_per_player: false,
        // Bộ game mặc định của wizard theo số người/đội.
        game_templates: getDefaultTemplates(d.roster).map(({ order_index, game_type, display_name, scoring_type }) => ({ order_index, game_type, display_name, scoring_type })),
      });
      toast({ title: c.tmCreated(t.name) });
      // Nháp chia bảng (nếu có) giữ nguyên; hội thoại MLP xong thì dọn.
      setTm(null);
      setMessages(freshMessages(c, draft));
      navigate(to(`/tools/team-match/${t.share_id}`));
    } catch (e) {
      pushBot((e as Error).message === "LIMIT_REACHED" ? c.tmLimit : c.tmFailed);
    } finally {
      setBusy(false);
    }
  };

  const send = async (out?: Outgoing, isRetry = false) => {
    let msg = out ?? { text: input.trim() };
    // File vừa chọn vẫn phải đi tiếp dù lượt trước đang bận — nếu không, bấm file xong im luôn.
    if (!msg.text || (busy && !out)) return;
    // Lệnh gõ tay, xử lý tại chỗ không gọi AI.
    if (!out && !isRetry) {
      const cmd = msg.text.toLocaleLowerCase("vi").replace(/[.!]+$/, "").trim();
      if (/^(làm lại|lam lai|xoá hết|xóa hết|xoa het|reset|start over|restart)$/.test(cmd)) { setInput(""); void resetAll(); return; }
      if (/^(quay lại|quay lai|undo|back)$/.test(cmd)) { setInput(""); undo(); return; }
      const lists = tm ? null : teamLists(msg.text);
      const tmSeed: TmDraft = lists ? { team_count: lists.length, roster: Math.max(...lists.map((l) => l.names.length)) } : {};
      setTeamPaste(null);
      if (tm || wantsTeamMatch(msg.text)) { setInput(""); pushUser(msg.text); tmStep(tmAnswer(tm ?? mergeTm({}, tmSeed), msg.text, lang), !tm); return; }
      if (lists) { setInput(""); pushUser(msg.text); setTeamPaste(lists); pushBot(c.teamPasteAsk(lists)); return; }
      // Câu đòi nhiều hạng đi qua AI để giữ các thông tin khác; câu trả lời kèm luật mỗi hạng một giải.
      const divs = div ? null : divisionsAsked(msg.text, lang);
      if (divs) setDiv({ labels: divs, done: 0 });
      const sheet = googleSheetRef(msg.text);
      if (sheet) {
        setInput("");
        snap();
        setMessages((m) => [...m, { id: uid(), role: "user", text: msg.text, label: c.sheetLabel }]);
        setBusy(true);
        setBusyNote(c.thinking);
        let data: unknown = null;
        try {
          const res = await supabase.functions.invoke("quick-table-chat", { body: { sheet }, timeout: 15_000 });
          data = res.data;
        } catch { /* mạng lỗi thì báo không đọc được, đừng khoá ô nhập */ }
        finally { setBusy(false); }
        const csv = data && typeof data === "object" && "csv" in data && typeof data.csv === "string" ? data.csv : "";
        const sheetError = data && typeof data === "object" && "error" in data ? String(data.error) : "";
        if (!csv) {
          pushBot(sheetError === "sheet_private" ? c.sheetPrivate : c.sheetUnreadable);
          return;
        }
        let sheetEntries: Entry[] = [];
        try { sheetEntries = parseSheet(await rowsFromCsv(csv), { doubles: draft.is_doubles === true }); } catch { /* bảng lạ thì để AI đọc chữ */ }
        if (sheetEntries.length >= 2) {
          const entries = mergeRoster(draft.entries, sheetEntries);
          const doubles = draft.is_doubles === undefined && entries.every((e) => e.p2);
          const next = applyPatch(draft, { entries, ...(doubles ? { is_doubles: true } : {}) });
          advance(next, rosterAck(c, c.unit(next), draft.entries?.length ?? 0, next.entries!.length, sheetEntries.length, next.entries));
          return;
        }
        if (draft.is_doubles === true || !looksLikeNameList(csv)) {
          pushBot(c.fileNotList);
          return;
        }
        msg = { text: `${msg.text}\n${csv.trim().slice(0, 3500)}`, label: c.sheetLabel };
        isRetry = true;
      } else if (!divs) {
        const local = localSlotPatch(msg.text, slot);
        if (local) { setInput(""); choose(msg.text, local); return; }
        const spoken = applySpokenEdit(draft, msg.text);
        if (spoken && !messageNeedsModel(msg.text)) {
          setInput("");
          pushUser(msg.text);
          advance(spoken, factualAck(draft, spoken, lang, msg.text));
          return;
        }
      }
    }
    if (msg.entries?.length) {
      if (!msg.echoed) {
        snap();
        setMessages((m) => [...m, { id: uid(), role: "user", text: msg.text, label: msg.label }]);
      }
      const entries = msg.append ? mergeRoster(draft.entries, msg.entries) : msg.entries.slice(0, MAX_CHAT_ENTRIES);
      const doubles = draft.is_doubles === undefined && entries.every((e) => e.p2);
      const next = applyPatch(draft, { entries, ...(doubles ? { is_doubles: true } : {}) });
      advance(next, rosterAck(c, c.unit(next), draft.entries?.length ?? 0, next.entries!.length, msg.entries.length, next.entries));
      return;
    }
    if (!isRetry) {
      if (!msg.echoed) {
        snap();
        setMessages((m) => [...m, { id: uid(), role: "user", text: msg.text, label: msg.label }]);
      }
      if (!out) setInput("");
    }
    setFailed(null);
    setBusy(true);
    setBusyNote(c.thinking);
    // Thử lại: bỏ tin lỗi + chính tin người dùng đó khỏi lịch sử rồi gửi lại.
    const prior = isRetry ? messages.slice(0, messages.map((m) => m.role).lastIndexOf("user")) : messages;
    const files = msg.attachments ?? (msg.attachment ? [msg.attachment] : []);
    // Mỗi ảnh một lượt. Gửi chung hai ảnh, kèm nháp 32 đội và câu "chia thế nào?",
    // mô hình trả entries rỗng dù ảnh có tên — rồi trang vẫn hỏi chia 32 đội.
    if (files.length) {
      const hint = "Đọc hết tên trong ảnh này. Đánh đôi thì mỗi cặp một đội. Chỉ trả tên nhìn thấy trong ảnh, không chép danh sách khác.";
      const history = [{ role: "user" as const, text: hint }];
      const draftWithoutList = { ...draft, entries: undefined, player_count: undefined };
      let incoming: Entry[] = [];
      let missed = 0;
      let transportFailed = false;
      try {
        for (const file of files) {
          const { data, error } = await invokeChat(
            { messages: history, draft: draftWithoutList, pending: "count", lang, attachment: file },
            60_000,
            () => setBusyNote(c.thinkingRetry),
          );
          if (error || !data || typeof data !== "object" || "error" in data) { transportFailed = true; missed++; continue; }
          const res = data as { intent: string; patch: unknown };
          if (res.intent !== "fill" && res.intent !== "answer") { missed++; continue; }
          const patch = trustPatch(res.patch, "", "count");
          const got = Array.isArray(patch.entries) ? (patch.entries as Entry[]) : [];
          if (!got.length) { missed++; continue; }
          incoming = mergeRoster(incoming, got);
        }
      } finally {
        setBusy(false);
      }
      if (!incoming.length) {
        if (transportFailed) { setFailed(msg); pushBot(c.aiError); return; }
        pushBot(c.attachmentNoList);
        return;
      }
      const before = draft.entries?.length ?? 0;
      const entries = mergeRoster(draft.entries, incoming);
      const next = applyPatch(draft, { entries, roster_mode: "now" });
      let ack = rosterAck(c, c.unit(next), before, entries.length, incoming.length, next.entries);
      if (missed) ack += c.photoMissed(missed);
      advance(next, ack);
      return;
    }
    const history = [...prior, { role: "user" as const, text: msg.text }]
      .slice(-8)
      .map((m) => ({ role: m.role, text: m.text.slice(0, 4000) }));
    const { data, error } = await invokeChat(
      { messages: history, draft, pending: slot, lang, facts: chatFacts(draft, lang) },
      25_000,
      () => setBusyNote(c.thinkingRetry),
    );
    setBusy(false);
    if (error || !data || typeof data !== "object" || "error" in data) {
      setFailed(msg);
      pushBot(c.aiError);
      return;
    }
    const res = data as { reply?: string; intent: string; patch: unknown; unmet?: string | null };
    if (res.intent === "team_match") { tmStep(tmAnswer({}, msg.text, lang), true); return; }
    const said = typeof res.reply === "string" ? res.reply : "";
    if (res.intent !== "fill" && res.intent !== "answer") {
      const spoken = applySpokenEdit(draft, msg.text);
      const next = spoken ?? draft;
      // Yêu cầu chưa đáp ứng mà AI trả reply rỗng (ca sân-theo-bảng 01:51
      // 22/10) → dùng câu fallback tử tế thay vì "bản nháp chưa đổi" chung
      // chung: nhắc lại yêu cầu, nói rõ chưa hỗ trợ, flow vẫn đi tiếp.
      const ack = !said.trim() && JSON.stringify(next) === JSON.stringify(draft)
        ? fallbackReply(res.intent, res.unmet ?? null, lang, msg.text)
        : replyFromDraft(draft, next, said, lang, msg.text);
      advance(next, ack);
      return;
    }
    // Ảnh đã được đọc ở vòng trên. Ở đây chỉ còn chữ người dùng gõ.
    const patch = dropInventedRoster(trustPatch(res.patch, msg.text, slot), msg.text, draft.entries);
    const patched = applyPatch(draft, patch);
    const spoken = applySpokenEdit(patched, msg.text);
    const next = spoken ?? patched;
    let ack = replyFromDraft(draft, next, said, lang, msg.text);
    const plan = draftSeriesPlan(next);
    if (plan && !next.advance_per_group && next.series_sizes && next.series_sizes.join() !== draft.series_sizes?.join()) {
      const line = plan.map((sl, i) => seriesLine(seriesName(next.series_style ?? "series", i, lang), sl, lang, c.unit(next))).join(" · ");
      if (!ack.includes(line)) ack = `${ack} ${line}.`;
    }
    advance(next, ack);
  };

  // ---------- chip theo bước ----------
  const chips: Chip[] = (() => {
    if (created || quotaFull != null || busy) return [];
    if (failed) return [{ label: c.retry, onClick: () => send(failed, true) }];
    if (teamPaste) {
      const [a, b] = teamPaste;
      const pairBy = (mode: "within" | "across", label: string) => () => {
        setTeamPaste(null);
        const entries = pairTeamLists(teamPaste, mode);
        choose(label, { entries, is_doubles: true, pairing_done: true, player_count: entries.length });
      };
      return [
        { label: c.teamPasteMlp(teamPaste.length), recommended: true, onClick: () => {
          setTeamPaste(null);
          pushUser(c.teamPasteMlp(teamPaste.length));
          tmStep(mergeTm({}, { team_count: teamPaste.length, roster: Math.max(...teamPaste.map((l) => l.names.length)) }), true);
        } },
        ...(teamPaste.every((l) => l.names.length % 2 === 0) ? [{ label: c.teamPasteWithin, onClick: pairBy("within", c.teamPasteWithin) }] : []),
        ...(teamPaste.length === 2 && a.names.length === b.names.length ? [{ label: c.teamPasteAcross(a.label, b.label), onClick: pairBy("across", c.teamPasteAcross(a.label, b.label)) }] : []),
      ];
    }
    if (tm) {
      const back = { label: c.tmBack, onClick: () => { pushUser(c.tmBack); setTm(null); pushBot(questionFor(c, draft, slot)); } };
      const auto = { label: c.tmAuto, onClick: tmPick(c.tmAuto, { team_count: 4, roster: 4, format: "round_robin", name: tmDefaultName(lang), ...tm }) };
      switch (nextTmSlot(tm)) {
        case "teams":
          return [...[4, 6, 8].map((k) => ({ label: lang === "vi" ? `${k} đội` : `${k} teams`, onClick: tmPick(String(k), { team_count: k }) })), auto, back];
        case "roster":
          return [...[4, 6, 8].map((k) => ({ label: c.tmPeople(k), onClick: tmPick(c.tmPeople(k), { roster: k }) })), auto, back];
        case "format":
          return (["round_robin", "rr_playoff", "single_elimination"] as const)
            .filter((f) => f !== "single_elimination" || tmKnockoutOk(tm.team_count))
            .map((f) => ({ label: c.tmFmt[f], onClick: tmPick(c.tmFmt[f], { format: f }) }));
        case "name":
          return [{ label: tmDefaultName(lang), onClick: tmPick(tmDefaultName(lang), { name: tmDefaultName(lang) }) }, back];
        case "confirm":
          return [
            { label: c.create, recommended: true, onClick: () => void createTm() },
            { label: c.tmForm, onClick: () => navigate(to("/tools/team-match/new")) },
            back,
          ];
      }
    }
    const n = entryCount(draft);
    const switchFormat: Chip[] = draft.is_doubles === undefined ? [] : [
      draft.is_doubles
        ? { label: c.singles, sub: lang === "vi" ? "Đổi sang đánh đơn" : "Switch to singles", onClick: () => choose(c.singles, { is_doubles: false, pairing_done: false }) }
        : { label: c.doubles, sub: lang === "vi" ? "Đổi sang đánh đôi" : "Switch to doubles", onClick: () => choose(c.doubles, { is_doubles: true }) },
    ];
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
          { label: c.classicForm, onClick: () => navigate(to("/tools/quick-tables")) },
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
        return [
          ...groupChoices(n).map((o) => ({
            label: c.groupLabel(o),
            sub: c.groupSub(o, unit),
            recommended: o.recommended,
            onClick: () => choose(c.groupLabel(o), { group_count: o.groupCount }),
          })),
          ...switchFormat,
        ];
      case "series": {
        const style = draft.series_style ?? "series";
        const sizes = groupSizes(draft);
        const bundled = Array.from({ length: seriesCap(draft) }, (_, i) => i + 1).map((k) => {
          const names = Array.from({ length: k }, (_, d) => seriesName(style, d, lang));
          const label = k === 1 ? c.seriesOne : c.seriesMany(names);
          return {
            label,
            sub: k === 1 ? c.seriesOneSub(unit) : (seriesPlan(sizes, k) ?? []).map((sl, d) => seriesLine(names[d], sl, lang, unit)).join(" · "),
            recommended: k === seriesCap(draft),
            onClick: () => choose(label, { series: k, series_sizes: undefined, advance_per_group: undefined }),
          };
        });
        const ranks = rankSeriesSizes(sizes);
        const rankKey = ranks?.join();
        const already = ranks != null && bundled.some((_, i) => seriesPlan(sizes, i + 1)?.map((sl) => sl.size).join() === rankKey);
        if (!ranks || already) return [...bundled, ...switchFormat];
        return [
          ...bundled,
          ...switchFormat,
          {
            label: c.seriesByRank,
            sub: ranks.map((n, d) => seriesLine(seriesName("series", d, lang), seriesSlot(n), lang, unit)).join(" · "),
            onClick: () => choose(c.seriesByRank, { series: ranks.length, series_sizes: ranks, series_style: "series", advance_per_group: undefined }),
          },
        ];
      }
      case "roster":
        return [
          { label: c.pasteNow, onClick: () => choose(c.pasteNow, { roster_mode: "now" }) },
          { label: c.openRegistration, onClick: () => choose(c.openRegistration, { roster_mode: "registration" }) },
          { label: c.later, onClick: () => choose(c.later, { roster_mode: "later" }) },
          ...switchFormat,
        ];
      case "paste":
        return [
          { label: c.upload, onClick: () => fileRef.current?.click() },
          { label: c.later, onClick: () => choose(c.later, { roster_mode: "later" }) },
        ];
      case "courts":
        return [
          ...[1, 2, 3, 4].map((k) => ({
            label: c.courtN(k),
            recommended: k === 2,
            onClick: () => choose(c.courtN(k), { courts: Array.from({ length: k }, (_, i) => i + 1), courts_done: true }),
          })),
          { label: c.courtsSkip, onClick: () => choose(c.courtsSkip, { courts_done: true }) },
        ];
      case "start_time": {
        const now = new Date();
        const hh = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        return [
          { label: c.timeNow, recommended: true, onClick: () => choose(c.timeNow, { start_time: hh, time_done: true }) },
          { label: c.timeLater, onClick: () => choose(c.timeLater, { time_done: true }) },
        ];
      }
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
          ...((draft.series ?? 1) > 1 && (draft.series ?? 1) <= 3
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
    if (field === "count") { d.player_count = undefined; d.entries = undefined; d.roster_mode = undefined; d.group_count = undefined; d.series = undefined; d.series_sizes = undefined; }
    if (field === "groups") { d.group_count = undefined; d.series = undefined; d.series_sizes = undefined; }
    if (field === "roster") { d.entries = undefined; d.roster_mode = undefined; d.options_done = false; }
    if (field === "name") d.name = undefined;
    if (field === "extra") d.options_done = false;
    if (field === "courts") { d.courts = undefined; d.group_courts = undefined; d.start_time = undefined; d.courts_done = false; d.time_done = false; }
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
    const custom = customSeries(draft);
    const series = custom ? custom.length : Math.min(draft.series ?? 1, seriesCap(draft));
    // Có danh sách → setupRosterAtomic lưu sân + xếp lịch; chưa có → lưu sẵn lên giải cho bước nhập sau.
    const courtsOnTable = !draft.entries?.length && !!draft.courts?.length;
    if ((draft.default_sets ?? 1) > 1 || series > 1 || custom || courtsOnTable) {
      await supabase.from("quick_tables").update({
        ...((draft.default_sets ?? 1) > 1 ? { default_sets: draft.default_sets } : {}),
        ...(courtsOnTable ? { courts: draft.courts!.map(String), start_time: draft.start_time ?? null } : {}),
        ...(series > 1 || custom ? { playoff_series: series, playoff_series_style: draft.series_style ?? "series" } : {}),
      } as never).eq("id", table.id);
    }
    // Ghi riêng: cột mới, lỡ chưa có trên DB thì các thiết lập trên vẫn lưu được.
    if (custom) await supabase.from("quick_tables").update({ playoff_series_sizes: custom } as never).eq("id", table.id);
    let rosterOk = true;
    if (draft.entries?.length) {
      rosterOk = await setupRosterAtomic(
        table.id,
        buildRoster(draft),
        draft.group_count ?? 1,
        assignments.length === draft.entries.length ? assignments : undefined,
        draft.courts ?? [],
        draft.start_time ?? null,
        draft.group_courts,
      );
    }
    setCreating(false);
    setCreated({ table, rosterOk });
    if (div) {
      const done = div.done + 1;
      setDiv({ ...div, done });
      const label = div.labels[done];
      if (label) pushBot(c.divOffer(label, `${divisionBase(draft.name!, div.labels)} — ${label}`));
    }
  };

  const nextDiv = created && div ? div.labels[div.done] : undefined;
  const divChips: Chip[] = !nextDiv ? [] : [
    ...(draft.entries?.length ? [{ label: c.divSame(nextDiv), recommended: true, onClick: () => continueDivision(true) }] : []),
    { label: c.divNew(nextDiv), recommended: !draft.entries?.length, onClick: () => continueDivision(false) },
    { label: c.divStop, onClick: () => { pushUser(c.divStop); setDiv(null); } },
  ];
  const continueDivision = (same: boolean) => {
    const name = `${divisionBase(draft.name!, div!.labels)} — ${nextDiv}`;
    setCreated(null);
    pushUser(same ? c.divSame(nextDiv!) : c.divNew(nextDiv!));
    advance(nextDivisionDraft(draft, name, same), lang === "vi" ? `Tên giải: ${name}.` : `Name: ${name}.`);
  };

  const tableUrl = created ? `${getSiteUrl()}${to(`/tools/quick-tables/${created.table.share_id}`)}` : "";
  const groupsList = useMemo(() => {
    const k = draft.group_count ?? 1;
    const out: Entry[][] = Array.from({ length: k }, () => []);
    (draft.entries ?? []).forEach((e, i) => out[assignments[i] ?? 0]?.push(e));
    return out;
  }, [draft.entries, draft.group_count, assignments]);

  const zaloText = () => [
    `🏓 ${draft.name}`,
    ...(draft.entries?.length ? groupsList.map((g, i) => `${c.group(i)}: ${g.map(entryLabel).join(", ")}`) : []),
    `${c.zaloLink}: ${tableUrl}`,
  ].join("\n");

  const onFiles = async (list: FileList | null) => {
    // Copy trước khi xoá value. FileList sống cùng ô input; xoá trước thì danh sách về rỗng.
    const files = [...(list ?? [])];
    if (fileRef.current) fileRef.current.value = "";
    if (!files.length || busy) return;
    const say = (text: string) => { setBusy(false); pushBot(text); };
    // Hiện tên file ngay, trước khi đọc. Nếu không, lúc parse hoặc gọi AI người dùng thấy im.
    snap();
    setMessages((m) => [...m, {
      id: uid(),
      role: "user",
      text: files.map((f) => f.name).join("\n"),
      label: files.length > 1 ? `📎 ${files.length}` : `📎 ${files[0].name}`,
    }]);
    setBusy(true);
    setBusyNote(c.thinking);
    const images = files.filter((f) => f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(f.name));
    const others = files.filter((f) => !images.includes(f));
    if (others.length > 1 || (others.length && images.length)) { say(c.oneFile); return; }
    if (files.some((f) => f.size > MAX_UPLOAD_BYTES)) { say(c.fileTooBig); return; }
    const batch = images.length > MAX_IMAGES ? images.slice(0, MAX_IMAGES) : images;
    if (images.length > MAX_IMAGES) pushBot(c.fileTooMany);
    let out: Outgoing;
    try { out = others.length ? await readUpload(others[0], draft.is_doubles === true) : await readImages(batch); }
    catch (err) { say(err instanceof UploadError && err.code === "not_a_list" ? c.fileNotList : c.fileUnreadable); return; }
    setBusy(false);
    send({ ...out, echoed: true });
  };

  const startOver = () => {
    setCreated(null);
    setDraft({});
    setTm(null);
    setTeamPaste(null);
    setDiv(null);
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

  const refreshQuota = async () => {
    const [q, tables] = await Promise.all([getUserQuotaInfo(), getUserTables()]);
    setQuotaTables(tables);
    setQuotaFull(q && q.current_count >= q.quota ? q.quota : null);
  };
  const endQuotaTable = async (table: QuickTable) => {
    if (!(await confirm({
      title: c.endTable,
      description: lang === "vi"
        ? `Kết thúc “${table.name}”? Kết quả vẫn giữ. Bạn tạo được giải mới.`
        : `End “${table.name}”? Results stay. You can create another tournament.`,
      confirmText: c.endTable,
    }))) return;
    if (await updateTableStatus(table.id, "completed")) await refreshQuota();
  };
  const deleteQuotaTable = async (table: QuickTable) => {
    if (!(await confirm({
      title: c.deleteTable,
      description: lang === "vi" ? `Xoá “${table.name}”? Không lấy lại được.` : `Delete “${table.name}”? This cannot be undone.`,
      confirmText: c.deleteTable,
      destructive: true,
    }))) return;
    if (await deleteTable(table.id)) await refreshQuota();
  };

  const quotaMsg = quotaFull != null ? c.quotaFull(quotaFull) : null;
  const openQuotaTables = quotaTables.filter((t) => t.status !== "completed");
  const filled = [draft.is_doubles !== undefined, entryCount(draft) > 0, !!draft.group_count && slot !== "groups", !!draft.name].filter(Boolean).length;

  return (
    <TheLineLayout title={c.layoutTitle} noindex active="lab">
      <style>{QT_CHAT_CSS}</style>
      <div className="tl-shell qt-chat-shell">
        {/* header */}
        <header className="qt-chat-header" style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0" }}>
          <Button asChild variant="ghost" size="icon" aria-label={lang === "vi" ? "Quay lại" : "Back"}>
            <Link to={to("/tools/quick-tables")}><ArrowLeft className="w-5 h-5" /></Link>
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
        {!created && !tm && (
          <section
            className="qt-chat-draft"
            style={{ background: "var(--tl-bg-elev)", border: "1px solid var(--tl-border)", borderRadius: "var(--tl-radius-lg)" }}
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
              <span style={{ fontSize: 13, color: "var(--tl-fg-3)" }}>{filled === 4 ? c.draftReady : c.draftMissing(4 - filled)}</span>
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
        <div className="qt-chat-log" role="log" aria-live="polite" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, padding: "16px 0" }}>
          {messages.map((m) => <Bubble key={m.id} msg={m} c={c} />)}
          {quotaMsg && <Bubble msg={{ id: "quota", role: "bot", text: quotaMsg }} c={c} />}
          {busy && (
            <div role="status" aria-live="polite" style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 16, background: "var(--tl-bg-elev)", border: "1px solid var(--tl-border)", color: "var(--tl-fg-2)", fontSize: 14 }}>
              <span className="inline-flex gap-1" aria-hidden>
                {[0, 1, 2].map((i) => <span key={i} className="animate-pulse" style={{ width: 6, height: 6, borderRadius: 3, background: "var(--tl-fg-3)", animationDelay: `${i * 150}ms` }} />)}
              </span>
              {busyNote || c.thinking}
            </div>
          )}

          {slot === "confirm" && !created && !busy && !tm && (
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
              onOpen={() => navigate(to(`/tools/quick-tables/${created.table.share_id}`))}
              onRoster={() => navigate(to(`/tools/quick-tables/${created.table.share_id}/setup`))}
              shareUrl={tableUrl}
              shareMessage={zaloText()}
              onAnother={startOver}
            />
          )}
          {divChips.length > 0 && <ChipRow chips={divChips} />}
          {quotaMsg && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Button variant="default" onClick={() => navigate(to("/tools/quick-tables"))}>{c.myTables}</Button>
              {openQuotaTables.map((table) => (
                <div key={table.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ flex: 1, minWidth: 120, fontSize: 14 }}>{table.name}</span>
                  <Button variant="outline" onClick={() => void endQuotaTable(table)}>{c.endTable}</Button>
                  <Button variant="outline" onClick={() => void deleteQuotaTable(table)}>{c.deleteTable}</Button>
                </div>
              ))}
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* chip + ô nhập */}
        {!created && quotaFull == null && (
          <div className="qt-chat-composer" style={{ position: "sticky", bottom: 0, background: "var(--tl-bg)", paddingBottom: "max(12px, env(safe-area-inset-bottom))", paddingTop: 8 }}>
            {chips.length > 0 && <ChipRow chips={chips} />}
            <form
              onSubmit={(e) => { e.preventDefault(); send(); }}
              style={{ display: "flex", gap: 8, alignItems: "flex-end" }}
            >
              <Button type="button" variant="ghost" size="icon" disabled={busy} onClick={() => fileRef.current?.click()} aria-label={c.uploadAria} title={c.uploadAria} style={{ width: 44, height: 44, flexShrink: 0 }}>
                <Paperclip className="w-4 h-4" />
              </Button>
              {createPortal(
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf,.pdf,.xlsx,.xls,.csv,.tsv,.txt"
                  multiple
                  disabled={busy}
                  tabIndex={-1}
                  aria-label={c.uploadAria}
                  onChange={(e) => { void onFiles(e.currentTarget.files); }}
                  style={{ position: "fixed", left: -1000, top: 0, width: 44, height: 44, opacity: 0 }}
                />,
                document.body,
              )}
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
              <Link to={to("/tools/quick-tables")} style={{ color: "var(--tl-fg-2)", textDecoration: "underline" }}>{c.classicForm}</Link>
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
  const plan = draftSeriesPlan(d);
  if (!plan) return null;
  const sized = !!customSeries(d);
  return plan.map((sl, i) => `${seriesName(d.series_style ?? "series", i, lang)}${sized ? ` ${sl.size}` : ""}`).join(" + ");
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
      return (d.group_count ? c.groupsInvalid(d.group_count, u) : [c.groups(n, u), c.suggestGroups(d)].filter(Boolean).join(" ")) + (n > 32 ? c.groupsBig : "");
    case "series": return c.series(u);
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

class UploadError extends Error {
  constructor(public code: "unsupported" | "empty" | "not_a_list") { super(code); }
}

function rosterAck(c: C, unit: string, before: number, after: number, incoming: number, entries?: Entry[]): string {
  const shown = (entries ?? []).slice(0, 6).map(entryLabel);
  const more = entries && entries.length > 6 ? ` +${entries.length - 6}` : "";
  const preview = shown.length ? `: ${shown.join(", ")}${more}` : "";
  let ack = before === 0 ? `${c.received(after, unit).replace(/\.$/, "")}${preview}.` : after > before ? c.added(after - before, after, unit) : c.alreadyThere;
  if (entries) {
    const dups = duplicateIndexes(entries).size;
    if (dups) ack += c.dupWarn(dups);
  }
  if (before + incoming > after && after >= MAX_CHAT_ENTRIES) ack += c.capped;
  return ack;
}

async function rowsFromCsv(csv: string): Promise<string[][]> {
  const XLSX = await import("xlsx/dist/xlsx.mini.min.js");
  const wb = XLSX.read(csv, { type: "string" });
  return XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, blankrows: false, defval: "" });
}

async function readImages(files: File[]): Promise<Outgoing> {
  const attachments = await Promise.all(files.map(imageToJpeg));
  return {
    text: files.map((f) => `🖼️ ${f.name}`).join("\n"),
    label: files.length > 1 ? `🖼️ ${files.length} ảnh` : `🖼️ ${files[0].name}`,
    ...(attachments.length > 1 ? { attachments } : { attachment: attachments[0] }),
    append: true,
  };
}

/** Ảnh/PDF → Gemini đọc; bảng tính/văn bản → đọc tại chỗ thành chữ (tab giữa các cột). */
async function readUpload(file: File, doubles = false): Promise<Outgoing> {
  if (file.type.startsWith("image/")) return readImages([file]);
  if (file.type === "application/pdf") return { text: `📎 ${file.name}`, label: `📎 ${file.name}`, attachment: { mime_type: "application/pdf", data: await readAsBase64(file) }, append: true };
  if (!SHEET_EXT.test(file.name)) throw new UploadError("unsupported");
  let text: string;
  let entries: Entry[] = [];
  if (/\.(xlsx|xls|csv|tsv)$/i.test(file.name)) {
    const XLSX = await import("xlsx/dist/xlsx.mini.min.js");
    const wb = /\.(xlsx|xls)$/i.test(file.name) ? XLSX.read(await file.arrayBuffer()) : XLSX.read(await file.text(), { type: "string" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    entries = parseSheet(XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, blankrows: false, defval: "" }), { doubles });
    text = XLSX.utils.sheet_to_csv(sheet, { FS: "\t", blankrows: false });
  } else {
    text = await file.text();
  }
  text = text.trim().slice(0, 4000);
  if (!text) throw new UploadError("empty");
  if (doubles && entries.filter((e) => e.p2).length < 2 && entries.length < 2) throw new UploadError("not_a_list");
  if (entries.length < 2 && !looksLikeNameList(text)) throw new UploadError("not_a_list");
  // Nhận ra ≥ 2 dòng thì dùng luôn; chữ có tên mà chưa tách được thì để AI đọc.
  return { text, label: `📎 ${file.name}`, append: true, ...(entries.length >= 2 ? { entries: entries.slice(0, 200) } : {}) };
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
        flexWrap: "wrap",
        gap: 8,
        paddingBottom: 8,
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
            whiteSpace: "normal",
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
    (draft.default_sets ?? 1) > 1 ? c.optSets(draft.default_sets ?? 1) : null,
    draft.entries?.some((e) => e.seed) ? c.optSeed : null,
  ].filter(Boolean).join(" · ");
  const rows: Array<[string, string, Parameters<typeof onEdit>[0]]> = [
    [c.fFormat, draft.is_doubles === undefined ? c.empty : draft.is_doubles ? c.doubles : c.singles, "format"],
    [c.fCount, n ? `${n} ${c.unit(draft)}` : c.empty, "count"],
    [c.fGroups, findGroupOption(n, draft.group_count) ? [c.groupLabel(findGroupOption(n, draft.group_count)!), playoffSummary(draft, lang) ?? seriesLabel(draft, lang)].filter(Boolean).join(" · ") : c.empty, "groups"],
    [c.fRoster, draft.entries?.length ? `${draft.entries.length} ${c.unit(draft)}` : draft.roster_mode === "registration" ? c.rosterReg : draft.roster_mode === "later" ? c.rosterLater : c.empty, "roster"],
    [c.fName, draft.name ?? c.empty, "name"],
    [c.fCourts, draft.courts?.length || groupCourtsLine(draft, lang) ? [draft.courts?.length ? c.courts(draft.courts) : null, groupCourtsLine(draft, lang), draft.start_time].filter(Boolean).join(" · ") : c.empty, "courts"],
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
    findGroupOption(n, draft.group_count) ? c.groupLabel(findGroupOption(n, draft.group_count)!) : null,
    playoffSummary(draft, lang) ?? seriesLabel(draft, lang),
    draft.default_sets && draft.default_sets > 1 ? c.optSets(draft.default_sets) : null,
    draft.courts?.length ? c.courts(draft.courts) : null,
    groupCourtsLine(draft, lang),
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
          {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> <span role="status">{c.creating}</span></> : <><Check className="w-4 h-4" /> {c.create}</>}
        </Button>
        <Button variant="outline" onClick={onEdit} style={{ minHeight: 44 }}>
          <Pencil className="w-4 h-4" /> {c.edit}
        </Button>
      </div>
    </div>
  );
}

function SuccessCard({ c, name, rosterOk, needsRoster, onOpen, onRoster, shareUrl, shareMessage, onAnother }: {
  c: C; name: string; rosterOk: boolean; needsRoster: boolean;
  onOpen: () => void; onRoster: () => void; shareUrl: string; shareMessage: string; onAnother: () => void;
}) {
  const goRoster = needsRoster || !rosterOk;
  return (
    <div style={{ background: "var(--tl-green-glow)", border: "1px solid var(--tl-green)", borderRadius: "var(--tl-radius-lg)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <strong style={{ fontSize: 17, color: "var(--tl-fg)" }}>{c.created(name)}</strong>
      {!rosterOk && <p style={{ margin: 0, fontSize: 14, color: "var(--tl-fg-2)" }}>{c.rosterFailed}</p>}
      <Button variant="default" size="lg" onClick={goRoster ? onRoster : onOpen} style={{ minHeight: 52, fontSize: 17 }}>
        {goRoster ? c.enterRoster : c.openTable}
      </Button>
      <QuickTableShareActions
        url={shareUrl}
        title={name}
        message={shareMessage}
        copyLink={c.copyLink}
        copyZalo={c.copyZalo}
        sendZalo={c.sendZalo}
        copied={c.copied}
      />
      <Button variant="ghost" onClick={onAnother}>{c.another}</Button>
    </div>
  );
}

export default QuickTableChat;
