import argparse
import asyncio
import logging
import queue
from time import perf_counter

import bumble.logging
from bumble.device import Device
from bumble.hci import Address, HCI_Write_Default_Link_Policy_Settings_Command
from bumble.l2cap import ClassicChannelSpec
from bumble.pairing import PairingConfig, PairingDelegate
from bumble.transport import open_transport

from lib.controller import ControllerTypes
from lib.input import NEUTRAL, apply_to_protocol, parse_rumble
from lib.input.macro_source import MacroPlayerThread, load_macro
from lib.input.pygame_source import PygameInputThread
from lib.input.state import ControllerState
from lib.sdp_records import DEVICE_CLASS_GAMEPAD, sdp_record
from lib.switch_protocol import ControllerProtocol

HID_CONTROL_PSM = 0x0011
HID_INTERRUPT_PSM = 0x0013
TICK_RATE_HZ = 132

logger = logging.getLogger("switch_pair")


def setup_logging():
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)

    file_handler = logging.FileHandler("switch_packets.log")
    file_handler.setLevel(logging.DEBUG)

    formatter = logging.Formatter("%(asctime)s - %(message)s")
    console_handler.setFormatter(formatter)
    file_handler.setFormatter(formatter)

    logger.setLevel(logging.DEBUG)
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)


def build_input_sources(specs, command_queue):
    """Construct (not yet start) the daemon input threads for each --input spec.

    Spec formats:
      * ``controller``              -> pygame gamepad reader
      * ``controller:<index>``      -> pygame gamepad at a specific index
      * ``macro:<path>``            -> JSON macro player
    """
    threads = []
    for spec in specs:
        spec = spec.strip()
        if spec == "controller" or spec.startswith("controller:"):
            idx = 0
            if ":" in spec:
                idx = int(spec.split(":", 1)[1])
            threads.append(
                PygameInputThread(command_queue, device_index=idx)
            )
        elif spec.startswith("macro:"):
            path = spec.split(":", 1)[1]
            macro = load_macro(path)
            threads.append(MacroPlayerThread(macro, command_queue))
        else:
            raise ValueError(f"Unknown --input spec: {spec!r}")
    return threads


async def run_pairing_handshake(protocol, interrupt_channel, incoming):
    """Exchange subcommands with the Switch until the handshake completes.

    The Switch considers the controller ready once vibration has been
    enabled and a player number has been assigned. Mirrors the proven
    flow in nxbt_bumble's ControllerServer._run_pairing_handshake.
    """
    received_first_message = False
    while True:
        try:
            reply = incoming.get_nowait()
        except asyncio.QueueEmpty:
            reply = None

        if reply:
            received_first_message = True
            logger.debug(f"Switch -> {reply.hex()}")

        protocol.process_commands(reply)
        report = protocol.get_report()
        if report:
            logger.debug(f"Controller -> {report.hex()}")
            interrupt_channel.send_pdu(report)

        if (
            reply
            and len(reply) > 45
            and protocol.vibration_enabled
            and protocol.player_number
        ):
            logger.info(
                f"Handshake complete (player {protocol.player_number})"
            )
            return

        # Before the Switch has spoken, poll slowly to avoid flooding;
        # once it starts talking, respond at ~15 Hz.
        if not received_first_message:
            await asyncio.sleep(1)
        else:
            await asyncio.sleep(1 / 15)


