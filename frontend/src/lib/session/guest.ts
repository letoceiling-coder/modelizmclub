import type { User } from "@/lib/mock";

// Neutral placeholder used before the session is restored / when signed out.
// Carries no mock identity so nothing fake ever reaches the UI.
export const GUEST_USER: User = {
  id: "guest",
  name: "Гость",
  city: "",
  interests: "",
  avatar: "",
};
