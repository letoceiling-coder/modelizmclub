import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@/lib/session";
import type { User } from "@/lib/mock";

// The gate reads exactly one input: the ['session'] cache. Everything below
// exercises the four viewer states the product defines.
let session: Session | null = null;

vi.mock("@/lib/session", () => ({
  getSession: () => session,
  useSession: () => ({ data: session, isPending: false }),
}));

const { levelOf, meets, firstFailingStep } = await import("./levels");
const { gateRequire } = await import("./useGate");
const { closeGate, getGateState, setPendingAction, takePendingAction } =
  await import("./gateStore");

function makeSession(over: {
  phoneVerified?: boolean;
  subscriptionActive?: boolean;
  role?: User["role"];
}): Session {
  return {
    user: {
      id: "u-1",
      name: "Тест",
      city: "",
      interests: "",
      avatar: "",
      phone_verified: over.phoneVerified ?? false,
      ...(over.role ? { role: over.role } : {}),
    },
    phoneVerified: over.phoneVerified ?? false,
    subscription: { active: over.subscriptionActive ?? false, plan: null, endsAt: null },
  };
}

const STATES = {
  guest: null,
  registered: makeSession({}),
  verified: makeSession({ phoneVerified: true }),
  subscriber: makeSession({ phoneVerified: true, subscriptionActive: true }),
} as const;

beforeEach(() => {
  session = null;
  closeGate();
  setPendingAction(null);
});

describe("levelOf", () => {
  it("maps each viewer state to its rung", () => {
    expect(levelOf(STATES.guest)).toBe("guest");
    expect(levelOf(STATES.registered)).toBe("registered");
    expect(levelOf(STATES.verified)).toBe("verified");
    expect(levelOf(STATES.subscriber)).toBe("subscriber");
  });

  it("treats staff as a subscriber (no SMS, no paywall)", () => {
    expect(levelOf(makeSession({ role: "admin" }))).toBe("subscriber");
    expect(levelOf(makeSession({ role: "moderator" }))).toBe("subscriber");
  });
});

describe("meets", () => {
  const table: Array<[keyof typeof STATES, boolean, boolean, boolean]> = [
    // state                 guest  verified subscriber
    ["guest", true, false, false],
    ["registered", true, false, false],
    ["verified", true, true, false],
    ["subscriber", true, true, true],
  ];

  it.each(table)("%s meets guest/verified/subscriber", (state, guest, verified, subscriber) => {
    const have = levelOf(STATES[state]);
    expect(meets(have, "guest")).toBe(guest);
    expect(meets(have, "verified")).toBe(verified);
    expect(meets(have, "subscriber")).toBe(subscriber);
  });
});

describe("firstFailingStep", () => {
  it("shows the login window to a guest — never verification or a paywall", () => {
    const have = levelOf(STATES.guest);
    expect(firstFailingStep(have, "verified")).toBe("auth");
    expect(firstFailingStep(have, "subscriber")).toBe("auth");
    expect(firstFailingStep(have, "guest")).toBeNull();
  });

  it("asks a signed-in user without SMS to verify", () => {
    const have = levelOf(STATES.registered);
    expect(firstFailingStep(have, "verified")).toBe("verify");
    expect(firstFailingStep(have, "subscriber")).toBe("verify");
  });

  it("shows the subscription window — not verification — to a verified user", () => {
    const have = levelOf(STATES.verified);
    expect(firstFailingStep(have, "verified")).toBeNull();
    expect(firstFailingStep(have, "subscriber")).toBe("paywall");
  });

  it("never refuses a subscriber", () => {
    const have = levelOf(STATES.subscriber);
    expect(firstFailingStep(have, "subscriber")).toBeNull();
  });
});

describe("gateRequire", () => {
  it("runs the action immediately when the level is already met", async () => {
    session = STATES.subscriber;
    const action = vi.fn();

    await expect(gateRequire("subscriber", action)).resolves.toBe(true);

    expect(action).toHaveBeenCalledTimes(1);
    expect(getGateState().open).toBeNull();
    expect(takePendingAction()).toBeNull();
  });

  it("holds the action and opens the login window for a guest", async () => {
    session = STATES.guest;
    const action = vi.fn();

    await expect(gateRequire("subscriber", action)).resolves.toBe(false);

    expect(action).not.toHaveBeenCalled();
    expect(getGateState().open).toBe("auth");
    const pending = takePendingAction();
    expect(pending?.level).toBe("subscriber");
    await pending?.run();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("opens verification for a signed-in user without SMS", async () => {
    session = STATES.registered;
    const action = vi.fn();

    await gateRequire("verified", action);

    expect(action).not.toHaveBeenCalled();
    expect(getGateState().open).toBe("verify");
    expect(takePendingAction()?.level).toBe("verified");
  });

  it("opens the subscription window for a verified user on a premium action", async () => {
    session = STATES.verified;
    const action = vi.fn();

    await gateRequire("subscriber", action);

    expect(action).not.toHaveBeenCalled();
    expect(getGateState().open).toBe("paywall");
    expect(takePendingAction()?.level).toBe("subscriber");
  });

  it("lets a verified user through a verified-level action", async () => {
    session = STATES.verified;
    const action = vi.fn();

    await expect(gateRequire("verified", action)).resolves.toBe(true);

    expect(action).toHaveBeenCalledTimes(1);
    expect(getGateState().open).toBeNull();
  });
});
