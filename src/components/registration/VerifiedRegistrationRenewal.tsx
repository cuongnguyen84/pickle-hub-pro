import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { normalizeVietnamPhone } from "@/lib/phone";
import { saveMyRegistration, readMyRegistration } from "@/lib/social-events/myRegistration";
import { registrationRenewalEnabled } from "@/lib/social-events/renewalFlag";
import { Button } from "@/components/ui/button";
import { TurnstileWidget } from "./TurnstileWidget";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const copy={
 en:{storage:"Ownership was verified, but this browser could not save the registration. Allow site storage or use another browser, then recover again.",title:"Verify registration ownership",context:"Open recovery from the event page to choose the correct event. Contact the organizer if the event is unavailable.",loading:"Loading event context…",phone:"Registered phone",request:"Send verification code",ack:"If a matching registration exists and SMS is available, a code will be sent to its registered phone. If none arrives, contact the organizer. CAPTCHA does not verify ownership.",code:"Six-digit code",verify:"Verify code",owner:"Recover my signed-in registration",error:"Verification is unavailable, or the code is invalid, expired or already used. Request a new code or contact the organizer.",again:"Start again",success:"Ownership verified. Your registration is restored on this device.",event:"Return to event",busy:"Verifying…"},
 vi:{storage:"Đã xác minh quyền sở hữu nhưng trình duyệt chưa lưu được đăng ký. Hãy cho phép lưu dữ liệu trang hoặc dùng trình duyệt khác, rồi khôi phục lại.",title:"Xác minh quyền sở hữu đăng ký",context:"Mở khôi phục từ trang sự kiện để chọn đúng sự kiện. Liên hệ ban tổ chức nếu không tìm thấy sự kiện.",loading:"Đang tải thông tin sự kiện…",phone:"Số điện thoại đã đăng ký",request:"Gửi mã xác minh",ack:"Nếu có đăng ký phù hợp và kênh SMS hoạt động, mã sẽ được gửi đến số điện thoại đã đăng ký. Nếu không nhận được, hãy liên hệ ban tổ chức. CAPTCHA không xác minh danh tính.",code:"Mã gồm sáu chữ số",verify:"Xác minh mã",owner:"Khôi phục đăng ký của tài khoản đang đăng nhập",error:"Chưa thể xác minh, hoặc mã không đúng, hết hạn hay đã dùng. Hãy yêu cầu mã mới hoặc liên hệ ban tổ chức.",again:"Bắt đầu lại",success:"Đã xác minh quyền sở hữu. Đăng ký được khôi phục trên thiết bị này.",event:"Về trang sự kiện",busy:"Đang xác minh…"},
};
interface Context {id:string;slug:string;title:string;ownerRegistrationId:string|null;}
interface RenewalResponse {ok?:boolean;code?:string;registration_id?:string;magic_token?:string;expires_at?:string;}
export function VerifiedRegistrationRenewal(){
 if(!registrationRenewalEnabled()) return null;
 return <EnabledRenewal/>;
}
function EnabledRenewal(){
 const [params]=useSearchParams();const {user}=useAuth();const {language}=useI18n();const text=copy[language==="vi"?"vi":"en"];
 const userId=user?.id??null;
 const eventId=params.get("event_id");const [context,setContext]=useState<Context|null>(null);const [loading,setLoading]=useState(false);
 useEffect(()=>{
  let cancelled=false;setContext(null);
  if(!eventId || !UUID.test(eventId)){setLoading(false);return;}
  setLoading(true);
  void(async()=>{
   try{
    const {data:event,error}=await supabase.from("social_events").select("id,slug,title_vi,title_en").eq("id",eventId).maybeSingle();
    if(error || !event || event.id!==eventId || !UUID.test(event.id) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(event.slug))return;
    let ownerRegistrationId:string|null=null;
    if(userId){
     const {data:owned,error:ownerError}=await supabase.from("event_registrations").select("id").eq("event_id",eventId).eq("profile_id",userId).order("registered_at",{ascending:false}).limit(1).maybeSingle();
     if(!ownerError && owned && UUID.test(owned.id))ownerRegistrationId=owned.id;
    }
    if(!cancelled)setContext({id:event.id,slug:event.slug,title:(language==="vi"?event.title_vi:event.title_en)||event.title_vi,ownerRegistrationId});
   }catch{/* Never log request context or credential-bearing errors. */}finally{if(!cancelled)setLoading(false);}
  })();return()=>{cancelled=true;};
 },[eventId,userId,language]);
 return <section className="rounded-md border border-border p-4 mb-5" aria-label={text.title}><h2>{text.title}</h2>{loading?<p role="status">{text.loading}</p>:context?<RenewalForm key={`${context.id}:${userId??"guest"}`} context={context} text={text}/>:<p>{text.context}</p>}</section>;
}
function RenewalForm({context,text}:{context:Context;text:typeof copy.en}){
 const [phone,setPhone]=useState("");const [captcha,setCaptcha]=useState<string|null>(null);const [code,setCode]=useState("");
 const [stage,setStage]=useState<"request"|"code"|"success">("request");const [busy,setBusy]=useState(false);const [failed,setFailed]=useState(false);const [storageFailed,setStorageFailed]=useState(false);
 const generation=useRef(0);useEffect(()=>()=>{generation.current++;},[]);
 const normalized=normalizeVietnamPhone(phone);
 async function invoke(action:"request"|"verify"|"owner"){
  const attempt=++generation.current;setBusy(true);setFailed(false);setStorageFailed(false);
  const body=action==="owner"?{action,registration_id:context.ownerRegistrationId}:action==="request"?{action,event_id:context.id,phone:normalized,captcha_token:captcha}:{action,event_id:context.id,phone:normalized,code};
  try{
   const {data,error}=await supabase.functions.invoke<RenewalResponse>("renew-registration-token",{body});
   if(attempt!==generation.current)return;
   if(error || !data?.ok)throw new Error("unavailable");
   if(action==="request"){
    if(data.code!=="check_registered_phone")throw new Error("unavailable");
    setStage("code");setCaptcha(null);return;
   }
   if(!data.magic_token || !UUID.test(data.magic_token) || !data.registration_id || !UUID.test(data.registration_id) || !data.expires_at || !Number.isFinite(Date.parse(data.expires_at)) || Date.parse(data.expires_at)<=Date.now() || action==="owner" && data.registration_id!==context.ownerRegistrationId)throw new Error("unavailable");
   // Existing device-only registration storage keeps its90-day retention. No
   // token in URL, analytics, logs, DOM link, query string or shared query cache.
   saveMyRegistration(context.id,{registration_id:data.registration_id,magic_token:data.magic_token,expires_at:new Date(Math.min(Date.parse(data.expires_at),Date.now()+90*24*60*60*1000)).toISOString()});
   const stored=readMyRegistration(context.id);
   if(stored?.magic_token!==data.magic_token || stored.registration_id!==data.registration_id){setCode("");setStorageFailed(true);return;}
   setCode("");setPhone("");setStage("success");
  }catch{if(attempt===generation.current)setFailed(true);}finally{if(attempt===generation.current)setBusy(false);}
 }
 return <div className="space-y-3"><h3>{context.title}</h3>
  {stage==="success"?<><p role="status">{text.success}</p><Link to={`/social/${encodeURIComponent(context.slug)}`}>{text.event}</Link></>:<>
   {context.ownerRegistrationId && <Button type="button" variant="outline" disabled={busy} onClick={()=>void invoke("owner")}>{text.owner}</Button>}
   {stage==="request"?<><label htmlFor="renewal-phone">{text.phone}</label><input id="renewal-phone" type="tel" value={phone} disabled={busy} maxLength={20} onChange={e=>setPhone(e.target.value)}/><TurnstileWidget onVerify={setCaptcha} onError={()=>setCaptcha(null)}/><Button type="button" variant="tl-primary" disabled={busy||!normalized||!captcha} onClick={()=>void invoke("request")}>{text.request}</Button></>:<><p role="status">{text.ack}</p><label htmlFor="renewal-code">{text.code}</label><input id="renewal-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} disabled={busy} onChange={e=>setCode(e.target.value.replace(/\D/g,""))}/><Button type="button" variant="tl-primary" disabled={busy||!/^\d{6}$/.test(code)} onClick={()=>void invoke("verify")}>{text.verify}</Button><button type="button" disabled={busy} onClick={()=>{generation.current++;setCode("");setCaptcha(null);setFailed(false);setStorageFailed(false);setStage("request");}}>{text.again}</button></>}
  </>}{busy&&<p role="status">{text.busy}</p>}{(failed||storageFailed)&&<p role="alert">{storageFailed?text.storage:text.error}</p>}
 </div>;
}