async def run_mainloop(
    protocol, interrupt_channel, incoming, stop_event, command_queue
):
    """Steady-state loop: apply the latest controller input, process one
    Switch PDU per tick, decode rumble, and emit reports.

    Caches the last report payload so we don't flood the Switch with
    identical packets (important on the "Change Grip/Order" menu), and
    sends a keepalive every 132 ticks (~1 s) regardless.
    """
    tick = 0
    cached = None
    latest_state: ControllerState = NEUTRAL
    last_rumble = None
    duration_start = perf_counter()

    while not stop_event.is_set():
        if not interrupt_channel or interrupt_channel.state != interrupt_channel.State.OPEN:
            logger.warning("Interrupt channel no longer open")
            return

        # Pull the latest input state from the command queue (latest-wins).
        # Held buttons/sticks persist across ticks when no new state arrives.
        drained = False
        while True:
            try:
                latest_state = command_queue.get_nowait()
                drained = True
            except queue.Empty:
                break

        # One Switch PDU per tick (non-blocking)
        try:
            reply = incoming.get_nowait()
        except asyncio.QueueEmpty:
            reply = None

        protocol.process_commands(reply)

        # Apply the latest input state (buttons + sticks) to the report.
        apply_to_protocol(protocol, latest_state)

        report = protocol.get_report()

        # Decode rumble from the Switch packet and log changes only.
        if reply:
            rumble = parse_rumble(reply)
            if rumble is not None:
                sig = (
                    round(rumble.left.frequency_hz),
                    round(rumble.left.amplitude, 3),
                    round(rumble.right.frequency_hz),
                    round(rumble.right.amplitude, 3),
                )
                if sig != last_rumble:
                    last_rumble = sig
                    logger.info(
                        f"Rumble: L={rumble.left.frequency_hz:.0f}Hz@"
                        f"{rumble.left.amplitude:.2f} "
                        f"R={rumble.right.frequency_hz:.0f}Hz@"
                        f"{rumble.right.amplitude:.2f}"
                    )

        try:
            if report[3:] != cached:
                interrupt_channel.send_pdu(report)
                cached = report[3:]
            elif tick >= TICK_RATE_HZ:
                interrupt_channel.send_pdu(report)
                tick = 0
        except Exception as e:
            logger.warning(f"Failed to send report: {e}")
            return

        tick += 1

        # Maintain the target tick rate, accounting for processing time.
        duration_end = perf_counter()
        elapsed = duration_end - duration_start
        duration_start = duration_end
        sleep_time = max(0.0, 1 / TICK_RATE_HZ - elapsed)
        await asyncio.sleep(sleep_time)


class SessionState:
    """Mutable state shared between the L2CAP callbacks and the session loop."""

    def __init__(self):
        self.ctrl_channel = None
        self.intr_channel = None
        self.incoming = asyncio.Queue()
        self.ctrl_ready = asyncio.Event()
        self.intr_ready = asyncio.Event()
        self.session_stop = asyncio.Event()

    def reset_for_session(self):
        self.ctrl_channel = None
        self.intr_channel = None
        self.ctrl_ready.clear()
        self.intr_ready.clear()
        self.session_stop.clear()
        while not self.incoming.empty():
            try:
                self.incoming.get_nowait()
            except asyncio.QueueEmpty:
                break


def make_l2cap_handler(psm, state):
    """Build an L2CAP server handler for a given PSM."""

    def on_open():
        if psm == HID_CONTROL_PSM:
            logger.info("HID Control channel opened")
            state.ctrl_ready.set()
        else:
            logger.info("HID Interrupt channel opened")
            state.intr_ready.set()

    def on_close():
        if psm == HID_INTERRUPT_PSM:
            logger.warning("HID Interrupt channel closed")
            state.intr_ready.clear()
            state.session_stop.set()
        else:
            logger.warning("HID Control channel closed")

    def handler(channel):
        logger.info(f"Incoming L2CAP connection on PSM 0x{psm:04X}")
        if psm == HID_CONTROL_PSM:
            state.ctrl_channel = channel
            # The Switch may send HID control transactions (SET_PROTOCOL, HANDSHAKE).
            # They aren't required, so we just observe them.
            channel.sink = lambda pdu: logger.debug(
                f"Control PDU (ignored): {pdu.hex() if isinstance(pdu, bytes) else pdu}"
            )
        else:
            state.intr_channel = channel
            channel.sink = lambda pdu: state.incoming.put_nowait(pdu)

        channel.on("open", on_open)
        channel.on("close", on_close)

        # The channel may already be OPEN by the time the handler runs.
        if channel.state == channel.State.OPEN:
            on_open()

    return handler


