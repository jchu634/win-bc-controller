import { useEffect, useRef } from "react";
import {
  VideoCameraIcon,
  VideoCameraSlashIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { useCaptureControls, useCaptureStream } from "@/src/hooks/use-capture";

export function CapturePreview() {
  const videoRef = useRef<HTMLVideoElement>(null);
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

  return (
    <div className="relative aspect-video w-4/5 overflow-hidden rounded-xl border border-border bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
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
    </div>
  );
}
