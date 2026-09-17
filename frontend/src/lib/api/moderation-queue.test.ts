import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Заявки на сообщество и канал в общей очереди модерации (17.09).
 *
 * Сервер отдаёт их строками очереди с типом `CommunityApplication` и
 * `ChannelApplication`. uuid у заявки нет, решение адресуется номером заявки.
 * До правки такая строка распознавалась как «публикация» с пустым адресом и
 * молча отбрасывалась фильтром `targetId !== ""` — модератор её не видел.
 */

const responses = new Map<string, unknown>();

vi.mock("./client", () => ({
  API_BASE_URL: "https://api.test/api/v1",
  ApiError: class extends Error {},
  getLocale: () => "ru",
  getToken: () => "token",
  api: vi.fn(async (path: string) => {
    if (!responses.has(path)) throw new Error(`unexpected ${path}`);
    const value = responses.get(path);
    if (value instanceof Error) throw value;
    return value;
  }),
}));

vi.mock("@/lib/demo-mode", () => ({ isDemoMode: () => false }));

beforeEach(() => responses.clear());

describe("fetchModerationQueue", () => {
  it("показывает заявки на сообщество и канал, а не отбрасывает их", async () => {
    responses.set("/admin/moderation/queue", {
      data: [
        {
          id: 501,
          queue: "community_applications",
          moderatable_type: "CommunityApplication",
          moderatable_id: 24,
          moderatable: {
            uuid: null,
            application_id: 24,
            title: "Пилоты",
            body: "Пилотажные модели",
            author: { display_name: "Никита" },
            category: { name: "Авиация" },
            details: [{ label: "Вступление", value: "по заявке" }],
            submitted_at: "2026-09-15T20:01:18+03:00",
            media: [],
          },
        },
        {
          id: 502,
          queue: "channel_applications",
          moderatable_type: "ChannelApplication",
          moderatable_id: 16,
          moderatable: { uuid: null, application_id: 16, title: "Броня", media: [] },
        },
      ],
    });
    const { fetchModerationQueue } = await import("./admin");

    const items = await fetchModerationQueue("pending");

    expect(items.map((i) => [i.type, i.targetId, i.title])).toEqual([
      ["community_applications", "24", "Пилоты"],
      ["channel_applications", "16", "Броня"],
    ]);
    expect(items[0].details).toEqual([{ label: "Вступление", value: "по заявке" }]);
  });
});

describe("fetchEntityRequests", () => {
  it("не выдаёт отказ сервера за пустой список заявок", async () => {
    responses.set("/admin/communities/applications", new Error("Server Error"));
    responses.set("/admin/channels/applications", { data: [] });
    const { fetchEntityRequests } = await import("./entity-requests");

    await expect(fetchEntityRequests("pending")).rejects.toThrow("Server Error");
  });
});
