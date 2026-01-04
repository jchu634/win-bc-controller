import time

import pygame


def run_joystick_only():
    # Initialize all pygame modules, or just joystick explicitly
    pygame.init()
    pygame.joystick.init()

    joystick_count = pygame.joystick.get_count()
    if joystick_count == 0:
        print("No joysticks found. Plug in a controller and restart.")
        return

    # Get the first joystick
    joystick = pygame.joystick.Joystick(0)
    joystick.init()
    print(f"Initialized Joystick: {joystick.get_name()}")

    try:
        while True:
            # Must call pump() or get() to process events
            pygame.event.pump()

            # --- Check Axes (Analog sticks) ---
            # Axes usually return a value between -1.0 and 1.0
            for i in range(joystick.get_numaxes()):
                axis_value = joystick.get_axis(i)
                if abs(axis_value) > 0.1:  # Filter out minor noise
                    print(f"Axis {i}: {axis_value:.2f}")

            # --- Check Buttons ---
            # Buttons usually return 0 for up, 1 for down
            for i in range(joystick.get_numbuttons()):
                if joystick.get_button(i):
                    print(f"Button {i} pressed")

            # --- Check Hats (D-pads) ---
            # Hats return a tuple (x, y) with values like (-1, 0), (1, 0), etc.
            for i in range(joystick.get_numhats()):
                hat_value = joystick.get_hat(i)
                if hat_value != (0, 0):
                    print(f"Hat {i}: {hat_value}")

            time.sleep(0.1)  # Small delay to prevent 100% CPU usage

    except KeyboardInterrupt:
        print("Exiting...")
    finally:
        joystick.quit()
        pygame.joystick.quit()
        pygame.quit()


if __name__ == "__main__":
    run_joystick_only()
