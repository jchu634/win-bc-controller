import { createFileRoute } from "@tanstack/react-router";

function About() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        About
      </h1>
    </div>
  );
}

export const Route = createFileRoute("/about")({
  component: About,
});
