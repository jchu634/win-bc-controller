import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type SVGProps,
} from "react";
import { Effect } from "effect";
import {
  ArrowCounterClockwiseIcon,
  CheckIcon,
  FloppyDiskIcon,
  GameControllerIcon,
  MagicWandIcon,
  PlayIcon,
  SpinnerGapIcon,
  SlidersHorizontalIcon,
  CodeIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import {
  SwitchButtonA,
  SwitchButtonB,
  SwitchButtonHome,
  SwitchButtonL,
  SwitchButtonMinus,
  SwitchButtonPlus,
  SwitchButtonR,
  SwitchButtonSync,
  SwitchButtonX,
  SwitchButtonY,
  SwitchButtonZl,
  SwitchButtonZr,
  SwitchDpadDown,
  SwitchDpadLeft,
  SwitchDpadRight,
  SwitchDpadUp,
  SwitchStickLPress,
  SwitchStickLHorizontal,
  SwitchStickLVertical,
  SwitchStickRPress,
  SwitchStickRHorizontal,
  SwitchStickRVertical,
} from "@/src/assets/input-prompts/switch";
import {
  XboxButtonA,
  XboxButtonB,
  XboxButtonMenu,
  XboxButtonView,
  XboxButtonX,
  XboxButtonY,
  XboxGuide,
  XboxLb,
  XboxLs,
  XboxLt,
  XboxRb,
  XboxRs,
  XboxRt,
  XboxStickLHorizontal,
  XboxStickLVertical,
  XboxStickRHorizontal,
  XboxStickRVertical,
} from "@/src/assets/input-prompts/xbox";
import {
  Playstation5ButtonCreate,
  Playstation5ButtonOptions,
  PlaystationButtonCircle,
  PlaystationButtonCross,
  PlaystationButtonL3,
  PlaystationButtonR3,
  PlaystationButtonSquare,
  PlaystationButtonTriangle,
  PlaystationDpadDown,
  PlaystationDpadLeft,
  PlaystationDpadRight,
  PlaystationDpadUp,
  PlaystationStickLHorizontal,
  PlaystationStickLVertical,
  PlaystationStickRHorizontal,
  PlaystationStickRVertical,
  PlaystationTriggerL1,
  PlaystationTriggerL2,
  PlaystationTriggerR1,
  PlaystationTriggerR2,
} from "@/src/assets/input-prompts/playstation";
import { errorMessage } from "@/src/lib/errors";
import { Button } from "@/src/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import {
  JsonEditor,
  type JsonEditorHandle,
  type JsonMarker,
} from "@/src/components/json-editor/json-editor";
import { activatePreset, getPreset, putPreset } from "@/src/lib/api";
import { ApiError } from "@/src/lib/api";
import {
  BUTTON_NAMES,
  type ButtonName,
  type ValidationBody,
} from "@/src/lib/types";
import { locatePathLine, positionToLineCol } from "@/src/lib/json-locate";
import {
  CONTROLLER_LAYOUTS,
  GENERIC_CONTROLLER_LAYOUT,
  type ControllerLayout,
  type ControllerLayoutDefinition,
} from "@/src/lib/controller-mappings";
import { cn } from "@/src/lib/utils";

export type PresetEditorProps = {
  name: string | null;
  builtin: boolean;
  onSaved: (name: string) => void;
};

