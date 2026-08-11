import { WebcamViewer } from "@/components/webcam-viewer";
import "./App.css";

function App() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-4 py-10">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Capture Card Preview
        </h1>
        <p className="text-sm text-muted-foreground">
          Select a capture device and preview the live signal.
        </p>
      </header>
      <WebcamViewer />
    </div>
  );
}

export default App;
