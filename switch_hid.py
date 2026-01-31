import asyncio
import logging

logger = logging.getLogger("switch_hid")


class SwitchHIDSession:
    def __init__(self, protocol):
        self.protocol = protocol

        self.control_channel = None
        self.interrupt_channel = None

        self._spam_task = None
        self._running = False

    # ---------- Channel attachment ----------

    def attach_control_channel(self, channel):
        logger.info("HID Control channel attached")
        self.control_channel = channel

        channel.on("data", self._on_control_data)
        channel.on("close", self._on_control_close)

    def attach_interrupt_channel(self, channel):
        logger.info("HID Interrupt channel attached")
        self.interrupt_channel = channel

        channel.on("close", self._on_interrupt_close)

        asyncio.create_task(self._maybe_start_spam())

    # ---------- Control channel handling ----------

    def _on_control_data(self, data: bytes):
        logger.debug(f"CONTROL RX: {data.hex()}")

        # Parse & update protocol state
        self.protocol.process_commands(data)

        # Immediate response (NXBT behavior)
        if self.interrupt_channel:
            response = self.protocol.get_report_no_clear()
            logger.debug(f"INTERRUPT TX (reply): {response.hex()}")
            self.interrupt_channel.send(response)

    def _on_control_close(self):
        logger.info("HID Control channel closed")
        self.control_channel = None

    # ---------- Interrupt channel handling ----------

    async def _maybe_start_spam(self):
        """
        Switch requires unsolicited input reports after interrupt opens.
        """

        logger.info("Starting input spam")
        self._running = True
        self._spam_task = asyncio.create_task(self._spam_loop())

    async def _spam_loop(self):
        try:
            while self._running:
                # Stop spamming once Switch asks for device info
                if self.protocol.device_info_queried:
                    logger.info("Device info requested, stopping spam")
                    break

                self.protocol.set_full_input_report()
                report = self.protocol.get_report()

                logger.debug(f"INTERRUPT TX (spam): {report.hex()}")
                self.interrupt_channel.send(report)

                await asyncio.sleep(0.05)  # ~200 Hz (NXBT‑like)

        except asyncio.CancelledError:
            pass

    def _on_interrupt_close(self):
        logger.info("HID Interrupt channel closed")
        self._running = False

        if self._spam_task:
            self._spam_task.cancel()
            self._spam_task = None

        self.interrupt_channel = None
