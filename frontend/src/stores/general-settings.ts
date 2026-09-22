import { createStore } from "@tanstack/react-store";

const STORAGE_KEY = "win-bc-controller.controls-only-homepage";

type GeneralSettings = {
  controlsOnlyHomepage: boolean;
};

function loadSettings(): GeneralSettings {
  try {
    return { controlsOnlyHomepage: localStorage.getItem(STORAGE_KEY) === "true" };
  } catch {
    return { controlsOnlyHomepage: false };
  }
}

export const generalSettingsStore = createStore(loadSettings());

export function setControlsOnlyHomepage(enabled: boolean) {
  generalSettingsStore.setState((settings) => ({
    ...settings,
    controlsOnlyHomepage: enabled,
  }));
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // Keep the setting usable for this session if storage is unavailable.
  }
}
