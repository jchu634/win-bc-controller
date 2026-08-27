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

export function SettingsDialog() {
  const [currentTab, setCurrentTab] = useState("general");
  const settingsDescription: Record<string, string> = {
    general: "General Settings.",
    controller: "Controller Mapping Settings",
  };
  return (
    <Dialog>
      <DialogTrigger>
        <Button size="icon" className="bg-muted-foreground">
          <GearSixIcon weight="fill" className="size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-background min-w-4/5">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>

          <DialogDescription>
            {settingsDescription[currentTab]}
          </DialogDescription>
        </DialogHeader>
        <Tabs
          value={currentTab}
          onValueChange={(newTab) => setCurrentTab(newTab)}
          orientation="vertical"
          className="w-100"
        >
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="controller">Controller</TabsTrigger>
          </TabsList>
          <TabsContent className="p-2" value="general">
            Current Video Capture Device
          </TabsContent>
          <TabsContent value="controller">
            Change your password here.
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
