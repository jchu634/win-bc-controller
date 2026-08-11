import random

NINTENDO_OUI = [0x98, 0xB6, 0xE9]
HEADER = [0x55, 0xAB, 0x23, 0x87, 0x09, 0x00, 0x30, 0x00, 0x06]


def generate_mac():
    return NINTENDO_OUI + [random.randint(0x00, 0xFF) for _ in range(3)]


def mac_to_reversed_bytes(mac):
    return list(reversed(mac))


def write_bin(filename, data):
    with open(filename, "wb") as f:
        f.write(bytes(data))


def main():
    mac = generate_mac()
    reversed_mac = mac_to_reversed_bytes(mac)
    final_bytes = HEADER + reversed_mac

    filename = "rtl8761bu_config.bin"
    write_bin(filename, final_bytes)

    mac_str = ":".join(f"{b:02X}" for b in mac)
    output_str = " ".join(f"{b:02X}" for b in final_bytes)

    print(f"Generated MAC: {mac_str}")
    print(f"Written to {filename}:")
    print(output_str)


if __name__ == "__main__":
    main()
