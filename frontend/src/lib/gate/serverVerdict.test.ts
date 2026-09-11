import { describe, expect, it } from "vitest";

import { controlForServerVerdict } from "./levels";

describe("controlForServerVerdict", () => {
  it("shows the button whenever the server allows or says nothing", () => {
    for (const viewer of ["guest", "registered", "verified", "subscriber"] as const) {
      expect(controlForServerVerdict(viewer, true)).toBe("show");
      expect(controlForServerVerdict(viewer, undefined)).toBe("show");
    }
  });

  it("keeps the button for a guest — the click opens the login window", () => {
    expect(controlForServerVerdict("guest", false)).toBe("show");
  });

  it("keeps the button for a user without SMS — the click asks to verify the phone", () => {
    expect(controlForServerVerdict("registered", false)).toBe("verify");
  });

  it("hides the button when a verified viewer is refused on the merits", () => {
    expect(controlForServerVerdict("verified", false)).toBe("hide");
    expect(controlForServerVerdict("subscriber", false)).toBe("hide");
  });
});
