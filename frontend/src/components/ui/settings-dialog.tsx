import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/src/components/ui/tabs";
import { Button } from "@/src/components/ui/button";
import { GearSixIcon, SpinnerGapIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import {
  useCaptureControls,
  useCaptureInput,
  useCaptureStream,
} from "@/src/hooks/use-capture";
import { ControllerPanel } from "@/src/components/controller/controller-panel";
import {
  PresetEditor,
  type PresetEditorHandle,
} from "@/src/components/preset/preset-editor";
import { PresetPicker } from "@/src/components/preset/preset-picker";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";

const SETTINGS_DESCRIPTIONS: Record<string, string> = {
  general: "General settings.",
  controller: "Choose a controller and manage its mapping presets.",
};

function ControllerSettings() {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [selectedBuiltin, setSelectedBuiltin] = useState(false);
  const [presetListVersion, setPresetListVersion] = useState(0);
  const presetEditor = useRef<PresetEditorHandle | null>(null);

  function openPreset(name: string, builtin: boolean) {
    setSelectedPreset(name);
    setSelectedBuiltin(builtin);
  }

  function requestPreset(name: string, builtin: boolean) {
    if (name === selectedPreset) return;
    const navigate = () => openPreset(name, builtin);
    if (presetEditor.current === null) {
      navigate();
      return;
    }
    presetEditor.current.requestNavigation(navigate);
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <ControllerPanel />

      <div className="2xl:flex 2xl:gap-x-4 space-y-4 2xl:space-y-0">
        <PresetPicker
          selected={selectedPreset}
          onSelect={(preset) => requestPreset(preset.filename, preset.builtin)}
          onDeleted={(name) => {
            if (selectedPreset === name) {
              setSelectedPreset(null);
              setSelectedBuiltin(false);
            }
            setPresetListVersion((version) => version + 1);
          }}
          refreshKey={presetListVersion}
        />
        <PresetEditor
          ref={presetEditor}
          name={selectedPreset}
          builtin={selectedBuiltin}
          onSaved={(name) => {
            openPreset(name, false);
            setPresetListVersion((version) => version + 1);
          }}
        />
      </div>
    </div>
  );
}

function CaptureDeviceSettings() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const startedForPreview = useRef(false);
  const [visible, setVisible] = useState(false);
  const stream = useCaptureStream();
  const { error, start, starting, stop, streaming } = useCaptureControls();
  const { cameras, selectedInputId, selectInput } = useCaptureInput();
  const selectedInputLabel = cameras.find(
    (camera) => camera.deviceId === selectedInputId,
  )?.label;

  const stopRef = useRef(stop);
  stopRef.current = stop;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = visible ? stream : null;
    return () => {
      video.srcObject = null;
    };
  }, [stream, visible]);

  useEffect(
    () => () => {
      if (startedForPreview.current) stopRef.current();
    },
    [],
  );

  const togglePreview = async () => {
    if (visible) {
      setVisible(false);
      if (startedForPreview.current) {
        startedForPreview.current = false;
        stop();
      }
      return;
    }

    setVisible(true);
    if (!streaming) {
      startedForPreview.current = true;
      await start(selectedInputId);
    }
  };

  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex w-full flex-wrap items-center gap-2">
        <Select
          value={selectedInputId}
          onValueChange={(deviceId) => {
            if (deviceId !== null) selectInput(deviceId);
          }}
        >
          <SelectTrigger className="w-1/2 min-w-64">
            <SelectValue placeholder="Capture Device">
              {selectedInputLabel}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Capture Device</SelectLabel>
              {cameras.map((camera) => (
                <SelectItem key={camera.deviceId} value={camera.deviceId}>
                  {camera.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          disabled={!selectedInputId || starting}
          onClick={() => void togglePreview()}
        >
          {starting && (
            <SpinnerGapIcon className="animate-spin" weight="bold" />
          )}
          {visible ? "Hide preview" : "Show preview"}
        </Button>
      </div>

      <div className="aspect-video w-1/2 min-w-80 overflow-hidden rounded-lg border border-border bg-black">
        {visible && stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            disablePictureInPicture
            className="size-full object-contain"
          />
        ) : (
          <div className="flex size-full items-center justify-center px-6 text-center text-sm text-zinc-400">
            {visible
              ? (error ??
                (starting ? "Starting preview..." : "Preview unavailable"))
              : "Preview disabled"}
          </div>
        )}
      </div>
    </div>
  );
}

export function SettingsDialog() {
  const [currentTab, setCurrentTab] = useState("general");

  return (
    <Dialog>
      <DialogTrigger>
        <Button size="icon" className="bg-muted-foreground fixed top-5 right-5">
          <GearSixIcon weight="fill" className="size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="h-4/5 min-w-4/5 bg-background flex flex-col">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>

          <DialogDescription>
            {SETTINGS_DESCRIPTIONS[currentTab]}
          </DialogDescription>
        </DialogHeader>
        <Tabs
          value={currentTab}
          onValueChange={(newTab) => setCurrentTab(newTab)}
          orientation="vertical"
          className="min-h-0 min-w-0 flex-1 overflow-hidden"
        >
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="controller">Controller</TabsTrigger>
          </TabsList>
          <TabsContent
            className="min-w-0 overflow-y-auto p-2 space-y-2"
            value="general"
          >
            <h2 className="text-lg font-semibold text-foreground">
              Current Video Capture Device
            </h2>

            <CaptureDeviceSettings />
          </TabsContent>
          <TabsContent
            className="min-h-0 min-w-0 overflow-y-auto p-2"
            value="controller"
          >
            <ControllerSettings />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
