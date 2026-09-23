import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import {
  GenericButtonCircle,
  GenericButtonCircleOutline,
  GenericButtonSquare,
  GenericButtonSquareOutline,
  GenericButtonTriggerA,
  GenericButtonTriggerAOutline,
  GenericButtonTriggerB,
  GenericButtonTriggerBOutline,
  GenericStickDown,
  GenericStickLeft,
  GenericStickRight,
  GenericStickUp,
} from "@/src/assets/input-prompts/generic";
import {
  XboxDpadDown,
  XboxDpadDownOutline,
  XboxDpadLeft,
  XboxDpadLeftOutline,
  XboxDpadRight,
  XboxDpadRightOutline,
  XboxDpadUp,
  XboxDpadUpOutline,
} from "@/src/assets/input-prompts/xbox";
import { useSocket } from "@/src/hooks/use-socket";
import type { ButtonName } from "@/src/lib/types";
import { Button } from "@/src/components/ui/button";
import { cn } from "cnfast";

type ControlButtonProps = {
  label: string;
  icon: ReactNode;
  pressedIcon?: ReactNode;
  accessibleLabel?: string;
  pressed: boolean;
  disabled: boolean;
  className?: string;
  onPress: () => void;
  onRelease: () => void;
};

type ButtonVisual = { button: ButtonName } & Pick<
  ControlButtonProps,
  "label" | "accessibleLabel" | "icon" | "pressedIcon"
>;

type StickSide = "left" | "right";
type StickDirection = "up" | "down" | "left" | "right";
type StickInput = `${StickSide}-${StickDirection}`;

function stickPosition(
  side: StickSide,
  inputs: ReadonlySet<StickInput>,
): [number, number] {
  const x =
    Number(inputs.has(`${side}-right`)) - Number(inputs.has(`${side}-left`));
  const y =
    Number(inputs.has(`${side}-up`)) - Number(inputs.has(`${side}-down`));
  return [x, y];
}

function ControlButton({
  label,
  icon,
  pressedIcon = icon,
  accessibleLabel = label,
  pressed,
  disabled,
  className,
  onPress,
  onRelease,
}: ControlButtonProps) {
  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    onPress();
  };

  const handlePointerEnd = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onRelease();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if ((event.key === " " || event.key === "Enter") && !event.repeat) {
      event.preventDefault();
      onPress();
    }
  };

  const handleKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      onRelease();
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon-lg"
      aria-label={accessibleLabel}
      aria-pressed={pressed}
      disabled={disabled}
      className={cn(
        "relative size-14 touch-none rounded-xl border-0 bg-transparent p-0 text-foreground transition-[transform,color] hover:bg-transparent hover:text-primary active:translate-y-0 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-40",
        pressed && "scale-90 text-primary",
        className,
      )}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={onRelease}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span className="absolute inset-0" aria-hidden="true">
        {pressed ? pressedIcon : icon}
      </span>
      <span
        className={cn(
          "relative text-xs font-bold",
          pressed && "text-primary-foreground",
        )}
        aria-hidden="true"
      >
        {label}
      </span>
    </Button>
  );
}

const BUTTON_GROUPS = {
  shoulders: [
    {
      button: "ZL",
      label: "ZL",
      icon: <GenericButtonTriggerBOutline className="size-full" />,
      pressedIcon: <GenericButtonTriggerB className="size-full" />,
    },
    {
      button: "L",
      label: "L",
      icon: <GenericButtonTriggerAOutline className="size-full" />,
      pressedIcon: <GenericButtonTriggerA className="size-full" />,
    },
    {
      button: "R",
      label: "R",
      icon: <GenericButtonTriggerAOutline className="size-full -scale-x-100" />,
      pressedIcon: <GenericButtonTriggerA className="size-full -scale-x-100" />,
    },
    {
      button: "ZR",
      label: "ZR",
      icon: <GenericButtonTriggerBOutline className="size-full -scale-x-100" />,
      pressedIcon: <GenericButtonTriggerB className="size-full -scale-x-100" />,
    },
  ],
  system: [
    {
      button: "CAPTURE",
      label: "●",
      accessibleLabel: "Capture",
      icon: <GenericButtonSquareOutline className="size-full" />,
      pressedIcon: <GenericButtonSquare className="size-full" />,
    },
    {
      button: "HOME",
      label: "⌂",
      accessibleLabel: "Home",
      icon: <GenericButtonCircleOutline className="size-full" />,
      pressedIcon: <GenericButtonCircle className="size-full" />,
    },
  ],
} satisfies Record<string, ReadonlyArray<ButtonVisual>>;

