import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type SendTarget = "all" | "specific";

export default function AdminPushNotification() {
  const [target, setTarget] = useState<SendTarget>("all");
  const [userIds, setUserIds] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!title.trim()) {
      toast.error("Vui lòng nhập tiêu đề");
      return;
    }
    if (!body.trim()) {
      toast.error("Vui lòng nhập nội dung");
      return;
    }

    setSending(true);
    try {
      let targetUserIds: string[] = [];

      if (target === "all") {
        // Get all unique user_ids from push_tokens
        const { data: tokens, error } = await supabase
          .from("push_tokens")
          .select("user_id");

        if (error) throw error;

        targetUserIds = [...new Set(tokens?.map((t) => t.user_id) || [])];

        if (targetUserIds.length === 0) {
          toast.warning("Không có user nào đã đăng ký push token");
          setSending(false);
          return;
        }
      } else {
        const emailList = userIds
          .split(/[,\n]/)
          .map((e) => e.trim())
          .filter(Boolean);

        if (emailList.length === 0) {
          toast.error("Vui lòng nhập ít nhất 1 email");
          setSending(false);
          return;
        }

        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, email")
          .in("email", emailList);

        if (profileError) throw profileError;

        const foundEmails = new Set((profiles || []).map((p) => p.email));
        const notFound = emailList.filter((e) => !foundEmails.has(e));
        if (notFound.length > 0) {
          toast.error(`Email không tồn tại trong hệ thống: ${notFound.join(", ")}`);
          setSending(false);
          return;
        }

        targetUserIds = (profiles || []).map((p) => p.id);

        if (targetUserIds.length === 0) {
          toast.error("Vui lòng nhập ít nhất 1 email");
          setSending(false);
          return;
        }
      }

      const { data, error } = await supabase.functions.invoke("send-push-notification", {
        body: {
          user_ids: targetUserIds,
          title: title.trim(),
          body: body.trim(),
        },
      });

      if (error) throw error;

      toast.success(`Đã gửi thành công ${data?.sent || 0}/${data?.total_tokens || 0} thiết bị`);

      if (data?.errors?.length) {
        console.warn("Push errors:", data.errors);
      }

      // Reset form
      setTitle("");
      setBody("");
      setUserIds("");
    } catch (err: unknown) {
      console.error("Send push error:", err);
      toast.error("Lỗi khi gửi thông báo: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setSending(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Push Notification</h1>
            <p className="text-sm text-muted-foreground">Gửi thông báo đẩy đến người dùng</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Gửi thông báo</CardTitle>
            <CardDescription>Chọn đối tượng và soạn nội dung thông báo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Target selection */}
            <div className="space-y-3">
              <Label>Đối tượng nhận</Label>
              <RadioGroup
                value={target}
                onValueChange={(v) => setTarget(v as SendTarget)}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all" className="cursor-pointer">Tất cả users</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="specific" id="specific" />
                  <Label htmlFor="specific" className="cursor-pointer">User cụ thể</Label>
                </div>
              </RadioGroup>
            </div>

            {/* User IDs input */}
            {target === "specific" && (
              <div className="space-y-2">
                <Label htmlFor="userIds">Email (cách nhau bởi dấu phẩy hoặc xuống dòng)</Label>
                <Textarea
                  id="userIds"
                  placeholder="user@example.com, user2@example.com..."
                  value={userIds}
                  onChange={(e) => setUserIds(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Tiêu đề</Label>
              <Input
                id="title"
                placeholder="VD: Giải đấu mới đã bắt đầu!"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
              />
            </div>

            {/* Body */}
            <div className="space-y-2">
              <Label htmlFor="body">Nội dung</Label>
              <Textarea
                id="body"
                placeholder="VD: Hãy tham gia xem livestream ngay bây giờ..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={500}
                rows={3}
              />
            </div>

            {/* Send button */}
            <Button
              onClick={handleSend}
              disabled={sending}
              className="w-full"
              size="lg"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Đang gửi...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Gửi thông báo
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
