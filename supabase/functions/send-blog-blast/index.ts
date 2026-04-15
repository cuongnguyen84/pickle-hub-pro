/**
 * send-blog-blast — Supabase Edge Function
 *
 * Triggered by a Supabase Database Webhook when vi_blog_posts.status
 * transitions to 'published'. Creates a Mailchimp variate (A/B subject)
 * campaign using Template V2, then schedules it for the next
 * Tue/Wed/Thu at 8:30 AM ICT (01:30 UTC).
 *
 * Required secrets:
 *   MAILCHIMP_API_KEY          e.g. "abc123def456-us7"
 *   MAILCHIMP_AUDIENCE_ID      e.g. "1a2b3c4d5e"
 *   MAILCHIMP_WEBHOOK_SECRET   random hex — set in DB Webhook header
 *   SUPABASE_URL               injected by platform
 *   SUPABASE_SERVICE_ROLE_KEY  injected by platform
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SupabaseWebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: Record<string, unknown>;
  old_record: Record<string, unknown> | null;
}

interface PostRecord {
  id: string;
  slug: string;
  title: string;
  meta_description: string | null;
  excerpt: string | null;
  content_html: string | null;
  cover_image_url: string | null;
  status: string;
  skip_email_blast: boolean | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_OG_IMAGE = "https://www.thepicklehub.net/og-image.png";
const SITE_URL = "https://www.thepicklehub.net";

// ICT = UTC+7; 8:30 AM ICT = 01:30 UTC
const SEND_HOUR_UTC = 1;
const SEND_MINUTE_UTC = 30;

// Only send on Tue(2), Wed(3), Thu(4)
const ALLOWED_DOW = new Set([2, 3, 4]);

// ---------------------------------------------------------------------------
// Schedule helper: find next Tue/Wed/Thu at 01:30 UTC
// ---------------------------------------------------------------------------

function getNextSendTime(from: Date = new Date()): Date {
  const dt = new Date(from);
  // Start from today if current UTC time is before 01:30, else start from tomorrow
  if (
    dt.getUTCHours() > SEND_HOUR_UTC ||
    (dt.getUTCHours() === SEND_HOUR_UTC && dt.getUTCMinutes() >= SEND_MINUTE_UTC)
  ) {
    dt.setUTCDate(dt.getUTCDate() + 1);
  }
  dt.setUTCHours(SEND_HOUR_UTC, SEND_MINUTE_UTC, 0, 0);

  // Walk forward until we land on Tue/Wed/Thu
  for (let i = 0; i < 7; i++) {
    if (ALLOWED_DOW.has(dt.getUTCDay())) break;
    dt.setUTCDate(dt.getUTCDate() + 1);
  }
  return dt;
}

// ---------------------------------------------------------------------------
// Content helpers
// ---------------------------------------------------------------------------

/** Strip HTML tags from a string. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

/**
 * Extract top-N section headings from post HTML.
 * First tries <h2> tags; falls back to <li> items.
 */
function extractTopBullets(html: string, count: number): string[] {
  if (!html) return [];

  const h2Matches = [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/gis)];
  if (h2Matches.length >= count) {
    return h2Matches.slice(0, count).map((m) => stripHtml(m[1]));
  }

  const liMatches = [...html.matchAll(/<li[^>]*>(.*?)<\/li>/gis)];
  if (liMatches.length > 0) {
    return liMatches.slice(0, count).map((m) => stripHtml(m[1]));
  }

  return [];
}

/**
 * Build two A/B subject lines for a post.
 * Returns [subjectA, subjectB].
 */
function buildSubjects(title: string, isVI: boolean): [string, string] {
  if (isVI) {
    // Pattern A: curiosity gap; Pattern B: personal
    const short = title.length > 40 ? title.slice(0, 40) + "..." : title;
    return [
      `Bạn có biết: "${short}"`,
      `Anh/chị ơi, bài mới đăng: ${title}`,
    ];
  } else {
    return [
      `New guide: ${title}`,
      `Quick read: ${title}`,
    ];
  }
}

/**
 * Build the full Template V2 HTML for the email body.
 * shortHook is truncated to 120 chars to force the reader to click.
 */
