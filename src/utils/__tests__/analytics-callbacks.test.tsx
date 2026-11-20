// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { en } from "@/i18n/en";
import { FollowOaBanner } from "@/components/social-events/FollowOaBanner";
import Login from "@/pages/Login";
const state=vi.hoisted(()=>({signUp:vi.fn(async():Promise<{error:Error|null}>=>({error:null})),signIn:vi.fn(async():Promise<{error:Error|null}>=>({error:null})),resend:vi.fn(async():Promise<{error:Error|null}>=>({error:null})),reset:vi.fn(async():Promise<{error:Error|null}>=>({error:null}))}));
vi.mock("@/i18n",()=>({useI18n:()=>({t:en,language:"en"})}));
vi.mock("@/hooks/useAuth",()=>({useAuth:()=>({user:null,loading:false,signUp:state.signUp,signIn:state.signIn})}));
vi.mock("@/hooks/useUserProfile",()=>({useUserProfile:()=>({profile:null,isLoading:false})}));
vi.mock("@/components/seo",()=>({DynamicMeta:()=>null}));
vi.mock("@/hooks/use-toast",()=>({toast:vi.fn()}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{auth:{resend:state.resend,resetPasswordForEmail:state.reset}}}));
afterEach(()=>{cleanup();window.history.replaceState({},"","/");sessionStorage.clear();vi.restoreAllMocks();state.signUp.mockClear();state.signIn.mockClear();state.resend.mockClear();state.reset.mockClear();state.resend.mockResolvedValue({error:null});state.reset.mockResolvedValue({error:null});state.signUp.mockResolvedValue({error:null});state.signIn.mockResolvedValue({error:null});});
it("follow callback cannot bypass private URL suppression even with a preloaded SDK",()=>{
 window.history.replaceState({},"","/dang-ky/credential");window.gtag=vi.fn();window.dataLayer=[];vi.spyOn(window,"open").mockImplementation(()=>null);
 render(<FollowOaBanner registrationId="private-registration"/>);fireEvent.click(screen.getByRole("button",{name:en.socialEvents.playerRegistration.followOaBanner.cta}));
 expect(window.gtag).not.toHaveBeenCalled();expect(window.dataLayer).toEqual([]);expect(window.open).toHaveBeenCalled();
});
it("signup callback cannot bypass private URL suppression even with a preloaded SDK",async()=>{
 window.history.replaceState({},"","/auth/callback?code=credential");window.gtag=vi.fn();window.dataLayer=[];
 render(<MemoryRouter initialEntries={["/login?mode=signup"]}><Login/></MemoryRouter>);
 fireEvent.change(screen.getByLabelText(en.auth.email),{target:{value:"synthetic@example.test"}});fireEvent.change(screen.getByLabelText(en.auth.password),{target:{value:"synthetic-password"}});
 fireEvent.submit(document.querySelector("form")!);await waitFor(()=>expect(state.signUp).toHaveBeenCalled());await screen.findByText(en.auth.verificationSentDesc);
 expect(window.gtag).not.toHaveBeenCalled();expect(window.dataLayer).toEqual([]);
});
it("public follow conversion retains safe intent without registration identity",()=>{
 window.history.replaceState({},"","/social/public-event");window.gtag=vi.fn();vi.spyOn(window,"open").mockImplementation(()=>null);
 render(<FollowOaBanner registrationId="private-registration"/>);fireEvent.click(screen.getByRole("button",{name:en.socialEvents.playerRegistration.followOaBanner.cta}));
 expect(window.gtag).toHaveBeenCalledWith("event","follow_oa_cta_click",expect.objectContaining({source:"registration_success_banner"}));expect(JSON.stringify(vi.mocked(window.gtag).mock.calls)).not.toContain("private-registration");
});
it("all application callbacks use the shared privacy utility",()=>{
 for(const path of ["src/hooks/useAuth.tsx","src/pages/Login.tsx","src/components/social-events/FollowOaBanner.tsx"]){const source=readFileSync(resolve(path),"utf8");expect(source).not.toMatch(/\.gtag\s*\(|dataLayer\.push/);expect(source).toContain("trackEvent(");}
});

it.each([
 ["signup","User already registered"], ["signup","opaque provider failure"],
 ["login","Invalid login credentials"], ["login","Email not confirmed"],
 ["login","network failure"], ["login",null],
])("%s callback with %s never transmits private context or error payload",async(mode,message)=>{
 window.history.replaceState({},"","/auth/callback?code=credential");window.gtag=vi.fn();window.dataLayer=[];
 const callback=mode==="signup"?state.signUp:state.signIn;callback.mockResolvedValue({error:message?new Error(message):null});
 render(<MemoryRouter initialEntries={[mode==="signup"?"/login?mode=signup":"/login"]}><Login/></MemoryRouter>);
 fireEvent.change(screen.getByLabelText(en.auth.email),{target:{value:"synthetic-private@example.test"}});fireEvent.change(screen.getByLabelText(en.auth.password),{target:{value:"synthetic-private-password"}});
 await act(async()=>{fireEvent.submit(document.querySelector("form")!);});
 expect(callback).toHaveBeenCalledWith("synthetic-private@example.test","synthetic-private-password");
 expect(window.gtag).not.toHaveBeenCalled();expect(window.dataLayer).toEqual([]);
});

it.each([false,true])("verification resend callback keeps private identity outside SDK (provider error=%s)",async(failed)=>{
 window.history.replaceState({},"","/auth/callback?code=private-credential");window.gtag=vi.fn();window.dataLayer=[];
 state.resend.mockResolvedValue({error:failed?new Error("private provider payload"):null});
 render(<MemoryRouter initialEntries={["/login?mode=signup"]}><Login/></MemoryRouter>);
 fireEvent.change(screen.getByLabelText(en.auth.email),{target:{value:"synthetic-private@example.test"}});fireEvent.change(screen.getByLabelText(en.auth.password),{target:{value:"synthetic-password"}});
 await act(async()=>{fireEvent.submit(document.querySelector("form")!);});
 await act(async()=>{fireEvent.click(screen.getByRole("button",{name:en.auth.resendVerification}));});
 expect(state.resend).toHaveBeenCalledWith(expect.objectContaining({email:"synthetic-private@example.test",type:"signup"}));
 expect(window.gtag).not.toHaveBeenCalled();expect(window.dataLayer).toEqual([]);
});
it.each([false,true])("password reset callback keeps private identity outside SDK (provider error=%s)",async(failed)=>{
 window.history.replaceState({},"","/auth/callback?code=private-credential");window.gtag=vi.fn();window.dataLayer=[];
 state.reset.mockResolvedValue({error:failed?new Error("private provider payload"):null});
 render(<MemoryRouter initialEntries={["/login"]}><Login/></MemoryRouter>);
 fireEvent.change(screen.getByLabelText(en.auth.email),{target:{value:"synthetic-private@example.test"}});
 fireEvent.click(screen.getByRole("button",{name:en.auth.forgotPassword}));
 await act(async()=>{fireEvent.click(screen.getByRole("button",{name:en.auth.resetPassword}));});
 expect(state.reset).toHaveBeenCalledWith("synthetic-private@example.test",expect.any(Object));
 expect(window.gtag).not.toHaveBeenCalled();expect(window.dataLayer).toEqual([]);
});
