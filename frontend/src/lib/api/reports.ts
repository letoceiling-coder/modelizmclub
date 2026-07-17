import { api } from "./client";

export type ReportType = "post" | "listing" | "comment" | "user" | "video" | "conversation" | "message";

export type ReportReason = "spam" | "offensive" | "adult" | "fraud" | "violence" | "copyright" | "other";

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "Спам",
  offensive: "Оскорбления",
  adult: "Нежелательный контент",
  fraud: "Мошенничество",
  violence: "Насилие",
  copyright: "Авторские права",
  other: "Другое",
};

/** UI labels from ComplaintDialog → API reason codes. */
export const COMPLAINT_REASON_TO_API: Record<string, ReportReason> = {
  Спам: "spam",
  Оскорбления: "offensive",
  Мошенничество: "fraud",
  "Нежелательный контент": "adult",
  Другое: "other",
};

export interface SubmitReportInput {
  type: ReportType;
  targetId: string;
  reason: ReportReason;
  description?: string;
}

export async function submitReport(input: SubmitReportInput): Promise<{ id: number; status: string }> {
  const res = await api<{ data: { id: number; status: string }; message?: string }>("/reports", {
    method: "POST",
    json: {
      type: input.type,
      target_id: input.targetId,
      reason: input.reason,
      description: input.description || null,
    },
  });
  return res.data;
}
