// ============================================================================
// CreateVenueModal — Sprint 2 Phase 3A.2
// ----------------------------------------------------------------------------
// Form to create a new venue when search/nearby returns nothing relevant.
// Auto-generates the slug via lib/social/slug. Inserts as the current user
// (created_by = auth.uid()), so RLS venues_auth_insert policy is satisfied
// (FIX 2 made it `created_by = auth.uid()`).
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
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { venueSlug } from "@/lib/social/slug";
import { toast } from "@/hooks/use-toast";
import type { Venue } from "@/hooks/social/types";

const VN_CITIES = [
  "Hà Nội",
  "TP. Hồ Chí Minh",
  "Đà Nẵng",
  "Hải Phòng",
  "Cần Thơ",
  "Nha Trang",
  "Huế",
  "Vũng Tàu",
  "Đà Lạt",
  "Quy Nhơn",
  "Khác",
];

const SURFACES = [
  { value: "concrete", label: "Bê tông" },
  { value: "asphalt",  label: "Nhựa đường" },
  { value: "acrylic",  label: "Acrylic" },
  { value: "wood",     label: "Sàn gỗ" },
  { value: "other",    label: "Khác" },
];

const schema = z.object({
  name: z.string().min(2, "Tên sân tối thiểu 2 ký tự").max(100),
  name_vi: z.string().max(100).optional(),
  city: z.string().min(1, "Chọn thành phố"),
  district: z.string().max(60).optional(),
  address: z.string().max(200).optional(),
  num_courts: z.coerce.number().int().min(0).max(50).optional(),
  surface_type: z.string().optional(),
  is_indoor: z.boolean().default(false),
});

type FormValues = z.infer<typeof schema>;

interface CreateVenueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (venue: Venue) => void;
}

export const CreateVenueModal = ({ open, onOpenChange, onCreated }: CreateVenueModalProps) => {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "", name_vi: "", city: "", district: "",
      address: "", num_courts: undefined, surface_type: undefined, is_indoor: false,
    },
  });

  const submit = async (values: FormValues) => {
    if (!user) {
      toast({ title: "Cần đăng nhập", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      // Slug uniqueness retry — append -2, -3 ... if collision
      const baseSlug = venueSlug(values.name, values.city);
      let attempt = 0;
      let inserted: Venue | null = null;
      while (!inserted && attempt < 5) {
        const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
        const { data, error } = await supabase
          .from("venues")
          .insert({
            slug,
            name: values.name,
            name_vi: values.name_vi || null,
            city: values.city,
            district: values.district || null,
            address: values.address || null,
            num_courts: values.num_courts ?? null,
            surface_type: values.surface_type || null,
            is_indoor: values.is_indoor,
            created_by: user.id,
          })
          .select(
            "id,slug,name,name_vi,city,district,address,latitude,longitude,num_courts,surface_type,is_indoor,is_verified",
          )
          .single();
        if (!error && data) {
          inserted = data as Venue;
          break;
        }
        if (error && error.code !== "23505") throw error; // not slug-unique
        attempt++;
      }
      if (!inserted) throw new Error("Không tạo được sân (slug trùng)");
      toast({ title: "Đã thêm sân mới", description: inserted.name });
      onCreated(inserted);
      form.reset();
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Không thêm được sân",
        description: e instanceof Error ? e.message : "Lỗi không xác định",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm sân mới</DialogTitle>
          <DialogDescription>
            Sân của bạn sẽ hiển thị ngay. Admin có thể duyệt thêm thông tin sau.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
          <div>
            <Label htmlFor="venue-name">Tên sân *</Label>
            <Input id="venue-name" {...form.register("name")} placeholder="Sân Long Biên" />
            {form.formState.errors.name && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="venue-name-vi">Tên hiển thị (VN)</Label>
            <Input id="venue-name-vi" {...form.register("name_vi")} placeholder="Tên tiếng Việt nếu khác" />
          </div>
          <div>
            <Label htmlFor="venue-city">Thành phố *</Label>
            <Select
              onValueChange={(v) => form.setValue("city", v, { shouldValidate: true })}
              value={form.watch("city")}
            >
              <SelectTrigger id="venue-city" className="h-11">
                <SelectValue placeholder="Chọn thành phố" />
              </SelectTrigger>
              <SelectContent>
                {VN_CITIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.city && (
              <p className="mt-1 text-xs text-destructive">{form.formState.errors.city.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="venue-district">Quận / Huyện</Label>
            <Input id="venue-district" {...form.register("district")} placeholder="Long Biên" />
          </div>
          <div>
            <Label htmlFor="venue-address">Địa chỉ</Label>
            <Input id="venue-address" {...form.register("address")} placeholder="Số 1, đường ABC" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="venue-courts">Số sân</Label>
              <Input
                id="venue-courts"
                type="number"
                min={0}
                max={50}
                inputMode="numeric"
                {...form.register("num_courts")}
              />
            </div>
            <div>
              <Label htmlFor="venue-surface">Mặt sân</Label>
              <Select
                onValueChange={(v) => form.setValue("surface_type", v)}
                value={form.watch("surface_type") ?? ""}
              >
                <SelectTrigger id="venue-surface" className="h-11">
                  <SelectValue placeholder="Chọn loại" />
                </SelectTrigger>
                <SelectContent>
                  {SURFACES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="venue-indoor" className="flex-1 cursor-pointer">Sân trong nhà</Label>
            <Switch
              id="venue-indoor"
              checked={form.watch("is_indoor")}
              onCheckedChange={(v) => form.setValue("is_indoor", v)}
            />
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
              disabled={submitting}
              className="bg-social-primary text-white hover:bg-social-primary-dark"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lưu sân
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateVenueModal;
