import asyncio
import logging
import sys

import bumble.logging
from bumble.device import Device
from bumble.hci import Address
from bumble.hid import Device as HID_Device
from bumble.l2cap import ClassicChannelSpec
from bumble.transport import open_transport

from controller import ControllerTypes
from sdp_records import DEVICE_CLASS_GAMEPAD, sdp_record
from switch_hid import SwitchHIDSession
from switch_protocol import ControllerProtocol


def setup_logging():
    """Setup logging to console and file"""
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)

    file_handler = logging.FileHandler("switch_packets.log")
    file_handler.setLevel(logging.DEBUG)

    formatter = logging.Formatter("%(asctime)s - %(message)s")
    console_handler.setFormatter(formatter)
    file_handler.setFormatter(formatter)

    logger = logging.getLogger("switch_pair")
    logger.setLevel(logging.DEBUG)
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)

    return logger


def format_switch_msg(data: bytes, direction: str) -> str:
    """Format Switch packet for logging"""
    if len(data) < 11:
        return f"{direction}: Too short ({len(data)} bytes)"

    payload = " ".join(f"{b:02X}" for b in data[:11])
    subcmd = ""

    if len(data) > 11:
        subcmd_id = data[11]
        subcmd = f"| Sub: {subcmd_id:02X}"
        if len(data) > 12:
            subcmd_data = " ".join(f"{b:02X}" for b in data[12:])
            subcmd += f" {subcmd_data}"

    return f"[{direction}] Payload: {payload} {subcmd}"


def reverse_mac_to_little_endian(mac: str) -> str:
    parts = mac.split(":")
    if len(parts) != 6:
        raise ValueError("Invalid MAC address format")

    return ":".join(reversed(parts))


async def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: python switch_pair.py <device-config> <transport-spec>")
        print("example: python switch_pair.py pro_controller.json usb:0")
        print("")
        print("Press Ctrl+C to exit")
        return

    logger = setup_logging()

    print("=" * 60)
    print("Pro Controller Switch Pairing POC")
    print("=" * 60)
    print("")

    if len(sys.argv) == 4:
        bt_address = sys.argv[3]
    else:
        bt_address = "98:b6:e9:12:34:57"

    protocol = ControllerProtocol(
        ControllerTypes.PRO_CONTROLLER, reverse_mac_to_little_endian(bt_address)
    )
    # session = SwitchHIDSession(protocol)

    received_first_message = False

    def on_hid_data_callback(pdu: bytes):
        nonlocal received_first_message

        packet_log = format_switch_msg(pdu, "RX")
        logger.debug(packet_log)

        # Track when we receive first actual Switch message
        if pdu is not None:
            print("RECEIVED SWITCH MESSAGE")
            received_first_message = True

        if len(pdu) > 40:
            print(
                f" [RX] Switch command: {' '.join((f'{b:02x}' for b in pdu)).upper()}"
            )

        # Process Switch command and generate immediate response
        protocol.process_commands(pdu)
        report = protocol.get_report_no_clear()

        if len(report) > 1:
            tx_log = format_switch_msg(report, "TX")
            hid_device.send_data(report)
            logger.debug(tx_log)
            if len(report) > 20:
                print(f"  [TX] Response sent ({len(report)} bytes)")

    async with await open_transport(sys.argv[2]) as hci_transport:
        device = Device.from_config_file_with_hci(
            sys.argv[1], hci_transport.source, hci_transport.sink
        )
        device.classic_enabled = True
        device.public_address = Address(bt_address)
        device.class_of_device = DEVICE_CLASS_GAMEPAD

        hid_device = HID_Device(device)
        hid_device.on("interrupt_data", on_hid_data_callback)
        connected = False

        logger.info(f"Device address: {device.public_address}")
        logger.info(f"Device name: {device.name}")

        async def on_connection(connection):
            nonlocal connected
            logger.info(f"Connected to {connection.peer_address}")
            connected = True

        device.on("connection", on_connection)

        device.sdp_service_records = sdp_record()

        await device.power_on()
        logging.info("Device powered on + SDP Records registered")

        await device.set_discoverable(True)
        await device.set_connectable(True)

        async def send_reports_task():
            nonlocal received_first_message
            nonlocal connected

            # while not pairing_event.is_set():
            while True:
                try:
                    if not connected:
                        await asyncio.sleep(0.01)
                        continue
                    else:
                        report = protocol.get_report()
                        hid_device.send_data(report)

                    if (
                        received_first_message
                        and protocol.vibration_enabled
                        and protocol.player_number is not None
                    ):
                        print("")
                        print("=" * 60)
                        print("✓ PAIRING COMPLETE!")
                        print("=" * 60)
                        print(f"  Player Number: {protocol.player_number}")
                        print(
                            f"  Vibration: {'Enabled' if protocol.vibration_enabled else 'Disabled'}"
                        )
                        print("=" * 60)
                        break

                    await asyncio.sleep(1 / 15)

                except Exception as e:
                    print(f"\n✗ Error in send_reports_task: {e}")
                    logger.error(f"Send reports task error: {e}")
                    await asyncio.sleep(1)

        send_task = asyncio.create_task(send_reports_task())

        # Block forever (until manual termination)
        await asyncio.Event().wait()


bumble.logging.setup_basic_logging("info")
asyncio.run(main())
