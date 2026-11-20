import { afterEach, expect, it, vi } from "vitest";
type Handler=(req:Request)=>Promise<Response>;
const state=vi.hoisted(()=>({handler:null as Handler|null,user:null as {id:string}|null,rpc:vi.fn(),sms:vi.fn(),update:vi.fn(),captcha:true}));
vi.mock("https://esm.sh/@supabase/supabase-js@2.89.0",()=>({createClient:()=>({rpc:state.rpc,from:()=>({update:(value:unknown)=>{state.update(value);const c={eq:()=>c,is:async()=>({error:null})};return c;}})})}));
vi.mock("../../_shared/auth.ts",()=>({getAuthUser:async()=>state.user,jsonResponse:(body:unknown,status=200)=>Response.json(body,{status})}));
vi.mock("../../_shared/sms-esms.ts",()=>({sendBrandnameSms:state.sms}));
vi.mock("../../_shared/otp.ts",()=>({generateOtpCode:()=>"123456",hashOtp:async(code:string,phone:string)=>`hashed:${phone}:${code}`}));
afterEach(()=>{vi.resetModules();vi.unstubAllGlobals();state.user=null;state.rpc.mockReset();state.sms.mockReset();state.update.mockReset();state.captcha=true;});
async function run(body:Record<string,unknown>){
 vi.stubGlobal("Deno",{env:{get:()=>"test"},serve:(h:Handler)=>{state.handler=h;}});
 vi.stubGlobal("fetch",async()=>Response.json({success:state.captcha}));
 await import("../index.ts");return state.handler!(new Request("https://example.test",{method:"POST",headers:{"cf-connecting-ip":"192.0.2.1"},body:JSON.stringify(body)}));
}
const base={phone:"0901234567",event_id:"f6200000-0000-4000-8000-000000000002"};
it("rejects unauthenticated owner action regardless of supplied identity",async()=>{expect((await run({action:"owner",owner_id:"victim",registration_id:base.event_id})).status).toBe(401);expect(state.rpc).not.toHaveBeenCalled();});
it("uses verified Auth identity, never request owner identity",async()=>{state.user={id:"verified-user"};state.rpc.mockResolvedValue({data:[]});expect((await run({action:"owner",owner_id:"victim",registration_id:base.event_id})).status).toBe(403);expect(state.rpc).toHaveBeenCalledWith("renew_registration_token_by_owner",expect.objectContaining({p_owner_id:"verified-user"}));});
it("CAPTCHA alone cannot renew or disclose a bearer token",async()=>{state.rpc.mockResolvedValue({data:[]});expect(await(await run({...base,action:"request",captcha_token:"human",email:"attacker@example.test"})).json()).toEqual({ok:true,code:"check_registered_phone"});expect(state.sms).not.toHaveBeenCalled();expect(state.rpc.mock.calls[0][0]).toBe("begin_registration_renewal");});
it("invalid CAPTCHA prevents budget and SMS",async()=>{state.captcha=false;expect((await run({...base,action:"request",captcha_token:"bad"})).status).toBe(401);expect(state.rpc).not.toHaveBeenCalled();});
it.each([true,false])("binds delivery to reserved phone and only marks provider success: %s",async(ok)=>{state.rpc.mockResolvedValue({data:[{challenge_id:"challenge",phone:"+84909999999"}]});state.sms.mockResolvedValue({ok,messageId:ok?"test-provider-id":null});expect(await(await run({...base,action:"request",captcha_token:"human",delivered:true,email:"evil@example.test"})).json()).toEqual({ok:true,code:"check_registered_phone"});expect(state.sms).toHaveBeenCalledWith(expect.objectContaining({phoneE164:"+84909999999"}));expect(state.update).toHaveBeenCalledTimes(ok?1:0);});
it("verification hashes code with normalized phone and delegates atomic proof consumption",async()=>{state.rpc.mockResolvedValue({data:[]});expect((await run({...base,action:"verify",code:"123456",delivered:true})).status).toBe(401);expect(state.rpc).toHaveBeenCalledWith("renew_registration_token_by_phone",{p_phone:"+84901234567",p_event_id:base.event_id,p_code_hash:"hashed:+84901234567:123456"});});
it("valid proof returns only the atomically issued credential",async()=>{state.rpc.mockResolvedValue({data:[{registration_id:"reg",magic_token:"fresh",rotated:true}]});expect(await(await run({...base,action:"verify",code:"123456"})).json()).toEqual({ok:true,registration_id:"reg",magic_token:"fresh",rotated:true});});

it("provider acceptance without explicit message ID cannot mark proof delivered",async()=>{state.rpc.mockResolvedValue({data:[{challenge_id:"challenge",phone:"+84901234567"}]});state.sms.mockResolvedValue({ok:true,messageId:null});const response=await run({...base,action:"request",captcha_token:"human"});expect(response.headers.get("Cache-Control")).toBe("no-store");expect(state.update).not.toHaveBeenCalled();});
