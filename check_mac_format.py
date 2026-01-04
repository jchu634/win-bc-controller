"""
Test to generate and check Switch-compatible MAC addresses
"""

import random


def generate_switch_mac():
    """
    Generate Switch-compatible MAC address (nxbt format)
    nxbt uses: 7C:BB:8A:XX:XX:XX
    where XX is random
    """

    def seg():
        return f"{random.randint(0, 255):02X}"

    return f"7C:BB:8A:{seg()}:{seg()}:{seg()}"


if __name__ == "__main__":
    print("Switch-compatible MAC format (from nxbt):")
    print("  Prefix: 7C:BB:8A")
    print("  Format: 7C:BB:8A:XX:XX:XX")
    print()
    print("Examples:")
    for i in range(5):
        print(f"  {generate_switch_mac()}")

    print()
    print("Check if your adapter's MAC matches this format")
    print("If not, you may need to spoof the MAC address")
