// ============================================================================
// CreateGhostProfileModal — Sprint 2 Phase 3A.3
// ----------------------------------------------------------------------------
// Quick-add a ghost player by phone (player doesn't have a ThePickleHub
// account yet). Generates a unique username via lib/social/username-generator,
// inserts profiles row with is_ghost=true. The ghost can be claimed later
// when the real user signs up with the same phone.
//
// Rate limit (client-side): max 3 ghost creates per session to discourage
// fake roster stuffing.
// ============================================================================

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { generateUsername } from "@/lib/social/username-generator";
import { toast } from "@/hooks/use-toast";
import type { PlayerProfile } from "@/hooks/social/types";

const VN_CITIES = [
  "Hà Nội",
  "TP. Hồ Chí Minh",
  "Đà Nẵng",
  "Hải Phòng",
  "Cần Thơ",
  "Nha Trang",
  "Huế",
  "Khác",
];

// Vietnam phone: 0 followed by 9 digits, OR +84 followed by 9 digits
const VN_PHONE_RE = /^(0\d{9}|\+84\d{9})$/;

const schema = z.object({
  display_name: z.string().min(2, "Tên tối thiểu 2 ký tự").max(50),
  phone: z.string().regex(VN_PHONE_RE, "Số điện thoại VN: 0xxxxxxxxx hoặc +84xxxxxxxxx"),
  city: z.string().min(1, "Chọn thành phố"),
});

type FormValues = z.infer<typeof schema>;

interface CreateGhostProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (player: PlayerProfile) => void;
  /** Number of ghosts already created this session. */
  ghostCount: number;
}

const MAX_GHOSTS_PER_SESSION = 3;

export const CreateGhostProfileModal = ({
  open,
  onOpenChange,
  onCreated,
  ghostCount,
}: CreateGhostProfileModalProps) => {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { display_name: "", phone: "", city: "" },
  });

  const overLimit = ghostCount >= MAX_GHOSTS_PER_SESSION;

  const submit = async (values: FormValues) => {
    if (overLimit) return;
    setSubmitting(true);
    try {
      // Check phone uniqueness first
      const { data: existingByPhone } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, dupr_doubles, is_ghost, city")
        .eq("phone", values.phone)
        .maybeSingle();
      if (existingByPhone) {
        toast({
          title: "Đã có người chơi với SĐT này",
          description: "Tự động chọn từ danh sách.",
        });
        onCreated(existingByPhone as PlayerProfile);
        form.reset();
        onOpenChange(false);
        return;
      }

      const username = await generateUsername(values.display_name, {
        isAvailable: async (cand) => {
          const { data } = await supabase
            .from("profiles")
            .select("id")
            .eq("username", cand)
            .maybeSingle();
          return !data;
        },
      });

      const { data, error } = await supabase
        .from("profiles")
        .insert({
          username,
          display_name: values.display_name,
          phone: values.phone,
          city: values.city,
          country: "VN",
          is_ghost: true,
        })
        .select("id, username, display_name, avatar_url, dupr_doubles, is_ghost, city")
        .single();
      if (error) throw error;

      toast({
        title: "Đã thêm người chơi",
        description: `${values.display_name} (@${username})`,
      });
      onCreated(data as PlayerProfile);
      form.reset();
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Không thêm được người chơi",
        description: e instanceof Error ? e.message : "Lỗi không xác định",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mời người chơi mới</DialogTitle>
          <DialogDescription>
            Người này chưa có tài khoản? Tạo profile tạm bằng số điện thoại.
            Họ có thể nhận và xác nhận trận đấu khi đăng ký.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
          {overLimit && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              Đã đạt giới hạn 3 người chơi mới mỗi phiên. Vui lòng search hoặc gửi
              link mời.
            </div>
          )}
          <div>
            <Label htmlFor="ghost-name">Tên hiển thị *</Label>
            <Input
              id="ghost-name"
              {...form.register("display_name")}
              placeholder="Nguyễn Văn A"
              autoComplete="name"
            />
            {form.formState.errors.display_name && (
              <p className="mt-1 text-xs text-destructive">
                {form.formState.errors.display_name.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="ghost-phone">Số điện thoại *</Label>
            <Input
              id="ghost-phone"
              {...form.register("phone")}
              placeholder="0901234567"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
            />
            {form.formState.errors.phone && (
              <p className="mt-1 text-xs text-destructive">
                {form.formState.errors.phone.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="ghost-city">Thành phố *</Label>
            <Select
              onValueChange={(v) => form.setValue("city", v, { shouldValidate: true })}
              value={form.watch("city")}
            >
              <SelectTrigger id="ghost-city" className="h-11">
                <SelectValue placeholder="Chọn thành phố" />
              </SelectTrigger>
              <SelectContent>
                {VN_CITIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.city && (
              <p className="mt-1 text-xs text-destructive">
                {form.formState.errors.city.message}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={submitting || overLimit}
              className="bg-social-primary text-white hover:bg-social-primary-dark"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Tạo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGhostProfileModal;
