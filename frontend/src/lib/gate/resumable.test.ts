import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@/lib/session";

// Возврат после OAuth — это полная перезагрузка: замыкания действия уже нет,
// в sessionStorage лежит только намерение. Проверяем, что по нему действие
// выполняется, когда уровня хватает, и не выполняется, когда не хватает.

let session: Session | null = null;
vi.mock("@/lib/session", () => ({
  getSession: () => session,
  sessionQueryOptions: {},
}));
vi.mock("@/lib/session/queryClient", () => ({ getSessionQueryClient: () => null }));

const reactToPost = vi.fn(async () => undefined);
const joinCommunity = vi.fn(async () => ({ status: "member" as const }));
vi.mock("@/lib/api/feed", () => ({ reactToPost, bookmarkPost: vi.fn() }));
vi.mock("@/lib/api/communities", () => ({ joinCommunity }));
vi.mock("@/lib/api/listings", () => ({ addFavoriteListing: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ syncFavoritesFromServer: vi.fn() }));

const store = new Map<string, string>();
vi.stubGlobal("window", {
  sessionStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
  location: { pathname: "/login", search: "" },
});

const { resumeIntent } = await import("./resume");
const { saveIntent, readIntent } = await import("./intent");
const { resumableHandler, resumeIntentKey } = await import("./resumable");
const { closeGate, getGateState, setPendingAction } = await import("./gateStore");

function signedIn(phoneVerified: boolean, subscriptionActive: boolean): Session {
  return {
    user: {
      id: "u-1",
      name: "Тест",
      city: "",
      interests: "",
      avatar: "",
      phone_verified: phoneVerified,
    },
    phoneVerified,
    subscription: { active: subscriptionActive, plan: null, endsAt: null },
  };
}

beforeEach(() => {
  store.clear();
  session = null;
  closeGate();
  setPendingAction(null);
  reactToPost.mockClear();
  joinCommunity.mockClear();
});

describe("resumableHandler", () => {
  it("знает только ключи с префиксом и из списка", () => {
    expect(resumableHandler(resumeIntentKey("post.like"))).toBeTypeOf("function");
    expect(resumableHandler("action")).toBeNull();
    expect(resumableHandler("resume:post.delete")).toBeNull();
    expect(resumableHandler(undefined)).toBeNull();
  });
});

describe("resumeIntent после перезагрузки", () => {
  it("ставит лайк, возвращает на страницу и просит перечитать данные", async () => {
    saveIntent({
      key: resumeIntentKey("post.like"),
      params: { uuid: "p-1" },
      returnTo: "/feed",
      level: "registered",
    });
    session = signedIn(false, false);
    const navigate = vi.fn();
    const onReplayed = vi.fn();

    await resumeIntent(navigate, onReplayed);

    expect(reactToPost).toHaveBeenCalledWith("p-1", true);
    expect(onReplayed).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/feed");
    expect(readIntent()).toBeNull();
  });

  it("не вступает, если уровня не хватает, и оставляет намерение", async () => {
    saveIntent({
      key: resumeIntentKey("community.join"),
      params: { slug: "aviacia" },
      returnTo: "/communities/aviacia",
      level: "subscriber",
    });
    session = signedIn(true, false);

    await resumeIntent(vi.fn());

    expect(joinCommunity).not.toHaveBeenCalled();
    expect(readIntent()?.returnTo).toBe("/communities/aviacia");
    expect(getGateState().open).toBe("paywall");
  });

  it("не повторяет действие дважды, если замыкание ещё в памяти", async () => {
    saveIntent({
      key: resumeIntentKey("post.like"),
      params: { uuid: "p-1" },
      returnTo: "/feed",
      level: "registered",
    });
    session = signedIn(false, false);
    const run = vi.fn();
    setPendingAction({ level: "registered", run, intent: { key: "x", createdAt: Date.now() } });

    await resumeIntent(vi.fn());

    expect(run).toHaveBeenCalledTimes(1);
    expect(reactToPost).not.toHaveBeenCalled();
  });
});