export function PresetEditor({ name, builtin, onSaved }: PresetEditorProps) {
  const [value, setValue] = useState("");
  const [savedText, setSavedText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");
  const [savingAs, setSavingAs] = useState(false);
  const [saveAsError, setSaveAsError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [markers, setMarkers] = useState<JsonMarker[]>([]);
  const [advanced, setAdvanced] = useState(false);
  const editorHandle = useRef<JsonEditorHandle | null>(null);

  useEffect(() => {
    if (name === null) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    setMarkers([]);
    setSavedText(null);
    setAdvanced(false);
    Effect.runPromise(getPreset(name))
      .then((r) => {
        setValue(r.contents);
        setSavedText(r.contents);
      })
      .catch((error: unknown) => {
        setValue("");
        setError(errorMessage(error));
      })
      .finally(() => setLoading(false));
  }, [name]);

  const dirty = savedText !== null && value !== savedText;

  const syntaxPrecheck = useCallback((text: string): JsonMarker[] => {
    try {
      JSON.parse(text);
      return [];
    } catch (e) {
      const msg = e instanceof SyntaxError ? e.message : String(e);
      const pos = /position (\d+)/i.exec(msg)?.[1];
      const lc =
        pos !== undefined ? positionToLineCol(text, Number(pos)) : null;
      return [
        {
          line: lc?.line ?? 1,
          col: lc?.col,
          severity: "error",
          message: `Invalid JSON: ${msg}`,
        },
      ];
    }
  }, []);

  const buildMarkers = useCallback(
    (body: ValidationBody, text: string): JsonMarker[] => {
      if (body.line !== undefined) {
        return [
          {
            line: body.line,
            col: body.col,
            severity: "error",
            message: body.detail ?? body.error,
          },
        ];
      }
      if (body.path !== undefined) {
        const line = locatePathLine(text, body.path);
        if (line !== null) {
          return [
            {
              line,
              severity: "error",
              message: body.detail ?? body.error,
            },
          ];
        }
      }
      return [];
    },
    [],
  );

  const save = useCallback(async (): Promise<boolean> => {
    if (name === null) return false;
    const local = syntaxPrecheck(value);
    if (local.length > 0) {
      setMarkers(local);
      setError("Invalid JSON — fix the highlighted line before saving.");
      return false;
    }
    if (builtin) {
      let suggestedName = name;
      const document: unknown = JSON.parse(value);
      if (
        typeof document === "object" &&
        document !== null &&
        !Array.isArray(document) &&
        "name" in document &&
        typeof document.name === "string"
      ) {
        suggestedName = document.name;
      }
      setSaveAsName(`${suggestedName} copy`);
      setSaveAsError(null);
      setSaveAsOpen(true);
      return false;
    }
    setSaving(true);
    const result = await Effect.runPromise(putPreset(name, value)).catch(
      (e): null => {
        if (e instanceof ApiError && e.body !== null) {
          setMarkers(buildMarkers(e.body, value));
          setError(`${e.message}${e.body.detail ? ` — ${e.body.detail}` : ""}`);
        } else {
          setError(String(e));
        }
        return null;
      },
    );
    setSaving(false);
    if (result !== null) {
      setSavedText(value);
      setMarkers([]);
      setError(null);
      onSaved(name);
      return true;
    }
    return false;
  }, [name, builtin, value, syntaxPrecheck, buildMarkers, onSaved]);

  const activate = useCallback(async () => {
    if (name === null) return;
    if (dirty) {
      const saved = await save();
      if (!saved) return;
    }
    setActivating(true);
    await Effect.runPromise(activatePreset(name))
      .then(() => setNotice(`Preset '${name}' applied.`))
      .catch((error: unknown) => setError(errorMessage(error)));
    setActivating(false);
  }, [name, dirty, save]);

  const format = useCallback(() => {
    try {
      const pretty = `${JSON.stringify(JSON.parse(value), null, 2)}\n`;
      if (!editorHandle.current?.replaceDocument(pretty)) {
        setValue(pretty);
      }
      setMarkers([]);
    } catch (e) {
      const msg = e instanceof SyntaxError ? e.message : String(e);
      const pos = /position (\d+)/i.exec(msg)?.[1];
      const lc =
        pos !== undefined ? positionToLineCol(value, Number(pos)) : null;
      setMarkers([
        {
          line: lc?.line ?? 1,
          col: lc?.col,
          severity: "error",
          message: `Cannot format: ${msg}`,
        },
      ]);
    }
  }, [value]);

  const saveAsNewPreset = useCallback(async () => {
    const targetName = saveAsName.trim();
    if (targetName.length === 0) return;
    setSavingAs(true);
    setSaveAsError(null);
    const targetFilename = `preset-${crypto.randomUUID()}`;
    const succeeded = await Promise.resolve()
      .then(() => {
        const document: unknown = JSON.parse(value);
        if (
          typeof document !== "object" ||
          document === null ||
          Array.isArray(document)
        ) {
          throw new Error("Preset JSON must be an object.");
        }
        const contents = `${JSON.stringify({ ...document, name: targetName }, null, 2)}\n`;
        return Effect.runPromise(putPreset(targetFilename, contents));
      })
      .then(() => true)
      .catch((error: unknown) => {
        setSaveAsError(errorMessage(error));
        return false;
      });
    setSavingAs(false);
    if (!succeeded) return;
    setSaveAsOpen(false);
    onSaved(targetFilename);
  }, [saveAsName, value, onSaved]);

  if (name === null) {
    return (
      <section className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-16 text-sm text-muted-foreground">
        <p>Select a preset to inspect it.</p>
      </section>
    );
  }

  return (
    <section className="flex w-full flex-col gap-3 text-left">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-mono text-lg font-semibold text-foreground">
          {name}.json
        </h2>
        {builtin && (
          <span className="rounded-4xl bg-muted px-2 py-0.5 text-[10px] tracking-wide text-muted-foreground uppercase">
            built-in
          </span>
        )}
        {dirty && (
          <span className="rounded-4xl bg-amber-500/15 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">
            unsaved
          </span>
        )}
        {!builtin && savedText !== null && !dirty && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CheckIcon size={12} /> saved
          </span>
        )}
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={advanced ? "secondary" : "outline"}
            onClick={() => setAdvanced((current) => !current)}
          >
            {advanced ? (
              <SlidersHorizontalIcon size={14} />
            ) : (
              <CodeIcon size={14} />
            )}
            {advanced ? "Visual Editor" : "JSON Editor"}
          </Button>
          {advanced && (
            <Button size="sm" variant="ghost" onClick={format} title="Format">
              <MagicWandIcon size={14} />
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (savedText === null) return;
              // While an edit session is attached the editor's
              // document is authoritative — route through it.
              if (!editorHandle.current?.replaceDocument(savedText)) {
                setValue(savedText);
              }
              setMarkers([]);
              setError(null);
            }}
            disabled={!dirty}
            title="Revert"
          >
            Undo
            <ArrowCounterClockwiseIcon size={14} />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void activate()}
            disabled={activating}
          >
            {activating ? (
              <SpinnerGapIcon size={14} className="animate-spin" />
            ) : (
              <PlayIcon size={14} weight="fill" />
            )}
            Activate
          </Button>
          <Button
            size="sm"
            onClick={() => void save()}
            disabled={saving || !dirty}
          >
            {saving ? (
              <SpinnerGapIcon size={14} className="animate-spin" />
            ) : (
              <FloppyDiskIcon size={14} weight="fill" />
            )}
            Save
          </Button>
        </div>
      </div>

      {error !== null && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm"
        >
          <WarningIcon size={16} className="mt-0.5 shrink-0 text-destructive" />
          <p className="flex-1">{error}</p>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setError(null)}
          >
            dismiss
          </button>
        </div>
      )}
      {notice !== null && (
        <p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
          {notice}
        </p>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center gap-2 rounded-xl border border-border text-sm text-muted-foreground">
          <SpinnerGapIcon size={16} className="animate-spin" /> Loading…
        </div>
      ) : advanced ? (
        <JsonEditor
          ref={editorHandle}
          fileName={`${name}.json`}
          cacheKey={`preset:${name}`}
          value={value}
          onChange={setValue}
          editing
          markers={markers}
          className="max-h-[60vh] min-h-64"
        />
      ) : (
        <PresetMappingEditor
          value={value}
          onChange={setValue}
          disabled={false}
        />
      )}
      <Dialog open={saveAsOpen} onOpenChange={setSaveAsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as new preset</DialogTitle>
            <DialogDescription>
              Built-in presets cannot be overwritten. Name your edited copy to
              save it as a new preset.
            </DialogDescription>
          </DialogHeader>
          <input
            autoFocus
            value={saveAsName}
            onChange={(event) => setSaveAsName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void saveAsNewPreset();
            }}
            placeholder="Preset name"
            aria-label="New preset name"
            className="h-9 w-full rounded-4xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          />
          {saveAsError !== null && (
            <p role="alert" className="text-sm text-destructive">
              {saveAsError}
            </p>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              onClick={() => void saveAsNewPreset()}
              disabled={savingAs || saveAsName.trim().length === 0}
            >
              {savingAs && (
                <SpinnerGapIcon size={14} className="animate-spin" />
              )}
              Save new preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

type PresetMappingEditorProps = {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
};

type ParsedPreset =
  | {
      kind: "valid";
      document: Record<string, unknown>;
      buttons: Record<string, ButtonName>;
      triggers: Record<string, ButtonName>;
    }
  | { kind: "invalid"; message: string };

type PhysicalSource =
  { kind: "button"; index: string } | { kind: "trigger"; index: string };

type SupportedButtonName = Exclude<
  ButtonName,
  "SL_L" | "SR_L" | "SL_R" | "SR_R"
>;

const MAPPING_COLUMNS: readonly [
  readonly SupportedButtonName[],
  readonly SupportedButtonName[],
] = [
  ["ZL", "L", "MINUS", "UP", "LEFT", "RIGHT", "DOWN", "STICK_L", "CAPTURE"],
  ["ZR", "R", "PLUS", "X", "A", "Y", "B", "STICK_R", "HOME"],
];

const BUTTON_LABELS: Record<SupportedButtonName, string> = {
  A: "A",
  B: "B",
  X: "X",
  Y: "Y",
  L: "L bumper",
  R: "R bumper",
  ZL: "ZL trigger",
  ZR: "ZR trigger",
  UP: "D-pad up",
  DOWN: "D-pad down",
  LEFT: "D-pad left",
  RIGHT: "D-pad right",
  PLUS: "Plus",
  MINUS: "Minus",
  HOME: "Home",
  CAPTURE: "Capture",
  STICK_L: "Left stick click",
  STICK_R: "Right stick click",
};

const BUTTON_ICONS: Record<
  SupportedButtonName,
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  A: SwitchButtonA,
  B: SwitchButtonB,
  X: SwitchButtonX,
  Y: SwitchButtonY,
  L: SwitchButtonL,
  R: SwitchButtonR,
  ZL: SwitchButtonZl,
  ZR: SwitchButtonZr,
  UP: SwitchDpadUp,
  DOWN: SwitchDpadDown,
  LEFT: SwitchDpadLeft,
  RIGHT: SwitchDpadRight,
  PLUS: SwitchButtonPlus,
  MINUS: SwitchButtonMinus,
  HOME: SwitchButtonHome,
  CAPTURE: SwitchButtonSync,
  STICK_L: SwitchStickLPress,
  STICK_R: SwitchStickRPress,
};

type InputIcon = ComponentType<SVGProps<SVGSVGElement>>;

const CONTROLLER_BUTTON_ICONS: Partial<
  Record<ControllerLayout, readonly InputIcon[]>
> = {
  switch: [
    SwitchButtonA,
    SwitchButtonB,
    SwitchButtonX,
    SwitchButtonY,
    SwitchButtonMinus,
    SwitchButtonHome,
    SwitchButtonPlus,
    SwitchStickRPress,
    SwitchStickLPress,
    SwitchButtonL,
    SwitchButtonR,
    SwitchDpadUp,
    SwitchDpadDown,
    SwitchDpadLeft,
    SwitchDpadRight,
    SwitchButtonSync,
  ],
  xbox: [
    XboxButtonA,
    XboxButtonB,
    XboxButtonX,
    XboxButtonY,
    XboxLb,
    XboxRb,
    XboxButtonView,
    XboxButtonMenu,
    XboxLs,
    XboxRs,
    XboxGuide,
  ],
  playstation: [
    PlaystationButtonCross,
    PlaystationButtonCircle,
    PlaystationButtonSquare,
    PlaystationButtonTriangle,
    Playstation5ButtonCreate,
    GameControllerIcon,
    Playstation5ButtonOptions,
    PlaystationButtonL3,
    PlaystationButtonR3,
    PlaystationTriggerL1,
    PlaystationTriggerR1,
    PlaystationDpadUp,
    PlaystationDpadDown,
    PlaystationDpadLeft,
    PlaystationDpadRight,
    GameControllerIcon,
  ],
};

const CONTROLLER_AXIS_ICONS: Partial<
  Record<ControllerLayout, readonly InputIcon[]>
> = {
  switch: [
    SwitchStickLHorizontal,
    SwitchStickLVertical,
    SwitchStickRHorizontal,
    SwitchStickRVertical,
    SwitchButtonZl,
    SwitchButtonZr,
  ],
  xbox: [
    XboxStickLHorizontal,
    XboxStickLVertical,
    XboxLt,
    XboxStickRHorizontal,
    XboxStickRVertical,
    XboxRt,
  ],
  playstation: [
    PlaystationStickLHorizontal,
    PlaystationStickLVertical,
    PlaystationStickRHorizontal,
    PlaystationStickRVertical,
    PlaystationTriggerL2,
    PlaystationTriggerR2,
  ],
};

function physicalInputIcon(
  source: PhysicalSource,
  layout: ControllerLayout,
): InputIcon {
  const icons =
    source.kind === "button"
      ? CONTROLLER_BUTTON_ICONS[layout]
      : CONTROLLER_AXIS_ICONS[layout];
  return icons?.[Number(source.index)] ?? GameControllerIcon;
}

const isButtonName = (value: unknown): value is ButtonName =>
  typeof value === "string" && BUTTON_NAMES.some((name) => name === value);

const isControllerLayout = (value: unknown): value is ControllerLayout =>
  value === "generic" ||
  value === "switch" ||
  value === "xbox" ||
  value === "playstation";

const MAPPING_FIELDS: ReadonlyArray<"buttons" | "triggers"> = [
  "buttons",
  "triggers",
];

function parsePreset(value: string): ParsedPreset {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return {
      kind: "invalid",
      message: "Fix the JSON in Advanced mode before using the mapping editor.",
    };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { kind: "invalid", message: "Preset JSON must be an object." };
  }

  const document = Object.fromEntries(Object.entries(parsed));
  const mappings: Record<"buttons" | "triggers", Record<string, ButtonName>> = {
    buttons: {},
    triggers: {},
  };
  for (const field of MAPPING_FIELDS) {
    const rawMappings = document[field];
    if (rawMappings === undefined) continue;
    if (
      typeof rawMappings !== "object" ||
      rawMappings === null ||
      Array.isArray(rawMappings)
    ) {
      return {
        kind: "invalid",
        message: `The preset "${field}" field must be an object.`,
      };
    }
    for (const [index, button] of Object.entries(rawMappings)) {
      if (!/^\d+$/.test(index) || !isButtonName(button)) {
        return {
          kind: "invalid",
          message: `A ${field === "buttons" ? "button" : "trigger"} mapping is not valid. Open Advanced mode to fix it.`,
        };
      }
      mappings[field][index] = button;
    }
  }
  return { kind: "valid", document, ...mappings };
}

