import asyncio
import logging
import sys
from time import perf_counter

import bumble.logging
from bumble.device import Device
from bumble.hci import Address, HCI_Write_Default_Link_Policy_Settings_Command
from bumble.l2cap import ClassicChannelSpec
from bumble.pairing import PairingConfig, PairingDelegate
from bumble.transport import open_transport

from lib.controller import ControllerTypes
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


async def run_mainloop(protocol, interrupt_channel, incoming, stop_event):
    """Steady-state loop: process one Switch PDU per tick and emit reports.

    Caches the last report payload so we don't flood the Switch with
    identical packets (important on the "Change Grip/Order" menu), and
    sends a keepalive every 132 ticks (~1 s) regardless.
    """
    tick = 0
    cached = None
    duration_start = perf_counter()

    while not stop_event.is_set():
        if not interrupt_channel or interrupt_channel.state != interrupt_channel.State.OPEN:
            logger.warning("Interrupt channel no longer open")
            return

        # One Switch PDU per tick (non-blocking)
        try:
            reply = incoming.get_nowait()
        except asyncio.QueueEmpty:
            reply = None

        protocol.process_commands(reply)
        report = protocol.get_report()

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
            # The Switch may send HID control transactions (SET_PROTOCOL,
            # HANDSHAKE). They aren't required for the controller to
            # function, so we just observe them.
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
    if len(sys.argv) < 3:
        print("Usage: python main.py <device-config> <transport-spec> [bt-address]")
        print("example: python main.py pro_controller.json usb:0")
        print("         python main.py pro_controller.json usb:0 98:B6:E9:12:34:57")
        return

    setup_logging()

    if len(sys.argv) >= 4:
        bt_address = sys.argv[3]
    else:
        bt_address = "98:b6:e9:12:34:57"

    logger.info("=" * 60)
    logger.info("Pro Controller (Bumble) - Switch pairing")
    logger.info("=" * 60)

    async with await open_transport(sys.argv[2]) as hci_transport:
        device = Device.from_config_file_with_hci(
            sys.argv[1], hci_transport.source, hci_transport.sink
        )

        # Classic / HID service configuration
        device.classic_enabled = True
        device.public_address = Address(bt_address)
        device.class_of_device = DEVICE_CLASS_GAMEPAD
        device.discoverable = True
        device.connectable = True
        device.config.keystore = "JsonKeyStore"
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

        # Register the HID L2CAP servers once.
        # These persist across reconnects: a new Switch connection re-triggers the handler,
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

        logger.info(f"Powered on. address={device.public_address} name={device.name!r}")
        logger.info("Advertising as Pro Controller. Waiting for a Switch...")

        # Reconnect loop: each iteration is one full controller session.
        while True:
            state.reset_for_session()
            logger.info("Waiting for both HID channels to open...")
            await state.ctrl_ready.wait()
            await state.intr_ready.wait()

            interrupt_channel = state.intr_channel
            if interrupt_channel is None:
                logger.warning("Interrupt channel missing; retrying.")
                continue

            logger.info("Both HID channels open; starting controller session.")
            protocol = ControllerProtocol(
                ControllerTypes.PRO_CONTROLLER, bt_address
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
                )
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Session ended with an error")
            else:
                logger.info("Session ended cleanly")

            logger.info("Re-listening for a new Switch connection...")


bumble.logging.setup_basic_logging("info")
asyncio.run(main())
