import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/categories/$id")({
  component: () => <Outlet />,
});
