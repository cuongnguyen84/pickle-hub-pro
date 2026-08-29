export type NewsContentKind = "full" | "brief";
export type NewsLanguage = "en" | "vi";

export interface NewsLanguageDraft {
  title: string;
  summary: string;
  category: string;
  importance: number;
  sections: Array<{ heading?: string; paragraphs: string[] }>;
}

export interface DraftValidationIssue {
  language: NewsLanguage;
  code: "missing" | "structure" | "title" | "summary" | "category" |
    "importance" | "paragraphs" | "word_count" | "url" | "vi_diacritics";
  message: string;
}

export const WORD_LIMITS = {
  brief: { target: [170, 240], hard: [130, 320] },
  full: { target: [450, 700], hard: [300, 900] },
} as const;

export function countDraftWords(draft: NewsLanguageDraft): number {
  return draft.sections
    .flatMap((section) => section.paragraphs ?? [])
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function validateLanguageDraft(
  language: NewsLanguage,
  value: NewsLanguageDraft | null | undefined,
  kind: NewsContentKind,
): DraftValidationIssue[] {
  const issues: DraftValidationIssue[] = [];
  const add = (code: DraftValidationIssue["code"], message: string) =>
    issues.push({ language, code, message });

  if (!value) {
    add("missing", `${language} draft is missing`);
    return issues;
  }
  if (
    typeof value.title !== "string" ||
    typeof value.summary !== "string" ||
    !Array.isArray(value.sections) ||
    !value.sections.length
  ) {
    add("structure", `${language} draft is incomplete`);
    return issues;
  }
  if (value.title.trim().length < 12 || value.title.length > 120) {
    add("title", `${language} title length is invalid`);
  }
  if (value.summary.trim().length < 120 || value.summary.length > 300) {
    add("summary", `${language} summary length is invalid`);
  }
  if (!["tournament", "player", "equipment", "business", "community"].includes(value.category)) {
    add("category", `${language} category is invalid`);
  }
  if (!Number.isInteger(value.importance) || value.importance < 1 || value.importance > 5) {
    add("importance", `${language} importance is invalid`);
  }

  const paragraphs = value.sections.flatMap((section) => section.paragraphs ?? []);
  if (!paragraphs.length || paragraphs.some((paragraph) => typeof paragraph !== "string")) {
    add("paragraphs", `${language} paragraphs are invalid`);
    return issues;
  }

  const words = countDraftWords(value);
  const [minimum, maximum] = WORD_LIMITS[kind].hard;
  if (words < minimum || words > maximum) {
    add("word_count", `${language} body has ${words} words; hard limit is ${minimum}-${maximum}`);
  }

  const allText = `${value.title} ${value.summary} ${paragraphs.join(" ")}`;
  if (/https?:\/\/|www\./i.test(allText)) {
    add("url", `${language} draft contains a URL`);
  }
  if (language === "vi") {
    // Từng field một: body có dấu từng che được title mất dấu khi gộp chung
    // (prod 26/08: "Cong Bo Chung Ket ... Tai Thanh Phố" lọt qua check gộp).
    const fields: Array<[string, string]> = [
      ["title", value.title],
      ["summary", value.summary],
      ["body", paragraphs.join(" ")],
    ];
    for (const [name, text] of fields) {
      if (missingViDiacritics(text)) {
        add("vi_diacritics", `vi ${name} is missing Vietnamese diacritics`);
      }
    }
  }
  return issues;
}

function missingViDiacritics(text: string): boolean {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const vietnameseWords = words.filter((word) =>
    /[ăâđêôơưàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]/i.test(word)
  ).length;
  return vietnameseWords / words.length < 0.1;
}

export function fallbackContentKind(
  requestedKind: NewsContentKind,
  en: NewsLanguageDraft,
  vi: NewsLanguageDraft,
): NewsContentKind | null {
  if (requestedKind !== "full") return null;
  return validateLanguageDraft("en", en, "brief").length === 0 &&
      validateLanguageDraft("vi", vi, "brief").length === 0
    ? "brief"
    : null;
}

export function classifyRewriteFailure(message: string): {
  kind: "length" | "validation" | "gemini_http" | "publish" | "unknown";
  retryable: boolean;
} {
  if (/body has \d+ words|word|hard limit/i.test(message)) return { kind: "length", retryable: true };
  if (/Gemini HTTP (408|409|425|429|5\d\d)|timeout|network/i.test(message)) {
    return { kind: "gemini_http", retryable: true };
  }
  if (/publish failed/i.test(message)) return { kind: "publish", retryable: true };
  if (/draft|title|summary|category|importance|paragraph|URL|diacritics/i.test(message)) {
    return { kind: "validation", retryable: true };
  }
  return { kind: "unknown", retryable: false };
}
