

## Sửa lỗi Share Link không hiển thị OG metadata trên Facebook

### Vấn đề
Facebook Sharing Debugger trả về **response code 0** -- nghĩa là không đọc được nội dung từ `share.thepicklehub.net`. Nguyên nhân:

1. **Worker thiếu `apikey` header** khi gọi Supabase edge function. Supabase yêu cầu header `apikey` (anon key) cho mọi request, kể cả khi `verify_jwt = false`. Không có header này, Supabase trả lỗi 401, Worker nhận lỗi và Facebook không đọc được OG tags.

2. **`og:url` chưa được cập nhật** trong bản deploy -- vẫn dùng format cũ `thepicklehub.net/share/live/...` thay vì `share.thepicklehub.net/live/...`.

### Giải pháp

#### 1. Cập nhật Worker code trên Cloudflare (bạn tự làm)

Thêm `apikey` header vào Worker khi gọi Supabase:

```javascript
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/" || path === "/test") {
      return new Response("Share Worker is active!", {
        headers: { "Content-Type": "text/plain" }
      });
    }

    const userAgent = request.headers.get("User-Agent") || "";
    const supabaseBase = "https://nijiwypubmkvmjuafmgp.supabase.co/functions/v1";
    const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5paml3eXB1Ym1rdm1qdWFmbWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzMjA5MDcsImV4cCI6MjA4MTg5NjkwN30.v_pmxd3idyYRwGFcpxBc0fsZtlDYbFzxjxgkRGdyE8s";

    async function proxyToEdge(functionName, id) {
      try {
        const resp = await fetch(
          `${supabaseBase}/${functionName}?id=${id}`,
          {
            headers: {
              "User-Agent": userAgent,
              "apikey": supabaseAnonKey,
              "Authorization": `Bearer ${supabaseAnonKey}`
            }
          }
        );
        const body = await resp.text();
        return new Response(body, {
          status: resp.status,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=60, s-maxage=300"
          }
        });
      } catch (e) {
        return new Response("Proxy error", { status: 502 });
      }
    }

    const liveMatch = path.match(/^\/live\/(.+)$/);
    if (liveMatch) return proxyToEdge("og-live", liveMatch[1]);

    const videoMatch = path.match(/^\/video\/(.+)$/);
    if (videoMatch) return proxyToEdge("og-video", videoMatch[1]);

    const flexMatch = path.match(/^\/flex\/(.+)$/);
    if (flexMatch) return proxyToEdge("og-flex-tournament", flexMatch[1]);

    return new Response("Not Found", { status: 404 });
  },
};
```

**Thay doi quan trong**: Them `apikey` va `Authorization` header -- day la nguyen nhan chinh lam Facebook khong doc duoc OG tags.

#### 2. Re-deploy edge functions (Lovable tu dong lam)

Re-deploy `og-live` va `og-video` de cap nhat `og:url` sang format moi `share.thepicklehub.net/...`.

### Kiem tra sau khi hoan thanh

1. Mo `https://share.thepicklehub.net/live/e5c61e50-d121-4560-9c0a-6d978861d613` trong trinh duyet -- phai redirect toi trang chinh
2. Test tren [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) -- phai hien thi title, description, thumbnail day du
3. Test tuong tu voi mot video ID

