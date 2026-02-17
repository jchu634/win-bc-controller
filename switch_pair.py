# Pro Controller Pairing POC for Nintendo Switch
# Ported from nxbt for Bumble framework

import asyncio
import logging
import sys

import bumble.logging
from bumble.device import Device
from bumble.hci import Address
from bumble.hid import Device as HID_Device
from bumble.hid import Message
from bumble.transport import open_transport

from controller import ControllerTypes
from sdp_records import sdp_record
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


def handle_virtual_cable_unplug(hid_device: HID_Device, device: Device):
    async def _handle():
        hid_host_bd_addr = str(hid_device.remote_device_bd_address)
        await hid_device.disconnect_interrupt_channel()
        await hid_device.disconnect_control_channel()
        if device.keystore:
            await device.keystore.delete(hid_host_bd_addr)
        connection = hid_device.connection
        if connection is not None:
            await connection.disconnect()

    return _handle()


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

    bt_address = reverse_mac_to_little_endian(bt_address)

    # Pairing state tracking
    pairing_event = asyncio.Event()
    received_first_message = False
    packet_count = 0
    hid_ready = False

    # Pro Controller expects this exact class
    DEVICE_CLASS_GAMEPAD = 0x002508
    protocol = ControllerProtocol(ControllerTypes.PRO_CONTROLLER, bt_address)

    def on_hid_data_cb(pdu: bytes):
        nonlocal received_first_message

        packet_log = format_switch_msg(pdu, "RX")
        logger.debug(packet_log)

        # Track when we receive first actual Switch message
        if pdu is not None:
            print("RECEIVED SWITCH MESSAGE")
            received_first_message = True

        if len(pdu) > 40:
            print(f"  [RX] Switch command: 0x{' '.join(f'{b:02x}' for b in pdu)}")

        # Process Switch command and generate immediate response
        protocol.process_commands(pdu)
        report = protocol.get_report_no_clear()

        if len(report) > 1:
            tx_log = format_switch_msg(report, "TX")
            hid_device.send_data(report)
            logger.debug(tx_log)
            if len(report) > 20:
                print(f"  [TX] Response sent ({len(report)} bytes)")

    def on_get_report_cb(
        report_id: int, report_type: int, buffer_size: int
    ) -> HID_Device.GetSetStatus:
        EXPECTED_LENGTHS = {0x21: 48, 0x30: 48}
        retValue = hid_device.GetSetStatus()

        logger.info(
            f"GET_REPORT: ID=0x{report_id:02X}, Type={report_type}, Size={buffer_size}"
        )

        if report_type == Message.ReportType.INPUT_REPORT:
            if report_id == 0x21:
                protocol.set_subcommand_reply()
                data = bytes(protocol.get_report_no_clear()[1:])
                retValue.data = data[: EXPECTED_LENGTHS[0x21]]
                retValue.status = hid_device.GetSetReturn.SUCCESS
                print(f"  [GET] Subcommand reply (0x21)")
            elif report_id == 0x30:
                protocol.set_full_input_report()
                data = bytes(protocol.get_report_no_clear()[1:])
                retValue.data = data[: EXPECTED_LENGTHS[0x30]]
                retValue.status = hid_device.GetSetReturn.SUCCESS
                print(f"  [GET] Full input report (0x30)")
            else:
                retValue.status = hid_device.GetSetReturn.REPORT_ID_NOT_FOUND

            if buffer_size:
                data_len = buffer_size - 1
                retValue.data = retValue.data[:data_len]
        else:
            retValue.status = hid_device.GetSetReturn.ERR_INVALID_PARAMETER

        return retValue

    def on_set_protocol_cb(protocol_mode):
        nonlocal hid_ready
        logger.info(f"SET_PROTOCOL: {protocol_mode}")
        hid_ready = True
        return HID_Device.GetSetStatus(status=hid_device.GetSetReturn.SUCCESS)

    def on_set_report_cb(
        report_id: int, report_type: int, report_size: int, data: bytes
    ) -> HID_Device.GetSetStatus:
        logger.info(
            f"SET_REPORT: ID=0x{report_id:02X}, Type={report_type}, Size={report_size}"
        )

        if report_type == Message.ReportType.OUTPUT_REPORT:
            retValue = hid_device.GetSetStatus(status=hid_device.GetSetReturn.SUCCESS)
        elif report_type == Message.ReportType.FEATURE_REPORT:
            retValue = hid_device.GetSetStatus(
                status=hid_device.GetSetReturn.ERR_INVALID_PARAMETER
            )
        else:
            retValue = hid_device.GetSetStatus(status=hid_device.GetSetReturn.SUCCESS)

        return retValue

    def on_virtual_cable_unplug_cb():
        print("\n! Virtual cable unplug received")
        logger.warning("Virtual cable unplug received")

    async with await open_transport(sys.argv[2]) as hci_transport:
        logger.info(f"Transport: {sys.argv[2]}")

        # Create a device
        device = Device.from_config_file_with_hci(
            sys.argv[1], hci_transport.source, hci_transport.sink
        )

        device.classic_enabled = True
        device.public_address = Address(bt_address)
        device.keystore = None

        # Critical: Switch is extremely sensitive to this
        device.class_of_device = DEVICE_CLASS_GAMEPAD

        logger.info(f"Device address: {device.public_address}")
        logger.info(f"Device class: 0x{device.class_of_device:04X}")
        logger.info(f"Device name: {device.name}")

        # Create and register HID Device
        hid_device = HID_Device(device)

        async def on_connection(connection):
            logger.info(f"Connection from: {connection.peer_address}")

        device.on("connection", on_connection)

        # Register for call backs
        hid_device.on("interrupt_data", on_hid_data_cb)

        hid_device.register_get_report_cb(on_get_report_cb)
        hid_device.register_set_report_cb(on_set_report_cb)
        hid_device.register_set_protocol_cb(on_set_protocol_cb)

        # Register for virtual cable unplug call back
        hid_device.on("virtual_cable_unplug", on_virtual_cable_unplug_cb)

        # Setup the SDP to advertise HID Device service
        device.sdp_service_records = sdp_record()

        logging.debug(f"Device class: 0x{device.class_of_device:04X}")
        logging.debug(f"Device name: {device.name}")

        # Start the controller
        await device.power_on()
        logging.info("Device powered on + SDP Records registered")

        # Start being discoverable and connectable
        await device.set_discoverable(True)
        await device.set_connectable(True)

        print("")
        print("Waiting for Switch connection...")
        print("  On Switch, go to: Controllers > Change Grip/Order")
        print("")
        print("-" * 60)
        print("  [STATUS] Starting background report task")
        print("-" * 60)

        async def send_reports_task():
            nonlocal packet_count
            nonlocal received_first_message

            while not pairing_event.is_set():
                try:
                    report = protocol.get_report()
                    hid_device.send_data(report)

                    if not hid_ready:
                        await asyncio.sleep(0.01)
                        continue

                    packet_count += 1

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
                        print(f"  Packets Exchanged: {packet_count}")
                        print("=" * 60)
                        pairing_event.set()
                        break
                    else:
                        if packet_count % 30 == 0 and packet_count > 0:
                            print(
                                f"  [STATUS] Waiting... ({packet_count} packets sent)"
                            )

                    if packet_count < 100:
                        await asyncio.sleep(0.002)
                    else:
                        await asyncio.sleep(1 / 15)

                except Exception as e:
                    print(f"\n✗ Error in send_reports_task: {e}")
                    logger.error(f"Send reports task error: {e}")
                    await asyncio.sleep(1)

        send_task = asyncio.create_task(send_reports_task())

        try:
            await pairing_event.wait()
            print("")
            print("✓ Pairing complete - keeping connection alive")
            print("  [STATUS] Press Ctrl+C to exit")
            print("")

            try:
                while True:
                    if protocol.device_info_queried:
                        protocol.set_full_input_report()
                        report = protocol.get_report()
                        hid_device.send_data(report)

                    await asyncio.sleep(1 / 132)
            except KeyboardInterrupt:
                print("\n\n✓ Exiting gracefully...")
                logger.info("User requested exit")
        finally:
            if not send_task.done():
                send_task.cancel()
                try:
                    await send_task
                except asyncio.CancelledError:
                    pass


bumble.logging.setup_basic_logging("info")
asyncio.run(main())
