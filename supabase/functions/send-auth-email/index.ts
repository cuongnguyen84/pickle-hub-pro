import * as crypto from "https://deno.land/std@0.168.0/crypto/mod.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SEND_EMAIL_HOOK_SECRET = Deno.env.get("SEND_EMAIL_HOOK_SECRET");

const sendEmail = async (to: string, subject: string, html: string) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "The Pickle Hub <no-reply@mail.thepicklehub.net>",
      to: [to],
      subject,
      html,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }
  
  return response.json();
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-webhook-secret",
};

// Supabase Auth Hook format
interface AuthHookPayload {
  user: {
    id: string;
    email: string;
    email_confirmed_at?: string;
    phone?: string;
    created_at: string;
    updated_at: string;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: "signup" | "recovery" | "magiclink" | "email_change" | "invite";
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

// SECURITY: Verify HMAC signature from Supabase Auth Hook
const verifyWebhookSignature = async (payload: string, signatureHeader: string | null): Promise<boolean> => {
  if (!SEND_EMAIL_HOOK_SECRET) {
    console.warn("SEND_EMAIL_HOOK_SECRET not configured, skipping verification");
    return true;
  }
  
  if (!signatureHeader) {
    console.error("No webhook signature header provided");
    return false;
  }
  
  try {
    // Supabase Auth Hook sends signature as "v1,<base64_signature>"
    const parts = signatureHeader.split(",");
    if (parts.length < 2) {
      console.error("Invalid signature format");
      return false;
    }
    
    const receivedSignature = parts.slice(1).join(",");
    
    // The secret from env may have "v1," prefix — strip it
    let secretKey = SEND_EMAIL_HOOK_SECRET;
    if (secretKey.startsWith("v1,")) {
      secretKey = secretKey.substring(3);
    }
    const keyBytes = Uint8Array.from(atob(secretKey), c => c.charCodeAt(0));
    
    // Compute HMAC-SHA256
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const encoder = new TextEncoder();
    const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const computedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));
    
    // Constant-time comparison
    if (computedSignature.length !== receivedSignature.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < computedSignature.length; i++) {
      result |= computedSignature.charCodeAt(i) ^ receivedSignature.charCodeAt(i);
    }
    
    return result === 0;
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
};

// Check if request is from Supabase Auth Hook
const isAuthHookRequest = (body: any): body is AuthHookPayload => {
  return body && typeof body === 'object' && 'user' in body && 'email_data' in body;
};

const getSignupEmailHtml = (confirmationUrl: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 480px; width: 100%; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <div style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 16px 24px; border-radius: 12px;">
                <span style="font-size: 28px; font-weight: 700; color: #ffffff;">🏓 The Pickle Hub</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px;">
              <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #18181b; text-align: center;">
                Xác thực email của bạn
              </h1>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #52525b; text-align: center;">
                Cảm ơn bạn đã đăng ký tài khoản tại <strong>The Pickle Hub</strong>! 
                Nhấn nút bên dưới để xác thực địa chỉ email của bạn.
              </p>
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center" style="padding: 8px 0 24px;">
                    <a href="${confirmationUrl}" 
                       style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px; box-shadow: 0 2px 4px rgba(34, 197, 94, 0.3);">
                      Xác thực Email
                    </a>
                  </td>
                </tr>
              </table>
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td style="padding: 16px 0; border-top: 1px solid #e4e4e7;">
                    <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">
                      Hoặc sao chép link này vào trình duyệt:
                    </p>
                    <p style="margin: 8px 0 0; font-size: 12px; color: #a1a1aa; word-break: break-all; text-align: center;">
                      ${confirmationUrl}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px 40px;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center; line-height: 1.5;">
                Nếu bạn không yêu cầu email này, bạn có thể bỏ qua nó.<br>
                © 2026 The Pickle Hub. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const getResetPasswordEmailHtml = (confirmationUrl: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 480px; width: 100%; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <div style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 16px 24px; border-radius: 12px;">
                <span style="font-size: 28px; font-weight: 700; color: #ffffff;">🏓 The Pickle Hub</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px;">
              <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #18181b; text-align: center;">
                Đặt lại mật khẩu
              </h1>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #52525b; text-align: center;">
                Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản <strong>The Pickle Hub</strong>. 
                Nhấn nút bên dưới để tạo mật khẩu mới.
              </p>
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center" style="padding: 8px 0 24px;">
                    <a href="${confirmationUrl}" 
                       style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px; box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);">
                      Đặt lại mật khẩu
                    </a>
                  </td>
                </tr>
              </table>
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td style="padding: 16px; background-color: #fef3c7; border-radius: 8px;">
                    <p style="margin: 0; font-size: 14px; color: #92400e; text-align: center;">
                      ⚠️ Link này sẽ hết hạn sau 1 giờ
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px 40px;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center; line-height: 1.5;">
                Nếu bạn không yêu cầu đặt lại mật khẩu, bạn có thể bỏ qua email này.<br>
                © 2026 The Pickle Hub. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const getMagicLinkEmailHtml = (confirmationUrl: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 480px; width: 100%; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <div style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 16px 24px; border-radius: 12px;">
                <span style="font-size: 28px; font-weight: 700; color: #ffffff;">🏓 The Pickle Hub</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px;">
              <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #18181b; text-align: center;">
                Đăng nhập vào The Pickle Hub
              </h1>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #52525b; text-align: center;">
                Nhấn nút bên dưới để đăng nhập vào tài khoản của bạn. 
                Link này chỉ có hiệu lực trong 10 phút.
              </p>
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center" style="padding: 8px 0 24px;">
                    <a href="${confirmationUrl}" 
                       style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px; box-shadow: 0 2px 4px rgba(34, 197, 94, 0.3);">
                      Đăng nhập ngay
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px 40px;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center; line-height: 1.5;">
                Nếu bạn không yêu cầu email này, bạn có thể bỏ qua nó.<br>
                © 2026 The Pickle Hub. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const getInviteEmailHtml = (confirmationUrl: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 480px; width: 100%; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <div style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 16px 24px; border-radius: 12px;">
                <span style="font-size: 28px; font-weight: 700; color: #ffffff;">🏓 The Pickle Hub</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px;">
              <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #18181b; text-align: center;">
                Bạn được mời tham gia The Pickle Hub
              </h1>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #52525b; text-align: center;">
                Bạn đã được mời tham gia <strong>The Pickle Hub</strong>! 
                Nhấn nút bên dưới để chấp nhận lời mời và thiết lập tài khoản của bạn.
              </p>
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center" style="padding: 8px 0 24px;">
                    <a href="${confirmationUrl}" 
                       style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px; box-shadow: 0 2px 4px rgba(34, 197, 94, 0.3);">
                      Chấp nhận lời mời
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px 40px;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center; line-height: 1.5;">
                Nếu bạn không mong đợi email này, bạn có thể bỏ qua nó.<br>
                © 2026 The Pickle Hub. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const getEmailChangeEmailHtml = (confirmationUrl: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 480px; width: 100%; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <div style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 16px 24px; border-radius: 12px;">
                <span style="font-size: 28px; font-weight: 700; color: #ffffff;">🏓 The Pickle Hub</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px;">
              <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #18181b; text-align: center;">
                Xác nhận thay đổi email
              </h1>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #52525b; text-align: center;">
                Bạn đã yêu cầu thay đổi địa chỉ email cho tài khoản <strong>The Pickle Hub</strong>. 
                Nhấn nút bên dưới để xác nhận thay đổi.
              </p>
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center" style="padding: 8px 0 24px;">
                    <a href="${confirmationUrl}" 
                       style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);">
                      Xác nhận Email mới
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px 40px;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center; line-height: 1.5;">
                Nếu bạn không yêu cầu thay đổi email, vui lòng liên hệ hỗ trợ.<br>
                © 2026 The Pickle Hub. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// Build confirmation URL for Supabase Auth
const buildConfirmationUrl = (siteUrl: string, tokenHash: string, type: string, redirectTo: string): string => {
  const baseUrl = Deno.env.get("SUPABASE_URL") || siteUrl;
  return `${baseUrl}/auth/v1/verify?token=${tokenHash}&type=${type}&redirect_to=${encodeURIComponent(redirectTo)}`;
};

Deno.serve(async (req) => {
  console.log("send-auth-email function called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);
    
    // SECURITY: Only accept Auth Hook requests from Supabase
    if (!isAuthHookRequest(body)) {
      console.error("Rejected non-Auth-Hook request");
      return new Response(
        JSON.stringify({ error: "Only Supabase Auth Hook requests are accepted" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    // SECURITY: Verify HMAC signature from Supabase Auth Hook
    const signatureHeader = req.headers.get("x-supabase-webhook-secret");
    const isValid = await verifyWebhookSignature(rawBody, signatureHeader);
    
    if (!isValid) {
      console.error("Invalid webhook signature — request rejected");
      return new Response(
        JSON.stringify({ error: "Invalid webhook signature" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const { user, email_data } = body;
    const email = user.email;
    
    const confirmationUrl = buildConfirmationUrl(
      email_data.site_url,
      email_data.token_hash,
      email_data.email_action_type,
      email_data.redirect_to
    );
    
    console.log(`Auth Hook - Type: ${email_data.email_action_type}, Email: ${email}`);
    
    let subject: string;
    let html: string;
    
    switch (email_data.email_action_type) {
      case "signup":
        subject = "Xác thực email - The Pickle Hub";
        html = getSignupEmailHtml(confirmationUrl);
        break;
      case "recovery":
        subject = "Đặt lại mật khẩu - The Pickle Hub";
        html = getResetPasswordEmailHtml(confirmationUrl);
        break;
      case "magiclink":
        subject = "Đăng nhập - The Pickle Hub";
        html = getMagicLinkEmailHtml(confirmationUrl);
        break;
      case "invite":
        subject = "Lời mời tham gia - The Pickle Hub";
        html = getInviteEmailHtml(confirmationUrl);
        break;
      case "email_change":
        subject = "Xác nhận thay đổi email - The Pickle Hub";
        html = getEmailChangeEmailHtml(confirmationUrl);
        break;
      default:
        console.log(`Unknown email type: ${email_data.email_action_type}, using signup template`);
        subject = "The Pickle Hub";
        html = getSignupEmailHtml(confirmationUrl);
    }

    const emailResponse = await sendEmail(email, subject, html);
    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-auth-email function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
