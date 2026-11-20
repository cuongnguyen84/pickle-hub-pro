import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { getAuthUser, jsonResponse as sharedJsonResponse } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { normalizeVietnamPhone } from "../_shared/phone.ts";
import { generateOtpCode, hashOtp } from "../_shared/otp.ts";
import { sendBrandnameSms } from "../_shared/sms-esms.ts";
function jsonResponse(body: unknown, status = 200): Response {
  const response = sharedJsonResponse(body, status);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Pragma", "no-cache");
  return response;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reject = (status = 400) => jsonResponse({ ok: false, code: "renewal_unavailable" },status);
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null,{headers:corsHeaders});
  if (req.method !== "POST") return reject(405);
  let body: Record<string,unknown>;
  try { const input = await req.json(); if (!input || typeof input !== "object" || Array.isArray(input)) return reject(); body=input; } catch { return reject(); }
  const db=createClient(Deno.env.get("SUPABASE_URL")??"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"");
  if(body.action==="owner") {
    const user=await getAuthUser(req,db);
    if (!user) return reject(401);
    if(typeof body.registration_id!=="string" || !UUID.test(body.registration_id)) return reject();
    const {data,error}=await db.rpc("renew_registration_token_by_owner",{p_registration_id:body.registration_id,p_owner_id:user.id});
    if(error || !data?.[0]) return reject(403);
    return jsonResponse({ok:true,...data[0]});
  }
  const phone=normalizeVietnamPhone(typeof body.phone==="string"?body.phone:"");
  if(!phone || typeof body.event_id!=="string" || !UUID.test(body.event_id)) return reject();
  if(body.action==="verify") {
    if(typeof body.code!=="string" || !/^\d{6}$/.test(body.code)) return reject();
    const {data,error}=await db.rpc("renew_registration_token_by_phone",{p_phone:phone,p_event_id:body.event_id,p_code_hash:await hashOtp(body.code,phone)});
    if(error || !data?.[0]) return reject(401);
    return jsonResponse({ok:true,...data[0]});
  }
  if(body.action!=="request" || typeof body.captcha_token!=="string") return reject();
  const secret=Deno.env.get("TURNSTILE_SECRET");
  if(!secret) return reject(503);
  try {
    const response=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:new URLSearchParams({secret,response:body.captcha_token})});
    if(!response.ok || !(await response.json()).success) return reject(401);
    // Gateway-supplied source only; no caller-controlled forwarded-for fallback.
    const ip=req.headers.get("cf-connecting-ip");
    if(!ip) return reject(503);
    const code=generateOtpCode();
    const {data,error}=await db.rpc("begin_registration_renewal",{p_phone:phone,p_event_id:body.event_id,p_ip_hash:await hashOtp(ip,"registration-renewal-ip"),p_code_hash:await hashOtp(code,phone)});
    if(error) return reject(503);
    const challenge=data?.[0];
    if(challenge) {
      const result=await sendBrandnameSms({phoneE164:challenge.phone,content:`[ThePickleHub] Ma khoi phuc dang ky: ${code}. Het han sau 5 phut. Khong chia se ma.`});
      if(result.ok && typeof result.messageId === "string" && result.messageId.length > 0) await db.from("registration_renewal_challenges").update({delivered_at:new Date().toISOString()}).eq("id",challenge.challenge_id).is("delivered_at",null);
    }
    // Neither provider failure, unknown phone nor budget exhaustion discloses existence.
    return jsonResponse({ok:true,code:"check_registered_phone"});
  } catch { return reject(503); }
});
