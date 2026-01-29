import type { ElementAttachment } from "@/form/types";
import { cn } from "@/lib/utils";
import { FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type ElementAttachmentsProps = {
  attachments?: ElementAttachment[];
  displayMode?: "list" | "slider";
  className?: string;
};

const formatBytes = (size?: number) => {
  if (!size || size <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
};

const buildSafeHref = (attachment: ElementAttachment) => {
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
  const fallback = new URL(`/api/v1/files/${attachment.file_id}/download`, origin);
  const rawUrl = attachment.url;
  if (!rawUrl) {
    return fallback.toString();
  }
  try {
    const parsed = new URL(rawUrl, origin);
    if (parsed.origin !== origin) {
      return fallback.toString();
    }
    const pathMatch = parsed.pathname.match(/^\/api\/v1\/files\/(\d+)\/download$/);
    if (!pathMatch || Number(pathMatch[1]) !== Number(attachment.file_id)) {
      return fallback.toString();
    }
    const token = parsed.searchParams.get("token");
    if (token) {
      fallback.searchParams.set("token", token);
    }
    return fallback.toString();
  } catch {
    return fallback.toString();
  }
};

const buildSafeHref = (attachment: ElementAttachment) => {
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
  const fallback = new URL(`/api/v1/files/${attachment.file_id}/download`, origin);
  const rawUrl = attachment.url;
  if (!rawUrl) {
    return fallback.toString();
  }
  try {
    const parsed = new URL(rawUrl, origin);
    if (parsed.origin !== origin) {
      return fallback.toString();
    }
    const pathMatch = parsed.pathname.match(/^\/api\/v1\/files\/(\d+)\/download$/);
    if (!pathMatch || Number(pathMatch[1]) !== Number(attachment.file_id)) {
      return fallback.toString();
    }
    const token = parsed.searchParams.get("token");
    if (token) {
      fallback.searchParams.set("token", token);
    }
    return fallback.toString();
  } catch {
    return fallback.toString();
  }
};

const escapeAttribute = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function ElementAttachments({ attachments, displayMode = "slider", className }: ElementAttachmentsProps) {
  const list = Array.isArray(attachments) ? attachments : [];
  if (list.length === 0) return null;

  const images = useMemo(
    () => list.filter((item) => item.mime_type?.startsWith("image/")),
    [list]
  );
  const nonImages = useMemo(
    () => list.filter((item) => !item.mime_type?.startsWith("image/")),
    [list]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const fadeTimeoutRef = useRef<number | null>(null);
  const swapTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (activeIndex >= images.length) {
      setActiveIndex(Math.max(images.length - 1, 0));
    }
  }, [activeIndex, images.length]);

  useEffect(() => {
    return () => {
      if (fadeTimeoutRef.current) {
        window.clearTimeout(fadeTimeoutRef.current);
      }
      if (swapTimeoutRef.current) {
        window.clearTimeout(swapTimeoutRef.current);
      }
    };
  }, []);

  const renderFileLink = (attachment: ElementAttachment) => {
    const href = buildSafeHref(attachment);
    return (
      <a
        key={attachment.file_id}
        href={href}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 text-sm text-primary underline underline-offset-2"
      >
        <FileText className="h-4 w-4" />
        <span className="truncate">{attachment.name}</span>
        <span className="text-xs text-muted-foreground">{formatBytes(attachment.size_bytes)}</span>
      </a>
    );
  };

  const renderImageCard = (attachment: ElementAttachment) => {
    const href = buildSafeHref(attachment);
    return (
      <div key={attachment.file_id} className="space-y-1">
        <a href={href} target="_blank" rel="noreferrer" className="block">
          <img
            src={href}
            alt={escapeAttribute(attachment.name || "attachment")}
            className="max-h-64 w-auto rounded-md border border-muted-foreground/20"
          />
        </a>
      </div>
    );
  };

  if (displayMode === "slider" && images.length > 1) {
    const current = images[activeIndex] ?? images[0];
    const changeSlide = (nextIndex: number) => {
      if (isFading) return;
      setIsFading(true);
      fadeTimeoutRef.current = window.setTimeout(() => {
        setActiveIndex(nextIndex);
        swapTimeoutRef.current = window.setTimeout(() => setIsFading(false), 60);
      }, 180);
    };
    return (
      <div className={cn("space-y-3 pt-2", className)}>
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => changeSlide((activeIndex - 1 + images.length) % images.length)}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            {activeIndex + 1}/{images.length}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => changeSlide((activeIndex + 1) % images.length)}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {current && (
          <div className={cn("transition-opacity duration-300", isFading ? "opacity-0" : "opacity-100")}>
            {renderImageCard(current)}
          </div>
        )}
        {nonImages.length > 0 && (
          <div className="space-y-2">{nonImages.map(renderFileLink)}</div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3 pt-2", className)}>
      {images.map(renderImageCard)}
      {nonImages.map(renderFileLink)}
    </div>
  );
}
