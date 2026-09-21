# Implementation Plan: Macro UI, Controller Support, Presets, Diffs Editor

Post-POC fleshing-out plan covering:

1. Macro running via the WebSocket (frontend)
2. Proper controller support (backend + frontend): device selection, preset switching, custom presets
3. Pierre Diffs (`@pierre/diffs`) as the primary JSON editor for macros and presets

## Current state

**Backend** (Python, Starlette + Bumble, shares one asyncio loop):

- `/ws` protocol (`lib/server/protocol.py`) already supports: `state`/`event` manual input,
  `macro` ops (`start` inline or by-name, `cancel`, `pause`, `resume`), and outbound
  `status`/`error` frames broadcast on every mode/macro transition.
- REST: `GET/PATCH /api/config`, `GET/PUT /api/control-mode`, `GET /api/macros` (names only).
- `InputManager` (`lib/input/manager.py`) arbitrates `manual` vs `macro` mode, owns macro
  lifecycle, pauses pygame threads during macros, broadcasts status to WS subscribers.
- Physical input: `PygameInputThread` (`lib/input/pygame_source.py`) — device index fixed at
  construction from `--input controller:<idx>`; no enumeration API, no runtime switching,
  no hotplug handling.
- Presets (`lib/input/presets.py`): builtin `xbox|playstation|switch_pro` in `presets/`,
  selected via config or `--preset`; loaded **once at startup**, immutable at runtime.
- No CRUD endpoints for macros or presets.

**Frontend** (React 19 + Vite + TanStack Router + Tailwind 4 + Base UI + Phosphor + Effect):

- Webcam viewer POC only (`src/components/webcam-viewer.tsx` — good UX/convention reference).
- No WS client, no macro/controller/preset UI.

## Architecture principles

- **Modularity (per user requirement):** every feature ships as a self-contained
  *hook + panel component* pair under `src/components/<feature>/` with zero route coupling.
  Route files are thin compositions. Panels accept layout-neutral props so they can later be
  embedded in a settings dialog without changes.
- **Transport split:** WebSocket = runtime operations + push (macro ops, status,
  controller/preset change events). REST = CRUD + persistence (file read/write, config).
- **Single pygame owner:** all pygame/SDL calls (enumeration, polling, hotplug events) live
  on one daemon thread (`ControllerService`); API handlers marshal requests to it. pygame is
  not safe to call cross-thread — this is the linchchain of Phase 4.
- **Diffs editor is generic:** one `JsonEditor` component wraps `@pierre/diffs` and is
  parameterized by (validator, save, load). Macros and presets reuse it verbatim.
- **Conventions:** frontend lib modules use `effect` (mirror `src/lib/webcam.ts`); Python
  follows existing module layout; `ruff` / `oxlint` / `tsc -b` must stay clean.

---

## Phase 1 — Frontend foundations (WS + API clients, app shell)

**Frontend**

- `src/lib/types.ts` — shared TS types mirroring `lib/server/protocol.py`:
  `ButtonName`, `MacroAction`, `MacroDoc`, `PresetDoc`, `ControllerInfo`, `StatusFrame`,
  `ErrorFrame`, `ControllersFrame`, outbound message types.
- `src/lib/ws.ts` — reconnecting WS client:
  - connect to relative `/ws` (works in dev via Vite proxy and in prod), auto-reconnect with
    backoff, inbound message subscriber registry, typed `send()` (drops + flags when closed).
  - Exposes connection state (`connecting | open | closed`) for a status badge.
- `src/hooks/use-controller-socket.ts` — React binding: singleton socket + context provider
  (`ConnectionProvider`) in `__root.tsx`; `useConnectionStatus()`, `useLatestStatus()`.
- `src/lib/api.ts` — REST client with Effect wrappers (pattern from `webcam.ts`):
  config get/patch, macros list/get/put/delete, controllers list/select,
  presets list/get/put/delete/activate.
- `src/components/app-shell.tsx` — nav shell in `__root.tsx` (`/`, `/macros`, `/presets`,
  `/controller`) + connection badge. Thin; panels do the work.

**Verify:** dev server connects to backend, badge shows open/closed on backend restart.

## Phase 2 — Macro running via WebSocket (frontend; backend already done)

**Frontend**

- `src/hooks/use-macro-runner.ts` — derives `{mode, macro: {name, state}}` from `status`
  frames; commands `startByName(name)`, `startInline(macroDoc)`, `pause()`, `resume()`,
  `cancel()`; surfaces `error` frames as toasts/return values.
- `src/components/macro/macro-run-panel.tsx`:
  - Macro list from `GET /api/macros`; Run button per row.
  - Global controls: Pause/Resume/Stop, enabled per macro state.
  - Mode badge (`manual` / `macro` + macro name); disabled manual-input hint while macro runs.
