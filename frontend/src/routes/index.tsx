import { createFileRoute } from "@tanstack/react-router";
import { WebcamViewer } from "@/src/components/webcam-viewer";
import "@/src/App.css";

function App() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-4 py-10">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Capture Card Preview
        </h1>
      </header>
      <WebcamViewer />
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: App,
});