function buildEmailV2(opts: {
  title: string;
  shortHook: string;
  heroImage: string;
  postUrl: string;
  bullets: string[];
  slug: string;
  psNote: string;
}): string {
  const { title, shortHook, heroImage, postUrl, bullets, slug, psNote } = opts;

  // Pad bullets array to 4 items
  const b = [...bullets];
  while (b.length < 4) b.push("Đọc thêm trong bài viết");

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; background: #f5f5f5;">

  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background: #f5f5f5; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; background: #ffffff; border-radius: 12px; overflow: hidden;">

          <!-- HERO IMAGE -->
          <tr>
            <td>
              <a href="${esc(postUrl)}&utm_content=hero-image" style="display: block;">
                <img src="${esc(heroImage)}" alt="${esc(title)}" width="600" style="display: block; width: 100%; max-width: 600px; height: auto;">
              </a>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding: 32px 32px 24px 32px;">

              <!-- TITLE -->
              <h1 style="font-size: 22px; line-height: 1.35; margin: 0 0 16px; color: #0a2540;">
                <a href="${esc(postUrl)}&utm_content=title" style="color: #0a2540; text-decoration: none;">${esc(title)}</a>
              </h1>

              <!-- GREETING -->
              <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px;">Chào anh/chị,</p>

              <!-- SHORT HOOK -->
              <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                ${esc(shortHook)}
              </p>

              <!-- NUMBERED LIST -->
              <p style="font-size: 16px; line-height: 1.6; margin: 0 0 12px; font-weight: 600;">Trong bài anh/chị sẽ đọc được:</p>
              <ol style="font-size: 16px; line-height: 1.85; margin: 0 0 24px; padding-left: 24px;">
                <li style="margin-bottom: 10px;">
                  <a href="${esc(postUrl)}&utm_content=bullet-1" style="color: #0a2540; font-weight: 500;">${esc(b[0])}</a>
                </li>
                <li style="margin-bottom: 10px;">
                  <a href="${esc(postUrl)}&utm_content=bullet-2" style="color: #0a2540; font-weight: 500;">${esc(b[1])}</a>
                </li>
                <li style="margin-bottom: 10px;">
                  <a href="${esc(postUrl)}&utm_content=bullet-3" style="color: #0a2540; font-weight: 500;">${esc(b[2])}</a>
                </li>
                <li style="margin-bottom: 10px;">
                  <a href="${esc(postUrl)}&utm_content=bullet-4" style="color: #0a2540; font-weight: 500;">${esc(b[3])}</a>
                </li>
              </ol>

              <!-- CTA PRIMARY BUTTON -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 8px 0 24px;">
                <tr>
                  <td style="background: #0a2540; border-radius: 8px;">
                    <a href="${esc(postUrl)}&utm_content=cta-primary" style="display: inline-block; padding: 14px 28px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px;">
                      Đọc toàn bộ bài →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- INLINE TEXT FALLBACK -->
              <p style="font-size: 14px; line-height: 1.6; color: #666; margin: 0 0 24px;">
                Hoặc <a href="${esc(postUrl)}&utm_content=text-fallback" style="color: #0a2540;">mở trong browser</a> để lưu làm bookmark.
              </p>

              <!-- P.S. SECTION -->
              <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;">
              <p style="font-size: 15px; line-height: 1.6; color: #444; margin: 0 0 12px;">
                <strong>P.S.</strong> ${esc(psNote)}
              </p>

              <!-- SIGN OFF -->
              <p style="font-size: 15px; line-height: 1.5; margin: 24px 0 4px;">Cường</p>
              <p style="font-size: 13px; line-height: 1.4; color: #888; margin: 0;">
                ThePickleHub · <a href="https://www.thepicklehub.net?utm_source=newsletter&utm_medium=email&utm_campaign=${esc(slug)}&utm_content=sig-home" style="color: #888;">thepicklehub.net</a>
              </p>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding: 20px 32px 32px 32px; background: #fafafa; border-top: 1px solid #e5e5e5;">
              <p style="font-size: 12px; line-height: 1.5; color: #999; margin: 0 0 8px;">
                Bạn nhận email này vì đã đăng ký nhận tin từ ThePickleHub.
              </p>
              <p style="font-size: 12px; line-height: 1.5; color: #999; margin: 0;">
                <a href="*|UNSUB|*" style="color: #999;">Huỷ đăng ký</a> ·
                <a href="*|UPDATE_PROFILE|*" style="color: #999;">Cập nhật preferences</a> ·
                <a href="*|ARCHIVE|*" style="color: #999;">Xem trên web</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Mailchimp API helpers
// ---------------------------------------------------------------------------

/** Extract Mailchimp data center from API key, e.g. "abc-us7" → "us7". */
function getDataCenter(apiKey: string): string {
  const parts = apiKey.split("-");
  return parts[parts.length - 1] || "us1";
}

/** Simple retry wrapper for Mailchimp 429 / transient errors. */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }
  throw lastError;
}

