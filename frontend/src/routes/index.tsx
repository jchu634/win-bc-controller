import { createFileRoute } from "@tanstack/react-router";
import { WebcamViewer } from "@/src/components/webcam-viewer";
import "@/src/App.css";

function App() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-4 py-10">
      <WebcamViewer />
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: App,
});
