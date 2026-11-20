import { afterEach, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { canonicalRenewalIp, readRenewalBody, renewalDigest } from "../security";
afterEach(()=>vi.useRealTimers());
it("uses domain separated server HMAC rather than enumerable six-digit SHA",async()=>{
 const key="a".repeat(64);const code=await renewalDigest(key,"code","+84901234567:123456");
 expect(code).toBe(createHmac("sha256",Buffer.from(key,"hex")).update("registration-renewal:code:+84901234567:123456").digest("hex"));
 expect(await renewalDigest(key,"ip","+84901234567:123456")).not.toBe(code);
 expect(await renewalDigest(undefined,"code","123456")).toBeNull();
});
it("canonicalizes bounded IP syntax without asserting header authenticity",()=>{
 expect(canonicalRenewalIp("192.000.002.001")).toBe("192.0.2.1");
 expect(canonicalRenewalIp("2001:0db8:0:0:0:0:0:1")).toBe("[2001:db8::1]");
 for(const value of ["999.1.2.3","1.2.3.4,5.6.7.8","x".repeat(10000),"::1%eth0"]) expect(canonicalRenewalIp(value)).toBeNull();
});
it("rejects oversized streamed bodies without content-length",async()=>{
 expect(await readRenewalBody(new Request("https://example.test",{method:"POST",body:'{"code":"'+"1".repeat(5000)+'"}'}))).toBeNull();
});
it("cancels stalled bodies at the deadline",async()=>{
 vi.useFakeTimers();const cancel=vi.fn();
 const request=new Request("https://example.test",{method:"POST",body:new ReadableStream({cancel}),duplex:"half"} as RequestInit);
 const pending=readRenewalBody(request);await vi.advanceTimersByTimeAsync(3001);
 expect(await pending).toBeNull();expect(cancel).toHaveBeenCalled();
});
