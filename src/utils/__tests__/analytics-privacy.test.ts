// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { isPrivateAnalyticsUrl, analyticsLocation, analyticsProps } from "../analyticsPrivacy";
import { trackEvent, trackPageView } from "../ga";
const token="f6200000-0000-4000-8000-000000000004";
const privatePaths=[`/match/confirm/${token}`,`/login?next=%252Fdang-ky%252F${token}`,`/login?next=${encodeURIComponent(encodeURIComponent(encodeURIComponent(encodeURIComponent("/dang-ky/"+token))))}`,`/login?redirect=${encodeURIComponent("/auth/callback?code=secret")}`,`/dang-ky/${token}`,`/vi/%64ang-ky/${token}`,`/auth/callback#access_token=secret`,`/join/${token}`,`/login?redirect=${encodeURIComponent('/dang-ky/'+token)}`,`/blog/test?magic_token=${token}`,`/blog/test?phone=0901234567`,`/khoi-phuc-dang-ky`];
const html=readFileSync(resolve(import.meta.dirname,"../../../index.html"),"utf8");
const guard=html.match(/<script id="analytics-privacy-guard">([\s\S]*?)<\/script>/)![1];
function boot(path:string){
 const listeners=new Map<string,((e:unknown)=>void)[]>();
 const append=vi.fn();const assign=vi.fn();const push=vi.fn();const location={href:`https://www.thepicklehub.net${path}`,assign};
 const context:Record<string,unknown>={URL,location,history:{pushState:push,replaceState:push},document:{createElement:()=>({}),head:{appendChild:append}},addEventListener:(name:string,fn:(e:unknown)=>void)=>listeners.set(name,[...(listeners.get(name)??[]),fn])};context.window=context;vm.runInNewContext(guard,context);
 return {context,append,assign,push};
}
afterEach(()=>{window.history.replaceState({},"","/");vi.restoreAllMocks();});
it.each(privatePaths)("blocks initial SDK and manual events for %s",path=>{
 expect(isPrivateAnalyticsUrl(path)).toBe(true);
 const fixture=boot(path);expect((fixture.context.__tphAnalyticsAllowed as ()=>boolean)()).toBe(false);
 expect(fixture.append).toHaveBeenCalledWith(expect.objectContaining({name:"referrer",content:"no-referrer"}));
 window.history.replaceState({},"",path);window.gtag=vi.fn();trackPageView();trackEvent("test_event",{magic_token:token});expect(window.gtag).not.toHaveBeenCalled();
});
it("emits no query/hash/referrer/raw credential properties on a public page",()=>{
 window.history.replaceState({},"","/blog/test?utm_source=public#section");window.gtag=vi.fn();
 trackPageView();trackEvent("test_event",{magic_token:token,recovery_url:`/dang-ky/${token}`,email:"x@example.test",nested:{secret:"x"},public_count:2,url:"https://www.thepicklehub.net/blog/test?secret=x#frag",note:token});
 const payload=JSON.stringify(vi.mocked(window.gtag).mock.calls);
 for(const value of [token,"example.test","?utm","secret=x","#section","#frag"])expect(payload).not.toContain(value);
 expect(window.gtag).toHaveBeenCalledWith("event","page_view",expect.objectContaining({page_referrer:""}));
 expect(analyticsLocation("https://www.thepicklehub.net/blog/test?q=x#frag")?.page_location).toBe("https://www.thepicklehub.net/blog/test");
 expect(analyticsProps({public_count:2})).toEqual({public_count:2});
});
it("creates a clean document boundary before a public SPA exposes bearer URL",()=>{
 const fixture=boot("/blog/test");const history=fixture.context.history as History;history.pushState({},"",`/dang-ky/${token}`);
 expect(fixture.assign).toHaveBeenCalledWith(`/dang-ky/${token}`);expect(fixture.push).not.toHaveBeenCalled();
});
it("rechecks privacy at both deferred loaders and disables automatic page views",()=>{
 expect(html).toContain("gtagLoaded || !window.__tphAnalyticsAllowed()");expect(html).toContain("loaded || !window.__tphAnalyticsAllowed()");
 expect(html).toContain("send_page_view: false");expect(html).not.toContain("debug_mode: true");
});
it("does not inject third-party analytics into private SSR shells",async()=>{
 const {renderNoindexShell}=await import("../../../functions/_lib/render/static-pages");
 const body=await renderNoindexShell("https://www.thepicklehub.net",`/dang-ky/${token}`,"vi").text();
 expect(body).not.toContain("analytics.ahrefs.com");expect(body).toContain('name="referrer" content="no-referrer"');
});

