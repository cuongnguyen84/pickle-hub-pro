import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Livestream {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  tournament_id: string | null;
  organizations?: { id: string; name: string } | null;
  tournaments?: { id: string; name: string } | null;
}

interface Tournament {
  id: string;
  name: string;
}

interface EditLivestreamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  livestream: Livestream | null;
  tournaments: Tournament[];
  onSave: (data: { id: string; title: string; description: string; thumbnail_url: string; tournament_id: string | null }) => Promise<void>;
  isPending: boolean;
}

export function EditLivestreamDialog({
  open,
  onOpenChange,
  livestream,
  tournaments,
  onSave,
  isPending,
}: EditLivestreamDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [tournamentId, setTournamentId] = useState<string>("none");

  useEffect(() => {
    if (livestream) {
      setTitle(livestream.title || "");
      setDescription(livestream.description || "");
      setThumbnailUrl(livestream.thumbnail_url || "");
      setTournamentId(livestream.tournament_id || "none");
    }
  }, [livestream]);

  const handleSave = async () => {
    if (!livestream) return;
    await onSave({
      id: livestream.id,
      title,
      description,
      thumbnail_url: thumbnailUrl,
      tournament_id: tournamentId === "none" ? null : tournamentId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Sửa thông tin Livestream</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Tiêu đề</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tiêu đề livestream"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Mô tả</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả chi tiết"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="thumbnail">URL Thumbnail</Label>
            <Input
              id="thumbnail"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder="https://..."
            />
            {thumbnailUrl && (
              <div className="mt-2 rounded-lg overflow-hidden bg-muted w-32 h-20">
                <img
                  src={thumbnailUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="tournament">Giải đấu</Label>
            <Select value={tournamentId} onValueChange={setTournamentId}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn giải đấu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Không thuộc giải nào</SelectItem>
                {tournaments.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleSave} disabled={isPending || !title.trim()}>
            {isPending ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
