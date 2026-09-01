"""Controller mapping presets.

A *preset* is a JSON description of how a physical controller's
pygame/SDL indices map to Switch buttons, sticks, triggers, D-pad, and
whether rumble is enabled. Presets live in the top-level ``presets/``
directory and are selected by name through the config store (``preset``
field) or the ``--preset`` CLI flag.

Schema (see ``presets/xbox.json`` for a full example)::

    {
      "name": "Xbox",
      "description": "...",
      "rumble_enabled": true,
      "buttons":  {"0": "B", "1": "A", ...},   # pygame btn idx -> Switch Button
      "triggers": {"4": "ZL", "5": "ZR"},       # pygame axis idx -> Switch Button
      "left_stick":  {"x_axis": 0, "y_axis": 1},
      "right_stick": {"x_axis": 2, "y_axis": 3},
      "dpad": {"hat": 0}                         # set hat to null to disable
    }

JSON object keys are strings (per the JSON spec) and are coerced to
``int`` on load. Button values are :class:`Button` enum names.
"""

from __future__ import annotations

import json
import logging
import os
import threading
from dataclasses import dataclass, field
from pathlib import Path

from lib.input.state import Button

logger = logging.getLogger("switch_pair")

PRESETS_DIR = Path(__file__).resolve().parents[2] / "presets"
BUILTIN_PRESETS = frozenset({"xbox", "playstation", "switch_pro"})

_WRITE_LOCK = threading.Lock()


def _preset_doc_path(name: str) -> tuple[str, Path]:
    """Validate an API-facing preset stem without importing the server
    package while this module itself is being initialised."""
    from lib.server.files import doc_path, validate_name

    clean_name = validate_name(name)
    return clean_name, doc_path(PRESETS_DIR, clean_name)


class PresetValidationError(ValueError):
    """A preset document failed semantic validation.

    ``path`` is the JSON path of the offending element, e.g.
    ``["buttons", "3"]``, mirroring ``MacroValidationError``.
    """

    def __init__(self, path: list[str | int], message: str):
        self.path = path
        where = "".join(
            f"[{p}]" if isinstance(p, int) else f".{p}" for p in path
        ).lstrip(".")
        super().__init__(f"{where or '<root>'}: {message}" if where else message)


@dataclass(frozen=True, slots=True)
class PresetConfig:
    """Resolved, ready-to-use controller mapping preset.

    All axis/button/hat indices are :mod:`pygame.joystick` indices on the
    physical gamepad. ``button_map`` maps digital buttons; ``trigger_map``
    maps analog trigger axes (treated as digital above a threshold).
    """

    name: str = "Default"
    rumble_enabled: bool = True
    button_map: dict[int, Button] = field(default_factory=dict)
    trigger_map: dict[int, Button] = field(default_factory=dict)
    left_stick: tuple[int, int] = (0, 1)
    right_stick: tuple[int, int] = (2, 3)
    dpad_hat: int | None = 0

    @classmethod
    def default(cls) -> PresetConfig:
        """Fallback preset matching the historical hardcoded Xbox defaults.

        Used when a named preset cannot be loaded so the controller remains
        usable.
        """
        return cls(
            name="Default",
            rumble_enabled=True,
            button_map={
                0: Button.B,
                1: Button.A,
                2: Button.Y,
                3: Button.X,
                4: Button.L,
                5: Button.R,
                6: Button.MINUS,
                7: Button.PLUS,
                8: Button.HOME,
                9: Button.STICK_L,
                10: Button.STICK_R,
            },
            trigger_map={4: Button.ZL, 5: Button.ZR},
            left_stick=(0, 1),
            right_stick=(2, 3),
            dpad_hat=0,
        )


def load_preset(source: str | Path) -> PresetConfig:
    """Load a preset by builtin name or filesystem path.

    ``source`` is matched against :data:`BUILTIN_PRESETS` first; on a hit
    the file is read from :data:`PRESETS_DIR`. Otherwise ``source`` is
    treated as a path to a JSON file. Raises :class:`FileNotFoundError`
    or :class:`ValueError` on problems.
    """
    path = _resolve_preset_path(source)
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise TypeError(f"Preset {path} must be a JSON object")
    return _build_preset(data)


def validate_preset(data: dict) -> PresetConfig:
    """Validate a parsed preset document and build its config.

    Raises :class:`PresetValidationError` (with a JSON path) on problems,
    mirroring :func:`lib.input.macro_source.validate_macro`.
    """
    if not isinstance(data, dict):
        raise PresetValidationError([], "must be a JSON object")
    if "name" in data and not isinstance(data["name"], str):
        raise PresetValidationError(["name"], "must be a string")
    if "rumble_enabled" in data and not isinstance(data["rumble_enabled"], bool):
        raise PresetValidationError(["rumble_enabled"], "must be a boolean")

    for key in ("buttons", "triggers"):
        raw = data.get(key) or {}
        if not isinstance(raw, dict):
            raise PresetValidationError([key], "must be an object")
        for idx, value in raw.items():
            path = [key, str(idx)]
            try:
                int(str(idx))
            except (TypeError, ValueError):
                raise PresetValidationError(path, "key must be an integer index")
            if int(str(idx)) < 0:
                raise PresetValidationError(path, "key must be non-negative")
            if not isinstance(value, str):
                raise PresetValidationError(path, "must map to a button name")
            try:
                Button[str(value).strip().upper()]
            except KeyError:
                valid = ", ".join(sorted(b.name for b in Button if b.name))
                raise PresetValidationError(
                    path, f"unknown button {value!r} (valid: {valid})"
                ) from None

    for key in ("left_stick", "right_stick"):
        raw = data.get(key) or {}
        if not isinstance(raw, dict):
            raise PresetValidationError([key], "must be an object")
        for axis in ("x_axis", "y_axis"):
            if axis in raw:
                value = raw[axis]
                if not isinstance(value, int) or isinstance(value, bool) or value < 0:
                    raise PresetValidationError(
                        [key, axis], "must be a non-negative integer axis index"
                    )

    dpad = data.get("dpad") or {}
    if not isinstance(dpad, dict):
        raise PresetValidationError(["dpad"], "must be an object")
    if "hat" in dpad and dpad["hat"] is not None:
        hat = dpad["hat"]
        if not isinstance(hat, int) or isinstance(hat, bool) or hat < 0:
            raise PresetValidationError(
                ["dpad", "hat"], "must be a non-negative integer or null"
            )

    return _build_preset(data)