export function ManualControl() {
  const { connection, send, status } = useSocket();
  const heldButtons = useRef<Set<ButtonName>>(new Set());
  const heldSticks = useRef<Set<StickInput>>(new Set());
  const [pressedButtons, setPressedButtons] = useState<Set<ButtonName>>(
    () => new Set(),
  );
  const [pressedSticks, setPressedSticks] = useState<Set<StickInput>>(
    () => new Set(),
  );
  const disabled = connection !== "open" || status?.mode === "macro";

  const sendState = useCallback(() => {
    send({
      type: "state",
      buttons: [...heldButtons.current],
      left: stickPosition("left", heldSticks.current),
      right: stickPosition("right", heldSticks.current),
    });
  }, [send]);

  const releaseAll = useCallback(() => {
    if (heldButtons.current.size === 0 && heldSticks.current.size === 0) return;
    heldButtons.current = new Set();
    heldSticks.current = new Set();
    setPressedButtons(new Set());
    setPressedSticks(new Set());
    sendState();
  }, [sendState]);

  useEffect(() => {
    if (disabled) releaseAll();
  }, [disabled, releaseAll]);

  useEffect(() => {
    window.addEventListener("blur", releaseAll);
    return () => {
      window.removeEventListener("blur", releaseAll);
      releaseAll();
    };
  }, [releaseAll]);

  const press = useCallback(
    (button: ButtonName) => {
      if (disabled || heldButtons.current.has(button)) return;
      const next = new Set(heldButtons.current).add(button);
      heldButtons.current = next;
      setPressedButtons(next);
      sendState();
    },
    [disabled, sendState],
  );

  const release = useCallback(
    (button: ButtonName) => {
      if (!heldButtons.current.has(button)) return;
      const next = new Set(heldButtons.current);
      next.delete(button);
      heldButtons.current = next;
      setPressedButtons(next);
      sendState();
    },
    [sendState],
  );

  const controlProps = (button: ButtonName) => ({
    pressed: pressedButtons.has(button),
    disabled,
    onPress: () => press(button),
    onRelease: () => release(button),
  });

  const stickControlProps = (side: StickSide, direction: StickDirection) => {
    const input: StickInput = `${side}-${direction}`;
    return {
      pressed: pressedSticks.has(input),
      disabled,
      onPress: () => {
        if (disabled || heldSticks.current.has(input)) return;
        const next = new Set(heldSticks.current).add(input);
        heldSticks.current = next;
        setPressedSticks(next);
        sendState();
      },
      onRelease: () => {
        if (!heldSticks.current.has(input)) return;
        const next = new Set(heldSticks.current);
        next.delete(input);
        heldSticks.current = next;
        setPressedSticks(next);
        sendState();
      },
    };
  };

  return (
    <section className="w-full ">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Manual control</h2>
      </div>

      <div className="mx-auto flex max-w-xl flex-col gap-2 rounded-md border border-border bg-card p-3 text-card-foreground shadow-sm">
        <div className="grid grid-cols-4 gap-1" aria-label="Triggers">
          {BUTTON_GROUPS.shoulders.map(({ button, ...visual }) => (
            <ControlButton
              key={button}
              {...controlProps(button)}
              {...visual}
              className="h-12 w-full"
            />
          ))}
        </div>

        <div className="flex w-full justify-between items-center gap-3">
          <div
            className="grid grid-cols-2 place-items-center size-28 gap-0"
            aria-label="Directional pad"
          >
            {/* prettier-ignore */}
            <>
              <ControlButton {...controlProps("UP")} label="" accessibleLabel="D-pad up" icon={<XboxDpadUpOutline className="size-full" />} pressedIcon={<XboxDpadUp className="size-full" />} />
              <ControlButton {...controlProps("DOWN")} label="" accessibleLabel="D-pad down" icon={<XboxDpadDownOutline className="size-full" />} pressedIcon={<XboxDpadDown className="size-full" />} />
              <ControlButton {...controlProps("LEFT")} label="" accessibleLabel="D-pad left" icon={<XboxDpadLeftOutline className="size-full" />} pressedIcon={<XboxDpadLeft className="size-full" />} />
              <ControlButton {...controlProps("RIGHT")} label="" accessibleLabel="D-pad right" icon={<XboxDpadRightOutline className="size-full" />} pressedIcon={<XboxDpadRight className="size-full" />} />
            </>
          </div>

          <div className="flex flex-row gap-0">
            {BUTTON_GROUPS.system.map(({ button, ...visual }) => (
              <ControlButton
                key={button}
                {...controlProps(button)}
                {...visual}
                className="size-9"
              />
            ))}
          </div>

          <div
            className="grid grid-cols-2 place-items-center size-28"
            aria-label="Face buttons"
          >
            {/* prettier-ignore */}
            <>
              <ControlButton {...controlProps("X")} label="X" icon={<GenericButtonCircleOutline className="size-full" />} pressedIcon={<GenericButtonCircle className="size-full" />} className="text-blue-600" />
              <ControlButton {...controlProps("A")} label="A" icon={<GenericButtonCircleOutline className="size-full" />} pressedIcon={<GenericButtonCircle className="size-full" />} className="text-emerald-600" />
              <ControlButton {...controlProps("Y")} label="Y" icon={<GenericButtonCircleOutline className="size-full" />} pressedIcon={<GenericButtonCircle className="size-full" />} className="text-amber-600" />
              <ControlButton {...controlProps("B")} label="B" icon={<GenericButtonCircleOutline className="size-full" />} pressedIcon={<GenericButtonCircle className="size-full" />} className="text-red-600" />
            </>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 px-6" aria-label="Analog sticks">
          {(["left", "right"] satisfies StickSide[]).map((side) => (
            // biome-ignore format: preserving custom grid layout

            <div
              key={side}
              className="grid grid-cols-3 grid-rows-3 place-items-center"
            >
              {/* prettier-ignore */}
              <>
                <ControlButton {...stickControlProps(side, "up")} label="" accessibleLabel={`${side} stick up`} icon={<GenericStickUp className="size-full" />} className="col-start-2" />
                <ControlButton {...stickControlProps(side, "left")} label="" accessibleLabel={`${side} stick left`} icon={<GenericStickLeft className="size-full" />} className="row-start-2" />
                <div className="size-10" />
                <div className="size-10" />
                <ControlButton {...stickControlProps(side, "right")} label="" accessibleLabel={`${side} stick right`} icon={<GenericStickRight className="size-full" />} />
                <ControlButton {...stickControlProps(side, "down")} label="" accessibleLabel={`${side} stick down`} icon={<GenericStickDown className="size-full" />} className="col-start-2" />
              </>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
