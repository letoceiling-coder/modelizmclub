import { api, ApiError } from "./client";
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

/** Подтверждение смены email кодом из письма. Сервер ждёт ровно 6 знаков. */
export async function confirmEmailChange(code: string): Promise<void> {
  if (isDemoMode()) return;
  await api("/account/confirm-email", { method: "POST", json: { code } });
}

export async function resendEmailChangeVerification(): Promise<void> {
  if (isDemoMode()) return;
  await api("/account/email/verify/resend", { method: "POST" });
}

export async function sendPhoneVerificationCode(
  phone: string,
): Promise<{ expires_in_minutes: number; resend_after: number }> {
  if (isDemoMode()) return { expires_in_minutes: 10, resend_after: 60 };
  const res = await api<{
    data: { message: string; expires_in_minutes: number; resend_after?: number };
  }>("/account/phone/send-code", { method: "POST", json: { phone } });
  return {
    expires_in_minutes: res.data.expires_in_minutes,
    // Сервер знает паузу, клиент только показывает. 60 — на случай старого
    // ответа без поля, чтобы кнопка всё равно блокировалась.
    resend_after: res.data.resend_after ?? 60,
  };
}

/** Причина отказа в отправке: ждать, ждать дольше или менять номер. */
export type SmsRefusalCode = "sms_cooldown" | "sms_rate_limited" | "sms_provider_rejected";

/**
 * Разбирает отказ отправки: сколько ждать и можно ли вообще дождаться.
 *
 * Отказ оператора отличается от предела тем, что срока у него нет: сколько ни
 * жди, этот номер не примут. Поэтому `retryAfter` там `0` — кнопку блокировать
 * не надо, надо дать исправить номер.
 */
export function readSmsRefusal(err: unknown): { code?: SmsRefusalCode; retryAfter: number } {
  if (!(err instanceof ApiError) || err.status !== 422) return { retryAfter: 0 };
  const payload = err.payload as { code?: SmsRefusalCode; retry_after?: number | null } | undefined;
  return {
    code: payload?.code,
    retryAfter: Math.max(0, Number(payload?.retry_after ?? 0)),
  };
}

export async function verifyPhoneCode(
  phone: string,
  code: string,
): Promise<import("@/lib/mock").User> {
  if (isDemoMode()) {
    const { DEMO_USER } = await import("@/lib/demo-data");
    return { ...DEMO_USER, phone, phone_verified: true };
  }
  const res = await api<{ data: import("@/lib/api/auth").ApiUser }>("/account/phone/verify", {
    method: "POST",
    json: { phone, code },
  });
  const { mapApiUser } = await import("@/lib/api/auth");
  return mapApiUser(res.data);
}
