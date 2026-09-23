import { useEffect, useRef, useState } from "react";
import {
  ArrowsInIcon,
  ArrowsOutIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import cn from "cnfast";
import { Button } from "@/src/components/ui/button";
import { useCaptureControls, useCaptureStream } from "@/src/hooks/use-capture";

export function CapturePreview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [expanded, setExpanded] = useState(false);
  const stream = useCaptureStream();
  const { error, permission, starting } = useCaptureControls();
  const permissionGranted =
    permission === "granted" || permission === "unsupported";

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    if (!expanded) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [expanded]);

  return (
    <div
      className={cn(
        "group/capture relative aspect-video w-4/5 overflow-hidden rounded-xl border border-border bg-black",
        expanded &&
          "fixed inset-0 z-50 h-dvh w-dvw rounded-none border-0 aspect-auto",
      )}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        disablePictureInPicture
        className="size-full object-contain"
      />
      {!stream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-400">
          {error ? (
            <>
              <WarningIcon size={36} weight="duotone" />
              <p className="px-6 text-center text-sm">{error}</p>
            </>
          ) : permission === "denied" ? (
            <>
              <VideoCameraSlashIcon size={36} weight="duotone" />
              <p className="px-6 text-center text-sm">
                Camera access is blocked. Enable it in your browser's site
                settings to continue.
              </p>
            </>
          ) : !permissionGranted ? (
            <>
              <VideoCameraIcon size={36} weight="duotone" />
              <p className="text-sm">Camera access required to begin</p>
            </>
          ) : (
            <>
              <VideoCameraSlashIcon size={36} weight="duotone" />
              <p className="text-sm">
                {starting ? "Starting capture..." : "Capture card is idle"}
              </p>
            </>
          )}
        </div>
      )}
      <Button
        type="button"
        size="icon"
        variant="secondary"
        onClick={() => setExpanded((current) => !current)}
        className="absolute right-3 bottom-3 z-10 rounded-none bg-black/65 text-white opacity-0 shadow-md backdrop-blur-sm transition-opacity group-hover/capture:opacity-100 hover:bg-black/80 hover:text-white focus-visible:opacity-100"
        aria-label={expanded ? "Exit expanded video" : "Expand video"}
        title={expanded ? "Exit expanded video" : "Expand video"}
      >
        {expanded ? (
          <ArrowsInIcon size={20} weight="bold" />
        ) : (
          <ArrowsOutIcon size={20} weight="bold" />
        )}
      </Button>
    </div>
  );
}
