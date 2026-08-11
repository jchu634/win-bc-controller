"""Input policy broker.

Single authority over the controller's input sources.
Tracks the current "control mode" (``manual`` vs ``macro``)
Only one mode is active at a time:

"""

from __future__ import annotations

import asyncio
import logging
import queue
import threading
from pathlib import Path
from typing import Literal

from lib.input.macro_source import MacroPlayerThread, load_macro
from lib.input.pygame_source import PygameInputThread
from lib.input.state import NEUTRAL, Button, ControllerState

logger = logging.getLogger("switch_pair")

Mode = Literal["manual", "macro"]


class InputManager:
    def __init__(
        self,
        command_queue: queue.Queue,
        macros_dir: Path,
        macro_rate_hz: int = 120,
    ):
        self.command_queue = command_queue
        self.macros_dir = Path(macros_dir)
        self.macro_rate_hz = macro_rate_hz
        self.mode: Mode = "manual"
        self.pygame_threads: list[PygameInputThread] = []
        self._macro: MacroPlayerThread | None = None
        self._macro_name: str | None = None
        # Reentrant: ``on_finish`` fires from the macro thread while the
        # asyncio thread may still be inside ``cancel_macro``.
        self._lock = threading.RLock()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._subscribers: list[asyncio.Queue] = []

    # ------------------------------------------------------------------ loop

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Register the running asyncio loop so thread-side transitions can
        marshal broadcasts back onto the loop thread."""
        self._loop = loop

    # ------------------------------------------------------------ subscribers

    def subscribe(self) -> asyncio.Queue:
        """Get a queue that receives a status dict on every transition.
        The queue is loop-bound; consume it from the same loop."""
        q: asyncio.Queue = asyncio.Queue()
        self._subscribers.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        try:
            self._subscribers.remove(q)
        except ValueError:
            pass

    def _emit_status(self) -> None:
        payload = self.status()
        loop = self._loop
        if loop is not None and loop.is_running():
            for q in list(self._subscribers):
                try:
                    loop.call_soon_threadsafe(q.put_nowait, payload)
                except RuntimeError:
                    # Loop closed between check and schedule; drop silently.
                    pass
        else:
            for q in list(self._subscribers):
                try:
                    q.put_nowait(payload)
                except Exception:
                    logger.exception("status broadcast failed")

    # --------------------------------------------------------------- queries

    def status(self) -> dict:
        with self._lock:
            macro_info = None
            if self._macro is not None:
                state = "paused" if self._macro.is_paused() else "running"
                macro_info = {"name": self._macro_name, "state": state}
            return {"mode": self.mode, "macro": macro_info}

    def list_macro_files(self) -> list[str]:
        """Return macro names (file stems) available under ``macros_dir``."""
        if not self.macros_dir.exists():
            return []
        return sorted(p.stem for p in self.macros_dir.glob("*.json") if p.is_file())

    # ------------------------------------------------------ pygame registry

    def attach_pygame_threads(self, threads: list[PygameInputThread]) -> None:
        self.pygame_threads.extend(threads)

    # ----------------------------------------------------- mode transitions

    def set_mode(self, mode: Mode) -> None:
        with self._lock:
            if mode == self.mode:
                return
            if mode == "macro":
                for t in self.pygame_threads:
                    t.pause()
                self.mode = "macro"
            else:  # -> manual
                if self._macro is not None:
                    self._macro.stop()
                    self._drain_and_neutralize()
                    self._clear_macro()
                for t in self.pygame_threads:
                    t.resume()
                self.mode = "manual"
        self._emit_status()

    # ----------------------------------------------------- macro lifecycle

    def start_macro(self, macro: dict) -> None:
        """Start a fresh macro dict. Cancels any currently running macro
        first (immediate stop + queue drain + NEUTRAL). Flips mode to
        ``macro`` and pauses physical input."""
        with self._lock:
            self._cancel_internal()
            name = macro.get("name", "<unnamed>")
            thread = MacroPlayerThread(
                macro,
                self.command_queue,
                rate_hz=self.macro_rate_hz,
                on_finish=self._on_macro_finished,
            )
            self._macro = thread
            self._macro_name = name
            if self.mode != "macro":
                for t in self.pygame_threads:
                    t.pause()
                self.mode = "macro"
            thread.start()
        logger.info(f"Started macro '{name}'")
        self._emit_status()

    def start_macro_by_name(self, name: str) -> None:
        path = self.macros_dir / f"{name}.json"
        macro = load_macro(path)
        macro.setdefault("name", name)
        self.start_macro(macro)

    def cancel_macro(self) -> None:
        with self._lock:
            self._cancel_internal()
            if self.mode == "macro":
                for t in self.pygame_threads:
                    t.resume()
                self.mode = "manual"
        self._emit_status()

    def pause_macro(self) -> None:
        with self._lock:
            if self._macro is not None and not self._macro.is_paused():
                self._macro.pause()
        self._emit_status()

    def resume_macro(self) -> None:
        with self._lock:
            if self._macro is not None and self._macro.is_paused():
                self._macro.resume()
        self._emit_status()

    # -------------------------------------------------- manual input gate

    def submit_state(self, state: ControllerState) -> bool:
        """Enqueue an ad-hoc state. Returns True if accepted, False if the
        manager is in macro mode (caller should emit an error frame)."""
        with self._lock:
            if self.mode == "macro":
                return False
        self.command_queue.put_nowait(state)
        return True

    # ----------------------------------------------------------- shutdown

    def shutdown(self) -> None:
        with self._lock:
            if self._macro is not None:
                self._macro.stop()
                self._clear_macro()
            for t in self.pygame_threads:
                t.stop()

    # ------------------------------------------------------------- internals

    def _cancel_internal(self) -> None:
        """Stop the current macro, drain the queue, push NEUTRAL. Caller
        holds ``_lock``. Does NOT switch mode."""
        if self._macro is None:
            return
        name = self._macro_name
        self._macro.stop()
        self._drain_and_neutralize()
        self._clear_macro()
        logger.info(f"Cancelled macro '{name}'")

    def _drain_and_neutralize(self) -> None:
        """Drain whatever the macro already enqueued (so a held state
        doesn't linger for a few ticks) and push one NEUTRAL so the
        Switch releases held inputs immediately."""
        drained = 0
        while True:
            try:
                self.command_queue.get_nowait()
            except queue.Empty:
                break
            drained += 1
        self.command_queue.put_nowait(NEUTRAL)
        if drained:
            logger.debug(f"drained {drained} queued states on macro stop")

    def _clear_macro(self) -> None:
        self._macro = None
        self._macro_name = None

    def _on_macro_finished(self) -> None:
        """Invoked from the macro thread (natural end or stop). Flip back
        to manual so physical input resumes."""
        with self._lock:
            name = self._macro_name
            self._clear_macro()
            if self.mode == "macro":
                for t in self.pygame_threads:
                    t.resume()
                self.mode = "manual"
        logger.info(f"Macro '{name}' finished; returning to manual mode")
        self._emit_status()


# --------------------------------------------------------------------- helpers


def state_from_event(action: dict) -> ControllerState:
    """Resolve a single ``press``/``release``/``stick`` action into a
    delta-applied :class:`ControllerState`.

    ``press``/``release`` produce a state containing only that button;
    ``stick`` produces a state with the named stick moved (and the other
    at neutral). The caller is expected to merge consecutive deltas when
    accumulating button state across frames; for the common case of a
    one-shot button tap, this is sufficient.
    """
    kind = action.get("do")
    if kind == "press":
        return ControllerState(Button.by_name(action["button"]))
    if kind == "release":
        return ControllerState(Button(0))
    if kind == "stick":
        side = str(action.get("side", "left")).lower()
        x = float(action.get("x", 0.0))
        y = float(action.get("y", 0.0))
        if side == "right":
            return ControllerState(Button(0), (0.0, 0.0), (x, y))
        return ControllerState(Button(0), (x, y), (0.0, 0.0))
    raise ValueError(f"unsupported event action: {kind!r}")
