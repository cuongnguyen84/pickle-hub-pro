import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// System prompt for step-aware AI assistant
const SYSTEM_PROMPT = `Bạn là AI hỗ trợ người dùng sử dụng hệ thống chia bảng thi đấu Pickleball.

QUAN TRỌNG - QUY TẮC BẮT BUỘC:
1. Chỉ trả lời về bước/màn hình hiện tại - KHÔNG trả lời ngoài phạm vi
2. Chỉ dựa trên dữ liệu được cung cấp trong context - KHÔNG suy đoán
3. Nếu thiếu dữ liệu, trả về: "Không đủ dữ liệu để xác minh"
4. KHÔNG can thiệp/thay đổi dữ liệu - chỉ hướng dẫn

CẤU TRÚC TRẢ LỜI BẮT BUỘC:

**📍 Trạng thái hiện tại**
[Mô tả người dùng đang ở đâu trong flow]

**✅ Việc cần làm ở bước này**
[Liệt kê 1-3 hành động cần thực hiện]

**📋 Điều kiện để tiếp tục**
[Các yêu cầu phải đáp ứng trước khi sang bước tiếp]

**⚠️ Nguyên nhân bị chặn (nếu có)**
[Giải thích tại sao không thể tiếp tục - quota, permission, dữ liệu thiếu]

CONTEXT CÁC MÀN HÌNH:
- quick-table-setup/info: Tạo giải mới - nhập tên, số VĐV, cấu hình đăng ký
- quick-table-setup/players: Nhập danh sách VĐV, team, hạt giống
- quick-table-view/group: Xem bảng đấu vòng bảng, nhập điểm
- quick-table-view/playoff: Xem và cập nhật vòng playoff
- registration: Đăng ký tham gia giải
- registration-manager: BTC quản lý đơn đăng ký

BLOCKING REASONS:
- quota_exceeded: User đã đạt giới hạn số giải được tạo (theo quota admin set hoặc mặc định 3)
- permission_denied: Không có quyền thực hiện thao tác
- soft_launch_limited: Áp dụng với user KHÔNG có quota riêng

Trả lời bằng tiếng Việt, ngắn gọn, đúng trọng tâm.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { screenName, stepName, contextData, question } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Input validation
    const safeScreenName = typeof screenName === 'string' ? screenName.slice(0, 100) : '';
    const safeStepName = typeof stepName === 'string' ? stepName.slice(0, 100) : '';
    const safeQuestion = typeof question === 'string' ? question.slice(0, 500) : '';

    // Build user message with context
    const userMessage = `
SCREEN: ${safeScreenName}
STEP: ${safeStepName}
CONTEXT DATA: ${JSON.stringify(contextData || {}, null, 2).slice(0, 2000)}

CÂU HỎI CỦA NGƯỜI DÙNG: ${safeQuestion || "Tôi cần làm gì ở bước này?"}
`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted, please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
