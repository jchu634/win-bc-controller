from __future__ import annotations

import json
import logging
import math
import threading
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

from lib.input.state import Button, ControllerState

logger = logging.getLogger("switch_pair")


SLICE_SECONDS = 0.005

VALID_BUTTONS = frozenset(b.name for b in Button if b.name)


def load_macro(path: str | Path) -> dict:
    """Load and minimally validate a JSON macro file."""
    with open(path, "r", encoding="utf-8") as f:
        macro = json.load(f)
    if not isinstance(macro, dict) or "actions" not in macro:
        raise ValueError("Macro JSON must be an object with an 'actions' list")
    if not isinstance(macro["actions"], list):
        raise ValueError("'actions' must be a list")
    return macro


class MacroValidationError(ValueError):
    """A macro failed semantic validation.

    ``path`` is the JSON path of the offending element, e.g.
    ``["actions", 3, "button"]`` so editors can locate the error in the
    source text.
    """

    def __init__(self, path: list[str | int], message: str):
        self.path = path
        where = "".join(
            f"[{p}]" if isinstance(p, int) else f".{p}" for p in path
        ).lstrip(".")
        super().__init__(f"{where or '<root>'}: {message}" if where else message)


def _expect_number(value: Any, path: list[str | int], key: str) -> float:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise MacroValidationError(path, f"'{key}' must be a number")
    if not math.isfinite(float(value)):
        raise MacroValidationError(path, f"'{key}' must be finite")
    return float(value)


def validate_macro(macro: dict) -> dict:
    """Recursively validate a parsed macro document. Returns it unchanged.

    Raises :class:`MacroValidationError` on the first problem found.
    Mirrors exactly what :class:`MacroPlayerThread` can execute:
    ``press`` / ``release`` / ``wait`` / ``stick`` / nested ``loop``.
    """
    if "actions" not in macro:
        raise MacroValidationError([], "missing required key 'actions'")
    if not isinstance(macro["actions"], list):
        raise MacroValidationError(["actions"], "must be a list")

    if "repeat" in macro:
        repeat = macro["repeat"]
        if not isinstance(repeat, int) or isinstance(repeat, bool) or repeat < 0:
            raise MacroValidationError(
                ["repeat"], "must be a non-negative integer (0 = loop forever)"
            )

    if "name" in macro and not isinstance(macro["name"], str):
        raise MacroValidationError(["name"], "must be a string")

    _validate_actions(macro["actions"], ["actions"], depth=0)
    return macro


def _validate_actions(actions: list, path: list[str | int], depth: int) -> None:
    if depth > 16:
        raise MacroValidationError(path, "loops nested too deeply (max 16)")
    for i, action in enumerate(actions):
        action_path = [*path, i]
        if not isinstance(action, dict):
            raise MacroValidationError(action_path, "each action must be an object")
        kind = action.get("do")
        if kind == "press" or kind == "release":
            if "button" not in action:
                raise MacroValidationError(
                    action_path, f"'{kind}' requires a 'button'"
                )
            button = action["button"]
            if not isinstance(button, str) or button.strip().upper() not in VALID_BUTTONS:
                valid = ", ".join(sorted(VALID_BUTTONS))
                raise MacroValidationError(
                    [*action_path, "button"],
                    f"unknown button {button!r} for '{kind}' (valid: {valid})",
                )
        elif kind == "wait":
            ms = action.get("ms", 0)
            if not isinstance(ms, (int, float)) or isinstance(ms, bool):
                raise MacroValidationError(
                    [*action_path, "ms"], "'wait' duration must be a number"
                )
            if float(ms) < 0 or not math.isfinite(float(ms)):
                raise MacroValidationError(
                    [*action_path, "ms"], "'wait' duration must be >= 0"
                )
        elif kind == "stick":
            side = action.get("side", "left")
            if side not in ("left", "right"):
                raise MacroValidationError(
                    [*action_path, "side"], "must be 'left' or 'right'"
                )
            for key in ("x", "y"):
                _expect_number(action.get(key, 0.0), [*action_path, key], key)
        elif kind == "loop":
            count = action.get("count", 1)
            if not isinstance(count, int) or isinstance(count, bool) or count < 0:
                raise MacroValidationError(
                    [*action_path, "count"],
                    "must be a non-negative integer",
                )
            inner = action.get("actions", [])
            if not isinstance(inner, list):
                raise MacroValidationError(
                    [*action_path, "actions"], "'loop' actions must be a list"
                )
            _validate_actions(inner, [*action_path, "actions"], depth + 1)
        else:
            raise MacroValidationError(
                action_path,
                "unknown action (expected 'press', 'release', 'wait', 'stick' "
                "or 'loop')",
            )


