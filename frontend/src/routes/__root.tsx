import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { AppShell } from "@/src/components/app-shell";
import { SocketProvider } from "@/src/hooks/use-socket";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <SocketProvider>
      <AppShell>
        <Outlet />
      </AppShell>
      <TanStackRouterDevtools position="bottom-right" />
    </SocketProvider>
  );
}
