// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { VerifiedRegistrationRenewal } from "../VerifiedRegistrationRenewal";
const ids={event:"f6260000-0000-4000-8000-000000000002",registration:"f6260000-0000-4000-8000-000000000003",token:"f6260000-0000-4000-8000-000000000004",user:"f6260000-0000-4000-8000-000000000001"};
const state=vi.hoisted(()=>({invoke:vi.fn(),from:vi.fn(),eq:vi.fn(),save:vi.fn(),user:null as {id:string}|null,eventAvailable:true,persist:true}));
vi.mock("@/hooks/useAuth",()=>({useAuth:()=>({user:state.user})}));
vi.mock("@/i18n",()=>({useI18n:()=>({language:"en"})}));
vi.mock("@/lib/social-events/myRegistration",()=>({saveMyRegistration:state.save,readMyRegistration:()=>state.persist?state.save.mock.calls.at(-1)?.[1]:null}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{functions:{invoke:state.invoke},from:(table:string)=>{
 state.from(table);const chain={select:()=>chain,eq:(...args:unknown[])=>{state.eq(...args);return chain;},order:()=>chain,limit:()=>chain,maybeSingle:async()=>({data:table==="social_events"?(state.eventAvailable?{id:ids.event,slug:"renewal-event",title_en:"Event <img src=x onerror=bad()>",title_vi:"Sự kiện"}:null):{id:ids.registration},error:null})};return chain;
}}}));
vi.mock("../TurnstileWidget",()=>({TurnstileWidget:({onVerify}:{onVerify:(value:string)=>void})=><button onClick={()=>onVerify("captcha-human-only")}>Solve CAPTCHA</button>}));
afterEach(()=>{cleanup();vi.unstubAllEnvs();state.invoke.mockReset();state.from.mockReset();state.eq.mockReset();state.save.mockReset();state.user=null;state.eventAvailable=true;state.persist=true;});
function mount(path=`/khoi-phuc-dang-ky?event_id=${ids.event}`,enabled=true){if(enabled)vi.stubEnv("VITE_REGISTRATION_RENEWAL_ENABLED","true");return render(<MemoryRouter initialEntries={[path]}><VerifiedRegistrationRenewal/></MemoryRouter>);}
const credential=()=>({data:{ok:true,registration_id:ids.registration,magic_token:ids.token,expires_at:new Date(Date.now()+86400000).toISOString()}});
async function request(){await screen.findByText("Event <img src=x onerror=bad()>");fireEvent.change(screen.getByLabelText("Registered phone"),{target:{value:"0901234567"}});fireEvent.click(screen.getByText("Solve CAPTCHA"));fireEvent.click(screen.getByRole("button",{name:"Send verification code"}));}
it.each([undefined,"false","1"])("is absent and makes no requests when rollout flag is missing/off (%s)",value=>{vi.stubEnv("VITE_REGISTRATION_RENEWAL_ENABLED",value);const {container}=mount(undefined,false);expect(container.textContent).toBe("");expect(state.from).not.toHaveBeenCalled();expect(state.invoke).not.toHaveBeenCalled();});
it.each(["/khoi-phuc-dang-ky","/khoi-phuc-dang-ky?event_id=guess"])("requires visible event context rather than guessing: %s",path=>{mount(path);expect(screen.getByText(/Open recovery from the event page/)).toBeTruthy();expect(state.from).not.toHaveBeenCalled();expect(state.invoke).not.toHaveBeenCalled();});
it("does not accept an unavailable event context",async()=>{state.eventAvailable=false;mount();expect(await screen.findByText(/Open recovery from the event page/)).toBeTruthy();expect(screen.queryByText("Send verification code")).toBeNull();});
it("requests phone-only proof and restores device state without token URL/DOM/analytics",async()=>{
 state.invoke.mockResolvedValueOnce({data:{ok:true,code:"check_registered_phone"}}).mockResolvedValueOnce(credential());window.gtag=vi.fn();const {container}=mount();await request();
 expect(await screen.findByText(/If a matching registration exists and SMS is available/)).toBeTruthy();
 expect(state.invoke.mock.calls[0]).toEqual(["renew-registration-token",{body:{action:"request",event_id:ids.event,phone:"+84901234567",captcha_token:"captcha-human-only"}}]);
 expect(container.querySelector("img")).toBeNull();fireEvent.change(screen.getByLabelText("Six-digit code"),{target:{value:"12x3456"}});fireEvent.click(screen.getByRole("button",{name:"Verify code"}));
 expect(await screen.findByText(/Ownership verified/)).toBeTruthy();expect(state.invoke.mock.calls[1][1].body).toEqual({action:"verify",event_id:ids.event,phone:"+84901234567",code:"123456"});
 expect(state.save).toHaveBeenCalledWith(ids.event,expect.objectContaining({registration_id:ids.registration,magic_token:ids.token}));expect(container.innerHTML).not.toContain(ids.token);expect(screen.getByRole("link").getAttribute("href")).toBe("/social/renewal-event");expect(window.gtag).not.toHaveBeenCalled();
});
it.each(["wrong-code","expired-code","used-code","wrong-phone"])("shows safe verification retry guidance for %s",async()=>{
 state.invoke.mockResolvedValueOnce({data:{ok:true,code:"check_registered_phone"}}).mockResolvedValueOnce({error:new Error("private backend payload")});mount();await request();fireEvent.change(await screen.findByLabelText("Six-digit code"),{target:{value:"123456"}});fireEvent.click(screen.getByRole("button",{name:"Verify code"}));expect(await screen.findByRole("alert")).toHaveProperty("textContent",expect.stringContaining("invalid, expired or already used"));expect(state.save).not.toHaveBeenCalled();expect(document.body.textContent).not.toContain("private backend payload");
});
it("provider/configuration unavailability does not claim delivery",async()=>{state.invoke.mockResolvedValue({error:new Error("503")});mount();await request();expect(await screen.findByRole("alert")).toBeTruthy();expect(screen.queryByLabelText("Six-digit code")).toBeNull();expect(state.save).not.toHaveBeenCalled();});
it("signed-in action is scoped to the owned registration in the visible event",async()=>{
 state.user={id:ids.user};state.invoke.mockResolvedValue(credential());mount(`/khoi-phuc-dang-ky?event_id=${ids.event}&registration_id=attacker-supplied`);fireEvent.click(await screen.findByText("Recover my signed-in registration"));await screen.findByText(/Ownership verified/);
 expect(state.eq).toHaveBeenCalledWith("event_id",ids.event);expect(state.eq).toHaveBeenCalledWith("profile_id",ids.user);expect(state.invoke).toHaveBeenCalledWith("renew-registration-token",{body:{action:"owner",registration_id:ids.registration}});
});
it.each(["expired","wrong-registration"])("rejects invalid credential response: %s",async(kind)=>{
 state.user={id:ids.user};state.invoke.mockResolvedValue({data:{...credential().data,...(kind==="wrong-registration"?{registration_id:ids.event}:{expires_at:"2000-01-01"})}});mount();fireEvent.click(await screen.findByText("Recover my signed-in registration"));await screen.findByRole("alert");expect(state.save).not.toHaveBeenCalled();
});
it("restart clears the code and requires a fresh CAPTCHA request",async()=>{state.invoke.mockResolvedValue({data:{ok:true,code:"check_registered_phone"}});mount();await request();fireEvent.change(await screen.findByLabelText("Six-digit code"),{target:{value:"123456"}});fireEvent.click(screen.getByRole("button",{name:"Start again"}));await waitFor(()=>expect(screen.getByRole("button",{name:"Send verification code"}).hasAttribute("disabled")).toBe(true));expect(screen.queryByLabelText("Six-digit code")).toBeNull();});

it("does not persist an in-flight owner response after sign-out",async()=>{
 state.user={id:ids.user};let resolve:(value:ReturnType<typeof credential>)=>void=()=>{};state.invoke.mockImplementation(()=>new Promise(done=>{resolve=done;}));
 const mounted=mount();fireEvent.click(await screen.findByText("Recover my signed-in registration"));
 state.user=null;mounted.rerender(<MemoryRouter initialEntries={[`/khoi-phuc-dang-ky?event_id=${ids.event}`]}><VerifiedRegistrationRenewal/></MemoryRouter>);
 await waitFor(()=>expect(screen.queryByText("Recover my signed-in registration")).toBeNull());
 await act(async()=>resolve(credential()));expect(state.save).not.toHaveBeenCalled();
});

it("does not falsely claim restoration when browser storage is unavailable",async()=>{
 state.user={id:ids.user};state.persist=false;state.invoke.mockResolvedValue(credential());mount();fireEvent.click(await screen.findByText("Recover my signed-in registration"));expect(await screen.findByRole("alert")).toHaveProperty("textContent",expect.stringContaining("browser could not save"));expect(screen.queryByText(/Your registration is restored/)).toBeNull();
});
