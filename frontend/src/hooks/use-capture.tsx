import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Effect } from "effect";
import { useSelector } from "@tanstack/react-store";
import { generalSettingsStore } from "@/src/stores/general-settings";
import {
  type CameraDevice,
  CameraError,
  type CameraPermissionState,
  acquireStream,
  describeError,
  enumerateCameras,
  releaseStream,
  requestPermission,
} from "@/src/lib/webcam";

type CaptureContextValue = {
  readonly cameras: readonly CameraDevice[];
  readonly error: string | null;
  readonly permission: CameraPermissionState;
  readonly requestingPermission: boolean;
  readonly selectedAudioInputId: string;
  readonly selectedInputId: string;
  readonly starting: boolean;
  readonly stream: MediaStream | null;
  readonly selectInput: (deviceId: string) => void;
  readonly selectInputs: (inputs: {
    readonly audioDeviceId: string;
    readonly videoDeviceId: string;
  }) => void;
  readonly requestAccess: () => Promise<void>;
  readonly start: (deviceId: string) => Promise<void>;
  readonly stop: () => void;
};

const CaptureContext = createContext<CaptureContextValue | null>(null);

const AUDIO_INPUT_STORAGE_KEY = "win-bc-controller.audio-input";

function readSavedAudioInputId(): string {
  try {
    return localStorage.getItem(AUDIO_INPUT_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveAudioInputId(deviceId: string): void {
  try {
    localStorage.setItem(AUDIO_INPUT_STORAGE_KEY, deviceId);
  } catch {
    // Capture still works when storage is unavailable.
  }
}

function useCaptureContext(): CaptureContextValue {
  const context = useContext(CaptureContext);
  if (!context) {
    throw new Error("Capture hooks must be used inside CaptureProvider");
  }
  return context;
}

export function CaptureProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const controlsOnlyHomepage = useSelector(
    generalSettingsStore,
    (settings) => settings.controlsOnlyHomepage,
  );
  const activeStreamRef = useRef<MediaStream | null>(null);
  const [cameras, setCameras] = useState<readonly CameraDevice[]>([]);
  const [selectedAudioInputId, setSelectedAudioInputId] = useState(
    readSavedAudioInputId,
  );
  const [selectedInputId, setSelectedInputId] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [starting, setStarting] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [permission, setPermission] = useState<CameraPermissionState>("prompt");
  const [error, setError] = useState<string | null>(null);

  const syncActiveStream = (nextStream: MediaStream | null) => {
    activeStreamRef.current = nextStream;
    setStream(nextStream);
  };

  const refreshCameras = useCallback(async () => {
    const devices = await Effect.runPromise(enumerateCameras).catch(
      (): readonly CameraDevice[] => [],
    );
    setCameras(devices);
    setSelectedInputId((currentId) => currentId || devices[0]?.deviceId || "");
  }, []);

  const stop = () => {
    const current = activeStreamRef.current;
    syncActiveStream(null);
    if (current) void Effect.runPromise(releaseStream(current));
  };

  const startWithInputs = async (
    deviceId: string,
    audioDeviceId: string,
  ) => {
    setError(null);
    setStarting(true);
    const previous = activeStreamRef.current;
    syncActiveStream(null);
    if (previous) await Effect.runPromise(releaseStream(previous));

    try {
      const nextStream = await Effect.runPromise(
        acquireStream(deviceId, audioDeviceId),
      );
      syncActiveStream(nextStream);
      setPermission("granted");
      await refreshCameras();
    } catch (cause: unknown) {
      const captureError = cause instanceof CameraError ? cause : null;
      setError(
        captureError ? describeError(captureError) : "Unable to access camera.",
      );
      if (captureError?.reason === "denied") setPermission("denied");
    } finally {
      setStarting(false);
    }
  };

  const start = (deviceId: string) =>
    startWithInputs(deviceId, selectedAudioInputId);

  const requestAccess = useCallback(async () => {
    setError(null);
    setRequestingPermission(true);
    try {
      await Effect.runPromise(requestPermission);
      setPermission("granted");
      await refreshCameras();
    } catch (cause: unknown) {
      const captureError = cause instanceof CameraError ? cause : null;
      setError(
        captureError ? describeError(captureError) : "Unable to access camera.",
      );
      setPermission(
        captureError?.reason === "unsupported" ? "unsupported" : "denied",
      );
    } finally {
      setRequestingPermission(false);
    }
  }, [refreshCameras]);

  const selectInput = (deviceId: string) => {
    setSelectedInputId(deviceId);
    if (activeStreamRef.current) {
      void startWithInputs(deviceId, selectedAudioInputId);
    }
  };

  const selectInputs = ({
    audioDeviceId,
    videoDeviceId,
  }: {
    readonly audioDeviceId: string;
    readonly videoDeviceId: string;
  }) => {
    setSelectedInputId(videoDeviceId);
    setSelectedAudioInputId(audioDeviceId);
    saveAudioInputId(audioDeviceId);
    if (activeStreamRef.current) {
      void startWithInputs(videoDeviceId, audioDeviceId);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let status: PermissionStatus | null = null;
    const permissions = navigator.permissions;
    if (!permissions?.query) {
      setPermission("unsupported");
      return;
    }

    void permissions
      .query({ name: "camera" as PermissionName })
      .then((nextStatus) => {
        if (cancelled) return;
        status = nextStatus;
        setPermission(nextStatus.state);
        if (nextStatus.state === "prompt" && !controlsOnlyHomepage) {
          void requestAccess();
        }
        nextStatus.onchange = () => setPermission(nextStatus.state);
      })
      .catch(() => {
        if (!cancelled) setPermission("unsupported");
      });

    return () => {
      cancelled = true;
      if (status) status.onchange = null;
    };
  }, [requestAccess, controlsOnlyHomepage]);

  useEffect(() => {
    if (permission !== "granted" && permission !== "unsupported") return;
    void refreshCameras();
    const handleDeviceChange = () => void refreshCameras();
    navigator.mediaDevices?.addEventListener?.(
      "devicechange",
      handleDeviceChange,
    );
    return () => {
      navigator.mediaDevices?.removeEventListener?.(
        "devicechange",
        handleDeviceChange,
      );
    };
  }, [permission, refreshCameras]);

  useEffect(
    () => () => {
      const current = activeStreamRef.current;
      activeStreamRef.current = null;
      if (current) current.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  return (
    <CaptureContext.Provider
      value={{
        cameras,
        error,
        permission,
        requestingPermission,
        selectedAudioInputId,
        selectedInputId,
        starting,
        stream,
        selectInput,
        selectInputs,
        requestAccess,
        start,
        stop,
      }}
    >
      {children}
    </CaptureContext.Provider>
  );
}

export function useCaptureControls() {
  const {
    error,
    permission,
    requestAccess,
    requestingPermission,
    start,
    starting,
    stop,
    stream,
  } = useCaptureContext();
  return {
    error,
    permission,
    requestAccess,
    requestingPermission,
    start,
    starting,
    stop,
    streaming: stream !== null,
  } as const;
}

export function useCaptureInput() {
  const {
    cameras,
    permission,
    selectedAudioInputId,
    selectedInputId,
    selectInput,
    selectInputs,
  } = useCaptureContext();
  return {
    cameras,
    permission,
    selectedAudioInputId,
    selectedInputId,
    selectInput,
    selectInputs,
  } as const;
}

export function useCaptureStream(): MediaStream | null {
  return useCaptureContext().stream;
}
