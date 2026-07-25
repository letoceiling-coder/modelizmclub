import { createFileRoute } from "@tanstack/react-router";

const VK_CALLBACK_API = `${(
  import.meta.env.VITE_API_BASE_URL || "https://api.modelizmclub.ru/api/v1"
).replace(/\/$/, "")}/auth/oauth/vk/callback`;

/** VK ID redirects here (modelizmclub.ru); forward to API before React hydrates. */
export const Route = createFileRoute("/oauth/vk/callback")({
  head: () => ({
    meta: [{ title: "Вход через VK — МоДелизМ" }],
    scripts: [
      {
        children: `window.location.replace(${JSON.stringify(VK_CALLBACK_API)} + window.location.search);`,
      },
    ],
  }),
  component: VkOAuthCallbackPage,
});

function VkOAuthCallbackPage() {
  return (
    <div className="grid min-h-[40vh] place-items-center px-4">
      <p className="text-muted-foreground text-sm">Вход через VK…</p>
      <noscript>
        <a href={VK_CALLBACK_API}>Продолжить вход через VK</a>
      </noscript>
    </div>
  );
}
