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
import { useSelector } from "@tanstack/react-store";
import {
  generalSettingsStore,
  setControlsOnlyHomepage,
  setTheme,
} from "@/src/stores/general-settings";
import { GearSixIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { useCaptureControls } from "@/src/hooks/use-capture";
import { Checkbox } from "@/src/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/src/components/ui/toggle-group";
import { Separator } from "@/src/components/ui/separator";
import { Label } from "@/src/components/ui/label";
import { AudioInputSettings } from "@/src/components/settings/audio-input-settings";
import { ControllerSettings } from "@/src/components/settings/controller-settings";
import { CaptureDeviceSettings } from "@/src/components/settings/capture-device-settings";

const SETTINGS_DESCRIPTIONS: Record<string, string> = {
  general: "General settings.",
  controller: "Choose a controller and manage its mapping presets.",
};

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState("general");
  const controlsOnlyHomepage = useSelector(
    generalSettingsStore,
    (settings) => settings.controlsOnlyHomepage,
  );
  const theme = useSelector(generalSettingsStore, (settings) => settings.theme);
  const [draftControlsOnlyHomepage, setDraftControlsOnlyHomepage] =
    useState(controlsOnlyHomepage);
  const { stop, starting } = useCaptureControls();

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setDraftControlsOnlyHomepage(controlsOnlyHomepage);
          return;
        }

        if (draftControlsOnlyHomepage === controlsOnlyHomepage) return;
        if (draftControlsOnlyHomepage) stop();
        setControlsOnlyHomepage(draftControlsOnlyHomepage);
      }}
    >
      <DialogTrigger>
        <Button className="bg-muted-foreground dark:text-gray-900 fixed top-5 right-4">
          General Settings
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
            <TabsTrigger value="credits">Credits</TabsTrigger>
          </TabsList>
          <TabsContent
            className="min-w-0 space-y-4 overflow-y-auto p-2"
            value="general"
          >
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-foreground">
                Input Settings
              </h2>
              <AudioInputSettings />
              <CaptureDeviceSettings disabled={draftControlsOnlyHomepage} />
            </div>
            <Separator />
            <div className="flex w-180 items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="controls-only-homepage">
                  Controls-only homepage
                </Label>
                <p
                  id="controls-only-description"
                  className="text-sm text-muted-foreground"
                >
                  Focus on macros and manual control without the capture card
                  preview.
                </p>
              </div>
              <Checkbox
                id="controls-only-homepage"
                aria-describedby="controls-only-description"
                checked={draftControlsOnlyHomepage}
                disabled={starting}
                onCheckedChange={setDraftControlsOnlyHomepage}
              />
            </div>
            <Separator />
            <div className="flex w-180 items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <Label id="theme-label">Appearance</Label>
                <p
                  id="theme-description"
                  className="text-sm text-muted-foreground"
                >
                  Choose light, dark, or follow your system setting.
                </p>
              </div>
              <ToggleGroup
                aria-labelledby="theme-label"
                aria-describedby="theme-description"
                value={[theme]}
                onValueChange={(value) => {
                  const selected = value.find(
                    (item) =>
                      item === "dark" || item === "light" || item === "system",
                  );
                  if (
                    selected === "dark" ||
                    selected === "light" ||
                    selected === "system"
                  ) {
                    setTheme(selected);
                  }
                }}
                className="inline-flex rounded-md border border-input bg-background p-1"
              >
                {(["light", "dark", "system"] as const).map((option) => (
                  <ToggleGroupItem
                    key={option}
                    value={option}
                    className="capitalize"
                  >
                    {option}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </TabsContent>
          <TabsContent
            className="min-h-0 min-w-0 overflow-y-auto p-2"
            value="controller"
          >
            <ControllerSettings />
          </TabsContent>
          <TabsContent
            className="min-h-0 min-w-0 overflow-y-auto p-2"
            value="credits"
          >
            This PLACEHOLDER NAME application was developed by JCHU634
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
