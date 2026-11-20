// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { en } from "@/i18n/en";
import { FollowOaBanner } from "@/components/social-events/FollowOaBanner";
import Login from "@/pages/Login";
const state=vi.hoisted(()=>({signUp:vi.fn(async()=>({error:null}))}));
vi.mock("@/i18n",()=>({useI18n:()=>({t:en,language:"en"})}));
vi.mock("@/hooks/useAuth",()=>({useAuth:()=>({user:null,loading:false,signUp:state.signUp,signIn:vi.fn()})}));
vi.mock("@/hooks/useUserProfile",()=>({useUserProfile:()=>({profile:null,isLoading:false})}));
vi.mock("@/components/seo",()=>({DynamicMeta:()=>null}));
vi.mock("@/hooks/use-toast",()=>({toast:vi.fn()}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{}}));
afterEach(()=>{cleanup();window.history.replaceState({},"","/");sessionStorage.clear();vi.restoreAllMocks();state.signUp.mockClear();});
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