function sourceFor(
  buttons: Record<string, ButtonName>,
  triggers: Record<string, ButtonName>,
  target: ButtonName,
): PhysicalSource | null {
  const buttonIndex = Object.entries(buttons).find(
    ([, button]) => button === target,
  )?.[0];
  if (buttonIndex !== undefined) return { kind: "button", index: buttonIndex };
  const triggerIndex = Object.entries(triggers).find(
    ([, button]) => button === target,
  )?.[0];
  return triggerIndex === undefined
    ? null
    : { kind: "trigger", index: triggerIndex };
}

function sourceValue(source: PhysicalSource | null): string {
  return source === null ? "" : `${source.kind}:${source.index}`;
}

function parseSourceValue(value: string): PhysicalSource | null {
  const [kind, index, extra] = value.split(":");
  if (extra !== undefined || !/^\d+$/.test(index ?? "")) return null;
  if (kind === "button" || kind === "trigger") return { kind, index };
  return null;
}

function inferControllerLayout(
  document: Record<string, unknown>,
): ControllerLayout {
  if (isControllerLayout(document.controller_layout))
    return document.controller_layout;
  const identity =
    `${document.name ?? ""} ${document.description ?? ""}`.toLowerCase();
  if (
    identity.includes("playstation") ||
    identity.includes("dualshock") ||
    identity.includes("dualsense")
  ) {
    return "playstation";
  }
  if (
    identity.includes("switch") ||
    identity.includes("joy-con") ||
    identity.includes("nintendo")
  ) {
    return "switch";
  }
  return "xbox";
}

