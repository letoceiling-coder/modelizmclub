import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Старый адрес комнаты. Страница отсюда уехала на `/categories/{slug}` —
 * направление и комната различаются глубиной узла, а не длиной адреса.
 *
 * Маршрут остаётся ради ссылок, которые уже разошлись: закладки, чужие
 * страницы, история браузера. Он ничего не рисует, только переадресует —
 * 301, потому что адрес сменился насовсем, и сказать об этом поисковику
 * надо кодом, а не заменой истории.
 *
 * Второй сегмент и есть комната, первый лишь называл её родителя, поэтому
 * разрешается второй, а первый не смотрится вовсе. Если комната не нашлась
 * — ведём на само направление: оно точно существует, раз ссылка была
 * построена, и там комната видна списком.
 */
export const Route = createFileRoute("/categories/$id/$subId")({
  beforeLoad: async ({ params }) => {
    const { resolveCategory } = await import("@/lib/api/categories");
    const room = await resolveCategory(params.subId);

    throw redirect({
      to: "/categories/$id",
      params: { id: room?.slug ?? params.id },
      code: 301,
    });
  },
});
