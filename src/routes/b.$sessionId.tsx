import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/b/$sessionId")({
  component: () => <Outlet />,
});
