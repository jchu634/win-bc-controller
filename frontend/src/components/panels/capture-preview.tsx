import { useEffect, useRef } from "react";
import { LiveVideoPlayer, Video } from "@videojs/react/live-video";
import { VideoCameraIcon, VideoCameraSlashIcon, WarningIcon } from "@phosphor-icons/react";
import { CapturePreviewSkin } from "./capture-preview-skin";
import { useCaptureControls, useCaptureStream } from "@/src/hooks/use-capture";

export function CapturePreview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stream = useCaptureStream();
  const { error, permission, starting } = useCaptureControls();
  const permissionGranted = permission === "granted" || permission === "unsupported";

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  return (
    <LiveVideoPlayer>
      <CapturePreviewSkin>
        <Video
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
                  Camera access is blocked. Enable it in your browser's site settings to continue.
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
      </CapturePreviewSkin>
    </LiveVideoPlayer>
  );
}
