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

    protocol = ControllerProtocol(ControllerTypes.PRO_CONTROLLER, bt_address)
    session = SwitchHIDSession(protocol)

    # def on_hid_control_channel(channel):
    #     logger.info("HID Control channel opened")

    #     def handle_control_data(data: bytes):
    #         logger.debug(f"CONTROL RX: {data.hex()}")
    #         # protocol.handle_control_packet(data)

    #     def handle_control_close():
    #         logger.info("HID Control channel closed")
    #         # protocol.detach_control_channel()

    #     channel.on("data", handle_control_data)
    #     channel.on("close", handle_control_close)

    #     # protocol.attach_control_channel(channel)

    # def on_hid_interrupt_channel(channel):
    #     logger.info("HID Interrupt channel opened")

    #     def handle_interrupt_data(data: bytes):
    #         logger.debug(f"INTERRUPT RX: {data.hex()}")
    #         # protocol.handle_interrupt_packet(data)

    #     def handle_interrupt_close():
    #         logger.info("HID Interrupt channel closed")
    #         # protocol.stop_input_spam()
    #         # protocol.detach_interrupt_channel()

    #     channel.on("data", handle_interrupt_data)
    #     channel.on("close", handle_interrupt_close)

    #     # protocol.attach_interrupt_channel(channel)

    #     # protocol.maybe_start_input_spam()

    async with await open_transport(sys.argv[2]) as hci_transport:
        device = Device.from_config_file_with_hci(
            sys.argv[1], hci_transport.source, hci_transport.sink
        )
        device.classic_enabled = True
        device.public_address = Address(bt_address)
        device.class_of_device = DEVICE_CLASS_GAMEPAD

        logger.info(f"Device address: {device.public_address}")
        logger.info(f"Device name: {device.name}")

        async def on_connection(connection):
            logger.info(f"Connected to {connection.peer_address}")

        device.on("connection", on_connection)

        device.sdp_service_records = sdp_record()

        device.create_l2cap_server(
            ClassicChannelSpec(psm=0x11), session.attach_control_channel
        )

        device.create_l2cap_server(
            ClassicChannelSpec(psm=0x13), session.attach_interrupt_channel
        )

        await device.power_on()
        logging.info("Device powered on + SDP Records registered")

        await device.set_discoverable(True)
        await device.set_connectable(True)

        # Block forever (until manual termination)
        await asyncio.Event().wait()


bumble.logging.setup_basic_logging("info")
asyncio.run(main())