- `src/routes/macros.tsx` — composes `MacroRunPanel` (editor arrives in Phase 3).

**Verify:** run `example.json` from UI; two tabs see identical status transitions;
pause/resume/cancel all reflected; error frame shown when starting unknown macro.

## Phase 3 — Macro file CRUD + Diffs JSON editor

**Backend**

- `lib/server/files.py` (new) — safe JSON-doc CRUD shared by macros and presets:
  - Name validation: `^[A-Za-z0-9][A-Za-z0-9 _-]*$`, resolves inside the owning dir only
    (no traversal, no leading dot); names are file stems.
  - Atomic writes (tmp + `os.replace`, matching `Config.save` style).
- `lib/input/macro_source.py`: extract `validate_macro(dict)` from `load_macro`; extend to a
  recursive walker (checks `press|release|wait|stick|loop` shapes, button names via
  `Button.by_name`, numeric ranges). Errors carry the JSON path / action index so the editor
  can map them to markers.
- Routes (in `lib/server/__init__.py`):
  - `GET /api/macros/{name}` → macro JSON or 404
  - `PUT /api/macros/{name}` → validate → atomic write; 400 `{error, detail}` on bad JSON
    (includes `line`/`col` from `JSONDecodeError`) or semantic failure
  - `DELETE /api/macros/{name}` → 409 if currently running

**Frontend**

- Add dependency: `pnpm add @pierre/diffs` (pin exact version — edit mode is experimental).
- `src/components/json-editor/json-editor.tsx` — **the** Diffs integration (reused by presets):
  - `File` from `@pierre/diffs` rendered inside a permanently-mounted `EditProvider`;
    `edit` prop toggles Review/Edit.
  - `editorOptions` held stable via `useMemo`/module scope (docs: editors are cached by
    options identity); `persistState: true` + unique `cacheKey` (`macro:<name>` /
    `preset:<name>`) so edits/history survive file switches.
  - Lazy `import('@pierre/diffs/edit')` on first edit toggle to keep the main bundle small.
  - `onAttach` → keep an imperative editor ref (undo/redo toolbar, `setMarkers`).
  - `onChange` → dirty tracking; client-side `JSON.parse` pre-flight.
  - Validation failures → `editor.setMarkers([{start, end, severity: 'error', message}])`
    from server 400 detail (parse errors: line/col; semantic errors: nearest action line).
  - Toolbar: Save, Format (2-space re-stringify), Revert; unsaved-changes guard.
- `src/components/macro/macro-editor.tsx` — macro wrapper over `JsonEditor`:
  - **Run** sends `{"type":"macro","op":"start","macro": <parsed buffer>}` — runs unsaved
    edits (backend already supports inline start).
  - **Save & Run** = PUT then start-by-name. New-macro flow (name prompt → blank template).
  - Delete with confirm (blocked while running).
- `src/routes/macros.tsx` — list + editor side-by-side (run panel from Phase 2 on top).

**Verify:** curl PUT valid/invalid macros (400 details well-formed); markers render and
clear; undo/redo works; switching files preserves edits; Run executes unsaved buffer.

## Phase 4 — Controller enumeration + selection

**Backend**

- `lib/input/controller_service.py` (new) — single owner of pygame on one daemon thread:
  - Mailbox pattern: `queue.Queue` of `(op, payload, reply_future)`; results marshaled back
    via `loop.call_soon_threadsafe`. Ops: `enumerate`, `select`, `shutdown`.
  - `enumerate()`: init pygame once; pump events; report
    `[{index, guid, name, axes, buttons, hats}]` (SDL GUID = stable device identity).
  - `select(guid | index)`: stop current capture thread, start a new one on the device
    (refactor `PygameInputThread` to accept a GUID-or-index ident + `PresetConfig`; it stays
    the polling implementation, the service owns lifecycle).
  - Hotplug: consume `JOYDEVICEADDED`/`JOYDEVICEREMOVED` while pumping → re-enumerate →
    notify manager → WS broadcast; if active device vanished, fall back to first available
    and emit a warning status.
- `InputManager` extensions:
  - `controllers_status()` → `{controllers: [...], active_guid}`; `select_controller(ident)`.
  - Extend the subscriber broadcast with a `controllers` frame (new outbound frame in
    `protocol.py`: `{"type": "controllers", "controllers": [...], "active": "<guid>"}`),
    sent on connect and on change/hotplug. Macro pause/resume still applies to the capture
    thread via existing `pause()`/`resume()`.
- Config: add `controller_guid: str = ""` (persist selection; fallback chain GUID → name →
  index at boot when the saved GUID is absent).
- REST: `GET /api/controllers`; `PUT /api/controllers/active` `{guid}` (or `{index}`) →
  select + persist.
