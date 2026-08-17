// Telegram announcement for a published post. Its own module because both the
// Facebook path (index.ts) and the X path (x.ts) need it, and x.ts is imported
// by index.ts — putting it in either would make the import circular.

export interface NotifyEnv {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}

/**
 * Announce a published post. Best-effort by design: a failed notification must
 * never fail, retry or roll back a post that is already live on the platform.
 * Silent when the secrets are absent, so the pipeline runs unchanged without
 * them.
 */
export async function notifyPosted(
  env: NotifyEnv,
  channel: string,
  title: string,
  url: string,
): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN ?? '';
  const chat = env.TELEGRAM_CHAT_ID ?? '';
  if (!token || !chat) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat,
        text: `✅ <b>${channel}</b>\n${title}\n${url}`,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
  } catch (error) {
    console.error('[social-poster] telegram notify failed:', error);
  }
}