interface MailchimpCampaignCreatePayload {
  type: "variate";
  recipients: { list_id: string };
  variate_settings: {
    winner_criteria: string;
    wait_time: number;
    test_size: number;
    subject_lines: string[];
    from_names: string[];
    reply_to_addresses: string[];
  };
  settings: {
    title: string;
    from_name: string;
    reply_to: string;
    subject_line: string;
  };
  tracking: {
    opens: boolean;
    html_clicks: boolean;
    text_clicks: boolean;
    goal_tracking: boolean;
    ecomm360: boolean;
    google_analytics: string;
    clicktale: string;
  };
}

async function mailchimpRequest(
  method: string,
  path: string,
  apiKey: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const dc = getDataCenter(apiKey);
  const url = `https://${dc}.api.mailchimp.com/3.0${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Authorization": `Basic ${btoa(`anystring:${apiKey}`)}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  // Only POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Verify webhook secret
  const webhookSecret = Deno.env.get("MAILCHIMP_WEBHOOK_SECRET");
  if (webhookSecret) {
    const incoming = req.headers.get("x-webhook-secret");
    if (incoming !== webhookSecret) {
      console.error("Invalid webhook secret");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  } else {
    console.warn("MAILCHIMP_WEBHOOK_SECRET not set — skipping secret check");
  }

  let payload: SupabaseWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { type, table, record, old_record } = payload;

  // Only handle UPDATE on vi_blog_posts
  if (table !== "vi_blog_posts" || type !== "UPDATE") {
    return new Response(JSON.stringify({ skipped: true, reason: "not a vi_blog_posts update" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const post = record as PostRecord;
  const oldStatus = (old_record as Partial<PostRecord> | null)?.status ?? null;

  // Only fire when status transitions to 'published'
  if (post.status !== "published" || oldStatus === "published") {
    return new Response(JSON.stringify({ skipped: true, reason: "not a publish transition" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Honour skip flag
  if (post.skip_email_blast === true) {
    console.log(`Post ${post.slug}: skip_email_blast=true, skipping`);
    return new Response(JSON.stringify({ skipped: true, reason: "skip_email_blast" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate required env vars
  const apiKey = Deno.env.get("MAILCHIMP_API_KEY");
  const audienceId = Deno.env.get("MAILCHIMP_AUDIENCE_ID");
  if (!apiKey || !audienceId) {
    console.error("Missing MAILCHIMP_API_KEY or MAILCHIMP_AUDIENCE_ID");
    return new Response(JSON.stringify({ error: "Mailchimp not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const isVI = true; // this function only handles vi_blog_posts
  const language = "vi";

  // -------------------------------------------------------------------------
  // Deduplication: try to claim the blast slot before calling Mailchimp.
  // If UNIQUE(post_id, post_language) already exists, another invocation
  // already blasted this post — return 200 silently.
  // -------------------------------------------------------------------------
  const { error: claimError } = await supabase.from("posts_blasts").insert({
    post_id: post.id,
    post_slug: post.slug,
    post_language: language,
    mailchimp_campaign_id: "pending",
    scheduled_for: new Date().toISOString(),
  });

  if (claimError) {
    if (claimError.code === "23505") {
      // unique_violation — already blasted
      console.log(`Post ${post.slug} already blasted, skipping`);
      return new Response(JSON.stringify({ skipped: true, reason: "already_blasted" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.error("Claim insert error:", claimError);
    // Non-unique error — continue anyway (blast is more important than dedup)
  }

  // -------------------------------------------------------------------------
  // Build email content
  // -------------------------------------------------------------------------
  const summary = (post.excerpt || post.meta_description || post.title) as string;
  const shortHook = summary.length > 120 ? summary.slice(0, 120) + "..." : summary;
  const heroImage = (post.cover_image_url as string | null) || DEFAULT_OG_IMAGE;
  const postUrl =
    `${SITE_URL}/vi/blog/${post.slug}` +
    `?utm_source=newsletter&utm_medium=email&utm_campaign=${post.slug}`;
  const bullets = extractTopBullets((post.content_html as string | null) || "", 4);
  const [subjectA, subjectB] = buildSubjects(post.title as string, isVI);
  const psNote =
    "Nếu bài viết hữu ích, anh/chị có thể chia sẻ cho bạn pickleball nhé! 🙏";

  const htmlBody = buildEmailV2({
    title: post.title as string,
    shortHook,
    heroImage,
    postUrl,
    bullets,
    slug: post.slug as string,
    psNote,
  });

  const scheduledFor = getNextSendTime();

  // -------------------------------------------------------------------------
  // Mailchimp API calls
  // -------------------------------------------------------------------------
  let campaignId: string;

  try {
    // 1. Create variate campaign
    const createPayload: MailchimpCampaignCreatePayload = {
      type: "variate",
      recipients: { list_id: audienceId },
      variate_settings: {
        winner_criteria: "clicks",
        wait_time: 240,
        test_size: 50,
        subject_lines: [subjectA, subjectB],
        from_names: ["Cường"],
        reply_to_addresses: ["tapickleballvn@gmail.com"],
      },
      settings: {
        title: `[Blog] ${post.slug}`,
        from_name: "Cường",
        reply_to: "tapickleballvn@gmail.com",
        subject_line: subjectA,
      },
      tracking: {
        opens: true,
        html_clicks: true,
        text_clicks: true,
        goal_tracking: false,
        ecomm360: false,
        google_analytics: "",
        clicktale: "",
      },
    };

    const createRes = await withRetry(() =>
      mailchimpRequest("POST", "/campaigns", apiKey, createPayload)
    );

    if (!createRes.ok) {
      throw new Error(
        `Mailchimp create campaign failed: ${createRes.status} — ${JSON.stringify(createRes.data)}`,
      );
    }

    campaignId = (createRes.data as { id: string }).id;
    console.log(`Created Mailchimp campaign: ${campaignId}`);

    // 2. Set campaign HTML content
    const contentRes = await withRetry(() =>
      mailchimpRequest("PUT", `/campaigns/${campaignId}/content`, apiKey, {
        html: htmlBody,
      })
    );

    if (!contentRes.ok) {
      throw new Error(
        `Mailchimp set content failed: ${contentRes.status} — ${JSON.stringify(contentRes.data)}`,
      );
    }

    // 3. Schedule campaign
    // Mailchimp schedule_time must be in ISO 8601 UTC: "2026-04-17T01:30:00+00:00"
    const scheduleTime = scheduledFor.toISOString().replace(".000Z", "+00:00");
    const scheduleRes = await withRetry(() =>
      mailchimpRequest("POST", `/campaigns/${campaignId}/actions/schedule`, apiKey, {
        schedule_time: scheduleTime,
      })
    );

    if (!scheduleRes.ok) {
      throw new Error(
        `Mailchimp schedule failed: ${scheduleRes.status} — ${JSON.stringify(scheduleRes.data)}`,
      );
    }

    console.log(`Scheduled campaign ${campaignId} for ${scheduleTime}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Mailchimp error:", msg);

    // Update the pending claim row to record the failure so admin can see it
    await supabase
      .from("posts_blasts")
      .update({ mailchimp_campaign_id: `error:${msg.slice(0, 200)}` })
      .eq("post_id", post.id)
      .eq("post_language", language);

    // Return 200 so Supabase doesn't retry the webhook indefinitely
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // -------------------------------------------------------------------------
  // Update the dedup row with the real campaign ID
  // -------------------------------------------------------------------------
  await supabase
    .from("posts_blasts")
    .update({
      mailchimp_campaign_id: campaignId,
      mailchimp_campaign_url: `https://us1.admin.mailchimp.com/campaigns/wizard/neapolitan?id=${campaignId}`,
      scheduled_for: scheduledFor.toISOString(),
    })
    .eq("post_id", post.id)
    .eq("post_language", language);

  return new Response(
    JSON.stringify({
      success: true,
      campaign_id: campaignId,
      scheduled_for: scheduledFor.toISOString(),
      subjects: [subjectA, subjectB],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
