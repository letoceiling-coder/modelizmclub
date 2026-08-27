import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/rules")({
  component: () => <Outlet />,
});
