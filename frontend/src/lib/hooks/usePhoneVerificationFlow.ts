import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMe } from "@/lib/api/auth";
import {
  fetchPhoneVerificationSession,
  sendPhoneVerificationCode,
  verifyPhoneCode,
  type PhoneVerificationPhase,
  type PhoneVerificationSendPayload,
} from "@/lib/api/account";
import { smsCodeLength } from "@/lib/api/bootstrap";
import type { User } from "@/lib/mock";

type Options = {
  onVerified: (user: User) => void;
};

export function usePhoneVerificationFlow({ onVerified }: Options) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phase, setPhase] = useState<PhoneVerificationPhase | null>(null);
  const [hint, setHint] = useState<string>("");
  const [codeLength, setCodeLength] = useState<number>(() => smsCodeLength());
  const [pollMs, setPollMs] = useState(2000);
  const [polling, setPolling] = useState(false);
  const [needsCodeInput, setNeedsCodeInput] = useState(false);
  const [waitingPush, setWaitingPush] = useState(false);
  const onVerifiedRef = useRef(onVerified);
  onVerifiedRef.current = onVerified;

  const applySession = useCallback((data: PhoneVerificationSendPayload | { phase: PhoneVerificationPhase; code_length: number | null; hint: string; completed?: boolean; failed?: boolean }) => {
    setPhase(data.phase);
    setHint(data.hint ?? "");
    if (data.code_length != null) setCodeLength(data.code_length);
    const failed = "failed" in data && data.failed === true;
    const completed = "completed" in data && data.completed === true;
    setWaitingPush(data.phase === "awaiting_push" && !completed && !failed);
    setNeedsCodeInput(
      !completed &&
        !failed &&
        (data.phase === "otp_required" || data.phase === "awaiting_sms"),
    );
    if (failed) setPolling(false);
  }, []);

  const finishFromWebhook = useCallback(async () => {
    setPolling(false);
    const user = await fetchMe();
    onVerifiedRef.current(user);
  }, []);

  useEffect(() => {
    if (!sessionId || !polling) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const data = await fetchPhoneVerificationSession(sessionId);
        if (cancelled) return;
        applySession(data);
        if (data.completed) {
          await finishFromWebhook();
        }
        if (data.failed) setPolling(false);
      } catch {
        /* poll again */
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [sessionId, polling, pollMs, applySession, finishFromWebhook]);

  const resetFlow = useCallback(() => {
    setSessionId(null);
    setPhase(null);
    setHint("");
    setCodeLength(smsCodeLength());
    setPolling(false);
    setNeedsCodeInput(false);
    setWaitingPush(false);
  }, []);

  const send = useCallback(async (phone: string) => {
    const data = await sendPhoneVerificationCode(phone);
    setSessionId(data.session_id);
    setPollMs(Math.max(1000, data.poll_interval_seconds * 1000));
    applySession(data);
    if (data.verification_mode === "mobile_id" && data.code_length != null) {
      setCodeLength(data.code_length);
    }
    setPolling(data.verification_mode === "mobile_id");
    return data;
  }, [applySession]);

  const verify = useCallback(
    async (phone: string, code: string) => {
      const user = await verifyPhoneCode(phone, code, sessionId);
      setPolling(false);
      onVerifiedRef.current(user);
      return user;
    },
    [sessionId],
  );

  return {
    sessionId,
    phase,
    hint,
    codeLength,
    needsCodeInput,
    waitingPush,
    send,
    verify,
    resetFlow,
  };
}
