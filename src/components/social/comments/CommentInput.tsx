import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/i18n";
import { useMentionAutocomplete } from "@/hooks/social/useMentionAutocomplete";
import {
  detectMentionTrigger,
  applyMentionInsert,
} from "@/lib/social/comment-helpers";

const MAX_LENGTH = 500;
const WARN_LENGTH = 480;

interface CommentInputProps {
  /** Initial body — used for inline edit form. Empty for new comments. */
  initialBody?: string;
  /** Submit handler. Throws on failure → form stays open. */
  onSubmit: (body: string) => void | Promise<void>;
  /** Cancel handler. Provided for inline edit + reply modes; absent for the
   *  root comment composer (which has nothing to cancel back to). */
  onCancel?: () => void;
  /** Placeholder copy override. Otherwise bilingual default. */
  placeholder?: string;
  /** Disable while a submit is in flight. */
  isSubmitting?: boolean;
  /** Visible only for replies/edits — root composer is always-on. */
  autoFocus?: boolean;
  /** Submit button label override. Default "Đăng" / "Post". */
  submitLabel?: string;
}

/**
 * Plain-text comment composer with @-mention autocomplete. Keeps a
 * single source of truth for the input value and caret; the autocomplete
 * dropdown is driven by `detectMentionTrigger` against the current value.
 *
 * Keyboard:
 *   - Enter: submit (matches Strava/Twitter; Shift+Enter inserts newline)
 *   - Esc:   cancel (when onCancel provided)
 *   - ↑/↓ inside dropdown: navigate suggestions
 *   - Enter inside dropdown: select highlighted suggestion (overrides submit)
 *   - Tab inside dropdown: select highlighted suggestion + close
 */
export function CommentInput({
  initialBody = "",
  onSubmit,
  onCancel,
  placeholder,
  isSubmitting = false,
  autoFocus = false,
  submitLabel,
}: CommentInputProps) {
  const { language } = useI18n();
  const [value, setValue] = useState(initialBody);
  const [caret, setCaret] = useState(initialBody.length);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
      const end = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(end, end);
    }
  }, [autoFocus]);

  const trigger = detectMentionTrigger(value, caret);
  const { data: suggestions = [] } = useMentionAutocomplete(
    trigger ? trigger.query : null,
  );

  // Reset highlight on suggestion list change.
  useEffect(() => {
    setHighlightIndex(0);
  }, [trigger?.query]);

  const trimmedLength = value.trim().length;
  const overLimit = value.length > MAX_LENGTH;
  const canSubmit = !isSubmitting && trimmedLength > 0 && !overLimit;

  const placeholderCopy =
    placeholder ??
    (language === "vi" ? "Viết bình luận…" : "Write a comment…");
  const submitCopy =
    submitLabel ?? (language === "vi" ? "Đăng" : "Post");
  const cancelCopy = language === "vi" ? "Huỷ" : "Cancel";

  const handleSelect = (username: string) => {
    if (!trigger) return;
    const next = applyMentionInsert(value, caret, trigger.triggerStart, username);
    setValue(next.value);
    setCaret(next.caret);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(next.caret, next.caret);
    });
  };

  const submit = async () => {
    if (!canSubmit) return;
    await onSubmit(value.trim());
    setValue("");
    setCaret(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Dropdown keyboard handling takes precedence.
    if (trigger && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((i) =>
          i === 0 ? suggestions.length - 1 : i - 1,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const pick = suggestions[highlightIndex];
        if (pick) handleSelect(pick.username);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        // Move caret past the @ trigger to dismiss without selecting.
        setCaret(value.length);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
      return;
    }
    if (e.key === "Escape" && onCancel) {
      e.preventDefault();
      onCancel();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    setCaret(e.target.selectionStart);
  };

  const handleSelectionUpdate = (
    e: React.SyntheticEvent<HTMLTextAreaElement>,
  ) => {
    setCaret(e.currentTarget.selectionStart);
  };

  return (
    <div className="tl-comment-input" style={{ position: "relative" }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onKeyUp={handleSelectionUpdate}
        onClick={handleSelectionUpdate}
        placeholder={placeholderCopy}
        rows={3}
        maxLength={MAX_LENGTH + 50}
        aria-label={
          language === "vi" ? "Nội dung bình luận" : "Comment body"
        }
        disabled={isSubmitting}
        style={{
          width: "100%",
          minHeight: 72,
          padding: "10px 12px",
          fontFamily: "var(--tl-font-body, inherit)",
          fontSize: 14,
          lineHeight: 1.5,
          background: "var(--tl-bg-2, rgba(255,255,255,0.04))",
          border: "1px solid var(--tl-border, rgba(255,255,255,0.12))",
          borderRadius: 4,
          color: "var(--tl-fg, inherit)",
          resize: "vertical",
          outline: "none",
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 8,
          gap: 12,
          fontFamily: "'Geist Mono', monospace",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        <span
          style={{
            color:
              value.length >= WARN_LENGTH
                ? "var(--tl-live, #ff4136)"
                : "var(--tl-fg-3)",
          }}
          aria-live="polite"
        >
          {value.length} / {MAX_LENGTH}
        </span>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              style={{
                padding: "6px 10px",
                background: "transparent",
                border: "1px solid var(--tl-border)",
                borderRadius: 4,
                color: "var(--tl-fg-2)",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                cursor: isSubmitting ? "default" : "pointer",
              }}
            >
              {cancelCopy}
            </button>
          )}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit}
            aria-busy={isSubmitting}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              background: canSubmit
                ? "var(--tl-green, #00b96b)"
                : "var(--tl-bg-3, rgba(255,255,255,0.06))",
              border: "1px solid",
              borderColor: canSubmit
                ? "var(--tl-green, #00b96b)"
                : "var(--tl-border)",
              borderRadius: 4,
              color: canSubmit ? "#000" : "var(--tl-fg-3)",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              cursor: canSubmit ? "pointer" : "default",
            }}
          >
            {isSubmitting && (
              <Loader2 className="animate-spin" style={{ width: 12, height: 12 }} />
            )}
            {submitCopy}
          </button>
        </div>
      </div>

      {/* Mention autocomplete dropdown */}
      {trigger && suggestions.length > 0 && (
        <ul
          role="listbox"
          aria-label={
            language === "vi" ? "Gợi ý người dùng" : "User suggestions"
          }
          style={{
            position: "absolute",
            bottom: "calc(100% + 4px)",
            left: 0,
            right: 0,
            maxHeight: 240,
            overflowY: "auto",
            margin: 0,
            padding: 4,
            listStyle: "none",
            background: "var(--tl-bg-1, #0a0a0a)",
            border: "1px solid var(--tl-border)",
            borderRadius: 4,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            zIndex: 20,
          }}
        >
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              role="option"
              aria-selected={i === highlightIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(s.username);
              }}
              onMouseEnter={() => setHighlightIndex(i)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                cursor: "pointer",
                background:
                  i === highlightIndex
                    ? "var(--tl-bg-3, rgba(255,255,255,0.06))"
                    : "transparent",
                borderRadius: 2,
              }}
            >
              <span
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 12,
                  color: "var(--tl-fg)",
                }}
              >
                @{s.username}
              </span>
              {s.display_name && (
                <span
                  style={{
                    fontFamily: "'Instrument Serif', serif",
                    fontStyle: "italic",
                    fontSize: 14,
                    color: "var(--tl-fg-3)",
                  }}
                >
                  {s.display_name}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default CommentInput;
