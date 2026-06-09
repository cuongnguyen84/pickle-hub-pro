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
import { useI18n } from "@/i18n";
import type { PlayerProfile } from "@/hooks/social/types";

const VN_CITIES_VI = [
  "Hà Nội",
  "TP. Hồ Chí Minh",
  "Đà Nẵng",
  "Hải Phòng",
  "Cần Thơ",
  "Nha Trang",
  "Huế",
  "Khác",
];
const VN_CITIES_EN = [
  "Hanoi",
  "Ho Chi Minh City",
  "Da Nang",
  "Hai Phong",
  "Can Tho",
  "Nha Trang",
  "Hue",
  "Other",
];

// Vietnam phone: 0 followed by 9 digits, OR +84 followed by 9 digits
const VN_PHONE_RE = /^(0\d{9}|\+84\d{9})$/;

const buildSchema = (language: "vi" | "en") =>
  z.object({
    display_name: z
      .string()
      .min(
        2,
        language === "vi" ? "Tên tối thiểu 2 ký tự" : "Name needs at least 2 characters",
      )
      .max(50),
    phone: z
      .string()
      .regex(
        VN_PHONE_RE,
        language === "vi"
          ? "Số điện thoại VN: 0xxxxxxxxx hoặc +84xxxxxxxxx"
          : "VN phone format: 0xxxxxxxxx or +84xxxxxxxxx",
      ),
    city: z
      .string()
      .min(1, language === "vi" ? "Chọn thành phố" : "Pick a city"),
  });

type FormValues = {
  display_name: string;
  phone: string;
  city: string;
};

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
  const { language } = useI18n();
  const VN_CITIES = language === "vi" ? VN_CITIES_VI : VN_CITIES_EN;
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(buildSchema(language)),
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
          title:
            language === "vi"
              ? "Đã có người chơi với SĐT này"
              : "Player with this phone already exists",
          description:
            language === "vi"
              ? "Tự động chọn từ danh sách."
              : "Auto-selected from your list.",
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

      // Ghost profiles have no auth user, but profiles.id, email and
      // profile_slug are all NOT NULL with no default — generate them here.
      // profile_slug uses the same formula as trg_profiles_set_profile_slug
      // (which only fills it when NULL), so providing it satisfies the typed
      // insert and the trigger leaves it untouched. Matches the existing
      // ghost+<uuid>@guest.thepicklehub.net rows. Without id/email the insert
      // hit a not-null violation (the regression that broke ghost creation).
      const id = crypto.randomUUID();
      const { data, error } = await supabase
        .from("profiles")
        .insert({
          id,
          email: `ghost+${id}@guest.thepicklehub.net`,
          profile_slug: id.replace(/-/g, "").slice(0, 12),
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
        title: language === "vi" ? "Đã thêm người chơi" : "Player added",
        description: `${values.display_name} (@${username})`,
      });
      onCreated(data as PlayerProfile);
      form.reset();
      onOpenChange(false);
    } catch (e) {
      toast({
        title:
          language === "vi"
            ? "Không thêm được người chơi"
            : "Couldn't add player",
        description:
          e instanceof Error
            ? e.message
            : language === "vi"
              ? "Lỗi không xác định"
              : "Unexpected error",
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
          <DialogTitle>
            {language === "vi" ? "Mời người chơi mới" : "Invite a new player"}
          </DialogTitle>
          <DialogDescription>
            {language === "vi"
              ? "Người này chưa có tài khoản? Tạo profile tạm bằng số điện thoại. Họ có thể nhận và xác nhận trận đấu khi đăng ký."
              : "No ThePickleHub account yet? Create a placeholder profile with their phone. They can claim and confirm the match when they sign up."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
          {overLimit && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {language === "vi"
                ? "Đã đạt giới hạn 3 người chơi mới mỗi phiên. Vui lòng search hoặc gửi link mời."
                : "Reached the 3-new-players-per-session limit. Search existing players or send an invite link."}
            </div>
          )}
          <div>
            <Label htmlFor="ghost-name">
              {language === "vi" ? "Tên hiển thị" : "Display name"} *
            </Label>
            <Input
              id="ghost-name"
              {...form.register("display_name")}
              placeholder={language === "vi" ? "Nguyễn Văn A" : "Cuong Nguyen"}
              autoComplete="name"
            />
            {form.formState.errors.display_name && (
              <p className="mt-1 text-xs text-destructive">
                {form.formState.errors.display_name.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="ghost-phone">
              {language === "vi" ? "Số điện thoại" : "Phone number"} *
            </Label>
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
            <Label htmlFor="ghost-city">
              {language === "vi" ? "Thành phố" : "City"} *
            </Label>
            <Select
              onValueChange={(v) => form.setValue("city", v, { shouldValidate: true })}
              value={form.watch("city")}
            >
              <SelectTrigger id="ghost-city" className="h-11">
                <SelectValue
                  placeholder={
                    language === "vi" ? "Chọn thành phố" : "Pick a city"
                  }
                />
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
              {language === "vi" ? "Hủy" : "Cancel"}
            </Button>
            <Button
              type="submit"
              disabled={submitting || overLimit}
              className="bg-social-primary text-white hover:bg-social-primary-dark"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {language === "vi" ? "Tạo" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGhostProfileModal;
