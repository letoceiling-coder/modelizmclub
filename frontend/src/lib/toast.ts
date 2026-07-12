// Internal toast facade.
//
// The whole app imports `toast` from here — never from "sonner" directly —
// so the toast implementation is decoupled behind this single module. Sonner
// can be swapped for a custom implementation later without touching any of the
// ~220 call-sites; only this file (and the <Toaster> mount in
// components/ui/sonner.tsx) would change.
//
// The used surface is intentionally small: toast() / toast.success / .error /
// .info / .message, each accepting an optional { description }.
export { toast } from "sonner";