- `main.py`: when `input_specs` contains a `controller` spec, start `ControllerService`
  instead of a bare `PygameInputThread` (spec's `<idx>`, if given, seeds initial selection).
  `manager.attach_pygame_threads` re-targets to the service.

**Frontend**

- `src/hooks/use-controllers.ts` — list + active from WS frames; refresh via REST fallback.
- `src/components/controller/controller-picker.tsx` — select dropdown mirroring
  `webcam-viewer` UX (CaretDown select, plug/unplug auto-update, name + axes/buttons count).
- `src/components/controller/controller-panel.tsx` — picker + active preset summary + preset
  picker mount point (Phase 5); designed to drop into a settings dialog later.
- `src/routes/controller.tsx` — composes the panel.

**Verify:** plug/unplug updates list via WS with no refresh; switching devices keeps reports
flowing (watch `switch_packets.log`); restart app → same controller re-selected; selecting
mid-macro is refused or deferred (pick one: refuse while `mode == "macro"`).

## Phase 5 — Preset switching + custom presets

**Backend**

- `lib/input/presets.py`:
  - Public `validate_preset(dict) -> PresetConfig` (expose `_build_preset` with friendly
    `ValueError` messages including the offending key).
  - `save_preset(name, data)` / `delete_preset(name)` — atomic write / remove under
    `presets/`; **builtin names refused** (403 at the route layer).
  - `list_presets()` → `[{name, builtin, description}]` (scan dir; read `description`).
- Runtime application:
  - `InputManager.apply_preset(source)` → load + hand to `ControllerService` (restart
    capture with new `PresetConfig`, preserving active device); refuse while a macro runs;
    emit status.
  - Hook `PATCH /api/config`: a changed `preset` value triggers `apply_preset` so the config
    store stays the single source of truth.
- Routes:
  - `GET /api/presets`; `GET /api/presets/{name}`
  - `PUT /api/presets/{name}` — validate → save; 403 builtin; 400 invalid
  - `DELETE /api/presets/{name}` — 403 builtin; 409 if active
  - `POST /api/presets/{name}/activate` — convenience (= PATCH config + apply)
- WS: include `preset` in the `controllers`/status broadcast on change.

**Frontend**

- `src/components/preset/preset-picker.tsx` — dropdown (name, builtin badge); selecting a
  custom preset activates it.
- `src/components/preset/preset-editor.tsx` — `JsonEditor` reused:
  - Builtins render read-only (Review mode) with **Duplicate…** (name prompt → GET → PUT
    custom copy → open editable).
  - Customs fully editable: Save (PUT), Activate, Delete (blocked when active).
- `src/routes/presets.tsx` — picker + editor.

**Verify:** duplicate `xbox` → tweak mapping → activate → physical button mapping changes
live on hardware; builtin writes rejected; deleting active preset rejected; restart
persists selection; validation errors surface as markers.

## Phase 6 — Docs, tests, polish

- README: new REST routes, new WS frames, preset/macro editing workflow, frontend feature
  pages, `@pierre/diffs` attribution note.
- Tests (add `pytest` dev dep; pure-logic + Starlette `TestClient`, no pygame/hardware):
  - `protocol.py` parse round-trips + malformed frames
  - `validate_macro` / `validate_preset` (nested loops, bad buttons, bad indices)
  - safe-name validation + path-traversal refusal
  - REST endpoints with a stubbed manager
- Frontend: `oxlint` + `tsc -b` + `pnpm build` clean.
- Polish candidates: toast system for WS errors, `JsonEditor` JSON-schema-aware autocomplete
  (future), keymap help.

## Sequencing & rationale

| Order | Phase | Why here |
|---|---|---|
| 1 | Foundations | Everything needs the WS/REST clients + shell |
| 2 | Macro running UI | Headline ask; backend already complete — frontend only |
| 3 | Macro CRUD + editor | Editor needs CRUD; unlocks presets editor too |
| 4 | Controller service | Refactor required before presets can live-apply |
| 5 | Presets | Builds on the service restart machinery from Phase 4 |
| 6 | Docs/tests | Continuous, but formally closed out here |

## Risks & open items

- **Diffs edit mode is experimental** (upstream warning): pin the exact version; the editor
  is isolated behind one component so an API change is a one-file fix.
- **pygame thread affinity**: enumeration from the API thread without the service refactor
  would be unsafe — Phase 4 must not be shortcut.
- **GUID stability**: SDL GUIDs are stable per-device per-driver but can change with driver
  updates; keep name fallback in the resolution chain.
- **WS send-while-disconnected**: choose "drop + disable UI" (simplest, no stale ops).
- **Concurrent writers**: two tabs PUTting the same macro — last write wins (acceptable;
  note in UI via dirty-check reload before save).
- Editor toolbar scope: start minimal (Save/Format/Revert/undo-redo); markers and find/
  replace come free with edit mode.
