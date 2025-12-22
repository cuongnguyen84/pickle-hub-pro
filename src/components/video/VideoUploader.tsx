import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, X, FileVideo, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoUploaderProps {
  onUpload: (file: File) => Promise<{ storagePath: string; videoUrl: string } | null>;
  onDelete?: (storagePath: string) => Promise<boolean>;
  isUploading: boolean;
  progress: { loaded: number; total: number; percentage: number } | null;
  error: string | null;
  storagePath: string | null;
  videoUrl: string | null;
  existingUrl?: string;
  existingSource?: "storage" | "mux";
  disabled?: boolean;
}

export function VideoUploader({
  onUpload,
  onDelete,
  isUploading,
  progress,
  error,
  storagePath,
  videoUrl,
  existingUrl,
  existingSource,
  disabled,
}: VideoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileSelect = async (file: File) => {
    if (!file.type.match(/^video\/(mp4|quicktime|webm)$/)) {
      return;
    }
    setSelectedFile(file);
    await onUpload(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleRemove = async () => {
    if (storagePath && onDelete) {
      await onDelete(storagePath);
    }
    setSelectedFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  // Show existing Mux source read-only
  if (existingSource === "mux" && !storagePath) {
    return (
      <div className="border border-border rounded-lg p-4 bg-surface-elevated">
        <div className="flex items-center gap-3">
          <FileVideo className="w-8 h-8 text-primary" />
          <div className="flex-1">
            <p className="font-medium text-foreground">Mux Video Source</p>
            <p className="text-sm text-foreground-secondary">
              This video uses Mux for playback. Upload a new file to switch to storage.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isUploading}
        >
          <Upload className="w-4 h-4 mr-2" />
          Replace with Storage
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          className="hidden"
          onChange={handleInputChange}
        />
      </div>
    );
  }

  // Upload complete state
  if (storagePath && videoUrl) {
    return (
      <div className="border border-accent-success/50 rounded-lg p-4 bg-accent-success/10">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-8 h-8 text-accent-success" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground">Video Uploaded</p>
            <p className="text-sm text-foreground-secondary truncate">
              {selectedFile?.name || storagePath.split("/").pop()}
            </p>
            {selectedFile && (
              <p className="text-xs text-foreground-muted">{formatSize(selectedFile.size)}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRemove}
            disabled={disabled}
            className="text-foreground-secondary hover:text-destructive"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        {/* Preview */}
        <div className="mt-4 aspect-video rounded-lg overflow-hidden bg-black">
          <video
            src={videoUrl}
            controls
            className="w-full h-full"
            preload="metadata"
          />
        </div>
      </div>
    );
  }

  // Existing storage file (edit mode)
  if (existingUrl && existingSource === "storage") {
    return (
      <div className="border border-border rounded-lg p-4 bg-surface-elevated">
        <div className="flex items-center gap-3">
          <FileVideo className="w-8 h-8 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground">Current Video</p>
            <p className="text-sm text-foreground-secondary">Video already uploaded</p>
          </div>
        </div>
        {/* Preview */}
        <div className="mt-4 aspect-video rounded-lg overflow-hidden bg-black">
          <video
            src={existingUrl}
            controls
            className="w-full h-full"
            preload="metadata"
          />
        </div>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isUploading}
        >
          <Upload className="w-4 h-4 mr-2" />
          Replace Video
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          className="hidden"
          onChange={handleInputChange}
        />
      </div>
    );
  }

  // Uploading state
  if (isUploading && progress) {
    return (
      <div className="border border-border rounded-lg p-6 bg-surface-elevated">
        <div className="flex items-center gap-3 mb-4">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <div className="flex-1">
            <p className="font-medium text-foreground">Uploading...</p>
            <p className="text-sm text-foreground-secondary">
              {selectedFile?.name}
            </p>
          </div>
          <span className="text-sm font-medium text-primary">
            {progress.percentage.toFixed(0)}%
          </span>
        </div>
        <Progress value={progress.percentage} className="h-2" />
        <p className="text-xs text-foreground-muted mt-2">
          {formatSize(progress.loaded)} / {formatSize(progress.total)}
        </p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="border border-destructive/50 rounded-lg p-4 bg-destructive/10">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-8 h-8 text-destructive" />
          <div className="flex-1">
            <p className="font-medium text-foreground">Upload Failed</p>
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </div>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          <Upload className="w-4 h-4 mr-2" />
          Try Again
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          className="hidden"
          onChange={handleInputChange}
        />
      </div>
    );
  }

  // Default upload zone
  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
        dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={disabled ? undefined : handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
    >
      <Upload className="w-12 h-12 mx-auto text-foreground-muted mb-4" />
      <p className="text-foreground font-medium mb-1">
        Drag & drop video here or click to browse
      </p>
      <p className="text-sm text-foreground-secondary">
        MP4, MOV, WebM • Max 500MB
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled}
      />
    </div>
  );
}