def preset_name_is_builtin(name: str) -> bool:
    return name in BUILTIN_PRESETS


def read_preset_text(name: str) -> str:
    """Raw text of a preset by name (builtin or custom). Raises
    :class:`FileNotFoundError` when absent."""
    _, path = _preset_doc_path(name)
    return path.read_text(encoding="utf-8")


def save_preset_text(name: str, contents: str) -> None:
    """Atomically write a custom preset. Builtin names are refused."""
    name, path = _preset_doc_path(name)
    if preset_name_is_builtin(name):
        raise PermissionError(
            f"'{name}' is a built-in preset and cannot be overwritten; "
            f"duplicate it under a new name instead"
        )
    with _WRITE_LOCK:
        PRESETS_DIR.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".json.tmp")
        tmp.write_text(contents, encoding="utf-8")
        os.replace(tmp, path)


def delete_preset(name: str) -> None:
    name, path = _preset_doc_path(name)
    if preset_name_is_builtin(name):
        raise PermissionError(f"'{name}' is a built-in preset and cannot be deleted")
    if not path.is_file():
        raise FileNotFoundError(f"preset '{name}' does not exist")
    with _WRITE_LOCK:
        path.unlink()


def list_preset_infos() -> list[dict]:
    """Metadata for every available preset (builtins + customs)."""
    infos: dict[str, dict] = {}
    if PRESETS_DIR.is_dir():
        for path in sorted(PRESETS_DIR.glob("*.json")):
            if not path.is_file():
                continue
            filename = path.stem
            name = filename
            description = ""
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(data, dict):
                    name = str(data.get("name"))
                    description = str(data.get("description", ""))
            except (json.JSONDecodeError, OSError):
                description = "(unreadable)"
            infos[filename] = {
                "name": name,
                "filename": filename,
                "builtin": filename in BUILTIN_PRESETS,
                "description": description,
            }
    for filename in sorted(BUILTIN_PRESETS):
        infos.setdefault(
            filename,
            {
                "name": filename,
                "filename": filename,
                "builtin": True,
                "description": "",
            },
        )
    return [infos[k] for k in sorted(infos)]


def list_presets() -> list[str]:
    """Return sorted preset names: builtins plus any extra ``.json`` files
    discovered in the presets directory."""
    return [info["filename"] for info in list_preset_infos()]


def _resolve_preset_path(source: str | Path) -> Path:
    source = str(source).strip()
    if source in BUILTIN_PRESETS:
        return PRESETS_DIR / f"{source}.json"
    # Custom presets saved in the presets directory resolve by name too.
    by_name = PRESETS_DIR / f"{source}.json"
    if by_name.is_file():
        return by_name
    path = Path(source)
    if not path.is_file():
        raise FileNotFoundError(
            f"Preset not found: {source!r}. "
            f"Known builtins: {sorted(BUILTIN_PRESETS)}; "
            f"or provide a path to a JSON file."
        )
    return path


def _build_preset(data: dict) -> PresetConfig:
    name = str(data.get("name", "Unnamed"))
    rumble_enabled = bool(data.get("rumble_enabled", True))

    button_map = _parse_button_map(data.get("buttons") or {}, "buttons")
    trigger_map = _parse_button_map(data.get("triggers") or {}, "triggers")

    left = data.get("left_stick") or {}
    right = data.get("right_stick") or {}
    left_stick = (int(left.get("x_axis", 0)), int(left.get("y_axis", 1)))
    right_stick = (int(right.get("x_axis", 2)), int(right.get("y_axis", 3)))

    dpad = data.get("dpad") or {}
    dpad_hat_raw = dpad.get("hat", 0)
    dpad_hat = int(dpad_hat_raw) if dpad_hat_raw is not None else None

    return PresetConfig(
        name=name,
        rumble_enabled=rumble_enabled,
        button_map=button_map,
        trigger_map=trigger_map,
        left_stick=left_stick,
        right_stick=right_stick,
        dpad_hat=dpad_hat,
    )


def _parse_button_map(raw: dict, label: str) -> dict[int, Button]:
    """Convert a ``{"0": "B", ...}`` mapping to ``{0: Button.B}``.

    JSON keys are strings; they are coerced to ``int`` indices. Button
    values are resolved through the :class:`Button` enum by name.
    """
    result: dict[int, Button] = {}
    for key, value in raw.items():
        idx = int(key)
        button_name = str(value).strip().upper()
        try:
            result[idx] = Button[button_name]
        except KeyError:
            valid = ", ".join(sorted(b.name for b in Button if b.name))
            raise ValueError(
                f"Unknown button name {value!r} in preset '{label}' "
                f"(index {key}). Valid names: {valid}"
            ) from None
    return result
