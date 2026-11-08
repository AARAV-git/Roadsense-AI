"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Film, FileVideo, Loader2, UploadCloud, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number): string {
  if (!isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1,
  );
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

export interface UploadFormProps {
  onUploaded?: (sessionId: string, name: string) => void;
}

export function UploadForm({ onUploaded }: UploadFormProps) {
  const { toast } = useToast();
  const [name, setName] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const clipName = file?.name ?? "";

  const acceptFile = (f: File | null) => {
    if (!f) {
      setFile(null);
      return;
    }
    const isVideo =
      f.type.startsWith("video/") ||
      /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(f.name);
    if (!isVideo) {
      toast({
        title: "Unsupported file",
        description: "Choose a video file (.mp4, .mov, .webm, .mkv).",
        variant: "destructive",
      });
      return;
    }
    setFile(f);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    acceptFile(e.target.files?.[0] ?? null);
    // reset so re-selecting the same file fires the change event again
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    acceptFile(e.dataTransfer.files?.[0] ?? null);
  };

  const onSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast({
        title: "Name required",
        description: "Give this run a name before starting analysis.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.uploadClip({
        name: trimmed,
        clipName: clipName || "untitled.mp4",
      });
      toast({
        title: "Analysis queued",
        description: `session ${res.session_id} · ${trimmed}`,
      });
      onUploaded?.(res.session_id, trimmed);
      // reset form for the next upload
      setName("");
      setFile(null);
    } catch (err) {
      toast({
        title: "Upload failed",
        description:
          err instanceof Error ? err.message : "Could not queue the analysis.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <Card className="rs-grid-bg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UploadCloud className="size-4 text-emerald-400" />
            Upload clip
          </CardTitle>
          <CardDescription>
            run the full pipeline on a recorded video
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="rs-run-name">Run name</Label>
            <Input
              id="rs-run-name"
              placeholder="e.g. Jayanagar evening run"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              autoComplete="off"
            />
          </div>

          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Choose a video clip to upload"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "group relative cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors",
              "border-border hover:border-emerald-500/50 hover:bg-emerald-500/[0.04]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-[3px]",
              dragging && "border-emerald-500/70 bg-emerald-500/10",
              submitting && "pointer-events-none opacity-60",
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={onInputChange}
              disabled={submitting}
            />
            <UploadCloud
              className={cn(
                "mx-auto size-7 transition-colors",
                "text-emerald-400/80 group-hover:text-emerald-400",
                dragging && "text-emerald-400",
              )}
            />
            <p className="mt-2 text-sm font-medium">
              Drag a clip here or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              MP4 · MOV · WEBM · MKV
            </p>
          </div>

          {/* Selected file chip */}
          {file && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">
                <FileVideo className="size-3.5 text-emerald-300" />
                <span className="max-w-[220px] truncate font-medium">
                  {file.name}
                </span>
                <span className="text-emerald-400/70">
                  · {formatBytes(file.size)}
                </span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-rose-300"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
                disabled={submitting}
              >
                <X className="size-3.5" />
                Remove
              </Button>
            </div>
          )}

          {/* Captured clip name */}
          <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Film className="size-3.5" />
              Clip name
            </span>
            <span className="truncate font-mono text-foreground/80 max-w-[220px]">
              {clipName || "—"}
            </span>
          </div>

          <Button
            onClick={onSubmit}
            disabled={submitting || !name.trim()}
            className="w-full bg-emerald-500 text-emerald-950 shadow-[0_0_20px_-6px_oklch(0.72_0.16_162_/_0.6)] hover:bg-emerald-400"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Starting analysis…
              </>
            ) : (
              <>
                <UploadCloud className="size-4" />
                Start analysis
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default UploadForm;
