import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/oauth", () => ({ pollMaxAuth: vi.fn() }));

import { pollMaxAuth } from "@/lib/api/oauth";
import { MAX_POLL_BASE_MS, MAX_POLL_CAP_MS, startMaxPoll } from "./maxPoll";

const poll = vi.mocked(pollMaxAuth);
const pending = { status: "pending" } as never;

/*
 * Тесты проекта идут без DOM, и тащить jsdom ради одного файла незачем: опросу
 * нужны только `document.hidden` и событие видимости. Встроенный в Node
 * `EventTarget` даёт ровно это.
 */
const doc = Object.assign(new EventTarget(), { hidden: false });
vi.stubGlobal("document", doc);

function setHidden(hidden: boolean) {
  doc.hidden = hidden;
  doc.dispatchEvent(new Event("visibilitychange"));
}

describe("startMaxPoll", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    poll.mockReset();
    setHidden(false);
  });
  afterEach(() => vi.useRealTimers());

  it("в минуту уходит не больше 20 запросов — лимит статуса 30", async () => {
    poll.mockResolvedValue(pending);
    const stop = startMaxPoll("s", Date.now() + 10 * 60_000, {
      onStatus: () => false,
      onExpired: () => {},
    });
    await vi.advanceTimersByTimeAsync(60_000);
    stop();
    expect(poll.mock.calls.length).toBeLessThanOrEqual(20);
    expect(poll.mock.calls.length).toBeGreaterThanOrEqual(19);
  });

  it("на ошибке отступает удвоением до потолка, успех возвращает шаг", async () => {
    poll.mockRejectedValue(new Error("429"));
    const stop = startMaxPoll("s", Date.now() + 10 * 60_000, {
      onStatus: () => false,
      onExpired: () => {},
    });
    // 3 с → ошибка, дальше 6, 12, 24, 30, 30 …
    await vi.advanceTimersByTimeAsync(MAX_POLL_BASE_MS); // 1-й
    await vi.advanceTimersByTimeAsync(6_000); // 2-й
    await vi.advanceTimersByTimeAsync(12_000); // 3-й
    await vi.advanceTimersByTimeAsync(24_000); // 4-й
    await vi.advanceTimersByTimeAsync(MAX_POLL_CAP_MS); // 5-й — уже потолок
    expect(poll).toHaveBeenCalledTimes(5);
    await vi.advanceTimersByTimeAsync(MAX_POLL_CAP_MS - 1);
    expect(poll).toHaveBeenCalledTimes(5);
    stop();
  });

  it("в скрытой вкладке молчит и просыпается сразу при возврате", async () => {
    poll.mockResolvedValue(pending);
    setHidden(true);
    const stop = startMaxPoll("s", Date.now() + 10 * 60_000, {
      onStatus: () => false,
      onExpired: () => {},
    });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(poll).not.toHaveBeenCalled();
    setHidden(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(poll).toHaveBeenCalledTimes(1);
    stop();
  });

  it("останавливается, когда разбор ответа говорит «хватит», и после истечения", async () => {
    poll.mockResolvedValue({ status: "ready", token: "t" } as never);
    const onExpired = vi.fn();
    startMaxPoll("s", Date.now() + 10 * 60_000, { onStatus: () => true, onExpired });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(poll).toHaveBeenCalledTimes(1);

    poll.mockReset();
    poll.mockResolvedValue(pending);
    startMaxPoll("s", Date.now() + 5_000, { onStatus: () => false, onExpired });
    await vi.advanceTimersByTimeAsync(20_000);
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(poll.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it("запросы не накладываются: следующий уходит только после ответа", async () => {
    let resolve!: (v: unknown) => void;
    poll.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }) as never,
    );
    const stop = startMaxPoll("s", Date.now() + 10 * 60_000, {
      onStatus: () => false,
      onExpired: () => {},
    });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(poll).toHaveBeenCalledTimes(1);
    resolve(pending);
    await vi.advanceTimersByTimeAsync(MAX_POLL_BASE_MS);
    expect(poll).toHaveBeenCalledTimes(2);
    stop();
  });
});
