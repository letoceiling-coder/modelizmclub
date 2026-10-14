import { api, ApiError } from "./client";
import { isDemoMode } from "@/lib/demo-mode";
import { GOALS, metrikaGoal } from "@/lib/analytics/metrika";
import { smsCodeLength } from "@/lib/api/bootstrap";

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

export type PhoneVerificationMode = "classic" | "mobile_id";
export type PhoneVerificationPhase =
  | "awaiting_push"
  | "otp_required"
  | "awaiting_sms"
  | "delivered"
  | "failed";

export type PhoneVerificationSendPayload = {
  message: string;
  session_id: string;
  verification_mode: PhoneVerificationMode;
  phase: PhoneVerificationPhase;
  code_length: number | null;
  hint: string;
  expires_in_minutes: number;
  resend_after: number;
  max_attempts: number;
  poll_interval_seconds: number;
};

export type PhoneVerificationSessionPayload = {
  session_id: string;
  verification_mode: PhoneVerificationMode;
  phase: PhoneVerificationPhase;
  code_length: number | null;
  hint: string;
  completed: boolean;
  failed: boolean;
};

export async function sendPhoneVerificationCode(phone: string): Promise<PhoneVerificationSendPayload> {
  if (isDemoMode())
    return {
      message: "Код отправлен по SMS.",
      session_id: "demo-session",
      verification_mode: "classic",
      phase: "awaiting_sms",
      code_length: smsCodeLength(),
      hint: "",
      expires_in_minutes: 10,
      resend_after: 60,
      max_attempts: 5,
      poll_interval_seconds: 2,
    };
  const res = await api<{ data: PhoneVerificationSendPayload }>("/account/phone/send-code", {
    method: "POST",
    json: { phone },
  });
  const data = res.data;
  return {
    ...data,
    resend_after: data.resend_after ?? 60,
    code_length: data.code_length ?? (data.verification_mode === "classic" ? smsCodeLength() : null),
    max_attempts: data.max_attempts ?? 5,
    poll_interval_seconds: data.poll_interval_seconds ?? 2,
  };
}

export async function fetchPhoneVerificationSession(
  sessionId: string,
): Promise<PhoneVerificationSessionPayload> {
  const res = await api<{ data: PhoneVerificationSessionPayload }>(
    `/account/phone/verification-session/${sessionId}`,
  );
  return res.data;
}

/**
 * Причина отказа в отправке: ждать, ждать дольше, менять номер — или дело в
 * нас.
 *
 * `sms_service_unavailable` добавлен 09.10 по решению Ж5: до него любой
 * отказ шлюза приходил как `sms_provider_rejected` с текстом про номер, в
 * том числе когда у нас не было ключей, не согласована подпись отправителя
 * или кончились деньги. Теперь про номер говорится только тогда, когда это
 * сказал сам шлюз.
 */
export type SmsRefusalCode =
  "sms_cooldown" | "sms_rate_limited" | "sms_provider_rejected" | "sms_service_unavailable";

/**
 * Разбирает отказ отправки: сколько ждать и можно ли вообще дождаться.
 *
 * Отказ оператора отличается от предела тем, что срока у него нет: сколько ни
 * жди, этот номер не примут. Поэтому `retryAfter` там `0` — кнопку блокировать
 * не надо, надо дать исправить номер.
 */
/**
 * Отказ в отправке SMS: почему и сколько ждать.
 *
 * Читаются и 422 (пауза, счётчик, отказ оператора), и 429 от маршрутного
 * ограничителя. Раньше 429 не разбирался и отвечал нулём — кнопка
 * разблокировалась, пока сервер ещё отказывал, и человек получал новый
 * отказ вместо кода.
 */
export function readSmsRefusal(err: unknown): { code?: SmsRefusalCode; retryAfter: number } {
  if (!(err instanceof ApiError) || (err.status !== 422 && err.status !== 429)) {
    return { retryAfter: 0 };
  }
  const payload = err.payload as { code?: SmsRefusalCode; retry_after?: number | null } | undefined;
  return {
    code: payload?.code,
    retryAfter: Math.max(0, Number(payload?.retry_after ?? 0)),
  };
}

export async function verifyPhoneCode(
  phone: string,
  code: string,
  sessionId?: string | null,
): Promise<import("@/lib/mock").User> {
  if (isDemoMode()) {
    const { DEMO_USER } = await import("@/lib/demo-data");
    return { ...DEMO_USER, phone, phone_verified: true };
  }
  const res = await api<{ data: import("@/lib/api/auth").ApiUser }>("/account/phone/verify", {
    method: "POST",
    json: { phone, code, ...(sessionId ? { session_id: sessionId } : {}) },
  });
  const { mapApiUser } = await import("@/lib/api/auth");
  // Цель ставится здесь, а не у кнопки: телефон подтверждают из трёх мест
  // (регистрация, настройки, шлюз доступа), и у каждой кнопки это пришлось
  // бы повторить. Ответ сервера — единственное доказательство события.
  metrikaGoal(GOALS.phoneVerified);
  return mapApiUser(res.data);
}
