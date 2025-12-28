import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const sendEmail = async (to: string, subject: string, html: string) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "The Pickle Hub <no-reply@thepicklehub.net>",
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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AuthEmailRequest {
  type: "signup" | "reset_password" | "magic_link";
  email: string;
  token?: string;
  redirect_url?: string;
}

const getSignupEmailHtml = (token: string, redirectUrl: string) => `
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
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <div style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 16px 24px; border-radius: 12px;">
                <span style="font-size: 28px; font-weight: 700; color: #ffffff;">🏓 The Pickle Hub</span>
              </div>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #18181b; text-align: center;">
                Xác thực email của bạn
              </h1>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #52525b; text-align: center;">
                Cảm ơn bạn đã đăng ký tài khoản tại <strong>The Pickle Hub</strong>! 
                Nhấn nút bên dưới để xác thực địa chỉ email của bạn.
              </p>
              
              <!-- Button -->
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center" style="padding: 8px 0 24px;">
                    <a href="${redirectUrl}?token=${token}&type=signup" 
                       style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px; box-shadow: 0 2px 4px rgba(34, 197, 94, 0.3);">
                      Xác thực Email
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Divider -->
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td style="padding: 16px 0; border-top: 1px solid #e4e4e7;">
                    <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">
                      Hoặc sao chép link này vào trình duyệt:
                    </p>
                    <p style="margin: 8px 0 0; font-size: 12px; color: #a1a1aa; word-break: break-all; text-align: center;">
                      ${redirectUrl}?token=${token}&type=signup
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 40px;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center; line-height: 1.5;">
                Nếu bạn không yêu cầu email này, bạn có thể bỏ qua nó.<br>
                © 2024 The Pickle Hub. All rights reserved.
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

const getResetPasswordEmailHtml = (token: string, redirectUrl: string) => `
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
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <div style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 16px 24px; border-radius: 12px;">
                <span style="font-size: 28px; font-weight: 700; color: #ffffff;">🏓 The Pickle Hub</span>
              </div>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #18181b; text-align: center;">
                Đặt lại mật khẩu
              </h1>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #52525b; text-align: center;">
                Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản <strong>The Pickle Hub</strong>. 
                Nhấn nút bên dưới để tạo mật khẩu mới.
              </p>
              
              <!-- Button -->
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center" style="padding: 8px 0 24px;">
                    <a href="${redirectUrl}?token=${token}&type=recovery" 
                       style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px; box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);">
                      Đặt lại mật khẩu
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Warning -->
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
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 40px;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center; line-height: 1.5;">
                Nếu bạn không yêu cầu đặt lại mật khẩu, bạn có thể bỏ qua email này.<br>
                © 2024 The Pickle Hub. All rights reserved.
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

const getMagicLinkEmailHtml = (token: string, redirectUrl: string) => `
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
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <div style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 16px 24px; border-radius: 12px;">
                <span style="font-size: 28px; font-weight: 700; color: #ffffff;">🏓 The Pickle Hub</span>
              </div>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #18181b; text-align: center;">
                Đăng nhập vào The Pickle Hub
              </h1>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #52525b; text-align: center;">
                Nhấn nút bên dưới để đăng nhập vào tài khoản của bạn. 
                Link này chỉ có hiệu lực trong 10 phút.
              </p>
              
              <!-- Button -->
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center" style="padding: 8px 0 24px;">
                    <a href="${redirectUrl}?token=${token}&type=magiclink" 
                       style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px; box-shadow: 0 2px 4px rgba(34, 197, 94, 0.3);">
                      Đăng nhập ngay
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 40px;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center; line-height: 1.5;">
                Nếu bạn không yêu cầu email này, bạn có thể bỏ qua nó.<br>
                © 2024 The Pickle Hub. All rights reserved.
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

const handler = async (req: Request): Promise<Response> => {
  console.log("send-auth-email function called");
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, email, token, redirect_url }: AuthEmailRequest = await req.json();
    
    console.log(`Sending ${type} email to ${email}`);
    
    const redirectUrl = redirect_url || "https://thepicklehub.net/auth/callback";
    let subject: string;
    let html: string;
    
    switch (type) {
      case "signup":
        subject = "Xác thực email - The Pickle Hub";
        html = getSignupEmailHtml(token || "", redirectUrl);
        break;
      case "reset_password":
        subject = "Đặt lại mật khẩu - The Pickle Hub";
        html = getResetPasswordEmailHtml(token || "", redirectUrl);
        break;
      case "magic_link":
        subject = "Đăng nhập - The Pickle Hub";
        html = getMagicLinkEmailHtml(token || "", redirectUrl);
        break;
      default:
        throw new Error(`Unknown email type: ${type}`);
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
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
