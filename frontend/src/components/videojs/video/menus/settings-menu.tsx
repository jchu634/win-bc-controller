import type { ComponentProps } from "react";

import { AudioTrackMenu } from "@/src/components/videojs/ui/audio-track-menu";
import { CaptionsSubmenu } from "@/src/components/videojs/ui/captions-submenu";
import { PlaybackRateSubmenu } from "@/src/components/videojs/ui/playback-rate-submenu";
import { QualityMenu } from "@/src/components/videojs/ui/quality-menu";
import { SettingsMenu } from "@/src/components/videojs/ui/settings-menu";

export type VideoSettingsMenuProps = Omit<
  NonNullable<ComponentProps<typeof SettingsMenu>>,
  "children"
>;

export function VideoSettingsMenu(props: VideoSettingsMenuProps = {}) {
  return (
    <SettingsMenu {...props}>
      <QualityMenu />
      <AudioTrackMenu />
      <PlaybackRateSubmenu />
      <CaptionsSubmenu />
    </SettingsMenu>
  );
}
