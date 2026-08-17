// Telegram announcement for a published post. Its own module because both the
// Facebook path (index.ts) and the X path (x.ts) need it, and x.ts is imported
// by index.ts — putting it in either would make the import circular.

export interface NotifyEnv {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}

/**
 * Telegram parses the message as HTML, so any `&`, `<` or `>` in the text is
 * read as markup. An unescaped one makes the API return 400 and the
 * notification vanishes — silently, because the caller swallows failures.
 *
 * This is not hypothetical: the first roundup posted to X reads
 * "Waters & Khlif were down 0-6", and that single ampersand is enough.
 */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface PostedNotice {
  /** "Facebook" or "X" — the platform, on its own line and unmistakable. */
  platform: string;
  /** Which page or account, e.g. "TA Pickleball" or "@thepicklehub". */
  account: string;
  /** What went out: the article headline, or the post text itself. */
  body: string;
  url: string;
}

export function buildPostedMessage(n: PostedNotice): string {
  return [
    `✅ <b>Đã đăng lên ${escapeHtml(n.platform)}</b> — ${escapeHtml(n.account)}`,
    '',
    escapeHtml(n.body.trim()),
    '',
    escapeHtml(n.url),
  ].join('\n');
}

/**
 * Announce a published post. Best-effort by design: a failed notification must
 * never fail, retry or roll back a post that is already live on the platform.
 * Silent when the secrets are absent, so the pipeline runs unchanged without
 * them.
 */
export async function notifyPosted(env: NotifyEnv, notice: PostedNotice): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN ?? '';
  const chat = env.TELEGRAM_CHAT_ID ?? '';
  if (!token || !chat) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat,
        text: buildPostedMessage(notice),
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });
    // Log the reason rather than dropping it. A 400 here means the message was
    // malformed, and finding that out from an absent notification is exactly
    // the failure this project has spent a day chasing.
    if (!res.ok) {
      console.error('[social-poster] telegram rejected:', res.status, (await res.text()).slice(0, 200));
    }
  } catch (error) {
    console.error('[social-poster] telegram notify failed:', error);
  }
}
