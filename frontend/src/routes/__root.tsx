import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { AppShell } from "@/src/components/app-shell";
import { SocketProvider } from "@/src/hooks/use-socket";
import { CaptureProvider } from "@/src/hooks/use-capture";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <SocketProvider>
      <CaptureProvider>
        <AppShell>
          <Outlet />
        </AppShell>
      </CaptureProvider>
      <TanStackRouterDevtools position="bottom-right" />
    </SocketProvider>
  );
}