function physicalInputLabel(
  kind: PhysicalSource["kind"],
  index: number,
  controller: ControllerLayoutDefinition,
): string {
  const prefix = kind === "button" ? "Button" : "Axis";
  const names =
    kind === "button" ? controller.buttonNames : controller.axisNames;
  const name = names[index];
  return name === undefined ? `${prefix} ${index}` : `${name}`;
}

function controllerLayoutDefinition(
  layout: ControllerLayout,
): ControllerLayoutDefinition {
  return (
    CONTROLLER_LAYOUTS.find((controller) => controller.value === layout) ??
    GENERIC_CONTROLLER_LAYOUT
  );
}

function PresetMappingEditor({
  value,
  onChange,
  disabled,
}: PresetMappingEditorProps) {
  const parsed = useMemo(() => parsePreset(value), [value]);
  const [listeningTarget, setListeningTarget] =
    useState<SupportedButtonName | null>(null);
  const [gamepadButtonCount, setGamepadButtonCount] = useState(16);
  const [gamepadAxisCount, setGamepadAxisCount] = useState(6);
  const pressedAtStart = useRef<Set<number>>(new Set());

  const assign = useCallback(
    (target: ButtonName, source: PhysicalSource | null) => {
      if (disabled || parsed.kind === "invalid") return;
      const nextButtons = Object.fromEntries(
        Object.entries(parsed.buttons).filter(
          ([index, button]) =>
            !(source?.kind === "button" && index === source.index) &&
            button !== target,
        ),
      );
      const nextTriggers = Object.fromEntries(
        Object.entries(parsed.triggers).filter(
          ([index, button]) =>
            !(source?.kind === "trigger" && index === source.index) &&
            button !== target,
        ),
      );
      if (source?.kind === "button") nextButtons[source.index] = target;
      if (source?.kind === "trigger") nextTriggers[source.index] = target;
      const nextDocument = {
        ...parsed.document,
        buttons: nextButtons,
        triggers: nextTriggers,
      };
      onChange(`${JSON.stringify(nextDocument, null, 2)}\n`);
    },
    [disabled, onChange, parsed],
  );

  useEffect(() => {
    if (listeningTarget === null) return;
    let animationFrame = 0;
    const poll = () => {
      const gamepad = Array.from(navigator.getGamepads()).find(
        (item) => item !== null,
      );
      if (gamepad !== undefined) {
        setGamepadButtonCount(Math.max(16, gamepad.buttons.length));
        setGamepadAxisCount(Math.max(6, gamepad.axes.length));
        const pressed = new Set<number>();
        gamepad.buttons.forEach((button, index) => {
          if (button.pressed) pressed.add(index);
        });
        const newlyPressed = [...pressed].find(
          (index) => !pressedAtStart.current.has(index),
        );
        if (newlyPressed !== undefined) {
          assign(listeningTarget, {
            kind: "button",
            index: String(newlyPressed),
          });
          setListeningTarget(null);
          return;
        }
        pressedAtStart.current = pressed;
      }
      animationFrame = requestAnimationFrame(poll);
    };
    animationFrame = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animationFrame);
  }, [assign, listeningTarget]);

  const startListening = (target: SupportedButtonName) => {
    const gamepad = Array.from(navigator.getGamepads()).find(
      (item) => item !== null,
    );
    pressedAtStart.current = new Set(
      gamepad?.buttons.flatMap((button, index) =>
        button.pressed ? [index] : [],
      ) ?? [],
    );
    if (gamepad !== undefined) {
      setGamepadButtonCount(Math.max(16, gamepad.buttons.length));
      setGamepadAxisCount(Math.max(6, gamepad.axes.length));
    }
    setListeningTarget(target);
  };

  if (parsed.kind === "invalid") {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
        {parsed.message}
      </div>
    );
  }

  const buttonOptions = Array.from(
    { length: gamepadButtonCount },
    (_, index) => index,
  );
  const axisOptions = Array.from(
    { length: gamepadAxisCount },
    (_, index) => index,
  );
  const controllerLayout = inferControllerLayout(parsed.document);
  const controller = controllerLayoutDefinition(controllerLayout);

  const setControllerLayout = (layout: ControllerLayout) => {
    if (disabled) return;
    onChange(
      `${JSON.stringify({ ...parsed.document, controller_layout: layout }, null, 2)}\n`,
    );
  };

  const mappingRow = (target: SupportedButtonName) => {
    const source = sourceFor(parsed.buttons, parsed.triggers, target);
    const listening = listeningTarget === target;
    const Icon = BUTTON_ICONS[target];
    const SelectedInputIcon =
      source === null ? null : physicalInputIcon(source, controllerLayout);
    return (
      <div
        key={target}
        className="group flex min-w-0 items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 transition-colors hover:border-border hover:bg-background/80"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-foreground p-0.5 text-background">
          <Icon className="size-7" />
        </span>
        <Select
          value={sourceValue(source)}
          onValueChange={(nextValue) => {
            if (nextValue !== null) assign(target, parseSourceValue(nextValue));
          }}
          disabled={disabled || listeningTarget !== null}
        >
          <SelectTrigger
            id={`mapping-${target}`}
            size="sm"
            aria-label={`Physical input for ${BUTTON_LABELS[target]}`}
            className="min-w-0 flex-1 rounded-md border-border bg-background px-2 text-xs"
          >
            <SelectValue>
              {source === null || SelectedInputIcon === null ? (
                "None"
              ) : (
                <>
                  <SelectedInputIcon className="size-5" />
                  {physicalInputLabel(
                    source.kind,
                    Number(source.index),
                    controller,
                  )}
                </>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="start">
            <SelectGroup>
              <SelectItem value="">None</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Buttons</SelectLabel>
              {buttonOptions.map((index) => {
                const OptionIcon = physicalInputIcon(
                  { kind: "button", index: String(index) },
                  controllerLayout,
                );
                return (
                  <SelectItem key={index} value={`button:${index}`}>
                    <OptionIcon className="size-5" />
                    {physicalInputLabel("button", index, controller)}
                  </SelectItem>
                );
              })}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel>Trigger axes</SelectLabel>
              {axisOptions.map((index) => {
                const OptionIcon = physicalInputIcon(
                  { kind: "trigger", index: String(index) },
                  controllerLayout,
                );
                return (
                  <SelectItem key={index} value={`trigger:${index}`}>
                    <OptionIcon className="size-5" />
                    {physicalInputLabel("trigger", index, controller)}
                  </SelectItem>
                );
              })}
            </SelectGroup>
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={() =>
            listening ? setListeningTarget(null) : startListening(target)
          }
          disabled={listeningTarget !== null && !listening}
          title={
            listening
              ? "Cancel controller input"
              : `Press a controller button for ${BUTTON_LABELS[target]}`
          }
          aria-label={
            listening
              ? "Cancel controller input"
              : `Listen for ${BUTTON_LABELS[target]}`
          }
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors disabled:opacity-40",
            listening
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-muted-foreground hover:text-foreground",
          )}
        >
          {listening ? (
            <SpinnerGapIcon className="animate-spin" />
          ) : (
            <GameControllerIcon />
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <GameControllerIcon size={18} />
          <div>
            <h3 className="text-sm font-semibold">Controller mapping</h3>
            <p className="text-xs text-muted-foreground">
              Assign every Switch control from one screen.
            </p>
          </div>
        </div>
        <label className="ms-auto flex items-center gap-2 text-xs text-muted-foreground">
          Controller layout
          <select
            value={controllerLayout}
            onChange={(event) => {
              if (isControllerLayout(event.target.value))
                setControllerLayout(event.target.value);
            }}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60"
          >
            {CONTROLLER_LAYOUTS.map((layout) => (
              <option key={layout.value} value={layout.value}>
                {layout.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-2 bg-muted/10 p-3 md:grid-cols-2 xl:grid-cols-[minmax(270px,1fr)_minmax(220px,0.8fr)_minmax(270px,1fr)]">
        <div className="space-y-0.5">{MAPPING_COLUMNS[0].map(mappingRow)}</div>

        <div className="order-first flex min-h-48 flex-col items-center justify-center rounded-xl border border-border/70 bg-background/60 p-5 md:col-span-2 xl:order-none xl:col-span-1">
          {controller.image === null ? (
            <GameControllerIcon
              weight="light"
              className="size-32 text-muted-foreground"
            />
          ) : (
            <img
              src={controller.image}
              alt={`${controller.label} controller layout`}
              className="w-full max-w-56 brightness-0 opacity-80 dark:invert"
            />
          )}
          <p className="mt-3 text-sm font-semibold">{controller.label}</p>
          <p className="mt-1 max-w-52 text-center text-xs text-muted-foreground">
            Use the dropdowns or the controller buttons beside each mapping.
          </p>
          {listeningTarget !== null && (
            <div className="mt-4 flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
              <SpinnerGapIcon className="animate-spin" />
              Press a button for {BUTTON_LABELS[listeningTarget]}
            </div>
          )}
        </div>

        <div className="space-y-0.5">{MAPPING_COLUMNS[1].map(mappingRow)}</div>
      </div>
    </div>
  );
}
