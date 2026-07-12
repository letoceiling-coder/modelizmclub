import { api } from "./client";
import { isDemoMode } from "@/lib/demo-mode";

export interface DocumentRequisites {
  full_name: string;
  inn: string;
  phone: string;
  address: string;
}

export async function fetchDocumentRequisites(): Promise<DocumentRequisites> {
  if (isDemoMode()) {
    const { getRequisites } = await import("@/lib/settings-prefs");
    const r = getRequisites();
    return {
      full_name: r.fullName,
      inn: r.inn,
      phone: r.phone,
      address: r.address,
    };
  }
  const res = await api<{ data: DocumentRequisites }>("/account/requisites");
  return res.data;
}

export async function saveDocumentRequisites(data: DocumentRequisites): Promise<void> {
  if (isDemoMode()) {
    const { setRequisites } = await import("@/lib/settings-prefs");
    setRequisites({
      fullName: data.full_name,
      inn: data.inn,
      phone: data.phone,
      address: data.address,
    });
    return;
  }
  await api("/account/requisites", { method: "PUT", json: data });
}

export async function requestEmailChange(newEmail: string): Promise<void> {
  if (isDemoMode()) return;
  await api("/account/email", { method: "POST", json: { new_email: newEmail } });
}

export async function resendVerificationEmail(): Promise<void> {
  if (isDemoMode()) return;
  await api("/account/resend-verification-email", { method: "POST" });
}

export async function resendEmailChangeVerification(): Promise<void> {
  if (isDemoMode()) return;
  await api("/account/email/verify/resend", { method: "POST" });
}