it("invalidates previous cached bot and human heads",async()=>{
 const {prerenderCacheKey}=await import("../../../functions/_lib/prerender-cache-key");
 for(const human of [false,true]){
  const cache=new Map([158,159].map(version=>[`pr:v${version}:${human?"human:":""}/blog/test`,"unguarded analytics head"]));
  expect(cache.get(prerenderCacheKey("/blog/test",human))).toBeUndefined();
 }
});

it("retains approved failure/country enums while removing raw codes and personal name fields",()=>{
 expect(analyticsProps({failure_code:"otp_expired",country_code:"VN",otp_code:"123456",display_name:"A private name"})).toEqual({failure_code:"otp_expired",country_code:"VN"});
 expect(analyticsProps({failure_code:"provider says private phone123",country_code:"123456",code:"123456"})).toEqual({failure_code:"unknown"});
});

it("does not turn cross-origin history writes into navigations",()=>{
 const fixture=boot("/blog/test");const history=fixture.context.history as History;
 history.pushState({},"","https://other.test/dang-ky/credential");
 expect(fixture.assign).not.toHaveBeenCalled();expect(fixture.push).toHaveBeenCalled();
});

it("accepts bounded primitive dimensions while rejecting malformed/secret/unbounded values",()=>{
 expect(analyticsProps({count:2,enabled:true,nan:NaN,infinite:Infinity,missing:undefined,list:["secret"],large:"x".repeat(101),malformed_url:"http://[",email_value:"private@example.test",jwt_value:"eyJhbGciOiJSUzI1NiJ9.credential",journey_id:token,plain_uuid:token,source_route:"/blog/test?q=secret#frag",hash:"/auth/callback#access_token=credential",failure_code:"unknown",country_code:4})).toEqual({count:2,enabled:true,journey_id:token,source_route:"/blog/test",failure_code:"unknown"});
 expect(analyticsLocation("not-an-absolute-url")).toBeNull();
 expect(isPrivateAnalyticsUrl("https://www.thepicklehub.net/%E0%A4%A")).toBe(true);
});

it.each(["en", "vi"] as const)("merge retains main's %s AI-chat landing and private create route", async lang=>{
 const {renderCreateByChatPage, renderTools}=await import("../../../functions/_lib/render/tools");
 const {CREATE_BY_CHAT_PATHS, CREATE_BY_CHAT_COPY}=await import("../../content/tools/create-by-chat-copy");
 const origin="https://www.thepicklehub.net";
 const landingPath=CREATE_BY_CHAT_PATHS[lang];
 const chatPath=lang==="vi"?CREATE_BY_CHAT_PATHS.chatVi:CREATE_BY_CHAT_PATHS.chatEn;
 const landing=await renderCreateByChatPage(origin,landingPath,lang).text();
 expect(landing).toContain(CREATE_BY_CHAT_COPY[lang].h1);
 expect(landing).toContain(`href="${origin}${chatPath}"`);
 expect(landing).toContain(`${origin}${landingPath}`);
 expect(await renderTools(origin,lang==="vi"?"/vi/tools":"/tools",lang).text()).toContain(landingPath);
 const middleware=readFileSync(resolve(import.meta.dirname,"../../../functions/_middleware.ts"),"utf8");
 expect(middleware).toContain('if (path === "/tools/quick-tables/chat") return renderNoindexShell');
 expect(middleware).toContain('if (path === "/tools/create-by-chat") return renderCreateByChatPage');
 expect(middleware).toContain('if (path === "/tools/tao-giai-bang-chat") return renderCreateByChatPage');
});