class MacroPlayerThread(threading.Thread):
    """Daemon thread that plays a JSON macro onto a command queue.

    Macro schema (event-based: press / release / wait / stick / loop)::

        {
          "name": "example",
          "repeat": 0,            # 0 = loop forever, N = play N times
          "actions": [
            {"do": "press",   "button": "A"},
            {"do": "wait",    "ms": 50},
            {"do": "release", "button": "A"},
            {"do": "wait",    "ms": 50},
            {"do": "stick",   "side": "left", "x": 0.0, "y": 1.0},
            {"do": "wait",    "ms": 200},
            {"do": "stick",   "side": "left", "x": 0.0, "y": 0.0},
            {"do": "loop",    "count": 3, "actions": [
              {"do": "press",   "button": "B"},
              {"do": "wait",    "ms": 30},
              {"do": "release", "button": "B"},
              {"do": "wait",    "ms": 30}
            ]}
          ]
        }

    Button names match the ``Button`` enum (A, B, X, Y, L, R, ZL, ZR,
    UP, DOWN, LEFT, RIGHT, PLUS, MINUS, HOME, CAPTURE, STICK_L, STICK_R).
    """

    def __init__(
        self,
        macro: dict,
        command_queue,
        rate_hz: int = 120,
        on_finish: Callable[[], None] | None = None,
    ):
        super().__init__(name="macro-player", daemon=True)
        self._macro = macro
        self._queue = command_queue
        self._period = 1.0 / rate_hz
        self._stop = threading.Event()
        # Set = running, cleared = paused. Pause freezes the macro in its
        # current (possibly held) state; the steady-state snapshots are
        # not enqueued while paused, but held buttons stay held on the
        # Switch until something else enqueues a fresh state.
        self._pause = threading.Event()
        self._pause.set()
        self._buttons: set[Button] = set()
        self._left: tuple[float, float] = (0.0, 0.0)
        self._right: tuple[float, float] = (0.0, 0.0)
        self._on_finish = on_finish

    def stop(self):
        self._stop.set()
        # Make sure a paused macro can actually exit.
        self._pause.set()

    def pause(self):
        self._pause.clear()

    def resume(self):
        self._pause.set()

    def is_paused(self) -> bool:
        return not self._pause.is_set() and not self._stop.is_set()

    def run(self):
        repeat = int(self._macro.get("repeat", 1))
        name = self._macro.get("name", "<unnamed>")
        logger.info(f"Playing macro '{name}' (repeat={'∞' if repeat == 0 else repeat})")
        try:
            if repeat == 0:
                while not self._stop.is_set():
                    if not self._execute(self._macro["actions"]):
                        break
            else:
                for _ in range(repeat):
                    if self._stop.is_set():
                        break
                    if not self._execute(self._macro["actions"]):
                        break
        finally:
            # Always leave the controller idle when the macro ends.
            self._buttons.clear()
            self._left = (0.0, 0.0)
            self._right = (0.0, 0.0)
            self._queue.put(ControllerState())
            logger.info(f"Macro '{name}' finished")
            if self._on_finish is not None:
                try:
                    self._on_finish()
                except Exception:
                    logger.exception("macro on_finish callback raised")

    def _execute(self, actions: list[dict]) -> bool:
        """Execute a block of actions. Returns False if stopped."""
        for action in actions:
            if self._stop.is_set():
                return False
            kind = action.get("do")
            if kind == "press":
                self._buttons.add(Button.by_name(action["button"]))
                self._emit()
            elif kind == "release":
                self._buttons.discard(Button.by_name(action["button"]))
                self._emit()
            elif kind == "stick":
                self._apply_stick(action)
                self._emit()
            elif kind == "wait":
                self._wait(float(action.get("ms", 0)) / 1000.0)
            elif kind == "loop":
                count = int(action.get("count", 1))
                for _ in range(count):
                    if self._stop.is_set():
                        return False
                    if not self._execute(action.get("actions", [])):
                        return False
            else:
                raise ValueError(f"Unknown macro action: {kind!r}")
        return True

    def _apply_stick(self, action: dict[str, Any]):
        side = action.get("side", "left").lower()
        x = float(action.get("x", 0.0))
        y = float(action.get("y", 0.0))
        if side == "right":
            self._right = (x, y)
        else:
            self._left = (x, y)

    def _wait(self, seconds: float):
        """Hold the current state for ``seconds``, continuously enqueuing
        so the Switch keeps receiving reports at a steady rate."""
        if seconds <= 0:
            return
        end = time.perf_counter() + seconds
        while True:
            if self._stop.is_set():
                return
            # Block while paused (no enqueue, no countdown progress).
            if not self._pause.wait(timeout=SLICE_SECONDS):
                # Timed out waiting for run signal; loop and re-check stop.
                continue
            remaining = end - time.perf_counter()
            if remaining <= 0:
                return
            self._queue.put(self._snapshot())
            time.sleep(min(self._period, remaining, SLICE_SECONDS))

    def _emit(self):
        self._queue.put(self._snapshot())

    def _snapshot(self) -> ControllerState:
        flags = Button(0)
        for b in self._buttons:
            flags |= b
        return ControllerState(flags, self._left, self._right)
