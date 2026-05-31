import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/g/$sessionId")({
  component: () => <Outlet />,
});
