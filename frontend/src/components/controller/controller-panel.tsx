import { useCallback } from "react";
import {
  CaretDownIcon,
  GameControllerIcon,
  SpinnerGapIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useControllers } from "@/src/hooks/use-controllers";
import { useMacroRunner } from "@/src/hooks/use-macro-runner";
import { cn } from "cnfast";

export function ControllerPanel() {
  const { available, controllers, active, activeInfo, busy, error, select } =
    useControllers();
  const { macroActive } = useMacroRunner();

  const handleChange = useCallback(
    (value: string) => {
      if (value !== "") void select(value);
    },
    [select],
  );

  return (
    <section className="flex w-full flex-col gap-4 text-left">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-foreground">Controller</h2>
        <span className="ms-auto text-xs text-muted-foreground">
          {controllers.length} connected
        </span>
      </div>

      {!available ? (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          <GameControllerIcon size={20} className="shrink-0" />
          <p>
            Controller service is not running — start the backend with{" "}
            <code className="rounded bg-muted px-1 font-mono">
              --input controller
            </code>
            .
          </p>
        </div>
      ) : (
        <div className="relative">
          <select
            value={active ?? ""}
            onChange={(e) => handleChange(e.target.value)}
            disabled={busy || controllers.length === 0 || macroActive}
            aria-label="Select controller"
            className={cn(
              "h-9 w-full appearance-none rounded-4xl border border-border bg-background px-3 pe-9 text-sm",
              "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
              "disabled:opacity-50",
            )}
          >
            {controllers.length === 0 ? (
              <option value="">No controllers detected</option>
            ) : (
              controllers.map((c) => (
                <option key={c.guid} value={c.guid}>
                  {c.name} ({c.buttons} buttons, {c.axes} axes)
                </option>
              ))
            )}
          </select>
          <CaretDownIcon
            size={16}
            weight="bold"
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
          />
          {busy && (
            <SpinnerGapIcon
              size={16}
              className="absolute top-1/2 right-8 -translate-y-1/2 animate-spin text-muted-foreground"
            />
          )}
        </div>
      )}

      {macroActive && (
        <p className="text-xs text-muted-foreground">
          Device switching is disabled while a macro is running.
        </p>
      )}

      {error !== null && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm"
        >
          <WarningIcon size={16} className="mt-0.5 shrink-0 text-destructive" />
          <p className="flex-1">{error}</p>
        </div>
      )}

      <div className="rounded-xl border border-border p-4 text-sm">
        <h3 className="mb-2 font-semibold">Active device</h3>
        {activeInfo ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
            <dt className="text-muted-foreground">name</dt>
            <dd>{activeInfo.name}</dd>
            <dt className="text-muted-foreground">guid</dt>
            <dd className="break-all">{activeInfo.guid}</dd>
            <dt className="text-muted-foreground">axes / buttons / hats</dt>
            <dd>
              {activeInfo.axes} / {activeInfo.buttons} / {activeInfo.hats}
            </dd>
          </dl>
        ) : (
          <p className="text-muted-foreground">No device selected.</p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Button mappings are managed by{" "}
          <Link to="/presets" className="text-primary hover:underline">
            presets
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
