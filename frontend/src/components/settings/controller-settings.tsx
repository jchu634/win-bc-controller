import { useRef, useState } from "react";
import { ControllerPanel } from "@/src/components/settings/controller-panel";
import { PresetEditor, type PresetEditorHandle } from "@/src/components/editors/preset-editor";
import { PresetPicker } from "@/src/components/settings/controller-preset-picker";

export function ControllerSettings() {
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

      <div className="space-y-4 2xl:flex 2xl:space-y-0 2xl:gap-x-4">
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
