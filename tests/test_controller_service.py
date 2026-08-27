from __future__ import annotations

import queue

from pygame import event

from lib.input.controller_service import ControllerInfo, ControllerService


def test_poll_without_hotplug_does_not_reprobe_active_joystick(monkeypatch):
    """Routine polling must not invalidate the active capture joystick."""
    service = ControllerService(queue.Queue())
    monkeypatch.setattr(event, "pump", lambda: None)
    monkeypatch.setattr(event, "get", lambda types: [])
    monkeypatch.setattr(
        service,
        "_refresh_controllers",
        lambda: (_ for _ in ()).throw(AssertionError("unexpected probe")),
    )

    service._pump_and_handle_hotplug()


def test_hotplug_stops_capture_before_enumeration_and_reselects(monkeypatch):
    """Hotplug enumeration must stop capture before probing and reopen it."""
    service = ControllerService(queue.Queue())
    controller = ControllerInfo("guid-1", 0, "Pad", 4, 10, 1)
    service._controllers = [controller]
    service._active_guid = controller.guid
    service._capture = object()  # Only its presence matters to this test.
    calls = []

    monkeypatch.setattr(event, "pump", lambda: None)
    monkeypatch.setattr(event, "get", lambda types: [object()])
    monkeypatch.setattr(service, "_stop_capture", lambda: calls.append("stop"))
    monkeypatch.setattr(
        service, "_refresh_controllers", lambda: calls.append("refresh") or False
    )
    monkeypatch.setattr(
        service, "_do_select", lambda ident: calls.append(("select", ident)) or controller
    )

    service._pump_and_handle_hotplug()

    assert calls == ["stop", "refresh", ("select", controller.guid)]
