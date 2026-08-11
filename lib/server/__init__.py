"""
Starlette application hosting the built frontend and the macro
WebSocke.

Routes (ordered WS/REST before static so the catch-all SPA mount doesn't
shadow them)::

    /ws                       WebSocket: macro command channel
    GET  /api/config          current config as JSON
    PATCH /api/config         merge-update config (persists)
    GET  /api/control-mode    {"mode": ..., "macro": {...}|null}
    PUT  /api/control-mode    {"mode": "manual"|"macro"}
    GET  /api/macros          {"names": [...]}
    /                        StaticFiles(frontend/dist, html=True)
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.routing import Mount, Route, WebSocketRoute
from starlette.staticfiles import StaticFiles
from starlette.websockets import WebSocket, WebSocketDisconnect, WebSocketState

from lib.config import ConfigStore
from lib.input.manager import InputManager, state_from_event
from lib.server.protocol import (
    MacroCancel,
    MacroPause,
    MacroResume,
    MacroStartByName,
    MacroStartInline,
    ProtocolError,
    error_frame,
    parse_message,
    status_frame,
)

logger = logging.getLogger("switch_pair")


# ----------------------------------------------------------- WebSocket route


async def macro_ws_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    manager: InputManager = websocket.app.state.manager
    status_q = manager.subscribe()

    initial = manager.status()
    await websocket.send_text(status_frame(initial["mode"], initial["macro"]))

    try:
        while True:
            # If a previous iteration observed a disconnect (e.g. via a
            # failed send), stop now -- ``receive()`` would raise
            # RuntimeError on an already-disconnected socket.
            if websocket.application_state != WebSocketState.CONNECTED:
                break
            receive_task = asyncio.create_task(websocket.receive())
            status_task = asyncio.create_task(status_q.get())
            done, pending = await asyncio.wait(
                {receive_task, status_task},
                return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()
            if pending:
                # Await cancellations so the tasks don't warn on GC.
                await asyncio.gather(*pending, return_exceptions=True)

            if receive_task in done:
                try:
                    event = receive_task.result()
                except WebSocketDisconnect:
                    break
                text = event.get("text") or ""
                if not text:
                    continue
                try:
                    await _dispatch_ws(text, websocket, manager)
                except ProtocolError as e:
                    await websocket.send_text(error_frame(str(e)))
                except WebSocketDisconnect:
                    break
                except Exception as e:
                    logger.exception("error handling WS message")
                    try:
                        await websocket.send_text(
                            error_frame("internal error", detail=str(e))
                        )
                    except WebSocketDisconnect:
                        break

            if status_task in done:
                payload = status_task.result()
                try:
                    await websocket.send_text(
                        status_frame(payload["mode"], payload["macro"])
                    )
                except WebSocketDisconnect:
                    break
    except WebSocketDisconnect:
        pass
    finally:
        manager.unsubscribe(status_q)


async def _dispatch_ws(text: str, websocket: WebSocket, manager: InputManager) -> None:
    msg = parse_message(text)

    if hasattr(msg, "action"):  # EventMessage
        accepted = manager.submit_state(state_from_event(msg.action))
        if not accepted:
            await websocket.send_text(
                error_frame("manual input disabled while macro running")
            )
        return

    if hasattr(msg, "buttons"):  # StateMessage
        accepted = manager.submit_state(msg.to_state())
        if not accepted:
            await websocket.send_text(
                error_frame("manual input disabled while macro running")
            )
        return

    if isinstance(msg, MacroStartInline):
        manager.start_macro(msg.macro)
        return
    if isinstance(msg, MacroStartByName):
        try:
            manager.start_macro_by_name(msg.name)
        except (FileNotFoundError, ValueError) as e:
            await websocket.send_text(error_frame(f"could not load macro: {e}"))
        return
    if isinstance(msg, MacroCancel):
        manager.cancel_macro()
        return
    if isinstance(msg, MacroPause):
        manager.pause_macro()
        return
    if isinstance(msg, MacroResume):
        manager.resume_macro()
        return


# -------------------------------------------------------------- REST routes


async def config_get(request: Request) -> Response:
    store: ConfigStore = request.app.state.config_store
    return JSONResponse(store.snapshot())


async def config_patch(request: Request) -> Response:
    store: ConfigStore = request.app.state.config_store
    try:
        body = await request.json()
    except ValueError:
        return JSONResponse({"error": "invalid JSON body"}, status_code=400)
    if not isinstance(body, dict):
        return JSONResponse({"error": "expected a JSON object"}, status_code=400)
    changed = store.update(body)
    return JSONResponse({"changed": changed, "config": store.snapshot()})


async def control_mode_get(request: Request) -> Response:
    manager: InputManager = request.app.state.manager
    return JSONResponse(manager.status())


async def control_mode_put(request: Request) -> Response:
    manager: InputManager = request.app.state.manager
    try:
        body = await request.json()
    except ValueError:
        return JSONResponse({"error": "invalid JSON body"}, status_code=400)
    mode = body.get("mode") if isinstance(body, dict) else None
    if mode not in ("manual", "macro"):
        return JSONResponse(
            {"error": "mode must be 'manual' or 'macro'"}, status_code=400
        )
    manager.set_mode(mode)
    return JSONResponse(manager.status())


async def macros_list(request: Request) -> Response:
    manager: InputManager = request.app.state.manager
    return JSONResponse({"names": manager.list_macro_files()})


# ------------------------------------------------------------------ factory


async def _frontend_not_built(request: Request) -> Response:
    return JSONResponse(
        {
            "error": "frontend not built",
            "detail": "Run `pnpm build` in the frontend/ directory, then restart.",
        },
        status_code=503,
    )


def build_app(
    manager: InputManager,
    config_store: ConfigStore,
    frontend_dist: Path,
) -> Starlette:
    """Construct the Starlette application.

    ``frontend_dist`` is the React production build directory. If it
    doesn't exist (frontend not yet built) we fall back to a stub route
    so the WebSocket and REST API remain usable for testing.
    """
    routes = [
        WebSocketRoute("/ws", macro_ws_endpoint),
        Route("/api/config", config_get, methods=["GET"]),
        Route("/api/config", config_patch, methods=["PATCH"]),
        Route("/api/control-mode", control_mode_get, methods=["GET"]),
        Route("/api/control-mode", control_mode_put, methods=["PUT"]),
        Route("/api/macros", macros_list, methods=["GET"]),
    ]

    if frontend_dist.exists() and (frontend_dist / "index.html").exists():
        routes.append(
            Mount(
                "/",
                app=StaticFiles(directory=str(frontend_dist), html=True),
                name="frontend",
            )
        )
        logger.info(f"Serving frontend from {frontend_dist}")
    else:
        routes.append(Route("/", _frontend_not_built, methods=["GET"]))
        logger.warning(
            f"Frontend build not found at {frontend_dist}; "
            f"serving API only. Run `pnpm build` in frontend/."
        )

    app = Starlette(routes=routes)
    app.state.manager = manager
    app.state.config_store = config_store
    return app
