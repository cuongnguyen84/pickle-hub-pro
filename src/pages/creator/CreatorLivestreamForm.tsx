import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CreatorLayout } from "@/components/creator/CreatorLayout";
import { useCreatorAuth } from "@/hooks/useCreatorAuth";
import {
  useCreatorLivestream,
  useLivestreamMutations,
  useCreatorTournaments,
} from "@/hooks/useCreatorData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Save, Loader2, Copy, Radio, ExternalLink } from "lucide-react";
import type { Enums } from "@/integrations/supabase/types";

export default function CreatorLivestreamForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { organizationId } = useCreatorAuth();
  const isEditing = !!id;

  const { data: livestream, isLoading: livestreamLoading } = useCreatorLivestream(id, organizationId);
  const { data: tournaments } = useCreatorTournaments();
  const { createLivestream, updateLivestream } = useLivestreamMutations(organizationId);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    tournament_id: "",
    scheduled_start_at: "",
    status: "scheduled" as Enums<"livestream_status">,
    mux_live_stream_id: "",
    mux_playback_id: "",
    mux_stream_key: "",
    thumbnail_url: "",
  });

  useEffect(() => {
    if (livestream) {
      setFormData({
        title: livestream.title,
        description: livestream.description ?? "",
        tournament_id: livestream.tournament_id ?? "",
        scheduled_start_at: livestream.scheduled_start_at
          ? new Date(livestream.scheduled_start_at).toISOString().slice(0, 16)
          : "",
        status: livestream.status,
        mux_live_stream_id: livestream.mux_live_stream_id ?? "",
        mux_playback_id: livestream.mux_playback_id ?? "",
        mux_stream_key: livestream.mux_stream_key ?? "",
        thumbnail_url: livestream.thumbnail_url ?? "",
      });
    }
  }, [livestream]);

  const handleSubmit = async () => {
    const payload = {
      title: formData.title,
      description: formData.description || null,
      tournament_id: formData.tournament_id || null,
      scheduled_start_at: formData.scheduled_start_at
        ? new Date(formData.scheduled_start_at).toISOString()
        : null,
      status: formData.status,
      mux_live_stream_id: formData.mux_live_stream_id || null,
      mux_playback_id: formData.mux_playback_id || null,
      mux_stream_key: formData.mux_stream_key || null,
      thumbnail_url: formData.thumbnail_url || null,
      started_at: formData.status === "live" ? new Date().toISOString() : (isEditing ? livestream?.started_at : null),
      ended_at: formData.status === "ended" ? new Date().toISOString() : null,
    };

    if (isEditing && id) {
      await updateLivestream.mutateAsync({ id, ...payload });
    } else {
      await createLivestream.mutateAsync(payload);
    }
    navigate("/creator/livestreams");
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied to clipboard` });
  };

  const isSubmitting = createLivestream.isPending || updateLivestream.isPending;

  if (isEditing && livestreamLoading) {
    return (
      <CreatorLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </CreatorLayout>
    );
  }

  return (
    <CreatorLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/creator/livestreams")}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isEditing ? "Edit Livestream" : "New Livestream"}
            </h1>
            <p className="text-foreground-secondary mt-1">
              {isEditing ? "Update your livestream details" : "Schedule a new livestream"}
            </p>
          </div>
        </div>

        {/* Form */}
        <Card className="bg-surface border-border-subtle">
          <CardHeader>
            <CardTitle>Livestream Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter livestream title"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter livestream description"
                rows={4}
              />
            </div>

            {/* Tournament */}
            <div className="space-y-2">
              <Label htmlFor="tournament">Tournament (optional)</Label>
              <Select
                value={formData.tournament_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, tournament_id: value === "none" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a tournament" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {tournaments?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Scheduled Start */}
            <div className="space-y-2">
              <Label htmlFor="scheduled_start_at">Scheduled Start</Label>
              <Input
                id="scheduled_start_at"
                type="datetime-local"
                value={formData.scheduled_start_at}
                onChange={(e) =>
                  setFormData({ ...formData, scheduled_start_at: e.target.value })
                }
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value as Enums<"livestream_status"> })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="live">Live</SelectItem>
                  <SelectItem value="ended">Ended</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Thumbnail URL */}
            <div className="space-y-2">
              <Label htmlFor="thumbnail_url">Thumbnail URL</Label>
              <Input
                id="thumbnail_url"
                value={formData.thumbnail_url}
                onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Mux Settings */}
        <Card className="bg-surface border-border-subtle">
          <CardHeader>
            <CardTitle>Mux Settings (MVP)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-foreground-secondary">
              Enter Mux IDs manually for MVP. Real integration coming soon.
            </p>

            <div className="space-y-2">
              <Label htmlFor="mux_live_stream_id">Mux Live Stream ID</Label>
              <Input
                id="mux_live_stream_id"
                value={formData.mux_live_stream_id}
                onChange={(e) => setFormData({ ...formData, mux_live_stream_id: e.target.value })}
                placeholder="live_stream_id..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mux_playback_id">Mux Playback ID</Label>
              <Input
                id="mux_playback_id"
                value={formData.mux_playback_id}
                onChange={(e) => setFormData({ ...formData, mux_playback_id: e.target.value })}
                placeholder="playback_id..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mux_stream_key">Mux Stream Key (SENSITIVE)</Label>
              <div className="flex gap-2">
                <Input
                  id="mux_stream_key"
                  type="password"
                  value={formData.mux_stream_key}
                  onChange={(e) => setFormData({ ...formData, mux_stream_key: e.target.value })}
                  placeholder="stream_key..."
                />
                {formData.mux_stream_key && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(formData.mux_stream_key, "Stream Key")}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-destructive">
                ⚠️ This key is sensitive. Never share it publicly.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Streaming Guide */}
        {(formData.mux_stream_key || formData.mux_playback_id) && (
          <Card className="bg-surface border-border-subtle">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-primary" />
                Streaming Guide
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>RTMP URL</Label>
                <div className="flex items-center gap-2">
                  <Input value="rtmps://global-live.mux.com:443/app" readOnly />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      copyToClipboard("rtmps://global-live.mux.com:443/app", "RTMP URL")
                    }
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {formData.mux_stream_key && (
                <div className="space-y-2">
                  <Label>Stream Key</Label>
                  <div className="flex items-center gap-2">
                    <Input type="password" value={formData.mux_stream_key} readOnly />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(formData.mux_stream_key, "Stream Key")}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {formData.mux_playback_id && (
                <div className="space-y-2">
                  <Label>Playback URL</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={`https://stream.mux.com/${formData.mux_playback_id}.m3u8`}
                      readOnly
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        copyToClipboard(
                          `https://stream.mux.com/${formData.mux_playback_id}.m3u8`,
                          "Playback URL"
                        )
                      }
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      asChild
                    >
                      <a
                        href={`https://stream.mux.com/${formData.mux_playback_id}.m3u8`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.title}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <Save className="w-4 h-4 mr-2" />
            {isEditing ? "Save Changes" : "Create Livestream"}
          </Button>
        </div>
      </div>
    </CreatorLayout>
  );
}
