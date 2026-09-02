import { useCallback } from "react";
import {
  GameControllerIcon,
  SpinnerGapIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { useControllers } from "@/src/hooks/use-controllers";
import { useMacroRunner } from "@/src/hooks/use-macro-runner";

export function ControllerPanel() {
  const { available, controllers, active, busy, error, select } =
    useControllers();
  const { macroActive } = useMacroRunner();
  const activeController = controllers.find(
    (controller) => controller.guid === active,
  );

  const handleChange = useCallback(
    (value: string) => {
      if (value !== "") void select(value);
    },
    [select],
  );

  return (
    <section className="flex w-full flex-col space-y-2 text-left">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-foreground">Controller</h2>
        <span className="ms-auto text-xs text-muted-foreground">
          {controllers.length} connected
        </span>
      </div>

      {!available ? (
        // Only shows with frontend development and/or something broke.
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
          <Select
            value={active}
            onValueChange={(value) => {
              if (value !== null) handleChange(value);
            }}
            disabled={busy || controllers.length === 0 || macroActive}
          >
            <SelectTrigger className="w-50%" aria-label="Select controller">
              <SelectValue placeholder="No controllers detected">
                {activeController ? `${activeController.name}` : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {controllers.map((c) => (
                <SelectItem key={c.guid} value={c.guid}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
    </section>
  );
}
