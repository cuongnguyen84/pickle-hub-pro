import { expect, it, vi } from "vitest";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isPrivateAnalyticsUrl } from "../analyticsPrivacy";
const source=readFileSync(resolve(import.meta.dirname,"../../../public/sw-private-navigation.js"),"utf8");
function worker(){
 const listeners=new Map<string,(event:Record<string,unknown>)=>void>();
 const deleted:string[]=[];const keys=["https://app.test/dang-ky/credential","https://app.test/blog/public","https://app.test/drafts/local","https://other.test/dang-ky/external"];
 const context={URL,Response,Request:class{constructor(input:object,options:object){Object.assign(this,input,options);}},fetch:vi.fn(async()=>{throw new Error("offline");}),caches:{keys:async()=>["html-shell"],open:async()=>({keys:async()=>keys.map(url=>({url,method:"GET"})),delete:async(request:{url:string})=>{deleted.push(request.url);return true;}})},self:{location:new URL("https://app.test/sw-v3.js"),addEventListener:(name:string,handler:(event:Record<string,unknown>)=>void)=>listeners.set(name,handler)}};
 vm.runInNewContext(source,context);return {listeners,context,deleted};
}
it.each(["/dang-ky/credential","/auth/callback?code=secret","/match/confirm/invite","/blog/test?magic_token=secret","/login?next=%252Fdang-ky%252Fsecret","/blog/public","/blog/public?utm_source=campaign"])("worker private predicate matches utility: %s",async path=>{
 const test=worker();const respond=vi.fn();const stop=vi.fn();test.listeners.get("fetch")!({request:{mode:"navigate",url:`https://app.test${path}`},respondWith:respond,stopImmediatePropagation:stop});
 expect(respond).toHaveBeenCalledTimes(isPrivateAnalyticsUrl(path)?1:0);
 if(isPrivateAnalyticsUrl(path)){
  const response:Response=await respond.mock.calls[0][0];expect(response.status).toBe(503);expect(await response.text()).not.toContain("secret");expect(response.headers.get("Cache-Control")).toBe("no-store");expect(stop).toHaveBeenCalled();
 }
});
it("activation removes only same-origin private cache keys and preserves public/draft/external entries",async()=>{
 const test=worker();let pending:Promise<void>|undefined;test.listeners.get("activate")!({waitUntil:(value:Promise<void>)=>{pending=value;}});await pending;
 expect(test.deleted).toEqual(["https://app.test/dang-ky/credential"]);
});
