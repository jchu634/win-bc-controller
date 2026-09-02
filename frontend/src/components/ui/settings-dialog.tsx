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
import { GearSixIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { useCaptureInput } from "@/src/hooks/use-capture";
import { ControllerPanel } from "@/src/components/controller/controller-panel";
import { PresetEditor } from "@/src/components/preset/preset-editor";
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

  function selectPreset(name: string, builtin: boolean) {
    setSelectedPreset(name);
    setSelectedBuiltin(builtin);
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <ControllerPanel />

      <div className="lg:flex lg:gap-x-4 space-y-4 lg:space-y-0">
        <PresetPicker
          selected={selectedPreset}
          onSelect={(preset) => selectPreset(preset.filename, preset.builtin)}
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
          name={selectedPreset}
          builtin={selectedBuiltin}
          onSaved={(name) => {
            selectPreset(name, false);
            setPresetListVersion((version) => version + 1);
          }}
        />
      </div>
    </div>
  );
}

export function SettingsDialog() {
  const [currentTab, setCurrentTab] = useState("general");
  const { cameras, selectedInputId, selectInput } = useCaptureInput();
  const selectedInputLabel = cameras.find(
    (camera) => camera.deviceId === selectedInputId,
  )?.label;

  return (
    <Dialog>
      <DialogTrigger>
        <Button size="icon" className="bg-muted-foreground">
          <GearSixIcon weight="fill" className="size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="min-w-4/5 bg-background">
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
          className="min-h-0 min-w-0 overflow-hidden"
        >
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="controller">Controller</TabsTrigger>
          </TabsList>
          <TabsContent className="min-w-0 overflow-y-auto p-2" value="general">
            Current Video Capture Device
            <Select
              value={selectedInputId}
              onValueChange={(deviceId) => {
                if (deviceId !== null) {
                  selectInput(deviceId);
                }
              }}
            >
              <SelectTrigger className="w-50%">
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
          </TabsContent>
          <TabsContent
            className="min-w-0 overflow-y-auto p-2"
            value="controller"
          >
            <ControllerSettings />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
