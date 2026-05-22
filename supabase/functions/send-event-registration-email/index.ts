// ============================================================================
// send-event-registration-email — fires Resend email to event organizers
// ----------------------------------------------------------------------------
// Called by the AFTER INSERT trigger on event_registrations (via pg_net,
// see migration 20260522160000_event_registration_email.sql). Sends a
// single email per recipient using Resend.
//
// Body shape (Vietnamese):
//   Subject: "[ThePickleHub] {player_name} vừa đăng ký {event_title}"
//   Body:    Brief HTML with name, event title, link to roster
//
// Best-effort: errors are logged but never block the registration.
// verify_jwt=false; protected by an `x-internal-secret` header that
// matches a vault-stored secret so random callers can't spam Resend.
// ============================================================================

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const INTERNAL_SECRET = Deno.env.get("INTERNAL_NOTIFY_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

interface RequestBody {
  recipient_emails?: unknown;
  player_name?: unknown;
  event_title?: unknown;
  event_slug?: unknown;
  registration_id?: unknown;
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function logEvent(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ function: "send-event-registration-email", ...payload }));
}

function buildHtml(opts: {
  playerName: string;
  eventTitle: string;
  rosterUrl: string;
  eventUrl: string;
}): string {
  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>Đăng ký mới</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f5f5f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px;">
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#10b981;font-weight:600;">◆ ThePickleHub</p>
              <h1 style="margin:0 0 16px;font-size:22px;color:#111;font-weight:700;">Đăng ký mới</h1>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#333;">
                <strong style="color:#10b981;">${escapeHtml(opts.playerName)}</strong> vừa đăng ký vào sự kiện
                <strong>${escapeHtml(opts.eventTitle)}</strong>.
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#666;">
                Bạn có thể vào trang quản lý để xem danh sách đăng ký đầy đủ.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="border-radius:8px;background:#10b981;">
                    <a href="${escapeHtml(opts.rosterUrl)}"
                       style="display:inline-block;padding:12px 22px;font-size:14px;color:#ffffff;text-decoration:none;font-weight:600;">
                      Xem danh sách đăng ký →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:12px;color:#999;">
                Email này gửi tự động từ ThePickleHub khi có người đăng ký vào sự kiện của bạn.
                <br>
                <a href="${escapeHtml(opts.eventUrl)}" style="color:#10b981;text-decoration:none;">Xem trang sự kiện</a>
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 0;font-size:11px;color:#999;">
          thepicklehub.net · Pickleball cộng đồng Việt Nam
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  // Internal secret gate to prevent random callers from spamming Resend
  // even though verify_jwt is off.
  if (INTERNAL_SECRET) {
    const provided = req.headers.get("x-internal-secret");
    if (provided !== INTERNAL_SECRET) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }
  }

  if (!RESEND_API_KEY) {
    logEvent({ error: "RESEND_API_KEY not configured" });
    return jsonResponse({ error: "email_not_configured" }, 500);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const recipients = Array.isArray(body.recipient_emails)
    ? (body.recipient_emails as unknown[])
        .filter((e): e is string => typeof e === "string" && e.includes("@"))
    : [];
  const playerName = (typeof body.player_name === "string" && body.player_name.trim()) || "(không tên)";
  const eventTitle = (typeof body.event_title === "string" && body.event_title.trim()) || "(không tên)";
  const eventSlug = typeof body.event_slug === "string" ? body.event_slug : "";

  if (recipients.length === 0 || !eventSlug) {
    return jsonResponse({ sent: 0, message: "No recipients or event_slug" }, 200);
  }

  const eventUrl = `https://www.thepicklehub.net/social/${eventSlug}`;
  const rosterUrl = `https://www.thepicklehub.net/social/${eventSlug}/danh-sach`;
  const subject = `[ThePickleHub] ${playerName} vừa đăng ký ${eventTitle}`;
  const html = buildHtml({ playerName, eventTitle, rosterUrl, eventUrl });

  let sent = 0;
  const failures: Array<{ to: string; error: string }> = [];

  // Send in parallel — Resend dedupes by request, not by content.
  await Promise.all(
    recipients.map(async (to) => {
      try {
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "The Pickle Hub <no-reply@thepicklehub.net>",
            to: [to],
            subject,
            html,
          }),
        });
        if (resp.ok) {
          sent += 1;
        } else {
          const text = await resp.text();
          failures.push({ to, error: text.slice(0, 200) });
        }
      } catch (e) {
        failures.push({ to, error: e instanceof Error ? e.message : String(e) });
      }
    }),
  );

  logEvent({
    step: "done",
    sent,
    failures_count: failures.length,
    recipients_count: recipients.length,
  });

  return jsonResponse({ sent, total: recipients.length, failures }, 200);
});
