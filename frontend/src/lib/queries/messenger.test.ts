import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { addMessageToCache, mergeMessages, replaceMessageInCache } from "./messenger";
import { qk } from "./keys";
import type { Message } from "@/lib/mock";

/*
 * Ключ пузыря не теряется при перечитывании (15.09): иначе только что
 * отправленное сообщение монтируется заново и проигрывает анимацию появления.
 */
const me = "user-a";
const base = (over: Partial<Message>): Message =>
  ({
    id: "x",
    authorId: me,
    time: "2026-09-15T10:00:00Z",
    text: "привет",
    status: "sent",
    ...over,
  }) as Message;

describe("mergeMessages — ключ пузыря", () => {
  it("перечитывание после замены tmp на серверное сохраняет clientKey", () => {
    const current = [base({ id: "srv-1", clientKey: "tmp100" })];
    const incoming = [base({ id: "srv-1" })];
    expect(mergeMessages(current, incoming)[0].clientKey).toBe("tmp100");
  });

  it("перечитывание до замены: серверный двойник получает ключ tmp, tmp не дублируется", () => {
    const current = [base({ id: "tmp200", clientKey: "tmp200" })];
    const incoming = [base({ id: "srv-2" })];
    const merged = mergeMessages(current, incoming);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("srv-2");
    expect(merged[0].clientKey).toBe("tmp200");
  });

  it("чужие сообщения и неподтверждённые tmp не трогает", () => {
    const current = [base({ id: "tmp300", clientKey: "tmp300", text: "ещё летит" })];
    const incoming = [base({ id: "srv-3", authorId: "user-b", text: "ответ" })];
    const merged = mergeMessages(current, incoming);
    expect(merged.map((m) => m.id)).toEqual(["srv-3", "tmp300"]);
    expect(merged[0].clientKey).toBeUndefined();
  });
});

describe("replaceMessageInCache — сокет раньше ответа на отправку", () => {
  it("сообщение уже пришло по сокету: ответ POST не перекладывает его и не снимает ключ", () => {
    const qc = new QueryClient();
    const conv = "c-1";
    qc.setQueryData(qk.messages(conv), [
      base({ id: "srv-0", text: "раньше" }),
      base({ id: "tmp400", clientKey: "tmp400" }),
    ]);
    // сокет: серверное сообщение встаёт на место черновика
    addMessageToCache(qc, conv, base({ id: "srv-4" }), { incrementUnread: false, meUuid: me });
    // ответ на POST
    replaceMessageInCache(qc, conv, "tmp400", base({ id: "srv-4" }));
    const list = qc.getQueryData<Message[]>(qk.messages(conv))!;
    expect(list.map((m) => m.id)).toEqual(["srv-0", "srv-4"]);
    expect(list[1].clientKey).toBe("tmp400");
  });
});