async def main():
    parser = argparse.ArgumentParser(
        description="Pro Controller (Bumble) for Nintendo Switch"
    )
    parser.add_argument("device_config", help="Bumble device config JSON")
    parser.add_argument("transport_spec", help="e.g. usb:0")
    parser.add_argument(
        "bt_address",
        nargs="?",
        default="98:b6:e9:12:34:57",
        help="controller Bluetooth address",
    )
    parser.add_argument(
        "--input",
        action="append",
        default=[],
        metavar="controller|controller:<idx>|macro:<path>",
        help="enable an input source (may be repeated)",
    )
    args = parser.parse_args()

    setup_logging()

    logger.info("=" * 60)
    logger.info("Pro Controller (Bumble) - Switch pairing")
    logger.info("=" * 60)

    # Shared, thread-safe command queue. Input-source threads are producers;
    # the asyncio main loop is the consumer.
    command_queue: queue.Queue[ControllerState] = queue.Queue()
    input_threads = build_input_sources(args.input, command_queue)

    async with await open_transport(args.transport_spec) as hci_transport:
        device = Device.from_config_file_with_hci(
            args.device_config, hci_transport.source, hci_transport.sink
        )

        # Classic / HID service configuration
        device.classic_enabled = True
        device.public_address = Address(args.bt_address)
        device.class_of_device = DEVICE_CLASS_GAMEPAD
        device.discoverable = True
        device.connectable = True
        device.pairing_config_factory = lambda _: PairingConfig(
            sc=True,
            mitm=False,
            bonding=True,
            delegate=PairingDelegate(
                io_capability=PairingDelegate.IoCapability.NO_OUTPUT_NO_INPUT
            ),
        )
        device.sdp_service_records = sdp_record()

        state = SessionState()

        # Register the HID L2CAP servers once. They persist across
        # reconnects: a new Switch connection re-triggers the handler,
        # re-points the channel references, and re-arms the ready events.
        device.create_l2cap_server(
            spec=ClassicChannelSpec(psm=HID_CONTROL_PSM),
            handler=make_l2cap_handler(HID_CONTROL_PSM, state),
        )
        device.create_l2cap_server(
            spec=ClassicChannelSpec(psm=HID_INTERRUPT_PSM),
            handler=make_l2cap_handler(HID_INTERRUPT_PSM, state),
        )

        await device.power_on()
        # Enable authentication + encryption + secure connections policy.
        await device.send_command(
            HCI_Write_Default_Link_Policy_Settings_Command(
                default_link_policy_settings=0x0005
            )
        )

        logger.info(
            f"Powered on. address={device.public_address} name={device.name!r}"
        )
        logger.info("Advertising as Pro Controller. Waiting for a Switch...")

        # Start input sources now that the radio is up. They are daemon
        # threads; they keep producing states whether or not a session
        # is active, and the main loop drains stale entries per session.
        for t in input_threads:
            t.start()
            logger.info(f"Started input source: {t.name}")

        try:
            # Reconnect loop: each iteration is one full controller session.
            while True:
                state.reset_for_session()
                # Drop any stale input that accumulated before this session.
                while not command_queue.empty():
                    try:
                        command_queue.get_nowait()
                    except queue.Empty:
                        break

                logger.info("Waiting for both HID channels to open...")
                await state.ctrl_ready.wait()
                await state.intr_ready.wait()

                interrupt_channel = state.intr_channel
                if interrupt_channel is None:
                    logger.warning("Interrupt channel missing; retrying.")
                    continue

                logger.info("Both HID channels open; starting controller session.")
                protocol = ControllerProtocol(
                    ControllerTypes.PRO_CONTROLLER, args.bt_address
                )

                try:
                    await run_pairing_handshake(
                        protocol, interrupt_channel, state.incoming
                    )
                    await run_mainloop(
                        protocol,
                        interrupt_channel,
                        state.incoming,
                        state.session_stop,
                        command_queue,
                    )
                except asyncio.CancelledError:
                    raise
                except Exception:
                    logger.exception("Session ended with an error")
                else:
                    logger.info("Session ended cleanly")

                logger.info("Re-listening for a new Switch connection...")
        finally:
            for t in input_threads:
                t.stop()


bumble.logging.setup_basic_logging("info")
asyncio.run(main())
