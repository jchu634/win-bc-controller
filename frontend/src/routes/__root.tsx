import { Outlet, createRootRoute } from "@tanstack/react-router";
import { SocketProvider } from "@/src/hooks/use-socket";
import { CaptureProvider } from "@/src/hooks/use-capture";
import { TooltipProvider } from "@/src/components/ui/tooltip";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <SocketProvider>
      <CaptureProvider>
        {/*<AppShell>*/}
        <TooltipProvider>
          <Outlet />
        </TooltipProvider>
        {/*</AppShell>*/}
      </CaptureProvider>
      {/*<TanStackRouterDevtools position="bottom-right" />*/}
    </SocketProvider>
  );
}
