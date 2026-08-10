from __future__ import annotations

import logging
import threading
import time

# TODO Make Lazy for python 3.15
from pygame import event, joystick
from pygame import init as pygame_init

from lib.input.state import Button, ControllerState

logger = logging.getLogger("switch_pair")


# Default mapping from an Xbox/SDL-style gamepad (pygame button indices)
# to Switch buttons. Nintendo labels sit in the *positions* Xbox uses for
# the other letter, so we swap A/B and X/Y to keep physical placement
# (bottom = primary action). Override via ``button_map`` to customise.
DEFAULT_BUTTON_MAP: dict[int, Button] = {
    0: Button.B,  # Xbox A  -> Nintendo B (bottom)
    1: Button.A,  # Xbox B  -> Nintendo A (right)
    2: Button.Y,  # Xbox X  -> Nintendo Y (left)
    3: Button.X,  # Xbox Y  -> Nintendo X (top)
    4: Button.L,  # LB
    5: Button.R,  # RB
    6: Button.MINUS,  # Back
    7: Button.PLUS,  # Start
    8: Button.HOME,  # Guide
    9: Button.STICK_L,  # Left stick click
    10: Button.STICK_R,  # Right stick click
}


class PygameInputThread(threading.Thread):
    """Daemon thread that polls a physical gamepad via pygame and pushes
    ``ControllerState`` snapshots onto a thread-safe command queue.
    """

    def __init__(
        self,
        command_queue,
        device_index: int = 0,
        rate_hz: int = 120,
        deadzone: float = 0.12,
        trigger_threshold: float = 0.30,
        button_map: dict[int, Button] | None = None,
    ):
        super().__init__(name="pygame-input", daemon=True)
        self._queue = command_queue
        self._device_index = device_index
        self._period = 1.0 / rate_hz
        self._deadzone = deadzone
        self._trigger_threshold = trigger_threshold
        self._button_map = button_map or DEFAULT_BUTTON_MAP
        self._stop = threading.Event()

    def stop(self):
        self._stop.set()

    def run(self):
        try:
            pygame_init()
        except Exception:
            # Headless / no-display environments: fall back to joystick-only.
            try:
                joystick.init()
            except Exception as e:
                logger.error(f"pygame init failed: {e}")
                return

        try:
            count = joystick.get_count()
            if count <= self._device_index:
                logger.error(
                    f"No joystick at index {self._device_index} ({count} detected)"
                )
                return
            stick = joystick.Joystick(self._device_index)
            stick.init()
            logger.info(
                f"Pygame input following '{stick.get_name()}' "
                f"({stick.get_numaxes()} axes, {stick.get_numbuttons()} "
                f"buttons, {stick.get_numhats()} hats)"
            )
            self._loop(stick)
        except Exception as e:
            logger.exception(f"Pygame input thread crashed: {e}")
        finally:
            joystick.quit()

    def _loop(self, stick):
        n_axes = stick.get_numaxes()
        n_buttons = stick.get_numbuttons()
        n_hats = stick.get_numhats()

        while not self._stop.is_set():
            event.pump()

            buttons = Button(0)

            for i in range(n_buttons):
                if i not in self._button_map:
                    continue
                if stick.get_button(i):
                    buttons |= self._button_map[i]

            # Analog triggers (axes 4/5 on most XInput pads). Treat as
            # digital above a threshold; index varies, so we probe.
            for i in (4, 5):
                if i >= n_axes:
                    continue
                v = stick.get_axis(i)
                if v >= self._trigger_threshold:
                    if i == 4:
                        buttons |= Button.ZL
                    elif i == 5:
                        buttons |= Button.ZR

            lx, ly = self._axis(stick, 0, 1, n_axes)
            rx, ry = self._axis(stick, 2, 3, n_axes)

            # D-pad from hat 0.
            if n_hats > 0:
                hx, hy = stick.get_hat(0)
                if hx < 0:
                    buttons |= Button.LEFT
                elif hx > 0:
                    buttons |= Button.RIGHT
                if hy < 0:
                    buttons |= Button.DOWN
                elif hy > 0:
                    buttons |= Button.UP

            self._queue.put(ControllerState(buttons, (lx, ly), (rx, ry)))
            time.sleep(self._period)

    def _axis(self, stick, ix, iy, n_axes):
        if ix >= n_axes or iy >= n_axes:
            return 0.0, 0.0
        x = self._deadzone_apply(stick.get_axis(ix))
        y = self._deadzone_apply(stick.get_axis(iy))
        # SDL reports Y positive = down; flip so up is positive.
        return x, -y

    def _deadzone_apply(self, v):
        if abs(v) <= self._deadzone:
            return 0.0
        # Rescale outside the deadzone so the stick feels responsive.
        sign = 1.0 if v > 0 else -1.0
        return sign * min(1.0, abs(v))
